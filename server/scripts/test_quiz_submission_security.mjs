import { appendLocalActivity } from "../../shared/quizActivity.mjs";
// Controller integration using isolated in-memory storage only.
import assert from "node:assert/strict";
import vm from "node:vm";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";
import { createRequire } from "node:module";
const require=createRequire(import.meta.url);
const quizzes=[{id:'manual',seccion_id:'s',numero_semana:1,publicada:true,preguntas:[{id:'q',puntos:1,items:[]}]},{id:'auto',seccion_id:'s',numero_semana:2,publicada:true,preguntas:[{id:'q',items:[{id:'a',tipo:'verdadero_falso',instruccion:'Demo',puntos:1,respuesta_correcta:'Verdadero'}]}]}];
let failGradeWrite=false,failSubmissionWrite=false,failDelete=false;const gradeUpdates=[];const rows=[];let live={estado:'en_pregunta'};
const database={rpc(name,args){
  assert(["delete_quiz_submission_with_grade","reopen_quiz_submission"].includes(name));
  const request={setHeader(key,value){assert.equal(key,"x-histolab-grade-actor");assert.equal(value,"actor");return request;},
    then(resolve,reject){return Promise.resolve().then(()=>{
      if(name==="reopen_quiz_submission")return {error:{code:"PGRST202"}};
      if(failDelete)return {error:{code:"WRITE_FAILED"}};
      const index=rows.findIndex(row=>row.id===args.p_id&&row.seccion_id===args.p_section&&row.numero_semana===args.p_week&&row.numero_cuenta===args.p_account);
      return {data:index<0?null:rows.splice(index,1)[0].id};
    }).then(resolve,reject);}
  };
  return request;
},from(table){let operation='read',payload,single=false;const filters=[];const query={select(){return query},eq(key,value){filters.push([key,value]);return query},in(key,values){filters.push([key,values]);return query},maybeSingle(){single=true;return query},insert(value){operation='insert';payload=structuredClone(value);return query},update(value){operation='update';payload=structuredClone(value);return query},async then(resolve){const data=table==='pruebas_semanales'?quizzes:rows;if(operation==='update'){if(failSubmissionWrite)return resolve({error:{code:'WRITE_FAILED'}});const selected=data.filter(row=>filters.every(([key,value])=>(Array.isArray(value)?value.includes(row[key]):row[key]===value)));selected.forEach(row=>{Object.assign(row,payload);if(row.id==='resumed-auto')row.updated_at='2026-11-15T00:00:00.123456Z';});return resolve({data:selected,error:null})}if(operation==='insert'){if(rows.some(row=>row.seccion_id===payload.seccion_id&&row.numero_semana===payload.numero_semana&&row.numero_cuenta===payload.numero_cuenta))return resolve({error:{code:'23505'}});rows.push(payload);return resolve({error:null})}const found=data.filter(row=>filters.every(([key,value])=>(Array.isArray(value)?value.includes(row[key]):row[key]===value)));return resolve({data:single?structuredClone(found[0]||null):structuredClone(found),error:null})}};return query}};
const activityRows=new Map();let failActivity=false;
const recordActivity=async(section,week,student,id,events=[])=>{
 if(failActivity)throw Error('ACTIVITY_WRITE_FAILED');
 const account=student.numero_cuenta;
 const row=activityRows.get(account)||{id,quiz_id:week===1?'manual':'auto',politica:'salidas-tres-faltas-v1',faltas:0,episodio_abierto:null,eventos:[],aceptado_at:new Date().toISOString()};
 const next=appendLocalActivity(row,events);activityRows.set(account,next);return next;
};
const compiled=await build({entryPoints:[fileURLToPath(new URL('../src/controllers/pruebas.controller.js',import.meta.url))],platform:'node',format:'cjs',bundle:true,write:false,logLevel:'silent',plugins:[{name:'isolation',setup(b){b.onResolve({filter:/services\/quizActivity\.js$/},()=>({path:'activity',namespace:'isolate'}));b.onResolve({filter:/db\/supabase\.js$/},()=>({path:'db',namespace:'isolate'}));b.onResolve({filter:/estudiantes\.controller\.js$/},()=>({path:'grades',namespace:'isolate'}));b.onResolve({filter:/liveQuiz\.controller\.js$/},()=>({path:'live',namespace:'isolate'}));b.onResolve({filter:/^node:fs$/},()=>({path:'fs',namespace:'isolate'}));b.onLoad({filter:/.*/,namespace:'isolate'},args=>({contents:args.path==='activity'?'export const recordQuizActivity=(...args)=>globalThis.recordActivity(...args);export const finishQuizActivity=async()=>{};export const beginQuizActivity=async()=>{};export const listQuizActivity=async()=>[];':args.path==='db'?'export const isSupabaseConfigured=true,supabase=globalThis.database;':args.path==='grades'?'export const updateEstudianteGradeDirect=async(...args)=>globalThis.recordGrade(args);':args.path==='live'?'export const getLiveQuizEvidence=async()=>globalThis.getLive();':'export default {existsSync:()=>false,mkdirSync(){},writeFileSync(){}};',loader:'js'}))}}]});
const module={exports:{}};vm.runInNewContext(compiled.outputFiles[0].text,{module,exports:module.exports,require,console,database,gradeUpdates,recordActivity,recordGrade:args=>{if(failGradeWrite)throw Error("GRADE_WRITE_FAILED");gradeUpdates.push(args);},getLive:()=>live,process:{cwd:()=>path.resolve('server')}});
const {submitPruebaEstudiante}=module.exports;
async function submit(account,week,answers={q:{respuesta:'Original'}},audit={},extra={}){let status=200,payload;const req={params:{seccion_id:'s'},student:{numero_cuenta:account},body:{numero_cuenta:account,numero_semana:week,respuestas:answers,actividad_intento_id:'fixture-attempt',...extra,auditoria:{nota_real:999,strikes:999,origen_integridad:'servidor',...audit}}};const res={status(value){status=value;return res},json(value){payload=value;return res}};await submitPruebaEstudiante(req,res);return {status,payload};}
let result=await submit('manual',1);assert.equal(result.status,200);assert.equal(result.payload.data.estado,'enviado');assert(!('strikes' in result.payload.data.auditoria));assert(!('origen_integridad' in result.payload.data.auditoria));
result=await submit('manual',1,{q:{respuesta:'Changed'}});assert.equal(result.status,200);assert.equal(result.payload.data.respuestas.q.respuesta,'Original');
const simultaneous=await Promise.all([submit('race',1,{q:{respuesta:'First'}}),submit('race',1,{q:{respuesta:'Second'}})]);assert(simultaneous.every(item=>item.status===200));assert.equal(rows.filter(row=>row.numero_cuenta==='race').length,1);assert.equal(simultaneous[0].payload.data.respuestas.q.respuesta,simultaneous[1].payload.data.respuestas.q.respuesta);
result=await submit('auto',2,{q:{a:'Verdadero'}});assert.equal(result.payload.data.nota_obtenida,1);assert.equal(result.payload.data.auditoria.nota_real,1);
live={estado:'lobby',alumnos_conectados:{early:{}}};assert.equal((await submit('early',1)).status,409);assert(!rows.some(row=>row.numero_cuenta==='early'));
live.habilitada=true;
assert.equal((await submit('early-normal',1)).status,409);
for (const reason of ['entrega_anticipada_por_salida']) {
  const account=`lobby-${reason}`;
  const first=await submit(account,1,{}, {motivo_finalizacion:reason});
  assert.equal(first.status,200);assert.deepEqual(first.payload.data.respuestas,{});
  const retry=await submit(account,1,{q:{respuesta:'Changed'}},{motivo_finalizacion:reason});
  assert.equal(retry.status,200);assert.deepEqual(retry.payload.data.respuestas,{});
}
assert.equal((await submit('legacy-expulsion',1,{}, {motivo_finalizacion:'expulsion_infracciones'})).status,409);
live.habilitada=false;
assert.equal((await submit('lobby-disabled',1,{}, {motivo_finalizacion:'expulsion_infracciones'})).status,409);
quizzes[0].publicada=false;live={estado:'en_pregunta'};assert.equal((await submit('draft',1)).status,403);
console.log('PASS: entrega manual reintentable e inmutable, carrera concurrente, nota calculada en servidor y rechazo de borradores/entregas antes de iniciar.');

quizzes[0].publicada=true;live={estado:'inactiva',habilitada:false};
result=await submit('closed-pending',1,{q:{respuesta:'Sellada antes de cerrar'}},{motivo_finalizacion:'finalizada_por_docente'});
assert.equal(result.status,200,'Un intento aceptado puede sincronizarse después de cerrar la sala');
assert.equal(result.payload.data.respuestas.q.respuesta,'Sellada antes de cerrar');
result=await submit('closed-pending',1,{q:{respuesta:'No sobrescribir'}});
assert.equal(result.payload.data.respuestas.q.respuesta,'Sellada antes de cerrar');
assert.equal((await submit('closed-no-acceptance',1,{}, {},{actividad_intento_id:undefined})).status,428);
activityRows.set('closed-retired',{id:'retired',quiz_id:'manual',reemplazado_at:new Date().toISOString(),faltas:0,eventos:[]});
assert.equal((await submit('closed-retired',1)).payload.reason,'QUIZ_REOPENED');
activityRows.set('closed-other-quiz',{id:'other',quiz_id:'different',faltas:0,eventos:[]});
assert.equal((await submit('closed-other-quiz',1)).status,409);
live={estado:'en_pregunta'};
console.log('PASS cierre: sincronización pendiente e idempotente, sin aceptar intentos ausentes, retirados o de otra prueba.');

async function grade(account,grade,extra={}) {const row=rows.find(item=>item.numero_cuenta===account);let status=200,payload;await module.exports.calificarEntrega({params:{entrega_id:row.id},body:{nota_obtenida:grade,comentarios:'Comentario del instructor',...extra}},{status(value){status=value;return this},json(value){payload=value;return this}});assert.equal(status,200);return payload.data;}
let graded=await grade('manual',.875,{evaluaciones_incisos:{q___direct:{estado:'regular',puntos_obtenidos:.875}}});
assert.equal(graded.estado,'calificado');assert.equal(graded.nota_obtenida,.875);assert.equal(graded.comentarios,'Comentario del instructor');
assert(gradeUpdates.some(args=>args[1]==='manual'&&args[3]==='prueba_1'&&args[4]===.875));
graded=await grade('auto',5,{evaluaciones_incisos:{q___a:{estado:'mala',puntos_obtenidos:0}}});assert.equal(graded.nota_obtenida,1,'Las correcciones automáticas no se reemplazan al guardar la revisión');
assert(gradeUpdates.some(args=>args[1]==='auto'&&args[3]==='prueba_2'&&args[4]===1));
console.log('PASS: revisión del instructor guarda comentario y milésimas, sincroniza notas y conserva la corrección automática.');

async function gradeFailure(){let status=200,payload;const row=rows.find(item=>item.numero_cuenta==='manual');await module.exports.calificarEntrega({params:{entrega_id:row.id},body:{nota_obtenida:.5}},{status(value){status=value;return this;},json(value){payload=value;return this;}});return {status,payload};}
const writesBeforeFailure=gradeUpdates.length;
failSubmissionWrite=true;
let failed=await gradeFailure();assert(failed.status>=500);assert.equal(failed.payload.success,false);assert.equal(gradeUpdates.length,writesBeforeFailure,'Una entrega no persistida no cambia la ficha académica');
failSubmissionWrite=false;failGradeWrite=true;
failed=await gradeFailure();assert(failed.status>=500);assert.equal(failed.payload.success,false,'No anuncia sincronización si falla la nota de la ficha');
failGradeWrite=false;
await grade('manual',.5,{carrera:'Enfermeria'});
assert(gradeUpdates.some(args=>args[1]==='manual'&&args[2]==='Medicina'&&args[3]==='prueba_1'&&args[4]===.5&&args[5]===true),'Sincroniza estrictamente en la carrera de la entrega, no en una carrera inyectada');
console.log('PASS revisión: errores de guardado/sincronización no devuelven éxito y el reintento conserva cuenta, carrera, semana y sección.');

const actor = { id: "actor", primer_nombre: "Docente", primer_apellido: "Ejemplo" };
const reviewed = rows.find(row => row.numero_cuenta === "auto");
function response() {
  return { code: 200, status(code) { this.code = code; return this; }, json(body) { this.body = body; return this; } };
}
let reply = response();
failGradeWrite = true;
await module.exports.calificarEntrega({
  params: { entrega_id: reviewed.id }, instructor: actor,
  body: { nota_obtenida: 1, instructor_calificador_id: "otro" }
}, reply);
assert.equal(reply.code, 500);
assert.equal(reviewed.instructor_calificador_id, actor.id);
assert.equal(reviewed.calificado_por, "Docente Ejemplo");

failGradeWrite = false;
const retryStart = gradeUpdates.length;
const retried = await submit("auto", 2, { q: { a: "Verdadero" } });
assert.equal(retried.status, 200);
assert.ok(!Object.hasOwn(retried.payload.data, "instructor_calificador_id"));
assert.ok(gradeUpdates.slice(retryStart).some(args => args[3] === "prueba_2" &&
  args[6]?.id === actor.id && args[7]?.id === reviewed.id));

const toDelete = rows.find(row => row.numero_cuenta === "manual");
const deleteRequest = { params: { entrega_id: toDelete.id }, quizSubmission: toDelete, instructor: actor };
failDelete = true;
reply = response();
await module.exports.deleteEntregaEstudiante(deleteRequest, reply);
assert.equal(reply.code, 503);
assert.equal(reply.body.success, false);
assert.ok(rows.includes(toDelete));
failDelete = false;
reply = response();
await module.exports.deleteEntregaEstudiante(deleteRequest, reply);
assert.equal(reply.code, 200);
assert.ok(!rows.includes(toDelete));
console.log("PASS reintento con identidad docente verificada y eliminación sin confirmación falsa.");

// La tercera falta se confirma con el registro del servidor, incluso desde el lobby.
live={estado:'lobby',habilitada:true};quizzes[0].publicada=true;
const uuid=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const departure=(n,ep,tipo='salida')=>({id:uuid(n),episodio_id:uuid(ep),tipo,hora_cliente:new Date().toISOString(),senales:tipo==='salida'?['pagina_oculta']:[],pregunta_indice:0});
const journal=[departure(101,201),departure(102,201,'regreso'),departure(103,202),departure(104,202,'regreso'),departure(105,203)];
result=await submit('third',1,{q:{respuesta:'Exactamente esta respuesta'}},{motivo_finalizacion:'entrega_alumno'},{actividad_eventos_pendientes:journal});
assert.equal(result.status,200);assert.equal(result.payload.data.respuestas.q.respuesta,'Exactamente esta respuesta');
assert.equal(result.payload.data.auditoria.motivo_finalizacion,'limite_tres_faltas');assert.equal(result.payload.data.auditoria.actividad.faltas,3);assert.equal(result.payload.data.auditoria.actividad.eventos.length,5);
result=await submit('third',1,{q:{respuesta:'No reemplazar'}});assert.equal(result.payload.data.respuestas.q.respuesta,'Exactamente esta respuesta');
assert.equal((await submit('missing-acceptance',1,{}, {},{actividad_intento_id:undefined})).status,428);
live={estado:'en_pregunta'};failActivity=true;assert.equal((await submit('journal-failure',1)).status,500);assert(!rows.some(row=>row.numero_cuenta==='journal-failure'));
console.log('PASS: tercera falta en lobby envía respuestas exactas, conserva bitácora, rechaza ausencia de aceptación y no confirma éxito si falla el registro.');

failActivity=false;live={estado:'lobby',habilitada:true};
const graveEvent={...departure(301,401),hora_cliente:new Date(Date.now()-11000).toISOString()};
result=await submit('grave',1,{q:{respuesta:'Respuesta de la falta grave'}},{motivo_finalizacion:'falta_grave_tiempo'},{actividad_eventos_pendientes:[graveEvent]});
assert.equal(result.status,200);assert.equal(result.payload.data.respuestas.q.respuesta,'Respuesta de la falta grave');assert.equal(result.payload.data.auditoria.actividad.falta_grave.plazo_segundos,10);assert.equal(result.payload.data.auditoria.actividad.faltas,1);
assert.equal((await submit('grave-premature',1,{}, {motivo_finalizacion:'falta_grave_tiempo'},{actividad_eventos_pendientes:[departure(302,402)]})).status,409);
assert.equal((await submit('grave-missing',1,{}, {motivo_finalizacion:'falta_grave_tiempo'})).status,409);
console.log('PASS: falta grave tras diez segundos entrega desde lobby con respuestas exactas; no acepta un vencimiento prematuro o sin salida.');

rows.push(
  {seccion_id:'presence-section',numero_semana:9,numero_cuenta:' complete ',estado:'enviado',fecha_envio:'2026-11-13',respuestas:{private:true},nota:100},
  {seccion_id:'presence-section',numero_semana:9,numero_cuenta:'draft',estado:'borrador'},
  {seccion_id:'presence-section',numero_semana:8,numero_cuenta:'other-week',estado:'enviado'},
  {seccion_id:'other-section',numero_semana:9,numero_cuenta:'other-section',estado:'enviado'}
);
const deliveryPresence=await module.exports.getQuizDeliveryPresence('presence-section',9);
assert.deepEqual(JSON.parse(JSON.stringify(deliveryPresence)),{complete:{estado:'enviado',fecha_envio:'2026-11-13'},draft:{estado:'borrador'}});
console.log('PASS: resumen de presencia limitado a sección/semana, entregas y reaperturas sin respuestas ni notas.');

live={estado:'en_pregunta',habilitada:true};
const reopenStamp=new Date(Date.now()-1000).toISOString();
const previousSnapshot={respuestas:{q:{respuesta:'Respuesta previa'}},auditoria:{actividad:{faltas:3}},instructor_calificador_id:'private-teacher'};
rows.push({id:'resumed-delivery',quiz_id:'manual',seccion_id:'s',numero_semana:1,numero_cuenta:'resumed',estado:'borrador',updated_at:reopenStamp,respuestas:previousSnapshot.respuestas,auditoria:{reapertura:{id:'authorization',fecha:reopenStamp,instructor_id:'private-teacher'},reaperturas:[{entrega:previousSnapshot}]}});
activityRows.set('resumed',{id:'old-attempt',quiz_id:'manual',aceptado_at:'2026-01-01',reemplazado_at:reopenStamp,faltas:0,eventos:[]});
assert.equal((await submit('resumed',1)).status,409,'Un intento retirado no sella la prueba reabierta');
activityRows.set('resumed',{id:'new-attempt',quiz_id:'manual',aceptado_at:new Date().toISOString(),faltas:0,eventos:[]});
const resumedRace=await Promise.all([submit('resumed',1,{q:{respuesta:'Primera respuesta recuperada'}}),submit('resumed',1,{q:{respuesta:'Segunda'}})]);
assert(resumedRace.every(item=>item.status===200));
assert.equal(resumedRace[0].payload.data.respuestas.q.respuesta,resumedRace[1].payload.data.respuestas.q.respuesta);
assert.equal(resumedRace[0].payload.data.auditoria.reaperturas,undefined,'El estudiante no recibe el archivo docente');
const savedResumed=rows.find(row=>row.id==='resumed-delivery');
assert.equal(savedResumed.auditoria.reaperturas[0].entrega.auditoria.actividad.faltas,3);
assert.equal(savedResumed.auditoria.actividad.faltas,0);
assert.equal(savedResumed.estado,'enviado');
console.log('PASS reapertura: descarta intento antiguo, nueva entrega única con respuestas conservadas, faltas nuevas y archivo privado intacto.');
rows.push({id:'resumed-auto',quiz_id:'auto',seccion_id:'s',numero_semana:2,numero_cuenta:'resumed-auto',estado:'borrador',updated_at:reopenStamp,auditoria:{reapertura:{fecha:reopenStamp},reaperturas:[{entrega:previousSnapshot}]}});
activityRows.set('resumed-auto',{id:'new-auto-attempt',quiz_id:'auto',aceptado_at:new Date().toISOString(),faltas:0,eventos:[]});
const automaticReopening=await submit('resumed-auto',2,{q:{a:'Verdadero'}});
assert.equal(automaticReopening.status,200);assert.equal(automaticReopening.payload.data.nota_obtenida,1);
assert.equal(automaticReopening.payload.data.updated_at,'2026-11-15T00:00:00.123456Z');
assert.equal(gradeUpdates.at(-1)[7].updated_at,'2026-11-15T00:00:00.123456Z','La nota usa la versión devuelta por el servidor, incluida la precisión de su trigger');
console.log('PASS reapertura automática: nueva calificación sincronizada con la versión real de la entrega.');

const reopenReply=response();
await module.exports.reopenQuizSubmission({params:{seccion_id:'s',semana:1,numero_cuenta:'manual'},instructor:actor,body:{motivo:'Recuperar intento',solicitud_id:uuid(900),version:new Date().toISOString()}},reopenReply);
assert.equal(reopenReply.code,503);
assert.equal(reopenReply.body.reason,'QUIZ_REOPENING_UNAVAILABLE');
assert.match(reopenReply.body.message,/migración/);
console.log('PASS reapertura pendiente de migración: informa el motivo sin borrar ni sustituir la entrega.');
