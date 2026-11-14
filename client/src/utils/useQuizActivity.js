import { useCallback, useEffect, useRef, useState } from "react";
import { safeStorage } from "./safeStorage";
import { observeQuizActivity } from "./quizActivityObserver.mjs";
import { startQuizDiagnostics } from "./quizDiagnosticsTransport.mjs";
import { appendLocalActivity, QUIZ_ACTIVITY_POLICY, quizReturnDeadline } from "../../../shared/quizActivity.mjs";

export function useQuizActivity({ quiz, student, api, active, getQuestion, onLimit }) {
  const [state, setState] = useState(null);
  const [error, setError] = useState("");
  const [secondsLeft, setSecondsLeft] = useState(10);
  const current = useRef(null);
  const syncing = useRef(false);
  const callbacks = useRef({});
  callbacks.current = { active, getQuestion, onLimit };
  const keyFor = useCallback(target => `histolab_activity_${student?.id}_${student?.seccion_id}_${student?.numero_cuenta}_${target.id}`, [student?.id, student?.seccion_id, student?.numero_cuenta]);
  const store = useCallback(value => {
    // Guardado síncrono antes de cualquier solicitud; incluye eventos sin confirmar.
    safeStorage.setItem(value.key, JSON.stringify(value));
    current.current = value;
    setState(value);
  }, []);
  const initialize = useCallback(async target => {
    const section = student?.seccion_id || student?.seccion?.id;
    const result = await api.startActivity(section, target.numero_semana, { quiz_id: target.id, politica: QUIZ_ACTIVITY_POLICY, hora_cliente: new Date().toISOString(), diagnostico_version: 1 });
    if (!result?.success) throw new Error(result?.message || "No se pudo registrar la aceptación.");
    const key = keyFor(target);
    let saved;
    try { saved = JSON.parse(safeStorage.getItem(key) || "null"); } catch {}
    const pending = saved?.attempt?.id === result.data.id ? saved.pending || [] : [];
    const attempt = appendLocalActivity(result.data, pending);
    store({ key, section, week: target.numero_semana, quizId: target.id, attempt, pending });
    setError("");
    return attempt;
  }, [api, student, keyFor, store]);
  useEffect(() => {
    if (!quiz) { current.current = null; setState(null); return; }
    try {
      const saved = JSON.parse(safeStorage.getItem(keyFor(quiz)) || "null");
      if (saved?.quizId === quiz.id && saved.attempt?.politica === QUIZ_ACTIVITY_POLICY) { current.current = saved; setState(saved); }
      else { current.current = null; setState(null); }
    } catch { current.current = null; setState(null); }
  }, [quiz?.id, keyFor]);

  const sync = useCallback(async () => {
    const value = current.current;
    if (syncing.current || !value || !value.pending.length) return;
    syncing.current = true;
    try {
      const sent = value.pending;
      const result = await api.saveActivity(value.section, value.week, value.attempt.id, sent);
      if (!result?.success) throw new Error(result?.message || "Registro pendiente");
      if (current.current?.attempt.id !== value.attempt.id) return;
      const pending = current.current.pending.filter(event => !sent.some(row => row.id === event.id));
      store({ ...current.current, attempt: appendLocalActivity(result.data, pending), pending });
      setError("");
    } catch { setError("Registro pendiente de sincronización. Se conserva en este dispositivo."); }
    finally { syncing.current = false; }
  }, [api, store]);
  const ready = Boolean(quiz && state?.quizId === quiz.id);
  const recordEvent = useCallback(event => {
    const value = current.current;
    if (!value || !callbacks.current.active()) return;
    const full = { ...event, ...callbacks.current.getQuestion() };
    const attempt = appendLocalActivity(value.attempt, [full]);
    store({ ...value, attempt, pending: [...value.pending, full] });
    if (attempt.faltas >= 3) callbacks.current.onLimit();
    else sync();
  }, [store, sync]);
  const leave = useCallback(() => {
    if (current.current && !current.current.attempt.episodio_abierto && current.current.attempt.faltas < 3) {
      recordEvent({ id: crypto.randomUUID(), episodio_id: crypto.randomUUID(), tipo: "salida", hora_cliente: new Date().toISOString(), senales: ["salida_del_portal"] });
    }
  }, [recordEvent]);
  const returnToQuiz = useCallback(() => {
    const attempt = current.current?.attempt;
    if (!attempt?.episodio_abierto || !callbacks.current.active()) return;
    if (Date.now() >= quizReturnDeadline(attempt)) { callbacks.current.onLimit("falta_grave_tiempo"); return; }
    if (document.visibilityState === "hidden" || !document.hasFocus()) return;
    recordEvent({ id: crypto.randomUUID(), episodio_id: attempt.episodio_abierto, tipo: "regreso", hora_cliente: new Date().toISOString(), senales: [] });
  }, [recordEvent]);
  const deadline = ready ? quizReturnDeadline(state.attempt) : null;
  useEffect(() => {
    if (!deadline) return;
    const tick = () => {
      const remaining = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
      setSecondsLeft(remaining);
      if (!remaining && callbacks.current.active()) callbacks.current.onLimit("falta_grave_tiempo");
    };
    tick();
    const timer = window.setInterval(tick, 100);
    window.addEventListener("focus", tick);
    document.addEventListener("visibilitychange", tick);
    return () => { clearInterval(timer); window.removeEventListener("focus", tick); document.removeEventListener("visibilitychange", tick); };
  }, [deadline]);
  useEffect(() => {
    if (ready) initialize(quiz).catch(() => setError("No se pudo verificar el contador del servidor. Se reintentará al sincronizar."));
  }, [quiz?.id, ready]);
  useEffect(() => {
    if (!ready) return;
    sync();
    const timer = window.setInterval(sync, 2500);
    window.addEventListener("online", sync);
    return () => { window.clearInterval(timer); window.removeEventListener("online", sync); };
  }, [ready, sync]);
  useEffect(() => {
    if (!ready) return;
    return observeQuizActivity({ window, document,
      explicitReturn: true,
      isActive: () => callbacks.current.active(),
      getState: () => current.current.attempt,
      onEvent: recordEvent
    });
  }, [ready, recordEvent]);
  // Diagnóstico independiente, únicamente para intentos con el aviso nuevo aceptado.
  useEffect(() => {
    if (!ready || state?.attempt?.diagnostico_version !== 1) return;
    const value=current.current;
    return startQuizDiagnostics({ window, document, storage:safeStorage, section:value.section, week:value.week,
      account:student?.numero_cuenta, attemptId:value.attempt.id, api,
      isActive:()=>callbacks.current.active(), getQuestion:()=>callbacks.current.getQuestion(), getFaults:()=>current.current?.attempt.faltas ?? 0 });
  }, [ready, state?.attempt?.id, state?.attempt?.diagnostico_version]);

  // También se aplica al restaurar un intento que ya alcanzó el límite.
  useEffect(() => { if (ready && state.attempt.faltas >= 3 && callbacks.current.active()) callbacks.current.onLimit(); }, [ready, state?.attempt.faltas]);
  return { ready, state, error, initialize, leave, returnToQuiz, secondsLeft, warning: Boolean(ready && state.attempt.episodio_abierto && state.attempt.faltas < 3), payload: () => ({ actividad_intento_id: current.current?.attempt.id, actividad_eventos_pendientes: current.current?.pending || [] }) };
}
