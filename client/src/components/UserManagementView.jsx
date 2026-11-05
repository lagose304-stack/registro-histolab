import { hasAdministrationAccess, normalizeInstructorRole } from "../../../shared/instructorRoles.mjs";
import React, { useState, useEffect, useCallback } from "react";
import { ArrowLeft, Edit3, LayoutGrid, List, RefreshCw, Search, Shield, Trash2, UserPlus, Users } from "lucide-react";
import { api } from "../services/api";
import { safeStorage } from "../utils/safeStorage";
import UserManagementModal from "./UserManagementModal";

const VIEW_STORAGE_KEY = "histolab_user_directory_view";

export default function UserManagementView({ currentInstructor, onClose, notify = () => {} }) {
  const [instructorsList, setInstructorsList] = useState([]);
  const [loadingInstructors, setLoadingInstructors] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [listView, setListView] = useState(() => safeStorage.getItem(VIEW_STORAGE_KEY) === "list");
  const [modal, setModal] = useState(null);
  const isAuthorized = hasAdministrationAccess(currentInstructor?.rol);

  const loadInstructores = useCallback(async () => {
    if (!isAuthorized) return;
    setLoadingInstructors(true);
    setLoadError(false);
    try {
      const res = await api.auth.getInstructores();
      if (res?.data) setInstructorsList(res.data);
    } catch (err) {
      console.warn("Error al cargar instructores:", err);
      setLoadError(true);
    } finally {
      setLoadingInstructors(false);
    }
  }, [isAuthorized]);

  useEffect(() => {
    loadInstructores();
  }, [loadInstructores]);

  const backButton = (
    <button type="button" className="user-button user-button--back" onClick={onClose}>
      <ArrowLeft size={17} aria-hidden="true" /> Panel docente
    </button>
  );

  if (!isAuthorized) {
    return (
      <section className="user-directory">
        {backButton}
        <div className="user-directory__state">
          <Shield size={24} aria-hidden="true" />
          <h2>Acceso restringido</h2>
          <p>Creador y Coordinador pueden gestionar cuentas de instructores.</p>
        </div>
      </section>
    );
  }

  const query = searchTerm.trim().toLowerCase();
  const filteredInstructors = instructorsList.filter((inst) => {
    const name = [inst.primer_nombre, inst.segundo_nombre, inst.primer_apellido, inst.segundo_apellido].filter(Boolean).join(" ");
    return [name, inst.correo, inst.numero_cuenta, inst.rol].some(value =>
      String(value ?? "").toLowerCase().includes(query)
    );
  });
  const totalActivos = instructorsList.filter(inst => inst.activo).length;
  const toggleView = () => {
    setListView(!listView);
    safeStorage.setItem(VIEW_STORAGE_KEY, listView ? "cards" : "list");
  };
  const viewAction = listView ? "Ver como tarjetas" : "Ver como lista";

  return (
    <section className="user-directory" aria-labelledby="user-directory-title">
      {backButton}
      <header className="user-directory__hero">
        <div>
          <p className="user-directory__eyebrow"><Users size={16} aria-hidden="true" /> Administración general</p>
          <h2 id="user-directory-title">Administración de usuarios</h2>
          <p>Gestiona las cuentas y los accesos de los instructores.</p>
        </div>
        <button type="button" className="user-button user-button--primary" onClick={() => setModal({ mode: "create" })}>
          <UserPlus size={19} aria-hidden="true" /> Crear usuario
        </button>
      </header>

      <section className="user-directory__results" aria-labelledby="user-list-title" aria-busy={loadingInstructors}>
        <div className="user-directory__toolbar">
          <div>
            <h3 id="user-list-title">Instructores</h3>
            <p>{instructorsList.length} registrados · {totalActivos} activos</p>
          </div>
          <div className="user-directory__tools">
            <label className="user-directory__search">
              <Search size={18} aria-hidden="true" />
              <input type="search" aria-label="Buscar instructores" placeholder="Buscar" title="Busca por nombre, cuenta, correo o rol"
                value={searchTerm} onChange={event => setSearchTerm(event.target.value)} />
            </label>
            <button type="button" className="user-button user-button--icon" onClick={loadInstructores}
              disabled={loadingInstructors} aria-label="Actualizar lista" title="Actualizar lista">
              <RefreshCw size={18} aria-hidden="true" />
            </button>
            <button type="button" className="user-button user-button--icon" onClick={toggleView}
              aria-label={viewAction} title={viewAction}>
              {listView ? <LayoutGrid size={19} aria-hidden="true" /> : <List size={20} aria-hidden="true" />}
            </button>
          </div>
        </div>

        {loadingInstructors ? (
          <p className="user-directory__state" role="status">Cargando instructores…</p>
        ) : loadError ? (
          <div className="user-directory__state" role="alert">
            <p>No pudimos cargar los instructores.</p>
            <button type="button" className="user-button" onClick={loadInstructores}>Reintentar</button>
          </div>
        ) : filteredInstructors.length === 0 ? (
          <div className="user-directory__state" role="status">
            <p>{query ? "No hay resultados para esta búsqueda." : "Aún no hay instructores registrados."}</p>
            {query && <button type="button" className="user-button" onClick={() => setSearchTerm("")}>Limpiar búsqueda</button>}
          </div>
        ) : (
          <>
            {query && <p className="user-directory__count" role="status">{filteredInstructors.length} resultados</p>}
            <ul className={listView ? "user-directory__list user-directory__list--compact" : "user-directory__list"}>
              {filteredInstructors.map(inst => {
                const isSelf = inst.id === currentInstructor?.id;
                const role = normalizeInstructorRole(inst.rol) || inst.rol || "Instructor";
                const isCreator = role === "Creador";
                const name = [inst.primer_nombre, inst.segundo_nombre, inst.primer_apellido, inst.segundo_apellido].filter(Boolean).join(" ") || "Instructor";

                return (
                  <li key={inst.id} className="user-card">
                    <div className="user-card__identity">
                      <span className="user-card__avatar" aria-hidden="true">{name.charAt(0).toUpperCase()}</span>
                      <div>
                        <h4>{name}</h4>
                        {isSelf && <span className="user-card__hint">Tu cuenta</span>}
                      </div>
                    </div>
                    <div className="user-card__badges">
                      <span className="user-badge" data-role={role}>{role}</span>
                      <span className={inst.activo ? "user-badge user-badge--active" : "user-badge user-badge--inactive"}>
                        {inst.activo ? "Activo" : "Inactivo"}
                      </span>
                    </div>
                    <dl className="user-card__details">
                      <div><dt>Cuenta</dt><dd>{inst.numero_cuenta || "—"}</dd></div>
                      <div><dt>Correo</dt><dd>{inst.correo || "—"}</dd></div>
                      {inst.seccion && <div><dt>Sección</dt><dd>{inst.seccion}</dd></div>}
                    </dl>
                    <div className="user-card__actions">
                      {isCreator ? <span className="user-card__hint"><Shield size={16} aria-hidden="true" /> Cuenta protegida</span> : (
                        <>
                          <button type="button" className="user-button" aria-label={`Editar a ${name}`}
                            onClick={() => setModal({ mode: "edit", instructor: inst })}>
                            <Edit3 size={16} aria-hidden="true" /> Editar
                          </button>
                          {!isSelf && <button type="button" className="user-button user-button--danger" aria-label={`Eliminar a ${name}`}
                            onClick={() => setModal({ mode: "delete", instructor: inst })}>
                            <Trash2 size={16} aria-hidden="true" /> Eliminar
                          </button>}
                        </>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </section>

      {modal && (
        <UserManagementModal
          mode={modal.mode}
          instructors={instructorsList}
          selectedInstructor={modal.instructor}
          currentInstructor={currentInstructor}
          onClose={() => setModal(null)}
          onSuccess={loadInstructores}
          notify={notify}
        />
      )}
    </section>
  );
}
