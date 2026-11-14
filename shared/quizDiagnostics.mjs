export const QUIZ_DIAGNOSTIC_VERSION = 1;
export const QUIZ_DIAGNOSTIC_BATCH_SIZE = 16;
export const QUIZ_DIAGNOSTIC_MAX_BATCHES = 64;
export const QUIZ_DIAGNOSTIC_REASONS = ["inicio", "fin", "blur", "focus", "visibilitychange", "resize", "orientationchange", "pagehide", "pageshow", "focusin", "focusout", "online", "offline", "viewport_resize", "sondeo", "muestra", "freeze", "resume"];
const reasons = new Set(QUIZ_DIAGNOSTIC_REASONS);
const number = (value, max = 16384) => typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= max ? Math.round(value * 100) / 100 : null;
const bool = value => typeof value === "boolean" ? value : null;
const version = value => typeof value === "string" && /^\d{1,3}(\.\d{1,3}){0,3}$/.test(value) ? value : null;

export function diagnosticDevice(navigator = {}) {
  const ua = navigator.userAgent || "";
  const ipad = /iPad/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const browser = [/CriOS\/([\d.]+)/, /FxiOS\/([\d.]+)/, /EdgiOS\/([\d.]+)/, /Edg\/([\d.]+)/, /Chrome\/([\d.]+)/, /Version\/([\d.]+).*Safari/];
  const names = ["Chrome", "Firefox", "Edge", "Edge", "Chrome", "Safari"];
  const index = browser.findIndex(pattern => pattern.test(ua));
  return {
    sistema: ipad ? "iPadOS" : /iPhone|iPod/.test(ua) ? "iOS" : /Android/.test(ua) ? "Android" : /Windows/.test(ua) ? "Windows" : /Mac/.test(ua) ? "macOS" : "Otro",
    version_sistema: version((ua.match(/(?:CPU (?:iPhone )?OS|iPhone OS) ([\d_]+)/)?.[1] || ua.match(/Android ([\d.]+)/)?.[1] || "").replaceAll("_", ".")),
    navegador: index < 0 ? "Otro" : names[index], version_navegador: index < 0 ? null : version(ua.match(browser[index])[1]),
    tactil: Number(navigator.maxTouchPoints) > 0
  };
}

export function normalizeDiagnosticPayload(payload) {
  if (payload?.version !== 1 || !Array.isArray(payload.muestras) || !payload.muestras.length || payload.muestras.length > QUIZ_DIAGNOSTIC_BATCH_SIZE) throw new Error("Lote de diagnóstico inválido.");
  const device = payload.dispositivo || {};
  const muestras = payload.muestras.map(sample => {
    if (!sample || !Array.isArray(sample.motivos) || !sample.motivos.length || sample.motivos.length > 8 || !sample.motivos.every(reason => reasons.has(reason))) throw new Error("Señal de diagnóstico inválida.");
    const date = new Date(sample.hora_cliente);
    if (!Number.isFinite(date.getTime())) throw new Error("Hora de diagnóstico inválida.");
    return {
      motivos: [...new Set(sample.motivos)], hora_cliente: date.toISOString(),
      ...(Number.isInteger(sample.detector_version) && sample.detector_version > 0 && sample.detector_version <= 100 ? {detector_version:sample.detector_version} : {}),
      secuencia: number(sample.secuencia, 10000), pregunta_indice: number(sample.pregunta_indice, 999), faltas_observadas: number(sample.faltas_observadas, 3),
      visible: ["visible", "hidden", "prerender"].includes(sample.visible) ? sample.visible : "desconocida",
      foco: bool(sample.foco), online: bool(sample.online), campo_activo: bool(sample.campo_activo),
      ancho: number(sample.ancho), alto: number(sample.alto), pantalla_ancho: number(sample.pantalla_ancho), pantalla_alto: number(sample.pantalla_alto),
      viewport_ancho: number(sample.viewport_ancho), viewport_alto: number(sample.viewport_alto), viewport_escala: number(sample.viewport_escala, 20),
      viewport_x: number(sample.viewport_x), viewport_y: number(sample.viewport_y),
      orientacion: ["portrait-primary", "portrait-secondary", "landscape-primary", "landscape-secondary"].includes(sample.orientacion) ? sample.orientacion : null
    };
  });
  return {
    version: 1,
    dispositivo: { sistema: ["iPadOS", "iOS", "Android", "Windows", "macOS", "Otro"].includes(device.sistema) ? device.sistema : "Otro", version_sistema: version(device.version_sistema), navegador: ["Chrome", "Firefox", "Edge", "Safari", "Otro"].includes(device.navegador) ? device.navegador : "Otro", version_navegador: version(device.version_navegador), tactil: bool(device.tactil) },
    muestras
  };
}
