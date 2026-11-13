// Component-handler integration without browser, network or real student data.
// Hooks are scheduled in memory; the real portal, integrity and submission code run.
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';
import { build } from 'esbuild';
const source = await readFile('client/src/components/StudentPortalView.jsx', 'utf8');
const icons = source.match(/import\s*\{([^}]+)\}\s*from "lucide-react"/)[1].split(',').map(name => name.trim().split(/\s+as\s+/)[0]);
const compiled = await build({ entryPoints: ['client/src/components/StudentPortalView.jsx'], bundle: true, platform: 'node', format: 'cjs', write: false, logLevel: 'silent', plugins: [{ name: 'isolation', setup(b) {
  b.onResolve({ filter: /^(react|lucide-react)$|services\/api$|utils\/safeStorage$|\.css$|\.png$/ }, args => ({ path: args.path, namespace: 'fixture' }));
  b.onResolve({ filter: /^\.\// }, args => args.importer.endsWith('StudentPortalView.jsx') ? { path: args.path, namespace: 'child' } : undefined);
  b.onLoad({ filter: /.*/, namespace: 'child' }, args => ({ contents: `export default ${JSON.stringify(args.path.slice(2))};`, loader: 'js' }));
  b.onLoad({ filter: /.*/, namespace: 'fixture' }, args => ({ contents: args.path === 'react'
    ? 'const h=globalThis.hooks; export default h; export const {useState,useEffect,useMemo,useCallback,useRef}=h;'
    : args.path === 'lucide-react' ? icons.map(name => `export const ${name}='${name}';`).join('\n')
    : args.path.includes('services/api') ? 'export const api=globalThis.fixtureAPI;'
    : args.path.includes('safeStorage') ? 'export const safeStorage=globalThis.storage;'
    : 'export default "";', loader: 'js' }));
} }] });

class Surface {
  listeners = new Map(); hidden = false; focused = true; fullscreenElement = {};
  addEventListener(type, fn) { if (!this.listeners.has(type)) this.listeners.set(type, new Set()); this.listeners.get(type).add(fn); }
  removeEventListener(type, fn) { this.listeners.get(type)?.delete(fn); }
  emit(type, event = {}) { this.listeners.get(type)?.forEach(fn => fn(event)); }
  hasFocus() { return this.focused; }
}
async function scenario({ phase = 'en_pregunta', offline = false, restore = true, fullscreen = restore } = {}) {
  const student = { id: 'fixture', numero_cuenta: 'fixture', seccion_id: 'section', carrera: 'Medicina', nombre_completo: 'Estudiante aislado', notas: {}, asistencias: {}, seccion: { id: 'section' } };
  const quiz = { id: 'quiz', numero_semana: 1, publicada: true, preguntas: [{ id: 'q', items: [{ id: 'a', tipo: 'texto_corto' }] }] };
  const live = { estado: phase, habilitada: true, pregunta_actual_idx: 0, tiempo_restante_segundos: 90 };
  const map = new Map(), storage = { getItem: key => map.get(key) || null, setItem: (key, value) => map.set(key, value), removeItem: key => map.delete(key), getSession: () => null, setSession() {} };
  if (restore) {
    storage.setItem('histolab_active_quiz_session_fixture', JSON.stringify({ quiz, liveSess: live }));
    storage.setItem('histolab_active_quiz_fixture_sem_1', JSON.stringify({ quiz, quizAnswers: { q: { a: 'Respuesta original' } }, strikes: 0, incidents: [], startTime: Date.now() }));
  }
  const doc = new Surface(), win = new Surface(), sent = [], notices = [], slots = [], pendingEffects = [];
  if (!fullscreen) doc.fullscreenElement = null;
  let cursor = 0, dirty = true, tree, denied = false, exitGuard;
  doc.body = { classList: { add() {}, remove() {} } }; doc.getElementById = () => null;
  doc.documentElement = { requestFullscreen: async () => { if (denied) throw Error('denied'); doc.fullscreenElement = {}; doc.emit('fullscreenchange'); } };
  doc.exitFullscreen = async () => { doc.fullscreenElement = null; doc.emit('fullscreenchange'); };
  const history = [{ original: true }]; let position = 0;
  win.location = { href: 'http://fixture.test/' };
  win.history = { get state() { return history[position]; }, pushState(value) { history.splice(++position); history.push(value); }, replaceState(value) { history[position] = value; }, back() { if (position > 0) { position--; win.emit('popstate'); } } };
  const sameDeps = (a, b) => a && b && a.length === b.length && a.every((value, index) => Object.is(value, b[index]));
  const hooks = {
    createElement: (type, props, ...children) => ({ type, props: { ...props, children } }), Fragment: 'Fragment',
    useState(initial) { const index = cursor++; if (!slots[index]) slots[index] = { value: typeof initial === 'function' ? initial() : initial }; return [slots[index].value, next => { const value = typeof next === 'function' ? next(slots[index].value) : next; if (!Object.is(value, slots[index].value)) { slots[index].value = value; dirty = true; } }]; },
    useRef(initial) { const index = cursor++; return slots[index] ??= { current: initial }; },
    useMemo(fn, deps) { const index = cursor++; if (!slots[index] || !sameDeps(deps, slots[index].deps)) slots[index] = { value: fn(), deps }; return slots[index].value; },
    useCallback(fn, deps) { return hooks.useMemo(() => fn, deps); },
    useEffect(fn, deps) { const index = cursor++; if (!slots[index] || !sameDeps(deps, slots[index].deps)) { const previous = slots[index]; slots[index] = { deps, cleanup: previous?.cleanup }; pendingEffects.push(() => { slots[index].cleanup?.(); slots[index].cleanup = fn(); }); } }
  };
  const ok = data => Promise.resolve({ success: true, data });
  let submission;
  const fixtureAPI = {
    semanas: { getConfig: () => ok([]) }, temario: { getAll: () => ok([]), getPuntajes: () => ok({}) }, estudiantes: { getByCuenta: () => ok(student) },
    pruebas: { getBySeccion: () => ok([quiz]), getLiveState: () => ok(live), getMiEntrega: () => ok(submission || null), getActiveLiveSession: () => ok(null), sendLiveHeartbeat: () => ok(live),
      submit: async (section, payload) => { sent.push(structuredClone(payload)); if (offline) throw Error('isolated offline'); submission = { ...payload, id: 'delivery', estado: 'enviado' }; return { success: true, data: submission }; } }
  };
  const module = { exports: {} };
  vm.runInNewContext(compiled.outputFiles[0].text, { module, exports: module.exports, hooks, fixtureAPI, storage, window: win, document: doc, navigator: { onLine: true }, console, performance, setTimeout: () => 1, clearTimeout() {}, setInterval: () => 1, clearInterval() {} });
  const props = { student, notify: message => notices.push(message), onExitGuardChange: handler => { exitGuard = handler; } };
  async function flush() {
    for (let count = 0; count < 35; count++) {
      if (dirty) { dirty = false; cursor = 0; tree = module.exports.default(props); pendingEffects.splice(0).forEach(fn => fn()); }
      await Promise.resolve();
    }
    assert.equal(dirty, false, 'Portal settles without render loop');
  }
  function walk(node) { if (Array.isArray(node)) return node.flatMap(child => walk(child)); if (!node || typeof node !== 'object') return []; return [node, ...walk(node.props?.children)]; }
  const nodes = () => walk(tree);
  const player = () => nodes().find(node => node.type === 'StudentQuizPlayer');
  const text = node => (Array.isArray(node) ? node.map(text).join('') : typeof node === 'object' && node ? text(node.props?.children) : String(node ?? ''));
  const button = label => { const found = nodes().find(node => node.type === 'button' && text(node).includes(label)); assert(found, `Button: ${label}`); return found; };
  await flush();
  return { doc, win, sent, notices, map, flush, player, button, nodes, quiz, live, setDenied: value => { denied = value; }, exitGuard: () => exitGuard?.() };
}

// Entry denied: no active attempt, no persisted draft.
let fixture = await scenario({ restore: false });
fixture.button('Pruebas semanales').props.onClick(); await fixture.flush(); fixture.setDenied(true);
await fixture.nodes().find(node => node.type === 'StudentQuizzesView').props.onStart(fixture.quiz, fixture.live); await fixture.flush();
assert.equal(fixture.player(), undefined); assert(!fixture.map.has('histolab_active_quiz_session_fixture'));

fixture = await scenario({ fullscreen: false });
assert.equal(fixture.player().props.locked, true);
const gate = () => fixture.nodes().find(node => node.type === 'QuizFullscreenGate');
assert(gate(), 'Restored attempts without fullscreen are gated');
fixture.setDenied(true); await gate().props.onResume(); await fixture.flush(); assert(gate());
fixture.setDenied(false); await gate().props.onResume(); await fixture.flush(); assert.equal(gate(), undefined);
assert.equal(fixture.player().props.answers.q.a, 'Respuesta original');

fixture = await scenario({ phase: 'lobby' });
fixture.player().props.onExit(); await fixture.flush();
fixture.button('Salir y Enviar Respuestas').props.onClick(); await fixture.flush();
assert.equal(fixture.sent.length, 1); assert.equal(fixture.sent[0].auditoria.motivo_finalizacion, 'entrega_anticipada_por_salida');
assert.equal(fixture.sent[0].respuestas.q.a, 'Respuesta original');
assert.equal(fixture.player(), undefined);

// Real portal handlers: Back, fullscreen rejection/cancel, confirmations and send.
fixture = await scenario();
fixture.win.history.back(); await fixture.flush();
assert.equal(fixture.player().props.locked, true);
fixture.setDenied(true); await fixture.doc.exitFullscreen(); await fixture.flush();
assert.equal(fixture.player().props.strikes, 1);
// Return events must not rearm while the first warning is still open.
fixture.setDenied(false); await fixture.doc.documentElement.requestFullscreen();
fixture.doc.focused = true; fixture.win.emit('focus');
fixture.doc.focused = false; fixture.win.emit('blur'); await fixture.flush();
assert.equal(fixture.player().props.strikes, 1, 'No second strike before acknowledgment');
fixture.player().props.onChange('q', 'a', 'Change during warning'); await fixture.flush();
assert.equal(fixture.player().props.answers.q.a, 'Respuesta original');
fixture.doc.focused = true; fixture.win.emit('focus');
fixture.setDenied(true); await fixture.doc.exitFullscreen(); await fixture.flush();

assert(!fixture.nodes().some(node => node.type === 'button' && node.props.children?.includes?.('Salir y Enviar Respuestas')), 'Fullscreen departure shows a violation instead of exit confirmation');
await fixture.button('Volver a pantalla completa').props.onClick(); await fixture.flush();
assert.equal(fixture.player().props.locked, true, 'Denied fullscreen cannot dismiss warning');
fixture.setDenied(false); await fixture.button('Volver a pantalla completa').props.onClick(); await fixture.flush();
assert.equal(fixture.player().props.locked, false);
fixture.player().props.onChange('q', 'a', 'Respuesta conservada'); await fixture.flush();
fixture.exitGuard(); await fixture.flush();
fixture.doc.focused = false; fixture.win.emit('blur'); await fixture.flush();
assert.equal(fixture.player().props.strikes, 2, 'Exit dialog must not suppress warnings');
fixture.doc.focused = true; fixture.win.emit('focus');
await fixture.button('Volver a pantalla completa').props.onClick(); await fixture.flush();
fixture.win.emit('blur'); fixture.doc.hidden = true; fixture.doc.emit('visibilitychange'); await fixture.doc.exitFullscreen(); await fixture.flush();
assert.equal(fixture.sent.length, 0, 'A departure never sends answers automatically');
assert.equal(fixture.player().props.locked, true, 'The attempt stays locked while the security countdown runs');

// Lobby warnings use the same explicit recovery policy and never send answers.
fixture = await scenario({ phase: 'lobby', offline: true });
for (let index = 1; index <= 3; index++) {
  fixture.doc.focused = false; fixture.win.emit('blur'); await fixture.flush();
  if (index < 3) { assert.equal(fixture.player().props.strikes, index); fixture.doc.focused = true; fixture.win.emit('focus'); await fixture.button('Volver a pantalla completa').props.onClick(); await fixture.flush(); }
}
assert.equal(fixture.sent.length, 0);
fixture.player().props.onChange('q', 'a', 'Changed'); await fixture.flush();
assert.equal(fixture.player().props.answers.q.a, 'Respuesta original');
console.log('PASS portal handlers: denied entry, Back confirmation, required fullscreen recovery, no automatic answer delivery after departures, and lobby protection.');
