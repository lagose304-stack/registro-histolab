// Isolated event/permission/history tests: no real accounts or network.
import assert from 'node:assert/strict';
import { observeQuizIntegrity } from '../../client/src/utils/quizIntegrity.mjs';
import { enterQuizFullscreen } from '../../client/src/utils/quizFullscreen.mjs';
import { guardQuizNavigation } from '../../client/src/utils/quizNavigation.mjs';

class Surface {
  listeners = new Map(); hidden = false; focused = true; fullscreenElement = {};
  hasFocus() { return this.focused; }
  addEventListener(type, callback) { if (!this.listeners.has(type)) this.listeners.set(type, new Set()); this.listeners.get(type).add(callback); }
  removeEventListener(type, callback) { this.listeners.get(type)?.delete(callback); }
  emit(type, event = {}) { this.listeners.get(type)?.forEach(callback => callback(event)); }
}
let clock = 0, active = true, submitting = false, departures = [], returns = [], blocked = [], submissions = 0;
const doc = new Surface(), win = new Surface();
const dispose = observeQuizIntegrity({
  document: doc, window: win, now: () => clock, isActive: () => active, isSuppressed: () => submitting,
  onHidden() {}, onVisible() {}, onFullscreen() {}, onReturn: seconds => returns.push(seconds),
  onDeparture: (seconds, type) => { departures.push(type); if (departures.length === 3) { submissions++; submitting = true; } },
  onBlocked: type => blocked.push(type)
});
const hidden = () => { doc.hidden = true; doc.emit('visibilitychange'); };
const visible = () => { doc.hidden = false; doc.emit('visibilitychange'); };
const blur = () => { doc.focused = false; win.emit('blur'); };
const focus = () => { doc.focused = true; win.emit('focus'); };
const fullscreen = value => { doc.fullscreenElement = value ? {} : null; doc.emit('fullscreenchange'); doc.emit('webkitfullscreenchange'); };
blur(); hidden(); fullscreen(false);
assert.deepEqual(departures, ['perdida_de_foco']);
clock += 500; visible(); focus();
assert.equal(departures.length, 1);
blur(); focus(); assert.equal(departures.length, 1, 'Focus alone cannot resume an episode outside fullscreen');
fullscreen(true); assert.equal(returns.length, 1);
hidden(); assert.equal(departures.length, 2, 'Immediate warning, without waiting for return');
clock += 4000; visible(); assert.deepEqual(returns, [1, 4]);
for (const type of ['resize', 'touchstart', 'touchcancel', 'orientationchange', 'keydown']) win.emit(type, {});
assert.equal(departures.length, 2);
fullscreen(false); blur(); hidden();
assert.equal(departures.length, 3); assert.equal(submissions, 1);
assert.equal(departures[2], 'salida_pantalla_completa');
visible(); focus(); fullscreen(true); hidden(); blur(); fullscreen(false);
assert.equal(submissions, 1, 'No duplicate delivery while sealing');
submitting = false; active = false; visible(); focus(); fullscreen(true); blur(); hidden(); fullscreen(false);
assert.equal(departures.length, 3, 'No warnings after the attempt ends');
visible(); focus(); fullscreen(true); active = true;
let prevented = 0;
const event = { target: { closest: () => true }, preventDefault: () => prevented++ };
doc.emit('paste', event); doc.emit('paste', event); assert.equal(prevented, 2); assert.deepEqual(blocked, ['pegar_texto']);
doc.emit('copy', { ...event, target: { closest: () => false } }); assert.equal(blocked.length, 1);
dispose(); blur(); hidden();
assert.equal(departures.length, 3);
assert([...doc.listeners.values(), ...win.listeners.values()].every(list => list.size === 0));

assert.equal(await enterQuizFullscreen({ documentElement: {} }), false);
assert.equal(await enterQuizFullscreen({ documentElement: { requestFullscreen: async () => { throw Error('denied'); } } }), false);
assert.equal(await enterQuizFullscreen({ documentElement: { requestFullscreen: async () => {} } }), false);
const compatible = { documentElement: { async requestFullscreen() { compatible.fullscreenElement = this; } } };
assert.equal(await enterQuizFullscreen(compatible), true);
const webkit = { documentElement: { async webkitRequestFullscreen() { webkit.webkitFullscreenElement = this; } } };
assert.equal(await enterQuizFullscreen(webkit), true);

const browser = new Surface(); browser.location = { href: 'https://example.test/' };
const entries = [{ original: true }]; let index = 0, prompts = 0;
browser.history = {
  get state() { return entries[index]; },
  pushState(state) { entries.splice(++index); entries.push(state); },
  replaceState(state) { entries[index] = state; },
  back() { if (index > 0) { index--; browser.emit('popstate'); } }
};
const release = guardQuizNavigation({ window: browser, onBack: () => prompts++ });
browser.history.back(); browser.history.back();
assert.equal(prompts, 2); assert.equal(entries.length, 2); assert.equal(index, 1);
release(); assert.equal(index, 1); assert.equal(prompts, 2); assert.equal(browser.history.state.original, true);
assert.equal(browser.history.state.histolabQuizGuard.marker, null);
const remount = guardQuizNavigation({ window: browser, onBack: () => prompts++ });
assert.equal(entries.length, 2, 'StrictMode/later attempts reuse the entry without asynchronous Back');
browser.history.back(); assert.equal(prompts, 3); remount();
assert.equal(browser.listeners.get('popstate').size, 0);
console.log('PASS: immediate focus/visibility/fullscreen warnings, one per episode, third-warning single delivery, cleanup, permission failures and repeated Back confirmation.');
