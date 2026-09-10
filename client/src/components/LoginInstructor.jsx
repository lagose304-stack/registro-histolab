import React, { useState } from "react";
import {
  Lock,
  Mail,
  GraduationCap,
  ArrowRight,
  Eye,
  EyeOff,
  AlertCircle,
  Users,
  ChevronDown,
  ChevronUp,
  Check,
  Stethoscope,
  Activity,
  Smile,
  Microscope,
  Apple,
  Sparkles
} from "lucide-react";
import { api } from "../services/api";
import { safeStorage } from "../utils/safeStorage";
import laboratorioLogo from "../assets/logos/laboratorio.png";
import facultadLogo from "../assets/logos/facultad.png";
import universidadLogo from "../assets/logos/universidad.png";

// Lista de las 5 Carreras con colores temáticos e íconos
const CARRERAS = [
  {
    id: "Medicina",
    label: "Medicina",
    icon: Stethoscope,
    color: "#0284c7",
    bg: "#eff6ff",
    border: "#93c5fd",
    gradient: "linear-gradient(135deg, #0284c7 0%, #0369a1 100%)",
    desc: "Laboratorio de Histología Humana"
  },
  {
    id: "Enfermeria",
    label: "Enfermería",
    icon: Activity,
    color: "#16a34a",
    bg: "#f0fdf4",
    border: "#86efac",
    gradient: "linear-gradient(135deg, #16a34a 0%, #15803d 100%)",
    desc: "Histología para Enfermería"
  },
  {
    id: "Odontologia",
    label: "Odontología",
    icon: Smile,
    color: "#c026d3",
    bg: "#fdf4ff",
    border: "#f0abfc",
    gradient: "linear-gradient(135deg, #c026d3 0%, #a21caf 100%)",
    desc: "Histología y Embriología Dental"
  },
  {
    id: "Microbiologia",
    label: "Microbiología",
    icon: Microscope,
    color: "#ea580c",
    bg: "#fff7ed",
    border: "#fdba74",
    gradient: "linear-gradient(135deg, #ea580c 0%, #c2410c 100%)",
    desc: "Estructuras Tisulares"
  },
  {
    id: "Nutricion",
    label: "Nutrición",
    icon: Apple,
    color: "#0891b2",
    bg: "#ecfeff",
    border: "#67e8f9",
    gradient: "linear-gradient(135deg, #0891b2 0%, #0e7490 100%)",
    desc: "Histología del Sistema Digestivo"
  }
];

export default function LoginInstructor({
  onLoginSuccess,
  onStudentLoginSuccess,
  notify = () => {}
}) {
  // Portal activo: 'ESTUDIANTE' por defecto (conforme a requerimiento), alternable a 'INSTRUCTOR'
  const [activePortal, setActivePortal] = useState("ESTUDIANTE");

  // Estado común
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  // =========================================================================
  // 1. ESTADO DE FORMULARIO DE ESTUDIANTES
  // =========================================================================
  // Recordar estudiante (cuenta y carrera)
  const [rememberStudent, setRememberStudent] = useState(() => {
    return Boolean(safeStorage.getItem("histolab_remembered_student_account"));
  });

  // Sin carrera seleccionada por defecto (inicia vacío ""); si recordó se restaura
  const [selectedCarrera, setSelectedCarrera] = useState(() => {
    return safeStorage.getItem("histolab_remembered_student_carrera") || "";
  });

  const [isCareerAccordionOpen, setIsCareerAccordionOpen] = useState(false);
  const [showStudentPassword, setShowStudentPassword] = useState(false);
  const [studentData, setStudentData] = useState({
    numero_cuenta: safeStorage.getItem("histolab_remembered_student_account") || "",
    contrasena: ""
  });

  // =========================================================================
  // 2. ESTADO DE FORMULARIO DE INSTRUCTORES
  // =========================================================================
  const [showInstructorPassword, setShowInstructorPassword] = useState(false);
  const [rememberUser, setRememberUser] = useState(() => {
    return Boolean(safeStorage.getItem("histolab_remembered_email"));
  });
  const [instructorData, setInstructorData] = useState({
    email: safeStorage.getItem("histolab_remembered_email") || "",
    password: ""
  });

  // Carrera actualmente seleccionada (null si ninguna)
  const currentCarreraObj = CARRERAS.find((c) => c.id === selectedCarrera) || null;

  // =========================================================================
  // LOGIN DE ESTUDIANTE
  // =========================================================================
  const handleStudentLoginSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg("");

    if (!selectedCarrera) {
      setErrorMsg("Debes seleccionar tu carrera en el acordeón superior antes de ingresar.");
      setIsCareerAccordionOpen(true);
      return;
    }
    if (!studentData.numero_cuenta.trim()) {
      setErrorMsg("Por favor ingresa tu número de cuenta.");
      return;
    }
    if (!studentData.contrasena.trim()) {
      setErrorMsg("Por favor ingresa tu contraseña.");
      return;
    }

    setLoading(true);
    try {
      const res = await api.auth.loginStudent({
        carrera: selectedCarrera,
        numero_cuenta: studentData.numero_cuenta.trim(),
        contrasena: studentData.contrasena.trim()
      });

      if (res.success && res.estudiante) {
        // Recordar estudiante si la casilla está marcada
        if (rememberStudent && studentData.numero_cuenta.trim()) {
          safeStorage.setItem("histolab_remembered_student_account", studentData.numero_cuenta.trim());
          if (selectedCarrera) {
            safeStorage.setItem("histolab_remembered_student_carrera", selectedCarrera);
          }
        } else {
          safeStorage.removeItem("histolab_remembered_student_account");
          safeStorage.removeItem("histolab_remembered_student_carrera");
        }

        notify(res.message || `¡Bienvenido(a), ${res.estudiante.nombre_completo}!`, "success");
        if (onStudentLoginSuccess) {
          onStudentLoginSuccess(res.estudiante);
        } else if (onLoginSuccess) {
          onLoginSuccess(res.estudiante, "ESTUDIANTE");
        }
      }
    } catch (err) {
      const msg = err.message || "Credenciales incorrectas o estudiante no encontrado.";
      setErrorMsg(msg);
      notify(msg, "error");
    } finally {
      setLoading(false);
    }
  };

  // =========================================================================
  // LOGIN DE INSTRUCTOR
  // =========================================================================
  const handleInstructorLoginSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg("");
    setLoading(true);

    try {
      const res = await api.auth.login(instructorData);
      if (res.success) {
        if (rememberUser && instructorData.email.trim()) {
          safeStorage.setItem("histolab_remembered_email", instructorData.email.trim());
        } else {
          safeStorage.removeItem("histolab_remembered_email");
        }

        const displayName =
          res.instructor.nombre_completo ||
          `${res.instructor.primer_nombre || ""} ${res.instructor.primer_apellido || ""}`.trim() ||
          "Instructor";
        notify(res.message || `¡Bienvenido(a), ${displayName}!`, "success");
        onLoginSuccess(res.instructor, "INSTRUCTOR");
      }
    } catch (err) {
      setErrorMsg(err.message || "Error al iniciar sesión. Verifica tus credenciales.");
      notify(err.message || "Error de autenticación", "error");
    } finally {
      setLoading(false);
    }
  };



  return (
    <div
      className="login-card-container"
      style={{
        minHeight: "100vh",
        width: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "linear-gradient(135deg, #f0f9ff 0%, #f8fafc 40%, #e0f2fe 100%)",
        padding: "1.5rem 1rem",
        position: "relative",
        overflow: "hidden"
      }}
    >
      {/* Círculos decorativos de fondo */}
      <div
        style={{
          position: "absolute",
          top: "-10%",
          left: "10%",
          width: "480px",
          height: "480px",
          background: "radial-gradient(circle, rgba(2, 132, 199, 0.08) 0%, rgba(2, 132, 199, 0) 70%)",
          borderRadius: "50%",
          pointerEvents: "none"
        }}
      />
      <div
        style={{
          position: "absolute",
          bottom: "-10%",
          right: "10%",
          width: "440px",
          height: "440px",
          background: "radial-gradient(circle, rgba(14, 165, 233, 0.08) 0%, rgba(14, 165, 233, 0) 70%)",
          borderRadius: "50%",
          pointerEvents: "none"
        }}
      />

      <div
        style={{
          width: "100%",
          maxWidth: "460px",
          background: "#ffffff",
          border: "1px solid #e2e8f0",
          borderRadius: "1.35rem",
          boxShadow: "0 20px 45px -10px rgba(2, 132, 199, 0.15), 0 4px 12px rgba(0, 0, 0, 0.03)",
          overflow: "hidden",
          zIndex: 10
        }}
      >
        {/* Cabecera Principal con Logos Institucionales */}
        <div
          style={{
            padding: "1.75rem 1.5rem 1.15rem",
            textAlign: "center",
            background: "linear-gradient(180deg, #f0f9ff 0%, #ffffff 100%)",
            borderBottom: "1px solid #f1f5f9"
          }}
        >
          {/* Fila de Logos */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "1rem",
              marginBottom: "0.85rem",
              flexWrap: "wrap"
            }}
          >
            {/* Logo UNAH */}
            <div style={{ height: "36px", display: "flex", alignItems: "center" }} title="UNAH">
              <img
                src={universidadLogo}
                alt="UNAH"
                style={{ height: "34px", width: "auto", objectFit: "contain" }}
              />
            </div>

            {/* Logo Laboratorio */}
            <div
              style={{
                width: "42px",
                height: "42px",
                borderRadius: "50%",
                background: "#ffffff",
                boxShadow: "0 2px 8px rgba(0, 0, 0, 0.08)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                border: "1px solid #e2e8f0",
                overflow: "hidden"
              }}
            >
              <img
                src={laboratorioLogo}
                alt="Histolab"
                style={{ width: "32px", height: "32px", objectFit: "contain" }}
              />
            </div>

            {/* Logo Facultad */}
            <div style={{ height: "36px", display: "flex", alignItems: "center" }} title="Facultad de Ciencias Médicas">
              <img
                src={facultadLogo}
                alt="Facultad de Ciencias Médicas"
                style={{ height: "34px", width: "auto", objectFit: "contain" }}
              />
            </div>
          </div>

          <h1
            style={{
              fontSize: "1.35rem",
              fontWeight: 900,
              color: "#0f172a",
              margin: 0,
              letterSpacing: "-0.01em"
            }}
          >
            Registro HistoLab
          </h1>

          {/* Banner llamativo y elegante: Próximamente 2027 */}
          <div style={{ marginTop: "0.6rem" }}>
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "0.55rem",
                padding: "0.45rem 1.25rem",
                background: "linear-gradient(135deg, rgba(2, 132, 199, 0.08) 0%, rgba(14, 165, 233, 0.16) 100%)",
                border: "1.5px solid rgba(56, 189, 248, 0.5)",
                borderRadius: "9999px",
                boxShadow: "0 4px 16px -2px rgba(2, 132, 199, 0.18), inset 0 1px 0 rgba(255, 255, 255, 0.9)",
                backdropFilter: "blur(6px)"
              }}
            >
              <Sparkles size={19} style={{ color: "#0284c7" }} />
              <span
                style={{
                  fontSize: "1.15rem",
                  fontWeight: 900,
                  letterSpacing: "0.03em",
                  background: "linear-gradient(135deg, #0284c7 0%, #0369a1 60%, #075985 100%)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  textTransform: "uppercase"
                }}
              >
                Próximamente 2027
              </span>
              <Sparkles size={19} style={{ color: "#0284c7" }} />
            </div>
          </div>
        </div>

        {/* =================================================================== */}
        {/* SWITCHER / SELECTOR DOBLE: ESTUDIANTES VS INSTRUCTORES              */}
        {/* =================================================================== */}
        <div
          style={{
            padding: "0.85rem 1.25rem 0.35rem",
            background: "#ffffff"
          }}
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              background: "#f1f5f9",
              padding: "0.3rem",
              borderRadius: "0.85rem",
              gap: "0.35rem"
            }}
          >
            {/* Botón Tab: Estudiantes (Por defecto) */}
            <button
              type="button"
              onClick={() => {
                setActivePortal("ESTUDIANTE");
                setErrorMsg("");
              }}
              style={{
                border: "none",
                borderRadius: "0.65rem",
                padding: "0.6rem 0.5rem",
                background: activePortal === "ESTUDIANTE" ? "#ffffff" : "transparent",
                color: activePortal === "ESTUDIANTE" ? "#0284c7" : "#64748b",
                fontWeight: 800,
                fontSize: "0.83rem",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "0.45rem",
                boxShadow: activePortal === "ESTUDIANTE" ? "0 2px 8px rgba(0,0,0,0.06)" : "none",
                transition: "all 0.2s ease"
              }}
            >
              <GraduationCap size={16} />
              <span>Estudiantes</span>
            </button>

            {/* Botón Tab: Instructores */}
            <button
              type="button"
              onClick={() => {
                setActivePortal("INSTRUCTOR");
                setErrorMsg("");
              }}
              style={{
                border: "none",
                borderRadius: "0.65rem",
                padding: "0.6rem 0.5rem",
                background: activePortal === "INSTRUCTOR" ? "#ffffff" : "transparent",
                color: activePortal === "INSTRUCTOR" ? "#0f172a" : "#64748b",
                fontWeight: 800,
                fontSize: "0.83rem",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "0.45rem",
                boxShadow: activePortal === "INSTRUCTOR" ? "0 2px 8px rgba(0,0,0,0.06)" : "none",
                transition: "all 0.2s ease"
              }}
            >
              <Users size={16} />
              <span>Instructores</span>
            </button>
          </div>
        </div>

        {/* =================================================================== */}
        {/* MENSAJE DE ERROR GLOBAL                                             */}
        {/* =================================================================== */}
        {errorMsg && (
          <div style={{ padding: "0 1.25rem", marginTop: "0.65rem" }}>
            <div
              style={{
                background: "#fef2f2",
                border: "1px solid #fecdd3",
                borderRadius: "0.75rem",
                padding: "0.75rem 0.85rem",
                display: "flex",
                alignItems: "center",
                gap: "0.65rem",
                color: "#b91c1c",
                fontSize: "0.79rem",
                fontWeight: 600
              }}
            >
              <AlertCircle size={16} style={{ flexShrink: 0 }} />
              <span>{errorMsg}</span>
            </div>
          </div>
        )}

        {/* =================================================================== */}
        {/* CASO A: FORMULARIO DE ESTUDIANTES (DISEÑO SOLICITADO)               */}
        {/* =================================================================== */}
        {activePortal === "ESTUDIANTE" && (
          <form onSubmit={handleStudentLoginSubmit} style={{ padding: "1rem 1.5rem 1.75rem" }}>
            <div style={{ marginBottom: "1rem" }}>
              <h2 style={{ fontSize: "1.05rem", fontWeight: 800, color: "#0f172a", margin: "0 0 0.2rem 0" }}>
                Portal del Estudiante
              </h2>
              <span style={{ fontSize: "0.76rem", color: "#64748b" }}>
                Selecciona tu carrera y consulta tus calificaciones y asistencias.
              </span>
            </div>

            {/* PASO 1: ACORDEÓN DE SELECCIÓN DE CARRERA */}
            <div style={{ marginBottom: "1rem" }}>
              <label
                style={{
                  display: "block",
                  fontSize: "0.76rem",
                  fontWeight: 800,
                  color: "#334155",
                  marginBottom: "0.4rem",
                  textTransform: "uppercase",
                  letterSpacing: "0.02em"
                }}
              >
                1. Selecciona tu Carrera:
              </label>

              {/* Botón Cabecera del Acordeón */}
              <div
                onClick={() => setIsCareerAccordionOpen(!isCareerAccordionOpen)}
                style={{
                  background: currentCarreraObj ? currentCarreraObj.bg : "#f8fafc",
                  border: currentCarreraObj
                    ? `1.5px solid ${currentCarreraObj.border}`
                    : "1.5px dashed #cbd5e1",
                  borderRadius: isCareerAccordionOpen ? "0.75rem 0.75rem 0 0" : "0.75rem",
                  padding: "0.65rem 0.85rem",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  transition: "all 0.15s ease"
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
                  <div
                    style={{
                      width: "30px",
                      height: "30px",
                      borderRadius: "0.5rem",
                      background: currentCarreraObj ? currentCarreraObj.gradient : "#e2e8f0",
                      color: currentCarreraObj ? "#ffffff" : "#64748b",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center"
                    }}
                  >
                    {currentCarreraObj ? <currentCarreraObj.icon size={16} /> : <GraduationCap size={16} />}
                  </div>
                  <div>
                    <strong
                      style={{
                        fontSize: "0.88rem",
                        color: currentCarreraObj ? currentCarreraObj.color : "#64748b",
                        display: "block",
                        lineHeight: 1.2
                      }}
                    >
                      {currentCarreraObj ? currentCarreraObj.label : "Selecciona tu Carrera..."}
                    </strong>
                    <span style={{ fontSize: "0.7rem", color: "#64748b" }}>
                      {currentCarreraObj ? currentCarreraObj.desc : "Obligatorio para ingresar"}
                    </span>
                  </div>
                </div>

                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.4rem",
                    color: currentCarreraObj ? currentCarreraObj.color : "#64748b"
                  }}
                >
                  <span
                    style={{
                      fontSize: "0.72rem",
                      fontWeight: 800,
                      background: currentCarreraObj ? "transparent" : "#fef3c7",
                      color: currentCarreraObj ? currentCarreraObj.color : "#b45309",
                      padding: currentCarreraObj ? "0" : "0.15rem 0.45rem",
                      borderRadius: "0.35rem"
                    }}
                  >
                    {currentCarreraObj ? "Cambiar" : "Elegir"}
                  </span>
                  {isCareerAccordionOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                </div>
              </div>

              {/* Contenido desplegable del Acordeón con las 5 Carreras */}
              {isCareerAccordionOpen && (
                <div
                  style={{
                    background: "#ffffff",
                    border: currentCarreraObj
                      ? `1.5px solid ${currentCarreraObj.border}`
                      : "1.5px solid #cbd5e1",
                    borderTop: "none",
                    borderRadius: "0 0 0.75rem 0.75rem",
                    padding: "0.5rem",
                    display: "flex",
                    flexDirection: "column",
                    gap: "0.35rem",
                    boxShadow: "0 8px 20px -5px rgba(0, 0, 0, 0.08)"
                  }}
                >
                  {CARRERAS.map((c) => {
                    const isSelected = c.id === selectedCarrera;
                    const IconComp = c.icon;
                    return (
                      <div
                        key={c.id}
                        onClick={() => {
                          setSelectedCarrera(c.id);
                          setIsCareerAccordionOpen(false);
                          setErrorMsg("");
                        }}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          padding: "0.5rem 0.65rem",
                          borderRadius: "0.5rem",
                          background: isSelected ? c.bg : "#f8fafc",
                          border: isSelected ? `1.5px solid ${c.border}` : "1px solid #e2e8f0",
                          cursor: "pointer",
                          transition: "all 0.15s ease"
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: "0.55rem" }}>
                          <div
                            style={{
                              width: "26px",
                              height: "26px",
                              borderRadius: "0.4rem",
                              background: c.gradient,
                              color: "#ffffff",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center"
                            }}
                          >
                            <IconComp size={14} />
                          </div>
                          <div>
                            <span style={{ fontSize: "0.82rem", fontWeight: 800, color: "#0f172a", display: "block" }}>
                              {c.label}
                            </span>
                            <span style={{ fontSize: "0.68rem", color: "#64748b" }}>
                              {c.desc}
                            </span>
                          </div>
                        </div>

                        {isSelected && (
                          <div
                            style={{
                              width: "20px",
                              height: "20px",
                              borderRadius: "50%",
                              background: c.color,
                              color: "#ffffff",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center"
                            }}
                          >
                            <Check size={12} strokeWidth={3} />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* PASO 2: NÚMERO DE CUENTA */}
            <div style={{ marginBottom: "0.85rem" }}>
              <label
                style={{
                  display: "block",
                  fontSize: "0.76rem",
                  fontWeight: 800,
                  color: "#334155",
                  marginBottom: "0.35rem",
                  textTransform: "uppercase",
                  letterSpacing: "0.02em"
                }}
              >
                2. Número de Cuenta:
              </label>
              <div style={{ position: "relative" }}>
                <input
                  type="text"
                  inputMode="numeric"
                  placeholder="Ej. 20201001234"
                  value={studentData.numero_cuenta}
                  onChange={(e) => setStudentData({ ...studentData, numero_cuenta: e.target.value })}
                  style={{
                    width: "100%",
                    padding: "0.65rem 0.85rem",
                    borderRadius: "0.65rem",
                    border: "1.5px solid #cbd5e1",
                    background: "#ffffff",
                    fontSize: "0.88rem",
                    fontWeight: 700,
                    color: "#0f172a",
                    outline: "none",
                    transition: "border 0.2s"
                  }}
                  onFocus={(e) => (e.target.style.borderColor = currentCarreraObj ? currentCarreraObj.color : "#0284c7")}
                  onBlur={(e) => (e.target.style.borderColor = "#cbd5e1")}
                />
              </div>
            </div>

            {/* PASO 3: CONTRASEÑA */}
            <div style={{ marginBottom: "0.85rem" }}>
              <label
                style={{
                  display: "block",
                  fontSize: "0.76rem",
                  fontWeight: 800,
                  color: "#334155",
                  marginBottom: "0.35rem",
                  textTransform: "uppercase",
                  letterSpacing: "0.02em"
                }}
              >
                3. Contraseña:
              </label>
              <div style={{ position: "relative" }}>
                <input
                  type={showStudentPassword ? "text" : "password"}
                  placeholder="Contraseña de estudiante"
                  value={studentData.contrasena}
                  onChange={(e) => setStudentData({ ...studentData, contrasena: e.target.value })}
                  style={{
                    width: "100%",
                    padding: "0.65rem 2.4rem 0.65rem 0.85rem",
                    borderRadius: "0.65rem",
                    border: "1.5px solid #cbd5e1",
                    background: "#ffffff",
                    fontSize: "0.88rem",
                    color: "#0f172a",
                    outline: "none",
                    transition: "border 0.2s"
                  }}
                  onFocus={(e) => (e.target.style.borderColor = currentCarreraObj ? currentCarreraObj.color : "#0284c7")}
                  onBlur={(e) => (e.target.style.borderColor = "#cbd5e1")}
                />
                <button
                  type="button"
                  onClick={() => setShowStudentPassword(!showStudentPassword)}
                  style={{
                    position: "absolute",
                    right: "0.65rem",
                    top: "50%",
                    transform: "translateY(-50%)",
                    background: "none",
                    border: "none",
                    color: "#94a3b8",
                    cursor: "pointer",
                    padding: "0.2rem",
                    display: "flex",
                    alignItems: "center"
                  }}
                  title={showStudentPassword ? "Ocultar" : "Mostrar"}
                >
                  {showStudentPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {/* RECORDAR USUARIO ESTUDIANTE */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: "1.25rem",
                fontSize: "0.78rem"
              }}
            >
              <label style={{ display: "flex", alignItems: "center", gap: "0.4rem", color: "#475569", cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={rememberStudent}
                  onChange={(e) => setRememberStudent(e.target.checked)}
                  style={{ accentColor: currentCarreraObj ? currentCarreraObj.color : "#0284c7" }}
                />
                <span>Recordar número de cuenta y carrera</span>
              </label>
            </div>

            {/* BOTÓN ENTRAR ESTUDIANTE (Deshabilitado si no hay carrera seleccionada) */}
            <button
              type="submit"
              disabled={loading || !selectedCarrera}
              style={{
                width: "100%",
                padding: "0.75rem",
                background: !selectedCarrera
                  ? "#94a3b8"
                  : currentCarreraObj.gradient,
                color: "#ffffff",
                border: "none",
                borderRadius: "0.75rem",
                fontSize: "0.92rem",
                fontWeight: 900,
                cursor: loading || !selectedCarrera ? "not-allowed" : "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "0.5rem",
                boxShadow: !selectedCarrera ? "none" : `0 4px 14px ${currentCarreraObj.color}40`,
                opacity: loading || !selectedCarrera ? 0.65 : 1,
                transition: "all 0.2s ease"
              }}
              title={!selectedCarrera ? "Debes seleccionar tu carrera en el acordeón superior para habilitar el botón" : "Iniciar sesión"}
            >
              {loading ? (
                <span>Ingresando al Portal...</span>
              ) : !selectedCarrera ? (
                <span>Selecciona una Carrera para Continuar</span>
              ) : (
                <>
                  <span>Ingresar como Estudiante ({currentCarreraObj.label})</span>
                  <ArrowRight size={16} />
                </>
              )}
            </button>

            {/* Créditos y Copyright */}
            <div
              style={{
                marginTop: "1.25rem",
                paddingTop: "0.85rem",
                borderTop: "1px solid #f1f5f9",
                textAlign: "center"
              }}
            >
              <p style={{ margin: 0, fontSize: "0.75rem", color: "#64748b", fontWeight: 600 }}>
                Hecho por <span style={{ color: "#0f172a", fontWeight: 700 }}>Elam Lagos</span>
              </p>
              <p style={{ margin: "0.25rem 0 0 0", fontSize: "0.7rem", color: "#94a3b8" }}>
                © {new Date().getFullYear()} Registro HistoLab • Todos los derechos reservados
              </p>
            </div>
          </form>
        )}

        {/* =================================================================== */}
        {/* CASO B: FORMULARIO DE INSTRUCTORES (SE MANTIENE IGUAL)              */}
        {/* =================================================================== */}
        {activePortal === "INSTRUCTOR" && (
          <form onSubmit={handleInstructorLoginSubmit} style={{ padding: "1rem 1.5rem 1.75rem" }}>
            <div style={{ marginBottom: "1rem" }}>
              <h2 style={{ fontSize: "1.05rem", fontWeight: 800, color: "#0f172a", margin: "0 0 0.2rem 0" }}>
                Acceso de los Instructores
              </h2>
              <span style={{ fontSize: "0.76rem", color: "#64748b" }}>
                Ingresa con tu correo institucional y contraseña docente.
              </span>
            </div>

            {/* Correo */}
            <div style={{ marginBottom: "0.85rem" }}>
              <label
                style={{
                  display: "block",
                  fontSize: "0.76rem",
                  fontWeight: 800,
                  color: "#334155",
                  marginBottom: "0.35rem",
                  textTransform: "uppercase"
                }}
              >
                Correo Institucional:
              </label>
              <div style={{ position: "relative" }}>
                <div
                  style={{
                    position: "absolute",
                    left: "0.85rem",
                    top: "50%",
                    transform: "translateY(-50%)",
                    color: "#94a3b8",
                    display: "flex",
                    pointerEvents: "none"
                  }}
                >
                  <Mail size={16} />
                </div>
                <input
                  type="email"
                  placeholder="ejemplo@unah.edu.hn"
                  value={instructorData.email}
                  onChange={(e) => setInstructorData({ ...instructorData, email: e.target.value })}
                  style={{
                    width: "100%",
                    padding: "0.65rem 0.85rem 0.65rem 2.3rem",
                    borderRadius: "0.65rem",
                    border: "1.5px solid #cbd5e1",
                    fontSize: "0.88rem",
                    color: "#0f172a",
                    outline: "none"
                  }}
                />
              </div>
            </div>

            {/* Contraseña */}
            <div style={{ marginBottom: "0.85rem" }}>
              <label
                style={{
                  display: "block",
                  fontSize: "0.76rem",
                  fontWeight: 800,
                  color: "#334155",
                  marginBottom: "0.35rem",
                  textTransform: "uppercase"
                }}
              >
                Contraseña:
              </label>
              <div style={{ position: "relative" }}>
                <div
                  style={{
                    position: "absolute",
                    left: "0.85rem",
                    top: "50%",
                    transform: "translateY(-50%)",
                    color: "#94a3b8",
                    display: "flex",
                    pointerEvents: "none"
                  }}
                >
                  <Lock size={16} />
                </div>
                <input
                  type={showInstructorPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={instructorData.password}
                  onChange={(e) => setInstructorData({ ...instructorData, password: e.target.value })}
                  style={{
                    width: "100%",
                    padding: "0.65rem 2.4rem 0.65rem 2.3rem",
                    borderRadius: "0.65rem",
                    border: "1.5px solid #cbd5e1",
                    fontSize: "0.88rem",
                    color: "#0f172a",
                    outline: "none"
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowInstructorPassword(!showInstructorPassword)}
                  style={{
                    position: "absolute",
                    right: "0.65rem",
                    top: "50%",
                    transform: "translateY(-50%)",
                    background: "none",
                    border: "none",
                    color: "#94a3b8",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center"
                  }}
                >
                  {showInstructorPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {/* Recordar usuario */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: "1.25rem",
                fontSize: "0.78rem"
              }}
            >
              <label style={{ display: "flex", alignItems: "center", gap: "0.4rem", color: "#475569", cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={rememberUser}
                  onChange={(e) => setRememberUser(e.target.checked)}
                  style={{ accentColor: "#0284c7" }}
                />
                <span>Recordar usuario</span>
              </label>
            </div>

            {/* Botón Ingresar Instructor */}
            <button
              type="submit"
              disabled={loading}
              style={{
                width: "100%",
                padding: "0.75rem",
                background: "linear-gradient(135deg, #0284c7 0%, #0369a1 100%)",
                color: "#ffffff",
                border: "none",
                borderRadius: "0.75rem",
                fontSize: "0.92rem",
                fontWeight: 900,
                cursor: loading ? "not-allowed" : "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "0.5rem",
                boxShadow: "0 4px 14px rgba(2, 132, 199, 0.25)",
                opacity: loading ? 0.7 : 1
              }}
            >
              {loading ? (
                <span>Iniciando sesión...</span>
              ) : (
                <>
                  <span>Iniciar Sesión como Instructor</span>
                  <ArrowRight size={16} />
                </>
              )}
            </button>

            {/* Créditos y Copyright */}
            <div
              style={{
                marginTop: "1.25rem",
                paddingTop: "0.85rem",
                borderTop: "1px solid #f1f5f9",
                textAlign: "center"
              }}
            >
              <p style={{ margin: 0, fontSize: "0.75rem", color: "#64748b", fontWeight: 600 }}>
                Hecho por <span style={{ color: "#0f172a", fontWeight: 700 }}>Elam Lagos</span>
              </p>
              <p style={{ margin: "0.25rem 0 0 0", fontSize: "0.7rem", color: "#94a3b8" }}>
                © {new Date().getFullYear()} Registro HistoLab • Todos los derechos reservados
              </p>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
