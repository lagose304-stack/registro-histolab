import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import {
  CalendarCheck,
  Search,
  Save,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Users,
  Calendar,
  Clock,
  ArrowLeft,
  Check,
  RefreshCw,
  AlertCircle,
  Sparkles,
  ShieldAlert,
  ShieldCheck,
  ChevronRight,
  Filter,
  CheckCheck,
  Lock,
  User,
  HelpCircle
} from "lucide-react";
import { api } from "../services/api";
import {
  isInstructorTitular,
  isWeekAssignedToUser,
  matchesInstructor,
  SECTION_ROLES
} from "../utils/sectionRoleUtils";

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
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  const currentUser = currentInstructor || api.auth.getCurrentInstructor();
  const isTitular = useMemo(() => isInstructorTitular(currentUser, seccion), [currentUser, seccion]);

  // Guardar ref de notify para que no sea dependencia inestable de loadData
  const notifyRef = useRef(notify);
  notifyRef.current = notify;

  // Bandera para no sobreescribir la semana elegida por el usuario
  const hasInitializedWeekRef = useRef(false);

  // Datos
  const [estudiantes, setEstudiantes] = useState([]);
  const [semanasConfig, setSemanasConfig] = useState([]);
  const [temario, setTemario] = useState([]);
  const [asignaciones, setAsignaciones] = useState([]);

  // Selección de semana persistente por sección
  const [selectedSemana, setSelectedSemana] = useState(() => {
    try {
      const saved = sessionStorage.getItem(`histolab_asistencia_semana_${seccion?.id}`);
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
      sessionStorage.setItem(`histolab_asistencia_semana_${seccion?.id}`, String(n));
    } catch (_) {}
  };

  const [searchTerm, setSearchTerm] = useState("");

  const carrera = seccion?.carrera || "Medicina";

  // 1. Cargar configuración académica, estudiantes y asignaciones
  const loadData = useCallback(async (isInitial = false) => {
    if (!seccion?.id) return;
    if (isInitial) setLoading(true);

    try {
      const [resEst, resSemanas, resTemario, resAsig] = await Promise.all([
        api.estudiantes.getBySeccion(seccion.id, carrera),
        api.semanas.getConfig(carrera).catch(() => ({ data: [] })),
        api.temario.getAll({ carrera }).catch(() => ({ data: [] })),
        api.asignaciones.getBySeccion(seccion.id).catch(() => ({ data: [] }))
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

      // Solo elegir semana por defecto si no se había seleccionado ninguna previamente
      if (!hasInitializedWeekRef.current) {
        const savedWeek = sessionStorage.getItem(`histolab_asistencia_semana_${seccion?.id}`);
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
      console.error("Error al cargar lista de estudiantes:", err);
      notifyRef.current("Error al cargar la información de estudiantes de la sección", "error");
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
    if (isTitular) return allAvailableWeeks;
    return allAvailableWeeks.filter((w) =>
      isWeekAssignedToUser(asignaciones, SECTION_ROLES.ASISTENCIA, w.numero_semana, currentUser, seccion)
    );
  }, [allAvailableWeeks, isTitular, asignaciones, currentUser, seccion]);

  // Si la semana seleccionada no está entre las disponibles, ajustar a la primera
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
      descripcion: `Semana ${selectedSemana}`
    };
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
  const canEdit = useMemo(() => {
    if (isTitular) return true;
    if (!assignedRecordForWeek || !assignedRecordForWeek.instructor_id) {
      // Si nadie ha sido asignado a esta semana en "Proporcionar Asignaciones", está bloqueado para edición
      return false;
    }
    return matchesInstructor(currentUser, assignedRecordForWeek.instructor_id, assignedRecordForWeek.instructor_nombre, seccion);
  }, [assignedRecordForWeek, currentUser, seccion, isTitular]);

  // Claves de asistencia para la semana actual
  const asistKey = `asistencia_${selectedSemana}`;
  const legacyKey = `semana_${selectedSemana}`;

  // Helper para leer el estado de asistencia de un estudiante
  const getStudentAsistenciaVal = (est) => {
    return (
      est?.asistencias?.[asistKey] ??
      est?.asistencias?.[legacyKey] ??
      est?.[`Asistencia de la semana ${selectedSemana}`] ??
      null
    );
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
          [asistKey]: finalVal,
          [legacyKey]: finalVal
        };

        return {
          ...est,
          asistencias: updatedAsist,
          [asistKey]: finalVal
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
          [asistKey]: ESTADOS_ASISTENCIA.ASISTIO,
          [legacyKey]: ESTADOS_ASISTENCIA.ASISTIO
        };
        return {
          ...est,
          asistencias: updatedAsist,
          [asistKey]: ESTADOS_ASISTENCIA.ASISTIO
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
          [asistKey]: null,
          [legacyKey]: null
        };
        return {
          ...est,
          asistencias: updatedAsist,
          [asistKey]: null
        };
      })
    );
    setHasUnsavedChanges(true);
    notify(`Se limpió la lista de la Semana ${selectedSemana}`, "info");
  };

  // Guardar lista de asistencia en el backend
  const handleSaveAll = async () => {
    if (!seccion?.id) return;
    if (!canEdit) {
      notify(`No tienes permisos para guardar cambios en la Semana ${selectedSemana}.`, "warning");
      return;
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
      notify("¡Lista de asistencia guardada con éxito!", "success");
    } catch (err) {
      console.error("Error al guardar asistencia:", err);
      notify("Error al guardar la lista de asistencia en el servidor", "error");
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
  }, [estudiantes, asistKey, legacyKey, selectedSemana]);

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
        <RefreshCw size={28} className="animate-spin" color="#c026d3" />
        <span style={{ fontSize: "0.95rem", fontWeight: 700 }}>
          Cargando alumnos matriculados y registro de asistencia...
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
                  background: "linear-gradient(135deg, #c026d3 0%, #9333ea 100%)",
                  color: "#ffffff",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center"
                }}
              >
                <CalendarCheck size={20} />
              </div>

              <h2 style={{ fontSize: "1.35rem", fontWeight: 900, color: "#0f172a", margin: 0, letterSpacing: "-0.01em" }}>
                Pasar Lista de Asistencia
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
                <span>{estudiantes.length} Alumnos Matriculados</span>
              </span>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap", fontSize: "0.82rem", color: "#64748b" }}>
              <span>{carrera}</span>
              <span>•</span>
              <span>{seccion?.dia} {seccion?.hora_inicio} - {seccion?.hora_fin}</span>
              {assignedInstructorForWeek && (
                <>
                  <span>•</span>
                  <span style={{ color: "#7c3aed", fontWeight: 700 }}>
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
                  : "linear-gradient(135deg, #c026d3 0%, #9333ea 100%)",
                color: "#ffffff",
                border: "none",
                padding: "0.6rem 1.25rem",
                borderRadius: "0.65rem",
                fontSize: "0.88rem",
                fontWeight: 800,
                cursor: (!canEdit || saving) ? "not-allowed" : "pointer",
                boxShadow: canEdit
                  ? (hasUnsavedChanges ? "0 4px 14px rgba(16, 185, 129, 0.3)" : "0 4px 14px rgba(192, 38, 211, 0.25)")
                  : "none",
                opacity: (!canEdit || saving) ? 0.7 : 1,
                transition: "all 0.2s ease"
              }}
              title={!canEdit ? "No tienes permisos de edición para esta semana" : "Guardar asistencia"}
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
                  <span>Guardar Lista de Asistencia</span>
                </>
              )}
            </button>
          </div>
        </div>

        {availableWeeks.length === 0 ? (
          <div
            style={{
              background: "#ffffff",
              border: "1.5px dashed #cbd5e1",
              borderRadius: "1rem",
              padding: "3.5rem 2rem",
              textAlign: "center",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "1rem"
            }}
          >
            <div
              style={{
                width: "56px",
                height: "56px",
                borderRadius: "50%",
                background: "#f8fafc",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#64748b",
                border: "1px solid #e2e8f0"
              }}
            >
              <HelpCircle size={28} />
            </div>
            <h3 style={{ margin: 0, fontSize: "1.2rem", fontWeight: 800, color: "#1e293b" }}>
              No tienes semanas asignadas para pasar lista de asistencia
            </h3>
            <p style={{ margin: 0, fontSize: "0.88rem", color: "#64748b", maxWidth: "480px", lineHeight: 1.5 }}>
              En esta sección no tienes asignado el rol oficial de <strong>Pasar lista de asistencia semanal</strong> en ninguna semana. Si requieres acceso para tomar asistencia, contacta al instructor titular ({seccion?.coordinador || "Coordinador de Sección"}).
            </p>
          </div>
        ) : (
          <>
        {/* =================================================================== */}
        {/* BANNER DE REGLA Y PERMISO DE ASIGNACIÓN                             */}
        {/* =================================================================== */}
        {isTitular ? (
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
              Tienes acceso y autorización total como <strong>Instructor Titular</strong> de la sección. {assignedInstructorForWeek ? `Docente asignado a esta semana: ${assignedInstructorForWeek}.` : "Esta semana no tiene docente asignado."}
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
              Tienes asignado el rol oficial de <strong>Pasar lista de asistencia</strong> en la <strong>Semana {selectedSemana}</strong>. Puedes registrar asistencias y guardar cambios.
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
              <strong>Modo de Solo Lectura:</strong> Para la <strong>Semana {selectedSemana}</strong>, la lista de asistencia está asignada a <strong>{assignedInstructorForWeek || "ningún docente (sin asignar)"}</strong>. Solo la persona asignada tiene autorización para registrar o modificar la asistencia.
            </span>
          </div>
        )}

        {/* =================================================================== */}
        {/* SELECTOR DE SEMANA Y RESUMEN DE ASISTENCIA                          */}
        {/* =================================================================== */}
        <div
          style={{
            background: "#fdf4ff",
            border: "1.5px solid #f0abfc",
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
            <span style={{ fontSize: "0.82rem", fontWeight: 800, color: "#701a75", textTransform: "uppercase", letterSpacing: "0.02em" }}>
              Semana a Calificar:
            </span>

            <select
              value={selectedSemana}
              onChange={(e) => handleSelectSemana(Number(e.target.value))}
              style={{
                padding: "0.45rem 0.85rem",
                borderRadius: "0.55rem",
                border: "1.5px solid #c026d3",
                background: "#ffffff",
                color: "#701a75",
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
                background: currentWeekInfo.esExamen ? "#fef3c7" : "#fae8ff",
                color: currentWeekInfo.esExamen ? "#b45309" : "#a21caf",
                padding: "0.2rem 0.6rem",
                borderRadius: "9999px",
                fontSize: "0.74rem",
                fontWeight: 800
              }}
            >
              {getWeekDisplayName(currentWeekInfo)}
            </span>

            {assignedInstructorForWeek && (
              <div
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "0.35rem",
                  fontSize: "0.75rem",
                  fontWeight: 800,
                  padding: "0.2rem 0.65rem",
                  borderRadius: "9999px",
                  background: "#fdf4ff",
                  color: "#a21caf",
                  border: "1px solid #f0abfc"
                }}
              >
                <User size={13} color="#c026d3" />
                <span>Docente asignado: {assignedInstructorForWeek}</span>
              </div>
            )}

            {currentWeekInfo.fecha_inicio && currentWeekInfo.fecha_fin && (
              <span style={{ fontSize: "0.74rem", color: "#64748b", display: "inline-flex", alignItems: "center", gap: "0.25rem" }}>
                <Calendar size={12} />
                <span>{currentWeekInfo.fecha_inicio} al {currentWeekInfo.fecha_fin}</span>
              </span>
            )}
          </div>

          {/* Estadísticas de la semana */}
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.35rem", background: "#ffffff", border: "1px solid #bbf7d0", padding: "0.3rem 0.65rem", borderRadius: "0.5rem", fontSize: "0.78rem" }}>
              <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#16a34a" }} />
              <span style={{ color: "#166534", fontWeight: 800 }}>Asistieron: {stats.asistioCount}</span>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "0.35rem", background: "#ffffff", border: "1px solid #fecdd3", padding: "0.3rem 0.65rem", borderRadius: "0.5rem", fontSize: "0.78rem" }}>
              <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#e11d48" }} />
              <span style={{ color: "#9f1239", fontWeight: 800 }}>Injustificadas: {stats.injustificadaCount}</span>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "0.35rem", background: "#ffffff", border: "1px solid #fde68a", padding: "0.3rem 0.65rem", borderRadius: "0.5rem", fontSize: "0.78rem" }}>
              <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#d97706" }} />
              <span style={{ color: "#92400e", fontWeight: 800 }}>Justificadas: {stats.justificadaCount}</span>
            </div>

            {stats.sinMarcarCount > 0 && (
              <div style={{ display: "flex", alignItems: "center", gap: "0.35rem", background: "#ffffff", border: "1px solid #cbd5e1", padding: "0.3rem 0.65rem", borderRadius: "0.5rem", fontSize: "0.78rem" }}>
                <span style={{ color: "#64748b", fontWeight: 700 }}>Sin marcar: {stats.sinMarcarCount}</span>
              </div>
            )}
          </div>
        </div>

        {/* Fila 3: Acciones masivas y Barra de Búsqueda */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "0.75rem", paddingTop: "0.25rem" }}>
          {/* Acciones Rápidas */}
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
            <button
              onClick={handleMarkAllAsistio}
              disabled={!canEdit}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "0.35rem",
                background: canEdit ? "#f0fdf4" : "#f1f5f9",
                border: canEdit ? "1.5px solid #86efac" : "1px solid #cbd5e1",
                color: canEdit ? "#166534" : "#94a3b8",
                padding: "0.4rem 0.85rem",
                borderRadius: "0.55rem",
                fontSize: "0.8rem",
                fontWeight: 800,
                cursor: canEdit ? "pointer" : "not-allowed",
                opacity: canEdit ? 1 : 0.6,
                transition: "all 0.15s ease"
              }}
              title={!canEdit ? "Solo el docente asignado puede modificar la asistencia" : "Marcar todos como Asistencia"}
            >
              <CheckCheck size={15} />
              <span>Marcar todos como Asistencia</span>
            </button>

            <button
              onClick={handleClearWeek}
              disabled={!canEdit}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "0.35rem",
                background: "#f8fafc",
                border: "1px solid #cbd5e1",
                color: canEdit ? "#475569" : "#94a3b8",
                padding: "0.4rem 0.85rem",
                borderRadius: "0.55rem",
                fontSize: "0.8rem",
                fontWeight: 700,
                cursor: canEdit ? "pointer" : "not-allowed",
                opacity: canEdit ? 1 : 0.6,
                transition: "all 0.15s ease"
              }}
              title={!canEdit ? "Solo el docente asignado puede modificar la asistencia" : "Limpiar semana"}
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
        </>
        )}
      </div>

      {/* =================================================================== */}
      {/* 2. LISTA DE ALUMNOS CON LAS 3 CASILLAS DE ASISTENCIA                */}
      {/* =================================================================== */}
      {availableWeeks.length > 0 && (
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
        {/* Cabecera de la tabla */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "50px 1.4fr 1.6fr",
            padding: "0.6rem 0.85rem",
            background: "#f8fafc",
            borderRadius: "0.65rem",
            border: "1px solid #e2e8f0",
            fontSize: "0.75rem",
            fontWeight: 800,
            color: "#475569",
            textTransform: "uppercase",
            letterSpacing: "0.03em"
          }}
        >
          <span>#</span>
          <span>Alumno / N° de Cuenta</span>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "0.5rem", textAlign: "center" }}>
            <span style={{ color: "#15803d" }}>✓ Asistencia</span>
            <span style={{ color: "#b91c1c" }}>✗ Falta Injustificada</span>
            <span style={{ color: "#b45309" }}>⚠ Falta Justificada</span>
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
              const currentStatus = getStudentAsistenciaVal(est);

              const isAsistio = currentStatus === ESTADOS_ASISTENCIA.ASISTIO;
              const isInjustificada = currentStatus === ESTADOS_ASISTENCIA.INJUSTIFICADA;
              const isJustificada = currentStatus === ESTADOS_ASISTENCIA.JUSTIFICADA;

              return (
                <div
                  key={est.numero_cuenta || est.id || index}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "50px 1.4fr 1.6fr",
                    alignItems: "center",
                    padding: "0.75rem 0.85rem",
                    borderRadius: "0.65rem",
                    border: "1px solid #e2e8f0",
                    background: isAsistio
                      ? "#f0fdf4"
                      : isInjustificada
                      ? "#fff1f2"
                      : isJustificada
                      ? "#fffbeb"
                      : "#ffffff",
                    transition: "all 0.15s ease"
                  }}
                >
                  {/* Número correlativo */}
                  <span style={{ fontSize: "0.8rem", fontWeight: 800, color: "#94a3b8" }}>
                    {String(index + 1).padStart(2, "0")}
                  </span>

                  {/* Nombre Completo y Número de Cuenta */}
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.15rem", paddingRight: "0.5rem" }}>
                    <strong style={{ fontSize: "0.92rem", color: "#0f172a", lineHeight: 1.25 }}>
                      {est.nombre_completo || "Sin Nombre Registrado"}
                    </strong>
                    <span style={{ fontSize: "0.74rem", color: "#64748b", fontFamily: "monospace" }}>
                      Cuenta: {est.numero_cuenta || "Sin cuenta"}
                    </span>
                  </div>

                  {/* LAS 3 CASILLAS DE ASISTENCIA */}
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "0.5rem" }}>
                    {/* CASILLA 1: ASISTENCIA */}
                    <button
                      type="button"
                      onClick={() => handleSelectStatus(est.numero_cuenta, ESTADOS_ASISTENCIA.ASISTIO)}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: "0.35rem",
                        padding: "0.55rem 0.5rem",
                        borderRadius: "0.55rem",
                        border: isAsistio ? "2px solid #16a34a" : "1.5px solid #cbd5e1",
                        background: isAsistio ? "#16a34a" : "#ffffff",
                        color: isAsistio ? "#ffffff" : canEdit ? "#334155" : "#94a3b8",
                        cursor: canEdit ? "pointer" : "not-allowed",
                        fontSize: "0.78rem",
                        fontWeight: 800,
                        boxShadow: isAsistio ? "0 2px 8px rgba(22, 163, 74, 0.25)" : "none",
                        opacity: canEdit ? 1 : (isAsistio ? 0.9 : 0.4),
                        transition: "all 0.15s ease"
                      }}
                      title={!canEdit ? `Solo lectura. Docente asignado: ${assignedInstructorForWeek || "ninguno"}` : "Marcar Asistencia"}
                    >
                      <Check size={14} strokeWidth={isAsistio ? 3 : 2} />
                      <span>Asistencia</span>
                    </button>

                    {/* CASILLA 2: FALTA INJUSTIFICADA */}
                    <button
                      type="button"
                      onClick={() => handleSelectStatus(est.numero_cuenta, ESTADOS_ASISTENCIA.INJUSTIFICADA)}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: "0.35rem",
                        padding: "0.55rem 0.5rem",
                        borderRadius: "0.55rem",
                        border: isInjustificada ? "2px solid #e11d48" : "1.5px solid #cbd5e1",
                        background: isInjustificada ? "#e11d48" : "#ffffff",
                        color: isInjustificada ? "#ffffff" : canEdit ? "#334155" : "#94a3b8",
                        cursor: canEdit ? "pointer" : "not-allowed",
                        fontSize: "0.78rem",
                        fontWeight: 800,
                        boxShadow: isInjustificada ? "0 2px 8px rgba(225, 29, 72, 0.25)" : "none",
                        opacity: canEdit ? 1 : (isInjustificada ? 0.9 : 0.4),
                        transition: "all 0.15s ease"
                      }}
                      title={!canEdit ? `Solo lectura. Docente asignado: ${assignedInstructorForWeek || "ninguno"}` : "Marcar Falta Injustificada"}
                    >
                      <XCircle size={14} strokeWidth={isInjustificada ? 2.5 : 2} />
                      <span>Falta Injustificada</span>
                    </button>

                    {/* CASILLA 3: FALTA JUSTIFICADA */}
                    <button
                      type="button"
                      onClick={() => handleSelectStatus(est.numero_cuenta, ESTADOS_ASISTENCIA.JUSTIFICADA)}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: "0.35rem",
                        padding: "0.55rem 0.5rem",
                        borderRadius: "0.55rem",
                        border: isJustificada ? "2px solid #d97706" : "1.5px solid #cbd5e1",
                        background: isJustificada ? "#d97706" : "#ffffff",
                        color: isJustificada ? "#ffffff" : canEdit ? "#334155" : "#94a3b8",
                        cursor: canEdit ? "pointer" : "not-allowed",
                        fontSize: "0.78rem",
                        fontWeight: 800,
                        boxShadow: isJustificada ? "0 2px 8px rgba(217, 119, 6, 0.25)" : "none",
                        opacity: canEdit ? 1 : (isJustificada ? 0.9 : 0.4),
                        transition: "all 0.15s ease"
                      }}
                      title={!canEdit ? `Solo lectura. Docente asignado: ${assignedInstructorForWeek || "ninguno"}` : "Marcar Falta Justificada"}
                    >
                      <AlertTriangle size={14} strokeWidth={isJustificada ? 2.5 : 2} />
                      <span>Falta Justificada</span>
                    </button>
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
                : "linear-gradient(135deg, #c026d3 0%, #9333ea 100%)",
              color: "#ffffff",
              border: "none",
              padding: "0.65rem 1.5rem",
              borderRadius: "0.65rem",
              fontSize: "0.88rem",
              fontWeight: 800,
              cursor: (!canEdit || saving) ? "not-allowed" : "pointer",
              boxShadow: canEdit ? "0 4px 14px rgba(192, 38, 211, 0.25)" : "none",
              opacity: (!canEdit || saving) ? 0.7 : 1,
              transition: "all 0.2s ease"
            }}
            title={!canEdit ? "Solo lectura. No tienes el rol de esta semana" : "Guardar asistencia"}
          >
            {saving ? (
              <>
                <RefreshCw size={15} className="animate-spin" />
                <span>Guardando asistencia...</span>
              </>
            ) : !canEdit ? (
              <>
                <Lock size={15} />
                <span>Solo Lectura (Semana {selectedSemana})</span>
              </>
            ) : (
              <>
                <Save size={15} />
                <span>Guardar Lista de Asistencia (Semana {selectedSemana})</span>
              </>
            )}
          </button>
        </div>
      </div>
      )}
    </div>
  );
}
