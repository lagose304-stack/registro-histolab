import { readFileSync, writeFileSync, renameSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { supabase, isSupabaseConfigured } from "../db/supabase.js";
import { getLocalSchedulingSections } from "./secciones.controller.js";
import { getLocalSchedulingWeeks } from "./semanas.controller.js";
import { getSectionAttendanceEvents } from "./academicAgenda.controller.js";
import { canViewSection, isInstructorTitular } from "../../../shared/sectionAccess.mjs";
import { hasAdministrationAccess } from "../../../shared/instructorRoles.mjs";
import { normalizeSectionCareer } from "../../../shared/sectionCode.mjs";
import { parseScheduleDate } from "../../../shared/academicSchedule.mjs";
import { getManualsWindow } from "../../../shared/manualsWindow.mjs";

const table = "fechas_carga_manuales";
const localFile = fileURLToPath(new URL("../../data/fechas_carga_manuales.json", import.meta.url));
const usingDatabase = isSupabaseConfigured && supabase;

function readDates() {
  try {
    return JSON.parse(readFileSync(localFile, "utf8"));
  } catch (error) {
    if (error.code === "ENOENT") return [];
    throw error;
  }
}

export async function getSectionManualDates(sectionId) {
  if (!usingDatabase) return readDates().filter(item => item.seccion_id === sectionId);
  const { data, error } = await supabase.from(table).select("*").eq("seccion_id", sectionId);
  if (error?.code === "PGRST205") return [];
  if (error) throw error;
  return data;
}

export async function getManualSchedule(sectionId) {
  let section, weeks;
  if (usingDatabase) {
    const result = await supabase.from("secciones").select("*").eq("id", sectionId).maybeSingle();
    if (result.error) throw result.error;
    section = result.data;
    if (section) {
      const result = await supabase.from("configuracion_semanas").select("*");
      if (result.error) throw result.error;
      weeks = result.data.filter(item => normalizeSectionCareer(item.carrera) === normalizeSectionCareer(section.carrera));
    }
  } else {
    section = getLocalSchedulingSections().find(item => item.id === sectionId);
    weeks = getLocalSchedulingWeeks(section?.carrera);
  }
  if (!section) return null;
  const [events, deadlines] = await Promise.all([
    getSectionAttendanceEvents(section), getSectionManualDates(sectionId)
  ]);
  return { section, weeks, events, deadlines };
}

export async function listManualDates(req, res) {
  try {
    const schedule = await getManualSchedule(req.params.seccion_id);
    if (!schedule || !canViewSection(req.instructor, schedule.section)) {
      return res.status(404).json({ message: "Sección no encontrada." });
    }
    return res.json({ data: schedule.deadlines, weeks: schedule.weeks, events: schedule.events });
  } catch (error) {
    console.error("Fechas de manuales:", error.message);
    return res.status(500).json({ message: "No pudimos consultar las fechas de manuales." });
  }
}

export async function saveManualDate(req, res) {
  try {
    const { seccion_id, semana } = req.params;
    const number = Number(semana);
    const date = req.body?.fecha_carga;
    if (!Number.isInteger(number) || number < 1 || !parseScheduleDate(date)) {
      return res.status(400).json({ message: "Selecciona una fecha válida para la carga de manuales." });
    }
    const schedule = await getManualSchedule(seccion_id);
    if (!schedule) return res.status(404).json({ message: "Sección no encontrada." });
    if (!hasAdministrationAccess(req.instructor?.rol) && !isInstructorTitular(req.instructor, schedule.section)) {
      return res.status(403).json({ message: "El titular de sección define esta fecha." });
    }
    const window = getManualsWindow(schedule.section, schedule.weeks, number, new Date(), schedule.events, schedule.deadlines);
    if (!window.isSpecial) return res.status(400).json({ message: "La fecha especial corresponde a la semana previa a un examen." });
    const row = { seccion_id, numero_semana: number, fecha_carga: date, updated_at: new Date().toISOString() };
    if (usingDatabase) {
      const { error } = await supabase.from(table).upsert(row, { onConflict: "seccion_id,numero_semana" });
      if (error) throw error;
    } else {
      const rows = readDates().filter(item => item.seccion_id !== seccion_id || item.numero_semana !== number);
      const temporaryFile = `${localFile}.tmp`;
      writeFileSync(temporaryFile, JSON.stringify([...rows, row], null, 2), "utf8");
      renameSync(temporaryFile, localFile);
    }
    return res.json({ data: row });
  } catch (error) {
    console.error("Guardar fecha de manuales:", error.message);
    return res.status(500).json({ message: "No pudimos guardar la fecha de carga de manuales." });
  }
}
