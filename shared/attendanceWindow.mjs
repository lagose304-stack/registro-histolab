import { getAcademicDate, getCurrentAcademicWeek } from "./academicWeek.mjs";
import { addScheduleDays, parseScheduleDate, sectionTimeRange } from "./academicSchedule.mjs";
import { normalizeSectionCareer } from "./sectionCode.mjs";

export function isAttendanceExamWeek(week) {
  return Boolean(week && (week.es_examen || week.esExamen ||
    String(week.temas || "").toUpperCase().includes("EXAMEN") ||
    String(week.descripcion || "").toLowerCase().includes("examen")));
}

export function getAttendanceKeys(week) {
  const number = week.numero_semana;
  const keys = [`asistencia_${number}`, `semana_${number}`];
  if (isAttendanceExamWeek(week)) {
    const partial = String(week.parcial || "").toUpperCase();
    const legacy = partial.includes("III") || partial.includes("TERCER") ? "Asistencia Tercer Examen"
      : partial.includes("II") || partial.includes("SEGUNDO") ? "Asistencia Segundo Examen" : "Asistencia Primer Examen";
    return [`asistencia_examen_${number}`, legacy, ...keys];
  }
  return keys;
}

const weekdays = ["DOMINGO", "LUNES", "MARTES", "MIERCOLES", "JUEVES", "VIERNES", "SABADO"];

export function getAttendanceWindow(section, weeks, weekNumber, now = new Date(), events = []) {
  const week = weeks.find(item => Number(item.numero_semana) === Number(weekNumber));
  const current = getCurrentAcademicWeek(weeks, getAcademicDate(now));
  const start = parseScheduleDate(week?.fecha_inicio);
  const end = parseScheduleDate(week?.fecha_fin);
  const result = { opensAt: null, closesAt: null, isOpen: false,
    isCurrentWeek: Boolean(current && Number(current.numero_semana) === Number(weekNumber)),
    isExam: isAttendanceExamWeek(week), isReplacement: false };
  if (!start || !end) {
    return { ...result, reason: "Guarda las fechas de la semana para habilitar la lista." };
  }

  let date, range;
  if (result.isExam) {
    const exams = events.filter(event => event.tipo === "examen" &&
      (!event.seccion_id || event.seccion_id === section.id) &&
      (!event.carrera || normalizeSectionCareer(event.carrera) === normalizeSectionCareer(section.carrera)) &&
      event.fecha >= week.fecha_inicio && event.fecha <= week.fecha_fin && sectionTimeRange(event))
      .sort((left, right) => left.fecha.localeCompare(right.fecha) || left.hora_inicio.localeCompare(right.hora_inicio));
    const exam = exams.find(event => {
      const midnight = new Date(`${event.fecha}T00:00:00-06:00`).getTime();
      return midnight + (sectionTimeRange(event)[1] + 10) * 60_000 > now.getTime();
    }) || exams.at(-1);
    if (!exam) return { ...result, reason: "Programa el examen de esta sección para habilitar su asistencia." };
    date = exam.fecha;
    range = sectionTimeRange(exam);
  } else {
    const weekday = weekdays.indexOf(normalizeSectionCareer(section?.dia));
    const regularRange = sectionTimeRange(section || {});
    if (weekday < 0 || !regularRange) {
      return { ...result, reason: "Guarda el horario de la sección para habilitar la lista." };
    }
    const originalDate = addScheduleDays(week.fecha_inicio, (weekday - start.getUTCDay() + 7) % 7);
    if (originalDate > week.fecha_fin) return { ...result, reason: "El día de la sección queda fuera de esta semana." };
    const replacement = events.find(event => event.tipo === "reposicion" &&
      event.seccion_id === section.id && event.fecha_original === originalDate);
    date = replacement?.fecha || originalDate;
    range = replacement ? sectionTimeRange(replacement) : regularRange;
    result.isReplacement = Boolean(replacement);
    result.originalDate = originalDate;
  }

  result.scheduledDate = date;
  if (!parseScheduleDate(date) || !range || range[1] > 1440) {
    return { ...result, reason: "Revisa la fecha y el horario de la actividad." };
  }
  const midnight = new Date(`${date}T00:00:00-06:00`).getTime();
  result.opensAt = new Date(midnight + (range[0] - 10) * 60_000).toISOString();
  result.closesAt = new Date(midnight + (range[1] + 10) * 60_000).toISOString();
  if (!result.isCurrentWeek && !result.isReplacement) {
    return { ...result, reason: "Solo puedes pasar asistencia de la semana actual." };
  }
  if (now.getTime() < Date.parse(result.opensAt)) return { ...result, reason: "La lista aún no se ha habilitado." };
  if (now.getTime() >= Date.parse(result.closesAt)) return { ...result, reason: "El horario para pasar lista ya terminó." };
  return { ...result, isOpen: true, reason: result.isReplacement
    ? "Lista habilitada para la reposición de esta semana."
    : result.isExam ? "Lista habilitada para el examen programado." : "Lista habilitada para la semana actual." };
}
