import { getAttendanceWindow, isAttendanceExamWeek } from "./attendanceWindow.mjs";
import { getAcademicDate, getCurrentAcademicWeek } from "./academicWeek.mjs";

// La identidad de la prueba siempre es su semana de contenido, no la de rendición.
export function getQuizPractice(weeks, quizWeek) {
  const ordered = [...weeks].sort((a,b) => Number(a.numero_semana)-Number(b.numero_semana));
  const index = ordered.findIndex(week => Number(week.numero_semana) === Number(quizWeek));
  const week = ordered[index], next = ordered[index + 1];
  if (!week || isAttendanceExamWeek(week)) return { practiceWeek: null, reason: "Las semanas de examen no tienen prueba semanal." };
  if (!next) return { practiceWeek: null, reason: "Configura la siguiente semana para determinar cuándo se realiza esta prueba." };
  const beforeExam = isAttendanceExamWeek(next);
  return { practiceWeek: Number((beforeExam ? week : next).numero_semana), beforeExam,
    reason: beforeExam ? "Se realiza en esta misma práctica porque la siguiente semana es de examen."
      : `Se realiza en la práctica de la semana ${next.numero_semana}.` };
}
export function getQuizWindow(section, weeks, quizWeek, now = new Date(), events = []) {
  const rule = getQuizPractice(weeks, quizWeek);
  const result = { ...rule, isOpen: false, isPracticeDay: false, scheduledDate: null, opensAt: null, closesAt: null };
  if (!rule.practiceWeek) return result;
  if (isAttendanceExamWeek(getCurrentAcademicWeek(weeks,getAcademicDate(now)))) return { ...result, reason: "En la semana de examen no se habilitan pruebas semanales." };
  const practice = getAttendanceWindow(section, weeks, rule.practiceWeek, now, events);
  if (!practice.opensAt || !practice.closesAt) return { ...result, reason: practice.reason };
  // Pruebas: horario de la práctica, sin el margen de diez minutos de la lista.
  const opensAt = new Date(Date.parse(practice.opensAt) + 600_000).toISOString();
  const closesAt = new Date(Date.parse(practice.closesAt) - 600_000).toISOString();
  const isPracticeDay = getAcademicDate(now) === practice.scheduledDate;
  const isOpen = isPracticeDay && now.getTime() >= Date.parse(opensAt) && now.getTime() < Date.parse(closesAt);
  return { ...result, opensAt, closesAt, scheduledDate: practice.scheduledDate, isPracticeDay, isOpen,
    isReplacement: practice.isReplacement, reason: isOpen ? rule.reason
      : `${rule.reason} Fecha: ${practice.scheduledDate}. Solo se habilita en el horario de esa práctica.` };
}
export function quizzesDueAtPractice(weeks, practiceWeek) {
  return weeks.filter(week => getQuizPractice(weeks, week.numero_semana).practiceWeek === Number(practiceWeek))
    .map(week => Number(week.numero_semana)).sort((a,b)=>a-b);
}
