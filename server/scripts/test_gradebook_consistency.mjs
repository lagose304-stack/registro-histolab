import assert from 'node:assert/strict';
import { calculateStudentAcademicSummary } from '../../client/src/utils/academicEngine.js';
import { getStudentDerechoStatus } from '../../client/src/utils/gradebookUtils.js';

const weeks = [1, 2, 5, 6, 11].map(numero_semana => ({ numero_semana,
  parcial: numero_semana <= 5 ? 'I Parcial' : 'II Parcial', es_examen: [5, 11].includes(numero_semana) }));
const topics = [{ id: 't1', semana: 1 }, { id: 't2', semana: 6 }, { id: 'disabled', semana: 2, tiene_manual: false }];
const student = { notas: { manual_t1: .5, manual_t2: 0, manual_disabled: 1, manual_deleted: 100,
  prueba_1: 5, prueba_1_real: 6, examencito_1: 1, prueba_2: 0, prueba_99_real: 6,
  prueba_99: 100, prueba_5: 5, examen_semana_5: 7.125, examen_semana_11: 8.625 },
  asistencias: { asistencia_1: 'Falta injustificada', semana_2: 'Falta injustificada', asistencia_6: 'Falta justificada' } };
const summary = calculateStudentAcademicSummary(student, { nota_total_manuales: 6, nota_total_pruebas: 10 }, topics, weeks);
assert.equal(summary.notaOroManuales, 1.5);
assert.equal(summary.notaOroPruebas, 3.333);
assert.equal(summary.total, 20.583);
assert.deepEqual(summary.manualesList.map(m => m.nota), [.5, 0]);
assert.deepEqual(summary.pruebasList.map(p => p.nota), [5, 0, null]);
const partials = ['I', 'II'].map((roman, i) => ({ id: `PARCIAL_${roman}_PARCIAL`, label: `${roman} Parcial`,
  rawParcialName: `${roman} Parcial`, semanas: i ? [6, 11] : [1, 2, 5] }));
const rights = getStudentDerechoStatus(student, 'TODOS', partials);
assert.equal(rights.perdioI, true);
assert.equal(rights.perdioII, false);
assert.equal(getStudentDerechoStatus(student, partials[0].id, partials).faltasInjustificadas, 2);
assert.equal(getStudentDerechoStatus(student, partials[1].id, partials).perdioDerecho, false);
const legacy = calculateStudentAcademicSummary({ notas: { prueba_9_real: 6, examencito_1: 2, prueba_1: 5 } });
assert.deepEqual(legacy.pruebasList.map(p => p.nota), [5]);
const noExams = calculateStudentAcademicSummary({ notas: { manual_deleted: 1, primer_examen: 10 } }, {}, [], [{ numero_semana: 1 }]);
assert.equal(noExams.total, 0, 'Sin temas ni exámenes configurados no se suman notas antiguas invisibles');
console.log('PASS: totales coherentes con columnas vigentes; sin duplicados, bonus ni notas eliminadas; ceros, pendientes y faltas por parcial.');
