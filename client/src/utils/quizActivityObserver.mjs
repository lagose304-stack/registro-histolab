import { QUIZ_ACTIVITY_LIMIT } from "../../../shared/quizActivity.mjs";
import { createQuizWindowGuard } from "./quizWindowGuard.mjs";

// Revisión del algoritmo, independiente de la versión de la política de faltas.
export const QUIZ_ACTIVITY_OBSERVER_VERSION = 5;

export function usesTouchInput(window) {
  return window.navigator?.maxTouchPoints > 0 ||
    Boolean(window.matchMedia?.("(any-pointer: coarse)")?.matches);
}

// Observa señales del navegador. No intercepta teclas, navegación ni permisos.
export function observeQuizActivity({ window, document, getState, onEvent, isActive, explicitReturn = false, onWindowStatus = () => {}, makeId = () => crypto.randomUUID(), now = () => new Date().toISOString(), nowMs = () => Date.now() }) {
  const guard = createQuizWindowGuard(window, nowMs);
  const windowStatus = () => guard.check(getState()?.ventana_version === 1);
  // En pantallas táctiles el teclado y los controles del sistema pueden tomar el foco.
  const tracksWindowFocus = !usesTouchInput(window);
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
    if (!here() || windowStatus().blocked) return;
    // Agrupar la transición focus/visibility del regreso, sin rearmar entre eventos.
    returnTimer = window.setTimeout(() => {
      const state = getState();
      if (isActive() && here() && !windowStatus().blocked && state.episodio_abierto) onEvent({ id: makeId(), episodio_id: state.episodio_abierto, tipo: "regreso", hora_cliente: now(), senales: [] });
    }, 150);
  };
  const visibility = () => document.visibilityState === "hidden" ? departure("pagina_oculta") : returned();
  const blur = event => {
    if (tracksWindowFocus && event.target === window &&
        document.visibilityState !== "hidden") departure("ventana_sin_foco");
  };
  const pagehide = () => departure("documento_abandonado");
  window.addEventListener("blur", blur);
  window.addEventListener("focus", returned);
  window.addEventListener("pagehide", pagehide);
  window.addEventListener("pageshow", returned);
  document.addEventListener("visibilitychange", visibility);
  // Algunos navegadores cambian el estado sin emitir blur/visibilitychange.
  // El ancho reducido solo aplica a intentos que aceptaron la regla nueva.
  const checkState = () => {
    if (stopped || !isActive()) return;
    const size = windowStatus();
    onWindowStatus(size.blocked);
    if (document.visibilityState === "hidden") departure("pagina_oculta");
    else if (tracksWindowFocus && !document.hasFocus()) departure("ventana_sin_foco");
    else if (size.departure) departure("ventana_reducida");
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
  listen(window.screen?.orientation, "change");
  const stateTimer = window.setInterval(checkState, 500);
  checkState();
  const cleanup = () => {
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
  cleanup.canReturn = () => !windowStatus().blocked;
  return cleanup;
}
