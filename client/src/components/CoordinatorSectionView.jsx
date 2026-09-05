import React, { useState, useEffect, useCallback } from "react";
import {
  ArrowLeft,
  Star,
  Clock,
  Calendar,
  Layers,
  GraduationCap,
  Sparkles,
  ShieldCheck,
  Award,
  CalendarCheck,
  Users,
  Search,
  Mail,
  Phone,
  Hash,
  UserCheck,
  CheckCircle2,
  RefreshCw,
  FileSpreadsheet,
  ArrowRight,
  ChevronRight,
  BookOpen,
  LayoutGrid,
  Building2,
  Database,
  HelpCircle,
  Trophy,
  Radio
} from "lucide-react";
import { api } from "../services/api";
import SectionGradebookView from "./SectionGradebookView";
import SectionAssignmentsView from "./SectionAssignmentsView";
import WeeklyAttendanceTakingView from "./WeeklyAttendanceTakingView";
import WeeklyManualsGradingView from "./WeeklyManualsGradingView";
import WeeklyQuizGradingView from "./WeeklyQuizGradingView";
import WeeklyExamGradingView from "./WeeklyExamGradingView";
import SectionDataMigrationView from "./SectionDataMigrationView";
import WeeklyQuizCreationView from "./WeeklyQuizCreationView";
import ReviewQuizSubmissionsView from "./ReviewQuizSubmissionsView";
import SectionAwardsView from "./SectionAwardsView";
import LiveQuizControlView from "./LiveQuizControlView";
import { getNavState, setNavState } from "../utils/navigationState";

export default function CoordinatorSectionView({
  seccion,
  currentInstructor,
  onClose = () => {},
  notify = () => {}
}) {
  const initialNav = getNavState();
  // activeModule: null (vista de tarjetas) | 'calificaciones' | 'asistencia' | 'instructores'
  const [activeModule, setActiveModuleState] = useState(
    () => initialNav.coordinatorSectionModule || null
  );

  const setActiveModule = (mod) => {
    setActiveModuleState(mod);
    setNavState({ coordinatorSectionModule: mod });
  };

  // Estado para preselección de semana al abrir Control en Vivo desde el creador
  const [liveQuizInitialSemana, setLiveQuizInitialSemana] = useState(null);

  // Estado para la Lista de Instructores de la sección
  const [allInstructors, setAllInstructors] = useState([]);
  const [loadingInstructores, setLoadingInstructores] = useState(false);
  const [searchTermInstructores, setSearchTermInstructores] = useState("");

  const loadInstructores = useCallback(async () => {
    setLoadingInstructores(true);
    try {
      const res = await api.auth.getInstructores();
      if (res?.data) {
        setAllInstructors(res.data);
      }
    } catch (err) {
      console.warn("Aviso al cargar instructores:", err);
      notify("Error al cargar la lista de instructores", "error");
    } finally {
      setLoadingInstructores(false);
    }
  }, [notify]);

  useEffect(() => {
    if (activeModule === "instructores" || !activeModule) {
      loadInstructores();
    }
  }, [activeModule, loadInstructores]);

  if (!seccion) return null;

  // Helper para verificar si un instructor es el Coordinador
  const isSectionCoordinator = (inst) => {
    if (!seccion.coordinador) return false;
    const coordStr = (seccion.coordinador || "").toLowerCase().trim();
    const pNom = (inst.primer_nombre || "").toLowerCase().trim();
    const pApe = (inst.primer_apellido || "").toLowerCase().trim();
    const fName = `${pNom} ${pApe}`.trim();
    const full = (inst.nombre_completo || "").toLowerCase().trim();
    const username = (inst.numero_cuenta || "").toLowerCase().trim();

    return (
      (pNom && pApe && coordStr.includes(pNom) && coordStr.includes(pApe)) ||
      coordStr === fName ||
      coordStr === full ||
      coordStr.includes(fName) ||
      coordStr.includes(username)
    );
  };

  // Obtener IDs de instructores asignados
  const assignedIds = Array.isArray(seccion.instructores_asignados)
    ? seccion.instructores_asignados
    : [];

  // Encontrar al Coordinador en la lista de instructores
  const coordinatorInstructor = allInstructors.find(isSectionCoordinator);

  // Instructores asignados a esta sección
  const assignedInstructorsList = allInstructors.filter((inst) => {
    const isAssigned =
      assignedIds.includes(inst.id) ||
      (inst.numero_cuenta && assignedIds.includes(inst.numero_cuenta));
    return isAssigned && !isSectionCoordinator(inst);
  });

  // Filtrado de instructores por búsqueda
  const filteredAssignedInstructors = assignedInstructorsList.filter((inst) => {
    const s = searchTermInstructores.toLowerCase().trim();
    if (!s) return true;
    const full = `${inst.primer_nombre || ''} ${inst.primer_apellido || ''} ${inst.nombre_completo || ''} ${inst.numero_cuenta || ''} ${inst.correo || ''}`.toLowerCase();
    return full.includes(s);
  });

  const totalInstructores = assignedIds.length + (seccion.coordinador ? 1 : 0);

  return (
    <div className="animate-fade-in" style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
      {/* =================================================================== */}
      {/* 🧭 ENCABEZADO DE LA SECCIÓN                                        */}
      {/* =================================================================== */}
      <div
        className="glass-panel"
        style={{
          padding: "1.25rem 1.5rem",
          background: "linear-gradient(135deg, #ffffff 0%, #f0f9ff 100%)",
          border: "1px solid #bae6fd",
          borderRadius: "1rem",
          boxShadow: "0 4px 15px -3px rgba(2, 132, 199, 0.06)",
          display: "flex",
          flexDirection: "column",
          gap: "1rem"
        }}
      >
        {/* Fila 1: Botón Volver a Mis Secciones y Rol */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "0.5rem" }}>
          <button
            onClick={onClose}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "0.5rem",
              background: "#ffffff",
              border: "1px solid #cbd5e1",
              color: "#334155",
              padding: "0.45rem 0.9rem",
              borderRadius: "0.6rem",
              fontSize: "0.82rem",
              fontWeight: 700,
              cursor: "pointer",
              boxShadow: "0 2px 5px rgba(0,0,0,0.02)",
              transition: "all 0.15s ease"
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "#f8fafc";
              e.currentTarget.style.borderColor = "#94a3b8";
              e.currentTarget.style.transform = "translateX(-2px)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "#ffffff";
              e.currentTarget.style.borderColor = "#cbd5e1";
              e.currentTarget.style.transform = "translateX(0)";
            }}
          >
            <ArrowLeft size={15} />
            <span>Volver a Mis Secciones</span>
          </button>

          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "0.35rem",
              background: "#fffbeb",
              border: "1px solid #fde68a",
              color: "#b45309",
              padding: "0.3rem 0.75rem",
              borderRadius: "9999px",
              fontSize: "0.78rem",
              fontWeight: 800
            }}
          >
            <Star size={13} fill="#f59e0b" color="#d97706" />
            <span>Instructor Titular</span>
          </div>
        </div>

        {/* Fila 2: Título principal destacado 'Panel de Administración — Sección [Código]' */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "0.85rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap" }}>
            <h1
              style={{
                fontSize: "1.65rem",
                fontWeight: 900,
                color: "#0f172a",
                margin: 0,
                letterSpacing: "-0.02em",
                display: "flex",
                alignItems: "center",
                gap: "0.5rem"
              }}
            >
              <span style={{ color: "#0284c7" }}>Panel de Administración</span>
              <span style={{ color: "#cbd5e1", fontWeight: 400 }}>—</span>
              <span
                style={{
                  background: "linear-gradient(135deg, #0369a1 0%, #075985 100%)",
                  color: "#ffffff",
                  padding: "0.2rem 0.75rem",
                  borderRadius: "0.55rem",
                  fontSize: "1.35rem",
                  fontWeight: 900,
                  letterSpacing: "0.02em",
                  boxShadow: "0 2px 8px rgba(3, 105, 161, 0.25)"
                }}
              >
                Sección {seccion.codigo}
              </span>
            </h1>

            <span
              style={{
                background: "#0369a1",
                color: "#ffffff",
                fontWeight: 800,
                fontSize: "0.76rem",
                padding: "0.25rem 0.75rem",
                borderRadius: "9999px",
                textTransform: "uppercase",
                letterSpacing: "0.04em",
                boxShadow: "0 2px 6px rgba(3, 105, 161, 0.2)"
              }}
            >
              {seccion.carrera}
            </span>
          </div>
        </div>

        {/* Fila 3: Tira completa de datos de la sección */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
            gap: "0.75rem",
            background: "#ffffff",
            padding: "0.85rem 1.15rem",
            borderRadius: "0.85rem",
            border: "1px solid #e0f2fe",
            boxShadow: "0 2px 8px rgba(0,0,0,0.02)"
          }}
        >
          {/* Dato 1: Horario y Día */}
          <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
            <div style={{ width: "32px", height: "32px", borderRadius: "0.5rem", background: "#f0f9ff", color: "#0284c7", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <Clock size={16} />
            </div>
            <div style={{ display: "flex", flexDirection: "column" }}>
              <span style={{ fontSize: "0.68rem", color: "#64748b", fontWeight: 700, textTransform: "uppercase" }}>Horario</span>
              <strong style={{ fontSize: "0.82rem", color: "#0f172a" }}>{seccion.dia} {seccion.hora_inicio} - {seccion.hora_fin || "Fin"}</strong>
            </div>
          </div>

          {/* Dato 2: Instructor Titular */}
          <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
            <div style={{ width: "32px", height: "32px", borderRadius: "0.5rem", background: "#fffbeb", color: "#d97706", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <Star size={16} fill="#f59e0b" />
            </div>
            <div style={{ display: "flex", flexDirection: "column" }}>
              <span style={{ fontSize: "0.68rem", color: "#64748b", fontWeight: 700, textTransform: "uppercase" }}>Instructor Titular</span>
              <strong style={{ fontSize: "0.82rem", color: "#78350f", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "180px" }} title={coordinatorInstructor ? `${coordinatorInstructor.primer_nombre || ''} ${coordinatorInstructor.primer_apellido || ''}`.trim() || coordinatorInstructor.nombre_completo : seccion.coordinador || "Sin asignar"}>
                {coordinatorInstructor ? `${coordinatorInstructor.primer_nombre || ''} ${coordinatorInstructor.primer_apellido || ''}`.trim() || coordinatorInstructor.nombre_completo : seccion.coordinador || "Sin asignar"}
              </strong>
            </div>
          </div>

          {/* Dato 3: Doctor Encargado */}
          <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
            <div style={{ width: "32px", height: "32px", borderRadius: "0.5rem", background: "#f0fdf4", color: "#16a34a", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <GraduationCap size={16} />
            </div>
            <div style={{ display: "flex", flexDirection: "column" }}>
              <span style={{ fontSize: "0.68rem", color: "#64748b", fontWeight: 700, textTransform: "uppercase" }}>Doctor Encargado</span>
              <strong style={{ fontSize: "0.82rem", color: "#15803d", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "180px" }} title={seccion.doctor_encargado || "Dr. Rafael Perdomo Vaquero"}>
                {seccion.doctor_encargado || "Dr. Rafael Perdomo Vaquero"}
              </strong>
            </div>
          </div>

          {/* Dato 4: Instructores Asignados */}
          <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
            <div style={{ width: "32px", height: "32px", borderRadius: "0.5rem", background: "#e0f2fe", color: "#0369a1", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <Users size={16} />
            </div>
            <div style={{ display: "flex", flexDirection: "column" }}>
              <span style={{ fontSize: "0.68rem", color: "#64748b", fontWeight: 700, textTransform: "uppercase" }}>Instructores Asignados</span>
              <strong style={{ fontSize: "0.82rem", color: "#0369a1" }}>{totalInstructores} Instructor{totalInstructores === 1 ? "" : "es"}</strong>
            </div>
          </div>
        </div>
      </div>

      {/* =================================================================== */}
      {/* 🔘 BOTÓN LLAMATIVO: VOLVER A MÓDULOS (SI UN MÓDULO ESTÁ ABIERTO)    */}
      {/* =================================================================== */}
      {activeModule && (
        <div style={{ display: "flex", alignItems: "center" }}>
          <button
            onClick={() => setActiveModule(null)}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "0.6rem",
              background: "linear-gradient(135deg, #0284c7 0%, #0369a1 100%)",
              color: "#ffffff",
              border: "none",
              padding: "0.65rem 1.35rem",
              borderRadius: "0.75rem",
              fontSize: "0.9rem",
              fontWeight: 800,
              cursor: "pointer",
              boxShadow: "0 4px 14px rgba(2, 132, 199, 0.28)",
              transition: "all 0.15s ease"
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = "translateX(-3px)";
              e.currentTarget.style.boxShadow = "0 6px 20px rgba(2, 132, 199, 0.4)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = "translateX(0)";
              e.currentTarget.style.boxShadow = "0 4px 14px rgba(2, 132, 199, 0.28)";
            }}
          >
            <ArrowLeft size={18} />
            <span>Volver a Módulos de la Sección</span>
          </button>
        </div>
      )}

      {/* =================================================================== */}
      {/* 🎴 VISTA 1: TARJETAS DE MÓDULOS                                     */}
      {/* =================================================================== */}
      {!activeModule && (
        <div style={{ display: "flex", flexDirection: "column", gap: "2.25rem" }}>
          {/* SECCIÓN A: MÓDULOS GENERALES DE LA SECCIÓN */}
          <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <div style={{ width: "4px", height: "18px", borderRadius: "2px", background: "#0284c7" }} />
              <h3 style={{ fontSize: "1.05rem", fontWeight: 800, color: "#0f172a", margin: 0 }}>
                Módulos de la Sección
              </h3>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
                gap: "1.25rem"
              }}
            >
              {/* TARJETA 1: CALIFICACIONES */}
              <div
                onClick={() => setActiveModule("calificaciones")}
                style={{
                  background: "#ffffff",
                  borderRadius: "1rem",
                  border: "1.5px solid #bbf7d0",
                  boxShadow: "0 6px 18px -4px rgba(22, 163, 74, 0.08)",
                  padding: "1.5rem",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                  gap: "1rem",
                  cursor: "pointer",
                  transition: "all 0.15s ease"
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = "translateY(-3px)";
                  e.currentTarget.style.borderColor = "#16a34a";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = "translateY(0)";
                  e.currentTarget.style.borderColor = "#bbf7d0";
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "0.85rem" }}>
                  <div
                    style={{
                      width: "48px",
                      height: "48px",
                      borderRadius: "0.75rem",
                      background: "linear-gradient(135deg, #16a34a 0%, #15803d 100%)",
                      color: "#ffffff",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0
                    }}
                  >
                    <Award size={24} />
                  </div>

                  <div>
                    <h3 style={{ fontSize: "1.1rem", fontWeight: 800, color: "#0f172a", margin: 0 }}>
                      Calificaciones
                    </h3>
                    <span style={{ fontSize: "0.8rem", color: "#64748b" }}>
                      Cuadro de notas y exportación a Excel
                    </span>
                  </div>
                </div>

                <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", color: "#15803d", fontSize: "0.82rem", fontWeight: 800, gap: "0.25rem" }}>
                  <span>Abrir</span>
                  <ArrowRight size={14} />
                </div>
              </div>

              {/* TARJETA 2: ASISTENCIA */}
              <div
                onClick={() => setActiveModule("asistencia")}
                style={{
                  background: "#ffffff",
                  borderRadius: "1rem",
                  border: "1.5px solid #fde68a",
                  boxShadow: "0 6px 18px -4px rgba(217, 119, 6, 0.08)",
                  padding: "1.5rem",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                  gap: "1rem",
                  cursor: "pointer",
                  transition: "all 0.15s ease"
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = "translateY(-3px)";
                  e.currentTarget.style.borderColor = "#f59e0b";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = "translateY(0)";
                  e.currentTarget.style.borderColor = "#fde68a";
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "0.85rem" }}>
                  <div
                    style={{
                      width: "48px",
                      height: "48px",
                      borderRadius: "0.75rem",
                      background: "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)",
                      color: "#ffffff",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0
                    }}
                  >
                    <CalendarCheck size={24} />
                  </div>

                  <div>
                    <h3 style={{ fontSize: "1.1rem", fontWeight: 800, color: "#0f172a", margin: 0 }}>
                      Lista de Asistencia
                    </h3>
                    <span style={{ fontSize: "0.8rem", color: "#64748b" }}>
                      Registro semanal y derecho a examen
                    </span>
                  </div>
                </div>

                <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", color: "#b45309", fontSize: "0.82rem", fontWeight: 800, gap: "0.25rem" }}>
                  <span>Abrir</span>
                  <ArrowRight size={14} />
                </div>
              </div>

              {/* TARJETA 3: INSTRUCTORES */}
              <div
                onClick={() => setActiveModule("instructores")}
                style={{
                  background: "#ffffff",
                  borderRadius: "1rem",
                  border: "1.5px solid #bae6fd",
                  boxShadow: "0 6px 18px -4px rgba(2, 132, 199, 0.08)",
                  padding: "1.5rem",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                  gap: "1rem",
                  cursor: "pointer",
                  transition: "all 0.15s ease"
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = "translateY(-3px)";
                  e.currentTarget.style.borderColor = "#0284c7";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = "translateY(0)";
                  e.currentTarget.style.borderColor = "#bae6fd";
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "0.85rem" }}>
                  <div
                    style={{
                      width: "48px",
                      height: "48px",
                      borderRadius: "0.75rem",
                      background: "linear-gradient(135deg, #0284c7 0%, #0369a1 100%)",
                      color: "#ffffff",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0
                    }}
                  >
                    <Users size={24} />
                  </div>

                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                      <h3 style={{ fontSize: "1.1rem", fontWeight: 800, color: "#0f172a", margin: 0 }}>
                        Instructores
                      </h3>
                      <span style={{ fontSize: "0.7rem", background: "#e0f2fe", color: "#0369a1", fontWeight: 800, padding: "0.1rem 0.4rem", borderRadius: "9999px" }}>
                        {totalInstructores}
                      </span>
                    </div>
                    <span style={{ fontSize: "0.8rem", color: "#64748b" }}>
                      Instructor titular y equipo de instructores
                    </span>
                  </div>
                </div>

                <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", color: "#0284c7", fontSize: "0.82rem", fontWeight: 800, gap: "0.25rem" }}>
                  <span>Ver</span>
                  <ArrowRight size={14} />
                </div>
              </div>

              {/* TARJETA 4: ASIGNACIONES (PROPORCIONAR ASIGNACIONES) */}
              <div
                onClick={() => setActiveModule("asignaciones")}
                style={{
                  background: "#ffffff",
                  borderRadius: "1rem",
                  border: "1.5px solid #bfdbfe",
                  boxShadow: "0 6px 18px -4px rgba(59, 130, 246, 0.08)",
                  padding: "1.5rem",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                  gap: "1rem",
                  cursor: "pointer",
                  transition: "all 0.15s ease"
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = "translateY(-3px)";
                  e.currentTarget.style.borderColor = "#3b82f6";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = "translateY(0)";
                  e.currentTarget.style.borderColor = "#bfdbfe";
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "0.85rem" }}>
                  <div
                    style={{
                      width: "48px",
                      height: "48px",
                      borderRadius: "0.75rem",
                      background: "linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)",
                      color: "#ffffff",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0
                    }}
                  >
                    <BookOpen size={24} />
                  </div>

                  <div>
                    <h3 style={{ fontSize: "1.1rem", fontWeight: 800, color: "#0f172a", margin: 0 }}>
                      Proporcionar Asignaciones
                    </h3>
                    <span style={{ fontSize: "0.8rem", color: "#64748b" }}>
                      Roles de sección y distribución docente
                    </span>
                  </div>
                </div>

                <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", color: "#2563eb", fontSize: "0.82rem", fontWeight: 800, gap: "0.25rem" }}>
                  <span>Abrir</span>
                  <ArrowRight size={14} />
                </div>
              </div>
            </div>
          </div>

          {/* SECCIÓN B: ASIGNACIONES SEMANALES (NUEVA SECCIÓN SEPARADA) */}
          <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "0.5rem" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <div style={{ width: "4px", height: "18px", borderRadius: "2px", background: "#8b5cf6" }} />
                <div>
                  <h3 style={{ fontSize: "1.05rem", fontWeight: 800, color: "#0f172a", margin: 0 }}>
                    Asignaciones Semanales
                  </h3>
                  <span style={{ fontSize: "0.76rem", color: "#64748b" }}>
                    Módulos operativos de ejecución por rol semanal
                  </span>
                </div>
              </div>

              <span style={{ fontSize: "0.72rem", fontWeight: 800, background: "#f5f3ff", color: "#7c3aed", border: "1px solid #ddd6fe", padding: "0.2rem 0.6rem", borderRadius: "9999px" }}>
                Roles Operativos
              </span>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
                gap: "1.25rem"
              }}
            >
              {/* 1. Pasar lista de asistencia */}
              <div
                onClick={() => setActiveModule("pasar_asistencia")}
                style={{
                  background: "#ffffff",
                  borderRadius: "1rem",
                  border: "1.5px solid #f0abfc",
                  boxShadow: "0 6px 18px -4px rgba(192, 38, 211, 0.08)",
                  padding: "1.5rem",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                  gap: "1rem",
                  cursor: "pointer",
                  transition: "all 0.15s ease"
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = "translateY(-3px)";
                  e.currentTarget.style.borderColor = "#c026d3";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = "translateY(0)";
                  e.currentTarget.style.borderColor = "#f0abfc";
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "0.85rem" }}>
                  <div
                    style={{
                      width: "48px",
                      height: "48px",
                      borderRadius: "0.75rem",
                      background: "linear-gradient(135deg, #c026d3 0%, #9333ea 100%)",
                      color: "#ffffff",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0
                    }}
                  >
                    <CalendarCheck size={24} />
                  </div>

                  <div>
                    <h3 style={{ fontSize: "1.1rem", fontWeight: 800, color: "#0f172a", margin: 0 }}>
                      Pasar lista de asistencia
                    </h3>
                    <span style={{ fontSize: "0.8rem", color: "#64748b" }}>
                      Registro de asistencia de la semana asignada
                    </span>
                  </div>
                </div>

                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: "0.75rem", color: "#a21caf", fontWeight: 800 }}>
                  <span style={{ background: "#fae8ff", padding: "0.15rem 0.5rem", borderRadius: "9999px" }}>
                    Pasar Lista
                  </span>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.2rem" }}>
                    <span>Abrir</span>
                    <ArrowRight size={14} />
                  </div>
                </div>
              </div>

              {/* 2. Subir Nota de manuales */}
              <div
                onClick={() => setActiveModule("subir_manuales")}
                style={{
                  background: "#ffffff",
                  borderRadius: "1rem",
                  border: "1.5px solid #bfdbfe",
                  boxShadow: "0 6px 18px -4px rgba(37, 99, 235, 0.08)",
                  padding: "1.5rem",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                  gap: "1rem",
                  cursor: "pointer",
                  transition: "all 0.15s ease"
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = "translateY(-3px)";
                  e.currentTarget.style.borderColor = "#2563eb";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = "translateY(0)";
                  e.currentTarget.style.borderColor = "#bfdbfe";
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "0.85rem" }}>
                  <div
                    style={{
                      width: "48px",
                      height: "48px",
                      borderRadius: "0.75rem",
                      background: "linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)",
                      color: "#ffffff",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0
                    }}
                  >
                    <BookOpen size={24} />
                  </div>

                  <div>
                    <h3 style={{ fontSize: "1.1rem", fontWeight: 800, color: "#0f172a", margin: 0 }}>
                      Subir Nota de manuales
                    </h3>
                    <span style={{ fontSize: "0.8rem", color: "#64748b" }}>
                      Ingreso de notas por temas (Máx. 1.000 pt c/u)
                    </span>
                  </div>
                </div>

                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: "0.75rem", color: "#1d4ed8", fontWeight: 800 }}>
                  <span style={{ background: "#eff6ff", padding: "0.15rem 0.5rem", borderRadius: "9999px" }}>
                    Subir Notas
                  </span>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.2rem" }}>
                    <span>Abrir</span>
                    <ArrowRight size={14} />
                  </div>
                </div>
              </div>

              {/* 3. Subir nota de Prueba semanal */}
              <div
                onClick={() => setActiveModule("subir_prueba")}
                style={{
                  background: "#ffffff",
                  borderRadius: "1rem",
                  border: "1.5px solid #bbf7d0",
                  boxShadow: "0 6px 18px -4px rgba(22, 163, 74, 0.08)",
                  padding: "1.5rem",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                  gap: "1rem",
                  cursor: "pointer",
                  transition: "all 0.15s ease"
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = "translateY(-3px)";
                  e.currentTarget.style.borderColor = "#16a34a";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = "translateY(0)";
                  e.currentTarget.style.borderColor = "#bbf7d0";
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "0.85rem" }}>
                  <div
                    style={{
                      width: "48px",
                      height: "48px",
                      borderRadius: "0.75rem",
                      background: "linear-gradient(135deg, #16a34a 0%, #15803d 100%)",
                      color: "#ffffff",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0
                    }}
                  >
                    <Award size={24} />
                  </div>

                  <div>
                    <h3 style={{ fontSize: "1.1rem", fontWeight: 800, color: "#0f172a", margin: 0 }}>
                      Subir nota de Prueba semanal
                    </h3>
                    <span style={{ fontSize: "0.8rem", color: "#64748b" }}>
                      Calificación de prueba corta (Máx. 5.000 pts c/u)
                    </span>
                  </div>
                </div>

                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: "0.75rem", color: "#15803d", fontWeight: 800 }}>
                  <span style={{ background: "#f0fdf4", padding: "0.15rem 0.5rem", borderRadius: "9999px" }}>
                    Subir Nota
                  </span>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.2rem" }}>
                    <span>Abrir</span>
                    <ArrowRight size={14} />
                  </div>
                </div>
              </div>

              {/* 4. Subir Nota de Examen parcial */}
              <div
                onClick={() => setActiveModule("subir_examen")}
                style={{
                  background: "#ffffff",
                  borderRadius: "1rem",
                  border: "1.5px solid #c7d2fe",
                  boxShadow: "0 6px 18px -4px rgba(99, 102, 241, 0.08)",
                  padding: "1.5rem",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                  gap: "1rem",
                  cursor: "pointer",
                  transition: "all 0.15s ease"
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = "translateY(-3px)";
                  e.currentTarget.style.borderColor = "#6366f1";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = "translateY(0)";
                  e.currentTarget.style.borderColor = "#c7d2fe";
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "0.85rem" }}>
                  <div
                    style={{
                      width: "48px",
                      height: "48px",
                      borderRadius: "0.75rem",
                      background: "linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)",
                      color: "#ffffff",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0
                    }}
                  >
                    <GraduationCap size={24} />
                  </div>

                  <div>
                    <h3 style={{ fontSize: "1.1rem", fontWeight: 800, color: "#0f172a", margin: 0 }}>
                      Subir Nota de Examen parcial
                    </h3>
                    <span style={{ fontSize: "0.8rem", color: "#64748b" }}>
                      Calificación de exámenes I, II y III Parcial
                    </span>
                  </div>
                </div>

                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: "0.75rem", color: "#4f46e5", fontWeight: 800 }}>
                  <span style={{ background: "#eef2ff", padding: "0.15rem 0.5rem", borderRadius: "9999px" }}>
                    Subir Notas
                  </span>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.2rem" }}>
                    <span>Abrir</span>
                    <ArrowRight size={14} />
                  </div>
                </div>
              </div>

              {/* 5. Crear prueba semanal */}
              <div
                onClick={() => setActiveModule("crear_prueba")}
                style={{
                  background: "#ffffff",
                  borderRadius: "1rem",
                  border: "1px solid #e2e8f0",
                  padding: "1.5rem",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                  gap: "1rem",
                  cursor: "pointer",
                  transition: "all 0.15s ease"
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = "translateY(-3px)";
                  e.currentTarget.style.borderColor = "#0284c7";
                  e.currentTarget.style.boxShadow = "var(--shadow-md)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = "translateY(0)";
                  e.currentTarget.style.borderColor = "#e2e8f0";
                  e.currentTarget.style.boxShadow = "none";
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "0.85rem" }}>
                  <div
                    style={{
                      width: "48px",
                      height: "48px",
                      borderRadius: "0.75rem",
                      background: "linear-gradient(135deg, #0284c7 0%, #0369a1 100%)",
                      color: "#ffffff",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0
                    }}
                  >
                    <HelpCircle size={24} />
                  </div>

                  <div>
                    <h3 style={{ fontSize: "1.1rem", fontWeight: 800, color: "#0f172a", margin: 0 }}>
                      Crear prueba semanal
                    </h3>
                    <span style={{ fontSize: "0.8rem", color: "#64748b" }}>
                      Diseño, reactivos y cuestionario semanal
                    </span>
                  </div>
                </div>

                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: "0.75rem", color: "#0284c7", fontWeight: 800 }}>
                  <span style={{ background: "#e0f2fe", padding: "0.15rem 0.5rem", borderRadius: "9999px" }}>
                    Diseñar Reactivos
                  </span>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.2rem" }}>
                    <span>Abrir</span>
                    <ArrowRight size={14} />
                  </div>
                </div>
              </div>

              {/* 5B. Control en Vivo de Pruebas Semanales (Transmisión y Sincronización) */}
              <div
                onClick={() => {
                  setLiveQuizInitialSemana(null);
                  setActiveModule("control_en_vivo");
                }}
                style={{
                  background: "#ffffff",
                  borderRadius: "1rem",
                  border: "1.5px solid #fca5a5",
                  boxShadow: "0 6px 18px -4px rgba(239, 68, 68, 0.12)",
                  padding: "1.5rem",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                  gap: "1rem",
                  cursor: "pointer",
                  transition: "all 0.15s ease"
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = "translateY(-3px)";
                  e.currentTarget.style.borderColor = "#ef4444";
                  e.currentTarget.style.boxShadow = "0 10px 22px -4px rgba(239, 68, 68, 0.25)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = "translateY(0)";
                  e.currentTarget.style.borderColor = "#fca5a5";
                  e.currentTarget.style.boxShadow = "0 6px 18px -4px rgba(239, 68, 68, 0.12)";
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "0.85rem" }}>
                  <div
                    style={{
                      width: "48px",
                      height: "48px",
                      borderRadius: "0.75rem",
                      background: "linear-gradient(135deg, #ef4444 0%, #b91c1c 100%)",
                      color: "#ffffff",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                      boxShadow: "0 4px 12px rgba(239, 68, 68, 0.35)"
                    }}
                  >
                    <Radio size={24} />
                  </div>

                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                      <h3 style={{ fontSize: "1.1rem", fontWeight: 800, color: "#0f172a", margin: 0 }}>
                        Control en Vivo
                      </h3>
                      <span style={{ fontSize: "0.68rem", background: "#fef2f2", color: "#dc2626", fontWeight: 900, padding: "0.1rem 0.45rem", borderRadius: "9999px", border: "1px solid #fecaca" }}>
                        EN DIRECTO
                      </span>
                    </div>
                    <span style={{ fontSize: "0.8rem", color: "#64748b" }}>
                      Habilitar prueba, sala de espera y tiempo por pregunta (1:30 min)
                    </span>
                  </div>
                </div>

                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: "0.75rem", color: "#dc2626", fontWeight: 800 }}>
                  <span style={{ background: "#fef2f2", padding: "0.15rem 0.5rem", borderRadius: "9999px", border: "1px solid #fecaca" }}>
                    Tiempo Real
                  </span>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.2rem" }}>
                    <span>Abrir Control</span>
                    <ArrowRight size={14} />
                  </div>
                </div>
              </div>

              {/* 6. Revisar respuestas de pruebas semanales */}
              <div
                onClick={() => setActiveModule("revisar_respuestas")}
                style={{
                  background: "#ffffff",
                  borderRadius: "1rem",
                  border: "1.5px solid #86efac",
                  boxShadow: "0 6px 18px -4px rgba(16, 185, 129, 0.08)",
                  padding: "1.5rem",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                  gap: "1rem",
                  cursor: "pointer",
                  transition: "all 0.15s ease"
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = "translateY(-3px)";
                  e.currentTarget.style.borderColor = "#10b981";
                  e.currentTarget.style.boxShadow = "var(--shadow-md)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = "translateY(0)";
                  e.currentTarget.style.borderColor = "#86efac";
                  e.currentTarget.style.boxShadow = "0 6px 18px -4px rgba(16, 185, 129, 0.08)";
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "0.85rem" }}>
                  <div
                    style={{
                      width: "48px",
                      height: "48px",
                      borderRadius: "0.75rem",
                      background: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
                      color: "#ffffff",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                      boxShadow: "0 4px 12px rgba(16, 185, 129, 0.25)"
                    }}
                  >
                    <CheckCircle2 size={24} />
                  </div>

                  <div>
                    <h3 style={{ fontSize: "1.1rem", fontWeight: 800, color: "#0f172a", margin: 0 }}>
                      Revisar respuestas
                    </h3>
                    <span style={{ fontSize: "0.8rem", color: "#64748b" }}>
                      Calificación de pruebas enviadas por alumnos
                    </span>
                  </div>
                </div>

                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: "0.75rem", color: "#059669", fontWeight: 800 }}>
                  <span style={{ background: "#ecfdf5", padding: "0.15rem 0.5rem", borderRadius: "9999px", border: "1px solid #a7f3d0" }}>
                    Calificar Entregas
                  </span>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.2rem" }}>
                    <span>Abrir</span>
                    <ArrowRight size={14} />
                  </div>
                </div>
              </div>

              {/* 7. Premios de la Sección (Top 3) */}
              <div
                onClick={() => setActiveModule("premios")}
                style={{
                  background: "#ffffff",
                  borderRadius: "1rem",
                  border: "1.5px solid #fde68a",
                  boxShadow: "0 6px 18px -4px rgba(245, 158, 11, 0.12)",
                  padding: "1.5rem",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                  gap: "1rem",
                  cursor: "pointer",
                  transition: "all 0.15s ease"
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = "translateY(-3px)";
                  e.currentTarget.style.borderColor = "#f59e0b";
                  e.currentTarget.style.boxShadow = "0 10px 22px -4px rgba(245, 158, 11, 0.25)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = "translateY(0)";
                  e.currentTarget.style.borderColor = "#fde68a";
                  e.currentTarget.style.boxShadow = "0 6px 18px -4px rgba(245, 158, 11, 0.12)";
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "0.85rem" }}>
                  <div
                    style={{
                      width: "48px",
                      height: "48px",
                      borderRadius: "0.75rem",
                      background: "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)",
                      color: "#ffffff",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                      boxShadow: "0 4px 12px rgba(245, 158, 11, 0.35)"
                    }}
                  >
                    <Trophy size={24} />
                  </div>

                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                      <h3 style={{ fontSize: "1.1rem", fontWeight: 800, color: "#0f172a", margin: 0 }}>
                        Premios de la Sección
                      </h3>
                      <span style={{ fontSize: "0.68rem", background: "#fef3c7", color: "#b45309", fontWeight: 800, padding: "0.1rem 0.45rem", borderRadius: "9999px", border: "1px solid #fde68a" }}>
                        Top 3
                      </span>
                    </div>
                    <span style={{ fontSize: "0.8rem", color: "#64748b" }}>
                      Ranking paralelo con bonificaciones de pruebas (hasta 6 pts)
                    </span>
                  </div>
                </div>

                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: "0.75rem", color: "#b45309", fontWeight: 800 }}>
                  <span style={{ background: "#fffbeb", padding: "0.15rem 0.5rem", borderRadius: "9999px", border: "1px solid #fde68a" }}>
                    Cuadro de Honor
                  </span>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.2rem" }}>
                    <span>Abrir</span>
                    <ArrowRight size={14} />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* ================================================================= */}
          {/* SECCIÓN 3: EXCLUSIVO DE MIGRACIÓN                                  */}
          {/* ================================================================= */}
          <div style={{ display: "flex", flexDirection: "column", gap: "1rem", marginTop: "0.5rem" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
              <div
                style={{
                  width: "10px",
                  height: "10px",
                  borderRadius: "50%",
                  background: "#d97706"
                }}
              />
              <h3 style={{ fontSize: "1.15rem", fontWeight: 900, color: "#0f172a", margin: 0, letterSpacing: "-0.01em" }}>
                Exclusivo de Migración
              </h3>
              <span
                style={{
                  fontSize: "0.72rem",
                  fontWeight: 800,
                  background: "#fef3c7",
                  color: "#92400e",
                  padding: "0.2rem 0.6rem",
                  borderRadius: "9999px",
                  border: "1px solid #fde68a"
                }}
              >
                Sin Restricción
              </span>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
                gap: "1.25rem"
              }}
            >
              {/* ÚNICO COMPONENTE: MIGRAR DATOS */}
              <div
                onClick={() => setActiveModule("migrar_datos")}
                style={{
                  background: "#ffffff",
                  borderRadius: "1rem",
                  border: "1.5px solid #fde68a",
                  boxShadow: "0 6px 18px -4px rgba(217, 119, 6, 0.1)",
                  padding: "1.5rem",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                  gap: "1rem",
                  cursor: "pointer",
                  transition: "all 0.15s ease"
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = "translateY(-3px)";
                  e.currentTarget.style.borderColor = "#d97706";
                  e.currentTarget.style.boxShadow = "0 10px 24px -4px rgba(217, 119, 6, 0.2)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = "translateY(0)";
                  e.currentTarget.style.borderColor = "#fde68a";
                  e.currentTarget.style.boxShadow = "0 6px 18px -4px rgba(217, 119, 6, 0.1)";
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "0.85rem" }}>
                  <div
                    style={{
                      width: "48px",
                      height: "48px",
                      borderRadius: "0.75rem",
                      background: "linear-gradient(135deg, #d97706 0%, #b45309 100%)",
                      color: "#ffffff",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                      boxShadow: "0 4px 12px rgba(217, 119, 6, 0.3)"
                    }}
                  >
                    <Database size={24} />
                  </div>

                  <div>
                    <h3 style={{ fontSize: "1.1rem", fontWeight: 800, color: "#0f172a", margin: 0 }}>
                      Migrar Datos
                    </h3>
                    <span style={{ fontSize: "0.8rem", color: "#64748b" }}>
                      Subir manuales, pruebas, exámenes y asistencia sin restricción
                    </span>
                  </div>
                </div>

                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: "0.75rem", color: "#b45309", fontWeight: 800 }}>
                  <span style={{ background: "#fef3c7", padding: "0.15rem 0.5rem", borderRadius: "9999px" }}>
                    Acceso Total
                  </span>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.2rem" }}>
                    <span>Abrir Módulo</span>
                    <ArrowRight size={14} />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* 📦 VISTA 2: MÓDULO ABIERTO                                          */}
      {/* =================================================================== */}
      {activeModule === "calificaciones" && (
        <SectionGradebookView
          seccion={seccion}
          forcedViewType="notas"
          hideBackButton={true}
          notify={notify}
        />
      )}

      {activeModule === "asistencia" && (
        <SectionGradebookView
          seccion={seccion}
          forcedViewType="asistencia"
          hideBackButton={true}
          notify={notify}
        />
      )}

      {activeModule === "asignaciones" && (
        <SectionAssignmentsView
          seccion={seccion}
          hideBackButton={true}
          notify={notify}
        />
      )}

      {activeModule === "pasar_asistencia" && (
        <WeeklyAttendanceTakingView
          seccion={seccion}
          currentInstructor={currentInstructor}
          hideBackButton={false}
          onClose={() => setActiveModule(null)}
          notify={notify}
        />
      )}

      {activeModule === "subir_manuales" && (
        <WeeklyManualsGradingView
          seccion={seccion}
          currentInstructor={currentInstructor}
          hideBackButton={false}
          onClose={() => setActiveModule(null)}
          notify={notify}
        />
      )}

      {activeModule === "subir_prueba" && (
        <WeeklyQuizGradingView
          seccion={seccion}
          currentInstructor={currentInstructor}
          hideBackButton={false}
          onClose={() => setActiveModule(null)}
          notify={notify}
        />
      )}

      {activeModule === "subir_examen" && (
        <WeeklyExamGradingView
          seccion={seccion}
          currentInstructor={currentInstructor}
          hideBackButton={false}
          onClose={() => setActiveModule(null)}
          notify={notify}
        />
      )}

      {activeModule === "migrar_datos" && (
        <SectionDataMigrationView
          seccion={seccion}
          currentInstructor={currentInstructor}
          hideBackButton={false}
          onClose={() => setActiveModule(null)}
          notify={notify}
        />
      )}

      {activeModule === "crear_prueba" && (
        <WeeklyQuizCreationView
          seccion={seccion}
          currentInstructor={currentInstructor}
          hideBackButton={false}
          onClose={() => setActiveModule(null)}
          notify={notify}
          onOpenLiveControl={(sem) => {
            setLiveQuizInitialSemana(sem);
            setActiveModule("control_en_vivo");
          }}
        />
      )}

      {activeModule === "control_en_vivo" && (
        <LiveQuizControlView
          seccion={seccion}
          currentInstructor={currentInstructor}
          initialSemana={liveQuizInitialSemana}
          hideBackButton={false}
          onClose={() => setActiveModule(null)}
          notify={notify}
        />
      )}

      {activeModule === "revisar_respuestas" && (
        <ReviewQuizSubmissionsView
          seccion={seccion}
          currentInstructor={currentInstructor}
          hideBackButton={false}
          onClose={() => setActiveModule(null)}
          notify={notify}
        />
      )}

      {activeModule === "premios" && (
        <SectionAwardsView
          seccion={seccion}
          currentInstructor={currentInstructor}
          hideBackButton={false}
          onClose={() => setActiveModule(null)}
          notify={notify}
        />
      )}

      {activeModule === "instructores" && (
        <div
          className="glass-panel"
          style={{
            padding: "1.5rem",
            background: "#ffffff",
            borderRadius: "1rem",
            border: "1px solid #e2e8f0",
            boxShadow: "0 4px 15px -3px rgba(0, 0, 0, 0.04)",
            display: "flex",
            flexDirection: "column",
            gap: "1.25rem"
          }}
        >
          {/* Cabecera del Módulo 3 */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "0.75rem" }}>
            <h2 style={{ fontSize: "1.15rem", fontWeight: 800, color: "#0f172a", margin: 0 }}>
              Equipo Docente
            </h2>

            {/* Buscador */}
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", width: "100%", maxWidth: "300px" }}>
              <div style={{ position: "relative", width: "100%" }}>
                <Search size={14} color="#94a3b8" style={{ position: "absolute", left: "0.75rem", top: "50%", transform: "translateY(-50%)" }} />
                <input
                  type="text"
                  placeholder="Buscar instructor..."
                  value={searchTermInstructores}
                  onChange={(e) => setSearchTermInstructores(e.target.value)}
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

              <button
                onClick={loadInstructores}
                disabled={loadingInstructores}
                style={{
                  background: "#ffffff",
                  border: "1px solid #cbd5e1",
                  borderRadius: "0.5rem",
                  padding: "0.45rem 0.65rem",
                  cursor: "pointer",
                  color: "#64748b"
                }}
                title="Recargar"
              >
                <RefreshCw size={14} className={loadingInstructores ? "animate-spin" : ""} />
              </button>
            </div>
          </div>

          {loadingInstructores ? (
            <div style={{ padding: "3rem", textAlign: "center", color: "#64748b", fontSize: "0.9rem" }}>
              Cargando instructores...
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
              {/* Instructor Titular */}
              <div
                style={{
                  background: "#fffbeb",
                  border: "1.5px solid #fde68a",
                  borderRadius: "0.85rem",
                  padding: "1rem 1.25rem",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  flexWrap: "wrap",
                  gap: "1rem"
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "0.85rem" }}>
                  <div
                    style={{
                      width: "42px",
                      height: "42px",
                      borderRadius: "0.75rem",
                      background: "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)",
                      color: "#ffffff",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontWeight: 900
                    }}
                  >
                    <Star size={20} fill="#ffffff" />
                  </div>

                  <div>
                    <span style={{ fontSize: "0.7rem", color: "#b45309", fontWeight: 800, textTransform: "uppercase" }}>
                      Instructor Titular
                    </span>
                    <h3 style={{ fontSize: "1.05rem", fontWeight: 800, color: "#78350f", margin: 0 }}>
                      {coordinatorInstructor
                        ? `${coordinatorInstructor.primer_nombre || ''} ${coordinatorInstructor.primer_apellido || ''}`.trim() || coordinatorInstructor.nombre_completo
                        : seccion.coordinador || "Sin Instructor Titular Asignado"}
                    </h3>

                    <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginTop: "0.2rem", fontSize: "0.78rem", color: "#92400e", flexWrap: "wrap" }}>
                      {coordinatorInstructor?.numero_cuenta && (
                        <span>Cuenta: <strong>{coordinatorInstructor.numero_cuenta}</strong></span>
                      )}
                      {coordinatorInstructor?.correo && (
                        <span>{coordinatorInstructor.correo}</span>
                      )}
                      {coordinatorInstructor?.telefono && (
                        <span>{coordinatorInstructor.telefono}</span>
                      )}
                    </div>
                  </div>
                </div>

                <div
                  style={{
                    background: "#ffffff",
                    padding: "0.35rem 0.65rem",
                    borderRadius: "0.5rem",
                    border: "1px solid #fde68a",
                    color: "#b45309",
                    fontSize: "0.74rem",
                    fontWeight: 800
                  }}
                >
                  Responsable
                </div>
              </div>

              {/* Instructores Asignados */}
              <div>
                <div style={{ marginBottom: "0.6rem" }}>
                  <h4 style={{ fontSize: "0.92rem", fontWeight: 800, color: "#334155", margin: 0 }}>
                    Instructores Asignados ({assignedInstructorsList.length})
                  </h4>
                </div>

                {filteredAssignedInstructors.length === 0 ? (
                  <div
                    style={{
                      padding: "2rem",
                      textAlign: "center",
                      background: "#f8fafc",
                      border: "1px dashed #cbd5e1",
                      borderRadius: "0.75rem",
                      color: "#64748b",
                      fontSize: "0.84rem"
                    }}
                  >
                    {searchTermInstructores
                      ? "No se encontraron instructores."
                      : "No hay instructores adicionales asignados a esta sección."}
                  </div>
                ) : (
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(auto-fill, minmax(250px, 1fr))",
                      gap: "0.85rem"
                    }}
                  >
                    {filteredAssignedInstructors.map((inst, idx) => {
                      const initial = (inst.primer_nombre?.[0] || inst.nombre_completo?.[0] || "I").toUpperCase();
                      const name = `${inst.primer_nombre || ''} ${inst.primer_apellido || ''}`.trim() || inst.nombre_completo || "Instructor";

                      return (
                        <div
                          key={inst.id || idx}
                          style={{
                            background: "#ffffff",
                            border: "1px solid #e2e8f0",
                            borderRadius: "0.75rem",
                            padding: "0.85rem",
                            display: "flex",
                            flexDirection: "column",
                            gap: "0.6rem"
                          }}
                        >
                          <div style={{ display: "flex", alignItems: "center", gap: "0.65rem" }}>
                            <div
                              style={{
                                width: "36px",
                                height: "36px",
                                borderRadius: "0.6rem",
                                background: "#0284c7",
                                color: "#ffffff",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                fontSize: "0.95rem",
                                fontWeight: 800,
                                flexShrink: 0
                              }}
                            >
                              {initial}
                            </div>

                            <div style={{ overflow: "hidden" }}>
                              <h5 style={{ fontSize: "0.88rem", fontWeight: 800, color: "#0f172a", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                {name}
                              </h5>
                              <span style={{ fontSize: "0.72rem", color: "#64748b" }}>
                                {inst.numero_cuenta ? `Cuenta: ${inst.numero_cuenta}` : "Instructor"}
                              </span>
                            </div>
                          </div>

                          <div style={{ fontSize: "0.74rem", color: "#64748b", display: "flex", flexDirection: "column", gap: "0.2rem" }}>
                            {inst.correo && <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{inst.correo}</span>}
                            {inst.telefono && <span>Tel: {inst.telefono}</span>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

