import React, { useId } from "react";
import { FileEdit, Clock, Radio, Lock, CheckCircle2, Eye, Play, RefreshCw, AlertCircle, Send, ChevronRight, ChevronDown } from "lucide-react";
import "./StudentQuizzesView.css";
import { getQuizPractice } from "../../../shared/quizSchedule.mjs";

const sessionEnabled = session => Boolean(session && !["finalizada", "inactiva"].includes(session.estado) &&
  (session.habilitada || ["lobby", "en_pregunta", "esperando_siguiente"].includes(session.estado)));
const formatSeconds = seconds => {
  const minutes = Math.floor(seconds / 60);
  const remaining = seconds % 60;
  return [minutes ? `${minutes} min` : "", remaining ? `${remaining} s` : ""].filter(Boolean).join(" ") || "0 s";
};
const states = {
  live: { label: "En vivo · habilitada", Icon: Radio },
  waiting: { label: "En espera de habilitación", Icon: Lock },
  submitted: { label: "Entregada · en revisión", Icon: Send },
  graded: { label: "Calificada", Icon: CheckCircle2 }
};

export default function StudentQuizzesView({ quizzes, submissions, sessions, parciales = [], weeks = [], loading, error, onRefresh, onStart, onReview }) {
  const historyAccordionName = useId();
  const items = [...quizzes].sort((a, b) => Number(a.numero_semana) - Number(b.numero_semana)).map(quiz => {
    const submission = submissions[quiz.numero_semana];
    const session = sessions[quiz.numero_semana];
    const state = submission ? submission.estado === "calificado" ? "graded" : "submitted" : sessionEnabled(session) ? "live" : "waiting";
    return { quiz, submission, session, state };
  });
  const counts = { live: 0, waiting: 0, submitted: 0, graded: 0 };
  items.forEach(item => { counts[item.state] += 1; });

  const available = items.filter(item => !item.submission);
  const historyMap = new Map();
  items.filter(item => item.submission).forEach(item => {
    const partial = parciales.find(group => (group.weekNums || (group.weeks || []).map(week => Number(week.numero_semana))).includes(Number(item.quiz.numero_semana)));
    const key = partial?.key ?? null;
    if (!historyMap.has(key)) historyMap.set(key, { ...partial, key, label: partial?.label || "Sin parcial asignado", items: [] });
    historyMap.get(key).items.push(item);
  });
  const historyGroups = parciales.map(group => historyMap.get(group.key)).filter(Boolean);
  if (historyMap.has(null)) historyGroups.push(historyMap.get(null));

  const renderQuiz = ({ quiz, submission, session, state }) => {
    const { Icon, label } = states[state];
    const schedule = getQuizPractice(weeks,quiz.numero_semana);
    const questions = Array.isArray(quiz.preguntas) ? quiz.preguntas : [];
    const times = questions.map(question => Number(question.tiempo_segundos || quiz.tiempo_por_pregunta_segundos || 90));
    const uniformTime = times.length > 0 && times.every(time => time === times[0]);
    const duration = Number(quiz.duracion_minutos || quiz.tiempo_limite_minutos || quiz.duracionMinutos);
    const hasGrade = submission?.nota_obtenida !== null && submission?.nota_obtenida !== undefined && Number.isFinite(Number(submission.nota_obtenida));
    const realGrade = Number(submission?.nota_real ?? submission?.nota_con_bonus ?? submission?.auditoria?.nota_real);
    return <article className="student-quizzes__card" data-state={state} data-week={quiz.numero_semana} key={quiz.id || quiz.numero_semana}>
      <div className="student-quizzes__card-top"><span>Semana {quiz.numero_semana}</span><span className="student-quizzes__badge"><Icon size={14} />{label}</span></div>
      <h4>{quiz.titulo || `Prueba semanal ${quiz.numero_semana}`}</h4>
      {schedule.practiceWeek && <p>{schedule.beforeExam ? "Se rinde el mismo día de esta práctica, antes de la semana de examen." : `Se rinde en la práctica de la semana ${schedule.practiceWeek}.`}</p>}
      {quiz.reposicion && <p><strong>Reposición en sección {quiz.reposicion.seccion}</strong> · El resultado se registra en tu sección original.</p>}
      <div className="student-quizzes__metadata"><span><FileEdit size={15} />{questions.length} {questions.length === 1 ? "pregunta" : "preguntas"}</span>{duration > 0 && <span><Clock size={15} />{duration} min de duración</span>}{questions.length > 0 && <span><Clock size={15} />{uniformTime ? `${formatSeconds(times[0])} por pregunta` : "Tiempo variable por pregunta"}</span>}</div>
      {quiz.instrucciones && <details className="student-quizzes__instructions"><summary>Instrucciones de la prueba</summary><p>{quiz.instrucciones}</p></details>}
      <div className="student-quizzes__card-bottom">
        {state === "graded" ? <div className="student-quizzes__grade"><span>Nota oficial</span><strong>{hasGrade ? `${Number(submission.nota_obtenida).toFixed(3)} / 5.000 pts` : "Nota por sincronizar"}</strong>{realGrade > 5 && <small>Puntaje con bonus: {realGrade.toFixed(3)} pts</small>}</div>
          : <p className="student-quizzes__status-note">{state === "live" ? "La sesión está habilitada. Puedes ingresar a la evaluación." : state === "submitted" ? "Tu entrega está registrada y espera la revisión del instructor titular de la sección." : "La prueba está publicada. Podrás ingresar cuando el instructor titular de la sección la habilite en vivo."}</p>}
        {submission ? <button type="button" className="student-portal__button" onClick={() => onReview(quiz, submission)}><Eye size={17} />Ver respuestas y comprobante<ChevronRight size={15} /></button>
          : state === "live" ? <button type="button" className="student-quizzes__start" onClick={() => onStart(quiz, session)}><Play size={17} />Entrar a la prueba<ChevronRight size={16} /></button>
          : <button type="button" className="student-portal__button" disabled><Lock size={16} />En espera de habilitación</button>}
      </div>
    </article>;
  };

  return <section className="student-quizzes" aria-label="Pruebas semanales">
    <div className="student-quizzes__toolbar"><p>Revisa el estado de tus pruebas y consulta tus entregas.</p><button type="button" className="student-portal__button" disabled={loading} onClick={onRefresh}><RefreshCw size={16} className={loading ? "animate-spin" : ""} />{loading ? "Actualizando…" : "Actualizar pruebas"}</button></div>
    {loading ? <div className="student-quizzes__empty" role="status"><RefreshCw size={26} className="animate-spin" /><p>Cargando pruebas y verificando tus entregas…</p></div>
      : error ? <div className="student-quizzes__error" role="alert"><AlertCircle size={22} /><p>{error}</p><button type="button" className="student-portal__button" onClick={onRefresh}>Reintentar carga de pruebas</button></div>
      : <>
        <dl className="student-quizzes__stats">{[["live", "En vivo"], ["waiting", "En espera"], ["submitted", "En revisión"], ["graded", "Calificadas"]].map(([key, label]) => { const Icon = states[key].Icon; return <div key={key} data-state={key}><dt><Icon size={17} />{label}</dt><dd>{counts[key]}</dd></div>; })}</dl>
        {!items.length ? <div className="student-quizzes__empty"><FileEdit size={28} /><h4>Aún no hay pruebas publicadas</h4><p>El instructor titular de tu sección publicará aquí las evaluaciones de cada semana.</p></div>
          : <>
            {available.length > 0 && <section className="student-quizzes__available" aria-label="Pruebas por realizar"><h4>Pruebas por realizar</h4><div className="student-quizzes__list">{available.map(renderQuiz)}</div></section>}
            {historyGroups.length > 0 && <section className="student-quizzes__history" aria-label="Historial de entregas"><h4>Historial de entregas</h4><div className="student-quizzes__history-groups">{historyGroups.map(group => <details className="student-quizzes__history-partial" name={historyAccordionName} key={group.key || "unassigned"}
              onToggle={event => {
                const openedPartial = event.currentTarget;
                if (!openedPartial.open) return;
                openedPartial.parentElement.querySelectorAll(".student-quizzes__history-partial[open]").forEach(other => {
                  if (other !== openedPartial) other.open = false;
                });
                requestAnimationFrame(() => requestAnimationFrame(() => {
                  if (openedPartial.isConnected && openedPartial.open) openedPartial.scrollIntoView({ block: "start", behavior: "instant" });
                }));
              }}><summary><span><strong>{group.label}</strong>{group.rangoSemanasText && <small>{group.rangoSemanasText}</small>}</span><span className="student-quizzes__history-count">{group.items.length} {group.items.length === 1 ? "entrega" : "entregas"}</span><ChevronDown size={19} /></summary><div className="student-quizzes__list student-quizzes__history-content">{group.items.map(renderQuiz)}</div></details>)}</div></section>}
          </>}
      </>}
  </section>;
}
