import React, { useCallback, useEffect, useRef, useState } from "react";
import { CalendarDays, ChevronDown, ChevronLeft, ChevronRight, Clock, Edit3, Plus, Save, Trash2 } from "lucide-react";
import { api } from "../services/api";
import { getAcademicDate } from "../../../shared/academicWeek.mjs";
import { addScheduleDays, getPracticeDate, parseScheduleDate, scheduleTimeLabel, scheduleTimeMinutes, scheduleWeekday } from "../../../shared/academicSchedule.mjs";
import { displaySectionCode, normalizeSectionCareer } from "../../../shared/sectionCode.mjs";
import TemarioDialog from "./TemarioDialog";
import WeeklyExamCalendar from "./WeeklyExamCalendar";

const monthFormatter = new Intl.DateTimeFormat("es-HN", { month: "long", year: "numeric", timeZone: "UTC" });
const dayFormatter = new Intl.DateTimeFormat("es-HN", {
  weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC"
});
const shortDayFormatter = new Intl.DateTimeFormat("es-HN", {
  weekday: "short", day: "numeric", month: "short", timeZone: "UTC"
});
const weekdays = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
const dateLabel = value => dayFormatter.format(parseScheduleDate(value));
const shortWeekRange = (start, end) => {
  const startYear = start.slice(0, 4);
  const endYear = end.slice(0, 4);
  const startLabel = shortDayFormatter.format(parseScheduleDate(start));
  const endLabel = shortDayFormatter.format(parseScheduleDate(end));
  return `${startLabel}${startYear === endYear ? "" : ` ${startYear}`} – ${endLabel} ${endYear}`;
};
const timeLabel = value => scheduleTimeLabel(scheduleTimeMinutes(value));

function shiftMonth(month, offset) {
  const date = parseScheduleDate(`${month}-01`);
  date.setUTCMonth(date.getUTCMonth() + offset);
  return date.toISOString().slice(0, 7);
}

export default function AcademicEventsView({ career, kind, weeks, notify }) {
  const practice = kind === "reposicion";
  const today = getAcademicDate();
  const [month, setMonth] = useState(() => today.slice(0, 7));
  const [examWeekNumber, setExamWeekNumber] = useState("");
  const [events, setEvents] = useState([]);
  const [examChanges, setExamChanges] = useState({});
  const [examSaveError, setExamSaveError] = useState("");
  const [sections, setSections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [draft, setDraft] = useState(null);
  const [replacementMonth, setReplacementMonth] = useState("");
  const [removing, setRemoving] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [availability, setAvailability] = useState(null);
  const requestId = useRef(0);
  const nextDraftId = useRef(0);
  const slotsRef = useRef(null);
  const datePickerRef = useRef(null);
  const examWeeks = practice ? [] : weeks.filter(week => week.es_examen &&
    parseScheduleDate(week.fecha_inicio) && parseScheduleDate(week.fecha_fin) && week.fecha_inicio <= week.fecha_fin);
  const examWeek = examWeeks.find(week => String(week.numero_semana) === examWeekNumber);
  const monthStart = `${month}-01`;
  const monthEnd = addScheduleDays(`${shiftMonth(month, 1)}-01`, -1);
  const firstDay = !practice ? examWeek?.fecha_inicio : monthStart;
  const lastDay = !practice ? examWeek?.fecha_fin : monthEnd;

  const rangeStart = practice ? monthStart : undefined;
  const rangeEnd = practice ? monthEnd : undefined;

  const loadAgenda = useCallback(async () => {
    const request = ++requestId.current;
    setLoading(true);
    setLoadError("");
    try {
      const result = await api.semanas.getAgenda(career, rangeStart, rangeEnd, kind);
      if (request === requestId.current) {
        setEvents(result.data || []);
        setSections(result.sections || []);
      }
    } catch (err) {
      if (request === requestId.current) setLoadError(err.message || "No pudimos cargar la agenda.");
    } finally {
      if (request === requestId.current) setLoading(false);
    }
  }, [career, rangeStart, rangeEnd, kind]);

  useEffect(() => {
    loadAgenda();
    return () => { requestId.current++; };
  }, [loadAgenda]);

  const draftDate = draft?.fecha;
  const originalDate = draft?.fecha_original;
  const sectionId = draft?.seccion_id;
  const eventId = draft?.id;
  const confirmPlacement = !practice && !eventId;
  const currentSection = sections.find(section => section.id === sectionId);
  const practiceDates = practice && currentSection ? weeks.flatMap(week => {
    const date = getPracticeDate(week, normalizeSectionCareer(currentSection.dia));
    const number = week.numero_semana;
    const label = `Semana ${number}`;
    const name = (week.nombre_semana || week.descripcion || "").trim();
    return date ? [{ number, date, label: name && name !== label ? `${label} · ${name}` : label }] : [];
  }) : [];
  const validOriginalDay = Boolean(currentSection && parseScheduleDate(originalDate) &&
    scheduleWeekday(originalDate) === normalizeSectionCareer(currentSection.dia));
  const haveSlotQuery = Boolean(validOriginalDay && draftDate && draftDate !== originalDate);
  useEffect(() => {
    if (!practice || !haveSlotQuery) return;
    let active = true;
    api.semanas.getAgendaAvailability(career, draftDate, sectionId, eventId).then(result => {
      if (active) setAvailability({ slots: result.data || [], message: result.message });
    }).catch(err => {
      if (active) setAvailability({ slots: [], message: err.message || "No pudimos consultar horarios libres." });
    });
    return () => { active = false; };
  }, [career, practice, haveSlotQuery, draftDate, sectionId, eventId]);

  const moveMonth = next => {
    requestId.current++;
    setMonth(next);
    setLoading(true);
    setLoadError("");
  };

  const openEditor = (event, placement) => {
    setError("");
    setAvailability(null);
    setReplacementMonth(event?.fecha.slice(0, 7) || "");
    setDraft(event ? {
      ...event, seccion_id: event.seccion_id || "", fecha_original: event.fecha_original || "",
      hora_inicio: timeLabel(event.hora_inicio), hora_fin: timeLabel(event.hora_fin)
    } : {
      titulo: "", seccion_id: "", fecha_original: "",
      fecha: practice ? "" : firstDay,
      hora_inicio: "", hora_fin: "",
      ...placement
    });
  };

  const updateDraft = (field, value) => {
    const refreshSlots = practice && ["fecha", "fecha_original", "seccion_id"].includes(field);
    const resetDate = practice && ["fecha_original", "seccion_id"].includes(field);
    if (resetDate) setReplacementMonth("");
    if (refreshSlots) setAvailability(null);
    setDraft(previous => ({
      ...previous, [field]: value,
      ...(practice && field === "seccion_id" ? { fecha_original: "" } : {}),
      ...(resetDate ? { fecha: "" } : {}),
      ...(refreshSlots ? { hora_inicio: "", hora_fin: "" } : {})
    }));
    setError("");
  };

  const saveEvent = async event => {
    event.preventDefault();
    if (saving) return;
    if (!practice) {
      if (scheduleTimeMinutes(draft.hora_fin) <= scheduleTimeMinutes(draft.hora_inicio)) {
        setError("La hora de fin debe ser posterior a la hora de inicio.");
        return;
      }
      const id = eventId || `draft-${++nextDraftId.current}`;
      setExamChanges(previous => ({ ...previous, [id]: { ...draft, id, carrera: career, tipo: kind } }));
      setExamSaveError("");
      setDraft(null);
      return;
    }
    setSaving(true);
    setError("");
    try {
      await api.semanas.saveAgendaEvent({ ...draft, carrera: career, tipo: kind }, eventId);
      const destinationMonth = draft.fecha.slice(0, 7);
      setDraft(null);
      notify("Reposición guardada", "success");
      if (destinationMonth !== month) moveMonth(destinationMonth);
      else await loadAgenda();
    } catch (err) {
      setError(err.message || "No pudimos guardar la actividad.");
    } finally {
      setSaving(false);
    }
  };

  const deleteEvent = async () => {
    if (saving) return;
    if (!practice) {
      const id = removing.id;
      setExamChanges(previous => {
        const next = { ...previous };
        if (id.startsWith("draft-")) delete next[id];
        else next[id] = null;
        return next;
      });
      setExamSaveError("");
      setRemoving(null);
      return;
    }
    setSaving(true);
    setError("");
    try {
      await api.semanas.deleteAgendaEvent(removing.id);
      setRemoving(null);
      await loadAgenda();
      notify("Actividad retirada de la agenda", "success");
    } catch (err) {
      setError(err.message || "No pudimos retirar la actividad.");
    } finally {
      setSaving(false);
    }
  };

  const pendingExams = Object.entries(examChanges);
  const saveExamChanges = async () => {
    if (saving || !pendingExams.length) return;
    setSaving(true);
    setExamSaveError("");
    try {
      const changes = pendingExams.map(([id, exam]) => ({
        id: id.startsWith("draft-") ? undefined : id,
        exam
      }));
      const result = await api.semanas.saveExamBatch(career, changes);
      const changedIds = new Set(pendingExams.map(([id]) => id));
      setEvents(previous => [...previous.filter(event => !changedIds.has(event.id)), ...result.data]);
      setExamChanges({});
      notify("Cambios de exámenes guardados", "success");
    } catch (err) {
      setExamSaveError(err.message || "No pudimos guardar los cambios pendientes.");
    } finally {
      setSaving(false);
    }
  };

  const agendaEvents = [
    ...events.filter(event => event.tipo === kind && !Object.hasOwn(examChanges, event.id)),
    ...pendingExams.map(([, exam]) => exam).filter(Boolean)
  ].sort((a, b) => a.fecha.localeCompare(b.fecha) || a.hora_inicio.localeCompare(b.hora_inicio));
  const isInWeek = (exam, week) => exam.fecha >= week.fecha_inicio && exam.fecha <= week.fecha_fin;
  const weeklyExams = examWeek ? agendaEvents.filter(exam => isInWeek(exam, examWeek)) : [];
  const unplacedExams = practice ? [] : agendaEvents.filter(exam => !examWeeks.some(week => isInWeek(exam, week)));
  const availableMonths = new Set();
  const datedWeeks = practice && draft ? weeks.filter(week => parseScheduleDate(week.fecha_inicio) && parseScheduleDate(week.fecha_fin)) : [];
  for (const week of datedWeeks) {
    for (let value = week.fecha_inicio.slice(0, 7); value <= week.fecha_fin.slice(0, 7); value = shiftMonth(value, 1)) {
      availableMonths.add(value);
    }
  }
  const replacementDays = [];
  if (replacementMonth) {
    const end = `${shiftMonth(replacementMonth, 1)}-01`;
    for (let day = `${replacementMonth}-01`; day < end; day = addScheduleDays(day, 1)) {
      const enabled = day !== originalDate && datedWeeks.some(week => week.fecha_inicio <= day && day <= week.fecha_fin);
      replacementDays.push({ day, enabled });
    }
  }
  const replacementOffset = replacementMonth ? (parseScheduleDate(`${replacementMonth}-01`).getUTCDay() + 6) % 7 : 0;
  const canSave = draft?.titulo.trim() && draftDate && draft.hora_inicio && draft.hora_fin &&
    (!practice || (haveSlotQuery && draftDate !== originalDate));

  return (
    <section className="temario-workspace academic-events">
      <header className="temario-workspace__header">
        <div>
          <h3>{practice ? `Reposiciones de ${career}` : `Calendario de exámenes de ${career}`}</h3>
          <p>{practice ? "Registra la fecha que se perdió y elige un horario libre de la misma carrera."
            : "Programa un examen para una sección o para toda la carrera."}</p>
        </div>
        {practice ? (
          <button type="button" className="user-button user-button--primary"
            disabled={loading || Boolean(loadError) || !sections.length} onClick={() => openEditor()}>
            <Plus size={18} aria-hidden="true" /> Programar reposición
          </button>
        ) : (
          <div className="weekly-exams__controls">
            <label className="user-field weekly-exams__week-picker">Semana de examen
              <select aria-label="Semana de examen" disabled={!examWeeks.length || saving || pendingExams.length > 0} value={examWeekNumber}
                onChange={event => setExamWeekNumber(event.target.value)}>
                <option value="" disabled>{examWeeks.length ? "Selecciona una semana" : "Sin semanas con fechas"}</option>
                {examWeeks.map(week => <option key={week.numero_semana} value={week.numero_semana}>
                  Semana {week.numero_semana} · {week.nombre_semana || week.parcial || "Examen"}
                </option>)}
              </select>
            </label>
            <button type="button" className="user-button user-button--primary"
              disabled={saving || !pendingExams.length} onClick={saveExamChanges}>
              <Save size={17} aria-hidden="true" /> {saving ? "Guardando…" : "Guardar cambios"}
            </button>
            {examWeek && <small>{shortWeekRange(firstDay, lastDay)}</small>}
          </div>
        )}
      </header>
      {!practice && pendingExams.length > 0 && (
        <div className="temario-inline-actions" role="status">
          <p>{pendingExams.length} {pendingExams.length === 1 ? "cambio pendiente" : "cambios pendientes"}</p>
          <button type="button" className="user-button" disabled={saving} onClick={() => {
            setExamChanges({});
            setExamSaveError("");
          }}>Descartar pendientes</button>
        </div>
      )}
      {examSaveError && <p className="user-dialog__error" role="alert">{examSaveError}</p>}
      {practice && <div className="academic-events__month">
        <button type="button" className="user-button user-button--icon" aria-label="Mes anterior" onClick={() => moveMonth(shiftMonth(month, -1))}>
          <ChevronLeft size={20} aria-hidden="true" />
        </button>
        <h4 aria-live="polite">{monthFormatter.format(parseScheduleDate(monthStart))}</h4>
        <button type="button" className="user-button user-button--icon" aria-label="Mes siguiente" onClick={() => moveMonth(shiftMonth(month, 1))}>
          <ChevronRight size={20} aria-hidden="true" />
        </button>
      </div>}

      {!practice && !loading && !loadError && unplacedExams.length > 0 && (
        <section aria-labelledby="unplaced-exams-title">
          <h4 id="unplaced-exams-title">Exámenes fuera de las semanas de examen</h4>
          <p>{examWeek ? "Conservan su fecha guardada. Puedes moverlos a la semana seleccionada."
            : "Selecciona una semana de examen para reprogramarlos."}</p>
          <ul className="user-directory__list">
            {unplacedExams.map(exam => (
              <li key={exam.id} className="user-card academic-events__card">
                <div>
                  <h4>{exam.titulo}</h4>
                  <p>{dateLabel(exam.fecha)} · {timeLabel(exam.hora_inicio)} – {timeLabel(exam.hora_fin)}</p>
                </div>
                <div className="user-card__actions">
                  <button type="button" className="user-button" disabled={!examWeek || saving}
                    onClick={() => openEditor({ ...exam, fecha: firstDay })}>
                    <Edit3 size={16} aria-hidden="true" /> Reprogramar
                  </button>
                  <button type="button" className="user-button user-button--danger" disabled={saving}
                    onClick={() => { setError(""); setRemoving(exam); }}>
                    <Trash2 size={16} aria-hidden="true" /> Retirar
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
      {!practice && !examWeek && !loading && !loadError ? <p className="user-directory__state">{examWeeks.length
        ? "Selecciona la semana de examen que quieres editar."
        : "Guarda las fechas de una semana de examen para usar la cuadrícula semanal."}</p>
        : loading || (!practice && saving) ? <p className="user-directory__state" role="status">{saving ? "Guardando agenda…" : "Cargando agenda…"}</p> : loadError ? (
        <div className="user-directory__state" role="alert">
          <p>{loadError}</p><button type="button" className="user-button" onClick={loadAgenda}>Reintentar</button>
        </div>
      ) : !practice ? (
        <WeeklyExamCalendar key={examWeek.numero_semana} week={examWeek} sections={sections} exams={weeklyExams} changes={examChanges}
          onSchedule={(id, fecha, hora_inicio, hora_fin) => openEditor(null, {
            seccion_id: id, fecha, hora_inicio, hora_fin,
            titulo: examWeek.nombre_semana || `Examen ${examWeek.parcial || ""}`.trim()
          })}
          onRemove={exam => { setError(""); setRemoving(exam); }} />
      ) : (
        <>
          {agendaEvents.length ? (
            <ul className="user-directory__list">
              {agendaEvents.map(event => {
                const section = sections.find(item => item.id === event.seccion_id);
                return (
                  <li key={event.id} className="user-card academic-events__card">
                    <div>
                      <p className="user-directory__eyebrow"><CalendarDays size={16} aria-hidden="true" /> {dateLabel(event.fecha)}</p>
                      <h4>{event.titulo}</h4>
                    </div>
                    <div className="user-card__badges">
                      <span className="user-badge">{section ? `Sección ${displaySectionCode(section.codigo)}` : event.seccion_id ? "Sección vinculada" : "Toda la carrera"}</span>
                      <span className="user-badge"><Clock size={13} aria-hidden="true" /> {timeLabel(event.hora_inicio)} – {timeLabel(event.hora_fin)}</span>
                    </div>
                    {event.fecha_original && <p className="user-card__hint">Práctica original del {dateLabel(event.fecha_original)}</p>}
                    <div className="user-card__actions">
                      <button type="button" className="user-button" onClick={() => openEditor(event)} aria-label={`Editar ${event.titulo}`}><Edit3 size={16} aria-hidden="true" /> Editar</button>
                      <button type="button" className="user-button user-button--danger" aria-label={`Retirar ${event.titulo}`} onClick={() => {
                        setError("");
                        setRemoving(event);
                      }}><Trash2 size={16} aria-hidden="true" /> Retirar</button>
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : <p className="user-directory__state">
            {practice && !sections.length ? "Crea una sección activa de esta carrera para programar reposiciones."
              : "No hay reposiciones en este mes."}
          </p>}
        </>
      )}

      {draft && (
        <TemarioDialog title={practice ? "Reposición de práctica" : "Programar examen"} career={career}
          Icon={CalendarDays} busy={saving} onClose={() => setDraft(null)}
          footer={<>
            {error && <p className="user-dialog__error" role="alert">{error}</p>}
            {practice && draftDate && draft.hora_inicio && (
              <p className="academic-events__selected" role="status">
                {dateLabel(draftDate)} · {draft.hora_inicio} – {draft.hora_fin}
              </p>
            )}
            <div className="user-dialog__buttons">
              <button type="button" className="user-button" disabled={saving} onClick={() => setDraft(null)}>Cancelar</button>
              <button type="submit" form="academic-event-form" className="user-button user-button--primary" disabled={saving || !canSave}>
                {saving ? "Guardando…" : practice ? "Guardar actividad" : confirmPlacement ? "Confirmar" : "Aplicar en la agenda"}
              </button>
            </div>
          </>}>
          <form id="academic-event-form" className="user-dialog__body" onSubmit={saveEvent}>
            {confirmPlacement ? (
              <div>
                <h4>Sección {displaySectionCode(currentSection?.codigo)}</h4>
                <p>{draft.titulo}</p>
                <p>{dateLabel(draftDate)} · {draft.hora_inicio} – {draft.hora_fin}</p>
              </div>
            ) : <>
            <label className="user-field">{practice ? "Motivo de la reposición" : "Nombre del examen"}
              <input maxLength={160} required value={draft.titulo} onChange={event => updateDraft("titulo", event.target.value)}
                placeholder={practice ? "Ej. Feriado o examen de otra materia" : "Ej. Examen del II Parcial"} />
            </label>
            <label className="user-field">Sección
              <select aria-label="Sección" required={practice} value={draft.seccion_id} onChange={event => updateDraft("seccion_id", event.target.value)}>
                <option value="">{practice ? "Selecciona una sección" : "Toda la carrera"}</option>
                {sections.map(section => <option key={section.id} value={section.id}>
                  {displaySectionCode(section.codigo)} · {section.dia} {section.hora_inicio}
                </option>)}
              </select>
              {practice && currentSection && <small>Horario habitual: {currentSection.dia}, {currentSection.hora_inicio} – {currentSection.hora_fin || "según la duración habitual"}.</small>}
            </label>
            {practice && <label className="user-field">Semana a reponer
              <select aria-label="Semana a reponer" required disabled={!currentSection}
                value={originalDate} onChange={event => updateDraft("fecha_original", event.target.value)}>
                <option value="">Selecciona una semana</option>
                {originalDate && !practiceDates.some(item => item.date === originalDate) && (
                  <option value={originalDate}>Fecha guardada · {dateLabel(originalDate)}</option>
                )}
                {practiceDates.map(({ number, date, label }) => (
                  <option key={number} value={date}>{label}</option>
                ))}
              </select>
              {currentSection && !practiceDates.length && <small>Guarda las fechas de las semanas de clase para calcular cuándo correspondía la práctica.</small>}
              {originalDate && <small>Práctica original: {dateLabel(originalDate)}.</small>}
            </label>}
            {practice ? (
              <fieldset className="temario-week-topics academic-events__date-picker">
                <legend>Fecha de reposición</legend>
                {!validOriginalDay ? <p>Elige primero la sección y la semana a reponer.</p> : (
                  <details ref={datePickerRef} className="academic-events__date-details">
                    <summary className="user-button academic-events__month-toggle">
                      <CalendarDays size={17} aria-hidden="true" />
                      <span>{draftDate ? dateLabel(draftDate) : "Elegir mes y día"}</span>
                      <ChevronDown size={17} aria-hidden="true" />
                    </summary>
                    <div className="academic-events__months">
                      {[...availableMonths].sort().map(value => {
                        const open = value === replacementMonth;
                        const label = monthFormatter.format(parseScheduleDate(`${value}-01`));
                        return (
                          <div key={value} className="academic-events__month-panel">
                            <button type="button" className="user-button academic-events__month-toggle"
                              aria-expanded={open} aria-controls={`replacement-calendar-${value}`} onClick={() => {
                                setReplacementMonth(open ? "" : value);
                                if (!open && !draftDate?.startsWith(value)) updateDraft("fecha", "");
                              }}>
                              <CalendarDays size={17} aria-hidden="true" />
                              <span>{label}</span>
                              <ChevronDown size={17} aria-hidden="true" />
                            </button>
                            <div id={`replacement-calendar-${value}`} hidden={!open}>
                              {open && (
                                <div className="academic-events__calendar" role="group" aria-label={`Días de ${label}`}>
                                  {weekdays.map(day => <span key={day} className="academic-events__weekday" aria-hidden="true">{day}</span>)}
                                  {Array.from({ length: replacementOffset }, (_, index) => <span key={index} aria-hidden="true" />)}
                                  {replacementDays.map(({ day, enabled }) => (
                                    <button type="button" key={day} disabled={!enabled}
                                      aria-label={dateLabel(day)} aria-pressed={day === draftDate}
                                      aria-current={day === today ? "date" : undefined}
                                      onClick={() => {
                                        if (day !== draftDate) updateDraft("fecha", day);
                                        setReplacementMonth("");
                                        datePickerRef.current.open = false;
                                        requestAnimationFrame(() => slotsRef.current?.focus());
                                      }}>{Number(day.slice(-2))}</button>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </details>
                )}
              </fieldset>
            ) : (
              <label className="user-field">Fecha del examen
                <input type="date" required min={firstDay} max={lastDay}
                  value={draft.fecha} onChange={event => updateDraft("fecha", event.target.value)} />
              </label>
            )}

            {practice ? (
              <fieldset ref={slotsRef} tabIndex={-1} className="temario-week-topics academic-events__slots">
                <legend>Horarios libres</legend>
                {!haveSlotQuery ? <p>Elige el mes y el día para consultar los horarios.</p>
                  : !availability ? <p role="status">Consultando disponibilidad…</p>
                  : availability.slots.length ? (
                      <div className="temario-inline-actions">
                        {availability.slots.map(slot => (
                          <button type="button" key={slot.hora_inicio} className="user-button"
                            aria-pressed={draft.hora_inicio === slot.hora_inicio} onClick={() => {
                              setDraft(previous => ({ ...previous, ...slot }));
                              setError("");
                            }}>{slot.hora_inicio} – {slot.hora_fin}</button>
                        ))}
                      </div>
                  ) : <p>{availability.message || "No hay un espacio libre con la duración de esta práctica. Prueba otro día."}</p>}
              </fieldset>
            ) : (
              <div className="temario-form-grid">
                <label className="user-field">Hora de inicio
                  <input type="time" required value={draft.hora_inicio} onChange={event => updateDraft("hora_inicio", event.target.value)} />
                </label>
                <label className="user-field">Hora de fin
                  <input type="time" required value={draft.hora_fin} onChange={event => updateDraft("hora_fin", event.target.value)} />
                </label>
              </div>
            )}
            </>}
          </form>
        </TemarioDialog>
      )}

      {removing && (
        <TemarioDialog title={practice ? "Retirar reposición" : "Retirar examen"} career={career} Icon={Trash2} busy={saving}
          onClose={() => setRemoving(null)} footer={<>
            {error && <p className="user-dialog__error" role="alert">{error}</p>}
            <div className="user-dialog__buttons">
              <button type="button" className="user-button" disabled={saving} onClick={() => setRemoving(null)}>Cancelar</button>
              <button type="button" className="user-button user-button--destructive" disabled={saving} onClick={deleteEvent}>
                {saving ? "Retirando…" : practice ? "Retirar actividad" : "Retirar examen"}
              </button>
            </div>
          </>}>
          <div className="user-dialog__body"><p>Se retirará <strong>{removing.titulo}</strong> del {dateLabel(removing.fecha)}.</p></div>
        </TemarioDialog>
      )}
    </section>
  );
}
