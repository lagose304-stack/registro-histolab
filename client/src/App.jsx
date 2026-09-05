import React, { useState, useEffect, useCallback, useRef } from "react";
import Navbar from "./components/Navbar";
import LoginInstructor from "./components/LoginInstructor";
import DashboardInstructor from "./components/DashboardInstructor";
import StudentPortalView from "./components/StudentPortalView";
import Notification from "./components/Notification";
import { api } from "./services/api";
import { AlertTriangle } from "lucide-react";

import { clearNavState } from "./utils/navigationState";

// Tiempo de inactividad máximo: 20 minutos
const INACTIVITY_TIMEOUT_MS = 20 * 60 * 1000;
// Intervalo de comprobación de sesión activa (Heartbeat): 20 segundos
const HEARTBEAT_INTERVAL_MS = 20 * 1000;

export default function App() {
  const [backendStatus, setBackendStatus] = useState("checking");
  const [currentInstructor, setCurrentInstructor] = useState(() => api.auth.getCurrentInstructor());
  const [currentStudent, setCurrentStudent] = useState(() => api.auth.getCurrentStudent());
  const [sessionAlert, setSessionAlert] = useState(null);
  const [notification, setNotification] = useState({ message: "", type: "success", title: "" });

  const notify = useCallback((message, type = "success", title = "") => {
    setNotification({ message, type, title });
  }, []);

  const lastActivityRef = useRef(Date.now());

  // Cerrar sesión de instructor
  const handleLogout = useCallback(async (reasonText = "Sesión cerrada correctamente.") => {
    clearNavState();
    await api.auth.logout();
    setCurrentInstructor(null);
    notify(reasonText, "info");
  }, [notify]);

  // Cerrar sesión de estudiante
  const handleStudentLogout = useCallback(() => {
    api.auth.logoutStudent();
    setCurrentStudent(null);
    notify("Sesión de estudiante cerrada correctamente.", "info");
  }, [notify]);

  const handleStudentLoginSuccess = useCallback((student) => {
    setCurrentStudent(student);
  }, []);

  // Verificar estado del backend
  const checkServerHealth = useCallback(async () => {
    try {
      const res = await api.checkHealth();
      setBackendStatus(res?.status === "ok" ? "online" : "offline");
    } catch {
      setBackendStatus("offline");
    }
  }, []);

  useEffect(() => {
    checkServerHealth();
  }, [checkServerHealth]);

  // 🛡️ Detector de sesiones concurrentes
  useEffect(() => {
    if (!currentInstructor) return;

    const heartbeatTimer = setInterval(async () => {
      try {
        await api.auth.checkHeartbeat();
      } catch (err) {
        if (err.reason === "CONCURRENT_SESSION_DETECTED") {
          setSessionAlert({
            title: "Sesión Desconectada",
            message: "Tu cuenta de instructor fue abierta en otra ubicación o pestaña. Tu sesión en esta pantalla ha sido invalidada."
          });
          handleLogout("Sesión cerrada: Acceso simultáneo detectado.");
        } else if (err.status === 401) {
          handleLogout("Sesión no válida o revocada.");
        }
      }
    }, HEARTBEAT_INTERVAL_MS);

    const handleSessionExpiredEvent = (e) => {
      setSessionAlert({
        title: "Sesión Concurrente Detectada",
        message: e.detail?.message || "Tu sesión ha sido cerrada porque se inició sesión desde otro dispositivo."
      });
      handleLogout("Sesión cerrada por acceso simultáneo.");
    };

    window.addEventListener("histolab:session_expired", handleSessionExpiredEvent);

    return () => {
      clearInterval(heartbeatTimer);
      window.removeEventListener("histolab:session_expired", handleSessionExpiredEvent);
    };
  }, [currentInstructor, handleLogout]);

  // ⏱️ Auto-logout por inactividad (20 min)
  useEffect(() => {
    if (!currentInstructor) return;

    const resetActivity = () => {
      lastActivityRef.current = Date.now();
    };

    const activityEvents = ["mousedown", "mousemove", "keydown", "scroll", "touchstart"];
    activityEvents.forEach((ev) => window.addEventListener(ev, resetActivity));

    const inactivityCheckTimer = setInterval(() => {
      const elapsed = Date.now() - lastActivityRef.current;
      if (elapsed > INACTIVITY_TIMEOUT_MS) {
        setSessionAlert({
          title: "Sesión Cerrada por Inactividad",
          message: "Por políticas de seguridad, tu sesión se cerró automáticamente tras 20 minutos de inactividad."
        });
        handleLogout("Sesión cerrada por inactividad prolongada.");
      }
    }, 30 * 1000);

    return () => {
      activityEvents.forEach((ev) => window.removeEventListener(ev, resetActivity));
      clearInterval(inactivityCheckTimer);
    };
  }, [currentInstructor, handleLogout]);

  // Login de instructor exitoso
  const handleLoginSuccess = (instructor) => {
    setSessionAlert(null);
    setCurrentInstructor(instructor);
    lastActivityRef.current = Date.now();
    checkServerHealth();
  };

  // 1. Si hay sesión de Estudiante activa, mostrar su Portal con la MISMA barra superior
  if (currentStudent) {
    return (
      <div className="app-container">
        {/* Barra Superior IDÉNTICA en ambos portales */}
        <Navbar
          currentStudent={currentStudent}
          onLogout={handleStudentLogout}
        />

        <main className="main-content" style={{ paddingTop: "1rem" }}>
          <StudentPortalView
            student={currentStudent}
            notify={notify}
          />
        </main>

        <Notification
          message={notification.message}
          type={notification.type}
          title={notification.title}
          onClose={() => setNotification({ message: "", type: "success", title: "" })}
        />
      </div>
    );
  }

  // 2. Si no hay sesión, mostrar el Portal Dual de Acceso
  if (!currentInstructor) {
    return (
      <>
        {sessionAlert && (
          <div style={{
            position: "fixed",
            top: "1.5rem",
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 10000,
            maxWidth: "480px",
            width: "90%",
            background: "#fff1f2",
            border: "1px solid #fecdd3",
            borderRadius: "1rem",
            padding: "1rem 1.25rem",
            boxShadow: "0 10px 25px -5px rgba(225, 29, 72, 0.2)",
            display: "flex",
            alignItems: "flex-start",
            gap: "0.85rem",
            animation: "fadeIn 0.25s ease-out"
          }}>
            <div style={{
              background: "#e11d48",
              color: "#ffffff",
              padding: "0.4rem",
              borderRadius: "50%",
              display: "flex"
            }}>
              <AlertTriangle size={18} />
            </div>
            <div style={{ flex: 1 }}>
              <strong style={{ display: "block", color: "#9f1239", fontSize: "0.92rem", marginBottom: "0.2rem" }}>
                {sessionAlert.title}
              </strong>
              <p style={{ margin: 0, color: "#be123c", fontSize: "0.83rem", lineHeight: 1.4 }}>
                {sessionAlert.message}
              </p>
            </div>
            <button
              onClick={() => setSessionAlert(null)}
              style={{
                background: "none",
                border: "none",
                color: "#9f1239",
                fontWeight: 700,
                fontSize: "1.1rem",
                cursor: "pointer",
                padding: "0 0.25rem"
              }}
            >
              ×
            </button>
          </div>
        )}

        <LoginInstructor
          onLoginSuccess={handleLoginSuccess}
          onStudentLoginSuccess={handleStudentLoginSuccess}
          notify={notify}
        />

        <Notification
          message={notification.message}
          type={notification.type}
          title={notification.title}
          onClose={() => setNotification({ message: "", type: "success", title: "" })}
        />
      </>
    );
  }

  // Vista Autenticada con Barra Superior y Dashboard
  return (
    <div className="app-container">
      {/* Barra Superior */}
      <Navbar
        currentInstructor={currentInstructor}
        onLogout={() => handleLogout("Sesión cerrada por el usuario.")}
      />

      {/* Panel Principal Dashboard */}
      <main className="main-content">
        <DashboardInstructor instructor={currentInstructor} notify={notify} />
      </main>

      {/* Toast Notification */}
      <Notification
        message={notification.message}
        type={notification.type}
        title={notification.title}
        onClose={() => setNotification({ message: "", type: "success", title: "" })}
      />
    </div>
  );
}
