import React, { useState, useEffect, useCallback } from "react";
import {
  Layers,
  PlusCircle,
  Edit3,
  Trash2,
  ArrowLeft,
  Search,
  BookOpen,
  Calendar,
  Clock,
  UserCheck,
  Building2,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Users,
  LayoutGrid,
  List,
  GraduationCap,
  Sparkles
} from "lucide-react";
import { api } from "../services/api";
import SectionManagementModal from "./SectionManagementModal";
import SectionInstructorsModal from "./SectionInstructorsModal";
import SectionStudentsView from "./SectionStudentsView";
import { getNavState, setNavState } from "../utils/navigationState";

const CARRERAS_LIST = [
  "TODAS",
  "MEDICINA",
  "ENFERMERIA",
  "ODONTOLOGIA",
  "MICROBIOLOGIA",
  "NUTRICION"
];

const DIAS_CALENDARIO = [
  "Lunes",
  "Martes",
  "Miércoles",
  "Jueves",
  "Viernes",
  "Sábado",
  "Domingo"
];

const BLOQUES_HORARIOS = [
  { id: "b1", label: "07:00 - 09:00", inicio: "07:00", fin: "09:00", turno: "07:00 - 09:00" },
  { id: "b2", label: "09:00 - 11:00", inicio: "09:00", fin: "11:00", turno: "09:00 - 11:00" },
  { id: "b3", label: "11:00 - 13:00", inicio: "11:00", fin: "13:00", turno: "11:00 - 13:00" },
  { id: "b4", label: "13:00 - 15:00", inicio: "13:00", fin: "15:00", turno: "13:00 - 15:00" },
  { id: "b5", label: "15:00 - 17:00", inicio: "15:00", fin: "17:00", turno: "15:00 - 17:00" }
];

const timeToMinutes = (timeStr) => {
  if (!timeStr) return 0;
  const [h, m] = timeStr.split(":").map((v) => parseInt(v, 10) || 0);
  return h * 60 + (m || 0);
};

const isTimeOverlap = (startA, endA, startB, endB) => {
  const minStartA = timeToMinutes(startA);
  let minEndA = timeToMinutes(endA);
  if (minEndA <= minStartA) minEndA = minStartA + 120;

  const minStartB = timeToMinutes(startB);
  let minEndB = timeToMinutes(endB);
  if (minEndB <= minStartB) minEndB = minStartB + 120;

  return minStartA < minEndB && minEndA > minStartB;
};

const CARRERA_COLORS = {
  MEDICINA: { bg: "#eff6ff", text: "#1d4ed8", border: "#bfdbfe", accent: "#3b82f6" },
  ENFERMERIA: { bg: "#f0fdf4", text: "#15803d", border: "#bbf7d0", accent: "#22c55e" },
  ODONTOLOGIA: { bg: "#fdf4ff", text: "#a21caf", border: "#f5d0fe", accent: "#d946ef" },
  MICROBIOLOGIA: { bg: "#fff7ed", text: "#c2410c", border: "#ffedd5", accent: "#f97316" },
  NUTRICION: { bg: "#ecfeff", text: "#0e7490", border: "#cffafe", accent: "#06b6d4" },
  DEFAULT: { bg: "#f0fdfa", text: "#0f766e", border: "#99f6e4", accent: "#0d9488" }
};

export default function SectionManagementView({ currentInstructor, onClose, notify = () => {} }) {
  const initialNav = getNavState();
  const [activeSubTab, setActiveSubTabState] = useState(() => initialNav.sectionManagementSubTab || "secciones");
  const [sectionsList, setSectionsList] = useState([]);
  const [instructorsList, setInstructorsList] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCarrera, setSelectedCarreraState] = useState(() => initialNav.sectionManagementCarrera || "TODAS");
  const [viewMode, setViewModeState] = useState(() => initialNav.sectionManagementViewMode || "calendar");

  // Control del modal de creación / edición / borrado
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState("create"); // 'create' | 'edit' | 'delete'
  const [selectedSectionForModal, setSelectedSectionForModal] = useState(null);

  // Control del modal de asignación de instructores
  const [selectedSectionForInstructors, setSelectedSectionForInstructors] = useState(null);

  // Control de vista de administración de estudiantes por sección
  const [selectedSectionForStudents, setSelectedSectionForStudentsState] = useState(() => initialNav.selectedSectionForStudents || null);

  const setActiveSubTab = (tab) => {
    setActiveSubTabState(tab);
    setNavState({ sectionManagementSubTab: tab });
  };

  const setSelectedCarrera = (car) => {
    setSelectedCarreraState(car);
    setNavState({ sectionManagementCarrera: car });
  };

  const setViewMode = (mode) => {
    setViewModeState(mode);
    setNavState({ sectionManagementViewMode: mode });
  };

  const setSelectedSectionForStudents = (sec) => {
    setSelectedSectionForStudentsState(sec);
    setNavState({ selectedSectionForStudents: sec });
  };

  const rolNormalized = (currentInstructor?.rol || "").toLowerCase().trim();
  const isAuthorized = rolNormalized === "creador" || rolNormalized === "administrador" || rolNormalized === "admin";

  const loadData = useCallback(async () => {
    if (!isAuthorized) return;
    setLoading(true);
    try {
      const [secRes, instRes] = await Promise.all([
        api.secciones.getAll(),
        api.auth.getInstructores()
      ]);

      if (secRes?.data) {
        setSectionsList(secRes.data);
        // Si había una sección previamente seleccionada, actualizarla con los datos frescos
        const currentSavedSec = getNavState().selectedSectionForStudents;
        if (currentSavedSec?.id) {
          const freshSec = secRes.data.find((s) => s.id === currentSavedSec.id);
          if (freshSec) {
            setSelectedSectionForStudentsState(freshSec);
          }
        }
      }
      if (instRes?.data) {
        setInstructorsList(instRes.data);
      }
    } catch (err) {
      console.warn("Error al cargar secciones o instructores:", err);
    } finally {
      setLoading(false);
    }
  }, [isAuthorized]);

  useEffect(() => {
    if (isAuthorized) {
      loadData();
    }
  }, [loadData, isAuthorized]);

  if (!isAuthorized) {
    return (
      <div className="animate-fade-in" style={{ padding: "2.5rem 2rem", textAlign: "center", background: "#ffffff", borderRadius: "1rem", border: "1px solid #e2e8f0", maxWidth: "580px", margin: "3rem auto", boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.05)" }}>
        <div style={{ width: "56px", height: "56px", borderRadius: "50%", background: "#fee2e2", color: "#dc2626", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 1.25rem" }}>
          <Layers size={28} />
        </div>
        <h3 style={{ fontSize: "1.25rem", fontWeight: 800, color: "#1e293b", marginBottom: "0.5rem" }}>Acceso Restringido</h3>
        <p style={{ fontSize: "0.95rem", color: "#64748b", lineHeight: 1.5, marginBottom: "1.5rem" }}>
          El módulo de <strong>Gestión de Secciones y Estudiantes</strong> está reservado exclusivamente para instructores con rol de <strong>Creador</strong> o <strong>Administrador</strong>.
        </p>
        <button
          onClick={onClose}
          style={{
            padding: "0.65rem 1.5rem",
            background: "#0284c7",
            color: "#ffffff",
            border: "none",
            borderRadius: "0.75rem",
            fontWeight: 700,
            cursor: "pointer",
            display: "inline-flex",
            alignItems: "center",
            gap: "0.5rem"
          }}
        >
          <ArrowLeft size={16} /> Volver al Dashboard
        </button>
      </div>
    );
  }

  const handleOpenModal = (mode, targetSec = null) => {
    setModalMode(mode);
    setSelectedSectionForModal(targetSec);
    setModalOpen(true);
  };

  // Filtrado por Carrera y Búsqueda
  const filteredSections = sectionsList.filter((sec) => {
    const s = searchTerm.toLowerCase();
    const secCode = (sec.codigo || "").toLowerCase();
    const secName = (sec.nombre || "").toLowerCase();
    const secCarrera = (sec.carrera || "").toUpperCase();
    const secDay = (sec.dia || "").toLowerCase();
    const secDoctor = (sec.doctor_encargado || "").toLowerCase();
    const secCoord = (sec.coordinador || "").toLowerCase();

    const matchesSearch =
      !s ||
      secCode.includes(s) ||
      secName.includes(s) ||
      secCarrera.toLowerCase().includes(s) ||
      secDay.includes(s) ||
      secDoctor.includes(s) ||
      secCoord.includes(s);

    const matchesCarrera =
      selectedCarrera === "TODAS" || secCarrera === selectedCarrera.toUpperCase();

    return matchesSearch && matchesCarrera;
  });

  const totalActivas = sectionsList.filter((s) => s.activa).length;

  // Mapa de secciones para el calendario gráfico por bloque de 2 horas (retorna lista de secciones en ese slot)
  const getSectionsForSlot = (dia, bloque) => {
    const normDay = (dia || "").toLowerCase().trim();
    return filteredSections.filter((sec) => {
      const secDay = (sec.dia || "").toLowerCase().trim();
      const secHora = (sec.hora_inicio || "").trim();
      return (
        secDay === normDay &&
        (secHora === bloque.inicio || isTimeOverlap(bloque.inicio, bloque.fin, sec.hora_inicio, sec.hora_fin))
      );
    });
  };

  // Si se selecciona una sección para administrar sus estudiantes
  if (selectedSectionForStudents) {
    return (
      <SectionStudentsView
        seccion={selectedSectionForStudents}
        onClose={() => setSelectedSectionForStudents(null)}
        notify={notify}
      />
    );
  }

  return (
    <div className="animate-fade-in" style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      {/* Barra Superior con Botón Volver y Actualizar */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: "1rem"
        }}
      >
        <button
          onClick={onClose}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "0.5rem",
            padding: "0.6rem 1.15rem",
            borderRadius: "0.75rem",
            background: "#ffffff",
            border: "1.5px solid #cbd5e1",
            color: "#334155",
            fontSize: "0.88rem",
            fontWeight: 700,
            cursor: "pointer",
            boxShadow: "0 2px 6px rgba(0,0,0,0.03)",
            transition: "all 0.15s ease"
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = "#f8fafc";
            e.currentTarget.style.borderColor = "#94a3b8";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "#ffffff";
            e.currentTarget.style.borderColor = "#cbd5e1";
          }}
        >
          <ArrowLeft size={17} />
          <span>Volver al Dashboard</span>
        </button>

        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <button
            onClick={loadData}
            disabled={loading}
            style={{
              background: "#ffffff",
              border: "1.5px solid #cbd5e1",
              borderRadius: "0.75rem",
              padding: "0.55rem 0.95rem",
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              gap: "0.45rem",
              color: "#475569",
              fontSize: "0.82rem",
              fontWeight: 700,
              boxShadow: "0 2px 6px rgba(0,0,0,0.03)",
              transition: "all 0.15s ease"
            }}
            title="Actualizar datos del servidor"
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = "#0d9488";
              e.currentTarget.style.color = "#0d9488";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = "#cbd5e1";
              e.currentTarget.style.color = "#475569";
            }}
          >
            <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
            <span>Actualizar</span>
          </button>
        </div>
      </div>

      {/* 🚀 PANEL DESTACADO: 3 MÓDULOS DE ADMINISTRACIÓN CENTRAL */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
          gap: "1rem",
          width: "100%"
        }}
      >
        {/* BOTÓN 1: ADMINISTRACIÓN DE SECCIONES */}
        <div
          onClick={() => setActiveSubTab("secciones")}
          style={{
            position: "relative",
            background: activeSubTab === "secciones"
              ? "linear-gradient(135deg, #f0fdfa 0%, #ffffff 100%)"
              : "#ffffff",
            borderRadius: "1rem",
            border: activeSubTab === "secciones" ? "2px solid #0d9488" : "1.5px solid #e2e8f0",
            padding: "1.25rem 1.4rem",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: "1.1rem",
            boxShadow: activeSubTab === "secciones"
              ? "0 10px 25px -4px rgba(13, 148, 136, 0.22)"
              : "0 2px 8px rgba(0, 0, 0, 0.03)",
            transform: activeSubTab === "secciones" ? "scale(1.01)" : "none",
            transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
            overflow: "hidden"
          }}
          onMouseEnter={(e) => {
            if (activeSubTab !== "secciones") {
              e.currentTarget.style.transform = "translateY(-3px)";
              e.currentTarget.style.borderColor = "#0d9488";
              e.currentTarget.style.boxShadow = "0 8px 20px -4px rgba(13, 148, 136, 0.15)";
            }
          }}
          onMouseLeave={(e) => {
            if (activeSubTab !== "secciones") {
              e.currentTarget.style.transform = "none";
              e.currentTarget.style.borderColor = "#e2e8f0";
              e.currentTarget.style.boxShadow = "0 2px 8px rgba(0, 0, 0, 0.03)";
            }
          }}
        >
          {activeSubTab === "secciones" && (
            <div
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                right: 0,
                height: "4px",
                background: "linear-gradient(90deg, #0d9488 0%, #14b8a6 100%)"
              }}
            />
          )}

          <div
            style={{
              width: "52px",
              height: "52px",
              borderRadius: "0.85rem",
              background: activeSubTab === "secciones"
                ? "linear-gradient(135deg, #0d9488 0%, #0f766e 100%)"
                : "#f0fdfa",
              color: activeSubTab === "secciones" ? "#ffffff" : "#0d9488",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
              boxShadow: activeSubTab === "secciones" ? "0 6px 16px rgba(13, 148, 136, 0.35)" : "none",
              border: activeSubTab === "secciones" ? "none" : "1.5px solid #ccfbf1",
              transition: "all 0.2s ease"
            }}
          >
            <Layers size={26} />
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem", flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.5rem" }}>
              <h3
                style={{
                  fontSize: "1.05rem",
                  fontWeight: 900,
                  color: activeSubTab === "secciones" ? "#0f766e" : "#0f172a",
                  margin: 0,
                  letterSpacing: "-0.01em"
                }}
              >
                Administración de Secciones
              </h3>
              {activeSubTab === "secciones" && (
                <span
                  style={{
                    background: "#ccfbf1",
                    color: "#0f766e",
                    fontSize: "0.68rem",
                    fontWeight: 900,
                    padding: "0.15rem 0.5rem",
                    borderRadius: "9999px",
                    textTransform: "uppercase"
                  }}
                >
                  Activo
                </span>
              )}
            </div>
            <span style={{ fontSize: "0.78rem", color: "#64748b", lineHeight: 1.3 }}>
              Horarios, aulas, cupos y coordinadores
            </span>
            <span style={{ fontSize: "0.74rem", color: "#0d9488", fontWeight: 800 }}>
              {sectionsList.length} secciones registradas
            </span>
          </div>
        </div>

        {/* BOTÓN 2: ADMINISTRACIÓN DE INSTRUCTORES */}
        <div
          onClick={() => setActiveSubTab("instructores")}
          style={{
            position: "relative",
            background: activeSubTab === "instructores"
              ? "linear-gradient(135deg, #eef2ff 0%, #ffffff 100%)"
              : "#ffffff",
            borderRadius: "1rem",
            border: activeSubTab === "instructores" ? "2px solid #6366f1" : "1.5px solid #e2e8f0",
            padding: "1.25rem 1.4rem",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: "1.1rem",
            boxShadow: activeSubTab === "instructores"
              ? "0 10px 25px -4px rgba(99, 102, 241, 0.22)"
              : "0 2px 8px rgba(0, 0, 0, 0.03)",
            transform: activeSubTab === "instructores" ? "scale(1.01)" : "none",
            transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
            overflow: "hidden"
          }}
          onMouseEnter={(e) => {
            if (activeSubTab !== "instructores") {
              e.currentTarget.style.transform = "translateY(-3px)";
              e.currentTarget.style.borderColor = "#6366f1";
              e.currentTarget.style.boxShadow = "0 8px 20px -4px rgba(99, 102, 241, 0.15)";
            }
          }}
          onMouseLeave={(e) => {
            if (activeSubTab !== "instructores") {
              e.currentTarget.style.transform = "none";
              e.currentTarget.style.borderColor = "#e2e8f0";
              e.currentTarget.style.boxShadow = "0 2px 8px rgba(0, 0, 0, 0.03)";
            }
          }}
        >
          {activeSubTab === "instructores" && (
            <div
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                right: 0,
                height: "4px",
                background: "linear-gradient(90deg, #6366f1 0%, #818cf8 100%)"
              }}
            />
          )}

          <div
            style={{
              width: "52px",
              height: "52px",
              borderRadius: "0.85rem",
              background: activeSubTab === "instructores"
                ? "linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)"
                : "#eef2ff",
              color: activeSubTab === "instructores" ? "#ffffff" : "#6366f1",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
              boxShadow: activeSubTab === "instructores" ? "0 6px 16px rgba(99, 102, 241, 0.35)" : "none",
              border: activeSubTab === "instructores" ? "none" : "1.5px solid #e0e7ff",
              transition: "all 0.2s ease"
            }}
          >
            <Users size={26} />
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem", flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.5rem" }}>
              <h3
                style={{
                  fontSize: "1.05rem",
                  fontWeight: 900,
                  color: activeSubTab === "instructores" ? "#4338ca" : "#0f172a",
                  margin: 0,
                  letterSpacing: "-0.01em"
                }}
              >
                Administración de Instructores
              </h3>
              {activeSubTab === "instructores" && (
                <span
                  style={{
                    background: "#e0e7ff",
                    color: "#4338ca",
                    fontSize: "0.68rem",
                    fontWeight: 900,
                    padding: "0.15rem 0.5rem",
                    borderRadius: "9999px",
                    textTransform: "uppercase"
                  }}
                >
                  Activo
                </span>
              )}
            </div>
            <span style={{ fontSize: "0.78rem", color: "#64748b", lineHeight: 1.3 }}>
              Cuentas, correos y asignación docente
            </span>
            <span style={{ fontSize: "0.74rem", color: "#6366f1", fontWeight: 800 }}>
              {instructorsList.length} docentes registrados
            </span>
          </div>
        </div>

        {/* BOTÓN 3: ADMINISTRACIÓN DE ESTUDIANTES */}
        <div
          onClick={() => setActiveSubTab("estudiantes")}
          style={{
            position: "relative",
            background: activeSubTab === "estudiantes"
              ? "linear-gradient(135deg, #eff6ff 0%, #ffffff 100%)"
              : "#ffffff",
            borderRadius: "1rem",
            border: activeSubTab === "estudiantes" ? "2px solid #2563eb" : "1.5px solid #e2e8f0",
            padding: "1.25rem 1.4rem",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: "1.1rem",
            boxShadow: activeSubTab === "estudiantes"
              ? "0 10px 25px -4px rgba(37, 99, 235, 0.22)"
              : "0 2px 8px rgba(0, 0, 0, 0.03)",
            transform: activeSubTab === "estudiantes" ? "scale(1.01)" : "none",
            transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
            overflow: "hidden"
          }}
          onMouseEnter={(e) => {
            if (activeSubTab !== "estudiantes") {
              e.currentTarget.style.transform = "translateY(-3px)";
              e.currentTarget.style.borderColor = "#2563eb";
              e.currentTarget.style.boxShadow = "0 8px 20px -4px rgba(37, 99, 235, 0.15)";
            }
          }}
          onMouseLeave={(e) => {
            if (activeSubTab !== "estudiantes") {
              e.currentTarget.style.transform = "none";
              e.currentTarget.style.borderColor = "#e2e8f0";
              e.currentTarget.style.boxShadow = "0 2px 8px rgba(0, 0, 0, 0.03)";
            }
          }}
        >
          {activeSubTab === "estudiantes" && (
            <div
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                right: 0,
                height: "4px",
                background: "linear-gradient(90deg, #2563eb 0%, #60a5fa 100%)"
              }}
            />
          )}

          <div
            style={{
              width: "52px",
              height: "52px",
              borderRadius: "0.85rem",
              background: activeSubTab === "estudiantes"
                ? "linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)"
                : "#eff6ff",
              color: activeSubTab === "estudiantes" ? "#ffffff" : "#2563eb",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
              boxShadow: activeSubTab === "estudiantes" ? "0 6px 16px rgba(37, 99, 235, 0.35)" : "none",
              border: activeSubTab === "estudiantes" ? "none" : "1.5px solid #dbeafe",
              transition: "all 0.2s ease"
            }}
          >
            <GraduationCap size={26} />
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem", flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.5rem" }}>
              <h3
                style={{
                  fontSize: "1.05rem",
                  fontWeight: 900,
                  color: activeSubTab === "estudiantes" ? "#1e40af" : "#0f172a",
                  margin: 0,
                  letterSpacing: "-0.01em"
                }}
              >
                Administración de Estudiantes
              </h3>
              {activeSubTab === "estudiantes" && (
                <span
                  style={{
                    background: "#dbeafe",
                    color: "#1e40af",
                    fontSize: "0.68rem",
                    fontWeight: 900,
                    padding: "0.15rem 0.5rem",
                    borderRadius: "9999px",
                    textTransform: "uppercase"
                  }}
                >
                  Activo
                </span>
              )}
            </div>
            <span style={{ fontSize: "0.78rem", color: "#64748b", lineHeight: 1.3 }}>
              Matrículas, padrones y traslados
            </span>
            <span style={{ fontSize: "0.74rem", color: "#2563eb", fontWeight: 800 }}>
              Gestión por carrera
            </span>
          </div>
        </div>
      </div>

      {/* ===================================================================== */}
      {/* 📚 VISTA 1: ADMINISTRACIÓN DE SECCIONES */}
      {/* ===================================================================== */}
      {activeSubTab === "secciones" && (
        <div
          className="glass-panel"
          style={{
            background: "#ffffff",
            borderRadius: "1.25rem",
            border: "1px solid #e2e8f0",
            boxShadow: "0 10px 30px -5px rgba(0, 0, 0, 0.05)",
            padding: "1.75rem",
            display: "flex",
            flexDirection: "column",
            gap: "1.5rem"
          }}
        >
          {/* Cabecera */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "1rem" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.85rem" }}>
              <div
                style={{
                  width: "48px",
                  height: "48px",
                  borderRadius: "1rem",
                  background: "linear-gradient(135deg, #0d9488 0%, #0f766e 100%)",
                  color: "#ffffff",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  boxShadow: "0 6px 16px rgba(13, 148, 136, 0.25)"
                }}
              >
                <Layers size={24} />
              </div>
              <div>
                <h2 style={{ fontSize: "1.4rem", fontWeight: 800, color: "#0f172a", margin: 0, letterSpacing: "-0.01em" }}>
                  Módulo de Administración de Secciones
                </h2>
                <span style={{ fontSize: "0.85rem", color: "#64748b" }}>
                  Gestión visual de horarios, asignación de cátedras y secciones organizadas por carrera
                </span>
              </div>
            </div>

            {/* Selector de modo de vista: Calendario / Lista */}
            <div
              style={{
                display: "inline-flex",
                background: "#f1f5f9",
                padding: "0.25rem",
                borderRadius: "0.65rem",
                border: "1px solid #e2e8f0"
              }}
            >
              <button
                onClick={() => setViewMode("calendar")}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "0.4rem",
                  padding: "0.4rem 0.75rem",
                  borderRadius: "0.5rem",
                  border: "none",
                  fontSize: "0.82rem",
                  fontWeight: 700,
                  cursor: "pointer",
                  background: viewMode === "calendar" ? "#ffffff" : "transparent",
                  color: viewMode === "calendar" ? "#0f766e" : "#64748b",
                  boxShadow: viewMode === "calendar" ? "0 2px 4px rgba(0,0,0,0.06)" : "none",
                  transition: "all 0.15s ease"
                }}
              >
                <LayoutGrid size={15} />
                Calendario Gráfico
              </button>
              <button
                onClick={() => setViewMode("table")}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "0.4rem",
                  padding: "0.4rem 0.75rem",
                  borderRadius: "0.5rem",
                  border: "none",
                  fontSize: "0.82rem",
                  fontWeight: 700,
                  cursor: "pointer",
                  background: viewMode === "table" ? "#ffffff" : "transparent",
                  color: viewMode === "table" ? "#0f766e" : "#64748b",
                  boxShadow: viewMode === "table" ? "0 2px 4px rgba(0,0,0,0.06)" : "none",
                  transition: "all 0.15s ease"
                }}
              >
                <List size={15} />
                Tabla Detallada
              </button>
            </div>
          </div>

          {/* Botones de acción principales */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
              gap: "1rem"
            }}
          >
            <button
              onClick={() => handleOpenModal("create")}
              style={{
                padding: "1.1rem 1.25rem",
                borderRadius: "0.85rem",
                border: "1px solid #99f6e4",
                background: "linear-gradient(135deg, #0d9488 0%, #0f766e 100%)",
                color: "#ffffff",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "0.85rem",
                textAlign: "left"
              }}
            >
              <PlusCircle size={20} />
              <div>
                <strong style={{ display: "block", fontSize: "0.98rem", fontWeight: 800 }}>Crear Sección</strong>
                <span style={{ fontSize: "0.78rem", opacity: 0.9 }}>Nueva clase de laboratorio</span>
              </div>
            </button>

            <button
              onClick={() => handleOpenModal("edit")}
              style={{
                padding: "1.1rem 1.25rem",
                borderRadius: "0.85rem",
                border: "1px solid #fed7aa",
                background: "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)",
                color: "#ffffff",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "0.85rem",
                textAlign: "left"
              }}
            >
              <Edit3 size={20} />
              <div>
                <strong style={{ display: "block", fontSize: "0.98rem", fontWeight: 800 }}>Editar Sección</strong>
                <span style={{ fontSize: "0.78rem", opacity: 0.9 }}>Modificar datos u horario</span>
              </div>
            </button>

            <button
              onClick={() => handleOpenModal("delete")}
              style={{
                padding: "1.1rem 1.25rem",
                borderRadius: "0.85rem",
                border: "1px solid #fecaca",
                background: "linear-gradient(135deg, #ef4444 0%, #dc2626 100%)",
                color: "#ffffff",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "0.85rem",
                textAlign: "left"
              }}
            >
              <Trash2 size={20} />
              <div>
                <strong style={{ display: "block", fontSize: "0.98rem", fontWeight: 800 }}>Borrar Sección</strong>
                <span style={{ fontSize: "0.78rem", opacity: 0.9 }}>Eliminar permanentemente</span>
              </div>
            </button>
          </div>

          {/* Pestañas de Carreras */}
          <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontSize: "0.82rem", fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.04em", display: "flex", alignItems: "center", gap: "0.4rem" }}>
              <GraduationCap size={16} color="#0f766e" /> Filtrar por Carrera
            </span>
            <span style={{ fontSize: "0.78rem", color: "#64748b" }}>
              Mostrando {filteredSections.length} de {sectionsList.length} secciones
            </span>
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
              overflowX: "auto",
              paddingBottom: "0.35rem"
            }}
          >
            {CARRERAS_LIST.map((carrera) => {
              const isSelected = selectedCarrera === carrera;
              const count =
                carrera === "TODAS"
                  ? sectionsList.length
                  : sectionsList.filter((s) => (s.carrera || "").toUpperCase() === carrera).length;
              const styleConf = CARRERA_COLORS[carrera] || CARRERA_COLORS.DEFAULT;

              return (
                <button
                  key={carrera}
                  onClick={() => setSelectedCarrera(carrera)}
                  style={{
                    padding: "0.6rem 1.1rem",
                    borderRadius: "0.75rem",
                    border: isSelected
                      ? `2px solid ${carrera === "TODAS" ? "#0f766e" : styleConf.accent}`
                      : "1px solid #e2e8f0",
                    background: isSelected
                      ? carrera === "TODAS"
                        ? "#0f766e"
                        : styleConf.bg
                      : "#ffffff",
                    color: isSelected
                      ? carrera === "TODAS"
                        ? "#ffffff"
                        : styleConf.text
                      : "#64748b",
                    fontSize: "0.85rem",
                    fontWeight: isSelected ? 800 : 600,
                    cursor: "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "0.5rem",
                    whiteSpace: "nowrap",
                    boxShadow: isSelected ? "0 4px 12px rgba(0,0,0,0.06)" : "none",
                    transition: "all 0.15s ease"
                  }}
                >
                  <span>{carrera === "TODAS" ? "Todas las Carreras" : carrera}</span>
                  <span
                    style={{
                      background: isSelected
                        ? carrera === "TODAS"
                          ? "rgba(255, 255, 255, 0.25)"
                          : styleConf.border
                        : "#f1f5f9",
                      color: isSelected
                        ? carrera === "TODAS"
                          ? "#ffffff"
                          : styleConf.text
                        : "#64748b",
                      padding: "0.1rem 0.45rem",
                      borderRadius: "9999px",
                      fontSize: "0.72rem",
                      fontWeight: 800
                    }}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Barra de Búsqueda */}
        <div style={{ position: "relative", flex: 1 }}>
          <Search size={16} color="#94a3b8" style={{ position: "absolute", left: "0.85rem", top: "50%", transform: "translateY(-50%)" }} />
          <input
            type="text"
            placeholder="Buscar por código de sección (ej. MI1300), doctor, carrera o día..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{
              width: "100%",
              padding: "0.65rem 0.85rem 0.65rem 2.3rem",
              borderRadius: "0.6rem",
              border: "1px solid #cbd5e1",
              fontSize: "0.88rem",
              outline: "none",
              boxSizing: "border-box",
              background: "#f8fafc"
            }}
          />
        </div>

        {/* 🌟 VISTA 1: CALENDARIO GRÁFICO SEMANAL (DÍAS X HORAS) */}
        {viewMode === "calendar" && (
          <div
            style={{
              border: "1px solid #e2e8f0",
              borderRadius: "1rem",
              overflow: "hidden",
              background: "#ffffff",
              boxShadow: "0 4px 15px rgba(0,0,0,0.02)"
            }}
          >
            {loading ? (
              <div style={{ padding: "3rem", textAlign: "center", color: "#64748b", fontSize: "0.9rem" }}>
                Cargando calendario de horarios...
              </div>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table
                  style={{
                    width: "100%",
                    borderCollapse: "collapse",
                    minWidth: "980px",
                    textAlign: "center"
                  }}
                >
                  {/* Encabezado de Días de la Semana */}
                  <thead>
                    <tr style={{ background: "#f8fafc", borderBottom: "2px solid #e2e8f0" }}>
                      <th
                        style={{
                          padding: "1rem 0.75rem",
                          fontWeight: 800,
                          fontSize: "0.84rem",
                          color: "#475569",
                          width: "105px",
                          borderRight: "1px solid #e2e8f0",
                          background: "#f1f5f9"
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "0.3rem" }}>
                          <Clock size={15} color="#0f766e" />
                          <span>Horario</span>
                        </div>
                      </th>
                      {DIAS_CALENDARIO.map((dia) => (
                        <th
                          key={dia}
                          style={{
                            padding: "1rem 0.5rem",
                            fontWeight: 800,
                            fontSize: "0.88rem",
                            color: "#0f766e",
                            borderRight: "1px solid #e2e8f0",
                            width: "13%"
                          }}
                        >
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "0.35rem" }}>
                            <Calendar size={14} />
                            <span>{dia}</span>
                          </div>
                        </th>
                      ))}
                    </tr>
                  </thead>

                  {/* Filas de Bloques de 2 Horas */}
                  <tbody>
                    {BLOQUES_HORARIOS.map((bloque, idx) => {
                      const isEven = idx % 2 === 0;
                      return (
                        <tr
                          key={bloque.id}
                          style={{
                            borderBottom: "1px solid #f1f5f9",
                            background: isEven ? "#ffffff" : "#fcfcfd"
                          }}
                        >
                          {/* Celda del Bloque de Horas */}
                          <td
                            style={{
                              padding: "0.85rem 0.5rem",
                              fontWeight: 800,
                              fontSize: "0.8rem",
                              color: "#0f766e",
                              background: "#f8fafc",
                              borderRight: "1px solid #e2e8f0",
                              letterSpacing: "0.01em",
                              whiteSpace: "nowrap"
                            }}
                          >
                            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "0.15rem" }}>
                              <span style={{ fontWeight: 800, color: "#0f172a", fontSize: "0.82rem" }}>{bloque.label}</span>
                              <span style={{ fontSize: "0.68rem", color: "#64748b", fontWeight: 700, background: "#f1f5f9", padding: "0.1rem 0.4rem", borderRadius: "4px" }}>
                                2 Horas
                              </span>
                            </div>
                          </td>

                          {/* Celdas de cada Día */}
                          {DIAS_CALENDARIO.map((dia) => {
                            const slotSections = getSectionsForSlot(dia, bloque);

                            return (
                              <td
                                key={`${dia}_${bloque.id}`}
                                style={{
                                  padding: "0.45rem",
                                  borderRight: "1px solid #f1f5f9",
                                  verticalAlign: "top",
                                  minHeight: "100px",
                                  minWidth: "130px"
                                }}
                              >
                                {slotSections.length > 0 ? (
                                  <div style={{ display: "flex", flexDirection: "column", gap: "0.45rem" }}>
                                    {slotSections.map((sec) => {
                                      const carStyle = sec?.carrera
                                        ? CARRERA_COLORS[sec.carrera.toUpperCase()] || CARRERA_COLORS.DEFAULT
                                        : CARRERA_COLORS.DEFAULT;

                                      return (
                                        <div
                                          key={sec.id}
                                          style={{
                                            background: carStyle.bg,
                                            border: `1.5px solid ${carStyle.border}`,
                                            borderRadius: "0.75rem",
                                            padding: "0.6rem 0.65rem",
                                            textAlign: "left",
                                            display: "flex",
                                            flexDirection: "column",
                                            gap: "0.35rem",
                                            boxShadow: "0 3px 8px rgba(0,0,0,0.04)",
                                            transition: "transform 0.15s ease, box-shadow 0.15s ease"
                                          }}
                                          onMouseEnter={(e) => {
                                            e.currentTarget.style.transform = "scale(1.02)";
                                            e.currentTarget.style.boxShadow = "0 6px 14px rgba(0,0,0,0.08)";
                                          }}
                                          onMouseLeave={(e) => {
                                            e.currentTarget.style.transform = "scale(1)";
                                            e.currentTarget.style.boxShadow = "0 3px 8px rgba(0,0,0,0.04)";
                                          }}
                                        >
                                          {/* Cabecera del cuadro: Código y Carrera */}
                                          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.3rem" }}>
                                            <span
                                              style={{
                                                fontWeight: 900,
                                                fontSize: "0.85rem",
                                                color: carStyle.text,
                                                letterSpacing: "0.02em"
                                              }}
                                            >
                                              {sec.codigo}
                                            </span>
                                            {sec.carrera && (
                                              <span
                                                style={{
                                                  fontSize: "0.64rem",
                                                  fontWeight: 800,
                                                  background: carStyle.border,
                                                  color: carStyle.text,
                                                  padding: "0.1rem 0.4rem",
                                                  borderRadius: "4px"
                                                }}
                                              >
                                                {sec.carrera}
                                              </span>
                                            )}
                                          </div>

                                          {/* Doctor Encargado */}
                                          <div style={{ fontSize: "0.75rem", color: "#1e293b", fontWeight: 700, lineHeight: 1.25 }}>
                                            👨‍⚕️ {sec.doctor_encargado || "Dr. Rafael Perdomo"}
                                          </div>

                                          {/* Horario de fin */}
                                          <div style={{ fontSize: "0.7rem", color: "#64748b", fontWeight: 600 }}>
                                            ⏰ {sec.hora_inicio} {sec.hora_fin ? `- ${sec.hora_fin}` : ""}
                                          </div>

                                          {/* Botones de acción directos: Editar y Borrar */}
                                          <div
                                            style={{
                                              display: "flex",
                                              alignItems: "center",
                                              justifyContent: "flex-end",
                                              gap: "0.35rem",
                                              marginTop: "0.25rem",
                                              paddingTop: "0.35rem",
                                              borderTop: `1px dashed ${carStyle.border}`
                                            }}
                                          >
                                            <button
                                              onClick={() => handleOpenModal("edit", sec)}
                                              style={{
                                                background: "#ffffff",
                                                border: "1px solid #fde68a",
                                                color: "#b45309",
                                                borderRadius: "0.4rem",
                                                padding: "0.25rem 0.5rem",
                                                fontSize: "0.72rem",
                                                fontWeight: 700,
                                                cursor: "pointer",
                                                display: "inline-flex",
                                                alignItems: "center",
                                                gap: "0.25rem",
                                                boxShadow: "0 1px 2px rgba(0,0,0,0.05)"
                                              }}
                                              title="Editar sección"
                                            >
                                              <Edit3 size={11} />
                                              Editar
                                            </button>

                                            <button
                                              onClick={() => handleOpenModal("delete", sec)}
                                              style={{
                                                background: "#ffffff",
                                                border: "1px solid #fecaca",
                                                color: "#dc2626",
                                                borderRadius: "0.4rem",
                                                padding: "0.25rem 0.5rem",
                                                fontSize: "0.72rem",
                                                fontWeight: 700,
                                                cursor: "pointer",
                                                display: "inline-flex",
                                                alignItems: "center",
                                                gap: "0.25rem",
                                                boxShadow: "0 1px 2px rgba(0,0,0,0.05)"
                                              }}
                                              title="Eliminar sección"
                                            >
                                              <Trash2 size={11} />
                                              Borrar
                                            </button>
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                ) : (
                                  <div
                                    style={{
                                      height: "100%",
                                      minHeight: "65px",
                                      borderRadius: "0.5rem",
                                      display: "flex",
                                      alignItems: "center",
                                      justifyContent: "center",
                                      color: "#cbd5e1"
                                    }}
                                  >
                                    <span style={{ fontSize: "0.75rem", opacity: 0.35 }}>—</span>
                                  </div>
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* 🌟 VISTA 2: TABLA DETALLADA DE SECCIONES */}
        {viewMode === "table" && (
          <div
            style={{
              border: "1px solid #e2e8f0",
              borderRadius: "0.85rem",
              overflow: "hidden",
              background: "#ffffff"
            }}
          >
            {loading ? (
              <div style={{ padding: "2.5rem", textAlign: "center", color: "#64748b", fontSize: "0.9rem" }}>
                Cargando secciones registradas...
              </div>
            ) : filteredSections.length === 0 ? (
              <div style={{ padding: "2.5rem", textAlign: "center", color: "#64748b", fontSize: "0.9rem" }}>
                {searchTerm || selectedCarrera !== "TODAS"
                  ? "No se encontraron secciones con los filtros seleccionados."
                  : "No hay secciones registradas aún. ¡Crea la primera con el botón Crear Sección!"}
              </div>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "0.86rem" }}>
                  <thead>
                    <tr style={{ background: "#f8fafc", borderBottom: "1px solid #e2e8f0", color: "#475569" }}>
                      <th style={{ padding: "0.8rem 1rem", fontWeight: 700 }}>Sección</th>
                      <th style={{ padding: "0.8rem 1rem", fontWeight: 700 }}>Carrera</th>
                      <th style={{ padding: "0.8rem 1rem", fontWeight: 700 }}>Día & Horario</th>
                      <th style={{ padding: "0.8rem 1rem", fontWeight: 700 }}>Doctor(a) de Cátedra</th>
                      <th style={{ padding: "0.8rem 1rem", fontWeight: 700 }}>Coordinador(a)</th>
                      <th style={{ padding: "0.8rem 1rem", fontWeight: 700 }}>Periodo</th>
                      <th style={{ padding: "0.8rem 1rem", fontWeight: 700 }}>Estado</th>
                      <th style={{ padding: "0.8rem 1rem", fontWeight: 700, textAlign: "right" }}>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredSections.map((sec) => (
                      <tr
                        key={sec.id}
                        style={{
                          borderBottom: "1px solid #f1f5f9",
                          transition: "background 0.15s ease"
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = "#f8fafc")}
                        onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                      >
                        <td style={{ padding: "0.8rem 1rem" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
                            <div
                              style={{
                                width: "36px",
                                height: "36px",
                                borderRadius: "0.6rem",
                                background: "#ccfbf1",
                                color: "#0f766e",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                fontWeight: 800,
                                fontSize: "0.82rem",
                                flexShrink: 0
                              }}
                            >
                              <Layers size={18} />
                            </div>
                            <div>
                              <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                                <strong style={{ color: "#0f172a", fontSize: "0.94rem" }}>
                                  Sección {sec.codigo}
                                </strong>
                                {sec.id && (
                                  <span
                                    style={{
                                      fontSize: "0.68rem",
                                      color: "#64748b",
                                      background: "#f1f5f9",
                                      padding: "0.1rem 0.35rem",
                                      borderRadius: "4px",
                                      fontFamily: "monospace"
                                    }}
                                    title={`ID fijo permanente: ${sec.id}`}
                                  >
                                    ID: {sec.id.slice(0, 8)}
                                  </span>
                                )}
                              </div>
                              <span style={{ fontSize: "0.75rem", color: "#64748b" }}>
                                {sec.nombre || "Laboratorio de Histología"}
                              </span>
                            </div>
                          </div>
                        </td>

                        <td style={{ padding: "0.8rem 1rem" }}>
                          {sec.carrera ? (
                            <span
                              style={{
                                background: (CARRERA_COLORS[sec.carrera.toUpperCase()] || CARRERA_COLORS.DEFAULT).bg,
                                color: (CARRERA_COLORS[sec.carrera.toUpperCase()] || CARRERA_COLORS.DEFAULT).text,
                                border: `1px solid ${(CARRERA_COLORS[sec.carrera.toUpperCase()] || CARRERA_COLORS.DEFAULT).border}`,
                                padding: "0.2rem 0.55rem",
                                borderRadius: "6px",
                                fontSize: "0.76rem",
                                fontWeight: 800,
                                letterSpacing: "0.02em"
                              }}
                            >
                              {sec.carrera}
                            </span>
                          ) : (
                            <span style={{ color: "#94a3b8", fontSize: "0.8rem" }}>—</span>
                          )}
                        </td>

                        <td style={{ padding: "0.8rem 1rem" }}>
                          <div style={{ display: "flex", flexDirection: "column", gap: "0.2rem" }}>
                            <span
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "0.3rem",
                                fontWeight: 700,
                                color: "#0f766e",
                                fontSize: "0.82rem"
                              }}
                            >
                              <Calendar size={13} /> {sec.dia}
                            </span>
                            <span
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "0.3rem",
                                color: "#64748b",
                                fontSize: "0.78rem"
                              }}
                            >
                              <Clock size={12} /> {sec.hora_inicio} {sec.hora_fin ? `- ${sec.hora_fin}` : ""}
                            </span>
                          </div>
                        </td>

                        <td style={{ padding: "0.8rem 1rem" }}>
                          <strong style={{ display: "block", color: "#334155", fontSize: "0.84rem" }}>
                            {sec.doctor_encargado || "Dr. Rafael Perdomo Vaquero"}
                          </strong>
                        </td>

                        <td style={{ padding: "0.8rem 1rem" }}>
                          <span style={{ fontSize: "0.82rem", color: sec.coordinador ? "#0f766e" : "#94a3b8", fontWeight: 700 }}>
                            {sec.coordinador ? `Coord. ${sec.coordinador}` : "Sin asignar"}
                          </span>
                        </td>

                        <td style={{ padding: "0.8rem 1rem" }}>
                          <span style={{ fontSize: "0.8rem", color: "#475569", fontWeight: 600 }}>
                            {sec.periodo_academico || "I PAC 2026"}
                          </span>
                        </td>

                        <td style={{ padding: "0.8rem 1rem" }}>
                          {sec.activa ? (
                            <span style={{ color: "#059669", fontWeight: 700, fontSize: "0.78rem", display: "inline-flex", alignItems: "center", gap: "0.3rem" }}>
                              <CheckCircle2 size={14} /> Activa
                            </span>
                          ) : (
                            <span style={{ color: "#dc2626", fontWeight: 700, fontSize: "0.78rem", display: "inline-flex", alignItems: "center", gap: "0.3rem" }}>
                              <XCircle size={14} /> Inactiva
                            </span>
                          )}
                        </td>

                        <td style={{ padding: "0.8rem 1rem", textAlign: "right" }}>
                          <div style={{ display: "inline-flex", gap: "0.4rem" }}>
                            {/* Botón Editar directo */}
                            <button
                              onClick={() => handleOpenModal("edit", sec)}
                              style={{
                                background: "#fef3c7",
                                border: "1px solid #fde68a",
                                color: "#b45309",
                                borderRadius: "0.4rem",
                                padding: "0.35rem 0.6rem",
                                fontSize: "0.78rem",
                                fontWeight: 700,
                                cursor: "pointer",
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "0.3rem"
                              }}
                              title="Editar sección"
                            >
                              <Edit3 size={13} />
                              Editar
                            </button>

                            {/* Botón Borrar directo */}
                            <button
                              onClick={() => handleOpenModal("delete", sec)}
                              style={{
                                background: "#fee2e2",
                                border: "1px solid #fecaca",
                                color: "#dc2626",
                                borderRadius: "0.4rem",
                                padding: "0.35rem 0.6rem",
                                fontSize: "0.78rem",
                                fontWeight: 700,
                                cursor: "pointer",
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "0.3rem"
                              }}
                              title="Eliminar sección"
                            >
                              <Trash2 size={13} />
                              Borrar
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    )}

      {/* ===================================================================== */}
      {/* 👥 VISTA 2: ADMINISTRACIÓN DE INSTRUCTORES */}
      {/* ===================================================================== */}
      {activeSubTab === "instructores" && (
        <div
          className="glass-panel"
          style={{
            background: "#ffffff",
            borderRadius: "1.25rem",
            border: "1px solid #e2e8f0",
            boxShadow: "0 10px 30px -5px rgba(0, 0, 0, 0.05)",
            padding: "1.75rem",
            display: "flex",
            flexDirection: "column",
            gap: "1.5rem"
          }}
        >
          {/* Cabecera */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "1rem" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.85rem" }}>
              <div
                style={{
                  width: "48px",
                  height: "48px",
                  borderRadius: "1rem",
                  background: "linear-gradient(135deg, #0284c7 0%, #0369a1 100%)",
                  color: "#ffffff",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  boxShadow: "0 6px 16px rgba(2, 132, 199, 0.25)"
                }}
              >
                <Users size={24} />
              </div>
              <div>
                <h2 style={{ fontSize: "1.4rem", fontWeight: 800, color: "#0f172a", margin: 0, letterSpacing: "-0.01em" }}>
                  Administración de Instructores
                </h2>
                <span style={{ fontSize: "0.85rem", color: "#64748b" }}>
                  Selecciona cualquier sección para gestionar, añadir o remover sus instructores asignados
                </span>
              </div>
            </div>

            {/* Selector de modo de vista: Calendario / Lista */}
            <div
              style={{
                display: "inline-flex",
                background: "#f1f5f9",
                padding: "0.25rem",
                borderRadius: "0.65rem",
                border: "1px solid #e2e8f0"
              }}
            >
              <button
                onClick={() => setViewMode("calendar")}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "0.4rem",
                  padding: "0.4rem 0.75rem",
                  borderRadius: "0.5rem",
                  border: "none",
                  fontSize: "0.82rem",
                  fontWeight: 700,
                  cursor: "pointer",
                  background: viewMode === "calendar" ? "#ffffff" : "transparent",
                  color: viewMode === "calendar" ? "#0284c7" : "#64748b",
                  boxShadow: viewMode === "calendar" ? "0 2px 4px rgba(0,0,0,0.06)" : "none",
                  transition: "all 0.15s ease"
                }}
              >
                <LayoutGrid size={15} />
                Calendario Gráfico
              </button>
              <button
                onClick={() => setViewMode("table")}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "0.4rem",
                  padding: "0.4rem 0.75rem",
                  borderRadius: "0.5rem",
                  border: "none",
                  fontSize: "0.82rem",
                  fontWeight: 700,
                  cursor: "pointer",
                  background: viewMode === "table" ? "#ffffff" : "transparent",
                  color: viewMode === "table" ? "#0284c7" : "#64748b",
                  boxShadow: viewMode === "table" ? "0 2px 4px rgba(0,0,0,0.06)" : "none",
                  transition: "all 0.15s ease"
                }}
              >
                <List size={15} />
                Tabla Detallada
              </button>
            </div>
          </div>

          {/* Pestañas de Carreras */}
          <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ fontSize: "0.82rem", fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.04em", display: "flex", alignItems: "center", gap: "0.4rem" }}>
                <GraduationCap size={16} color="#0284c7" /> Filtrar por Carrera
              </span>
              <span style={{ fontSize: "0.78rem", color: "#64748b" }}>
                Mostrando {filteredSections.length} de {sectionsList.length} secciones
              </span>
            </div>

            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.5rem",
                overflowX: "auto",
                paddingBottom: "0.35rem"
              }}
            >
              {CARRERAS_LIST.map((carrera) => {
                const isSelected = selectedCarrera === carrera;
                const count =
                  carrera === "TODAS"
                    ? sectionsList.length
                    : sectionsList.filter((s) => (s.carrera || "").toUpperCase() === carrera).length;
                const styleConf = CARRERA_COLORS[carrera] || CARRERA_COLORS.DEFAULT;

                return (
                  <button
                    key={carrera}
                    onClick={() => setSelectedCarrera(carrera)}
                    style={{
                      padding: "0.6rem 1.1rem",
                      borderRadius: "0.75rem",
                      border: isSelected
                        ? `2px solid ${carrera === "TODAS" ? "#0284c7" : styleConf.accent}`
                        : "1px solid #e2e8f0",
                      background: isSelected
                        ? carrera === "TODAS"
                          ? "#0284c7"
                          : styleConf.bg
                        : "#ffffff",
                      color: isSelected
                        ? carrera === "TODAS"
                          ? "#ffffff"
                          : styleConf.text
                        : "#64748b",
                      fontSize: "0.85rem",
                      fontWeight: isSelected ? 800 : 600,
                      cursor: "pointer",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "0.5rem",
                      whiteSpace: "nowrap",
                      boxShadow: isSelected ? "0 4px 12px rgba(0,0,0,0.06)" : "none",
                      transition: "all 0.15s ease"
                    }}
                  >
                    <span>{carrera === "TODAS" ? "Todas las Carreras" : carrera}</span>
                    <span
                      style={{
                        background: isSelected
                          ? carrera === "TODAS"
                            ? "rgba(255, 255, 255, 0.25)"
                            : styleConf.border
                          : "#f1f5f9",
                        color: isSelected
                          ? carrera === "TODAS"
                            ? "#ffffff"
                            : styleConf.text
                          : "#64748b",
                        padding: "0.1rem 0.45rem",
                        borderRadius: "9999px",
                        fontSize: "0.72rem",
                        fontWeight: 800
                      }}
                    >
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Barra de Búsqueda */}
          <div style={{ position: "relative", flex: 1 }}>
            <Search size={16} color="#94a3b8" style={{ position: "absolute", left: "0.85rem", top: "50%", transform: "translateY(-50%)" }} />
            <input
              type="text"
              placeholder="Buscar sección para asignar instructores (ej. MI1300, doctor, carrera o día)..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{
                width: "100%",
                padding: "0.65rem 0.85rem 0.65rem 2.3rem",
                borderRadius: "0.6rem",
                border: "1px solid #cbd5e1",
                fontSize: "0.88rem",
                outline: "none",
                boxSizing: "border-box",
                background: "#f8fafc"
              }}
            />
          </div>

          {/* 🌟 VISTA 1: CALENDARIO GRÁFICO SEMANAL CON BOTONES DE SECCIÓN DIRECTOS */}
          {viewMode === "calendar" && (
            <div
              style={{
                border: "1px solid #e2e8f0",
                borderRadius: "1rem",
                overflow: "hidden",
                background: "#ffffff",
                boxShadow: "0 4px 15px rgba(0,0,0,0.02)"
              }}
            >
              {loading ? (
                <div style={{ padding: "3rem", textAlign: "center", color: "#64748b", fontSize: "0.9rem" }}>
                  Cargando secciones...
                </div>
              ) : (
                <div style={{ overflowX: "auto" }}>
                  <table
                    style={{
                      width: "100%",
                      borderCollapse: "collapse",
                      minWidth: "980px",
                      textAlign: "center"
                    }}
                  >
                    <thead>
                      <tr style={{ background: "#f8fafc", borderBottom: "2px solid #e2e8f0" }}>
                        <th
                          style={{
                            padding: "1rem 0.75rem",
                            fontWeight: 800,
                            fontSize: "0.84rem",
                            color: "#475569",
                            width: "105px",
                            borderRight: "1px solid #e2e8f0",
                            background: "#f1f5f9"
                          }}
                        >
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "0.3rem" }}>
                            <Clock size={15} color="#0284c7" />
                            <span>Horario</span>
                          </div>
                        </th>
                        {DIAS_CALENDARIO.map((dia) => (
                          <th
                            key={dia}
                            style={{
                              padding: "1rem 0.5rem",
                              fontWeight: 800,
                              fontSize: "0.88rem",
                              color: "#0284c7",
                              borderRight: "1px solid #e2e8f0",
                              width: "13%"
                            }}
                          >
                            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "0.35rem" }}>
                              <Calendar size={14} />
                              <span>{dia}</span>
                            </div>
                          </th>
                        ))}
                      </tr>
                    </thead>

                    <tbody>
                      {BLOQUES_HORARIOS.map((bloque, idx) => {
                        const isEven = idx % 2 === 0;
                        return (
                          <tr
                            key={bloque.id}
                            style={{
                              background: isEven ? "#ffffff" : "#fafcff",
                              borderBottom: "1px solid #e2e8f0"
                            }}
                          >
                            <td
                              style={{
                                padding: "0.85rem 0.5rem",
                                fontWeight: 800,
                                fontSize: "0.8rem",
                                color: "#0369a1",
                                background: "#f0f9ff",
                                borderRight: "1px solid #e2e8f0",
                                verticalAlign: "middle"
                              }}
                            >
                              <div style={{ lineHeight: "1.2" }}>
                                <span>{bloque.inicio}</span>
                                <span style={{ display: "block", fontSize: "0.7rem", color: "#64748b", fontWeight: 600 }}>a</span>
                                <span>{bloque.fin}</span>
                              </div>
                            </td>

                            {DIAS_CALENDARIO.map((dia) => {
                              const secsInSlot = getSectionsForSlot(dia, bloque);
                              const hasSecs = secsInSlot.length > 0;

                              return (
                                <td
                                  key={dia}
                                  style={{
                                    padding: "0.45rem",
                                    borderRight: "1px solid #e2e8f0",
                                    verticalAlign: "top",
                                    background: hasSecs ? "transparent" : isEven ? "#ffffff" : "#fafcff"
                                  }}
                                >
                                  {hasSecs ? (
                                    <div style={{ display: "flex", flexDirection: "column", gap: "0.45rem" }}>
                                      {secsInSlot.map((sec) => {
                                        const cStyle = CARRERA_COLORS[sec.carrera] || CARRERA_COLORS.DEFAULT;
                                        const assignedIds = Array.isArray(sec.instructores_asignados) ? sec.instructores_asignados : [];
                                        const assignedInstList = instructorsList.filter((inst) => assignedIds.includes(inst.id));

                                        return (
                                          <div
                                            key={sec.id}
                                            onClick={() => setSelectedSectionForInstructors(sec)}
                                            style={{
                                              background: cStyle.bg,
                                              border: `1.5px solid ${cStyle.border}`,
                                              borderLeft: `4px solid ${cStyle.accent}`,
                                              borderRadius: "0.65rem",
                                              padding: "0.6rem 0.75rem",
                                              textAlign: "left",
                                              cursor: "pointer",
                                              position: "relative",
                                              transition: "all 0.15s ease",
                                              boxShadow: "0 2px 6px rgba(0,0,0,0.04)"
                                            }}
                                            onMouseEnter={(e) => {
                                              e.currentTarget.style.transform = "translateY(-2px)";
                                              e.currentTarget.style.boxShadow = "0 6px 14px rgba(2, 132, 199, 0.18)";
                                            }}
                                            onMouseLeave={(e) => {
                                              e.currentTarget.style.transform = "translateY(0)";
                                              e.currentTarget.style.boxShadow = "0 2px 6px rgba(0,0,0,0.04)";
                                            }}
                                            title="Clic para gestionar instructores de esta sección"
                                          >
                                            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.3rem" }}>
                                              <span style={{ fontWeight: 900, fontSize: "0.88rem", color: "#0f172a" }}>
                                                {sec.codigo}
                                              </span>
                                              <span
                                                style={{
                                                  fontSize: "0.65rem",
                                                  fontWeight: 800,
                                                  padding: "0.15rem 0.4rem",
                                                  borderRadius: "9999px",
                                                  background: "#ffffff",
                                                  color: cStyle.text,
                                                  border: `1px solid ${cStyle.border}`
                                                }}
                                              >
                                                {sec.carrera}
                                              </span>
                                            </div>

                                            {/* Coordinador */}
                                            <div style={{ fontSize: "0.74rem", color: "#1e293b", lineHeight: 1.35 }}>
                                              <strong style={{ color: "#0369a1", fontWeight: 800 }}>Coordinador:</strong>{" "}
                                              <span>{sec.coordinador || "Sin asignar"}</span>
                                            </div>

                                            {/* Listado de Instructores Asignados con Viñeta */}
                                            {assignedInstList.length > 0 && (
                                              <div style={{ marginTop: "0.35rem", display: "flex", flexDirection: "column", gap: "0.15rem", borderTop: `1px dashed ${cStyle.border}`, paddingTop: "0.35rem" }}>
                                                {assignedInstList.map((inst) => {
                                                  const shortName = `${inst.primer_nombre || ''} ${inst.primer_apellido || ''}`.trim() || inst.nombre_completo || "Instructor";
                                                  return (
                                                    <div
                                                      key={inst.id}
                                                      style={{
                                                        fontSize: "0.72rem",
                                                        color: "#334155",
                                                        fontWeight: 600,
                                                        display: "flex",
                                                        alignItems: "center",
                                                        gap: "0.3rem"
                                                      }}
                                                    >
                                                      <span style={{ fontSize: "0.65rem", color: "#0284c7" }}>•</span>
                                                      <span>{shortName}</span>
                                                    </div>
                                                  );
                                                })}
                                              </div>
                                            )}
                                          </div>
                                        );
                                      })}
                                    </div>
                                  ) : (
                                    <div
                                      style={{
                                        height: "100%",
                                        minHeight: "65px",
                                        borderRadius: "0.5rem",
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        color: "#cbd5e1"
                                      }}
                                    >
                                      <span style={{ fontSize: "0.75rem", opacity: 0.35 }}>—</span>
                                    </div>
                                  )}
                                </td>
                              );
                            })}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* 🌟 VISTA 2: TABLA DETALLADA DE SECCIONES CON BOTÓN GESTIONAR */}
          {viewMode === "table" && (
            <div
              style={{
                border: "1px solid #e2e8f0",
                borderRadius: "0.85rem",
                overflow: "hidden",
                background: "#ffffff"
              }}
            >
              {loading ? (
                <div style={{ padding: "2.5rem", textAlign: "center", color: "#64748b", fontSize: "0.9rem" }}>
                  Cargando secciones registradas...
                </div>
              ) : filteredSections.length === 0 ? (
                <div style={{ padding: "2.5rem", textAlign: "center", color: "#64748b", fontSize: "0.9rem" }}>
                  {searchTerm || selectedCarrera !== "TODAS"
                    ? "No se encontraron secciones con los filtros seleccionados."
                    : "No hay secciones registradas aún."}
                </div>
              ) : (
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
                    <thead>
                      <tr style={{ background: "#f8fafc", borderBottom: "1px solid #e2e8f0" }}>
                        <th style={{ padding: "0.8rem 1rem", fontSize: "0.78rem", fontWeight: 800, color: "#475569", textTransform: "uppercase" }}>Código</th>
                        <th style={{ padding: "0.8rem 1rem", fontSize: "0.78rem", fontWeight: 800, color: "#475569", textTransform: "uppercase" }}>Carrera</th>
                        <th style={{ padding: "0.8rem 1rem", fontSize: "0.78rem", fontWeight: 800, color: "#475569", textTransform: "uppercase" }}>Horario</th>
                        <th style={{ padding: "0.8rem 1rem", fontSize: "0.78rem", fontWeight: 800, color: "#475569", textTransform: "uppercase" }}>Coordinador</th>
                        <th style={{ padding: "0.8rem 1rem", fontSize: "0.78rem", fontWeight: 800, color: "#475569", textTransform: "uppercase" }}>Instructores Asignados</th>
                        <th style={{ padding: "0.8rem 1rem", fontSize: "0.78rem", fontWeight: 800, color: "#475569", textTransform: "uppercase", textAlign: "center" }}>Acción</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredSections.map((sec, idx) => {
                        const assignedIds = Array.isArray(sec.instructores_asignados) ? sec.instructores_asignados : [];
                        const assignedInstList = instructorsList.filter((inst) => assignedIds.includes(inst.id));

                        return (
                          <tr
                            key={sec.id}
                            style={{
                              background: idx % 2 === 0 ? "#ffffff" : "#f8fafc",
                              borderBottom: "1px solid #f1f5f9"
                            }}
                          >
                            <td style={{ padding: "0.8rem 1rem", fontWeight: 900, color: "#0f172a" }}>
                              {sec.codigo}
                            </td>
                            <td style={{ padding: "0.8rem 1rem" }}>
                              <span style={{ fontSize: "0.75rem", fontWeight: 700, padding: "0.2rem 0.5rem", borderRadius: "9999px", background: "#f1f5f9", color: "#334155" }}>
                                {sec.carrera}
                              </span>
                            </td>
                            <td style={{ padding: "0.8rem 1rem", fontSize: "0.82rem", color: "#334155" }}>
                              {sec.dia} {sec.hora_inicio} - {sec.hora_fin || "Fin"}
                            </td>
                            <td style={{ padding: "0.8rem 1rem", fontSize: "0.82rem", color: "#64748b" }}>
                              {sec.coordinador || "Sin asignar"}
                            </td>
                            <td style={{ padding: "0.8rem 1rem" }}>
                              {assignedInstList.length === 0 ? (
                                <span style={{ fontSize: "0.78rem", color: "#94a3b8" }}>Ninguno</span>
                              ) : (
                                <div style={{ display: "flex", flexDirection: "column", gap: "0.2rem" }}>
                                  {assignedInstList.map((inst) => {
                                    const shortName = `${inst.primer_nombre || ''} ${inst.primer_apellido || ''}`.trim() || inst.nombre_completo || "Instructor";
                                    return (
                                      <div
                                        key={inst.id}
                                        style={{
                                          fontSize: "0.78rem",
                                          color: "#334155",
                                          fontWeight: 600,
                                          display: "flex",
                                          alignItems: "center",
                                          gap: "0.35rem"
                                        }}
                                      >
                                        <span style={{ color: "#0284c7" }}>•</span>
                                        <span>{shortName}</span>
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </td>
                            <td style={{ padding: "0.8rem 1rem", textAlign: "center" }}>
                              <button
                                onClick={() => setSelectedSectionForInstructors(sec)}
                                style={{
                                  background: "linear-gradient(135deg, #0284c7 0%, #0369a1 100%)",
                                  border: "none",
                                  color: "#ffffff",
                                  borderRadius: "0.5rem",
                                  padding: "0.45rem 0.9rem",
                                  fontSize: "0.8rem",
                                  fontWeight: 700,
                                  cursor: "pointer",
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: "0.35rem",
                                  boxShadow: "0 2px 6px rgba(2, 132, 199, 0.25)"
                                }}
                              >
                                <Users size={14} />
                                Gestionar Instructores
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ===================================================================== */}
      {/* 🎓 VISTA 3: ADMINISTRACIÓN DE ESTUDIANTES */}
      {/* ===================================================================== */}
      {activeSubTab === "estudiantes" && (
        <div
          className="glass-panel"
          style={{
            background: "#ffffff",
            borderRadius: "1.25rem",
            border: "1px solid #e2e8f0",
            boxShadow: "0 10px 30px -5px rgba(0, 0, 0, 0.05)",
            padding: "1.75rem",
            display: "flex",
            flexDirection: "column",
            gap: "1.5rem"
          }}
        >
          {/* Cabecera */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "1rem" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.85rem" }}>
              <div
                style={{
                  width: "48px",
                  height: "48px",
                  borderRadius: "1rem",
                  background: "linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%)",
                  color: "#ffffff",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  boxShadow: "0 6px 16px rgba(124, 58, 237, 0.25)"
                }}
              >
                <GraduationCap size={24} />
              </div>
              <div>
                <h2 style={{ fontSize: "1.4rem", fontWeight: 800, color: "#0f172a", margin: 0, letterSpacing: "-0.01em" }}>
                  Administración de Estudiantes
                </h2>
                <span style={{ fontSize: "0.85rem", color: "#64748b" }}>
                  Selecciona cualquier sección para matricular, editar o consultar la lista de estudiantes
                </span>
              </div>
            </div>

            {/* Selector de modo de vista: Calendario / Lista */}
            <div
              style={{
                display: "inline-flex",
                background: "#f1f5f9",
                padding: "0.25rem",
                borderRadius: "0.65rem",
                border: "1px solid #e2e8f0"
              }}
            >
              <button
                onClick={() => setViewMode("calendar")}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "0.4rem",
                  padding: "0.4rem 0.75rem",
                  borderRadius: "0.5rem",
                  border: "none",
                  fontSize: "0.82rem",
                  fontWeight: 700,
                  cursor: "pointer",
                  background: viewMode === "calendar" ? "#ffffff" : "transparent",
                  color: viewMode === "calendar" ? "#7c3aed" : "#64748b",
                  boxShadow: viewMode === "calendar" ? "0 2px 4px rgba(0,0,0,0.06)" : "none",
                  transition: "all 0.15s ease"
                }}
              >
                <LayoutGrid size={15} />
                Calendario Gráfico
              </button>
              <button
                onClick={() => setViewMode("table")}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "0.4rem",
                  padding: "0.4rem 0.75rem",
                  borderRadius: "0.5rem",
                  border: "none",
                  fontSize: "0.82rem",
                  fontWeight: 700,
                  cursor: "pointer",
                  background: viewMode === "table" ? "#ffffff" : "transparent",
                  color: viewMode === "table" ? "#7c3aed" : "#64748b",
                  boxShadow: viewMode === "table" ? "0 2px 4px rgba(0,0,0,0.06)" : "none",
                  transition: "all 0.15s ease"
                }}
              >
                <List size={15} />
                Tabla Detallada
              </button>
            </div>
          </div>

          {/* Pestañas de Carreras */}
          <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ fontSize: "0.82rem", fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.04em", display: "flex", alignItems: "center", gap: "0.4rem" }}>
                <GraduationCap size={16} color="#7c3aed" /> Filtrar por Carrera
              </span>
              <span style={{ fontSize: "0.78rem", color: "#64748b" }}>
                Mostrando {filteredSections.length} de {sectionsList.length} secciones
              </span>
            </div>

            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.5rem",
                overflowX: "auto",
                paddingBottom: "0.35rem"
              }}
            >
              {CARRERAS_LIST.map((carrera) => {
                const isSelected = selectedCarrera === carrera;
                const count =
                  carrera === "TODAS"
                    ? sectionsList.length
                    : sectionsList.filter((s) => (s.carrera || "").toUpperCase() === carrera).length;
                const styleConf = CARRERA_COLORS[carrera] || CARRERA_COLORS.DEFAULT;

                return (
                  <button
                    key={carrera}
                    onClick={() => setSelectedCarrera(carrera)}
                    style={{
                      padding: "0.6rem 1.1rem",
                      borderRadius: "0.75rem",
                      border: isSelected
                        ? `2px solid ${carrera === "TODAS" ? "#7c3aed" : styleConf.accent}`
                        : "1px solid #e2e8f0",
                      background: isSelected
                        ? carrera === "TODAS"
                          ? "#7c3aed"
                          : styleConf.bg
                        : "#ffffff",
                      color: isSelected
                        ? carrera === "TODAS"
                          ? "#ffffff"
                          : styleConf.text
                        : "#64748b",
                      fontSize: "0.85rem",
                      fontWeight: isSelected ? 800 : 600,
                      cursor: "pointer",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "0.5rem",
                      whiteSpace: "nowrap",
                      boxShadow: isSelected ? "0 4px 12px rgba(0,0,0,0.06)" : "none",
                      transition: "all 0.15s ease"
                    }}
                  >
                    <span>{carrera === "TODAS" ? "Todas las Carreras" : carrera}</span>
                    <span
                      style={{
                        background: isSelected
                          ? carrera === "TODAS"
                            ? "rgba(255, 255, 255, 0.25)"
                            : styleConf.border
                          : "#f1f5f9",
                        color: isSelected
                          ? carrera === "TODAS"
                            ? "#ffffff"
                            : styleConf.text
                          : "#64748b",
                        padding: "0.1rem 0.45rem",
                        borderRadius: "9999px",
                        fontSize: "0.72rem",
                        fontWeight: 800
                      }}
                    >
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Barra de Búsqueda */}
          <div style={{ position: "relative", flex: 1 }}>
            <Search size={16} color="#94a3b8" style={{ position: "absolute", left: "0.85rem", top: "50%", transform: "translateY(-50%)" }} />
            <input
              type="text"
              placeholder="Buscar sección para administrar estudiantes (ej. MI1300, doctor, carrera o día)..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{
                width: "100%",
                padding: "0.65rem 0.85rem 0.65rem 2.3rem",
                borderRadius: "0.6rem",
                border: "1px solid #cbd5e1",
                fontSize: "0.88rem",
                outline: "none",
                boxSizing: "border-box",
                background: "#f8fafc"
              }}
            />
          </div>

          {/* 🌟 VISTA 1: CALENDARIO GRÁFICO SEMANAL CON TARJETAS DE SECCIÓN */}
          {viewMode === "calendar" && (
            <div
              style={{
                border: "1px solid #e2e8f0",
                borderRadius: "1rem",
                overflow: "hidden",
                background: "#ffffff",
                boxShadow: "0 4px 15px rgba(0,0,0,0.02)"
              }}
            >
              {loading ? (
                <div style={{ padding: "3rem", textAlign: "center", color: "#64748b", fontSize: "0.9rem" }}>
                  Cargando secciones...
                </div>
              ) : (
                <div style={{ overflowX: "auto" }}>
                  <table
                    style={{
                      width: "100%",
                      borderCollapse: "collapse",
                      minWidth: "980px",
                      textAlign: "center"
                    }}
                  >
                    <thead>
                      <tr style={{ background: "#f8fafc", borderBottom: "2px solid #e2e8f0" }}>
                        <th
                          style={{
                            padding: "1rem 0.75rem",
                            fontWeight: 800,
                            fontSize: "0.84rem",
                            color: "#475569",
                            width: "105px",
                            borderRight: "1px solid #e2e8f0",
                            background: "#f1f5f9"
                          }}
                        >
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "0.3rem" }}>
                            <Clock size={15} color="#7c3aed" />
                            <span>Horario</span>
                          </div>
                        </th>
                        {DIAS_CALENDARIO.map((dia) => (
                          <th
                            key={dia}
                            style={{
                              padding: "1rem 0.5rem",
                              fontWeight: 800,
                              fontSize: "0.88rem",
                              color: "#7c3aed",
                              borderRight: "1px solid #e2e8f0",
                              width: "13%"
                            }}
                          >
                            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "0.35rem" }}>
                              <Calendar size={14} />
                              <span>{dia}</span>
                            </div>
                          </th>
                        ))}
                      </tr>
                    </thead>

                    <tbody>
                      {BLOQUES_HORARIOS.map((bloque, idx) => {
                        const isEven = idx % 2 === 0;
                        return (
                          <tr
                            key={bloque.id}
                            style={{
                              background: isEven ? "#ffffff" : "#fafcff",
                              borderBottom: "1px solid #e2e8f0"
                            }}
                          >
                            <td
                              style={{
                                padding: "0.85rem 0.5rem",
                                fontWeight: 800,
                                fontSize: "0.8rem",
                                color: "#7c3aed",
                                background: "#f5f3ff",
                                borderRight: "1px solid #e2e8f0",
                                verticalAlign: "middle"
                              }}
                            >
                              <div style={{ lineHeight: "1.2" }}>
                                <span>{bloque.inicio}</span>
                                <span style={{ display: "block", fontSize: "0.7rem", color: "#64748b", fontWeight: 600 }}>a</span>
                                <span>{bloque.fin}</span>
                              </div>
                            </td>

                            {DIAS_CALENDARIO.map((dia) => {
                              const secsInSlot = getSectionsForSlot(dia, bloque);
                              const hasSecs = secsInSlot.length > 0;

                              return (
                                <td
                                  key={dia}
                                  style={{
                                    padding: "0.45rem",
                                    borderRight: "1px solid #e2e8f0",
                                    verticalAlign: "top",
                                    background: hasSecs ? "transparent" : isEven ? "#ffffff" : "#fafcff"
                                  }}
                                >
                                  {hasSecs ? (
                                    <div style={{ display: "flex", flexDirection: "column", gap: "0.45rem" }}>
                                      {secsInSlot.map((sec) => {
                                        const cStyle = CARRERA_COLORS[sec.carrera] || CARRERA_COLORS.DEFAULT;

                                        return (
                                          <div
                                            key={sec.id}
                                            onClick={() => setSelectedSectionForStudents(sec)}
                                            style={{
                                              background: cStyle.bg,
                                              border: `1.5px solid ${cStyle.border}`,
                                              borderLeft: `4px solid #7c3aed`,
                                              borderRadius: "0.65rem",
                                              padding: "0.6rem 0.75rem",
                                              textAlign: "left",
                                              cursor: "pointer",
                                              position: "relative",
                                              transition: "all 0.15s ease",
                                              boxShadow: "0 2px 6px rgba(0,0,0,0.04)"
                                            }}
                                            onMouseEnter={(e) => {
                                              e.currentTarget.style.transform = "translateY(-2px)";
                                              e.currentTarget.style.boxShadow = "0 6px 14px rgba(124, 58, 237, 0.18)";
                                            }}
                                            onMouseLeave={(e) => {
                                              e.currentTarget.style.transform = "translateY(0)";
                                              e.currentTarget.style.boxShadow = "0 2px 6px rgba(0,0,0,0.04)";
                                            }}
                                            title="Clic para gestionar la lista de estudiantes de esta sección"
                                          >
                                            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.25rem" }}>
                                              <span style={{ fontWeight: 900, fontSize: "0.88rem", color: "#0f172a" }}>
                                                {sec.codigo}
                                              </span>
                                              <span
                                                style={{
                                                  fontSize: "0.65rem",
                                                  fontWeight: 800,
                                                  padding: "0.15rem 0.4rem",
                                                  borderRadius: "9999px",
                                                  background: "#ffffff",
                                                  color: cStyle.text,
                                                  border: `1px solid ${cStyle.border}`
                                                }}
                                              >
                                                {sec.carrera}
                                              </span>
                                            </div>

                                            <div style={{ fontSize: "0.72rem", color: "#334155", fontWeight: 700 }}>
                                              {sec.coordinador ? `Coord: ${sec.coordinador}` : "Sin coord."}
                                            </div>

                                            <div style={{ fontSize: "0.7rem", color: "#64748b", marginTop: "0.15rem" }}>
                                              {sec.doctor_encargado || "Dr. Rafael Perdomo"}
                                            </div>

                                            <div
                                              style={{
                                                marginTop: "0.4rem",
                                                display: "inline-flex",
                                                alignItems: "center",
                                                gap: "0.3rem",
                                                background: "linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%)",
                                                color: "#ffffff",
                                                fontSize: "0.68rem",
                                                fontWeight: 800,
                                                padding: "0.2rem 0.5rem",
                                                borderRadius: "9999px"
                                              }}
                                            >
                                              <GraduationCap size={11} />
                                              <span>Matrícula de Alumnos</span>
                                            </div>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  ) : (
                                    <div
                                      style={{
                                        height: "100%",
                                        minHeight: "65px",
                                        borderRadius: "0.5rem",
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        color: "#cbd5e1"
                                      }}
                                    >
                                      <span style={{ fontSize: "0.75rem", opacity: 0.35 }}>—</span>
                                    </div>
                                  )}
                                </td>
                              );
                            })}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* 🌟 VISTA 2: TABLA DETALLADA DE SECCIONES CON BOTÓN GESTIONAR */}
          {viewMode === "table" && (
            <div
              style={{
                border: "1px solid #e2e8f0",
                borderRadius: "0.85rem",
                overflow: "hidden",
                background: "#ffffff"
              }}
            >
              {loading ? (
                <div style={{ padding: "2.5rem", textAlign: "center", color: "#64748b", fontSize: "0.9rem" }}>
                  Cargando secciones registradas...
                </div>
              ) : filteredSections.length === 0 ? (
                <div style={{ padding: "2.5rem", textAlign: "center", color: "#64748b", fontSize: "0.9rem" }}>
                  {searchTerm || selectedCarrera !== "TODAS"
                    ? "No se encontraron secciones con los filtros seleccionados."
                    : "No hay secciones registradas aún."}
                </div>
              ) : (
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
                    <thead>
                      <tr style={{ background: "#f8fafc", borderBottom: "1px solid #e2e8f0" }}>
                        <th style={{ padding: "0.8rem 1rem", fontSize: "0.78rem", fontWeight: 800, color: "#475569", textTransform: "uppercase" }}>Código</th>
                        <th style={{ padding: "0.8rem 1rem", fontSize: "0.78rem", fontWeight: 800, color: "#475569", textTransform: "uppercase" }}>Carrera</th>
                        <th style={{ padding: "0.8rem 1rem", fontSize: "0.78rem", fontWeight: 800, color: "#475569", textTransform: "uppercase" }}>Horario</th>
                        <th style={{ padding: "0.8rem 1rem", fontSize: "0.78rem", fontWeight: 800, color: "#475569", textTransform: "uppercase" }}>Coordinador</th>
                        <th style={{ padding: "0.8rem 1rem", fontSize: "0.78rem", fontWeight: 800, color: "#475569", textTransform: "uppercase" }}>Doctor Encargado</th>
                        <th style={{ padding: "0.8rem 1rem", fontSize: "0.78rem", fontWeight: 800, color: "#475569", textTransform: "uppercase", textAlign: "center" }}>Acción</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredSections.map((sec, idx) => (
                        <tr
                          key={sec.id}
                          style={{
                            background: idx % 2 === 0 ? "#ffffff" : "#f8fafc",
                            borderBottom: "1px solid #f1f5f9"
                          }}
                        >
                          <td style={{ padding: "0.8rem 1rem", fontWeight: 900, color: "#0f172a" }}>
                            {sec.codigo}
                          </td>
                          <td style={{ padding: "0.8rem 1rem" }}>
                            <span style={{ fontSize: "0.75rem", fontWeight: 700, padding: "0.2rem 0.5rem", borderRadius: "9999px", background: "#f1f5f9", color: "#334155" }}>
                              {sec.carrera}
                            </span>
                          </td>
                          <td style={{ padding: "0.8rem 1rem", fontSize: "0.82rem", color: "#334155" }}>
                            {sec.dia} {sec.hora_inicio} - {sec.hora_fin || "Fin"}
                          </td>
                          <td style={{ padding: "0.8rem 1rem", fontSize: "0.82rem", color: "#64748b" }}>
                            {sec.coordinador || "Sin asignar"}
                          </td>
                          <td style={{ padding: "0.8rem 1rem", fontSize: "0.82rem", color: "#64748b" }}>
                            {sec.doctor_encargado || "Dr. Rafael Perdomo"}
                          </td>
                          <td style={{ padding: "0.8rem 1rem", textAlign: "center" }}>
                            <button
                              onClick={() => setSelectedSectionForStudents(sec)}
                              style={{
                                background: "linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%)",
                                border: "none",
                                color: "#ffffff",
                                borderRadius: "0.5rem",
                                padding: "0.45rem 0.9rem",
                                fontSize: "0.8rem",
                                fontWeight: 700,
                                cursor: "pointer",
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "0.35rem",
                                boxShadow: "0 2px 6px rgba(124, 58, 237, 0.25)"
                              }}
                            >
                              <GraduationCap size={14} />
                              Gestionar Estudiantes
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Modal de Creación / Edición / Borrado de Sección */}
      {modalOpen && (
        <SectionManagementModal
          mode={modalMode}
          sections={sectionsList}
          selectedSection={selectedSectionForModal}
          instructors={instructorsList}
          onClose={() => {
            setModalOpen(false);
            setSelectedSectionForModal(null);
          }}
          onSuccess={loadData}
          notify={notify}
        />
      )}

      {/* Modal de Asignación / Matrícula de Instructores a Sección */}
      {selectedSectionForInstructors && (
        <SectionInstructorsModal
          section={selectedSectionForInstructors}
          allInstructors={instructorsList}
          onClose={() => setSelectedSectionForInstructors(null)}
          onSuccess={loadData}
          notify={notify}
        />
      )}
    </div>
  );
}
