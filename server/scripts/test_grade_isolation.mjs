// Controladores reales, base y archivos simulados; nunca toca matrículas reales.
import assert from "node:assert/strict";
import vm from "node:vm";
import { build } from "esbuild";
import { createRequire } from "node:module";
import { sameStudentEnrollment } from "../../shared/studentIdentity.mjs";
const require=createRequire(import.meta.url);
const bundle=await build({entryPoints:["server/src/controllers/estudiantes.controller.js"],bundle:true,platform:"node",format:"cjs",write:false,logLevel:"silent",plugins:[{name:"isolated-grades",setup(b){
  b.onResolve({filter:/db\/supabase\.js$/},()=>({path:"db",namespace:"fixture"}));
  b.onResolve({filter:/^(node:)?fs$/},()=>({path:"fs",namespace:"fixture"}));
  b.onResolve({filter:/\.\/(secciones|semanas|asignaciones|academicAgenda|manualsSchedule|temario)\.controller\.js$/},args=>({path:args.path,namespace:"helpers"}));
  b.onLoad({filter:/.*/,namespace:"helpers"},()=>({contents:"export const getLocalSchedulingSections=()=>[],getLocalSchedulingWeeks=()=>[],getLocalSectionAssignments=()=>[],getSectionAttendanceEvents=async()=>[],getManualSchedule=async()=>({}),getLocalAcademicSettings=()=>({});"}));
  b.onLoad({filter:/.*/,namespace:"fixture"},({path})=>({contents:path==="db"?"export const supabase=globalThis.fixture.db,isSupabaseConfigured=globalThis.fixture.configured;":"export default {existsSync:()=>true,mkdirSync(){},readFileSync:()=>JSON.stringify(globalThis.fixture.local),writeFileSync(){globalThis.fixture.fileWrites++}};"}));
}}]});
const tables=["medicina","enfermeria","odontologia","microbiologia","nutricion"].map(c=>`estudiantes_${c}`);
const seed=()=>[
  {id:"a1",numero_cuenta:"A",seccion_id:"s1",carrera:"Medicina",activo:true,notas:{prueba_1:1},updated_at:"2026-11-01T00:00:00Z"},
  {id:"b1",numero_cuenta:"B",seccion_id:"s1",carrera:"Medicina",activo:true,notas:{prueba_1:4},updated_at:"2026-11-01T00:00:00Z"},
  {id:"a2",numero_cuenta:"A",seccion_id:"s2",carrera:"Medicina",activo:true,notas:{prueba_1:2},updated_at:"2026-11-01T00:00:00Z"}
];
function setup(configured=true){
 const fixture={configured,rows:Object.fromEntries(tables.map(t=>[t,[]])),fileWrites:0,dbWrites:0,offline:false,failAccount:null,conflictAccount:null};
 fixture.rows.estudiantes_medicina=seed();fixture.rows.secciones=[{id:"s1",carrera:"Medicina"},{id:"s2",carrera:"Medicina"}];
 fixture.local={estudiantes_medicina:[{...seed()[0],id:"stale-local-id",notas:{prueba_1:99}}]};
 fixture.db={from(table){let operation="read",payload,single=false;const filters=[];const q={
  select(){return q;},eq(key,value){filters.push(row=>typeof row[key]==="object"&&row[key]!==null&&typeof value==="string"?JSON.stringify(row[key])===value:row[key]===value);return q;},
  in(key,values){filters.push(row=>values.includes(row[key]));return q;},is(key,value){filters.push(row=>row[key]===value);return q;},order(){return q;},maybeSingle(){single=true;return q;},update(value){operation="update";payload=value;return q;},
  then(resolve,reject){return Promise.resolve().then(()=>{
   if(fixture.offline)return {error:{code:"OFFLINE"}};
   let selected=(fixture.rows[table]||[]).filter(row=>filters.every(f=>f(row)));
   if(operation==="update"){
    if(selected.some(row=>row.numero_cuenta===fixture.failAccount))return {error:{code:"WRITE_FAILED"}};
    if(selected.some(row=>row.numero_cuenta===fixture.conflictAccount))return {data:[]};
    selected.forEach(row=>{Object.assign(row,structuredClone(payload));fixture.dbWrites++;});
   }
   if(single&&selected.length>1)return {error:{code:"MULTIPLE_ROWS"}};
   return {data:structuredClone(single?selected[0]||null:selected)};
  }).then(resolve,reject);}
 };return q;}};
 const module={exports:{}};vm.runInNewContext(bundle.outputFiles[0].text,{module,exports:module.exports,require,fixture,console:{log(){},warn(){},error(){}},process:{cwd:()=>process.cwd(),env:{}}});
 return {api:module.exports,fixture};
}
async function call(fn,req){let status=200,body;const res={status(value){status=value;return res;},json(value){body=value;return res;}};await fn({params:{},query:{},body:{},...req},res);return {status,body};}
const own=(account="A",section="s1",career="Medicina")=>({params:{carrera:career,numero_cuenta:account},query:{seccion_id:section},student:seed()[0]});
let {api,fixture}=setup();
assert.equal((await call(api.getEstudianteByCuenta,own())).body.data.notas.prueba_1,1);
for(const req of [own("B"),own("A","s2"),own("A","s1","Enfermeria")])assert.equal((await call(api.getEstudianteByCuenta,req)).status,403);
fixture.rows.estudiantes_medicina=fixture.rows.estudiantes_medicina.filter(row=>row.id!=="a1");
assert.equal((await call(api.getEstudianteByCuenta,own())).status,404,"No sustituye la matrícula perdida por una copia local o de otra sección");
fixture.offline=true;
assert.equal((await call(api.getEstudianteByCuenta,own())).status,503);
assert.equal((await call(api.getEstudiantesBySeccion,{params:{seccion_id:"s1"},query:{carrera:"Medicina"}})).status,503,"Un fallo de BD no muestra notas antiguas del archivo local");
const local=setup(false);
assert.equal((await call(local.api.getEstudianteByCuenta,own())).status,404,"El respaldo local también comprueba el ID");

const batch=updates=>({params:{seccion_id:"s1"},body:{carrera:"Medicina",updates}});
({api,fixture}=setup());
let result=await call(api.updateBatchGrades,batch([{id:"a1",numero_cuenta:"A",expected_updated_at:seed()[0].updated_at,notas:{prueba_1:3,prueba_1_real:6}}]));
assert.equal(result.status,200);assert.equal(result.body.updatedCount,1);
assert.equal(fixture.rows.estudiantes_medicina.find(row=>row.id==="a1").notas.prueba_1,3);
assert.equal(fixture.rows.estudiantes_medicina.find(row=>row.id==="b1").notas.prueba_1,4);
assert.equal(fixture.rows.estudiantes_medicina.find(row=>row.id==="a2").notas.prueba_1,2);
assert.equal(fixture.fileWrites,0,"No fabrica respaldos locales después de guardar en BD");
assert.equal((await call(api.updateBatchGrades,batch([{id:"a2",numero_cuenta:"A",notas:{prueba_1:5}}]))).status,409);
assert.equal((await call(api.updateBatchGrades,batch([{numero_cuenta:"NO_EXISTE",notas:{prueba_1:5}}]))).status,409);
assert.equal((await call(api.updateBatchGrades,batch([{numero_cuenta:"A"},{numero_cuenta:"A"}]))).status,400);
assert.equal((await call(api.updateBatchGrades,batch([{numero_cuenta:"A",expected_updated_at:seed()[0].updated_at,notas:{prueba_1:5}}]))).status,409,"Una edición atrasada no pisa un guardado nuevo");
fixture.failAccount="B";
result=await call(api.updateBatchGrades,batch([{numero_cuenta:"A",notas:{prueba_1:2}},{numero_cuenta:"B",notas:{prueba_1:5}}]));
assert.equal(result.status,503);assert.equal(result.body.success,false);assert.equal(result.body.updatedCount,1,"El guardado parcial se informa como fallo, con cantidad confirmada");
assert.equal(fixture.rows.estudiantes_medicina.find(row=>row.id==="b1").notas.prueba_1,4);
fixture.failAccount=null;fixture.conflictAccount="A";
assert.equal((await call(api.updateBatchGrades,batch([{numero_cuenta:"A",notas:{prueba_1:5}}]))).status,409);
await assert.rejects(api.updateEstudianteGradeDirect("s1","A","Medicina","prueba_2",5,true),/notas cambiaron/);
fixture.conflictAccount=null;fixture.failAccount="A";
await assert.rejects(api.updateEstudianteGradeDirect("s1","A","Medicina","prueba_2",5,true));
fixture.failAccount=null;
await api.updateEstudianteGradeDirect("s1","A","Medicina","prueba_2",5,true);
assert.equal(fixture.rows.estudiantes_medicina.find(row=>row.id==="a1").notas.prueba_2,5);
assert.equal(fixture.rows.estudiantes_medicina.find(row=>row.id==="a2").notas.prueba_2,undefined);
assert.equal(api.sanitizeNotasPayload({prueba_1:5,examencito_1:1}).prueba_1,5,"El alias antiguo no reemplaza la nota canónica al guardar");
for(const props of [{id:"other"},{numero_cuenta:"B"},{seccion_id:"s2"},{carrera:"Enfermeria"}])assert.equal(sameStudentEnrollment(seed()[0],{...seed()[0],...props}),false);
assert(sameStudentEnrollment(seed()[0],{...seed()[0],carrera:"MEDICINA"}));
assert.equal(sameStudentEnrollment(null,null),false);
console.log("PASS aislamiento: ID/cuenta/carrera/sección, rechazo de terceros y respaldos ajenos, guardado por matrícula, conflictos concurrentes, fallos parciales sin éxito falso, alias históricos y sincronización de pruebas.");
