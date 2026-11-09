import React from "react";
import { AlertTriangle, RefreshCw, LogOut } from "lucide-react";
import { safeStorage } from "../utils/safeStorage";

export default class ErrorBoundary extends React.Component {
  state = { hasError: false };
  static getDerivedStateFromError() { return { hasError: true }; }
  componentDidCatch(error, errorInfo) {
    console.error("Error al mostrar HistoLab:", error, errorInfo);
  }
  handleResetAndLogout = () => {
    for (const key of ["histolab_instructor_token", "histolab_instructor_user", "histolab_session_id", "histolab_student_token", "histolab_student_user", "histolab_student_session_id"]) {
      safeStorage.removeItem(key);
    }
    safeStorage.removeSession("histolab_nav_state");
    window.location.href = "/";
  };
  render() {
    if (!this.state.hasError) return this.props.children;
    return <main className="site-recovery">
      <section className="site-recovery__card" aria-labelledby="site-recovery-title">
        <span className="site-recovery__icon"><AlertTriangle size={28} aria-hidden="true" /></span>
        <h1 id="site-recovery-title">No pudimos mostrar esta pantalla</h1>
        <p>Recarga la página para volver a intentarlo. Si el problema continúa, puedes regresar al inicio e iniciar sesión de nuevo.</p>
        <div className="site-recovery__actions">
          <button type="button" onClick={() => window.location.reload()}><RefreshCw size={18} aria-hidden="true" />Recargar página</button>
          <button type="button" onClick={this.handleResetAndLogout}><LogOut size={18} aria-hidden="true" />Volver al inicio</button>
        </div>
      </section>
    </main>;
  }
}
