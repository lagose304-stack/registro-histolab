import React, { useState, useEffect, useCallback } from "react";
import {
  BookOpen,
  PlusCircle,
  Edit3,
  Trash2,
  ArrowLeft,
  Search,
  Calendar,
  RefreshCw,
  Sparkles,
  LayoutGrid,
  List,
  ArrowUpDown,
  Layers,
  Copy,
  Check,
  CheckCircle2,
  Award
} from "lucide-react";
import { api } from "../services/api";
import TemarioManagementModal from "./TemarioManagementModal";
import PuntajesManagementModal from "./PuntajesManagementModal";
import { getNavState, setNavState } from "../utils/navigationState";

// Carreras académicas disponibles
const CARRERAS_CONFIG = [
  { id: "Medicina", label: "Medicina", icon: "🩺", color: "#0284c7", bg: "#f0f9ff", border: "#bae6fd", badgeColor: "#0284c7" },
  { id: "Enfermería", label: "Enfermería", icon: "💉", color: "#0d9488", bg: "#f0fdfa", border: "#99f6e4", badgeColor: "#0d9488" },
  { id: "Odontología", label: "Odontología", icon: "🦷", color: "#c026d3", bg: "#fdf4ff", border: "#f5d0fe", badgeColor: "#c026d3" },
  { id: "Microbiología", label: "Microbiología", icon: "🔬", color: "#d97706", bg: "#fffbeb", border: "#fde68a", badgeColor: "#d97706" },
  { id: "Nutrición", label: "Nutrición", icon: "🥗", color: "#16a34a", bg: "#f0fdf4", border: "#bbf7d0", badgeColor: "#16a34a" }
];

// Paleta de colores temáticos por semana
const SEMANA_THEMES = [
  {
    name: "Cian / Azul",
    headerBg: "linear-gradient(135deg, #0284c7 0%, #0369a1 100%)",
    headerBadge: "#e0f2fe",
    headerText: "#0369a1",
    rowBg: "#f8fafc",
    cardBorder: "#bae6fd",
    cardBg: "#ffffff",
    badgeBg: "#0284c7",
    badgeText: "#ffffff",
    accent: "#0284c7"
  },
  {
    name: "Violeta / Púrpura",
    headerBg: "linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%)",
    headerBadge: "#ede9fe",
    headerText: "#6d28d9",
    rowBg: "#faf5ff",
    cardBorder: "#ddd6fe",
    cardBg: "#ffffff",
    badgeBg: "#7c3aed",
    badgeText: "#ffffff",
    accent: "#7c3aed"
  },
  {
    name: "Esmeralda / Verde",
    headerBg: "linear-gradient(135deg, #059669 0%, #047857 100%)",
    headerBadge: "#d1fae5",
    headerText: "#047857",
    rowBg: "#f0fdf4",
    cardBorder: "#a7f3d0",
    cardBg: "#ffffff",
    badgeBg: "#059669",
    badgeText: "#ffffff",
    accent: "#059669"
  },
  {
    name: "Ámbar / Naranja",
    headerBg: "linear-gradient(135deg, #d97706 0%, #b45309 100%)",
    headerBadge: "#fef3c7",
    headerText: "#b45309",
    rowBg: "#fffbeb",
    cardBorder: "#fde68a",
    cardBg: "#ffffff",
    badgeBg: "#d97706",
    badgeText: "#ffffff",
    accent: "#d97706"
  },
  {
    name: "Rosa / Carmesí",
    headerBg: "linear-gradient(135deg, #e11d48 0%, #be123c 100%)",
    headerBadge: "#ffe4e6",
    headerText: "#be123c",
    rowBg: "#fff1f2",
    cardBorder: "#fecdd3",
    cardBg: "#ffffff",
    badgeBg: "#e11d48",
    badgeText: "#ffffff",
    accent: "#e11d48"
  },
  {
    name: "Teal / Turquesa",
    headerBg: "linear-gradient(135deg, #0d9488 0%, #0f766e 100%)",
    headerBadge: "#ccfbf1",
    headerText: "#0f766e",
    rowBg: "#f0fdfa",
    cardBorder: "#99f6e4",
    cardBg: "#ffffff",
    badgeBg: "#0d9488",
    badgeText: "#ffffff",
    accent: "#0d9488"
  },
  {
    name: "Índigo",
    headerBg: "linear-gradient(135deg, #4f46e5 0%, #4338ca 100%)",
    headerBadge: "#e0e7ff",
    headerText: "#4338ca",
    rowBg: "#eef2ff",
    cardBorder: "#c7d2fe",
    cardBg: "#ffffff",
    badgeBg: "#4f46e5",
    badgeText: "#ffffff",
    accent: "#4f46e5"
  },
  {
    name: "Fucsia / Magenta",
    headerBg: "linear-gradient(135deg, #c026d3 0%, #a21caf 100%)",
    headerBadge: "#fae8ff",
    headerText: "#a21caf",
    rowBg: "#fdf4ff",
    cardBorder: "#f5d0fe",
    cardBg: "#ffffff",
    badgeBg: "#c026d3",
    badgeText: "#ffffff",
    accent: "#c026d3"
  }
];

const getThemeForWeek = (semanaNum) => {
  const num = Number(semanaNum) || 1;
  const index = (Math.max(1, num) - 1) % SEMANA_THEMES.length;
  return SEMANA_THEMES[index];
};

export default function TemarioManagementView({ currentInstructor, onClose, notify = () => {} }) {
  const initialNav = getNavState();
  const [temasList, setTemasList] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [viewMode, setViewModeState] = useState(() => initialNav.temarioViewMode || "grid");
  const [selectedCarrera, setSelectedCarreraState] = useState(() => initialNav.temarioCarrera || "Medicina");

  const setSelectedCarrera = (car) => {
    setSelectedCarreraState(car);
    setNavState({ temarioCarrera: car });
  };

  const setViewMode = (mode) => {
    setViewModeState(mode);
    setNavState({ temarioViewMode: mode });
  };

  // Control del modal de administración
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState("create"); // 'create' | 'edit' | 'delete' | 'reorder'
  const [selectedTemaForModal, setSelectedTemaForModal] = useState(null);

  // Control del modal de copia de temario entre carreras
  const [copyModalOpen, setCopyModalOpen] = useState(false);
  const [copyFromCarrera, setCopyFromCarrera] = useState("Medicina");
  const [copying, setCopying] = useState(false);

  // Control del modal de administración de puntajes
  const [puntajesModalOpen, setPuntajesModalOpen] = useState(false);

  const activeCarreraConfig =
    CARRERAS_CONFIG.find((c) => c.id === selectedCarrera) || CARRERAS_CONFIG[0];

  const rolNormalized = (currentInstructor?.rol || "").toLowerCase().trim();
  const isAuthorized = rolNormalized === "creador" || rolNormalized === "administrador" || rolNormalized === "admin";

  const loadData = useCallback(async () => {
    if (!isAuthorized) return;
    setLoading(true);
    try {
      const res = await api.temario.getAll({ carrera: selectedCarrera });
      if (res?.data) {
        const sorted = [...res.data].sort((a, b) => (Number(a.semana) || 999) - (Number(b.semana) || 999));
        setTemasList(sorted);
      }
    } catch (err) {
      console.warn("Error al cargar temario:", err);
      notify("Error al cargar temas", "error");
    } finally {
      setLoading(false);
    }
  }, [selectedCarrera, isAuthorized]);

  useEffect(() => {
    if (isAuthorized) {
      loadData();
    }
  }, [loadData, isAuthorized]);

  if (!isAuthorized) {
    return (
      <div className="animate-fade-in" style={{ padding: "2.5rem 2rem", textAlign: "center", background: "#ffffff", borderRadius: "1rem", border: "1px solid #e2e8f0", maxWidth: "580px", margin: "3rem auto", boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.05)" }}>
        <div style={{ width: "56px", height: "56px", borderRadius: "50%", background: "#fee2e2", color: "#dc2626", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 1.25rem" }}>
          <BookOpen size={28} />
        </div>
        <h3 style={{ fontSize: "1.25rem", fontWeight: 800, color: "#1e293b", marginBottom: "0.5rem" }}>Acceso Restringido</h3>
        <p style={{ fontSize: "0.95rem", color: "#64748b", lineHeight: 1.5, marginBottom: "1.5rem" }}>
          El módulo de <strong>Configuración de Temarios Académicos</strong> está reservado exclusivamente para instructores con rol de <strong>Creador</strong> o <strong>Administrador</strong>.
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

  const handleOpenModal = (mode, targetTema = null) => {
    setModalMode(mode);
    setSelectedTemaForModal(targetTema);
    setModalOpen(true);
  };

  // Copiar temario desde otra carrera
  const handleExecuteCopy = async () => {
    if (copyFromCarrera === selectedCarrera) {
      notify("La carrera de origen no puede ser igual a la carrera actual", "warning");
      return;
    }

    setCopying(true);
    try {
      const res = await api.temario.copy(copyFromCarrera, selectedCarrera);
      notify(res.message || `Temario copiado exitosamente a ${selectedCarrera}`, "success");
      setCopyModalOpen(false);
      loadData();
    } catch (err) {
      console.error("Error al copiar temario:", err);
      notify(err.message || "Error al duplicar temario", "error");
    } finally {
      setCopying(false);
    }
  };

  // Búsqueda por Nombre o Semana
  const filteredTemas = temasList.filter((tema) => {
    const s = searchTerm.toLowerCase();
    const titulo = (tema.titulo || tema.nombre || "").toLowerCase();
    const semanaStr = `semana ${tema.semana}`.toLowerCase();
    const semNum = String(tema.semana || "");

    return !s || titulo.includes(s) || semanaStr.includes(s) || semNum.includes(s);
  });

  // 🗂️ Agrupación de temas por semana
  const groupedBySemana = {};
  filteredTemas.forEach((tema) => {
    const sem = Number(tema.semana) || 1;
    if (!groupedBySemana[sem]) {
      groupedBySemana[sem] = [];
    }
    groupedBySemana[sem].push(tema);
  });

  const sortedWeeks = Object.keys(groupedBySemana).sort((a, b) => Number(a) - Number(b));

  return (
    <div className="animate-fade-in" style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      {/* Barra Superior de Navegación del Módulo */}
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
            padding: "0.6rem 1.1rem",
            borderRadius: "0.75rem",
            background: "#ffffff",
            border: "1px solid #cbd5e1",
            color: "#334155",
            fontSize: "0.88rem",
            fontWeight: 700,
            cursor: "pointer",
            boxShadow: "var(--shadow-sm)",
            transition: "all 0.15s ease"
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = "#f1f5f9";
            e.currentTarget.style.color = "#0f172a";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "#ffffff";
            e.currentTarget.style.color = "#334155";
          }}
        >
          <ArrowLeft size={17} />
          Volver al Dashboard
        </button>

        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap" }}>
          <div
            style={{
              background: activeCarreraConfig.bg,
              border: `1px solid ${activeCarreraConfig.border}`,
              padding: "0.45rem 0.95rem",
              borderRadius: "9999px",
              fontSize: "0.82rem",
              fontWeight: 800,
              color: activeCarreraConfig.color,
              display: "flex",
              alignItems: "center",
              gap: "0.4rem"
            }}
          >
            <span>{activeCarreraConfig.icon}</span>
            <span>
              {selectedCarrera}: {temasList.length} Temas ({sortedWeeks.length} Semanas)
            </span>
          </div>

          {/* Selector de modo de vista */}
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
              onClick={() => setViewMode("grid")}
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
                background: viewMode === "grid" ? "#ffffff" : "transparent",
                color: viewMode === "grid" ? "#0284c7" : "#64748b",
                boxShadow: viewMode === "grid" ? "0 2px 4px rgba(0,0,0,0.06)" : "none",
                transition: "all 0.15s ease"
              }}
            >
              <LayoutGrid size={15} />
              Filas por Semana
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
              Lista
            </button>
          </div>

          <button
            onClick={loadData}
            disabled={loading}
            style={{
              background: "#ffffff",
              border: "1px solid #cbd5e1",
              borderRadius: "0.6rem",
              padding: "0.5rem 0.75rem",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              color: "#64748b",
              transition: "all 0.15s ease"
            }}
            title="Actualizar temario"
          >
            <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
          </button>
        </div>
      </div>

      {/* Contenedor Principal */}
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
        {/* Cabecera del Módulo */}
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
              <BookOpen size={24} />
            </div>
            <div>
              <h2 style={{ fontSize: "1.4rem", fontWeight: 800, color: "#0f172a", margin: 0, letterSpacing: "-0.01em" }}>
                Administración de Temario por Carrera
              </h2>
              <span style={{ fontSize: "0.85rem", color: "#64748b" }}>
                Configuración y ordenamiento de temas académicos independientes para cada carrera.
              </span>
            </div>
          </div>

          <button
            onClick={() => setCopyModalOpen(true)}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "0.45rem",
              background: "#ffffff",
              border: "1px solid #cbd5e1",
              color: "#334155",
              padding: "0.55rem 1rem",
              borderRadius: "0.75rem",
              fontSize: "0.84rem",
              fontWeight: 700,
              cursor: "pointer",
              boxShadow: "0 2px 4px rgba(0,0,0,0.03)",
              transition: "all 0.15s ease"
            }}
          >
            <Copy size={15} color="#0284c7" />
            <span>Copiar temario desde otra carrera</span>
          </button>
        </div>

        {/* =================================================================== */}
        {/* 🩺 SELECTOR VISUAL DE CARRERAS (PESTAÑAS INDEPENDIENTES) */}
        {/* =================================================================== */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.6rem",
            padding: "0.6rem",
            background: "#f8fafc",
            borderRadius: "1rem",
            border: "1px solid #e2e8f0",
            overflowX: "auto"
          }}
        >
          {CARRERAS_CONFIG.map((carrera) => {
            const isSelected = selectedCarrera === carrera.id;
            return (
              <button
                key={carrera.id}
                onClick={() => setSelectedCarrera(carrera.id)}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "0.5rem",
                  padding: "0.55rem 1.15rem",
                  borderRadius: "0.75rem",
                  border: isSelected ? `2px solid ${carrera.color}` : "1px solid transparent",
                  background: isSelected ? "#ffffff" : "transparent",
                  color: isSelected ? carrera.color : "#64748b",
                  fontWeight: isSelected ? 800 : 600,
                  fontSize: "0.88rem",
                  cursor: "pointer",
                  boxShadow: isSelected ? "0 4px 12px rgba(0,0,0,0.06)" : "none",
                  transition: "all 0.15s ease",
                  whiteSpace: "nowrap"
                }}
              >
                <span style={{ fontSize: "1.1rem" }}>{carrera.icon}</span>
                <span>{carrera.label}</span>
                {isSelected && (
                  <span
                    style={{
                      width: "8px",
                      height: "8px",
                      borderRadius: "50%",
                      background: carrera.color,
                      display: "inline-block"
                    }}
                  />
                )}
              </button>
            );
          })}
        </div>

        {/* 🌟 CINCO BOTONES PRINCIPALES DE GESTIÓN */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(175px, 1fr))",
            gap: "1rem"
          }}
        >
          {/* Botón 1: Crear Tema */}
          <button
            onClick={() => handleOpenModal("create")}
            style={{
              padding: "1.1rem 1.2rem",
              borderRadius: "0.85rem",
              border: "1px solid #bae6fd",
              background: "linear-gradient(135deg, #0284c7 0%, #0369a1 100%)",
              color: "#ffffff",
              cursor: "pointer",
              display: "flex",
              flexDirection: "column",
              alignItems: "flex-start",
              gap: "0.4rem",
              boxShadow: "0 4px 12px rgba(2, 132, 199, 0.25)",
              transition: "all 0.2s ease",
              textAlign: "left"
            }}
            onMouseEnter={(e) => (e.currentTarget.style.transform = "translateY(-2px)")}
            onMouseLeave={(e) => (e.currentTarget.style.transform = "translateY(0)")}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", width: "100%", justifyContent: "space-between" }}>
              <PlusCircle size={22} />
              <span style={{ fontSize: "0.72rem", background: "rgba(255,255,255,0.2)", padding: "0.15rem 0.5rem", borderRadius: "9999px" }}>
                {selectedCarrera}
              </span>
            </div>
            <strong style={{ fontSize: "0.95rem" }}>Crear Tema</strong>
            <span style={{ fontSize: "0.76rem", opacity: 0.9 }}>Registrar nuevo tema en {selectedCarrera}</span>
          </button>

          {/* Botón 2: Editar Tema */}
          <button
            onClick={() => handleOpenModal("edit")}
            style={{
              padding: "1.1rem 1.2rem",
              borderRadius: "0.85rem",
              border: "1px solid #fde68a",
              background: "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)",
              color: "#ffffff",
              cursor: "pointer",
              display: "flex",
              flexDirection: "column",
              alignItems: "flex-start",
              gap: "0.4rem",
              boxShadow: "0 4px 12px rgba(217, 119, 6, 0.25)",
              transition: "all 0.2s ease",
              textAlign: "left"
            }}
            onMouseEnter={(e) => (e.currentTarget.style.transform = "translateY(-2px)")}
            onMouseLeave={(e) => (e.currentTarget.style.transform = "translateY(0)")}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", width: "100%", justifyContent: "space-between" }}>
              <Edit3 size={22} />
              <span style={{ fontSize: "0.72rem", background: "rgba(255,255,255,0.2)", padding: "0.15rem 0.5rem", borderRadius: "9999px" }}>
                Modificar
              </span>
            </div>
            <strong style={{ fontSize: "0.95rem" }}>Editar Tema</strong>
            <span style={{ fontSize: "0.76rem", opacity: 0.9 }}>Modificar nombre o semana</span>
          </button>

          {/* Botón 3: Reordenar Temas */}
          <button
            onClick={() => handleOpenModal("reorder_temas")}
            style={{
              padding: "1.1rem 1.2rem",
              borderRadius: "0.85rem",
              border: "1px solid #c7d2fe",
              background: "linear-gradient(135deg, #4f46e5 0%, #4338ca 100%)",
              color: "#ffffff",
              cursor: "pointer",
              display: "flex",
              flexDirection: "column",
              alignItems: "flex-start",
              gap: "0.4rem",
              boxShadow: "0 4px 12px rgba(79, 70, 229, 0.25)",
              transition: "all 0.2s ease",
              textAlign: "left"
            }}
            onMouseEnter={(e) => (e.currentTarget.style.transform = "translateY(-2px)")}
            onMouseLeave={(e) => (e.currentTarget.style.transform = "translateY(0)")}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", width: "100%", justifyContent: "space-between" }}>
              <ArrowUpDown size={22} />
              <span style={{ fontSize: "0.72rem", background: "rgba(255,255,255,0.2)", padding: "0.15rem 0.5rem", borderRadius: "9999px" }}>
                Orden
              </span>
            </div>
            <strong style={{ fontSize: "0.95rem" }}>Reordenar Temas</strong>
            <span style={{ fontSize: "0.76rem", opacity: 0.9 }}>Cambiar orden y renumerar 1, 2, 3...</span>
          </button>

          {/* Botón 3: Administrar / Asignar Semanas */}
          <button
            onClick={() => handleOpenModal("reorder")}
            style={{
              padding: "1.1rem 1.2rem",
              borderRadius: "0.85rem",
              border: "1px solid #c7d2fe",
              background: "linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%)",
              color: "#ffffff",
              cursor: "pointer",
              display: "flex",
              flexDirection: "column",
              alignItems: "flex-start",
              gap: "0.4rem",
              boxShadow: "0 4px 12px rgba(124, 58, 237, 0.25)",
              transition: "all 0.2s ease",
              textAlign: "left"
            }}
            onMouseEnter={(e) => (e.currentTarget.style.transform = "translateY(-2px)")}
            onMouseLeave={(e) => (e.currentTarget.style.transform = "translateY(0)")}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", width: "100%", justifyContent: "space-between" }}>
              <Calendar size={22} />
              <span style={{ fontSize: "0.72rem", background: "rgba(255,255,255,0.2)", padding: "0.15rem 0.5rem", borderRadius: "9999px" }}>
                Semanas
              </span>
            </div>
            <strong style={{ fontSize: "0.95rem" }}>Administrar Semanas</strong>
            <span style={{ fontSize: "0.76rem", opacity: 0.9 }}>Definir semanas, parcial y temas</span>
          </button>

          {/* Botón 4: Eliminar Tema */}
          <button
            onClick={() => handleOpenModal("delete")}
            style={{
              padding: "1.1rem 1.2rem",
              borderRadius: "0.85rem",
              border: "1px solid #fecdd3",
              background: "linear-gradient(135deg, #e11d48 0%, #be123c 100%)",
              color: "#ffffff",
              cursor: "pointer",
              display: "flex",
              flexDirection: "column",
              alignItems: "flex-start",
              gap: "0.4rem",
              boxShadow: "0 4px 12px rgba(225, 29, 72, 0.25)",
              transition: "all 0.2s ease",
              textAlign: "left"
            }}
            onMouseEnter={(e) => (e.currentTarget.style.transform = "translateY(-2px)")}
            onMouseLeave={(e) => (e.currentTarget.style.transform = "translateY(0)")}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", width: "100%", justifyContent: "space-between" }}>
              <Trash2 size={22} />
              <span style={{ fontSize: "0.72rem", background: "rgba(255,255,255,0.2)", padding: "0.15rem 0.5rem", borderRadius: "9999px" }}>
                Borrar
              </span>
            </div>
            <strong style={{ fontSize: "0.95rem" }}>Eliminar Tema</strong>
            <span style={{ fontSize: "0.76rem", opacity: 0.9 }}>Quitar tema de {selectedCarrera}</span>
          </button>

          {/* Botón 5: Administrar Puntaje */}
          <button
            onClick={() => setPuntajesModalOpen(true)}
            style={{
              padding: "1.1rem 1.2rem",
              borderRadius: "0.85rem",
              border: "1px solid #bbf7d0",
              background: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
              color: "#ffffff",
              cursor: "pointer",
              display: "flex",
              flexDirection: "column",
              alignItems: "flex-start",
              gap: "0.4rem",
              boxShadow: "0 4px 12px rgba(16, 185, 129, 0.25)",
              transition: "all 0.2s ease",
              textAlign: "left"
            }}
            onMouseEnter={(e) => (e.currentTarget.style.transform = "translateY(-2px)")}
            onMouseLeave={(e) => (e.currentTarget.style.transform = "translateY(0)")}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", width: "100%", justifyContent: "space-between" }}>
              <Award size={22} />
              <span style={{ fontSize: "0.72rem", background: "rgba(255,255,255,0.2)", padding: "0.15rem 0.5rem", borderRadius: "9999px" }}>
                Puntajes
              </span>
            </div>
            <strong style={{ fontSize: "0.95rem" }}>Administrar Puntaje</strong>
            <span style={{ fontSize: "0.76rem", opacity: 0.9 }}>Notas de manuales, pruebas y exámenes</span>
          </button>
        </div>

        {/* Buscador de Temas */}
        <div style={{ position: "relative", maxWidth: "420px" }}>
          <Search
            size={16}
            style={{
              position: "absolute",
              left: "1rem",
              top: "50%",
              transform: "translateY(-50%)",
              color: "#94a3b8"
            }}
          />
          <input
            type="text"
            placeholder={`Buscar tema o semana en ${selectedCarrera}...`}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{
              width: "100%",
              padding: "0.65rem 1rem 0.65rem 2.6rem",
              borderRadius: "0.75rem",
              border: "1px solid #cbd5e1",
              fontSize: "0.85rem",
              outline: "none",
              boxSizing: "border-box"
            }}
          />
        </div>

        {/* Visualización de Temas */}
        {loading ? (
          <div style={{ padding: "3rem", textAlign: "center", color: "#64748b" }}>
            <RefreshCw size={28} className="animate-spin" style={{ margin: "0 auto 0.75rem", color: activeCarreraConfig.color }} />
            <p style={{ fontWeight: 700 }}>Cargando temario de {selectedCarrera}...</p>
          </div>
        ) : filteredTemas.length === 0 ? (
          <div
            style={{
              padding: "3rem 1.5rem",
              textAlign: "center",
              background: "#f8fafc",
              borderRadius: "1rem",
              border: "1px dashed #cbd5e1",
              color: "#64748b"
            }}
          >
            <span style={{ fontSize: "2.5rem", display: "block", marginBottom: "0.5rem" }}>{activeCarreraConfig.icon}</span>
            <p style={{ fontWeight: 800, fontSize: "1.05rem", color: "#1e293b", margin: "0 0 0.4rem" }}>
              No hay temas registrados para {selectedCarrera}
            </p>
            <p style={{ fontSize: "0.84rem", margin: "0 0 1.2rem" }}>
              Puedes crear un nuevo tema para esta carrera o copiar el temario oficial desde Medicina.
            </p>
            <div style={{ display: "flex", justifyContent: "center", gap: "0.75rem" }}>
              <button
                onClick={() => handleOpenModal("create")}
                style={{
                  background: activeCarreraConfig.color,
                  color: "#ffffff",
                  border: "none",
                  padding: "0.55rem 1.1rem",
                  borderRadius: "0.65rem",
                  fontSize: "0.84rem",
                  fontWeight: 700,
                  cursor: "pointer"
                }}
              >
                + Crear Primer Tema
              </button>
              <button
                onClick={() => setCopyModalOpen(true)}
                style={{
                  background: "#ffffff",
                  color: "#334155",
                  border: "1px solid #cbd5e1",
                  padding: "0.55rem 1.1rem",
                  borderRadius: "0.65rem",
                  fontSize: "0.84rem",
                  fontWeight: 700,
                  cursor: "pointer"
                }}
              >
                Copiar desde Medicina
              </button>
            </div>
          </div>
        ) : viewMode === "grid" ? (
          /* =================================================================== */
          /* 🗂️ MODO 1: FILAS AGRUPADAS POR SEMANA */
          /* =================================================================== */
          <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
            {sortedWeeks.map((semStr) => {
              const semNum = Number(semStr);
              const temasDeEstaSemana = groupedBySemana[semNum] || [];
              const theme = getThemeForWeek(semNum);

              return (
                <div
                  key={`sem_block_${semNum}`}
                  style={{
                    background: theme.rowBg,
                    border: `1px solid ${theme.cardBorder}`,
                    borderRadius: "1rem",
                    padding: "1.25rem",
                    display: "flex",
                    flexDirection: "column",
                    gap: "1rem"
                  }}
                >
                  {/* Título de la Semana */}
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
                      <span
                        style={{
                          background: theme.badgeBg,
                          color: theme.badgeText,
                          fontWeight: 900,
                          fontSize: "0.8rem",
                          padding: "0.2rem 0.7rem",
                          borderRadius: "9999px"
                        }}
                      >
                        Semana {semNum}
                      </span>
                      <span style={{ fontSize: "0.86rem", fontWeight: 700, color: "#475569" }}>
                        {temasDeEstaSemana.length} {temasDeEstaSemana.length === 1 ? "Tema" : "Temas"}
                      </span>
                    </div>

                    <button
                      onClick={() => handleOpenModal("create")}
                      style={{
                        background: "#ffffff",
                        border: `1px solid ${theme.cardBorder}`,
                        color: theme.accent,
                        fontSize: "0.75rem",
                        fontWeight: 700,
                        padding: "0.25rem 0.65rem",
                        borderRadius: "0.5rem",
                        cursor: "pointer"
                      }}
                    >
                      + Agregar a Semana {semNum}
                    </button>
                  </div>

                  {/* Cuadrícula de Temas de la Semana */}
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
                      gap: "0.85rem"
                    }}
                  >
                    {temasDeEstaSemana.map((tema, index) => (
                      <div
                        key={tema.id}
                        style={{
                          background: "#ffffff",
                          border: "1px solid #e2e8f0",
                          borderRadius: "0.75rem",
                          padding: "0.9rem 1rem",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          gap: "0.75rem",
                          boxShadow: "0 2px 5px rgba(0,0,0,0.03)"
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", overflow: "hidden" }}>
                          <div
                            style={{
                              width: "32px",
                              height: "28px",
                              borderRadius: "0.5rem",
                              background: theme.headerBadge,
                              color: theme.accent,
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              fontSize: "0.76rem",
                              fontWeight: 800,
                              flexShrink: 0
                            }}
                          >
                            #{tema.numero_tema || index + 1}
                          </div>
                          <span
                            style={{
                              fontSize: "0.88rem",
                              fontWeight: 700,
                              color: "#1e293b",
                              whiteSpace: "nowrap",
                              overflow: "hidden",
                              textOverflow: "ellipsis"
                            }}
                            title={tema.titulo || tema.nombre}
                          >
                            {tema.titulo || tema.nombre}
                          </span>

                          {tema.tiene_manual !== false ? (
                            <span
                              style={{
                                background: "#f0fdf4",
                                color: "#15803d",
                                border: "1px solid #bbf7d0",
                                fontSize: "0.68rem",
                                fontWeight: 700,
                                padding: "0.1rem 0.4rem",
                                borderRadius: "4px",
                                flexShrink: 0
                              }}
                            >
                              📘 Manual
                            </span>
                          ) : (
                            <span
                              style={{
                                background: "#f1f5f9",
                                color: "#64748b",
                                fontSize: "0.68rem",
                                fontWeight: 600,
                                padding: "0.1rem 0.4rem",
                                borderRadius: "4px",
                                flexShrink: 0
                              }}
                            >
                              Sin Manual
                            </span>
                          )}
                        </div>

                        <div style={{ display: "flex", alignItems: "center", gap: "0.3rem", flexShrink: 0 }}>
                          <button
                            onClick={() => handleOpenModal("edit", tema)}
                            style={{
                              background: "#fef3c7",
                              border: "none",
                              color: "#d97706",
                              width: "28px",
                              height: "28px",
                              borderRadius: "0.45rem",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              cursor: "pointer"
                            }}
                            title="Editar tema"
                          >
                            <Edit3 size={13} />
                          </button>
                          <button
                            onClick={() => handleOpenModal("delete", tema)}
                            style={{
                              background: "#fee2e2",
                              border: "none",
                              color: "#dc2626",
                              width: "28px",
                              height: "28px",
                              borderRadius: "0.45rem",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              cursor: "pointer"
                            }}
                            title="Eliminar tema"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          /* =================================================================== */
          /* 📋 MODO 2: TABLA COMPACTA */
          /* =================================================================== */
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
              <thead>
                <tr style={{ background: "#f8fafc", borderBottom: "2px solid #cbd5e1" }}>
                  <th style={{ padding: "0.75rem 1rem", fontSize: "0.8rem", color: "#475569", fontWeight: 800, width: "60px", textAlign: "center" }}>No.</th>
                  <th style={{ padding: "0.75rem 1rem", fontSize: "0.8rem", color: "#475569", fontWeight: 800 }}>Semana</th>
                  <th style={{ padding: "0.75rem 1rem", fontSize: "0.8rem", color: "#475569", fontWeight: 800 }}>Nombre del Tema</th>
                  <th style={{ padding: "0.75rem 1rem", fontSize: "0.8rem", color: "#475569", fontWeight: 800 }}>Manual</th>
                  <th style={{ padding: "0.75rem 1rem", fontSize: "0.8rem", color: "#475569", fontWeight: 800 }}>Carrera</th>
                  <th style={{ padding: "0.75rem 1rem", fontSize: "0.8rem", color: "#475569", fontWeight: 800, textAlign: "right" }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filteredTemas.map((tema, index) => (
                  <tr
                    key={tema.id}
                    style={{
                      borderBottom: "1px solid #f1f5f9",
                      background: index % 2 === 0 ? "#ffffff" : "#f8fafc"
                    }}
                  >
                    <td style={{ padding: "0.75rem 1rem", fontSize: "0.82rem", fontWeight: 800, color: "#64748b", textAlign: "center" }}>
                      #{tema.numero_tema || index + 1}
                    </td>
                    <td style={{ padding: "0.75rem 1rem", fontSize: "0.82rem", fontWeight: 800, color: "#0284c7" }}>
                      Semana {tema.semana}
                    </td>
                    <td style={{ padding: "0.75rem 1rem", fontSize: "0.85rem", fontWeight: 700, color: "#1e293b" }}>
                      {tema.titulo || tema.nombre}
                    </td>
                    <td style={{ padding: "0.75rem 1rem" }}>
                      {tema.tiene_manual !== false ? (
                        <span style={{ background: "#f0fdf4", color: "#15803d", border: "1px solid #bbf7d0", fontSize: "0.72rem", fontWeight: 700, padding: "0.15rem 0.5rem", borderRadius: "4px" }}>
                          📘 Con Manual
                        </span>
                      ) : (
                        <span style={{ background: "#f1f5f9", color: "#64748b", fontSize: "0.72rem", fontWeight: 600, padding: "0.15rem 0.5rem", borderRadius: "4px" }}>
                          Sin Manual
                        </span>
                      )}
                    </td>
                    <td style={{ padding: "0.75rem 1rem", fontSize: "0.78rem", fontWeight: 600, color: "#64748b" }}>
                      {tema.carrera || selectedCarrera}
                    </td>
                    <td style={{ padding: "0.75rem 1rem", textAlign: "right" }}>
                      <div style={{ display: "inline-flex", gap: "0.4rem" }}>
                        <button
                          onClick={() => handleOpenModal("edit", tema)}
                          style={{
                            background: "#fef3c7",
                            border: "none",
                            color: "#d97706",
                            padding: "0.3rem 0.6rem",
                            borderRadius: "0.45rem",
                            fontSize: "0.75rem",
                            fontWeight: 700,
                            cursor: "pointer"
                          }}
                        >
                          Editar
                        </button>
                        <button
                          onClick={() => handleOpenModal("delete", tema)}
                          style={{
                            background: "#fee2e2",
                            border: "none",
                            color: "#dc2626",
                            padding: "0.3rem 0.6rem",
                            borderRadius: "0.45rem",
                            fontSize: "0.75rem",
                            fontWeight: 700,
                            cursor: "pointer"
                          }}
                        >
                          Eliminar
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

      {/* Modal de Copia de Temario entre Carreras */}
      {copyModalOpen && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(15, 23, 42, 0.7)",
            backdropFilter: "blur(8px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 99999999,
            padding: "1rem"
          }}
          onClick={() => setCopyModalOpen(false)}
        >
          <div
            style={{
              background: "#ffffff",
              borderRadius: "1.25rem",
              width: "100%",
              maxWidth: "500px",
              padding: "1.75rem",
              display: "flex",
              flexDirection: "column",
              gap: "1.25rem",
              boxShadow: "0 25px 50px -12px rgba(0,0,0,0.35)",
              border: "1px solid #e2e8f0"
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
              <div
                style={{
                  width: "40px",
                  height: "40px",
                  borderRadius: "0.75rem",
                  background: "#e0f2fe",
                  color: "#0284c7",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center"
                }}
              >
                <Copy size={20} />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: "1.15rem", fontWeight: 800, color: "#0f172a" }}>
                  Copiar Temario a {selectedCarrera}
                </h3>
                <span style={{ fontSize: "0.78rem", color: "#64748b" }}>
                  Duplica todo el temario de otra carrera como base para {selectedCarrera}.
                </span>
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              <label style={{ fontSize: "0.82rem", fontWeight: 700, color: "#334155" }}>
                Selecciona la carrera de origen:
              </label>
              <select
                value={copyFromCarrera}
                onChange={(e) => setCopyFromCarrera(e.target.value)}
                style={{
                  padding: "0.6rem 0.8rem",
                  borderRadius: "0.6rem",
                  border: "1px solid #cbd5e1",
                  fontSize: "0.88rem",
                  fontWeight: 600,
                  outline: "none"
                }}
              >
                {CARRERAS_CONFIG.filter((c) => c.id !== selectedCarrera).map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.icon} {c.label}
                  </option>
                ))}
              </select>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.6rem", marginTop: "0.5rem" }}>
              <button
                onClick={() => setCopyModalOpen(false)}
                style={{
                  background: "#f1f5f9",
                  border: "none",
                  padding: "0.55rem 1rem",
                  borderRadius: "0.6rem",
                  fontSize: "0.84rem",
                  fontWeight: 700,
                  color: "#475569",
                  cursor: "pointer"
                }}
              >
                Cancelar
              </button>
              <button
                onClick={handleExecuteCopy}
                disabled={copying}
                style={{
                  background: "linear-gradient(135deg, #0284c7 0%, #0369a1 100%)",
                  border: "none",
                  padding: "0.55rem 1.2rem",
                  borderRadius: "0.6rem",
                  fontSize: "0.84rem",
                  fontWeight: 800,
                  color: "#ffffff",
                  cursor: copying ? "not-allowed" : "pointer"
                }}
              >
                {copying ? "Copiando..." : `Copiar a ${selectedCarrera}`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Administración de Temas y Semanas */}
      {modalOpen && (
        <TemarioManagementModal
          mode={modalMode}
          temas={temasList}
          selectedTema={selectedTemaForModal}
          carrera={selectedCarrera}
          onClose={() => setModalOpen(false)}
          onSuccess={() => {
            setModalOpen(false);
            loadData();
          }}
          notify={notify}
        />
      )}

      {/* Modal de Administración de Puntajes por Carrera */}
      {puntajesModalOpen && (
        <PuntajesManagementModal
          carrera={selectedCarrera}
          carreraConfig={activeCarreraConfig}
          onClose={() => setPuntajesModalOpen(false)}
          notify={notify}
        />
      )}
    </div>
  );
}
