import { ArrowLeft, ArrowRight, CalendarDays, History, RefreshCw, Search } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { api } from "../services/api";
import "./SectionGradeHistory.css";

const dateFormat = new Intl.DateTimeFormat("es-HN", {
  dateStyle: "medium", timeStyle: "short", timeZone: "America/Tegucigalpa"
});
const gradeFormat = new Intl.NumberFormat("es-HN", { maximumFractionDigits: 3 });
const formatGrade = value => value == null ? "Sin nota" : gradeFormat.format(value);
const emptyFilters = { cuenta: "", instructor: "", evaluacion: "", accion: "", desde: "", hasta: "" };
const textFilters = [
  ["cuenta", "Número de cuenta", "Cuenta exacta"],
  ["instructor", "Instructor", "Nombre o apellido"],
  ["evaluacion", "Evaluación", "Prueba, manual, examen…"]
];

export default function SectionGradeHistory({ sectionId }) {
  const resultsHeading = useRef(null);
  const [draft, setDraft] = useState(emptyFilters);
  const [request, setRequest] = useState({ filters: {}, cursors: [] });
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    const before = request.cursors.at(-1);
    api.estudiantes.getGradeHistory(sectionId, {
      ...request.filters,
      ...(before ? { before } : {})
    }, controller.signal).then(data => {
      if (!controller.signal.aborted) setResult(data);
    }).catch(err => {
      if (!controller.signal.aborted) setError(err.message);
    });
    return () => controller.abort();
  }, [sectionId, request]);

  function load(nextRequest, moveFocus = false) {
    setResult(null);
    setError("");
    setRequest(nextRequest);
    if (moveFocus) resultsHeading.current?.focus();
  }

  const activeFilters = Object.keys(request.filters).length;
  const loading = !result && !error;
  const updateDraft = event => {
    const { name, value } = event.target;
    setDraft(previous => ({ ...previous, [name]: value }));
  };

  return (
    <section className="grade-history" aria-labelledby="section-grade-history-title">
      <header className="grade-history__hero">
        <span className="grade-history__icon"><History size={25} aria-hidden="true" /></span>
        <div>
          <h2 id="section-grade-history-title">Historial de calificaciones</h2>
          <p>Consulta quién cambió una nota, a qué estudiante y cuándo.</p>
        </div>
        <button type="button" className="user-button" disabled={loading}
          onClick={() => load({ ...request, cursors: [] })}>
          <RefreshCw size={16} aria-hidden="true" /> Actualizar
        </button>
      </header>

      <form className="grade-history__filters" aria-label="Filtros del historial" onSubmit={event => {
        event.preventDefault();
        const filters = Object.fromEntries(Object.entries(draft)
          .map(([name, value]) => [name, value.trim()]).filter(([, value]) => value));
        load({ filters, cursors: [] });
      }}>
        <div className="grade-history__fields">
          {textFilters.map(([name, label, placeholder]) => (
            <label key={name}>
              {label}
              <input type="search" name={name} value={draft[name]} onChange={updateDraft}
                placeholder={placeholder} maxLength={64} pattern={name === "cuenta" ? undefined : "[^*]*"}
                title={name === "cuenta" ? undefined : "Escribe el texto sin asteriscos"} />
            </label>
          ))}
          <label>
            Acción
            <select name="accion" value={draft.accion} onChange={updateDraft}>
              <option value="">Todas</option>
              <option value="asigno">Asignó</option>
              <option value="modifico">Modificó</option>
              <option value="elimino">Eliminó</option>
            </select>
          </label>
          <label>
            Desde
            <input type="date" name="desde" value={draft.desde} onChange={updateDraft} max={draft.hasta || undefined} />
          </label>
          <label>
            Hasta
            <input type="date" name="hasta" value={draft.hasta} onChange={updateDraft} min={draft.desde || undefined} />
          </label>
        </div>
        <div className="grade-history__filter-actions">
          <button type="submit" className="user-button user-button--primary"><Search size={16} aria-hidden="true" /> Buscar</button>
          <button type="button" className="user-button"
            disabled={!activeFilters && !Object.values(draft).some(Boolean)}
            onClick={() => { setDraft(emptyFilters); load({ filters: {}, cursors: [] }); }}>
            Limpiar filtros
          </button>
        </div>
      </form>

      <section className="grade-history__results" aria-labelledby="grade-history-results" aria-busy={loading}>
        <div className="grade-history__results-heading">
          <h3 id="grade-history-results" ref={resultsHeading} tabIndex={-1}>Cambios registrados</h3>
          <span>Más recientes primero{activeFilters > 0 && ` · ${activeFilters} ${activeFilters === 1 ? "filtro" : "filtros"}`}</span>
        </div>
        {error ? <div className="grade-history__state" role="alert">
          <p>{error}</p>
          <button type="button" className="user-button" onClick={() => load({ ...request })}>Reintentar</button>
        </div> : loading ? <p className="grade-history__state" role="status">Cargando historial…</p> : (
          <>
            {result.data.length === 0 ? (
              <p className="grade-history__state" role="status">
                {activeFilters ? "No hay cambios que coincidan con los filtros." : "Todavía no hay cambios registrados en esta sección."}
              </p>
            ) : (
              <ol className="grade-history__list">
                {result.data.map(event => {
                  const [action, tone] = event.nueva == null ? ["Eliminó", "removed"] :
                    event.anterior == null ? ["Asignó", "assigned"] : ["Modificó", "edited"];
                  return (
                    <li key={event.id} className="grade-history__entry">
                      <div>
                        <h4>{event.estudiante_nombre}</h4>
                        <span className="grade-history__muted">{event.numero_cuenta} · {event.etiqueta}</span>
                      </div>
                      <div className="grade-history__change">
                        <span className="grade-history__badge" data-action={tone}>{action}</span>
                        <dl>
                          <div><dt>Antes</dt><dd>{formatGrade(event.anterior)}</dd></div>
                          <div><dt>Después</dt><dd>{formatGrade(event.nueva)}</dd></div>
                        </dl>
                      </div>
                      <div className="grade-history__meta">
                        <strong>{event.instructor_nombre}</strong>
                        <time dateTime={event.fecha}><CalendarDays size={14} aria-hidden="true" /> {dateFormat.format(new Date(event.fecha))}</time>
                      </div>
                    </li>
                  );
                })}
              </ol>
            )}
            {(request.cursors.length > 0 || result.next) && (
              <nav className="grade-history__pages" aria-label="Páginas del historial">
                <button type="button" className="user-button" disabled={!request.cursors.length}
                  onClick={() => load({ ...request, cursors: request.cursors.slice(0, -1) }, true)}>
                  <ArrowLeft size={16} aria-hidden="true" /> Anterior
                </button>
                <span>Página {request.cursors.length + 1}</span>
                <button type="button" className="user-button" disabled={!result.next}
                  onClick={() => load({ ...request, cursors: [...request.cursors, result.next] }, true)}>
                  Siguiente <ArrowRight size={16} aria-hidden="true" />
                </button>
              </nav>
            )}
          </>
        )}
      </section>
    </section>
  );
}
