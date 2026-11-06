import assert from "node:assert/strict";
import { getExamMetadata, getCanonicalExamGrade, calculateStudentAcademicSummary } from "../../client/src/utils/academicEngine.js";

const weeks = [
  { numero_semana: 5, es_examen: true, parcial: "I Parcial", nombre_semana: "Examen I" },
  { numero_semana: 11, es_examen: true, parcial: "II Parcial", nombre_semana: "Examen II" },
  { numero_semana: 16, es_examen: true, parcial: "III Parcial", nombre_semana: "Examen III" }
];
const legacy = { primer_examen: 0, segundo_examen: 0, tercer_examen: 0, notas: { primer_examen: 7.125, segundo_examen: 8.625 } };
assert.deepEqual(weeks.map((week, index) => getCanonicalExamGrade(legacy, index, week)), [7.125, 8.625, null]);
assert.deepEqual(weeks.map((week, index) => getExamMetadata(week, index).legacyKey), ["primer_examen", "segundo_examen", "tercer_examen"]);
let summary = calculateStudentAcademicSummary(legacy, {}, [], weeks);
assert.equal(summary.sumaExamenes, 15.75);
assert.deepEqual(summary.examenesList.map(exam => exam.nota), [7.125, 8.625, null]);
assert.equal(calculateStudentAcademicSummary(legacy, {}, [], []).sumaExamenes, 15.75, "Los ceros por defecto no ocultan las notas históricas JSON");
const canonical = { ...legacy, notas: { ...legacy.notas, examen_semana_5: 6.25, examen_11: 9.5, examen_semana_16: 0 } };
assert.deepEqual(weeks.map((week, index) => getCanonicalExamGrade(canonical, index, week)), [6.25, 9.5, 0], "La semana tiene prioridad y un cero explícito es una nota válida");
const four = [...weeks, { numero_semana: 20, es_examen: true, parcial: "IV Parcial", nombre_semana: "Examen IV" }];
assert.equal(getCanonicalExamGrade(legacy, 3, four[3]), null, "Un cuarto examen no vuelve a leer el primero");
summary = calculateStudentAcademicSummary({ notas: { examen_semana_5: 1, examen_semana_11: 2, examen_semana_16: 3, examen_semana_20: 4 } }, {}, [], four);
assert.equal(summary.sumaExamenes, 10);
assert.deepEqual(summary.examenesList.map(exam => exam.nota), [1, 2, 3, 4]);
const samePartial = weeks.map(week => ({ ...week, parcial: "Parcial único" }));
assert.deepEqual(samePartial.map((week, index) => getCanonicalExamGrade(legacy, index, week)), [7.125, 8.625, null], "Compartir el nombre del parcial no mezcla exámenes");
console.log("PASS: exámenes en semanas 5/11/16, notas históricas, prioridad por semana, ceros y más de tres exámenes sin mezclas.");
