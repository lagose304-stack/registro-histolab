import React, { useEffect, useState } from "react";
import { Award, BookOpen, FileEdit, CalendarCheck, Building2, Clock, User, ChevronRight, ShieldCheck, AlertCircle, RefreshCw, GraduationCap, Trophy } from "lucide-react";
import { api } from "../services/api";
import { formatGrade } from "../utils/academicEngine";

function StudentSectionRank() {
  const [position, setPosition] = useState(null);
  const [status, setStatus] = useState("loading");

  useEffect(() => {
    const controller = new AbortController();
    api.estudiantes.getMySectionRank(controller.signal).then(({ data }) => {
      if (controller.signal.aborted) return;
      setPosition(Number.isInteger(data?.posicion) && data.posicion > 0 ? data.posicion : null);
      setStatus("ready");
    }).catch(() => {
      if (!controller.signal.aborted) setStatus("error");
    });
    return () => controller.abort();
  }, []);

  const hasPosition = status === "ready" && position !== null;
  const isPodium = hasPosition && position <= 3;
  const message = status === "loading" ? "Consultando tu posición…" :
    status === "error" ? "Tu posición no está disponible en este momento." :
    !hasPosition ? "Tu posición aparecerá cuando tengas una calificación registrada." :
    position === 1 ? "¡Felicidades por el primer lugar! Sigue con esa constancia." :
    isPodium ? "¡Excelente trabajo! Estás entre los tres primeros de tu sección." :
    "Cada práctica cuenta. Sigue avanzando a tu ritmo y aprovecha las próximas evaluaciones.";

  return (
    <section className="student-dashboard__rank" data-podium={isPodium} aria-labelledby="student-rank-title">
      <div className="student-dashboard__rank-content" role="status">
        <div className="student-dashboard__rank-medallion">
          {hasPosition ? (
            <>
              <span>Puesto</span>
              <strong><span aria-hidden="true">#</span>{position}</strong>
            </>
          ) : <Trophy size={25} aria-hidden="true" />}
        </div>
        <div className="student-dashboard__rank-copy">
          <h4 id="student-rank-title">Tu posición en la sección</h4>
          <p>{message}</p>
        </div>
      </div>
    </section>
  );
}

export default function StudentDashboard({ summary, attendance, examStatus, section, loading, error, onNavigate }) {
  const sectionInfo = section && typeof section === "object" ? section : {};
  const maximum = Number(summary.maxPuntajeCarrera) || 0;
  const accumulated = Number(summary.total) || 0;
  const hasAttendance = attendance.totalSemanas > 0;
  const hasExams = summary.examenesList.length > 0;
  const actions = [
    { id: "calificaciones", title: "Mis calificaciones", description: "Consulta tus notas por parcial, manual y prueba.", Icon: Award },
    { id: "asistencia", title: "Mi asistencia", description: "Revisa los registros de tus prácticas de laboratorio.", Icon: CalendarCheck },
    { id: "pruebas", title: "Pruebas semanales", description: "Abre tus evaluaciones y consulta las entregas realizadas.", Icon: FileEdit }
  ];

  return <section className="student-dashboard" aria-label="Inicio del portal de estudiantes">

    {loading ? <div className="student-dashboard__loading" role="status"><RefreshCw size={24} className="animate-spin" /><p>Cargando tu resumen académico…</p></div> : !error && <>
      <div className="student-dashboard__overview">
        <section className="student-dashboard__score" aria-labelledby="student-score-title">
          <div className="student-dashboard__card-title"><span className="student-dashboard__icon"><GraduationCap size={22} /></span><div><h4 id="student-score-title">Nota acumulada</h4><p>Resumen del periodo completo</p></div></div>
          <div className="student-dashboard__total"><strong>{formatGrade(accumulated)}</strong>{maximum > 0 && <span>/ {formatGrade(maximum)} pts</span>}</div>
          {maximum > 0 && <progress max={maximum} value={Math.min(maximum, Math.max(0, accumulated))} aria-label="Puntos acumulados respecto al máximo del periodo" />}
          <p className="student-dashboard__score-note">Se actualiza con las calificaciones registradas por el instructor titular de tu sección.</p>
          <dl className="student-dashboard__breakdown">
            <div><dt><BookOpen size={15} />Oro manuales</dt><dd>{formatGrade(summary.notaOroManuales)}<small>/ {formatGrade(summary.maxNotaManuales)} pts</small></dd></div>
            <div><dt><FileEdit size={15} />Oro pruebas</dt><dd>{formatGrade(summary.notaOroPruebas)}<small>/ {formatGrade(summary.maxNotaPruebas)} pts</small></dd></div>
            <div><dt><Award size={15} />Exámenes</dt><dd>{formatGrade(summary.sumaExamenes)}<small>/ {formatGrade(summary.maxExamenesPuntaje)} pts</small></dd></div>
          </dl>
          <button type="button" className="student-dashboard__text-button" onClick={() => onNavigate("calificaciones")}>Ver desglose de calificaciones<ChevronRight size={16} /></button>
        </section>

        <section className="student-dashboard__attendance" aria-labelledby="student-attendance-title">
          <div className="student-dashboard__card-title"><span className="student-dashboard__icon"><CalendarCheck size={21} /></span><div><h4 id="student-attendance-title">Tus prácticas</h4><p>Asistencia registrada</p></div></div>
          <div className="student-dashboard__attendance-total"><strong>{hasAttendance ? attendance.asistenciasCount : "—"}</strong><span>{hasAttendance ? `asistencias de ${attendance.totalSemanas} registros` : "Aún no hay registros de asistencia"}</span></div>
          <dl className="student-dashboard__attendance-counts"><div><dt>Justificadas</dt><dd>{attendance.faltasJustificadas}</dd></div><div><dt>Injustificadas</dt><dd>{attendance.faltasInjustificadas}</dd></div></dl>
          {hasExams && hasAttendance && <div className="student-dashboard__exam-status" data-alert={examStatus.perdioAlguno}>{examStatus.perdioAlguno ? <AlertCircle size={18} /> : <ShieldCheck size={18} />}<div><strong>{examStatus.perdioAlguno ? "Revisa tu derecho a examen" : "Sin restricción por inasistencias"}</strong><p>{examStatus.perdioAlguno ? examStatus.titulo : "Según los registros de asistencia disponibles."}</p></div></div>}
          <button type="button" className="student-dashboard__text-button" onClick={() => onNavigate("asistencia")}>Ver mi asistencia<ChevronRight size={16} /></button>
        </section>
      </div>
      <StudentSectionRank />
    </>}

    <div className="student-dashboard__lower">
      <section className="student-dashboard__shortcuts" aria-labelledby="student-shortcuts-title"><h4 id="student-shortcuts-title">¿Qué quieres consultar?</h4><div>{actions.map(({ id, title, description, Icon }) => <button type="button" key={id} onClick={() => onNavigate(id)}><span className="student-dashboard__icon"><Icon size={22} /></span><span><strong>{title}</strong><small>{description}</small></span><ChevronRight size={18} /></button>)}</div></section>
      <aside className="student-dashboard__section" aria-labelledby="student-section-title"><h4 id="student-section-title">Tu sección de laboratorio</h4><dl><div><dt><Building2 size={16} />Sección</dt><dd>{sectionInfo.codigo || (typeof section === "string" ? section : "Sin asignar")}</dd></div><div><dt><Clock size={16} />Horario</dt><dd>{sectionInfo.dia || "Por confirmar"}{sectionInfo.hora_inicio && <span>{sectionInfo.hora_inicio}{sectionInfo.hora_fin ? ` – ${sectionInfo.hora_fin}` : ""}</span>}</dd></div><div><dt><GraduationCap size={16} />Catedrático</dt><dd>{sectionInfo.doctor_encargado || "Por confirmar"}</dd></div><div><dt><User size={16} />Titular de sección</dt><dd>{sectionInfo.coordinador || "Por confirmar"}</dd></div></dl><p>Para consultar sobre una nota o asistencia, comunícate con el instructor titular de tu sección.</p></aside>
    </div>
  </section>;
}
