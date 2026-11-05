import { hasAdministrationAccess } from "../../../shared/instructorRoles.mjs";
import { getAcademicDate, getCurrentAcademicWeek } from "../../../shared/academicWeek.mjs";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { AlertTriangle, ArrowLeft, BookOpen, CalendarDays, Check, Clock, Copy, GraduationCap, Save, Wand2, X } from "lucide-react";
import { api } from "../services/api";
import TemarioDialog from "./TemarioDialog";
import AcademicEventsView from "./AcademicEventsView";
import { addScheduleDays, generateScheduleDates, getScheduleBreaks, parseScheduleDate } from "../../../shared/academicSchedule.mjs";

const CAREERS = ["Medicina", "Enfermería", "Odontología", "Microbiología", "Nutrición"];
const AREAS = [
  { id: "schedule", title: "Semanas", hint: "Fechas y recesos", Icon: CalendarDays },
  { id: "reposicion", title: "Reposiciones", hint: "Recuperar prácticas", Icon: Clock },
  { id: "examen", title: "Exámenes", hint: "Calendario por carrera", Icon: GraduationCap }
];
const breakDateFormat = new Intl.DateTimeFormat("es-HN", { day: "numeric", month: "short", timeZone: "UTC" });

export default function WeekDefinitionView({ currentInstructor, onClose, onOpenTemario, notify = () => {} }) {
  const [career, setCareer] = useState(CAREERS[0]);
  const [area, setArea] = useState("schedule");
  const [weeks, setWeeks] = useState([]);
  const [savedWeeks, setSavedWeeks] = useState([]);
  const [today, setToday] = useState(getAcademicDate);
  const [partial, setPartial] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [saveError, setSaveError] = useState("");
  const [dirty, setDirty] = useState(false);
  const [saved, setSaved] = useState(false);
  const [tool, setTool] = useState(null);
  const [startDate, setStartDate] = useState("");
  const [breakDate, setBreakDate] = useState("");
  const [skippedMondays, setSkippedMondays] = useState([]);
  const [sourceCareer, setSourceCareer] = useState("");
  const [copying, setCopying] = useState(false);
  const [toolError, setToolError] = useState("");
  const requestId = useRef(0);
  const isAuthorized = hasAdministrationAccess(currentInstructor?.rol);

  const loadWeeks = useCallback(async () => {
    if (!isAuthorized) return;
    const request = ++requestId.current;
    setLoading(true);
    setLoadError("");
    try {
      const result = await api.semanas.getConfig(career);
      if (request === requestId.current) {
        const schedule = [...(result?.data || [])].sort((a, b) => Number(a.numero_semana) - Number(b.numero_semana));
        setWeeks(schedule);
        setSavedWeeks(schedule);
        setSkippedMondays(getScheduleBreaks(schedule));
      }
    } catch (error) {
      if (request === requestId.current) setLoadError(error.message || "No pudimos cargar la programación.");
    } finally {
      if (request === requestId.current) setLoading(false);
    }
  }, [career, isAuthorized]);

  useEffect(() => {
    loadWeeks();
    return () => { requestId.current++; };
  }, [loadWeeks]);

  useEffect(() => {
    const timer = setInterval(() => setToday(getAcademicDate()), 60_000);
    return () => clearInterval(timer);
  }, []);

  const markChanged = () => {
    setDirty(true);
    setSaved(false);
    setSaveError("");
  };

  const updateWeek = (number, field, value) => {
    setWeeks(previous => previous.map(week => week.numero_semana === number ? { ...week, [field]: value } : week));
    markChanged();
  };

  const addBreak = () => {
    const date = parseScheduleDate(breakDate);
    if (!date || date.getUTCDay() !== 1) {
      setToolError("Selecciona el lunes de la semana de receso.");
      return;
    }
    setSkippedMondays(previous => [...new Set([...previous, breakDate])].sort());
    setBreakDate("");
    setToolError("");
  };

  const handleGenerate = (event) => {
    event.preventDefault();
    const start = parseScheduleDate(startDate);
    if (!start || start.getUTCDay() !== 1) {
      setToolError("La primera semana debe iniciar un lunes.");
      return;
    }
    if (breakDate && parseScheduleDate(breakDate)?.getUTCDay() !== 1) {
      setToolError("Selecciona el lunes de la semana de receso.");
      return;
    }
    const skipped = [...new Set([...skippedMondays, ...(breakDate ? [breakDate] : [])])].sort();
    setSkippedMondays(skipped);
    setWeeks(previous => generateScheduleDates(previous, startDate, skipped));
    markChanged();
    setTool(null);
    notify("Fechas calculadas. Revísalas y guarda la programación.", "success");
  };

  const handleCopy = async (event) => {
    event.preventDefault();
    if (!sourceCareer || sourceCareer === career || copying) return;
    setCopying(true);
    setToolError("");
    try {
      const result = await api.semanas.copy(sourceCareer, career);
      setTool(null);
      setPartial("");
      setSkippedMondays([]);
      setDirty(false);
      setSaved(true);
      setSaveError("");
      notify(result.message || `Programación copiada a ${career}`, "success");
      await loadWeeks();
    } catch (error) {
      setToolError(error.message || "No pudimos copiar la programación.");
    } finally {
      setCopying(false);
    }
  };

  const handleSave = async () => {
    if (!weeks.length || saving) return;
    setSaving(true);
    setSaveError("");
    try {
      await api.semanas.saveConfig(weeks, career);
      setSavedWeeks(weeks);
      setDirty(false);
      setSaved(true);
      notify(`Programación guardada para ${career}`, "success");
    } catch (error) {
      setSaveError(error.message || "No pudimos guardar la programación.");
    } finally {
      setSaving(false);
    }
  };

  const groups = new Map();
  for (const week of weeks) {
    const name = week.parcial?.trim() || "Sin parcial";
    if (!groups.has(name)) groups.set(name, []);
    groups.get(name).push(week);
  }
  const shownGroups = [...groups].filter(([name]) => !partial || partial === name);
  const currentWeek = getCurrentAcademicWeek(weeks, today);
  const datedWeeks = weeks.filter(week => week.fecha_inicio && week.fecha_fin).length;
  const generating = tool === "generate";

  const openTool = mode => {
    setToolError("");
    setSourceCareer("");
    setStartDate(weeks.find(week => parseScheduleDate(week.fecha_inicio)?.getUTCDay() === 1)?.fecha_inicio || "");
    setBreakDate("");
    setTool(mode);
  };

  const back = (
    <button type="button" className="user-button user-button--back" onClick={onClose}>
      <ArrowLeft size={17} aria-hidden="true" /> Panel docente
    </button>
  );

  if (!isAuthorized) {
    return (
      <section className="user-directory">
        {back}
        <p className="user-directory__state">Creador y Coordinador pueden definir la programación.</p>
      </section>
    );
  }

  return (
    <section className="user-directory week-definition" aria-labelledby="week-definition-title">
      {back}
      <header className="user-directory__hero">
        <div>
          <p className="user-directory__eyebrow"><CalendarDays size={17} aria-hidden="true" /> Administración general</p>
          <h2 id="week-definition-title">Definir semanas por carrera</h2>
          <p>Organiza el periodo, las reposiciones y los exámenes de cada carrera.</p>
        </div>
      </header>

      <section className="temario-context" aria-labelledby="week-career-title">
        <div className="temario-context__career">
          <h3 id="week-career-title">Carrera activa</h3>
          <div className="user-field">
            <select aria-label="Elegir carrera" value={career} disabled={saving || copying} onChange={event => {
              requestId.current++;
              setCareer(event.target.value);
              setWeeks([]);
              setSavedWeeks([]);
              setSkippedMondays([]);
              setPartial("");
              setDirty(false);
              setSaved(false);
              setSaveError("");
              setLoading(true);
            }}>
              {CAREERS.map(value => <option key={value}>{value}</option>)}
            </select>
          </div>
        </div>

      </section>

      <div className="temario-nav week-definition__nav" role="group" aria-label="Áreas del calendario académico">
        {AREAS.map(({ id, title, hint, Icon }) => (
          <button type="button" key={id} className="temario-nav__tab" data-area={id} aria-pressed={area === id}
            disabled={saving || copying} onClick={() => setArea(id)}>
            <span className="temario-nav__icon"><Icon size={19} aria-hidden="true" /></span>
            <strong>{title}</strong>
            <span className="temario-nav__hint">{hint}</span>
            {area === id && <Check className="temario-nav__check" size={14} aria-hidden="true" />}
          </button>
        ))}
      </div>

      {area !== "schedule" ? (
        <AcademicEventsView key={`${career}-${area}`} career={career} kind={area} weeks={savedWeeks} notify={notify} />
      ) : (
        <>
          <div className="week-definition__tools">
            <button type="button" className="user-button" disabled={loading || saving || Boolean(loadError) || !weeks.length} onClick={() => openTool("generate")}>
              <Wand2 size={17} aria-hidden="true" /> Generar fechas
            </button>
            <button type="button" className="user-button" disabled={loading || saving} onClick={() => openTool("copy")}>
              <Copy size={17} aria-hidden="true" /> Copiar programación
            </button>
          </div>
      {loading ? (
        <p className="user-directory__state" role="status">Cargando semanas de {career}…</p>
      ) : loadError ? (
        <div className="user-directory__state" role="alert">
          <p>{loadError}</p>
          <button type="button" className="user-button" onClick={loadWeeks}>Reintentar</button>
        </div>
      ) : weeks.length === 0 ? (
        <section className="user-directory__state">
          <CalendarDays size={24} aria-hidden="true" />
          <h3>Aún no hay semanas para {career}</h3>
          <p>Agrega semanas desde el área Semanas de Temario.</p>
          {onOpenTemario && <button type="button" className="user-button" onClick={() => onOpenTemario(career)}>
            <BookOpen size={17} aria-hidden="true" /> Abrir Temario
          </button>}
        </section>
      ) : (
        <>
          <section className="week-definition__overview" aria-label="Resumen de programación">
            <div><strong>{datedWeeks} de {weeks.length}</strong><span>semanas con fechas</span></div>
            <div><strong>{currentWeek ? `Semana ${currentWeek.numero_semana}` : "Sin semana actual"}</strong><span>según las fechas programadas</span></div>
          </section>
          {groups.size > 1 && (
            <div className="week-definition__filters" role="group" aria-label="Filtrar por parcial">
              <button type="button" className="user-button" aria-pressed={!partial} onClick={() => setPartial("")}>Todos los parciales</button>
              {[...groups].map(([name]) => (
                <button type="button" key={name} className="user-button" aria-pressed={partial === name} onClick={() => setPartial(name)}>
                  {name}
                </button>
              ))}
            </div>
          )}

          <div className="week-definition__save" role="group" aria-label="Guardado de la programación">
            <div>
              <strong>{career}</strong>
              <p role="status">{dirty ? "Cambios sin guardar" : saved ? "Programación guardada" : "Programación de semanas"}</p>
              {saveError && <p className="user-dialog__error" role="alert">{saveError}</p>}
            </div>
            <button type="button" className="user-button user-button--primary" disabled={saving} onClick={handleSave}>
              <Save size={18} aria-hidden="true" /> {saving ? "Guardando…" : "Guardar programación"}
            </button>
          </div>

          {shownGroups.map(([name, items]) => (
            <section key={name} className="temario-week">
              <header><h3>{name}</h3><span>{items.length} {items.length === 1 ? "semana" : "semanas"}</span></header>
              <ul className="user-directory__list week-definition__cards">
                {items.map(week => (
                  <li key={week.numero_semana} className="user-card week-definition__card" data-current={week === currentWeek}>
                    <header>
                      <div className="user-card__identity">
                        <span className="user-card__avatar" aria-hidden="true">S{week.numero_semana}</span>
                        <h4>Semana {week.numero_semana}</h4>
                      </div>
                      <div className="user-card__badges">
                        <span className="user-badge">{week.es_examen ? "Examen" : "Clase"}</span>
                        {week === currentWeek && (
                          <span className="user-badge user-badge--active week-definition__current">
                            <Check size={14} aria-hidden="true" /> Semana actual
                          </span>
                        )}
                      </div>
                    </header>
                    <p className="week-definition__topics">{week.es_examen ? (week.nombre_semana || "Semana de examen") : week.temas || "Sin temas asignados"}</p>
                    <div className="week-definition__dates">
                      <label className="user-field">Inicio
                        <input type="date" aria-label={`Inicio de semana ${week.numero_semana}`} disabled={saving}
                          value={week.fecha_inicio || ""} onChange={event => updateWeek(week.numero_semana, "fecha_inicio", event.target.value)} />
                      </label>
                      <label className="user-field">Fin
                        <input type="date" aria-label={`Fin de semana ${week.numero_semana}`} disabled={saving}
                          value={week.fecha_fin || ""} onChange={event => updateWeek(week.numero_semana, "fecha_fin", event.target.value)} />
                      </label>
                    </div>
                    {week.descripcion && (
                      <p className="week-definition__description">
                        <strong>Descripción</strong>
                        <span>{week.descripcion}</span>
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </>
      )}
        </>
      )}

      {tool && (
        <TemarioDialog title={generating ? "Generar fechas" : "Copiar programación"} career={career} Icon={generating ? Wand2 : Copy}
          busy={copying} onClose={() => setTool(null)}
          footer={<>
            {toolError && <p className="user-dialog__error" role="alert">{toolError}</p>}
            <div className="user-dialog__buttons">
              <button type="button" className="user-button" disabled={copying} onClick={() => setTool(null)}>Cancelar</button>
              <button type="submit" form="week-definition-tool"
                className={generating ? "user-button user-button--primary" : "user-button user-button--destructive"}
                disabled={copying || (generating ? !startDate : !sourceCareer)}>
                {generating ? "Aplicar fechas" : copying ? "Copiando…" : "Reemplazar programación"}
              </button>
            </div>
          </>}>
          <form id="week-definition-tool" className="user-dialog__body" onSubmit={generating ? handleGenerate : handleCopy}>
            {generating ? (
              <>
                <p>Cada semana comenzará el lunes y terminará el domingo. Podrás revisar las fechas antes de guardar.</p>
                <label className="user-field">Lunes de inicio
                  <input type="date" required value={startDate} onChange={event => {
                    setStartDate(event.target.value);
                    setToolError("");
                  }} />
                </label>
                <fieldset className="temario-week-topics">
                  <legend>¿Qué semanas completas son feriado o receso?</legend>
                  <p>Agrega el lunes de cada semana que quieras omitir. Las semanas de clase conservarán su numeración.</p>
                  <label className="user-field">Lunes del feriado o receso
                    <input type="date" value={breakDate} onChange={event => {
                      setBreakDate(event.target.value);
                      setToolError("");
                    }} />
                  </label>
                  <button type="button" className="user-button" disabled={!breakDate} onClick={addBreak}>Agregar semana de receso</button>
                  {skippedMondays.length > 0 && (
                    <ul className="week-definition__breaks">
                      {skippedMondays.map(monday => (
                        <li key={monday}>
                          <span>{breakDateFormat.format(parseScheduleDate(monday))} – {breakDateFormat.format(parseScheduleDate(addScheduleDays(monday, 6)))}</span>
                          <button type="button" className="user-button user-button--icon" aria-label={`Quitar receso del ${monday}`}
                            onClick={() => setSkippedMondays(previous => previous.filter(day => day !== monday))}>
                            <X size={17} aria-hidden="true" />
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </fieldset>
              </>
            ) : (
              <>
                <div className="user-dialog__warning"><AlertTriangle size={21} aria-hidden="true" />
                  <p>La copia reemplaza la programación guardada de {career}, incluidos los parciales y las fechas.
                    {dirty && " También se perderán los cambios sin guardar de esta pantalla."}</p>
                </div>
                <label className="user-field">Carrera de origen
                  <select aria-label="Carrera de origen" required disabled={copying} value={sourceCareer} onChange={event => setSourceCareer(event.target.value)}>
                    <option value="">Selecciona el origen</option>
                    {CAREERS.filter(value => value !== career).map(value => <option key={value}>{value}</option>)}
                  </select>
                </label>
              </>
            )}
          </form>
        </TemarioDialog>
      )}
    </section>
  );
}
