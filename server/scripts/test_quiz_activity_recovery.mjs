// Solo datos ficticios: comprueba lectura de aceptación existente, sin escrituras.
import assert from 'node:assert/strict';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { build } from 'esbuild';
const require = createRequire(import.meta.url);
const rows = [
  {id:'accepted',seccion_id:'s',numero_semana:1,alumno_id:'student',numero_cuenta:'A',quiz_id:'q',reemplazado_at:null,faltas:2},
  {id:'retired',seccion_id:'s',numero_semana:1,alumno_id:'student',numero_cuenta:'A',quiz_id:'old',reemplazado_at:'2026-01-01'},
];
let failRead=false;
const database={from(table){
  const filters=[];
  const query={
    select(){return query;},match(where){filters.push(...Object.entries(where));return query;},
    is(key,value){filters.push([key,value]);return query;},eq(key,value){filters.push([key,value]);return query;},
    maybeSingle(){return query;},order(){return query;},
    then(resolve,reject){return Promise.resolve().then(()=>{
      if(failRead)return {error:{code:'42501'}};
      const found=rows.filter(row=>filters.every(([key,value])=>row[key]===value));
      return {data:table==='quiz_activity_events'?[{intento_id:'accepted',falta:2}]:found[0]||null,error:null};
    }).then(resolve,reject);}
  };
  return query;
}};
const bundle=await build({entryPoints:[fileURLToPath(new URL('../src/services/quizActivity.js',import.meta.url))],platform:'node',format:'cjs',bundle:true,write:false,logLevel:'silent',plugins:[{name:'isolated',setup(b){
  b.onResolve({filter:/db\/supabase\.js$/},()=>({path:'db',namespace:'test'}));
  b.onResolve({filter:/^node:fs$/},()=>({path:'fs',namespace:'test'}));
  b.onLoad({filter:/.*/,namespace:'test'},args=>({contents:args.path==='db'?'export const supabase=globalThis.database,isSupabaseConfigured=true;':'export default {existsSync:()=>false};',loader:'js'}));
}}]});
const module={exports:{}};
vm.runInNewContext(bundle.outputFiles[0].text,{module,exports:module.exports,database,require,process:{cwd:()=>path.resolve('server')}});
const find=module.exports.findCurrentQuizActivity;
const student={id:'student',numero_cuenta:'A'};
const recovered=await find('s',1,student,'q');
assert.equal(recovered.id,'accepted');assert.equal(recovered.faltas,2);assert.equal(recovered.eventos.length,1);
for(const args of [['other',1,student,'q'],['s',2,student,'q'],['s',1,{...student,id:'other'},'q'],['s',1,{...student,numero_cuenta:'B'},'q'],['s',1,student,'other'],['s',1,student,'old']]){
  assert.equal(await find(...args),null,'No recupera aceptación de otra matrícula, semana, prueba o retirada');
}
failRead=true;await assert.rejects(()=>find('s',1,student,'q'),{code:'42501'});
console.log('PASS recuperación: identidad completa, misma prueba, faltas y eventos conservados; sin crear aceptación ni ocultar fallos de base.');
