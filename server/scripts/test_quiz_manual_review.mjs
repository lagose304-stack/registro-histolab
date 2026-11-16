import assert from 'node:assert/strict';
import { manualQuickReviewQuestions, quickReviewSelections } from '../../client/src/utils/quizQuickReview.mjs';
import { buildAutomaticQuizAssessment, resolveQuizAssessment, splitQuizPoints } from '../../shared/quizAutoGrading.mjs';

const automaticItems = [
  {id:'choice',tipo:'seleccion_multiple',respuesta_correcta:'yes',opciones:[{id:'yes',texto:'Sí'},{id:'no',texto:'No'}]},
  {id:'tf',tipo:'verdadero_falso',respuesta_correcta:'Verdadero'},
  {id:'pairs',tipo:'terminos_pareados',pares:[{id:'a',termino:'A',definicion:'Uno'},{id:'b',termino:'B',definicion:'Dos'}]}
];
const mixed = {id:'mixed',puntos:6,items:[automaticItems[0],{id:'text',tipo:'texto_corto'},automaticItems[1],{id:'list',tipo:'listado',cantidad:3},automaticItems[2],{id:'complete',tipo:'completacion',texto_completar:'Uno ___ y dos ___'}]};
const questions = [{id:'automatic',items:automaticItems},mixed,{id:'legacy',puntos:1},{id:'empty',items:[],puntos:1},{id:'legacy-list',items:[{id:'old',tipo:'enumeracion',cantidad:2,puntos:1}]},{id:'bonus',puntos:1,items:[{id:'written',tipo:'texto_corto',puntos:1}]}];
const before = structuredClone(questions);
const review = manualQuickReviewQuestions(questions);
assert.deepEqual(review.map(q=>q.reviewQuestionIndex),[1,2,3,4,5]);
assert.deepEqual(review[0].items.map(item=>item.id),['text','list','complete']);
assert.deepEqual(review[0].items.map(item=>item.reviewItemIndex),[1,3,5],'Conserva las letras b, d y f de una pregunta mixta');
assert.deepEqual(review[0].items.map(item=>item.puntos),[1,1,1],'El reparto usa los seis incisos originales, no los tres visibles');
assert.equal(review[0].reviewManualPoints,3);
assert.equal(review.at(-1).reviewQuestionIndex,5,'El bonus histórico mantiene su posición original');
assert.deepEqual(questions,before,'No modifica la prueba ni añade metadatos de vista a su esquema');
assert.deepEqual(manualQuickReviewQuestions([{id:'auto',items:automaticItems}]),[]);
assert.deepEqual(manualQuickReviewQuestions([{items:[{tipo:'seleccion_multiple'}]}]),[],'Un inciso automático mal configurado tampoco es escritura');
assert.deepEqual(manualQuickReviewQuestions(),[]);
const explicit=manualQuickReviewQuestions([{puntos:10,items:[automaticItems[0],{id:'text',tipo:'texto_corto',puntos:2}]}]);
assert.equal(explicit[0].items[0].puntos,2,'Conserva puntajes explícitos');

const answers={mixed:{choice:'Sí',tf:'Verdadero',pairs:['Uno','Dos']}};
const assessment=buildAutomaticQuizAssessment([mixed],answers);
assert.equal(Object.keys(assessment.automaticas).length,4);
const evaluations={};
for(const descriptor of assessment.manuales){evaluations[descriptor.key]={estado:'buena',puntos_obtenidos:descriptor.puntos_max};}
const result=resolveQuizAssessment(assessment,evaluations);
assert.equal(result.pending,0);assert.equal(result.raw,6);assert.equal(result.official,5);
assert.equal(result.evaluations.mixed___choice.origen,'automatica');
assert.equal(result.evaluations.mixed___list___slot_2.puntos_obtenidos,splitQuizPoints(1,3)[2]);
const saved={A:{q___text:{estado:'mala',puntos_obtenidos:0}},B:{q___text:{estado:'mala',puntos_obtenidos:0},q___slot_0:{estado:'buena',puntos_obtenidos:1}}};
const chosen={A:{q___text:true}};
assert.deepEqual(quickReviewSelections(saved,chosen,'A'),saved.A);
assert.deepEqual(quickReviewSelections(saved,chosen,'B'),{},'Ni la selección anterior ni las notas guardadas preseleccionan al siguiente alumno');
chosen.B={q___slot_0:true};
assert.deepEqual(quickReviewSelections(saved,chosen,'B'),{q___slot_0:saved.B.q___slot_0},'Cada casilla exige una elección propia');
assert.deepEqual(quickReviewSelections(saved,chosen,'A'),saved.A,'Volver al alumno anterior recupera solo su elección');
assert.deepEqual(quickReviewSelections(saved,{},'A'),{},'Reabrir una revisión comienza sin seleccionar');
assert.equal(saved.B.q___text.estado,'mala','Mostrar una selección vacía no borra la nota anterior');
console.log('PASS revisión manual: tipos, puntajes, automática y selección independiente por estudiante/casilla sin borrar notas guardadas.');
