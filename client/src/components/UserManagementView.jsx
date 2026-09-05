import React, { useState, useEffect, useCallback } from "react";
import {
  Users,
  UserPlus,
  Edit3,
  Trash2,
  Search,
  CheckCircle2,
  XCircle,
  RefreshCw,
  ArrowLeft,
  Shield,
  Laptop
} from "lucide-react";
import { api } from "../services/api";
import UserManagementModal from "./UserManagementModal";

export default function UserManagementView({ currentInstructor, onClose, notify = () => {} }) {
  const [instructorsList, setInstructorsList] = useState([]);
  const [loadingInstructors, setLoadingInstructors] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  // Control del modal de creación / edición / borrado
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState("create"); // 'create' | 'edit' | 'delete'
  const [selectedInstructorForModal, setSelectedInstructorForModal] = useState(null);

  const loadInstructores = useCallback(async () => {
    setLoadingInstructors(true);
    try {
      const res = await api.auth.getInstructores();
      if (res?.data) {
        setInstructorsList(res.data);
      }
    } catch (err) {
      console.warn("Error al cargar instructores:", err);
    } finally {
      setLoadingInstructors(false);
    }
  }, []);

  useEffect(() => {
    loadInstructores();
  }, [loadInstructores]);

  const handleOpenModal = (mode, targetInst = null) => {
    setModalMode(mode);
    setSelectedInstructorForModal(targetInst);
    setModalOpen(true);
  };

  const filteredInstructors = instructorsList.filter((inst) => {
    const searchLower = searchTerm.toLowerCase();
    const instName = `${inst.primer_nombre || ''} ${inst.primer_apellido || ''}`.toLowerCase();
    const instEmail = (inst.correo || '').toLowerCase();
    const instAccount = (inst.numero_cuenta || '').toLowerCase();
    const instRole = (inst.rol || '').toLowerCase();
    return (
      instName.includes(searchLower) ||
      instEmail.includes(searchLower) ||
      instAccount.includes(searchLower) ||
      instRole.includes(searchLower)
    );
  });

  const totalActivos = instructorsList.filter((i) => i.activo).length;

  return (
    <div className="animate-fade-in" style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      {/* Barra Superior de Navegación del Módulo */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: "1rem"
        }}
      >
        <button
          onClick={onClose}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "0.5rem",
            padding: "0.6rem 1.1rem",
            borderRadius: "0.75rem",
            background: "#ffffff",
            border: "1px solid #cbd5e1",
            color: "#334155",
            fontSize: "0.88rem",
            fontWeight: 700,
            cursor: "pointer",
            boxShadow: "var(--shadow-sm)",
            transition: "all 0.15s ease"
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = "#f1f5f9";
            e.currentTarget.style.color = "#0f172a";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "#ffffff";
            e.currentTarget.style.color = "#334155";
          }}
        >
          <ArrowLeft size={17} />
          Volver al Dashboard
        </button>

        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <div
            style={{
              background: "#f0f9ff",
              border: "1px solid #bae6fd",
              padding: "0.45rem 0.95rem",
              borderRadius: "9999px",
              fontSize: "0.82rem",
              fontWeight: 700,
              color: "#0369a1",
              display: "flex",
              alignItems: "center",
              gap: "0.4rem"
            }}
          >
            <Users size={15} />
            <span>{instructorsList.length} Registrados ({totalActivos} Activos)</span>
          </div>

          <button
            onClick={loadInstructores}
            disabled={loadingInstructors}
            style={{
              background: "#ffffff",
              border: "1px solid #cbd5e1",
              borderRadius: "0.6rem",
              padding: "0.5rem 0.75rem",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              color: "#64748b",
              transition: "all 0.15s ease"
            }}
            title="Actualizar lista de instructores"
          >
            <RefreshCw size={15} className={loadingInstructors ? "animate-spin" : ""} />
          </button>
        </div>
      </div>

      {/* Contenedor Principal del Módulo */}
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
        {/* Cabecera */}
        <div style={{ display: "flex", alignItems: "center", gap: "0.85rem" }}>
          <div
            style={{
              width: "48px",
              height: "48px",
              borderRadius: "1rem",
              background: "linear-gradient(135deg, #0284c7 0%, #0369a1 100%)",
              color: "#ffffff",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "0 6px 16px rgba(2, 132, 199, 0.25)"
            }}
          >
            <Users size={24} />
          </div>
          <div>
            <h2 style={{ fontSize: "1.4rem", fontWeight: 800, color: "#0f172a", margin: 0, letterSpacing: "-0.01em" }}>
              Módulo de Administración de Usuarios
            </h2>
            <span style={{ fontSize: "0.85rem", color: "#64748b" }}>
              Gestión centralizada de cuentas de instructores, permisos y accesos del portal
            </span>
          </div>
        </div>

        {/* 🌟 TRES BOTONES PRINCIPALES: CREAR, EDITAR, BORRAR */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
            gap: "1rem"
          }}
        >
          {/* Botón 1: Crear Usuario */}
          <button
            onClick={() => handleOpenModal("create")}
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
              boxShadow: "0 6px 16px rgba(2, 132, 199, 0.25)",
              transition: "transform 0.15s ease, box-shadow 0.15s ease",
              textAlign: "left"
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = "translateY(-2px)";
              e.currentTarget.style.boxShadow = "0 10px 20px rgba(2, 132, 199, 0.35)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = "translateY(0)";
              e.currentTarget.style.boxShadow = "0 6px 16px rgba(2, 132, 199, 0.25)";
            }}
          >
            <div
              style={{
                width: "40px",
                height: "40px",
                borderRadius: "0.6rem",
                background: "rgba(255, 255, 255, 0.2)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0
              }}
            >
              <UserPlus size={20} />
            </div>
            <div>
              <strong style={{ display: "block", fontSize: "0.98rem", fontWeight: 800 }}>Crear Usuario</strong>
              <span style={{ fontSize: "0.78rem", opacity: 0.9 }}>Registrar nuevo instructor</span>
            </div>
          </button>

          {/* Botón 2: Editar Usuario */}
          <button
            onClick={() => handleOpenModal("edit")}
            style={{
              padding: "1.1rem 1.25rem",
              borderRadius: "0.85rem",
              border: "1px solid #fed7aa",
              background: "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)",
              color: "#ffffff",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "0.85rem",
              boxShadow: "0 6px 16px rgba(217, 119, 6, 0.25)",
              transition: "transform 0.15s ease, box-shadow 0.15s ease",
              textAlign: "left"
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = "translateY(-2px)";
              e.currentTarget.style.boxShadow = "0 10px 20px rgba(217, 119, 6, 0.35)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = "translateY(0)";
              e.currentTarget.style.boxShadow = "0 6px 16px rgba(217, 119, 6, 0.25)";
            }}
          >
            <div
              style={{
                width: "40px",
                height: "40px",
                borderRadius: "0.6rem",
                background: "rgba(255, 255, 255, 0.2)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0
              }}
            >
              <Edit3 size={20} />
            </div>
            <div>
              <strong style={{ display: "block", fontSize: "0.98rem", fontWeight: 800 }}>Editar Usuario</strong>
              <span style={{ fontSize: "0.78rem", opacity: 0.9 }}>Modificar datos o clave</span>
            </div>
          </button>

          {/* Botón 3: Borrar Usuario */}
          <button
            onClick={() => handleOpenModal("delete")}
            style={{
              padding: "1.1rem 1.25rem",
              borderRadius: "0.85rem",
              border: "1px solid #fecaca",
              background: "linear-gradient(135deg, #ef4444 0%, #dc2626 100%)",
              color: "#ffffff",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "0.85rem",
              boxShadow: "0 6px 16px rgba(220, 38, 38, 0.25)",
              transition: "transform 0.15s ease, box-shadow 0.15s ease",
              textAlign: "left"
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = "translateY(-2px)";
              e.currentTarget.style.boxShadow = "0 10px 20px rgba(220, 38, 38, 0.35)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = "translateY(0)";
              e.currentTarget.style.boxShadow = "0 6px 16px rgba(220, 38, 38, 0.25)";
            }}
          >
            <div
              style={{
                width: "40px",
                height: "40px",
                borderRadius: "0.6rem",
                background: "rgba(255, 255, 255, 0.2)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0
              }}
            >
              <Trash2 size={20} />
            </div>
            <div>
              <strong style={{ display: "block", fontSize: "0.98rem", fontWeight: 800 }}>Borrar Usuario</strong>
              <span style={{ fontSize: "0.78rem", opacity: 0.9 }}>Dar de baja una cuenta</span>
            </div>
          </button>
        </div>

        {/* Barra de Búsqueda y Filtro de Usuarios */}
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <div style={{ position: "relative", flex: 1 }}>
            <Search size={16} color="#94a3b8" style={{ position: "absolute", left: "0.85rem", top: "50%", transform: "translateY(-50%)" }} />
            <input
              type="text"
              placeholder="Buscar por nombre, no. cuenta, correo o rol..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{
                width: "100%",
                padding: "0.65rem 0.85rem 0.65rem 2.3rem",
                borderRadius: "0.6rem",
                border: "1px solid #cbd5e1",
                fontSize: "0.88rem",
                outline: "none",
                boxSizing: "border-box",
                background: "#f8fafc"
              }}
            />
          </div>
        </div>

        {/* Tabla de Usuarios Registrados */}
        <div
          style={{
            border: "1px solid #e2e8f0",
            borderRadius: "0.85rem",
            overflow: "hidden",
            background: "#ffffff"
          }}
        >
          {loadingInstructors ? (
            <div style={{ padding: "2.5rem", textAlign: "center", color: "#64748b", fontSize: "0.9rem" }}>
              Cargando instructores registrados...
            </div>
          ) : filteredInstructors.length === 0 ? (
            <div style={{ padding: "2.5rem", textAlign: "center", color: "#64748b", fontSize: "0.9rem" }}>
              {searchTerm ? "No se encontraron instructores que coincidan con la búsqueda." : "No hay instructores registrados aún."}
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "0.86rem" }}>
                <thead>
                  <tr style={{ background: "#f8fafc", borderBottom: "1px solid #e2e8f0", color: "#475569" }}>
                    <th style={{ padding: "0.8rem 1rem", fontWeight: 700 }}>Instructor</th>
                    <th style={{ padding: "0.8rem 1rem", fontWeight: 700 }}>No. Cuenta</th>
                    <th style={{ padding: "0.8rem 1rem", fontWeight: 700 }}>Correo</th>
                    <th style={{ padding: "0.8rem 1rem", fontWeight: 700 }}>Rol & Sección</th>
                    <th style={{ padding: "0.8rem 1rem", fontWeight: 700 }}>Estado</th>
                    <th style={{ padding: "0.8rem 1rem", fontWeight: 700, textAlign: "right" }}>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredInstructors.map((inst) => {
                    const isSelf = inst.id === currentInstructor?.id;
                    const instFullName = `${inst.primer_nombre || ''} ${inst.segundo_nombre ? inst.segundo_nombre + ' ' : ''}${inst.primer_apellido || ''} ${inst.segundo_apellido || ''}`.trim() || "Instructor";

                    return (
                      <tr
                        key={inst.id}
                        style={{
                          borderBottom: "1px solid #f1f5f9",
                          transition: "background 0.15s ease"
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = "#f8fafc")}
                        onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                      >
                        <td style={{ padding: "0.8rem 1rem" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
                            <div
                              style={{
                                width: "34px",
                                height: "34px",
                                borderRadius: "50%",
                                background: isSelf ? "#0284c7" : "#64748b",
                                color: "#ffffff",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                fontWeight: 700,
                                fontSize: "0.82rem",
                                flexShrink: 0
                              }}
                            >
                              {(inst.primer_nombre || "I").charAt(0)}
                            </div>
                            <div>
                              <strong style={{ color: "#0f172a", display: "block" }}>
                                {instFullName}
                              </strong>
                              {isSelf && (
                                <span style={{ fontSize: "0.72rem", color: "#0284c7", fontWeight: 700 }}>
                                  (Tu sesión activa)
                                </span>
                              )}
                            </div>
                          </div>
                        </td>

                        <td style={{ padding: "0.8rem 1rem", color: "#334155", fontWeight: 600 }}>
                          {inst.numero_cuenta || "—"}
                        </td>

                        <td style={{ padding: "0.8rem 1rem", color: "#64748b" }}>
                          {inst.correo}
                        </td>

                        <td style={{ padding: "0.8rem 1rem" }}>
                          {(() => {
                            const isCreador = inst.rol === "Creador";
                            const isCoord = inst.rol === "Coordinador";
                            const isAdmin = inst.rol === "Administrador";

                            return (
                              <span
                                style={{
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: "0.25rem",
                                  padding: isCreador ? "0.25rem 0.65rem" : "0.2rem 0.55rem",
                                  borderRadius: "9999px",
                                  fontSize: "0.75rem",
                                  fontWeight: 800,
                                  background: isCreador
                                    ? "linear-gradient(135deg, #7c3aed 0%, #4f46e5 100%)"
                                    : isAdmin
                                    ? "#fef3c7"
                                    : isCoord
                                    ? "#ccfbf1"
                                    : "#e0f2fe",
                                  color: isCreador
                                    ? "#ffffff"
                                    : isAdmin
                                    ? "#b45309"
                                    : isCoord
                                    ? "#0f766e"
                                    : "#0369a1",
                                  border: isCreador
                                    ? "1px solid #6d28d9"
                                    : isAdmin
                                    ? "1px solid #fde68a"
                                    : isCoord
                                    ? "1px solid #99f6e4"
                                    : "1px solid #bae6fd",
                                  boxShadow: isCreador ? "0 2px 8px rgba(124, 58, 237, 0.25)" : "none"
                                }}
                              >
                                {isCreador && <Laptop size={13} />}
                                {inst.rol || "Instructor"} {inst.seccion ? `• Sec. ${inst.seccion}` : ""}
                              </span>
                            );
                          })()}
                        </td>

                        <td style={{ padding: "0.8rem 1rem" }}>
                          {inst.activo ? (
                            <span style={{ color: "#059669", fontWeight: 700, fontSize: "0.78rem", display: "inline-flex", alignItems: "center", gap: "0.3rem" }}>
                              <CheckCircle2 size={14} /> Activo
                            </span>
                          ) : (
                            <span style={{ color: "#dc2626", fontWeight: 700, fontSize: "0.78rem", display: "inline-flex", alignItems: "center", gap: "0.3rem" }}>
                              <XCircle size={14} /> Inactivo
                            </span>
                          )}
                        </td>

                        <td style={{ padding: "0.8rem 1rem", textAlign: "right" }}>
                          <div style={{ display: "inline-flex", gap: "0.4rem" }}>
                            {/* Botón Editar directo */}
                            <button
                              onClick={() => handleOpenModal("edit", inst)}
                              disabled={inst.rol === "Creador"}
                              style={{
                                background: inst.rol === "Creador" ? "#f1f5f9" : "#fef3c7",
                                border: `1px solid ${inst.rol === "Creador" ? "#e2e8f0" : "#fde68a"}`,
                                color: inst.rol === "Creador" ? "#94a3b8" : "#b45309",
                                borderRadius: "0.4rem",
                                padding: "0.35rem 0.6rem",
                                cursor: inst.rol === "Creador" ? "not-allowed" : "pointer",
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "0.25rem",
                                fontSize: "0.78rem",
                                fontWeight: 700
                              }}
                              title={
                                inst.rol === "Creador"
                                  ? "La cuenta del Creador está blindada y no se puede modificar"
                                  : "Editar este instructor"
                              }
                            >
                              <Edit3 size={13} />
                              Editar
                            </button>

                            {/* Botón Borrar directo */}
                            <button
                              onClick={() => handleOpenModal("delete", inst)}
                              disabled={isSelf || inst.rol === "Creador"}
                              style={{
                                background: isSelf || inst.rol === "Creador" ? "#f1f5f9" : "#fee2e2",
                                border: `1px solid ${isSelf || inst.rol === "Creador" ? "#e2e8f0" : "#fecaca"}`,
                                color: isSelf || inst.rol === "Creador" ? "#94a3b8" : "#dc2626",
                                borderRadius: "0.4rem",
                                padding: "0.35rem 0.6rem",
                                cursor: isSelf || inst.rol === "Creador" ? "not-allowed" : "pointer",
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "0.25rem",
                                fontSize: "0.78rem",
                                fontWeight: 700
                              }}
                              title={
                                isSelf
                                  ? "No puedes borrar tu propia cuenta activa"
                                  : inst.rol === "Creador"
                                  ? "La cuenta del Creador está protegida y no puede ser eliminada"
                                  : "Borrar este instructor"
                              }
                            >
                              <Trash2 size={13} />
                              Borrar
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* MODAL DE ACCIONES: CREAR / EDITAR / BORRAR */}
      {modalOpen && (
        <UserManagementModal
          mode={modalMode}
          instructors={instructorsList}
          selectedInstructor={selectedInstructorForModal}
          currentInstructor={currentInstructor}
          onClose={() => setModalOpen(false)}
          onSuccess={() => {
            loadInstructores();
          }}
          notify={notify}
        />
      )}
    </div>
  );
}
