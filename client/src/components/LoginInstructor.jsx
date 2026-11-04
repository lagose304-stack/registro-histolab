import React, { useState } from "react";
import { AlertCircle, ArrowRight, Eye, EyeOff, GraduationCap, Users } from "lucide-react";
import { api } from "../services/api";
import { safeStorage } from "../utils/safeStorage";
import laboratorioLogo from "../assets/logos/laboratorio.png";
import "./LoginInstructor.css";

const CARRERAS = [
  ["Medicina", "Medicina"],
  ["Enfermeria", "Enfermería"],
  ["Odontologia", "Odontología"],
  ["Microbiologia", "Microbiología"],
  ["Nutricion", "Nutrición"]
];

const PORTALS = [
  { id: "ESTUDIANTE", label: "Estudiantes", Icon: GraduationCap },
  { id: "INSTRUCTOR", label: "Instructores", Icon: Users }
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


  // =========================================================================
  // LOGIN DE ESTUDIANTE
  // =========================================================================
  const handleStudentLoginSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg("");

    if (!selectedCarrera) {
      setErrorMsg("Selecciona tu carrera antes de ingresar.");
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



  const isStudent = activePortal === "ESTUDIANTE";
  const showPassword = isStudent ? showStudentPassword : showInstructorPassword;
  const setShowPassword = isStudent ? setShowStudentPassword : setShowInstructorPassword;

  return (
    <main className="histolab-login">
      <div className="histolab-login__layout">
        <header className="histolab-login__brand">
          <div className="histolab-login__specimen" aria-hidden="true">
            <span />
            <span />
            <span />
          </div>
          <div className="histolab-login__identity">
            <img src={laboratorioLogo} width="52" height="52" alt="" />
            <p className="histolab-login__eyebrow">Laboratorio de Histología<br />UNAH</p>
          </div>
          <h1><span>Registro</span> HistoLab</h1>
          <p className="histolab-login__badge">Próximamente 2027</p>
        </header>

        <section className="histolab-login__card" aria-labelledby="login-title">
          <h2 id="login-title">Iniciar sesión</h2>
          <p className="histolab-login__hint">Selecciona tu perfil para ingresar.</p>

          <div className="histolab-login__profiles" role="group" aria-label="Perfil de acceso">
            {PORTALS.map(({ id, label, Icon }) => (
              <button
                key={id}
                type="button"
                aria-pressed={activePortal === id}
                disabled={loading}
                onClick={() => {
                  setActivePortal(id);
                  setErrorMsg("");
                  setShowStudentPassword(false);
                  setShowInstructorPassword(false);
                }}
              >
                <Icon size={19} aria-hidden="true" />
                {label}
              </button>
            ))}
          </div>

          <form onSubmit={isStudent ? handleStudentLoginSubmit : handleInstructorLoginSubmit} aria-busy={loading}>
            {isStudent && (
              <label className="histolab-login__field">
                Carrera
                <select value={selectedCarrera} onChange={(e) => setSelectedCarrera(e.target.value)} required>
                  <option value="" disabled>Selecciona tu carrera</option>
                  {CARRERAS.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
                </select>
              </label>
            )}

            {isStudent ? (
              <label key="account" className="histolab-login__field">
                Número de cuenta
                <input
                  name="numero_cuenta"
                  type="text"
                  inputMode="numeric"
                  autoComplete="username"
                  placeholder="Ej. 20201001234"
                  value={studentData.numero_cuenta}
                  onChange={(e) => setStudentData({ ...studentData, numero_cuenta: e.target.value })}
                  required
                />
              </label>
            ) : (
              <label key="email" className="histolab-login__field">
                Correo electrónico
                <input
                  name="email"
                  type="email"
                  autoComplete="username"
                  autoCapitalize="none"
                  placeholder="ejemplo@unah.edu.hn"
                  value={instructorData.email}
                  onChange={(e) => setInstructorData({ ...instructorData, email: e.target.value })}
                  required
                />
              </label>
            )}

            <div className="histolab-login__field">
              <label htmlFor="histolab-login-password">Contraseña</label>
              <div className="histolab-login__password">
                <input
                  key={activePortal}
                  id="histolab-login-password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  autoCapitalize="none"
                  spellCheck={false}
                  value={isStudent ? studentData.contrasena : instructorData.password}
                  onChange={(e) => {
                    if (isStudent) setStudentData({ ...studentData, contrasena: e.target.value });
                    else setInstructorData({ ...instructorData, password: e.target.value });
                  }}
                  required
                />
                <button
                  type="button"
                  aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff size={19} /> : <Eye size={19} />}
                </button>
              </div>
            </div>

            <label className="histolab-login__remember">
              <input
                type="checkbox"
                checked={isStudent ? rememberStudent : rememberUser}
                onChange={(e) => (isStudent ? setRememberStudent : setRememberUser)(e.target.checked)}
              />
              {isStudent ? "Recordar mi cuenta y carrera" : "Recordar mi correo"}
            </label>

            {errorMsg && (
              <p className="histolab-login__error" role="alert">
                <AlertCircle size={18} aria-hidden="true" />
                {errorMsg}
              </p>
            )}

            <button className="histolab-login__submit" type="submit" disabled={loading}>
              {loading ? "Iniciando sesión…" : "Ingresar"}
              {!loading && <ArrowRight size={19} aria-hidden="true" />}
            </button>
          </form>
        </section>

        <footer className="histolab-login__footer">
          Registro HistoLab · Hecho por Elam Lagos · © {new Date().getFullYear()}
        </footer>
      </div>
    </main>
  );
}
