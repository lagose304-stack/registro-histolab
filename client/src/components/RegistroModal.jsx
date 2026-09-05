import React from "react";
import { X, Calendar, User, Microscope, Activity, Tag, FileText, CheckCircle } from "lucide-react";

export default function RegistroModal({ registro, onClose, onEdit }) {
  if (!registro) return null;

  const formattedDate = new Date(registro.fechaIngreso).toLocaleString("es-ES", {
    dateStyle: "full",
    timeStyle: "short"
  });

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-content animate-fade-in"
        onClick={(e) => e.stopPropagation()}
        style={{ padding: "2rem" }}
      >
        {/* Header */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "1.5rem" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: "1.2rem", fontWeight: 800, color: "var(--primary)" }}>
                {registro.id}
              </span>
              <span className={`badge ${registro.estado === "Completado" ? "badge-success" : registro.estado === "En Proceso" ? "badge-info" : "badge-warning"}`}>
                <span className="badge-dot" />
                {registro.estado}
              </span>
            </div>
            <h2 style={{ fontSize: "1.4rem", marginTop: "0.4rem", color: "var(--text-main)" }}>
              {registro.tipoEstudio}
            </h2>
          </div>
          <button onClick={onClose} className="btn btn-secondary btn-icon" style={{ borderRadius: "50%" }}>
            <X size={18} />
          </button>
        </div>

        {/* Info Grid */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "1.5rem" }}>
          <div style={{ background: "#f8fafc", padding: "1rem", borderRadius: "var(--radius-md)", border: "1px solid var(--border-subtle)" }}>
            <span style={{ fontSize: "0.75rem", textTransform: "uppercase", color: "var(--text-muted)", fontWeight: 700 }}>Paciente</span>
            <p style={{ fontSize: "1.1rem", fontWeight: 700, color: "var(--text-main)", marginTop: "0.2rem" }}>{registro.paciente}</p>
            <p style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>{registro.edad} años • {registro.genero}</p>
          </div>

          <div style={{ background: "#f8fafc", padding: "1rem", borderRadius: "var(--radius-md)", border: "1px solid var(--border-subtle)" }}>
            <span style={{ fontSize: "0.75rem", textTransform: "uppercase", color: "var(--text-muted)", fontWeight: 700 }}>Médico Solicitante</span>
            <p style={{ fontSize: "1.1rem", fontWeight: 700, color: "var(--text-main)", marginTop: "0.2rem" }}>{registro.medicoSolicitante || "No especificado"}</p>
            <p style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>Prioridad: <strong style={{ color: registro.prioridad === "Urgente" ? "#b91c1c" : "#0284c7" }}>{registro.prioridad}</strong></p>
          </div>
        </div>

        {/* Detalles Clínicos */}
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem", marginBottom: "1.5rem" }}>
          <div style={{ background: "#f8fafc", padding: "1rem", borderRadius: "var(--radius-md)", border: "1px solid var(--border-subtle)" }}>
            <span style={{ fontSize: "0.75rem", textTransform: "uppercase", color: "var(--text-muted)", fontWeight: 700 }}>Órgano o Topografía</span>
            <p style={{ fontSize: "0.95rem", color: "var(--text-main)", marginTop: "0.25rem", fontWeight: 500 }}>{registro.organo || "No especificado"}</p>
          </div>

          <div style={{ background: "#f8fafc", padding: "1rem", borderRadius: "var(--radius-md)", border: "1px solid var(--border-subtle)" }}>
            <span style={{ fontSize: "0.75rem", textTransform: "uppercase", color: "var(--text-muted)", fontWeight: 700 }}>Diagnóstico Clínico / Presuntivo</span>
            <p style={{ fontSize: "0.95rem", color: "var(--text-main)", marginTop: "0.25rem" }}>
              {registro.diagnosticoPresuntivo || "Sin observaciones clínicas previas."}
            </p>
          </div>

          <div style={{ background: "#f8fafc", padding: "1rem", borderRadius: "var(--radius-md)", border: "1px solid var(--border-subtle)" }}>
            <span style={{ fontSize: "0.75rem", textTransform: "uppercase", color: "var(--text-muted)", fontWeight: 700 }}>Descripción de Muestra & Fijación</span>
            <p style={{ fontSize: "0.95rem", color: "var(--text-main)", marginTop: "0.25rem" }}>
              {registro.observaciones || "Muestra estándar recibida en contenedor reglamentario."}
            </p>
          </div>
        </div>

        {/* Footer timestamp & action */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderTop: "1px solid var(--border-subtle)", paddingTop: "1.25rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.8rem", color: "var(--text-dim)" }}>
            <Calendar size={15} />
            <span>Ingreso: {formattedDate}</span>
          </div>

          <div style={{ display: "flex", gap: "0.75rem" }}>
            <button
              onClick={() => {
                onClose();
                onEdit(registro);
              }}
              className="btn btn-primary"
            >
              Editar Ficha
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
