import { getAttendanceWindow, getAttendanceKeys, isAttendanceExamWeek } from "./attendanceWindow.mjs";
import { normalizeSectionCareer } from "./sectionCode.mjs";

export const MAKEUP_STATES = ["solicitada", "asignada", "completada", "rechazada", "cancelada"];
export const ACTIVE_MAKEUP_STATES = ["asignada", "completada"];
export function makeupAttendanceOutcome(attendance) {
  return attendance === "Asistio" ? "Repuso" : attendance === "Falta injustificada" ? "No repuso" : null;
}
export function getMakeupOutcome(attendances, week) {
  const value = attendances?.[`reposicion_${Number(week)}`];
  return ["Repuso", "No repuso"].includes(value) ? value : null;
}
export function hasJustifiedAbsence(student, week) {
  return getAttendanceKeys(week).map(key => student?.asistencias?.[key]).find(value => value != null) === "Falta justificada";
}
export function makeupPractice(section, weeks, number, events = [], now = new Date()) {
  const window = getAttendanceWindow(section, weeks, number, now, events);
  const startsAt = window.opensAt ? new Date(Date.parse(window.opensAt) + 600_000).toISOString() : null;
  return { startsAt, closesAt: window.closesAt, date: window.scheduledDate,
    eligible: Boolean(startsAt && Date.parse(startsAt) > now.getTime() && !window.isExam) };
}
export function sameMakeupProgram(origin, target) {
  return Boolean(origin && target && origin.id !== target.id &&
    target.activo !== false && target.activa !== false &&
    normalizeSectionCareer(origin.carrera) === normalizeSectionCareer(target.carrera) &&
    origin.periodo_academico && origin.periodo_academico === target.periodo_academico);
}
export function assertMakeupWeek(weeks, number) {
  const week = weeks.find(item => Number(item.numero_semana) === Number(number));
  if (!week || isAttendanceExamWeek(week)) throw new Error("Selecciona una práctica regular; los exámenes no se reponen con este procedimiento.");
  return week;
}
export const makeupGrade = value => typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 1 && Math.abs(value * 1000 - Math.round(value * 1000)) < 1e-7;
