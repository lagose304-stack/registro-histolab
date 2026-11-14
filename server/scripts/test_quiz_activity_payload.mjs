// Reproduce un cierre antes del primer efecto React, con almacenamiento ficticio.
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
const storage=new Map();
const bundle=await build({entryPoints:[fileURLToPath(new URL('../../client/src/utils/useQuizActivity.js',import.meta.url))],bundle:true,format:'cjs',write:false,logLevel:'silent',plugins:[{name:'before-effects',setup(b){
  b.onResolve({filter:/^react$/},()=>({path:'react',namespace:'test'}));
  b.onResolve({filter:/safeStorage$/},()=>({path:'storage',namespace:'test'}));
  b.onLoad({filter:/.*/,namespace:'test'},args=>({contents:args.path==='react'?'export const useCallback=f=>f,useEffect=()=>{},useRef=()=>({current:null}),useState=v=>[v,()=>{}];':'export const safeStorage={getItem:key=>globalThis.storage.get(key)||null};',loader:'js'}));
}}]});
const module={exports:{}};
vm.runInNewContext(bundle.outputFiles[0].text,{module,exports:module.exports,storage});
const quiz={id:'quiz',numero_semana:1},student={id:'student',seccion_id:'section',numero_cuenta:'A'};
const key='histolab_activity_student_section_A_quiz';
const pending=[{id:'pending-event'}];
const saved={quizId:'quiz',attempt:{id:'accepted',politica:'salidas-tres-faltas-v1'},pending};
const payload=(target=quiz,identity=student)=>module.exports.useQuizActivity({quiz:target,student:identity,api:{},active:()=>true,getQuestion:()=>({}),onLimit:()=>{}}).payload();
storage.set(key,JSON.stringify(saved));
let result=payload();assert.equal(result.actividad_intento_id,'accepted');assert.equal(result.actividad_eventos_pendientes[0].id,'pending-event');
assert.equal(payload(null).actividad_intento_id,undefined);
for(const identity of [{...student,id:'other'},{...student,seccion_id:'other'},{...student,numero_cuenta:'B'}])assert.equal(payload(quiz,identity).actividad_intento_id,undefined);
storage.set(key,JSON.stringify({...saved,quizId:'other'}));assert.equal(payload().actividad_intento_id,undefined);
storage.set(key,'invalid-json');assert.equal(payload().actividad_intento_id,undefined);
console.log('PASS cierre antes de restauración: recupera ID y eventos propios del disco sin usar otra matrícula ni fabricar aceptación.');
