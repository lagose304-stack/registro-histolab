import React, { useState } from "react";
import { usesTouchInput } from "../utils/quizActivityObserver.mjs";
import "./QuizActivity.css";

export default function QuizActivityConsent({ title, busy, error, onAccept, onCancel }) {
  const [checked, setChecked] = useState(false);
  return <div className="quiz-activity-consent" role="dialog" aria-modal="true" aria-labelledby="quiz-activity-title">
    <div>
      <h2 id="quiz-activity-title">Antes de comenzar</h2>
      <p className="quiz-activity-consent__exam">{title}</p>
      <div className="quiz-activity-consent__rules">
        <p><strong>Acciones prohibidas</strong>, también durante la sala de espera. Cada una suma una falta:</p>
        <ul>
          <li>{usesTouchInput(window) ? "Cambiar a otra pestaña o aplicación cuando la página queda oculta. Puedes usar el teclado de tu dispositivo durante la prueba." : "Cambiar a otra pestaña, aplicación o ventana: la página queda oculta o la ventana pierde el foco."}</li>
          <li>Abandonar, cerrar o recargar la página de la prueba.</li>
          <li>En iPad, reducir el ancho de Safari de forma significativa durante al menos un segundo, aunque la página siga visible. Para regresar debes restaurar el ancho.</li>
        </ul>
        <p><strong>Qué ocurre con cada falta:</strong></p>
        <ul>
          <li>Se abre un aviso con 10 segundos para pulsar «Regresar a la prueba».</li>
          <li>Volver a la ventana por sí solo no detiene el contador.</li>
          <li>Si el plazo vence, se registra una falta grave y se envían tus respuestas.</li>
          <li>A la tercera falta, la prueba finaliza y se envía de inmediato.</li>
          <li>Una misma salida cuenta una sola vez hasta confirmar el regreso. El tiempo sigue avanzando.</li>
        </ul>
        <p>Se registra un diagnóstico técnico del navegador y sistema, foco, visibilidad, tamaño de ventana, orientación y estado de conexión durante el intento. El docente autorizado puede revisarlo y dispone del historial completo de tus acciones en el sitio. Por eso, si el historial demuestra las faltas que motivaron la suspensión de la prueba, cualquier reclamo se considera inválido.</p>
      </div>
      <label><input type="checkbox" checked={checked} onChange={e => setChecked(e.target.checked)} disabled={busy} /> He leído y acepto estas reglas y el registro de actividad y diagnóstico descritos.</label>
      {error && <p role="alert">{error}</p>}
      <div className="quiz-activity-consent__actions">
        {onCancel && <button type="button" onClick={onCancel} disabled={busy}>Volver</button>}
        <button type="button" onClick={onAccept} disabled={!checked || busy}>{busy ? "Registrando inicio…" : "Aceptar y comenzar"}</button>
      </div>
    </div>
  </div>;
}
