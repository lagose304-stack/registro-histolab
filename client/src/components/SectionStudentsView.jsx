import React, { useState, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import {
  ArrowLeft,
  GraduationCap,
  PlusCircle,
  Edit3,
  Trash2,
  Search,
  KeyRound,
  User,
  Hash,
  Eye,
  EyeOff,
  CheckCircle2,
  Clock,
  Calendar,
  AlertCircle,
  RefreshCw,
  X,
  FileSpreadsheet
} from "lucide-react";
import { api } from "../services/api";
import SectionGradebookView from "./SectionGradebookView";
import { getNavState, setNavState } from "../utils/navigationState";

export default function SectionStudentsView({
  seccion,
  onClose = () => {},
  notify = () => {}
}) {
  const initialNav = getNavState();
  const [estudiantes, setEstudiantes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [showGradebook, setShowGradebookState] = useState(() => Boolean(initialNav.showGradebook));

  const setShowGradebook = (val) => {
    setShowGradebookState(val);
    setNavState({ showGradebook: val });
  };

  // Control de Modales de Acción (Añadir / Editar / Borrar)
  const [modalMode, setModalMode] = useState(null); // null | 'create' | 'edit' | 'delete'
  const [selectedStudent, setSelectedStudent] = useState(null);

  // Formulario
  const [formData, setFormData] = useState({
    numero_cuenta: "",
    nombre_completo: "",
    contrasena: "histolab123"
  });
  const [showPassword, setShowPassword] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  // Cargar estudiantes de la sección
  const loadEstudiantes = useCallback(async () => {
    if (!seccion?.id) return;
    setLoading(true);
    try {
      const res = await api.estudiantes.getBySeccion(seccion.id);
      if (res?.data) {
        setEstudiantes(res.data);
      }
    } catch (err) {
      console.error("Error al cargar estudiantes:", err);
      notify("Error al cargar estudiantes de la sección", "error");
    } finally {
      setLoading(false);
    }
  }, [seccion?.id, notify]);

  useEffect(() => {
    loadEstudiantes();
  }, [loadEstudiantes]);

  // Abrir Modal
  const handleOpenModal = (mode, student = null) => {
    setModalMode(mode);
    setSelectedStudent(student);
    setFormError("");

    if (mode === "create") {
      setFormData({
        numero_cuenta: "",
        nombre_completo: "",
        contrasena: "histolab123"
      });
    } else if (mode === "edit" && student) {
      setFormData({
        numero_cuenta: student.numero_cuenta || "",
        nombre_completo: student.nombre_completo || "",
        contrasena: student.contrasena || "histolab123"
      });
    }
  };

  const handleCloseModal = () => {
    setModalMode(null);
    setSelectedStudent(null);
    setFormError("");
  };

  // Guardar (Crear o Editar)
  const handleSave = async (e) => {
    e.preventDefault();
    setFormError("");

    if (!formData.numero_cuenta.trim()) {
      setFormError("El número de cuenta es obligatorio.");
      return;
    }
    if (!formData.nombre_completo.trim()) {
      setFormError("El nombre completo del estudiante es obligatorio.");
      return;
    }
    if (!formData.contrasena.trim()) {
      setFormError("La contraseña no puede estar vacía.");
      return;
    }

    setSaving(true);
    try {
      if (modalMode === "create") {
        await api.estudiantes.create({
          seccion_id: seccion.id,
          numero_cuenta: formData.numero_cuenta.trim(),
          nombre_completo: formData.nombre_completo.trim(),
          contrasena: formData.contrasena.trim()
        });
        notify("Estudiante matriculado con éxito", "success");
      } else if (modalMode === "edit" && selectedStudent) {
        await api.estudiantes.update(seccion.id, selectedStudent.numero_cuenta, {
          nombre_completo: formData.nombre_completo.trim(),
          nuevo_numero_cuenta: formData.numero_cuenta.trim(),
          contrasena: formData.contrasena.trim()
        });
        notify("Estudiante actualizado con éxito", "success");
      }

      handleCloseModal();
      loadEstudiantes();
    } catch (err) {
      console.error("Error al guardar estudiante:", err);
      setFormError(err.message || "Error al procesar la solicitud.");
    } finally {
      setSaving(false);
    }
  };

  // Borrar Estudiante
  const handleDelete = async () => {
    if (!selectedStudent) return;
    setSaving(true);
    try {
      await api.estudiantes.delete(seccion.id, selectedStudent.numero_cuenta);
      notify("Estudiante eliminado de la sección", "success");
      handleCloseModal();
      loadEstudiantes();
    } catch (err) {
      console.error("Error al eliminar estudiante:", err);
      notify("Error al eliminar estudiante", "error");
    } finally {
      setSaving(false);
    }
  };

  // Filtrado de estudiantes
  const filteredEstudiantes = estudiantes.filter((est) => {
    const s = searchTerm.toLowerCase().trim();
    if (!s) return true;
    return (
      (est.numero_cuenta || "").toLowerCase().includes(s) ||
      (est.nombre_completo || "").toLowerCase().includes(s)
    );
  });

  // Si se abre el cuadro de notas de la sección
  if (showGradebook) {
    return (
      <SectionGradebookView
        seccion={seccion}
        onClose={() => setShowGradebook(false)}
        notify={notify}
      />
    );
  }

  return (
    <div className="animate-fade-in" style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      {/* Barra Superior con Encabezado de la Sección */}
      <div
        className="glass-panel"
        style={{
          padding: "1.5rem 1.75rem",
          background: "linear-gradient(135deg, #ffffff 0%, #f5f3ff 100%)",
          border: "1px solid #ddd6fe",
          borderRadius: "1.25rem",
          boxShadow: "0 8px 25px -5px rgba(124, 58, 237, 0.08)",
          display: "flex",
          flexDirection: "column",
          gap: "1.25rem"
        }}
      >
        {/* Fila 1: Botón Volver, Badge y Botón Ver Cuadro de Notas */}
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
            <span>Volver a Secciones</span>
          </button>

          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap" }}>
            {/* 🌟 BOTÓN VER CUADRO DE NOTAS */}
            <button
              onClick={() => setShowGradebook(true)}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "0.45rem",
                background: "linear-gradient(135deg, #16a34a 0%, #15803d 100%)",
                border: "none",
                color: "#ffffff",
                padding: "0.5rem 1.15rem",
                borderRadius: "0.65rem",
                fontSize: "0.85rem",
                fontWeight: 800,
                cursor: "pointer",
                boxShadow: "0 4px 12px rgba(22, 163, 74, 0.25)",
                transition: "all 0.15s ease"
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = "translateY(-1px)";
                e.currentTarget.style.boxShadow = "0 6px 16px rgba(22, 163, 74, 0.35)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = "translateY(0)";
                e.currentTarget.style.boxShadow = "0 4px 12px rgba(22, 163, 74, 0.25)";
              }}
            >
              <FileSpreadsheet size={16} />
              <span>Ver Cuadro de Notas</span>
            </button>

            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "0.45rem",
                background: "linear-gradient(135deg, #f5f3ff 0%, #ede9fe 100%)",
                border: "1.5px solid #ddd6fe",
                color: "#7c3aed",
                padding: "0.4rem 0.85rem",
                borderRadius: "9999px",
                fontSize: "0.82rem",
                fontWeight: 800,
                boxShadow: "0 2px 6px rgba(124, 58, 237, 0.1)"
              }}
            >
              <GraduationCap size={15} color="#7c3aed" />
              <span>Administración de Estudiantes</span>
            </div>
          </div>
        </div>

        {/* Fila 2: Código, Carrera, Horario y Botón Ver Cuadro de Notas */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "1rem" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", marginBottom: "0.35rem" }}>
              <span
                style={{
                  background: "linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%)",
                  color: "#ffffff",
                  fontWeight: 900,
                  fontSize: "1.1rem",
                  padding: "0.3rem 0.85rem",
                  borderRadius: "0.55rem",
                  letterSpacing: "0.04em",
                  boxShadow: "0 2px 8px rgba(124, 58, 237, 0.25)"
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
              Matrícula y Estudiantes - Sección {seccion.codigo}
            </h1>
          </div>

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
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", color: "#7c3aed" }}>
              <Clock size={18} />
              <div style={{ display: "flex", flexDirection: "column" }}>
                <span style={{ fontSize: "0.68rem", color: "#64748b", fontWeight: 700, textTransform: "uppercase" }}>Horario</span>
                <strong style={{ fontSize: "0.92rem", color: "#0f172a" }}>{seccion.dia} {seccion.hora_inicio} - {seccion.hora_fin || "Fin"}</strong>
              </div>
            </div>

            <div style={{ height: "26px", width: "1px", background: "#e2e8f0" }} />

            <div style={{ display: "flex", flexDirection: "column" }}>
              <span style={{ fontSize: "0.68rem", color: "#64748b", fontWeight: 700, textTransform: "uppercase" }}>Coordinador</span>
              <strong style={{ fontSize: "0.86rem", color: "#334155" }}>{seccion.coordinador || "Sin asignar"}</strong>
            </div>
          </div>
        </div>
      </div>

      {/* Contenedor Principal de Gestión de Estudiantes */}
      <div
        className="glass-panel"
        style={{
          background: "#ffffff",
          borderRadius: "1.25rem",
          border: "1px solid #e2e8f0",
          boxShadow: "0 10px 30px -5px rgba(0, 0, 0, 0.05)",
          padding: "1.75rem",
          display: "flex",
          flexDirection: "column",
          gap: "1.5rem"
        }}
      >
        {/* =================================================================== */}
        {/* 🌟 3 BOTONES DE ACCIÓN: AÑADIR, EDITAR, BORRAR */}
        {/* =================================================================== */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
            gap: "1rem"
          }}
        >
          <button
            onClick={() => handleOpenModal("create")}
            style={{
              padding: "1.1rem 1.25rem",
              borderRadius: "0.85rem",
              border: "1px solid #c4b5fd",
              background: "linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%)",
              color: "#ffffff",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "0.85rem",
              textAlign: "left",
              boxShadow: "0 4px 12px rgba(124, 58, 237, 0.25)",
              transition: "all 0.15s ease"
            }}
          >
            <PlusCircle size={24} />
            <div>
              <strong style={{ display: "block", fontSize: "0.98rem", fontWeight: 800 }}>Añadir Estudiante</strong>
              <span style={{ fontSize: "0.78rem", opacity: 0.9 }}>Matricular nuevo alumno</span>
            </div>
          </button>

          <button
            onClick={() => {
              if (estudiantes.length === 0) {
                notify("No hay estudiantes registrados para editar", "info");
                return;
              }
              handleOpenModal("edit", estudiantes[0]);
            }}
            style={{
              padding: "1.1rem 1.25rem",
              borderRadius: "0.85rem",
              border: "1px solid #bae6fd",
              background: "linear-gradient(135deg, #0284c7 0%, #0369a1 100%)",
              color: "#ffffff",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "0.85rem",
              textAlign: "left",
              boxShadow: "0 4px 12px rgba(2, 132, 199, 0.25)",
              transition: "all 0.15s ease"
            }}
          >
            <Edit3 size={24} />
            <div>
              <strong style={{ display: "block", fontSize: "0.98rem", fontWeight: 800 }}>Editar Estudiante</strong>
              <span style={{ fontSize: "0.78rem", opacity: 0.9 }}>Modificar cuenta o nombre</span>
            </div>
          </button>

          <button
            onClick={() => {
              if (estudiantes.length === 0) {
                notify("No hay estudiantes registrados para borrar", "info");
                return;
              }
              handleOpenModal("delete", estudiantes[0]);
            }}
            style={{
              padding: "1.1rem 1.25rem",
              borderRadius: "0.85rem",
              border: "1px solid #fecaca",
              background: "linear-gradient(135deg, #e11d48 0%, #be123c 100%)",
              color: "#ffffff",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "0.85rem",
              textAlign: "left",
              boxShadow: "0 4px 12px rgba(225, 29, 72, 0.25)",
              transition: "all 0.15s ease"
            }}
          >
            <Trash2 size={24} />
            <div>
              <strong style={{ display: "block", fontSize: "0.98rem", fontWeight: 800 }}>Borrar Estudiante</strong>
              <span style={{ fontSize: "0.78rem", opacity: 0.9 }}>Eliminar de la sección</span>
            </div>
          </button>
        </div>

        {/* Buscador y Resumen */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "1rem" }}>
          <div style={{ position: "relative", flex: 1, minWidth: "260px" }}>
            <Search size={16} color="#94a3b8" style={{ position: "absolute", left: "0.85rem", top: "50%", transform: "translateY(-50%)" }} />
            <input
              type="text"
              placeholder="Buscar por número de cuenta o nombre completo..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{
                width: "100%",
                padding: "0.65rem 0.85rem 0.65rem 2.3rem",
                borderRadius: "0.6rem",
                border: "1px solid #cbd5e1",
                fontSize: "0.88rem",
                outline: "none",
                background: "#f8fafc"
              }}
            />
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
            <span
              style={{
                background: "#f5f3ff",
                color: "#7c3aed",
                fontWeight: 800,
                fontSize: "0.82rem",
                padding: "0.4rem 0.85rem",
                borderRadius: "9999px",
                border: "1px solid #ddd6fe"
              }}
            >
              {estudiantes.length} {estudiantes.length === 1 ? "Estudiante Matriculado" : "Estudiantes Matriculados"}
            </span>

            <button
              onClick={loadEstudiantes}
              disabled={loading}
              style={{
                background: "#ffffff",
                border: "1px solid #cbd5e1",
                borderRadius: "0.6rem",
                padding: "0.55rem 0.75rem",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                color: "#64748b"
              }}
              title="Actualizar listado de estudiantes"
            >
              <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
            </button>
          </div>
        </div>

        {/* Tabla de Estudiantes */}
        {loading ? (
          <div style={{ padding: "3rem", textAlign: "center", color: "#64748b", fontSize: "0.9rem" }}>
            Cargando lista de estudiantes...
          </div>
        ) : filteredEstudiantes.length === 0 ? (
          <div
            style={{
              background: "#f8fafc",
              border: "1.5px dashed #cbd5e1",
              borderRadius: "1rem",
              padding: "3.5rem 2rem",
              textAlign: "center",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: "0.8rem",
              color: "#64748b"
            }}
          >
            <div
              style={{
                width: "56px",
                height: "56px",
                borderRadius: "50%",
                background: "#f5f3ff",
                color: "#7c3aed",
                display: "flex",
                alignItems: "center",
                justifyContent: "center"
              }}
            >
              <GraduationCap size={28} />
            </div>
            <strong style={{ fontSize: "1.1rem", color: "#0f172a" }}>
              {searchTerm ? "No se encontraron estudiantes" : "No hay estudiantes matriculados en esta sección"}
            </strong>
            <p style={{ fontSize: "0.88rem", margin: 0, maxWidth: "480px", lineHeight: 1.45 }}>
              {searchTerm
                ? "Intenta con otro número de cuenta o nombre en la barra de búsqueda."
                : 'Presiona el botón "Añadir Estudiante" para comenzar a matricular alumnos.'}
            </p>
          </div>
        ) : (
          <div style={{ overflowX: "auto", border: "1px solid #e2e8f0", borderRadius: "0.85rem" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
              <thead>
                <tr style={{ background: "#f8fafc", borderBottom: "1px solid #e2e8f0" }}>
                  <th style={{ padding: "0.8rem 1rem", fontSize: "0.78rem", fontWeight: 800, color: "#475569", width: "50px" }}>#</th>
                  <th style={{ padding: "0.8rem 1rem", fontSize: "0.78rem", fontWeight: 800, color: "#475569" }}>No. Cuenta</th>
                  <th style={{ padding: "0.8rem 1rem", fontSize: "0.78rem", fontWeight: 800, color: "#475569" }}>Nombre Completo</th>
                  <th style={{ padding: "0.8rem 1rem", fontSize: "0.78rem", fontWeight: 800, color: "#475569" }}>Contraseña</th>
                  <th style={{ padding: "0.8rem 1rem", fontSize: "0.78rem", fontWeight: 800, color: "#475569", textAlign: "center" }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filteredEstudiantes.map((est, idx) => (
                  <tr
                    key={est.numero_cuenta}
                    style={{
                      background: idx % 2 === 0 ? "#ffffff" : "#fafbff",
                      borderBottom: "1px solid #f1f5f9"
                    }}
                  >
                    <td style={{ padding: "0.8rem 1rem", fontSize: "0.8rem", color: "#64748b", fontWeight: 700 }}>
                      {idx + 1}
                    </td>
                    <td style={{ padding: "0.8rem 1rem", fontWeight: 900, color: "#0f172a", fontSize: "0.9rem" }}>
                      {est.numero_cuenta}
                    </td>
                    <td style={{ padding: "0.8rem 1rem", fontWeight: 700, color: "#334155", fontSize: "0.88rem" }}>
                      {est.nombre_completo}
                    </td>
                    <td style={{ padding: "0.8rem 1rem", fontSize: "0.82rem", color: "#64748b" }}>
                      <span
                        style={{
                          background: "#f1f5f9",
                          padding: "0.2rem 0.5rem",
                          borderRadius: "4px",
                          fontFamily: "monospace",
                          fontSize: "0.82rem"
                        }}
                      >
                        {est.contrasena || "histolab123"}
                      </span>
                    </td>
                    <td style={{ padding: "0.8rem 1rem", textAlign: "center" }}>
                      <div style={{ display: "inline-flex", gap: "0.4rem" }}>
                        <button
                          onClick={() => handleOpenModal("edit", est)}
                          style={{
                            background: "#e0f2fe",
                            border: "1px solid #bae6fd",
                            color: "#0369a1",
                            borderRadius: "0.45rem",
                            padding: "0.35rem 0.65rem",
                            fontSize: "0.78rem",
                            fontWeight: 700,
                            cursor: "pointer",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "0.3rem"
                          }}
                          title="Editar datos del estudiante"
                        >
                          <Edit3 size={13} />
                          Editar
                        </button>

                        <button
                          onClick={() => handleOpenModal("delete", est)}
                          style={{
                            background: "#fee2e2",
                            border: "1px solid #fecaca",
                            color: "#dc2626",
                            borderRadius: "0.45rem",
                            padding: "0.35rem 0.65rem",
                            fontSize: "0.78rem",
                            fontWeight: 700,
                            cursor: "pointer",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "0.3rem"
                          }}
                          title="Eliminar estudiante"
                        >
                          <Trash2 size={13} />
                          Borrar
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* =================================================================== */}
      {/* 📝 MODAL: AÑADIR / EDITAR ESTUDIANTE */}
      {/* =================================================================== */}
      {/* =================================================================== */}
      {/* 📝 MODAL: AÑADIR / EDITAR ESTUDIANTE */}
      {/* =================================================================== */}
      {(modalMode === "create" || modalMode === "edit") &&
        createPortal(
          <div
            style={{
              position: "fixed",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              width: "100vw",
              height: "100vh",
              backgroundColor: "rgba(15, 23, 42, 0.65)",
              backdropFilter: "blur(8px)",
              WebkitBackdropFilter: "blur(8px)",
              zIndex: 99999999,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "1rem",
              boxSizing: "border-box"
            }}
            onClick={(e) => {
              if (e.target === e.currentTarget && !saving) handleCloseModal();
            }}
          >
            <div
              className="glass-panel animate-scale-up"
              style={{
                background: "#ffffff",
                borderRadius: "1.5rem",
                maxWidth: "500px",
                width: "100%",
                overflow: "hidden",
                boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
                border: "1px solid #e2e8f0"
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Cabecera del Modal */}
              <div
                style={{
                  padding: "1.25rem 1.5rem",
                  background: modalMode === "create"
                    ? "linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%)"
                    : "linear-gradient(135deg, #0284c7 0%, #0369a1 100%)",
                  color: "#ffffff",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between"
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
                  {modalMode === "create" ? <PlusCircle size={22} /> : <Edit3 size={22} />}
                  <h3 style={{ fontSize: "1.15rem", fontWeight: 800, margin: 0, color: "#ffffff" }}>
                    {modalMode === "create" ? "Añadir Nuevo Estudiante" : "Editar Estudiante"}
                  </h3>
                </div>

                <button
                  onClick={handleCloseModal}
                  disabled={saving}
                  style={{
                    background: "rgba(255, 255, 255, 0.2)",
                    border: "none",
                    borderRadius: "50%",
                    width: "32px",
                    height: "32px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "#ffffff",
                    cursor: "pointer"
                  }}
                >
                  <X size={16} />
                </button>
              </div>

              {/* Formulario */}
              <form onSubmit={handleSave} style={{ padding: "1.5rem", display: "flex", flexDirection: "column", gap: "1.15rem" }}>
                {formError && (
                  <div
                    style={{
                      background: "#fee2e2",
                      border: "1px solid #fecaca",
                      color: "#b91c1c",
                      padding: "0.75rem 1rem",
                      borderRadius: "0.65rem",
                      fontSize: "0.85rem",
                      display: "flex",
                      alignItems: "center",
                      gap: "0.5rem"
                    }}
                  >
                    <AlertCircle size={16} style={{ flexShrink: 0 }} />
                    <span>{formError}</span>
                  </div>
                )}

                {/* Campo 1: Número de Cuenta */}
                <div>
                  <label style={{ display: "block", fontSize: "0.82rem", fontWeight: 800, color: "#334155", marginBottom: "0.4rem" }}>
                    1. Número de Cuenta *
                  </label>
                  <div style={{ position: "relative" }}>
                    <Hash size={16} color="#94a3b8" style={{ position: "absolute", left: "0.85rem", top: "50%", transform: "translateY(-50%)" }} />
                    <input
                      type="text"
                      required
                      placeholder="Ej. 20211001234"
                      value={formData.numero_cuenta}
                      onChange={(e) => setFormData({ ...formData, numero_cuenta: e.target.value })}
                      style={{
                        width: "100%",
                        padding: "0.7rem 0.85rem 0.7rem 2.4rem",
                        borderRadius: "0.6rem",
                        border: "1px solid #cbd5e1",
                        fontSize: "0.9rem",
                        outline: "none"
                      }}
                    />
                  </div>
                </div>

                {/* Campo 2: Nombre Completo */}
                <div>
                  <label style={{ display: "block", fontSize: "0.82rem", fontWeight: 800, color: "#334155", marginBottom: "0.4rem" }}>
                    2. Nombre Completo del Estudiante *
                  </label>
                  <div style={{ position: "relative" }}>
                    <User size={16} color="#94a3b8" style={{ position: "absolute", left: "0.85rem", top: "50%", transform: "translateY(-50%)" }} />
                    <input
                      type="text"
                      required
                      placeholder="Ej. Juan Carlos Pérez Rodríguez"
                      value={formData.nombre_completo}
                      onChange={(e) => setFormData({ ...formData, nombre_completo: e.target.value })}
                      style={{
                        width: "100%",
                        padding: "0.7rem 0.85rem 0.7rem 2.4rem",
                        borderRadius: "0.6rem",
                        border: "1px solid #cbd5e1",
                        fontSize: "0.9rem",
                        outline: "none"
                      }}
                    />
                  </div>
                </div>

                {/* Campo 3: Contraseña */}
                <div>
                  <label style={{ display: "block", fontSize: "0.82rem", fontWeight: 800, color: "#334155", marginBottom: "0.4rem" }}>
                    3. Contraseña de Acceso *
                  </label>
                  <div style={{ position: "relative" }}>
                    <KeyRound size={16} color="#94a3b8" style={{ position: "absolute", left: "0.85rem", top: "50%", transform: "translateY(-50%)" }} />
                    <input
                      type={showPassword ? "text" : "password"}
                      required
                      placeholder="Contraseña del estudiante"
                      value={formData.contrasena}
                      onChange={(e) => setFormData({ ...formData, contrasena: e.target.value })}
                      style={{
                        width: "100%",
                        padding: "0.7rem 2.6rem 0.7rem 2.4rem",
                        borderRadius: "0.6rem",
                        border: "1px solid #cbd5e1",
                        fontSize: "0.9rem",
                        outline: "none"
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      style={{
                        position: "absolute",
                        right: "0.75rem",
                        top: "50%",
                        transform: "translateY(-50%)",
                        background: "transparent",
                        border: "none",
                        color: "#64748b",
                        cursor: "pointer"
                      }}
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                  <span style={{ fontSize: "0.74rem", color: "#64748b", marginTop: "0.25rem", display: "block" }}>
                    Por defecto: <strong>histolab123</strong>
                  </span>
                </div>

                {/* Botones de Acción del Modal */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: "0.75rem", marginTop: "0.5rem" }}>
                  <button
                    type="button"
                    onClick={handleCloseModal}
                    disabled={saving}
                    style={{
                      padding: "0.6rem 1.15rem",
                      borderRadius: "0.6rem",
                      border: "1px solid #cbd5e1",
                      background: "#ffffff",
                      color: "#475569",
                      fontSize: "0.88rem",
                      fontWeight: 700,
                      cursor: "pointer"
                    }}
                  >
                    Cancelar
                  </button>

                  <button
                    type="submit"
                    disabled={saving}
                    style={{
                      padding: "0.6rem 1.25rem",
                      borderRadius: "0.6rem",
                      border: "none",
                      background: modalMode === "create"
                        ? "linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%)"
                        : "linear-gradient(135deg, #0284c7 0%, #0369a1 100%)",
                      color: "#ffffff",
                      fontSize: "0.88rem",
                      fontWeight: 800,
                      cursor: "pointer",
                      boxShadow: "0 2px 8px rgba(0,0,0,0.15)"
                    }}
                  >
                    {saving ? "Guardando..." : modalMode === "create" ? "Matricular Estudiante" : "Guardar Cambios"}
                  </button>
                </div>
              </form>
            </div>
          </div>,
          document.body
        )}

      {/* =================================================================== */}
      {/* 🗑️ MODAL: CONFIRMAR BORRADO DE ESTUDIANTE */}
      {/* =================================================================== */}
      {modalMode === "delete" &&
        createPortal(
          <div
            style={{
              position: "fixed",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              width: "100vw",
              height: "100vh",
              backgroundColor: "rgba(15, 23, 42, 0.65)",
              backdropFilter: "blur(8px)",
              WebkitBackdropFilter: "blur(8px)",
              zIndex: 99999999,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "1rem",
              boxSizing: "border-box"
            }}
            onClick={(e) => {
              if (e.target === e.currentTarget && !saving) handleCloseModal();
            }}
          >
            <div
              className="glass-panel animate-scale-up"
              style={{
                background: "#ffffff",
                borderRadius: "1.5rem",
                maxWidth: "480px",
                width: "100%",
                overflow: "hidden",
                boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
                border: "1px solid #e2e8f0",
                padding: "1.75rem",
                display: "flex",
                flexDirection: "column",
                gap: "1.25rem"
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                <div
                  style={{
                    width: "44px",
                    height: "44px",
                    borderRadius: "50%",
                    background: "#fee2e2",
                    color: "#dc2626",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center"
                  }}
                >
                  <Trash2 size={22} />
                </div>
                <div>
                  <h3 style={{ fontSize: "1.2rem", fontWeight: 800, margin: 0, color: "#0f172a" }}>
                    Eliminar Estudiante
                  </h3>
                  <span style={{ fontSize: "0.82rem", color: "#64748b" }}>
                    ¿Estás seguro de que deseas desmatricular a este estudiante?
                  </span>
                </div>
              </div>

              {/* Selector si hay varios o confirmación */}
              <div>
                <label style={{ display: "block", fontSize: "0.82rem", fontWeight: 800, color: "#334155", marginBottom: "0.4rem" }}>
                  Selecciona el estudiante a eliminar:
                </label>
                <select
                  value={selectedStudent?.numero_cuenta || ""}
                  onChange={(e) => {
                    const found = estudiantes.find((est) => est.numero_cuenta === e.target.value);
                    setSelectedStudent(found || null);
                  }}
                  style={{
                    width: "100%",
                    padding: "0.65rem 0.85rem",
                    borderRadius: "0.6rem",
                    border: "1px solid #cbd5e1",
                    fontSize: "0.88rem",
                    background: "#ffffff"
                  }}
                >
                  {estudiantes.map((est) => (
                    <option key={est.numero_cuenta} value={est.numero_cuenta}>
                      {est.numero_cuenta} - {est.nombre_completo}
                    </option>
                  ))}
                </select>
              </div>

              <div
                style={{
                  background: "#fef2f2",
                  border: "1px solid #fecaca",
                  borderRadius: "0.65rem",
                  padding: "0.75rem",
                  fontSize: "0.8rem",
                  color: "#991b1b"
                }}
              >
                ⚠️ Al eliminar al estudiante se borrarán sus registros y notas asociadas a la sección {seccion.codigo}.
              </div>

              <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: "0.75rem" }}>
                <button
                  type="button"
                  onClick={handleCloseModal}
                  disabled={saving}
                  style={{
                    padding: "0.6rem 1.15rem",
                    borderRadius: "0.6rem",
                    border: "1px solid #cbd5e1",
                    background: "#ffffff",
                    color: "#475569",
                    fontSize: "0.88rem",
                    fontWeight: 700,
                    cursor: "pointer"
                  }}
                >
                  Cancelar
                </button>

                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={saving || !selectedStudent}
                  style={{
                    padding: "0.6rem 1.25rem",
                    borderRadius: "0.6rem",
                    border: "none",
                    background: "linear-gradient(135deg, #e11d48 0%, #be123c 100%)",
                    color: "#ffffff",
                    fontSize: "0.88rem",
                    fontWeight: 800,
                    cursor: "pointer",
                    boxShadow: "0 2px 8px rgba(225, 29, 72, 0.25)"
                  }}
                >
                  {saving ? "Eliminando..." : "Sí, Eliminar Estudiante"}
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}
