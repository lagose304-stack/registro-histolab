import { getAcademicDate } from "./academicWeek.mjs";
import { getAttendanceWindow, isAttendanceExamWeek } from "./attendanceWindow.mjs";
import { parseScheduleDate } from "./academicSchedule.mjs";

export function getManualsWindow(section, weeks, weekNumber, now = new Date(), events = [], deadlines = []) {
  const ordered = [...weeks].sort((left, right) => Number(left.numero_semana) - Number(right.numero_semana));
  const index = ordered.findIndex(week => Number(week.numero_semana) === Number(weekNumber));
  const week = ordered[index];
  const next = ordered[index + 1];
  const result = { isOpen: false, opensAt: null, closesAt: null, isSpecial: false, isReplacement: false };
  if (!week || isAttendanceExamWeek(week)) {
    return { ...result, reason: "Selecciona una semana de clase con manuales." };
  }
  if (!next) return { ...result, reason: "Define la siguiente semana académica para calcular la carga de manuales." };

  result.isSpecial = isAttendanceExamWeek(next);
  result.nextWeekNumber = next.numero_semana;
  if (result.isSpecial) {
    const deadline = deadlines.find(item => Number(item.numero_semana) === Number(weekNumber));
    if (!parseScheduleDate(deadline?.fecha_carga)) {
      return { ...result, reason: "El titular debe definir el día de carga de los manuales previos al examen." };
    }
    result.date = deadline.fecha_carga;
    const midnight = new Date(`${deadline.fecha_carga}T00:00:00-06:00`).getTime();
    result.opensAt = new Date(midnight).toISOString();
    result.closesAt = new Date(midnight + 86_400_000).toISOString();
  } else {
    const nextPractice = getAttendanceWindow(section, weeks, next.numero_semana, now, events);
    result.opensAt = nextPractice.opensAt;
    result.closesAt = nextPractice.closesAt;
    result.isReplacement = nextPractice.isReplacement;
    if (!result.opensAt || !result.closesAt) {
      return { ...result, reason: "Guarda las fechas y el horario de la siguiente práctica." };
    }
    result.date = getAcademicDate(new Date(result.opensAt));
  }
  if (now.getTime() < Date.parse(result.opensAt)) {
    return { ...result, reason: "La carga de manuales aún no se ha habilitado." };
  }
  if (now.getTime() >= Date.parse(result.closesAt)) {
    return { ...result, reason: "El plazo para cargar estos manuales ya terminó." };
  }
  return { ...result, isOpen: true, reason: result.isSpecial
    ? "Carga habilitada durante el día definido por el titular."
    : "Carga habilitada durante la siguiente práctica, con margen de diez minutos." };
}
