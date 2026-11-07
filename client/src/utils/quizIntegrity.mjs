// Only sustained document visibility changes count toward the explicit exam policy.
// Focus, resizing, keyboard, touch gestures and debugger timing cannot prove misconduct.
export const HIDDEN_GRACE_MS = 2000;
export function observeQuizIntegrity({ document: doc, window: win, isActive, isSuppressed, onHidden, onVisible, onDeparture, onBlocked, onFullscreen, now = () => performance.now() }) {
  let hiddenAt = null;
  let hadFullscreen = Boolean(doc.fullscreenElement || doc.webkitFullscreenElement);
  const blockedAt = new Map();
  const visibility = () => {
    if (doc.hidden) {
      if (hiddenAt === null && isActive() && !isSuppressed()) {
        hiddenAt = now();
        onHidden();
      }
    } else {
      const started = hiddenAt;
      hiddenAt = null;
      onVisible();
      if (started !== null && isActive() && !isSuppressed()) {
        const duration = Math.max(0, now() - started);
        if (duration >= HIDDEN_GRACE_MS) onDeparture(Math.round(duration / 1000));
      }
    }
  };
  const fullscreen = () => {
    const current = Boolean(doc.fullscreenElement || doc.webkitFullscreenElement);
    if (current !== hadFullscreen) onFullscreen(current, hadFullscreen);
    hadFullscreen = current;
  };
  const block = (event, type) => {
    if (!isActive() || isSuppressed() || !event.target?.closest?.('.quiz-player')) return;
    event.preventDefault();
    const timestamp = now();
    if (timestamp - (blockedAt.get(type) ?? -Infinity) >= 2500) {
      blockedAt.set(type, timestamp);
      onBlocked(type);
    }
  };
  const copy = event => block(event, 'copiar_texto');
  const paste = event => block(event, 'pegar_texto');
  const cut = event => block(event, 'cortar_texto');
  const context = event => block(event, 'menu_contextual');
  const drag = event => block(event, 'arrastrar_contenido');
  const key = event => {
    if ((event.ctrlKey || event.metaKey) && ['p', 's', 'u'].includes(event.key.toLowerCase())) block(event, 'atajo_restringido');
  };
  const listeners = [[doc,'visibilitychange',visibility], [win,'focus',visibility], [doc,'fullscreenchange',fullscreen], [doc,'webkitfullscreenchange',fullscreen], [doc,'copy',copy], [doc,'paste',paste], [doc,'cut',cut], [doc,'contextmenu',context], [doc,'dragstart',drag], [doc,'keydown',key]];
  listeners.forEach(([target,event,handler]) => target.addEventListener(event,handler,true));
  return () => { listeners.forEach(([target,event,handler]) => target.removeEventListener(event,handler,true)); hiddenAt = null; onVisible(); };
}
