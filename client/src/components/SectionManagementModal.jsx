import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import {
  X,
  PlusCircle,
  Edit3,
  Trash2,
  Layers,
  Clock,
  Calendar,
  User,
  Users,
  Building2,
  AlertTriangle,
  BookOpen
} from "lucide-react";
import { api } from "../services/api";

const DIAS_SEMANA = [
  "Lunes",
  "Martes",
  "Miércoles",
  "Jueves",
  "Viernes",
  "Sábado",
  "Domingo"
];

const HORAS_CLASE = [
  "07:00",
  "08:00",
  "09:00",
  "10:00",
  "11:00",
  "12:00",
  "13:00",
  "14:00",
  "15:00",
  "16:00",
  "17:00"
];

// Conversor de hora HH:MM a minutos transcurridos desde medianoche
const timeToMinutes = (timeStr) => {
  if (!timeStr) return 0;
  const [h, m] = timeStr.split(":").map((v) => parseInt(v, 10) || 0);
  return h * 60 + (m || 0);
};

// Detector de traslape entre 2 intervalos de tiempo [startA, endA) y [startB, endB)
const isTimeOverlap = (startA, endA, startB, endB) => {
  const minStartA = timeToMinutes(startA);
  let minEndA = timeToMinutes(endA);
  if (minEndA <= minStartA) minEndA = minStartA + 120; // 2 horas por defecto

  const minStartB = timeToMinutes(startB);
  let minEndB = timeToMinutes(endB);
  if (minEndB <= minStartB) minEndB = minStartB + 120;

  return minStartA < minEndB && minEndA > minStartB;
};

// Generador de código según la convención solicitada (Día abreviado + Hora 24h a 4 dígitos)
const generateSectionCode = (dia = "Lunes", horaInicio = "13:00") => {
  const diaMap = {
    lunes: "LU",
    martes: "MA",
    miercoles: "MI",
    miércoles: "MI",
    jueves: "JUE",
    viernes: "VIE",
    sabado: "SAB",
    sábado: "SAB",
    domingo: "DO"
  };

  const normalizedDay = (dia || "Lunes").toLowerCase().trim();
  const dayPrefix = diaMap[normalizedDay] || "SEC";

  let hourStr = "13";
  let minStr = "00";

  if (horaInicio && horaInicio.includes(":")) {
    const parts = horaInicio.split(":");
    hourStr = (parts[0] || "00").trim().padStart(2, "0");
    minStr = (parts[1] || "00").trim().slice(0, 2).padStart(2, "0");
  } else if (horaInicio) {
    const digits = horaInicio.replace(/\D/g, "");
    if (digits.length >= 4) {
      hourStr = digits.slice(0, 2);
      minStr = digits.slice(2, 4);
    } else if (digits.length >= 1) {
      hourStr = digits.slice(0, 2).padStart(2, "0");
      minStr = "00";
    }
  }

  return `${dayPrefix}${hourStr}${minStr}`;
};

const CARRERAS_DISPONIBLES = [
  "MEDICINA",
  "ENFERMERIA",
  "ODONTOLOGIA",
  "MICROBIOLOGIA",
  "NUTRICION"
];

const emptyForm = {
  codigo: "",
  nombre: "",
  carrera: "",
  dia: "",
  hora_inicio: "",
  hora_fin: "",
  doctor_encargado: "",
  coordinador: "",
  periodo_academico: "",
  activa: true
};

export default function SectionManagementModal({
  mode = "create", // 'create' | 'edit' | 'delete'
  sections = [],
  selectedSection = null,
  instructors = [],
  onClose,
  onSuccess,
  notify
}) {
  const [loading, setLoading] = useState(false);
  const [targetId, setTargetId] = useState(selectedSection?.id || "");
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [inlineError, setInlineError] = useState("");

  const [formData, setFormData] = useState(emptyForm);

  const resetForm = () => {
    setFormData(emptyForm);
    setDeleteConfirmText("");
    setInlineError("");
  };

  useEffect(() => {
    setInlineError("");
    if (mode === "create") {
      resetForm();
      setTargetId("");
    } else if (selectedSection) {
      setTargetId(selectedSection.id);
      loadSectionToForm(selectedSection);
    } else {
      setTargetId("");
      resetForm();
    }
  }, [mode, selectedSection]);

  const loadSectionToForm = (sec) => {
    if (!sec) return;
    setFormData({
      codigo: sec.codigo || "",
      nombre: sec.nombre || "",
      carrera: sec.carrera || "",
      dia: sec.dia || "",
      hora_inicio: sec.hora_inicio || "",
      hora_fin: sec.hora_fin || "",
      doctor_encargado: sec.doctor_encargado || "",
      coordinador: sec.coordinador || "",
      periodo_academico: sec.periodo_academico || "",
      activa: sec.activa !== undefined ? sec.activa : true
    });
  };

  const handleDiaChange = (newDia) => {
    const newCode = newDia && formData.hora_inicio ? generateSectionCode(newDia, formData.hora_inicio) : formData.codigo;
    setFormData((prev) => ({
      ...prev,
      dia: newDia,
      codigo: newCode,
      nombre: newCode ? `Laboratorio de Histología - Sección ${newCode}` : prev.nombre
    }));
  };

  const handleHoraInicioChange = (newHora) => {
    let suggestedEnd = "";
    if (newHora && newHora.includes(":")) {
      const h = parseInt(newHora.split(":")[0], 10);
      const m = newHora.split(":")[1];
      const endH = (h + 2) % 24;
      suggestedEnd = `${String(endH).padStart(2, "0")}:${m}`;
    }

    const newCode = formData.dia && newHora ? generateSectionCode(formData.dia, newHora) : formData.codigo;
    setFormData((prev) => ({
      ...prev,
      hora_inicio: newHora,
      hora_fin: suggestedEnd || prev.hora_fin,
      codigo: newCode,
      nombre: newCode ? `Laboratorio de Histología - Sección ${newCode}` : prev.nombre
    }));
  };

  const handleSelectSection = (id) => {
    setTargetId(id);
    if (!id) {
      resetForm();
      return;
    }
    const found = sections.find((s) => s.id === id);
    if (found) {
      loadSectionToForm(found);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setInlineError("");
    setLoading(true);

    try {
      if (mode === "create" || mode === "edit") {
        if (!formData.carrera) {
          throw new Error("Por favor selecciona la Carrera para la sección.");
        }
        if (!formData.dia || !formData.hora_inicio) {
          throw new Error("Por favor completa el Día y la Hora de inicio de la sección.");
        }

        // 🛡️ REGLA: Máximo 4 secciones por día para la carrera de MEDICINA
        const targetSectionId = mode === "edit" ? targetId : null;
        if (formData.carrera.toUpperCase() === "MEDICINA") {
          const medDayCount = sections.filter(
            (s) =>
              s.id !== targetSectionId &&
              (s.carrera || "").toUpperCase() === "MEDICINA" &&
              (s.dia || "").toLowerCase() === formData.dia.toLowerCase() &&
              (!formData.periodo_academico || !s.periodo_academico || s.periodo_academico === formData.periodo_academico)
          ).length;

          if (medDayCount >= 4) {
            throw new Error(`Límite diario alcanzado: En la carrera de MEDICINA solo se permite un máximo de 4 secciones por día (${formData.dia}).`);
          }
        }

        // 🛡️ Verificar traslape de horario en la misma carrera el mismo día
        const collision = sections.find(
          (s) =>
            s.id !== targetSectionId &&
            (s.carrera || "").trim().toUpperCase() === formData.carrera.trim().toUpperCase() &&
            (s.dia || "").trim().toLowerCase() === formData.dia.trim().toLowerCase() &&
            (!formData.periodo_academico || !s.periodo_academico || s.periodo_academico === formData.periodo_academico) &&
            isTimeOverlap(formData.hora_inicio, formData.hora_fin, s.hora_inicio, s.hora_fin)
        );

        if (collision) {
          const finDisplay = collision.hora_fin ? ` a ${collision.hora_fin}` : "";
          throw new Error(
            `Traslape de horario detectado: La sección choca con la Sección ${collision.codigo} (${collision.dia} de ${collision.hora_inicio}${finDisplay}) para la carrera de ${formData.carrera}. No se permiten traslapes de horario en la misma carrera.`
          );
        }
      }

      if (mode === "create") {
        const res = await api.secciones.create(formData);
        notify(res.message || "Sección creada exitosamente.", "success");
        onSuccess && onSuccess();
        onClose();
      } else if (mode === "edit") {
        if (!targetId) {
          throw new Error("Por favor selecciona una sección de la lista para editar.");
        }

        const res = await api.secciones.update(targetId, formData);
        notify(res.message || "Sección actualizada exitosamente.", "success");
        onSuccess && onSuccess();
        onClose();
      } else if (mode === "delete") {
        if (!targetId) {
          throw new Error("Por favor selecciona una sección de la lista para eliminar.");
        }

        const selectedSec = sections.find((s) => s.id === targetId);
        const expectedConfirm = selectedSec?.codigo || "ELIMINAR";
        if (deleteConfirmText.trim() !== expectedConfirm.trim()) {
          throw new Error(`Para confirmar, debes escribir el código de la sección: ${expectedConfirm}`);
        }

        const res = await api.secciones.delete(targetId);
        notify(res.message || "Sección eliminada exitosamente.", "success");
        onSuccess && onSuccess();
        onClose();
      }
    } catch (err) {
      const errorText = err.message || "Ocurrió un error al procesar la sección.";
      setInlineError(errorText);
      notify(errorText, "error");
    } finally {
      setLoading(false);
    }
  };

  const selectedSecObj = sections.find((s) => s.id === targetId);

  const inputStyle = {
    width: "100%",
    boxSizing: "border-box",
    padding: "0.65rem 0.85rem",
    borderRadius: "0.55rem",
    border: "1px solid #cbd5e1",
    fontSize: "0.88rem",
    color: "#0f172a",
    background: "#ffffff",
    outline: "none"
  };

  const labelStyle = {
    display: "block",
    fontSize: "0.8rem",
    fontWeight: 700,
    color: "#334155",
    marginBottom: "0.35rem"
  };

  return createPortal(
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        width: "100vw",
        height: "100vh",
        backgroundColor: "rgba(15, 23, 42, 0.7)",
        backdropFilter: "blur(8px)",
        WebkitBackdropFilter: "blur(8px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 999999,
        padding: "1rem",
        boxSizing: "border-box"
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          background: "#ffffff",
          borderRadius: "1.25rem",
          width: "100%",
          maxWidth: "700px",
          maxHeight: "88vh",
          display: "flex",
          flexDirection: "column",
          boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.35)",
          border: "1px solid #e2e8f0",
          overflow: "hidden",
          position: "relative",
          zIndex: 1000000
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Encabezado del Modal */}
        <div
          style={{
            padding: "1.2rem 1.5rem",
            borderBottom: "1px solid #e2e8f0",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            background:
              mode === "create"
                ? "linear-gradient(135deg, #f0fdfa 0%, #ffffff 100%)"
                : mode === "edit"
                ? "linear-gradient(135deg, #fffbeb 0%, #ffffff 100%)"
                : "linear-gradient(135deg, #fff1f2 0%, #ffffff 100%)",
            flexShrink: 0
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
            <div
              style={{
                width: "42px",
                height: "42px",
                borderRadius: "0.75rem",
                background:
                  mode === "create"
                    ? "#ccfbf1"
                    : mode === "edit"
                    ? "#fef3c7"
                    : "#fee2e2",
                color:
                  mode === "create"
                    ? "#0f766e"
                    : mode === "edit"
                    ? "#d97706"
                    : "#dc2626",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0
              }}
            >
              {mode === "create" && <PlusCircle size={22} />}
              {mode === "edit" && <Edit3 size={22} />}
              {mode === "delete" && <Trash2 size={22} />}
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: "1.2rem", fontWeight: 800, color: "#0f172a" }}>
                {mode === "create" && "Crear Nueva Sección"}
                {mode === "edit" && "Editar Sección"}
                {mode === "delete" && "Eliminar Sección"}
              </h2>
              <span style={{ fontSize: "0.8rem", color: "#64748b" }}>
                {mode === "create" && "Registrar una nueva sección de laboratorio con horarios y cupos"}
                {mode === "edit" && "Modificar horarios, aula, cupos o docentes encargados"}
                {mode === "delete" && "Dar de baja y eliminar una sección del sistema"}
              </span>
            </div>
          </div>

          <button
            onClick={onClose}
            style={{
              background: "#f1f5f9",
              border: "none",
              borderRadius: "50%",
              width: "34px",
              height: "34px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              color: "#64748b",
              transition: "all 0.15s ease",
              flexShrink: 0
            }}
            title="Cerrar ventana"
          >
            <X size={18} />
          </button>
        </div>

        {/* Cuerpo del Formulario con Scroll interno */}
        <div style={{ flex: 1, overflowY: "auto", padding: "1.5rem" }}>
          <form id="section-mgmt-form" onSubmit={handleSubmit} autoComplete="off" style={{ display: "flex", flexDirection: "column", gap: "1.1rem" }}>
            {/* Banner de error interactivo en el formulario */}
            {inlineError && (
              <div
                style={{
                  background: "#fff1f2",
                  border: "1px solid #fecdd3",
                  borderRadius: "0.65rem",
                  padding: "0.85rem 1rem",
                  display: "flex",
                  alignItems: "flex-start",
                  gap: "0.65rem",
                  color: "#9f1239",
                  fontSize: "0.86rem",
                  fontWeight: 600,
                  lineHeight: 1.45,
                  boxShadow: "0 2px 4px rgba(225, 29, 72, 0.06)"
                }}
              >
                <AlertTriangle size={20} color="#e11d48" style={{ flexShrink: 0, marginTop: "2px" }} />
                <span style={{ flex: 1 }}>{inlineError}</span>
                <button
                  type="button"
                  onClick={() => setInlineError("")}
                  style={{
                    background: "transparent",
                    border: "none",
                    cursor: "pointer",
                    color: "#9f1239",
                    padding: "0 0.2rem",
                    display: "flex",
                    alignItems: "center"
                  }}
                  title="Cerrar aviso"
                >
                  <X size={16} />
                </button>
              </div>
            )}

            {/* Selector de Sección (Para Editar o Borrar) */}
            {(mode === "edit" || mode === "delete") && (
              <div
                style={{
                  background: mode === "delete" ? "#fff1f2" : "#f0fdfa",
                  border: `1px solid ${mode === "delete" ? "#fecdd3" : "#99f6e4"}`,
                  borderRadius: "0.75rem",
                  padding: "1rem"
                }}
              >
                <label style={{ display: "block", fontSize: "0.82rem", fontWeight: 700, color: mode === "delete" ? "#9f1239" : "#0f766e", marginBottom: "0.4rem" }}>
                  Seleccionar Sección a {mode === "edit" ? "Modificar" : "Eliminar"}:
                </label>
                <select
                  value={targetId}
                  onChange={(e) => handleSelectSection(e.target.value)}
                  style={{
                    width: "100%",
                    boxSizing: "border-box",
                    padding: "0.65rem 0.85rem",
                    borderRadius: "0.5rem",
                    border: "1px solid #cbd5e1",
                    background: "#ffffff",
                    fontSize: "0.9rem",
                    color: "#0f172a",
                    fontWeight: 600,
                    outline: "none"
                  }}
                >
                  <option value="">
                    {mode === "edit" ? "-- Selecciona una sección a editar --" : "-- Selecciona una sección a eliminar --"}
                  </option>
                  {sections.map((sec) => (
                    <option key={sec.id} value={sec.id}>
                      {`Sección ${sec.codigo || 'S/C'} • ${sec.dia} ${sec.hora_inicio} (${sec.nombre || 'Laboratorio'})`}
                    </option>
                  ))}
                </select>

                {mode === "edit" && targetId && (
                  <div style={{ marginTop: "0.5rem", fontSize: "0.76rem", color: "#0f766e", display: "flex", alignItems: "center", gap: "0.4rem" }}>
                    <span style={{ fontWeight: 700 }}>ID Permanente:</span>
                    <code style={{ background: "#ffffff", padding: "0.15rem 0.4rem", borderRadius: "4px", border: "1px solid #99f6e4", fontFamily: "monospace" }}>
                      {targetId}
                    </code>
                    <span style={{ color: "#64748b" }}>(Inmutable, se preserva en el sistema)</span>
                  </div>
                )}
              </div>
            )}

            {/* MODO EDITAR SIN SELECCIÓN PREVIA */}
            {mode === "edit" && !targetId && (
              <div
                style={{
                  background: "#f8fafc",
                  border: "1px dashed #cbd5e1",
                  borderRadius: "0.75rem",
                  padding: "2.5rem 1.5rem",
                  textAlign: "center",
                  color: "#64748b"
                }}
              >
                <Edit3 size={32} color="#94a3b8" style={{ marginBottom: "0.5rem" }} />
                <p style={{ margin: "0 0 0.25rem", fontSize: "0.95rem", fontWeight: 700, color: "#334155" }}>
                  Ninguna sección seleccionada para editar
                </p>
                <span style={{ fontSize: "0.82rem", color: "#64748b" }}>
                  Por favor selecciona una sección en el menú desplegable superior para cargar y modificar sus datos.
                </span>
              </div>
            )}

            {/* MODO CREAR O MODO EDITAR CON SECCIÓN SELECCIONADA */}
            {(mode === "create" || (mode === "edit" && targetId)) && (
              <>
                {/* Código de Sección y Nombre */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: "1rem" }}>
                  <div>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.35rem" }}>
                      <label style={{ ...labelStyle, marginBottom: 0 }}>
                        Código de Sección
                      </label>
                      <span style={{ fontSize: "0.72rem", color: "#0f766e", fontWeight: 700, background: "#ccfbf1", padding: "0.15rem 0.45rem", borderRadius: "4px" }}>
                        Automático
                      </span>
                    </div>
                    <input
                      type="text"
                      name="sec_codigo"
                      readOnly
                      tabIndex={-1}
                      placeholder="Se generará automáticamente"
                      value={formData.codigo}
                      style={{
                        ...inputStyle,
                        fontWeight: 800,
                        letterSpacing: "0.03em",
                        color: "#0f766e",
                        background: "#f8fafc",
                        borderColor: "#cbd5e1",
                        cursor: "not-allowed",
                        userSelect: "none"
                      }}
                      title="Este código es generado automáticamente a partir del día y la hora de inicio"
                    />
                  </div>
                  <div>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.35rem" }}>
                      <label style={{ ...labelStyle, marginBottom: 0 }}>
                        Nombre Descriptivo
                      </label>
                      <span style={{ fontSize: "0.72rem", color: "#64748b", fontWeight: 700, background: "#f1f5f9", padding: "0.15rem 0.45rem", borderRadius: "4px" }}>
                        Automático
                      </span>
                    </div>
                    <input
                      type="text"
                      name="sec_nombre"
                      readOnly
                      tabIndex={-1}
                      placeholder="Se generará automáticamente"
                      value={formData.nombre}
                      style={{
                        ...inputStyle,
                        color: "#334155",
                        fontWeight: 600,
                        background: "#f8fafc",
                        borderColor: "#cbd5e1",
                        cursor: "not-allowed",
                        userSelect: "none"
                      }}
                      title="Este nombre se genera automáticamente con el código de la sección"
                    />
                  </div>
                </div>

                {/* Día, Hora Inicio y Hora Fin */}
                <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr 1fr", gap: "1rem" }}>
                  <div>
                    <label style={labelStyle}>
                      Día de la Sección <span style={{ color: "#e11d48" }}>*</span>
                    </label>
                    <select
                      value={formData.dia}
                      onChange={(e) => handleDiaChange(e.target.value)}
                      style={inputStyle}
                    >
                      <option value="">-- Selecciona el día --</option>
                      {DIAS_SEMANA.map((dia) => (
                        <option key={dia} value={dia}>{dia}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label style={labelStyle}>
                      Hora de Inicio (24h) <span style={{ color: "#e11d48" }}>*</span>
                    </label>
                    <select
                      required
                      name="sec_hora_inicio"
                      value={formData.hora_inicio}
                      onChange={(e) => handleHoraInicioChange(e.target.value)}
                      style={inputStyle}
                    >
                      <option value="">-- Hora de Inicio --</option>
                      {HORAS_CLASE.map((hora) => (
                        <option key={hora} value={hora}>{hora}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label style={labelStyle}>
                      Hora de Fin
                    </label>
                    <select
                      name="sec_hora_fin"
                      value={formData.hora_fin}
                      onChange={(e) => setFormData({ ...formData, hora_fin: e.target.value })}
                      style={inputStyle}
                    >
                      <option value="">-- Hora de Fin --</option>
                      {HORAS_CLASE.map((hora) => (
                        <option key={hora} value={hora}>{hora}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Doctor Encargado y Coordinador Asignado */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                  <div>
                    <label style={labelStyle}>
                      Doctor(a) Encargado(a) de Cátedra
                    </label>
                    <input
                      type="text"
                      name="sec_doctor"
                      placeholder="Ej. Dr. Rafael Perdomo Vaquero"
                      value={formData.doctor_encargado}
                      onChange={(e) => setFormData({ ...formData, doctor_encargado: e.target.value })}
                      style={inputStyle}
                    />
                  </div>

                  <div>
                    <label style={labelStyle}>
                      Coordinador(a) Asignado(a)
                    </label>
                    <select
                      value={formData.coordinador}
                      onChange={(e) => setFormData({ ...formData, coordinador: e.target.value })}
                      style={inputStyle}
                    >
                      <option value="">-- Sin coordinador específico --</option>
                      {instructors.map((inst) => {
                        const name = `${inst.primer_nombre || ''} ${inst.primer_apellido || ''}`.trim() || inst.nombre_completo || "Instructor";
                        return (
                          <option key={inst.id} value={name}>
                            {name}
                          </option>
                        );
                      })}
                    </select>
                  </div>
                </div>

                {/* Carrera y Periodo Académico */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                  <div>
                    <label style={labelStyle}>
                      Carrera <span style={{ color: "#e11d48" }}>*</span>
                    </label>
                    <select
                      value={formData.carrera}
                      onChange={(e) => setFormData({ ...formData, carrera: e.target.value })}
                      style={inputStyle}
                    >
                      <option value="">-- Selecciona la Carrera --</option>
                      {CARRERAS_DISPONIBLES.map((car) => (
                        <option key={car} value={car}>{car}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label style={labelStyle}>
                      Periodo Académico
                    </label>
                    <select
                      value={formData.periodo_academico}
                      onChange={(e) => setFormData({ ...formData, periodo_academico: e.target.value })}
                      style={inputStyle}
                    >
                      <option value="">-- Selecciona el Periodo --</option>
                      <option value={`I PAC ${new Date().getFullYear()}`}>{`I PAC ${new Date().getFullYear()}`}</option>
                      <option value={`II PAC ${new Date().getFullYear()}`}>{`II PAC ${new Date().getFullYear()}`}</option>
                    </select>
                  </div>
                </div>

                {/* Estado Activo */}
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginTop: "0.2rem" }}>
                  <input
                    type="checkbox"
                    id="sec-activa-check"
                    checked={formData.activa}
                    onChange={(e) => setFormData({ ...formData, activa: e.target.checked })}
                    style={{ width: "17px", height: "17px", accentColor: "#0d9488", cursor: "pointer" }}
                  />
                  <label htmlFor="sec-activa-check" style={{ fontSize: "0.85rem", fontWeight: 600, color: "#334155", cursor: "pointer" }}>
                    Sección Activa (Visible y disponible para calificación de estudiantes)
                  </label>
                </div>
              </>
            )}

            {/* MODO BORRAR */}
            {mode === "delete" && !selectedSecObj && (
              <div
                style={{
                  background: "#f8fafc",
                  border: "1px dashed #cbd5e1",
                  borderRadius: "0.75rem",
                  padding: "2.5rem 1.5rem",
                  textAlign: "center",
                  color: "#64748b"
                }}
              >
                <Trash2 size={32} color="#94a3b8" style={{ marginBottom: "0.5rem" }} />
                <p style={{ margin: "0 0 0.25rem", fontSize: "0.95rem", fontWeight: 700, color: "#334155" }}>
                  Ninguna sección seleccionada
                </p>
                <span style={{ fontSize: "0.82rem", color: "#64748b" }}>
                  Por favor selecciona una sección en el menú desplegable superior para revisar sus datos y confirmar la eliminación.
                </span>
              </div>
            )}

            {mode === "delete" && selectedSecObj && (
              <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                <div
                  style={{
                    background: "#fff1f2",
                    border: "1px solid #fecdd3",
                    borderRadius: "0.75rem",
                    padding: "1rem",
                    display: "flex",
                    alignItems: "flex-start",
                    gap: "0.75rem"
                  }}
                >
                  <AlertTriangle size={24} color="#e11d48" style={{ flexShrink: 0, marginTop: "2px" }} />
                  <div>
                    <strong style={{ color: "#9f1239", fontSize: "0.95rem", display: "block" }}>
                      ¿Estás seguro de eliminar esta sección?
                    </strong>
                    <p style={{ margin: "0.25rem 0 0", color: "#be123c", fontSize: "0.83rem", lineHeight: 1.4 }}>
                      Esta acción es irreversible. Se eliminará la sección y se desvinculará de las listas de asistencia y calificaciones.
                    </p>
                  </div>
                </div>

                {/* Ficha Resumen de la Sección a Borrar */}
                <div
                  style={{
                    background: "#f8fafc",
                    border: "1px solid #e2e8f0",
                    borderRadius: "0.75rem",
                    padding: "1rem"
                  }}
                >
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem", fontSize: "0.85rem" }}>
                    <div>
                      <span style={{ color: "#64748b", display: "block", fontSize: "0.75rem" }}>Código de Sección</span>
                      <strong>{selectedSecObj.codigo}</strong>
                    </div>
                    <div>
                      <span style={{ color: "#64748b", display: "block", fontSize: "0.75rem" }}>Día y Horario</span>
                      <strong>{selectedSecObj.dia} ({selectedSecObj.hora_inicio} - {selectedSecObj.hora_fin || '—'})</strong>
                    </div>
                    <div>
                      <span style={{ color: "#64748b", display: "block", fontSize: "0.75rem" }}>Doctor Encargado</span>
                      <span>{selectedSecObj.doctor_encargado}</span>
                    </div>
                    <div>
                      <span style={{ color: "#64748b", display: "block", fontSize: "0.75rem" }}>Coordinador Asignado</span>
                      <span style={{ color: "#0f766e", fontWeight: 700 }}>
                        {selectedSecObj.coordinador || "No asignado"}
                      </span>
                    </div>
                  </div>
                </div>

                <div>
                  <label style={{ display: "block", fontSize: "0.82rem", fontWeight: 700, color: "#9f1239", marginBottom: "0.4rem" }}>
                    Escribe el código de la sección ({selectedSecObj.codigo}) para confirmar la eliminación:
                  </label>
                  <input
                    type="text"
                    required
                    placeholder={`Escribe ${selectedSecObj.codigo}`}
                    value={deleteConfirmText}
                    onChange={(e) => setDeleteConfirmText(e.target.value)}
                    style={{
                      ...inputStyle,
                      border: "2px solid #fda4af",
                      fontSize: "0.92rem",
                      fontWeight: 600
                    }}
                  />
                </div>
              </div>
            )}
          </form>
        </div>

        {/* Footer fijo del Modal */}
        <div
          style={{
            padding: "1rem 1.5rem",
            borderTop: "1px solid #e2e8f0",
            display: "flex",
            alignItems: "center",
            justifyContent: "flex-end",
            gap: "0.75rem",
            background: "#f8fafc",
            flexShrink: 0
          }}
        >
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            style={{
              padding: "0.6rem 1.1rem",
              borderRadius: "0.6rem",
              border: "1px solid #cbd5e1",
              background: "#ffffff",
              color: "#475569",
              fontSize: "0.88rem",
              fontWeight: 600,
              cursor: "pointer"
            }}
          >
            Cancelar
          </button>

          <button
            type="submit"
            form="section-mgmt-form"
            disabled={loading}
            style={{
              padding: "0.6rem 1.4rem",
              borderRadius: "0.6rem",
              border: "none",
              fontSize: "0.88rem",
              fontWeight: 700,
              cursor: loading ? "not-allowed" : "pointer",
              display: "inline-flex",
              alignItems: "center",
              gap: "0.45rem",
              color: "#ffffff",
              background:
                mode === "create"
                  ? "linear-gradient(135deg, #0d9488 0%, #0f766e 100%)"
                  : mode === "edit"
                  ? "linear-gradient(135deg, #d97706 0%, #b45309 100%)"
                  : "linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)",
              boxShadow:
                mode === "create"
                  ? "0 4px 12px rgba(13, 148, 136, 0.3)"
                  : mode === "edit"
                  ? "0 4px 12px rgba(217, 119, 6, 0.3)"
                  : "0 4px 12px rgba(220, 38, 38, 0.3)"
            }}
          >
            {loading ? (
              "Procesando..."
            ) : mode === "create" ? (
              <>
                <PlusCircle size={16} />
                Guardar y Crear Sección
              </>
            ) : mode === "edit" ? (
              <>
                <Edit3 size={16} />
                Guardar Cambios
              </>
            ) : (
              <>
                <Trash2 size={16} />
                Confirmar Eliminación
              </>
            )}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
