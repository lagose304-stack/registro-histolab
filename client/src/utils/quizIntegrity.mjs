// One warning per departure episode, immediately, throughout the active attempt.
// A single system gesture can emit blur, visibility and fullscreen events together.
export function observeQuizIntegrity({ document: doc, window: win, isActive, isSuppressed, onHidden, onVisible, onDeparture, onReturn = () => {}, onBlocked, onFullscreen, now = () => performance.now() }) {
  let departureAt = null;
  let focused = doc.hasFocus?.() ?? true;
  let hadFullscreen = Boolean(doc.fullscreenElement || doc.webkitFullscreenElement);
  const blockedAt = new Map();
  const depart = type => {
    if (!isActive() || isSuppressed() || departureAt !== null) return;
    departureAt = now();
    onDeparture(0, type);
  };
  const recover = () => {
    if (doc.hidden || !focused || !hadFullscreen) return;
    onVisible();
    if (departureAt !== null) {
      const started = departureAt;
      departureAt = null;
      onReturn(Math.max(0, Math.round((now() - started) / 1000)));
    }
  };
  const visibility = () => {
    if (doc.hidden) {
      if (isActive() && !isSuppressed()) onHidden();
      depart('salida_de_pantalla');
    } else {
      onVisible();
      focused = doc.hasFocus?.() ?? focused;
      recover();
    }
  };
  const blur = () => { focused = false; depart('perdida_de_foco'); };
  const focus = () => { focused = true; visibility(); };
  const fullscreen = () => {
    const current = Boolean(doc.fullscreenElement || doc.webkitFullscreenElement);
    const previous = hadFullscreen;
    hadFullscreen = current;
    if (current !== previous) onFullscreen(current, previous);
    if (previous && !current) depart('salida_pantalla_completa');
    recover();
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
  const listeners = [[doc,'visibilitychange',visibility], [win,'blur',blur], [win,'focus',focus], [doc,'fullscreenchange',fullscreen], [doc,'webkitfullscreenchange',fullscreen], [doc,'copy',copy], [doc,'paste',paste], [doc,'cut',cut], [doc,'contextmenu',context], [doc,'dragstart',drag], [doc,'keydown',key]];
  listeners.forEach(([target,event,handler]) => target.addEventListener(event,handler,true));
  return () => { listeners.forEach(([target,event,handler]) => target.removeEventListener(event,handler,true)); departureAt = null; onVisible(); };
}
