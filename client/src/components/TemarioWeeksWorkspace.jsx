import React, { useCallback, useEffect, useState } from "react";
import { AlertTriangle, ArrowUpDown, Edit3, Plus, Trash2 } from "lucide-react";
import { api } from "../services/api";
import TemarioDialog from "./TemarioDialog";
import TemarioOrder from "./TemarioOrder";

const PARTIALS = ["I Parcial", "II Parcial", "III Parcial"];
const numberOf = week => Number(week.numero_semana);
const weekTitle = week => week.nombre_semana || week.descripcion || `Semana ${week.numero_semana}`;
const topicTitle = topic => topic.titulo || topic.nombre || "Tema sin título";

export default function TemarioWeeksWorkspace({ career, topics, onTopicsChange, notify }) {
  const [weeks, setWeeks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [draft, setDraft] = useState(null);
  const [orderOpen, setOrderOpen] = useState(false);
  const [toDelete, setToDelete] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");

  const loadWeeks = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    try {
      const result = await api.semanas.getConfig(career);
      setWeeks([...(result?.data || [])].sort((a, b) => numberOf(a) - numberOf(b)));
    } catch (err) {
      setLoadError(err.message || "No pudimos cargar las semanas.");
    } finally {
      setLoading(false);
    }
  }, [career]);

  useEffect(() => { loadWeeks(); }, [loadWeeks]);

  const editWeek = (week = null) => {
    const number = week ? numberOf(week) : Math.max(0, ...weeks.map(numberOf)) + 1;
    setDraft({
      existing: Boolean(week),
      numero_semana: number,
      nombre_semana: week ? weekTitle(week) : "",
      parcial: week?.parcial || PARTIALS[number > 10 ? 2 : number > 5 ? 1 : 0],
      es_examen: Boolean(week?.es_examen),
      tema_ids: week?.es_examen ? [] : topics.filter(topic => Number(topic.semana) === number).map(topic => topic.id)
    });
    setError("");
    setSearch("");
  };

  const update = (name, value) => {
    setDraft(previous => ({ ...previous, [name]: value }));
    setError("");
  };

  const refresh = () => Promise.all([loadWeeks(), onTopicsChange()]);

  const saveWeek = async event => {
    event.preventDefault();
    if (busy) return;
    setError("");
    const number = Number(draft.numero_semana);
    if (!Number.isInteger(number) || number < 1) {
      setError("Ingresa un número de semana válido.");
      return;
    }
    if (!draft.existing && weeks.some(week => numberOf(week) === number)) {
      setError(`La semana ${number} ya existe. Abre esa semana para editarla.`);
      return;
    }
    setBusy(true);
    try {
      await api.semanas.saveWeek({
        carrera: career,
        numero_semana: number,
        nombre_semana: draft.nombre_semana.trim() || (draft.es_examen ? `Examen ${draft.parcial}` : `Semana ${number}`),
        parcial: draft.parcial,
        es_examen: draft.es_examen,
        tema_ids: draft.es_examen ? [] : draft.tema_ids
      });
      await refresh();
      setDraft(null);
      notify(`Semana ${number} guardada`, "success");
    } catch (err) {
      setError(err.message || "No pudimos guardar la semana.");
    } finally {
      setBusy(false);
    }
  };

  const deleteWeek = async () => {
    setBusy(true);
    setError("");
    try {
      await api.semanas.deleteWeek(numberOf(toDelete), career);
      await refresh();
      setToDelete(null);
      notify("Semana eliminada", "success");
    } catch (err) {
      setError(err.message || "No pudimos eliminar la semana.");
    } finally {
      setBusy(false);
    }
  };

  if (orderOpen) {
    return <TemarioOrder items={weeks} noun="semanas" itemKey={numberOf}
      itemLabel={week => `Semana ${numberOf(week)} · ${weekTitle(week)}`}
      onCancel={() => setOrderOpen(false)}
      onSave={async ordered => {
        await api.semanas.reorder(career, ordered.map(week => ({
          original_numero_semana: numberOf(week),
          nombre_semana: weekTitle(week),
          parcial: week.parcial,
          es_examen: Boolean(week.es_examen),
          fecha_inicio: week.fecha_inicio,
          fecha_fin: week.fecha_fin,
          es_semana_actual: week.es_semana_actual,
          tema_ids: week.temas_ids || topics.filter(topic => Number(topic.semana) === numberOf(week)).map(topic => topic.id)
        })));
        await refresh();
        setOrderOpen(false);
        notify("Orden de semanas guardado", "success");
      }} />;
  }

  if (draft) {
    const term = search.trim().toLowerCase();
    const visibleTopics = topics.filter(topic => `${topic.numero_tema || ""} ${topicTitle(topic)}`.toLowerCase().includes(term));
    const movingCount = topics.filter(topic => draft.tema_ids.includes(topic.id) &&
      Number(topic.semana) > 0 && Number(topic.semana) !== Number(draft.numero_semana)).length;

    return (
      <form className="temario-workspace temario-week-form" onSubmit={saveWeek}>
        <header>
          <h3>{draft.existing ? `Editar semana ${draft.numero_semana}` : "Agregar semana"}</h3>
          <p>Define el parcial y el tipo de semana. Si es una clase, elige los temas que se impartirán.</p>
        </header>
        <div className="temario-form-grid">
          <label className="user-field">Número de semana
            <input type="number" min="1" required readOnly={draft.existing} value={draft.numero_semana}
              onChange={event => update("numero_semana", event.target.value)} />
          </label>
          <label className="user-field">Nombre (opcional)
            <input value={draft.nombre_semana} placeholder="Ej. Tejido epitelial" onChange={event => update("nombre_semana", event.target.value)} />
          </label>
          <label className="user-field">Parcial
            <select aria-label="Parcial" value={draft.parcial} onChange={event => update("parcial", event.target.value)}>
              {[...new Set([...PARTIALS, draft.parcial])].map(value => <option key={value}>{value}</option>)}
            </select>
          </label>
          <label className="user-field">Tipo de semana
            <select aria-label="Tipo de semana" value={draft.es_examen ? "exam" : "class"} onChange={event => update("es_examen", event.target.value === "exam")}>
              <option value="class">Clase</option><option value="exam">Examen</option>
            </select>
          </label>
        </div>

        {draft.es_examen ? (
          <div className="user-dialog__warning">
            <AlertTriangle size={19} aria-hidden="true" />
            <p>Al guardar como examen, los temas que estén en esta semana quedarán sin asignar.</p>
          </div>
        ) : (
          <fieldset className="temario-week-topics">
            <legend>Temas de la semana · {draft.tema_ids.length} seleccionados</legend>
            <p>Si eliges un tema de otra semana, se moverá a esta al guardar.</p>
            {topics.length ? (
              <>
                <label className="user-field">Filtrar temas
                  <input type="search" value={search} onChange={event => setSearch(event.target.value)} />
                </label>
                <div className="temario-inline-actions">
                  <button type="button" className="user-button" onClick={() => update("tema_ids", topics.map(topic => topic.id))}>Seleccionar todos</button>
                  <button type="button" className="user-button" onClick={() => update("tema_ids", [])}>Quitar selección</button>
                </div>
                <ul className="temario-topic-choices">
                  {visibleTopics.map(topic => (
                    <li key={topic.id}>
                      <label className="temario-check">
                        <input type="checkbox" checked={draft.tema_ids.includes(topic.id)}
                          onChange={event => update("tema_ids", event.target.checked
                            ? [...draft.tema_ids, topic.id] : draft.tema_ids.filter(id => id !== topic.id))} />
                        <span><strong>{topic.numero_tema ? `#${topic.numero_tema} · ` : ""}{topicTitle(topic)}</strong>
                          <small>{Number(topic.semana) > 0 ? `Actualmente en semana ${topic.semana}` : "Sin asignar"}</small>
                        </span>
                      </label>
                    </li>
                  ))}
                </ul>
                {term && visibleTopics.length === 0 && <p role="status">No hay temas que coincidan con la búsqueda.</p>}
                {movingCount > 0 && <p className="temario-feedback" role="status">{movingCount} {movingCount === 1 ? "tema cambiará" : "temas cambiarán"} de semana al guardar.</p>}
              </>
            ) : <p>Agrega temas desde la pestaña Temas cuando los necesites.</p>}
          </fieldset>
        )}

        {error && <p className="user-dialog__error" role="alert">{error}</p>}
        <div className="temario-inline-actions">
          <button type="button" className="user-button" disabled={busy} onClick={() => setDraft(null)}>Cancelar</button>
          <button type="submit" className="user-button user-button--primary" disabled={busy}>{busy ? "Guardando…" : "Guardar semana"}</button>
        </div>
      </form>
    );
  }

  return (
    <section className="temario-workspace">
      <header className="temario-workspace__header">
        <div><h3>Plan de semanas de {career}</h3><p>Organiza las clases, los exámenes y los temas asignados.</p></div>
        <div className="temario-inline-actions">
          {weeks.length > 0 && <button type="button" className="user-button" disabled={loading || Boolean(loadError)} onClick={() => setOrderOpen(true)}>
            <ArrowUpDown size={17} aria-hidden="true" /> Ordenar semanas
          </button>}
          <button type="button" className="user-button user-button--primary" disabled={loading || Boolean(loadError)} onClick={() => editWeek()}>
            <Plus size={18} aria-hidden="true" /> Agregar semana
          </button>
        </div>
      </header>
      {loading ? <p role="status">Cargando semanas…</p> : loadError ? (
        <div className="user-directory__state" role="alert"><p>{loadError}</p>
          <button type="button" className="user-button" onClick={loadWeeks}>Reintentar</button>
        </div>
      ) : weeks.length === 0 ? <p className="user-directory__state">Todavía no hay semanas configuradas.</p> : (
        <ul className="user-directory__list">
          {weeks.map(week => {
            const assigned = topics.filter(topic => Number(topic.semana) === numberOf(week));
            return (
              <li key={week.numero_semana} className="user-card temario-week-card">
                <div>
                  <span className="user-badge">Semana {week.numero_semana}</span>
                  <h4>{weekTitle(week)}</h4>
                </div>
                <div className="user-card__badges">
                  <span className="user-badge">{week.parcial || "Sin parcial"}</span>
                  <span className={week.es_examen ? "user-badge user-badge--inactive" : "user-badge user-badge--active"}>
                    {week.es_examen ? "Examen" : `${assigned.length} ${assigned.length === 1 ? "tema" : "temas"}`}
                  </span>
                </div>
                {!week.es_examen && assigned.length > 0 && <ul className="temario-assigned">{assigned.map(topic => <li key={topic.id}>{topicTitle(topic)}</li>)}</ul>}
                <div className="user-card__actions">
                  <button type="button" className="user-button" aria-label={`Editar semana ${week.numero_semana}`} onClick={() => editWeek(week)}>
                    <Edit3 size={16} aria-hidden="true" /> Editar
                  </button>
                  <button type="button" className="user-button user-button--danger" aria-label={`Eliminar semana ${week.numero_semana}`}
                    onClick={() => { setError(""); setToDelete(week); }}>
                    <Trash2 size={16} aria-hidden="true" /> Eliminar
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
      {toDelete && (
        <TemarioDialog title={`Eliminar semana ${toDelete.numero_semana}`} career={career} Icon={Trash2} busy={busy}
          onClose={() => setToDelete(null)}
          footer={<>
            {error && <p className="user-dialog__error" role="alert">{error}</p>}
            <div className="user-dialog__buttons">
              <button type="button" className="user-button" disabled={busy} onClick={() => setToDelete(null)}>Cancelar</button>
              <button type="button" className="user-button user-button--destructive" disabled={busy} onClick={deleteWeek}>
                {busy ? "Eliminando…" : "Eliminar semana"}
              </button>
            </div>
          </>}>
          <div className="user-dialog__body">
            <p><strong>{weekTitle(toDelete)}</strong></p>
            <div className="user-dialog__warning"><AlertTriangle size={19} aria-hidden="true" />
              <p>Se eliminará la semana del plan. Los temas asignados quedarán disponibles para otra semana.</p>
            </div>
          </div>
        </TemarioDialog>
      )}
    </section>
  );
}
