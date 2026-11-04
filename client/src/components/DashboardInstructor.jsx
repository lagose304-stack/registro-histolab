import { hasAdministrationAccess } from "../../../shared/instructorRoles.mjs";
import React, { useState, useEffect, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import {
  Users,
  PanelLeftOpen,
  X,
  ArrowRight,
  Layers,
  BookOpen,
  Star,
  Clock,
  Calendar,
  GraduationCap,
  AlertCircle
} from "lucide-react";
import { api } from "../services/api";
import UserManagementView from "./UserManagementView";
import SectionManagementView from "./SectionManagementView";
import TemarioManagementView from "./TemarioManagementView";
import WeekDefinitionView from "./WeekDefinitionView";
import CoordinatorSectionView from "./CoordinatorSectionView";

import { getNavState, setNavState } from "../utils/navigationState";
import { safeStorage } from "../utils/safeStorage";
import "./DashboardInstructor.css";

const ADMIN_MODULES = [
  { id: "user-management", label: "Administración de usuarios", Icon: Users },
  { id: "section-management", label: "Administración de secciones", Icon: Layers },
  { id: "temario-management", label: "Gestión de temario", Icon: BookOpen },
  { id: "week-definition", label: "Definición de semanas", Icon: Calendar }
];

const CAREER_ACCENTS = {
  MEDICINA: "#0369a1",
  ENFERMERIA: "#5148a4",
  ODONTOLOGIA: "#a21caf",
  MICROBIOLOGIA: "#9a4c11",
  NUTRICION: "#475569"
};

export default function DashboardInstructor({ instructor, notify = () => {}, adminMenuSlot }) {
  const adminMenu = useRef(null);
  const [currentGreeting, setCurrentGreeting] = useState("¡Buen día!");
  const [sectionsError, setSectionsError] = useState(false);
  
  // Restauración automática del estado de navegación al recargar la página
  const initialNav = getNavState();
  const [activeModule, setActiveModuleState] = useState(() => initialNav.activeModule || null);
  const [selectedCoordinatorSeccion, setSelectedCoordinatorSeccionState] = useState(() => initialNav.selectedCoordinatorSeccion || null);
  const [selectedInstructorSeccion, setSelectedInstructorSeccionState] = useState(() => initialNav.selectedInstructorSeccion || null);
  const [misSecciones, setMisSecciones] = useState(() => {
    try {
      const cached = safeStorage.getSession(`histolab_cached_mis_secciones_${instructor?.id || 'default'}`);
      return cached ? JSON.parse(cached) : [];
    } catch {
      return [];
    }
  });
  const [loadingSecciones, setLoadingSecciones] = useState(() => {
    try {
      const cached = safeStorage.getSession(`histolab_cached_mis_secciones_${instructor?.id || 'default'}`);
      return !cached;
    } catch {
      return true;
    }
  });

  const setActiveModule = (mod) => {
    setActiveModuleState(mod);
    setNavState({ activeModule: mod });
  };

  const setSelectedCoordinatorSeccion = (sec) => {
    setSelectedCoordinatorSeccionState(sec);
    setNavState({ selectedCoordinatorSeccion: sec });
  };

  const setSelectedInstructorSeccion = (sec) => {
    setSelectedInstructorSeccionState(sec);
    setNavState({ selectedInstructorSeccion: sec });
  };

  useEffect(() => {
    const hour = new Date().getHours();
    if (hour < 12) {
      setCurrentGreeting("¡Buenos días!");
    } else if (hour < 18) {
      setCurrentGreeting("¡Buenas tardes!");
    } else {
      setCurrentGreeting("¡Buenas noches!");
    }
  }, []);

  const fullName = instructor
    ? `${instructor.primer_nombre || ''} ${instructor.segundo_nombre ? instructor.segundo_nombre + ' ' : ''}${instructor.primer_apellido || ''} ${instructor.segundo_apellido || ''}`.trim() || instructor.nombre_completo || "Instructor"
    : "Instructor";

  const isCreadorOrAdmin = hasAdministrationAccess(instructor?.rol);

  let todayFormatted = "";
  try {
    todayFormatted = new Date().toLocaleDateString("es-HN", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric"
    });
  } catch (_) {
    try {
      todayFormatted = new Date().toLocaleDateString("es-ES", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric"
      });
    } catch (_) {
      todayFormatted = new Date().toDateString();
    }
  }

  // Determina si el instructor actual es el Coordinador titular de una sección
  const checkIsCoord = useCallback((sec) => {
    if (!sec) return false;
    const coordStr = (sec.coordinador || "").toLowerCase().trim();
    const pNombre = (instructor?.primer_nombre || "").toLowerCase().trim();
    const pApellido = (instructor?.primer_apellido || "").toLowerCase().trim();
    const fName = fullName.toLowerCase().trim();
    return (
      Boolean(pNombre && pApellido && coordStr.includes(pNombre) && coordStr.includes(pApellido)) ||
      coordStr === fName ||
      (fName.length > 0 && coordStr.includes(fName))
    );
  }, [instructor, fullName]);

  // Cargar secciones y filtrar aquellas donde el instructor es Coordinador o Instructor Asignado
  const loadMisSecciones = useCallback(async () => {
    setLoadingSecciones(true);
    setSectionsError(false);
    try {
      const res = await api.secciones.getAll();
      if (res?.data) {
        const allSecs = res.data;

        // Filtrar secciones donde el instructor es Coordinador O está Asignado
        const misSecs = allSecs.filter((sec) => {
          const isCoord = checkIsCoord(sec);
          const isAssigned = Array.isArray(sec.instructores_asignados) && (
            (instructor?.id && sec.instructores_asignados.includes(instructor.id)) ||
            (instructor?.numero_cuenta && sec.instructores_asignados.includes(instructor.numero_cuenta))
          );
          return isCoord || isAssigned;
        });

        setMisSecciones(misSecs);
        try {
          safeStorage.setSession(`histolab_cached_mis_secciones_${instructor?.id || 'default'}`, JSON.stringify(misSecs));
        } catch (_) {}
      }
    } catch (err) {
      console.warn("Error al cargar mis secciones:", err);
      setSectionsError(true);
    } finally {
      setLoadingSecciones(false);
    }
  }, [instructor, checkIsCoord]);

  useEffect(() => {
    loadMisSecciones();
  }, [loadMisSecciones]);

  // Si se abre la vista de la sección como Coordinador
  if (selectedCoordinatorSeccion) {
    return (
      <CoordinatorSectionView
        seccion={selectedCoordinatorSeccion}
        currentInstructor={instructor}
        onClose={() => setSelectedCoordinatorSeccion(null)}
        notify={notify}
      />
    );
  }

  // Si se abre la vista de la sección como Instructor Asignado
  if (selectedInstructorSeccion) {
    return (
      <CoordinatorSectionView
        seccion={selectedInstructorSeccion}
        currentInstructor={instructor}
        onClose={() => setSelectedInstructorSeccion(null)}
        notify={notify}
      />
    );
  }

  // Si hay un módulo activo abierto (Administración General exclusiva para Creador y Administrador)
  if (activeModule === "user-management") {
    if (!isCreadorOrAdmin) {
      setActiveModule(null);
      return null;
    }
    return (
      <UserManagementView
        currentInstructor={instructor}
        onClose={() => setActiveModule(null)}
        notify={notify}
      />
    );
  }

  if (activeModule === "section-management") {
    if (!isCreadorOrAdmin) {
      setActiveModule(null);
      return null;
    }
    return (
      <SectionManagementView
        currentInstructor={instructor}
        onClose={() => setActiveModule(null)}
        notify={notify}
      />
    );
  }

  if (activeModule === "temario-management") {
    if (!isCreadorOrAdmin) {
      setActiveModule(null);
      return null;
    }
    return (
      <TemarioManagementView
        currentInstructor={instructor}
        onClose={() => setActiveModule(null)}
        notify={notify}
      />
    );
  }

  if (activeModule === "week-definition") {
    if (!isCreadorOrAdmin) {
      setActiveModule(null);
      return null;
    }
    return (
      <WeekDefinitionView
        currentInstructor={instructor}
        onClose={() => setActiveModule(null)}
        notify={notify}
      />
    );
  }

  const coordsCount = misSecciones.filter((sec) => checkIsCoord(sec)).length;
  const assignedCount = misSecciones.length - coordsCount;

  return (
    <div className="instructor-dashboard">
      {isCreadorOrAdmin && adminMenuSlot && (
        <>
          {createPortal(
            <button
              type="button"
              className="admin-menu-trigger"
              aria-label="Administración General"
              title="Administración General"
              aria-haspopup="dialog"
              aria-controls="admin-menu"
              onClick={() => adminMenu.current.showModal()}
            >
              <PanelLeftOpen size={21} aria-hidden="true" />
            </button>,
            adminMenuSlot
          )}
          <dialog
            ref={adminMenu}
            id="admin-menu"
            className="admin-menu"
            aria-labelledby="admin-menu-title"
            onClick={(event) => {
              if (event.target === event.currentTarget) adminMenu.current.close();
            }}
          >
            <div className="admin-menu__content">
              <header className="admin-menu__header">
                <h2 id="admin-menu-title">Administración General</h2>
                <button type="button" aria-label="Cerrar menú" onClick={() => adminMenu.current.close()}>
                  <X size={22} aria-hidden="true" />
                </button>
              </header>
              <nav className="admin-menu__modules" aria-label="Módulos administrativos">
                {ADMIN_MODULES.map(({ id, label, Icon }) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => {
                      adminMenu.current.close();
                      setActiveModule(id);
                    }}
                  >
                    <Icon size={20} aria-hidden="true" />
                    <span>{label}</span>
                    <ArrowRight size={17} aria-hidden="true" />
                  </button>
                ))}
              </nav>
            </div>
          </dialog>
        </>
      )}

      <section className="instructor-hero" aria-labelledby="instructor-welcome">
        <div className="instructor-hero__welcome">
          <p className="instructor-hero__eyebrow"><GraduationCap size={17} aria-hidden="true" /> Panel docente</p>
          <p className="instructor-hero__greeting">{currentGreeting}</p>
          <h1 id="instructor-welcome">{fullName}</h1>
          <p className="instructor-hero__date"><Calendar size={16} aria-hidden="true" /> {todayFormatted}</p>
        </div>

        <dl className="instructor-profile" aria-label="Perfil docente">
          {instructor?.numero_cuenta && (
            <div><dt>Cuenta</dt><dd>{instructor.numero_cuenta}</dd></div>
          )}
          <div><dt>Rol</dt><dd>{instructor?.rol || "Instructor"}</dd></div>
          {instructor?.comite && (
            <div><dt>Comité</dt><dd>{instructor.comite}</dd></div>
          )}
          <div><dt>Estado</dt><dd className="instructor-profile__status">Activo</dd></div>
        </dl>
      </section>

      <section className="instructor-sections" aria-labelledby="instructor-sections-title">
        <div className="instructor-sections__heading">
          <div>
            <h2 id="instructor-sections-title">Mis secciones</h2>
            <p>Consulta tus horarios y abre el espacio de trabajo de cada sección.</p>
          </div>
          {misSecciones.length > 0 && (
            <div className="instructor-sections__counts">
              {coordsCount > 0 && <span><strong>{coordsCount}</strong> {coordsCount === 1 ? "Coordinada" : "Coordinadas"}</span>}
              {assignedCount > 0 && <span><strong>{assignedCount}</strong> {assignedCount === 1 ? "Asignada" : "Asignadas"}</span>}
            </div>
          )}
        </div>

        {loadingSecciones && misSecciones.length === 0 ? (
          <p className="instructor-sections__empty" role="status">Cargando tus secciones…</p>
        ) : sectionsError && misSecciones.length === 0 ? (
          <div className="instructor-sections__empty">
            <span className="instructor-sections__empty-icon"><AlertCircle size={24} aria-hidden="true" /></span>
            <h3 role="alert">No pudimos cargar tus secciones</h3>
            <button type="button" className="instructor-section-card__open" onClick={loadMisSecciones}>Reintentar</button>
          </div>
        ) : misSecciones.length === 0 ? (
          <div className="instructor-sections__empty">
            <span className="instructor-sections__empty-icon"><Layers size={24} aria-hidden="true" /></span>
            <h3>No tienes secciones asignadas</h3>
            <p>Aquí aparecerán las secciones que coordines o en las que participes como instructor.</p>
          </div>
        ) : (
          <ul className="instructor-sections__grid">
            {misSecciones.map((sec) => {
              const isCoord = checkIsCoord(sec);
              const careerKey = (sec.carrera || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();
              const accent = CAREER_ACCENTS[careerKey] || "#445185";

              return (
                <li key={sec.id} className="instructor-section-card" style={{ "--section-accent": accent }}>
                  <header className="instructor-section-card__header">
                    <div>
                      <p><GraduationCap size={15} aria-hidden="true" /> {sec.carrera}</p>
                      <h3>{sec.codigo}</h3>
                    </div>
                    <span className={isCoord ? "instructor-section-card__role is-coordinator" : "instructor-section-card__role"}>
                      {isCoord ? <Star size={14} aria-hidden="true" /> : <Users size={14} aria-hidden="true" />}
                      {isCoord ? "Coordinador" : "Instructor"}
                    </span>
                  </header>

                  <div className="instructor-section-card__schedule">
                    <Clock size={18} aria-hidden="true" />
                    <div>
                      <strong>{sec.dia}</strong>
                      <span>{sec.hora_inicio} – {sec.hora_fin || "Fin"}</span>
                    </div>
                  </div>

                  <dl className="instructor-section-card__details">
                    <div><dt>Docente</dt><dd>{sec.doctor_encargado || "Dr. Rafael Perdomo Vaquero"}</dd></div>
                    <div><dt>Periodo</dt><dd>{sec.periodo_academico || "I PAC 2026"}</dd></div>
                  </dl>

                  <button
                    type="button"
                    className="instructor-section-card__open"
                    aria-label={`Abrir sección ${sec.codigo}`}
                    onClick={() => isCoord ? setSelectedCoordinatorSeccion(sec) : setSelectedInstructorSeccion(sec)}
                  >
                    Abrir sección <ArrowRight size={18} aria-hidden="true" />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
