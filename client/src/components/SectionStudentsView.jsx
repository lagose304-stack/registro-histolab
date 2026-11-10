import { navigateEnrollmentFields } from "../utils/enrollmentNavigation.mjs";
import React, { useState, useEffect, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import {
  AlertTriangle, ArrowLeft, Edit3, Eye, EyeOff, FileSpreadsheet, GraduationCap,
  LayoutGrid, List, Plus, RefreshCw, Search, Trash2, X
} from "lucide-react";
import { api } from "../services/api";
import SectionGradebookView from "./SectionGradebookView";
import { getNavState, setNavState } from "../utils/navigationState";
import { safeStorage } from "../utils/safeStorage";
import { displaySectionCode } from "../../../shared/sectionCode.mjs";

const VIEW_KEY = "histolab_section_roster_view";

export default function SectionStudentsView({
  seccion,
  onClose = () => {},
  hideBackButton = false,
  hideGradebook = false,
  notify = () => {}
}) {
  const [estudiantes, setEstudiantes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [cardView, setCardView] = useState(() => safeStorage.getItem(VIEW_KEY) === "cards");
  const dialogRef = useRef(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [showGradebook, setShowGradebookState] = useState(() => Boolean(getNavState().showGradebook));

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
    correo: ""
  });
  const [showPassword, setShowPassword] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  // Cargar estudiantes de la sección
  const loadEstudiantes = useCallback(async () => {
    if (!seccion?.id) return;
    setLoading(true);
    setLoadError(false);
    try {
      const res = await api.estudiantes.getBySeccion(seccion.id);
      if (res?.data) {
        setEstudiantes(res.data);
      }
    } catch (err) {
      console.error("Error al cargar estudiantes:", err);
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, [seccion?.id]);

  useEffect(() => {
    loadEstudiantes();
  }, [loadEstudiantes]);

  // Abrir Modal
  const handleOpenModal = (mode, student = null) => {
    setModalMode(mode);
    setSelectedStudent(student);
    setShowPassword(false);
    setFormError("");

    if (mode === "create") {
      setFormData({
        numero_cuenta: "",
        nombre_completo: "",
        correo: ""
      });
    } else if (mode === "edit" && student) {
      setFormData({
        numero_cuenta: student.numero_cuenta || "",
        nombre_completo: student.nombre_completo || "",
        correo: student.correo || ""
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
    if (!formData.correo.trim()) {
      setFormError("Registra el correo del estudiante para que pueda activar su cuenta.");
      return;
    }

    setSaving(true);
    try {
      if (modalMode === "create") {
        await api.estudiantes.create({
          seccion_id: seccion.id,
          numero_cuenta: formData.numero_cuenta.trim(),
          nombre_completo: formData.nombre_completo.trim(),
          correo: formData.correo.trim()
        });
        notify("Estudiante matriculado con éxito", "success");
      } else if (modalMode === "edit" && selectedStudent) {
        await api.estudiantes.update(seccion.id, selectedStudent.numero_cuenta, {
          nombre_completo: formData.nombre_completo.trim(),
          nuevo_numero_cuenta: formData.numero_cuenta.trim(),
          correo: formData.correo.trim()
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
    setFormError("");
    try {
      await api.estudiantes.delete(seccion.id, selectedStudent.numero_cuenta);
      notify("Estudiante eliminado de la sección", "success");
      handleCloseModal();
      loadEstudiantes();
    } catch (err) {
      console.error("Error al eliminar estudiante:", err);
      setFormError(err.message || "No pudimos eliminar al estudiante.");
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    if (!modalMode) return;
    const dialog = dialogRef.current;
    dialog.showModal();
    return () => dialog.close();
  }, [modalMode]);

  if (!hideGradebook && showGradebook) {
    return <SectionGradebookView seccion={seccion} onClose={() => setShowGradebook(false)} notify={notify} />;
  }

  const query = searchTerm.trim().toLowerCase();
  const filtered = estudiantes.filter(student =>
    [student.numero_cuenta, student.nombre_completo].some(value => String(value ?? "").toLowerCase().includes(query))
  );
  const sectionCode = displaySectionCode(seccion.codigo);
  const schedule = [seccion.dia, [seccion.hora_inicio, seccion.hora_fin].filter(Boolean).join(" – ")].filter(Boolean).join(" · ");
  const viewAction = cardView ? "Ver como lista" : "Ver como tarjetas";
  const modalTitle = modalMode === "create" ? "Matricular estudiante" : modalMode === "edit" ? "Editar estudiante" : "Eliminar estudiante";
  const ModalIcon = modalMode === "create" ? Plus : modalMode === "edit" ? Edit3 : Trash2;
  const deleting = modalMode === "delete";

  const toggleView = () => {
    setCardView(!cardView);
    safeStorage.setItem(VIEW_KEY, cardView ? "list" : "cards");
  };

  const updateField = (event) => {
    const { name, value } = event.target;
    setFormData(previous => ({ ...previous, [name]: value }));
  };

  return (
    <section className="user-directory student-roster" aria-labelledby="roster-title">
      {!hideBackButton && (
        <button type="button" className="user-button user-button--back" onClick={onClose}>
          <ArrowLeft size={17} aria-hidden="true" /> Volver a secciones
        </button>
      )}

      <header className="user-directory__hero">
        <div>
          <p className="user-directory__eyebrow"><GraduationCap size={17} aria-hidden="true" /> Sección {sectionCode}</p>
          <h2 id="roster-title">Matrícula y estudiantes</h2>
          <p className="student-roster__context">
            {[seccion.carrera, schedule, seccion.periodo_academico].filter(Boolean).join(" · ")}
          </p>
        </div>
        <div className="student-roster__hero-actions">
          <button type="button" className="user-button user-button--primary" onClick={() => handleOpenModal("create")}>
            <Plus size={19} aria-hidden="true" /> Matricular estudiante
          </button>
          {!hideGradebook && (
            <button type="button" className="user-button" onClick={() => setShowGradebook(true)}>
              <FileSpreadsheet size={18} aria-hidden="true" /> Cuadro de notas
            </button>
          )}
        </div>
      </header>

      <section className="user-directory__results" aria-labelledby="roster-list-title" aria-busy={loading}>
        <div className="user-directory__toolbar">
          <div>
            <h3 id="roster-list-title">Estudiantes matriculados</h3>
            <p>{estudiantes.length} en esta sección</p>
          </div>
          <div className="user-directory__tools">
            <label className="user-directory__search">
              <Search size={18} aria-hidden="true" />
              <input type="search" aria-label="Buscar por nombre o cuenta" placeholder="Buscar"
                value={searchTerm} onChange={event => setSearchTerm(event.target.value)} />
            </label>
            <button type="button" className="user-button user-button--icon" onClick={loadEstudiantes}
              disabled={loading} aria-label="Actualizar lista" title="Actualizar lista">
              <RefreshCw size={18} aria-hidden="true" />
            </button>
            <button type="button" className="user-button user-button--icon" onClick={toggleView}
              aria-label={viewAction} title={viewAction}>
              {cardView ? <List size={19} aria-hidden="true" /> : <LayoutGrid size={19} aria-hidden="true" />}
            </button>
          </div>
        </div>

        {loading ? (
          <p className="user-directory__state" role="status">Cargando estudiantes…</p>
        ) : loadError ? (
          <div className="user-directory__state" role="alert">
            <p>No pudimos cargar la matrícula de esta sección.</p>
            <button type="button" className="user-button" onClick={loadEstudiantes}>Reintentar</button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="user-directory__state" role="status">
            <p>{query ? "No hay estudiantes que coincidan con la búsqueda." : "Aún no hay estudiantes matriculados en esta sección."}</p>
            {query && <button type="button" className="user-button" onClick={() => setSearchTerm("")}>Limpiar búsqueda</button>}
          </div>
        ) : (
          <>
            {query && <p className="user-directory__count" role="status">{filtered.length} de {estudiantes.length} estudiantes</p>}
            <ul className={cardView ? "user-directory__list" : "user-directory__list user-directory__list--compact"}>
              {filtered.map(student => {
                const name = student.nombre_completo || "Estudiante";
                return (
                  <li key={student.numero_cuenta} className="user-card">
                    <div className="user-card__identity">
                      <span className="user-card__avatar" aria-hidden="true">{name.charAt(0).toUpperCase()}</span>
                      <div>
                        <h4>{name}</h4>
                        <span className="user-card__hint">Cuenta {student.numero_cuenta}</span>
                      </div>
                    </div>
                    <div className="user-card__actions">
                      <button type="button" className="user-button" aria-label={`Editar a ${name}`}
                        onClick={() => handleOpenModal("edit", student)}>
                        <Edit3 size={16} aria-hidden="true" /> Editar
                      </button>
                      <button type="button" className="user-button user-button--danger" aria-label={`Eliminar a ${name}`}
                        onClick={() => handleOpenModal("delete", student)}>
                        <Trash2 size={16} aria-hidden="true" /> Eliminar
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </section>

      {modalMode && createPortal(
        <dialog ref={dialogRef} className="user-dialog student-roster-dialog" aria-labelledby="roster-dialog-title"
          onCancel={event => {
            event.preventDefault();
            if (!saving) handleCloseModal();
          }}>
          <header className="user-dialog__header">
            <span className="user-dialog__icon"><ModalIcon size={22} aria-hidden="true" /></span>
            <div>
              <p>Sección {sectionCode}</p>
              <h2 id="roster-dialog-title">{modalTitle}</h2>
            </div>
            <button type="button" className="user-button user-button--icon" disabled={saving}
              onClick={handleCloseModal} aria-label="Cerrar ventana">
              <X size={21} aria-hidden="true" />
            </button>
          </header>

          {deleting ? (
            <div className="user-dialog__body">
              <div className="student-roster-dialog__student">
                <strong>{selectedStudent?.nombre_completo}</strong>
                <p>Cuenta {selectedStudent?.numero_cuenta}</p>
              </div>
              <div className="user-dialog__warning">
                <AlertTriangle size={22} aria-hidden="true" />
                <p>Se eliminarán permanentemente la matrícula, las notas, asistencias, entregas y reposiciones de este estudiante, además de su cuenta de acceso. Esta acción no se puede deshacer.</p>
              </div>
            </div>
          ) : (
            <form id="roster-form" className="user-dialog__body"
              onKeyDown={modalMode === "create" && !saving ? navigateEnrollmentFields : undefined} onSubmit={handleSave}>
              <label className="user-field">
                Nombre completo
                <input required name="nombre_completo" autoComplete="off" value={formData.nombre_completo} onChange={updateField} />
              </label>
              <label className="user-field">
                Número de cuenta
                <input required name="numero_cuenta" autoComplete="off" value={formData.numero_cuenta} onChange={updateField} />
                <small>La cuenta solo puede tener una matrícula activa entre todas las carreras.</small>
              </label>
              <label className="user-field">Correo electrónico
                <input required name="correo" type="email" autoComplete="off" value={formData.correo} onChange={updateField} />
                <small>Confirma que pertenece al estudiante. Recibirá allí el código para crear su contraseña.</small>
              </label>
            </form>
          )}

          <footer className="user-dialog__footer">
            {formError && <p className="user-dialog__error" role="alert">{formError}</p>}
            <div className="user-dialog__buttons">
              <button type="button" className="user-button" disabled={saving} onClick={handleCloseModal}>Cancelar</button>
              {deleting ? (
                <button type="button" className="user-button user-button--destructive" disabled={saving || !selectedStudent}
                  onClick={handleDelete}>{saving ? "Eliminando…" : "Eliminar estudiante"}</button>
              ) : (
                <button type="submit" form="roster-form" className="user-button user-button--primary" disabled={saving}>
                  {saving ? "Guardando…" : modalMode === "create" ? "Matricular" : "Guardar cambios"}
                </button>
              )}
            </div>
          </footer>
        </dialog>,
        document.body
      )}
    </section>
  );
}
