// Prueba aislada: no lee ni modifica secciones reales.
import assert from 'node:assert/strict';
import vm from 'node:vm';
import path from 'node:path';
import {build} from 'esbuild';
const section={id:'demo',carrera:'Medicina',coordinador:'Titular Ejemplo',instructores_asignados:['assigned']};
let failure=false;
const database={from(table){assert.equal(table,'secciones');return {select(){return this},eq(){return this},async maybeSingle(){return failure?{error:new Error('offline')}:{data:section}}}}};
const built=await build({entryPoints:['server/src/middlewares/studentEnrollmentAccess.middleware.js'],bundle:true,platform:'node',format:'cjs',write:false,plugins:[{name:'isolated',setup(b){b.onResolve({filter:/db\/supabase\.js$/},()=>({path:'db',namespace:'fixture'}));b.onResolve({filter:/controllers\/secciones\.controller\.js$/},()=>({path:'sections',namespace:'fixture'}));b.onLoad({filter:/.*/,namespace:'fixture'},({path:p})=>({contents:p==='db'?'export const isSupabaseConfigured=true;export const supabase=globalThis.database;':'export const getLocalSchedulingSections=()=>[];'}));}}]});
const context={module:{exports:{}},exports:null,database};context.exports=context.module.exports;vm.runInNewContext(built.outputFiles[0].text,context);
const {requireStudentEnrollmentManager:manage,requireStudentSectionReader:read,requireGradeHistoryReader:history}=context.module.exports;
async function run(fn,user){let status=200,allowed=false;const req={params:{seccion_id:'demo'},body:{carrera:'spoofed'},query:{carrera:'spoofed'},instructor:user};const res={status(n){status=n;return this},json(){return this}};await fn(req,res,()=>{allowed=true});return {status,allowed,req};}
for(const rol of ['Creador','Coordinador']){const result=await run(manage,{rol});assert.equal(result.allowed,true);assert.equal(result.req.body.carrera,'Medicina');assert.equal(result.req.query.carrera,'Medicina');}
assert.equal((await run(manage,{rol:'Instructor',primer_nombre:'Titular',primer_apellido:'Ejemplo'})).allowed,true);
assert.equal((await run(manage,{rol:'Instructor',id:'assigned'})).status,403);
assert.equal((await run(read,{rol:'Instructor',id:'assigned'})).allowed,true);
assert.equal((await run(read,{rol:'Instructor',id:'other'})).status,403);
assert.equal((await run(manage,undefined)).status,403);
for (const rol of ['Creador','Coordinador']) assert.equal((await run(history,{rol})).allowed,true);
assert.equal((await run(history,{rol:'Instructor',primer_nombre:'Titular',primer_apellido:'Ejemplo'})).allowed,true);
for (const id of ['assigned','other']) assert.equal((await run(history,{rol:'Instructor',id})).status,403);
assert.equal((await run(history,undefined)).status,403);
failure=true;assert.equal((await run(manage,{rol:'Creador'})).status,503);
console.log('PASS permisos de matrícula: administración y titular, lectura de asignados, rechazo de externos, carrera autoritativa y fallo seguro sin acceso.');
