// Real live controller, isolated schedule/storage: no network or student data.
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { build } from 'esbuild';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
import { canBypassQuizSchedule } from '../../shared/instructorRoles.mjs';
for (const role of ['Creador', 'creador', ' CREADOR ']) assert.equal(canBypassQuizSchedule(role), true);
for (const role of ['Coordinador', 'Instructor', 'Titular', 'ESTUDIANTE', 'Admin', undefined, '']) assert.equal(canBypassQuizSchedule(role), false);
let scheduleOpen = false, practiceDay = false, scheduleFails = false, scheduleReads = 0;
const bundle = await build({ entryPoints: ['server/src/controllers/liveQuiz.controller.js'], platform: 'node', format: 'cjs', bundle: true, write: false, logLevel: 'silent', plugins: [{ name: 'isolation', setup(b) {
  b.onResolve({ filter: /db\/supabase\.js$|services\/quizSchedule\.js$|shared\/quizSchedule\.mjs$|^node:fs$/ }, args => ({ path: args.path, namespace: 'fixture' }));
  b.onLoad({ filter: /.*/, namespace: 'fixture' }, args => ({ contents: args.path.includes('db/supabase') ? 'export const isSupabaseConfigured=false,supabase=null;'
    : args.path.includes('services/quizSchedule') ? 'export const loadQuizSchedule=()=>globalThis.loadSchedule();'
    : args.path.includes('shared/quizSchedule') ? 'export const getQuizWindow=()=>globalThis.getWindow();'
    : 'export default {existsSync:()=>false,mkdirSync(){},writeFileSync(){}};', loader: 'js' }));
} }] });
const module = { exports: {} };
vm.runInNewContext(bundle.outputFiles[0].text, {
  module, exports: module.exports, require, console, process: { cwd: () => '/fixture' },
  loadSchedule: async () => { scheduleReads++; if (scheduleFails) throw Error('unconfigured'); return { weeks: [], events: [] }; },
  getWindow: () => ({ isPracticeDay: practiceDay, isOpen: scheduleOpen, reason: 'Fuera de horario' })
});
async function control(role, action, extra = {}) {
  let status = 200, result;
  await module.exports.controlLiveQuiz({ params: { seccion_id: 'isolated', semana: 1 },
    instructor: { id: 'verified', rol: role }, quizSection: { id: 'isolated' }, quizFullAccess: true,
    body: { accion: action, es_titular: true, rol: 'Creador', bypassSchedule: true, ...extra }
  }, { status(value) { status = value; return this; }, json(value) { result = value; return this; } });
  return { status, result };
}
const startActions = ['habilitar', 'iniciar_pregunta_1', 'iniciar_pregunta', 'siguiente_pregunta'];
for (const role of ['Coordinador', 'Instructor', undefined]) {
  for (const action of startActions) assert.equal((await control(role, action)).status, 403, `${role}/${action}: body/full-access cannot bypass`);
}
// Being on the correct day is still insufficient for every non-Creador role.
practiceDay = true;
for (const role of ['Coordinador', 'Instructor']) for (const action of startActions) assert.equal((await control(role, action)).status, 403);
practiceDay = false;
const readsBeforeCreator = scheduleReads;
scheduleFails = true;
for (const action of startActions) assert.equal((await control('Creador', action)).status, 200, `Creador/${action} outside any schedule`);
assert.equal(scheduleReads, readsBeforeCreator, 'Creator exception does not depend on a configured practice date');
assert.equal((await control('Coordinador', 'habilitar')).status, 503, 'A schedule error never grants the exception');
scheduleFails = false; practiceDay = true; scheduleOpen = true;
for (const role of ['Coordinador', 'Instructor']) for (const action of startActions) assert.equal((await control(role, action)).status, 200);
practiceDay = false; scheduleOpen = false;
for (const role of ['Coordinador', 'Instructor']) for (const action of ['finalizar', 'deshabilitar', 'tiempo_agotado']) assert.equal((await control(role, action)).status, 200, 'Finishing/closing must remain possible');
console.log('PASS: only authenticated Creador bypasses live quiz date/time, all start endpoints protected, forged body/full access denied, other roles allowed in schedule and able to close afterward.');
