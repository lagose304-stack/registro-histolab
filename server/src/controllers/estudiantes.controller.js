import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { supabase, isSupabaseConfigured } from "../db/supabase.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.join(__dirname, "../../data");
const ESTUDIANTES_FILE = path.join(DATA_DIR, "estudiantes_data.json");

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function loadPersistentEstudiantes() {
  try {
    ensureDataDir();
    if (fs.existsSync(ESTUDIANTES_FILE)) {
      const raw = fs.readFileSync(ESTUDIANTES_FILE, "utf-8");
      return JSON.parse(raw);
    }
  } catch (err) {
    console.warn("Aviso al leer estudiantes locales:", err.message);
  }
  return {
    estudiantes_medicina: [],
    estudiantes_enfermeria: [],
    estudiantes_odontologia: [],
    estudiantes_microbiologia: [],
    estudiantes_nutricion: []
  };
}

function savePersistentEstudiantes(data) {
  try {
    ensureDataDir();
    fs.writeFileSync(ESTUDIANTES_FILE, JSON.stringify(data, null, 2), "utf-8");
  } catch (err) {
    console.warn("Aviso al guardar estudiantes locales:", err.message);
  }
}

// Memoria de respaldo por carrera respaldada en disco local
let inMemoryEstudiantes = loadPersistentEstudiantes();

/**
 * Sanitiza canónicamente el objeto notas antes de persistirlo en Supabase o memoria local:
 * 1. Estandariza de forma transparente examencito_X -> prueba_X (eliminando claves redundantes).
 * 2. Purga manual_tema_X si ya existe un manual_UUID para el tema.
 * 3. Normaliza decimales a un máximo de 3 dígitos de precisión.
 */
export const sanitizeNotasPayload = (notas = {}) => {
  if (!notas || typeof notas !== "object") return {};
  const cleaned = {};

  for (const [rawKey, val] of Object.entries(notas)) {
    if (val === undefined || val === null || val === "") continue;

    let key = rawKey.trim();

    // 1. Estandarizar examencito_X a prueba_X
    if (key.startsWith("examencito_")) {
      const semNum = key.replace("examencito_", "");
      key = `prueba_${semNum}`;
    }

    const numVal = Number(val);
    if (!isNaN(numVal)) {
      cleaned[key] = Math.round(numVal * 1000) / 1000;
    } else {
      cleaned[key] = val;
    }
  }

  // 2. Si existe un manual por ID UUID, eliminar manual_tema_X posicional para evitar inconsistencias
  const hasUuidManual = Object.keys(cleaned).some(
    (k) => k.startsWith("manual_") && !k.startsWith("manual_tema_")
  );
  if (hasUuidManual) {
    for (const k of Object.keys(cleaned)) {
      if (k.startsWith("manual_tema_")) {
        delete cleaned[k];
      }
    }
  }

  return cleaned;
};

/**
 * Normaliza cualquier string de carrera al nombre oficial de su tabla en Supabase
 * Remueve tildes y caracteres especiales para evitar errores tipográficos
 */
export const normalizeCarreraToTable = (carrera) => {
  const c = String(carrera || "")
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

/**
 * Obtiene la tabla correspondiente a partir del ID de la sección
 */
const getTableForSeccion = async (seccion_id, hintCarrera = null) => {
  if (hintCarrera) {
    return normalizeCarreraToTable(hintCarrera);
  }

  if (isSupabaseConfigured && supabase) {
    try {
      const { data: sec } = await supabase
        .from("secciones")
        .select("carrera")
        .eq("id", seccion_id)
        .maybeSingle();

      if (sec?.carrera) {
        return normalizeCarreraToTable(sec.carrera);
      }
    } catch (e) {
      console.warn("Aviso al consultar carrera de sección:", e.message);
    }
  }

  return "estudiantes_medicina";
};

// 1. Obtener todos los estudiantes de una sección (consultando la tabla de su carrera)
export const getEstudiantesBySeccion = async (req, res) => {
  try {
    const { seccion_id } = req.params;
    const { carrera } = req.query;

    const tableName = await getTableForSeccion(seccion_id, carrera);

    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase
        .from(tableName)
        .select("*")
        .eq("seccion_id", seccion_id)
        .order("nombre_completo", { ascending: true });

      if (!error && data) {
        return res.json({
          success: true,
          table: tableName,
          count: data.length,
          data: data
        });
      } else if (error) {
        console.warn(`Aviso al consultar ${tableName}:`, error.message);
      }
    }

    const memoryList = inMemoryEstudiantes[tableName] || [];
    const filtered = memoryList.filter((e) => e.seccion_id === seccion_id);
    return res.json({
      success: true,
      table: tableName,
      count: filtered.length,
      data: filtered
    });
  } catch (error) {
    console.error("Error al obtener estudiantes de la sección:", error);
    res.status(500).json({
      success: false,
      message: "Error al obtener la lista de estudiantes",
      error: error.message
    });
  }
};

// 2. Registrar un nuevo estudiante en una sección
export const createEstudiante = async (req, res) => {
  try {
    const { seccion_id, numero_cuenta, nombre_completo, contrasena, carrera, notas, asistencias, total } = req.body;

    if (!seccion_id || !numero_cuenta || !nombre_completo) {
      return res.status(400).json({
        success: false,
        message: "El número de cuenta, nombre completo y la sección son requeridos."
      });
    }

    const cleanCuenta = String(numero_cuenta).trim();
    const cleanNombre = String(nombre_completo).trim();
    const cleanPass = contrasena ? String(contrasena).trim() : "histolab123";
    const tableName = await getTableForSeccion(seccion_id, carrera);

    // Verificar si ya existe en esta sección
    if (isSupabaseConfigured && supabase) {
      const { data: existing } = await supabase
        .from(tableName)
        .select("numero_cuenta")
        .eq("seccion_id", seccion_id)
        .eq("numero_cuenta", cleanCuenta)
        .maybeSingle();

      if (existing) {
        return res.status(400).json({
          success: false,
          message: `El estudiante con número de cuenta ${cleanCuenta} ya está registrado en esta sección.`
        });
      }

      const newRecord = {
        seccion_id,
        numero_cuenta: cleanCuenta,
        nombre_completo: cleanNombre,
        contrasena: cleanPass,
        notas: typeof notas === "object" && notas !== null ? notas : {},
        asistencias: typeof asistencias === "object" && asistencias !== null ? asistencias : {},
        total: Number(total) || 0.00,
        activo: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      const { data, error } = await supabase
        .from(tableName)
        .insert(newRecord)
        .select()
        .single();

      if (!error && data) {
        if (!inMemoryEstudiantes[tableName]) inMemoryEstudiantes[tableName] = [];
        inMemoryEstudiantes[tableName] = inMemoryEstudiantes[tableName].filter(
          (e) => !(e.seccion_id === seccion_id && e.numero_cuenta === cleanCuenta)
        );
        inMemoryEstudiantes[tableName].push(data);
        savePersistentEstudiantes(inMemoryEstudiantes);

        return res.status(201).json({
          success: true,
          message: "Estudiante matriculado exitosamente en la sección.",
          table: tableName,
          data
        });
      } else if (error) {
        console.warn(`Aviso al insertar en ${tableName}:`, error.message);
      }
    }

    // Memoria de respaldo
    if (!inMemoryEstudiantes[tableName]) {
      inMemoryEstudiantes[tableName] = [];
    }

    const existsInMemory = inMemoryEstudiantes[tableName].find(
      (e) => e.seccion_id === seccion_id && e.numero_cuenta === cleanCuenta
    );

    if (existsInMemory) {
      return res.status(400).json({
        success: false,
        message: `El estudiante con número de cuenta ${cleanCuenta} ya existe en esta sección.`
      });
    }

    const newInMemory = {
      seccion_id,
      numero_cuenta: cleanCuenta,
      nombre_completo: cleanNombre,
      contrasena: cleanPass,
      notas: typeof notas === "object" && notas !== null ? notas : {},
      asistencias: typeof asistencias === "object" && asistencias !== null ? asistencias : {},
      total: Number(total) || 0.00,
      activo: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    inMemoryEstudiantes[tableName].push(newInMemory);
    savePersistentEstudiantes(inMemoryEstudiantes);

    return res.status(201).json({
      success: true,
      message: "Estudiante matriculado exitosamente (memoria).",
      table: tableName,
      data: newInMemory
    });
  } catch (error) {
    console.error("Error al matricular estudiante:", error);
    res.status(500).json({
      success: false,
      message: "Error al registrar el estudiante",
      error: error.message
    });
  }
};

// 3. Editar datos o calificaciones/asistencias de un estudiante
export const updateEstudiante = async (req, res) => {
  try {
    const { seccion_id, numero_cuenta } = req.params;
    const {
      nombre_completo,
      nuevo_numero_cuenta,
      contrasena,
      carrera,
      notas,
      asistencias,
      total,
      primer_examen,
      segundo_examen,
      tercer_examen
    } = req.body;

    const tableName = await getTableForSeccion(seccion_id, carrera);

    // Sanitizar canónicamente el objeto notas
    const sanitizedNotas = notas ? sanitizeNotasPayload(notas) : undefined;

    // Validación de reglas académicas de calificaciones:
    // Manuales: máximo 1.000 punto | Pruebas: máximo 5.000 puntos
    if (sanitizedNotas && typeof sanitizedNotas === "object") {
      for (const [k, v] of Object.entries(sanitizedNotas)) {
        const numVal = Number(v);
        if (!isNaN(numVal)) {
          if ((k.startsWith("manual_") || k.startsWith("Manual de ")) && numVal > 1) {
            return res.status(400).json({
              success: false,
              message: `Error académico: La nota de manual no puede ser mayor a 1 punto (máximo 1.000). Se recibió ${numVal} para ${k}.`
            });
          }
          if ((k.startsWith("prueba_") || k.startsWith("Prueba de ")) && numVal > 5) {
            return res.status(400).json({
              success: false,
              message: `Error académico: La nota de prueba no puede ser mayor a 5 puntos (máximo 5.000). Se recibió ${numVal} para ${k}.`
            });
          }
        }
      }
    }

    const updates = {
      updated_at: new Date().toISOString()
    };

    if (nombre_completo !== undefined) updates.nombre_completo = String(nombre_completo).trim();
    if (nuevo_numero_cuenta !== undefined) updates.numero_cuenta = String(nuevo_numero_cuenta).trim();
    if (contrasena !== undefined) updates.contrasena = String(contrasena).trim();
    if (sanitizedNotas !== undefined) updates.notas = sanitizedNotas;
    if (asistencias !== undefined) updates.asistencias = asistencias;
    if (total !== undefined) updates.total = Math.round((Number(total) || 0) * 1000) / 1000;
    if (primer_examen !== undefined) {
      const ex1 = Number(primer_examen);
      if (!isNaN(ex1) && (ex1 > 20 || ex1 < 0)) {
        return res.status(400).json({
          success: false,
          message: `Error académico: La nota del primer examen (${ex1}) excede el límite permitido (máx. 20 puntos).`
        });
      }
      updates.primer_examen = Math.round(ex1 * 1000) / 1000;
    }
    if (segundo_examen !== undefined) {
      const ex2 = Number(segundo_examen);
      if (!isNaN(ex2) && (ex2 > 20 || ex2 < 0)) {
        return res.status(400).json({
          success: false,
          message: `Error académico: La nota del segundo examen (${ex2}) excede el límite permitido (máx. 20 puntos).`
        });
      }
      updates.segundo_examen = Math.round(ex2 * 1000) / 1000;
    }
    if (tercer_examen !== undefined) {
      const ex3 = Number(tercer_examen);
      if (!isNaN(ex3) && (ex3 > 20 || ex3 < 0)) {
        return res.status(400).json({
          success: false,
          message: `Error académico: La nota del tercer examen (${ex3}) excede el límite permitido (máx. 20 puntos).`
        });
      }
      updates.tercer_examen = Math.round(ex3 * 1000) / 1000;
    }

    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase
        .from(tableName)
        .update(updates)
        .eq("seccion_id", seccion_id)
        .eq("numero_cuenta", numero_cuenta)
        .select()
        .single();

      if (!error && data) {
        if (!inMemoryEstudiantes[tableName]) inMemoryEstudiantes[tableName] = [];
        const uIdx = inMemoryEstudiantes[tableName].findIndex(
          (e) => e.seccion_id === seccion_id && e.numero_cuenta === numero_cuenta
        );
        if (uIdx !== -1) inMemoryEstudiantes[tableName][uIdx] = { ...inMemoryEstudiantes[tableName][uIdx], ...data };
        else inMemoryEstudiantes[tableName].push(data);
        savePersistentEstudiantes(inMemoryEstudiantes);

        return res.json({
          success: true,
          message: "Datos del estudiante actualizados correctamente.",
          table: tableName,
          data
        });
      } else if (error) {
        console.warn(`Aviso al actualizar en ${tableName}:`, error.message);
      }
    }

    if (!inMemoryEstudiantes[tableName]) {
      inMemoryEstudiantes[tableName] = [];
    }

    const idx = inMemoryEstudiantes[tableName].findIndex(
      (e) => e.seccion_id === seccion_id && e.numero_cuenta === numero_cuenta
    );

    if (idx !== -1) {
      inMemoryEstudiantes[tableName][idx] = { ...inMemoryEstudiantes[tableName][idx], ...updates };
      savePersistentEstudiantes(inMemoryEstudiantes);
      return res.json({
        success: true,
        message: "Estudiante actualizado exitosamente (memoria).",
        table: tableName,
        data: inMemoryEstudiantes[tableName][idx]
      });
    }

    return res.status(404).json({
      success: false,
      message: "Estudiante no encontrado en la sección."
    });
  } catch (error) {
    console.error("Error al actualizar estudiante:", error);
    res.status(500).json({
      success: false,
      message: "Error al actualizar los datos del estudiante",
      error: error.message
    });
  }
};

// 4. Actualización en lote (Batch Update) de notas y asistencias para toda la sección
export const updateBatchGrades = async (req, res) => {
  try {
    const { seccion_id } = req.params;
    const { updates = [], carrera } = req.body;

    if (!Array.isArray(updates) || updates.length === 0) {
      return res.status(400).json({
        success: false,
        message: "No se proporcionaron actualizaciones de estudiantes."
      });
    }

    // Sanitización canónica y validación de reglas académicas para todos los registros del lote:
    // Manuales: máximo 1.000 punto | Pruebas: máximo 5.000 puntos
    for (const item of updates) {
      if (item.notas && typeof item.notas === "object") {
        item.notas = sanitizeNotasPayload(item.notas);
        for (const [k, v] of Object.entries(item.notas)) {
          const numVal = Number(v);
          if (!isNaN(numVal)) {
            if ((k.startsWith("manual_") || k.startsWith("Manual de ")) && numVal > 1) {
              return res.status(400).json({
                success: false,
                message: `Error académico: La nota de manual no puede ser mayor a 1 punto (máximo 1.000). Se recibió ${numVal} para ${k} en la cuenta ${item.numero_cuenta || 'estudiante'}.`
              });
            }
            if ((k.startsWith("prueba_") || k.startsWith("Prueba de ")) && numVal > 5) {
              return res.status(400).json({
                success: false,
                message: `Error académico: La nota de prueba no puede ser mayor a 5 puntos (máximo 5.000). Se recibió ${numVal} para ${k} en la cuenta ${item.numero_cuenta || 'estudiante'}.`
              });
            }
          }
        }
      }

      if (item.total !== undefined) {
        item.total = Math.round((Number(item.total) || 0) * 1000) / 1000;
      }
      if (item.primer_examen !== undefined) {
        const ex1 = Number(item.primer_examen);
        if (!isNaN(ex1) && (ex1 > 20 || ex1 < 0)) {
          return res.status(400).json({
            success: false,
            message: `Error académico: La nota del primer examen (${ex1}) en la cuenta ${item.numero_cuenta || 'estudiante'} excede el límite permitido (máx. 20 puntos).`
          });
        }
        item.primer_examen = Math.round(ex1 * 1000) / 1000;
      }
      if (item.segundo_examen !== undefined) {
        const ex2 = Number(item.segundo_examen);
        if (!isNaN(ex2) && (ex2 > 20 || ex2 < 0)) {
          return res.status(400).json({
            success: false,
            message: `Error académico: La nota del segundo examen (${ex2}) en la cuenta ${item.numero_cuenta || 'estudiante'} excede el límite permitido (máx. 20 puntos).`
          });
        }
        item.segundo_examen = Math.round(ex2 * 1000) / 1000;
      }
      if (item.tercer_examen !== undefined) {
        const ex3 = Number(item.tercer_examen);
        if (!isNaN(ex3) && (ex3 > 20 || ex3 < 0)) {
          return res.status(400).json({
            success: false,
            message: `Error académico: La nota del tercer examen (${ex3}) en la cuenta ${item.numero_cuenta || 'estudiante'} excede el límite permitido (máx. 20 puntos).`
          });
        }
        item.tercer_examen = Math.round(ex3 * 1000) / 1000;
      }
    }

    const tableName = await getTableForSeccion(seccion_id, carrera);

    if (isSupabaseConfigured && supabase) {
      const promises = updates.map(async (item) => {
        const payload = {
          updated_at: new Date().toISOString()
        };
        if (item.notas !== undefined) payload.notas = item.notas;
        if (item.asistencias !== undefined) payload.asistencias = item.asistencias;
        if (item.total !== undefined) payload.total = item.total;
        if (item.primer_examen !== undefined) payload.primer_examen = item.primer_examen;
        if (item.segundo_examen !== undefined) payload.segundo_examen = item.segundo_examen;
        if (item.tercer_examen !== undefined) payload.tercer_examen = item.tercer_examen;

        return supabase
          .from(tableName)
          .update(payload)
          .eq("seccion_id", seccion_id)
          .eq("numero_cuenta", item.numero_cuenta);
      });

      const results = await Promise.all(promises);
      const errors = results.filter((r) => r.error);
      if (errors.length > 0) {
        console.error(`Aviso: ${errors.length}/${updates.length} actualizaciones fallaron en Supabase (${tableName}):`, errors.map(e => e.error?.message));
      }

      // Sincronizar memoria y archivo persistente
      if (!inMemoryEstudiantes[tableName]) inMemoryEstudiantes[tableName] = [];
      updates.forEach((item) => {
        const idx = inMemoryEstudiantes[tableName].findIndex(
          (e) => e.seccion_id === seccion_id && e.numero_cuenta === item.numero_cuenta
        );
        if (idx !== -1) {
          inMemoryEstudiantes[tableName][idx] = {
            ...inMemoryEstudiantes[tableName][idx],
            ...item,
            updated_at: new Date().toISOString()
          };
        }
      });
      savePersistentEstudiantes(inMemoryEstudiantes);

      return res.json({
        success: true,
        message: `Calificaciones y asistencias sincronizadas con éxito en ${tableName}.`,
        table: tableName,
        updatedCount: updates.length
      });
    }

    // Memoria de respaldo
    if (!inMemoryEstudiantes[tableName]) inMemoryEstudiantes[tableName] = [];
    updates.forEach((item) => {
      const idx = inMemoryEstudiantes[tableName].findIndex(
        (e) => e.seccion_id === seccion_id && e.numero_cuenta === item.numero_cuenta
      );
      if (idx !== -1) {
        inMemoryEstudiantes[tableName][idx] = {
          ...inMemoryEstudiantes[tableName][idx],
          ...item,
          updated_at: new Date().toISOString()
        };
      }
    });
    savePersistentEstudiantes(inMemoryEstudiantes);

    return res.json({
      success: true,
      message: `Calificaciones guardadas en memoria para ${tableName}.`,
      table: tableName,
      updatedCount: updates.length
    });
  } catch (error) {
    console.error("Error al actualizar notas por lote:", error);
    res.status(500).json({
      success: false,
      message: "Error al sincronizar calificaciones y asistencias.",
      error: error.message
    });
  }
};

// 5. Borrar un estudiante de una sección
export const deleteEstudiante = async (req, res) => {
  try {
    const { seccion_id, numero_cuenta } = req.params;
    const { carrera } = req.query;

    const tableName = await getTableForSeccion(seccion_id, carrera);

    if (isSupabaseConfigured && supabase) {
      const { error } = await supabase
        .from(tableName)
        .delete()
        .eq("seccion_id", seccion_id)
        .eq("numero_cuenta", numero_cuenta);

      if (!error) {
        if (inMemoryEstudiantes[tableName]) {
          inMemoryEstudiantes[tableName] = inMemoryEstudiantes[tableName].filter(
            (e) => !(e.seccion_id === seccion_id && e.numero_cuenta === numero_cuenta)
          );
          savePersistentEstudiantes(inMemoryEstudiantes);
        }
        return res.json({
          success: true,
          table: tableName,
          message: "Estudiante eliminado de la sección con éxito."
        });
      }
    }

    if (inMemoryEstudiantes[tableName]) {
      const initialLen = inMemoryEstudiantes[tableName].length;
      inMemoryEstudiantes[tableName] = inMemoryEstudiantes[tableName].filter(
        (e) => !(e.seccion_id === seccion_id && e.numero_cuenta === numero_cuenta)
      );
      savePersistentEstudiantes(inMemoryEstudiantes);

      if (inMemoryEstudiantes[tableName].length < initialLen) {
        return res.json({
          success: true,
          table: tableName,
          message: "Estudiante eliminado exitosamente."
        });
      }
    }

    return res.status(404).json({
      success: false,
      message: "Estudiante no encontrado para eliminar."
    });
  } catch (error) {
    console.error("Error al eliminar estudiante:", error);
    res.status(500).json({
      success: false,
      message: "Error al eliminar el estudiante",
      error: error.message
    });
  }
};

// 6. Obtener un estudiante específico por carrera y número de cuenta
export const getEstudianteByCuenta = async (req, res) => {
  try {
    const { carrera, numero_cuenta } = req.params;
    const tableName = normalizeCarreraToTable(carrera);
    const cleanCuenta = String(numero_cuenta).trim();

    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase
        .from(tableName)
        .select("*")
        .eq("numero_cuenta", cleanCuenta)
        .eq("activo", true)
        .maybeSingle();

      if (!error && data) {
        let seccionData = null;
        if (data.seccion_id) {
          const { data: sec } = await supabase
            .from("secciones")
            .select("*")
            .eq("id", data.seccion_id)
            .maybeSingle();
          seccionData = sec;
        }

        return res.json({
          success: true,
          data: {
            ...data,
            carrera: carrera,
            seccion: seccionData,
            notas: data.notas || {},
            asistencias: data.asistencias || {}
          }
        });
      }
    }

    const memoryList = inMemoryEstudiantes[tableName] || [];
    const found = memoryList.find((e) => String(e.numero_cuenta).trim() === cleanCuenta);
    if (found) {
      return res.json({ success: true, data: found });
    }

    return res.status(404).json({
      success: false,
      message: `Estudiante con cuenta ${cleanCuenta} no encontrado en ${carrera}.`
    });
  } catch (error) {
    console.error("Error al obtener estudiante por cuenta:", error);
    res.status(500).json({
      success: false,
      message: "Error al consultar información del estudiante",
      error: error.message
    });
  }
};

// 7. Helper directo para actualizar una nota específica de un estudiante (usado por módulo de pruebas)
export const updateEstudianteGradeDirect = async (seccion_id, numero_cuenta, carrera, key, value) => {
  const tableName = await getTableForSeccion(seccion_id, carrera);

  if (!inMemoryEstudiantes[tableName]) {
    inMemoryEstudiantes[tableName] = [];
  }

  const idx = inMemoryEstudiantes[tableName].findIndex(
    (e) => String(e.seccion_id) === String(seccion_id) && String(e.numero_cuenta) === String(numero_cuenta)
  );

  let currentEst = idx !== -1 ? inMemoryEstudiantes[tableName][idx] : null;

  if (isSupabaseConfigured && supabase) {
    try {
      const { data } = await supabase
        .from(tableName)
        .select("*")
        .eq("seccion_id", seccion_id)
        .eq("numero_cuenta", numero_cuenta)
        .maybeSingle();
      if (data) currentEst = data;
    } catch (err) {
      // fallback
    }
  }

  if (!currentEst) return false;

  const currentNotas = { ...(currentEst.notas || {}) };
  currentNotas[key] = value;
  const sanitized = sanitizeNotasPayload(currentNotas);

  const payload = {
    notas: sanitized,
    updated_at: new Date().toISOString()
  };

  if (isSupabaseConfigured && supabase) {
    try {
      await supabase
        .from(tableName)
        .update(payload)
        .eq("seccion_id", seccion_id)
        .eq("numero_cuenta", numero_cuenta);
    } catch (err) {
      console.warn("Aviso en Supabase updateEstudianteGradeDirect:", err.message);
    }
  }

  if (idx !== -1) {
    inMemoryEstudiantes[tableName][idx] = {
      ...inMemoryEstudiantes[tableName][idx],
      notas: sanitized,
      updated_at: payload.updated_at
    };
    savePersistentEstudiantes(inMemoryEstudiantes);
  }

  return true;
};

