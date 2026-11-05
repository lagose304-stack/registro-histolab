export const QUIZ_CREATION_ROLE = "Crear prueba semanal";
export const QUIZ_REVIEW_ROLE = "Revisión de prueba semanal";
const LEGACY_QUIZ_REVIEW_ROLE = "Subir nota de prueba semanal";
const quizRoles = new Set([QUIZ_CREATION_ROLE, QUIZ_REVIEW_ROLE, LEGACY_QUIZ_REVIEW_ROLE]);

export function synchronizeQuizAssignments(assignments) {
  const byReference = new Map();
  for (const assignment of assignments) {
    if (!quizRoles.has(assignment.tipo_asignacion)) continue;
    const current = byReference.get(assignment.referencia_id);
    if (!current || assignment.tipo_asignacion === QUIZ_CREATION_ROLE) {
      byReference.set(assignment.referencia_id, assignment);
    }
  }
  const result = assignments.filter(assignment => !quizRoles.has(assignment.tipo_asignacion));
  for (const assignment of byReference.values()) {
    for (const role of quizRoles) {
      const existing = assignments.find(item =>
        item.referencia_id === assignment.referencia_id && item.tipo_asignacion === role);
      result.push({ ...assignment, ...existing, instructor_id: assignment.instructor_id || null,
        instructor_nombre: assignment.instructor_nombre || "", tipo_asignacion: role });
    }
  }
  return result;
}
