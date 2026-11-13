import React, { useState } from "react";
import "./QuizActivity.css";

export default function QuizActivityConsent({ title, busy, error, onAccept, onCancel }) {
  const [checked, setChecked] = useState(false);
  return <div className="quiz-activity-consent" role="dialog" aria-modal="true" aria-labelledby="quiz-activity-title">
    <div>
      <h2 id="quiz-activity-title">Antes de comenzar</h2>
      <p>{title}</p>
      <p>Durante la prueba, incluida la sala de espera, cada salida detectada suma una falta. Puedes cambiar de ventana o aplicación; la prueba registra si la página queda oculta o la ventana pierde el foco. Abandonar o recargar la página también puede registrar una salida.</p>
      <p><strong>La tercera falta finaliza y envía la prueba con las respuestas que lleves.</strong> Una misma salida cuenta una sola vez hasta que regreses. El tiempo sigue avanzando.</p>
      <p>Se guardan la señal observada, la pregunta y las horas del dispositivo y del servidor. Una señal no demuestra por sí sola que hubo copia: el navegador no identifica la aplicación abierta ni el motivo de una interrupción.</p>
      <label><input type="checkbox" checked={checked} onChange={e => setChecked(e.target.checked)} disabled={busy} /> He leído y acepto estas reglas y el registro de actividad descrito.</label>
      {error && <p role="alert">{error}</p>}
      <div className="quiz-activity-consent__actions">
        {onCancel && <button type="button" onClick={onCancel} disabled={busy}>Volver</button>}
        <button type="button" onClick={onAccept} disabled={!checked || busy}>{busy ? "Registrando inicio…" : "Aceptar y comenzar"}</button>
      </div>
    </div>
  </div>;
}
