import assert from "node:assert/strict";
import vm from "node:vm";
import path from "node:path";
import {fileURLToPath} from "node:url";
import {build} from "esbuild";
const bundle=await build({entryPoints:[fileURLToPath(new URL('../src/services/quizActivity.js',import.meta.url))],platform:'node',format:'cjs',bundle:true,write:false,logLevel:'silent',plugins:[{name:'isolate',setup(b){
 b.onResolve({filter:/db\/supabase\.js$/},()=>({path:'db',namespace:'test'}));b.onResolve({filter:/^node:fs$/},()=>({path:'fs',namespace:'test'}));
 b.onLoad({filter:/.*/,namespace:'test'},args=>({contents:args.path==='db'?'export const supabase=globalThis.database,isSupabaseConfigured=true;':'export default {existsSync:()=>false};',loader:'js'}));
}}]});
for(const scenario of ['ready','missing','denied']){
 let row=null,insertions=[];
 const database={from(table){let insert;const query={select:()=>query,match:()=>query,is:()=>query,eq:()=>query,order:()=>Promise.resolve({data:[]}),maybeSingle:()=>Promise.resolve({data:row}),insert:value=>{insert=value;insertions.push(value);return query;},single:async()=>{
 if(scenario==='denied')return {error:{code:'42501',message:'Permission denied'}};
 if(scenario==='missing'&&insert.diagnostico_version)return {error:{code:'PGRST204',message:"Could not find the 'diagnostico_version' column"}};
 row={...insert};return {data:row};
 }};assert(['quiz_activity_attempts','quiz_activity_events'].includes(table));return query;}};
 const module={exports:{}};
 vm.runInNewContext(bundle.outputFiles[0].text,{module,exports:module.exports,database,console,process:{cwd:()=>path.resolve('server')},require:key=>{if(key==='node:path')return path;if(key==='node:url')return {fileURLToPath};if(key==='node:crypto')return {randomUUID:()=> '00000000-0000-4000-8000-000000000001'};throw Error(key);}});
 const start=()=>module.exports.beginQuizActivity('s',1,{id:'student',numero_cuenta:'A'},{id:'quiz'},new Date().toISOString(),null,1);
 if(scenario==='denied'){await assert.rejects(start());assert.equal(insertions.length,1,'No oculta errores de permisos ni otros errores de la base');}
 else{const attempt=await start();assert.equal(attempt.diagnostico_version,scenario==='ready'?1:undefined);assert.equal(insertions.length,scenario==='ready'?1:2);assert.equal(attempt.faltas,0);}
}
console.log('PASS publicación: diagnóstico activo con migración, inicio compatible sin su columna y errores de permisos sin fallback inseguro.');
