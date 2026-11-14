import React, { useEffect, useState } from "react";
import { api } from "../services/api";
import { QUIZ_ACTIVITY_SIGNALS } from "../../../shared/quizActivity.mjs";
import "./QuizActivity.css";
import QuizDiagnosticsReview from "./QuizDiagnosticsReview";

const stamp = value => value ? new Date(value).toLocaleString("es-HN", { timeZone: "America/Tegucigalpa", hour12: false }) : "Sin registrar";
const hour = value => value ? new Date(value).toLocaleTimeString("es-HN", { timeZone: "America/Tegucigalpa", hour12: false }) : "Sin registrar";

function AttemptReview({ attempt, label }) {
  const events = Array.isArray(attempt.eventos) ? attempt.eventos : [];
  const departures = events.filter(event => event.tipo === "salida");
  return <article className="quiz-activity-review__attempt" aria-label={label}>
    <header><strong>{label}</strong><span className="quiz-activity-review__count" data-clear={attempt.faltas === 0}>{attempt.faltas === 0 ? "Sin faltas registradas" : `${attempt.faltas} de 3 faltas`}</span></header>
    <small>Inicio del intento: {stamp(attempt.aceptado_at)}</small>
    {!departures.length ? <p>{attempt.faltas > 0 ? "El contador registra faltas, pero el detalle de las salidas no está disponible." : "Sin salidas registradas en este intento."}</p> : <ol>{departures.map(event => {
      const returned = events.find(row => row.tipo === "regreso" && row.episodio_id === event.episodio_id);
      const elapsed = returned ? Math.round((new Date(returned.hora_cliente) - new Date(event.hora_cliente)) / 1000) : null;
      const duration = Number.isFinite(elapsed) && elapsed >= 0 ? elapsed : null;
      return <li key={event.id}>
        <strong>Falta {event.falta}: {(event.senales || []).map(signal => QUIZ_ACTIVITY_SIGNALS[signal] || signal).join(" · ")}</strong>
        <small>Pregunta {event.pregunta_indice + 1} · Salida{event.recibido_at ? " recibida" : " declarada"}: {hour(event.recibido_at || event.hora_cliente)}</small>
        <small>{returned ? `Regreso${returned.recibido_at ? " recibido" : " declarado"}: ${hour(returned.recibido_at || returned.hora_cliente)}${duration === null ? "" : ` · Duración declarada: ${duration} s`}` : "Regreso no registrado"}</small>
      </li>;
    })}</ol>}
    <details className="quiz-activity-review__technical"><summary>Datos técnicos del intento</summary>
      <p>Política: {attempt.politica || "Sin registrar"}<br />Aceptación recibida: {stamp(attempt.aceptado_at)}<br />Intento: {attempt.id}</p>
      {departures.length > 0 && <ol>{departures.map(event => {
        const returned = events.find(row => row.tipo === "regreso" && row.episodio_id === event.episodio_id);
        return <li key={event.id}><strong>Falta {event.falta}</strong>
          <small>Pregunta: {event.pregunta_id || "Sin identificador"} · Episodio: {event.episodio_id}</small>
          <small>Dispositivo: {stamp(event.hora_cliente)} · Recepción del servidor: {stamp(event.recibido_at)}</small>
          <small>Evento de salida: {event.id}</small>
          {returned && <><small>Regreso declarado: {stamp(returned.hora_cliente)} · Recepción del regreso: {stamp(returned.recibido_at)}</small><small>Evento de regreso: {returned.id}</small></>}
        </li>;
      })}</ol>}
    </details>
  </article>;
}

export default function QuizActivityReview({ section, week, account, fallback }) {
  const identity = JSON.stringify([section, week, account]);
  const [result, setResult] = useState(null);
  const rows = result?.identity === identity ? result.rows : null;
  const error = result?.identity === identity && result.error;
  const [version, setVersion] = useState(0);
  useEffect(() => {
    let cancelled = false;
    setResult(null);
    api.pruebas.getActivity(section, week, account).then(result => {
      if (!result?.success) throw Error();
      if (!cancelled) setResult({identity, rows:result.data || [], error:false});
    }).catch(() => { if (!cancelled) setResult({identity, rows:null, error:true}); });
    return () => { cancelled = true; };
  }, [section, week, account, version]);
  const copy = fallback?.intento_id ? {...fallback, id:fallback.intento_id} : null;
  const attempts = [...new Map((rows || []).map(attempt => [attempt.id, attempt])).values()].sort((a,b) => (Date.parse(b.aceptado_at) || 0) - (Date.parse(a.aceptado_at) || 0));
  const primary = copy ? attempts.find(attempt => attempt.id === copy.id) || copy : attempts[0];
  const history = attempts.filter(attempt => attempt.id !== primary?.id);
  return <section className="quiz-activity-review" aria-label="Registro de salidas de la prueba">
    <h3>Registro de salidas</h3>
    {fallback?.falta_grave && <p role="alert"><strong>Falta grave: venció el plazo de 10 segundos para confirmar el regreso. La prueba se envió con las respuestas existentes.</strong></p>}
    <p>Las señales del navegador no demuestran copia ni identifican otra aplicación. Horas en Honduras; los tiempos declarados pueden ser inexactos.</p>
    {rows === null && !error && <p role="status">Consultando registro…</p>}
    {error && <p role="alert">No se pudo consultar la bitácora independiente. {fallback && "Se muestra la copia guardada con la entrega."} <button type="button" onClick={() => setVersion(value => value + 1)}>Reintentar</button></p>}
    {rows && !primary && <p>Esta entrega no tiene un registro de salidas disponible.</p>}
    {!copy && primary && <p>La entrega no indica qué intento le corresponde. Se muestra el más reciente de esta cuenta y semana.</p>}
    {primary && <AttemptReview key={primary.id} attempt={primary} label={copy ? "Intento de esta entrega" : "Intento más reciente del registro"} />}
    {history.length > 0 && <details className="quiz-activity-review__history"><summary>Historial de otros intentos ({history.length})</summary>
      <p>Cada intento tiene su propio contador. Las faltas de estos intentos no se suman a las de la entrega mostrada.</p>
      {history.map(attempt => <AttemptReview key={attempt.id} attempt={attempt} label="Otro intento guardado" />)}
    </details>}
    <QuizDiagnosticsReview key={`${section}_${week}_${account}`} section={section} week={week} account={account} />
  </section>;
}
