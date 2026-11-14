import { diagnosticDevice, normalizeDiagnosticPayload, QUIZ_DIAGNOSTIC_BATCH_SIZE } from "../../../shared/quizDiagnostics.mjs";
import { observeQuizDiagnostics } from "./quizDiagnosticsObserver.mjs";
import { QUIZ_ACTIVITY_OBSERVER_VERSION } from "./quizActivityObserver.mjs";

export function startQuizDiagnostics({ window, document, storage, section, week, account, attemptId, api, isActive, getQuestion, getFaults }) {
  if (typeof api.saveDiagnostics !== "function") return () => {};
  const key = `histolab_diagnostic_v1_${account}_${attemptId}`;
  let queue = { registros: [], lote: null, total: 0, lotes: 0 }, sending = false, blocked = false, nextTry = 0, failures = 0;
  try {
    const saved = JSON.parse(storage.getItem(key) || "null");
    if (saved && Date.now() - saved.guardado_at < 86400000 && Array.isArray(saved.registros)) queue = { registros: saved.registros.slice(0,160), lote: saved.lote, total: Math.max(0,Number(saved.total)||0), lotes: Math.max(0,Number(saved.lotes)||0) };
  } catch {}
  const device = diagnosticDevice(window.navigator);
  const persist = () => { try { storage.setItem(key,JSON.stringify({...queue,guardado_at:Date.now()})); } catch {} };
  const flush = async (force = false) => {
    if (sending || blocked || (!force && Date.now() < nextTry)) return;
    sending = true;
    try {
      // La identidad del lote se conserva en disco antes de enviarlo: reintentar no duplica.
      while (queue.lote || queue.registros.length) {
        if (!queue.lote) {
          queue.lote = { id: window.crypto.randomUUID(), datos: normalizeDiagnosticPayload({version:1,dispositivo:device,muestras:queue.registros.splice(0,QUIZ_DIAGNOSTIC_BATCH_SIZE)}) };
          persist();
        }
        const result = await api.saveDiagnostics(section,week,attemptId,queue.lote);
        if (!result?.success) throw new Error("Diagnóstico pendiente");
        queue.lote = null; queue.lotes++;
        if (result.data?.limite || queue.lotes >= 64) { blocked = true; queue.registros = []; }
        failures = 0; nextTry = 0; persist();
        if (blocked) break;
      }
    } catch { failures++; nextTry = Date.now() + Math.min(120000,15000 * 2 ** Math.min(failures-1,3)); persist(); }
    finally { sending = false; }
  };
  const stop = observeQuizDiagnostics({ window, document, isActive, onSample: sample => {
    if (blocked || queue.total >= 640 || queue.registros.length >= 160) return;
    queue.total++;
    // Etiquetar al capturar, nunca al reenviar muestras antiguas de la cola.
    queue.registros.push({...sample,detector_version:QUIZ_ACTIVITY_OBSERVER_VERSION,secuencia:queue.total,pregunta_indice:getQuestion()?.pregunta_indice ?? 0,faltas_observadas:getFaults()});
    persist();
    if (sample.motivos.includes("pagehide") || sample.visible === "hidden") void flush(true);
  }});
  const timer = window.setInterval(() => { void flush(); },15000);
  const online = () => { nextTry = 0; void flush(); };
  window.addEventListener("online",online);
  void flush();
  return () => { stop(); window.clearInterval(timer); window.removeEventListener("online",online); void flush(true); };
}
