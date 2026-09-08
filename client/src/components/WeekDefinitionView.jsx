import React, { useState, useEffect, useCallback } from "react";
import {
  Calendar,
  CalendarDays,
  ArrowLeft,
  Save,
  Wand2,
  CheckCircle2,
  Clock,
  Sparkles,
  Layers,
  BookOpen,
  Info,
  CalendarCheck,
  Copy,
  RefreshCw,
  AlertCircle
} from "lucide-react";
import { api } from "../services/api";

const CARRERAS_CONFIG = [
  { id: "Medicina", label: "Medicina", icon: "🩺", color: "#0284c7", bg: "#f0f9ff", border: "#bae6fd" },
  { id: "Enfermería", label: "Enfermería", icon: "💉", color: "#0d9488", bg: "#f0fdfa", border: "#99f6e4" },
  { id: "Odontología", label: "Odontología", icon: "🦷", color: "#c026d3", bg: "#fdf4ff", border: "#f5d0fe" },
  { id: "Microbiología", label: "Microbiología", icon: "🔬", color: "#d97706", bg: "#fffbeb", border: "#fde68a" },
  { id: "Nutrición", label: "Nutrición", icon: "🥗", color: "#16a34a", bg: "#f0fdf4", border: "#bbf7d0" }
];

const PARCIALES_META = [
  { id: "I Parcial", label: "I Parcial", semanas: [1, 2, 3, 4, 5], color: "#7c3aed", bg: "#faf5ff", border: "#e9d5ff" },
  { id: "II Parcial", label: "II Parcial", semanas: [6, 7, 8, 9, 10, 11], color: "#0284c7", bg: "#f0f9ff", border: "#bae6fd" },
  { id: "III Parcial", label: "III Parcial", semanas: [12, 13, 14, 15, 16], color: "#d97706", bg: "#fffbeb", border: "#fde68a" }
];

export default function WeekDefinitionView({ currentInstructor, onClose = () => {}, notify = () => {} }) {
  const [selectedCarrera, setSelectedCarrera] = useState("Medicina");
  const [semanas, setSemanas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [autoStartDate, setAutoStartDate] = useState("");
  const [showAutoGenerator, setShowAutoGenerator] = useState(false);

  // Modal para copiar fechas de semanas entre carreras
  const [copyModalOpen, setCopyModalOpen] = useState(false);
  const [copyFromCarrera, setCopyFromCarrera] = useState("Medicina");
  const [copying, setCopying] = useState(false);

  const rolNormalized = (currentInstructor?.rol || "").toLowerCase().trim();
  const isAuthorized = rolNormalized === "creador" || rolNormalized === "administrador" || rolNormalized === "admin";

  const activeCarrera =
    CARRERAS_CONFIG.find((c) => c.id === selectedCarrera) || CARRERAS_CONFIG[0];

  // Cargar configuración de semanas de la carrera activa
  const loadSemanas = useCallback(async () => {
    if (!isAuthorized) return;
    setLoading(true);
    try {
      const res = await api.semanas.getConfig(selectedCarrera);
      if (res?.data) {
        setSemanas(res.data);
      } else {
        setSemanas([]);
      }
    } catch (err) {
      console.error("Error al cargar configuración de semanas:", err);
      notify(`Error al cargar la programación de ${selectedCarrera}`, "error");
    } finally {
      setLoading(false);
    }
  }, [selectedCarrera, isAuthorized]);

  useEffect(() => {
    if (isAuthorized) {
      loadSemanas();
    }
  }, [loadSemanas, isAuthorized]);

  if (!isAuthorized) {
    return (
      <div className="animate-fade-in" style={{ padding: "2.5rem 2rem", textAlign: "center", background: "#ffffff", borderRadius: "1rem", border: "1px solid #e2e8f0", maxWidth: "580px", margin: "3rem auto", boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.05)" }}>
        <div style={{ width: "56px", height: "56px", borderRadius: "50%", background: "#fee2e2", color: "#dc2626", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 1.25rem" }}>
          <CalendarDays size={28} />
        </div>
        <h3 style={{ fontSize: "1.25rem", fontWeight: 800, color: "#1e293b", marginBottom: "0.5rem" }}>Acceso Restringido</h3>
        <p style={{ fontSize: "0.95rem", color: "#64748b", lineHeight: 1.5, marginBottom: "1.5rem" }}>
          El módulo de <strong>Definición de Semanas Académicas</strong> está reservado exclusivamente para instructores con rol de <strong>Creador</strong> o <strong>Administrador</strong>.
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

  // Manejar cambio en fecha inicio o fin
  const handleDateChange = (numeroSemana, field, value) => {
    setSemanas((prev) =>
      prev.map((s) => (s.numero_semana === numeroSemana ? { ...s, [field]: value } : s))
    );
  };

  // Manejar cambio de semana actual activa
  const handleSetSemanaActual = (numeroSemana) => {
    setSemanas((prev) =>
      prev.map((s) => ({
        ...s,
        es_semana_actual: s.numero_semana === numeroSemana
      }))
    );
  };

  // Generador automático de fechas a partir de un lunes inicial
  const handleApplyAutoDates = () => {
    if (!autoStartDate) {
      notify("Selecciona la fecha de inicio (Lunes de la Semana 1)", "warning");
      return;
    }

    const start = new Date(autoStartDate + "T00:00:00");
    if (isNaN(start.getTime())) {
      notify("Fecha inválida", "error");
      return;
    }

    const updated = semanas.map((s, idx) => {
      const semStart = new Date(start);
      semStart.setDate(start.getDate() + idx * 7);

      const semEnd = new Date(semStart);
      semEnd.setDate(semStart.getDate() + 5);

      const fInicio = semStart.toISOString().split("T")[0];
      const fFin = semEnd.toISOString().split("T")[0];

      return {
        ...s,
        fecha_inicio: fInicio,
        fecha_fin: fFin
      };
    });

    setSemanas(updated);
    setShowAutoGenerator(false);
    notify(`Fechas de las ${semanas.length} semanas calculadas para ${selectedCarrera}. Revisa y presiona Guardar.`, "success");
  };

  // Copiar fechas desde otra carrera
  const handleExecuteCopy = async () => {
    if (copyFromCarrera === selectedCarrera) {
      notify("La carrera de origen no puede ser igual a la carrera actual", "warning");
      return;
    }

    setCopying(true);
    try {
      const res = await api.semanas.copy(copyFromCarrera, selectedCarrera);
      notify(res.message || `Fechas copiadas exitosamente a ${selectedCarrera}`, "success");
      setCopyModalOpen(false);
      loadSemanas();
    } catch (err) {
      console.error("Error al copiar fechas de semanas:", err);
      notify("Error al duplicar fechas entre carreras", "error");
    } finally {
      setCopying(false);
    }
  };

  // Guardar configuración en Backend
  const handleSave = async () => {
    if (semanas.length === 0) {
      notify("No hay semanas para guardar.", "info");
      return;
    }

    setSaving(true);
    try {
      await api.semanas.saveConfig(semanas, selectedCarrera);
      notify(`Programación de semanas guardada con éxito para ${selectedCarrera}`, "success");
    } catch (err) {
      console.error("Error al guardar semanas:", err);
      notify("Error al guardar la configuración de semanas", "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.75rem", maxWidth: "1280px", margin: "0 auto" }}>
      {/* ======================================================================= */}
      {/* 🧭 ENCABEZADO Y CONTROLES SUPERIORES */}
      {/* ======================================================================= */}
      <div
        className="glass-panel"
        style={{
          background: "linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)",
          borderRadius: "1.25rem",
          border: "1px solid #e2e8f0",
          boxShadow: "0 10px 30px -5px rgba(0, 0, 0, 0.04)",
          padding: "1.5rem 1.75rem",
          display: "flex",
          flexDirection: "column",
          gap: "1.25rem"
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "1rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.85rem" }}>
            <button
              onClick={onClose}
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                width: "40px",
                height: "40px",
                borderRadius: "0.75rem",
                background: "#f1f5f9",
                border: "1px solid #cbd5e1",
                color: "#334155",
                cursor: "pointer",
                transition: "all 0.15s ease"
              }}
              title="Regresar al Dashboard"
            >
              <ArrowLeft size={18} />
            </button>

            <div
              style={{
                width: "44px",
                height: "44px",
                borderRadius: "0.85rem",
                background: "linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)",
                color: "#ffffff",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: "0 6px 16px rgba(99, 102, 241, 0.3)"
              }}
            >
              <CalendarDays size={22} />
            </div>

            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <h1 style={{ fontSize: "1.45rem", fontWeight: 900, color: "#0f172a", margin: 0, letterSpacing: "-0.01em" }}>
                  Definir Semanas por Carrera
                </h1>
                <span
                  style={{
                    background: activeCarrera.bg,
                    color: activeCarrera.color,
                    border: `1px solid ${activeCarrera.border}`,
                    fontSize: "0.74rem",
                    fontWeight: 800,
                    padding: "0.2rem 0.6rem",
                    borderRadius: "9999px",
                    display: "flex",
                    alignItems: "center",
                    gap: "0.3rem"
                  }}
                >
                  <span>{activeCarrera.icon}</span>
                  <span>{selectedCarrera}</span>
                </span>
              </div>
              <p style={{ fontSize: "0.84rem", color: "#64748b", margin: 0 }}>
                {semanas.length > 0
                  ? `Mostrando únicamente las ${semanas.length} semanas con temas creados para ${selectedCarrera}.`
                  : `Configuración de fechas para ${selectedCarrera}.`}
              </p>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", flexWrap: "wrap" }}>
            <button
              onClick={() => setCopyModalOpen(true)}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "0.45rem",
                background: "#ffffff",
                border: "1px solid #cbd5e1",
                color: "#334155",
                padding: "0.55rem 0.95rem",
                borderRadius: "0.75rem",
                fontSize: "0.84rem",
                fontWeight: 700,
                cursor: "pointer",
                boxShadow: "0 2px 4px rgba(0,0,0,0.03)",
                transition: "all 0.15s ease"
              }}
            >
              <Copy size={15} color="#0284c7" />
              <span>Copiar Fechas</span>
            </button>

            {semanas.length > 0 && (
              <button
                onClick={() => setShowAutoGenerator(!showAutoGenerator)}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "0.45rem",
                  background: showAutoGenerator ? "#e0e7ff" : "#ffffff",
                  border: "1px solid #cbd5e1",
                  color: "#4338ca",
                  padding: "0.55rem 1rem",
                  borderRadius: "0.75rem",
                  fontSize: "0.85rem",
                  fontWeight: 700,
                  cursor: "pointer",
                  boxShadow: "0 2px 5px rgba(0,0,0,0.03)",
                  transition: "all 0.15s ease"
                }}
              >
                <Wand2 size={16} color="#6366f1" />
                <span>Autocalcular Fechas</span>
              </button>
            )}

            <button
              onClick={handleSave}
              disabled={saving || loading || semanas.length === 0}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "0.45rem",
                background: "linear-gradient(135deg, #16a34a 0%, #15803d 100%)",
                border: "none",
                color: "#ffffff",
                padding: "0.55rem 1.25rem",
                borderRadius: "0.75rem",
                fontSize: "0.85rem",
                fontWeight: 800,
                cursor: saving || loading || semanas.length === 0 ? "not-allowed" : "pointer",
                boxShadow: "0 4px 12px rgba(22, 163, 74, 0.25)",
                transition: "all 0.15s ease",
                opacity: saving || semanas.length === 0 ? 0.75 : 1
              }}
            >
              <Save size={16} />
              <span>{saving ? "Guardando..." : `Guardar (${selectedCarrera})`}</span>
            </button>
          </div>
        </div>

        {/* =================================================================== */}
        {/* 🩺 SELECTOR DE CARRERAS (PESTAÑAS INDEPENDIENTES) */}
        {/* =================================================================== */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.6rem",
            padding: "0.5rem",
            background: "#f1f5f9",
            borderRadius: "0.85rem",
            overflowX: "auto"
          }}
        >
          {CARRERAS_CONFIG.map((c) => {
            const isSelected = selectedCarrera === c.id;
            return (
              <button
                key={c.id}
                onClick={() => setSelectedCarrera(c.id)}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "0.45rem",
                  padding: "0.5rem 1.1rem",
                  borderRadius: "0.65rem",
                  border: isSelected ? `2px solid ${c.color}` : "1px solid transparent",
                  background: isSelected ? "#ffffff" : "transparent",
                  color: isSelected ? c.color : "#64748b",
                  fontWeight: isSelected ? 800 : 600,
                  fontSize: "0.86rem",
                  cursor: "pointer",
                  boxShadow: isSelected ? "0 4px 10px rgba(0,0,0,0.06)" : "none",
                  transition: "all 0.15s ease",
                  whiteSpace: "nowrap"
                }}
              >
                <span style={{ fontSize: "1.05rem" }}>{c.icon}</span>
                <span>{c.label}</span>
                {isSelected && (
                  <span
                    style={{
                      width: "7px",
                      height: "7px",
                      borderRadius: "50%",
                      background: c.color,
                      display: "inline-block"
                    }}
                  />
                )}
              </button>
            );
          })}
        </div>

        {/* Generador Automático Desplegable */}
        {showAutoGenerator && semanas.length > 0 && (
          <div
            style={{
              background: "#eff6ff",
              border: "1px solid #bfdbfe",
              borderRadius: "0.85rem",
              padding: "1rem 1.25rem",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              flexWrap: "wrap",
              gap: "1rem"
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
              <Sparkles size={18} color="#2563eb" />
              <div>
                <span style={{ fontSize: "0.88rem", fontWeight: 800, color: "#1e3a8a", display: "block" }}>
                  Autollenar las {semanas.length} semanas de {selectedCarrera} a partir de la fecha de inicio
                </span>
                <span style={{ fontSize: "0.78rem", color: "#3b82f6" }}>
                  Ingresa el primer día de clases (Semana {semanas[0]?.numero_semana || 1}) y el sistema programará automáticamente todas las semanas consecutivas (Lunes a Sábado).
                </span>
              </div>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
              <input
                type="date"
                value={autoStartDate}
                onChange={(e) => setAutoStartDate(e.target.value)}
                style={{
                  padding: "0.45rem 0.75rem",
                  borderRadius: "0.6rem",
                  border: "1px solid #93c5fd",
                  background: "#ffffff",
                  fontSize: "0.85rem",
                  fontWeight: 600,
                  color: "#1e293b",
                  outline: "none"
                }}
              />
              <button
                onClick={handleApplyAutoDates}
                style={{
                  background: "#2563eb",
                  color: "#ffffff",
                  border: "none",
                  padding: "0.48rem 1rem",
                  borderRadius: "0.6rem",
                  fontSize: "0.82rem",
                  fontWeight: 800,
                  cursor: "pointer",
                  boxShadow: "0 2px 6px rgba(37, 99, 235, 0.25)"
                }}
              >
                Aplicar a {selectedCarrera}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ======================================================================= */}
      {/* 📅 CONTENEDOR PRINCIPAL: GRUPOS POR PARCIAL O ESTADO VACÍO */}
      {/* ======================================================================= */}
      {loading ? (
        <div style={{ padding: "4rem", textAlign: "center", color: "#64748b" }}>
          <Clock size={32} style={{ animation: "spin 1.5s linear infinite", margin: "0 auto 1rem", color: activeCarrera.color }} />
          <p style={{ fontWeight: 700 }}>Cargando programación de semanas para {selectedCarrera}...</p>
        </div>
      ) : semanas.length === 0 ? (
        /* Estado cuando la carrera no tiene temas registrados en temario */
        <div
          className="glass-panel"
          style={{
            background: "#ffffff",
            borderRadius: "1.25rem",
            border: "1px dashed #cbd5e1",
            padding: "3.5rem 2rem",
            textAlign: "center",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "0.75rem"
          }}
        >
          <span style={{ fontSize: "3rem" }}>{activeCarrera.icon}</span>
          <h2 style={{ fontSize: "1.25rem", fontWeight: 800, color: "#0f172a", margin: 0 }}>
            No hay temas registrados en el temario de {selectedCarrera}
          </h2>
          <p style={{ fontSize: "0.88rem", color: "#64748b", maxWidth: "500px", margin: "0 0 1rem", lineHeight: 1.45 }}>
            Para definir las semanas y fechas de <strong>{selectedCarrera}</strong>, primero debes registrar sus temas en el módulo <strong>"Administrar Temario"</strong>.
          </p>
          <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", justifyContent: "center" }}>
            <button
              onClick={onClose}
              style={{
                background: activeCarrera.color,
                color: "#ffffff",
                border: "none",
                padding: "0.6rem 1.25rem",
                borderRadius: "0.75rem",
                fontSize: "0.86rem",
                fontWeight: 700,
                cursor: "pointer",
                boxShadow: "0 4px 12px rgba(0,0,0,0.1)"
              }}
            >
              Ir a Administrar Temario
            </button>
          </div>
        </div>
      ) : (
        /* Renderizar únicamente los parciales y semanas que tienen temas creados para esta carrera */
        <div style={{ display: "flex", flexDirection: "column", gap: "2rem" }}>
          {PARCIALES_META.map((parcialMeta) => {
            const semanasDelParcial = semanas.filter((s) =>
              parcialMeta.semanas.includes(Number(s.numero_semana))
            );

            if (semanasDelParcial.length === 0) return null;

            return (
              <div key={parcialMeta.id} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                {/* Título de Sección del Parcial */}
                <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
                  <div
                    style={{
                      width: "10px",
                      height: "22px",
                      borderRadius: "4px",
                      background: parcialMeta.color
                    }}
                  />
                  <h2 style={{ fontSize: "1.15rem", fontWeight: 800, color: "#0f172a", margin: 0 }}>
                    {parcialMeta.label}
                  </h2>
                  <span
                    style={{
                      fontSize: "0.75rem",
                      fontWeight: 700,
                      color: parcialMeta.color,
                      background: parcialMeta.bg,
                      border: `1px solid ${parcialMeta.border}`,
                      padding: "0.15rem 0.6rem",
                      borderRadius: "9999px"
                    }}
                  >
                    {semanasDelParcial.length} {semanasDelParcial.length === 1 ? "Semana" : "Semanas"} ({semanasDelParcial.map((s) => `S${s.numero_semana}`).join(", ")})
                  </span>
                </div>

                {/* Grid de Semanas */}
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
                    gap: "1.25rem"
                  }}
                >
                  {semanasDelParcial.map((sem) => {
                    const isActual = sem.es_semana_actual;
                    return (
                      <div
                        key={sem.numero_semana}
                        className="glass-panel"
                        style={{
                          background: isActual ? "#f0fdf4" : "#ffffff",
                          border: isActual ? "2px solid #86efac" : "1px solid #e2e8f0",
                          borderRadius: "1rem",
                          padding: "1.25rem",
                          boxShadow: isActual
                            ? "0 10px 25px -5px rgba(22, 163, 74, 0.15)"
                            : "0 4px 15px rgba(0, 0, 0, 0.03)",
                          display: "flex",
                          flexDirection: "column",
                          justifyContent: "space-between",
                          gap: "1rem",
                          position: "relative",
                          transition: "all 0.15s ease"
                        }}
                      >
                        {/* Cabecera de la Tarjeta */}
                        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "0.5rem" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                            <div
                              style={{
                                width: "32px",
                                height: "32px",
                                borderRadius: "0.6rem",
                                background: isActual ? "#15803d" : "#0f172a",
                                color: "#ffffff",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                fontSize: "0.85rem",
                                fontWeight: 900
                              }}
                            >
                              S{sem.numero_semana}
                            </div>
                            <div>
                              <span style={{ fontSize: "0.95rem", fontWeight: 800, color: "#0f172a", display: "block" }}>
                                Semana {sem.numero_semana}
                              </span>
                              <span style={{ fontSize: "0.72rem", color: "#64748b", fontWeight: 600 }}>
                                {sem.parcial}
                              </span>
                            </div>
                          </div>

                          <button
                            onClick={() => handleSetSemanaActual(sem.numero_semana)}
                            style={{
                              border: isActual ? "1px solid #86efac" : "1px solid #cbd5e1",
                              background: isActual ? "#dcfce7" : "#f8fafc",
                              color: isActual ? "#15803d" : "#64748b",
                              fontSize: "0.7rem",
                              fontWeight: 800,
                              padding: "0.2rem 0.55rem",
                              borderRadius: "9999px",
                              cursor: "pointer",
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "0.25rem",
                              transition: "all 0.15s ease"
                            }}
                            title="Marcar como la semana académica en curso"
                          >
                            {isActual ? (
                              <>
                                <CheckCircle2 size={12} color="#15803d" />
                                <span>Semana Actual</span>
                              </>
                            ) : (
                              <span>Establecer Actual</span>
                            )}
                          </button>
                        </div>

                        {/* Temas Académicos Oficiales CREADOS para esta Carrera */}
                        <div
                          style={{
                            background: isActual ? "#ffffff" : "#f8fafc",
                            border: "1px solid #e2e8f0",
                            borderRadius: "0.65rem",
                            padding: "0.6rem 0.75rem"
                          }}
                        >
                          <div style={{ display: "flex", alignItems: "center", gap: "0.35rem", marginBottom: "0.25rem" }}>
                            <BookOpen size={12} color="#64748b" />
                            <span style={{ fontSize: "0.7rem", fontWeight: 800, color: "#64748b", textTransform: "uppercase" }}>
                              Temas en {selectedCarrera}
                            </span>
                          </div>
                          <span style={{ fontSize: "0.82rem", fontWeight: 700, color: "#1e293b", lineHeight: 1.35, display: "block" }}>
                            {sem.temas}
                          </span>
                        </div>

                        {/* Rango de Fechas: Desde / Hasta */}
                        <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
                          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem" }}>
                            {/* Fecha Inicio */}
                            <div style={{ display: "flex", flexDirection: "column", gap: "0.2rem" }}>
                              <label style={{ fontSize: "0.72rem", fontWeight: 700, color: "#475569" }}>
                                Fecha Inicio:
                              </label>
                              <input
                                type="date"
                                value={sem.fecha_inicio || ""}
                                onChange={(e) => handleDateChange(sem.numero_semana, "fecha_inicio", e.target.value)}
                                style={{
                                  padding: "0.4rem 0.5rem",
                                  borderRadius: "0.5rem",
                                  border: "1px solid #cbd5e1",
                                  fontSize: "0.78rem",
                                  fontWeight: 600,
                                  color: "#0f172a",
                                  background: "#ffffff",
                                  outline: "none"
                                }}
                              />
                            </div>

                            {/* Fecha Fin */}
                            <div style={{ display: "flex", flexDirection: "column", gap: "0.2rem" }}>
                              <label style={{ fontSize: "0.72rem", fontWeight: 700, color: "#475569" }}>
                                Fecha Fin:
                              </label>
                              <input
                                type="date"
                                value={sem.fecha_fin || ""}
                                onChange={(e) => handleDateChange(sem.numero_semana, "fecha_fin", e.target.value)}
                                style={{
                                  padding: "0.4rem 0.5rem",
                                  borderRadius: "0.5rem",
                                  border: "1px solid #cbd5e1",
                                  fontSize: "0.78rem",
                                  fontWeight: 600,
                                  color: "#0f172a",
                                  background: "#ffffff",
                                  outline: "none"
                                }}
                              />
                            </div>
                          </div>

                          {/* Notas / Descripción Opcional */}
                          <input
                            type="text"
                            placeholder="Descripción opcional (Ej. I Examen)"
                            value={sem.descripcion || ""}
                            onChange={(e) => handleDateChange(sem.numero_semana, "descripcion", e.target.value)}
                            style={{
                              padding: "0.35rem 0.6rem",
                              borderRadius: "0.5rem",
                              border: "1px solid #e2e8f0",
                              fontSize: "0.74rem",
                              color: "#64748b",
                              background: isActual ? "#ffffff" : "#f8fafc",
                              outline: "none"
                            }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal de Copia de Fechas entre Carreras */}
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
                  Copiar Fechas de Semanas a {selectedCarrera}
                </h3>
                <span style={{ fontSize: "0.78rem", color: "#64748b" }}>
                  Duplica las fechas de inicio y fin de otra carrera hacia {selectedCarrera}.
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
    </div>
  );
}
