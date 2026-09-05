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
const DATA_FILE = path.join(DATA_DIR, "asignaciones_data.json");
const OLD_DATA_FILE = path.join(__dirname, "../db/asignaciones_data.json");

function ensureDataDir() {
  try {
    if (typeof fs.existsSync === "function" && !fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
  } catch (err) {
    // Ignorar errores de sistema de archivos en entornos serverless/Cloudflare Workers
  }
}

// Carga inicial persistente de asignaciones
function loadPersistentAsignaciones() {
  try {
    ensureDataDir();
    if (fs.existsSync(DATA_FILE)) {
      const raw = fs.readFileSync(DATA_FILE, "utf-8");
      return JSON.parse(raw);
    }
    if (fs.existsSync(OLD_DATA_FILE)) {
      const raw = fs.readFileSync(OLD_DATA_FILE, "utf-8");
      const parsed = JSON.parse(raw);
      fs.writeFileSync(DATA_FILE, JSON.stringify(parsed, null, 2), "utf-8");
      return parsed;
    }
  } catch (err) {
    console.warn("Aviso al leer asignaciones locales:", err.message);
  }
  return [];
}

// Guardado persistente en archivo fuera de src/ para no reiniciar nodemon
function savePersistentAsignaciones(list) {
  try {
    ensureDataDir();
    fs.writeFileSync(DATA_FILE, JSON.stringify(list, null, 2), "utf-8");
  } catch (err) {
    console.warn("Aviso al guardar asignaciones locales:", err.message);
  }
}

let asignacionesMemoria = loadPersistentAsignaciones();

// 1. Obtener todas las asignaciones de una sección
export const getAsignacionesPorSeccion = async (req, res) => {
  const { seccionId } = req.params;

  try {
    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase
        .from("asignaciones_instructores")
        .select("*")
        .eq("seccion_id", seccionId);

      if (!error && data) {
        return res.status(200).json({ success: true, data });
      }
      // Si la tabla aún no existe en Supabase (código PGRST205), usamos la memoria persistente
      if (error && error.code !== "PGRST205") {
        console.warn("Aviso en consulta Supabase asignaciones:", error.message);
      }
    }

    // Fallback memoria persistente
    const filtradas = asignacionesMemoria.filter((a) => a.seccion_id === seccionId);
    return res.status(200).json({ success: true, data: filtradas });
  } catch (error) {
    console.error("Error al obtener asignaciones:", error);
    const filtradas = asignacionesMemoria.filter((a) => a.seccion_id === seccionId);
    return res.status(200).json({ success: true, data: filtradas });
  }
};

// 2. Guardar una asignación individual (upsert)
export const guardarAsignacion = async (req, res) => {
  const { seccionId } = req.params;
  const { instructor_id, instructor_nombre, tipo_asignacion, referencia_id, metadata } = req.body;

  if (!tipo_asignacion || !referencia_id) {
    return res.status(400).json({
      success: false,
      message: "Datos incompletos para guardar asignación (tipo_asignacion y referencia_id requeridos)."
    });
  }

  try {
    let supabaseSaved = false;
    let savedItem = null;

    if (isSupabaseConfigured && supabase) {
      try {
        const { data, error } = await supabase
          .from("asignaciones_instructores")
          .upsert(
            {
              seccion_id: seccionId,
              instructor_id: instructor_id || null,
              tipo_asignacion,
              referencia_id,
              updated_at: new Date().toISOString()
            },
            { onConflict: "seccion_id, tipo_asignacion, referencia_id" }
          )
          .select()
          .single();

        if (!error && data) {
          savedItem = data;
          supabaseSaved = true;
        }
      } catch (_) {}
    }

    // Siempre sincronizar con memoria persistente
    const index = asignacionesMemoria.findIndex(
      (a) =>
        a.seccion_id === seccionId &&
        a.tipo_asignacion === tipo_asignacion &&
        a.referencia_id === referencia_id
    );

    const nuevaAsignacion = {
      id: savedItem?.id || (index >= 0 ? asignacionesMemoria[index].id : `asig-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`),
      seccion_id: seccionId,
      instructor_id: instructor_id || null,
      instructor_nombre: instructor_nombre || "",
      tipo_asignacion,
      referencia_id,
      metadata: metadata || {},
      updated_at: new Date().toISOString()
    };

    if (index >= 0) {
      asignacionesMemoria[index] = nuevaAsignacion;
    } else {
      asignacionesMemoria.push(nuevaAsignacion);
    }
    savePersistentAsignaciones(asignacionesMemoria);

    return res.status(200).json({
      success: true,
      message: "Asignación guardada con éxito",
      data: nuevaAsignacion,
      storage: supabaseSaved ? "supabase" : "local"
    });
  } catch (error) {
    console.error("Error al guardar asignación:", error);
    res.status(500).json({
      success: false,
      message: "Error al guardar asignación",
      error: error.message
    });
  }
};

// 3. Guardar asignaciones por lote (Batch)
export const guardarAsignacionesBatch = async (req, res) => {
  const { seccionId } = req.params;
  const { asignaciones } = req.body;

  if (!Array.isArray(asignaciones)) {
    return res.status(400).json({
      success: false,
      message: "Se requiere un array de 'asignaciones'."
    });
  }

  try {
    const timestamp = new Date().toISOString();

    // Intentar upsert en Supabase si está disponible
    if (isSupabaseConfigured && supabase) {
      try {
        const rowsToUpsert = asignaciones.map((a) => ({
          seccion_id: seccionId,
          instructor_id: a.instructor_id || null,
          tipo_asignacion: a.tipo_asignacion,
          referencia_id: a.referencia_id,
          updated_at: timestamp
        }));

        await supabase
          .from("asignaciones_instructores")
          .upsert(rowsToUpsert, { onConflict: "seccion_id, tipo_asignacion, referencia_id" });
      } catch (_) {}
    }

    // Sincronizar en memoria persistente local
    asignaciones.forEach((item) => {
      const index = asignacionesMemoria.findIndex(
        (a) =>
          a.seccion_id === seccionId &&
          a.tipo_asignacion === item.tipo_asignacion &&
          a.referencia_id === item.referencia_id
      );

      const record = {
        id: index >= 0 ? asignacionesMemoria[index].id : `asig-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
        seccion_id: seccionId,
        instructor_id: item.instructor_id || null,
        instructor_nombre: item.instructor_nombre || "",
        tipo_asignacion: item.tipo_asignacion,
        referencia_id: item.referencia_id,
        metadata: item.metadata || {},
        updated_at: timestamp
      };

      if (index >= 0) {
        asignacionesMemoria[index] = record;
      } else {
        asignacionesMemoria.push(record);
      }
    });

    savePersistentAsignaciones(asignacionesMemoria);

    const filtradas = asignacionesMemoria.filter((a) => a.seccion_id === seccionId);

    return res.status(200).json({
      success: true,
      message: `${asignaciones.length} asignaciones guardadas con éxito.`,
      data: filtradas
    });
  } catch (error) {
    console.error("Error en guardarAsignacionesBatch:", error);
    res.status(500).json({
      success: false,
      message: "Error al guardar el lote de asignaciones",
      error: error.message
    });
  }
};
