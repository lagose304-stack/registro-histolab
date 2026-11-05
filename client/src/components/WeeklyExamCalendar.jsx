import React, { useState } from "react";
import { CalendarDays, Check, GripVertical, Layers, Plus } from "lucide-react";
import { addScheduleDays, parseScheduleDate, scheduleOverlaps, scheduleTimeLabel, scheduleTimeMinutes, sectionTimeRange } from "../../../shared/academicSchedule.mjs";
import { displaySectionCode, normalizeSectionCareer } from "../../../shared/sectionCode.mjs";

const BLOCKS = [7, 9, 11, 13, 15].map(hour => hour * 60);
const SECTION_DRAG = "application/x-histolab-section";
const dayFormat = new Intl.DateTimeFormat("es-HN", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
const weekdays = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
const dayLabels = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo", "Otros días"];
const sectionSort = new Intl.Collator("es-HN", { numeric: true });
const dayOrder = ["LUNES", "MARTES", "MIERCOLES", "JUEVES", "VIERNES", "SABADO", "DOMINGO"];
const sectionDay = section => {
  const index = dayOrder.indexOf(normalizeSectionCareer(section.dia));
  return index < 0 ? dayOrder.length : index;
};

export default function WeeklyExamCalendar({ week, sections, exams, changes, onSchedule, onRemove }) {
  const [selectedId, setSelectedId] = useState("");
  const [dragTarget, setDragTarget] = useState("");
  const ordered = [...sections].sort((a, b) => sectionDay(a) - sectionDay(b) ||
    (scheduleTimeMinutes(a.hora_inicio) ?? 1440) - (scheduleTimeMinutes(b.hora_inicio) ?? 1440) ||
    sectionSort.compare(a.codigo, b.codigo));
  const dayGroups = dayLabels.map((label, index) => ({
    label,
    sections: ordered.filter(section => sectionDay(section) === index)
  })).filter(group => group.sections.length);
  const selected = sections.find(section => section.id === selectedId);
  const start = parseScheduleDate(week.fecha_inicio);
  const monday = addScheduleDays(week.fecha_inicio, -((start.getUTCDay() + 6) % 7));
  const days = Array.from({ length: 7 }, (_, index) => addScheduleDays(monday, index));
  const inWeek = day => day >= week.fecha_inicio && day <= week.fecha_fin;
  const grouped = new Map();
  const occupiedByDay = new Map();
  for (const exam of exams) {
    const range = sectionTimeRange(exam);
    if (range) {
      if (!occupiedByDay.has(exam.fecha)) occupiedByDay.set(exam.fecha, []);
      occupiedByDay.get(exam.fecha).push(range);
    }
    const minutes = scheduleTimeMinutes(exam.hora_inicio);
    const block = BLOCKS.find(value => minutes >= value && minutes < value + 120) ?? null;
    const key = `${exam.fecha}-${block}`;
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key).push(exam);
  }
  const rows = [...BLOCKS, ...(exams.some(exam => {
    const minutes = scheduleTimeMinutes(exam.hora_inicio);
    return minutes < BLOCKS[0] || minutes >= BLOCKS.at(-1) + 120;
  }) ? [null] : [])];

  const place = (id, day, block) => {
    if (!inWeek(day) || !sections.some(section => section.id === id)) return;
    setSelectedId(id);
    onSchedule(id, day, scheduleTimeLabel(block), scheduleTimeLabel(block + 120));
  };

  return (
    <div className="weekly-exams">
      <aside className="weekly-exams__sections" aria-labelledby="weekly-exam-sections-title">
        <header className="weekly-exams__heading">
          <span className="weekly-exams__icon"><Layers size={19} aria-hidden="true" /></span>
          <div><h4 id="weekly-exam-sections-title">Secciones</h4><p>{ordered.length} en esta carrera</p></div>
        </header>
        <p className="weekly-exams__instructions">Arrastra una sección o tócala y elige un bloque.</p>
        {dayGroups.length ? <ul className="weekly-exams__day-groups">
          {dayGroups.map(group => (
            <li key={group.label}>
              <h5>{group.label}</h5>
              <ul>
                {group.sections.map(section => {
                  const code = displaySectionCode(section.codigo);
                  const scheduled = exams.some(exam => exam.seccion_id === section.id);
                  return (
                    <li key={section.id}>
                      <button type="button" className="user-button weekly-exams__section" draggable
                        aria-pressed={selectedId === section.id} onClick={() => setSelectedId(selectedId === section.id ? "" : section.id)}
                        onDragStart={event => {
                          event.dataTransfer.setData(SECTION_DRAG, section.id);
                          event.dataTransfer.effectAllowed = "copy";
                          setSelectedId(section.id);
                        }} onDragEnd={() => setDragTarget("")}>
                        <span className="weekly-exams__section-copy">
                          <strong>Sección {code}</strong>
                          <small>{section.coordinador?.trim() || "Sin titular de sección"}</small>
                          {scheduled && <span className="weekly-exams__scheduled"><Check size={13} aria-hidden="true" /> En agenda</span>}
                        </span>
                        <GripVertical className="weekly-exams__grip" size={19} aria-hidden="true" />
                      </button>
                    </li>
                  );
                })}
              </ul>
            </li>
          ))}
        </ul> : <p>No hay secciones activas para esta carrera.</p>}
      </aside>

      <div className="weekly-exams__main">
        <header className="weekly-exams__heading weekly-exams__heading--calendar">
          <span className="weekly-exams__icon"><CalendarDays size={19} aria-hidden="true" /></span>
          <div>
            <h4>Agenda semanal</h4>
            <p className="weekly-exams__hint" role="status">
              {selected ? `Sección ${displaySectionCode(selected.codigo)} seleccionada. Elige un bloque.`
                : `${exams.length} ${exams.length === 1 ? "examen agendado" : "exámenes agendados"}. Desliza para ver toda la semana.`}
            </p>
          </div>
        </header>
        <div className="section-admin__calendar weekly-exams__calendar" tabIndex={0} role="region" aria-label="Calendario semanal de exámenes">
          <table>
            <thead><tr>
              <th scope="col">Hora</th>
              {days.map((day, index) => <th key={day} scope="col" data-weekend={index > 4} aria-label={dayFormat.format(parseScheduleDate(day))}>
                <span className="weekly-exams__day-name">{weekdays[index]}</span>
                <time dateTime={day}>{Number(day.slice(-2))}</time>
              </th>)}
            </tr></thead>
            <tbody>
              {rows.map(block => (
                <tr key={block ?? "other"}>
                  <th scope="row">{block === null ? "Otros horarios" : <>
                    <strong>{scheduleTimeLabel(block)}</strong>
                    <small>hasta {scheduleTimeLabel(block + 120)}</small>
                  </>}</th>
                  {days.map((day, index) => {
                    const key = `${day}-${block}`;
                    const occupied = block !== null && occupiedByDay.get(day)?.some(
                      range => scheduleOverlaps([block, block + 120], range)
                    );
                    const canPlace = block !== null && inWeek(day) && !occupied;
                    const cellExams = grouped.get(key) || [];
                    return (
                      <td key={day} data-active-drop={dragTarget === key} data-weekend={index > 4} data-outside={!inWeek(day)}
                        onDragOver={event => {
                          if (!canPlace || !event.dataTransfer.types.includes(SECTION_DRAG)) return;
                          event.preventDefault();
                          event.dataTransfer.dropEffect = "copy";
                          setDragTarget(key);
                        }}
                        onDragLeave={event => {
                          if (!(event.relatedTarget instanceof Node) || !event.currentTarget.contains(event.relatedTarget)) setDragTarget("");
                        }}
                        onDrop={event => {
                          if (!canPlace) return;
                          const id = event.dataTransfer.getData(SECTION_DRAG);
                          if (!id) return;
                          event.preventDefault();
                          setDragTarget("");
                          place(id, day, block);
                        }}>
                        {cellExams.map(exam => {
                          const section = sections.find(item => item.id === exam.seccion_id);
                          return (
                            <div key={exam.id} className="weekly-exams__event" data-pending={Object.hasOwn(changes, exam.id)}>
                              <button type="button" className="weekly-exams__edit" onClick={() => onRemove(exam)}
                                aria-label={`Opciones de ${exam.titulo}`} aria-haspopup="dialog">
                                <strong>{section ? displaySectionCode(section.codigo) : exam.seccion_id ? "Sección vinculada" : "Toda la carrera"}</strong>
                                {section?.coordinador?.trim() && <small>{section.coordinador.trim()}</small>}
                              </button>
                            </div>
                          );
                        })}
                        {canPlace && (
                          <button type="button" className="weekly-exams__slot" disabled={!selected}
                            aria-label={`Colocar examen el ${dayFormat.format(parseScheduleDate(day))} a las ${scheduleTimeLabel(block)}`}
                            onClick={() => place(selectedId, day, block)}>
                            <Plus size={16} aria-hidden="true" />
                          </button>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
