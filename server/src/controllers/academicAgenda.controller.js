import { randomUUID } from "node:crypto";
import { readFileSync, renameSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { supabase, isSupabaseConfigured } from "../db/supabase.js";
import { getLocalSchedulingSections } from "./secciones.controller.js";
import { getLocalSchedulingWeeks } from "./semanas.controller.js";
import { normalizeSectionCareer } from "../../../shared/sectionCode.mjs";
import { canViewSection } from "../../../shared/sectionAccess.mjs";
import {
  LAB_START, LAB_END, addScheduleDays, findFreeScheduleSlots, parseScheduleDate, scheduleOverlaps,
  scheduleTimeLabel, scheduleTimeMinutes, scheduleWeekday, sectionTimeRange
} from "../../../shared/academicSchedule.mjs";

const CAREERS = {
  MEDICINA: "Medicina", ENFERMERIA: "Enfermería", ODONTOLOGIA: "Odontología",
  MICROBIOLOGIA: "Microbiología", NUTRICION: "Nutrición"
};
const TABLE = "agenda_academica";
const usingDatabase = isSupabaseConfigured && supabase;
const sectionFields = "id,codigo,carrera,dia,hora_inicio,hora_fin,activa,periodo_academico,coordinador";

class AgendaError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function localAgendaFile() {
  return fileURLToPath(new URL("../../data/agenda_academica.json", import.meta.url));
}

function readLocalEvents() {
  try {
    return JSON.parse(readFileSync(localAgendaFile(), "utf8"));
  } catch (error) {
    if (error.code === "ENOENT") return [];
    throw error;
  }
}

function saveLocalEvents(events) {
  const file = localAgendaFile();
  const temp = `${file}.tmp`;
  writeFileSync(temp, JSON.stringify(events, null, 2), "utf8");
  renameSync(temp, file);
}

function requireCareer(value) {
  const career = normalizeSectionCareer(typeof value === "string" ? value : "");
  if (!Object.hasOwn(CAREERS, career)) throw new AgendaError(400, "Selecciona una carrera válida.");
  return career;
}

function forCareer(query, career) {
  const label = CAREERS[career];
  return label.toUpperCase() === career ? query.ilike("carrera", career)
    : query.or(`carrera.ilike.${career},carrera.ilike.${label}`);
}

async function getSections(career) {
  let sections = getLocalSchedulingSections();
  if (usingDatabase) {
    const { data, error } = await forCareer(supabase.from("secciones").select(sectionFields), career);
    if (error) throw error;
    sections = data;
  }
  return sections.filter(section => normalizeSectionCareer(section.carrera) === career && section.activa !== false);
}

async function getDatedWeeks(career) {
  let weeks = getLocalSchedulingWeeks(career);
  if (usingDatabase) {
    const { data, error } = await forCareer(supabase.from("configuracion_semanas").select("carrera,fecha_inicio,fecha_fin,temas,descripcion"), career);
    if (error) throw error;
    weeks = data.filter(week => normalizeSectionCareer(week.carrera) === career);
  }
  return weeks.filter(week => week.fecha_inicio && week.fecha_fin);
}

async function getEvents(career, from, to) {
  if (usingDatabase) {
    const { data, error } = await supabase.from(TABLE).select("*")
      .eq("carrera", career).gte("fecha", from).lte("fecha", to).order("fecha").order("hora_inicio");
    if (error) throw error;
    return data;
  }
  return readLocalEvents().filter(event => event.carrera === career && event.fecha >= from && event.fecha <= to)
    .sort((left, right) => left.fecha.localeCompare(right.fecha) || left.hora_inicio.localeCompare(right.hora_inicio));
}

async function getExams(career) {
  if (usingDatabase) {
    const { data, error } = await supabase.from(TABLE).select("*")
      .eq("carrera", career).eq("tipo", "examen").order("fecha").order("hora_inicio");
    if (error) throw error;
    return data;
  }
  return readLocalEvents().filter(event => event.carrera === career && event.tipo === "examen");
}

async function getEventsForDay(career, date) {
  if (usingDatabase) {
    const { data, error } = await supabase.from(TABLE).select("*")
      .eq("carrera", career).or(`fecha.eq.${date},fecha_original.eq.${date}`);
    if (error) throw error;
    return data;
  }
  return readLocalEvents().filter(event =>
    event.carrera === career && (event.fecha === date || event.fecha_original === date)
  );
}

export async function getSectionAttendanceEvents(section) {
  const career = normalizeSectionCareer(section.carrera);
  if (usingDatabase) {
    const { data, error } = await supabase.from(TABLE)
      .select("id,tipo,carrera,seccion_id,fecha,fecha_original,hora_inicio,hora_fin")
      .eq("carrera", career).or(`seccion_id.eq.${section.id},seccion_id.is.null`);
    if (error) throw error;
    return data;
  }
  return readLocalEvents().filter(event => event.carrera === career &&
    (event.seccion_id === section.id || !event.seccion_id));
}

export async function listSectionAttendanceEvents(req, res) {
  try {
    const sectionId = req.params.sectionId;
    let section;
    if (usingDatabase) {
      const { data, error } = await supabase.from("secciones").select("*").eq("id", sectionId).maybeSingle();
      if (error) throw error;
      section = data;
    } else {
      section = getLocalSchedulingSections().find(item => item.id === sectionId);
    }
    if (!section || !canViewSection(req.instructor, section)) throw new AgendaError(404, "Sección no encontrada.");
    return res.json({ data: await getSectionAttendanceEvents(section) });
  } catch (error) {
    return errorResponse(res, error);
  }
}

function getDayAvailability(sections, weeks, events, date, excludeId) {
  const week = weeks.find(item => item.fecha_inicio <= date && item.fecha_fin >= date);
  const day = scheduleWeekday(date);
  const examWeek = week && (week.es_examen || String(week.temas || "").toUpperCase() === "EXAMEN" ||
    String(week.descripcion || "").toLowerCase().includes("examen"));
  const movedSections = new Set(events.filter(event =>
    event.tipo === "reposicion" && event.fecha_original === date && event.id !== excludeId
  ).map(event => event.seccion_id));
  const regular = (!weeks.length || (week && !examWeek))
    ? sections.filter(section => normalizeSectionCareer(section.dia) === day && !movedSections.has(section.id))
      .map(sectionTimeRange).filter(Boolean)
    : [];
  const booked = events.filter(event => event.fecha === date && event.id !== excludeId).map(sectionTimeRange);
  return { sections, week, busy: [...regular, ...booked] };
}

function errorResponse(res, error) {
  if (error instanceof AgendaError) return res.status(error.status).json({ message: error.message });
  if (error.code === "23P01") return res.status(409).json({ message: "El horario ya está ocupado para esta carrera. Elige otro." });
  if (error.code === "23505") return res.status(409).json({ message: "Ya existe una reposición para esta sección y fecha original." });
  console.error("Agenda académica:", error.message);
  return res.status(500).json({ message: "No pudimos acceder a la agenda académica." });
}

export async function listAgenda(req, res) {
  try {
    const career = requireCareer(req.query.carrera);
    const { desde, hasta, tipo } = req.query;
    if (tipo !== "examen" && (!parseScheduleDate(desde) || !parseScheduleDate(hasta) || hasta < desde || hasta > addScheduleDays(desde, 62))) {
      throw new AgendaError(400, "Elige un rango de hasta 63 días.");
    }
    const [data, sections] = await Promise.all([tipo === "examen" ? getExams(career) : getEvents(career, desde, hasta), getSections(career)]);
    res.json({ data, sections });
  } catch (error) {
    errorResponse(res, error);
  }
}

export async function listAvailability(req, res) {
  try {
    const career = requireCareer(req.query.carrera);
    const { fecha, seccion_id, excluir } = req.query;
    if (!parseScheduleDate(fecha)) throw new AgendaError(400, "Elige una fecha válida.");
    const [sections, weeks, events] = await Promise.all([getSections(career), getDatedWeeks(career), getEventsForDay(career, fecha)]);
    const section = sections.find(item => item.id === seccion_id);
    const range = section && sectionTimeRange(section);
    if (!range) throw new AgendaError(400, "La sección debe tener un horario habitual.");
    const { week, busy } = getDayAvailability(sections, weeks, events, fecha, excluir);
    if (!week) return res.json({ data: [], message: "Esta fecha queda fuera de las semanas académicas con fechas guardadas." });
    res.json({ data: findFreeScheduleSlots(range[1] - range[0], busy) });
  } catch (error) {
    errorResponse(res, error);
  }
}

async function validateEvent(body, id, context) {
  const career = requireCareer(body.carrera);
  const { tipo, fecha, fecha_original, seccion_id } = body;
  const title = typeof body.titulo === "string" ? body.titulo.trim() : "";
  const start = scheduleTimeMinutes(body.hora_inicio);
  const end = scheduleTimeMinutes(body.hora_fin);
  if (!["reposicion", "examen"].includes(tipo) || !parseScheduleDate(fecha) || !title || title.length > 160 ||
    start === null || end === null || end <= start) {
    throw new AgendaError(400, "Completa el motivo o título, la fecha y un horario válido.");
  }

  const [sections, weeks, events] = context || await Promise.all([getSections(career), getDatedWeeks(career), getEventsForDay(career, fecha)]);
  const { week, busy } = getDayAvailability(sections, weeks, events, fecha, id);
  const section = sections.find(item => item.id === seccion_id);
  if ((seccion_id && !section) || (tipo === "reposicion" && !section)) {
    throw new AgendaError(400, "Selecciona una sección activa de esta carrera.");
  }

  if (tipo === "reposicion") {
    const usual = sectionTimeRange(section);
    if (!parseScheduleDate(fecha_original) || fecha_original === fecha ||
      scheduleWeekday(fecha_original) !== normalizeSectionCareer(section.dia)) {
      throw new AgendaError(400, "La fecha original debe coincidir con el día habitual de la sección y ser distinta de la reposición.");
    }
    if (!week) throw new AgendaError(400, "La reposición debe caer dentro de una semana académica con fechas guardadas.");
    if (!usual || start < LAB_START || end > LAB_END || end - start !== usual[1] - usual[0]) {
      throw new AgendaError(400, "La reposición debe durar lo mismo que la práctica y quedar entre 07:00 y 17:00.");
    }
  }

  if (busy.some(range => scheduleOverlaps([start, end], range))) {
    throw new AgendaError(409, "Este horario se cruza con una actividad de la misma carrera. Elige otro.");
  }
  return {
    carrera: career, tipo, titulo: title, fecha,
    seccion_id: section?.id || null, fecha_original: tipo === "reposicion" ? fecha_original : null,
    hora_inicio: scheduleTimeLabel(start), hora_fin: scheduleTimeLabel(end)
  };
}

async function getAgendaEvent(id) {
  if (usingDatabase) {
    const { data, error } = await supabase.from(TABLE).select("*").eq("id", id).maybeSingle();
    if (error) throw error;
    return data;
  }
  return readLocalEvents().find(event => event.id === id);
}

async function checkRestoredPractice(previous, next) {
  if (previous?.tipo !== "reposicion") return;
  if (next?.seccion_id === previous.seccion_id && next?.fecha_original === previous.fecha_original) return;
  const { carrera, fecha_original, seccion_id } = previous;
  const [sections, weeks, events] = await Promise.all([
    getSections(carrera), getDatedWeeks(carrera), getEventsForDay(carrera, fecha_original)
  ]);
  const original = sections.filter(section => section.id === seccion_id);
  const { busy: restored } = getDayAvailability(original, weeks, [], fecha_original);
  const conflict = events.some(event => event.id !== previous.id && event.fecha === fecha_original &&
    restored.some(range => scheduleOverlaps(range, sectionTimeRange(event))));
  if (conflict) {
    throw new AgendaError(409, "El horario original ya tiene otra actividad. Muévela antes de devolver la práctica a ese horario.");
  }
}

export async function saveExamBatch(req, res) {
  try {
    const career = requireCareer(req.body?.carrera);
    const { changes } = req.body;
    if (!Array.isArray(changes) || !changes.length || changes.some(change =>
      !change || (change.id != null && !/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(change.id)) ||
      (!change.exam && !change.id))) {
      throw new AgendaError(400, "Envía cambios de exámenes válidos.");
    }

    const ids = new Set(changes.flatMap(change => change.id ? [change.id.toLowerCase()] : []));
    if (ids.size !== changes.filter(change => change.id).length) {
      throw new AgendaError(400, "Cada examen debe aparecer una sola vez en los cambios.");
    }

    const [sections, weeks] = await Promise.all([getSections(career), getDatedWeeks(career)]);
    const dates = [...new Set(changes.map(change => change.exam?.fecha).filter(parseScheduleDate))];
    const byDate = new Map(await Promise.all(dates.map(async date => [
      date, (await getEventsForDay(career, date)).filter(event => !ids.has(event.id) || event.tipo !== "examen")
    ])));
    const exams = [];
    for (const change of changes) {
      if (!change.exam) continue;
      const events = byDate.get(change.exam.fecha) || [];
      const exam = await validateEvent({ ...change.exam, carrera: career, tipo: "examen" }, undefined, [sections, weeks, events]);
      const row = { ...exam, id: change.id?.toLowerCase() || randomUUID() };
      exams.push(row);
      events.push(row);
    }

    if (usingDatabase) {
      const { data, error } = await supabase.rpc("save_academic_exam_batch", {
        target_career: career, existing_ids: [...ids], replacement_exams: exams
      });
      if (error) {
        if (error.code === "P0002") throw new AgendaError(404, "Uno de los exámenes ya no existe.");
        throw error;
      }
      return res.json({ data });
    }

    const rows = readLocalEvents();
    const existing = rows.filter(row => ids.has(row.id) && row.carrera === career && row.tipo === "examen");
    if (existing.length !== ids.size) throw new AgendaError(404, "Uno de los exámenes ya no existe.");
    const remaining = rows.filter(row => !ids.has(row.id));
    if (exams.some(exam => remaining.some(row => row.carrera === career && row.fecha === exam.fecha &&
      scheduleOverlaps(sectionTimeRange(row), sectionTimeRange(exam))))) {
      throw new AgendaError(409, "El horario ya está ocupado para esta carrera. Elige otro.");
    }
    const data = exams.map(exam => ({
      ...exam, created_at: existing.find(row => row.id === exam.id)?.created_at || new Date().toISOString()
    }));
    saveLocalEvents([...remaining, ...data]);
    return res.json({ data });
  } catch (error) {
    errorResponse(res, error);
  }
}

export async function saveAgendaEvent(req, res) {
  try {
    const id = req.params.id;
    const event = await validateEvent(req.body || {}, id);
    if (id && event.tipo === "reposicion") await checkRestoredPractice(await getAgendaEvent(id), event);
    if (usingDatabase) {
      const query = id
        ? supabase.from(TABLE).update(event).eq("id", id).eq("carrera", event.carrera).eq("tipo", event.tipo)
        : supabase.from(TABLE).insert(event);
      const { data, error } = await query.select().maybeSingle();
      if (error) throw error;
      if (!data) throw new AgendaError(404, "La actividad ya no existe.");
      return res.status(id ? 200 : 201).json({ data });
    }
    const rows = readLocalEvents();
    const index = id ? rows.findIndex(row => row.id === id && row.carrera === event.carrera && row.tipo === event.tipo) : -1;
    if (id && index === -1) throw new AgendaError(404, "La actividad ya no existe.");
    const otherRows = rows.filter(row => row.id !== id);
    if (event.tipo === "reposicion" && otherRows.some(row =>
      row.tipo === event.tipo && row.seccion_id === event.seccion_id && row.fecha_original === event.fecha_original)) {
      throw new AgendaError(409, "Ya existe una reposición para esta sección y fecha original.");
    }
    if (otherRows.some(row => row.carrera === event.carrera && row.fecha === event.fecha &&
      scheduleOverlaps(sectionTimeRange(row), sectionTimeRange(event)))) {
      throw new AgendaError(409, "El horario ya está ocupado para esta carrera. Elige otro.");
    }
    const data = { ...event, id: id || randomUUID(), created_at: rows[index]?.created_at || new Date().toISOString() };
    if (id) rows[index] = data;
    else rows.push(data);
    saveLocalEvents(rows);
    return res.status(id ? 200 : 201).json({ data });
  } catch (error) {
    errorResponse(res, error);
  }
}

export async function deleteAgendaEvent(req, res) {
  try {
    const { id } = req.params;
    await checkRestoredPractice(await getAgendaEvent(id));
    if (usingDatabase) {
      const { data, error } = await supabase.from(TABLE).delete().eq("id", id).select("id").maybeSingle();
      if (error) throw error;
      if (!data) throw new AgendaError(404, "La actividad ya no existe.");
    } else {
      const rows = readLocalEvents();
      const remaining = rows.filter(row => row.id !== id);
      if (remaining.length === rows.length) throw new AgendaError(404, "La actividad ya no existe.");
      saveLocalEvents(remaining);
    }
    res.json({ success: true });
  } catch (error) {
    errorResponse(res, error);
  }
}
