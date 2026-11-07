import React, { useId, useMemo } from "react";
import { BookOpen, FileEdit, GraduationCap, ChevronDown, ChevronRight, Info, AlertCircle, CheckCircle2, Clock, Eye } from "lucide-react";
import { formatGrade } from "../utils/academicEngine";
import "./StudentGradesView.css";

const hasGrade = value => value !== null && value !== undefined && value !== "" && Number.isFinite(Number(value));
const types = {
  manuales: { label: "Manual", Icon: BookOpen, max: 1 },
  pruebas: { label: "Prueba", Icon: FileEdit, max: 5 },
  examenes: { label: "Examen", Icon: GraduationCap, max: null }
};

export default function StudentGradesView({ summary, parciales, submissions, onReview, onAttendance }) {
  const accordionName = useId();
  const groups = useMemo(() => {
    const normalized = parciales.map(group => {
      const activities = Object.keys(types).flatMap(type => (group[type] || []).map((item, index) => ({ ...item,
        type, activityKey: `${type}-${item.key || item.id || index}`, graded: hasGrade(item.nota),
        label: item.label || types[type].label, maximum: item.ptsMax ?? types[type].max
      }))).sort((a, b) => (Number(a.semana) || 0) - (Number(b.semana) || 0));
      const weeks = new Map((group.weeks || []).filter(week => Number(week.numero_semana) > 0)
        .map(week => [Number(week.numero_semana), { ...week, number: Number(week.numero_semana) }]));
      // Conservar también notas históricas que no tienen una semana programada.
      activities.forEach(activity => {
        const number = Number(activity.semana) || 0;
        if (!weeks.has(number)) weeks.set(number, { number });
      });
      return { ...group, activities, gradeWeeks: [...weeks.values()].sort((a, b) =>
        (a.number || Infinity) - (b.number || Infinity)) };
    });
    const orderedWeeks = [...new Set(normalized.flatMap(group => group.gradeWeeks.map(week => week.number)))].filter(Boolean).sort((a, b) => a - b);
    const weekTones = new Map(orderedWeeks.map((number, index) => [number, index % 2 === 0 ? "gray" : "white"]));
    return normalized.map(group => ({ ...group, gradeWeeks: group.gradeWeeks.map(week => ({
      ...week, tone: weekTones.get(week.number) || "white",
      activities: group.activities.filter(activity => (Number(activity.semana) || 0) === week.number)
    })) })).filter(group => group.gradeWeeks.length > 0);
  }, [parciales]);
  return <section className="student-grades" aria-label="Mis calificaciones">
    <section className="student-grades__overview" aria-label="Acumulado del periodo completo">
      <div className="student-grades__total"><span>Nota acumulada del periodo</span><strong>{formatGrade(summary.total)}<small>{summary.maxPuntajeCarrera > 0 ? ` / ${formatGrade(summary.maxPuntajeCarrera)} pts` : " pts"}</small></strong><p>El acumulado corresponde al periodo completo y reúne las notas registradas de todos tus parciales.</p></div>
      <dl className="student-grades__breakdown">
        {[["Oro manuales", summary.notaOroManuales, summary.maxNotaManuales, BookOpen], ["Oro pruebas", summary.notaOroPruebas, summary.maxNotaPruebas, FileEdit], ["Exámenes", summary.sumaExamenes, summary.maxExamenesPuntaje, GraduationCap]].map(([label, value, maximum, Icon]) => <div key={label}><dt><Icon size={16} />{label}</dt><dd>{formatGrade(value)}<small>/ {formatGrade(maximum)} pts</small></dd></div>)}
      </dl>
    </section>
    <details className="student-grades__calculation"><summary><Info size={17} /><span>¿Cómo se forma mi nota acumulada?</span><ChevronDown size={17} /></summary><div><p>Se suman el oro de manuales, el oro de pruebas y las notas de exámenes. Las notas de actividades tienen escalas distintas y se ponderan para formar el acumulado.</p><ul><li><strong>Oro manuales:</strong> suma de notas de manuales ÷ {summary.countManuales} × {formatGrade(summary.maxNotaManuales)} puntos.</li><li><strong>Oro pruebas:</strong> suma de notas de pruebas ÷ ({summary.countPruebas} × 5) × {formatGrade(summary.maxNotaPruebas)} puntos.</li><li><strong>Exámenes:</strong> suma de las notas registradas en los exámenes del periodo.</li></ul><p>Una actividad <strong>sin nota</strong> aún no tiene una calificación registrada; no significa que tenga cero. Un <strong>0</strong> sí es una nota registrada. Los campos sin nota no añaden puntos al acumulado actual.</p></div></details>

    {!groups.length ? <div className="student-grades__empty"><BookOpen size={28} /><h4>Aún no hay actividades configuradas</h4><p>Las evaluaciones aparecerán aquí cuando se configure la programación académica.</p></div>
      : <div className="student-grades__groups">{groups.map(group => {
        const graded = group.activities.filter(activity => activity.graded).length;
        return <details className="student-grades__partial" key={group.key} name={accordionName}
          onToggle={event => {
            const openedPartial = event.currentTarget;
            if (!openedPartial.open) return;
            // Mantener la exclusividad también en navegadores sin soporte de details[name].
            event.currentTarget.parentElement.querySelectorAll(".student-grades__partial[open]").forEach(other => {
              if (other !== openedPartial) other.open = false;
            });
            // Esperar a que el otro parcial se cierre y el navegador ajuste la página.
            requestAnimationFrame(() => requestAnimationFrame(() => {
              if (openedPartial.isConnected && openedPartial.open) {
                openedPartial.scrollIntoView({ block: "start", behavior: "instant" });
              }
            }));
          }}>
          <summary><span className="student-grades__partial-icon">{group.roman}</span><span className="student-grades__partial-name"><strong>{group.label}</strong><small>{group.rangoSemanasText} · {group.activities.length} actividades</small></span><span className="student-grades__partial-count">{graded} con nota · {group.activities.length - graded} sin nota</span><ChevronDown size={19} /></summary>
          <div className="student-grades__partial-content">
            {group.perdioDerecho && <div className="student-grades__warning"><AlertCircle size={19} /><p><strong>Sin derecho a examen en este parcial.</strong> Hay {group.faltasInjustificadas} faltas injustificadas registradas. Las notas que ya tienes se conservan visibles.</p><button type="button" className="student-portal__button" onClick={onAttendance}>Ver asistencia</button></div>}
            <div className="student-grades__weeks">{group.gradeWeeks.map(week => {
              const weekLabel = week.number ? `Semana ${week.number}` : "Sin semana asignada";
              const description = week.nombre_semana || week.descripcion || "";
              return <section className="student-grades__week" data-week={week.number} data-tone={week.tone} key={week.number} aria-label={`${weekLabel} · ${group.label}`}>
                <div className="student-grades__week-heading"><div><h4>{weekLabel}</h4>{description && description.toLocaleLowerCase("es") !== weekLabel.toLocaleLowerCase("es") && <p>{description}</p>}</div><span>{week.activities.length} {week.activities.length === 1 ? "actividad" : "actividades"}</span></div>
                {!week.activities.length ? <p className="student-grades__week-empty">No hay actividades evaluables programadas para esta semana.</p> : <ul>{week.activities.map(activity => {
              const { Icon, label: typeLabel } = types[activity.type];
              const submission = activity.type === "pruebas" ? submissions?.[activity.semana] : null;
              const reviewing = !activity.graded && submission && submission.estado !== "calificado";
              return <li className="student-grades__activity" data-type={activity.type} data-graded={activity.graded} key={activity.activityKey}>
                <span className="student-grades__activity-icon"><Icon size={19} /></span>
                <div className="student-grades__activity-name"><span>{typeLabel}{Number(activity.semana) > 0 ? ` · Semana ${activity.semana}` : ""}</span><h5>{activity.label}</h5></div>
                <div className="student-grades__activity-grade"><strong>{activity.graded ? formatGrade(activity.nota) : "—"}{activity.maximum !== null && <small>/ {formatGrade(activity.maximum)} pts</small>}</strong><span className="student-grades__status">{activity.graded ? <CheckCircle2 size={13} /> : <Clock size={13} />}{activity.graded ? "Con nota" : reviewing ? "En revisión" : "Sin nota"}</span></div>
                {submission && <button type="button" className="student-portal__button student-grades__review" onClick={() => onReview(activity, submission)}><Eye size={15} />Ver entrega<ChevronRight size={14} /></button>}
              </li>;
                })}</ul>}
              </section>;
            })}</div>
            <p className="student-grades__partial-note">Las notas se muestran en la escala de cada actividad. Su aporte al acumulado se refleja en las notas oro y los exámenes del periodo.</p>
          </div>
        </details>;
      })}</div>}
  </section>;
}
