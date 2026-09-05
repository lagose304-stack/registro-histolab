import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import crypto from "node:crypto";
import { supabase, isSupabaseConfigured } from "../db/supabase.js";
import { updateEstudianteGradeDirect } from "./estudiantes.controller.js";

const __dirname = (() => {
  try {
    if (typeof import.meta !== "undefined" && typeof import.meta.url === "string" && import.meta.url.startsWith("file:")) {
      return path.dirname(fileURLToPath(import.meta.url));
    }
  } catch {}
  return (typeof process !== "undefined" && process.cwd) ? process.cwd() : "/";
})();
const DATA_DIR = path.join(__dirname, "../../data");
const DATA_FILE = path.join(DATA_DIR, "pruebas_data.json");

function ensureDataDir() {
  try {
    if (typeof fs.existsSync === "function" && !fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
  } catch (err) {
    // Ignorar errores de sistema de archivos en entornos serverless/Cloudflare Workers
  }
}

function loadPersistentPruebas() {
  try {
    ensureDataDir();
    if (fs.existsSync(DATA_FILE)) {
      const raw = fs.readFileSync(DATA_FILE, "utf-8");
      const parsed = JSON.parse(raw);
      return {
        pruebas: Array.isArray(parsed.pruebas) ? parsed.pruebas : [],
        entregas: Array.isArray(parsed.entregas) ? parsed.entregas : []
      };
    }
  } catch (err) {
    console.warn("Aviso al leer pruebas locales:", err.message);
  }
  return { pruebas: [], entregas: [] };
}

function savePersistentPruebas(state) {
  try {
    ensureDataDir();
    fs.writeFileSync(DATA_FILE, JSON.stringify(state, null, 2), "utf-8");
  } catch (err) {
    console.warn("Aviso al guardar pruebas locales:", err.message);
  }
}

let cachePruebas = loadPersistentPruebas();

// 1. Obtener la prueba configurada para una sección y semana
export const getPruebaSemanal = async (req, res) => {
  try {
    const { seccion_id, semana } = req.params;
    const numSemana = Number(semana);

    res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");

    if (isSupabaseConfigured && supabase) {
      try {
        const { data, error } = await supabase
          .from("pruebas_semanales")
          .select("*")
          .eq("seccion_id", seccion_id)
          .eq("numero_semana", numSemana)
          .maybeSingle();

        if (!error) {
          if (data) {
            const normalized = {
              ...data,
              duracion_minutos: data.tiempo_limite_minutos || data.duracion_minutos || 15,
              tiempo_limite_minutos: data.tiempo_limite_minutos || data.duracion_minutos || 15,
              tiempo_por_pregunta_segundos: data.tiempo_por_pregunta_segundos || 90,
              publicada: data.publicada === true || String(data.publicada) === "true" || data.estado === "publicada",
              preguntas: Array.isArray(data.preguntas)
                ? data.preguntas
                : typeof data.preguntas === "string"
                ? JSON.parse(data.preguntas || "[]")
                : []
            };
            return res.json({
              success: true,
              data: normalized
            });
          } else {
            // Si en Supabase no existe la prueba (fue borrada), quitar también del caché local
            const prevLen = cachePruebas.pruebas.length;
            cachePruebas.pruebas = cachePruebas.pruebas.filter(
              (p) => !(String(p.seccion_id) === String(seccion_id) && Number(p.numero_semana) === numSemana)
            );
            if (cachePruebas.pruebas.length !== prevLen) {
              savePersistentPruebas(cachePruebas);
            }
            return res.json({
              success: true,
              data: null
            });
          }
        }
      } catch (sbErr) {
        console.warn("Aviso en Supabase getPruebaSemanal:", sbErr.message);
      }
    }

    const found = cachePruebas.pruebas.find(
      (p) => String(p.seccion_id) === String(seccion_id) && Number(p.numero_semana) === numSemana
    );

    const normalizedFound = found
      ? {
          ...found,
          duracion_minutos: found.tiempo_limite_minutos || found.duracion_minutos || 15,
          tiempo_limite_minutos: found.tiempo_limite_minutos || found.duracion_minutos || 15,
          tiempo_por_pregunta_segundos: found.tiempo_por_pregunta_segundos || 90,
          publicada: found.publicada === true || String(found.publicada) === "true" || found.estado === "publicada",
          preguntas: Array.isArray(found.preguntas)
            ? found.preguntas
            : typeof found.preguntas === "string"
            ? JSON.parse(found.preguntas || "[]")
            : []
        }
      : null;

    return res.json({
      success: true,
      data: normalizedFound
    });
  } catch (error) {
    console.error("Error en getPruebaSemanal:", error);
    return res.status(500).json({
      success: false,
      message: "Error al obtener la prueba semanal",
      error: error.message
    });
  }
};

// 2. Obtener todas las pruebas de una sección (para el estudiante o docente)
export const getPruebasPorSeccion = async (req, res) => {
  try {
    const { seccion_id } = req.params;

    res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");

    if (isSupabaseConfigured && supabase) {
      try {
        const { data, error } = await supabase
          .from("pruebas_semanales")
          .select("*")
          .eq("seccion_id", seccion_id)
          .order("numero_semana", { ascending: true });

        if (!error && Array.isArray(data)) {
          // Sincronizar caché local con la BD
          const validWeekSet = new Set(data.map((p) => Number(p.numero_semana)));
          const prevLen = cachePruebas.pruebas.length;
          cachePruebas.pruebas = cachePruebas.pruebas.filter((p) => {
            if (String(p.seccion_id) === String(seccion_id)) {
              return validWeekSet.has(Number(p.numero_semana));
            }
            return true;
          });
          if (cachePruebas.pruebas.length !== prevLen) {
            savePersistentPruebas(cachePruebas);
          }

          const normalized = data.map((p) => ({
            ...p,
            duracion_minutos: p.tiempo_limite_minutos || p.duracion_minutos || 15,
            tiempo_limite_minutos: p.tiempo_limite_minutos || p.duracion_minutos || 15,
            publicada: p.publicada === true || String(p.publicada) === "true" || p.estado === "publicada",
            preguntas: Array.isArray(p.preguntas)
              ? p.preguntas
              : typeof p.preguntas === "string"
              ? JSON.parse(p.preguntas || "[]")
              : []
          }));
          return res.json({
            success: true,
            data: normalized
          });
        }
      } catch (sbErr) {
        console.warn("Aviso en Supabase getPruebasPorSeccion:", sbErr.message);
      }
    }

    const list = cachePruebas.pruebas
      .filter((p) => String(p.seccion_id) === String(seccion_id))
      .map((p) => ({
        ...p,
        duracion_minutos: p.tiempo_limite_minutos || p.duracion_minutos || 15,
        tiempo_limite_minutos: p.tiempo_limite_minutos || p.duracion_minutos || 15,
        publicada: p.publicada === true || String(p.publicada) === "true" || p.estado === "publicada",
        preguntas: Array.isArray(p.preguntas)
          ? p.preguntas
          : typeof p.preguntas === "string"
          ? JSON.parse(p.preguntas || "[]")
          : []
      }));

    return res.json({
      success: true,
      data: list
    });
  } catch (error) {
    console.error("Error en getPruebasPorSeccion:", error);
    return res.status(500).json({
      success: false,
      message: "Error al obtener las pruebas de la sección",
      error: error.message
    });
  }
};

// 3. Crear o actualizar una prueba semanal (Docente)
export const savePruebaSemanal = async (req, res) => {
  try {
    const { seccion_id } = req.params;
    const {
      id,
      numero_semana,
      carrera,
      titulo,
      descripcion,
      instrucciones,
      puntaje_total,
      duracion_minutos,
      tiempo_limite_minutos,
      estado,
      publicada,
      preguntas = []
    } = req.body;

    const numSemana = Number(numero_semana);
    if (!numSemana) {
      return res.status(400).json({
        success: false,
        message: "El número de semana es requerido."
      });
    }

    const isPublicada = publicada === true || String(publicada) === "true" || estado === "publicada";
    const tiempoPorPregunta = req.body.tiempo_por_pregunta_segundos ? Number(req.body.tiempo_por_pregunta_segundos) : 90;
    const duracionFinal = Number(tiempo_limite_minutos || duracion_minutos || Math.ceil((6 * tiempoPorPregunta) / 60));
    const rawPreguntas = Array.isArray(preguntas)
      ? preguntas
      : typeof preguntas === "string"
      ? JSON.parse(preguntas || "[]")
      : [];
    const parsedPreguntas = rawPreguntas.map((q) => ({
      ...q,
      tiempo_segundos: Number(q.tiempo_segundos) || tiempoPorPregunta
    }));

    // Validar y normar puntajes:
    // La calificación oficial de la prueba no puede exceder 5.000 pts (restricción chk_prueba_puntaje_total en BD)
    const rawPuntaje = puntaje_total !== undefined ? Number(puntaje_total) : 5.0;
    const cleanPuntajeOficial = Math.min(5.0, Math.max(0, isNaN(rawPuntaje) ? 5.0 : rawPuntaje));

    // El puntaje total con bonus (para Premios de la Sección) puede alcanzar 6.000 pts
    const rawBonusMax = req.body.puntaje_maximo_con_bonus !== undefined
      ? Number(req.body.puntaje_maximo_con_bonus)
      : Math.max(cleanPuntajeOficial, rawPuntaje);
    const cleanPuntajeConBonus = Math.max(cleanPuntajeOficial, isNaN(rawBonusMax) ? 6.0 : rawBonusMax);

    // Buscar si ya existe la prueba para mantener su ID original y no romper claves foráneas con entregas_pruebas
    let existingQuizId = id;
    if (isSupabaseConfigured && supabase) {
      try {
        const { data: existingRow } = await supabase
          .from("pruebas_semanales")
          .select("id")
          .eq("seccion_id", seccion_id)
          .eq("numero_semana", numSemana)
          .maybeSingle();

        if (existingRow?.id) {
          existingQuizId = existingRow.id;
        }
      } catch (findErr) {
        console.warn("Aviso al verificar existencia previa de prueba en Supabase:", findErr.message);
      }
    }

    if (!existingQuizId) {
      const localExisting = cachePruebas.pruebas.find(
        (p) => String(p.seccion_id) === String(seccion_id) && Number(p.numero_semana) === numSemana
      );
      if (localExisting?.id) {
        existingQuizId = localExisting.id;
      }
    }

    const finalId = existingQuizId || id || crypto.randomUUID();

    // Payload para Supabase usando estrictamente los nombres de columna de la tabla
    const sbPayload = {
      id: finalId,
      seccion_id,
      carrera: carrera || "Medicina",
      numero_semana: numSemana,
      titulo: titulo || `Prueba Semanal ${numSemana}`,
      descripcion: descripcion || "",
      instrucciones: instrucciones || "",
      tiempo_limite_minutos: duracionFinal,
      puntaje_total: cleanPuntajeOficial,
      tiene_bonus: true,
      puntaje_maximo_con_bonus: cleanPuntajeConBonus,
      publicada: isPublicada,
      estado: isPublicada ? "publicada" : (estado || "borrador"),
      preguntas: parsedPreguntas,
      updated_at: new Date().toISOString()
    };

    // Payload de respuesta completo compatible con el frontend
    const quizPayload = {
      ...sbPayload,
      duracion_minutos: duracionFinal,
      tiempo_por_pregunta_segundos: tiempoPorPregunta
    };

    if (isSupabaseConfigured && supabase) {
      try {
        const { data: upsertData, error } = await supabase
          .from("pruebas_semanales")
          .upsert(sbPayload, { onConflict: "seccion_id,numero_semana" })
          .select()
          .maybeSingle();

        if (error) {
          console.error("Error en upsert de pruebas_semanales en Supabase:", error.message);
          return res.status(500).json({
            success: false,
            message: `Error al persistir la prueba en base de datos: ${error.message}`,
            error: error.message
          });
        }
        if (upsertData?.id) {
          quizPayload.id = upsertData.id;
          sbPayload.id = upsertData.id;
        }
      } catch (sbErr) {
        console.error("Error en Supabase pruebas_semanales:", sbErr.message);
        return res.status(500).json({
          success: false,
          message: `Error inesperado al conectar con Supabase: ${sbErr.message}`,
          error: sbErr.message
        });
      }
    }

    // Persistencia local de respaldo
    const existingIdx = cachePruebas.pruebas.findIndex(
      (p) => String(p.seccion_id) === String(seccion_id) && Number(p.numero_semana) === numSemana
    );

    if (existingIdx !== -1) {
      cachePruebas.pruebas[existingIdx] = { ...cachePruebas.pruebas[existingIdx], ...quizPayload };
    } else {
      cachePruebas.pruebas.push(quizPayload);
    }
    savePersistentPruebas(cachePruebas);

    return res.json({
      success: true,
      message: `Prueba de la Semana ${numSemana} guardada exitosamente (${isPublicada ? "PUBLICADA" : "BORRADOR"}).`,
      data: quizPayload
    });
  } catch (error) {
    console.error("Error en savePruebaSemanal:", error);
    return res.status(500).json({
      success: false,
      message: "Error al guardar la prueba semanal",
      error: error.message
    });
  }
};

// 4. Entregar prueba semanal por parte del estudiante
export const submitPruebaEstudiante = async (req, res) => {
  try {
    const { seccion_id } = req.params;
    const {
      quiz_id,
      numero_semana,
      numero_cuenta,
      nombre_completo,
      carrera,
      respuestas = {},
      auditoria = {}
    } = req.body;

    if (!numero_cuenta || !numero_semana) {
      return res.status(400).json({
        success: false,
        message: "Número de cuenta y semana son obligatorios para la entrega."
      });
    }

    const numSemana = Number(numero_semana);
    const parsedRespuestas =
      typeof respuestas === "string"
        ? JSON.parse(respuestas || "{}")
        : (respuestas || {});
    const parsedAuditoria =
      typeof auditoria === "string"
        ? JSON.parse(auditoria || "{}")
        : (auditoria || {});

    // Buscar si ya existía una entrega previa en Supabase o en local
    let existingSubmission = null;
    if (isSupabaseConfigured && supabase) {
      try {
        const { data: sbSub } = await supabase
          .from("entregas_pruebas")
          .select("*")
          .eq("seccion_id", seccion_id)
          .eq("numero_semana", numSemana)
          .eq("numero_cuenta", String(numero_cuenta))
          .maybeSingle();
        if (sbSub) {
          existingSubmission = sbSub;
        }
      } catch (_) {}
    }

    if (!existingSubmission) {
      existingSubmission = cachePruebas.entregas.find(
        (e) =>
          String(e.seccion_id) === String(seccion_id) &&
          Number(e.numero_semana) === numSemana &&
          String(e.numero_cuenta) === String(numero_cuenta)
      );
    }

    // Blindaje contra reenvío o sobreescritura fraudulenta: Si ya existe una entrega registrada, no permitir alterarla
    if (existingSubmission && (existingSubmission.estado === "enviado" || existingSubmission.estado === "calificado")) {
      return res.status(403).json({
        success: false,
        message: "Esta evaluación ya fue entregada y registrada previamente. No es posible modificar las respuestas a menos que el docente autorice y elimine la entrega anterior.",
        data: existingSubmission
      });
    }

    // Registrar sello de tiempo inmutable del servidor
    const horaServidor = new Date().toISOString();
    parsedAuditoria.hora_recepcion_servidor = horaServidor;

    let finalQuizId = quiz_id || existingSubmission?.quiz_id || null;
    if (!finalQuizId && isSupabaseConfigured && supabase) {
      try {
        const { data: qData } = await supabase
          .from("pruebas_semanales")
          .select("id")
          .eq("seccion_id", seccion_id)
          .eq("numero_semana", numSemana)
          .maybeSingle();
        if (qData?.id) finalQuizId = qData.id;
      } catch (_) {}
    }

    const submissionPayload = {
      id: existingSubmission?.id || crypto.randomUUID(),
      quiz_id: finalQuizId,
      seccion_id,
      carrera: carrera || existingSubmission?.carrera || "Medicina",
      numero_semana: numSemana,
      numero_cuenta: String(numero_cuenta),
      nombre_completo: nombre_completo || existingSubmission?.nombre_completo || "",
      respuestas: parsedRespuestas,
      estado: "enviado", // Al enviar respuestas, queda lista para revisión docente
      nota_obtenida: null,
      comentarios: "",
      auditoria: parsedAuditoria,
      fecha_envio: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    if (isSupabaseConfigured && supabase) {
      try {
        const { error: sbErr } = await supabase
          .from("entregas_pruebas")
          .upsert(submissionPayload, { onConflict: "seccion_id,numero_semana,numero_cuenta" });
        if (sbErr) {
          console.warn("Aviso en Supabase entregas_pruebas (reintentando sin columna auditoria si no existe):", sbErr.message);
          const { auditoria: _, ...payloadWithoutAuditoria } = submissionPayload;
          await supabase
            .from("entregas_pruebas")
            .upsert(payloadWithoutAuditoria, { onConflict: "seccion_id,numero_semana,numero_cuenta" });
        }
      } catch (sbErr) {
        console.warn("Aviso en Supabase entregas_pruebas:", sbErr.message);
      }
    }

    const idx = cachePruebas.entregas.findIndex(
      (e) =>
        String(e.seccion_id) === String(seccion_id) &&
        Number(e.numero_semana) === numSemana &&
        String(e.numero_cuenta) === String(numero_cuenta)
    );

    if (idx !== -1) {
      cachePruebas.entregas[idx] = submissionPayload;
    } else {
      cachePruebas.entregas.push(submissionPayload);
    }
    savePersistentPruebas(cachePruebas);

    return res.json({
      success: true,
      message: "¡Prueba semanal entregada con éxito!",
      data: submissionPayload
    });
  } catch (error) {
    console.error("Error en submitPruebaEstudiante:", error);
    return res.status(500).json({
      success: false,
      message: "Error al registrar la entrega de la prueba",
      error: error.message
    });
  }
};

// 5. Obtener entregas de estudiantes para una prueba semanal (Docente)
export const getEntregasPorSemana = async (req, res) => {
  try {
    const { seccion_id, semana } = req.params;
    const numSemana = Number(semana);

    res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");

    if (isSupabaseConfigured && supabase) {
      try {
        const { data, error } = await supabase
          .from("entregas_pruebas")
          .select("*")
          .eq("seccion_id", seccion_id)
          .eq("numero_semana", numSemana);

        if (!error) {
          const arr = Array.isArray(data) ? data : [];
          // Sincronizar cache local eliminando entregas que ya no existen en Supabase
          const validAccountSet = new Set(arr.map((d) => String(d.numero_cuenta)));
          const prevLen = cachePruebas.entregas.length;
          cachePruebas.entregas = cachePruebas.entregas.filter((e) => {
            if (String(e.seccion_id) === String(seccion_id) && Number(e.numero_semana) === numSemana) {
              return validAccountSet.has(String(e.numero_cuenta));
            }
            return true;
          });
          if (cachePruebas.entregas.length !== prevLen) {
            savePersistentPruebas(cachePruebas);
          }

          const normalized = arr.map((d) => ({
            ...d,
            respuestas: typeof d.respuestas === "string" ? JSON.parse(d.respuestas || "{}") : (d.respuestas || {}),
            auditoria: typeof d.auditoria === "string" ? JSON.parse(d.auditoria || "{}") : (d.auditoria || {})
          }));
          return res.json({
            success: true,
            data: normalized
          });
        }
      } catch (sbErr) {
        console.warn("Aviso en Supabase getEntregasPorSemana:", sbErr.message);
      }
    }

    const list = cachePruebas.entregas
      .filter((e) => String(e.seccion_id) === String(seccion_id) && Number(e.numero_semana) === numSemana)
      .map((d) => ({
        ...d,
        respuestas: typeof d.respuestas === "string" ? JSON.parse(d.respuestas || "{}") : (d.respuestas || {}),
        auditoria: typeof d.auditoria === "string" ? JSON.parse(d.auditoria || "{}") : (d.auditoria || {})
      }));

    return res.json({
      success: true,
      data: list
    });
  } catch (error) {
    console.error("Error en getEntregasPorSemana:", error);
    return res.status(500).json({
      success: false,
      message: "Error al obtener entregas de la semana",
      error: error.message
    });
  }
};

// 6. Obtener la entrega de un estudiante específico para una semana (Estudiante / Docente)
export const getMiEntregaSemanal = async (req, res) => {
  try {
    const { seccion_id, semana, numero_cuenta } = req.params;
    const numSemana = Number(semana);

    res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");

    if (isSupabaseConfigured && supabase) {
      try {
        const { data, error } = await supabase
          .from("entregas_pruebas")
          .select("*")
          .eq("seccion_id", seccion_id)
          .eq("numero_semana", numSemana)
          .eq("numero_cuenta", String(numero_cuenta))
          .maybeSingle();

        if (!error) {
          if (data) {
            const normalized = {
              ...data,
              respuestas: typeof data.respuestas === "string" ? JSON.parse(data.respuestas || "{}") : (data.respuestas || {}),
              auditoria: typeof data.auditoria === "string" ? JSON.parse(data.auditoria || "{}") : (data.auditoria || {})
            };
            return res.json({
              success: true,
              data: normalized
            });
          } else {
            // En Supabase no existe entrega (o fue borrada directamente de la BD).
            // Sincronizar inmediatamente eliminando cualquier copia en el caché local
            const prevLen = cachePruebas.entregas.length;
            cachePruebas.entregas = cachePruebas.entregas.filter(
              (e) =>
                !(
                  String(e.seccion_id) === String(seccion_id) &&
                  Number(e.numero_semana) === numSemana &&
                  String(e.numero_cuenta) === String(numero_cuenta)
                )
            );
            if (cachePruebas.entregas.length !== prevLen) {
              savePersistentPruebas(cachePruebas);
            }

            return res.json({
              success: true,
              data: null
            });
          }
        }
      } catch (sbErr) {
        console.warn("Aviso en Supabase getMiEntregaSemanal:", sbErr.message);
      }
    }

    const found = cachePruebas.entregas.find(
      (e) =>
        String(e.seccion_id) === String(seccion_id) &&
        Number(e.numero_semana) === numSemana &&
        String(e.numero_cuenta) === String(numero_cuenta)
    );

    const normalizedFound = found
      ? {
          ...found,
          respuestas: typeof found.respuestas === "string" ? JSON.parse(found.respuestas || "{}") : (found.respuestas || {}),
          auditoria: typeof found.auditoria === "string" ? JSON.parse(found.auditoria || "{}") : (found.auditoria || {})
        }
      : null;

    return res.json({
      success: true,
      data: normalizedFound
    });
  } catch (error) {
    console.error("Error en getMiEntregaSemanal:", error);
    return res.status(500).json({
      success: false,
      message: "Error al obtener entrega del estudiante",
      error: error.message
    });
  }
};

// 7. Calificar una entrega y sincronizar automáticamente con la nota oficial del estudiante
export const calificarEntrega = async (req, res) => {
  try {
    const { entrega_id } = req.params;
    const { nota_obtenida, nota_real, nota_con_bonus, comentarios, calificado_por, carrera, evaluaciones_incisos, auditoria } = req.body;

    const numNota = Number(nota_obtenida);
    if (isNaN(numNota) || numNota < 0) {
      return res.status(400).json({
        success: false,
        message: "La calificación de la prueba debe ser un número mayor o igual a 0."
      });
    }

    // Calificación oficial: se topa reglamentariamente en 5.000 pts para el cuadro de notas
    const cleanNota = Math.min(5.0, Math.round(numNota * 1000) / 1000);

    // Calificación real: con puntos bonus para el ranking de Premios de la Sección (puede llegar a 6.000 pts o más)
    const rawBonusVal = nota_real !== undefined ? Number(nota_real) : (nota_con_bonus !== undefined ? Number(nota_con_bonus) : numNota);
    const cleanRealNota = isNaN(rawBonusVal) ? cleanNota : Math.round(rawBonusVal * 1000) / 1000;

    let sub = null;
    let subIdx = cachePruebas.entregas.findIndex((e) => String(e.id) === String(entrega_id));
    if (subIdx !== -1) {
      sub = cachePruebas.entregas[subIdx];
    } else if (isSupabaseConfigured && supabase) {
      try {
        const { data: sbSub } = await supabase
          .from("entregas_pruebas")
          .select("*")
          .eq("id", entrega_id)
          .maybeSingle();
        if (sbSub) {
          sub = sbSub;
          cachePruebas.entregas.push(sbSub);
          subIdx = cachePruebas.entregas.length - 1;
        }
      } catch (_) {}
    }

    if (!sub) {
      return res.status(404).json({
        success: false,
        message: "Entrega no encontrada."
      });
    }

    sub.nota_obtenida = cleanNota;
    sub.nota_real = cleanRealNota;
    sub.nota_con_bonus = cleanRealNota;
    sub.comentarios = comentarios || "";
    sub.estado = "calificado";
    sub.calificado_por = calificado_por || "Docente";
    if (evaluaciones_incisos) {
      sub.evaluaciones_incisos = evaluaciones_incisos;
    }
    sub.auditoria = {
      ...(sub.auditoria || {}),
      ...(auditoria || {}),
      nota_real: cleanRealNota,
      nota_con_bonus: cleanRealNota,
      ...(evaluaciones_incisos ? { evaluaciones_incisos } : {})
    };
    sub.updated_at = new Date().toISOString();

    if (isSupabaseConfigured && supabase) {
      try {
        const updatePayload = {
          nota_obtenida: cleanNota,
          nota_real: cleanRealNota,
          nota_con_bonus: cleanRealNota,
          comentarios: sub.comentarios,
          estado: "calificado",
          calificado_por: sub.calificado_por,
          updated_at: sub.updated_at
        };
        if (sub.auditoria) {
          updatePayload.auditoria = sub.auditoria;
        }
        const { error: updErr } = await supabase
          .from("entregas_pruebas")
          .update(updatePayload)
          .eq("id", entrega_id);

        if (updErr) {
          // Fallback por si las columnas nota_real / nota_con_bonus aún no existen en la base de datos
          delete updatePayload.nota_real;
          delete updatePayload.nota_con_bonus;
          await supabase
            .from("entregas_pruebas")
            .update(updatePayload)
            .eq("id", entrega_id);
        }
      } catch (sbErr) {
        console.warn("Aviso al actualizar entrega en Supabase:", sbErr.message);
      }
    }

    savePersistentPruebas(cachePruebas);

    // Sincronizar nota directamente en la ficha del estudiante (prueba_X = cleanNota)
    try {
      await updateEstudianteGradeDirect(
        sub.seccion_id,
        sub.numero_cuenta,
        carrera || sub.carrera || "Medicina",
        `prueba_${sub.numero_semana}`,
        cleanNota
      );

      // Si obtuvo nota real con bonus superior a 5.0, sincronizar prueba_X_real
      if (cleanRealNota > 5.0) {
        await updateEstudianteGradeDirect(
          sub.seccion_id,
          sub.numero_cuenta,
          carrera || sub.carrera || "Medicina",
          `prueba_${sub.numero_semana}_real`,
          cleanRealNota
        ).catch(() => {});
      }
    } catch (syncErr) {
      console.warn("Aviso al sincronizar nota en ficha de estudiante:", syncErr.message);
    }

    return res.json({
      success: true,
      message: `Entrega calificada exitosamente (${cleanNota} / 5.000 pts oficiales, ${cleanRealNota} pts reales) y sincronizada.`,
      data: sub
    });
  } catch (error) {
    console.error("Error en calificarEntrega:", error);
    return res.status(500).json({
      success: false,
      message: "Error al calificar la entrega",
      error: error.message
    });
  }
};

// 7.1 Obtener todas las entregas de una sección para el ranking de Premios de la Sección
export const getAllEntregasPorSeccion = async (req, res) => {
  try {
    const { seccion_id } = req.params;
    res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");

    if (isSupabaseConfigured && supabase) {
      try {
        const { data, error } = await supabase
          .from("entregas_pruebas")
          .select("*")
          .eq("seccion_id", String(seccion_id));

        if (!error && Array.isArray(data)) {
          const normalized = data.map((d) => {
            const parsedAud = typeof d.auditoria === "string" ? JSON.parse(d.auditoria || "{}") : (d.auditoria || {});
            const nReal = d.nota_real !== undefined && d.nota_real !== null ? Number(d.nota_real) : (parsedAud.nota_real !== undefined ? Number(parsedAud.nota_real) : (d.nota_con_bonus !== undefined ? Number(d.nota_con_bonus) : Number(d.nota_obtenida || 0)));
            return {
              ...d,
              nota_real: nReal,
              nota_con_bonus: nReal,
              respuestas: typeof d.respuestas === "string" ? JSON.parse(d.respuestas || "{}") : (d.respuestas || {}),
              auditoria: parsedAud
            };
          });
          return res.json({
            success: true,
            data: normalized
          });
        }
      } catch (sbErr) {
        console.warn("Aviso en Supabase getAllEntregasPorSeccion:", sbErr.message);
      }
    }

    const list = cachePruebas.entregas
      .filter((e) => String(e.seccion_id) === String(seccion_id))
      .map((d) => {
        const parsedAud = typeof d.auditoria === "string" ? JSON.parse(d.auditoria || "{}") : (d.auditoria || {});
        const nReal = d.nota_real !== undefined && d.nota_real !== null ? Number(d.nota_real) : (parsedAud.nota_real !== undefined ? Number(parsedAud.nota_real) : (d.nota_con_bonus !== undefined ? Number(d.nota_con_bonus) : Number(d.nota_obtenida || 0)));
        return {
          ...d,
          nota_real: nReal,
          nota_con_bonus: nReal,
          respuestas: typeof d.respuestas === "string" ? JSON.parse(d.respuestas || "{}") : (d.respuestas || {}),
          auditoria: parsedAud
        };
      });

    return res.json({
      success: true,
      data: list
    });
  } catch (error) {
    console.error("Error en getAllEntregasPorSeccion:", error);
    return res.status(500).json({
      success: false,
      message: "Error al consultar todas las entregas de la sección",
      error: error.message
    });
  }
};

// 8. Eliminar todas las pruebas y entregas asociadas a una sección cuando la sección se elimina (Cascade Delete)
export const deletePruebasBySeccion = async (seccionId) => {
  try {
    if (!seccionId) return false;
    const secIdStr = String(seccionId);

    // 1. Supabase (Eliminación en cascada de entregas y pruebas)
    if (isSupabaseConfigured && supabase) {
      try {
        await supabase
          .from("entregas_pruebas")
          .delete()
          .eq("seccion_id", secIdStr);

        await supabase
          .from("pruebas_semanales")
          .delete()
          .eq("seccion_id", secIdStr);
      } catch (sbErr) {
        console.warn("Aviso en Supabase al eliminar pruebas en cascada:", sbErr.message);
      }
    }

    // 2. Persistencia local / Caché en memoria
    const prevPruebas = cachePruebas.pruebas.length;
    const prevEntregas = cachePruebas.entregas.length;

    cachePruebas.pruebas = cachePruebas.pruebas.filter((p) => String(p.seccion_id) !== secIdStr);
    cachePruebas.entregas = cachePruebas.entregas.filter((e) => String(e.seccion_id) !== secIdStr);

    if (cachePruebas.pruebas.length !== prevPruebas || cachePruebas.entregas.length !== prevEntregas) {
      savePersistentPruebas(cachePruebas);
      console.log(`[CASCADE DELETE] Se eliminaron las pruebas y entregas vinculadas a la sección: ${secIdStr}`);
    }

    return true;
  } catch (err) {
    console.error("Error al eliminar pruebas por sección:", err);
    return false;
  }
};

// 9. Endpoint HTTP para eliminar pruebas de una sección
export const deletePruebasSeccionHandler = async (req, res) => {
  try {
    const { seccion_id } = req.params;
    await deletePruebasBySeccion(seccion_id);
    return res.json({
      success: true,
      message: `Pruebas y entregas de la sección ${seccion_id} eliminadas exitosamente.`
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: "Error al eliminar pruebas de la sección",
      error: err.message
    });
  }
};

// 10. Eliminar entrega individual de un estudiante (permite habilitar reintento)
export const deleteEntregaEstudiante = async (req, res) => {
  try {
    const { entrega_id, seccion_id, semana, numero_cuenta } = {
      ...req.params,
      ...req.query,
      ...req.body
    };

    let targetId = entrega_id;
    let targetSecId = seccion_id;
    let targetSemana = semana !== undefined && semana !== null ? Number(semana) : null;
    let targetCuenta = numero_cuenta ? String(numero_cuenta) : null;

    // Buscar en caché si falta algún identificador
    const localMatch = cachePruebas.entregas.find((e) =>
      targetId
        ? String(e.id) === String(targetId)
        : String(e.seccion_id) === String(targetSecId) &&
          Number(e.numero_semana) === targetSemana &&
          String(e.numero_cuenta) === targetCuenta
    );

    if (localMatch) {
      targetId = targetId || localMatch.id;
      targetSecId = targetSecId || localMatch.seccion_id;
      targetSemana = targetSemana ?? localMatch.numero_semana;
      targetCuenta = targetCuenta || localMatch.numero_cuenta;
    }

    if (isSupabaseConfigured && supabase) {
      try {
        if (targetId) {
          await supabase.from("entregas_pruebas").delete().eq("id", targetId);
        }
        if (targetSecId && targetSemana && targetCuenta) {
          await supabase
            .from("entregas_pruebas")
            .delete()
            .eq("seccion_id", targetSecId)
            .eq("numero_semana", targetSemana)
            .eq("numero_cuenta", targetCuenta);
        }
      } catch (sbErr) {
        console.warn("Aviso al eliminar entrega de prueba en Supabase:", sbErr.message);
      }
    }

    // Limpiar de caché local y archivo JSON
    const prevLen = cachePruebas.entregas.length;
    cachePruebas.entregas = cachePruebas.entregas.filter((e) => {
      if (targetId && String(e.id) === String(targetId)) return false;
      if (
        targetSecId &&
        targetSemana !== null &&
        targetCuenta &&
        String(e.seccion_id) === String(targetSecId) &&
        Number(e.numero_semana) === Number(targetSemana) &&
        String(e.numero_cuenta) === String(targetCuenta)
      ) {
        return false;
      }
      return true;
    });

    if (cachePruebas.entregas.length !== prevLen) {
      savePersistentPruebas(cachePruebas);
    }

    // Resetear la nota asociada a esta prueba en la ficha del estudiante si existía
    if (targetSecId && targetCuenta && targetSemana !== null) {
      try {
        const studentRes = await supabase
          .from("estudiantes")
          .select("carrera")
          .eq("numero_cuenta", targetCuenta)
          .maybeSingle();
        const carrera = studentRes?.data?.carrera || "Medicina";

        await updateEstudianteGradeDirect(
          targetSecId,
          targetCuenta,
          carrera,
          `prueba_${targetSemana}`,
          null
        );
      } catch (gErr) {
        console.warn("Aviso al limpiar nota de estudiante tras eliminar entrega:", gErr.message);
      }
    }

    return res.json({
      success: true,
      message: "Entrega eliminada exitosamente. El estudiante ahora puede volver a realizar la prueba."
    });
  } catch (error) {
    console.error("Error en deleteEntregaEstudiante:", error);
    return res.status(500).json({
      success: false,
      message: "Error al eliminar la entrega de la prueba",
      error: error.message
    });
  }
};


