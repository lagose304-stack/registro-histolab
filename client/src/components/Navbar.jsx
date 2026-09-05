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
          gap: "0.85rem",
          flexWrap: "wrap"
        }}
      >
        {/* Logo y Marca Oficial */}
        <div style={{ display: "flex", alignItems: "center", gap: "0.85rem" }}>
          <div style={{
            width: "42px",
            height: "42px",
            background: "#ffffff",
            border: "1px solid #e2e8f0",
            padding: "0.25rem",
            borderRadius: "var(--radius-md)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: "0 2px 8px rgba(2, 132, 199, 0.15)",
            flexShrink: 0
          }}>
            <img
              src={laboratorioLogo}
              alt="Logo Registro Histolab"
              style={{ width: "100%", height: "100%", objectFit: "contain" }}
            />
          </div>
          <div>
            <h1 style={{ fontSize: "1.3rem", fontWeight: 800, lineHeight: 1.1, color: "var(--text-main)", margin: 0 }}>
              <span className="text-gradient">REGISTRO HISTOLAB</span>
            </h1>
          </div>
        </div>

        {/* Acciones y Perfil */}
        <div style={{ display: "flex", alignItems: "center", gap: "0.85rem", flexWrap: "wrap" }}>
          {/* Perfil del Usuario Logueado (Instructor o Estudiante) */}
          {hasUser && (
            <div style={{
              display: "flex",
              alignItems: "center",
              gap: "0.65rem",
              background: isStudent ? "#f0fdf4" : "#f0f9ff",
              border: isStudent ? "1px solid #bbf7d0" : "1px solid #bae6fd",
              padding: "0.35rem 0.85rem 0.35rem 0.55rem",
              borderRadius: "9999px"
            }}>
              <div style={{
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
                fontSize: "0.78rem"
              }}>
                {initial}
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: "0.45rem" }}>
                <span style={{ fontSize: "0.85rem", fontWeight: 700, color: "#0f172a" }}>
                  {displayName}
                </span>
                {subInfo && (
                  <span
                    style={{
                      fontSize: "0.7rem",
                      fontWeight: 800,
                      background: isStudent ? "#dcfce7" : "#e0f2fe",
                      color: isStudent ? "#15803d" : "#0369a1",
                      padding: "0.1rem 0.45rem",
                      borderRadius: "0.35rem"
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
              className="btn btn-danger"
              style={{
                padding: "0.5rem 1rem",
                fontSize: "0.88rem",
                fontWeight: 700,
                display: "inline-flex",
                alignItems: "center",
                gap: "0.45rem",
                borderRadius: "var(--radius-md)",
                background: "#fef2f2",
                border: "1px solid #fecaca",
                color: "#dc2626",
                cursor: "pointer",
                transition: "all 0.15s ease",
                boxShadow: "0 1px 2px rgba(220, 38, 38, 0.05)"
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "#dc2626";
                e.currentTarget.style.color = "#ffffff";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "#fef2f2";
                e.currentTarget.style.color = "#dc2626";
              }}
              title="Cerrar sesión y proteger portal"
            >
              <LogOut size={16} />
              <span>Cerrar Sesión</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
