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
    console.warn("Aviso al leer sesiones en vivo:", err.message);
  }
  return {};
}

function savePersistentLiveSessions(sessions) {
  try {
    ensureDataDir();
    fs.writeFileSync(LIVE_DATA_FILE, JSON.stringify(sessions, null, 2), "utf-8");
  } catch (err) {
    console.warn("Aviso al guardar sesiones en vivo:", err.message);
  }
}

// Sincronización asíncrona no bloqueante con la tabla sesiones_pruebas_en_vivo de Supabase
async function syncLiveSessionToSupabase(session) {
  if (!isSupabaseConfigured || !supabase || !session?.seccion_id) return;
  try {
    const payload = {
      seccion_id: session.seccion_id,
      numero_semana: Number(session.numero_semana),
      estado: session.estado || "inactiva",
      habilitada: Boolean(session.habilitada),
      pregunta_actual_idx: session.pregunta_actual_idx ?? 0,
      duracion_segundos: session.duracion_segundos ?? 90,
      pregunta_inicio_timestamp: session.pregunta_inicio_timestamp || null,
      alumnos_conectados: session.alumnos_conectados || {},
      respuestas_globales: session.respuestas_globales || {},
      updated_at: new Date().toISOString()
    };

    await supabase
      .from("sesiones_pruebas_en_vivo")
      .upsert(payload, { onConflict: "seccion_id,numero_semana" });
  } catch (err) {
    // Si la tabla aún no se ha creado en Supabase, el sistema continúa funcionando con JSON sin interrumpir la prueba
    console.warn("Aviso al sincronizar sesión en vivo con Supabase:", err.message);
  }
}

// Mapa en memoria de sesiones en vivo: clave `${seccion_id}_sem_${semana}`
const liveSessions = loadPersistentLiveSessions();

function getSessionKey(seccion_id, semana) {
  return `${String(seccion_id).trim()}_sem_${Number(semana)}`;
}

function getOrCreateSession(seccion_id, semana) {
  const key = getSessionKey(seccion_id, semana);
  if (!liveSessions[key]) {
    liveSessions[key] = {
      seccion_id: String(seccion_id),
      numero_semana: Number(semana),
      estado: "inactiva", // 'inactiva' | 'lobby' | 'en_pregunta' | 'esperando_siguiente' | 'finalizada'
      habilitada: false,
      pregunta_actual_idx: 0, // 0 = Pregunta 1
      pregunta_inicio_timestamp: null,
      duracion_segundos: 90, // Por defecto 1:30 min = 90 segundos
      alumnos_conectados: {}, // { [numero_cuenta]: { nombre, ultimo_ping, pregunta_actual, respuestas_count } }
      respuestas_globales: {}, // { [numero_cuenta]: { [pregunta_id]: { ... } } }
      ultima_actualizacion: Date.now()
    };
  }
  return liveSessions[key];
}

// 1. Obtener estado sincronizado de la sesión en vivo
export const getLiveQuizState = async (req, res) => {
  try {
    const { seccion_id, semana } = req.params;
    const session = getOrCreateSession(seccion_id, semana);
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
      }
    }

    res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
    return res.json({
      success: true,
      data: {
        ...session,
        tiempo_restante_segundos,
        tiempo_transcurrido_segundos,
        total_conectados: Object.keys(session.alumnos_conectados || {}).length,
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
    const { accion, duracion_segundos, pregunta_idx } = req.body;
    const session = getOrCreateSession(seccion_id, semana);
    const now = Date.now();

    switch (accion) {
      case "habilitar": {
        // Pasa de inactiva a lobby (los alumnos pueden entrar a ver los Datos Generales)
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

    savePersistentLiveSessions(liveSessions);
    syncLiveSessionToSupabase(session).catch((err) => {
      console.warn("Aviso en syncLiveSessionToSupabase:", err.message);
    });

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

// 3. Latido (Heartbeat) de los estudiantes durante la prueba en vivo
export const heartbeatLiveQuiz = async (req, res) => {
  try {
    const { seccion_id, semana } = req.params;
    const { numero_cuenta, nombre_completo, respuestas_parciales, pregunta_vista } = req.body;

    if (!numero_cuenta) {
      return res.status(400).json({ success: false, message: "Se requiere numero_cuenta" });
    }

    const session = getOrCreateSession(seccion_id, semana);
    const now = Date.now();

    // Actualizar registro del estudiante conectado
    session.alumnos_conectados[numero_cuenta] = {
      nombre_completo: nombre_completo || session.alumnos_conectados[numero_cuenta]?.nombre_completo || "Estudiante",
      ultimo_ping: now,
      pregunta_vista: typeof pregunta_vista === "number" ? pregunta_vista : session.pregunta_actual_idx,
      ip: req.headers["x-forwarded-for"] || req.socket.remoteAddress || "127.0.0.1"
    };

    // Respaldar respuestas parciales si se enviaron
    if (respuestas_parciales && typeof respuestas_parciales === "object") {
      if (!session.respuestas_globales[numero_cuenta]) {
        session.respuestas_globales[numero_cuenta] = {};
      }
      session.respuestas_globales[numero_cuenta] = {
        ...session.respuestas_globales[numero_cuenta],
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

    return res.json({
      success: true,
      data: {
        estado: session.estado,
        habilitada: session.habilitada,
        pregunta_actual_idx: session.pregunta_actual_idx,
        duracion_segundos: session.duracion_segundos,
        tiempo_restante_segundos,
        tiempo_transcurrido_segundos,
        total_conectados: Object.keys(session.alumnos_conectados || {}).length,
        server_time: now
      }
    });
  } catch (err) {
    console.error("Error en heartbeatLiveQuiz:", err);
    return res.status(500).json({ success: false, message: "Error al procesar latido en vivo" });
  }
};
