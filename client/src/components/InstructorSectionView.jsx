import React from "react";
import {
  ArrowLeft,
  Users,
  Clock,
  Calendar,
  Layers,
  GraduationCap,
  Sparkles,
  BookOpen
} from "lucide-react";

export default function InstructorSectionView({
  seccion,
  currentInstructor,
  onClose = () => {},
  notify = () => {}
}) {
  if (!seccion) return null;

  return (
    <div className="animate-fade-in" style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      {/* Barra Superior de Navegación y Encabezado del Instructor */}
      <div
        className="glass-panel"
        style={{
          padding: "1.5rem 1.75rem",
          background: "linear-gradient(135deg, #ffffff 0%, #f0f9ff 100%)",
          border: "1px solid #bae6fd",
          borderRadius: "1.25rem",
          boxShadow: "0 8px 25px -5px rgba(2, 132, 199, 0.08)",
          display: "flex",
          flexDirection: "column",
          gap: "1.25rem"
        }}
      >
        {/* Fila 1: Botón Volver e Insignia de Rol Instructor */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "0.75rem" }}>
          <button
            onClick={onClose}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "0.5rem",
              background: "#ffffff",
              border: "1px solid #cbd5e1",
              color: "#334155",
              padding: "0.5rem 1rem",
              borderRadius: "0.65rem",
              fontSize: "0.85rem",
              fontWeight: 700,
              cursor: "pointer",
              boxShadow: "0 2px 5px rgba(0,0,0,0.04)",
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
            <ArrowLeft size={16} />
            <span>Volver a Mis Secciones</span>
          </button>

          {/* Insignia Azul de Instructor Asignado */}
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "0.45rem",
              background: "linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%)",
              border: "1.5px solid #bae6fd",
              color: "#0369a1",
              padding: "0.4rem 0.85rem",
              borderRadius: "9999px",
              fontSize: "0.82rem",
              fontWeight: 800,
              boxShadow: "0 2px 6px rgba(2, 132, 199, 0.1)"
            }}
          >
            <Users size={15} color="#0284c7" />
            <span>Panel del Instructor</span>
          </div>
        </div>

        {/* Fila 2: Título, Código, Carrera, Horario y Coordinador */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "1rem" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", marginBottom: "0.35rem" }}>
              <span
                style={{
                  background: "linear-gradient(135deg, #0284c7 0%, #0369a1 100%)",
                  color: "#ffffff",
                  fontWeight: 900,
                  fontSize: "1.1rem",
                  padding: "0.3rem 0.85rem",
                  borderRadius: "0.55rem",
                  letterSpacing: "0.04em",
                  boxShadow: "0 2px 8px rgba(2, 132, 199, 0.25)"
                }}
              >
                {seccion.codigo}
              </span>

              <span
                style={{
                  background: "#f1f5f9",
                  color: "#334155",
                  border: "1px solid #cbd5e1",
                  fontWeight: 800,
                  fontSize: "0.78rem",
                  padding: "0.28rem 0.75rem",
                  borderRadius: "9999px",
                  textTransform: "uppercase",
                  letterSpacing: "0.03em"
                }}
              >
                {seccion.carrera}
              </span>
            </div>

            <h1 style={{ fontSize: "1.6rem", fontWeight: 900, color: "#0f172a", margin: 0, letterSpacing: "-0.01em" }}>
              Sección {seccion.codigo}
            </h1>
          </div>

          {/* Horario, Coordinador y Doctor */}
          <div
            style={{
              background: "#ffffff",
              borderRadius: "0.85rem",
              border: "1px solid #e2e8f0",
              padding: "0.75rem 1.15rem",
              display: "flex",
              alignItems: "center",
              gap: "1.25rem",
              boxShadow: "0 2px 8px rgba(0,0,0,0.03)"
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", color: "#0284c7" }}>
              <Clock size={18} />
              <div style={{ display: "flex", flexDirection: "column" }}>
                <span style={{ fontSize: "0.68rem", color: "#64748b", fontWeight: 700, textTransform: "uppercase" }}>Horario</span>
                <strong style={{ fontSize: "0.92rem", color: "#0f172a" }}>{seccion.dia} {seccion.hora_inicio} - {seccion.hora_fin || "Fin"}</strong>
              </div>
            </div>

            <div style={{ height: "26px", width: "1px", background: "#e2e8f0" }} />

            <div style={{ display: "flex", flexDirection: "column" }}>
              <span style={{ fontSize: "0.68rem", color: "#64748b", fontWeight: 700, textTransform: "uppercase" }}>Coordinador de Sección</span>
              <strong style={{ fontSize: "0.86rem", color: "#0369a1" }}>{seccion.coordinador || "Sin asignar"}</strong>
            </div>

            <div style={{ height: "26px", width: "1px", background: "#e2e8f0" }} />

            <div style={{ display: "flex", flexDirection: "column" }}>
              <span style={{ fontSize: "0.68rem", color: "#64748b", fontWeight: 700, textTransform: "uppercase" }}>Doctor Encargado</span>
              <strong style={{ fontSize: "0.86rem", color: "#334155" }}>{seccion.doctor_encargado || "Dr. Rafael Perdomo Vaquero"}</strong>
            </div>
          </div>
        </div>
      </div>

      {/* Área de Trabajo Principal Vacía para el Instructor */}
      <div
        style={{
          background: "#ffffff",
          borderRadius: "1.25rem",
          border: "1.5px dashed #cbd5e1",
          minHeight: "420px",
          padding: "3rem 2rem",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          textAlign: "center",
          gap: "1rem",
          color: "#64748b"
        }}
      >
        <div
          style={{
            width: "60px",
            height: "60px",
            borderRadius: "1.25rem",
            background: "linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%)",
            color: "#0284c7",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: "0 6px 16px rgba(2, 132, 199, 0.15)"
          }}
        >
          <BookOpen size={30} />
        </div>

        <div style={{ maxWidth: "520px" }}>
          <h2 style={{ fontSize: "1.25rem", fontWeight: 800, color: "#0f172a", margin: "0 0 0.4rem" }}>
            Área de Trabajo del Instructor
          </h2>
          <p style={{ fontSize: "0.88rem", margin: 0, lineHeight: 1.5, color: "#64748b" }}>
            Esta vista está lista para integrar las funciones docentes y de seguimiento de clases asignadas al instructor.
          </p>
        </div>
      </div>
    </div>
  );
}
