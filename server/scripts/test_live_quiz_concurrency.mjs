// Prueba aislada: no usa la red, las credenciales ni los archivos de datos reales.
import assert from "node:assert/strict";
import vm from "node:vm";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";
import { getAcademicDate } from "../../shared/academicWeek.mjs";
const today = getAcademicDate();
const scheduling = { weeks: [{numero_semana:1,es_examen:false},{numero_semana:2,fecha_inicio:today,fecha_fin:today,es_examen:false}], events: [] };
const quizSection = { id:"isolated-pilot",carrera:"Medicina",dia:["Domingo","Lunes","Martes","Miércoles","Jueves","Viernes","Sábado"][new Date(`${today}T00:00:00Z`).getUTCDay()],hora_inicio:"00:00",hora_fin:"23:59" };

let row;
const deliveries = {};
let pauseWrite = null;
let writeFailure = null;
const clone = value => structuredClone(value);
const database = {
  from(table) {
    let operation = "select", payload, single = false;
    const filters = [];
    const query = {
      select() { return query; },
      eq(key, value) { filters.push([key, value]); return query; },
      maybeSingle() { single = true; return query; },
      update(value) { operation = "update"; payload = clone(value); return query; },
      upsert(value) { operation = "upsert"; payload = clone(value); return query; },
      async then(resolve, reject) {
        try {
          if (table !== "sesiones_pruebas_en_vivo") return resolve({ data: [], error: null });
          if (operation === "select") return resolve({ data: single ? clone(row) : [clone(row)], error: null });
          if (writeFailure) return resolve({ data: null, error: writeFailure });
          if (pauseWrite?.matches(payload)) {
            const paused = pauseWrite;
            pauseWrite = null;
            paused.reached();
            await paused.wait;
          }
          const matches = filters.every(([key, value]) => row[key] === value);
          if (operation === "update" && !matches) return resolve({ data: [], error: null });
          row = { ...row, ...payload };
          return resolve({ data: [{ seccion_id: row.seccion_id }], error: null });
        } catch (error) { return reject(error); }
      }
    };
    return query;
  }
};
const bundle = await build({
  entryPoints: [fileURLToPath(new URL("../src/controllers/liveQuiz.controller.js", import.meta.url))],
  bundle: true, platform: "node", format: "cjs", write: false, logLevel: "silent",
  plugins: [{ name: "isolate-storage", setup(builder) {
    builder.onResolve({ filter: /pruebas\.controller\.js$/ }, () => ({ path: "deliveries", namespace: "pilot" }));
    builder.onResolve({ filter: /db\/supabase\.js$/ }, () => ({ path: "database", namespace: "pilot" }));
    builder.onResolve({ filter: /services\/quizSchedule\.js$/ }, () => ({ path: "scheduling", namespace: "pilot" }));
    builder.onResolve({ filter: /^node:fs$/ }, () => ({ path: "filesystem", namespace: "pilot" }));
    builder.onLoad({ filter: /.*/, namespace: "pilot" }, args => ({ contents: args.path === "deliveries" ? "export const getQuizDeliveryPresence=async()=>globalThis.deliveries;" : args.path === "database"
      ? "export const isSupabaseConfigured=true; export const supabase=globalThis.database;"
      : args.path === "scheduling" ? "export const loadQuizSchedule=async()=>globalThis.scheduling;"
      : "export default { existsSync:()=>false, mkdirSync:()=>{}, writeFileSync:()=>{} };", loader: "js" }));
  }}]
});
function createController() {
const module = { exports: {} };
vm.runInNewContext(bundle.outputFiles[0].text, { module, exports: module.exports, database, deliveries, scheduling, console, process: { cwd: () => path.resolve("server") }, require: key => {
  if (key === "node:path") return path;
  if (key === "node:url") return { fileURLToPath };
  throw new Error(`Unexpected import: ${key}`);
} });
return module.exports;
}
const module = { exports: createController() };
const { controlLiveQuiz, heartbeatLiveQuiz, getLiveQuizState } = module.exports;
const params = { seccion_id: "isolated-pilot", semana: 1 };
function initial() {
  row = { seccion_id: params.seccion_id, numero_semana: 1, estado: "en_pregunta", habilitada: true,
    pregunta_actual_idx: 0, duracion_segundos: 300, pregunta_inicio_timestamp: Date.now(),
    alumnos_conectados: {}, respuestas_globales: {}, updated_at: new Date().toISOString() };
}
async function call(handler, body = {}, expectedCode = 200) {
  let code = 200, result;
  const response = { status(value) { code = value; return response; }, setHeader() {}, json(value) { result = value; return response; } };
  await handler({ params, body, headers: {}, socket: {}, quizSection, quizFullAccess: true }, response);
  assert.equal(code, expectedCode, JSON.stringify(result));
  return result;
}
function pause(matches) {
  let release, reached;
  const wait = new Promise(resolve => { release = resolve; });
  const ready = new Promise(resolve => { reached = resolve; });
  pauseWrite = { matches, wait, reached };
  return { release, ready };
}
async function until(predicate) {
  for (let i = 0; i < 100; i++) {
    if (predicate()) return;
    await new Promise(resolve => setImmediate(resolve));
  }
  assert.fail("La escritura concurrente no terminó");
}

initial();
const delayedHeartbeat = pause(payload => Boolean(payload.alumnos_conectados));
let heartbeatConfirmed = false;
const pendingHeartbeat = call(heartbeatLiveQuiz, { numero_cuenta: "pilot-A", respuestas_parciales: { q1: { a: "respuesta A" } }, pregunta_vista: 0 }).then(result => { heartbeatConfirmed = true; return result; });
await delayedHeartbeat.ready;
assert.equal(heartbeatConfirmed, false, "El latido no se confirma antes de persistirlo");
await call(controlLiveQuiz, { accion: "siguiente_pregunta" });
assert.equal(row.pregunta_actual_idx, 1);
delayedHeartbeat.release();
await pendingHeartbeat;
await until(() => row.respuestas_globales["pilot-A"]);
const independentState = await call(createController().getLiveQuizState);
assert.ok(independentState.data.alumnos_conectados["pilot-A"], "El docente en otra instancia recibe la presencia persistida");
assert.equal(independentState.data.total_conectados, 1);
assert.equal(row.pregunta_actual_idx, 1, "Un latido atrasado no revierte el avance docente");
assert.equal(row.respuestas_globales["pilot-A"].q1.a, "respuesta A");

const firstStudent = pause(payload => Boolean(payload.alumnos_conectados));
const pendingStudent = call(heartbeatLiveQuiz, { numero_cuenta: "pilot-B", respuestas_parciales: { q1: { a: "respuesta B" } } });
await firstStudent.ready;
await call(heartbeatLiveQuiz, { numero_cuenta: "pilot-C", respuestas_parciales: { q1: { a: "respuesta C" } } });
await until(() => row.respuestas_globales["pilot-C"]);
firstStudent.release();
await pendingStudent;
await until(() => row.respuestas_globales["pilot-B"]);
assert.ok(row.respuestas_globales["pilot-C"], "Los alumnos concurrentes conservan ambas respuestas");

row.pregunta_inicio_timestamp = Date.now() - 400000;
const expiredRead = pause(payload => payload.estado === "esperando_siguiente");
const pendingExpiration = call(getLiveQuizState);
await expiredRead.ready;
await call(controlLiveQuiz, { accion: "siguiente_pregunta", duracion_segundos: 300 });
expiredRead.release();
await pendingExpiration;
assert.equal(row.estado, "en_pregunta", "Un vencimiento atrasado no cierra la nueva pregunta");
assert.equal(row.pregunta_actual_idx, 2);
assert.ok(row.respuestas_globales["pilot-A"], "Los comandos docentes conservan las respuestas");
console.log("PASS: latido atrasado, respuestas simultáneas y vencimiento concurrente sin retrocesos ni pérdida de respuestas.");

// Un cliente antiguo no vuelve a activar la protección eliminada.
await call(heartbeatLiveQuiz, { numero_cuenta:"pilot-legacy",integridad:{strikes:3,tiempo_fuera_segundos:8} });
await until(()=>row.alumnos_conectados["pilot-legacy"]);
assert.equal(row.alumnos_conectados["pilot-legacy"].integridad,undefined);
assert.equal(row.alumnos_conectados["pilot-legacy"].ip,undefined);
console.log("PASS: los latidos conservan presencia y respuestas sin recopilar datos anticopias.");
await call(heartbeatLiveQuiz,{numero_cuenta:"pilot-location",pregunta_vista:2,ha_respondido:true,ubicacion:"prueba"});
await until(()=>row.alumnos_conectados["pilot-location"]?.ubicacion==="prueba");
await call(heartbeatLiveQuiz,{numero_cuenta:"pilot-location",pregunta_vista:-1,ubicacion:"portal"});
assert.equal(row.alumnos_conectados["pilot-location"].pregunta_vista,2,"El banner atrasado no reemplaza la presencia dentro de la prueba");
deliveries["pilot-location"]={estado:"enviado",fecha_envio:new Date().toISOString()};
const finalState=await call(getLiveQuizState);
assert.equal(finalState.data.entregas_estudiantes["pilot-location"].estado,"enviado");
assert.equal(Object.hasOwn(finalState.data.entregas_estudiantes["pilot-location"],"respuestas"),false);
console.log("PASS: presencia de prueba no retrocede por banner atrasado; el resumen docente reconoce la entrega sin exponer respuestas.");
row.alumnos_conectados = {};
row.respuestas_globales = {};
row.updated_at = new Date(Date.now() + 1000).toISOString();
const resetState = await call(getLiveQuizState);
assert.equal(Object.keys(resetState.data.alumnos_conectados).length, 0, "Un reinicio remoto no resucita conexiones de la memoria local");
console.log("PASS: un reinicio remoto descarta las conexiones antiguas almacenadas en memoria.");

writeFailure = new Error("Fallo de escritura simulado");
const failedHeartbeat = await call(heartbeatLiveQuiz, { numero_cuenta: "pilot-retry", ubicacion: "prueba" }, 500);
assert.equal(failedHeartbeat.success, false, "No se confirma un latido que no pudo guardarse");
assert.equal(row.alumnos_conectados["pilot-retry"], undefined);
writeFailure = null;
await call(heartbeatLiveQuiz, { numero_cuenta: "pilot-retry", ubicacion: "prueba" });
const recoveredState = await call(createController().getLiveQuizState);
assert.ok(recoveredState.data.alumnos_conectados["pilot-retry"]);
assert.equal(recoveredState.data.total_conectados, 1);
console.log("PASS: fallo de persistencia visible y reintento confirmado desde otra instancia.");
