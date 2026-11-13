import React, { useRef } from 'react';
import { Maximize2 } from 'lucide-react';

export default function QuizFullscreenGate({ error, onResume, onExit }) {
  const panel = useRef(null);
  return <div className="quiz-fullscreen-gate" role="dialog" aria-modal="true" aria-labelledby="quiz-fullscreen-title" onKeyDown={event => {
    if (event.key !== 'Tab') return;
    const buttons = [...panel.current.querySelectorAll('button')];
    const first = buttons[0], last = buttons[buttons.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  }}>
    <div ref={panel}>
      <Maximize2 size={32} />
      <h2 id="quiz-fullscreen-title">Pantalla completa obligatoria</h2>
      <p>Para continuar, vuelve a pantalla completa. No puedes responder mientras estés fuera de ella.</p>
      {error && <p role="alert">{error}</p>}
      <button type="button" autoFocus onClick={onResume}>Volver a pantalla completa</button>
      <button type="button" onClick={onExit}>Salir y finalizar la prueba</button>
    </div>
  </div>;
}
