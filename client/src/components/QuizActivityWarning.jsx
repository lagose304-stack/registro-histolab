import React, { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { AlertTriangle, ArrowLeft } from "lucide-react";
import "./QuizActivity.css";

export default function QuizActivityWarning({ strike, seconds, onReturn, windowBlocked = false, reducedWindow = false }) {
  const button = useRef(null);
  useEffect(() => {
    const previous = document.activeElement;
    const original = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    button.current?.focus({ preventScroll: true });
    return () => { document.body.style.overflow = original; if (previous?.isConnected) previous.focus?.({ preventScroll: true }); };
  }, []);
  return createPortal(<div className="quiz-activity-warning" role="alertdialog" aria-modal="true" aria-labelledby="quiz-departure-title" aria-describedby="quiz-departure-description" onKeyDown={event => { if (event.key === "Tab") { event.preventDefault(); button.current?.focus(); } }}>
    <div>
      <AlertTriangle size={48} aria-hidden="true" />
      <strong className="quiz-activity-warning__strike">Falta {strike} de 3</strong>
      <h2 id="quiz-departure-title">Regresa a la prueba</h2>
      {(windowBlocked || reducedWindow) && <p role="status"><strong>Se detectó una ventana reducida.</strong> Amplía Safari hasta ocupar todo el ancho de la pantalla y después pulsa «Regresar a la prueba». El contador continúa mientras restauras la ventana.</p>}
      <p id="quiz-departure-description">Se detectó una salida. Pulsa el botón antes de que termine el contador. Si llega a cero, se registrará una <strong>falta grave</strong> y se enviará la prueba con tus respuestas actuales.</p>
      <div className="quiz-activity-warning__timer" role="timer" aria-label={`${seconds} segundos restantes`}>{seconds}<span>segundos</span></div>
      <button ref={button} type="button" onClick={onReturn} aria-disabled={windowBlocked || seconds <= 0} disabled={seconds <= 0}><ArrowLeft size={21} /> Regresar a la prueba</button>
      <small>El tiempo de la pregunta sigue avanzando. Esta salida cuenta una sola vez.</small>
    </div>
  </div>, document.body);
}
