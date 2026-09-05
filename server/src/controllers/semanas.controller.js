import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { supabase, isSupabaseConfigured } from "../db/supabase.js";
import { CAREER_DEFAULT_TEMAS } from "./temario.controller.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.join(__dirname, "../../data");
const SEMANAS_FILE = path.join(DATA_DIR, "semanas_data.json");

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function loadPersistentSemanas() {
  try {
    ensureDataDir();
    if (fs.existsSync(SEMANAS_FILE)) {
      const raw = fs.readFileSync(SEMANAS_FILE, "utf-8");
      return JSON.parse(raw);
    }
  } catch (err) {
    console.warn("Aviso al leer semanas locales:", err.message);
  }
  return {};
}

function savePersistentSemanas(data) {
  try {
    ensureDataDir();
    fs.writeFileSync(SEMANAS_FILE, JSON.stringify(data, null, 2), "utf-8");
  } catch (err) {
    console.warn("Aviso al guardar semanas locales:", err.message);
  }
}

let inMemorySemanasConfig = loadPersistentSemanas();

/**
 * Normaliza la clave de carrera
 */
const getNormalizedCareerKey = (carrera) => {
  const c = String(carrera || "Medicina")
    .toLowerCase()
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  if (c.includes("enferm")) return "Enfermeria";
  if (c.includes("odont")) return "Odontologia";
  if (c.includes("microb")) return "Microbiologia";
  if (c.includes("nutri")) return "Nutricion";
  return "Medicina";
};

// Helper para calcular el parcial al que pertenece una semana por defecto (incluyendo semana de examen)
function getParcialForWeek(semanaNum, totalWeeks = 15) {
  if (totalWeeks >= 15) {
    if (semanaNum <= 5) return "I Parcial";
    if (semanaNum <= 10) return "II Parcial";
    return "III Parcial";
  }
  if (semanaNum <= 5) return "I Parcial";
  if (semanaNum <= 10) return "II Parcial";
  return "III Parcial";
}

// 1. Obtener la configuración de semanas y los temas asignados a cada una
export const getSemanasConfig = async (req, res) => {
  try {
    const { carrera = "Medicina" } = req.query;
    const normCarrera = getNormalizedCareerKey(carrera);

    // 1. Obtener los temas registrados en temario para esta carrera
    let careerTemas = [];
    if (isSupabaseConfigured && supabase) {
      const { data } = await supabase
        .from("temario")
        .select("*")
        .ilike("carrera", `%${normCarrera}%`)
        .order("semana", { ascending: true });
      careerTemas = data || [];
    }

    // 2. Obtener las semanas guardadas para esta carrera en configuracion_semanas
    let savedWeeks = [];
    if (isSupabaseConfigured && supabase) {
      const { data } = await supabase
        .from("configuracion_semanas")
        .select("*")
        .ilike("carrera", `%${normCarrera}%`)
        .order("numero_semana", { ascending: true });
      savedWeeks = data || [];
    }

    if (savedWeeks.length === 0) {
      savedWeeks = inMemorySemanasConfig[normCarrera] || [];
    }

    // Agrupar temas por semana
    const temasPorSemana = {};
    const temasListPorSemana = {};
    const temasIdsPorSemana = {};

    careerTemas.forEach((t) => {
      const sem = Number(t.semana) || 0;
      if (sem > 0) {
        if (!temasPorSemana[sem]) temasPorSemana[sem] = [];
        if (!temasListPorSemana[sem]) temasListPorSemana[sem] = [];
        if (!temasIdsPorSemana[sem]) temasIdsPorSemana[sem] = [];

        temasPorSemana[sem].push(t.titulo || t.nombre);
        temasListPorSemana[sem].push(t);
        temasIdsPorSemana[sem].push(t.id);
      }
    });

    // Unir números de semana de configuracion_semanas y de temario
    const semanasSet = new Set([
      ...savedWeeks.map((w) => Number(w.numero_semana)),
      ...Object.keys(temasPorSemana).map(Number)
    ]);

    const semanasNumeros = Array.from(semanasSet).sort((a, b) => a - b);
    const totalWeeksCount = semanasNumeros.length || 12;

    const result = semanasNumeros.map((semNum, idx) => {
      const found = savedWeeks.find((w) => Number(w.numero_semana) === semNum);
      const isExam = found
        ? Boolean(
            found.es_examen ||
              found.temas === "EXAMEN" ||
              (found.descripcion && found.descripcion.toLowerCase().includes("examen"))
          )
        : false;

      const temasArray = isExam ? [] : temasPorSemana[semNum] || [];
      const temasList = isExam ? [] : temasListPorSemana[semNum] || [];
      const temasIds = isExam ? [] : temasIdsPorSemana[semNum] || [];

      let examDefaultName = `Examen ${String(found?.parcial || getParcialForWeek(semNum, totalWeeksCount)).includes("III") ? "III" : String(found?.parcial || getParcialForWeek(semNum, totalWeeksCount)).includes("II") ? "II" : "I"}`;
      let cleanNombre = found?.descripcion || (isExam ? examDefaultName : `Semana ${semNum}`);
      if (isExam && /^Semana\s*\d+\s*[-:•–—]?\s*Examen/i.test(cleanNombre)) {
        cleanNombre = cleanNombre.replace(/^Semana\s*\d+\s*[-:•–—]?\s*/i, "").replace(/^Examen\s+([IVX\d]+)\s+Parcial$/i, "Examen $1");
      }

      return {
        numero_semana: semNum,
        nombre_semana: cleanNombre,
        carrera: normCarrera,
        parcial: found?.parcial || getParcialForWeek(semNum, totalWeeksCount),
        es_examen: isExam,
        temas: isExam
          ? `Examen ${found?.parcial || getParcialForWeek(semNum, totalWeeksCount)}`
          : temasArray.join(", "),
        temas_list: temasList,
        temas_ids: temasIds,
        fecha_inicio: found?.fecha_inicio || null,
        fecha_fin: found?.fecha_fin || null,
        es_semana_actual: found ? Boolean(found.es_semana_actual) : idx === 0,
        descripcion: cleanNombre
      };
    });

    res.json({
      success: true,
      carrera: normCarrera,
      countTemas: careerTemas.length,
      countSemanas: result.length,
      data: result
    });
  } catch (error) {
    console.error("Error al obtener configuración de semanas:", error);
    res.status(500).json({
      success: false,
      message: "Error al obtener la lista de semanas",
      error: error.message
    });
  }
};

// 2. Guardar o editar una semana individual (número, parcial, si es examen y temas con check)
export const saveSingleWeek = async (req, res) => {
  try {
    const {
      carrera = "Medicina",
      numero_semana,
      nombre_semana,
      parcial = "I Parcial",
      es_examen = false,
      tema_ids = []
    } = req.body;

    const normCarrera = getNormalizedCareerKey(carrera);
    const targetSemana = parseInt(numero_semana, 10);
    const isExam = Boolean(es_examen);

    if (!targetSemana || isNaN(targetSemana)) {
      return res.status(400).json({
        success: false,
        message: "El número de semana es obligatorio y debe ser un número entero válido."
      });
    }

    const payload = {
      carrera: normCarrera,
      numero_semana: targetSemana,
      parcial: parcial || "I Parcial",
      temas: isExam ? "EXAMEN" : "",
      descripcion:
        nombre_semana ||
        (isExam
          ? `Examen ${String(parcial || "").includes("III") ? "III" : String(parcial || "").includes("II") ? "II" : "I"}`
          : `Semana ${targetSemana}`),
      updated_at: new Date().toISOString()
    };

    if (isSupabaseConfigured && supabase) {
      // 1. Guardar o actualizar semana en configuracion_semanas
      await supabase
        .from("configuracion_semanas")
        .upsert(payload, { onConflict: "carrera, numero_semana" });

      if (isExam) {
        // Si es semana de examen, desasignamos todos los temas de esta semana (semana = 0)
        await supabase
          .from("temario")
          .update({ semana: 0, updated_at: new Date().toISOString() })
          .ilike("carrera", `%${normCarrera}%`)
          .eq("semana", targetSemana);
      } else {
        // Si es semana regular:
        // Desasignar temas que estaban antes en esta semana y ya no están marcados
        const { data: currentTemasInWeek } = await supabase
          .from("temario")
          .select("id")
          .ilike("carrera", `%${normCarrera}%`)
          .eq("semana", targetSemana);

        if (currentTemasInWeek && currentTemasInWeek.length > 0) {
          const toUnassign = currentTemasInWeek
            .map((t) => t.id)
            .filter((id) => !tema_ids.includes(id));

          if (toUnassign.length > 0) {
            await supabase
              .from("temario")
              .update({ semana: 0, updated_at: new Date().toISOString() })
              .in("id", toUnassign);
          }
        }

        // Asignar los temas seleccionados a esta semana
        if (Array.isArray(tema_ids) && tema_ids.length > 0) {
          await supabase
            .from("temario")
            .update({ semana: targetSemana, updated_at: new Date().toISOString() })
            .in("id", tema_ids);
        }
      }

      if (!inMemorySemanasConfig[normCarrera]) inMemorySemanasConfig[normCarrera] = [];
      const exIdx = inMemorySemanasConfig[normCarrera].findIndex((w) => Number(w.numero_semana) === targetSemana);
      const weekObj = { ...payload, es_examen: isExam };
      if (exIdx >= 0) inMemorySemanasConfig[normCarrera][exIdx] = weekObj;
      else inMemorySemanasConfig[normCarrera].push(weekObj);
      savePersistentSemanas(inMemorySemanasConfig);

      return res.json({
        success: true,
        message: isExam
          ? `Semana ${targetSemana} configurada como Semana de Examen (${parcial}) para ${normCarrera}.`
          : `Semana ${targetSemana} (${parcial}) guardada con ${tema_ids.length} tema(s).`,
        carrera: normCarrera,
        data: weekObj
      });
    }

    if (!inMemorySemanasConfig[normCarrera]) inMemorySemanasConfig[normCarrera] = [];
    const exIdx = inMemorySemanasConfig[normCarrera].findIndex((w) => Number(w.numero_semana) === targetSemana);
    const weekObj = { ...payload, es_examen: isExam };
    if (exIdx >= 0) inMemorySemanasConfig[normCarrera][exIdx] = weekObj;
    else inMemorySemanasConfig[normCarrera].push(weekObj);
    savePersistentSemanas(inMemorySemanasConfig);

    return res.json({
      success: true,
      message: `Semana ${targetSemana} guardada en memoria.`,
      carrera: normCarrera,
      data: weekObj
    });
  } catch (error) {
    console.error("Error al guardar semana:", error);
    res.status(500).json({
      success: false,
      message: "Error al guardar la semana",
      error: error.message
    });
  }
};

// 3. Eliminar una semana y desasignar sus temas
export const deleteSingleWeek = async (req, res) => {
  try {
    const { numero_semana } = req.params;
    const { carrera = "Medicina" } = req.query;
    const normCarrera = getNormalizedCareerKey(carrera);
    const targetSemana = parseInt(numero_semana, 10);

    if (isSupabaseConfigured && supabase) {
      await supabase
        .from("configuracion_semanas")
        .delete()
        .ilike("carrera", `%${normCarrera}%`)
        .eq("numero_semana", targetSemana);

      await supabase
        .from("temario")
        .update({ semana: 0, updated_at: new Date().toISOString() })
        .ilike("carrera", `%${normCarrera}%`)
        .eq("semana", targetSemana);

      if (inMemorySemanasConfig[normCarrera]) {
        inMemorySemanasConfig[normCarrera] = inMemorySemanasConfig[normCarrera].filter(
          (w) => Number(w.numero_semana) !== targetSemana
        );
        savePersistentSemanas(inMemorySemanasConfig);
      }

      return res.json({
        success: true,
        message: `Semana ${targetSemana} eliminada correctamente.`
      });
    }

    if (inMemorySemanasConfig[normCarrera]) {
      inMemorySemanasConfig[normCarrera] = inMemorySemanasConfig[normCarrera].filter(
        (w) => Number(w.numero_semana) !== targetSemana
      );
      savePersistentSemanas(inMemorySemanasConfig);
    }

    return res.json({
      success: true,
      message: `Semana ${targetSemana} eliminada (memoria).`
    });
  } catch (error) {
    console.error("Error al eliminar semana:", error);
    res.status(500).json({
      success: false,
      message: "Error al eliminar la semana",
      error: error.message
    });
  }
};

// 4. Guardar o actualizar la lista de semanas completa
export const saveSemanasConfig = async (req, res) => {
  try {
    const { semanas, carrera = "Medicina" } = req.body;
    const normCarrera = getNormalizedCareerKey(carrera);

    if (!Array.isArray(semanas) || semanas.length === 0) {
      return res.status(400).json({
        success: false,
        message: "No se proporcionaron semanas para guardar."
      });
    }

    const payload = semanas.map((s) => ({
      carrera: normCarrera,
      numero_semana: parseInt(s.numero_semana, 10),
      parcial: s.parcial || getParcialForWeek(s.numero_semana),
      temas: s.es_examen ? "EXAMEN" : s.temas || "",
      fecha_inicio: s.fecha_inicio || null,
      fecha_fin: s.fecha_fin || null,
      es_semana_actual: Boolean(s.es_semana_actual),
      descripcion: s.descripcion || `Semana ${s.numero_semana}`,
      updated_at: new Date().toISOString()
    }));

    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase
        .from("configuracion_semanas")
        .upsert(payload, { onConflict: "carrera, numero_semana" })
        .select();

      if (!error) {
        inMemorySemanasConfig[normCarrera] = payload;
        savePersistentSemanas(inMemorySemanasConfig);
        return res.json({
          success: true,
          message: `Configuración de semanas guardada correctamente para ${normCarrera}.`,
          carrera: normCarrera,
          data: data || payload
        });
      }
    }

    inMemorySemanasConfig[normCarrera] = payload;
    savePersistentSemanas(inMemorySemanasConfig);

    res.json({
      success: true,
      message: `Configuración de semanas guardada exitosamente (memoria) para ${normCarrera}.`,
      carrera: normCarrera,
      data: payload
    });
  } catch (error) {
    console.error("Error al guardar configuración de semanas:", error);
    res.status(500).json({
      success: false,
      message: "Error al guardar la configuración de semanas",
      error: error.message
    });
  }
};

// 5. Marcar una semana como la semana actual
export const setSemanaActual = async (req, res) => {
  try {
    const { numero_semana } = req.params;
    const { carrera = "Medicina" } = req.body;
    const normCarrera = getNormalizedCareerKey(carrera);
    const targetSemana = parseInt(numero_semana, 10);

    if (isSupabaseConfigured && supabase) {
      await supabase
        .from("configuracion_semanas")
        .update({ es_semana_actual: false, updated_at: new Date().toISOString() })
        .ilike("carrera", `%${normCarrera}%`);

      const { data, error } = await supabase
        .from("configuracion_semanas")
        .update({ es_semana_actual: true, updated_at: new Date().toISOString() })
        .ilike("carrera", `%${normCarrera}%`)
        .eq("numero_semana", targetSemana)
        .select();

      if (!error) {
        return res.json({
          success: true,
          message: `Semana ${targetSemana} marcada como la semana activa para ${normCarrera}.`,
          carrera: normCarrera,
          data
        });
      }
    }

    if (inMemorySemanasConfig[normCarrera]) {
      inMemorySemanasConfig[normCarrera].forEach((w) => {
        w.es_semana_actual = w.numero_semana === targetSemana;
      });
    }

    res.json({
      success: true,
      message: `Semana ${targetSemana} establecida como semana actual (memoria) para ${normCarrera}.`,
      carrera: normCarrera
    });
  } catch (error) {
    console.error("Error al establecer semana actual:", error);
    res.status(500).json({
      success: false,
      message: "Error al cambiar la semana actual",
      error: error.message
    });
  }
};

// 6. Copiar configuración de semanas de una carrera a otra
export const copySemanasConfig = async (req, res) => {
  try {
    const { fromCarrera = "Medicina", toCarrera } = req.body;
    const sourceCar = getNormalizedCareerKey(fromCarrera);
    const destCar = getNormalizedCareerKey(toCarrera);

    if (!toCarrera) {
      return res.status(400).json({
        success: false,
        message: "La carrera destino es obligatoria."
      });
    }

    if (sourceCar === destCar) {
      return res.status(400).json({
        success: false,
        message: "La carrera de origen y destino no pueden ser iguales."
      });
    }

    let sourceWeeks = [];
    if (isSupabaseConfigured && supabase) {
      const { data } = await supabase
        .from("configuracion_semanas")
        .select("*")
        .ilike("carrera", `%${sourceCar}%`);
      sourceWeeks = data || [];
    }

    if (sourceWeeks.length === 0) {
      sourceWeeks = inMemorySemanasConfig[sourceCar] || [];
    }

    if (sourceWeeks.length === 0) {
      return res.status(404).json({
        success: false,
        message: `No se encontró configuración de semanas para ${sourceCar}.`
      });
    }

    const payload = sourceWeeks.map((sw) => ({
      carrera: destCar,
      numero_semana: sw.numero_semana,
      parcial: sw.parcial,
      temas: sw.temas || "",
      fecha_inicio: sw.fecha_inicio || null,
      fecha_fin: sw.fecha_fin || null,
      es_semana_actual: Boolean(sw.es_semana_actual),
      descripcion: sw.descripcion || `Semana ${sw.numero_semana}`,
      updated_at: new Date().toISOString()
    }));

    if (isSupabaseConfigured && supabase) {
      await supabase.from("configuracion_semanas").delete().ilike("carrera", `%${destCar}%`);
      await supabase.from("configuracion_semanas").insert(payload);
    }

    inMemorySemanasConfig[destCar] = payload;

    res.json({
      success: true,
      message: `Configuración de semanas copiada con éxito de ${sourceCar} a ${destCar} (${payload.length} semanas).`,
      carrera: destCar,
      data: payload
    });
  } catch (error) {
    console.error("Error al copiar semanas:", error);
    res.status(500).json({
      success: false,
      message: "Error al duplicar las semanas entre carreras",
      error: error.message
    });
  }
};

// 7. Reordenar lista de semanas secuencialmente (1..N) y sincronizar los temas asignados a cada una
export const reorderSemanas = async (req, res) => {
  try {
    const { carrera = "Medicina", ordered_weeks = [] } = req.body;
    const normCarrera = getNormalizedCareerKey(carrera);

    if (!Array.isArray(ordered_weeks) || ordered_weeks.length === 0) {
      return res.status(400).json({
        success: false,
        message: "La lista de semanas ordenadas es obligatoria."
      });
    }

    if (isSupabaseConfigured && supabase) {
      // Paso 1: Mapear temas hacia números temporales negativos para evitar colisiones
      for (let idx = 0; idx < ordered_weeks.length; idx++) {
        const w = ordered_weeks[idx];
        const oldSem = Number(w.original_numero_semana ?? w.numero_semana);
        const tempSem = -(idx + 1);

        if (Array.isArray(w.tema_ids) && w.tema_ids.length > 0) {
          await supabase
            .from("temario")
            .update({ semana: tempSem, updated_at: new Date().toISOString() })
            .in("id", w.tema_ids);
        } else if (oldSem > 0 && !w.es_examen) {
          await supabase
            .from("temario")
            .update({ semana: tempSem, updated_at: new Date().toISOString() })
            .ilike("carrera", `%${normCarrera}%`)
            .eq("semana", oldSem);
        }
      }

      // Paso 2: Convertir los números temporales al nuevo número de semana positivo (idx + 1)
      for (let idx = 0; idx < ordered_weeks.length; idx++) {
        const tempSem = -(idx + 1);
        const finalSem = idx + 1;
        await supabase
          .from("temario")
          .update({ semana: finalSem, updated_at: new Date().toISOString() })
          .ilike("carrera", `%${normCarrera}%`)
          .eq("semana", tempSem);
      }

      // Paso 3: Reemplazar semanas en configuracion_semanas
      await supabase
        .from("configuracion_semanas")
        .delete()
        .ilike("carrera", `%${normCarrera}%`);

      const newConfigRows = ordered_weeks.map((w, idx) => {
        const newSemNum = idx + 1;
        const isExam = Boolean(w.es_examen);
        let desc = (w.nombre_semana || w.descripcion || "").trim();
        if (!desc || /^Semana\s+\d+$/i.test(desc)) {
          desc = isExam ? `Semana ${newSemNum} - Examen ${w.parcial || ""}`.trim() : `Semana ${newSemNum}`;
        }

        return {
          carrera: normCarrera,
          numero_semana: newSemNum,
          parcial: w.parcial || getParcialForWeek(newSemNum, ordered_weeks.length),
          temas: isExam ? "EXAMEN" : "",
          descripcion: desc,
          fecha_inicio: w.fecha_inicio || null,
          fecha_fin: w.fecha_fin || null,
          es_semana_actual: Boolean(w.es_semana_actual),
          updated_at: new Date().toISOString()
        };
      });

      await supabase.from("configuracion_semanas").insert(newConfigRows);

      inMemorySemanasConfig[normCarrera] = newConfigRows;
      savePersistentSemanas(inMemorySemanasConfig);

      return res.json({
        success: true,
        message: `Semanas reordenadas exitosamente para ${normCarrera}.`,
        carrera: normCarrera,
        data: newConfigRows
      });
    }

    // Actualización en memoria si Supabase no está conectado
    const newConfigRows = ordered_weeks.map((w, idx) => {
      const newSemNum = idx + 1;
      const isExam = Boolean(w.es_examen);
      let desc = (w.nombre_semana || w.descripcion || "").trim();
      if (!desc || /^Semana\s+\d+$/i.test(desc)) {
        desc = isExam ? `Semana ${newSemNum} - Examen ${w.parcial || ""}`.trim() : `Semana ${newSemNum}`;
      }

      return {
        carrera: normCarrera,
        numero_semana: newSemNum,
        parcial: w.parcial || getParcialForWeek(newSemNum, ordered_weeks.length),
        temas: isExam ? "EXAMEN" : "",
        descripcion: desc,
        fecha_inicio: w.fecha_inicio || null,
        fecha_fin: w.fecha_fin || null,
        es_semana_actual: Boolean(w.es_semana_actual),
        updated_at: new Date().toISOString()
      };
    });

    inMemorySemanasConfig[normCarrera] = newConfigRows;
    savePersistentSemanas(inMemorySemanasConfig);

    res.json({
      success: true,
      message: `Semanas reordenadas exitosamente (memoria) para ${normCarrera}.`,
      carrera: normCarrera,
      data: newConfigRows
    });
  } catch (error) {
    console.error("Error al reordenar semanas:", error);
    res.status(500).json({
      success: false,
      message: "Error al reordenar la secuencia de semanas",
      error: error.message
    });
  }
};
