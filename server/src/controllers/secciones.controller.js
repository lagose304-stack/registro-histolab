import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { supabase, isSupabaseConfigured } from "../db/supabase.js";
import crypto from "crypto";
import { deletePruebasBySeccion } from "./pruebas.controller.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.join(__dirname, "../../data");
const SECCIONES_FILE = path.join(DATA_DIR, "secciones_data.json");

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function loadPersistentSecciones() {
  try {
    ensureDataDir();
    if (fs.existsSync(SECCIONES_FILE)) {
      const raw = fs.readFileSync(SECCIONES_FILE, "utf-8");
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (err) {
    console.warn("Aviso al leer secciones locales:", err.message);
  }
  return [
    {
      id: "sec-mi1300-demo",
      codigo: "MI1300",
      nombre: "Laboratorio de Histología - Sección MI1300",
      carrera: "MEDICINA",
      dia: "Miércoles",
      hora_inicio: "13:00",
      hora_fin: "15:00",
      doctor_encargado: "Dr. Rafael Perdomo Vaquero",
      coordinador: "Coordinador General",
      periodo_academico: "I PAC 2026",
      activa: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }
  ];
}

function savePersistentSecciones(data) {
  try {
    ensureDataDir();
    fs.writeFileSync(SECCIONES_FILE, JSON.stringify(data, null, 2), "utf-8");
  } catch (err) {
    console.warn("Aviso al guardar secciones locales:", err.message);
  }
}

// Memoria local de respaldo respaldada en disco local
let inMemorySecciones = loadPersistentSecciones();

// Conversor de hora HH:MM a minutos transcurridos desde medianoche
export const timeToMinutes = (timeStr) => {
  if (!timeStr) return 0;
  const [h, m] = timeStr.split(":").map((v) => parseInt(v, 10) || 0);
  return h * 60 + (m || 0);
};

// Detector de traslape entre 2 intervalos de tiempo [startA, endA) y [startB, endB)
export const isTimeOverlap = (startA, endA, startB, endB) => {
  const minStartA = timeToMinutes(startA);
  let minEndA = timeToMinutes(endA);
  if (minEndA <= minStartA) minEndA = minStartA + 120; // 2 horas por defecto

  const minStartB = timeToMinutes(startB);
  let minEndB = timeToMinutes(endB);
  if (minEndB <= minStartB) minEndB = minStartB + 120;

  return minStartA < minEndB && minEndA > minStartB;
};

// Generador de código automático de sección (ej. MI1300, LU0800, JUE1500, SAB0900)
export const generateSectionCode = (dia = "Lunes", horaInicio = "13:00") => {
  const diaMap = {
    lunes: "LU",
    martes: "MA",
    miercoles: "MI",
    miércoles: "MI",
    jueves: "JUE",
    viernes: "VIE",
    sabado: "SAB",
    sábado: "SAB",
    domingo: "DO"
  };

  const normalizedDay = (dia || "Lunes").toLowerCase().trim();
  const dayPrefix = diaMap[normalizedDay] || "SEC";

  let hourStr = "13";
  let minStr = "00";

  if (horaInicio && horaInicio.includes(":")) {
    const parts = horaInicio.split(":");
    hourStr = (parts[0] || "00").trim().padStart(2, "0");
    minStr = (parts[1] || "00").trim().slice(0, 2).padStart(2, "0");
  } else if (horaInicio) {
    const digits = horaInicio.replace(/\D/g, "");
    if (digits.length >= 4) {
      hourStr = digits.slice(0, 2);
      minStr = digits.slice(2, 4);
    } else if (digits.length >= 1) {
      hourStr = digits.slice(0, 2).padStart(2, "0");
      minStr = "00";
    }
  }

  return `${dayPrefix}${hourStr}${minStr}`;
};

// 1. Listar todas las secciones
export const getSecciones = async (req, res) => {
  try {
    const { search, dia, activa } = req.query;

    if (isSupabaseConfigured && supabase) {
      let query = supabase
        .from("secciones")
        .select("*")
        .order("created_at", { ascending: false });

      if (dia) query = query.eq("dia", dia);
      if (activa !== undefined) query = query.eq("activa", activa === "true");

      const { data, error } = await query;

      if (!error && data) {
        let filtered = data;
        if (search) {
          const s = search.toLowerCase();
          filtered = filtered.filter(
            (sec) =>
              (sec.codigo || "").toLowerCase().includes(s) ||
              (sec.nombre || "").toLowerCase().includes(s) ||
              (sec.dia || "").toLowerCase().includes(s) ||
              (sec.doctor_encargado || "").toLowerCase().includes(s) ||
              (sec.coordinador || "").toLowerCase().includes(s) ||
              (sec.instructor_asignado || "").toLowerCase().includes(s)
          );
        }
        return res.json({ success: true, data: filtered });
      } else if (error) {
        console.warn("Aviso en consulta de secciones Supabase (usando memoria si la tabla no existe aún):", error.message);
      }
    }

    // Fallback en memoria
    let filtered = [...inMemorySecciones];
    if (dia) filtered = filtered.filter((s) => s.dia === dia);
    if (activa !== undefined) filtered = filtered.filter((s) => String(s.activa) === String(activa));
    if (search) {
      const s = search.toLowerCase();
      filtered = filtered.filter(
        (sec) =>
          (sec.codigo || "").toLowerCase().includes(s) ||
          (sec.nombre || "").toLowerCase().includes(s) ||
          (sec.dia || "").toLowerCase().includes(s) ||
          (sec.doctor_encargado || "").toLowerCase().includes(s) ||
          (sec.coordinador || "").toLowerCase().includes(s) ||
          (sec.instructor_asignado || "").toLowerCase().includes(s)
      );
    }

    res.json({ success: true, data: filtered });
  } catch (error) {
    console.error("Error al obtener secciones:", error);
    res.status(500).json({
      success: false,
      message: "Error al listar las secciones",
      error: error.message
    });
  }
};

// 2. Obtener una sección por ID
export const getSeccionById = async (req, res) => {
  try {
    const { id } = req.params;

    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase
        .from("secciones")
        .select("*")
        .eq("id", id)
        .maybeSingle();

      if (!error && data) {
        return res.json({ success: true, seccion: data });
      }
    }

    const found = inMemorySecciones.find((s) => s.id === id || s.codigo === id);
    if (!found) {
      return res.status(404).json({
        success: false,
        message: "Sección no encontrada."
      });
    }

    res.json({ success: true, seccion: found });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error al obtener la sección",
      error: error.message
    });
  }
};

// 3. Crear una nueva sección
export const createSeccion = async (req, res) => {
  try {
    const {
      codigo,
      nombre,
      carrera,
      dia,
      hora_inicio,
      hora_fin,
      doctor_encargado,
      coordinador,
      instructores_asignados,
      periodo_academico,
      activa
    } = req.body;

    if (!carrera || !carrera.trim()) {
      return res.status(400).json({
        success: false,
        message: "Por favor selecciona la Carrera para la sección."
      });
    }

    if (!dia || !hora_inicio) {
      return res.status(400).json({
        success: false,
        message: "El día y la hora de inicio son requeridos para registrar una sección."
      });
    }

    const cleanCarrera = carrera.trim();
    const cleanDia = dia.trim();
    const cleanHoraInicio = hora_inicio.trim();
    const cleanHoraFin = (hora_fin || "").trim();
    const cleanPeriodo = (periodo_academico || "I PAC 2026").trim();

    // 🛡️ REGLA 1: Horario permitido del laboratorio únicamente de 07:00 a 17:00
    if (timeToMinutes(cleanHoraInicio) < timeToMinutes("07:00") || timeToMinutes(cleanHoraInicio) > timeToMinutes("17:00")) {
      return res.status(400).json({
        success: false,
        message: "El horario del laboratorio está limitado estrictamente de 07:00 a 17:00 (5:00 PM)."
      });
    }

    // 🛡️ REGLA 2: Máximo 4 secciones por día para la carrera de MEDICINA
    if (cleanCarrera.toUpperCase() === "MEDICINA") {
      let medDayCount = 0;
      if (isSupabaseConfigured && supabase) {
        let query = supabase
          .from("secciones")
          .select("id", { count: "exact" })
          .eq("dia", cleanDia)
          .ilike("carrera", "MEDICINA");
        if (cleanPeriodo) query = query.eq("periodo_academico", cleanPeriodo);
        const { count } = await query;
        medDayCount = count || 0;
      } else {
        medDayCount = inMemorySecciones.filter(
          (s) =>
            s.dia.toLowerCase() === cleanDia.toLowerCase() &&
            (s.carrera || "").toUpperCase() === "MEDICINA" &&
            (!cleanPeriodo || !s.periodo_academico || s.periodo_academico === cleanPeriodo)
        ).length;
      }

      if (medDayCount >= 4) {
        return res.status(400).json({
          success: false,
          message: `Límite diario alcanzado: En la carrera de MEDICINA solo se permite un máximo de 4 secciones por día (${cleanDia}).`
        });
      }
    }

    // 🛡️ REGLA 3: No permitir traslapes de horario en la misma carrera el mismo día
    if (isSupabaseConfigured && supabase) {
      let conflictQuery = supabase
        .from("secciones")
        .select("id, codigo, dia, hora_inicio, hora_fin, carrera, periodo_academico")
        .eq("dia", cleanDia)
        .eq("carrera", cleanCarrera);

      if (cleanPeriodo) {
        conflictQuery = conflictQuery.eq("periodo_academico", cleanPeriodo);
      }

      const { data: daySections } = await conflictQuery;
      if (daySections && daySections.length > 0) {
        const overlap = daySections.find((sec) =>
          isTimeOverlap(cleanHoraInicio, cleanHoraFin, sec.hora_inicio, sec.hora_fin)
        );

        if (overlap) {
          const finDisplay = overlap.hora_fin ? ` a ${overlap.hora_fin}` : "";
          return res.status(400).json({
            success: false,
            message: `Traslape de horario detectado: La sección choca con la Sección ${overlap.codigo} (${overlap.dia} de ${overlap.hora_inicio}${finDisplay}) para la carrera de ${cleanCarrera}. No se permiten traslapes de horario en la misma carrera.`
          });
        }
      }
    }

    const inMemoryOverlap = inMemorySecciones.find(
      (s) =>
        s.dia.toLowerCase() === cleanDia.toLowerCase() &&
        (s.carrera || "").toLowerCase() === cleanCarrera.toLowerCase() &&
        (!cleanPeriodo || !s.periodo_academico || s.periodo_academico === cleanPeriodo) &&
        isTimeOverlap(cleanHoraInicio, cleanHoraFin, s.hora_inicio, s.hora_fin)
    );

    if (inMemoryOverlap) {
      const finDisplay = inMemoryOverlap.hora_fin ? ` a ${inMemoryOverlap.hora_fin}` : "";
      return res.status(400).json({
        success: false,
        message: `Traslape de horario detectado: La sección choca con la Sección ${inMemoryOverlap.codigo} (${inMemoryOverlap.dia} de ${inMemoryOverlap.hora_inicio}${finDisplay}) para la carrera de ${cleanCarrera}. No se permiten traslapes de horario en la misma carrera.`
      });
    }

    // Generar código automático combinando día abreviado + hora 24h (ej. MI1300, LU0800, JUE1500)
    const autoCodigo = (codigo && codigo.trim()) || generateSectionCode(cleanDia, cleanHoraInicio);

    const newSectionData = {
      id: crypto.randomUUID(),
      codigo: autoCodigo.trim(),
      nombre: (nombre || `Sección ${autoCodigo} - Laboratorio`).trim(),
      carrera: cleanCarrera,
      dia: cleanDia,
      hora_inicio: cleanHoraInicio,
      hora_fin: cleanHoraFin,
      doctor_encargado: (doctor_encargado || "Dr. Rafael Perdomo Vaquero").trim(),
      coordinador: (coordinador || "").trim(),
      instructores_asignados: Array.isArray(instructores_asignados) ? instructores_asignados : [],
      periodo_academico: cleanPeriodo,
      activa: activa !== undefined ? Boolean(activa) : true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase
        .from("secciones")
        .insert(newSectionData)
        .select()
        .single();

      if (!error && data) {
        inMemorySecciones = inMemorySecciones.filter((s) => s.id !== data.id);
        inMemorySecciones.unshift(data);
        savePersistentSecciones(inMemorySecciones);

        return res.status(201).json({
          success: true,
          message: "Sección creada exitosamente en la base de datos.",
          seccion: data
        });
      } else if (error) {
        console.warn("Aviso al insertar sección en Supabase (guardando en respaldo):", error.message);
      }
    }

    // Guardar en memoria de respaldo
    inMemorySecciones.unshift(newSectionData);
    savePersistentSecciones(inMemorySecciones);

    res.status(201).json({
      success: true,
      message: "Sección creada exitosamente.",
      seccion: newSectionData
    });
  } catch (error) {
    console.error("Error al crear sección:", error);
    res.status(500).json({
      success: false,
      message: "Error al registrar la sección",
      error: error.message
    });
  }
};

// 4. Actualizar datos de una sección
export const updateSeccion = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      codigo,
      nombre,
      carrera,
      dia,
      hora_inicio,
      hora_fin,
      doctor_encargado,
      coordinador,
      instructores_asignados,
      periodo_academico,
      activa
    } = req.body;

    // Obtener sección actual para evaluar choque con campos mezclados
    let currentSec = null;
    if (isSupabaseConfigured && supabase) {
      const { data } = await supabase.from("secciones").select("*").eq("id", id).maybeSingle();
      currentSec = data;
    }
    if (!currentSec) {
      currentSec = inMemorySecciones.find((s) => s.id === id);
    }

    const targetDia = dia !== undefined ? dia.trim() : (currentSec?.dia || "");
    const targetHora = hora_inicio !== undefined ? hora_inicio.trim() : (currentSec?.hora_inicio || "");
    const targetHoraFin = hora_fin !== undefined ? (hora_fin || "").trim() : (currentSec?.hora_fin || "");
    const targetCarrera = carrera !== undefined ? carrera.trim() : (currentSec?.carrera || "");
    const targetPeriodo = periodo_academico !== undefined ? periodo_academico.trim() : (currentSec?.periodo_academico || "");

    // 🛡️ REGLA 1: Horario permitido del laboratorio de 07:00 a 17:00
    if (targetHora && (timeToMinutes(targetHora) < timeToMinutes("07:00") || timeToMinutes(targetHora) > timeToMinutes("17:00"))) {
      return res.status(400).json({
        success: false,
        message: "El horario del laboratorio está limitado estrictamente de 07:00 a 17:00 (5:00 PM)."
      });
    }

    // 🛡️ REGLA 2: Máximo 4 secciones por día en MEDICINA
    if (targetCarrera.toUpperCase() === "MEDICINA" && targetDia) {
      let medDayCount = 0;
      if (isSupabaseConfigured && supabase) {
        let query = supabase
          .from("secciones")
          .select("id", { count: "exact" })
          .neq("id", id)
          .eq("dia", targetDia)
          .ilike("carrera", "MEDICINA");
        if (targetPeriodo) query = query.eq("periodo_academico", targetPeriodo);
        const { count } = await query;
        medDayCount = count || 0;
      } else {
        medDayCount = inMemorySecciones.filter(
          (s) =>
            s.id !== id &&
            s.dia.toLowerCase() === targetDia.toLowerCase() &&
            (s.carrera || "").toUpperCase() === "MEDICINA" &&
            (!targetPeriodo || !s.periodo_academico || s.periodo_academico === targetPeriodo)
        ).length;
      }

      if (medDayCount >= 4) {
        return res.status(400).json({
          success: false,
          message: `Límite diario alcanzado: En la carrera de MEDICINA solo se permite un máximo de 4 secciones por día (${targetDia}).`
        });
      }
    }

    // 🛡️ REGLA 3: No permitir traslapes de horario en la misma carrera al editar
    if (targetDia && targetHora && targetCarrera) {
      if (isSupabaseConfigured && supabase) {
        let conflictQuery = supabase
          .from("secciones")
          .select("id, codigo, dia, hora_inicio, hora_fin, carrera, periodo_academico")
          .neq("id", id)
          .eq("dia", targetDia)
          .eq("carrera", targetCarrera);

        if (targetPeriodo) {
          conflictQuery = conflictQuery.eq("periodo_academico", targetPeriodo);
        }

        const { data: daySections } = await conflictQuery;
        if (daySections && daySections.length > 0) {
          const overlap = daySections.find((sec) =>
            isTimeOverlap(targetHora, targetHoraFin, sec.hora_inicio, sec.hora_fin)
          );

          if (overlap) {
            const finDisplay = overlap.hora_fin ? ` a ${overlap.hora_fin}` : "";
            return res.status(400).json({
              success: false,
              message: `Traslape de horario detectado: La sección choca con la Sección ${overlap.codigo} (${overlap.dia} de ${overlap.hora_inicio}${finDisplay}) para la carrera de ${targetCarrera}. No se permiten traslapes de horario en la misma carrera.`
            });
          }
        }
      }

      const inMemoryOverlap = inMemorySecciones.find(
        (s) =>
          s.id !== id &&
          s.dia.toLowerCase() === targetDia.toLowerCase() &&
          (s.carrera || "").toLowerCase() === targetCarrera.toLowerCase() &&
          (!targetPeriodo || !s.periodo_academico || s.periodo_academico === targetPeriodo) &&
          isTimeOverlap(targetHora, targetHoraFin, s.hora_inicio, s.hora_fin)
      );

      if (inMemoryOverlap) {
        const finDisplay = inMemoryOverlap.hora_fin ? ` a ${inMemoryOverlap.hora_fin}` : "";
        return res.status(400).json({
          success: false,
          message: `Traslape de horario detectado: La sección choca con la Sección ${inMemoryOverlap.codigo} (${inMemoryOverlap.dia} de ${inMemoryOverlap.hora_inicio}${finDisplay}) para la carrera de ${targetCarrera}. No se permiten traslapes de horario en la misma carrera.`
        });
      }
    }

    const updates = {
      updated_at: new Date().toISOString()
    };

    if (codigo !== undefined) updates.codigo = codigo.trim();
    if (nombre !== undefined) updates.nombre = nombre.trim();
    if (carrera !== undefined) updates.carrera = carrera.trim();
    if (dia !== undefined) updates.dia = dia.trim();
    if (hora_inicio !== undefined) updates.hora_inicio = hora_inicio.trim();
    if (hora_fin !== undefined) updates.hora_fin = (hora_fin || "").trim();
    if (doctor_encargado !== undefined) updates.doctor_encargado = doctor_encargado.trim();
    if (coordinador !== undefined) updates.coordinador = coordinador.trim();
    if (instructores_asignados !== undefined) updates.instructores_asignados = Array.isArray(instructores_asignados) ? instructores_asignados : [];
    if (periodo_academico !== undefined) updates.periodo_academico = periodo_academico.trim();
    if (activa !== undefined) updates.activa = Boolean(activa);

    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase
        .from("secciones")
        .update(updates)
        .eq("id", id)
        .select()
        .single();

      if (!error && data) {
        const uIdx = inMemorySecciones.findIndex((s) => s.id === id);
        if (uIdx !== -1) inMemorySecciones[uIdx] = { ...inMemorySecciones[uIdx], ...data };
        else inMemorySecciones.push(data);
        savePersistentSecciones(inMemorySecciones);

        return res.json({
          success: true,
          message: "Sección actualizada exitosamente.",
          seccion: data
        });
      }
    }

    const index = inMemorySecciones.findIndex((s) => s.id === id);
    if (index !== -1) {
      inMemorySecciones[index] = { ...inMemorySecciones[index], ...updates };
      savePersistentSecciones(inMemorySecciones);
      return res.json({
        success: true,
        message: "Sección actualizada exitosamente.",
        seccion: inMemorySecciones[index]
      });
    }

    res.status(404).json({
      success: false,
      message: "Sección no encontrada para actualizar."
    });
  } catch (error) {
    console.error("Error al actualizar sección:", error);
    res.status(500).json({
      success: false,
      message: "Error al actualizar la sección",
      error: error.message
    });
  }
};

// 5. Eliminar una sección
export const deleteSeccion = async (req, res) => {
  try {
    const { id } = req.params;

    // 1. Eliminar en cascada todas las pruebas semanales y entregas vinculadas a esta sección
    try {
      await deletePruebasBySeccion(id);
    } catch (pruebasErr) {
      console.warn("Aviso al eliminar pruebas vinculadas a la sección:", pruebasErr.message);
    }

    if (isSupabaseConfigured && supabase) {
      const { error } = await supabase
        .from("secciones")
        .delete()
        .eq("id", id);

      if (!error) {
        inMemorySecciones = inMemorySecciones.filter((s) => s.id !== id);
        savePersistentSecciones(inMemorySecciones);
        return res.json({
          success: true,
          message: "Sección eliminada exitosamente."
        });
      }
    }

    const prevLength = inMemorySecciones.length;
    inMemorySecciones = inMemorySecciones.filter((s) => s.id !== id);
    savePersistentSecciones(inMemorySecciones);

    if (inMemorySecciones.length < prevLength) {
      return res.json({
        success: true,
        message: "Sección eliminada exitosamente."
      });
    }

    res.status(404).json({
      success: false,
      message: "Sección no encontrada para eliminar."
    });
  } catch (error) {
    console.error("Error al eliminar sección:", error);
    res.status(500).json({
      success: false,
      message: "Error al eliminar la sección",
      error: error.message
    });
  }
};
