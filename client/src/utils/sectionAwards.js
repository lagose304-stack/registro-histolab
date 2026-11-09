import { calculateStudentAcademicSummary } from "./academicEngine.js";

export function buildSectionAwardsRanking(students = [], scores = {}, topics = [], weeks = []) {
  const ranking = students.map(student => {
    const summary = calculateStudentAcademicSummary(student, scores, topics, weeks);
    return {
      ...student,
      cuenta: String(student.numero_cuenta || "").trim(),
      nombre: student.nombre_completo || `${student.primer_nombre || ""} ${student.primer_apellido || ""}`.trim() || "Estudiante",
      grandTotalPremios: summary.total,
      totalPruebas: summary.notaOroPruebas,
      totalManuales: summary.notaOroManuales,
      totalExamenes: summary.sumaExamenes,
      pruebasDesglose: summary.pruebasList.map(p => ({ semana: p.semana, nombre: p.label, nota: p.nota })),
      manualesDesglose: summary.manualesList.map(m => ({ temaId: m.temaId, titulo: m.label, numero: m.numero_tema, nota: m.nota })),
      examenesDesglose: summary.examenesList.map(e => ({ semana: e.semana, parcial: e.label, nota: e.nota }))
    };
  });
  ranking.sort((a, b) => b.grandTotalPremios - a.grandTotalPremios
    || b.totalPruebas - a.totalPruebas || b.totalExamenes - a.totalExamenes
    || a.nombre.localeCompare(b.nombre) || a.cuenta.localeCompare(b.cuenta));
  return ranking.map((student, index) => ({ ...student, posicion: index + 1, esPodio: index < 3 }));
}
