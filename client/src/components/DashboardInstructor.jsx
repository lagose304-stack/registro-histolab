import React, { useState, useEffect, useCallback } from "react";
import {
  Users,
  ShieldCheck,
  ArrowRight,
  Sparkles,
  Layers,
  Laptop,
  BookOpen,
  Star,
  Clock,
  Calendar,
  GraduationCap,
  Award,
  CheckCircle2,
  AlertCircle
} from "lucide-react";
import { api } from "../services/api";
import UserManagementView from "./UserManagementView";
import SectionManagementView from "./SectionManagementView";
import TemarioManagementView from "./TemarioManagementView";
import WeekDefinitionView from "./WeekDefinitionView";
import CoordinatorSectionView from "./CoordinatorSectionView";
import InstructorSectionView from "./InstructorSectionView";

import { getNavState, setNavState } from "../utils/navigationState";
import { safeStorage } from "../utils/safeStorage";

const CARRERA_THEMES = {
  MEDICINA: { bg: "#f0f9ff", border: "#bae6fd", text: "#0369a1", badge: "#0284c7", gradient: "linear-gradient(135deg, #0284c7 0%, #0369a1 100%)" },
  ENFERMERIA: { bg: "#f0fdfa", border: "#99f6e4", text: "#0f766e", badge: "#0d9488", gradient: "linear-gradient(135deg, #0d9488 0%, #0f766e 100%)" },
  ODONTOLOGIA: { bg: "#fdf4ff", border: "#f5d0fe", text: "#a21caf", badge: "#c026d3", gradient: "linear-gradient(135deg, #c026d3 0%, #a21caf 100%)" },
  MICROBIOLOGIA: { bg: "#fffbeb", border: "#fde68a", text: "#b45309", badge: "#d97706", gradient: "linear-gradient(135deg, #d97706 0%, #b45309 100%)" },
  NUTRICION: { bg: "#f0fdf4", border: "#bbf7d0", text: "#15803d", badge: "#16a34a", gradient: "linear-gradient(135deg, #16a34a 0%, #15803d 100%)" },
  DEFAULT: { bg: "#f8fafc", border: "#e2e8f0", text: "#475569", badge: "#64748b", gradient: "linear-gradient(135deg, #64748b 0%, #475569 100%)" }
};

export default function DashboardInstructor({ instructor, notify = () => {} }) {
  const [currentGreeting, setCurrentGreeting] = useState("¡Buen día!");
  
  // Restauración automática del estado de navegación al recargar la página
  const initialNav = getNavState();
  const [activeModule, setActiveModuleState] = useState(() => initialNav.activeModule || null);
  const [selectedCoordinatorSeccion, setSelectedCoordinatorSeccionState] = useState(() => initialNav.selectedCoordinatorSeccion || null);
  const [selectedInstructorSeccion, setSelectedInstructorSeccionState] = useState(() => initialNav.selectedInstructorSeccion || null);
  const [misSecciones, setMisSecciones] = useState(() => {
    try {
      const cached = safeStorage.getSession(`histolab_cached_mis_secciones_${instructor?.id || 'default'}`);
      return cached ? JSON.parse(cached) : [];
    } catch {
      return [];
    }
  });
  const [loadingSecciones, setLoadingSecciones] = useState(() => {
    try {
      const cached = safeStorage.getSession(`histolab_cached_mis_secciones_${instructor?.id || 'default'}`);
      return !cached;
    } catch {
      return true;
    }
  });

  const setActiveModule = (mod) => {
    setActiveModuleState(mod);
    setNavState({ activeModule: mod });
  };

  const setSelectedCoordinatorSeccion = (sec) => {
    setSelectedCoordinatorSeccionState(sec);
    setNavState({ selectedCoordinatorSeccion: sec });
  };

  const setSelectedInstructorSeccion = (sec) => {
    setSelectedInstructorSeccionState(sec);
    setNavState({ selectedInstructorSeccion: sec });
  };

  useEffect(() => {
    const hour = new Date().getHours();
    if (hour < 12) {
      setCurrentGreeting("¡Buenos días!");
    } else if (hour < 18) {
      setCurrentGreeting("¡Buenas tardes!");
    } else {
      setCurrentGreeting("¡Buenas noches!");
    }
  }, []);

  const fullName = instructor
    ? `${instructor.primer_nombre || ''} ${instructor.segundo_nombre ? instructor.segundo_nombre + ' ' : ''}${instructor.primer_apellido || ''} ${instructor.segundo_apellido || ''}`.trim() || instructor.nombre_completo || "Instructor"
    : "Instructor";

  const rolNormalized = (instructor?.rol || "").toLowerCase().trim();
  const isCreadorOrAdmin = rolNormalized === "creador" || rolNormalized === "administrador" || rolNormalized === "admin";

  let todayFormatted = "";
  try {
    todayFormatted = new Date().toLocaleDateString("es-HN", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric"
    });
  } catch (_) {
    try {
      todayFormatted = new Date().toLocaleDateString("es-ES", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric"
      });
    } catch (_) {
      todayFormatted = new Date().toDateString();
    }
  }

  // Determina si el instructor actual es el Coordinador titular de una sección
  const checkIsCoord = useCallback((sec) => {
    if (!sec) return false;
    const coordStr = (sec.coordinador || "").toLowerCase().trim();
    const pNombre = (instructor?.primer_nombre || "").toLowerCase().trim();
    const pApellido = (instructor?.primer_apellido || "").toLowerCase().trim();
    const fName = fullName.toLowerCase().trim();
    return (
      Boolean(pNombre && pApellido && coordStr.includes(pNombre) && coordStr.includes(pApellido)) ||
      coordStr === fName ||
      (fName.length > 0 && coordStr.includes(fName))
    );
  }, [instructor, fullName]);

  // Cargar secciones y filtrar aquellas donde el instructor es Coordinador o Instructor Asignado
  const loadMisSecciones = useCallback(async () => {
    setLoadingSecciones(true);
    try {
      const res = await api.secciones.getAll();
      if (res?.data) {
        const allSecs = res.data;

        // Filtrar secciones donde el instructor es Coordinador O está Asignado
        const misSecs = allSecs.filter((sec) => {
          const isCoord = checkIsCoord(sec);
          const isAssigned = Array.isArray(sec.instructores_asignados) && (
            (instructor?.id && sec.instructores_asignados.includes(instructor.id)) ||
            (instructor?.numero_cuenta && sec.instructores_asignados.includes(instructor.numero_cuenta))
          );
          return isCoord || isAssigned;
        });

        setMisSecciones(misSecs);
        try {
          safeStorage.setSession(`histolab_cached_mis_secciones_${instructor?.id || 'default'}`, JSON.stringify(misSecs));
        } catch (_) {}
      }
    } catch (err) {
      console.warn("Error al cargar mis secciones:", err);
    } finally {
      setLoadingSecciones(false);
    }
  }, [instructor, checkIsCoord]);

  useEffect(() => {
    loadMisSecciones();
  }, [loadMisSecciones]);

  // Si se abre la vista de la sección como Coordinador
  if (selectedCoordinatorSeccion) {
    return (
      <CoordinatorSectionView
        seccion={selectedCoordinatorSeccion}
        currentInstructor={instructor}
        onClose={() => setSelectedCoordinatorSeccion(null)}
        notify={notify}
      />
    );
  }

  // Si se abre la vista de la sección como Instructor Asignado
  if (selectedInstructorSeccion) {
    return (
      <CoordinatorSectionView
        seccion={selectedInstructorSeccion}
        currentInstructor={instructor}
        onClose={() => setSelectedInstructorSeccion(null)}
        notify={notify}
      />
    );
  }

  // Si hay un módulo activo abierto (Administración General exclusiva para Creador y Administrador)
  if (activeModule === "user-management") {
    if (!isCreadorOrAdmin) {
      setActiveModule(null);
      return null;
    }
    return (
      <UserManagementView
        currentInstructor={instructor}
        onClose={() => setActiveModule(null)}
        notify={notify}
      />
    );
  }

  if (activeModule === "section-management") {
    if (!isCreadorOrAdmin) {
      setActiveModule(null);
      return null;
    }
    return (
      <SectionManagementView
        currentInstructor={instructor}
        onClose={() => setActiveModule(null)}
        notify={notify}
      />
    );
  }

  if (activeModule === "temario-management") {
    if (!isCreadorOrAdmin) {
      setActiveModule(null);
      return null;
    }
    return (
      <TemarioManagementView
        currentInstructor={instructor}
        onClose={() => setActiveModule(null)}
        notify={notify}
      />
    );
  }

  if (activeModule === "week-definition") {
    if (!isCreadorOrAdmin) {
      setActiveModule(null);
      return null;
    }
    return (
      <WeekDefinitionView
        currentInstructor={instructor}
        onClose={() => setActiveModule(null)}
        notify={notify}
      />
    );
  }

  const coordsCount = misSecciones.filter((sec) => checkIsCoord(sec)).length;
  const assignedCount = misSecciones.length - coordsCount;

  return (
    <div className="animate-fade-in" style={{ display: "flex", flexDirection: "column", gap: "1.75rem" }}>
      {/* Tarjeta de Bienvenida & Perfil del Instructor */}
      <div
        className="glass-panel"
        style={{
          padding: "2rem",
          background: "linear-gradient(135deg, #ffffff 0%, #f0f9ff 100%)",
          border: "1px solid #bae6fd",
          position: "relative",
          overflow: "hidden"
        }}
      >
        <div style={{
          position: "absolute",
          top: "-20px",
          right: "-20px",
          width: "180px",
          height: "180px",
          background: "radial-gradient(circle, rgba(2, 132, 199, 0.12) 0%, rgba(2, 132, 199, 0) 70%)",
          borderRadius: "50%",
          pointerEvents: "none"
        }} />

        <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "flex-start", gap: "1.5rem", position: "relative", zIndex: 2 }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.4rem" }}>
              <span style={{ fontSize: "0.82rem", color: "var(--text-muted)", textTransform: "capitalize" }}>
                {todayFormatted}
              </span>
            </div>

            <h1 style={{ fontSize: "2rem", fontWeight: 800, color: "#0f172a", margin: "0.2rem 0" }}>
              {currentGreeting} <span className="text-gradient">{fullName}</span>
            </h1>
          </div>

          {/* Ficha de datos institucionales */}
          <div style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "0.6rem",
            background: "#ffffff",
            padding: "0.85rem 1.15rem",
            borderRadius: "var(--radius-lg)",
            border: "1px solid #e2e8f0",
            boxShadow: "var(--shadow-sm)"
          }}>
            {instructor?.numero_cuenta && (
              <div style={{ display: "flex", flexDirection: "column", paddingRight: "0.85rem", borderRight: "1px solid #f1f5f9" }}>
                <span style={{ fontSize: "0.7rem", color: "var(--text-muted)", fontWeight: 600, textTransform: "uppercase" }}>No. Cuenta</span>
                <strong style={{ fontSize: "0.92rem", color: "#0f172a" }}>{instructor.numero_cuenta}</strong>
              </div>
            )}

            <div style={{ display: "flex", flexDirection: "column", paddingRight: "0.85rem", borderRight: "1px solid #f1f5f9" }}>
              <span style={{ fontSize: "0.7rem", color: "var(--text-muted)", fontWeight: 600, textTransform: "uppercase" }}>Rol</span>
              <strong style={{
                fontSize: "0.92rem",
                color: instructor?.rol === "Creador" ? "#7c3aed" : "#075985",
                fontWeight: 800,
                display: "inline-flex",
                alignItems: "center",
                gap: "0.3rem"
              }}>
                {instructor?.rol === "Creador" ? (
                  <>
                    <Laptop size={15} /> Creador
                  </>
                ) : (
                  instructor?.rol || "Instructor"
                )}
              </strong>
            </div>

            {instructor?.comite && (
              <div style={{ display: "flex", flexDirection: "column", paddingRight: "0.85rem", borderRight: "1px solid #f1f5f9" }}>
                <span style={{ fontSize: "0.7rem", color: "var(--text-muted)", fontWeight: 600, textTransform: "uppercase" }}>Comité</span>
                <strong style={{ fontSize: "0.92rem", color: "#0f766e" }}>{instructor.comite}</strong>
              </div>
            )}

            <div style={{ display: "flex", flexDirection: "column" }}>
              <span style={{ fontSize: "0.7rem", color: "var(--text-muted)", fontWeight: 600, textTransform: "uppercase" }}>Estado</span>
              <span style={{ fontSize: "0.85rem", color: "#059669", fontWeight: 700, display: "flex", alignItems: "center", gap: "0.3rem" }}>
                <span style={{ width: "7px", height: "7px", borderRadius: "50%", background: "#10b981" }} />
                Activo
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ======================================================================= */}
      {/* 🏛️ SECCIÓN 1: ADMINISTRACIÓN GENERAL (Exclusivo Creador y Administrador) */}
      {/* ======================================================================= */}
      {isCreadorOrAdmin && (
      <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "0.5rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.65rem" }}>
            <div
              style={{
                width: "36px",
                height: "36px",
                borderRadius: "0.6rem",
                background: "linear-gradient(135deg, #0284c7 0%, #0369a1 100%)",
                color: "#ffffff",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: "0 4px 10px rgba(2, 132, 199, 0.25)"
              }}
            >
              <ShieldCheck size={20} />
            </div>
            <div>
              <h2 style={{ fontSize: "1.25rem", fontWeight: 800, color: "#0f172a", margin: 0, letterSpacing: "-0.01em" }}>
                Administración General
              </h2>
              <span style={{ fontSize: "0.82rem", color: "#64748b" }}>
                Control global de cuentas de instructores, programación de secciones y temario académico
              </span>
            </div>
          </div>

          <span
            style={{
              fontSize: "0.76rem",
              fontWeight: 700,
              color: "#0369a1",
              background: "#e0f2fe",
              padding: "0.25rem 0.7rem",
              borderRadius: "9999px",
              border: "1px solid #bae6fd"
            }}
          >
            4 Módulos Activos
          </span>
        </div>

        {/* Cuadrícula de Tarjetas de Administración General */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(260px, 280px))",
            gap: "1.5rem"
          }}
        >
          {/* 🔲 TARJETA 1: ADMINISTRACIÓN DE USUARIOS */}
          <div
            onClick={() => setActiveModule("user-management")}
            style={{
              aspectRatio: "1 / 1",
              background: "linear-gradient(145deg, #ffffff 0%, #f8fafc 100%)",
              borderRadius: "1.25rem",
              border: "1px solid #e2e8f0",
              boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.05)",
              padding: "1.6rem",
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
              cursor: "pointer",
              position: "relative",
              overflow: "hidden",
              transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)"
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = "translateY(-5px)";
              e.currentTarget.style.borderColor = "#7dd3fc";
              e.currentTarget.style.boxShadow = "0 20px 35px -10px rgba(2, 132, 199, 0.2)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = "translateY(0)";
              e.currentTarget.style.borderColor = "#e2e8f0";
              e.currentTarget.style.boxShadow = "0 10px 25px -5px rgba(0, 0, 0, 0.05)";
            }}
          >
            {/* Círculo sutil de fondo */}
            <div
              style={{
                position: "absolute",
                top: "-15%",
                right: "-15%",
                width: "120px",
                height: "120px",
                background: "radial-gradient(circle, rgba(2, 132, 199, 0.12) 0%, rgba(2, 132, 199, 0) 70%)",
                borderRadius: "50%",
                pointerEvents: "none"
              }}
            />

            {/* Parte Superior: Ícono & Badge */}
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
              <div
                style={{
                  width: "52px",
                  height: "52px",
                  borderRadius: "1rem",
                  background: "linear-gradient(135deg, #0284c7 0%, #0369a1 100%)",
                  color: "#ffffff",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  boxShadow: "0 6px 16px rgba(2, 132, 199, 0.3)"
                }}
              >
                <Users size={26} />
              </div>

              <span
                style={{
                  fontSize: "0.72rem",
                  fontWeight: 700,
                  color: "#0369a1",
                  background: "#e0f2fe",
                  border: "1px solid #bae6fd",
                  padding: "0.25rem 0.6rem",
                  borderRadius: "9999px"
                }}
              >
                Gestión
              </span>
            </div>

            {/* Parte Central: Título y Descripción */}
            <div>
              <h3 style={{ fontSize: "1.15rem", fontWeight: 800, color: "#0f172a", margin: "0 0 0.4rem" }}>
                Administración de Usuarios
              </h3>
              <p style={{ fontSize: "0.82rem", color: "#64748b", margin: 0, lineHeight: 1.35 }}>
                Herramientas para <strong>crear</strong>, <strong>editar</strong> y <strong>borrar</strong> instructores y accesos.
              </p>
            </div>

            {/* Parte Inferior: Botón / Indicador de Ingreso */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                paddingTop: "0.75rem",
                borderTop: "1px solid #f1f5f9",
                color: "#0284c7",
                fontSize: "0.84rem",
                fontWeight: 700
              }}
            >
              <span>Abrir módulo</span>
              <div
                style={{
                  width: "28px",
                  height: "28px",
                  borderRadius: "50%",
                  background: "#f0fdfa",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center"
                }}
              >
                <ArrowRight size={15} />
              </div>
            </div>
          </div>

          {/* 🔲 TARJETA 2: ADMINISTRAR SECCIONES */}
          <div
            onClick={() => setActiveModule("section-management")}
            style={{
              aspectRatio: "1 / 1",
              background: "linear-gradient(145deg, #ffffff 0%, #f8fafc 100%)",
              borderRadius: "1.25rem",
              border: "1px solid #e2e8f0",
              boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.05)",
              padding: "1.6rem",
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
              cursor: "pointer",
              position: "relative",
              overflow: "hidden",
              transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)"
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = "translateY(-5px)";
              e.currentTarget.style.borderColor = "#99f6e4";
              e.currentTarget.style.boxShadow = "0 20px 35px -10px rgba(13, 148, 136, 0.2)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = "translateY(0)";
              e.currentTarget.style.borderColor = "#e2e8f0";
              e.currentTarget.style.boxShadow = "0 10px 25px -5px rgba(0, 0, 0, 0.05)";
            }}
          >
            {/* Círculo sutil de fondo */}
            <div
              style={{
                position: "absolute",
                top: "-15%",
                right: "-15%",
                width: "120px",
                height: "120px",
                background: "radial-gradient(circle, rgba(13, 148, 136, 0.12) 0%, rgba(13, 148, 136, 0) 70%)",
                borderRadius: "50%",
                pointerEvents: "none"
              }}
            />

            {/* Parte Superior: Ícono & Badge */}
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
              <div
                style={{
                  width: "52px",
                  height: "52px",
                  borderRadius: "1rem",
                  background: "linear-gradient(135deg, #0d9488 0%, #0f766e 100%)",
                  color: "#ffffff",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  boxShadow: "0 6px 16px rgba(13, 148, 136, 0.3)"
                }}
              >
                <Layers size={26} />
              </div>

              <span
                style={{
                  fontSize: "0.72rem",
                  fontWeight: 700,
                  color: "#0f766e",
                  background: "#ccfbf1",
                  border: "1px solid #99f6e4",
                  padding: "0.25rem 0.6rem",
                  borderRadius: "9999px"
                }}
              >
                Académico
              </span>
            </div>

            {/* Parte Central: Título y Descripción */}
            <div>
              <h3 style={{ fontSize: "1.15rem", fontWeight: 800, color: "#0f172a", margin: "0 0 0.4rem" }}>
                Administrar Secciones
              </h3>
              <p style={{ fontSize: "0.82rem", color: "#64748b", margin: 0, lineHeight: 1.35 }}>
                Herramientas para <strong>crear</strong>, <strong>editar</strong> y <strong>borrar</strong> secciones de laboratorio.
              </p>
            </div>

            {/* Parte Inferior: Botón / Indicador de Ingreso */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                paddingTop: "0.75rem",
                borderTop: "1px solid #f1f5f9",
                color: "#0d9488",
                fontSize: "0.84rem",
                fontWeight: 700
              }}
            >
              <span>Abrir módulo</span>
              <div
                style={{
                  width: "28px",
                  height: "28px",
                  borderRadius: "50%",
                  background: "#f0fdfa",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center"
                }}
              >
                <ArrowRight size={15} />
              </div>
            </div>
          </div>

          {/* 🔲 TARJETA 3: ADMINISTRAR TEMARIO */}
          <div
            onClick={() => setActiveModule("temario-management")}
            style={{
              aspectRatio: "1 / 1",
              background: "linear-gradient(145deg, #ffffff 0%, #f8fafc 100%)",
              borderRadius: "1.25rem",
              border: "1px solid #e2e8f0",
              boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.05)",
              padding: "1.6rem",
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
              cursor: "pointer",
              position: "relative",
              overflow: "hidden",
              transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)"
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = "translateY(-5px)";
              e.currentTarget.style.borderColor = "#bae6fd";
              e.currentTarget.style.boxShadow = "0 20px 35px -10px rgba(2, 132, 199, 0.2)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = "translateY(0)";
              e.currentTarget.style.borderColor = "#e2e8f0";
              e.currentTarget.style.boxShadow = "0 10px 25px -5px rgba(0, 0, 0, 0.05)";
            }}
          >
            {/* Círculo sutil de fondo */}
            <div
              style={{
                position: "absolute",
                top: "-15%",
                right: "-15%",
                width: "120px",
                height: "120px",
                background: "radial-gradient(circle, rgba(2, 132, 199, 0.12) 0%, rgba(2, 132, 199, 0) 70%)",
                borderRadius: "50%",
                pointerEvents: "none"
              }}
            />

            {/* Parte Superior: Ícono & Badge */}
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
              <div
                style={{
                  width: "52px",
                  height: "52px",
                  borderRadius: "1rem",
                  background: "linear-gradient(135deg, #0284c7 0%, #0369a1 100%)",
                  color: "#ffffff",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  boxShadow: "0 6px 16px rgba(2, 132, 199, 0.3)"
                }}
              >
                <BookOpen size={26} />
              </div>

              <span
                style={{
                  fontSize: "0.72rem",
                  fontWeight: 700,
                  color: "#0369a1",
                  background: "#e0f2fe",
                  border: "1px solid #bae6fd",
                  padding: "0.25rem 0.6rem",
                  borderRadius: "9999px"
                }}
              >
                Programa
              </span>
            </div>

            {/* Parte Central: Título y Descripción */}
            <div>
              <h3 style={{ fontSize: "1.15rem", fontWeight: 800, color: "#0f172a", margin: "0 0 0.4rem" }}>
                Administrar Temario
              </h3>
              <p style={{ fontSize: "0.82rem", color: "#64748b", margin: 0, lineHeight: 1.35 }}>
                Herramientas para <strong>crear</strong>, <strong>editar</strong> y <strong>borrar</strong> temas de laboratorio.
              </p>
            </div>

            {/* Parte Inferior: Botón / Indicador de Ingreso */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                paddingTop: "0.75rem",
                borderTop: "1px solid #f1f5f9",
                color: "#0284c7",
                fontSize: "0.84rem",
                fontWeight: 700
              }}
            >
              <span>Abrir módulo</span>
              <div
                style={{
                  width: "28px",
                  height: "28px",
                  borderRadius: "50%",
                  background: "#f0fdfa",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center"
                }}
              >
                <ArrowRight size={15} />
              </div>
            </div>
          </div>

          {/* 🔲 TARJETA 4: DEFINIR SEMANA */}
          <div
            onClick={() => setActiveModule("week-definition")}
            style={{
              aspectRatio: "1 / 1",
              background: "linear-gradient(145deg, #ffffff 0%, #f8fafc 100%)",
              borderRadius: "1.25rem",
              border: "1px solid #e2e8f0",
              boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.05)",
              padding: "1.6rem",
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
              cursor: "pointer",
              position: "relative",
              overflow: "hidden",
              transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)"
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = "translateY(-5px)";
              e.currentTarget.style.borderColor = "#c7d2fe";
              e.currentTarget.style.boxShadow = "0 20px 35px -10px rgba(99, 102, 241, 0.2)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = "translateY(0)";
              e.currentTarget.style.borderColor = "#e2e8f0";
              e.currentTarget.style.boxShadow = "0 10px 25px -5px rgba(0, 0, 0, 0.05)";
            }}
          >
            {/* Círculo sutil de fondo */}
            <div
              style={{
                position: "absolute",
                top: "-15%",
                right: "-15%",
                width: "120px",
                height: "120px",
                background: "radial-gradient(circle, rgba(99, 102, 241, 0.12) 0%, rgba(99, 102, 241, 0) 70%)",
                borderRadius: "50%",
                pointerEvents: "none"
              }}
            />

            {/* Parte Superior: Ícono & Badge */}
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
              <div
                style={{
                  width: "52px",
                  height: "52px",
                  borderRadius: "1rem",
                  background: "linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)",
                  color: "#ffffff",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  boxShadow: "0 6px 16px rgba(99, 102, 241, 0.3)"
                }}
              >
                <Calendar size={26} />
              </div>

              <span
                style={{
                  fontSize: "0.72rem",
                  fontWeight: 700,
                  color: "#4338ca",
                  background: "#e0e7ff",
                  border: "1px solid #c7d2fe",
                  padding: "0.25rem 0.6rem",
                  borderRadius: "9999px"
                }}
              >
                Calendario
              </span>
            </div>

            {/* Parte Central: Título y Descripción */}
            <div>
              <h3 style={{ fontSize: "1.15rem", fontWeight: 800, color: "#0f172a", margin: "0 0 0.4rem" }}>
                Definir Semana
              </h3>
              <p style={{ fontSize: "0.82rem", color: "#64748b", margin: 0, lineHeight: 1.35 }}>
                Definir qué semana es <strong>de qué fecha a qué fecha</strong> para el periodo académico.
              </p>
            </div>

            {/* Parte Inferior: Botón / Indicador de Ingreso */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                paddingTop: "0.75rem",
                borderTop: "1px solid #f1f5f9",
                color: "#4f46e5",
                fontSize: "0.84rem",
                fontWeight: 700
              }}
            >
              <span>Abrir módulo</span>
              <div
                style={{
                  width: "28px",
                  height: "28px",
                  borderRadius: "50%",
                  background: "#eef2ff",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center"
                }}
              >
                <ArrowRight size={15} />
              </div>
            </div>
          </div>
        </div>
      </div>
      )}

      {/* ======================================================================= */}
      {/* 🎓 SECCIÓN 2: MIS SECCIONES (CON TARJETAS LLAMATIVAS Y ESTRELLA DORADA) */}
      {/* ======================================================================= */}
      <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem", marginTop: "0.5rem" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "0.5rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.65rem" }}>
            <div
              style={{
                width: "36px",
                height: "36px",
                borderRadius: "0.6rem",
                background: "linear-gradient(135deg, #0d9488 0%, #0f766e 100%)",
                color: "#ffffff",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: "0 4px 10px rgba(13, 148, 136, 0.25)"
              }}
            >
              <GraduationCap size={20} />
            </div>
            <div>
              <h2 style={{ fontSize: "1.25rem", fontWeight: 800, color: "#0f172a", margin: 0, letterSpacing: "-0.01em" }}>
                Mis Secciones
              </h2>
              <span style={{ fontSize: "0.82rem", color: "#64748b" }}>
                {coordsCount > 0 && assignedCount > 0
                  ? "Secciones donde participas como coordinador o instructor docente. Acceso a calificaciones, pruebas y asistencias."
                  : coordsCount > 0
                  ? "Secciones donde estás asignado como Coordinador. Acceso a calificaciones y asistencias."
                  : "Secciones donde participas como Instructor docente. Acceso a calificaciones, pruebas y asistencias."}
              </span>
            </div>
          </div>

          <span
            style={{
              fontSize: "0.76rem",
              fontWeight: 700,
              color: "#0f766e",
              background: "#ccfbf1",
              padding: "0.25rem 0.7rem",
              borderRadius: "9999px",
              border: "1px solid #99f6e4"
            }}
          >
            {coordsCount > 0 && assignedCount > 0
              ? `${coordsCount} ${coordsCount === 1 ? "Coordinada" : "Coordinadas"} · ${assignedCount} ${assignedCount === 1 ? "Asignada" : "Asignadas"}`
              : coordsCount > 0
              ? `${coordsCount} ${coordsCount === 1 ? "Sección Coordinada" : "Secciones Coordinadas"}`
              : assignedCount > 0
              ? `${assignedCount} ${assignedCount === 1 ? "Sección Asignada" : "Secciones Asignadas"}`
              : "0 Secciones"}
          </span>
        </div>

        {/* Renderizado de Tarjetas de Mis Secciones */}
        {loadingSecciones && misSecciones.length === 0 ? (
          <div style={{ padding: "3rem", textAlign: "center", color: "#64748b", background: "#ffffff", borderRadius: "1.25rem", border: "1px solid #e2e8f0" }}>
            Cargando tus secciones asignadas...
          </div>
        ) : misSecciones.length === 0 ? (
          <div
            style={{
              background: "linear-gradient(145deg, #ffffff 0%, #f8fafc 100%)",
              borderRadius: "1.25rem",
              border: "1.5px dashed #cbd5e1",
              padding: "2.5rem 1.5rem",
              textAlign: "center",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: "0.75rem",
              color: "#64748b"
            }}
          >
            <div
              style={{
                width: "52px",
                height: "52px",
                borderRadius: "50%",
                background: "#fef3c7",
                color: "#d97706",
                display: "flex",
                alignItems: "center",
                justifyContent: "center"
              }}
            >
              <Star size={26} fill="#fde68a" />
            </div>
            <strong style={{ fontSize: "1.05rem", color: "#0f172a" }}>No tienes secciones asignadas</strong>
            <p style={{ fontSize: "0.84rem", margin: 0, maxWidth: "520px", lineHeight: 1.45 }}>
              Cuando se cree o edite una sección en <strong>Administrar Secciones</strong> y seas asignado como coordinador o docente, aparecerá automáticamente aquí.
            </p>
          </div>
        ) : (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(260px, 280px))",
              gap: "1.5rem"
            }}
          >
            {misSecciones.map((sec) => {
              const carTheme = CARRERA_THEMES[sec.carrera] || CARRERA_THEMES.DEFAULT;

              return (
                <div
                  key={sec.id}
                  style={{
                    background: "#ffffff",
                    borderRadius: "1.25rem",
                    border: `1.5px solid ${carTheme.border}`,
                    boxShadow: "0 8px 20px -4px rgba(0, 0, 0, 0.05)",
                    padding: "1.35rem",
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "space-between",
                    gap: "0.9rem",
                    position: "relative",
                    overflow: "hidden",
                    transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)"
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = "translateY(-4px)";
                    e.currentTarget.style.boxShadow = "0 14px 25px -8px rgba(0, 0, 0, 0.1)";
                    e.currentTarget.style.borderColor = carTheme.badge;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = "translateY(0)";
                    e.currentTarget.style.boxShadow = "0 8px 20px -4px rgba(0, 0, 0, 0.05)";
                    e.currentTarget.style.borderColor = carTheme.border;
                  }}
                >
                  {/* Cabecera de la Tarjeta: Código, Carrera y Estrella de Coordinador */}
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.45rem", position: "relative", zIndex: 2 }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.4rem" }}>
                      {/* Código de Sección */}
                      <span
                        style={{
                          background: "linear-gradient(135deg, #0369a1 0%, #075985 100%)",
                          color: "#ffffff",
                          fontWeight: 900,
                          fontSize: "0.82rem",
                          padding: "0.22rem 0.65rem",
                          borderRadius: "0.45rem",
                          letterSpacing: "0.03em",
                          boxShadow: "0 2px 6px rgba(3, 105, 161, 0.2)"
                        }}
                      >
                        {sec.codigo}
                      </span>

                      {/* Insignia de Carrera con color sólido y 100% uniforme */}
                      <span
                        style={{
                          background: "#f8fafc",
                          color: "#334155",
                          border: "1px solid #cbd5e1",
                          fontWeight: 800,
                          fontSize: "0.72rem",
                          padding: "0.22rem 0.65rem",
                          borderRadius: "9999px",
                          textTransform: "uppercase",
                          letterSpacing: "0.03em",
                          whiteSpace: "nowrap"
                        }}
                      >
                        {sec.carrera}
                      </span>
                    </div>

                    {/* Insignia de Rol: Coordinador o Instructor Asignado */}
                    {(() => {
                      const isCoord = checkIsCoord(sec);

                      if (isCoord) {
                        return (
                          <div
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "0.35rem",
                              background: "linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%)",
                              border: "1px solid #fde68a",
                              color: "#b45309",
                              padding: "0.25rem 0.6rem",
                              borderRadius: "0.5rem",
                              fontSize: "0.74rem",
                              fontWeight: 800,
                              boxShadow: "0 2px 4px rgba(217, 119, 6, 0.08)",
                              width: "fit-content"
                            }}
                          >
                            <Star size={13} fill="#f59e0b" color="#d97706" />
                            <span>Coordinador</span>
                          </div>
                        );
                      }

                      return (
                        <div
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "0.35rem",
                            background: "linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%)",
                            border: "1px solid #bae6fd",
                            color: "#0369a1",
                            padding: "0.25rem 0.6rem",
                            borderRadius: "0.5rem",
                            fontSize: "0.74rem",
                            fontWeight: 800,
                            boxShadow: "0 2px 4px rgba(2, 132, 199, 0.08)",
                            width: "fit-content"
                          }}
                        >
                          <Users size={13} color="#0284c7" />
                          <span>Instructor</span>
                        </div>
                      );
                    })()}
                  </div>

                  {/* 🔥 SECCIÓN LLAMATIVA: DÍA Y HORA */}
                  <div
                    style={{
                      background: carTheme.gradient,
                      borderRadius: "0.75rem",
                      padding: "0.75rem 0.9rem",
                      color: "#ffffff",
                      boxShadow: "0 6px 14px -3px rgba(0, 0, 0, 0.12)",
                      display: "flex",
                      flexDirection: "column",
                      gap: "0.2rem"
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "0.3rem", fontSize: "0.68rem", opacity: 0.9, textTransform: "uppercase", letterSpacing: "0.03em", fontWeight: 700 }}>
                      <Calendar size={11} />
                      <span>Horario</span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", fontSize: "1.05rem", fontWeight: 900, letterSpacing: "-0.01em" }}>
                      <Clock size={16} style={{ flexShrink: 0 }} />
                      <span>{sec.dia} {sec.hora_inicio} - {sec.hora_fin || "Fin"}</span>
                    </div>
                  </div>

                  {/* Datos Complementarios: Doctor y Periodo */}
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem", fontSize: "0.76rem", color: "#64748b" }}>
                    <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      <strong>Dr:</strong> {sec.doctor_encargado || "Dr. Rafael Perdomo Vaquero"}
                    </div>
                    <div>
                      <strong>Periodo:</strong> {sec.periodo_academico || "I PAC 2026"}
                    </div>
                  </div>

                  {/* Botón de Acción Principal */}
                  <button
                    onClick={() => {
                      const isCoord = checkIsCoord(sec);

                      if (isCoord) {
                        setSelectedCoordinatorSeccion(sec);
                      } else {
                        setSelectedInstructorSeccion(sec);
                      }
                    }}
                    style={{
                      padding: "0.65rem 1rem",
                      borderRadius: "0.65rem",
                      border: "none",
                      background: "linear-gradient(135deg, #0284c7 0%, #0369a1 100%)",
                      color: "#ffffff",
                      fontSize: "0.85rem",
                      fontWeight: 800,
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "0.45rem",
                      boxShadow: "0 4px 12px rgba(2, 132, 199, 0.25)",
                      transition: "all 0.15s ease"
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = "linear-gradient(135deg, #0369a1 0%, #075985 100%)";
                      e.currentTarget.style.transform = "translateY(-1px)";
                      e.currentTarget.style.boxShadow = "0 6px 16px rgba(2, 132, 199, 0.35)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = "linear-gradient(135deg, #0284c7 0%, #0369a1 100%)";
                      e.currentTarget.style.transform = "translateY(0)";
                      e.currentTarget.style.boxShadow = "0 4px 12px rgba(2, 132, 199, 0.25)";
                    }}
                  >
                    <span>Entrar</span>
                    <ArrowRight size={15} />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}


