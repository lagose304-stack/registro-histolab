// Piloto HTTP con autenticación, rutas, controladores y archivos locales reales.
// Sustituye únicamente Supabase y las consultas de cuentas/programación por datos ficticios.
// Todos los archivos de la aplicación se redirigen a un directorio temporal nuevo.
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import vm from "node:vm";
import crypto from "node:crypto";
import { createRequire } from "node:module";
import { build } from "esbuild";
import { getAcademicDate } from "../../shared/academicWeek.mjs";
import { createQuizItem } from "../../shared/quizItems.mjs";

const require = createRequire(import.meta.url);
const express = require("express"), jwt = require("jsonwebtoken");
const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "histolab-pilot-25-"));
const secret = crypto.randomBytes(32).toString("hex");
const today = getAcademicDate();
const section = { id: "pilot-section", codigo: "PILOTO", carrera: "Medicina", dia:
  ["Domingo","Lunes","Martes","Miércoles","Jueves","Viernes","Sábado"][new Date(`${today}T00:00:00Z`).getUTCDay()],
  hora_inicio: "00:00", hora_fin: "23:59", coordinador: "Docente Piloto" };
const instructor = { id: "pilot-teacher", rol: "Coordinador", nombre_completo: "Docente Piloto", activo: true,
  current_session_token: "teacher-session", activation_required: false };
const weeks = [{ numero_semana: 1, carrera: "Medicina", es_examen: false, parcial: "I" },
  { numero_semana: 2, carrera: "Medicina", es_examen: false, parcial: "I", fecha_inicio: today, fecha_fin: today }];
const students = Array.from({ length: 25 }, (_, index) => ({ id: `pilot-${index+1}`,
  numero_cuenta: `PILOTO${String(index+1).padStart(2,"0")}`, nombre_completo: `Estudiante ficticio ${index+1}`,
  seccion_id: section.id, carrera: "Medicina", activo: true, auth_user_id: `pilot-auth-${index+1}`,
  correo: `piloto${index+1}@example.invalid`, activation_completed_at: `${today}T00:00:00Z`,
  current_session_token: `session-${index+1}`, notas: {}, asistencias: { asistencia_1: "Asistio" } }));
const read = name => JSON.parse(fs.readFileSync(path.join(dataDir,name),"utf8"));
const write = (name,value) => fs.writeFileSync(path.join(dataDir,name),JSON.stringify(value));
write("estudiantes_data.json",{ estudiantes_medicina:students });
write("secciones_data.json",[section]);
write("semanas_data.json",{MEDICINA:weeks});
write("agenda_academica.json",[]);

const logs = [];
const runtime = { section, weeks, instructor, dataDir,
  readStudent: (account,id) => {
    // La identidad simulada es independiente de la ficha académica pública guardada.
    const identity=students.find(row=>row.numero_cuenta===account && (!id || row.id===id));
    const academic=read("estudiantes_data.json").estudiantes_medicina.find(row=>row.numero_cuenta===account && (!id || row.id===id));
    return identity && academic ? {...identity,...academic} : null;
  },
  storage: { ...fs,
    existsSync: file => fs.existsSync(path.join(dataDir,path.basename(String(file)))),
    readFileSync: (file,...args) => fs.readFileSync(path.join(dataDir,path.basename(String(file))),...args),
    writeFileSync: (file,...args) => fs.writeFileSync(path.join(dataDir,path.basename(String(file))),...args),
    renameSync: (from,to) => fs.renameSync(path.join(dataDir,path.basename(String(from))),path.join(dataDir,path.basename(String(to)))),
    mkdirSync: () => {},
  }
};
const source = `export { default as router } from './server/src/routes/pruebas.routes.js';
  export { authenticateStudent } from './server/src/middlewares/auth.middleware.js';
  export { getEstudianteByCuenta } from './server/src/controllers/estudiantes.controller.js';`;
const bundle = await build({ stdin:{contents:source,resolveDir:process.cwd(),loader:"js"},bundle:true,
  packages:"external",platform:"node",format:"cjs",write:false,logLevel:"silent",plugins:[{name:"isolated-pilot",setup(b){
    b.onResolve({filter:/db\/supabase\.js$/},()=>({path:"database",namespace:"pilot"}));
    b.onResolve({filter:/auth\.controller\.js$/},()=>({path:"accounts",namespace:"pilot"}));
    b.onResolve({filter:/^(node:)?fs$/},()=>({path:"filesystem",namespace:"pilot"}));
    b.onResolve({filter:/^dotenv$/},()=>({path:"dotenv",namespace:"pilot"}));
    b.onResolve({filter:/(secciones|semanas|asignaciones|academicAgenda|manualsSchedule|temario)\.controller\.js$/},
      args=>({path:path.basename(args.path),namespace:"pilot"}));
    b.onLoad({filter:/.*/,namespace:"pilot"},({path:name})=>({contents:
      name==="database" ? "export const supabase=null,isSupabaseConfigured=false;" :
      name==="filesystem" ? "export default globalThis.pilot.storage;" :
      name==="dotenv" ? "export default {config(){}};" :
      name==="accounts" ? `export const getInstructorByIdOrEmail=async id=>id===globalThis.pilot.instructor.id?globalThis.pilot.instructor:null;
        export const getStudentByCuentaAndCarrera=async(account,career,id)=>globalThis.pilot.readStudent(account,id);
        export const getStudentSession=()=>null;` :
      `export const getLocalSchedulingSections=()=>[globalThis.pilot.section];
        export const getLocalSchedulingWeeks=()=>globalThis.pilot.weeks;
        export const buildAcademicWeeks=weeks=>weeks;
        export const getLocalSectionAssignments=()=>[];
        export const getSectionAttendanceEvents=async()=>[];
        export const getManualSchedule=async()=>({});
        export const getLocalAcademicSettings=()=>({topics:[],scores:{nota_total_pruebas:5}});`
    }));
  }}]});
function application() {
  const module={exports:{}};
  vm.runInNewContext(bundle.outputFiles[0].text,{module,exports:module.exports,require,pilot:runtime,
    crypto:globalThis.crypto,TextEncoder,TextDecoder,setTimeout,clearTimeout,
    console:{log(){},warn(...args){logs.push({level:"warning",message:args.map(String).join(" ")});},
      error(...args){logs.push({level:"error",message:args.map(String).join(" ")});}},
    process:{env:{JWT_SECRET:secret},cwd:()=>path.join(dataDir,"runtime")}});
  const api=module.exports, app=express();
  app.use(express.json());
  app.use("/api/pruebas",api.router);
  app.get("/api/pilot/me",api.authenticateStudent,(req,res)=>{
    req.params={numero_cuenta:req.student.numero_cuenta,carrera:req.student.carrera};
    return api.getEstudianteByCuenta(req,res);
  });
  return app;
}
const teacherToken=jwt.sign({id:instructor.id,rol:instructor.rol,session_id:instructor.current_session_token},secret,{expiresIn:"1h"});
const tokens=students.map(student=>jwt.sign({id:student.id,rol:"ESTUDIANTE",numero_cuenta:student.numero_cuenta,
  carrera:student.carrera,session_id:student.current_session_token},secret,{expiresIn:"1h"}));
let server,base;
const timings=[],checks=[];
async function start() { server=await new Promise(resolve=>{const handle=application().listen(0,"127.0.0.1",()=>resolve(handle));});
  base=`http://127.0.0.1:${server.address().port}`; }
async function stop() { if(server){server.closeAllConnections();await new Promise((resolve,reject)=>server.close(error=>error?reject(error):resolve()));server=null;} }
async function request(token,url,{method="GET",body,status=200}={}) {
  const start=performance.now();
  const response=await fetch(base+url,{method,signal:AbortSignal.timeout(15000),headers:{"Content-Type":"application/json",...(token?{Authorization:`Bearer ${token}`}:{})},
    ...(body!==undefined?{body:JSON.stringify(body)}:{})});
  const result=await response.json();
  timings.push({method,url,status:response.status,ms:performance.now()-start});
  assert.equal(response.status,status,`${method} ${url}: ${JSON.stringify(result)}`);
  return result;
}
const quizUrl=`/api/pruebas/seccion/${section.id}`;
const liveUrl=`/api/pruebas/live/${section.id}/1`;
const control=action=>request(teacherToken,liveUrl+"/control",{method:"POST",body:{accion:action,duracion_segundos:180}});
const check=(name)=>{checks.push(name);console.log(`PASS: ${name}`);};
const items=[{...createQuizItem("texto_corto","short"),instruccion:"Identifica la célula",respuesta_modelo:"Fibroblasto"},
  {...createQuizItem("listado","list"),instruccion:"Enumera tres tejidos",cantidad:3,respuestas_esperadas:["Epitelial","Conectivo","Muscular"]},
  {...createQuizItem("completacion","complete"),texto_completar:"El ___ produce ___",respuestas_esperadas:["fibroblasto","colágeno"]},
  {...createQuizItem("seleccion_multiple","choice"),instruccion:"Selecciona la célula",opciones:[{id:"a",texto:"Fibroblasto"},{id:"b",texto:"Neurona"}],respuesta_correcta:"a"},
  {...createQuizItem("verdadero_falso","boolean"),instruccion:"El epitelio es avascular",respuesta_correcta:"Verdadero"},
  {...createQuizItem("terminos_pareados","pairs"),instruccion:"Relaciona los tejidos",pares:[{id:"p1",termino:"Epitelial",definicion:"Revestimiento"},
    {id:"p2",termino:"Conectivo",definicion:"Sostén"},{id:"p3",termino:"Muscular",definicion:"Contracción"}]}];
const questions=items.map((item,index)=>({id:`q${index+1}`,numero:index+1,puntos:1,es_bonus:index===5,items:[item]}));
const milliWeights=[[1000],[334,333,333],[500,500],[1000],[1000],[334,333,333]];
const modelAnswers=[["Fibroblasto"],["Epitelial","Conectivo","Muscular"],["fibroblasto","colágeno"],["Fibroblasto"],["Verdadero"],["Revestimiento","Sostén","Contracción"]];
const cases=students.map((student,index)=>{
  let raw=0,automatic=0;const answers={},evaluations={};
  questions.forEach((question,q)=>{
    const item=items[q];
    const correct=milliWeights[q].map((_,slot)=>index===0 || (index!==1 && (index+q+slot)%3!==0));
    const values=modelAnswers[q].map((answer,slot)=>correct[slot]?answer:"Respuesta incorrecta");
    answers[question.id]={[item.id]:q===1||q===2||q===5?values:values[0]};
    correct.forEach((good,slot)=>{
      const points=good?milliWeights[q][slot]:0;raw+=points;if(q>=3)automatic+=points;
      if(q<3)evaluations[`${question.id}___${item.id}${q===1||q===2?`___slot_${slot}`:""}`]={estado:good?"buena":"mala",puntos_obtenidos:points/1000};
    });
  });
  return {student,answers,evaluations,expectedRaw:raw/1000,expectedOfficial:Math.min(5000,raw)/1000,expectedAutomatic:automatic/1000};
});
let report;
try {
  await start();
  await request(null,quizUrl,{status:401});
  await request(tokens[0],quizUrl.replace(section.id,"other-section"),{status:403});
  await request(tokens[0],quizUrl+"/semana/1/estudiante/"+students[1].numero_cuenta,{status:403});
  await request(tokens[0],liveUrl+"/control",{method:"POST",body:{accion:"habilitar"},status:403});
  check("sesiones firmadas y rechazo de acceso anónimo, otra sección, otro alumno y control docente por alumno");
  const quiz=(await request(teacherToken,quizUrl,{method:"POST",body:{numero_semana:1,carrera:"Medicina",titulo:"Piloto local 25",preguntas:questions,
    publicada:true,estado:"publicada",puntaje_total:5,puntaje_maximo_con_bonus:6,tiempo_por_pregunta_segundos:180}})).data;
  assert(quiz.id);
  const catalogs=await Promise.all(tokens.map(token=>request(token,quizUrl)));
  for(const catalog of catalogs){assert.equal(catalog.data.length,1);const text=JSON.stringify(catalog.data);
    for(const privateKey of ["respuesta_correcta","respuesta_modelo","respuestas_esperadas"])assert(!text.includes(privateKey));}
  check("creación y publicación de una prueba con seis tipos; 25 catálogos sin claves de corrección");
  // Falta de la práctica de contenido: el día de rendición no determina la sanción.
  const absent=read("estudiantes_data.json");absent.estudiantes_medicina[24].asistencias.asistencia_1="Falta injustificada";write("estudiantes_data.json",absent);
  await stop();await start();
  const blocked=await request(tokens[24],quizUrl+"/semana/1",{status:403});assert.equal(blocked.nota,0);
  await request(tokens[24],liveUrl+"/heartbeat",{method:"POST",body:{},status:403});
  const restored=read("estudiantes_data.json");restored.estudiantes_medicina[24].asistencias.asistencia_1="Asistio";write("estudiantes_data.json",restored);
  await stop();await start();
  await control("habilitar");
  await request(tokens[0],quizUrl+"/entregar",{method:"POST",body:{numero_semana:1,respuestas:cases[0].answers,quiz_id:quiz.id},status:409});
  const pulse=(index,q,answers)=>request(tokens[index],liveUrl+"/heartbeat",{method:"POST",body:{numero_cuenta:students[index].numero_cuenta,
    pregunta_vista:q,ha_respondido:true,respuestas_parciales:answers}});
  await Promise.all(tokens.map((_,index)=>pulse(index,-1,{})));
  assert.equal((await request(teacherToken,liveUrl)).data.total_conectados,25);
  check("falta injustificada bloqueada; entrega anticipada rechazada; 25 participantes conectados al lobby");
  await control("iniciar_pregunta_1");
  for(let q=0;q<6;q++){
    const part=Object.fromEntries(questions.slice(0,q+1).map(question=>[question.id,null]));
    await Promise.all(tokens.map((_,index)=>pulse(index,q,Object.fromEntries(Object.keys(part).map(key=>[key,cases[index].answers[key]])))));
    const live=(await request(teacherToken,liveUrl)).data;
    assert.equal(live.total_conectados,25);assert.equal(live.respuestas_recibidas_count,25);assert(live.todos_respondieron);
    for(const test of cases)assert.deepEqual(live.respuestas_globales[test.student.numero_cuenta][questions[q].id],test.answers[questions[q].id]);
    const publicLive=(await request(tokens[q],liveUrl)).data;assert(!("respuestas_globales" in publicLive));assert(!("alumnos_conectados" in publicLive));
    if(q===2){
      await request(teacherToken,liveUrl+"/control",{method:"POST",body:{accion:"iniciar_pregunta",pregunta_idx:q,duracion_segundos:1}});
      await new Promise(resolve=>setTimeout(resolve,1100));
      const expired=(await request(tokens[0],liveUrl)).data;
      assert.equal(expired.estado,"esperando_siguiente");assert.equal(expired.tiempo_restante_segundos,0);
      assert.equal((await request(teacherToken,liveUrl)).data.total_conectados,25);
    }
    if(q<5)await control("siguiente_pregunta");
  }
  // Reconexión: la misma cuenta conserva presencia única y respuestas previas.
  await Promise.all(tokens.slice(0,5).map((_,index)=>pulse(index,5,cases[index].answers)));
  assert.equal((await request(teacherToken,liveUrl)).data.total_conectados,25);
  await control("finalizar");
  check("seis preguntas con 25 respuestas por ronda, vencimiento real del cronómetro, avances docentes, privacidad y cinco reingresos sin pérdida");
  const submissions=await Promise.all(tokens.map((token,index)=>request(token,quizUrl+"/entregar",{method:"POST",body:{numero_semana:1,quiz_id:quiz.id,
    respuestas:cases[index].answers,auditoria:{nota_real:999,calificacion_automatica:{version:999}}}})));
  submissions.forEach((submission,index)=>{
    assert.equal(submission.data.estado,"enviado");assert.equal(submission.data.nota_obtenida,null);
    assert.equal(submission.data.auditoria.puntos_automaticos,cases[index].expectedAutomatic);
    assert.equal(submission.data.auditoria.apartados_pendientes,6);
  });
  // Dos reintentos simultáneos por alumno: no cambian ni duplican su entrega.
  await Promise.all(tokens.flatMap((token,index)=>Array.from({length:2},()=>request(token,quizUrl+"/entregar",{method:"POST",body:{numero_semana:1,quiz_id:quiz.id,
    respuestas:{q1:{short:"Intento de cambiar una respuesta sellada"}}}}).then(result=>{
      assert.equal(result.data.id,submissions[index].data.id);assert.deepEqual(result.data.respuestas,cases[index].answers);
    }))));
  assert.equal(read("pruebas_data.json").entregas.length,25);
  check("25 entregas mixtas, automáticas correctas, pendientes manuales y 50 reintentos sin duplicados ni cambios de respuestas");
  const partial=await request(teacherToken,`/api/pruebas/entregas/${submissions[0].data.id}/calificar`,{method:"PUT",
    body:{nota_obtenida:999,evaluaciones_incisos:{q1___short:cases[0].evaluations.q1___short}}});
  assert.equal(partial.data.estado,"enviado");assert.equal(partial.data.nota_obtenida,null);
  assert.equal(partial.data.auditoria.apartados_pendientes,5);
  assert.equal((await request(tokens[0],"/api/pilot/me")).data.notas.prueba_1,undefined);
  check("revisión manual incompleta conserva cinco pendientes y no publica una nota definitiva");
  // Intentar alterar las automáticas durante la revisión tampoco cambia sus resultados.
  const reviewed=await Promise.all(cases.map((test,index)=>request(teacherToken,`/api/pruebas/entregas/${submissions[index].data.id}/calificar`,{method:"PUT",
    body:{nota_obtenida:999,nota_real:999,comentarios:`Revisión piloto ${index+1}`,evaluaciones_incisos:{...test.evaluations,
      q4___choice:{estado:"buena",puntos_obtenidos:999},q5___boolean:{estado:"buena",puntos_obtenidos:999}}}})));
  reviewed.forEach((result,index)=>{
    assert.equal(result.data.estado,"calificado");assert.equal(result.data.nota_obtenida,cases[index].expectedOfficial);
    assert.equal(result.data.nota_real,cases[index].expectedRaw);assert.equal(result.data.auditoria.apartados_pendientes,0);
  });
  check("25 revisiones completas con notas independientes exactas a tres decimales; bonus y tope oficial de 5 respetados");
  const final=await Promise.all(tokens.map((token,index)=>request(token,quizUrl+`/semana/1/estudiante/${students[index].numero_cuenta}`)));
  const records=await Promise.all(tokens.map(token=>request(token,"/api/pilot/me")));
  final.forEach((result,index)=>{
    assert.equal(result.data.numero_cuenta,students[index].numero_cuenta);assert.equal(result.data.nota_obtenida,cases[index].expectedOfficial);
    assert.deepEqual(result.data.respuestas,cases[index].answers);assert.equal(records[index].data.notas.prueba_1,cases[index].expectedOfficial);
    assert.equal(records[index].data.notas.prueba_1_real,cases[index].expectedRaw);
  });
  check("25 comprobantes y 25 fichas académicas coinciden, sin cruces entre estudiantes");
  const allGrades=(await request(teacherToken,quizUrl+"/todas-entregas")).data;
  assert.equal(allGrades.length,25);
  for(const grade of allGrades){
    const test=cases.find(test=>test.student.numero_cuenta===grade.numero_cuenta);
    assert(test);assert.equal(grade.nota_obtenida,test.expectedOfficial);
    assert(!("respuestas" in grade));assert(!("auditoria" in grade));
  }
  check("resumen docente de 25 resultados sin error y sin exponer respuestas en la consulta de premios");
  await stop();await start();
  const afterRestart=await Promise.all(tokens.map(token=>request(token,"/api/pilot/me")));
  for(let index=0;index<25;index++){
    assert.equal(afterRestart[index].data.notas.prueba_1,cases[index].expectedOfficial);
    const submission=await request(tokens[index],quizUrl+`/semana/1/estudiante/${students[index].numero_cuenta}`);
    assert.equal(submission.data.nota_real,cases[index].expectedRaw);assert.equal(submission.data.estado,"calificado");
  }
  assert.equal(read("pruebas_data.json").entregas.length,25);
  assert.equal(logs.filter(log=>log.level==="error").length,0,JSON.stringify(logs));
  check("reinicio de la aplicación: 25 entregas y sus notas permanecen guardadas en archivos temporales reales");
  const durations=timings.map(row=>row.ms).sort((a,b)=>a-b);
  report={success:true,mode:"HTTP local con archivos temporales reales; consultas de cuentas/programación aisladas; sin Supabase ni proveedor de acceso real",
    participants:25,quizTypes:items.map(item=>item.tipo),checks,requests:timings.length,
    expectedRejections:timings.filter(row=>row.status>=400&&row.status<500).length,unexpectedServerErrors:timings.filter(row=>row.status>=500).length,
    latencyLocalMs:{median:Math.round(durations[Math.floor(durations.length*.5)]),p95:Math.round(durations[Math.floor(durations.length*.95)]),
      note:"Tiempo local del piloto, no es una medición de capacidad de producción."},
    results:cases.map((test,index)=>({cuenta:test.student.numero_cuenta,nota_esperada:test.expectedOfficial,
      nota_oficial:afterRestart[index].data.notas.prueba_1,nota_real:afterRestart[index].data.notas.prueba_1_real,
      nota_real_esperada:test.expectedRaw,estado:"calificado",verificada:true})),
    warnings:logs,limitations:["No valida Supabase, Cloudflare, Google Auth ni redes/dispositivos reales.","No prueba reposiciones individuales, indisponibles en almacenamiento local.",
      "No son 25 navegadores ni una prueba de carga de producción; son 25 sesiones HTTP concurrentes con autenticación y controladores reales."]};
  const reportIndex=process.argv.indexOf("--report");
  if(reportIndex>=0){assert(process.argv[reportIndex+1],"Falta la ruta de --report");const output=path.resolve(process.argv[reportIndex+1]);
    fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,JSON.stringify(report,null,2)+"\n");
    const markdown=["# Piloto local de pruebas: 25 estudiantes", "", "**Resultado: aprobado en almacenamiento local aislado.**", "",
      `Se procesaron ${report.requests} solicitudes HTTP con 25 sesiones autenticadas ficticias. Hubo ${report.expectedRejections} rechazos esperados por controles de acceso y ningún error inesperado del servidor.`, "",
      "Se utilizaron las rutas, autenticación, controladores, calificación y persistencia local de la aplicación. Las consultas de identidad y programación se alimentaron de fixtures; los archivos se guardaron en un directorio temporal nuevo. No se usaron cuentas ni datos reales.", "",
      "## Comprobaciones", "", ...checks.map(name=>`- ${name}.`), "", "## Notas al terminar y reiniciar", "",
      "La nota real incluye el bonus; la oficial tiene un máximo de 5.000 puntos. Las notas esperadas se calcularon antes de enviar las respuestas, con valores en milésimas independientes del calificador de la aplicación.", "",
      "| Estudiante ficticio | Esperada | Oficial guardada | Real con bonus | Coincide |", "| --- | ---: | ---: | ---: | --- |",
      ...report.results.map(row=>`| ${row.cuenta} | ${row.nota_esperada.toFixed(3)} | ${row.nota_oficial.toFixed(3)} | ${row.nota_real.toFixed(3)} | Sí |`), "",
      "## Alcance", "", ...report.limitations.map(item=>`- ${item}`), "",
      "## Repetir el piloto", "", "Desde la raíz del repositorio:", "", "```", "node server/scripts/pilot_quiz_25.mjs --report artifacts/piloto-pruebas-25.json", "```", "",
      "Cada ejecución usa datos temporales nuevos y solo conecta por HTTP a 127.0.0.1. La aplicación se reinicia dentro del piloto para comprobar que las entregas y notas se recuperan del disco.", ""].join("\n");
    fs.writeFileSync(output.replace(/\.json$/,".md"),markdown);console.log(`Informe: ${output}`);}
  console.log(`PILOTO APROBADO: 25 estudiantes, ${timings.length} solicitudes HTTP, cero errores inesperados del servidor.`);
} finally { await stop(); }
