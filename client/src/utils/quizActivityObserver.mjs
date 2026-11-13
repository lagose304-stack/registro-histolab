import { QUIZ_ACTIVITY_LIMIT } from "../../../shared/quizActivity.mjs";

// Observa señales del navegador. No intercepta teclas, navegación ni permisos.
export function observeQuizActivity({ window, document, getState, onEvent, isActive, makeId = () => crypto.randomUUID(), now = () => new Date().toISOString() }) {
  let returnTimer;
  const here = () => document.visibilityState !== "hidden" && document.hasFocus();
  const departure = signal => {
    clearTimeout(returnTimer);
    const state = getState();
    if (!isActive() || state.episodio_abierto || state.faltas >= QUIZ_ACTIVITY_LIMIT) return;
    onEvent({ id: makeId(), episodio_id: makeId(), tipo: "salida", hora_cliente: now(), senales: [signal] });
  };
  const returned = () => {
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
  if (document.visibilityState === "hidden") departure("pagina_oculta");
  else if (!document.hasFocus()) departure("ventana_sin_foco");
  else returned();
  return () => {
    clearTimeout(returnTimer);
    window.removeEventListener("blur", blur);
    window.removeEventListener("focus", returned);
    window.removeEventListener("pagehide", pagehide);
    window.removeEventListener("pageshow", returned);
    document.removeEventListener("visibilitychange", visibility);
  };
}
