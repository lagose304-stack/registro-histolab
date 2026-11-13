import React, { useEffect, useState } from "react";
import { api } from "../services/api";
import { QUIZ_ACTIVITY_SIGNALS } from "../../../shared/quizActivity.mjs";
import "./QuizActivity.css";

const stamp = value => value ? new Date(value).toLocaleString("es-HN", { timeZone: "America/Tegucigalpa", hour12: false }) : "Sin registrar";
export default function QuizActivityReview({ section, week, account, fallback }) {
  const [rows, setRows] = useState(null);
  const [error, setError] = useState(false);
  const [version, setVersion] = useState(0);
  useEffect(() => {
    let cancelled = false;
    setRows(null);setError(false);
    api.pruebas.getActivity(section, week, account).then(result => {
      if (!result?.success) throw Error();
      if (!cancelled) setRows(result.data);
    }).catch(() => { if (!cancelled) setError(true); });
    return () => { cancelled = true; };
  }, [section, week, account, version]);
  const attempts = rows || (fallback ? [{ id: fallback.intento_id, politica: fallback.politica, aceptado_at: fallback.aceptado_at, faltas: fallback.faltas, eventos: fallback.eventos }] : []);
  return <section className="quiz-activity-review" aria-label="Registro de salidas de la prueba">
    <h3>Registro de salidas</h3>
    <p>Señales declaradas por el navegador; no identifican otra aplicación ni demuestran copia. Horas mostradas en Honduras. La hora del dispositivo y la duración pueden ser inexactas.</p>
    {rows === null && !error && <p role="status">Consultando registro…</p>}
    {error && <p role="alert">No se pudo consultar la bitácora independiente. {fallback && "Se muestra la copia guardada con la entrega."} <button type="button" onClick={() => setVersion(value => value + 1)}>Reintentar</button></p>}
    {rows && !rows.length && <p>Esta entrega no tiene un registro de la nueva política.</p>}
    {attempts.map(attempt => <div key={attempt.id}>
      <strong>{attempt.faltas} de 3 faltas · {attempt.politica}</strong>
      <small>Aceptación recibida: {stamp(attempt.aceptado_at)} · Intento: {attempt.id}</small>
      <ol>{attempt.eventos.filter(event => event.tipo === "salida").map(event => {
        const returned = attempt.eventos.find(row => row.tipo === "regreso" && row.episodio_id === event.episodio_id);
        const duration = returned ? Math.max(0, Math.round((new Date(returned.hora_cliente) - new Date(event.hora_cliente)) / 1000)) : null;
        return <li key={event.id}><strong>Falta {event.falta}: {event.senales.map(signal => QUIZ_ACTIVITY_SIGNALS[signal]).join(" · ")}</strong>
          <small>Pregunta {event.pregunta_indice + 1} · ID: {event.pregunta_id || "Sin pregunta"}</small>
          <small>Dispositivo: {stamp(event.hora_cliente)} · Recepción del servidor: {stamp(event.recibido_at)}</small>
          <small>{returned ? `Regreso: ${stamp(returned.hora_cliente)} · Duración declarada: ${duration} s` : "Regreso no registrado"} · Evento: {event.id}</small>
        </li>;
      })}</ol>
    </div>)}
  </section>;
}
