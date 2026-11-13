import { hasQuizFullscreen } from './quizFullscreen.mjs';

// Attempt-scoped state machine. Recovery requires an explicit acknowledgment;
// focus/fullscreen event storms cannot rearm the counter behind an open warning.
export function createQuizIntegritySession({ readEnvironment, enabled, onLock, onDeparture, onReturn, now }) {
  let state = 'ready';
  let departureAt = null;
  let disposed = false;
  const safe = () => { const e = readEnvironment(); return e.visible && e.focused && e.fullscreen; };
  const canRespond = () => !disposed && enabled() && state === 'ready' && safe();
  const signal = type => {
    if (disposed || !enabled()) return;
    if (safe()) return;
    if (state !== 'ready') return;
    state = 'blocked';
    departureAt = now();
    onLock(true);
    onDeparture(0, type);
  };
  const resume = () => {
    if (disposed || !enabled() || !safe()) return false;
    const started = departureAt;
    departureAt = null;
    state = 'ready';
    if (started !== null) onReturn(Math.max(0, Math.round((now() - started) / 1000)));
    onLock(false);
    return true;
  };
  return { signal, resume, canRespond, dispose() { disposed = true; state = 'closed'; onLock(false); } };
}

// Browser adapter: no polling, screen-size heuristics, debugger traps or timers.
export function observeQuizIntegrity({ document: doc, window: win, isActive, isSuppressed, requireFullscreen = true,
  onDeparture, onReturn = () => {}, onBlocked, onFullscreen = () => {}, now = () => performance.now() }) {
  let focused = doc.hasFocus?.() ?? true;
  let fullscreen = hasQuizFullscreen(doc);
  let disposed = false;
  const enabled = () => isActive() && !isSuppressed();
  const session = createQuizIntegritySession({
    readEnvironment: () => ({ visible: !doc.hidden, focused, fullscreen: !requireFullscreen || hasQuizFullscreen(doc) }),
    enabled, now, onDeparture, onReturn,
    onLock: locked => {
      if (locked) doc.documentElement?.setAttribute?.('data-quiz-blocked', 'true');
      else doc.documentElement?.removeAttribute?.('data-quiz-blocked');
    }
  });
  let recoveryPending = false;
  let recoverySettling = false;
  let recoverySettlingTimer = null;
  const suppressRecoveryEvent = () => recoveryPending || recoverySettling;
  const visibility = () => {
    focused = doc.hasFocus?.() ?? focused;
    if (suppressRecoveryEvent()) return;
    session.signal('salida_de_pantalla');
  };
  const blur = () => { focused = false; if (!suppressRecoveryEvent()) session.signal('perdida_de_foco'); };
  const focus = () => { focused = true; }; // Never dismiss a warning implicitly.
  const fullscreenChange = () => {
    const current = hasQuizFullscreen(doc);
    const previous = fullscreen;
    fullscreen = current;
    if (current !== previous) onFullscreen(current, previous);
    if (requireFullscreen && !current && previous) session.signal('salida_pantalla_completa');
  };
  const blockedAt = new Map();
  const block = (event, type) => {
    if (!enabled() || !event.target?.closest?.('.quiz-player')) return;
    event.preventDefault();
    const timestamp = now();
    if (timestamp - (blockedAt.get(type) ?? -Infinity) < 2500) return;
    blockedAt.set(type, timestamp);
    onBlocked(type);
  };
  const key = event => {
    if ((event.ctrlKey || event.metaKey) && ['p', 's', 'u'].includes(String(event.key).toLowerCase())) block(event, 'atajo_restringido');
  };
  const listeners = [[doc, 'visibilitychange', visibility], [win, 'blur', blur], [win, 'focus', focus],
    [doc, 'fullscreenchange', fullscreenChange], [doc, 'webkitfullscreenchange', fullscreenChange],
    ...Object.entries({ copy: 'copiar_texto', paste: 'pegar_texto', cut: 'cortar_texto', contextmenu: 'menu_contextual', dragstart: 'arrastrar_contenido' })
      .map(([event, type]) => [doc, event, e => block(e, type)]), [doc, 'keydown', key]];
  listeners.forEach(([target, event, handler]) => target.addEventListener(event, handler, true));
  // `fullscreenchange` does not reliably emit a window `focus` event in every
  // browser. Reaching this method requires the student's explicit click on
  // the recovery control, so it is safe to refresh the cached focus state
  // before asking the state machine to reopen the attempt.
  const resume = () => {
    if (disposed || !enabled()) return false;
    focused = true;
    const result = session.resume();
    recoveryPending = false;
    // Some browsers dispatch a final blur/visibility event just after the
    // fullscreen promise resolves. It belongs to the recovery gesture, not
    // to a new departure, so keep that gesture suppressed through one turn.
    if (result) {
      recoverySettling = true;
      recoverySettlingTimer = setTimeout(() => { recoverySettling = false; recoverySettlingTimer = null; }, 0);
    }
    return result;
  };
  const beginRecovery = () => { if (!disposed && enabled()) recoveryPending = true; };
  const cancelRecovery = () => { recoveryPending = false; };
  const dispose = () => {
    disposed = true;
    if (recoverySettlingTimer !== null) clearTimeout(recoverySettlingTimer);
    listeners.forEach(([target, event, handler]) => target.removeEventListener(event, handler, true));
    session.dispose();
  };
  dispose.resume = resume;
  dispose.beginRecovery = beginRecovery;
  dispose.cancelRecovery = cancelRecovery;
  dispose.canRespond = session.canRespond;
  return dispose;
}
