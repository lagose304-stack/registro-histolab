import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import {
  X,
  UserPlus,
  Edit3,
  Trash2,
  Lock,
  Eye,
  EyeOff,
  AlertTriangle,
  Laptop
} from "lucide-react";
import { api } from "../services/api";

export default function UserManagementModal({
  mode = "create", // 'create' | 'edit' | 'delete'
  instructors = [],
  selectedInstructor = null,
  currentInstructor = null,
  onClose,
  onSuccess,
  notify
}) {
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [targetId, setTargetId] = useState(selectedInstructor?.id || "");
  const [deleteConfirmText, setDeleteConfirmText] = useState("");

  const [formData, setFormData] = useState({
    numero_cuenta: "",
    primer_nombre: "",
    segundo_nombre: "",
    primer_apellido: "",
    segundo_apellido: "",
    correo: "",
    password: "",
    rol: "Instructor",
    comite: "",
    seccion: "",
    coordinacion: "",
    activo: true
  });

  const resetForm = () => {
    setFormData({
      numero_cuenta: "",
      primer_nombre: "",
      segundo_nombre: "",
      primer_apellido: "",
      segundo_apellido: "",
      correo: "",
      password: "",
      rol: "Instructor",
      comite: "",
      seccion: "",
      coordinacion: "",
      activo: true
    });
    setDeleteConfirmText("");
  };

  useEffect(() => {
    if (mode === "create") {
      resetForm();
      setTargetId("");
    } else if (selectedInstructor && selectedInstructor.rol !== "Creador") {
      setTargetId(selectedInstructor.id);
      loadInstructorToForm(selectedInstructor);
    } else {
      setTargetId("");
      resetForm();
    }
  }, [mode, selectedInstructor]);

  const loadInstructorToForm = (instructor) => {
    if (!instructor) return;
    setFormData({
      numero_cuenta: instructor.numero_cuenta || "",
      primer_nombre: instructor.primer_nombre || "",
      segundo_nombre: instructor.segundo_nombre || "",
      primer_apellido: instructor.primer_apellido || "",
      segundo_apellido: instructor.segundo_apellido || "",
      correo: instructor.correo || "",
      password: "", // Contraseña vacía por defecto al editar
      rol: instructor.rol || "Instructor",
      comite: instructor.comite || "",
      seccion: instructor.seccion || "",
      coordinacion: instructor.coordinacion || "",
      activo: instructor.activo !== undefined ? instructor.activo : true
    });
  };

  const handleSelectInstructor = (id) => {
    setTargetId(id);
    if (!id) {
      resetForm();
      return;
    }
    const found = instructors.find((i) => i.id === id);
    if (found) {
      loadInstructorToForm(found);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (mode === "create") {
        if (!formData.primer_nombre || !formData.primer_apellido || !formData.correo || !formData.numero_cuenta || !formData.password) {
          throw new Error("Por favor completa todos los campos requeridos (Nombre, Apellido, Cuenta, Correo y Contraseña).");
        }
        if (formData.password.length < 6) {
          throw new Error("La contraseña debe tener al menos 6 caracteres.");
        }

        const res = await api.auth.createInstructor(formData);
        notify(res.message || "Usuario instructor creado con éxito.", "success");
        onSuccess && onSuccess();
        onClose();
      } else if (mode === "edit") {
        if (!targetId) {
          throw new Error("Por favor selecciona un instructor de la lista para editar.");
        }

        const selectedInst = instructors.find((i) => i.id === targetId);
        if (selectedInst?.rol === "Creador") {
          throw new Error("La cuenta con rol de Creador está protegida y no se puede modificar.");
        }

        const updatePayload = { ...formData };
        if (!updatePayload.password) {
          delete updatePayload.password;
        }

        const res = await api.auth.updateInstructor(targetId, updatePayload);
        notify(res.message || "Usuario instructor actualizado con éxito.", "success");
        onSuccess && onSuccess();
        onClose();
      } else if (mode === "delete") {
        if (!targetId) {
          throw new Error("Selecciona un instructor para eliminar.");
        }
        if (targetId === currentInstructor?.id) {
          throw new Error("No puedes eliminar tu propia cuenta en sesión activa.");
        }

        const selectedInst = instructors.find((i) => i.id === targetId);
        if (selectedInst?.rol === "Creador") {
          throw new Error("La cuenta con rol de Creador está protegida y no puede ser eliminada.");
        }

        const expectedConfirm = selectedInst?.numero_cuenta || "ELIMINAR";
        if (deleteConfirmText.trim() !== expectedConfirm.trim()) {
          throw new Error(`Para confirmar, debes escribir el número de cuenta: ${expectedConfirm}`);
        }

        const res = await api.auth.deleteInstructor(targetId);
        notify(res.message || "Usuario instructor eliminado con éxito.", "success");
        onSuccess && onSuccess();
        onClose();
      }
    } catch (err) {
      notify(err.message || "Ocurrió un error al procesar la solicitud.", "error");
    } finally {
      setLoading(false);
    }
  };

  const selectedInstObj = instructors.find((i) => i.id === targetId);

  const inputStyle = {
    width: "100%",
    boxSizing: "border-box",
    padding: "0.65rem 0.85rem",
    borderRadius: "0.55rem",
    border: "1px solid #cbd5e1",
    fontSize: "0.88rem",
    color: "#0f172a",
    background: "#ffffff",
    outline: "none"
  };

  const labelStyle = {
    display: "block",
    fontSize: "0.8rem",
    fontWeight: 700,
    color: "#334155",
    marginBottom: "0.35rem"
  };

  // Renderizar usando React Portal en document.body para evitar clipping con la barra superior
  return createPortal(
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        width: "100vw",
        height: "100vh",
        backgroundColor: "rgba(15, 23, 42, 0.7)",
        backdropFilter: "blur(8px)",
        WebkitBackdropFilter: "blur(8px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 999999,
        padding: "1rem",
        boxSizing: "border-box"
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          background: "#ffffff",
          borderRadius: "1.25rem",
          width: "100%",
          maxWidth: "680px",
          maxHeight: "88vh",
          display: "flex",
          flexDirection: "column",
          boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.35)",
          border: "1px solid #e2e8f0",
          overflow: "hidden",
          position: "relative",
          zIndex: 1000000
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Encabezado Único del Modal según la acción abierta */}
        <div
          style={{
            padding: "1.2rem 1.5rem",
            borderBottom: "1px solid #e2e8f0",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            background:
              mode === "create"
                ? "linear-gradient(135deg, #f0f9ff 0%, #ffffff 100%)"
                : mode === "edit"
                ? "linear-gradient(135deg, #fffbeb 0%, #ffffff 100%)"
                : "linear-gradient(135deg, #fff1f2 0%, #ffffff 100%)",
            flexShrink: 0
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
            <div
              style={{
                width: "42px",
                height: "42px",
                borderRadius: "0.75rem",
                background:
                  mode === "create"
                    ? "#e0f2fe"
                    : mode === "edit"
                    ? "#fef3c7"
                    : "#fee2e2",
                color:
                  mode === "create"
                    ? "#0284c7"
                    : mode === "edit"
                    ? "#d97706"
                    : "#dc2626",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0
              }}
            >
              {mode === "create" && <UserPlus size={22} />}
              {mode === "edit" && <Edit3 size={22} />}
              {mode === "delete" && <Trash2 size={22} />}
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: "1.2rem", fontWeight: 800, color: "#0f172a" }}>
                {mode === "create" && "Crear Nuevo Usuario"}
                {mode === "edit" && "Editar Usuario"}
                {mode === "delete" && "Eliminar Usuario"}
              </h2>
              <span style={{ fontSize: "0.8rem", color: "#64748b" }}>
                {mode === "create" && "Registrar un nuevo instructor al sistema con sus credenciales"}
                {mode === "edit" && "Modificar datos, asignación o contraseña del instructor"}
                {mode === "delete" && "Dar de baja y eliminar permanentemente la cuenta de un instructor"}
              </span>
            </div>
          </div>

          <button
            onClick={onClose}
            style={{
              background: "#f1f5f9",
              border: "none",
              borderRadius: "50%",
              width: "34px",
              height: "34px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              color: "#64748b",
              transition: "all 0.15s ease",
              flexShrink: 0
            }}
            title="Cerrar ventana"
          >
            <X size={18} />
          </button>
        </div>

        {/* Cuerpo del Formulario con Scroll interno */}
        <div style={{ flex: 1, overflowY: "auto", padding: "1.5rem" }}>
          <form id="user-mgmt-form" onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "1.1rem" }}>
            {/* Selector de Instructor (Solo para Editar o Borrar) */}
            {(mode === "edit" || mode === "delete") && (
              <div
                style={{
                  background: mode === "delete" ? "#fff1f2" : "#f0f9ff",
                  border: `1px solid ${mode === "delete" ? "#fecdd3" : "#bae6fd"}`,
                  borderRadius: "0.75rem",
                  padding: "1rem"
                }}
              >
                <label style={{ display: "block", fontSize: "0.82rem", fontWeight: 700, color: mode === "delete" ? "#9f1239" : "#0369a1", marginBottom: "0.4rem" }}>
                  Seleccionar Instructor a {mode === "edit" ? "Modificar" : "Eliminar"}:
                </label>
                <select
                  value={targetId}
                  onChange={(e) => handleSelectInstructor(e.target.value)}
                  style={{
                    width: "100%",
                    boxSizing: "border-box",
                    padding: "0.65rem 0.85rem",
                    borderRadius: "0.5rem",
                    border: "1px solid #cbd5e1",
                    background: "#ffffff",
                    fontSize: "0.9rem",
                    color: "#0f172a",
                    fontWeight: 600,
                    outline: "none"
                  }}
                >
                  <option value="">
                    {mode === "edit" ? "-- Selecciona un usuario a editar --" : "-- Selecciona un usuario a eliminar --"}
                  </option>
                  {instructors.map((inst) => {
                    const isCurrent = inst.id === currentInstructor?.id;
                    const isCreador = inst.rol === "Creador";
                    const nameStr = `${inst.primer_nombre} ${inst.primer_apellido} (${inst.numero_cuenta || inst.correo})${isCreador ? " 💻 [Creador - Blindado]" : ""}${isCurrent ? " - [Tu Sesión Actual]" : ""}`;
                    return (
                      <option
                        key={inst.id}
                        value={inst.id}
                        disabled={isCreador || (mode === "delete" && isCurrent)}
                      >
                        {nameStr}
                      </option>
                    );
                  })}
                </select>
              </div>
            )}

            {/* MODO CREAR Y MODO EDITAR */}
            {(mode === "create" || mode === "edit") && (
              <>
                {/* Nombres */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                  <div>
                    <label style={labelStyle}>
                      Primer Nombre <span style={{ color: "#e11d48" }}>*</span>
                    </label>
                    <input
                      type="text"
                      required
                      autoComplete="off"
                      name="inst_primer_nombre"
                      placeholder="Ej. Carlos"
                      value={formData.primer_nombre}
                      onChange={(e) => setFormData({ ...formData, primer_nombre: e.target.value })}
                      style={inputStyle}
                    />
                  </div>
                  <div>
                    <label style={labelStyle}>Segundo Nombre</label>
                    <input
                      type="text"
                      autoComplete="off"
                      name="inst_segundo_nombre"
                      placeholder="Ej. Alberto"
                      value={formData.segundo_nombre}
                      onChange={(e) => setFormData({ ...formData, segundo_nombre: e.target.value })}
                      style={inputStyle}
                    />
                  </div>
                </div>

                {/* Apellidos */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                  <div>
                    <label style={labelStyle}>
                      Primer Apellido <span style={{ color: "#e11d48" }}>*</span>
                    </label>
                    <input
                      type="text"
                      required
                      autoComplete="off"
                      name="inst_primer_apellido"
                      placeholder="Ej. Rivera"
                      value={formData.primer_apellido}
                      onChange={(e) => setFormData({ ...formData, primer_apellido: e.target.value })}
                      style={inputStyle}
                    />
                  </div>
                  <div>
                    <label style={labelStyle}>Segundo Apellido</label>
                    <input
                      type="text"
                      autoComplete="off"
                      name="inst_segundo_apellido"
                      placeholder="Ej. López"
                      value={formData.segundo_apellido}
                      onChange={(e) => setFormData({ ...formData, segundo_apellido: e.target.value })}
                      style={inputStyle}
                    />
                  </div>
                </div>

                {/* No. Cuenta y Correo */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                  <div>
                    <label style={labelStyle}>
                      No. Cuenta / Código <span style={{ color: "#e11d48" }}>*</span>
                    </label>
                    <input
                      type="text"
                      required
                      autoComplete="off"
                      name="inst_numero_cuenta"
                      placeholder="Ej. 20201001234"
                      value={formData.numero_cuenta}
                      onChange={(e) => setFormData({ ...formData, numero_cuenta: e.target.value })}
                      style={inputStyle}
                    />
                  </div>
                  <div>
                    <label style={labelStyle}>
                      Correo Electrónico <span style={{ color: "#e11d48" }}>*</span>
                    </label>
                    <input
                      type="email"
                      required
                      autoComplete="off"
                      name="inst_correo_electronico"
                      placeholder="instructor@unah.edu.hn"
                      value={formData.correo}
                      onChange={(e) => setFormData({ ...formData, correo: e.target.value })}
                      style={inputStyle}
                    />
                  </div>
                </div>

                {/* Contraseña */}
                <div>
                  <label style={labelStyle}>
                    {mode === "create" ? (
                      <>Contraseña <span style={{ color: "#e11d48" }}>*</span></>
                    ) : (
                      "Nueva Contraseña (Opcional, dejar en blanco para no cambiarla)"
                    )}
                  </label>
                  <div style={{ position: "relative" }}>
                    <input
                      type={showPassword ? "text" : "password"}
                      required={mode === "create"}
                      autoComplete="new-password"
                      name="inst_nueva_clave"
                      placeholder={mode === "create" ? "Mínimo 6 caracteres" : "Nueva contraseña (opcional)..."}
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      style={{
                        ...inputStyle,
                        paddingRight: "2.5rem"
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
                        background: "none",
                        border: "none",
                        color: "#64748b",
                        cursor: "pointer",
                        display: "flex",
                        padding: "0.2rem"
                      }}
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                {/* Rol, Comité, Sección */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "0.75rem" }}>
                  <div>
                    <label style={labelStyle}>Rol</label>
                    <select
                      value={formData.rol}
                      onChange={(e) => setFormData({ ...formData, rol: e.target.value })}
                      disabled={formData.rol === "Creador"}
                      style={{
                        ...inputStyle,
                        ...(formData.rol === "Creador" ? { background: "#f5f3ff", color: "#6d28d9", fontWeight: 700, borderColor: "#ddd6fe" } : {})
                      }}
                    >
                      {formData.rol === "Creador" && (
                        <option value="Creador">💻 Creador (Exclusivo)</option>
                      )}
                      <option value="Instructor">Instructor</option>
                      <option value="Coordinador">Coordinador</option>
                      <option value="Administrador">Administrador</option>
                    </select>
                  </div>

                  <div>
                    <label style={labelStyle}>Comité</label>
                    <input
                      type="text"
                      placeholder="Ej. Evaluación"
                      value={formData.comite}
                      onChange={(e) => setFormData({ ...formData, comite: e.target.value })}
                      style={inputStyle}
                    />
                  </div>

                  <div>
                    <label style={labelStyle}>Sección</label>
                    <input
                      type="text"
                      placeholder="Ej. 1300"
                      value={formData.seccion}
                      onChange={(e) => setFormData({ ...formData, seccion: e.target.value })}
                      style={inputStyle}
                    />
                  </div>
                </div>

                {/* Estado Activo */}
                {mode === "edit" && (
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginTop: "0.2rem" }}>
                    <input
                      type="checkbox"
                      id="activo-check"
                      checked={formData.activo}
                      onChange={(e) => setFormData({ ...formData, activo: e.target.checked })}
                      style={{ width: "17px", height: "17px", accentColor: "#0284c7", cursor: "pointer" }}
                    />
                    <label htmlFor="activo-check" style={{ fontSize: "0.85rem", fontWeight: 600, color: "#334155", cursor: "pointer" }}>
                      Usuario Activo (Permite el acceso al portal)
                    </label>
                  </div>
                )}
              </>
            )}

            {/* MODO BORRAR */}
            {mode === "delete" && !selectedInstObj && (
              <div
                style={{
                  background: "#f8fafc",
                  border: "1px dashed #cbd5e1",
                  borderRadius: "0.75rem",
                  padding: "2.5rem 1.5rem",
                  textAlign: "center",
                  color: "#64748b"
                }}
              >
                <Trash2 size={32} color="#94a3b8" style={{ marginBottom: "0.5rem" }} />
                <p style={{ margin: "0 0 0.25rem", fontSize: "0.95rem", fontWeight: 700, color: "#334155" }}>
                  Ningún instructor seleccionado
                </p>
                <span style={{ fontSize: "0.82rem", color: "#64748b" }}>
                  Por favor selecciona un instructor en el menú desplegable superior para revisar sus datos y confirmar la eliminación.
                </span>
              </div>
            )}

            {mode === "delete" && selectedInstObj && (
              <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                <div
                  style={{
                    background: "#fff1f2",
                    border: "1px solid #fecdd3",
                    borderRadius: "0.75rem",
                    padding: "1rem",
                    display: "flex",
                    alignItems: "flex-start",
                    gap: "0.75rem"
                  }}
                >
                  <AlertTriangle size={24} color="#e11d48" style={{ flexShrink: 0, marginTop: "2px" }} />
                  <div>
                    <strong style={{ color: "#9f1239", fontSize: "0.95rem", display: "block" }}>
                      ¿Estás seguro de eliminar este usuario?
                    </strong>
                    <p style={{ margin: "0.25rem 0 0", color: "#be123c", fontSize: "0.83rem", lineHeight: 1.4 }}>
                      Esta acción es irreversible. Se eliminará el perfil del instructor y sus credenciales de acceso permanentemente.
                    </p>
                  </div>
                </div>

                {/* Ficha Resumen del Usuario a Borrar */}
                <div
                  style={{
                    background: "#f8fafc",
                    border: "1px solid #e2e8f0",
                    borderRadius: "0.75rem",
                    padding: "1rem"
                  }}
                >
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem", fontSize: "0.85rem" }}>
                    <div>
                      <span style={{ color: "#64748b", display: "block", fontSize: "0.75rem" }}>Nombre Completo</span>
                      <strong>{selectedInstObj.primer_nombre} {selectedInstObj.primer_apellido}</strong>
                    </div>
                    <div>
                      <span style={{ color: "#64748b", display: "block", fontSize: "0.75rem" }}>No. Cuenta</span>
                      <strong>{selectedInstObj.numero_cuenta}</strong>
                    </div>
                    <div>
                      <span style={{ color: "#64748b", display: "block", fontSize: "0.75rem" }}>Correo</span>
                      <span>{selectedInstObj.correo}</span>
                    </div>
                    <div>
                      <span style={{ color: "#64748b", display: "block", fontSize: "0.75rem" }}>Rol</span>
                      <span style={{ color: selectedInstObj.rol === "Creador" ? "#7c3aed" : "#0284c7", fontWeight: 800, display: "inline-flex", alignItems: "center", gap: "0.25rem" }}>
                        {selectedInstObj.rol === "Creador" ? (
                          <>
                            <Laptop size={14} /> Creador
                          </>
                        ) : (
                          selectedInstObj.rol || "Instructor"
                        )}
                      </span>
                    </div>
                  </div>
                </div>

                <div>
                  <label style={{ display: "block", fontSize: "0.82rem", fontWeight: 700, color: "#9f1239", marginBottom: "0.4rem" }}>
                    Escribe el número de cuenta ({selectedInstObj.numero_cuenta}) para confirmar la eliminación:
                  </label>
                  <input
                    type="text"
                    required
                    placeholder={`Escribe ${selectedInstObj.numero_cuenta}`}
                    value={deleteConfirmText}
                    onChange={(e) => setDeleteConfirmText(e.target.value)}
                    style={{
                      ...inputStyle,
                      border: "2px solid #fda4af",
                      fontSize: "0.92rem",
                      fontWeight: 600
                    }}
                  />
                </div>
              </div>
            )}
          </form>
        </div>

        {/* Footer fijo del Modal */}
        <div
          style={{
            padding: "1rem 1.5rem",
            borderTop: "1px solid #e2e8f0",
            display: "flex",
            alignItems: "center",
            justifyContent: "flex-end",
            gap: "0.75rem",
            background: "#f8fafc",
            flexShrink: 0
          }}
        >
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            style={{
              padding: "0.6rem 1.1rem",
              borderRadius: "0.6rem",
              border: "1px solid #cbd5e1",
              background: "#ffffff",
              color: "#475569",
              fontSize: "0.88rem",
              fontWeight: 600,
              cursor: "pointer"
            }}
          >
            Cancelar
          </button>

          <button
            type="submit"
            form="user-mgmt-form"
            disabled={loading}
            style={{
              padding: "0.6rem 1.4rem",
              borderRadius: "0.6rem",
              border: "none",
              fontSize: "0.88rem",
              fontWeight: 700,
              cursor: loading ? "not-allowed" : "pointer",
              display: "inline-flex",
              alignItems: "center",
              gap: "0.45rem",
              color: "#ffffff",
              background:
                mode === "create"
                  ? "linear-gradient(135deg, #0284c7 0%, #0369a1 100%)"
                  : mode === "edit"
                  ? "linear-gradient(135deg, #d97706 0%, #b45309 100%)"
                  : "linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)",
              boxShadow:
                mode === "create"
                  ? "0 4px 12px rgba(2, 132, 199, 0.3)"
                  : mode === "edit"
                  ? "0 4px 12px rgba(217, 119, 6, 0.3)"
                  : "0 4px 12px rgba(220, 38, 38, 0.3)"
            }}
          >
            {loading ? (
              "Procesando..."
            ) : mode === "create" ? (
              <>
                <UserPlus size={16} />
                Guardar y Crear Usuario
              </>
            ) : mode === "edit" ? (
              <>
                <Edit3 size={16} />
                Guardar Cambios
              </>
            ) : (
              <>
                <Trash2 size={16} />
                Confirmar Eliminación
              </>
            )}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
