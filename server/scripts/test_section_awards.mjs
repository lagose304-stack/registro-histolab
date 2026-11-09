import assert from "node:assert/strict";
import { buildSectionAwardsRanking } from "../../client/src/utils/sectionAwards.js";
import { calculateStudentAcademicSummary } from "../../client/src/utils/academicEngine.js";

const weeks = [{ numero_semana: 1 }, { numero_semana: 2 }, { numero_semana: 5, es_examen: true, parcial: "I Parcial" }];
const topics = [{ id: "uno", semana: 1, titulo: 'Tema, "uno"' }, { id: "dos", semana: 2, titulo: "Tema dos" }];
const scores = { nota_total_manuales: 10, nota_total_pruebas: 20 };
const students = [
  { numero_cuenta: "A", nombre_completo: "Ana", notas: { manual_uno: 1, manual_dos: 1, prueba_1: 1, prueba_2: 1, prueba_1_real: 6, prueba_2_real: 6, examen_semana_5: 2 } },
  { numero_cuenta: "B", nombre_completo: "Berta", notas: { manual_uno: 0, manual_dos: 0, prueba_1: 5, prueba_2: 5, examen_semana_5: 1 } },
  { numero_cuenta: "C", nombre_completo: "Cero", notas: { manual_uno: 0, prueba_1: 0, prueba_1_real: 100, manual_eliminado: 100, prueba_99: 100 } }
];
const ranking = buildSectionAwardsRanking(students, scores, topics, weeks);
assert.deepEqual(ranking.map(s => s.cuenta), ["B", "A", "C"], "La clasificación ponderada reemplaza al ranking bruto con bonus");
assert.deepEqual(ranking.map(s => s.grandTotalPremios), [21, 16, 0]);
for (const student of students) {
  const ranked = ranking.find(s => s.cuenta === student.numero_cuenta);
  const official = calculateStudentAcademicSummary(student, scores, topics, weeks);
  assert.equal(ranked.grandTotalPremios, official.total);
  assert.equal(ranked.totalPruebas, official.notaOroPruebas);
  assert.equal(ranked.totalManuales, official.notaOroManuales);
  const withoutBonus = { ...student, notas: Object.fromEntries(Object.entries(student.notas).filter(([key]) => !key.endsWith("_real"))) };
  assert.equal(buildSectionAwardsRanking([withoutBonus], scores, topics, weeks)[0].grandTotalPremios, ranked.grandTotalPremios);
}
assert.deepEqual(ranking[2].pruebasDesglose.map(p => p.nota), [0, null], "Ceros explícitos y pendientes se distinguen");
assert.equal(ranking[2].examenesDesglose[0].nota, null);
assert.deepEqual(buildSectionAwardsRanking([], scores, topics, weeks), []);
assert.equal(buildSectionAwardsRanking([students[0], { ...students[0], numero_cuenta: "AA" }], scores, topics, weeks)[0].cuenta, "A", "Los empates conservan un orden estable");
console.log("PASS premios: mismos puntos oro y total que el libro, bonus ignorado, ranking ponderado, ceros y pendientes, datos históricos, y empates.");
