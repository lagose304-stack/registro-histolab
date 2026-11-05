import { hasAdministrationAccess } from "../../../shared/instructorRoles.mjs";
import { displaySectionCode } from "../../../shared/sectionCode.mjs";
import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  ArrowLeft, CalendarDays, Download, Edit3, GraduationCap, Layers, LayoutGrid, Plus,
  RefreshCw, Search, Trash2, Users
} from "lucide-react";
import { api } from "../services/api";
import { getNavState, setNavState } from "../utils/navigationState";
import { isInstructorTitular } from "../utils/sectionRoleUtils";
import SectionManagementModal from "./SectionManagementModal";
import SectionInstructorsModal from "./SectionInstructorsModal";
import SectionStudentsView from "./SectionStudentsView";

const AREAS = {
  secciones: { label: "Secciones", Icon: Layers, hint: "Edita los datos y horarios de cada sección." },
  instructores: { label: "Instructores", Icon: Users, hint: "Elige una sección para administrar su equipo docente." },
  estudiantes: { label: "Estudiantes", Icon: GraduationCap, hint: "Elige una sección para abrir su lista de estudiantes." }
};

const CAREERS = {
  MEDICINA: "Medicina",
  ENFERMERIA: "Enfermería",
  ODONTOLOGIA: "Odontología",
  MICROBIOLOGIA: "Microbiología",
  NUTRICION: "Nutrición"
};

const DAYS = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];
const BLOCK_STARTS = ["07:00", "09:00", "11:00", "13:00", "15:00", "17:00"];

const normalize = (value) => String(value ?? "").trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
const instructorName = (instructor) =>
  [instructor.primer_nombre, instructor.primer_apellido].filter(Boolean).join(" ") || instructor.nombre_completo || "Instructor";

export default function SectionManagementView({ currentInstructor, onClose, notify = () => {} }) {
  const [area, setArea] = useState(() => {
    const saved = getNavState().sectionManagementSubTab;
    return Object.hasOwn(AREAS, saved) ? saved : "secciones";
  });
  const [career, setCareer] = useState(() => getNavState().sectionManagementCarrera || "TODAS");
  const [view, setView] = useState("calendar");
  const calendarTable = useRef(null);
  const [downloading, setDownloading] = useState(false);
  const [studentsSection, setStudentsSection] = useState(() => getNavState().selectedSectionForStudents || null);
  const [sections, setSections] = useState([]);
  const [instructors, setInstructors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [search, setSearch] = useState("");
  const [modal, setModal] = useState(null);
  const isAuthorized = hasAdministrationAccess(currentInstructor?.rol);

  const loadData = useCallback(async () => {
    if (!isAuthorized) return;
    setLoading(true);
    setLoadError("");
    try {
      const [sectionResult, instructorResult] = await Promise.all([
        api.secciones.getAll(),
        api.auth.getInstructores()
      ]);
      const freshSections = sectionResult?.data || [];
      setSections(freshSections);
      setInstructors(instructorResult?.data || []);
      const savedSection = getNavState().selectedSectionForStudents;
      if (savedSection) {
        const fresh = freshSections.find(section => section.id === savedSection.id) || null;
        setStudentsSection(fresh);
        setNavState({ selectedSectionForStudents: fresh });
      }
    } catch (error) {
      setLoadError("No pudimos cargar las secciones y los instructores.");
      console.warn("Error al cargar secciones o instructores:", error);
    } finally {
      setLoading(false);
    }
  }, [isAuthorized]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const back = (
    <button type="button" className="section-admin__button section-admin__back" onClick={onClose}>
      <ArrowLeft size={17} aria-hidden="true" /> Panel docente
    </button>
  );

  if (!isAuthorized) {
    return (
      <section className="section-admin">
        {back}
        <p className="section-admin__state">Creador y Coordinador pueden gestionar las secciones.</p>
      </section>
    );
  }

  const openStudents = (section) => {
    setStudentsSection(section);
    setNavState({ selectedSectionForStudents: section });
  };

  if (studentsSection) {
    return <SectionStudentsView seccion={studentsSection} onClose={() => openStudents(null)} notify={notify} />;
  }

  const activeArea = AREAS[area];
  const query = normalize(search);
  const hasFilters = Boolean(query || career !== "TODAS");
  const visible = sections.filter(section =>
    (career === "TODAS" || normalize(section.carrera) === normalize(career)) &&
    (!query || [section.codigo, section.nombre, section.carrera, section.dia, section.coordinador, section.doctor_encargado]
      .some(value => normalize(value).includes(query)))
  );
  const activeCount = sections.filter(section => section.activa).length;
  const instructorsByKey = new Map((area === "instructores" ? instructors : []).flatMap(instructor =>
    [instructor.id, instructor.numero_cuenta].filter(Boolean).map(key => [String(key), instructor])
  ));

  const setCareerFilter = (value) => {
    setCareer(value);
    setNavState({ sectionManagementCarrera: value });
  };

  const downloadCalendar = async () => {
    const table = calendarTable.current;
    if (!table || downloading) return;
    setDownloading(true);
    try {
      const { downloadInstructorCalendar } = await import("../utils/exportInstructorCalendar");
      await downloadInstructorCalendar(table, CAREERS[career] || "Todas las carreras");
    } catch {
      notify("No pudimos descargar la imagen del calendario.", "error");
    } finally {
      setDownloading(false);
    }
  };

  const renderSection = (section, compact = false) => {
    const schedule = [section.hora_inicio, section.hora_fin].filter(Boolean).join(" – ");
    const assigned = [...new Set((Array.isArray(section.instructores_asignados) ? section.instructores_asignados : [])
      .map(key => instructorsByKey.get(String(key))).filter(Boolean))];
    const sectionName = `Sección ${section.codigo}`;
    const careerName = CAREERS[normalize(section.carrera).toUpperCase()] || section.carrera || "—";
    const chairName = section.doctor_encargado || "Sin asignar";
    const coordinator = section.coordinador?.trim();
    const calendarInstructors = compact && area === "instructores";

    return (
      <li key={section.id} className={compact ? "section-admin__card section-admin__card--calendar" : "section-admin__card"}>
        <div className="section-admin__card-top">
          <div>
            <h4 title={sectionName}>Sección {displaySectionCode(section.codigo)}</h4>
            {!compact && <p>{section.nombre || "Laboratorio de Histología"}</p>}
          </div>
          {!compact && (
            <span className={section.activa ? "section-admin__badge is-active" : "section-admin__badge"}>
              {section.activa ? "Activa" : "Inactiva"}
            </span>
          )}
        </div>
        {calendarInstructors ? (
          <div className="section-admin__facts">
            <p>{careerName}</p>
            <p>{chairName}</p>
            <p>Instructores:</p>
            <ul className="section-admin__instructor-list">
              {coordinator && <li><strong>{coordinator}</strong></li>}
              {assigned.filter(instructor => !isInstructorTitular(instructor, section)).map(instructor => (
                <li key={instructor.id || instructor.numero_cuenta}>{instructorName(instructor)}</li>
              ))}
              {!coordinator && !assigned.length && <li>Sin instructores asignados</li>}
            </ul>
          </div>
        ) : <dl className="section-admin__facts">
          <div><dt>Carrera</dt><dd>{careerName}</dd></div>
          {!compact && (
            <>
              <div><dt>Horario</dt><dd>{[section.dia, schedule].filter(Boolean).join(" · ") || "Sin horario"}</dd></div>
              <div><dt>Titular de sección</dt><dd>{section.coordinador || "Sin asignar"}</dd></div>
            </>
          )}
          {!compact && area === "instructores" ? (
            <div>
              <dt>Asignados</dt>
              <dd>{assigned.map(instructorName).join(", ") || "Sin instructores asignados"}</dd>
            </div>
          ) : (
            <div><dt>Cátedra</dt><dd>{chairName}</dd></div>
          )}
          {!compact && <div><dt>Periodo</dt><dd>{section.periodo_academico || "—"}</dd></div>}
        </dl>}
        <div className="section-admin__actions">
          {area === "instructores" ? (
            <button type="button" className="section-admin__button section-admin__primary"
              aria-label={`Asignar instructores a ${sectionName}`} onClick={() => setModal({ mode: "instructors", section })}>
              <Users size={17} aria-hidden="true" /> Asignar instructores
            </button>
          ) : area === "estudiantes" ? (
            <button type="button" className="section-admin__button section-admin__primary"
              aria-label={`Ver estudiantes de ${sectionName}`} onClick={() => openStudents(section)}>
              <GraduationCap size={17} aria-hidden="true" /> Ver estudiantes
            </button>
          ) : (
            <>
              <button type="button" className="section-admin__button" aria-label={`Editar ${sectionName}`} title={compact ? "Editar sección" : undefined}
                onClick={() => setModal({ mode: "edit", section })}>
                <Edit3 size={16} aria-hidden="true" /> {!compact && "Editar"}
              </button>
              <button type="button" className="section-admin__button section-admin__danger" title={compact ? "Eliminar sección" : undefined}
                aria-label={`Eliminar ${sectionName}`} onClick={() => setModal({ mode: "delete", section })}>
                <Trash2 size={16} aria-hidden="true" /> {!compact && "Eliminar"}
              </button>
            </>
          )}
        </div>
      </li>
    );
  };

  const calendarCells = new Map();
  const unscheduled = [];
  let hasOtherHours = false;
  if (view === "calendar") {
    for (const section of visible) {
      const day = DAYS.findIndex(label => normalize(label) === normalize(section.dia));
      if (day === -1) {
        unscheduled.push(section);
        continue;
      }
      const start = String(section.hora_inicio || "").trim().match(/^\d{1,2}:\d{2}/)?.[0].padStart(5, "0") || "";
      const block = BLOCK_STARTS.slice(0, -1).findIndex((time, index) => start >= time && start < BLOCK_STARTS[index + 1]);
      const row = block === -1 ? BLOCK_STARTS.length - 1 : block;
      if (block === -1) hasOtherHours = true;
      const key = `${row}-${day}`;
      if (!calendarCells.has(key)) calendarCells.set(key, []);
      calendarCells.get(key).push(section);
    }
  }
  const calendarRows = BLOCK_STARTS.slice(0, -1).map((start, index) => `${start} – ${BLOCK_STARTS[index + 1]}`);
  if (hasOtherHours) calendarRows.push("Otros horarios");

  return (
    <section className="section-admin" aria-labelledby="section-admin-title">
      {back}
      <header className="section-admin__hero">
        <div>
          <p className="section-admin__eyebrow"><Layers size={16} aria-hidden="true" /> Administración general</p>
          <h2 id="section-admin-title">Administración de secciones</h2>
          <p>Gestiona las secciones, sus instructores y sus estudiantes.</p>
        </div>
        {activeArea === AREAS.secciones && (
          <button type="button" className="section-admin__button section-admin__primary" onClick={() => setModal({ mode: "create" })}>
            <Plus size={19} aria-hidden="true" /> Crear sección
          </button>
        )}
      </header>

      <nav className="section-admin__areas" aria-label="Áreas de administración">
        {Object.entries(AREAS).map(([id, { label, Icon }]) => (
          <button type="button" key={id} className="section-admin__button"
            aria-pressed={activeArea === AREAS[id]} onClick={() => {
              setArea(id);
              setNavState({ sectionManagementSubTab: id });
            }}>
            <Icon size={19} aria-hidden="true" /> {label}
          </button>
        ))}
      </nav>

      <section className="section-admin__workspace" aria-labelledby="section-workspace-title">
        <div className="section-admin__toolbar">
          <div className="section-admin__context">
            <div>
              <h3 id="section-workspace-title">{area === "secciones" ? "Directorio de secciones" : `${activeArea.label} por sección`}</h3>
              <p>{activeArea.hint}</p>
            </div>
            <button type="button" className="section-admin__button section-admin__icon" onClick={loadData}
              disabled={loading} aria-label="Actualizar secciones" title="Actualizar secciones">
              <RefreshCw size={18} aria-hidden="true" />
            </button>
          </div>
          <div className="section-admin__filters">
            <label>
              <span>Buscar sección</span>
              <span className="section-admin__search">
                <Search size={17} aria-hidden="true" />
                <input type="search" placeholder="Código, nombre o titular" value={search} onChange={event => setSearch(event.target.value)} />
              </span>
            </label>
            <div className="section-admin__filter">
              <label htmlFor="section-admin-career">Carrera</label>
              <select id="section-admin-career" value={career} onChange={event => setCareerFilter(event.target.value)}>
                <option value="TODAS">Todas las carreras</option>
                {Object.entries(CAREERS).map(([id, label]) => <option key={id} value={id}>{label}</option>)}
              </select>
            </div>
          </div>
          <div className="section-admin__view">
            <p role="status">{loading ? "Cargando…" : !loadError && (hasFilters
              ? `${visible.length} de ${sections.length} secciones`
              : `${sections.length} secciones · ${activeCount} activas`)}</p>
            <div className="section-admin__switch" role="group" aria-label="Vista de secciones">
              {area === "instructores" && view === "calendar" && (
                <button type="button" className="section-admin__button" onClick={downloadCalendar}
                  disabled={loading || Boolean(loadError) || !calendarCells.size || downloading}>
                  <Download size={16} aria-hidden="true" /> {downloading ? "Generando…" : "Descargar imagen"}
                </button>
              )}
              {[["table", "Fichas", LayoutGrid], ["calendar", "Calendario", CalendarDays]].map(([id, label, Icon]) => (
                <button type="button" key={id} className="section-admin__button" aria-pressed={view === id} onClick={() => {
                  setView(id);
                }}>
                  <Icon size={16} aria-hidden="true" /> {label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {loading ? (
          <p className="section-admin__state">Cargando secciones…</p>
        ) : loadError ? (
          <div className="section-admin__state" role="alert">
            <p>{loadError}</p>
            <button type="button" className="section-admin__button" onClick={loadData}>Reintentar</button>
          </div>
        ) : visible.length === 0 ? (
          <div className="section-admin__state" role="status">
            <p>{hasFilters ? "No hay secciones que coincidan con los filtros." : "Aún no hay secciones registradas."}</p>
            {hasFilters && <button type="button" className="section-admin__button" onClick={() => {
              setSearch("");
              setCareerFilter("TODAS");
            }}>Limpiar filtros</button>}
          </div>
        ) : view === "calendar" ? (
          <>
            <p className="section-admin__calendar-hint">Desliza el calendario para ver todos los días.</p>
            <div className="section-admin__calendar" tabIndex={0} role="region" aria-label="Calendario semanal de secciones">
              <table ref={calendarTable}>
                <thead>
                  <tr>
                    <th scope="col">Hora</th>
                    {DAYS.map(day => <th key={day} scope="col">{day}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {calendarRows.map((label, row) => (
                    <tr key={label}>
                      <th scope="row">{label}</th>
                      {DAYS.map((day, column) => {
                        const items = calendarCells.get(`${row}-${column}`);
                        return (
                          <td key={day}>
                            {items && <ul>{items.map(section => renderSection(section, true))}</ul>}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {unscheduled.length > 0 && (
              <section aria-labelledby="section-unscheduled">
                <h4 id="section-unscheduled" className="section-admin__unscheduled">Sin día asignado</h4>
                <ul className="section-admin__cards">{unscheduled.map(section => renderSection(section, true))}</ul>
              </section>
            )}
          </>
        ) : (
          <ul className="section-admin__cards">{visible.map(section => renderSection(section))}</ul>
        )}
      </section>

      {modal?.mode === "instructors" ? (
        <SectionInstructorsModal section={modal.section} allInstructors={instructors}
          onClose={() => setModal(null)} onSuccess={loadData} notify={notify} />
      ) : modal && (
        <SectionManagementModal mode={modal.mode} selectedSection={modal.section} sections={sections} instructors={instructors}
          onClose={() => setModal(null)} onSuccess={loadData} notify={notify} />
      )}
    </section>
  );
}
