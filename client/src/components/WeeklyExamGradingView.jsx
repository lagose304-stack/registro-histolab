import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import {
  GraduationCap,
  Search,
  Save,
  CheckCircle2,
  AlertTriangle,
  Users,
  Calendar,
  ArrowLeft,
  RefreshCw,
  AlertCircle,
  ShieldAlert,
  ShieldCheck,
  CheckCheck,
  Lock,
  Sparkles,
  Info,
  Award
} from "lucide-react";
import { api } from "../services/api";
import {
  calculateStudentAcademicSummary,
  getCanonicalExamGrade
} from "../utils/academicEngine";

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
    if (!seccion?.id) return;
    if (isInitial) setLoading(true);

    try {
      const [resEst, resSemanas, resTemario, resAsig, resPuntajes] = await Promise.all([
        api.estudiantes.getBySeccion(seccion.id, carrera),
        api.semanas.getConfig(carrera).catch(() => ({ data: [] })),
        api.temario.getAll({ carrera }).catch(() => ({ data: [] })),
        api.asignaciones.getBySeccion(seccion.id).catch(() => ({ data: [] })),
        api.temario.getPuntajes(carrera).catch(() => ({ data: null }))
      ]);

      if (resEst?.data) {
        const sorted = [...resEst.data].sort((a, b) =>
          (a.nombre_completo || "").localeCompare(b.nombre_completo || "")
        );
        setEstudiantes(sorted);
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
          const examWeek = loadedSemanas.find((s) =>
            Boolean(s.es_examen) || String(s.nombre_semana || "").toLowerCase().includes("examen") || String(s.temas || "").toLowerCase().includes("examen")
          );

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
      console.error("Error al cargar notas de examen parcial:", err);
      notifyRef.current("Error al cargar la información de estudiantes", "error");
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

  // Lista unificada de todas las semanas
  const allWeeks = useMemo(() => {
    const weekMap = new Map();

    semanasConfig.forEach((s) => {
      const num = Number(s.numero_semana);
      if (!num) return;
      const isExam =
        Boolean(s.es_examen) ||
        s.es_examen === "true" ||
        String(s.nombre_semana || "").toLowerCase().includes("examen") ||
        String(s.descripcion || "").toLowerCase().includes("examen") ||
        String(s.temas || "").toLowerCase().includes("examen");

      const rawNombre = s.nombre_semana || s.descripcion || (isExam ? `Semana ${num} - Examen` : `Semana ${num}`);

      weekMap.set(num, {
        numero_semana: num,
        nombre_semana: rawNombre,
        parcial: s.parcial || (num <= 4 ? "I Parcial" : num <= 8 ? "II Parcial" : "III Parcial"),
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
    const p = String(currentWeekInfo.parcial || "").toLowerCase();
    const semIndex = examWeeks.findIndex((w) => Number(w.numero_semana) === Number(currentWeekInfo.numero_semana));

    if (p.includes("iii") || p.includes("tercer") || semIndex === 2) {
      return {
        id: "examen_III",
        columnKey: "tercer_examen",
        label: "III Examen Parcial",
        parcial: "III Parcial",
        badgeBg: "#faf5ff",
        badgeBorder: "#d8b4fe",
        badgeText: "#6b21a8"
      };
    }

    if (p.includes("ii") || p.includes("segundo") || semIndex === 1) {
      return {
        id: "examen_II",
        columnKey: "segundo_examen",
        label: "II Examen Parcial",
        parcial: "II Parcial",
        badgeBg: "#eff6ff",
        badgeBorder: "#bfdbfe",
        badgeText: "#1e40af"
      };
    }

    return {
      id: "examen_I",
      columnKey: "primer_examen",
      label: "I Examen Parcial",
      parcial: "I Parcial",
      badgeBg: "#fef3c7",
      badgeBorder: "#fde68a",
      badgeText: "#92400e"
    };
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
    assignedRecordForExam?.instructor_nombre || seccion?.coordinador || "Coordinador de Sección";

  // 🛡️ REGLA ESTRICTA: El rol de examen parcial es ÚNICA Y POR DEFECTO para el Coordinador de la Sección
  const canEdit = useMemo(() => {
    if (!currentWeekInfo.esExamen) return false;

    const user = currentInstructor || api.auth.getCurrentInstructor();
    if (!user) return false;

    // Verificar si el usuario actual es el Coordinador de la Sección
    const coordName = (seccion?.coordinador || "").toLowerCase().trim();
    const userFullName = (user.nombre_completo || "").toLowerCase().trim();
    const userCombinedName = `${user.primer_nombre || ""} ${user.primer_apellido || ""}`.toLowerCase().trim();
    const pNom = (user.primer_nombre || "").toLowerCase().trim();
    const pApe = (user.primer_apellido || "").toLowerCase().trim();

    const isCoordinatorUser =
      Boolean(coordName) &&
      (coordName === userFullName ||
        coordName === userCombinedName ||
        userFullName.includes(coordName) ||
        coordName.includes(userFullName) ||
        (pNom && pApe && coordName.includes(pNom) && coordName.includes(pApe)));

    // Si el usuario es el Coordinador, tiene acceso por defecto y exclusivo
    if (isCoordinatorUser) {
      return true;
    }

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
    const colKey = examMeta.columnKey;
    const examIndex = colKey === "primer_examen" ? 0 : colKey === "segundo_examen" ? 1 : 2;
    const val = getCanonicalExamGrade(est, examIndex, currentWeekInfo);
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
    if (!canEdit) {
      notifyRef.current(
        `Solo ${assignedInstructorForExam || "el docente asignado"} tiene permisos para editar las notas del ${examMeta.label}.`,
        "warning"
      );
      return;
    }

    const cleanVal = String(rawValue).replace(",", ".");

    if (cleanVal === "") {
      setEstudiantes((prev) =>
        prev.map((est) => {
          if (est.numero_cuenta !== numero_cuenta) return est;
          const currentNotas = { ...(est.notas || {}) };
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

    if (!/^\d*(\.\d{0,3})?$/.test(cleanVal)) {
      return;
    }

    const storedVal = cleanVal.endsWith(".") ? cleanVal : Number(cleanVal);

    setEstudiantes((prev) =>
      prev.map((est) => {
        if (est.numero_cuenta !== numero_cuenta) return est;

        const currentNotas = est.notas || {};
        const updatedNotas = {
          ...currentNotas,
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

  // Asignar nota rápida a todos en este examen
  const handleBatchGradeExam = () => {
    if (!canEdit) {
      notifyRef.current("No tienes permisos para modificar notas en este examen.", "warning");
      return;
    }

    const defaultScoreStr = window.prompt(
      `Ingresa la calificación a aplicar a TODOS los alumnos para el ${examMeta.label} (hasta 3 decimales, ej. 20.000):`,
      "20.000"
    );

    if (defaultScoreStr === null) return;
    const cleanStr = defaultScoreStr.replace(",", ".");
    const num = Number(cleanStr);
    if (isNaN(num) || num < 0) {
      notifyRef.current("Por favor ingresa una nota numérica válida mayor o igual a 0", "error");
      return;
    }

    const roundedNum = Math.round(num * 1000) / 1000;

    setEstudiantes((prev) =>
      prev.map((est) => {
        const currentNotas = est.notas || {};
        const updatedNotas = {
          ...currentNotas,
          [examMeta.columnKey]: roundedNum,
          [examMeta.id]: roundedNum
        };

        const updatedExamCols = { [examMeta.columnKey]: roundedNum };
        const nextTotal = recalculateTotal(est, updatedNotas, updatedExamCols);

        return {
          ...est,
          [examMeta.columnKey]: roundedNum,
          notas: updatedNotas,
          total: nextTotal
        };
      })
    );
    setHasUnsavedChanges(true);
    notifyRef.current(`Nota ${roundedNum} aplicada a todos los alumnos para el ${examMeta.label}`, "info");
  };

  // Limpiar notas de este examen
  const handleClearExamGrades = () => {
    if (!canEdit) {
      notifyRef.current("No tienes permisos para modificar notas en este examen.", "warning");
      return;
    }

    if (!window.confirm(`¿Seguro que deseas limpiar las notas del ${examMeta.label}?`)) {
      return;
    }

    setEstudiantes((prev) =>
      prev.map((est) => {
        const currentNotas = { ...(est.notas || {}) };
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
    notifyRef.current(`Se limpiaron las notas del ${examMeta.label}`, "info");
  };

  // Guardar calificaciones en el backend
  const handleSaveAll = async () => {
    if (!seccion?.id) return;
    if (!canEdit) {
      notifyRef.current(`No tienes permisos para guardar cambios en el ${examMeta.label}.`, "warning");
      return;
    }

    setSaving(true);
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
      setHasUnsavedChanges(false);
      notifyRef.current(`¡Notas del ${examMeta.label} guardadas con éxito!`, "success");
    } catch (err) {
      console.error("Error al guardar notas de examen parcial:", err);
      notifyRef.current("Error al guardar las notas en el servidor", "error");
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
    if (!searchTerm.trim()) return estudiantes;
    const s = searchTerm.toLowerCase().trim();
    return estudiantes.filter(
      (e) =>
        (e.nombre_completo || "").toLowerCase().includes(s) ||
        (e.numero_cuenta || "").toLowerCase().includes(s)
    );
  }, [estudiantes, searchTerm]);

  if (loading) {
    return (
      <div
        className="glass-panel"
        style={{
          padding: "3.5rem",
          background: "#ffffff",
          borderRadius: "1rem",
          border: "1px solid #e2e8f0",
          textAlign: "center",
          color: "#64748b",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "1rem"
        }}
      >
        <RefreshCw size={28} className="animate-spin" color="#7c3aed" />
        <span style={{ fontSize: "0.95rem", fontWeight: 700 }}>
          Cargando exámenes parciales y calificaciones...
        </span>
      </div>
    );
  }

  return (
    <div
      className="glass-panel animate-fade-in"
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "1.5rem"
      }}
    >
      {/* =================================================================== */}
      {/* 1. CABECERA DEL MÓDULO                                             */}
      {/* =================================================================== */}
      <div
        style={{
          padding: "1.5rem 1.75rem",
          background: "#ffffff",
          borderRadius: "1.1rem",
          border: "1px solid #e2e8f0",
          boxShadow: "0 4px 15px -3px rgba(0, 0, 0, 0.04)",
          display: "flex",
          flexDirection: "column",
          gap: "1.1rem"
        }}
      >
        {/* Fila 1: Título, Sección, Botón Volver y Botón Guardar */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: "1rem" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "0.65rem", flexWrap: "wrap", marginBottom: "0.35rem" }}>
              {!hideBackButton && (
                <button
                  onClick={onClose}
                  style={{
                    background: "#f1f5f9",
                    border: "none",
                    borderRadius: "0.5rem",
                    padding: "0.4rem 0.65rem",
                    cursor: "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "0.3rem",
                    color: "#475569",
                    fontSize: "0.8rem",
                    fontWeight: 700,
                    marginRight: "0.35rem"
                  }}
                  title="Volver a los módulos de la sección"
                >
                  <ArrowLeft size={15} />
                  <span>Volver</span>
                </button>
              )}

              <div
                style={{
                  width: "34px",
                  height: "34px",
                  borderRadius: "0.55rem",
                  background: "linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%)",
                  color: "#ffffff",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center"
                }}
              >
                <GraduationCap size={20} />
              </div>

              <h2 style={{ fontSize: "1.35rem", fontWeight: 900, color: "#0f172a", margin: 0, letterSpacing: "-0.01em" }}>
                Subir Nota de Examen Parcial
              </h2>

              <span
                style={{
                  background: "linear-gradient(135deg, #0284c7 0%, #0369a1 100%)",
                  color: "#ffffff",
                  padding: "0.2rem 0.65rem",
                  borderRadius: "0.45rem",
                  fontSize: "0.75rem",
                  fontWeight: 900,
                  letterSpacing: "0.03em"
                }}
              >
                {seccion?.codigo}
              </span>

              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "0.3rem",
                  background: "#f1f5f9",
                  color: "#475569",
                  padding: "0.2rem 0.6rem",
                  borderRadius: "9999px",
                  fontSize: "0.74rem",
                  fontWeight: 700
                }}
              >
                <Users size={12} />
                <span>{estudiantes.length} Alumnos</span>
              </span>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap", fontSize: "0.82rem", color: "#64748b" }}>
              <span>{carrera}</span>
              <span>•</span>
              <span>{seccion?.dia} {seccion?.hora_inicio} - {seccion?.hora_fin}</span>
              {assignedInstructorForExam && (
                <>
                  <span>•</span>
                  <span style={{ color: "#7c3aed", fontWeight: 700 }}>
                    Docente asignado: {assignedInstructorForExam}
                  </span>
                </>
              )}
            </div>
          </div>

          {/* Botones de Acción / Guardar */}
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
            {hasUnsavedChanges && (
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "0.35rem",
                  fontSize: "0.76rem",
                  fontWeight: 800,
                  color: "#d97706",
                  background: "#fef3c7",
                  border: "1px solid #fde68a",
                  padding: "0.35rem 0.75rem",
                  borderRadius: "9999px"
                }}
              >
                <AlertCircle size={13} />
                <span>Cambios sin guardar</span>
              </span>
            )}

            <button
              onClick={handleSaveAll}
              disabled={saving || !canEdit}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "0.5rem",
                background: !canEdit
                  ? "#94a3b8"
                  : hasUnsavedChanges
                  ? "linear-gradient(135deg, #10b981 0%, #059669 100%)"
                  : "linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%)",
                color: "#ffffff",
                border: "none",
                padding: "0.6rem 1.25rem",
                borderRadius: "0.65rem",
                fontSize: "0.88rem",
                fontWeight: 800,
                cursor: (!canEdit || saving) ? "not-allowed" : "pointer",
                boxShadow: canEdit
                  ? (hasUnsavedChanges ? "0 4px 14px rgba(16, 185, 129, 0.3)" : "0 4px 14px rgba(124, 58, 237, 0.25)")
                  : "none",
                opacity: (!canEdit || saving) ? 0.7 : 1,
                transition: "all 0.2s ease"
              }}
              title={!canEdit ? "No tienes permisos de edición para este examen" : "Guardar calificaciones"}
            >
              {saving ? (
                <>
                  <RefreshCw size={15} className="animate-spin" />
                  <span>Guardando...</span>
                </>
              ) : !canEdit ? (
                <>
                  <Lock size={15} />
                  <span>Solo Lectura</span>
                </>
              ) : (
                <>
                  <Save size={15} />
                  <span>Guardar Nota de Examen</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* =================================================================== */}
        {/* BANNER DE REGLA Y PERMISO DE ASIGNACIÓN                             */}
        {/* =================================================================== */}
        {!currentWeekInfo.esExamen ? (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.55rem",
              background: "#fffbeb",
              border: "1.5px solid #fde68a",
              borderRadius: "0.75rem",
              padding: "0.65rem 1rem",
              color: "#92400e",
              fontSize: "0.82rem",
              fontWeight: 700
            }}
          >
            <Info size={18} color="#d97706" style={{ flexShrink: 0 }} />
            <span>
              <strong>Semana Regular de Clase:</strong> La Semana {currentWeekInfo.numero_semana} no está configurada como semana de examen. Selecciona una de las <strong>semanas asignadas a examen parcial</strong> en las pestañas inferiores.
            </span>
          </div>
        ) : canEdit ? (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.55rem",
              background: "#f0fdf4",
              border: "1.5px solid #86efac",
              borderRadius: "0.75rem",
              padding: "0.65rem 1rem",
              color: "#166534",
              fontSize: "0.82rem",
              fontWeight: 700
            }}
          >
            <ShieldCheck size={18} color="#16a34a" style={{ flexShrink: 0 }} />
            <span>
              Tienes asignado el rol oficial de <strong>Subir nota de examen parcial</strong> para el <strong>{examMeta.label}</strong> (Semana {currentWeekInfo.numero_semana}). Puedes ingresar y modificar calificaciones.
            </span>
          </div>
        ) : (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.55rem",
              background: "#fffbeb",
              border: "1.5px solid #fde68a",
              borderRadius: "0.75rem",
              padding: "0.65rem 1rem",
              color: "#92400e",
              fontSize: "0.82rem",
              fontWeight: 700
            }}
          >
            <ShieldAlert size={18} color="#d97706" style={{ flexShrink: 0 }} />
            <span>
              <strong>Modo de Solo Lectura:</strong> Para el <strong>{examMeta.label}</strong> (Semana {currentWeekInfo.numero_semana}), la calificación de examen está asignada a <strong>{assignedInstructorForExam || "ningún docente (sin asignar)"}</strong>. Solo la persona asignada tiene autorización para calificar.
            </span>
          </div>
        )}

        {/* =================================================================== */}
        {/* SELECTOR EXCLUSIVO DE SEMANAS ASIGNADAS A EXAMEN PARCIAL           */}
        {/* =================================================================== */}
        <div
          style={{
            background: "#faf5ff",
            border: "1.5px solid #e9d5ff",
            borderRadius: "0.85rem",
            padding: "0.85rem 1.15rem",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: "1rem"
          }}
        >
          {/* Pestañas de Semanas de Examen */}
          <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", flexWrap: "wrap" }}>
            <span style={{ fontSize: "0.82rem", fontWeight: 800, color: "#6b21a8", textTransform: "uppercase", letterSpacing: "0.02em" }}>
              Exámenes Parciales:
            </span>

            {examWeeks.map((ew) => {
              const isSelected = ew.numero_semana === currentWeekInfo.numero_semana;
              const displayName = getWeekDisplayName(ew);

              return (
                <button
                  key={ew.numero_semana}
                  onClick={() => handleSelectSemana(ew.numero_semana)}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "0.35rem",
                    padding: "0.45rem 0.85rem",
                    borderRadius: "0.6rem",
                    border: isSelected ? "2px solid #7c3aed" : "1.5px solid #d8b4fe",
                    background: isSelected ? "linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%)" : "#ffffff",
                    color: isSelected ? "#ffffff" : "#6b21a8",
                    fontSize: "0.82rem",
                    fontWeight: 800,
                    cursor: "pointer",
                    boxShadow: isSelected ? "0 2px 8px rgba(124, 58, 237, 0.25)" : "none",
                    transition: "all 0.15s ease"
                  }}
                >
                  <GraduationCap size={14} />
                  <span>{displayName}</span>
                </button>
              );
            })}
          </div>

          {/* Estadísticas del examen seleccionado */}
          {currentWeekInfo.esExamen && (
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.35rem", background: "#ffffff", border: "1px solid #bbf7d0", padding: "0.3rem 0.65rem", borderRadius: "0.5rem", fontSize: "0.78rem" }}>
                <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#16a34a" }} />
                <span style={{ color: "#166534", fontWeight: 800 }}>Calificados: {stats.gradedCount}</span>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: "0.35rem", background: "#ffffff", border: "1px solid #fed7aa", padding: "0.3rem 0.65rem", borderRadius: "0.5rem", fontSize: "0.78rem" }}>
                <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#f97316" }} />
                <span style={{ color: "#c2410c", fontWeight: 800 }}>Pendientes: {stats.pendingCount}</span>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: "0.35rem", background: "#ffffff", border: "1px solid #e9d5ff", padding: "0.3rem 0.65rem", borderRadius: "0.5rem", fontSize: "0.78rem" }}>
                <span style={{ color: "#6b21a8", fontWeight: 800 }}>Promedio: {stats.average} pts</span>
              </div>
            </div>
          )}
        </div>

        {/* Fila 3: Acciones masivas y Barra de Búsqueda */}
        {currentWeekInfo.esExamen && (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "0.75rem", paddingTop: "0.25rem" }}>
            {/* Acciones Rápidas */}
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
              <button
                onClick={handleBatchGradeExam}
                disabled={!canEdit}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "0.35rem",
                  background: canEdit ? "#f5f3ff" : "#f1f5f9",
                  border: canEdit ? "1.5px solid #d8b4fe" : "1px solid #cbd5e1",
                  color: canEdit ? "#6d28d9" : "#94a3b8",
                  padding: "0.4rem 0.75rem",
                  borderRadius: "0.55rem",
                  fontSize: "0.78rem",
                  fontWeight: 800,
                  cursor: canEdit ? "pointer" : "not-allowed",
                  opacity: canEdit ? 1 : 0.6,
                  transition: "all 0.15s ease"
                }}
                title={!canEdit ? "Solo lectura" : `Asignar nota a todos en ${examMeta.label}`}
              >
                <CheckCheck size={14} />
                <span>Asignar nota a todos en {examMeta.label}</span>
              </button>

              <button
                onClick={handleClearExamGrades}
                disabled={!canEdit}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "0.35rem",
                  background: "#f8fafc",
                  border: "1px solid #cbd5e1",
                  color: canEdit ? "#475569" : "#94a3b8",
                  padding: "0.4rem 0.75rem",
                  borderRadius: "0.55rem",
                  fontSize: "0.78rem",
                  fontWeight: 700,
                  cursor: canEdit ? "pointer" : "not-allowed",
                  opacity: canEdit ? 1 : 0.6,
                  transition: "all 0.15s ease"
                }}
                title={!canEdit ? "Solo lectura" : `Limpiar notas de ${examMeta.label}`}
              >
                <span>Limpiar Examen</span>
              </button>
            </div>

            {/* Barra de Búsqueda */}
            <div style={{ position: "relative", width: "100%", maxWidth: "300px" }}>
              <Search size={14} color="#94a3b8" style={{ position: "absolute", left: "0.75rem", top: "50%", transform: "translateY(-50%)" }} />
              <input
                type="text"
                placeholder="Buscar alumno por nombre o cuenta..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={{
                  width: "100%",
                  padding: "0.45rem 0.75rem 0.45rem 2rem",
                  borderRadius: "0.5rem",
                  border: "1px solid #cbd5e1",
                  fontSize: "0.82rem",
                  outline: "none",
                  background: "#f8fafc"
                }}
              />
            </div>
          </div>
        )}
      </div>

      {/* =================================================================== */}
      {/* 2. LISTA DE ALUMNOS CON LA CASILLA DE EXAMEN PARCIAL                */}
      {/* =================================================================== */}
      <div
        style={{
          background: "#ffffff",
          borderRadius: "1.1rem",
          border: "1px solid #e2e8f0",
          boxShadow: "0 4px 15px -3px rgba(0, 0, 0, 0.04)",
          padding: "1.25rem 1.5rem",
          display: "flex",
          flexDirection: "column",
          gap: "0.85rem"
        }}
      >
        {!currentWeekInfo.esExamen ? (
          <div
            style={{
              padding: "3rem",
              textAlign: "center",
              background: "#f8fafc",
              borderRadius: "0.65rem",
              border: "1.5px dashed #cbd5e1",
              color: "#64748b",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "0.75rem"
            }}
          >
            <GraduationCap size={36} color="#94a3b8" />
            <strong style={{ fontSize: "1rem", color: "#334155" }}>
              Semana {currentWeekInfo.numero_semana} es una Semana Regular de Clase
            </strong>
            <span style={{ fontSize: "0.85rem", maxWidth: "450px" }}>
              Los exámenes parciales solo se evalúan en las semanas asignadas a examen parcial. Selecciona una de las pestañas superiores para calificar.
            </span>
          </div>
        ) : (
          <>
            {/* Cabecera de la tabla */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "50px 1.4fr 1.6fr",
                gap: "0.75rem",
                padding: "0.65rem 0.85rem",
                background: "#f8fafc",
                borderRadius: "0.65rem",
                border: "1px solid #e2e8f0",
                fontSize: "0.75rem",
                fontWeight: 800,
                color: "#475569",
                textTransform: "uppercase",
                letterSpacing: "0.03em",
                alignItems: "center"
              }}
            >
              <span>#</span>
              <span>Alumno / N° de Cuenta</span>
              <div style={{ textAlign: "center" }}>
                <div style={{ color: "#7c3aed", fontWeight: 900 }}>
                  {examMeta.label}
                </div>
                <div style={{ fontSize: "0.68rem", color: "#64748b", fontWeight: 600, textTransform: "none" }}>
                  Semana {currentWeekInfo.numero_semana} — ({currentWeekInfo.parcial})
                </div>
              </div>
            </div>

            {/* Listado de alumnos */}
            {filteredEstudiantes.length === 0 ? (
              <div
                style={{
                  padding: "2.5rem",
                  textAlign: "center",
                  background: "#f8fafc",
                  borderRadius: "0.65rem",
                  border: "1.5px dashed #cbd5e1",
                  color: "#64748b",
                  fontSize: "0.85rem"
                }}
              >
                {searchTerm ? "No se encontraron alumnos con ese criterio de búsqueda." : "No hay alumnos matriculados en esta sección."}
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                {filteredEstudiantes.map((est, index) => {
                  const gradeVal = getStudentExamGrade(est);

                  return (
                    <div
                      key={est.numero_cuenta || est.id || index}
                      style={{
                        display: "grid",
                        gridTemplateColumns: "50px 1.4fr 1.6fr",
                        gap: "0.75rem",
                        alignItems: "center",
                        padding: "0.75rem 0.85rem",
                        borderRadius: "0.65rem",
                        border: "1px solid #e2e8f0",
                        background: "#ffffff",
                        transition: "all 0.15s ease"
                      }}
                    >
                      {/* Número correlativo */}
                      <span style={{ fontSize: "0.8rem", fontWeight: 800, color: "#94a3b8" }}>
                        {String(index + 1).padStart(2, "0")}
                      </span>

                      {/* Nombre Completo y Cuenta */}
                      <div style={{ display: "flex", flexDirection: "column", gap: "0.15rem", paddingRight: "0.5rem" }}>
                        <strong style={{ fontSize: "0.92rem", color: "#0f172a", lineHeight: 1.25 }}>
                          {est.nombre_completo || "Sin Nombre Registrado"}
                        </strong>
                        <span style={{ fontSize: "0.74rem", color: "#64748b", fontFamily: "monospace" }}>
                          Cuenta: {est.numero_cuenta || "Sin cuenta"}
                        </span>
                      </div>

                      {/* Casilla de calificación del examen parcial */}
                      <div style={{ display: "flex", justifyContent: "center" }}>
                        <div
                          style={{
                            position: "relative",
                            width: "100%",
                            maxWidth: "180px"
                          }}
                        >
                          <input
                            type="text"
                            inputMode="decimal"
                            value={gradeVal}
                            onChange={(e) => handleGradeChange(est.numero_cuenta, e.target.value)}
                            onBlur={() => {
                              if (typeof gradeVal === "string" && gradeVal.endsWith(".")) {
                                handleGradeChange(est.numero_cuenta, gradeVal.slice(0, -1));
                              }
                            }}
                            disabled={!canEdit}
                            placeholder="0.000"
                            style={{
                              width: "100%",
                              textAlign: "center",
                              padding: "0.55rem 0.75rem",
                              borderRadius: "0.55rem",
                              border: gradeVal !== "" ? "2px solid #7c3aed" : "1.5px solid #cbd5e1",
                              background: !canEdit ? "#f1f5f9" : gradeVal !== "" ? "#faf5ff" : "#ffffff",
                              color: !canEdit ? "#94a3b8" : "#581c87",
                              fontSize: "0.95rem",
                              fontWeight: 800,
                              outline: "none",
                              cursor: canEdit ? "text" : "not-allowed",
                              transition: "all 0.15s ease"
                            }}
                            title={!canEdit ? `Solo lectura. Docente asignado: ${assignedInstructorForExam || "ninguno"}` : `Calificación ${examMeta.label}`}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Botón inferior de guardar */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: "0.75rem", paddingTop: "0.75rem" }}>
              <button
                onClick={handleSaveAll}
                disabled={saving || !canEdit}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "0.5rem",
                  background: !canEdit
                    ? "#94a3b8"
                    : hasUnsavedChanges
                    ? "linear-gradient(135deg, #10b981 0%, #059669 100%)"
                    : "linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%)",
                  color: "#ffffff",
                  border: "none",
                  padding: "0.65rem 1.5rem",
                  borderRadius: "0.65rem",
                  fontSize: "0.88rem",
                  fontWeight: 800,
                  cursor: (!canEdit || saving) ? "not-allowed" : "pointer",
                  boxShadow: canEdit ? "0 4px 14px rgba(124, 58, 237, 0.25)" : "none",
                  opacity: (!canEdit || saving) ? 0.7 : 1,
                  transition: "all 0.2s ease"
                }}
                title={!canEdit ? "Solo lectura" : `Guardar notas de ${examMeta.label}`}
              >
                {saving ? (
                  <>
                    <RefreshCw size={15} className="animate-spin" />
                    <span>Guardando notas...</span>
                  </>
                ) : !canEdit ? (
                  <>
                    <Lock size={15} />
                    <span>Solo Lectura ({examMeta.label})</span>
                  </>
                ) : (
                  <>
                    <Save size={15} />
                    <span>Guardar Notas de {examMeta.label}</span>
                  </>
                )}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
