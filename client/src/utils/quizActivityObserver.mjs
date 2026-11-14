import { QUIZ_ACTIVITY_LIMIT } from "../../../shared/quizActivity.mjs";

// Revisión del algoritmo, independiente de la versión de la política de faltas.
export const QUIZ_ACTIVITY_OBSERVER_VERSION = 3;

// Observa señales del navegador. No intercepta teclas, navegación ni permisos.
export function observeQuizActivity({ window, document, getState, onEvent, isActive, explicitReturn = false, makeId = () => crypto.randomUUID(), now = () => new Date().toISOString() }) {
  let returnTimer;
  let stopped = false;
  const recheckTimers = new Set();
  const here = () => document.visibilityState !== "hidden" && document.hasFocus();
  const departure = signal => {
    clearTimeout(returnTimer);
    const state = getState();
    if (!isActive() || state.episodio_abierto || state.faltas >= QUIZ_ACTIVITY_LIMIT) return;
    onEvent({ id: makeId(), episodio_id: makeId(), tipo: "salida", hora_cliente: now(), senales: [signal] });
  };
  const returned = () => {
    if (explicitReturn) return;
    clearTimeout(returnTimer);
    if (!here()) return;
    // Agrupar la transición focus/visibility del regreso, sin rearmar entre eventos.
    returnTimer = window.setTimeout(() => {
      const state = getState();
      if (isActive() && here() && state.episodio_abierto) onEvent({ id: makeId(), episodio_id: state.episodio_abierto, tipo: "regreso", hora_cliente: now(), senales: [] });
    }, 150);
  };
  const visibility = () => document.visibilityState === "hidden" ? departure("pagina_oculta") : returned();
  const blur = event => { if (event.target === window) departure("ventana_sin_foco"); };
  const pagehide = () => departure("documento_abandonado");
  window.addEventListener("blur", blur);
  window.addEventListener("focus", returned);
  window.addEventListener("pagehide", pagehide);
  window.addEventListener("pageshow", returned);
  document.addEventListener("visibilitychange", visibility);
  // Algunos navegadores cambian el estado sin emitir blur/visibilitychange.
  // El tamaño de ventana, el teclado y la rotación no deciden una falta.
  const checkState = () => {
    if (stopped || !isActive()) return;
    if (document.visibilityState === "hidden") departure("pagina_oculta");
    else if (!document.hasFocus()) departure("ventana_sin_foco");
    else if (getState().episodio_abierto) returned();
  };
  // Volver a consultar cuando la transición del navegador ya se haya asentado.
  // Las ráfagas no aplazan las comprobaciones ni crean colas sin límite.
  const recheck = () => {
    if (stopped || !isActive() || recheckTimers.size) return;
    for (const delay of [0, 200]) {
      const timer = window.setTimeout(() => {
        recheckTimers.delete(timer);
        checkState();
      }, delay);
      recheckTimers.add(timer);
    }
  };
  const removers = [];
  const listen = (target, type) => {
    if (!target?.addEventListener) return;
    target.addEventListener(type, recheck);
    removers.push(() => target.removeEventListener(type, recheck));
  };
  for (const type of ["focusin", "focusout", "pointercancel", "resume"]) listen(document, type);
  for (const type of ["focus", "pageshow", "resize", "orientationchange"]) listen(window, type);
  listen(window.visualViewport, "resize");
  const stateTimer = window.setInterval(checkState, 500);
  if (document.visibilityState === "hidden") departure("pagina_oculta");
  else if (!document.hasFocus()) departure("ventana_sin_foco");
  else returned();
  return () => {
    stopped = true;
    for (const remove of removers) remove();
    for (const timer of recheckTimers) window.clearTimeout(timer);
    recheckTimers.clear();
    window.clearInterval(stateTimer);
    clearTimeout(returnTimer);
    window.removeEventListener("blur", blur);
    window.removeEventListener("focus", returned);
    window.removeEventListener("pagehide", pagehide);
    window.removeEventListener("pageshow", returned);
    document.removeEventListener("visibilitychange", visibility);
  };
}
