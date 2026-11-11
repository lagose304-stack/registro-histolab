import assert from "node:assert/strict";
import { createQuizItem, syncQuizItemAnswerKey, quizItemIssues, quizPublicationIssues, quizItemSlotCount, isQuizItemMultiSlot, quizMatchingOptions, completionBlankCount, quizItemLabel } from "../../shared/quizItems.mjs";
const short = createQuizItem("texto_corto","short");
const list = {...createQuizItem("listado","list"), cantidad:4};
assert.equal(quizItemSlotCount(short),1);
assert.equal(quizItemSlotCount(list),4);
for (const cantidad of [0, -1, 11, 1.5, "", undefined, NaN]) {
  assert(quizItemIssues({...list,cantidad},false).length, `Cantidad inválida: ${cantidad}`);
}
for (const cantidad of [1, 3, 10]) {
  assert.deepEqual(quizItemIssues({...list,cantidad,instruccion:"Enumera"}),[]);
}
assert.equal(isQuizItemMultiSlot(short),false);
assert.equal(isQuizItemMultiSlot(list),true);
let choice=createQuizItem("seleccion_multiple","choice");
assert.equal(quizItemIssues(choice,false).length,0,"Se permiten borradores incompletos");
assert(quizItemIssues(choice).length>0,"No se publica una selección vacía");
choice={...choice,instruccion:"Seleccione un epitelio",opciones:[{id:"a",texto:"Simple"},{id:"b",texto:"Estratificado"}],respuesta_correcta:"b"};
assert.deepEqual(quizItemIssues(choice),[]);
assert.deepEqual(syncQuizItemAnswerKey(choice).respuestas_esperadas,["Estratificado"]);
assert(quizItemIssues({...choice,respuesta_correcta:"missing"}).length);
assert(quizItemIssues({...choice,opciones:[{id:"a",texto:"Simple"},{id:"b",texto:" simple "}]}).length);
const truth={...createQuizItem("verdadero_falso","truth"),instruccion:"El epitelio es avascular",respuesta_correcta:"Falso"};
assert.deepEqual(quizItemIssues(truth),[]);
assert.deepEqual(syncQuizItemAnswerKey(truth).respuestas_esperadas,["Falso"]);
assert.equal(isQuizItemMultiSlot(truth),false);
assert.equal(isQuizItemMultiSlot(choice),false);
assert(quizItemIssues({...truth,respuesta_correcta:"otro"}).length);
const pairs={...createQuizItem("terminos_pareados","pairs"),instruccion:"Relacione",pares:[{id:"a",termino:"Célula A",definicion:"Definición A"},{id:"b",termino:"Célula B",definicion:"Definición B"}]};
assert.deepEqual(quizItemIssues(pairs),[]);
assert.equal(quizItemSlotCount(pairs),2);
assert.equal(isQuizItemMultiSlot(pairs),true);
assert.deepEqual(syncQuizItemAnswerKey(pairs).respuestas_esperadas,["Definición A","Definición B"]);
assert.notDeepEqual(quizMatchingOptions(pairs),pairs.pares.map(pair=>pair.definicion));
assert.deepEqual(quizMatchingOptions(pairs),quizMatchingOptions(pairs),"El orden no cambia al responder");
assert(quizItemIssues({...pairs,pares:[pairs.pares[0],{...pairs.pares[1],definicion:"Definición A"}]}).length);
assert(quizItemIssues({...pairs,pares:[null,null]},false).length);
assert(quizItemIssues({...choice,opciones:[null,null]},false).length);
assert.equal(syncQuizItemAnswerKey(short),short,"Las preguntas históricas no se transforman");
assert.deepEqual(quizPublicationIssues([{items:[choice,truth,pairs]}]),[]);
assert(quizPublicationIssues([{items:[]}]).length);
console.log("Tipos de apartado, claves de revisión, borradores, validación y compatibilidad verificados.");

const completion={...createQuizItem("completacion","completion"),texto_completar:"El ___ produce ___ en el tejido conectivo.",respuestas_esperadas:["fibroblasto","matriz"]};
assert.equal(quizItemLabel(list),"Numeración");
assert.equal(completionBlankCount(completion.texto_completar),2);
assert.equal(quizItemSlotCount(completion),2);
assert.equal(isQuizItemMultiSlot(completion),true);
assert.deepEqual(quizItemIssues(completion),[]);
assert.deepEqual(syncQuizItemAnswerKey(completion).respuestas_esperadas,["fibroblasto","matriz"]);
assert.equal(syncQuizItemAnswerKey(completion).cantidad,2);
assert(quizItemIssues({...completion,respuestas_esperadas:["",""]}).length);
assert(quizItemIssues({...completion,texto_completar:"Sin espacios"}).length);
assert(quizItemIssues({...completion,texto_completar:Array(12).fill("___").join(" texto ")}).length);
assert.deepEqual(quizItemIssues(createQuizItem("completacion","draft"),false),[]);
assert.deepEqual(syncQuizItemAnswerKey({...completion,texto_completar:"Solo ___."}).respuestas_esperadas,["fibroblasto"]);
console.log("Completación por espacios y nombre Numeración verificados.");

for (let count=2;count<=10;count++) {
  for (let variation=0;variation<200;variation++) {
    const item={id:`matching_${variation}`,tipo:"terminos_pareados",pares:Array.from({length:count},(_,index)=>({id:`pair_${index}`,termino:`Término ${index}`,definicion:`Definición ${(index*7+variation)%count} - ${index}`}))};
    const original=item.pares.map(pair=>pair.definicion);
    const shuffled=quizMatchingOptions(item);
    assert.deepEqual([...shuffled].sort(),[...original].sort(),"Se conserva cada definición exactamente una vez");
    shuffled.forEach((definition,index)=>assert.notEqual(definition,original[index],`No puede coincidir la posición ${index}, con ${count} pares`));
    assert.deepEqual(quizMatchingOptions(structuredClone(item)),shuffled,"El orden permanece estable al reconstruir el apartado");
    assert.deepEqual(item.pares.map(pair=>pair.definicion),original,"La clave de corrección no se reordena");
  }
}
console.log("Términos pareados: 1800 configuraciones sin coincidencias de posición y con orden estable verificadas.");
