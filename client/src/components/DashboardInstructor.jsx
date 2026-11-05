import { hasAdministrationAccess } from "../../../shared/instructorRoles.mjs";
import { canViewSection, isInstructorTitular, isSectionAssignedToInstructor } from "../../../shared/sectionAccess.mjs";
import { normalizeSectionCareer } from "../../../shared/sectionCode.mjs";
import { scheduleTimeMinutes } from "../../../shared/academicSchedule.mjs";
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
  { id: "user-management", label: "Administración de usuarios", Icon: Users, View: UserManagementView },
  { id: "section-management", label: "Administración de secciones", Icon: Layers, View: SectionManagementView },
  { id: "temario-management", label: "Gestión de temario", Icon: BookOpen, View: TemarioManagementView },
  { id: "week-definition", label: "Definición de semanas", Icon: Calendar, View: WeekDefinitionView }
];

const SECTION_DAYS = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];
const SECTION_DAY_INDEX = new Map(SECTION_DAYS.map((day, index) => [normalizeSectionCareer(day), index]));
const sectionCodeSort = new Intl.Collator("es-HN", { numeric: true });

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
  const canManageSite = hasAdministrationAccess(instructor?.rol);
  const cacheKey = `histolab_cached_sections_${instructor?.id || "default"}_${instructor?.rol || "Instructor"}`;
  const [sections, setSections] = useState(() => {
    try {
      const cached = safeStorage.getSession(cacheKey);
      return cached ? JSON.parse(cached) : [];
    } catch {
      return [];
    }
  });
  const [loadingSecciones, setLoadingSecciones] = useState(() => {
    try {
      const cached = safeStorage.getSession(cacheKey);
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

  const loadMisSecciones = useCallback(async () => {
    setLoadingSecciones(true);
    setSectionsError(false);
    try {
      const res = await api.secciones.getAll();
      const visibleSections = (res?.data || []).filter(section => canViewSection(instructor, section));
      setSections(visibleSections);
      safeStorage.setSession(cacheKey, JSON.stringify(visibleSections));
    } catch (err) {
      console.warn("Error al cargar mis secciones:", err);
      setSectionsError(true);
    } finally {
      setLoadingSecciones(false);
    }
  }, [instructor, cacheKey]);

  useEffect(() => {
    loadMisSecciones();
  }, [loadMisSecciones]);

  const navigateFromMenu = (moduleId) => {
    adminMenu.current.close();
    setSelectedCoordinatorSeccion(null);
    setSelectedInstructorSeccion(null);
    setActiveModule(moduleId);
  };

  const menu = canManageSite && adminMenuSlot && (
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
          <nav className="admin-menu__modules" aria-label="Navegación docente">
            <button type="button" onClick={() => navigateFromMenu(null)}>
              <GraduationCap size={20} aria-hidden="true" />
              <span>Panel docente</span>
              <ArrowRight size={17} aria-hidden="true" />
            </button>
            {ADMIN_MODULES.map(({ id, label, Icon }) => (
              <button
                key={id}
                type="button"
                onClick={() => navigateFromMenu(id)}
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
  );

  const selectedSection = selectedCoordinatorSeccion || selectedInstructorSeccion;
  if (selectedSection && canViewSection(instructor, selectedSection)) {
    return (
      <>
        {menu}
        <CoordinatorSectionView
          seccion={selectedSection}
          currentInstructor={instructor}
          onClose={() => selectedCoordinatorSeccion
            ? setSelectedCoordinatorSeccion(null)
            : setSelectedInstructorSeccion(null)}
          notify={notify}
        />
      </>
    );
  }

  const ActiveView = canManageSite && ADMIN_MODULES.find(({ id }) => id === activeModule)?.View;
  if (ActiveView) {
    return (
      <>
        {menu}
        <ActiveView
          currentInstructor={instructor}
          onClose={() => setActiveModule(null)}
          onOpenTemario={career => {
            setNavState({ temarioCarrera: career, temarioArea: "weeks" });
            setActiveModule("temario-management");
          }}
          notify={notify}
        />
      </>
    );
  }

  const misSecciones = sections.filter(section => isSectionAssignedToInstructor(instructor, section));
  const coordsCount = misSecciones.filter(section => isInstructorTitular(instructor, section)).length;
  const assignedCount = misSecciones.length - coordsCount;

  const sectionsByDay = [...SECTION_DAYS, "Sin día asignado"].map(day => ({ day, sections: [] }));
  if (canManageSite) {
    for (const section of sections) {
      const index = SECTION_DAY_INDEX.get(normalizeSectionCareer(section.dia)) ?? SECTION_DAYS.length;
      sectionsByDay[index].sections.push(section);
    }
    for (const group of sectionsByDay) {
      group.sections.sort((left, right) =>
        (scheduleTimeMinutes(left.hora_inicio) ?? 1440) - (scheduleTimeMinutes(right.hora_inicio) ?? 1440) ||
        sectionCodeSort.compare(left.codigo, right.codigo));
    }
  }

  const renderSection = sec => {
    const isCoord = isInstructorTitular(instructor, sec);
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
            {isCoord ? "Titular de sección" : canManageSite ? "Acceso completo" : "Instructor"}
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
          onClick={() => {
            setNavState({ coordinatorSectionModule: null });
            if (isCoord) setSelectedCoordinatorSeccion(sec);
            else setSelectedInstructorSeccion(sec);
          }}
        >
          Abrir sección <ArrowRight size={18} aria-hidden="true" />
        </button>
      </li>
    );
  };

  const dashboard = (
    <div className="instructor-dashboard">
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
              {coordsCount > 0 && <span><strong>{coordsCount}</strong> como titular</span>}
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
            {misSecciones.map(renderSection)}
          </ul>
        )}
      </section>
      {canManageSite && (
        <section className="instructor-sections" aria-labelledby="instructor-all-sections-title">
          <div className="instructor-sections__heading">
            <div>
              <h2 id="instructor-all-sections-title">Todas las secciones</h2>
              <p>Consulta el directorio por día y hora.</p>
            </div>
          </div>
          {sectionsByDay.filter(group => group.sections.length).map(group => (
            <section className="instructor-sections__day" key={group.day}>
              <h3>{group.day}</h3>
              <ul className="instructor-sections__grid">{group.sections.map(renderSection)}</ul>
            </section>
          ))}
          {!loadingSecciones && !sectionsError && !sections.length && (
            <p className="instructor-sections__empty">No hay secciones registradas.</p>
          )}
        </section>
      )}
    </div>
  );

  return <>{menu}{dashboard}</>;
}
