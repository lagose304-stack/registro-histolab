// Controladores, autorización de pruebas y sincronización reales con persistencia aislada.
import assert from "node:assert/strict";
import { build } from "esbuild";
import vm from "node:vm";
import { createRequire } from "node:module";
import { hasJustifiedAbsence, makeupPractice, sameMakeupProgram } from "../../shared/studentMakeups.mjs";
const require=createRequire(import.meta.url);
let now=Date.parse("2026-11-06T18:00:00Z");
class Clock extends Date { constructor(...args){super(...(args.length?args:[now]));} static now(){return now;} }
const titular={id:"titular",rol:"Instructor",primer_nombre:"Titu",primer_apellido:"Lar"};
const receiver={id:"receiver",rol:"Instructor",primer_nombre:"Recep",primer_apellido:"Tor"};
const admin={id:"admin",rol:"Coordinador"};
const sections=[{id:"origin",codigo:"ORIGEN",carrera:"Medicina",periodo_academico:"III 2026",coordinador:"Titu Lar",dia:"Lunes",hora_inicio:"11:00",hora_fin:"13:00",instructores_asignados:["reader"]},
  {id:"host",codigo:"DESTINO",carrera:"Medicina",periodo_academico:"III 2026",coordinador:"Otra Persona",dia:"Sábado",hora_inicio:"11:00",hora_fin:"13:00",instructores_asignados:["receiver"]},
  {id:"past",codigo:"PASADA",carrera:"Medicina",periodo_academico:"III 2026",dia:"Miércoles",hora_inicio:"11:00",hora_fin:"13:00"},
  {id:"other",codigo:"AJENA",carrera:"Enfermería",periodo_academico:"III 2026",dia:"Sábado",hora_inicio:"11:00",hora_fin:"13:00"}];
const student={numero_cuenta:"DEMO",nombre_completo:"Estudiante aislado",seccion_id:"origin",carrera:"Medicina",activo:true,contrasena:"SECRET",notas:{otra_nota:2},asistencias:{asistencia_1:"Falta justificada"}};
const tables={secciones:sections,estudiantes_medicina:[student,{...student,numero_cuenta:"NO",asistencias:{asistencia_1:"Falta injustificada"}}],
  configuracion_semanas:[{carrera:"MEDICINA",numero_semana:1,fecha_inicio:"2026-11-02",fecha_fin:"2026-11-08",parcial:"I",es_examen:false},{carrera:"MEDICINA",numero_semana:2,fecha_inicio:"2026-11-09",fecha_fin:"2026-11-15",parcial:"I",es_examen:false},{carrera:"MEDICINA",numero_semana:3,fecha_inicio:"2026-11-16",fecha_fin:"2026-11-22",parcial:"I",es_examen:true}],
  temario:[{id:"t1",titulo:"Manual uno",semana:1,carrera:"MEDICINA",tiene_manual:true}],reposiciones_estudiantes:[],fechas_carga_manuales:[],sesiones_pruebas_en_vivo:[],entregas_pruebas:[],asignaciones_instructores:[],
  pruebas_semanales:[{id:"host-quiz",seccion_id:"host",carrera:"Medicina",numero_semana:1,publicada:true,tiempo_por_pregunta_segundos:90,preguntas:[{id:"q",items:[{id:"a",tipo:"verdadero_falso",puntos:5,respuesta_correcta:"Verdadero"}]}]}]};
function split(expression){let depth=0,start=0,result=[];for(let i=0;i<expression.length;i++){if(expression[i]==="(")depth++;if(expression[i]===")")depth--;if(expression[i]===","&&!depth){result.push(expression.slice(start,i));start=i+1;}}return [...result,expression.slice(start)];}
function match(row,expression){if(expression.startsWith("and("))return split(expression.slice(4,-1)).every(part=>match(row,part));if(expression.startsWith("or("))return split(expression.slice(3,-1)).some(part=>match(row,part));const [key,op,...parts]=expression.split(".");const value=parts.join(".");return op==="ilike"?new RegExp("^"+value.replace(/[.*+?^${}()|[\]\\]/g,"\\$&").replaceAll("%",".*")+"$","i").test(row[key]||""):String(row[key])===value;}
const clone=value=>structuredClone(value);
const rpcCalls=[],normalGrades=[];
const database={from(table){const predicates=[];let operation="read",payload,single=false,fields="*",range=null;const query={
  select(value="*"){fields=value;return query;},eq(key,value){predicates.push(row=>String(row[key])===String(value));return query;},in(key,values){predicates.push(row=>values.map(String).includes(String(row[key])));return query;},or(expression){predicates.push(row=>split(expression).some(part=>match(row,part)));return query;},order(){return query;},limit(){return query;},range(start,end){range=[start,end];return query;},maybeSingle(){single=true;return query;},single(){single=true;return query;},insert(value){operation="insert";payload=clone(value);return query;},update(value){operation="update";payload=clone(value);return query;},
  async then(resolve){const source=tables[table]||[];let data=source.filter(row=>predicates.every(predicate=>predicate(row)));if(operation==="insert"){
    if(table==="reposiciones_estudiantes"&&source.some(row=>row.seccion_origen_id===payload.seccion_origen_id&&row.numero_cuenta===payload.numero_cuenta&&row.numero_semana===payload.numero_semana&&["solicitada","asignada","completada"].includes(row.estado)))return resolve({error:{code:"23505"}});
    const row={id:`row-${source.length+1}`,estado:"solicitada",manual_notas:{},notas_aplicadas:{},asistio:false,created_at:new Clock().toISOString(),...payload};source.push(row);data=[row];
  }if(operation==="update")data.forEach(row=>Object.assign(row,payload));const count=data.length;if(range)data=data.slice(range[0],range[1]+1);if(fields!=="*")data=data.map(row=>Object.fromEntries(fields.split(",").filter(key=>key in row).map(key=>[key,row[key]])));resolve({data:clone(single?data[0]||null:data),count,error:null});}
};return query;},rpc(name,payload){
 const headers = {};
 const request = {setHeader(key,value){headers[key]=value;return request;},then(resolve,reject){
 return Promise.resolve().then(()=>database.runRpc(name,payload,headers)).then(resolve,reject);
 }};
 return request;
},runRpc(name,payload,headers){rpcCalls.push({name,payload,headers});
  if(name==="sync_quiz_makeup_grade"){
    const result=database.runRpc("apply_student_makeup",{p_id:payload.p_makeup,p_entrega:payload.p_delivery},headers);
    return {data:!result.error,error:result.error};
  }
  const row=tables.reposiciones_estudiantes.find(row=>row.id===payload.p_id);if(name==="assign_student_makeup"){if(row.estado!=="solicitada")return {error:{code:"P0001",message:"Ya resuelta"}};Object.assign(row,{estado:"asignada",seccion_destino_id:payload.p_destino,destino_codigo:"DESTINO",practica_at:payload.p_practica});}else{const patch=payload.p_manuales||{};if(payload.p_entrega){const sub=tables.entregas_pruebas.find(item=>item.id===payload.p_entrega);patch[`prueba_${row.numero_semana}`]=sub.nota_obtenida;patch[`prueba_${row.numero_semana}_real`]=sub.nota_real??sub.nota_obtenida;}Object.assign(student.notas,patch);Object.assign(row.manual_notas,payload.p_manuales||{});if(payload.p_asistio!=null){row.asistio=payload.p_asistio;row.asistencia_reposicion=payload.p_asistio?'Asistio':'Falta injustificada';student.asistencias['reposicion_'+row.numero_semana]=payload.p_asistio?'Repuso':'No repuso';}}return {data:clone(row),error:null};}};
async function compiled(entry){const output=await build({entryPoints:[entry],bundle:true,platform:"node",format:"cjs",write:false,logLevel:"silent",external:["jsonwebtoken"],plugins:[{name:"isolated",setup(b){
  b.onResolve({filter:/db\/supabase\.js$/},()=>({path:"db",namespace:"mock"}));b.onResolve({filter:/auth\.middleware\.js$/},()=>({path:"auth",namespace:"mock"}));
  b.onResolve({filter:/estudiantes\.controller\.js$/},()=>({path:"students",namespace:"mock"}));b.onResolve({filter:/academicAgenda\.controller\.js$/},()=>({path:"agenda",namespace:"mock"}));
  b.onResolve({filter:/liveQuiz\.controller\.js$/},()=>({path:"live",namespace:"mock"}));b.onResolve({filter:/secciones\.controller\.js$/},()=>({path:"sections",namespace:"mock"}));b.onResolve({filter:/asignaciones\.controller\.js$/},()=>({path:"assignments",namespace:"mock"}));b.onResolve({filter:/^node:fs$/},()=>({path:"fs",namespace:"mock"}));
  if(entry.includes("middleware"))b.onResolve({filter:/pruebas\.controller\.js$/},()=>({path:"submissions",namespace:"mock"}));
  b.onLoad({filter:/.*/,namespace:"mock"},({path:p})=>({contents:({db:"export const supabase=globalThis.database,isSupabaseConfigured=true;",auth:"export const authenticateInstructor=(r,s,n)=>n(),authenticateStudent=(r,s,n)=>n();",students:"export const normalizeCarreraToTable=()=> 'estudiantes_medicina';export const updateEstudianteGradeDirect=async(...a)=>globalThis.normalGrades.push(a);",agenda:"export const getSectionAttendanceEvents=async()=>[];",live:"export const getLiveQuizEvidence=async()=>({estado:'en_pregunta',alumnos_conectados:{}});",sections:"export const getLocalSchedulingSections=()=>[];",assignments:"export const getLocalSectionAssignments=()=>[];",submissions:"export const getQuizSubmissionForAccess=async()=>null;",fs:"export default {existsSync:()=>false,mkdirSync(){},writeFileSync(){}};"})[p]}));
  }}]});const module={exports:{}};vm.runInNewContext(output.outputFiles[0].text,{module,exports:module.exports,database,normalGrades,Date:Clock,require,console,process:{cwd:()=>process.cwd()}});return module.exports;}
const controllers=await compiled("server/src/controllers/studentMakeups.controller.js");
const middleware=await compiled("server/src/middlewares/quizAccess.middleware.js");
const quizzes=await compiled("server/src/controllers/pruebas.controller.js");
async function call(handler,request={}){let status=200,payload,next=false;const req={params:{},query:{},body:{},headers:{},method:"GET",...request};const res={status(n){status=n;return this;},set(){return this;},setHeader(){},json(value){payload=value;return this;}};await handler(req,res,()=>next=true);return {status,get payload(){return payload;},req,res,next};}
const request={seccion_origen_id:"origin",numero_cuenta:"DEMO",numero_semana:1,motivo:"Justificación privada de ejemplo"};
assert(hasJustifiedAbsence(student,tables.configuracion_semanas[0]));assert(!sameMakeupProgram(sections[0],sections[3]));assert(makeupPractice(sections[1],tables.configuracion_semanas,1,[],new Clock()).eligible);
assert.equal((await call(controllers.createStudentMakeup,{instructor:receiver,body:request})).status,403);
assert.equal((await call(controllers.createStudentMakeup,{instructor:titular,body:{...request,numero_cuenta:"NO"}})).status,409);
assert.equal((await call(controllers.createStudentMakeup,{instructor:titular,body:{...request,numero_semana:3}})).status,400);
student.notas["Manual de Manual uno"] = .875;
assert.equal((await call(controllers.createStudentMakeup,{instructor:titular,body:request})).status,409);
delete student.notas["Manual de Manual uno"];
student["Prueba de la semana 1"] = 4;
assert.equal((await call(controllers.createStudentMakeup,{instructor:titular,body:request})).status,409);
delete student["Prueba de la semana 1"];
let result=await call(controllers.createStudentMakeup,{instructor:titular,body:request});assert.equal(result.status,201);const created=result.payload.data;
assert.equal((await call(controllers.createStudentMakeup,{instructor:titular,body:request})).status,409);
assert.equal((await call(controllers.listStudentMakeups,{instructor:titular})).status,403);
result=await call(controllers.getMakeupDestinations,{instructor:admin,params:{id:created.id}});assert.equal(JSON.stringify(result.payload.data.map(row=>row.id)),JSON.stringify(["host"]));
tables.entregas_pruebas.push({id:"already",seccion_id:"host",numero_semana:1});assert.equal((await call(controllers.getMakeupDestinations,{instructor:admin,params:{id:created.id}})).payload.data.length,0);tables.entregas_pruebas.pop();
assert.equal((await call(controllers.resolveStudentMakeup,{instructor:titular,params:{id:created.id},body:{accion:"asignar",seccion_destino_id:"host"}})).status,403);
assert.equal((await call(controllers.resolveStudentMakeup,{instructor:admin,params:{id:created.id},body:{accion:"asignar",seccion_destino_id:"past"}})).status,409);
assert.equal((await call(controllers.resolveStudentMakeup,{instructor:admin,params:{id:created.id},body:{accion:"asignar",seccion_destino_id:"host"}})).status,200);
result=await call(controllers.listStudentMakeups,{instructor:receiver,query:{seccion_id:"host"}});assert.equal(result.payload.data[0].motivo,undefined);
result=await call(controllers.listStudentMakeups,{instructor:receiver,query:{seccion_id:"host",search:"Estudiante"}});assert.equal(result.payload.total,1);
assert.equal((await call(controllers.getMakeupOptions,{instructor:titular,params:{seccion_id:"origin"}})).payload.data.students[0].contrasena,undefined);
let auth=await call(middleware.quizAccess({student:true}),{student,params:{seccion_id:"origin",semana:"1"}});assert(auth.next);assert.equal(auth.req.params.seccion_id,"host");
assert.equal((await call(middleware.quizAccess({student:true}),{student,params:{seccion_id:"host",semana:"1"}})).status,403);
auth=await call(middleware.quizAccess({student:true}),{student,params:{seccion_id:"origin",semana:"2"}});assert(auth.next);assert.equal(auth.req.params.seccion_id,"origin");
auth=await call(middleware.quizAccess({student:true}),{student,params:{seccion_id:"origin"}});auth.res.json({success:true,data:[{id:"origin-quiz",numero_semana:1,publicada:true,preguntas:[]},{id:"second",numero_semana:2,publicada:true,preguntas:[]}]});
assert.equal(auth.payload.data[0].id,"host-quiz");assert.equal(auth.payload.data[0].preguntas[0].items[0].respuesta_correcta,undefined);assert.equal(auth.payload.reposiciones[0].seccion,"DESTINO");assert(!JSON.stringify(auth.payload).includes("Justificación privada"));
now=Date.parse("2026-11-07T18:00:00Z");
// El controlador recibe el destino validado, pero la matrícula autenticada permanece intacta.
auth=await call(middleware.quizAccess({student:true,kind:"submission"}),{method:"POST",student,params:{seccion_id:"origin"},body:{numero_semana:1,numero_cuenta:"DEMO",quiz_id:"host-quiz",respuestas:{q:{a:"Verdadero"}}}});assert(auth.next);
result=await call(quizzes.submitPruebaEstudiante,auth.req);assert.equal(result.status,200);assert.equal(result.payload.data.estado,"calificado");assert.equal(student.notas.prueba_1,5);assert.equal(student.seccion_id,"origin");assert.equal(normalGrades.length,0);assert(rpcCalls.some(call=>call.payload.p_entrega));
now=Date.parse("2026-11-08T18:00:00Z");
assert.equal((await call(controllers.saveReceivingMakeup,{instructor:receiver,params:{id:created.id},body:{manuales:{manual_t1:.875}}})).status,409);
now=Date.parse("2026-11-07T18:00:00Z");assert.equal((await call(controllers.saveReceivingMakeup,{instructor:receiver,params:{id:created.id},body:{asistencia_reposicion:'Asistio'}})).status,200);
assert.equal((await call(controllers.saveReceivingMakeup,{instructor:receiver,params:{id:created.id},body:{manuales:{manual_t1:.625}}})).status,409,"Los manuales se cargan en la siguiente práctica, no durante la reposición");
assert.equal(student.asistencias.asistencia_1,'Falta justificada');assert.equal(student.asistencias.reposicion_1,'Repuso');assert.equal((await call(controllers.saveReceivingMakeup,{instructor:receiver,params:{id:created.id},body:{asistencia_reposicion:'Falta injustificada'}})).status,200);assert.equal(student.asistencias.reposicion_1,'No repuso');assert.equal(student.asistencias.asistencia_1,'Falta justificada');assert.equal((await call(controllers.saveReceivingMakeup,{instructor:receiver,params:{id:created.id},body:{asistencia_reposicion:'Falta justificada'}})).status,400);
now=Date.parse("2026-11-14T18:00:00Z");assert.equal((await call(controllers.saveReceivingMakeup,{instructor:receiver,params:{id:created.id},body:{manuales:{manual_t1:.875}}})).status,200);assert.equal(student.notas.manual_t1,.875);
assert.equal((await call(controllers.saveReceivingMakeup,{instructor:{id:"outsider",rol:"Instructor"},params:{id:created.id},body:{manuales:{manual_t1:1}}})).status,403);
assert.equal((await call(controllers.saveReceivingMakeup,{instructor:receiver,params:{id:created.id},body:{manuales:{manual_t1:1.001}}})).status,400);
assert.equal(student.asistencias.asistencia_1,"Falta justificada");assert.equal(student.seccion_id,"origin");
console.log("PASS: titular y falta justificada, exclusión de exámenes/secciones iniciadas/otras carreras, decisiones administrativas, privacidad, acceso temporal por semana sin cambiar matrícula, prueba receptora y notas sincronizadas a origen, ventanas de asistencia/manuales y rechazo de terceros.");

const makeupGradeCalls = rpcCalls.filter(call => call.name === "apply_student_makeup");
assert.ok(makeupGradeCalls.some(call => call.headers["x-histolab-grade-actor"] === receiver.id));
assert.ok(makeupGradeCalls.some(call => call.payload.p_entrega && !call.headers["x-histolab-grade-actor"]));
