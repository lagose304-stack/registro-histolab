import React from "react";
import { LogOut, GraduationCap } from "lucide-react";
import laboratorioLogo from "../assets/logos/laboratorio.png";

export default function Navbar({
  currentInstructor,
  currentStudent,
  onLogout
}) {
  const isStudent = Boolean(currentStudent);

  // Datos del usuario (Instructor o Estudiante)
  const displayName = isStudent
    ? currentStudent?.nombre_completo || "Estudiante"
    : currentInstructor
    ? currentInstructor.nombre_completo ||
      `${currentInstructor.primer_nombre || currentInstructor.nombre || "Instructor"} ${currentInstructor.primer_apellido || currentInstructor.apellido || ""}`.trim()
    : "Usuario";

  const initial = isStudent
    ? displayName.charAt(0).toUpperCase() || "E"
    : currentInstructor?.primer_nombre?.charAt(0) || currentInstructor?.nombre?.charAt(0) || "I";

  const subInfo = isStudent
    ? currentStudent?.carrera || "Estudiante"
    : currentInstructor?.rol || currentInstructor?.comite || currentInstructor?.seccion || "Docente";

  const hasUser = Boolean(currentInstructor || currentStudent);

  return (
    <header style={{
      borderBottom: "1px solid var(--border-subtle)",
      background: "rgba(255, 255, 255, 0.95)",
      backdropFilter: "blur(12px)",
      position: "sticky",
      top: 0,
      zIndex: 100,
      boxShadow: "0 1px 3px rgba(0, 0, 0, 0.03)"
    }}>
      <div
        className="navbar-container"
        style={{
          maxWidth: "1380px",
          margin: "0 auto",
          padding: "0.85rem 1.25rem",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "0.85rem"
        }}
      >
        {/* Logo y Marca Oficial */}
        <div className="navbar-brand-group" style={{ display: "flex", alignItems: "center", gap: "0.65rem", flexShrink: 0 }}>
          <div
            className="navbar-logo-box"
            style={{
              width: "40px",
              height: "40px",
              background: "#ffffff",
              border: "1px solid #e2e8f0",
              padding: "0.2rem",
              borderRadius: "var(--radius-md)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "0 2px 8px rgba(2, 132, 199, 0.15)",
              flexShrink: 0
            }}
          >
            <img
              src={laboratorioLogo}
              alt="Logo Registro Histolab"
              style={{ width: "100%", height: "100%", objectFit: "contain" }}
            />
          </div>
          <div>
            <h1 className="navbar-logo-title" style={{ fontSize: "1.25rem", fontWeight: 800, lineHeight: 1.1, color: "var(--text-main)", margin: 0 }}>
              <span className="text-gradient navbar-brand-full">REGISTRO HISTOLAB</span>
              <span className="text-gradient navbar-brand-short">HISTOLAB</span>
            </h1>
          </div>
        </div>

        {/* Acciones y Perfil */}
        <div className="navbar-actions" style={{ display: "flex", alignItems: "center", gap: "0.55rem" }}>
          {/* Perfil del Usuario Logueado (Instructor o Estudiante) */}
          {hasUser && (
            <div
              className="navbar-user-chip"
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.5rem",
                background: isStudent ? "#f0fdf4" : "#f0f9ff",
                border: isStudent ? "1px solid #bbf7d0" : "1px solid #bae6fd",
                padding: "0.3rem 0.75rem 0.3rem 0.45rem",
                borderRadius: "9999px",
                maxWidth: "240px"
              }}
            >
              <div
                className="navbar-user-avatar"
                style={{
                  width: "28px",
                  height: "28px",
                  borderRadius: "50%",
                  background: isStudent
                    ? "linear-gradient(135deg, #0284c7 0%, #0369a1 100%)"
                    : "linear-gradient(135deg, #075985 0%, #0c4a6e 100%)",
                  color: "#ffffff",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontWeight: 700,
                  fontSize: "0.78rem",
                  flexShrink: 0
                }}
              >
                {initial}
              </div>

              <div className="navbar-user-details" style={{ display: "flex", alignItems: "center", gap: "0.4rem", minWidth: 0 }}>
                <span
                  className="navbar-user-name"
                  style={{
                    fontSize: "0.84rem",
                    fontWeight: 700,
                    color: "#0f172a",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap"
                  }}
                  title={displayName}
                >
                  {displayName}
                </span>
                {subInfo && (
                  <span
                    className="navbar-subinfo-badge"
                    style={{
                      fontSize: "0.68rem",
                      fontWeight: 800,
                      background: isStudent ? "#dcfce7" : "#e0f2fe",
                      color: isStudent ? "#15803d" : "#0369a1",
                      padding: "0.1rem 0.45rem",
                      borderRadius: "0.35rem",
                      whiteSpace: "nowrap",
                      flexShrink: 0
                    }}
                  >
                    {subInfo}
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Botón Cerrar Sesión */}
          {hasUser && (
            <button
              onClick={onLogout}
              className="btn btn-danger navbar-logout-btn"
              title="Cerrar sesión"
              aria-label="Cerrar sesión"
              style={{
                padding: "0.45rem 0.85rem",
                fontSize: "0.85rem",
                fontWeight: 700,
                display: "inline-flex",
                alignItems: "center",
                gap: "0.4rem",
                borderRadius: "var(--radius-md)",
                background: "#fef2f2",
                border: "1px solid #fecaca",
                color: "#dc2626",
                cursor: "pointer",
                transition: "all 0.15s ease",
                boxShadow: "0 1px 2px rgba(220, 38, 38, 0.05)",
                whiteSpace: "nowrap",
                flexShrink: 0
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "#dc2626";
                e.currentTarget.style.color = "#ffffff";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "#fef2f2";
                e.currentTarget.style.color = "#dc2626";
              }}
            >
              <LogOut size={16} />
              <span className="navbar-logout-text">Cerrar Sesión</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
