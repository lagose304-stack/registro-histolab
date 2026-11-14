import React, { useState } from "react";
import "./QuizActivity.css";

export default function QuizActivityConsent({ title, busy, error, onAccept, onCancel }) {
  const [checked, setChecked] = useState(false);
  return <div className="quiz-activity-consent" role="dialog" aria-modal="true" aria-labelledby="quiz-activity-title">
    <div>
      <h2 id="quiz-activity-title">Antes de comenzar</h2>
      <p>{title}</p>
      <p>Durante la prueba, incluida la sala de espera, cada salida detectada suma una falta. Puedes cambiar de ventana o aplicación; la prueba registra si la página queda oculta o la ventana pierde el foco. Abandonar o recargar la página también puede registrar una salida.</p>
      <p><strong>Cada falta abre un aviso con 10 segundos para pulsar «Regresar a la prueba».</strong> Si el plazo vence, se registra una falta grave y se envían tus respuestas. Volver a la ventana por sí solo no detiene el contador. La tercera falta finaliza y envía la prueba de inmediato. Una misma salida cuenta una sola vez hasta confirmar el regreso. El tiempo sigue avanzando.</p>
      <p>Para mejorar la compatibilidad de las pruebas, se registra un diagnóstico técnico del navegador y sistema, foco, visibilidad, tamaño de ventana, orientación y estado de conexión durante el intento. El docente autorizado puede revisarlo. Este diagnóstico no añade faltas ni guarda lo que escribes, imágenes o contenido de otras aplicaciones.</p>
      <label><input type="checkbox" checked={checked} onChange={e => setChecked(e.target.checked)} disabled={busy} /> He leído y acepto estas reglas y el registro de actividad y diagnóstico descritos.</label>
      {error && <p role="alert">{error}</p>}
      <div className="quiz-activity-consent__actions">
        {onCancel && <button type="button" onClick={onCancel} disabled={busy}>Volver</button>}
        <button type="button" onClick={onAccept} disabled={!checked || busy}>{busy ? "Registrando inicio…" : "Aceptar y comenzar"}</button>
      </div>
    </div>
  </div>;
}
