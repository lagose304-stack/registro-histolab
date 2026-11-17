// Política geométrica de iPad: ancho útil, nunca altura ni contenido de aplicaciones.
export function quizWindowStatus(window) {
  const nav = window.navigator;
  const ipad = /iPad/i.test(nav?.userAgent || "") ||
    (/Mac/i.test(nav?.platform || "") && nav?.maxTouchPoints > 1);
  const screen = window.screen;
  const width = Number(window.innerWidth);
  if (!ipad || !(screen?.width > 0 && screen?.height > 0 && width > 0)) return { supported: false, reduced: false };
  const type = screen.orientation?.type;
  const angle = window.orientation;
  const landscape = type ? type.startsWith("landscape") : typeof angle === "number" ? Math.abs(angle) === 90 : null;
  const expected = landscape === null ? screen.width : landscape ? Math.max(screen.width, screen.height) : Math.min(screen.width, screen.height);
  const view = window.visualViewport;
  // El zoom con los dedos reduce el viewport visual, no el ancho de la ventana.
  const visualWidth = Number(view?.width) * (Number(view?.scale) || 1);
  const actual = visualWidth > 0 ? Math.min(width, visualWidth) : width;
  return { supported: true, reduced: expected - actual > Math.max(32, expected * 0.08), expected, actual,
    orientation: landscape === null ? "unknown" : landscape ? "landscape" : "portrait" };
}

export function createQuizWindowGuard(window, now = () => Date.now()) {
  let orientation, until = 0, reducedSince = null;
  return {
    check(enabled) {
      const status = quizWindowStatus(window);
      if (!enabled || !status.supported) { reducedSince = null; return { ...status, blocked: false, departure: false }; }
      const current = now();
      if (orientation !== undefined && orientation !== status.orientation) { until = current + 1200; reducedSince = null; }
      orientation = status.orientation;
      if (!status.reduced || current < until) reducedSince = null;
      else reducedSince ??= current;
      return { ...status, blocked: status.reduced || current < until,
        departure: reducedSince !== null && current - reducedSince >= 1000 };
    }
  };
}
