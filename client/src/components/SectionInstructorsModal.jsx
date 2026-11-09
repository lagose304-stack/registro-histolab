import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X, UserPlus, Trash2, Users, Search, ChevronDown, ChevronUp, Clock, ShieldCheck } from "lucide-react";
import { api } from "../services/api";
import { isInstructorTitular } from "../../../shared/sectionAccess.mjs";

const nameOf = instructor => [instructor.primer_nombre, instructor.primer_apellido].filter(Boolean).join(" ") || instructor.nombre_completo || "Instructor";

export default function SectionInstructorsModal({ section, allInstructors = [], onClose = () => {}, onSuccess = () => {}, notify = () => {} }) {
  const [assignedIds, setAssignedIds] = useState(() => Array.isArray(section?.instructores_asignados) ? section.instructores_asignados : []);
  const [accordionOpen, setAccordionOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const dialogRef = useRef(null);
  const savingRef = useRef(false);
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    dialog.showModal();
    return () => dialog.close();
  }, [section?.id]);
  if (!section) return null;

  const assigned = allInstructors.filter(instructor => assignedIds.includes(instructor.id));
  const available = allInstructors.filter(instructor => !assignedIds.includes(instructor.id) && !isInstructorTitular(instructor, section) &&
    `${nameOf(instructor)} ${instructor.numero_cuenta || ""} ${instructor.correo || ""}`.toLocaleLowerCase("es").includes(search.toLocaleLowerCase("es")));

  const saveChanges = async (nextIds, message) => {
    if (savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    setSaveError("");
    try {
      const result = await api.secciones.update(section.id, { instructores_asignados: nextIds });
      if (result?.success === false) throw new Error(result.message || "No pudimos guardar el cambio.");
      setAssignedIds(nextIds);
      notify(message, "success");
      onSuccess();
    } catch (error) {
      setSaveError(error.message || "No pudimos guardar el cambio. Vuelve a intentarlo.");
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  const card = (instructor, isAssigned) => <li key={instructor.id} className="section-team__card">
    <div className="section-team__identity">
      <strong>{nameOf(instructor)}</strong>
      <span>Cuenta {instructor.numero_cuenta || "sin registrar"}</span>
      {instructor.correo && <span>{instructor.correo}</span>}
      {isInstructorTitular(instructor, section) && <span className="section-team__titular"><ShieldCheck size={15} aria-hidden="true" />Titular de sección</span>}
    </div>
    <button type="button" className={`user-button${isAssigned ? " section-team__remove" : " user-button--primary"}`} disabled={saving}
      aria-label={`${isAssigned ? "Quitar" : "Asignar"} a ${nameOf(instructor)}`}
      onClick={() => saveChanges(isAssigned ? assignedIds.filter(id => id !== instructor.id) : [...assignedIds, instructor.id], isAssigned ? "Instructor retirado de la sección" : "Instructor asignado a la sección")}>
      {isAssigned ? <Trash2 size={16} aria-hidden="true" /> : <UserPlus size={16} aria-hidden="true" />}{isAssigned ? "Quitar" : "Asignar"}
    </button>
  </li>;

  return createPortal(<dialog ref={dialogRef} className="user-dialog section-team" aria-labelledby="section-team-title"
    onCancel={event => { event.preventDefault(); if (!savingRef.current) onClose(); }}>
    <header className="user-dialog__header">
      <span className="user-dialog__icon"><Users size={22} aria-hidden="true" /></span>
      <div><p>{section.codigo} · {section.carrera}</p><h2 id="section-team-title">Asignar instructores</h2></div>
      <button type="button" className="user-button user-button--icon" onClick={onClose} disabled={saving} aria-label="Cerrar ventana"><X size={21} aria-hidden="true" /></button>
    </header>
    <div className="user-dialog__body" aria-busy={saving}>
      <div className="section-team__context"><p><Clock size={16} aria-hidden="true" />{section.dia} {section.hora_inicio} – {section.hora_fin || "Fin"}</p>
        <p>Titular de sección: <strong>{section.coordinador || "Sin asignar"}</strong></p></div>
      <section className="section-team__available">
        <button type="button" className="user-button section-team__toggle" aria-expanded={accordionOpen} aria-controls="section-team-available" onClick={() => setAccordionOpen(open => !open)}>
          <UserPlus size={18} aria-hidden="true" /><span>Añadir instructor</span>{accordionOpen ? <ChevronUp size={18} aria-hidden="true" /> : <ChevronDown size={18} aria-hidden="true" />}
        </button>
        {accordionOpen && <div id="section-team-available" className="section-team__options">
          <label className="user-field">Buscar instructor<div className="section-team__search"><Search size={17} aria-hidden="true" /><input type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder="Nombre, cuenta o correo" /></div></label>
          {available.length ? <ul className="section-team__list">{available.map(instructor => card(instructor, false))}</ul> : <p className="section-team__empty">{search ? "No hay instructores disponibles que coincidan con la búsqueda." : "No hay más instructores disponibles para asignar."}</p>}
        </div>}
      </section>
      <section aria-labelledby="section-team-assigned"><h3 id="section-team-assigned">Instructores asignados <span>({assigned.length})</span></h3>
        {assigned.length ? <ul className="section-team__list">{assigned.map(instructor => card(instructor, true))}</ul> : <p className="section-team__empty">Todavía no hay instructores asignados. Abre «Añadir instructor» para incorporarlos al equipo.</p>}
      </section>
    </div>
    <footer className="user-dialog__footer">
      {saveError && <p className="user-dialog__error" role="alert">{saveError}</p>}
      <div className="user-dialog__buttons"><button type="button" className="user-button" onClick={onClose} disabled={saving}>{saving ? "Guardando…" : "Listo / Cerrar"}</button></div>
    </footer>
  </dialog>, document.body);
}
