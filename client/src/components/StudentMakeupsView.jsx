import React, { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, UsersRound, Plus, RefreshCw, CheckCircle2, Clock, Send, AlertCircle, Search, X, CalendarDays, Save } from "lucide-react";
import { api } from "../services/api";
import { hasFullSectionAccess } from "../utils/sectionRoleUtils";
import { hasJustifiedAbsence, assertMakeupWeek, makeupAttendanceOutcome } from "../../../shared/studentMakeups.mjs";
import GradeInput from "./GradeInput";
import "./StudentMakeupsView.css";

const labels = { solicitada: "Pendiente de asignación", asignada: "Asignada", completada: "Completada", rechazada: "Rechazada", cancelada: "Cancelada" };
const date = value => value ? new Intl.DateTimeFormat("es-HN", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Tegucigalpa" }).format(new Date(value)) : "Por asignar";
export default function StudentMakeupsView({ seccion, currentInstructor, onClose = () => {} }) {
  const sectionId = seccion?.id;
  const isAdminArea = !sectionId;
  const canRequest = Boolean(sectionId && hasFullSectionAccess(currentInstructor, seccion));
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [status, setStatus] = useState(isAdminArea ? "solicitada" : "todas");
  const [search, setSearch] = useState("");
  const [querySearch, setQuerySearch] = useState("");
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const [direction, setDirection] = useState("todas");
  const [panel, setPanel] = useState(null);
  const [detail, setDetail] = useState(null);
  const [options, setOptions] = useState(null);
  const [targets, setTargets] = useState([]);
  const [destination, setDestination] = useState("");
  const [reason, setReason] = useState("");
  const [week, setWeek] = useState("");
  const [account, setAccount] = useState("");
  const [manuals, setManuals] = useState({});
  const [busy, setBusy] = useState(false);
  const [panelLoading, setPanelLoading] = useState(false);
  const [panelError, setPanelError] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const inFlight = useRef(false);
  const version = useRef(0);
  const panelHeading = useRef(null);
  const listVersion = useRef(0);
  useEffect(() => { const timer = setTimeout(() => { setQuerySearch(search); setPage(0); }, 300); return () => clearTimeout(timer); }, [search]);
  useEffect(() => {
    if (panel) { panelHeading.current?.focus({ preventScroll: true }); panelHeading.current?.scrollIntoView({ block: "start", behavior: "instant" }); }
  }, [panel]);
  const load = useCallback(async () => {
    const request = ++listVersion.current;
    setLoading(true); setError("");
    try { const result = await api.reposicionesEstudiantes.list(sectionId, { estado: status, direccion: direction, search: querySearch, page }); if (request === listVersion.current) { setRows(result.data || []); setTotal(result.total ?? result.data?.length ?? 0); if (!result.data?.length && page > 0) setPage(value => value - 1); } }
    catch (failure) { if (request === listVersion.current) setError(failure.message); }
    finally { if (request === listVersion.current) setLoading(false); }
  }, [sectionId, status, direction, querySearch, page]);
  useEffect(() => { load(); return () => { listVersion.current++; }; }, [load]);
  useEffect(() => () => { version.current++; }, [sectionId]);
  const closePanel = () => { if (inFlight.current) return; version.current++; setPanel(null); setDetail(null); setFeedback(null); };
  const openPanel = async (kind, row) => {
    if (inFlight.current) return;
    const request = ++version.current;
    setPanel({ kind, row }); setDetail(null); setFeedback(null); setPanelError(false); setTargets([]); setDestination(""); setReason(""); setAccount(""); setWeek(""); setOptions(null); setPanelLoading(true);
    try {
      if (kind === "create") { const result = await api.reposicionesEstudiantes.options(sectionId); if (request === version.current) setOptions(result.data); }
      if (kind === "assign") { const result = await api.reposicionesEstudiantes.destinations(row.id); if (request === version.current) setTargets(result.data || []); }
      if (kind === "receive") { const result = await api.reposicionesEstudiantes.receiving(row.id); if (request === version.current) { setDetail(result.data); setManuals(Object.fromEntries((result.data.topics || []).map(topic => [`manual_${topic.id}`, result.data.manual_notas?.[`manual_${topic.id}`] ?? ""]))); } }
    } catch (failure) { if (request === version.current) { setPanelError(true); setFeedback({ type: "error", message: failure.message }); } }
    finally { if (request === version.current) setPanelLoading(false); }
  };
  const mutate = async operation => {
    if (inFlight.current) return;
    inFlight.current = true; setBusy(true); setFeedback(null);
    try {
      const result = await operation();
      if (!result.success) throw new Error(result.message || "No pudimos guardar el cambio.");
      const kind = panel?.kind;
      const id = panel?.row?.id;
      if (kind === "receive") { const fresh = await api.reposicionesEstudiantes.receiving(id); setDetail(fresh.data); setManuals(Object.fromEntries((fresh.data.topics || []).map(topic => [`manual_${topic.id}`, fresh.data.manual_notas?.[`manual_${topic.id}`] ?? ""]))); }
      else { setPanel(null); setDetail(null); }
      setFeedback({ type: "success", message: result.message || "Cambio guardado." });
      await load();
    } catch (failure) { setFeedback({ type: "error", message: failure.message }); }
    finally { inFlight.current = false; setBusy(false); }
  };
  const eligible = (options?.students || []).filter(student => {
    try { return hasJustifiedAbsence(student, assertMakeupWeek(options.weeks || [], week)); } catch { return false; }
  });
  const visible = rows.filter(row => (status === "todas" || row.estado === status) &&
    (direction === "todas" || (direction === "origen" ? row.seccion_origen_id === sectionId : row.seccion_destino_id === sectionId)) &&
    `${row.nombre_estudiante} ${row.numero_cuenta} ${row.origen_codigo} ${row.destino_codigo || ""}`.toLocaleLowerCase("es").includes(search.toLocaleLowerCase("es")));

  return <section className="makeups user-directory" aria-label="Reposiciones de prácticas">
    {isAdminArea && <button type="button" className="user-button user-button--back" onClick={onClose} disabled={busy}><ArrowLeft size={17} />Panel docente</button>}
    <header className="makeups__hero"><span><UsersRound size={25} /></span><div><p>{isAdminArea ? "Administración General" : `Sección ${seccion.codigo}`}</p><h1>Reposiciones de prácticas</h1><p>{isAdminArea ? "Asigna una sección receptora a cada solicitud del titular." : "Solicita una reposición o registra a los estudiantes invitados a tu sección."}</p></div>
      {canRequest && <button type="button" className="user-button user-button--primary" onClick={() => openPanel("create")} disabled={busy}><Plus size={18} />Solicitar reposición</button>}</header>
    <div className="makeups__notice"><AlertCircle size={19} /><p>La matrícula permanece en la sección original. Las notas de la reposición se guardan allí; la justificación de la falta se conserva.</p></div>
    {feedback && <div className={`makeups__feedback makeups__feedback--${feedback.type}`} role={feedback.type === "error" ? "alert" : "status"}>{feedback.type === "success" ? <CheckCircle2 size={20} /> : <AlertCircle size={20} />}<p>{feedback.message}</p></div>}

    {panel && <section className="makeups__panel" aria-labelledby="makeups-panel-title" aria-busy={panelLoading || busy}>
      <header><h2 id="makeups-panel-title" ref={panelHeading} tabIndex={-1}>{({ create: "Solicitar reposición", assign: "Elegir sección receptora", reject: "Resolver solicitud", receive: "Registrar práctica repuesta" })[panel.kind]}</h2><button type="button" className="user-button user-button--icon" aria-label="Cerrar formulario de reposición" onClick={closePanel} disabled={busy}><X size={20} /></button></header>
      {panel.row && <p><strong>{panel.row.nombre_estudiante}</strong> · {panel.row.numero_cuenta} · Semana {panel.row.numero_semana} · Origen: {panel.row.origen_codigo}</p>}
      {panelLoading ? <p role="status"><RefreshCw size={18} className="animate-spin" />Cargando información…</p> : panelError ? <button type="button" className="user-button" onClick={() => openPanel(panel.kind,panel.row)}>Reintentar información de reposición</button> : <>
        {panel.kind === "create" && options && <form onSubmit={event => { event.preventDefault(); mutate(() => api.reposicionesEstudiantes.create({ seccion_origen_id: sectionId, numero_cuenta: account, numero_semana: Number(week), motivo: reason })); }}>
          <label className="user-field">Práctica<select required value={week} onChange={event => { setWeek(event.target.value); setAccount(""); }} disabled={busy}><option value="">Selecciona una semana</option>{(options.weeks || []).filter(item => { try { assertMakeupWeek(options.weeks, item.numero_semana); return true; } catch { return false; } }).sort((a, b) => Number(a.numero_semana) - Number(b.numero_semana)).map(item => <option value={item.numero_semana} key={item.numero_semana}>Semana {item.numero_semana} · {item.nombre_semana || item.descripcion || "Práctica"}</option>)}</select></label>
          <label className="user-field">Estudiante con falta justificada<select required value={account} onChange={event => setAccount(event.target.value)} disabled={!week || busy}><option value="">Selecciona un estudiante</option>{eligible.map(student => <option value={student.numero_cuenta} key={student.numero_cuenta}>{student.nombre_completo} · {student.numero_cuenta}</option>)}</select></label>
          {week && !eligible.length && <p>No hay estudiantes con falta justificada registrada para esta práctica.</p>}
          <label className="user-field">Justificación para Administración General<textarea required minLength={10} maxLength={1000} value={reason} onChange={event => setReason(event.target.value)} disabled={busy} rows={3} placeholder="Explica el motivo de la solicitud." /><small>Este motivo solo se muestra al titular y a Administración General.</small></label>
          <button type="submit" className="user-button user-button--primary" disabled={busy || !account || reason.trim().length < 10}><Send size={17} />{busy ? "Enviando…" : "Enviar solicitud"}</button>
        </form>}
        {panel.kind === "assign" && <form onSubmit={event => { event.preventDefault(); mutate(() => api.reposicionesEstudiantes.resolve(panel.row.id, { accion: "asignar", seccion_destino_id: destination })); }}>
          <p>{panel.row.motivo}</p><label className="user-field">Sección que aún no recibe esta práctica<select required value={destination} onChange={event => setDestination(event.target.value)} disabled={busy}><option value="">Selecciona una sección</option>{targets.map(target => <option value={target.id} key={target.id}>{target.codigo} · {date(target.practica_at)}</option>)}</select></label>
          {!targets.length && <p className="makeups__empty">No hay secciones disponibles de la misma carrera y periodo que aún no hayan iniciado esta práctica. No se habilitará una evaluación de otra semana.</p>}
          <button type="submit" className="user-button user-button--primary" disabled={busy || !destination}><CalendarDays size={17} />{busy ? "Asignando…" : "Confirmar sección receptora"}</button>
        </form>}
        {panel.kind === "reject" && <form onSubmit={event => { event.preventDefault(); mutate(() => api.reposicionesEstudiantes.resolve(panel.row.id, { accion: "rechazar", observacion: reason })); }}><p>{panel.row.motivo}</p><label className="user-field">Motivo de la decisión<textarea required minLength={5} maxLength={1000} value={reason} onChange={event => setReason(event.target.value)} disabled={busy} rows={3} /></label><button type="submit" className="user-button user-button--danger" disabled={busy || reason.trim().length < 5}>Confirmar rechazo</button></form>}
        {panel.kind === "receive" && detail && <div className="makeups__receiving">
          <div className="makeups__attendance"><div><h3>Asistencia a la reposición</h3><p>{detail.asistencia_reposicion === "Asistio" ? "Asistió" : detail.asistencia_reposicion || "Sin registrar"} · {date(detail.practica_at)}</p><p>{makeupAttendanceOutcome(detail.asistencia_reposicion) ? `En origen: Falta justificada · ${makeupAttendanceOutcome(detail.asistencia_reposicion)}` : "La falta justificada original se conserva."}</p><small>{detail.attendanceWindow.reason}</small></div><div className="makeups__attendance-actions" role="group" aria-label="Registrar asistencia de reposición">{[["Asistio","Asistió"],["Falta injustificada","Falta injustificada"]].map(([value,label]) => <button key={value} type="button" className="user-button" aria-pressed={detail.asistencia_reposicion === value} disabled={busy || !detail.attendanceWindow.isOpen} onClick={() => mutate(() => api.reposicionesEstudiantes.saveReceiving(detail.id, { asistencia_reposicion: value }))}>{label}</button>)}</div></div>
          <form onSubmit={event => { event.preventDefault(); const patch = Object.fromEntries(Object.entries(manuals).filter(([key, value]) => value !== "" && Number(value) !== detail.manual_notas?.[key]).map(([key, value]) => [key, Number(value)])); if (!Object.keys(patch).length) return; mutate(() => api.reposicionesEstudiantes.saveReceiving(detail.id, { manuales: patch })); }}>
            <h3>Manuales · Semana {detail.numero_semana}</h3><p>{detail.manualWindow.reason}</p>
            {(detail.topics || []).map(topic => <label className="user-field makeups__manual" key={topic.id}>{topic.titulo}<span><GradeInput aria-label={`Nota de ${topic.titulo}`} value={manuals[`manual_${topic.id}`] ?? ""} max={1} disabled={busy || !detail.manualWindow.isOpen} onValueChange={value => setManuals(previous => ({ ...previous, [`manual_${topic.id}`]: value }))} placeholder="Sin nota" /><small>/ 1 punto</small></span></label>)}
            {!detail.topics.length && <p>Esta práctica no tiene manuales configurados.</p>}
            {detail.topics.length > 0 && <button type="submit" className="user-button user-button--primary" disabled={busy || !detail.manualWindow.isOpen || !Object.entries(manuals).some(([key,value]) => value !== "" && Number(value) !== detail.manual_notas?.[key])}><Save size={17} />Guardar manuales en sección original</button>}
          </form>
          <div className="makeups__notice"><Clock size={19} /><p>{detail.submission ? `Prueba ${detail.submission.estado === "calificado" ? `calificada: ${detail.submission.nota_obtenida} / 5` : "entregada, pendiente de revisión"}.` : "El estudiante realizará la prueba en vivo de esta sección desde su portal."} La revisión se realiza en «Revisar respuestas» y su nota se sincroniza con la sección original.</p></div>
        </div>}
      </>}
    </section>}

    <div className="makeups__toolbar"><label className="makeups__search"><Search size={18} /><input type="search" aria-label="Buscar reposiciones" placeholder="Estudiante, cuenta o sección" value={search} onChange={event => setSearch(event.target.value)} /></label><label className="user-field">Estado<select value={status} onChange={event => { setStatus(event.target.value); setPage(0); }}><option value="todas">Todos</option>{Object.entries(labels).map(([key,label]) => <option key={key} value={key}>{label}</option>)}</select></label>{sectionId && <label className="user-field">Relación<select value={direction} onChange={event => { setDirection(event.target.value); setPage(0); }}><option value="todas">Todas</option><option value="origen">Solicitudes de mi sección</option><option value="destino">Estudiantes que recibimos</option></select></label>}<button type="button" className="user-button" onClick={load} disabled={loading || busy}><RefreshCw size={18} className={loading ? "animate-spin" : ""} />Actualizar</button></div>
    {loading ? <p className="makeups__empty" role="status">Cargando reposiciones…</p> : error ? <div className="makeups__feedback" role="alert"><AlertCircle size={20} /><p>{error}</p><button type="button" className="user-button" onClick={load}>Reintentar</button></div> : <>
      <p className="makeups__count">{total} {total === 1 ? "reposición" : "reposiciones"} · Página {page + 1}</p>
      {!visible.length && <p className="makeups__empty">No hay reposiciones que coincidan con esta consulta.</p>}
      <ul className="makeups__list">{visible.map(row => <li className="makeups__card" key={row.id}>
        <header><span className="makeups__state" data-state={row.estado}>{labels[row.estado]}</span><span>Semana {row.numero_semana}</span></header>
        <h2>{row.nombre_estudiante}</h2><p className="makeups__account">{row.numero_cuenta} · {row.carrera}</p>
        <div className="makeups__route"><span><small>Sección original</small><strong>{row.origen_codigo}</strong></span><ArrowRight size={20} /><span><small>Sección receptora</small><strong>{row.destino_codigo || "Por asignar"}</strong></span></div>
        {row.practica_at && <p><CalendarDays size={16} />{date(row.practica_at)}</p>}
        {makeupAttendanceOutcome(row.asistencia_reposicion) && <p>Falta justificada · <strong>{makeupAttendanceOutcome(row.asistencia_reposicion)}</strong></p>}
        {row.motivo && <details><summary>Justificación</summary><p>{row.motivo}</p></details>}
        {row.observacion && <p>{row.observacion}</p>}
        <footer>{isAdminArea && row.estado === "solicitada" && <><button type="button" className="user-button user-button--primary" onClick={() => openPanel("assign",row)} disabled={busy}>Asignar sección</button><button type="button" className="user-button user-button--danger" onClick={() => openPanel("reject",row)} disabled={busy}>Rechazar</button></>}
          {sectionId === row.seccion_destino_id && ["asignada","completada"].includes(row.estado) && <button type="button" className="user-button user-button--primary" onClick={() => openPanel("receive",row)} disabled={busy}>Registrar reposición</button>}
          {row.estado === "completada" && <p><CheckCircle2 size={17} />Práctica, manuales y prueba registrados.</p>}
        </footer>
      </li>)}</ul>
      {total > 30 && <nav className="makeups__pagination" aria-label="Páginas de reposiciones"><button type="button" className="user-button" disabled={busy || loading || page === 0} onClick={() => setPage(value => value - 1)}>Anterior</button><span>{page + 1} de {Math.ceil(total / 30)}</span><button type="button" className="user-button" disabled={busy || loading || (page + 1) * 30 >= total} onClick={() => setPage(value => value + 1)}>Siguiente</button></nav>}
    </>}
  </section>;
}
