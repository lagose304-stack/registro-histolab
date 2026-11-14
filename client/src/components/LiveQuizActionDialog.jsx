import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AlertTriangle } from "lucide-react";

export default function LiveQuizActionDialog({ action, busy, error, onCancel, onConfirm }) {
  const ref = useRef(null);
  const [reason, setReason] = useState("");
  const [understood, setUnderstood] = useState(false);
  const reopening = action.type === "reopen";
  useEffect(() => { ref.current.showModal(); }, []);
  return createPortal(<dialog ref={ref} className="live-quiz-action-dialog" aria-labelledby="live-action-title" aria-describedby="live-action-description" onCancel={event => { event.preventDefault(); if (!busy) onCancel(); }}>
    <div className="live-quiz-action-dialog__content">
      <div className="live-quiz-action-dialog__body">
      <AlertTriangle size={28} aria-hidden="true" />
      <h3 id="live-action-title">{reopening ? "Habilitar la prueba de nuevo" : action.action === "deshabilitar" ? "¿Cerrar la sala para todos?" : "¿Finalizar la prueba para todos?"}</h3>
      <div id="live-action-description">
        {reopening ? <><p><strong>{action.student.nombre_completo || "Estudiante"}</strong> · {action.student.key}</p><p>Conservará sus respuestas y se incorporará a la pregunta vigente y al tiempo restante de la sala. Las preguntas anteriores seguirán cerradas.</p><p>La entrega anterior y sus faltas quedarán en el historial. Su nota se retirará hasta la nueva entrega y el contador de faltas comenzará de cero.</p></> : <><p>Esta acción afecta a <strong>todo el grupo</strong>. {action.action === "deshabilitar" ? "Se cerrará el acceso a la sala y se reiniciará la sincronización de los estudiantes. Puede interrumpir las pruebas en curso." : "Los estudiantes dejarán de responder y los intentos abiertos se enviarán con las respuestas registradas."}</p><p>Para ayudar a un solo estudiante, cancela y usa su opción «Habilitar de nuevo».</p></>}
      </div>
      {reopening ? <label className="user-field">Motivo de la reapertura<textarea autoFocus rows={3} maxLength={500} minLength={5} value={reason} disabled={busy} onChange={event => setReason(event.target.value)} placeholder="Por ejemplo: interrupción de conexión verificada" /></label> : <label className="live-quiz-action-dialog__check"><input type="checkbox" checked={understood} disabled={busy} onChange={event => setUnderstood(event.target.checked)} />Entiendo que esta acción cerrará la prueba para todo el grupo.</label>}
      {error && <p className="user-dialog__error" role="alert">{error}</p>}
      </div>
      <div className="live-quiz-action-dialog__actions"><button type="button" className="user-button" disabled={busy} onClick={onCancel}>Cancelar</button><button type="button" className="user-button user-button--danger" disabled={busy || (reopening ? reason.trim().length < 5 : !understood)} onClick={() => onConfirm(reason.trim())}>{busy ? "Guardando…" : reopening ? "Habilitar de nuevo" : action.action === "deshabilitar" ? "Sí, cerrar sala para todos" : "Sí, finalizar para todos"}</button></div>
    </div>
  </dialog>, document.body);
}
