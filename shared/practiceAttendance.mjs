export const ABSENCE_MESSAGE = "Tienes una falta injustificada en esta práctica. Tu nota en esta prueba es 0.";

export function practiceAbsent(student, week, makeup = null) {
  const attendance = student?.asistencias || {};
  const baseAbsent = [`asistencia_${Number(week)}`, `semana_${Number(week)}`]
    .some(key => attendance[key] === "Falta injustificada");
  return baseAbsent || makeup?.asistencia_reposicion === "Falta injustificada";
}
