import React, { useState, useEffect } from "react";
import { X, Save, FilePlus } from "lucide-react";

export default function RegistroForm({ isOpen, onClose, onSave, initialData }) {
  const isEditing = Boolean(initialData?.id);

  const [formData, setFormData] = useState({
    paciente: "",
    edad: "",
    genero: "Femenino",
    medicoSolicitante: "",
    tipoEstudio: "Biopsia Gástrica",
    organo: "",
    prioridad: "Normal",
    estado: "Pendiente",
    diagnosticoPresuntivo: "",
    observaciones: ""
  });

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (initialData) {
      setFormData({
        paciente: initialData.paciente || "",
        edad: initialData.edad || "",
        genero: initialData.genero || "Femenino",
        medicoSolicitante: initialData.medicoSolicitante || "",
        tipoEstudio: initialData.tipoEstudio || "Biopsia Gástrica",
        organo: initialData.organo || "",
        prioridad: initialData.prioridad || "Normal",
        estado: initialData.estado || "Pendiente",
        diagnosticoPresuntivo: initialData.diagnosticoPresuntivo || "",
        observaciones: initialData.observaciones || ""
      });
    } else {
      setFormData({
        paciente: "",
        edad: "",
        genero: "Femenino",
        medicoSolicitante: "",
        tipoEstudio: "Biopsia Gástrica",
        organo: "",
        prioridad: "Normal",
        estado: "Pendiente",
        diagnosticoPresuntivo: "",
        observaciones: ""
      });
    }
    setError("");
  }, [initialData, isOpen]);

  if (!isOpen) return null;

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.paciente.trim()) {
      setError("El nombre del paciente es requerido");
      return;
    }
    if (!formData.tipoEstudio.trim()) {
      setError("El tipo de estudio es requerido");
      return;
    }

    try {
      setSubmitting(true);
      setError("");
      await onSave(formData, initialData?.id);
      onClose();
    } catch (err) {
      setError(err.message || "Error al guardar el registro");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-content animate-fade-in"
        onClick={(e) => e.stopPropagation()}
        style={{ padding: "2rem" }}
      >
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1.5rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
            <div style={{
              background: "var(--primary-gradient)",
              padding: "0.5rem",
              borderRadius: "var(--radius-sm)",
              display: "flex",
              alignItems: "center",
              boxShadow: "0 2px 8px rgba(2, 132, 199, 0.25)"
            }}>
              <FilePlus size={20} color="#fff" />
            </div>
            <div>
              <h2 style={{ fontSize: "1.25rem", color: "var(--text-main)" }}>
                {isEditing ? `Editar Muestra ${initialData.id}` : "Nuevo Ingreso de Muestra"}
              </h2>
              <p style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
                {isEditing ? "Actualice la información patológica" : "Complete la ficha de ingreso al laboratorio"}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="btn btn-secondary btn-icon" style={{ borderRadius: "50%" }}>
            <X size={18} />
          </button>
        </div>

        {error && (
          <div style={{
            background: "var(--danger-bg)",
            border: "1px solid rgba(239, 68, 68, 0.3)",
            color: "#b91c1c",
            padding: "0.75rem 1rem",
            borderRadius: "var(--radius-md)",
            marginBottom: "1.25rem",
            fontSize: "0.875rem",
            fontWeight: 500
          }}>
            {error}
          </div>
        )}

        {/* Form Body */}
        <form onSubmit={handleSubmit}>
          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gap: "1rem" }}>
            <div className="form-group">
              <label className="form-label">Nombre del Paciente *</label>
              <input
                type="text"
                name="paciente"
                required
                placeholder="Ej. Carmen Velásquez"
                className="form-control"
                value={formData.paciente}
                onChange={handleChange}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Edad</label>
              <input
                type="number"
                name="edad"
                placeholder="Ej. 42"
                className="form-control"
                value={formData.edad}
                onChange={handleChange}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Género</label>
              <select name="genero" className="form-select" value={formData.genero} onChange={handleChange}>
                <option value="Femenino">Femenino</option>
                <option value="Masculino">Masculino</option>
                <option value="Otro">Otro</option>
              </select>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
            <div className="form-group">
              <label className="form-label">Médico Solicitante</label>
              <input
                type="text"
                name="medicoSolicitante"
                placeholder="Ej. Dr. Mario Estrada"
                className="form-control"
                value={formData.medicoSolicitante}
                onChange={handleChange}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Órgano / Región Anatómica</label>
              <input
                type="text"
                name="organo"
                placeholder="Ej. Colon sigmoide, Tiroides..."
                className="form-control"
                value={formData.organo}
                onChange={handleChange}
              />
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gap: "1rem" }}>
            <div className="form-group">
              <label className="form-label">Tipo de Estudio *</label>
              <select name="tipoEstudio" className="form-select" value={formData.tipoEstudio} onChange={handleChange}>
                <option value="Biopsia Gástrica">Biopsia Gástrica</option>
                <option value="Citología Cervicovaginal (PAP)">Citología Cervicovaginal (PAP)</option>
                <option value="Inmunohistoquímica">Inmunohistoquímica</option>
                <option value="Biopsia de Piel (Punch)">Biopsia de Piel (Punch)</option>
                <option value="Citología por Aspiración (PAAF)">Citología por Aspiración (PAAF)</option>
                <option value="Estudio Transoperatorio">Estudio Transoperatorio</option>
                <option value="Biopsia Endometrial">Biopsia Endometrial</option>
                <option value="Pieza Quirúrgica Mayor">Pieza Quirúrgica Mayor</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Prioridad</label>
              <select name="prioridad" className="form-select" value={formData.prioridad} onChange={handleChange}>
                <option value="Normal">Normal</option>
                <option value="Alta">Alta</option>
                <option value="Urgente">Urgente</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Estado</label>
              <select name="estado" className="form-select" value={formData.estado} onChange={handleChange}>
                <option value="Pendiente">Pendiente</option>
                <option value="En Proceso">En Proceso</option>
                <option value="Completado">Completado</option>
              </select>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Diagnóstico Presuntivo / Indicación Clínica</label>
            <textarea
              name="diagnosticoPresuntivo"
              rows={2}
              placeholder="Indique sospecha diagnóstica clínica o motivo de envío..."
              className="form-textarea"
              value={formData.diagnosticoPresuntivo}
              onChange={handleChange}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Observaciones de Muestra (Fijador, fragmentos, etc.)</label>
            <textarea
              name="observaciones"
              rows={2}
              placeholder="Ej. Frasco con formol al 10%, 2 fragmentos parduscos de 0.3 cm..."
              className="form-textarea"
              value={formData.observaciones}
              onChange={handleChange}
            />
          </div>

          {/* Actions */}
          <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.75rem", marginTop: "1.5rem" }}>
            <button type="button" onClick={onClose} className="btn btn-secondary" disabled={submitting}>
              Cancelar
            </button>
            <button type="submit" className="btn btn-primary" disabled={submitting}>
              <Save size={18} />
              <span>{submitting ? "Guardando..." : isEditing ? "Actualizar Ficha" : "Registrar Muestra"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
