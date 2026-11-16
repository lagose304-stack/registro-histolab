import React, { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { ShieldAlert, CheckCircle2, RefreshCw } from "lucide-react";
import "./QuizActivity.css";

export default function QuizActivityFinished({ reason, title, confirmed, busy, error, onReview, onRetry }) {
  const panel = useRef(null);
  const action = useRef(null);
  const timedOut = reason === "falta_grave_tiempo";
  useEffect(() => {
    const previous = document.activeElement;
    const original = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    panel.current?.focus({ preventScroll: true });
    return () => { document.body.style.overflow = original; if (previous?.isConnected) previous.focus?.({ preventScroll: true }); };
  }, []);
  return createPortal(<div className="quiz-activity-warning quiz-activity-finished" role="alertdialog" aria-modal="true" aria-labelledby="quiz-finished-title" aria-describedby="quiz-finished-description" onKeyDown={event => {
    if (event.key === "Tab") { event.preventDefault(); (action.current && !action.current.disabled ? action.current : panel.current)?.focus(); }
  }}>
    <div ref={panel} tabIndex={-1}>
      <ShieldAlert size={48} aria-hidden="true" />
      <strong className="quiz-activity-warning__strike">{timedOut ? "Falta grave · Plazo de regreso vencido" : "Falta 3 de 3 · Límite alcanzado"}</strong>
      <h2 id="quiz-finished-title">Prueba bloqueada</h2>
      {title && <p className="quiz-activity-finished__name">{title}</p>}
      <p id="quiz-finished-description">{timedOut
        ? "Vencieron los 10 segundos del aviso sin confirmar el regreso. Por esta falta grave, la prueba se finalizó y ya no puedes continuar respondiendo."
        : "Se registraron tres salidas de la prueba. Según las reglas aceptadas al iniciar, la tercera falta finaliza la prueba y bloquea nuevas respuestas."}</p>
      <div className="quiz-activity-finished__status" role="status" aria-live="polite">
        {confirmed ? <><CheckCircle2 size={22} aria-hidden="true" /><p><strong>Entrega confirmada</strong><br />El servidor recibió las respuestas que habías contestado hasta el bloqueo.</p></>
          : busy ? <><RefreshCw size={22} aria-hidden="true" /><p><strong>Enviando tus respuestas…</strong><br />Mantén esta pantalla abierta hasta recibir la confirmación.</p></>
          : <p><strong>Entrega pendiente de confirmación</strong><br />Tus respuestas quedaron selladas en este dispositivo. Se reintentará el envío automáticamente al recuperar la conexión.</p>}
      </div>
      {!confirmed && error && <p className="quiz-activity-finished__error" role="alert">{error}</p>}
      <small>Si necesitas que se revise lo ocurrido, comunícate con el instructor titular de tu sección. Solo el docente puede habilitar de nuevo la prueba.</small>
      <button ref={action} type="button" disabled={!confirmed && busy} onClick={confirmed ? onReview : onRetry}>
        {confirmed ? "Ver entrega" : busy ? "Enviando…" : "Reintentar envío"}
      </button>
    </div>
  </div>, document.body);
}
