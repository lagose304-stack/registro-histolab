import React from "react";
import { Eye, Edit3, Trash2, Calendar, FileText, User } from "lucide-react";

export default function RegistroList({
  registros,
  loading,
  onView,
  onEdit,
  onDelete,
  onQuickStatusChange
}) {
  const getBadgeClass = (estado) => {
    switch (estado) {
      case "Completado":
        return "badge-success";
      case "En Proceso":
        return "badge-info";
      case "Pendiente":
      default:
        return "badge-warning";
    }
  };

  const getPriorityBadgeClass = (prioridad) => {
    switch (prioridad) {
      case "Urgente":
        return "badge-danger";
      case "Alta":
        return "badge-warning";
      case "Normal":
      default:
        return "badge-info";
    }
  };

  if (loading) {
    return (
      <div className="glass-panel" style={{ padding: "3.5rem", textAlign: "center" }}>
        <div style={{ display: "inline-block", width: "40px", height: "40px", border: "3px solid var(--border-subtle)", borderTopColor: "var(--primary)", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
        <p style={{ marginTop: "1rem", color: "var(--text-muted)", fontWeight: 500 }}>Cargando registros desde el servidor...</p>
        <style>{`@keyframes spin { 100% { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (!registros || registros.length === 0) {
    return (
      <div className="glass-panel" style={{ padding: "4rem 2rem", textAlign: "center" }}>
        <FileText size={48} color="var(--text-dim)" style={{ marginBottom: "1rem" }} />
        <h3 style={{ fontSize: "1.25rem", color: "var(--text-main)", marginBottom: "0.5rem" }}>
          No se encontraron registros
        </h3>
        <p style={{ color: "var(--text-muted)", maxWidth: "400px", margin: "0 auto" }}>
          No hay muestras que coincidan con los filtros aplicados o aún no se han ingresado datos.
        </p>
      </div>
    );
  }

  return (
    <div className="glass-panel" style={{ overflow: "hidden" }}>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
          <thead>
            <tr style={{ background: "#f8fafc", borderBottom: "1px solid var(--border-subtle)" }}>
              <th style={{ padding: "1rem 1.25rem", fontSize: "0.75rem", textTransform: "uppercase", color: "var(--text-muted)", letterSpacing: "0.05em", fontWeight: 700 }}>Código / Fecha</th>
              <th style={{ padding: "1rem 1.25rem", fontSize: "0.75rem", textTransform: "uppercase", color: "var(--text-muted)", letterSpacing: "0.05em", fontWeight: 700 }}>Paciente & Edad</th>
              <th style={{ padding: "1rem 1.25rem", fontSize: "0.75rem", textTransform: "uppercase", color: "var(--text-muted)", letterSpacing: "0.05em", fontWeight: 700 }}>Estudio / Órgano</th>
              <th style={{ padding: "1rem 1.25rem", fontSize: "0.75rem", textTransform: "uppercase", color: "var(--text-muted)", letterSpacing: "0.05em", fontWeight: 700 }}>Médico Remitente</th>
              <th style={{ padding: "1rem 1.25rem", fontSize: "0.75rem", textTransform: "uppercase", color: "var(--text-muted)", letterSpacing: "0.05em", fontWeight: 700 }}>Prioridad</th>
              <th style={{ padding: "1rem 1.25rem", fontSize: "0.75rem", textTransform: "uppercase", color: "var(--text-muted)", letterSpacing: "0.05em", fontWeight: 700 }}>Estado</th>
              <th style={{ padding: "1rem 1.25rem", fontSize: "0.75rem", textTransform: "uppercase", color: "var(--text-muted)", letterSpacing: "0.05em", fontWeight: 700, textAlign: "right" }}>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {registros.map((r) => {
              const formattedDate = new Date(r.fechaIngreso).toLocaleDateString("es-ES", {
                day: "2-digit",
                month: "short",
                year: "numeric"
              });

              return (
                <tr
                  key={r.id}
                  style={{
                    borderBottom: "1px solid var(--border-subtle)",
                    transition: "background-color 0.15s ease"
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "rgba(2, 132, 199, 0.03)")}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
                >
                  {/* ID y Fecha */}
                  <td style={{ padding: "1rem 1.25rem" }}>
                    <div style={{ fontFamily: "var(--font-mono)", fontWeight: 700, color: "var(--primary)", fontSize: "0.925rem" }}>
                      {r.id}
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.35rem", fontSize: "0.75rem", color: "var(--text-dim)", marginTop: "0.2rem" }}>
                      <Calendar size={12} />
                      <span>{formattedDate}</span>
                    </div>
                  </td>

                  {/* Paciente */}
                  <td style={{ padding: "1rem 1.25rem" }}>
                    <div style={{ fontWeight: 600, color: "var(--text-main)" }}>
                      {r.paciente}
                    </div>
                    <div style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
                      {r.edad} años • {r.genero}
                    </div>
                  </td>

                  {/* Estudio */}
                  <td style={{ padding: "1rem 1.25rem" }}>
                    <div style={{ fontWeight: 600, color: "var(--text-main)" }}>
                      {r.tipoEstudio}
                    </div>
                    <div style={{ fontSize: "0.8rem", color: "var(--text-dim)" }}>
                      {r.organo}
                    </div>
                  </td>

                  {/* Médico */}
                  <td style={{ padding: "1rem 1.25rem", fontSize: "0.875rem", color: "var(--text-muted)" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                      <User size={14} color="var(--text-dim)" />
                      <span>{r.medicoSolicitante}</span>
                    </div>
                  </td>

                  {/* Prioridad */}
                  <td style={{ padding: "1rem 1.25rem" }}>
                    <span className={`badge ${getPriorityBadgeClass(r.prioridad)}`}>
                      <span className="badge-dot" />
                      {r.prioridad}
                    </span>
                  </td>

                  {/* Estado con selector rápido */}
                  <td style={{ padding: "1rem 1.25rem" }}>
                    <select
                      value={r.estado}
                      onChange={(e) => onQuickStatusChange(r.id, e.target.value)}
                      className="form-select"
                      style={{
                        padding: "0.3rem 0.65rem",
                        fontSize: "0.8rem",
                        fontWeight: 600,
                        width: "auto",
                        borderRadius: "9999px",
                        border: "1px solid var(--border-subtle)",
                        backgroundColor: "#ffffff",
                        color: r.estado === "Completado" ? "#047857" : r.estado === "En Proceso" ? "#0284c7" : "#b45309",
                        boxShadow: "0 1px 2px rgba(0, 0, 0, 0.05)"
                      }}
                    >
                      <option value="Pendiente">Pendiente</option>
                      <option value="En Proceso">En Proceso</option>
                      <option value="Completado">Completado</option>
                    </select>
                  </td>

                  {/* Acciones */}
                  <td style={{ padding: "1rem 1.25rem", textAlign: "right" }}>
                    <div style={{ display: "inline-flex", alignItems: "center", gap: "0.4rem" }}>
                      <button
                        onClick={() => onView(r)}
                        className="btn btn-secondary btn-icon"
                        title="Ver detalles completos"
                        style={{ padding: "0.45rem" }}
                      >
                        <Eye size={16} color="var(--text-muted)" />
                      </button>
                      <button
                        onClick={() => onEdit(r)}
                        className="btn btn-secondary btn-icon"
                        title="Editar registro"
                        style={{ padding: "0.45rem" }}
                      >
                        <Edit3 size={16} color="var(--text-muted)" />
                      </button>
                      <button
                        onClick={() => onDelete(r.id, r.paciente)}
                        className="btn btn-danger btn-icon"
                        title="Eliminar muestra"
                        style={{ padding: "0.45rem" }}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
