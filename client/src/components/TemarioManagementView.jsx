import { hasAdministrationAccess } from "../../../shared/instructorRoles.mjs";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  AlertTriangle, ArrowLeft, ArrowUpDown, Award, BookOpen, CalendarDays, Check, Copy, Edit3,
  LayoutGrid, List, Plus, RefreshCw, Search, Trash2
} from "lucide-react";
import { api } from "../services/api";
import { getNavState, setNavState } from "../utils/navigationState";
import TemarioManagementModal from "./TemarioManagementModal";
import TemarioDialog from "./TemarioDialog";
import TemarioOrder from "./TemarioOrder";
import TemarioScoresWorkspace from "./TemarioScoresWorkspace";
import TemarioWeeksWorkspace from "./TemarioWeeksWorkspace";

const CAREERS = ["Medicina", "Enfermería", "Odontología", "Microbiología", "Nutrición"];
const AREAS = [
  { id: "topics", label: "Temas", hint: "Crear y ordenar temas", Icon: BookOpen },
  { id: "weeks", label: "Semanas", hint: "Planear clases y exámenes", Icon: CalendarDays },
  { id: "scores", label: "Puntajes", hint: "Repartir los puntos", Icon: Award }
];

const normalize = value => String(value ?? "").trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

export default function TemarioManagementView({ currentInstructor, onClose, notify = () => {} }) {
  const [career, setCareer] = useState(() => {
    const saved = getNavState().temarioCarrera;
    return CAREERS.includes(saved) ? saved : CAREERS[0];
  });
  const [view, setView] = useState(() => getNavState().temarioViewMode === "table" ? "table" : "grid");
  const [topics, setTopics] = useState([]);
  const [readyCareer, setReadyCareer] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [search, setSearch] = useState("");
  const [area, setArea] = useState(() => {
    const saved = getNavState().temarioArea;
    return AREAS.some(item => item.id === saved) ? saved : "topics";
  });
  const [ordering, setOrdering] = useState(false);
  const [modal, setModal] = useState(null);
  const [sourceCareer, setSourceCareer] = useState("");
  const [copying, setCopying] = useState(false);
  const [copyError, setCopyError] = useState("");
  const activeCareer = useRef(career);
  const requestId = useRef(0);
  const isAuthorized = hasAdministrationAccess(currentInstructor?.rol);

  const loadData = useCallback(async () => {
    if (!isAuthorized || activeCareer.current !== career) return;
    const request = ++requestId.current;
    setLoading(true);
    setLoadError(false);
    try {
      const result = await api.temario.getAll({ carrera: career });
      if (request === requestId.current) {
        setTopics([...(result?.data || [])].sort((a, b) =>
          (Number(a.semana) || 999) - (Number(b.semana) || 999) ||
          (Number(a.numero_tema) || 999) - (Number(b.numero_tema) || 999)
        ));
        setReadyCareer(career);
      }
    } catch (error) {
      if (request === requestId.current) setLoadError(true);
      console.warn("Error al cargar temario:", error);
    } finally {
      if (request === requestId.current) setLoading(false);
    }
  }, [career, isAuthorized]);

  useEffect(() => {
    loadData();
    return () => { requestId.current++; };
  }, [loadData]);

  const copyOpen = modal?.mode === "copy";

  const back = (
    <button type="button" className="user-button user-button--back" onClick={onClose}>
      <ArrowLeft size={17} aria-hidden="true" /> Panel docente
    </button>
  );

  if (!isAuthorized) {
    return (
      <section className="user-directory">
        {back}
        <p className="user-directory__state">Creador y Coordinador pueden gestionar los temarios.</p>
      </section>
    );
  }

  const openCopy = () => {
    setSourceCareer("");
    setCopyError("");
    setModal({ mode: "copy" });
  };

  const handleCopy = async (event) => {
    event.preventDefault();
    if (!sourceCareer || sourceCareer === career) return;
    setCopying(true);
    setCopyError("");
    try {
      const result = await api.temario.copy(sourceCareer, career);
      notify(result.message || `Temario copiado a ${career}`, "success");
      setModal(null);
      loadData();
    } catch (error) {
      setCopyError(error.message || "No pudimos copiar el temario.");
    } finally {
      setCopying(false);
    }
  };

  const query = normalize(search);
  const filtered = topics.filter(topic => !query ||
    [topic.titulo || topic.nombre, topic.numero_tema, topic.semana && `Semana ${topic.semana}`]
      .some(value => normalize(value).includes(query))
  );
  const weeks = new Map();
  for (const topic of filtered) {
    const week = Number(topic.semana) || null;
    if (!weeks.has(week)) weeks.set(week, []);
    weeks.get(week).push(topic);
  }

  const renderTopic = (topic) => {
    const title = topic.titulo || topic.nombre || "Tema sin título";
    return (
      <li key={topic.id} className="user-card temario-topic">
        <div className="user-card__identity">
          <span className="user-card__avatar" aria-hidden="true">{topic.numero_tema || "—"}</span>
          <h4>{title}</h4>
        </div>
        <div className="user-card__badges">
          {view === "table" && <span className="user-badge">{topic.semana ? `Semana ${topic.semana}` : "Sin semana"}</span>}
          <span className={topic.tiene_manual !== false ? "user-badge user-badge--active" : "user-badge user-badge--inactive"}>
            {topic.tiene_manual !== false ? "Con manual" : "Sin manual"}
          </span>
        </div>
        <div className="user-card__actions">
          <button type="button" className="user-button" aria-label={`Editar ${title}`} onClick={() => setModal({ mode: "edit", topic })}>
            <Edit3 size={16} aria-hidden="true" /> Editar
          </button>
          <button type="button" className="user-button user-button--danger" aria-label={`Eliminar ${title}`} onClick={() => setModal({ mode: "delete", topic })}>
            <Trash2 size={16} aria-hidden="true" /> Eliminar
          </button>
        </div>
      </li>
    );
  };

  return (
    <section className="user-directory temario-directory" aria-labelledby="temario-directory-title">
      {back}
      <header className="user-directory__hero">
        <div>
          <p className="user-directory__eyebrow"><BookOpen size={17} aria-hidden="true" /> Administración general</p>
          <h2 id="temario-directory-title">Administración de temario por carrera</h2>
          <p>Gestiona el programa académico.</p>
        </div>
      </header>

      <section className="temario-context" aria-labelledby="temario-context-title">
        <div className="temario-context__career">
          <h3 id="temario-context-title">Carrera activa</h3>
          <label className="user-field">
            <select aria-label="Elegir carrera" value={career} onChange={event => {
              const next = event.target.value;
              requestId.current++;
              activeCareer.current = next;
              setOrdering(false);
              setSearch("");
              setCareer(next);
              setTopics([]);
              setReadyCareer(null);
              setLoading(true);
              setLoadError(false);
              setNavState({ temarioCarrera: next });
            }}>
              {CAREERS.map(value => <option key={value}>{value}</option>)}
            </select>
          </label>
        </div>
      </section>

      <section className="temario-navigation" aria-labelledby="temario-nav-title">
        <h3 id="temario-nav-title">Áreas de trabajo</h3>
        <div className="temario-nav" role="tablist" aria-labelledby="temario-nav-title"
          onKeyDown={event => {
            const tabs = [...event.currentTarget.querySelectorAll('[role="tab"]')];
            const index = tabs.indexOf(event.target);
            const next = {
              ArrowLeft: (index + tabs.length - 1) % tabs.length,
              ArrowRight: (index + 1) % tabs.length,
              Home: 0,
              End: tabs.length - 1
            }[event.key];
            if (next === undefined) return;
            event.preventDefault();
            tabs[next].focus();
          }}>
          {AREAS.map(({ id, label, hint, Icon }) => (
            <button type="button" key={id} id={`temario-tab-${id}`} className="temario-nav__tab"
              role="tab" aria-selected={area === id} aria-controls={`temario-panel-${id}`}
              aria-labelledby={`temario-label-${id}`} aria-describedby={`temario-hint-${id}`} tabIndex={area === id ? 0 : -1}
              onClick={() => {
                if (id !== area) {
                  setArea(id);
                  setNavState({ temarioArea: id });
                  setOrdering(false);
                }
              }}>
              <span className="temario-nav__icon"><Icon size={19} aria-hidden="true" /></span>
              <strong id={`temario-label-${id}`}>{label}</strong>
              <span className="temario-nav__hint" id={`temario-hint-${id}`}>{hint}</span>
              {area === id && <Check className="temario-nav__check" size={14} aria-hidden="true" />}
            </button>
          ))}
        </div>
      </section>

      {loading ? <p className="user-directory__state" role="status">Cargando temas…</p> : loadError ? (
        <div className="user-directory__state" role="alert">
          <p>No pudimos cargar el temario de {career}.</p>
          <button type="button" className="user-button" onClick={loadData}>Reintentar</button>
        </div>
      ) : null}

      <div id="temario-panel-weeks" role="tabpanel" aria-labelledby="temario-tab-weeks" hidden={area !== "weeks"} tabIndex={0}>
        {area === "weeks" && readyCareer === career && (
          <TemarioWeeksWorkspace key={career} career={career} topics={topics} onTopicsChange={loadData} notify={notify} />
        )}
      </div>
      <div id="temario-panel-scores" role="tabpanel" aria-labelledby="temario-tab-scores" hidden={area !== "scores"} tabIndex={0}>
        {area === "scores" && readyCareer === career && (
          <TemarioScoresWorkspace key={career} carrera={career} topics={topics} notify={notify} />
        )}
      </div>
      <div id="temario-panel-topics" role="tabpanel" aria-labelledby="temario-tab-topics" hidden={area !== "topics"} tabIndex={0}>
        {area === "topics" && ordering && (
          <TemarioOrder
            items={[...topics].sort((a, b) => Number(a.numero_tema) - Number(b.numero_tema))}
            noun="temas" itemKey={topic => topic.id} itemLabel={topic => topic.titulo || topic.nombre || "Tema sin título"}
            onCancel={() => setOrdering(false)}
            onSave={async ordered => {
              await api.temario.reorder({ carrera: career, items: ordered.map((topic, index) => ({
                id: topic.id, numero_tema: index + 1, semana: topic.semana
              })) });
              setOrdering(false);
              loadData();
              notify("Orden de temas guardado", "success");
            }}
          />
        )}
        {area === "topics" && !ordering && !loading && !loadError && (
          <section className="user-directory__results" aria-labelledby="temario-list-title" aria-busy={loading}>
            <div className="temario-topic-bar">
              <div className="user-directory__toolbar">
                <div>
                  <h3 id="temario-list-title">Temas de {career}</h3>
                  <p>{topics.length} {topics.length === 1 ? "tema registrado" : "temas registrados"} · Asigna los temas desde Semanas.</p>
                </div>
                <div className="user-directory__tools">
                  <label className="user-directory__search">
                    <Search size={18} aria-hidden="true" />
                    <input type="search" aria-label="Buscar por título, tema o semana" placeholder="Buscar" value={search}
                      onChange={event => setSearch(event.target.value)} />
                  </label>
                  <button type="button" className="user-button user-button--icon" disabled={loading} onClick={loadData}
                    aria-label="Actualizar temas" title="Actualizar temas"><RefreshCw size={18} aria-hidden="true" /></button>
                  <button type="button" className="user-button user-button--icon"
                    aria-label={view === "grid" ? "Ver como lista" : "Ver como fichas"} title={view === "grid" ? "Ver como lista" : "Ver como fichas"}
                    onClick={() => {
                      const next = view === "grid" ? "table" : "grid";
                      setView(next);
                      setNavState({ temarioViewMode: next });
                    }}>
                    {view === "grid" ? <List size={20} aria-hidden="true" /> : <LayoutGrid size={19} aria-hidden="true" />}
                  </button>
                </div>
              </div>

              <div className="temario-inline-actions temario-topic-bar__actions">
                <button type="button" className="user-button user-button--primary" onClick={() => setModal({ mode: "create" })}>
                  <Plus size={18} aria-hidden="true" /> Crear tema
                </button>
                {topics.length > 0 && <button type="button" className="user-button" onClick={() => setOrdering(true)}>
                  <ArrowUpDown size={17} aria-hidden="true" /> Ordenar temas
                </button>}
                <button type="button" className="user-button" onClick={openCopy}>
                  <Copy size={18} aria-hidden="true" /> Copiar temario
                </button>
              </div>
            </div>

            {filtered.length === 0 ? (
              <div className="user-directory__state" role="status">
                <p>{query ? "No hay temas que coincidan con la búsqueda." : `Aún no hay temas registrados para ${career}.`}</p>
                {query && <button type="button" className="user-button" onClick={() => setSearch("")}>Limpiar búsqueda</button>}
              </div>
            ) : (
              <>
                {query && <p className="user-directory__count" role="status">{filtered.length} de {topics.length} temas</p>}
                {view === "grid" ? [...weeks].map(([week, items]) => (
                  <section key={week ?? "unassigned"} className="temario-week">
                    <header>
                      <h4>{week ? `Semana ${week}` : "Sin semana asignada"}</h4>
                      <span>{items.length} {items.length === 1 ? "tema" : "temas"}</span>
                    </header>
                    <ul className="user-directory__list">{items.map(renderTopic)}</ul>
                  </section>
                )) : (
                  <ul className="user-directory__list user-directory__list--compact">{filtered.map(renderTopic)}</ul>
                )}
              </>
            )}
          </section>
        )}
      </div>

      {copyOpen ? (
        <TemarioDialog title={`Copiar a ${career}`} career={career} Icon={Copy} busy={copying} onClose={() => setModal(null)}
          footer={<>
            {copyError && <p className="user-dialog__error" role="alert">{copyError}</p>}
            <div className="user-dialog__buttons">
              <button type="button" className="user-button" disabled={copying} onClick={() => setModal(null)}>Cancelar</button>
              <button type="submit" form="temario-copy-form" className="user-button user-button--destructive" disabled={!sourceCareer || copying}>
                {copying ? "Copiando…" : "Reemplazar temario"}
              </button>
            </div>
          </>}>
          <form className="user-dialog__body" id="temario-copy-form" onSubmit={handleCopy}>
            <div className="user-dialog__warning">
              <AlertTriangle size={21} aria-hidden="true" />
              <p>Esta operación reemplaza los temas de {career} con los de la carrera de origen.</p>
            </div>
            <label className="user-field">Carrera de origen
              <select aria-label="Carrera de origen" required value={sourceCareer} disabled={copying} onChange={event => setSourceCareer(event.target.value)}>
                <option value="">Selecciona el origen</option>
                {CAREERS.filter(value => value !== career).map(value => <option key={value}>{value}</option>)}
              </select>
            </label>
          </form>
        </TemarioDialog>
      ) : modal && (
        <TemarioManagementModal mode={modal.mode} temas={topics} selectedTema={modal.topic} carrera={career}
          onClose={() => setModal(null)} onSuccess={loadData} notify={notify} />
      )}
    </section>
  );
}
