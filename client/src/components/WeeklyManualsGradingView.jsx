import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { ArrowLeft, BookOpen, Calendar, Clock, Save, Search, Users } from "lucide-react";
import { api } from "../services/api";
import { getCanonicalManualGrade } from "../utils/academicEngine";
import { canViewSection } from "../../../shared/sectionAccess.mjs";
import { getManualsWindow } from "../../../shared/manualsWindow.mjs";
import { getCurrentAcademicWeek } from "../../../shared/academicWeek.mjs";
import { displaySectionCode } from "../../../shared/sectionCode.mjs";
import "./WeeklyManualsGradingView.css";

const dateTimeFormatter = new Intl.DateTimeFormat("es-HN", {
  timeZone: "America/Tegucigalpa", weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit", hour12: true
});
const dateFormatter = new Intl.DateTimeFormat("es-HN", {
  timeZone: "UTC", weekday: "long", day: "numeric", month: "long", year: "numeric"
});

export default function WeeklyManualsGradingView({
  seccion,
  currentInstructor,
  hideBackButton = false,
  onClose = () => {},
  notify = () => {}
}) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [saveError, setSaveError] = useState("");
  const [deadlines, setDeadlines] = useState([]);
  const [events, setEvents] = useState([]);
  const [now, setNow] = useState(() => new Date());
  const savedStudents = useRef([]);

  const currentUser = currentInstructor || api.auth.getCurrentInstructor();
  const canGradeManuals = canViewSection(currentUser, seccion);

  // Referencia estable de notify
  const notifyRef = useRef(notify);
  notifyRef.current = notify;

  // Bandera para inicializar semana por defecto una sola vez
  const hasInitializedWeekRef = useRef(false);

  // Datos
  const [estudiantes, setEstudiantes] = useState([]);
  const [semanasConfig, setSemanasConfig] = useState([]);
  const [temario, setTemario] = useState([]);

  const [selectedSemana, setSelectedSemana] = useState(1);
  const discardChanges = () => {
    setEstudiantes(savedStudents.current);
    setHasUnsavedChanges(false);
    setSaveError("");
  };
  const handleSelectSemana = value => {
    if (hasUnsavedChanges && !window.confirm("Hay notas sin guardar. ¿Quieres descartarlas y cambiar de semana?")) return;
    discardChanges();
    setSelectedSemana(Number(value));
  };

  const [searchTerm, setSearchTerm] = useState("");

  const carrera = seccion?.carrera || "Medicina";

  // 1. Cargar datos del servidor
  const loadData = useCallback(async (isInitial = false) => {
    if (!seccion?.id) return;
    if (isInitial) setLoading(true);
    setLoadError("");

    try {
      const [resEst, resSchedule, resTemario] = await Promise.all([
        api.estudiantes.getBySeccion(seccion.id, carrera),
        api.estudiantes.getManualSchedule(seccion.id),
        api.temario.getAll({ carrera })
      ]);
      const schedule = resSchedule.weeks || [];
      setSemanasConfig(schedule);
      setEvents(resSchedule.events || []);
      setDeadlines(resSchedule.data || []);

      if (resEst?.data) {
        // Ordenar alfabéticamente por nombre_completo
        const sorted = [...resEst.data].sort((a, b) =>
          (a.nombre_completo || "").localeCompare(b.nombre_completo || "")
        );
        setEstudiantes(sorted);
        savedStudents.current = sorted;
      }

      if (resTemario?.data) {
        setTemario(resTemario.data);
      }

      if (!hasInitializedWeekRef.current) {
        const openWeek = schedule.find(week =>
          getManualsWindow(seccion, schedule, week.numero_semana, new Date(),
            resSchedule.events || [], resSchedule.data || []).isOpen);
        const current = getCurrentAcademicWeek(schedule);
        const previous = schedule.filter(week => !week.es_examen && week.temas !== "EXAMEN" &&
          Number(week.numero_semana) < Number(current?.numero_semana)).sort((a, b) => b.numero_semana - a.numero_semana)[0];
        const initial = openWeek || previous || schedule.find(week => !week.es_examen && week.temas !== "EXAMEN");
        if (initial) setSelectedSemana(Number(initial.numero_semana));
        hasInitializedWeekRef.current = true;
      }
    } catch (err) {
      console.error("Error al cargar notas de manuales:", err);
      setLoadError("No pudimos cargar los manuales y su programación.");
    } finally {
      setLoading(false);
    }
  }, [seccion?.id, carrera]);

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

  // Semanas disponibles con manual (todas)
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
      weekMap.set(1, { numero_semana: 1, nombre_semana: "Semana 1", parcial: "I Parcial", descripcion: "Semana 1", esExamen: false });
    }

    // Regla: En semana de examen no hay manuales evaluables
    return Array.from(weekMap.values())
      .filter((w) => !w.esExamen)
      .sort((a, b) => a.numero_semana - b.numero_semana);
  }, [semanasConfig, temario]);

  const availableWeeks = canGradeManuals ? allAvailableWeeks : [];

  // Si la semana seleccionada coincide con un examen o no está en las disponibles, ajustar
  useEffect(() => {
    if (availableWeeks.length > 0 && !availableWeeks.some((w) => w.numero_semana === selectedSemana)) {
      setSelectedSemana(availableWeeks[0].numero_semana);
    }
  }, [availableWeeks, selectedSemana]);

  // Información de la semana seleccionada
  const currentWeekInfo = useMemo(() => {
    return availableWeeks.find((w) => w.numero_semana === selectedSemana) || {
      numero_semana: selectedSemana,
      nombre_semana: `Semana ${selectedSemana}`,
      parcial: "I Parcial",
      descripcion: `Semana ${selectedSemana}`,
      esExamen: false
    };
  }, [availableWeeks, selectedSemana]);

  // TEMAS CON MANUAL EVALUABLE PROGRAMADOS PARA ESTA SEMANA
  const weekTopics = useMemo(() => {
    if (currentWeekInfo.esExamen) return [];
    return temario
      .filter((t) => Number(t.semana) === Number(selectedSemana) && t.tiene_manual !== false)
      .sort((a, b) => (Number(a.numero_tema) || 0) - (Number(b.numero_tema) || 0));
  }, [temario, selectedSemana, currentWeekInfo.esExamen]);

  const manualWindow = getManualsWindow(seccion, semanasConfig, selectedSemana, now, events, deadlines);
  const canEdit = canGradeManuals && manualWindow.isOpen;
  useEffect(() => {
    const delays = [manualWindow.opensAt, manualWindow.closesAt].filter(Boolean)
      .map(value => Date.parse(value) - now.getTime() + 1).filter(value => value > 0);
    const timer = setTimeout(() => setNow(new Date()), Math.min(60_000, ...delays));
    const refresh = () => setNow(new Date());
    window.addEventListener("focus", refresh);
    return () => { clearTimeout(timer); window.removeEventListener("focus", refresh); };
  }, [manualWindow.opensAt, manualWindow.closesAt, now]);
  // Helper para leer la nota de manual de un estudiante para un tema
  const getStudentManualGrade = (est, tema) => {
    if (!est) return "";
    if (Object.hasOwn(est.notas || {}, `manual_${tema.id}`)) return est.notas[`manual_${tema.id}`] ?? "";
    const val = getCanonicalManualGrade(est.notas || {}, tema, est);
    if (val === undefined || val === null || val === "") return "";
    return val;
  };

  // Manejar cambio en la calificación de un manual con soporte para hasta 3 decimales (Máx. 1.000 pt)
  const handleGradeChange = (numero_cuenta, tema, rawValue) => {
    if (!canEdit) {
      notifyRef.current(
        "Elige una semana de clase para registrar notas de manuales.",
        "warning"
      );
      return;
    }

    // Normalizar comas a puntos
    const cleanVal = String(rawValue).replace(",", ".");

    // Permitir limpiar el campo
    if (cleanVal === "") {
      setEstudiantes((prev) =>
        prev.map((est) => {
          if (est.numero_cuenta !== numero_cuenta) return est;
          const currentNotas = { ...(est.notas || {}) };
          currentNotas[`manual_${tema.id}`] = null;
          delete currentNotas[`manual_tema_${tema.numero_tema}`];

          return { ...est, notas: currentNotas };
        })
      );
      setHasUnsavedChanges(true);
      return;
    }

    // Permitir solo números válidos con hasta 3 decimales (ej: "0.85", "1", "1.000")
    if (!/^\d*(\.\d{0,3})?$/.test(cleanVal)) {
      return;
    }

    const numVal = parseFloat(cleanVal);
    // REGLA: Notas de manuales su valor no puede pasar de 1 punto (no mayor a 1, máximo 1)
    if (!cleanVal.endsWith(".") && numVal > 1) {
      notifyRef.current("La nota del manual no puede ser mayor a 1 punto (máximo 1.000).", "warning");
      return;
    }

    // Si termina en punto (ej: "1."), permitir escribir mientras el usuario teclea
    const storedVal = cleanVal.endsWith(".") ? cleanVal : Number(cleanVal);

    setEstudiantes((prev) =>
      prev.map((est) => {
        if (est.numero_cuenta !== numero_cuenta) return est;

        const currentNotas = { ...(est.notas || {}) };
        const keyId = `manual_${tema.id}`;
        delete currentNotas[`manual_tema_${tema.numero_tema}`];

        const updatedNotas = {
          ...currentNotas,
          [keyId]: storedVal
        };


        return {
          ...est,
          notas: updatedNotas
        };
      })
    );
    setHasUnsavedChanges(true);
  };

  // Asignar nota rápida a todos los alumnos en un tema específico con hasta 3 decimales (Máx. 1.000 pt)
  const handleBatchGradeTopic = (tema) => {
    if (!canEdit) {
      notifyRef.current("No tienes permisos para modificar notas en esta semana.", "warning");
      return;
    }

    const defaultScoreStr = window.prompt(
      `Ingresa la calificación a aplicar a TODOS los alumnos para el Manual de ${tema.titulo} (Máximo 1.000 pt):`,
      "1.000"
    );

    if (defaultScoreStr === null) return;
    const cleanStr = defaultScoreStr.replace(",", ".");
    const num = Number(cleanStr);
    if (isNaN(num) || num < 0 || num > 1) {
      notifyRef.current("La nota del manual no puede ser mayor a 1 punto (máximo 1.000).", "error");
      return;
    }

    const roundedNum = Math.round(num * 1000) / 1000;

    setEstudiantes((prev) =>
      prev.map((est) => {
        const currentNotas = { ...(est.notas || {}) };
        const keyId = `manual_${tema.id}`;
        delete currentNotas[`manual_tema_${tema.numero_tema}`];

        const updatedNotas = {
          ...currentNotas,
          [keyId]: roundedNum
        };


        return {
          ...est,
          notas: updatedNotas
        };
      })
    );
    setHasUnsavedChanges(true);
    notifyRef.current(`Nota ${roundedNum} aplicada a todos los alumnos para ${tema.titulo}`, "info");
  };

  // Limpiar notas de manuales de esta semana
  const handleClearWeekManuals = () => {
    if (!canEdit) {
      notifyRef.current("No tienes permisos para modificar notas en esta semana.", "warning");
      return;
    }

    if (!window.confirm(`¿Seguro que deseas limpiar las notas de manuales de la Semana ${selectedSemana}?`)) {
      return;
    }

    setEstudiantes((prev) =>
      prev.map((est) => {
        const updatedNotas = { ...(est.notas || {}) };
        weekTopics.forEach((t) => {
          updatedNotas[`manual_${t.id}`] = null;
          delete updatedNotas[`manual_tema_${t.numero_tema}`];
        });


        return {
          ...est,
          notas: updatedNotas
        };
      })
    );
    setHasUnsavedChanges(true);
    notifyRef.current(`Se limpiaron las notas de manuales de la Semana ${selectedSemana}`, "info");
  };

  // Guardar calificaciones en el backend
  const handleSaveAll = async () => {
    if (!seccion?.id) return;
    if (!canEdit) {
      notifyRef.current(`No tienes permisos para guardar cambios en la Semana ${selectedSemana}.`, "warning");
      return;
    }

    if (!getManualsWindow(seccion, semanasConfig, selectedSemana, new Date(), events, deadlines).isOpen) {
      setNow(new Date());
      return;
    }
    if (saving || !estudiantes.length) return;
    setSaving(true);
    setSaveError("");
    try {
      const previous = new Map(savedStudents.current.map(student => [String(student.numero_cuenta), student]));
      const updates = estudiantes.map(student => {
        const saved = previous.get(String(student.numero_cuenta));
        const manuales = weekTopics.flatMap(topic => {
          const value = getStudentManualGrade(student, topic);
          const oldValue = getStudentManualGrade(saved, topic);
          if (value === oldValue) return [];
          return [{ tema_id: topic.id, nota: value === "" ? null : Number(value) }];
        });
        return { numero_cuenta: student.numero_cuenta, manuales };
      }).filter(student => student.manuales.length);
      if (updates.length) await api.estudiantes.saveManualGrades(seccion.id, selectedSemana, updates);
      savedStudents.current = estudiantes;
      setHasUnsavedChanges(false);
      notifyRef.current("Notas de manuales guardadas", "success");
    } catch (error) {
      setSaveError(error.message || "No pudimos guardar las notas.");
    } finally { setSaving(false); }
  };

  // Estadísticas de la semana seleccionada
  const stats = useMemo(() => {
    if (weekTopics.length === 0) return { gradedCount: 0, pendingCount: 0, average: 0 };

    let totalPoints = 0;
    let entriesCount = 0;
    let studentsWithAllGraded = 0;

    estudiantes.forEach((est) => {
      let studentGradedAll = true;
      weekTopics.forEach((t) => {
        const val = getStudentManualGrade(est, t);
        if (val !== "" && val !== null && !isNaN(Number(val))) {
          totalPoints += Number(val);
          entriesCount++;
        } else {
          studentGradedAll = false;
        }
      });
      if (studentGradedAll) studentsWithAllGraded++;
    });

    const average = entriesCount > 0 ? (totalPoints / entriesCount).toFixed(1) : 0;

    return {
      gradedCount: studentsWithAllGraded,
      pendingCount: estudiantes.length - studentsWithAllGraded,
      average
    };
  }, [estudiantes, weekTopics]);

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

  return (
    <section className="user-directory weekly-manuals" aria-labelledby="weekly-manuals-title">
      {!hideBackButton && <button type="button" className="user-button user-button--back" onClick={onClose}><ArrowLeft size={17} aria-hidden="true" /> Volver a módulos</button>}
      <header className="user-directory__hero">
        <div>
          <p className="user-directory__eyebrow"><BookOpen size={17} aria-hidden="true" /> Sección {displaySectionCode(seccion?.codigo)} · {carrera}</p>
          <h2 id="weekly-manuals-title">Subir nota de manuales</h2>
          <p>Registra las notas de cada tema durante su plazo de carga.</p>
        </div>
      </header>
      {loading ? <p className="user-directory__state" role="status">Cargando manuales…</p> : loadError ? (
        <div className="user-directory__state" role="alert"><p>{loadError}</p><button type="button" className="user-button" onClick={() => loadData(true)}>Reintentar</button></div>
      ) : !availableWeeks.length ? <p className="user-directory__state">No hay semanas de clase con manuales disponibles.</p> : (
        <>
          <div className="weekly-manuals__controls">
            <div className="weekly-manuals__week">
              <label className="user-field">Semana del manual
                <select aria-label="Semana del manual" value={selectedSemana} disabled={saving} onChange={event => handleSelectSemana(event.target.value)}>
                  {availableWeeks.map(week => <option key={week.numero_semana} value={week.numero_semana}>{getWeekDisplayName(week)} · {week.parcial}</option>)}
                </select>
              </label>
              <p><Users size={16} aria-hidden="true" /> Todos los instructores de la sección</p>
              <p>Calificación máxima por manual <strong>1.000 punto</strong></p>
            </div>
            <div className="weekly-manuals__window" data-open={canEdit} role="status">
              <strong><Clock size={17} aria-hidden="true" /> {canEdit ? "Carga habilitada" : "Carga cerrada"}</strong>
              <p>{manualWindow.reason}</p>
              {manualWindow.isSpecial && manualWindow.date ? (
                <p className="weekly-manuals__date">{dateFormatter.format(new Date(manualWindow.date + "T00:00:00Z"))} · Todo el día</p>
              ) : manualWindow.opensAt && (
                <dl>
                  <div><dt>Apertura</dt><dd>{dateTimeFormatter.format(new Date(manualWindow.opensAt))}</dd></div>
                  <div><dt>Cierre</dt><dd>{dateTimeFormatter.format(new Date(manualWindow.closesAt))}</dd></div>
                </dl>
              )}
              <small>{manualWindow.isSpecial ? "Fecha definida por el titular · hora de Honduras"
                : `Siguiente práctica${manualWindow.isReplacement ? " reprogramada" : ""} · margen de 10 minutos · hora de Honduras`}</small>
            </div>
          </div>
          {manualWindow.isSpecial && (
            <p className="weekly-manuals__special">El día de carga se define en <strong>Proporcionar asignaciones</strong>, dentro de la semana previa al examen.</p>
          )}
          <dl className="weekly-manuals__stats" aria-label="Resumen de manuales">
            {[["Estudiantes", estudiantes.length], ["Completos", stats.gradedCount], ["Pendientes", stats.pendingCount], ["Promedio", stats.average]].map(([label,value])=>(
              <div key={label}><dt>{label}</dt><dd>{value}</dd></div>
            ))}
          </dl>
          <section className="user-directory__results" aria-labelledby="manuals-students-title">
            <div className="user-directory__toolbar">
              <div><h3 id="manuals-students-title">Notas por estudiante</h3><p>{filteredEstudiantes.length} de {estudiantes.length} estudiantes · {weekTopics.length} manuales</p></div>
              <label className="user-directory__search"><Search size={17} aria-hidden="true" />
                <input type="search" aria-label="Buscar estudiante" placeholder="Nombre o cuenta" value={searchTerm} onChange={event => setSearchTerm(event.target.value)} />
              </label>
            </div>
            {weekTopics.length > 0 && (
              <div className="weekly-manuals__bulk">
                {weekTopics.map(topic=><button type="button" className="user-button" key={topic.id} disabled={!canEdit || saving || !estudiantes.length} onClick={()=>handleBatchGradeTopic(topic)}>Asignar nota a todos · {topic.titulo}</button>)}
                <button type="button" className="user-button user-button--danger" disabled={!canEdit || saving || !estudiantes.length} onClick={handleClearWeekManuals}>Limpiar notas de la semana</button>
              </div>
            )}
            {!weekTopics.length ? <p className="user-directory__state">Esta semana no tiene temas con manual evaluable.</p> : !filteredEstudiantes.length ? (
              <p className="user-directory__state">{estudiantes.length ? "Ningún estudiante coincide con la búsqueda." : "Aún no hay estudiantes matriculados."}</p>
            ) : (
              <ul className="weekly-manuals__students">
                {filteredEstudiantes.map(student=>(
                  <li className="weekly-manuals__student" key={student.numero_cuenta}>
                    <div><h4>{student.nombre_completo || "Sin nombre registrado"}</h4><p>Cuenta {student.numero_cuenta}</p></div>
                    <div className="weekly-manuals__grades">
                      {weekTopics.map(topic=>(
                        <label className="user-field" key={topic.id}>
                          {topic.titulo}
                          <input type="text" inputMode="decimal" value={getStudentManualGrade(student, topic)}
                            disabled={!canEdit || saving} placeholder="Sin nota" aria-label={`${topic.titulo} de ${student.nombre_completo || student.numero_cuenta}`}
                            onChange={event=>handleGradeChange(student.numero_cuenta,topic,event.target.value)} />
                          <small>Máximo 1.000 punto</small>
                        </label>
                      ))}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
          <footer className="weekly-manuals__save">
            {saveError && <p className="user-dialog__error" role="alert">{saveError}</p>}
            <div><p role="status">{hasUnsavedChanges ? "Cambios sin guardar" : "Sin cambios pendientes"}</p>
              <div>
                {hasUnsavedChanges && <button type="button" className="user-button" disabled={saving} onClick={discardChanges}>Descartar cambios</button>}
                <button type="button" className="user-button user-button--primary" disabled={!canEdit || saving || !hasUnsavedChanges} onClick={handleSaveAll}><Save size={17} aria-hidden="true" /> {saving ? "Guardando…" : "Guardar manuales"}</button>
              </div>
            </div>
          </footer>
        </>
      )}
    </section>
  );
}
