// Isolated authorization and payload tests. No real database, file writes or network.
import assert from "node:assert/strict";
import vm from "node:vm";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { build } from "esbuild";
import { studentQuiz, studentLiveState, sanitizeClientAudit } from "../src/middlewares/quizPrivacy.mjs";
import { quizMatchingOptions } from "../../shared/quizItems.mjs";
const require=createRequire(new URL('../package.json',import.meta.url));
const jwt=require('jsonwebtoken');
const question={id:'q1',puntos:1,items:[{id:'choice',tipo:'seleccion_multiple',respuesta_correcta:'a',respuesta_modelo:'SECRET_MODEL',respuestas_esperadas:['SECRET_EXPECTED'],opciones:[{id:'a',texto:'Option A'},{id:'b',texto:'Option B'}]},{id:'pair',tipo:'terminos_pareados',pares:[{id:'p1',termino:'Term A',definicion:'Def A'},{id:'p2',termino:'Term B',definicion:'Def B'}]}]};
const quiz={id:'quiz',publicada:true,numero_semana:1,preguntas:[question],privateKey:'SECRET'};
const clean=studentQuiz(quiz);const encoded=JSON.stringify(clean);
for(const secret of ['respuesta_correcta','respuesta_modelo','respuestas_esperadas','SECRET'])assert(!encoded.includes(secret));
assert.equal(clean.preguntas[0].items[1].pares[0].definicion,undefined);
assert.deepEqual(new Set(quizMatchingOptions(clean.preguntas[0].items[1])),new Set(['Def A','Def B']));
assert.equal(studentQuiz({...quiz,publicada:false}),null);
assert(!('respuestas_globales' in studentLiveState({estado:'lobby',respuestas_globales:{other:'SECRET'},alumnos_conectados:{other:{ip:'PRIVATE'}}})));
const audit=sanitizeClientAudit({strikes:999,calificacion_automatica:{},nota_real:999,incidentes:Array(150).fill({tipo:'event',detalle:'x'.repeat(1000),origen:'servidor'})});
assert.equal(audit.strikes,3);assert.equal(audit.incidentes.length,100);assert.equal(audit.incidentes[0].detalle.length,500);assert.equal(audit.incidentes[0].origen,'cliente_no_verificado');assert(!audit.calificacion_automatica);
const sections=[{id:'s1',coordinador:'Titular Test',instructores_asignados:['manual-only','attendance-only']},{id:'s2',coordinador:'Other'}];
const assignments=[{seccion_id:'s1',tipo_asignacion:'Crear prueba semanal',referencia_id:'semana_1',instructor_id:'creator'},{seccion_id:'s1',tipo_asignacion:'Revisión de prueba semanal',referencia_id:'semana_2',instructor_id:'reviewer'}];
const fixtureDatabase={from(table){const filters=[];let single=false;const query={select(){return query},eq(key,value){filters.push([key,value]);return query},maybeSingle(){single=true;return query},async then(resolve){const source=table==='secciones'?sections:assignments;const data=source.filter(row=>filters.every(([key,value])=>String(row[key])===String(value)));resolve({data:single?(data[0]||null):data,error:null});}};return query}};
const code=await build({entryPoints:[fileURLToPath(new URL('../src/middlewares/quizAccess.middleware.js',import.meta.url))],bundle:true,external:['jsonwebtoken'],platform:'node',format:'cjs',write:false,logLevel:'silent',plugins:[{name:'isolate',setup(b){
  b.onResolve({filter:/auth\.middleware\.js$/},()=>({path:'auth',namespace:'test'}));
  b.onResolve({filter:/db\/supabase\.js$/},()=>({path:'db',namespace:'test'}));
  b.onResolve({filter:/controllers\/(secciones|asignaciones|pruebas)\.controller\.js$/},args=>({path:args.path,namespace:'test'}));
  b.onLoad({filter:/.*/,namespace:'test'},args=>({contents:args.path==='auth'?'export const authenticateStudent=(r,s,n)=>{r.used="student";n()};export const authenticateInstructor=(r,s,n)=>{r.used="instructor";n()};':args.path==='db'?'export const isSupabaseConfigured=globalThis.usingDatabase,supabase=globalThis.database;':args.path.includes('secciones')?'export const getLocalSchedulingSections=()=>globalThis.sections;':args.path.includes('asignaciones')?'export const getLocalSectionAssignments=()=>globalThis.assignments;':'export const getQuizSubmissionForAccess=async()=>({id:"delivery",seccion_id:"s1",numero_semana:2});',loader:'js'}));
}}]});
const module={exports:{}};vm.runInNewContext(code.outputFiles[0].text,{module,exports:module.exports,require,console,sections,assignments,database:fixtureDatabase,usingDatabase:true,crypto:globalThis.crypto});
const {quizAccess,authenticateQuiz}=module.exports;
async function access(options,request,payload,authorize=quizAccess){let status=200,result,next=false;const req={method:'GET',params:{seccion_id:'s1'},headers:{},body:{},...request};const res={setHeader(){},status(code){status=code;return res},json(value){result=value;return res}};await authorize(options)(req,res,()=>next=true);if(next&&payload)res.json(payload);return {status,result,next,req};}
const student={numero_cuenta:'A',seccion_id:'s1',nombre_completo:'Demo',carrera:'Medicina'};
assert.equal((await access({student:true},{req:0,student,params:{seccion_id:'s2'}})).status,403);
assert.equal((await access({student:true},{student,params:{seccion_id:'s1',numero_cuenta:'B'}})).status,403);
assert.equal((await access({student:true},{student,method:'POST',body:{numero_cuenta:'B'}})).status,403);
assert.equal((await access({permission:'create'},{student})).status,403);
assert.equal((await access({student:true},{student}, {success:true,data:[quiz]})).result.data[0].privateKey,undefined);
const bound=await access({student:true,kind:'submission'},{student,method:'POST',body:{nombre_completo:'FORGED',carrera:'OTHER'}});assert(bound.next);assert.equal(bound.req.body.numero_cuenta,'A');assert.equal(bound.req.body.nombre_completo,'Demo');
assert.equal((await access({permission:'create',kind:'control'},{instructor:{id:'creator',rol:'Instructor'},params:{seccion_id:'s1',semana:2}})).status,403);
assert((await access({permission:'create',kind:'control'},{instructor:{id:'creator',rol:'Instructor'},params:{seccion_id:'s1',semana:1}})).next);
assert.equal((await access({permission:'review',submission:true},{instructor:{id:'creator',rol:'Instructor'},params:{entrega_id:'delivery'},body:{seccion_id:'s2'}})).status,403);
assert((await access({permission:'review',submission:true},{instructor:{id:'reviewer',rol:'Instructor'},params:{entrega_id:'delivery'}})).next);
assert((await access({permission:'full'},{instructor:{id:'titular',rol:'Instructor',nombre_completo:'Titular Test'}})).next);
const request={headers:{authorization:'Bearer '+jwt.sign({rol:'ESTUDIANTE'},'test-secret')}};authenticateQuiz(request,{},()=>{});assert.equal(request.used,'student');
console.log('PASS: sin claves de corrección ni datos de compañeros, pareados funcionales, auditoría acotada, cuenta/sección/semana/rol y entrega canónica verificados.');

const instructor = id => ({id,rol:'Instructor'});
assert((await access({permission:'review'},{instructor:instructor('creator'),params:{seccion_id:'s1',semana:1}})).next,'Crear también permite revisar como en la asignación sincronizada de la UI');
assert((await access({permission:'create',kind:'control'},{instructor:instructor('reviewer'),params:{seccion_id:'s1',semana:2}})).next,'La asignación histórica de revisión también permite controlar su semana');
const awardRows=[{id:'e1',numero_cuenta:'A',numero_semana:1,nota_obtenida:5,nota_real:6,respuestas:{secret:'private'},auditoria:{strikes:1}},{id:'e2',numero_cuenta:'A',numero_semana:2,nota_obtenida:0,nota_real:0}];
for (const id of ['manual-only','attendance-only','creator','reviewer']) {
  const awards=await access({permission:'section-read',kind:'awards'},{instructor:instructor(id)},{success:true,data:awardRows});
  assert(awards.next,'El equipo puede consultar la clasificación');assert.equal(awards.result.data.length,2,'Se incluyen todas las semanas');
  assert.equal(awards.result.data[0].nota_real,6);assert.equal(awards.result.data[1].nota_obtenida,0);
  assert(!('respuestas' in awards.result.data[0]));assert(!('auditoria' in awards.result.data[0]));
}
assert.equal((await access({permission:'section-read',kind:'awards'},{instructor:instructor('outsider')})).status,403);
assert.equal((await access({permission:'section-read',kind:'awards'},{student})).status,403);
const emptyCatalog=await access({}, {instructor:instructor('manual-only')},{success:true,data:[quiz]});
assert(emptyCatalog.next);assert.equal(emptyCatalog.result.data.length,0,'Sin asignación de pruebas la UI recibe un catálogo vacío');
assert.equal((await access({permission:'review'},{instructor:instructor('manual-only'),params:{seccion_id:'s1',semana:1}})).status,403);
assignments.push({seccion_id:'s1',tipo_asignacion:'Revisión de prueba semanal',referencia_id:'semana_1',instructor_id:'outdated-reviewer'});
assert.equal((await access({permission:'review'},{instructor:instructor('outdated-reviewer'),params:{seccion_id:'s1',semana:1}})).status,403,'Prevalece el responsable de creación cuando hay datos antiguos en conflicto');
console.log('PASS: premios completos para el equipo sin respuestas privadas, permisos históricos sincronizados y catálogo vacío sin errores para instructores sin pruebas asignadas.');

const localModule={exports:{}};
vm.runInNewContext(code.outputFiles[0].text,{module:localModule,exports:localModule.exports,require,console,sections,assignments,usingDatabase:false,crypto:globalThis.crypto});
const localAccess=localModule.exports.quizAccess;
assert((await access({permission:'create'},{instructor:instructor('reviewer'),params:{seccion_id:'s1',semana:2}},null,localAccess)).next);
const localAwards=await access({permission:'section-read',kind:'awards'},{instructor:instructor('manual-only')},{success:true,data:awardRows},localAccess);
assert(localAwards.next);assert.equal(localAwards.result.data.length,2);assert(!localAwards.result.data[0].respuestas);
console.log('PASS: mismas reglas de acceso con persistencia Supabase y local.');
