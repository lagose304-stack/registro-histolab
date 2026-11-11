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
  b.onLoad({filter:/.*/,namespace:"helpers"},()=>({contents:"export const getLocalSchedulingSections=()=>[],buildAcademicWeeks=(weeks)=>weeks,getLocalSchedulingWeeks=()=>[],getLocalSectionAssignments=()=>[],getSectionAttendanceEvents=async()=>[],getManualSchedule=async()=>({}),getLocalAcademicSettings=()=>({topics:[]});"}));
  b.onLoad({filter:/.*/,namespace:"fixture"},({path})=>({contents:path==="db"?"export const supabase=globalThis.fixture.db,isSupabaseConfigured=globalThis.fixture.configured;":"export default {existsSync:()=>true,mkdirSync(){},readFileSync:()=>JSON.stringify(globalThis.fixture.local),renameSync(){if(globalThis.fixture.failLocalWrite)throw new Error(\"DISK_FAILURE\");globalThis.fixture.local=globalThis.fixture.pending},writeFileSync(_file,data){globalThis.fixture.fileWrites++;globalThis.fixture.pending=JSON.parse(data)}};"}));
}}]});
const tables=["medicina","enfermeria","odontologia","microbiologia","nutricion"].map(c=>`estudiantes_${c}`);
const seed=()=>[
  {id:"a1",numero_cuenta:"A",seccion_id:"s1",carrera:"Medicina",activo:true,notas:{prueba_1:1},updated_at:"2026-11-01T00:00:00Z"},
  {id:"b1",numero_cuenta:"B",seccion_id:"s1",carrera:"Medicina",activo:true,notas:{prueba_1:4},updated_at:"2026-11-01T00:00:00Z"},
  {id:"a2",numero_cuenta:"A",seccion_id:"s2",carrera:"Medicina",activo:true,notas:{prueba_1:2},updated_at:"2026-11-01T00:00:00Z"}
];
function setup(configured=true, gradeHistory=[], now=null){
 const fixture={configured,rows:Object.fromEntries(tables.map(t=>[t,[]])),fileWrites:0,dbWrites:0,offline:false,failAccount:null,conflictAccount:null};
 fixture.rows.estudiantes_medicina=seed();fixture.rows.secciones=[{id:"s1",carrera:"Medicina"},{id:"s2",carrera:"Medicina"}];
 fixture.rows.historial_notas=gradeHistory;
 fixture.local={gradeHistory:{entries:gradeHistory},estudiantes_medicina:[{...seed()[0],id:"stale-local-id",notas:{prueba_1:99}}]};
 fixture.db={from(table){let operation="read",payload,single=false,limit,descending,includeCount=false;const filters=[];const q={
  setHeader(key,value){fixture.gradeHeader={key,value};return q;},select(_columns,options){includeCount=options?.count==="exact";return q;},eq(key,value){filters.push(row=>typeof row[key]==="object"&&row[key]!==null&&typeof value==="string"?JSON.stringify(row[key])===value:row[key]===value);return q;},
  in(key,values){filters.push(row=>values.includes(row[key]));return q;},is(key,value){filters.push(row=>row[key]===value);return q;},order(key, options){if(options?.ascending===false)descending=key;return q;},
  limit(value){limit=value;return q;},
  lt(key,value){filters.push(row=>row[key]<value);return q;},
  gte(key,value){filters.push(row=>row[key]>=value);return q;},
  not(key,op,value){assert.equal(op,"is");filters.push(row=>row[key]!==value);return q;},
  ilike(key,pattern){const text=pattern.slice(1,-1).replace(/\\([\\%_])/g,"$1").toLowerCase();filters.push(row=>row[key].toLowerCase().includes(text));return q;},
  maybeSingle(){single=true;return q;},update(value){operation="update";payload=value;return q;},
  then(resolve,reject){return Promise.resolve().then(()=>{
   if(fixture.offline)return {error:{code:"OFFLINE"}};
   let selected=(fixture.rows[table]||[]).filter(row=>filters.every(f=>f(row)));
   if(descending)selected.sort((a,b)=>b[descending]-a[descending]);
   if(limit!==undefined)selected=selected.slice(0,limit);
   if(operation==="update"){
    if(selected.some(row=>row.numero_cuenta===fixture.failAccount))return {error:{code:"WRITE_FAILED"}};
    if(selected.some(row=>row.numero_cuenta===fixture.conflictAccount))return {data:[]};
    selected.forEach(row=>{Object.assign(row,structuredClone(payload));fixture.dbWrites++;});
   }
   if(single&&selected.length>1)return {error:{code:"MULTIPLE_ROWS"}};
   return {data:structuredClone(single?selected[0]||null:selected),count:includeCount?selected.length:null};
  }).then(resolve,reject);}
 };return q;}};
 const module={exports:{}};vm.runInNewContext(bundle.outputFiles[0].text,{module,exports:module.exports,require,fixture,Date: now ? class extends Date { constructor(...args){super(...(args.length?args:[now]));} static now(){return Date.parse(now);} } : Date,console:{log(){},warn(){},error(){}},process:{cwd:()=>process.cwd(),env:{}}});
 return {api:module.exports,fixture};
}
async function call(fn,req){let status=200,body;const res={set(){return res;},status(value){status=value;return res;},json(value){body=value;return res;}};await fn({params:{},query:{},body:{},...req},res);return {status,body};}
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

const instructor = { id: "actor", nombre_completo: "Docente Ejemplo" };
const localGradeRequest = notas => ({ ...batch([{ numero_cuenta: "A", notas }]), instructor });
const listHistory = (section, query = {}) => call(local.api.listGradeHistory, { params: { seccion_id: section }, query });
assert.equal((await call(local.api.updateBatchGrades, localGradeRequest({ prueba_1: 0 }))).status, 200);
assert.equal((await call(local.api.updateBatchGrades, localGradeRequest({ prueba_1: 0 }))).status, 200);
assert.equal((await call(local.api.updateBatchGrades, localGradeRequest({}))).status, 200);
assert.deepEqual(Array.from((await listHistory("s1", { cuenta: "A" })).body.data, row => [row.anterior, row.nueva]),
  [[0, null], [99, 0]]);
assert.equal(local.fixture.local.gradeHistory.entries.at(-1).instructor_nombre, instructor.nombre_completo);
assert.equal((await listHistory("s2")).body.data.length, 0);
assert.equal((await listHistory("s1", { cuenta: "B" })).body.data.length, 0);
local.fixture.failLocalWrite = true;
assert.equal((await call(local.api.updateBatchGrades, localGradeRequest({ prueba_1: 3 }))).status, 500);
assert.equal((await listHistory("s1")).body.data.length, 2);
assert.equal(local.fixture.local.estudiantes_medicina[0].notas.prueba_1, undefined);
assert.equal((await call(api.updateBatchGrades, localGradeRequest({ prueba_1: 1 }))).status, 200);
assert.equal(fixture.gradeHeader.key, "x-histolab-grade-actor");
assert.equal(fixture.gradeHeader.value, instructor.id);
console.log("PASS historial local: identidad, cambios efectivos, filtros por sección y cuenta, y rollback si falla el archivo.");

const sampleEvent = {
  seccion_id: "s1", numero_cuenta: "A", etiqueta: "Prueba de la semana 1",
  instructor_nombre: "Docente Ejemplo", anterior: null, nueva: 0, fecha: "2026-11-09T06:00:00.000Z"
};
const auditRows = [
  ...Array.from({ length: 31 }, (_, index) => ({ ...sampleEvent, id: index + 1 })),
  ...[
    { seccion_id: "s2" }, { instructor_nombre: "Otro docente" }, { etiqueta: "Examen" },
    { numero_cuenta: "B" }, { anterior: 0, nueva: 4 }, { anterior: 0, nueva: null },
    { fecha: "2026-11-09T05:59:59.999Z" }, { fecha: "2026-11-10T06:00:00.000Z" }
  ].map((changes, index) => ({ ...sampleEvent, id: index + 32, ...changes }))
];
for (const configured of [false, true]) {
  const historyApi = setup(configured, auditRows).api;
  const query = { cuenta: "A", instructor: "ejemplo", evaluacion: "prueba", accion: "asigno", desde: "2026-11-09", hasta: "2026-11-09" };
  const fetchHistory = query => call(historyApi.listGradeHistory, { params: { seccion_id: "s1" }, query });
  const first = await fetchHistory(query);
  assert.equal(first.status, 200);
  assert.equal(first.body.data.length, 30);
  assert.equal(first.body.data[0].id, 31);
  assert.equal(first.body.next, 2);
  const second = await fetchHistory({ ...query, before: "2" });
  assert.equal(second.body.data.length, 1);
  assert.equal(second.body.data[0].id, 1);
  assert.equal(second.body.data[0].nueva, 0);
  for (const [action, id] of [["modifico", 36], ["elimino", 37]]) {
    const filtered = await fetchHistory({ ...query, accion: action });
    assert.equal(filtered.body.data.length, 1);
    assert.equal(filtered.body.data[0].id, id);
  }
  for (const invalid of [{ accion: "otro" }, { desde: "2026-02-30" }, { ...query, hasta: "2026-11-08" }, { instructor: ["a"] }]) {
    assert.equal((await fetchHistory(invalid)).status, 400);
  }
}
console.log("PASS filtros del historial: acciones, zona horaria de Honduras y paginación en ambos modos.");

const rankFixture = setup();
const rankRows = rankFixture.fixture.rows;
rankRows.estudiantes_medicina.push(
  { ...seed()[0], id: "zero", numero_cuenta: "ZERO", notas: { prueba_1: 0 } },
  { ...seed()[0], id: "pending", numero_cuenta: "PENDING", notas: {} },
  { ...seed()[0], id: "inactive", numero_cuenta: "INACTIVE", activo: false, notas: { prueba_1: 5 } }
);
rankRows.estudiantes_medicina.find(row => row.seccion_id === "s2").notas.prueba_1 = 5;
const myRank = id => call(rankFixture.api.getMySectionRank, {
  student: { id, seccion_id: "s1", carrera: "Medicina" },
  query: { id: "b1", seccion_id: "s2" }
});
for (const [id, position] of [["b1", 1], ["a1", 2], ["zero", 3], ["pending", null], ["inactive", null], ["a2", null]]) {
  const response = await myRank(id);
  assert.equal(response.status, 200);
  assert.equal(JSON.stringify(response.body), JSON.stringify({ data: { posicion: position } }));
}
rankFixture.fixture.offline = true;
assert.equal((await myRank("a1")).status, 503);
console.log("PASS clasificación individual: solo el puesto de la sesión, sección aislada, cero registrado y ausencia de datos.");

// La semana de contenido conserva la asistencia aunque la evaluación se rinda después.
({api,fixture}=setup());
fixture.rows.temario=[{id:'topic1',numero_tema:1,titulo:'Práctica uno',semana:1,carrera:'Medicina'},
  {id:'topic2',numero_tema:2,titulo:'Práctica dos',semana:2,carrera:'Medicina'}];
const juan=fixture.rows.estudiantes_medicina.find(row=>row.id==='a1');
juan.asistencias={asistencia_1:'Falta injustificada',asistencia_2:'Asistio'};
for(const notes of [{prueba_1:5},{prueba_1_real:6},{manual_topic1:1},{manual_tema_1:1},{'Manual de Práctica uno':1}]) {
  assert.equal((await call(api.updateBatchGrades,batch([{numero_cuenta:'A',notas:notes}]))).status,409);
}
assert.equal((await call(api.updateBatchGrades,batch([{numero_cuenta:'A',notas:{prueba_1:0,prueba_1_real:0,prueba_2:5,manual_topic2:1}}]))).status,200);
assert.equal(juan.notas.prueba_1,0);assert.equal(juan.notas.prueba_2,5);
juan.asistencias.asistencia_2='Falta injustificada';
assert.equal((await call(api.updateBatchGrades,batch([{numero_cuenta:'A',notas:{prueba_1:0,prueba_2:5}}]))).status,409);
await assert.rejects(api.updateEstudianteGradeDirect('s1','A','Medicina','prueba_2',5,true),/falta injustificada/);
juan.asistencias.asistencia_2='Falta justificada';
fixture.rows.reposiciones_estudiantes=[{id:'makeup',seccion_origen_id:'s1',seccion_destino_id:'host',numero_cuenta:'A',numero_semana:2,estado:'asignada',asistencia_reposicion:'Asistio'}];
assert.equal((await call(api.updateBatchGrades,batch([{numero_cuenta:'A',notas:{prueba_1:0,prueba_2:4,manual_topic2:1}}]))).status,200);
fixture.rows.reposiciones_estudiantes[0].asistencia_reposicion='Falta injustificada';
assert.equal((await call(api.updateBatchGrades,batch([{numero_cuenta:'A',notas:{prueba_2:4}}]))).status,409);
assert.equal((await call(api.updateBatchGrades,batch([{numero_cuenta:'A',notas:{manual_topic2:1}}]))).status,409);
assert.equal(await api.hasPracticeAbsence('host','A','Medicina',2),true);
assert.equal(juan.asistencias.asistencia_2,'Falta justificada');
console.log('PASS asistencia y notas: semana de contenido, manuales por ID y alias, dos faltas, reposición asistida y ausente, calificación directa y matrícula original.');

({api,fixture}=setup(true,[],"2026-11-06T17:30:00Z"));
fixture.rows.secciones[0]={id:'s1',carrera:'Medicina',dia:'Viernes',hora_inicio:'11:00',hora_fin:'13:00'};
fixture.rows.configuracion_semanas=[{carrera:'Medicina',numero_semana:1,fecha_inicio:'2026-11-02',fecha_fin:'2026-11-08'}];
const attendanceStudent=fixture.rows.estudiantes_medicina.find(row=>row.id==='a1');
attendanceStudent.asistencias={};attendanceStudent.notas={prueba_2:4};
const attendanceResult=await call(api.saveWeeklyAttendance,{instructor:{id:'admin',rol:'Coordinador'},params:{seccion_id:'s1',semana:'1'},body:{updates:[{numero_cuenta:'A',estado:'Falta injustificada'}]}});
assert.equal(attendanceResult.status,200,JSON.stringify(attendanceResult.body));
assert.equal(attendanceStudent.notas.prueba_1,0);assert.equal(attendanceStudent.notas.prueba_1_real,0);
assert.equal(attendanceStudent.notas.prueba_2,4);
console.log('PASS: pasar lista guarda cero de la práctica ausente sin abrir el portal ni alterar otra prueba.');
