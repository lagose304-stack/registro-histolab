import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import {
  BookOpen,
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
  HelpCircle,
  FileText
} from "lucide-react";
import { api } from "../services/api";
import {
  calculateStudentAcademicSummary,
  getCanonicalManualGrade
} from "../utils/academicEngine";

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
  const [configPuntajes, setConfigPuntajes] = useState(null);

  // Selección de semana persistente por sección
  const [selectedSemana, setSelectedSemana] = useState(() => {
    try {
      const saved = sessionStorage.getItem(`histolab_manuales_semana_${seccion?.id}`);
      return saved ? Number(saved) : 1;
    } catch {
      return 1;
    }
  });

  const handleSelectSemana = (num) => {
    const n = Number(num);
    setSelectedSemana(n);
    hasInitializedWeekRef.current = true;
    try {
      sessionStorage.setItem(`histolab_manuales_semana_${seccion?.id}`, String(n));
    } catch (_) {}
  };

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
        // Ordenar alfabéticamente por nombre_completo
        const sorted = [...resEst.data].sort((a, b) =>
          (a.nombre_completo || "").localeCompare(b.nombre_completo || "")
        );
        setEstudiantes(sorted);
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

      if (resPuntajes?.data) {
        setConfigPuntajes(resPuntajes.data);
      }

      // Solo elegir semana por defecto si no se había seleccionado ninguna previamente
      if (!hasInitializedWeekRef.current) {
        const savedWeek = sessionStorage.getItem(`histolab_manuales_semana_${seccion?.id}`);
        if (!savedWeek && resSemanas?.data && resSemanas.data.length > 0) {
          const actual = resSemanas.data.find((s) => s.es_semana_actual);
          if (actual && actual.numero_semana) {
            handleSelectSemana(Number(actual.numero_semana));
          } else {
            const first = Number(resSemanas.data[0].numero_semana);
            if (first) handleSelectSemana(first);
          }
        }
        hasInitializedWeekRef.current = true;
      }
    } catch (err) {
      console.error("Error al cargar notas de manuales:", err);
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

  // Lista unificada de semanas
  const availableWeeks = useMemo(() => {
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

  // Docente asignado al rol de "Subir nota de manuales semanal" en esta semana
  const assignedRecordForWeek = useMemo(() => {
    const targetRef = `semana_${selectedSemana}`;
    return (
      asignaciones.find(
        (a) =>
          a.tipo_asignacion === "Subir nota de manuales semanal" &&
          a.referencia_id === targetRef
      ) || null
    );
  }, [asignaciones, selectedSemana]);

  const assignedInstructorForWeek = assignedRecordForWeek?.instructor_nombre || null;

  // 🛡️ REGLA ESTRICTA: El usuario solo puede editar la nota de manuales si le asignaron el rol en esta semana
  const canEdit = useMemo(() => {
    if (currentWeekInfo.esExamen) return false;
    if (!assignedRecordForWeek || !assignedRecordForWeek.instructor_id) {
      // Si nadie ha sido asignado en Proporcionar Asignaciones para esta semana, queda en solo lectura
      return false;
    }

    const user = currentInstructor || api.auth.getCurrentInstructor();
    if (!user) return false;

    // 1. Coincidencia por ID de instructor UUID
    if (user.id && assignedRecordForWeek.instructor_id && String(user.id) === String(assignedRecordForWeek.instructor_id)) {
      return true;
    }

    // 2. Coincidencia por coordinador sintetizado (coord-{seccionId})
    if (assignedRecordForWeek.instructor_id === `coord-${seccion?.id}`) {
      const coordName = (seccion?.coordinador || "").toLowerCase().trim();
      const userName = (user.nombre_completo || `${user.primer_nombre || ""} ${user.primer_apellido || ""}`).toLowerCase().trim();
      if (coordName && (userName.includes(coordName) || coordName.includes(userName))) {
        return true;
      }
    }

    // 3. Coincidencia por nombre completo o primer nombre + primer apellido
    const targetName = (assignedRecordForWeek.instructor_nombre || "").toLowerCase().trim();
    if (!targetName) return false;

    const userFullName = (user.nombre_completo || "").toLowerCase().trim();
    const userCombinedName = `${user.primer_nombre || ""} ${user.primer_apellido || ""}`.toLowerCase().trim();

    if (userFullName && (userFullName === targetName || targetName.includes(userFullName))) {
      return true;
    }

    if (userCombinedName && (userCombinedName === targetName || targetName.includes(userCombinedName))) {
      return true;
    }

    const pNom = (user.primer_nombre || "").toLowerCase().trim();
    const pApe = (user.primer_apellido || "").toLowerCase().trim();
    if (pNom && pApe && targetName.includes(pNom) && targetName.includes(pApe)) {
      return true;
    }

    return false;
  }, [assignedRecordForWeek, currentInstructor, seccion, currentWeekInfo.esExamen]);

  // Helper para leer la nota de manual de un estudiante para un tema
  const getStudentManualGrade = (est, tema) => {
    if (!est) return "";
    const val = getCanonicalManualGrade(est.notas || {}, tema, est);
    if (val === undefined || val === null || val === "") return "";
    return val;
  };

  // Helper para recalcular el total de un estudiante al modificar una nota
  const recalculateTotal = (est, updatedNotas) => {
    const summary = calculateStudentAcademicSummary(
      est,
      configPuntajes,
      temario,
      semanasConfig,
      updatedNotas
    );
    return summary.total;
  };

  // Manejar cambio en la calificación de un manual con soporte para hasta 3 decimales (Máx. 1.000 pt)
  const handleGradeChange = (numero_cuenta, tema, rawValue) => {
    if (!canEdit) {
      notifyRef.current(
        `Solo ${assignedInstructorForWeek || "el docente asignado"} tiene permisos para editar manuales en la Semana ${selectedSemana}.`,
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
          delete currentNotas[`manual_${tema.id}`];
          delete currentNotas[`manual_tema_${tema.numero_tema}`];
          const nextTotal = recalculateTotal(est, currentNotas);
          return { ...est, notas: currentNotas, total: nextTotal };
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

        const nextTotal = recalculateTotal(est, updatedNotas);

        return {
          ...est,
          notas: updatedNotas,
          total: nextTotal
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

        const nextTotal = recalculateTotal(est, updatedNotas);

        return {
          ...est,
          notas: updatedNotas,
          total: nextTotal
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
          delete updatedNotas[`manual_${t.id}`];
          delete updatedNotas[`manual_tema_${t.numero_tema}`];
        });

        const nextTotal = recalculateTotal(est, updatedNotas);

        return {
          ...est,
          notas: updatedNotas,
          total: nextTotal
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

    // 🔒 Validación Académica Estricta: Ninguna nota de manual puede superar 1 punto
    for (const est of estudiantes) {
      const notas = est.notas || {};
      for (const [k, v] of Object.entries(notas)) {
        const numVal = Number(v);
        if (!isNaN(numVal) && (k.startsWith("manual_") || k.startsWith("Manual de ")) && numVal > 1) {
          notifyRef.current(
            `No se puede guardar: El estudiante "${est.nombre_completo || est.numero_cuenta}" tiene una nota de manual de ${numVal} pts. El valor máximo permitido es 1.000 punto.`,
            "error"
          );
          return;
        }
      }
    }

    setSaving(true);
    try {
      const updates = estudiantes.map((est) => ({
        numero_cuenta: est.numero_cuenta,
        notas: est.notas || {},
        asistencias: est.asistencias || {},
        primer_examen: est.primer_examen ?? 0,
        segundo_examen: est.segundo_examen ?? 0,
        tercer_examen: est.tercer_examen ?? 0,
        total: est.total ?? 0
      }));

      await api.estudiantes.saveBatch(seccion.id, updates, carrera);
      setHasUnsavedChanges(false);
      notifyRef.current("¡Notas de manuales guardadas con éxito!", "success");
    } catch (err) {
      console.error("Error al guardar notas de manuales:", err);
      notifyRef.current(err.response?.data?.message || "Error al guardar las notas en el servidor", "error");
    } finally {
      setSaving(false);
    }
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

  // Alumnos con notas de manual que exceden el límite de 1.000 punto
  const invalidManualStudents = useMemo(() => {
    return estudiantes.filter((est) => {
      const notas = est.notas || {};
      return Object.entries(notas).some(([k, v]) => {
        const num = Number(v);
        return !isNaN(num) && (k.startsWith("manual_") || k.startsWith("Manual de ")) && num > 1;
      });
    });
  }, [estudiantes]);

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
        <RefreshCw size={28} className="animate-spin" color="#2563eb" />
        <span style={{ fontSize: "0.95rem", fontWeight: 700 }}>
          Cargando manuales y calificaciones de la sección...
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
                  background: "linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)",
                  color: "#ffffff",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center"
                }}
              >
                <BookOpen size={20} />
              </div>

              <h2 style={{ fontSize: "1.35rem", fontWeight: 900, color: "#0f172a", margin: 0, letterSpacing: "-0.01em" }}>
                Subir Nota de Manuales
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
              {assignedInstructorForWeek && (
                <>
                  <span>•</span>
                  <span style={{ color: "#2563eb", fontWeight: 700 }}>
                    Docente asignado: {assignedInstructorForWeek}
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
                  : "linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)",
                color: "#ffffff",
                border: "none",
                padding: "0.6rem 1.25rem",
                borderRadius: "0.65rem",
                fontSize: "0.88rem",
                fontWeight: 800,
                cursor: (!canEdit || saving) ? "not-allowed" : "pointer",
                boxShadow: canEdit
                  ? (hasUnsavedChanges ? "0 4px 14px rgba(16, 185, 129, 0.3)" : "0 4px 14px rgba(37, 99, 235, 0.25)")
                  : "none",
                opacity: (!canEdit || saving) ? 0.7 : 1,
                transition: "all 0.2s ease"
              }}
              title={!canEdit ? "No tienes permisos de edición para esta semana" : "Guardar calificaciones"}
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
                  <span>Guardar Notas de Manuales</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* =================================================================== */}
        {/* BANNER DE REGLA Y PERMISO DE ASIGNACIÓN                             */}
        {/* =================================================================== */}
        {currentWeekInfo.esExamen ? (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.55rem",
              background: "#eff6ff",
              border: "1.5px solid #bfdbfe",
              borderRadius: "0.75rem",
              padding: "0.65rem 1rem",
              color: "#1e40af",
              fontSize: "0.82rem",
              fontWeight: 700
            }}
          >
            <Info size={18} color="#2563eb" style={{ flexShrink: 0 }} />
            <span>
              <strong>Semana de Examen Parcial:</strong> En las semanas de examen no hay manual programado para calificar.
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
              Tienes asignado el rol oficial de <strong>Subir nota de manuales semanal</strong> en la <strong>Semana {selectedSemana}</strong>. Puedes ingresar y modificar calificaciones.
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
              <strong>Modo de Solo Lectura:</strong> Para la <strong>Semana {selectedSemana}</strong>, la subida de manuales está asignada a <strong>{assignedInstructorForWeek || "ningún docente (sin asignar)"}</strong>. Solo la persona asignada tiene autorización para calificar.
            </span>
          </div>
        )}

        {/* =================================================================== */}
        {/* SELECTOR DE SEMANA Y TEMAS CONFIGURADOS                             */}
        {/* =================================================================== */}
        <div
          style={{
            background: "#f0fdf4",
            border: "1.5px solid #bbf7d0",
            borderRadius: "0.85rem",
            padding: "0.85rem 1.15rem",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: "1rem"
          }}
        >
          {/* Selector de Semana */}
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap" }}>
            <span style={{ fontSize: "0.82rem", fontWeight: 800, color: "#166534", textTransform: "uppercase", letterSpacing: "0.02em" }}>
              Semana a Calificar:
            </span>

            <select
              value={selectedSemana}
              onChange={(e) => handleSelectSemana(Number(e.target.value))}
              style={{
                padding: "0.45rem 0.85rem",
                borderRadius: "0.55rem",
                border: "1.5px solid #16a34a",
                background: "#ffffff",
                color: "#166534",
                fontSize: "0.88rem",
                fontWeight: 800,
                outline: "none",
                cursor: "pointer"
              }}
            >
              {availableWeeks.map((w) => (
                <option key={w.numero_semana} value={w.numero_semana}>
                  {getWeekDisplayName(w)}
                </option>
              ))}
            </select>

            <span
              style={{
                background: currentWeekInfo.esExamen ? "#fef3c7" : "#dcfce7",
                color: currentWeekInfo.esExamen ? "#b45309" : "#15803d",
                padding: "0.2rem 0.6rem",
                borderRadius: "9999px",
                fontSize: "0.74rem",
                fontWeight: 800
              }}
            >
              {getWeekDisplayName(currentWeekInfo)}
            </span>

            {/* Badges de Temas programados en esta semana */}
            <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", flexWrap: "wrap" }}>
              {weekTopics.length > 0 ? (
                weekTopics.map((t) => (
                  <span
                    key={t.id}
                    style={{
                      background: "#ffffff",
                      border: "1px solid #86efac",
                      color: "#166534",
                      padding: "0.2rem 0.55rem",
                      borderRadius: "0.45rem",
                      fontSize: "0.74rem",
                      fontWeight: 700,
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "0.3rem"
                    }}
                  >
                    <BookOpen size={11} color="#16a34a" />
                    <span>Tema {t.numero_tema}: {t.titulo}</span>
                  </span>
                ))
              ) : !currentWeekInfo.esExamen ? (
                <span style={{ fontSize: "0.74rem", color: "#64748b", fontStyle: "italic" }}>
                  (No hay temas con manual evaluable en el temario para esta semana)
                </span>
              ) : null}
            </div>
          </div>

          {/* Estadísticas de la semana */}
          {weekTopics.length > 0 && (
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.35rem", background: "#ffffff", border: "1px solid #cbd5e1", padding: "0.3rem 0.65rem", borderRadius: "0.5rem", fontSize: "0.78rem" }}>
                <span style={{ color: "#475569", fontWeight: 800 }}>Temas: {weekTopics.length}</span>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: "0.35rem", background: "#ffffff", border: "1px solid #bbf7d0", padding: "0.3rem 0.65rem", borderRadius: "0.5rem", fontSize: "0.78rem" }}>
                <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#16a34a" }} />
                <span style={{ color: "#166534", fontWeight: 800 }}>Completos: {stats.gradedCount}</span>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: "0.35rem", background: "#ffffff", border: "1px solid #fed7aa", padding: "0.3rem 0.65rem", borderRadius: "0.5rem", fontSize: "0.78rem" }}>
                <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#f97316" }} />
                <span style={{ color: "#c2410c", fontWeight: 800 }}>Pendientes: {stats.pendingCount}</span>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: "0.35rem", background: "#ffffff", border: "1px solid #bfdbfe", padding: "0.3rem 0.65rem", borderRadius: "0.5rem", fontSize: "0.78rem" }}>
                <span style={{ color: "#1d4ed8", fontWeight: 800 }}>Promedio: {stats.average} pts</span>
              </div>
            </div>
          )}
        </div>

        {/* Fila 3: Acciones masivas por tema y Barra de Búsqueda */}
        {weekTopics.length > 0 && (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "0.75rem", paddingTop: "0.25rem" }}>
            {/* Acciones Rápidas */}
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
              {weekTopics.map((t) => (
                <button
                  key={t.id}
                  onClick={() => handleBatchGradeTopic(t)}
                  disabled={!canEdit}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "0.35rem",
                    background: canEdit ? "#eff6ff" : "#f1f5f9",
                    border: canEdit ? "1.5px solid #bfdbfe" : "1px solid #cbd5e1",
                    color: canEdit ? "#1d4ed8" : "#94a3b8",
                    padding: "0.4rem 0.75rem",
                    borderRadius: "0.55rem",
                    fontSize: "0.78rem",
                    fontWeight: 800,
                    cursor: canEdit ? "pointer" : "not-allowed",
                    opacity: canEdit ? 1 : 0.6,
                    transition: "all 0.15s ease"
                  }}
                  title={!canEdit ? "Solo lectura" : `Asignar nota a todos en Tema ${t.numero_tema}`}
                >
                  <CheckCheck size={14} />
                  <span>Asignar a todos: Tema {t.numero_tema}</span>
                </button>
              ))}

              <button
                onClick={handleClearWeekManuals}
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
                title={!canEdit ? "Solo lectura" : "Limpiar calificaciones de manuales de esta semana"}
              >
                <span>Limpiar Semana</span>
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
      {/* 2. LISTA DE ALUMNOS CON LAS CASILLAS DE MANUAL POR TEMA             */}
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
        {currentWeekInfo.esExamen ? (
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
            <BookOpen size={36} color="#94a3b8" />
            <strong style={{ fontSize: "1rem", color: "#334155" }}>
              Semana {selectedSemana} es Semana de Examen Parcial
            </strong>
            <span style={{ fontSize: "0.85rem", maxWidth: "450px" }}>
              En las semanas de exámenes parciales no se programan ni evalúan manuales. Para calificar el examen parcial, utiliza el módulo correspondiente.
            </span>
          </div>
        ) : weekTopics.length === 0 ? (
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
            <BookOpen size={36} color="#94a3b8" />
            <strong style={{ fontSize: "1rem", color: "#334155" }}>
              Sin manuales en la Semana {selectedSemana}
            </strong>
            <span style={{ fontSize: "0.85rem", maxWidth: "450px" }}>
              No hay temas con manual evaluable asignados a esta semana en el temario de {carrera}. Puedes agregarlos desde el módulo de Temario de la carrera.
            </span>
          </div>
        ) : (
          <>
            {/* ⚠️ ALERTA: Si hay notas inválidas en la sección */}
            {invalidManualStudents.length > 0 && (
              <div
                style={{
                  background: "#fef2f2",
                  border: "1.5px solid #f87171",
                  borderRadius: "0.75rem",
                  padding: "0.85rem 1.25rem",
                  display: "flex",
                  alignItems: "center",
                  gap: "0.85rem",
                  color: "#991b1b",
                  boxShadow: "0 2px 8px rgba(239, 68, 68, 0.08)"
                }}
              >
                <AlertCircle size={22} color="#dc2626" style={{ flexShrink: 0 }} />
                <div style={{ fontSize: "0.84rem", fontWeight: 700, lineHeight: 1.45 }}>
                  <strong style={{ color: "#b91c1c", fontSize: "0.88rem" }}>
                    ⚠️ Calificaciones fuera de límite detectadas:
                  </strong>{" "}
                  Las notas de manuales <strong>no pueden superar 1.000 punto</strong>. Se encontraron valores superiores al límite (por ejemplo en{" "}
                  <strong>{invalidManualStudents[0].nombre_completo || "un alumno"}</strong>). Debes corregir las casillas con etiqueta roja a un valor entre <strong>0.000 y 1.000</strong> antes de poder guardar los cambios.
                </div>
              </div>
            )}

            {/* Cabecera de la tabla */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: `50px 1.4fr repeat(${weekTopics.length}, minmax(140px, 1fr))`,
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

              {/* Una columna por cada tema de la semana */}
              {weekTopics.map((tema) => (
                <div key={tema.id} style={{ textAlign: "center" }}>
                  <div style={{ color: "#1d4ed8", fontWeight: 900, display: "flex", alignItems: "center", justifyContent: "center", gap: "0.35rem" }}>
                    <span>Manual Tema {tema.numero_tema}</span>
                    <span style={{ fontSize: "0.66rem", fontWeight: 800, background: "#dbeafe", color: "#1e40af", padding: "0.1rem 0.4rem", borderRadius: "9999px" }}>
                      Máx. 1.000 pt
                    </span>
                  </div>
                  <div style={{ fontSize: "0.68rem", color: "#64748b", fontWeight: 600, textTransform: "none", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }} title={tema.titulo}>
                    {tema.titulo}
                  </div>
                </div>
              ))}
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
                  return (
                    <div
                      key={est.numero_cuenta || est.id || index}
                      style={{
                        display: "grid",
                        gridTemplateColumns: `50px 1.4fr repeat(${weekTopics.length}, minmax(140px, 1fr))`,
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

                      {/* Casilla de calificación para cada tema */}
                      {weekTopics.map((tema) => {
                        const gradeVal = getStudentManualGrade(est, tema);

                        return (
                          <div key={tema.id} style={{ display: "flex", justifyContent: "center" }}>
                            <div
                              style={{
                                position: "relative",
                                width: "100%",
                                maxWidth: "140px"
                              }}
                            >
                              <input
                                type="text"
                                inputMode="decimal"
                                value={gradeVal}
                                onChange={(e) => handleGradeChange(est.numero_cuenta, tema, e.target.value)}
                                onBlur={() => {
                                  if (typeof gradeVal === "string" && gradeVal.endsWith(".")) {
                                    handleGradeChange(est.numero_cuenta, tema, gradeVal.slice(0, -1));
                                  }
                                }}
                                disabled={!canEdit}
                                placeholder="0.000"
                                style={{
                                  width: "100%",
                                  textAlign: "center",
                                  padding: "0.5rem 0.6rem",
                                  borderRadius: "0.55rem",
                                  border:
                                    gradeVal !== "" && Number(gradeVal) > 1
                                      ? "2px solid #ef4444"
                                      : gradeVal !== ""
                                      ? "2px solid #3b82f6"
                                      : "1.5px solid #cbd5e1",
                                  background:
                                    !canEdit
                                      ? "#f1f5f9"
                                      : gradeVal !== "" && Number(gradeVal) > 1
                                      ? "#fef2f2"
                                      : gradeVal !== ""
                                      ? "#eff6ff"
                                      : "#ffffff",
                                  color:
                                    !canEdit
                                      ? "#94a3b8"
                                      : gradeVal !== "" && Number(gradeVal) > 1
                                      ? "#b91c1c"
                                      : "#1e3a8a",
                                  fontSize: "0.92rem",
                                  fontWeight: 800,
                                  outline: "none",
                                  cursor: canEdit ? "text" : "not-allowed",
                                  transition: "all 0.15s ease"
                                }}
                                title={
                                  !canEdit
                                    ? `Solo lectura. Docente asignado: ${assignedInstructorForWeek || "ninguno"}`
                                    : gradeVal !== "" && Number(gradeVal) > 1
                                    ? `⚠️ Error: La nota máxima es 1.000 punto (ingresaste: ${gradeVal})`
                                    : `Calificación Manual: ${tema.titulo}`
                                }
                              />

                              {/* 🏷️ ETIQUETA CLARA DE ERROR CUANDO SE EXCEDE EL LÍMITE */}
                              {gradeVal !== "" && Number(gradeVal) > 1 && (
                                <div
                                  style={{
                                    marginTop: "0.35rem",
                                    padding: "0.22rem 0.45rem",
                                    background: "#fee2e2",
                                    border: "1.5px solid #f87171",
                                    borderRadius: "0.45rem",
                                    fontSize: "0.72rem",
                                    fontWeight: 800,
                                    color: "#b91c1c",
                                    textAlign: "center",
                                    lineHeight: 1.25,
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    gap: "0.25rem"
                                  }}
                                >
                                  <span>⚠️ Máx 1.000 pt (ingresaste: {gradeVal})</span>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
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
                    : "linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)",
                  color: "#ffffff",
                  border: "none",
                  padding: "0.65rem 1.5rem",
                  borderRadius: "0.65rem",
                  fontSize: "0.88rem",
                  fontWeight: 800,
                  cursor: (!canEdit || saving) ? "not-allowed" : "pointer",
                  boxShadow: canEdit ? "0 4px 14px rgba(37, 99, 235, 0.25)" : "none",
                  opacity: (!canEdit || saving) ? 0.7 : 1,
                  transition: "all 0.2s ease"
                }}
                title={!canEdit ? "Solo lectura" : "Guardar notas de manuales"}
              >
                {saving ? (
                  <>
                    <RefreshCw size={15} className="animate-spin" />
                    <span>Guardando notas...</span>
                  </>
                ) : !canEdit ? (
                  <>
                    <Lock size={15} />
                    <span>Solo Lectura (Semana {selectedSemana})</span>
                  </>
                ) : (
                  <>
                    <Save size={15} />
                    <span>Guardar Notas de Manuales (Semana {selectedSemana})</span>
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
