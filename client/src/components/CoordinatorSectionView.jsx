import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  ArrowLeft, Star, Clock, Calendar, Layers, GraduationCap, Award, CalendarCheck, Users,
  Search, CheckCircle2, RefreshCw, FileSpreadsheet, ChevronRight, BookOpen, Database, Trophy, Radio,
  Hash, Mail, Phone
} from "lucide-react";
import { displaySectionCode } from "../../../shared/sectionCode.mjs";
import "./CoordinatorSectionView.css";
import { api } from "../services/api";
import SectionGradebookView from "./SectionGradebookView";
import SectionStudentsView from "./SectionStudentsView";
import SectionAssignmentsView from "./SectionAssignmentsView";
import WeeklyAttendanceTakingView from "./WeeklyAttendanceTakingView";
import WeeklyManualsGradingView from "./WeeklyManualsGradingView";
import WeeklyExamGradingView from "./WeeklyExamGradingView";
import SectionDataMigrationView from "./SectionDataMigrationView";
import WeeklyQuizCreationView from "./WeeklyQuizCreationView";
import ReviewQuizSubmissionsView from "./ReviewQuizSubmissionsView";
import SectionAwardsView from "./SectionAwardsView";
import LiveQuizControlView from "./LiveQuizControlView";
import { getNavState, setNavState } from "../utils/navigationState";
import { hasFullSectionAccess, isInstructorTitular } from "../utils/sectionRoleUtils";

const SECTION_MODULE_GROUPS = [
  {
    id: "general", title: "Módulos de la sección", hint: "Consulta el registro académico y el equipo docente.",
    modules: [
      { id: "matricula", label: "Estudiantes", description: "Matricula y administra estudiantes de esta sección.", Icon: GraduationCap, fullAccess: true },
      { id: "calificaciones", label: "Calificaciones", description: "Consulta el cuadro de notas.", Icon: FileSpreadsheet },
      { id: "asistencia", label: "Lista de asistencia", description: "Consulta el registro de asistencia.", Icon: Calendar },
      { id: "instructores", label: "Instructores", description: "Consulta el equipo de la sección.", Icon: Users },
      { id: "asignaciones", label: "Proporcionar asignaciones", description: "Distribuye las tareas por semana.", Icon: Layers, fullAccess: true }
    ]
  },
  {
    id: "weekly", title: "Trabajo semanal", hint: "Abre las herramientas de tus actividades académicas.",
    modules: [
      { id: "pasar_asistencia", label: "Pasar lista de asistencia", description: "Registra la asistencia de una práctica.", Icon: CalendarCheck },
      { id: "subir_manuales", label: "Subir nota de manuales", description: "Registra las notas de manuales.", Icon: BookOpen },
      { id: "subir_examen", label: "Subir nota de examen parcial", description: "Registra las notas de un parcial.", Icon: Award, fullAccess: true },
      { id: "crear_prueba", label: "Crear prueba semanal", description: "Prepara las preguntas de la semana.", Icon: FileSpreadsheet },
      { id: "control_en_vivo", label: "Control en vivo", description: "Abre y dirige una prueba en vivo.", Icon: Radio },
      { id: "revisar_respuestas", label: "Revisar respuestas", description: "Califica las pruebas enviadas.", Icon: CheckCircle2 },
      { id: "premios", label: "Premios de la sección", description: "Consulta el cuadro de honor.", Icon: Trophy }
    ]
  },
  {
    id: "data", title: "Datos de la sección", hint: "Importa registros académicos.",
    modules: [
      { id: "migrar_datos", label: "Migrar datos", description: "Importa notas, exámenes y asistencia.", Icon: Database, fullAccess: true }
    ]
  }
];

const FULL_ACCESS_MODULES = new Set(SECTION_MODULE_GROUPS.flatMap(group =>
  group.modules.filter(module => module.fullAccess).map(module => module.id)
));

function InstructorContact({ instructor }) {
  if (!instructor) return null;
  return (
    <div className="section-instructors__contact">
      {instructor.numero_cuenta && <span><Hash size={15} aria-hidden="true" /> Cuenta {instructor.numero_cuenta}</span>}
      {instructor.correo && <span><Mail size={15} aria-hidden="true" /> {instructor.correo}</span>}
      {instructor.telefono && <span><Phone size={15} aria-hidden="true" /> {instructor.telefono}</span>}
    </div>
  );
}

export default function CoordinatorSectionView({
  seccion,
  currentInstructor,
  onClose = () => {},
  notify = () => {}
}) {
  const initialNav = getNavState();
  const currentUser = currentInstructor || api.auth.getCurrentInstructor();
  const isTitular = useMemo(() => isInstructorTitular(currentUser, seccion), [currentUser, seccion]);

  const hasFullAccess = hasFullSectionAccess(currentUser, seccion);

  const [requestedModule, setActiveModuleState] = useState(
    () => initialNav.coordinatorSectionModule || null
  );

  const activeModule = !hasFullAccess && FULL_ACCESS_MODULES.has(requestedModule) ? null : requestedModule;

  const setActiveModule = (mod) => {
    setActiveModuleState(mod);
    setNavState({ coordinatorSectionModule: mod });
    if (mod) window.scrollTo({ top: 0, behavior: "instant" });
  };

  // Estado para preselección de semana al abrir Control en Vivo desde el creador
  const [liveQuizInitialSemana, setLiveQuizInitialSemana] = useState(null);

  // Estado para la Lista de Instructores de la sección
  const [allInstructors, setAllInstructors] = useState([]);
  const [loadingInstructores, setLoadingInstructores] = useState(false);
  const [instructorsError, setInstructorsError] = useState(false);
  const [searchTermInstructores, setSearchTermInstructores] = useState("");

  const loadInstructores = useCallback(async () => {
    setLoadingInstructores(true);
    setInstructorsError(false);
    try {
      const res = await api.auth.getInstructores();
      if (res?.data) {
        setAllInstructors(res.data);
      }
    } catch (err) {
      console.warn("Aviso al cargar instructores:", err);
      setInstructorsError(true);
    } finally {
      setLoadingInstructores(false);
    }
  }, []);

  useEffect(() => {
    if (activeModule === "instructores" || !activeModule) {
      loadInstructores();
    }
  }, [activeModule, loadInstructores]);

  if (!seccion) return null;

  const isSectionCoordinator = instructor =>
    isInstructorTitular(instructor, seccion) ||
    Boolean(instructor.numero_cuenta &&
      String(instructor.numero_cuenta).trim().toLowerCase() === seccion.coordinador?.trim().toLowerCase());

  // Obtener IDs de instructores asignados
  const assignedIds = Array.isArray(seccion.instructores_asignados)
    ? seccion.instructores_asignados
    : [];

  // Encontrar al Coordinador en la lista de instructores
  const coordinatorInstructor = allInstructors.find(isSectionCoordinator);

  // Instructores asignados a esta sección
  const assignedInstructorsList = allInstructors.filter((inst) => {
    const isAssigned =
      assignedIds.includes(inst.id) ||
      (inst.numero_cuenta && assignedIds.includes(inst.numero_cuenta));
    return isAssigned && !isSectionCoordinator(inst);
  });

  // Filtrado de instructores por búsqueda
  const filteredAssignedInstructors = assignedInstructorsList.filter((inst) => {
    const s = searchTermInstructores.toLowerCase().trim();
    if (!s) return true;
    const full = `${inst.primer_nombre || ''} ${inst.primer_apellido || ''} ${inst.nombre_completo || ''} ${inst.numero_cuenta || ''} ${inst.correo || ''}`.toLowerCase();
    return full.includes(s);
  });

  const totalInstructores = assignedIds.length + (seccion.coordinador ? 1 : 0);

  const titularName = coordinatorInstructor
    ? [coordinatorInstructor.primer_nombre, coordinatorInstructor.primer_apellido].filter(Boolean).join(" ") ||
      coordinatorInstructor.nombre_completo || seccion.coordinador
    : seccion.coordinador;
  const facts = [
    { label: "Horario", value: [seccion.dia, [seccion.hora_inicio, seccion.hora_fin].filter(Boolean).join(" – ")].filter(Boolean).join(" · "), Icon: Clock },
    { label: "Titular de sección", value: titularName, Icon: Star },
    { label: "Cátedra", value: seccion.doctor_encargado || "Dr. Rafael Perdomo Vaquero", Icon: GraduationCap },
    { label: "Equipo docente", value: `${totalInstructores} ${totalInstructores === 1 ? "instructor" : "instructores"}`, Icon: Users }
  ];

  return (
    <div className="section-panel">
      <header className="section-panel__header" data-full-access={hasFullAccess}>
        <div className="section-panel__top">
          <button type="button" className={activeModule ? "user-button user-button--primary" : "user-button"}
            onClick={activeModule ? () => setActiveModule(null) : onClose}>
            <ArrowLeft size={17} aria-hidden="true" /> {activeModule ? "Volver a Módulos de la Sección" : "Volver a Mis Secciones"}
          </button>
          <span className="section-panel__access" data-full-access={hasFullAccess}>
            {isTitular ? "Panel completo · Titular de sección" : hasFullAccess ? "Panel completo" : "Panel de instructor"}
          </span>
        </div>
        <div>
          <p className="section-panel__career">{seccion.carrera}</p>
          <h1>Panel de Administración <span className="section-panel__section-name">· Sección {displaySectionCode(seccion.codigo)}</span></h1>
        </div>
        <dl className="section-panel__facts">
          {facts.map(({ label, value, Icon }) => (
            <div key={label}>
              <dt><Icon size={16} aria-hidden="true" /> {label}</dt>
              <dd>{value || "Sin asignar"}</dd>
            </div>
          ))}
        </dl>
      </header>

      {activeModule === "matricula" ? (
        <SectionStudentsView seccion={seccion} hideBackButton hideGradebook notify={notify} />
      ) : !activeModule && SECTION_MODULE_GROUPS.map(({ id, title, hint, modules }) => {
        const visibleModules = modules.filter(module => hasFullAccess || !module.fullAccess);
        if (!visibleModules.length) return null;
        return (
          <section className="section-panel__group" aria-labelledby={`section-panel-${id}`} key={id}>
            <div className="section-panel__group-heading">
              <h2 id={`section-panel-${id}`}>{title}</h2>
              <p>{hint}</p>
            </div>
            <ul className="section-panel__modules">
              {visibleModules.map(({ id: moduleId, label, description, Icon }) => (
                <li key={moduleId}>
                  <button type="button" className="section-panel__module" onClick={() => {
                    if (moduleId === "control_en_vivo") setLiveQuizInitialSemana(null);
                    setActiveModule(moduleId);
                  }}>
                    <span className="section-panel__module-icon"><Icon size={20} aria-hidden="true" /></span>
                    <span className="section-panel__module-text">
                      <strong>{label}</strong>
                      <small>{description}</small>
                    </span>
                    <ChevronRight size={17} aria-hidden="true" className="section-panel__module-arrow" />
                  </button>
                </li>
              ))}
            </ul>
          </section>
        );
      })}

      {activeModule === "calificaciones" && (
        <SectionGradebookView
          seccion={seccion}
          forcedViewType="notas"
          hideBackButton={true}
          notify={notify}
        />
      )}

      {activeModule === "asistencia" && (
        <SectionGradebookView
          seccion={seccion}
          forcedViewType="asistencia"
          hideBackButton={true}
          notify={notify}
        />
      )}

      {activeModule === "asignaciones" && (
        <SectionAssignmentsView
          currentInstructor={currentInstructor}
          seccion={seccion}
          notify={notify}
        />
      )}

      {activeModule === "pasar_asistencia" && (
        <WeeklyAttendanceTakingView
          seccion={seccion}
          currentInstructor={currentInstructor}
          hideBackButton={true}
          onClose={() => setActiveModule(null)}
          notify={notify}
        />
      )}

      {activeModule === "subir_manuales" && (
        <WeeklyManualsGradingView
          seccion={seccion}
          currentInstructor={currentInstructor}
          hideBackButton={true}
          onClose={() => setActiveModule(null)}
          notify={notify}
        />
      )}


      {activeModule === "subir_examen" && hasFullAccess && (
        <WeeklyExamGradingView
          seccion={seccion}
          currentInstructor={currentInstructor}
          hideBackButton={true}
          onClose={() => setActiveModule(null)}
          notify={notify}
        />
      )}

      {activeModule === "migrar_datos" && (
        <SectionDataMigrationView
          seccion={seccion}
          currentInstructor={currentInstructor}
          hideBackButton={true}
          onClose={() => setActiveModule(null)}
          notify={notify}
        />
      )}

      {activeModule === "crear_prueba" && (
        <WeeklyQuizCreationView
          seccion={seccion}
          currentInstructor={currentInstructor}
          hideBackButton={true}
          onClose={() => setActiveModule(null)}
          notify={notify}
          onOpenLiveControl={(sem) => {
            setLiveQuizInitialSemana(sem);
            setActiveModule("control_en_vivo");
          }}
        />
      )}

      {activeModule === "control_en_vivo" && (
        <LiveQuizControlView
          seccion={seccion}
          currentInstructor={currentInstructor}
          initialSemana={liveQuizInitialSemana}
          hideBackButton={true}
          onClose={() => setActiveModule(null)}
          notify={notify}
        />
      )}

      {activeModule === "revisar_respuestas" && (
        <ReviewQuizSubmissionsView
          seccion={seccion}
          currentInstructor={currentInstructor}
          hideBackButton={true}
          onClose={() => setActiveModule(null)}
          notify={notify}
        />
      )}

      {activeModule === "premios" && (
        <SectionAwardsView
          seccion={seccion}
          currentInstructor={currentInstructor}
          hideBackButton={true}
          onClose={() => setActiveModule(null)}
          notify={notify}
        />
      )}

      {activeModule === "instructores" && (
        <section className="user-directory section-instructors" aria-labelledby="section-instructors-title">
          <header className="user-directory__hero">
            <div>
              <p className="user-directory__eyebrow"><Users size={17} aria-hidden="true" /> Instructores</p>
              <h2 id="section-instructors-title">Equipo docente</h2>
              <p>Consulta el titular y los instructores asignados a esta sección.</p>
            </div>
          </header>

          <section className="section-instructors__titular" aria-labelledby="section-instructors-titular">
            <span className="section-instructors__avatar" aria-hidden="true"><Star size={22} /></span>
            <div>
              <h3 id="section-instructors-titular">Titular de sección</h3>
              <p className="section-instructors__name">{titularName || "Sin titular asignado"}</p>
              <InstructorContact instructor={coordinatorInstructor} />
            </div>
          </section>

          <section className="user-directory__results" aria-labelledby="section-instructors-assigned" aria-busy={loadingInstructores}>
            <div className="user-directory__toolbar">
              <div>
                <h3 id="section-instructors-assigned">Instructores asignados</h3>
                {!loadingInstructores && !instructorsError && <p>{assignedInstructorsList.length} en esta sección</p>}
              </div>
              <div className="user-directory__tools">
                <label className="user-directory__search">
                  <Search size={17} aria-hidden="true" />
                  <input type="search" aria-label="Buscar instructores asignados" placeholder="Buscar instructor"
                    value={searchTermInstructores} onChange={event => setSearchTermInstructores(event.target.value)} />
                </label>
                <button type="button" className="user-button user-button--icon" onClick={loadInstructores}
                  disabled={loadingInstructores} aria-label="Actualizar instructores" title="Actualizar instructores">
                  <RefreshCw size={18} aria-hidden="true" />
                </button>
              </div>
            </div>

            {loadingInstructores ? (
              <p className="user-directory__state" role="status">Cargando instructores…</p>
            ) : instructorsError ? (
              <div className="user-directory__state" role="alert">
                <p>No pudimos cargar los instructores de esta sección.</p>
                <button type="button" className="user-button" onClick={loadInstructores}>Reintentar</button>
              </div>
            ) : filteredAssignedInstructors.length === 0 ? (
              <p className="user-directory__state" role="status">
                {searchTermInstructores.trim() ? "No hay instructores que coincidan con la búsqueda."
                  : "No hay instructores adicionales asignados a esta sección."}
              </p>
            ) : (
              <ul className="section-instructors__list">
                {filteredAssignedInstructors.map(instructor => {
                  const name = [instructor.primer_nombre, instructor.primer_apellido].filter(Boolean).join(" ") ||
                    instructor.nombre_completo || "Instructor";
                  return (
                    <li key={instructor.id || instructor.numero_cuenta} className="section-instructors__card">
                      <span className="section-instructors__avatar" aria-hidden="true">{name[0].toUpperCase()}</span>
                      <div>
                        <h4 className="section-instructors__name">{name}</h4>
                        <InstructorContact instructor={instructor} />
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </section>
      )}
    </div>
  );
}

