// Solo observación técnica. No llama al contador de faltas ni lee respuestas.
export function diagnosticSnapshot(window, document) {
  const view = window.visualViewport;
  return {
    visible: document.visibilityState, foco: document.hasFocus(), online: window.navigator?.onLine,
    campo_activo: Boolean(document.activeElement?.matches?.("input,textarea,[contenteditable=true]")),
    ancho: window.innerWidth, alto: window.innerHeight, pantalla_ancho: window.screen?.width, pantalla_alto: window.screen?.height,
    viewport_ancho: view?.width ?? null, viewport_alto: view?.height ?? null, viewport_escala: view?.scale ?? null,
    viewport_x: view?.offsetLeft ?? null, viewport_y: view?.offsetTop ?? null, orientacion: window.screen?.orientation?.type ?? null
  };
}

export function observeQuizDiagnostics({ window, document, onSample, isActive, now = () => Date.now() }) {
  let previous = "", last = 0, timeout;
  const removers = [], pending = new Set();
  const sample = (reason, force = false) => {
    if (!force && !isActive()) return;
    const value = diagnosticSnapshot(window, document);
    previous = JSON.stringify(value); last = now();
    onSample({ ...value, motivos: Array.isArray(reason) ? reason : [reason], hora_cliente: new Date(now()).toISOString() });
  };
  const drain = () => { timeout = null; if (pending.size) sample([...pending].slice(0,8)); pending.clear(); };
  const listen = (target, type, name = type) => {
    if (!target?.addEventListener) return;
    const callback = () => {
      if (!isActive()) return;
      pending.add(name);
      if (name === "pagehide" || (name === "visibilitychange" && document.visibilityState === "hidden")) { window.clearTimeout(timeout); drain(); }
      else if (!timeout) timeout = window.setTimeout(drain, 250);
    };
    target.addEventListener(type, callback); removers.push(() => target.removeEventListener(type, callback));
  };
  for (const type of ["blur","focus","resize","orientationchange","pagehide","pageshow","online","offline"]) listen(window,type);
  for (const type of ["visibilitychange","focusin","focusout","freeze","resume"]) listen(document,type);
  listen(window.visualViewport,"resize","viewport_resize");
  listen(window.screen?.orientation,"change","orientationchange");
  sample("inicio");
  const timer = window.setInterval(() => {
    if (!isActive() || pending.size) return;
    if (JSON.stringify(diagnosticSnapshot(window, document)) !== previous) sample("sondeo");
    else if (now() - last >= 30000) sample("muestra");
  }, 1000);
  return () => { window.clearTimeout(timeout); drain(); sample("fin",true); window.clearInterval(timer); removers.forEach(remove=>remove()); };
}
