// Reglas reales y controlador en vivo aislado: no accede a cuentas ni sesiones reales.
import assert from "node:assert/strict";
import vm from "node:vm";
import path from "node:path";
import { createRequire } from "node:module";
import { build } from "esbuild";
import { getQuizPractice, getQuizWindow, quizzesDueAtPractice } from "../../shared/quizSchedule.mjs";
import { getManualsWindow } from "../../shared/manualsWindow.mjs";
const require=createRequire(import.meta.url);
const section={id:"demo",carrera:"Medicina",dia:"Viernes",hora_inicio:"11:00",hora_fin:"13:00"};
const weeks=[
  {numero_semana:1,fecha_inicio:"2026-11-02",fecha_fin:"2026-11-08",es_examen:false},
  {numero_semana:2,fecha_inicio:"2026-11-09",fecha_fin:"2026-11-15",es_examen:false},
  {numero_semana:3,fecha_inicio:"2026-11-16",fecha_fin:"2026-11-22",es_examen:true},
  {numero_semana:4,fecha_inicio:"2026-11-23",fecha_fin:"2026-11-29",es_examen:false},
  {numero_semana:5,fecha_inicio:"2026-11-30",fecha_fin:"2026-12-06",es_examen:true}
].map(week=>({...week,carrera:"MEDICINA"}));
assert.equal(getQuizPractice(weeks,1).practiceWeek,2);
assert.equal(getQuizPractice(weeks,2).practiceWeek,2);
assert.equal(getQuizPractice(weeks,2).beforeExam,true);
assert.deepEqual(quizzesDueAtPractice(weeks,1),[]);
assert.deepEqual(quizzesDueAtPractice(weeks,2),[1,2]);
assert.deepEqual(quizzesDueAtPractice(weeks,3),[]);
assert.equal(getQuizPractice(weeks,3).practiceWeek,null);
assert.equal(getQuizPractice([{numero_semana:10},{numero_semana:20,es_examen:true}],10).practiceWeek,10);
assert.equal(getQuizPractice([{numero_semana:10},{numero_semana:20}],10).practiceWeek,20);
assert.equal(getQuizPractice([{numero_semana:10}],10).practiceWeek,null);
assert(getQuizWindow(section,weeks,1,new Date("2026-11-13T17:00:00Z")).isOpen);
assert(getQuizWindow(section,weeks,2,new Date("2026-11-13T17:00:00Z")).isOpen);
assert(!getQuizWindow(section,weeks,1,new Date("2026-11-06T17:00:00Z")).isPracticeDay);
assert(!getQuizWindow(section,weeks,2,new Date("2026-11-20T17:00:00Z")).isPracticeDay);
const moved={tipo:"reposicion",carrera:"MEDICINA",seccion_id:"demo",fecha_original:"2026-11-13",fecha:"2026-11-14",hora_inicio:"09:00",hora_fin:"11:00"};
assert(!getQuizWindow(section,weeks,1,new Date("2026-11-13T17:00:00Z"),[moved]).isPracticeDay);
assert(getQuizWindow(section,weeks,1,new Date("2026-11-14T15:00:00Z"),[moved]).isOpen);
assert(!getQuizWindow(section,weeks,1,new Date("2026-11-20T15:00:00Z"),[{...moved,fecha:"2026-11-20"}]).isPracticeDay,"No trasladar una prueba a la semana de examen");
assert(!getManualsWindow(section,weeks,1,new Date("2026-11-06T17:00:00Z")).isOpen);
assert(getManualsWindow(section,weeks,1,new Date("2026-11-13T17:00:00Z")).isOpen);
assert(!getManualsWindow(section,weeks,2,new Date("2026-11-13T17:00:00Z")).isOpen);
assert(getManualsWindow(section,weeks,2,new Date("2026-11-18T16:00:00Z"),[],[{numero_semana:2,fecha_carga:"2026-11-18"}]).isOpen);
let now=Date.parse("2026-11-13T17:30:00Z"),events=[],offline=false;
class Clock extends Date {constructor(...args){super(...(args.length?args:[now]));}static now(){return now;}}
const rows=new Map();
const database={from(table){let single=false,operation="read",payload;const predicates=[];const query={select(){return query;},eq(key,value){predicates.push(row=>String(row[key])===String(value));return query;},or(){return query;},maybeSingle(){single=true;return query;},upsert(value){operation="write";payload=structuredClone(value);return query;},update(value){operation="update";payload=value;return query;},async then(resolve){if(table==="configuracion_semanas")return resolve({data:weeks,error:offline?{message:"offline"}:null});if(table==="agenda_academica")return resolve({data:events,error:null});if(table!=="sesiones_pruebas_en_vivo")return resolve({data:[],error:null});if(operation==="write")rows.set(Number(payload.numero_semana),payload);const data=[...rows.values()].filter(row=>predicates.every(p=>p(row)));if(operation==="update")data.forEach(row=>Object.assign(row,payload));return resolve({data:single?structuredClone(data[0]||null):structuredClone(data),error:null});}};return query;}};
const output=await build({entryPoints:["server/src/controllers/liveQuiz.controller.js"],bundle:true,platform:"node",format:"cjs",write:false,plugins:[{name:"isolated",setup(builder){builder.onResolve({filter:/db\/supabase\.js$/},()=>({path:"db",namespace:"fake"}));builder.onResolve({filter:/^node:fs$/},()=>({path:"fs",namespace:"fake"}));builder.onLoad({filter:/.*/,namespace:"fake"},({path:p})=>({contents:p==="db"?"export const supabase=globalThis.database,isSupabaseConfigured=true;":"export default {existsSync:()=>false,mkdirSync(){},writeFileSync(){}};"}));}}]});
const module={exports:{}};vm.runInNewContext(output.outputFiles[0].text,{module,exports:module.exports,database,Date:Clock,require,console,process:{cwd:()=>path.resolve("server")}});
async function command(week,action="habilitar",full=false){let status=200,payload;const res={status(n){status=n;return this;},json(value){payload=value;return this;}};await module.exports.controlLiveQuiz({params:{seccion_id:"demo",semana:week},instructor:{rol:"Instructor"},body:{accion:action,es_titular:true},quizSection:section,quizFullAccess:full},res);return {status,payload};}
assert.equal((await command(1)).status,200);assert.equal((await command(2)).status,200);
assert.deepEqual([...rows.keys()],[1,2],"Las dos pruebas mantienen sesiones y semanas distintas");
assert.equal((await command(3)).status,403);assert.equal((await command(4)).status,403);
now=Date.parse("2026-11-06T17:30:00Z");assert.equal((await command(1,"habilitar",true)).status,403);
now=Date.parse("2026-11-13T16:59:00Z");assert.equal((await command(1)).status,403,"No confiar en es_titular del cuerpo");assert.equal((await command(1,"habilitar",true)).status,403,"Ser titular no concede la excepción de Creador");
now=Date.parse("2026-11-13T19:01:00Z");assert.equal((await command(1,"iniciar_pregunta")).status,403);assert.equal((await command(1,"siguiente_pregunta")).status,403,"No iniciar otra pregunta fuera de horario sin rol Creador");
now=Date.parse("2026-11-20T17:30:00Z");for(const week of [1,2,3])assert.equal((await command(week,"habilitar",true)).status,403);
assert.equal((await command(1,"finalizar",true)).status,200,"El cierre sigue disponible fuera de fecha");
events=[moved];now=Date.parse("2026-11-14T15:30:00Z");assert.equal((await command(1)).status,200);assert.equal((await command(2)).status,200);
offline=true;assert.equal((await command(1)).status,503);
console.log("PASS: siguiente práctica, dos pruebas antes de examen, ninguna durante examen, claves por semana, reposiciones de horario, límites horarios y permisos efectivos; manuales normales y fecha especial conservados.");
