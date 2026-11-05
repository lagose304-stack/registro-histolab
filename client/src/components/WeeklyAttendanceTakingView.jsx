import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { ArrowLeft, CalendarCheck, Check, Clock, Lock, Search, Save, Trash2, Users } from "lucide-react";
import { api } from "../services/api";
import { getAcademicDate, getCurrentAcademicWeek } from "../../../shared/academicWeek.mjs";
import { getAttendanceKeys, getAttendanceWindow } from "../../../shared/attendanceWindow.mjs";
import { displaySectionCode } from "../../../shared/sectionCode.mjs";
import { hasFullSectionAccess, isWeekAssignedToUser, matchesInstructor, SECTION_ROLES } from "../utils/sectionRoleUtils";
import "./WeeklyAttendanceTakingView.css";

const attendanceDateFormatter = new Intl.DateTimeFormat("es-HN", {
  timeZone: "America/Tegucigalpa", weekday: "short", day: "numeric", month: "short",
  hour: "numeric", minute: "2-digit", hour12: true
});

const ESTADOS_ASISTENCIA = {
  ASISTIO: "Asistio",
  INJUSTIFICADA: "Falta injustificada",
  JUSTIFICADA: "Falta justificada"
};

export default function WeeklyAttendanceTakingView({
  seccion,
  currentInstructor,
  hideBackButton = false,
  onClose = () => {},
  notify = () => {}
}) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [saveError, setSaveError] = useState("");
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [now, setNow] = useState(() => new Date());

  const currentUser = currentInstructor || api.auth.getCurrentInstructor();
  const hasFullAccess = useMemo(() => hasFullSectionAccess(currentUser, seccion), [currentUser, seccion]);

  // Bandera para no sobreescribir la semana elegida por el usuario
  const hasInitializedWeekRef = useRef(false);
  const savedStudents = useRef([]);

  // Datos
  const [estudiantes, setEstudiantes] = useState([]);
  const [semanasConfig, setSemanasConfig] = useState([]);
  const [temario, setTemario] = useState([]);
  const [asignaciones, setAsignaciones] = useState([]);
  const [attendanceEvents, setAttendanceEvents] = useState([]);

  // Selección de semana persistente por sección
  const [selectedSemana, setSelectedSemana] = useState(1);

  const discardChanges = () => {
    setEstudiantes(savedStudents.current);
    setHasUnsavedChanges(false);
    setSaveError("");
  };

  const handleSelectSemana = num => {
    if (hasUnsavedChanges && !window.confirm("Hay cambios sin guardar. ¿Quieres descartarlos y cambiar de semana?")) return;
    discardChanges();
    setSelectedSemana(Number(num));
  };

  const [searchTerm, setSearchTerm] = useState("");

  const carrera = seccion?.carrera || "Medicina";

  // 1. Cargar configuración académica, estudiantes y asignaciones
  const loadData = useCallback(async (isInitial = false) => {
    if (!seccion?.id) return;
    if (isInitial) setLoading(true);
    setLoadError("");

    try {
      const [resEst, resSemanas, resTemario, resAsig, resEvents] = await Promise.all([
        api.estudiantes.getBySeccion(seccion.id, carrera),
        api.semanas.getConfig(carrera),
        api.temario.getAll({ carrera }),
        api.asignaciones.getBySeccion(seccion.id),
        api.semanas.getSectionAttendanceEvents(seccion.id)
      ]);

      if (resEst?.data) {
        // Ordenar alfabéticamente por nombre_completo
        const sorted = [...resEst.data].sort((a, b) =>
          (a.nombre_completo || "").localeCompare(b.nombre_completo || "")
        );
        setEstudiantes(sorted);
        savedStudents.current = sorted;
      }

      if (resSemanas?.data) {
        setSemanasConfig(resSemanas.data);
      }

      if (resTemario?.data) {
        setTemario(resTemario.data);
      }

      if (resAsig?.data || Array.isArray(resAsig)) {
        setAsignaciones(resAsig.data || resAsig);
      }

      setAttendanceEvents(resEvents.data || []);

      // Solo elegir semana por defecto si no se había seleccionado ninguna previamente
      if (!hasInitializedWeekRef.current) {
        const schedule = resSemanas?.data || [];
        const replacementWeek = schedule.find(week => {
          const window = getAttendanceWindow(seccion, schedule, week.numero_semana, new Date(), resEvents.data || []);
          return window.isReplacement && window.scheduledDate === getAcademicDate();
        });
        const actual = replacementWeek || getCurrentAcademicWeek(schedule) || schedule.find(week => week.es_semana_actual);
        if (actual) setSelectedSemana(Number(actual.numero_semana));
        else if (schedule.length) setSelectedSemana(Number(schedule[0].numero_semana));
        hasInitializedWeekRef.current = true;
      }
    } catch (err) {
      console.error("Error al cargar lista de estudiantes:", err);
      setLoadError("No pudimos cargar los estudiantes y sus asignaciones.");
    } finally {
      setLoading(false);
    }
  }, [seccion?.id, carrera]);

  // Cargar una única vez al montar o cambiar sección
  useEffect(() => {
    loadData(true);
  }, [loadData]);

  // Helper para obtener el nombre visible de la semana
  const getWeekDisplayName = (w) => {
    if (!w) return "";
    const rawName = (w.nombre_semana || w.descripcion || "").trim();
    if (!rawName) return `Semana ${w.numero_semana}`;
    if (rawName.toLowerCase().startsWith("semana")) return rawName;
    return `Semana ${w.numero_semana}: ${rawName}`;
  };

  // Lista unificada de semanas (todas)
  const allAvailableWeeks = useMemo(() => {
    const weekMap = new Map();

    semanasConfig.forEach((s) => {
      const num = Number(s.numero_semana);
      if (!num) return;
      const rawNombre = s.nombre_semana || s.descripcion || (Boolean(s.es_examen) ? `Semana ${num} (Examen)` : `Semana ${num}`);
      weekMap.set(num, {
        numero_semana: num,
        nombre_semana: rawNombre,
        parcial: s.parcial || "I Parcial",
        fecha_inicio: s.fecha_inicio,
        fecha_fin: s.fecha_fin,
        esExamen: Boolean(s.es_examen) || (s.temas || "").toUpperCase().includes("EXAMEN"),
        descripcion: rawNombre
      });
    });

    temario.forEach((t) => {
      const num = Number(t.semana);
      if (!num) return;
      if (!weekMap.has(num)) {
        weekMap.set(num, {
          numero_semana: num,
          nombre_semana: `Semana ${num}`,
          parcial: num <= 4 ? "I Parcial" : num <= 8 ? "II Parcial" : "III Parcial",
          fecha_inicio: null,
          fecha_fin: null,
          esExamen: false,
          descripcion: `Semana ${num}`
        });
      }
    });

    if (weekMap.size === 0) {
      weekMap.set(1, { numero_semana: 1, nombre_semana: "Semana 1", parcial: "I Parcial", descripcion: "Semana 1" });
    }

    return Array.from(weekMap.values()).sort((a, b) => a.numero_semana - b.numero_semana);
  }, [semanasConfig, temario]);

  // Semanas filtradas por rol del usuario (el titular ve todas; los asignados solo sus semanas asignadas)
  const availableWeeks = useMemo(() => {
    if (hasFullAccess) return allAvailableWeeks;
    return allAvailableWeeks.filter((w) =>
      isWeekAssignedToUser(asignaciones, SECTION_ROLES.ASISTENCIA, w.numero_semana, currentUser, seccion)
    );
  }, [allAvailableWeeks, hasFullAccess, asignaciones, currentUser, seccion]);

  // Si la semana seleccionada no está entre las disponibles, ajustar a la primera
  useEffect(() => {
    if (availableWeeks.length > 0 && !availableWeeks.some((w) => w.numero_semana === selectedSemana)) {
      setSelectedSemana(availableWeeks[0].numero_semana);
    }
  }, [availableWeeks, selectedSemana]);

  // Docente asignado a pasar asistencia en esta semana (de Proporcionar Asignaciones)
  const assignedRecordForWeek = useMemo(() => {
    const targetRef = `semana_${selectedSemana}`;
    return asignaciones.find(
      (a) => a.tipo_asignacion === "Pasar lista de asistencia semanal" && a.referencia_id === targetRef
    ) || null;
  }, [asignaciones, selectedSemana]);

  const assignedInstructorForWeek = assignedRecordForWeek?.instructor_nombre || null;

  // 🛡️ REGLA ESTRICTA: El usuario solo puede editar la lista de asistencia si fue asignado a esa semana o es titular
  const hasAssignmentPermission = useMemo(() => {
    if (hasFullAccess) return true;
    if (!assignedRecordForWeek || !assignedRecordForWeek.instructor_id) {
      // Si nadie ha sido asignado a esta semana en "Proporcionar Asignaciones", está bloqueado para edición
      return false;
    }
    return matchesInstructor(currentUser, assignedRecordForWeek.instructor_id, assignedRecordForWeek.instructor_nombre, seccion);
  }, [assignedRecordForWeek, currentUser, seccion, hasFullAccess]);

  const attendanceWindow = getAttendanceWindow(seccion, semanasConfig, selectedSemana, now, attendanceEvents);
  const canEdit = hasAssignmentPermission && attendanceWindow.isOpen;
  const currentAcademicWeek = getCurrentAcademicWeek(semanasConfig, getAcademicDate(now));
  const selectedWeek = availableWeeks.find(week => Number(week.numero_semana) === selectedSemana);
  useEffect(() => {
    const boundaries = [attendanceWindow.opensAt, attendanceWindow.closesAt]
      .filter(Boolean).map(value => Date.parse(value) - now.getTime() + 1).filter(delay => delay > 0);
    const timer = setTimeout(() => setNow(new Date()), Math.min(60_000, ...boundaries));
    const refresh = () => setNow(new Date());
    window.addEventListener("focus", refresh);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("focus", refresh);
    };
  }, [attendanceWindow.opensAt, attendanceWindow.closesAt, now]);

  const attendanceKeys = getAttendanceKeys(semanasConfig.find(week => Number(week.numero_semana) === selectedSemana) ||
    { numero_semana: selectedSemana });

  const getStudentAsistenciaVal = student => {
    for (const key of attendanceKeys) {
      if (Object.hasOwn(student.asistencias || {}, key)) return student.asistencias[key];
    }
    return student[`Asistencia de la semana ${selectedSemana}`] ?? null;
  };

  // Marcar la asistencia de un estudiante con una de las 3 casillas
  const handleSelectStatus = (numero_cuenta, nuevoEstado) => {
    if (!canEdit) {
      notify(
        `Solo ${assignedInstructorForWeek || "el docente asignado"} tiene permisos para editar la lista en la Semana ${selectedSemana}.`,
        "warning"
      );
      return;
    }

    setEstudiantes((prev) =>
      prev.map((est) => {
        if (est.numero_cuenta !== numero_cuenta) return est;

        const currentVal = getStudentAsistenciaVal(est);
        // Si vuelve a hacer clic sobre la misma casilla, se deselecciona (queda sin marcar)
        const finalVal = currentVal === nuevoEstado ? null : nuevoEstado;

        const updatedAsist = {
          ...(est.asistencias || {}),
          ...Object.fromEntries(attendanceKeys.map(key => [key, finalVal]))
        };

        return {
          ...est,
          asistencias: updatedAsist
        };
      })
    );
    setHasUnsavedChanges(true);
  };

  // Acción rápida: Marcar todos como "Asistencia"
  const handleMarkAllAsistio = () => {
    if (!canEdit) {
      notify(
        `Solo ${assignedInstructorForWeek || "el docente asignado"} puede modificar la asistencia en la Semana ${selectedSemana}.`,
        "warning"
      );
      return;
    }

    setEstudiantes((prev) =>
      prev.map((est) => {
        const updatedAsist = {
          ...(est.asistencias || {}),
          ...Object.fromEntries(attendanceKeys.map(key => [key, ESTADOS_ASISTENCIA.ASISTIO]))
        };
        return {
          ...est,
          asistencias: updatedAsist
        };
      })
    );
    setHasUnsavedChanges(true);
    notify(`Todos los alumnos marcados como Asistencia para la Semana ${selectedSemana}`, "info");
  };

  // Acción rápida: Limpiar semana (dejar sin marcar)
  const handleClearWeek = () => {
    if (!canEdit) {
      notify(
        `Solo ${assignedInstructorForWeek || "el docente asignado"} puede modificar la asistencia en la Semana ${selectedSemana}.`,
        "warning"
      );
      return;
    }

    setEstudiantes((prev) =>
      prev.map((est) => {
        const updatedAsist = {
          ...(est.asistencias || {}),
          ...Object.fromEntries(attendanceKeys.map(key => [key, null]))
        };
        return {
          ...est,
          asistencias: updatedAsist
        };
      })
    );
    setHasUnsavedChanges(true);
    notify(`Se limpió la lista de la Semana ${selectedSemana}`, "info");
  };

  // Guardar lista de asistencia en el backend
  const handleSaveAll = async () => {
    if (!seccion?.id) return;
    if (!hasAssignmentPermission || !getAttendanceWindow(seccion, semanasConfig, selectedSemana, new Date(), attendanceEvents).isOpen) {
      setNow(new Date());
      notify("La lista solo puede guardarse durante su horario habilitado.", "warning");
      return;
    }

    if (saving || !estudiantes.length) return;
    setSaving(true);
    setSaveError("");
    try {
      const previous = new Map(savedStudents.current.map(student =>
        [String(student.numero_cuenta), getStudentAsistenciaVal(student)]));
      const updates = estudiantes.filter(student =>
        getStudentAsistenciaVal(student) !== previous.get(String(student.numero_cuenta))
      ).map(student => ({
        numero_cuenta: student.numero_cuenta,
        estado: getStudentAsistenciaVal(student)
      }));
      if (!updates.length) {
        setHasUnsavedChanges(false);
        return;
      }

      await api.estudiantes.saveAttendance(seccion.id, selectedSemana, updates);
      savedStudents.current = estudiantes;
      setHasUnsavedChanges(false);
      notify("¡Lista de asistencia guardada con éxito!", "success");
    } catch (err) {
      console.error("Error al guardar asistencia:", err);
      setSaveError(err.message || "No pudimos guardar la asistencia. Inténtalo de nuevo.");
    } finally {
      setSaving(false);
    }
  };

  // Estadísticas de la semana seleccionada
  const stats = useMemo(() => {
    let asistioCount = 0;
    let injustificadaCount = 0;
    let justificadaCount = 0;
    let sinMarcarCount = 0;

    estudiantes.forEach((est) => {
      const val = getStudentAsistenciaVal(est);
      if (val === ESTADOS_ASISTENCIA.ASISTIO) asistioCount++;
      else if (val === ESTADOS_ASISTENCIA.INJUSTIFICADA) injustificadaCount++;
      else if (val === ESTADOS_ASISTENCIA.JUSTIFICADA) justificadaCount++;
      else sinMarcarCount++;
    });

    return {
      total: estudiantes.length,
      asistioCount,
      injustificadaCount,
      justificadaCount,
      sinMarcarCount
    };
  }, [estudiantes, selectedSemana, semanasConfig]);

  // Filtrado por búsqueda
  const filteredEstudiantes = useMemo(() => {
    if (!searchTerm.trim()) return estudiantes;
    const s = searchTerm.toLowerCase().trim();
    return estudiantes.filter(
      (e) =>
        (e.nombre_completo || "").toLowerCase().includes(s) ||
        String(e.numero_cuenta || "").toLowerCase().includes(s)
    );
  }, [estudiantes, searchTerm]);

  const statuses = [
    { value: ESTADOS_ASISTENCIA.ASISTIO, label: "Asistió", kind: "present" },
    { value: ESTADOS_ASISTENCIA.INJUSTIFICADA, label: "Falta injustificada", kind: "absent" },
    { value: ESTADOS_ASISTENCIA.JUSTIFICADA, label: "Falta justificada", kind: "justified" }
  ];

  return (
    <section className="user-directory weekly-attendance" aria-labelledby="weekly-attendance-title">
      {!hideBackButton && (
        <button type="button" className="user-button user-button--back" onClick={onClose}>
          <ArrowLeft size={17} aria-hidden="true" /> Volver a módulos
        </button>
      )}
      <header className="user-directory__hero">
        <div>
          <p className="user-directory__eyebrow"><CalendarCheck size={17} aria-hidden="true" /> Sección {displaySectionCode(seccion?.codigo)} · {carrera}</p>
          <h2 id="weekly-attendance-title">Pasar lista de asistencia</h2>
          <p>Selecciona la semana y marca el estado de cada estudiante.</p>
        </div>
      </header>

      {loading ? (
        <p className="user-directory__state" role="status">Cargando estudiantes y asistencia…</p>
      ) : loadError ? (
        <div className="user-directory__state" role="alert">
          <p>{loadError}</p>
          <button type="button" className="user-button" onClick={() => loadData(true)}>Reintentar</button>
        </div>
      ) : availableWeeks.length === 0 ? (
        <div className="user-directory__state">
          <h3>No tienes semanas asignadas para pasar asistencia</h3>
          <p>El titular puede asignarte esta tarea desde Proporcionar asignaciones.</p>
        </div>
      ) : (
        <>
          <div className="weekly-attendance__controls">
            <div className="weekly-attendance__week-picker">
              <div className="weekly-attendance__control-heading">
                <CalendarCheck size={19} aria-hidden="true" />
                <span>Semana de trabajo</span>
                <span className="weekly-attendance__week-badge">{attendanceWindow.isReplacement ? "Reposición" : attendanceWindow.isExam ? "Examen" : attendanceWindow.isCurrentWeek ? "Semana actual" : "Consulta"}</span>
              </div>
            <label className="user-field">
              Semana de asistencia
              <select value={selectedSemana} disabled={saving}
                onChange={event => handleSelectSemana(event.target.value)}>
                {availableWeeks.map(week => (
                  <option key={week.numero_semana} value={week.numero_semana}>
                    {getWeekDisplayName(week)} · {week.parcial}{Number(currentAcademicWeek?.numero_semana) === Number(week.numero_semana) ? " · Actual" : ""}
                  </option>
                ))}
              </select>
            </label>
              <p className="weekly-attendance__week-detail">{selectedWeek?.parcial}</p>
              <p className="weekly-attendance__assigned">
                <Users size={16} aria-hidden="true" />
                {assignedInstructorForWeek ? `Docente asignado · ${assignedInstructorForWeek}`
                  : hasFullAccess ? "Acceso completo a la sección" : "Sin docente asignado"}
              </p>
            </div>
            <div className="weekly-attendance__permission" role="status" data-open={canEdit}>
              <div className="weekly-attendance__control-heading">
                {canEdit ? <Check size={19} aria-hidden="true" /> : <Lock size={19} aria-hidden="true" />}
                <strong>{canEdit ? "Lista habilitada" : "Lista cerrada"}</strong>
              </div>
              {attendanceWindow.isExam && (
                <p className="weekly-attendance__replacement">Horario del calendario de exámenes</p>
              )}
              {attendanceWindow.isReplacement && (
                <p className="weekly-attendance__replacement">Horario reprogramado · asistencia de la semana {selectedSemana}</p>
              )}
              <p>{attendanceWindow.reason}</p>
              {attendanceWindow.opensAt && (
                <dl className="weekly-attendance__window">
                  <div><dt><Clock size={14} aria-hidden="true" /> Apertura</dt><dd>{attendanceDateFormatter.format(new Date(attendanceWindow.opensAt))}</dd></div>
                  <div><dt><Clock size={14} aria-hidden="true" /> Cierre</dt><dd>{attendanceDateFormatter.format(new Date(attendanceWindow.closesAt))}</dd></div>
                </dl>
              )}
              <small>Horario de Honduras · margen de 10 minutos</small>
            </div>
          </div>

          <dl className="weekly-attendance__stats" aria-label="Resumen de asistencia">
            {[
              ["Estudiantes", stats.total], ["Asistieron", stats.asistioCount],
              ["Faltas injustificadas", stats.injustificadaCount],
              ["Faltas justificadas", stats.justificadaCount], ["Sin marcar", stats.sinMarcarCount]
            ].map(([label, count], index) => <div key={label} data-stat={index}><dt>{label}</dt><dd>{count}</dd></div>)}
          </dl>

          <section className="user-directory__results" aria-labelledby="attendance-students-title">
            <div className="user-directory__toolbar">
              <div><h3 id="attendance-students-title">Lista de estudiantes</h3><p>{filteredEstudiantes.length} de {estudiantes.length}</p></div>
              <label className="user-directory__search">
                <Search size={17} aria-hidden="true" />
                <input type="search" aria-label="Buscar estudiante por nombre o cuenta" placeholder="Buscar estudiante"
                  value={searchTerm} onChange={event => setSearchTerm(event.target.value)} />
              </label>
            </div>

            <div className="weekly-attendance__bulk">
              <button type="button" className="user-button" disabled={!canEdit || saving || !estudiantes.length} onClick={handleMarkAllAsistio}>
                <Users size={17} aria-hidden="true" /> Marcar todos como asistieron
              </button>
              <button type="button" className="user-button user-button--danger" disabled={!canEdit || saving || !estudiantes.length}
                onClick={handleClearWeek}>
                <Trash2 size={17} aria-hidden="true" /> Limpiar semana
              </button>
              <p>Estas acciones incluyen a todos los estudiantes, aunque tengas una búsqueda activa.</p>
            </div>

            {filteredEstudiantes.length === 0 ? (
              <p className="user-directory__state" role="status">{estudiantes.length
                ? "Ningún estudiante coincide con la búsqueda." : "Aún no hay estudiantes matriculados en esta sección."}</p>
            ) : (
              <ul className="weekly-attendance__students">
                {filteredEstudiantes.map(student => {
                  const currentStatus = getStudentAsistenciaVal(student);
                  return (
                    <li className="weekly-attendance__student" data-state={statuses.find(status => status.value === currentStatus)?.kind || "pending"} key={student.numero_cuenta}>
                      <div>
                        <h4>{student.nombre_completo || "Sin nombre registrado"}</h4>
                        <p>Cuenta {student.numero_cuenta}</p>
                        <span className="weekly-attendance__current">{currentStatus || "Sin marcar"}</span>
                      </div>
                      <div className="weekly-attendance__statuses" role="group" aria-label={`Asistencia de ${student.nombre_completo || student.numero_cuenta}`}>
                        {statuses.map(status => (
                          <button type="button" key={status.value} className="weekly-attendance__status" data-kind={status.kind}
                            aria-pressed={currentStatus === status.value} disabled={!canEdit || saving}
                            onClick={() => handleSelectStatus(student.numero_cuenta, status.value)}>
                            {currentStatus === status.value && <Check size={16} aria-hidden="true" />}
                            {status.label}
                          </button>
                        ))}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          <footer className="weekly-attendance__save">
            {saveError && <p className="user-dialog__error" role="alert">{saveError}</p>}
            <div>
              <p role="status">{hasUnsavedChanges ? "Cambios sin guardar." : "Sin cambios pendientes"}</p>
              <div className="weekly-attendance__save-actions">
              {hasUnsavedChanges && (
                <button type="button" className="user-button" disabled={saving} onClick={discardChanges}>Descartar cambios</button>
              )}
              <button type="button" className="user-button user-button--primary" onClick={handleSaveAll}
                disabled={!canEdit || saving || !hasUnsavedChanges || !estudiantes.length}>
                <Save size={17} aria-hidden="true" /> {saving ? "Guardando…" : "Guardar asistencia"}
              </button>
              </div>
            </div>
          </footer>
        </>
      )}
    </section>
  );
}
