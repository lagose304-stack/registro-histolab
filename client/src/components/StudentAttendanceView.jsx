import React, { useId, useMemo } from "react";
import { CalendarCheck, CheckCircle2, Clock, AlertCircle, ShieldCheck, ChevronDown } from "lucide-react";
import "./StudentAttendanceView.css";

const attendanceStates = {
  Asistio: { id: "present", label: "Asistió", Icon: CheckCircle2 },
  "Falta justificada": { id: "justified", label: "Falta justificada", Icon: ShieldCheck },
  "Falta injustificada": { id: "unjustified", label: "Falta injustificada", Icon: AlertCircle }
};
const unrecorded = { id: "unrecorded", label: "Sin registro", Icon: Clock };

export default function StudentAttendanceView({ parciales, examStatus }) {
  const accordionName = useId();
  const groups = useMemo(() => {
    const normalized = parciales.map(group => ({ ...group, attendanceWeeks: (group.semanasAsistencia || [])
      .map(week => ({ ...week, state: attendanceStates[week.estado] || unrecorded }))
      .sort((a, b) => Number(a.semana) - Number(b.semana))
    })).filter(group => group.attendanceWeeks.length > 0);
    return normalized.map(group => ({ ...group,
      registered: group.attendanceWeeks.filter(week => week.state.id !== "unrecorded").length
    }));
  }, [parciales]);
  const counts = { present: 0, justified: 0, unjustified: 0, unrecorded: 0 };
  groups.forEach(group => group.attendanceWeeks.forEach(week => { counts[week.state.id] += 1; }));
  const totalWeeks = Object.values(counts).reduce((sum, count) => sum + count, 0);

  return <section className="student-attendance" aria-label="Mi asistencia">
    <dl className="student-attendance__stats">
      {[["present", "Asistencias", CheckCircle2], ["justified", "Faltas justificadas", ShieldCheck], ["unjustified", "Faltas injustificadas", AlertCircle], ["unrecorded", "Sin registro", Clock]].map(([id, label, Icon]) => <div data-state={id} key={id}><dt><Icon size={18} />{label}</dt><dd>{counts[id]}<small>{counts[id] === 1 ? "semana" : "semanas"}</small></dd></div>)}
    </dl>
    <div className="student-attendance__note"><CalendarCheck size={19} /><p>{totalWeeks > 0 ? <>Hay <strong>{totalWeeks - counts.unrecorded} de {totalWeeks} semanas</strong> con asistencia registrada. </> : null}<strong>Sin registro</strong> significa que aún no se ha ingresado la asistencia; no equivale a una falta. Para consultas, comunícate con el instructor titular de tu sección.</p></div>

    {!groups.length ? <div className="student-attendance__empty"><CalendarCheck size={28} /><h4>Aún no hay semanas configuradas</h4><p>El historial aparecerá aquí cuando se configure la programación de tu carrera.</p></div>
      : <div className="student-attendance__groups">{groups.map(group => {
        const exams = (examStatus.exams || []).filter(exam => exam.semana
          ? group.attendanceWeeks.some(week => Number(week.semana) === Number(exam.semana))
          : exam.parcialName === group.label);
        return <details className="student-attendance__partial" name={accordionName} key={group.key}
          onToggle={event => {
            const openedPartial = event.currentTarget;
            if (!openedPartial.open) return;
            openedPartial.parentElement.querySelectorAll(".student-attendance__partial[open]").forEach(other => {
              if (other !== openedPartial) other.open = false;
            });
            requestAnimationFrame(() => requestAnimationFrame(() => {
              if (openedPartial.isConnected && openedPartial.open) openedPartial.scrollIntoView({ block: "start", behavior: "instant" });
            }));
          }}>
          <summary><span className="student-attendance__partial-icon">{group.roman}</span><span className="student-attendance__partial-name"><strong>{group.label}</strong><small>{group.rangoSemanasText}</small></span><span className="student-attendance__partial-count">{group.registered} de {group.attendanceWeeks.length} registradas</span><ChevronDown size={19} /></summary>
          <div className="student-attendance__content">
            {exams.length > 0 && <section className="student-attendance__exam-status" aria-label={`Derecho a examen · ${group.label}`}><h4>Derecho a examen</h4><p>Estado según las faltas injustificadas registradas en este parcial.</p><ul>{exams.map(exam => <li key={exam.id || `${exam.label}-${exam.semana}`} data-status={!group.registered ? "unrecorded" : exam.perdio ? "restricted" : "enabled"}>{!group.registered ? <Clock size={17} /> : exam.perdio ? <AlertCircle size={17} /> : <ShieldCheck size={17} />}<div><strong>{exam.label}</strong><span>{!group.registered ? "Aún no hay registros de asistencia" : exam.perdio ? `Sin derecho · ${exam.faltasInjustificadas} faltas injustificadas` : "Habilitado según los registros disponibles"}</span></div></li>)}</ul></section>}
            <ul className="student-attendance__weeks">{group.attendanceWeeks.map(week => {
              const { Icon, label, id } = week.state;
              return <li className="student-attendance__week" key={week.semana} data-week={week.semana} data-exam={Boolean(week.esExamen)} data-state={id}>
                <span className="student-attendance__week-icon"><CalendarCheck size={19} /></span><div><h4>Semana {week.semana}</h4>{week.nombre && week.nombre.toLocaleLowerCase("es") !== `semana ${week.semana}` && <p>{week.nombre}</p>}{week.esExamen && <small>Semana de examen</small>}</div><span className="student-attendance__badge"><Icon size={15} />{label}</span>
              </li>;
            })}</ul>
          </div>
        </details>;
      })}</div>}
  </section>;
}
