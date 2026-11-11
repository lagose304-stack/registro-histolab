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
  assert.equal(name,"delete_quiz_submission_with_grade");
  const request={setHeader(key,value){assert.equal(key,"x-histolab-grade-actor");assert.equal(value,"actor");return request;},
    then(resolve,reject){return Promise.resolve().then(()=>{
      if(failDelete)return {error:{code:"WRITE_FAILED"}};
      const index=rows.findIndex(row=>row.id===args.p_id&&row.seccion_id===args.p_section&&row.numero_semana===args.p_week&&row.numero_cuenta===args.p_account);
      return {data:index<0?null:rows.splice(index,1)[0].id};
    }).then(resolve,reject);}
  };
  return request;
},from(table){let operation='read',payload,single=false;const filters=[];const query={select(){return query},eq(key,value){filters.push([key,value]);return query},in(key,values){filters.push([key,values]);return query},maybeSingle(){single=true;return query},insert(value){operation='insert';payload=structuredClone(value);return query},update(value){operation='update';payload=structuredClone(value);return query},async then(resolve){const data=table==='pruebas_semanales'?quizzes:rows;if(operation==='update'){if(failSubmissionWrite)return resolve({error:{code:'WRITE_FAILED'}});const selected=data.filter(row=>filters.every(([key,value])=>(Array.isArray(value)?value.includes(row[key]):row[key]===value)));selected.forEach(row=>Object.assign(row,payload));return resolve({data:selected,error:null})}if(operation==='insert'){if(rows.some(row=>row.seccion_id===payload.seccion_id&&row.numero_semana===payload.numero_semana&&row.numero_cuenta===payload.numero_cuenta))return resolve({error:{code:'23505'}});rows.push(payload);return resolve({error:null})}const found=data.filter(row=>filters.every(([key,value])=>(Array.isArray(value)?value.includes(row[key]):row[key]===value)));return resolve({data:single?structuredClone(found[0]||null):structuredClone(found),error:null})}};return query}};
const compiled=await build({entryPoints:[fileURLToPath(new URL('../src/controllers/pruebas.controller.js',import.meta.url))],platform:'node',format:'cjs',bundle:true,write:false,logLevel:'silent',plugins:[{name:'isolation',setup(b){b.onResolve({filter:/db\/supabase\.js$/},()=>({path:'db',namespace:'isolate'}));b.onResolve({filter:/estudiantes\.controller\.js$/},()=>({path:'grades',namespace:'isolate'}));b.onResolve({filter:/liveQuiz\.controller\.js$/},()=>({path:'live',namespace:'isolate'}));b.onResolve({filter:/^node:fs$/},()=>({path:'fs',namespace:'isolate'}));b.onLoad({filter:/.*/,namespace:'isolate'},args=>({contents:args.path==='db'?'export const isSupabaseConfigured=true,supabase=globalThis.database;':args.path==='grades'?'export const updateEstudianteGradeDirect=async(...args)=>globalThis.recordGrade(args);':args.path==='live'?'export const getLiveQuizEvidence=async()=>globalThis.getLive();':'export default {existsSync:()=>false,mkdirSync(){},writeFileSync(){}};',loader:'js'}))}}]});
const module={exports:{}};vm.runInNewContext(compiled.outputFiles[0].text,{module,exports:module.exports,require,console,database,gradeUpdates,recordGrade:args=>{if(failGradeWrite)throw Error("GRADE_WRITE_FAILED");gradeUpdates.push(args);},getLive:()=>live,process:{cwd:()=>path.resolve('server')}});
const {submitPruebaEstudiante}=module.exports;
async function submit(account,week,answers={q:{respuesta:'Original'}},audit={}){let status=200,payload;const req={params:{seccion_id:'s'},student:{numero_cuenta:account},body:{numero_cuenta:account,numero_semana:week,respuestas:answers,auditoria:{nota_real:999,strikes:999,origen_integridad:'servidor',...audit}}};const res={status(value){status=value;return res},json(value){payload=value;return res}};await submitPruebaEstudiante(req,res);return {status,payload};}
let result=await submit('manual',1);assert.equal(result.status,200);assert.equal(result.payload.data.estado,'enviado');assert.equal(result.payload.data.auditoria.strikes,3);assert.equal(result.payload.data.auditoria.origen_integridad,'declarado_por_cliente_no_prueba_de_fraude');
result=await submit('manual',1,{q:{respuesta:'Changed'}});assert.equal(result.status,200);assert.equal(result.payload.data.respuestas.q.respuesta,'Original');
const simultaneous=await Promise.all([submit('race',1,{q:{respuesta:'First'}}),submit('race',1,{q:{respuesta:'Second'}})]);assert(simultaneous.every(item=>item.status===200));assert.equal(rows.filter(row=>row.numero_cuenta==='race').length,1);assert.equal(simultaneous[0].payload.data.respuestas.q.respuesta,simultaneous[1].payload.data.respuestas.q.respuesta);
result=await submit('auto',2,{q:{a:'Verdadero'}});assert.equal(result.payload.data.nota_obtenida,1);assert.equal(result.payload.data.auditoria.nota_real,1);
live={estado:'lobby',alumnos_conectados:{early:{}}};assert.equal((await submit('early',1)).status,409);assert(!rows.some(row=>row.numero_cuenta==='early'));
live.habilitada=true;
assert.equal((await submit('early-normal',1)).status,409);
for (const reason of ['entrega_anticipada_por_salida','expulsion_infracciones']) {
  const account=`lobby-${reason}`;
  const first=await submit(account,1,{}, {motivo_finalizacion:reason});
  assert.equal(first.status,200);assert.deepEqual(first.payload.data.respuestas,{});
  const retry=await submit(account,1,{q:{respuesta:'Changed'}},{motivo_finalizacion:reason});
  assert.equal(retry.status,200);assert.deepEqual(retry.payload.data.respuestas,{});
}
live.habilitada=false;
assert.equal((await submit('lobby-disabled',1,{}, {motivo_finalizacion:'expulsion_infracciones'})).status,409);
quizzes[0].publicada=false;live={estado:'en_pregunta'};assert.equal((await submit('draft',1)).status,403);
console.log('PASS: entrega manual reintentable e inmutable, carrera concurrente, nota calculada en servidor y rechazo de borradores/entregas antes de iniciar.');

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
