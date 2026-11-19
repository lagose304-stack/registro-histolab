export const ABSENCE_MESSAGE = "Tienes una falta injustificada en esta práctica. Tu nota en esta prueba es 0.";

export function practiceAbsent(student, week, makeup = null) {
  const attendance = student?.asistencias || {};
  const number = Number(week);
  const canonical = `asistencia_${number}`;
  const state = Object.hasOwn(attendance, canonical) ? attendance[canonical] : attendance[`semana_${number}`];
  const baseAbsent = state === "Falta injustificada";
  return baseAbsent || makeup?.asistencia_reposicion === "Falta injustificada";
}
