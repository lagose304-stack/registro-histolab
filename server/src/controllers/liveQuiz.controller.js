import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { supabase, isSupabaseConfigured } from "../db/supabase.js";

const __dirname = (() => {
  try {
    if (typeof import.meta !== "undefined" && typeof import.meta.url === "string" && import.meta.url.startsWith("file:")) {
      return path.dirname(fileURLToPath(import.meta.url));
    }
  } catch {}
  return (typeof process !== "undefined" && process.cwd) ? process.cwd() : "/";
})();
const DATA_DIR = path.join(__dirname, "../../data");
const LIVE_DATA_FILE = path.join(DATA_DIR, "live_sessions_data.json");

function ensureDataDir() {
  try {
    if (typeof fs.existsSync === "function" && !fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
  } catch (err) {
    // Ignorar errores de sistema de archivos en entornos serverless/Cloudflare Workers
  }
}

function loadPersistentLiveSessions() {
  try {
    ensureDataDir();
    if (fs.existsSync(LIVE_DATA_FILE)) {
      const raw = fs.readFileSync(LIVE_DATA_FILE, "utf-8");
      return JSON.parse(raw);
    }
  } catch (err) {
    console.warn("Aviso al leer sesiones en vivo locales:", err.message);
  }
  return {};
}

function savePersistentLiveSessions(sessions) {
  try {
    ensureDataDir();
    fs.writeFileSync(LIVE_DATA_FILE, JSON.stringify(sessions, null, 2), "utf-8");
  } catch (err) {
    // Modo serverless / Cloudflare Workers: no bloqueante
  }
}

// Mapa en memoria para acelerar consultas concurrentes por worker
const liveSessions = loadPersistentLiveSessions();

function getSessionKey(seccion_id, semana) {
  return `${String(seccion_id).trim()}_sem_${Number(semana)}`;
}

/**
 * Consulta la sesión en vivo desde Supabase (fuente de verdad compartida entre todos los workers y usuarios).
 */
async function fetchSessionFromSupabase(seccion_id, semana) {
  if (!isSupabaseConfigured || !supabase || !seccion_id) return null;
  try {
    const secClean = String(seccion_id).trim();
    const semNum = Number(semana);

    const { data, error } = await supabase
      .from("sesiones_pruebas_en_vivo")
      .select("*")
      .eq("seccion_id", secClean)
      .eq("numero_semana", semNum)
      .maybeSingle();

    if (!error && data) {
      return {
        seccion_id: String(data.seccion_id),
        numero_semana: Number(data.numero_semana),
        carrera: data.carrera || "Medicina",
        estado: data.estado || "inactiva",
        habilitada: Boolean(data.habilitada),
        pregunta_actual_idx: Number(data.pregunta_actual_idx ?? 0),
        duracion_segundos: Number(data.duracion_segundos ?? 90),
        pregunta_inicio_timestamp: data.pregunta_inicio_timestamp ? Number(data.pregunta_inicio_timestamp) : null,
        alumnos_conectados: typeof data.alumnos_conectados === "object" && data.alumnos_conectados ? data.alumnos_conectados : {},
        respuestas_globales: typeof data.respuestas_globales === "object" && data.respuestas_globales ? data.respuestas_globales : {},
        ultima_actualizacion: data.updated_at ? new Date(data.updated_at).getTime() : Date.now()
      };
    }
  } catch (err) {
    console.warn("Aviso al consultar sesión en vivo de Supabase:", err.message);
  }
  return null;
}

/**
 * Sincronización atómica con Supabase y respaldo de estado de habilitación en pruebas_semanales
 */
async function syncLiveSessionToSupabase(session) {
  if (!isSupabaseConfigured || !supabase || !session?.seccion_id) return;
  try {
    const secClean = String(session.seccion_id).trim();
    const semNum = Number(session.numero_semana);

    const payload = {
      seccion_id: secClean,
      numero_semana: semNum,
      carrera: session.carrera || "Medicina",
      estado: session.estado || "inactiva",
      habilitada: Boolean(session.habilitada),
      pregunta_actual_idx: session.pregunta_actual_idx ?? 0,
      duracion_segundos: session.duracion_segundos ?? 90,
      pregunta_inicio_timestamp: session.pregunta_inicio_timestamp || null,
      alumnos_conectados: session.alumnos_conectados || {},
      respuestas_globales: session.respuestas_globales || {},
      updated_at: new Date().toISOString()
    };

    // 1. Guardar en la tabla de sesiones en tiempo real
    const { error: liveErr } = await supabase
      .from("sesiones_pruebas_en_vivo")
      .upsert(payload, { onConflict: "seccion_id,numero_semana" });

    if (liveErr) {
      console.warn("Aviso al sincronizar sesión en vivo con Supabase:", liveErr.message);
    }

    // 2. Mantener sincronizado el flag habilitada_en_vivo en pruebas_semanales
    try {
      await supabase
        .from("pruebas_semanales")
        .update({
          habilitada_en_vivo: Boolean(session.habilitada),
          control_en_vivo: true,
          updated_at: new Date().toISOString()
        })
        .eq("seccion_id", secClean)
        .eq("numero_semana", semNum);
    } catch (_) {}
  } catch (err) {
    console.warn("Aviso al ejecutar syncLiveSessionToSupabase:", err.message);
  }
}

/**
 * Obtiene la sesión en vivo combinando Supabase (fuente de verdad) y la memoria local.
 */
async function getOrCreateSession(seccion_id, semana) {
  const key = getSessionKey(seccion_id, semana);
  const memSession = liveSessions[key];

  // 1. Siempre verificar estado maestro en Supabase
  const sbSession = await fetchSessionFromSupabase(seccion_id, semana);

  if (sbSession) {
    // Si tenemos datos en memoria con pings de alumnos, fusionarlos para no perder latidos recientes
    const mergedConnected = {
      ...(sbSession.alumnos_conectados || {}),
      ...(memSession?.alumnos_conectados || {})
    };
    const mergedAnswers = {
      ...(sbSession.respuestas_globales || {}),
      ...(memSession?.respuestas_globales || {})
    };

    liveSessions[key] = {
      ...sbSession,
      alumnos_conectados: mergedConnected,
      respuestas_globales: mergedAnswers
    };
    return liveSessions[key];
  }

  // 2. Si no existe en Supabase pero existe en memoria local
  if (memSession) {
    return memSession;
  }

  // 3. Crear sesión inicial por defecto
  const defaultSession = {
    seccion_id: String(seccion_id).trim(),
    numero_semana: Number(semana),
    carrera: "Medicina",
    estado: "inactiva",
    habilitada: false,
    pregunta_actual_idx: 0,
    pregunta_inicio_timestamp: null,
    duracion_segundos: 90,
    alumnos_conectados: {},
    respuestas_globales: {},
    ultima_actualizacion: Date.now()
  };

  liveSessions[key] = defaultSession;
  return defaultSession;
}

// 1. Obtener estado sincronizado de la sesión en vivo
export const getLiveQuizState = async (req, res) => {
  try {
    const { seccion_id, semana } = req.params;
    const session = await getOrCreateSession(seccion_id, semana);
    const now = Date.now();

    // Verificación automática de expiración de tiempo si está en pregunta
    let tiempo_restante_segundos = session.duracion_segundos;
    let tiempo_transcurrido_segundos = 0;

    if (session.estado === "en_pregunta" && session.pregunta_inicio_timestamp) {
      tiempo_transcurrido_segundos = Math.floor((now - session.pregunta_inicio_timestamp) / 1000);
      tiempo_restante_segundos = Math.max(0, session.duracion_segundos - tiempo_transcurrido_segundos);

      // Si el tiempo se agotó en el servidor, transicionar a esperando_siguiente
      if (tiempo_restante_segundos <= 0) {
        session.estado = "esperando_siguiente";
        session.ultima_actualizacion = now;
        savePersistentLiveSessions(liveSessions);
        await syncLiveSessionToSupabase(session);
      }
    }

    // Estadísticas de alumnos conectados y respuestas de la pregunta actual
    const currentQIdx = session.pregunta_actual_idx ?? 0;
    const activeStudentsList = Object.values(session.alumnos_conectados || {}).filter(
      (c) => c && (!c.ultimo_ping || (now - c.ultimo_ping < 60000))
    );
    const respondieronCount = activeStudentsList.filter(
      (c) => c.pregunta_vista === currentQIdx && c.ha_respondido
    ).length;

    res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
    return res.json({
      success: true,
      data: {
        ...session,
        tiempo_restante_segundos,
        tiempo_transcurrido_segundos,
        total_conectados: activeStudentsList.length,
        respuestas_recibidas_count: respondieronCount,
        todos_respondieron: activeStudentsList.length > 0 && respondieronCount >= activeStudentsList.length,
        server_time: now
      }
    });
  } catch (err) {
    console.error("Error en getLiveQuizState:", err);
    return res.status(500).json({ success: false, message: "Error al consultar estado en vivo" });
  }
};

// 2. Control maestro de la sesión en vivo (Acciones del Docente / Coordinador)
export const controlLiveQuiz = async (req, res) => {
  try {
    const { seccion_id, semana } = req.params;
    const { accion, duracion_segundos, pregunta_idx, carrera } = req.body;
    const session = await getOrCreateSession(seccion_id, semana);
    const now = Date.now();

    if (carrera) session.carrera = carrera;

    switch (accion) {
      case "habilitar": {
        // Pasa a lobby (los alumnos ven la alerta roja y pueden ingresar a la prueba)
        session.habilitada = true;
        session.estado = "lobby";
        session.pregunta_actual_idx = 0;
        session.pregunta_inicio_timestamp = null;
        if (duracion_segundos && Number(duracion_segundos) > 0) {
          session.duracion_segundos = Number(duracion_segundos);
        }
        session.ultima_actualizacion = now;
        break;
      }

      case "iniciar_pregunta_1":
      case "iniciar_pregunta": {
        // Da inicio a la pregunta especificada (por defecto la actual o pregunta_idx)
        const targetIdx = typeof pregunta_idx === "number" ? pregunta_idx : (session.pregunta_actual_idx || 0);
        session.habilitada = true;
        session.estado = "en_pregunta";
        session.pregunta_actual_idx = targetIdx;
        session.pregunta_inicio_timestamp = now;
        if (duracion_segundos && Number(duracion_segundos) > 0) {
          session.duracion_segundos = Number(duracion_segundos);
        }
        session.ultima_actualizacion = now;
        break;
      }

      case "siguiente_pregunta": {
        // Avanza a la siguiente pregunta y arranca su temporizador en vivo
        session.habilitada = true;
        session.estado = "en_pregunta";
        session.pregunta_actual_idx = (session.pregunta_actual_idx || 0) + 1;
        session.pregunta_inicio_timestamp = now;
        if (duracion_segundos && Number(duracion_segundos) > 0) {
          session.duracion_segundos = Number(duracion_segundos);
        }
        session.ultima_actualizacion = now;
        break;
      }

      case "tiempo_agotado":
      case "esperar_siguiente": {
        // Fuerza el estado de espera para la siguiente pregunta
        session.estado = "esperando_siguiente";
        session.ultima_actualizacion = now;
        break;
      }

      case "finalizar": {
        // Finaliza la prueba para toda la sección
        session.estado = "finalizada";
        session.habilitada = false;
        session.ultima_actualizacion = now;
        break;
      }

      case "deshabilitar":
      case "reiniciar": {
        // Deshabilita la sesión en vivo y limpia los estados
        session.habilitada = false;
        session.estado = "inactiva";
        session.pregunta_actual_idx = 0;
        session.pregunta_inicio_timestamp = null;
        session.alumnos_conectados = {};
        session.respuestas_globales = {};
        session.ultima_actualizacion = now;
        break;
      }

      default:
        return res.status(400).json({ success: false, message: `Acción desconocida: ${accion}` });
    }

    const key = getSessionKey(seccion_id, semana);
    liveSessions[key] = session;
    savePersistentLiveSessions(liveSessions);

    // Esperar explícitamente a que Supabase confirme para garantizar consistencia entre instancias
    await syncLiveSessionToSupabase(session);

    const elapsed = session.pregunta_inicio_timestamp ? Math.floor((now - session.pregunta_inicio_timestamp) / 1000) : 0;
    const remaining = Math.max(0, session.duracion_segundos - elapsed);

    return res.json({
      success: true,
      data: {
        ...session,
        tiempo_restante_segundos: remaining,
        tiempo_transcurrido_segundos: elapsed,
        server_time: now
      },
      message: `Comando '${accion}' ejecutado con éxito`
    });
  } catch (err) {
    console.error("Error en controlLiveQuiz:", err);
    return res.status(500).json({ success: false, message: "Error al ejecutar control de prueba en vivo" });
  }
};

// 3. Latido (Heartbeat) de los estudiantes durante la prueba o en el lobby
export const heartbeatLiveQuiz = async (req, res) => {
  try {
    const { seccion_id, semana } = req.params;
    const { numero_cuenta, nombre_completo, respuestas_parciales, pregunta_vista } = req.body;

    if (!numero_cuenta) {
      return res.status(400).json({ success: false, message: "Se requiere numero_cuenta" });
    }

    const cleanAccount = String(numero_cuenta).trim();
    const session = await getOrCreateSession(seccion_id, semana);
    const now = Date.now();

    if (!session.alumnos_conectados) {
      session.alumnos_conectados = {};
    }

    // Actualizar registro del estudiante conectado
    session.alumnos_conectados[cleanAccount] = {
      nombre_completo: nombre_completo || session.alumnos_conectados[cleanAccount]?.nombre_completo || "Estudiante",
      ultimo_ping: now,
      pregunta_vista: typeof pregunta_vista === "number" ? pregunta_vista : -1,
      ip: req.headers["x-forwarded-for"] || req.socket?.remoteAddress || "127.0.0.1"
    };

    // Respaldar respuestas parciales si se enviaron
    if (respuestas_parciales && typeof respuestas_parciales === "object") {
      if (!session.respuestas_globales) {
        session.respuestas_globales = {};
      }
      if (!session.respuestas_globales[cleanAccount]) {
        session.respuestas_globales[cleanAccount] = {};
      }
      session.respuestas_globales[cleanAccount] = {
        ...session.respuestas_globales[cleanAccount],
        ...respuestas_parciales
      };
    }

    // Calcular tiempos actuales
    let tiempo_restante_segundos = session.duracion_segundos;
    let tiempo_transcurrido_segundos = 0;

    if (session.estado === "en_pregunta" && session.pregunta_inicio_timestamp) {
      tiempo_transcurrido_segundos = Math.floor((now - session.pregunta_inicio_timestamp) / 1000);
      tiempo_restante_segundos = Math.max(0, session.duracion_segundos - tiempo_transcurrido_segundos);

      if (tiempo_restante_segundos <= 0 && session.estado === "en_pregunta") {
        session.estado = "esperando_siguiente";
        session.ultima_actualizacion = now;
      }
    }

    // Calcular estadísticas en tiempo real de alumnos que ya respondieron la pregunta actual
    const currentQIdx = session.pregunta_actual_idx ?? 0;
    const activeStudentsList = Object.values(session.alumnos_conectados || {}).filter(
      (c) => c && (!c.ultimo_ping || (now - c.ultimo_ping < 60000))
    );
    const respondieronCount = activeStudentsList.filter(
      (c) => c.pregunta_vista === currentQIdx && c.ha_respondido
    ).length;

    const key = getSessionKey(seccion_id, semana);
    liveSessions[key] = session;

    // Persistir en Supabase (con sincronización garantizada)
    await syncLiveSessionToSupabase(session);

    return res.json({
      success: true,
      data: {
        estado: session.estado,
        habilitada: session.habilitada,
        pregunta_actual_idx: session.pregunta_actual_idx,
        duracion_segundos: session.duracion_segundos,
        tiempo_restante_segundos,
        tiempo_transcurrido_segundos,
        total_conectados: activeStudentsList.length,
        respuestas_recibidas_count: respondieronCount,
        todos_respondieron: activeStudentsList.length > 0 && respondieronCount >= activeStudentsList.length,
        server_time: now
      }
    });
  } catch (err) {
    console.error("Error en heartbeatLiveQuiz:", err);
    return res.status(500).json({ success: false, message: "Error al procesar latido en vivo" });
  }
};

/**
 * Consulta instantánea si existe una prueba en vivo activa para una sección determinada.
 * Permite que los estudiantes detecten la sala de espera al instante sin saturar con llamadas múltiples.
 */
export const getActiveLiveQuiz = async (req, res) => {
  try {
    const { seccion_id } = req.params;
    if (!seccion_id) {
      return res.status(400).json({ success: false, message: "seccion_id requerido" });
    }
    const secClean = String(seccion_id).trim();

    // 1. Revisar memoria local activa del worker
    for (const key in liveSessions) {
      const sess = liveSessions[key];
      if (
        sess &&
        String(sess.seccion_id).trim() === secClean &&
        sess.habilitada &&
        sess.estado !== "finalizada" &&
        sess.estado !== "inactiva"
      ) {
        return res.json({
          success: true,
          activa: true,
          data: sess
        });
      }
    }

    // 2. Revisar base de datos central en Supabase
    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase
        .from("sesiones_pruebas_en_vivo")
        .select("*")
        .eq("seccion_id", secClean)
        .eq("habilitada", true)
        .neq("estado", "finalizada")
        .neq("estado", "inactiva")
        .order("updated_at", { ascending: false })
        .limit(1);

      if (!error && data && data.length > 0) {
        const row = data[0];
        const session = {
          seccion_id: String(row.seccion_id),
          numero_semana: Number(row.numero_semana),
          carrera: row.carrera || "Medicina",
          estado: row.estado || "lobby",
          habilitada: Boolean(row.habilitada),
          pregunta_actual_idx: Number(row.pregunta_actual_idx ?? 0),
          duracion_segundos: Number(row.duracion_segundos ?? 90),
          pregunta_inicio_timestamp: row.pregunta_inicio_timestamp ? Number(row.pregunta_inicio_timestamp) : null,
          alumnos_conectados: typeof row.alumnos_conectados === "object" && row.alumnos_conectados ? row.alumnos_conectados : {},
          respuestas_globales: typeof row.respuestas_globales === "object" && row.respuestas_globales ? row.respuestas_globales : {}
        };
        const key = getSessionKey(secClean, session.numero_semana);
        liveSessions[key] = session;

        return res.json({
          success: true,
          activa: true,
          data: session
        });
      }

      // 3. Fallback: verificar si pruebas_semanales tiene habilitada_en_vivo = true
      const { data: qData } = await supabase
        .from("pruebas_semanales")
        .select("numero_semana, titulo, carrera")
        .eq("seccion_id", secClean)
        .eq("habilitada_en_vivo", true)
        .limit(1);

      if (qData && qData.length > 0) {
        const qRow = qData[0];
        const fallbackSession = await getOrCreateSession(secClean, qRow.numero_semana);
        fallbackSession.habilitada = true;
        if (fallbackSession.estado === "inactiva") {
          fallbackSession.estado = "lobby";
        }
        return res.json({
          success: true,
          activa: true,
          data: fallbackSession
        });
      }
    }

    return res.json({
      success: true,
      activa: false
    });
  } catch (err) {
    console.warn("Aviso en getActiveLiveQuiz:", err.message);
    return res.json({ success: true, activa: false });
  }
};
