import React, { useState } from "react";
import { ArrowLeft, Clock, Radio, Lock, CheckCircle2, Send } from "lucide-react";
import QuizItemResponse from "./QuizItemResponse";
import { quizItemLabel } from "../../../shared/quizItems.mjs";
import "./StudentQuizPlayer.css";

function QuizImage({ src, number, watermark }) {
  const [failed, setFailed] = useState(false);
  return <figure className="quiz-player__image sp-quiz-image-container">
    {failed ? <p role="status">No se pudo cargar la micrografía. <button type="button" onClick={() => setFailed(false)}>Reintentar imagen</button></p>
      : <img src={src} alt={`Micrografía de la pregunta ${number}`} draggable={false} onError={() => setFailed(true)} />}
    <div className="quiz-player__watermark" style={watermark} aria-hidden="true" />
  </figure>;
}

export default function StudentQuizPlayer({ quiz, liveState, answers, seconds, strikes, online, connection, sealed, submitting, confirmed, studentName, account, onExit, onChange, onBlur, onConfirm, onSubmit, onPasteBlocked }) {
  const phase = liveState?.estado || "lobby";
  const index = liveState?.pregunta_actual_idx ?? 0;
  const questions = quiz.preguntas || [];
  const question = questions[index];
  const disabled = phase !== "en_pregunta" || sealed || submitting || seconds <= 0 || connection !== "connected" || !online;
  const timer = `${Math.floor(Math.max(0, seconds) / 60).toString().padStart(2, "0")}:${(Math.max(0, seconds) % 60).toString().padStart(2, "0")}`;
  const watermark = { backgroundImage: `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='340' height='130'><text x='15' y='65' fill='%23497490' font-family='sans-serif' font-size='12' transform='rotate(-22 170 65)'>HISTOLAB · ${encodeURIComponent(studentName || "")} · ${encodeURIComponent(account || "")}</text></svg>")` };
  const answer = question ? answers?.[question.id] : null;
  const bonus = index === 5;
  const times = questions.map(q => Number(q.tiempo_segundos || quiz.tiempo_por_pregunta_segundos || 90));
  return <section className="quiz-player sp-quiz-take-card" aria-label="Prueba en curso" onContextMenu={event => event.preventDefault()} onCopy={event => event.preventDefault()}>
    <div className="quiz-player__watermark" style={watermark} aria-hidden="true" />
    <div className="quiz-player__top">
      <button type="button" className="quiz-player__back" aria-label="Salir de la prueba" onClick={onExit}><ArrowLeft size={20} /></button>
      <div className="quiz-player__identity"><span>Semana {quiz.numero_semana} · Prueba semanal</span><h2>{quiz.titulo || "Evaluación en vivo"}</h2></div>
      <span className="quiz-player__connection" data-connected={online && connection === "connected"} role="status"><Radio size={15} />{!online ? "Sin conexión" : connection === "connected" ? "Sincronizado" : connection === "reconnecting" ? "Reconectando…" : "Conectando…"}</span>
    </div>
    <div className="quiz-player__statusbar">
      <span>{phase === "lobby" ? "Sala de espera" : `Pregunta ${index + 1} de ${questions.length}`}{bonus && phase !== "lobby" ? " · Bonus" : ""}</span>
      <strong className="quiz-player__timer" data-urgent={phase === "en_pregunta" && seconds <= 15} aria-label={phase === "en_pregunta" ? `Tiempo restante ${timer}` : undefined}><Clock size={19} />{phase === "en_pregunta" ? timer : phase === "esperando_siguiente" ? "Esperando siguiente" : phase === "finalizada" ? "Finalizada" : "En espera"}</strong>
    </div>
    {(!online || connection === "reconnecting") && <p className="quiz-player__warning" role="alert">La sincronización se interrumpió. Tus respuestas se conservan en este dispositivo. Reconectando para verificar la pregunta y el tiempo vigentes…</p>}
    {sealed && <p className="quiz-player__warning" role="status">La prueba está sellada. La entrega se enviará al recuperar la conexión.</p>}
    <details className="quiz-player__rules"><summary><Lock size={15} />Indicaciones y normas · {strikes}/3 advertencias</summary><p>Mantén visible la evaluación mientras respondes. Las salidas de al menos 2 segundos durante preguntas activas generan una advertencia; la tercera cierra y envía la prueba para revisión. El teclado, los selectores, la rotación y las interrupciones breves no generan advertencias. Copiar y pegar están deshabilitados.</p>{quiz.instrucciones && <p className="quiz-player__instructions">{quiz.instrucciones}</p>}</details>
    {phase === "lobby" ? <div className="quiz-player__waiting"><Radio size={32} /><h3>Todo listo para comenzar</h3><p>El instructor titular de la sección iniciará la primera pregunta. Aparecerá aquí automáticamente.</p><div className="quiz-player__facts"><div><strong>{questions.length} preguntas</strong><span>Una pregunta a la vez</span></div><div><strong>{times.every(time => time === times[0]) ? `${times[0] || 90} segundos por pregunta` : "Tiempo por pregunta"}</strong><span>{times.every(time => time === times[0]) ? "Sincronizado con la sección" : "Cada pregunta tiene su propio tiempo"}</span></div></div></div>
      : phase === "esperando_siguiente" ? <div className="quiz-player__waiting"><CheckCircle2 size={34} /><h3>Pregunta {index + 1} concluida</h3><p>Tus respuestas se conservan. La siguiente pregunta aparecerá cuando el instructor titular de la sección la habilite.</p></div>
      : phase === "inactiva" ? <div className="quiz-player__waiting" role="status"><Lock size={32} /><h3>Prueba deshabilitada</h3><p>Espera las indicaciones del instructor titular de la sección.</p></div>
      : phase === "finalizada" ? <div className="quiz-player__waiting" role="status"><Send size={32} /><h3>Finalizando tu entrega…</h3><p>Conserva esta pantalla abierta hasta recibir la confirmación.</p></div>
      : question ? <>
        <article className="quiz-player__question" key={question.id} data-bonus={bonus}>
          <div className="quiz-player__question-heading"><h3>{bonus ? "Pregunta bonus" : `Pregunta ${question.numero || index + 1}`}</h3>{question.puntos !== undefined && <span>{question.puntos} pt(s)</span>}</div>
          {question.enunciado && <p className="quiz-player__prompt">{question.enunciado}</p>}
          {question.imagen_url && <QuizImage key={`${question.id}:${question.imagen_url}`} src={question.imagen_url} number={index + 1} watermark={watermark} />}
          <div className="quiz-player__items">{(question.items?.length ? question.items : [{ id: "respuesta", tipo: "texto_corto", instruccion: "Respuesta" }]).map((item, itemIndex) => <div className="quiz-player__item" key={item.id}>
            <div className="quiz-player__item-heading"><h4>{String.fromCharCode(97 + itemIndex)}) {item.instruccion || item.etiqueta || quizItemLabel(item)}</h4>{item.puntos !== undefined && <span>{item.puntos} pt(s)</span>}</div>
            <QuizItemResponse item={item} value={typeof answer === "string" && item.id === "respuesta" ? answer : answer?.[item.id]} disabled={disabled} onChange={value => onChange(question.id, item.id, value)} onBlur={() => onBlur(question.id)} onPasteBlocked={onPasteBlocked} />
          </div>)}</div>
        </article>
        <div className="quiz-player__actions"><p>{seconds <= 0 ? "Tiempo agotado. Respuestas bloqueadas; esperando indicaciones del instructor." : "Las respuestas se guardan en este dispositivo y se sincronizan durante la prueba."}</p>{index < questions.length - 1 ? <button type="button" disabled={disabled} onClick={() => { onBlur(question.id); onConfirm(index); }}><CheckCircle2 size={18} />{confirmed[index] ? "Volver a guardar respuesta" : "Guardar respuesta"}</button> : <button type="button" disabled={sealed || submitting} onClick={onSubmit}><Send size={18} />{submitting ? "Enviando…" : !online ? "Finalizar y guardar entrega" : "Finalizar y entregar"}</button>}</div>
      </> : <p role="alert">No se encontró la pregunta indicada. Esperando sincronización con el instructor.</p>}
  </section>;
}
