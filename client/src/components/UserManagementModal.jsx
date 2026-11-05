import React, { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import {
  X,
  UserPlus,
  Edit3,
  Trash2,
  Eye,
  EyeOff,
  AlertTriangle
} from "lucide-react";
import { api } from "../services/api";
import { ASSIGNABLE_INSTRUCTOR_ROLES } from "../../../shared/instructorRoles.mjs";

const DEFAULT_INSTRUCTOR_PASSWORD = "histolab321";

export default function UserManagementModal({
  mode = "create", // 'create' | 'edit' | 'delete'
  instructors = [],
  selectedInstructor = null,
  currentInstructor = null,
  onClose,
  onSuccess,
  notify
}) {
  const dialogRef = useRef(null);
  const [formError, setFormError] = useState("");
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
    password: mode === "create" ? DEFAULT_INSTRUCTOR_PASSWORD : "",
    rol: "Instructor",
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
      password: mode === "create" ? DEFAULT_INSTRUCTOR_PASSWORD : "",
      rol: "Instructor",
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
      coordinacion: instructor.coordinacion || "",
      activo: instructor.activo !== undefined ? instructor.activo : true
    });
  };

  const handleSelectInstructor = (id) => {
    const found = instructors.find((inst) => String(inst.id) === id);
    setTargetId(found?.id ?? "");
    setDeleteConfirmText("");
    setFormError("");
    if (found) loadInstructorToForm(found);
    else resetForm();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setFormError("");

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
      setFormError(err.message || "Ocurrió un error al procesar la solicitud.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const dialog = dialogRef.current;
    dialog.showModal();
    return () => dialog.close();
  }, []);

  const isDelete = mode === "delete";
  const isCreate = mode === "create";
  const title = isCreate ? "Crear usuario" : isDelete ? "Eliminar usuario" : "Editar usuario";
  const Icon = isCreate ? UserPlus : isDelete ? Trash2 : Edit3;
  const selected = instructors.find(inst => inst.id === targetId);
  const confirmation = selected?.numero_cuenta || "ELIMINAR";
  const updateField = (event) => {
    const { name, value, checked, type } = event.target;
    setFormData(previous => ({ ...previous, [name]: type === "checkbox" ? checked : value }));
  };

  return createPortal(
    <dialog
      ref={dialogRef}
      className="user-dialog"
      aria-labelledby="user-dialog-title"
      onCancel={event => {
        event.preventDefault();
        if (!loading) onClose();
      }}
    >
      <header className="user-dialog__header">
        <span className="user-dialog__icon"><Icon size={22} aria-hidden="true" /></span>
        <div>
          <p>Administración de usuarios</p>
          <h2 id="user-dialog-title">{title}</h2>
        </div>
        <button type="button" className="user-button user-button--icon" onClick={onClose}
          disabled={loading} aria-label="Cerrar ventana">
          <X size={21} aria-hidden="true" />
        </button>
      </header>

      <form id="user-mgmt-form" className="user-dialog__body" onSubmit={handleSubmit}>
        {!isCreate && (
          <label className="user-field">
            Instructor
            <select required value={targetId} onChange={event => handleSelectInstructor(event.target.value)}>
              <option value="">Selecciona una cuenta</option>
              {instructors.map(inst => (
                <option key={inst.id} value={inst.id}
                  disabled={inst.rol === "Creador" || (isDelete && inst.id === currentInstructor?.id)}>
                  {inst.primer_nombre} {inst.primer_apellido} · {inst.numero_cuenta || inst.correo}
                </option>
              ))}
            </select>
          </label>
        )}

        {!isDelete && (isCreate || selected) && (
          <>
            <fieldset className="user-dialog__group">
              <legend>Datos personales</legend>
              <div className="user-dialog__grid">
                <label className="user-field">Primer nombre <input name="primer_nombre" required value={formData.primer_nombre} onChange={updateField} /></label>
                <label className="user-field">Segundo nombre <input name="segundo_nombre" value={formData.segundo_nombre} onChange={updateField} /></label>
                <label className="user-field">Primer apellido <input name="primer_apellido" required value={formData.primer_apellido} onChange={updateField} /></label>
                <label className="user-field">Segundo apellido <input name="segundo_apellido" value={formData.segundo_apellido} onChange={updateField} /></label>
              </div>
            </fieldset>

            <fieldset className="user-dialog__group">
              <legend>Cuenta y acceso</legend>
              <div className="user-dialog__grid">
                <label className="user-field">Número de cuenta <input name="numero_cuenta" required autoComplete="off" value={formData.numero_cuenta} onChange={updateField} /></label>
                <label className="user-field">Correo electrónico <input name="correo" type="email" required autoComplete="off" value={formData.correo} onChange={updateField} /></label>
                <div className="user-field">
                  <label htmlFor="user-password">{isCreate ? "Contraseña" : "Nueva contraseña (opcional)"}</label>
                  <div className="user-field__password">
                    <input id="user-password" name="password" type={showPassword ? "text" : "password"}
                      required={isCreate} autoComplete="new-password" value={formData.password} onChange={updateField} />
                    <button type="button" className="user-button user-button--icon" onClick={() => setShowPassword(previous => !previous)}
                      aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}>
                      {showPassword ? <EyeOff size={19} aria-hidden="true" /> : <Eye size={19} aria-hidden="true" />}
                    </button>
                  </div>
                  <small>{isCreate ? "Mínimo 6 caracteres." : "Déjala en blanco para conservar la actual."}</small>
                </div>
                <label className="user-field">
                  Rol
                  <select name="rol" value={formData.rol} onChange={updateField}>
                    {ASSIGNABLE_INSTRUCTOR_ROLES.map(role => <option key={role} value={role}>{role}</option>)}
                  </select>
                </label>
              </div>
              {!isCreate && (
                <label className="user-dialog__check">
                  <input type="checkbox" name="activo" checked={formData.activo} onChange={updateField} />
                  Usuario activo · Permite el acceso al portal
                </label>
              )}
            </fieldset>
          </>
        )}

        {isDelete && selected && (
          <>
            <div className="user-dialog__warning">
              <AlertTriangle size={22} aria-hidden="true" />
              <div>
                <strong>La eliminación es permanente</strong>
                <p>Se eliminará la cuenta de {selected.primer_nombre} {selected.primer_apellido}{selected.correo && ` (${selected.correo})`}.</p>
              </div>
            </div>
            <label className="user-field">
              Escribe <strong>{confirmation}</strong> para confirmar
              <input required autoComplete="off" value={deleteConfirmText} onChange={event => setDeleteConfirmText(event.target.value)} />
            </label>
          </>
        )}
      </form>

      <footer className="user-dialog__footer">
        {formError && <p className="user-dialog__error" role="alert">{formError}</p>}
        <div className="user-dialog__buttons">
          <button type="button" className="user-button" onClick={onClose} disabled={loading}>Cancelar</button>
          <button type="submit" className={isDelete ? "user-button user-button--destructive" : "user-button user-button--primary"}
            form="user-mgmt-form" disabled={loading || (!isCreate && !selected)}>
            {loading ? "Procesando…" : isDelete ? "Confirmar eliminación" : isCreate ? "Crear usuario" : "Guardar cambios"}
          </button>
        </div>
      </footer>
    </dialog>,
    document.body
  );
}
