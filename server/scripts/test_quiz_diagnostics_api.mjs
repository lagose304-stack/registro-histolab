import assert from "node:assert/strict";
import vm from "node:vm";
import path from "node:path";
import {fileURLToPath} from "node:url";
import {createRequire} from "node:module";
import {build} from "esbuild";
const require=createRequire(import.meta.url);
const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const attempts=[{id:id(1),seccion_id:'s',numero_semana:1,alumno_id:'student',numero_cuenta:'A',diagnostico_version:1},{id:id(2),seccion_id:'s',numero_semana:1,alumno_id:'other',numero_cuenta:'B',diagnostico_version:1},{id:id(3),seccion_id:'s',numero_semana:1,alumno_id:'student',numero_cuenta:'A'}];
const bundle=await build({entryPoints:[fileURLToPath(new URL('../src/controllers/quizDiagnostics.controller.js',import.meta.url))],platform:'node',format:'cjs',bundle:true,write:false,logLevel:'silent',plugins:[{name:'isolated',setup(b){
 b.onResolve({filter:/db\/supabase\.js$/},()=>({path:'db',namespace:'test'}));b.onResolve({filter:/services\/quizActivity\.js$/},()=>({path:'activity',namespace:'test'}));b.onResolve({filter:/^\.\/quizActivity\.js$/},()=>({path:'activity',namespace:'test'}));b.onResolve({filter:/^node:fs$/},()=>({path:'fs',namespace:'test'}));
 b.onLoad({filter:/.*/,namespace:'test'},args=>({contents:args.path==='db'?'export const supabase=globalThis.database,isSupabaseConfigured=globalThis.configured;':args.path==='activity'?'export const readQuizActivity=(...args)=>globalThis.readAttempt(...args);export const listQuizActivity=(...args)=>globalThis.listAttempts(...args);':'export default globalThis.filesystem;',loader:'js'}));
}}]});
for(const configured of [false,true]){
 const files=new Map(),databaseRows=[];let rpcCalls=0,failWrite=false;
 const filesystem={existsSync:f=>files.has(f),readFileSync:f=>files.get(f),mkdirSync(){},writeFileSync:(f,data)=>{if(failWrite)throw Error('WRITE_FAILED');files.set(f,data);},renameSync:(a,b)=>{files.set(b,files.get(a));files.delete(a);}};
 const database={rpc:async(name,args)=>{rpcCalls++;assert.equal(name,'append_quiz_diagnostic');assert.equal(args.p_student,'student');if(failWrite)return {error:{code:'WRITE_FAILED'}};if(!databaseRows.some(row=>row.id===args.p_batch))databaseRows.push({id:args.p_batch,intento_id:args.p_attempt,datos:structuredClone(args.p_payload)});return {data:{aceptado:true,limite:false}};},from:()=>{let ids;const query={select:()=>query,in:(_key,value)=>{ids=value;return query;},order:async()=>({data:databaseRows.filter(row=>ids.includes(row.intento_id))})};return query;}};
 const module={exports:{}};
 vm.runInNewContext(bundle.outputFiles[0].text,{module,exports:module.exports,require,process:{cwd:()=>path.resolve('server')},configured,database,filesystem,
 readAttempt:async(section,week,student,id)=>{const row=attempts.find(row=>row.id===id&&row.seccion_id===section&&row.numero_semana===week&&row.alumno_id===student.id&&row.numero_cuenta===student.numero_cuenta);if(!row)throw Error('Not yours');return structuredClone(row);},
 listAttempts:async(section,week,account)=>attempts.filter(row=>row.seccion_id===section&&row.numero_semana===week&&row.numero_cuenta===account)
 });
 const {saveDiagnostic,reviewDiagnostics}=module.exports;
 const body={id:id(100),numero_cuenta:'B',datos:{version:1,dispositivo:{navegador:'Safari',nombre:'No guardar'},muestras:[{motivos:['resize'],hora_cliente:new Date().toISOString(),foco:true,respuestas:'No guardar',texto:'No guardar'}]}};
 const params={seccion_id:'s',semana:1,intento_id:id(1),numero_cuenta:'A'};
 async function call(handler,overrides={}){let status=200,payload;const res={status(n){status=n;return res;},json(value){payload=value;return res;}};await handler({params,body,student:{id:'student',numero_cuenta:'A'},...overrides},res);return {status,payload};}
 assert.equal((await call(saveDiagnostic,{student:null,instructor:{id:'teacher'}})).status,403);
 assert.equal((await call(reviewDiagnostics)).status,403);
 assert.equal((await call(saveDiagnostic,{params:{...params,intento_id:id(2)}})).status,503);
 assert.equal((await call(saveDiagnostic,{params:{...params,intento_id:id(3)}})).status,503,'Una aceptación anterior al aviso no activa la recogida');
 assert.equal(rpcCalls,0);
 assert.equal((await call(saveDiagnostic)).status,200);assert.equal((await call(saveDiagnostic)).status,200);
 const report=await call(reviewDiagnostics,{student:null,instructor:{id:'teacher'}});
 assert.equal(report.payload.data.length,1);assert(!JSON.stringify(report).includes('No guardar'));assert(!JSON.stringify(report).includes('numero_cuenta'));
 failWrite=true;assert.equal((await call(saveDiagnostic,{body:{...body,id:id(101)}})).status,503);
 assert.equal((await call(reviewDiagnostics,{student:null,instructor:{id:'teacher'}})).payload.data.length,1);
 console.log(`PASS API diagnóstico (${configured?'Supabase aislado':'local aislado'}): identidad, aceptación, consulta docente, sanitización, reintentos y fallo de escritura sin éxito falso.`);
}
