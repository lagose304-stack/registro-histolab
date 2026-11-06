import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { GraduationCap, Search, Save, Users, ArrowLeft, ShieldCheck, Lock, CheckCircle2, Clock } from "lucide-react";
import { api } from "../services/api";
import {
  calculateStudentAcademicSummary,
  getCanonicalExamGrade, getExamMetadata, isExamWeek
} from "../utils/academicEngine";
import { hasFullSectionAccess } from "../utils/sectionRoleUtils";
import { displaySectionCode } from "../../../shared/sectionCode.mjs";
import "./WeeklyExamGradingView.css";

export default function WeeklyExamGradingView({
  seccion,
  currentInstructor,
  hideBackButton = false,
  onClose = () => {},
  notify = () => {}
}) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  const currentUser = currentInstructor || api.auth.getCurrentInstructor();
  const hasFullAccess = hasFullSectionAccess(currentUser, seccion);
  const [loadError, setLoadError] = useState("");
  const [saveError, setSaveError] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [editingAccount, setEditingAccount] = useState(null);
  const savedStudents = useRef([]);
  const loadEpoch = useRef(0);
  const editRevision = useRef(0);

  // Referencia estable de notify
  const notifyRef = useRef(notify);
  notifyRef.current = notify;

  // Bandera para inicializar semana por defecto una sola vez
  const hasInitializedWeekRef = useRef(false);

  // Datos
  const [estudiantes, setEstudiantes] = useState([]);
  const [semanasConfig, setSemanasConfig] = useState([]);
  const [temario, setTemario] = useState([]);
  const [asignaciones, setAsignaciones] = useState([]);

  // Selección de semana persistente por sección
  const [selectedSemana, setSelectedSemana] = useState(() => {
    try {
      const saved = sessionStorage.getItem(`histolab_examen_semana_${seccion?.id}`);
      return saved ? Number(saved) : null;
    } catch {
      return null;
    }
  });

  const handleSelectSemana = (num) => {
    const n = Number(num);
    if (saving || n === selectedSemana) return;
    if (hasUnsavedChanges) {
      if (!window.confirm("Hay notas sin guardar. ¿Descartar los cambios y cambiar de examen?")) return;
      setEstudiantes(savedStudents.current);
      setHasUnsavedChanges(false);
    }
    setSaveError("");
    setSelectedSemana(n);
    hasInitializedWeekRef.current = true;
    try {
      sessionStorage.setItem(`histolab_examen_semana_${seccion?.id}`, String(n));
    } catch (_) {}
  };

  const [configPuntajes, setConfigPuntajes] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");

  const carrera = seccion?.carrera || "Medicina";

  // 1. Cargar datos del servidor
  const loadData = useCallback(async (isInitial = false) => {
    if (!seccion?.id || !hasFullAccess) return;
    const requestEpoch = ++loadEpoch.current;
    const revision = editRevision.current;
    if (isInitial) setLoading(true);
    setLoadError("");

    try {
      const [resEst, resSemanas, resTemario, resAsig, resPuntajes] = await Promise.all([
        api.estudiantes.getBySeccion(seccion.id, carrera),
        api.semanas.getConfig(carrera),
        api.temario.getAll({ carrera }),
        api.asignaciones.getBySeccion(seccion.id),
        api.temario.getPuntajes(carrera)
      ]);
      if (requestEpoch !== loadEpoch.current || revision !== editRevision.current) return;

      if (resEst?.data) {
        const sorted = [...resEst.data].sort((a, b) =>
          (a.nombre_completo || "").localeCompare(b.nombre_completo || "")
        );
        setEstudiantes(sorted);
        savedStudents.current = sorted;
        setHasUnsavedChanges(false);
      }

      let loadedSemanas = [];
      if (resSemanas?.data) {
        loadedSemanas = resSemanas.data;
        setSemanasConfig(resSemanas.data);
      }

      if (resPuntajes?.data) {
        setConfigPuntajes(resPuntajes.data);
      }

      if (resTemario?.data) {
        setTemario(resTemario.data);
      }

      if (resAsig?.data || Array.isArray(resAsig)) {
        setAsignaciones(resAsig.data || resAsig);
      }

      // Identificar semanas de examen disponibles para seleccionar la primera por defecto
      if (!hasInitializedWeekRef.current) {
        const savedWeek = sessionStorage.getItem(`histolab_examen_semana_${seccion?.id}`);
        if (savedWeek) {
          setSelectedSemana(Number(savedWeek));
        } else {
          // Buscar la primera semana de examen configurada
          const examWeek = loadedSemanas.find(isExamWeek);

          if (examWeek && examWeek.numero_semana) {
            handleSelectSemana(Number(examWeek.numero_semana));
          } else if (loadedSemanas.length > 0) {
            // Si no hay marcada explícitamente, tomar semana 4 o primera semana
            const defaultWeek = loadedSemanas.find((s) => Number(s.numero_semana) === 4) || loadedSemanas[0];
            if (defaultWeek && defaultWeek.numero_semana) {
              handleSelectSemana(Number(defaultWeek.numero_semana));
            }
          } else {
            handleSelectSemana(4);
          }
        }
        hasInitializedWeekRef.current = true;
      }
    } catch (err) {
      if (requestEpoch !== loadEpoch.current) return;
      console.error("Error al cargar notas de examen parcial:", err);
      setLoadError("No pudimos cargar los estudiantes y las notas del examen. Inténtalo de nuevo.");
    } finally {
      if (requestEpoch === loadEpoch.current) setLoading(false);
    }
  }, [seccion?.id, carrera, hasFullAccess]);

  useEffect(() => {
    loadData(true);
    return () => { loadEpoch.current++; };
  }, [loadData]);

  // Helper para obtener el nombre visible de la semana
  const getWeekDisplayName = (w) => {
    if (!w) return "";
    const rawName = (w.nombre_semana || w.descripcion || "").trim();
    if (!rawName) return `Semana ${w.numero_semana}`;
    if (rawName.toLowerCase().startsWith("semana")) return rawName;
    return `Semana ${w.numero_semana}: ${rawName}`;
  };

  // Lista unificada de todas las semanas
  const allWeeks = useMemo(() => {
    const weekMap = new Map();

    semanasConfig.forEach((s) => {
      const num = Number(s.numero_semana);
      if (!num) return;
      const isExam = isExamWeek(s);

      const rawNombre = s.nombre_semana || s.descripcion || (isExam ? `Semana ${num} - Examen` : `Semana ${num}`);

      weekMap.set(num, {
        numero_semana: num,
        nombre_semana: rawNombre,
        parcial: s.parcial || "",
        fecha_inicio: s.fecha_inicio,
        fecha_fin: s.fecha_fin,
        esExamen: isExam,
        descripcion: rawNombre
      });
    });

    temario.forEach((t) => {
      const num = Number(t.semana);
      if (!num) return;
      if (!weekMap.has(num)) {
        weekMap.set(num, {
          numero_semana: num,
          parcial: num <= 4 ? "I Parcial" : num <= 8 ? "II Parcial" : "III Parcial",
          fecha_inicio: null,
          fecha_fin: null,
          esExamen: false,
          descripcion: `Semana ${num}`
        });
      }
    });

    // Si no hay semanas configuradas, fallback a 12 semanas con exámenes en 4, 8, 12
    if (weekMap.size === 0) {
      for (let i = 1; i <= 12; i++) {
        weekMap.set(i, {
          numero_semana: i,
          parcial: i <= 4 ? "I Parcial" : i <= 8 ? "II Parcial" : "III Parcial",
          esExamen: i === 4 || i === 8 || i === 12,
          descripcion: i === 4 || i === 8 || i === 12 ? `Semana ${i} - Examen` : `Semana ${i}`
        });
      }
    }

    return Array.from(weekMap.values()).sort((a, b) => a.numero_semana - b.numero_semana);
  }, [semanasConfig, temario]);

  // SEMANAS ASIGNADAS A EXAMEN PARCIAL (Las que sí importan para este módulo)
  const examWeeks = useMemo(() => {
    const list = allWeeks.filter((w) => w.esExamen);
    if (list.length > 0) return list;

    // Si ninguna semana está marcada explícitamente con examen, sugerir las semanas de corte de parcial
    return allWeeks.filter((w) => w.numero_semana === 4 || w.numero_semana === 8 || w.numero_semana === 12);
  }, [allWeeks]);

  // Información de la semana actualmente seleccionada
  const currentWeekInfo = useMemo(() => {
    const activeSem = selectedSemana || (examWeeks[0]?.numero_semana) || 4;
    const found = allWeeks.find((w) => w.numero_semana === activeSem);
    if (found) return found;
    return {
      numero_semana: activeSem,
      parcial: activeSem <= 4 ? "I Parcial" : activeSem <= 8 ? "II Parcial" : "III Parcial",
      esExamen: true,
      descripcion: `Semana ${activeSem}`
    };
  }, [allWeeks, examWeeks, selectedSemana]);

  // Determinación del examen correspondiente según la semana
  const examMeta = useMemo(() => {
    const semIndex = Math.max(0, examWeeks.findIndex(w => Number(w.numero_semana) === Number(currentWeekInfo.numero_semana)));
    const meta = getExamMetadata(currentWeekInfo, semIndex);
    const colors = [
      { badgeBg: "#fef3c7", badgeBorder: "#fde68a", badgeText: "#92400e" },
      { badgeBg: "#eff6ff", badgeBorder: "#bfdbfe", badgeText: "#1e40af" },
      { badgeBg: "#faf5ff", badgeBorder: "#d8b4fe", badgeText: "#6b21a8" }
    ];
    return { ...meta, id: meta.aliasKey || meta.key, parcial: meta.parcialName, ...colors[semIndex % colors.length] };
  }, [currentWeekInfo, examWeeks]);

  // Docente asignado al rol de "Subir nota de examen parcial"
  const assignedRecordForExam = useMemo(() => {
    // Buscar por ID de examen (examen_I, examen_II, examen_III) o por semana
    const semRef = `semana_${currentWeekInfo.numero_semana}`;
    return (
      asignaciones.find(
        (a) =>
          a.tipo_asignacion === "Subir nota de examen parcial" &&
          (a.referencia_id === examMeta.id || a.referencia_id === semRef)
      ) || null
    );
  }, [asignaciones, examMeta.id, currentWeekInfo.numero_semana]);

  const assignedInstructorForExam =
    assignedRecordForExam?.instructor_nombre || seccion?.coordinador || "Titular de sección";

  const canEdit = useMemo(() => {
    if (!currentWeekInfo.esExamen) return false;

    const user = currentInstructor || api.auth.getCurrentInstructor();
    if (!user) return false;
    if (hasFullSectionAccess(user, seccion)) return true;

    const userFullName = (user.nombre_completo || "").toLowerCase().trim();
    const userCombinedName = `${user.primer_nombre || ""} ${user.primer_apellido || ""}`.toLowerCase().trim();

    // Coincidencia con registro explícito de asignación
    if (assignedRecordForExam?.instructor_id) {
      if (user.id && String(user.id) === String(assignedRecordForExam.instructor_id)) {
        return true;
      }
      const targetName = (assignedRecordForExam.instructor_nombre || "").toLowerCase().trim();
      if (targetName && (userFullName === targetName || userCombinedName === targetName)) {
        return true;
      }
    }

    return false;
  }, [assignedRecordForExam, currentInstructor, seccion, currentWeekInfo.esExamen]);

  // Helper para leer la nota de examen de un estudiante
  const getStudentExamGrade = (est) => {
    if (!est) return "";
    // Conservar el texto provisional de este examen, identificado por su semana.
    if (typeof est.notas?.[examMeta.key] === "string") return est.notas[examMeta.key];
    const val = getCanonicalExamGrade(est, examMeta.index, currentWeekInfo);
    if (val === undefined || val === null || val === "") return "";
    return val;
  };

  // Helper para recalcular el total con precisión de 3 decimales (Suma de Exámenes + Nota Oro Manuales + Nota Oro Pruebas)
  const recalculateTotal = (est, updatedNotas, updatedExamCols = {}) => {
    const studentWithUpdatedExams = {
      ...est,
      ...updatedExamCols,
      notas: updatedNotas
    };
    const summary = calculateStudentAcademicSummary(
      studentWithUpdatedExams,
      configPuntajes,
      temario,
      semanasConfig,
      updatedNotas
    );
    return summary.total;
  };

  // Manejar cambio en la calificación de examen parcial con hasta 3 decimales
  const handleGradeChange = (numero_cuenta, rawValue) => {
    if (saving) return;
    if (!canEdit) {
      notifyRef.current(
        `Solo ${assignedInstructorForExam || "el docente asignado"} tiene permisos para editar las notas del ${examMeta.label}.`,
        "warning"
      );
      return;
    }

    const normalizedValue = String(rawValue).replace(",", ".");
    const cleanVal = normalizedValue.startsWith(".") ? `0${normalizedValue}` : normalizedValue;

    if (cleanVal === "") {
      editRevision.current++;
      setEstudiantes((prev) =>
        prev.map((est) => {
          if (est.numero_cuenta !== numero_cuenta) return est;
          const currentNotas = { ...(est.notas || {}) };
          delete currentNotas[examMeta.key];
          delete currentNotas[`examen_${currentWeekInfo.numero_semana}`];
          delete currentNotas[examMeta.columnKey];
          delete currentNotas[examMeta.id];

          const updatedExamCols = { [examMeta.columnKey]: 0 };
          const nextTotal = recalculateTotal(est, currentNotas, updatedExamCols);

          return {
            ...est,
            [examMeta.columnKey]: "",
            notas: currentNotas,
            total: nextTotal
          };
        })
      );
      setHasUnsavedChanges(true);
      return;
    }

    if (!/^\d+(\.\d{0,3})?$/.test(cleanVal) || !Number.isFinite(Number(cleanVal))) {
      return;
    }

    const storedVal = cleanVal;
    editRevision.current++;

    setEstudiantes((prev) =>
      prev.map((est) => {
        if (est.numero_cuenta !== numero_cuenta) return est;

        const currentNotas = est.notas || {};
        const updatedNotas = {
          ...currentNotas,
          [examMeta.key]: storedVal,
          [examMeta.columnKey]: storedVal,
          [examMeta.id]: storedVal
        };

        const updatedExamCols = { [examMeta.columnKey]: storedVal };
        const nextTotal = recalculateTotal(est, updatedNotas, updatedExamCols);

        return {
          ...est,
          [examMeta.columnKey]: storedVal,
          notas: updatedNotas,
          total: nextTotal
        };
      })
    );
    setHasUnsavedChanges(true);
  };

  // Guardar calificaciones en el backend
  const handleSaveAll = async () => {
    if (!seccion?.id || saving || !hasUnsavedChanges) return;
    if (!canEdit) {
      notifyRef.current(`No tienes permisos para guardar cambios en el ${examMeta.label}.`, "warning");
      return;
    }

    setSaving(true);
    setSaveError("");
    try {
      const updates = estudiantes.map((est) => ({
        numero_cuenta: est.numero_cuenta,
        notas: est.notas || {},
        asistencias: est.asistencias || {},
        primer_examen: est.primer_examen !== "" && est.primer_examen !== undefined ? Number(est.primer_examen) : 0,
        segundo_examen: est.segundo_examen !== "" && est.segundo_examen !== undefined ? Number(est.segundo_examen) : 0,
        tercer_examen: est.tercer_examen !== "" && est.tercer_examen !== undefined ? Number(est.tercer_examen) : 0,
        total: est.total ?? 0
      }));

      await api.estudiantes.saveBatch(seccion.id, updates, carrera);
      savedStudents.current = estudiantes;
      setHasUnsavedChanges(false);
      notifyRef.current(`¡Notas del ${examMeta.label} guardadas con éxito!`, "success");
    } catch (err) {
      console.error("Error al guardar notas de examen parcial:", err);
      setSaveError(err.message || "No pudimos guardar las notas. Tus cambios siguen aquí para reintentar.");
    } finally {
      setSaving(false);
    }
  };

  // Estadísticas del examen actual
  const stats = useMemo(() => {
    let totalPoints = 0;
    let gradedCount = 0;

    estudiantes.forEach((est) => {
      const val = getStudentExamGrade(est);
      if (val !== "" && val !== null && !isNaN(Number(val))) {
        totalPoints += Number(val);
        gradedCount++;
      }
    });

    const average = gradedCount > 0 ? (totalPoints / gradedCount).toFixed(3) : "0.000";

    return {
      gradedCount,
      pendingCount: estudiantes.length - gradedCount,
      average
    };
  }, [estudiantes, examMeta]);

  // Filtrado por búsqueda
  const filteredEstudiantes = useMemo(() => {
    const matchesStatus = estudiantes.filter(student => {
      const grade = getStudentExamGrade(student);
      const graded = grade !== "" && grade !== null;
      return student.numero_cuenta === editingAccount || statusFilter === "all" || (statusFilter === "graded" ? graded : !graded);
    });
    if (!searchTerm.trim()) return matchesStatus;
    const s = searchTerm.toLowerCase().trim();
    return matchesStatus.filter(
      (e) =>
        (e.nombre_completo || "").toLowerCase().includes(s) ||
        String(e.numero_cuenta || "").toLowerCase().includes(s)
    );
  }, [estudiantes, searchTerm, statusFilter, examMeta, editingAccount]);

  const discardChanges = () => {
    if (!window.confirm("¿Descartar las notas que todavía no has guardado?")) return;
    setEstudiantes(savedStudents.current);
    setHasUnsavedChanges(false);
    setSaveError("");
  };

  return (
    <section className="user-directory partial-grades" aria-labelledby="partial-grades-title">
      {!hideBackButton && <button type="button" className="user-button user-button--back" onClick={onClose}><ArrowLeft size={17} aria-hidden="true" /> Volver a módulos</button>}
      <header className="user-directory__hero">
        <div>
          <p className="user-directory__eyebrow"><GraduationCap size={18} aria-hidden="true" /> Sección {displaySectionCode(seccion?.codigo)} · {carrera}</p>
          <h2 id="partial-grades-title">Subir nota de examen parcial</h2>
          <p>Selecciona el examen y registra las calificaciones de tu sección.</p>
        </div>
      </header>
      {!hasFullAccess ? (
        <div className="user-directory__state"><Lock size={24} aria-hidden="true" /><h3>Acceso completo requerido</h3>
          <p>Disponible para el titular de sección y los usuarios con rol de Creador o Coordinador.</p></div>
      ) : loading ? (
        <div className="partial-grades__skeleton" role="status" aria-label="Cargando exámenes y calificaciones"><span /><span /><span /></div>
      ) : loadError ? (
        <div className="user-directory__state" role="alert"><p>{loadError}</p><button type="button" className="user-button" onClick={() => loadData(true)}>Reintentar</button></div>
      ) : !examWeeks.length ? <p className="user-directory__state">No hay semanas de examen disponibles para esta carrera.</p> : (
        <>
          <div className="partial-grades__overview">
            <div className="partial-grades__selection">
              <label className="user-field">Examen a calificar
                <select aria-label="Examen a calificar" value={currentWeekInfo.numero_semana} disabled={saving} onChange={event => handleSelectSemana(event.target.value)}>
                  {!examWeeks.some(week => week.numero_semana === currentWeekInfo.numero_semana) && <option value={currentWeekInfo.numero_semana}>Selecciona una semana de examen</option>}
                  {examWeeks.map(week => <option key={week.numero_semana} value={week.numero_semana}>{getWeekDisplayName(week)} · {week.parcial}</option>)}
                </select>
              </label>
              <p className="partial-grades__exam-name">{examMeta.label}</p>
              {currentWeekInfo.fecha_inicio && currentWeekInfo.fecha_fin && <p className="partial-grades__dates">{new Intl.DateTimeFormat("es-HN", { day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(currentWeekInfo.fecha_inicio + "T00:00:00Z"))} – {new Intl.DateTimeFormat("es-HN", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(currentWeekInfo.fecha_fin + "T00:00:00Z"))} · Semana académica</p>}
            </div>
            <div className="partial-grades__permission" data-editable={canEdit}>
              <strong>{canEdit ? <ShieldCheck size={20} aria-hidden="true" /> : <Lock size={20} aria-hidden="true" />}{canEdit ? "Puedes registrar calificaciones" : "Solo lectura"}</strong>
              <p>{canEdit ? "Tu acceso completo a la sección permite ingresar y modificar estas notas." : "Selecciona una semana de examen para registrar las calificaciones."}</p>
              <p>Titular de sección <b>{seccion?.coordinador || assignedInstructorForExam}</b></p>
              <small>Admite hasta 3 decimales. Una nota de 0 cuenta como calificada.</small>
            </div>
          </div>
          <dl className="partial-grades__stats" aria-label="Resumen de calificaciones">
            {[["Estudiantes", estudiantes.length, Users], ["Calificados", stats.gradedCount, CheckCircle2], ["Pendientes", stats.pendingCount, Clock], ["Promedio", stats.average, GraduationCap]].map(([label, value, Icon]) => (
              <div key={label}><dt><Icon size={16} aria-hidden="true" /> {label}</dt><dd>{value}</dd></div>
            ))}
          </dl>
          <section className="user-directory__results" aria-labelledby="exam-students-title">
            <div className="user-directory__toolbar">
              <div><h3 id="exam-students-title">Calificaciones por estudiante</h3><p>{filteredEstudiantes.length} de {estudiantes.length} estudiantes</p></div>
              <label className="user-directory__search"><Search size={17} aria-hidden="true" /><input type="search" aria-label="Buscar estudiante" placeholder="Nombre o cuenta" value={searchTerm} onChange={event => setSearchTerm(event.target.value)} /></label>
            </div>
            <div className="partial-grades__filters" role="group" aria-label="Filtrar calificaciones">
              {[["all", "Todos", estudiantes.length], ["pending", "Pendientes", stats.pendingCount], ["graded", "Calificados", stats.gradedCount]].map(([value, label, count]) => (
                <button type="button" key={value} aria-pressed={statusFilter === value} onClick={() => setStatusFilter(value)}>{label} <span>{count}</span></button>
              ))}
            </div>
            {!filteredEstudiantes.length ? <p className="user-directory__state">{estudiantes.length ? "Ningún estudiante coincide con los filtros." : "Aún no hay estudiantes matriculados en esta sección."}</p> : (
              <ul className="partial-grades__students">
                {filteredEstudiantes.map(student => {
                  const grade = getStudentExamGrade(student);
                  const graded = grade !== "" && grade !== null;
                  return (
                    <li className="partial-grades__student" data-graded={graded} key={student.numero_cuenta}>
                      <div className="partial-grades__student-info"><h4>{student.nombre_completo || "Sin nombre registrado"}</h4><p>Cuenta {student.numero_cuenta}</p>
                        <span>{graded ? <CheckCircle2 size={14} aria-hidden="true" /> : <Clock size={14} aria-hidden="true" />}{graded ? "Calificado" : "Pendiente"}</span></div>
                      <label className="user-field partial-grades__grade">Nota del examen
                        <input type="text" inputMode="decimal" value={grade} placeholder="Sin nota" disabled={!canEdit || saving}
                          aria-label={`Nota de ${student.nombre_completo || student.numero_cuenta}`}
                          onFocus={() => setEditingAccount(student.numero_cuenta)}
                          onChange={event => handleGradeChange(student.numero_cuenta, event.target.value)}
                          onBlur={() => {
                            if (typeof grade === "string" && grade.endsWith(".")) handleGradeChange(student.numero_cuenta, grade.slice(0, -1));
                            setEditingAccount(null);
                          }} />
                        <small>Puntos · hasta 3 decimales</small>
                      </label>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
          <footer className="partial-grades__save">
            {saveError && <p className="user-dialog__error" role="alert">{saveError}</p>}
            <div><p role="status">{hasUnsavedChanges ? "Cambios sin guardar" : "Sin cambios pendientes"}</p>
              <div>{hasUnsavedChanges && <button type="button" className="user-button" disabled={saving} onClick={discardChanges}>Descartar cambios</button>}
                <button type="button" className="user-button user-button--primary" disabled={!canEdit || saving || !hasUnsavedChanges} onClick={handleSaveAll}><Save size={17} aria-hidden="true" />{saving ? "Guardando…" : "Guardar notas del examen"}</button>
              </div>
            </div>
          </footer>
        </>
      )}
    </section>
  );
}
