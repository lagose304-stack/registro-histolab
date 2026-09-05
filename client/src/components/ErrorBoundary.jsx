import React from "react";
import { AlertTriangle, RefreshCw, LogOut } from "lucide-react";
import { safeStorage } from "../utils/safeStorage";

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    this.setState({ errorInfo });
    console.error("🚨 Error capturado por Histolab ErrorBoundary:", error, errorInfo);
  }

  handleReload = () => {
    window.location.reload();
  };

  handleResetAndLogout = () => {
    try {
      safeStorage.removeItem("histolab_instructor_token");
      safeStorage.removeItem("histolab_instructor_user");
      safeStorage.removeItem("histolab_session_id");
      safeStorage.removeItem("histolab_student_token");
      safeStorage.removeItem("histolab_student_user");
      safeStorage.removeSession("histolab_nav_state");
    } catch (_) {}
    window.location.href = "/";
  };

  render() {
    if (this.state.hasError) {
      const errorMsg = this.state.error?.message || "Ocurrió un error inesperado al renderizar la vista.";

      return (
        <div
          style={{
            minHeight: "100vh",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "#f8fafc",
            padding: "1.5rem",
            fontFamily: "system-ui, -apple-system, sans-serif"
          }}
        >
          <div
            style={{
              maxWidth: "520px",
              width: "100%",
              background: "#ffffff",
              borderRadius: "1.25rem",
              border: "1.5px solid #e2e8f0",
              boxShadow: "0 20px 40px -15px rgba(0,0,0,0.08)",
              padding: "2.5rem 2rem",
              textAlign: "center",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "1.25rem"
            }}
          >
            <div
              style={{
                width: "60px",
                height: "60px",
                borderRadius: "1rem",
                background: "#fef2f2",
                border: "1.5px solid #fecaca",
                color: "#dc2626",
                display: "flex",
                alignItems: "center",
                justifyContent: "center"
              }}
            >
              <AlertTriangle size={32} />
            </div>

            <div>
              <h2 style={{ margin: "0 0 0.4rem", fontSize: "1.35rem", fontWeight: 800, color: "#0f172a" }}>
                Error al Cargar la Pantalla
              </h2>
              <p style={{ margin: 0, fontSize: "0.88rem", color: "#64748b", lineHeight: 1.5 }}>
                El navegador encontró un inconveniente al procesar los datos de la sesión. Puedes recargar la página o volver al portal de inicio.
              </p>
            </div>

            <div
              style={{
                width: "100%",
                background: "#f8fafc",
                border: "1px solid #e2e8f0",
                borderRadius: "0.75rem",
                padding: "0.85rem 1rem",
                fontSize: "0.8rem",
                color: "#991b1b",
                textAlign: "left",
                fontFamily: "monospace",
                wordBreak: "break-word"
              }}
            >
              {errorMsg}
            </div>

            <div style={{ display: "flex", gap: "0.75rem", width: "100%", marginTop: "0.5rem" }}>
              <button
                type="button"
                onClick={this.handleReload}
                style={{
                  flex: 1,
                  padding: "0.75rem 1rem",
                  borderRadius: "0.65rem",
                  border: "none",
                  background: "linear-gradient(135deg, #0284c7 0%, #0369a1 100%)",
                  color: "#ffffff",
                  fontSize: "0.88rem",
                  fontWeight: 800,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "0.45rem",
                  boxShadow: "0 4px 12px rgba(2, 132, 199, 0.3)"
                }}
              >
                <RefreshCw size={16} />
                <span>Recargar Página</span>
              </button>

              <button
                type="button"
                onClick={this.handleResetAndLogout}
                style={{
                  padding: "0.75rem 1rem",
                  borderRadius: "0.65rem",
                  border: "1.5px solid #cbd5e1",
                  background: "#ffffff",
                  color: "#334155",
                  fontSize: "0.88rem",
                  fontWeight: 800,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "0.45rem"
                }}
              >
                <LogOut size={16} />
                <span>Reiniciar Sesión</span>
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
