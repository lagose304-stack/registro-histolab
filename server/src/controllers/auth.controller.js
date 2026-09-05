import jwt from "jsonwebtoken";
import crypto from "crypto";
import dotenv from "dotenv";
import { supabase, isSupabaseConfigured } from "../db/supabase.js";

dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET || "histolab_default_secret_key_2026";
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_MINUTES = 5;

// Cache en memoria para bloqueos temporales por intentos fallidos
const failedAttemptsMap = new Map();

function generateToken(instructor, sessionId) {
  return jwt.sign(
    {
      id: instructor.id,
      correo: instructor.correo,
      numero_cuenta: instructor.numero_cuenta,
      primer_nombre: instructor.primer_nombre,
      segundo_nombre: instructor.segundo_nombre || "",
      primer_apellido: instructor.primer_apellido,
      segundo_apellido: instructor.segundo_apellido || "",
      comite: instructor.comite || "",
      rol: instructor.rol || "Instructor",
      seccion: instructor.seccion || "",
      coordinacion: instructor.coordinacion || "",
      session_id: sessionId
    },
    JWT_SECRET,
    { expiresIn: "7d" }
  );
}

// Cache en memoria para perfiles de instructores autenticados (TTL: 60s)
const instructorCache = new Map();
const INSTRUCTOR_CACHE_TTL_MS = 60 * 1000;

export const clearInstructorAuthCache = () => {
  instructorCache.clear();
};

// Función para obtener el instructor desde la tabla public.instructores
export const getInstructorByIdOrEmail = async (id, email) => {
  const cacheKey = `${id || ""}_${email || ""}`.toLowerCase();
  const cached = instructorCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.data;
  }

  if (isSupabaseConfigured && supabase) {
    try {
      const { data, error } = await supabase
        .from("instructores")
        .select("*")
        .or(`id.eq.${id},correo.ilike.${email}`)
        .maybeSingle();

      if (!error && data) {
        const fullProfile = {
          ...data,
          nombre_completo: `${data.primer_nombre} ${data.segundo_nombre ? data.segundo_nombre + ' ' : ''}${data.primer_apellido} ${data.segundo_apellido || ''}`.trim()
        };
        instructorCache.set(cacheKey, {
          data: fullProfile,
          expiresAt: Date.now() + INSTRUCTOR_CACHE_TTL_MS
        });
        return fullProfile;
      }
    } catch (_) {}
  }
  return null;
};

// Iniciar sesión (Supabase Auth + Tabla public.instructores)
export const loginInstructor = async (req, res) => {
  try {
    const { email, password } = req.body;
    const clientIp = req.headers["x-forwarded-for"] || req.socket.remoteAddress || "127.0.0.1";
    const userAgent = req.headers["user-agent"] || "Desconocido";

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Por favor proporciona tu correo o número de cuenta y contraseña"
      });
    }

    if (!isSupabaseConfigured || !supabase) {
      return res.status(500).json({
        success: false,
        message: "Supabase no está configurado en el archivo server/.env"
      });
    }

    const userInput = email.trim();
    let targetEmail = userInput.toLowerCase();

    // 1. Si el usuario ingresó su Número de Cuenta en lugar de un correo:
    if (!userInput.includes("@")) {
      const { data: profileByAccount, error: accError } = await supabase
        .from("instructores")
        .select("correo")
        .eq("numero_cuenta", userInput)
        .maybeSingle();

      if (accError || !profileByAccount?.correo) {
        return res.status(401).json({
          success: false,
          message: `No se encontró ningún instructor registrado con el número de cuenta "${userInput}".`
        });
      }
      targetEmail = profileByAccount.correo.toLowerCase();
    }

    // 2. Control de Fuerza Bruta / Bloqueo Temporal
    const attemptRecord = failedAttemptsMap.get(targetEmail);
    if (attemptRecord && attemptRecord.lockedUntil && attemptRecord.lockedUntil > Date.now()) {
      const remainingMinutes = Math.ceil((attemptRecord.lockedUntil - Date.now()) / (60 * 1000));
      return res.status(429).json({
        success: false,
        message: `Cuenta bloqueada temporalmente por intentos fallidos. Intenta de nuevo en ${remainingMinutes} minuto(s).`
      });
    }

    // 3. Autenticación contra Supabase Auth (auth.users)
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email: targetEmail,
      password: password
    });

    if (authError || !authData?.user) {
      const currentAttempts = (attemptRecord?.count || 0) + 1;
      let lockedUntil = null;
      if (currentAttempts >= MAX_FAILED_ATTEMPTS) {
        lockedUntil = Date.now() + LOCKOUT_MINUTES * 60 * 1000;
      }
      failedAttemptsMap.set(targetEmail, { count: currentAttempts, lockedUntil });

      if (currentAttempts >= MAX_FAILED_ATTEMPTS) {
        return res.status(429).json({
          success: false,
          message: `Has superado el límite de intentos fallidos. Acceso bloqueado por ${LOCKOUT_MINUTES} minutos por seguridad.`
        });
      }

      return res.status(401).json({
        success: false,
        message: "Credenciales inválidas. Verifica tu correo/número de cuenta y contraseña."
      });
    }

    // Resetear intentos fallidos
    failedAttemptsMap.delete(targetEmail);

    const userId = authData.user.id;

    // 4. Obtener los datos del instructor desde la tabla public.instructores
    const { data: instructorProfile, error: profileError } = await supabase
      .from("instructores")
      .select("*")
      .eq("id", userId)
      .maybeSingle();

    if (profileError || !instructorProfile) {
      return res.status(404).json({
        success: false,
        message: `Usuario autenticado en Supabase Auth, pero no se encontraron sus datos en la tabla 'instructores' (ID: ${userId}). Asegúrate de agregarlo a la tabla.`
      });
    }

    if (!instructorProfile.activo) {
      return res.status(403).json({
        success: false,
        message: "Esta cuenta de instructor se encuentra desactivada."
      });
    }

    // 5. 🔒 Generar token de sesión única y actualizar en la tabla public.instructores
    const sessionId = crypto.randomBytes(24).toString("hex");
    const now = new Date().toISOString();

    await supabase
      .from("instructores")
      .update({
        current_session_token: sessionId,
        session_created_at: now,
        session_ip: String(clientIp),
        session_user_agent: String(userAgent).substring(0, 250),
        ultimo_acceso: now
      })
      .eq("id", userId);

    instructorProfile.current_session_token = sessionId;
    const token = generateToken(instructorProfile, sessionId);

    const nombreCompleto = `${instructorProfile.primer_nombre} ${instructorProfile.segundo_nombre ? instructorProfile.segundo_nombre + ' ' : ''}${instructorProfile.primer_apellido} ${instructorProfile.segundo_apellido || ''}`.trim();

    res.json({
      success: true,
      message: `¡Bienvenido(a) ${instructorProfile.primer_nombre} ${instructorProfile.primer_apellido}!`,
      token,
      sessionId,
      instructor: {
        id: instructorProfile.id,
        numero_cuenta: instructorProfile.numero_cuenta,
        primer_nombre: instructorProfile.primer_nombre,
        segundo_nombre: instructorProfile.segundo_nombre,
        primer_apellido: instructorProfile.primer_apellido,
        segundo_apellido: instructorProfile.segundo_apellido,
        correo: instructorProfile.correo,
        comite: instructorProfile.comite,
        rol: instructorProfile.rol,
        seccion: instructorProfile.seccion,
        coordinacion: instructorProfile.coordinacion,
        nombre_completo: nombreCompleto
      }
    });
  } catch (error) {
    console.error("Error en loginInstructor:", error);
    res.status(500).json({
      success: false,
      message: "Error al autenticar instructor",
      error: error.message
    });
  }
};

// Registrar nuevo instructor (en Supabase Auth y en la tabla public.instructores)
export const registerInstructor = async (req, res) => {
  try {
    const {
      numero_cuenta,
      primer_nombre,
      segundo_nombre,
      primer_apellido,
      segundo_apellido,
      correo,
      email,
      password,
      comite,
      rol,
      seccion,
      coordinacion
    } = req.body;

    const userEmail = (correo || email || "").trim().toLowerCase();

    if (!userEmail || !password || !primer_nombre || !primer_apellido || !numero_cuenta) {
      return res.status(400).json({
        success: false,
        message: "Número de cuenta, primer nombre, primer apellido, correo y contraseña son obligatorios."
      });
    }

    if (!isSupabaseConfigured || !supabase) {
      return res.status(500).json({
        success: false,
        message: "Supabase no está configurado."
      });
    }

    // 1. Crear usuario en Supabase Auth
    const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
      email: userEmail,
      password: password,
      email_confirm: true
    });

    if (authError || !authUser?.user) {
      return res.status(400).json({
        success: false,
        message: `Error al crear usuario en Supabase Auth: ${authError?.message}`
      });
    }

    // Validar rol permitido en creación (Creador no se puede asignar)
    const validRoles = ["Instructor", "Administrador", "Coordinador"];
    const assignedRole = validRoles.includes(rol) ? rol : "Instructor";

    // 2. Insertar perfil en la tabla public.instructores
    const newInstructorProfile = {
      id: authUser.user.id,
      numero_cuenta: String(numero_cuenta).trim(),
      primer_nombre: primer_nombre.trim(),
      segundo_nombre: (segundo_nombre || "").trim(),
      primer_apellido: primer_apellido.trim(),
      segundo_apellido: (segundo_apellido || "").trim(),
      correo: userEmail,
      comite: (comite || "").trim(),
      rol: assignedRole,
      seccion: (seccion || "").trim(),
      coordinacion: (coordinacion || "").trim(),
      activo: true
    };

    const { data: profileData, error: profileError } = await supabase
      .from("instructores")
      .insert([newInstructorProfile])
      .select()
      .single();

    if (profileError) {
      return res.status(500).json({
        success: false,
        message: `Usuario creado en Auth pero falló al guardar en tabla instructores: ${profileError.message}`
      });
    }

    res.status(201).json({
      success: true,
      message: "Instructor registrado exitosamente en Supabase.",
      instructor: profileData
    });
  } catch (error) {
    console.error("Error en registerInstructor:", error);
    res.status(500).json({
      success: false,
      message: "Error al registrar instructor",
      error: error.message
    });
  }
};

// Cierre de sesión en servidor y revocación en la base de datos
export const logoutInstructor = async (req, res) => {
  try {
    const instructorId = req.instructor?.id;

    if (instructorId && isSupabaseConfigured && supabase) {
      await supabase
        .from("instructores")
        .update({
          current_session_token: null,
          session_created_at: null
        })
        .eq("id", instructorId);

      await supabase.auth.signOut().catch(() => {});
    }

    res.json({
      success: true,
      message: "Sesión cerrada correctamente."
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error al cerrar sesión",
      error: error.message
    });
  }
};

// Heartbeat de sesión
export const checkHeartbeat = async (req, res) => {
  try {
    res.json({
      success: true,
      active: true,
      instructor: req.instructor
    });
  } catch (error) {
    res.status(401).json({
      success: false,
      active: false,
      message: "Sesión no válida"
    });
  }
};

// Obtener perfil del instructor actual
export const getMe = async (req, res) => {
  try {
    const instructor = await getInstructorByIdOrEmail(req.instructor.id, req.instructor.correo);

    if (!instructor) {
      return res.status(404).json({
        success: false,
        message: "Instructor no encontrado en la tabla de instructores."
      });
    }

    res.json({
      success: true,
      instructor
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error al obtener perfil",
      error: error.message
    });
  }
};

// Listar todos los instructores desde la tabla public.instructores
export const getInstructores = async (req, res) => {
  try {
    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase
        .from("instructores")
        .select("id, numero_cuenta, primer_nombre, segundo_nombre, primer_apellido, segundo_apellido, correo, comite, rol, seccion, coordinacion, activo, ultimo_acceso, created_at")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return res.json({ success: true, data: data || [] });
    }

    res.json({ success: true, data: [] });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error al listar instructores",
      error: error.message
    });
  }
};

// Actualizar datos de un instructor
export const updateInstructor = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      numero_cuenta,
      primer_nombre,
      segundo_nombre,
      primer_apellido,
      segundo_apellido,
      correo,
      email,
      password,
      comite,
      rol,
      seccion,
      coordinacion,
      activo
    } = req.body;

    if (!isSupabaseConfigured || !supabase) {
      return res.status(500).json({
        success: false,
        message: "Supabase no está configurado."
      });
    }

    // Proteger cuenta con rol Creador contra edición
    const { data: targetProfile } = await supabase
      .from("instructores")
      .select("rol")
      .eq("id", id)
      .maybeSingle();

    if (targetProfile?.rol === "Creador") {
      return res.status(403).json({
        success: false,
        message: "La cuenta de Creador está blindada por el sistema y no se puede modificar desde el panel."
      });
    }

    const updates = {};
    if (numero_cuenta !== undefined) updates.numero_cuenta = String(numero_cuenta).trim();
    if (primer_nombre !== undefined) updates.primer_nombre = primer_nombre.trim();
    if (segundo_nombre !== undefined) updates.segundo_nombre = (segundo_nombre || "").trim();
    if (primer_apellido !== undefined) updates.primer_apellido = primer_apellido.trim();
    if (segundo_apellido !== undefined) updates.segundo_apellido = (segundo_apellido || "").trim();
    const userEmail = (correo || email || "").trim().toLowerCase();
    if (userEmail) updates.correo = userEmail;
    if (comite !== undefined) updates.comite = (comite || "").trim();
    if (rol !== undefined) updates.rol = (rol || "Instructor").trim();
    if (seccion !== undefined) updates.seccion = (seccion || "").trim();
    if (coordinacion !== undefined) updates.coordinacion = (coordinacion || "").trim();
    if (activo !== undefined) updates.activo = Boolean(activo);

    // 1. Actualizar en la tabla public.instructores
    const { data: updatedProfile, error: profileError } = await supabase
      .from("instructores")
      .update(updates)
      .eq("id", id)
      .select()
      .single();

    if (profileError) {
      return res.status(500).json({
        success: false,
        message: `Error al actualizar perfil: ${profileError.message}`
      });
    }

    // 2. Si se proporcionó nueva contraseña o cambio de correo, actualizar en auth.users
    const authUpdates = {};
    if (password && password.trim().length >= 6) {
      authUpdates.password = password.trim();
    }
    if (userEmail) {
      authUpdates.email = userEmail;
    }

    if (Object.keys(authUpdates).length > 0) {
      const { error: authError } = await supabase.auth.admin.updateUserById(id, authUpdates);
      if (authError) {
        console.warn("Aviso al actualizar Supabase Auth:", authError.message);
      }
    }

    res.json({
      success: true,
      message: "Instructor actualizado exitosamente.",
      instructor: updatedProfile
    });
  } catch (error) {
    console.error("Error en updateInstructor:", error);
    res.status(500).json({
      success: false,
      message: "Error al actualizar instructor",
      error: error.message
    });
  }
};

// Eliminar un instructor
export const deleteInstructor = async (req, res) => {
  try {
    const { id } = req.params;

    if (!isSupabaseConfigured || !supabase) {
      return res.status(500).json({
        success: false,
        message: "Supabase no está configurado."
      });
    }

    // Evitar que el instructor se borre a sí mismo
    if (req.instructor && req.instructor.id === id) {
      return res.status(400).json({
        success: false,
        message: "No puedes eliminar tu propia cuenta mientras estás conectado."
      });
    }

    // Proteger cuenta con rol Creador contra eliminación
    const { data: targetProfile } = await supabase
      .from("instructores")
      .select("rol")
      .eq("id", id)
      .maybeSingle();

    if (targetProfile?.rol === "Creador") {
      return res.status(403).json({
        success: false,
        message: "La cuenta de Creador está blindada por el sistema y no puede ser eliminada."
      });
    }

    // 1. Eliminar de public.instructores
    const { error: profileError } = await supabase
      .from("instructores")
      .delete()
      .eq("id", id);

    if (profileError) {
      return res.status(500).json({
        success: false,
        message: `Error al eliminar instructor de la base de datos: ${profileError.message}`
      });
    }

    // 2. Eliminar de Supabase Auth
    try {
      await supabase.auth.admin.deleteUser(id);
    } catch (authErr) {
      console.warn("Aviso al eliminar de Supabase Auth:", authErr.message);
    }

    res.json({
      success: true,
      message: "Instructor eliminado exitosamente."
    });
  } catch (error) {
    console.error("Error en deleteInstructor:", error);
    res.status(500).json({
      success: false,
      message: "Error al eliminar instructor",
      error: error.message
    });
  }
};

// ============================================================================
// 7. AUTENTICACIÓN DE ESTUDIANTES POR CARRERA
// ============================================================================
export const getStudentTableName = (carrera) => {
  const c = String(carrera || "medicina")
    .toLowerCase()
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  if (c.includes("enferm")) return "estudiantes_enfermeria";
  if (c.includes("odont")) return "estudiantes_odontologia";
  if (c.includes("microb")) return "estudiantes_microbiologia";
  if (c.includes("nutri")) return "estudiantes_nutricion";
  return "estudiantes_medicina";
};

export const loginStudent = async (req, res) => {
  try {
    const { carrera, numero_cuenta, contrasena } = req.body;

    if (!carrera || !numero_cuenta || !contrasena) {
      return res.status(400).json({
        success: false,
        message: "Por favor selecciona tu carrera e ingresa tu número de cuenta y contraseña."
      });
    }

    const tableName = getStudentTableName(carrera);
    const cleanCuenta = String(numero_cuenta).trim();
    const cleanPass = String(contrasena).trim();

    let student = null;

    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase
        .from(tableName)
        .select("*")
        .eq("numero_cuenta", cleanCuenta)
        .eq("activo", true)
        .maybeSingle();

      if (error) {
        console.error("Error al buscar estudiante en Supabase:", error.message);
      }
      student = data;
    }

    if (!student) {
      return res.status(404).json({
        success: false,
        message: `No se encontró ningún estudiante con el número de cuenta "${cleanCuenta}" en la carrera seleccionada.`
      });
    }

    // Verificar contraseña (propia o por defecto 'histolab123')
    const validPassword =
      student.contrasena === cleanPass ||
      cleanPass === "histolab123" ||
      (!student.contrasena && cleanPass === "histolab123");

    if (!validPassword) {
      return res.status(401).json({
        success: false,
        message: "Contraseña incorrecta. Si es tu primer ingreso, utiliza la contraseña por defecto (histolab123)."
      });
    }

    // Obtener información de la sección a la que pertenece
    let seccionData = null;
    if (student.seccion_id && isSupabaseConfigured && supabase) {
      const { data: sec } = await supabase
        .from("secciones")
        .select("*")
        .eq("id", student.seccion_id)
        .maybeSingle();
      seccionData = sec;
    }

    // Generar token JWT para estudiante
    const token = jwt.sign(
      {
        id: student.id,
        numero_cuenta: student.numero_cuenta,
        nombre_completo: student.nombre_completo,
        carrera: carrera,
        seccion_id: student.seccion_id,
        rol: "ESTUDIANTE"
      },
      JWT_SECRET,
      { expiresIn: "7d" }
    );

    // Perfil completo del estudiante
    const studentProfile = {
      id: student.id,
      numero_cuenta: student.numero_cuenta,
      nombre_completo: student.nombre_completo,
      carrera: carrera,
      seccion_id: student.seccion_id,
      seccion: seccionData,
      notas: student.notas || {},
      asistencias: student.asistencias || {},
      total: student.total ?? 0,
      primer_examen: student.primer_examen ?? 0,
      segundo_examen: student.segundo_examen ?? 0,
      tercer_examen: student.tercer_examen ?? 0,
      rol: "ESTUDIANTE"
    };

    return res.json({
      success: true,
      message: `¡Bienvenido(a), ${student.nombre_completo}!`,
      token,
      estudiante: studentProfile
    });
  } catch (error) {
    console.error("Error en loginStudent:", error);
    return res.status(500).json({
      success: false,
      message: "Error interno en el servidor al autenticar estudiante.",
      error: error.message
    });
  }
};
