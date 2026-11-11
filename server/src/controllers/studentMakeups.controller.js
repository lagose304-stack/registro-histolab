import { withGradeActor } from "../services/gradeHistory.js";
import { supabase, isSupabaseConfigured } from "../db/supabase.js";
import { MAKEUP_TABLE } from "../services/studentMakeups.js";
import { normalizeCarreraToTable } from "./estudiantes.controller.js";
import { getSectionAttendanceEvents } from "./academicAgenda.controller.js";
import { hasAdministrationAccess } from "../../../shared/instructorRoles.mjs";
import { isInstructorTitular, isSectionAssignedToInstructor } from "../../../shared/sectionAccess.mjs";
import { normalizeSectionCareer } from "../../../shared/sectionCode.mjs";
import { getAttendanceWindow } from "../../../shared/attendanceWindow.mjs";
import { getManualsWindow } from "../../../shared/manualsWindow.mjs";
import { assertMakeupWeek, hasJustifiedAbsence, sameMakeupProgram, makeupPractice, makeupGrade } from "../../../shared/studentMakeups.mjs";
import { getCanonicalManualGrade, getCanonicalQuizGrade } from "../../../client/src/utils/academicEngine.js";

class MakeupError extends Error { constructor(status, message) { super(message); this.status = status; } }
const fail = (condition, status, message) => { if (condition) throw new MakeupError(status, message); };
const admin = user => hasAdministrationAccess(user?.rol);
const team = (user, section) => admin(user) || isSectionAssignedToInstructor(user, section);
const titular = (user, section) => admin(user) || isInstructorTitular(user, section);
async function query(builder) { const { data, error } = await builder; if (error) throw error; return data; }
const sectionById = id => query(supabase.from("secciones").select("*").eq("id", id).maybeSingle());
function forCareer(builder, career) {
  const key = normalizeSectionCareer(career);
  const label = { MEDICINA: "Medicina", ENFERMERIA: "Enfermería", ODONTOLOGIA: "Odontología", MICROBIOLOGIA: "Microbiología", NUTRICION: "Nutrición" }[key];
  fail(!label, 400, "Carrera no válida para reposiciones.");
  return builder.or(`carrera.ilike.${key},carrera.ilike.${label}`);
}
const weeksFor = career => query(forCareer(supabase.from("configuracion_semanas").select("*"), career));
const studentFor = (section, account) => query(supabase.from(normalizeCarreraToTable(section.carrera)).select("*")
  .eq("seccion_id", section.id).eq("numero_cuenta", String(account)).eq("activo", true).maybeSingle());
const requestById = id => query(supabase.from(MAKEUP_TABLE).select("*").eq("id", id).maybeSingle());
function receivingWindows(request, section, weeks, events, deadlines) {
  const now = new Date();
  let attendanceWindow = getAttendanceWindow(section, weeks, request.numero_semana, now, events);
  if (Date.parse(request.practica_at) > now.getTime()) attendanceWindow = { ...attendanceWindow, isOpen: false, reason: "El registro se habilita al iniciar la práctica receptora." };
  const manualWindow = getManualsWindow(section, weeks, request.numero_semana, now, events, deadlines);
  return { attendanceWindow, manualWindow };
}
const endpoints = handler => async (req, res) => {
  try {
    fail(!isSupabaseConfigured || !supabase, 503, "Las reposiciones requieren el servicio de base de datos.");
    res.set("Cache-Control", "no-store");
    await handler(req, res);
  } catch (error) {
    const status = error.status || (error.code === "23505" ? 409 : ["PGRST205", "42P01", "PGRST202"].includes(error.code) ? 503 : error.code === "P0001" ? 409 : 503);
    const message = error.status ? error.message : error.code === "23505" ? "Ya existe una reposición para este estudiante y práctica. Actualiza el listado."
      : error.code === "P0001" ? error.message : "No pudimos completar la operación. Verifica que la migración de reposiciones esté aplicada y vuelve a intentarlo.";
    res.status(status).json({ success: false, message });
  }
};
async function decorate(rows, user) {
  if (admin(user) || !rows.length) return rows;
  const origins = await query(supabase.from("secciones").select("*").in("id", [...new Set(rows.map(row => row.seccion_origen_id))]));
  return rows.map(row => {
    const origin = origins?.find(section => section.id === row.seccion_origen_id);
    if (admin(user) || titular(user, origin)) return row;
    const { motivo, observacion, ...safe } = row;
    return safe;
  });
}

export const listStudentMakeups = endpoints(async (req, res) => {
  const { seccion_id, estado, direccion } = req.query;
  const page = Number(req.query.page || 0);
  fail(!Number.isInteger(page) || page < 0 || page > 100000, 400, "Página inválida.");
  fail(estado && !["todas","solicitada","asignada","completada","rechazada","cancelada"].includes(estado), 400, "Estado inválido.");
  fail(!seccion_id && !admin(req.instructor), 403, "Solo Administración General puede consultar todas las solicitudes.");
  let builder = supabase.from(MAKEUP_TABLE).select("*", { count: "exact" }).order("created_at", { ascending: false }).order("id").range(page * 30, page * 30 + 29);
  let scope;
  if (seccion_id) {
    const section = await sectionById(seccion_id);
    fail(!section || !team(req.instructor, section), 403, "No perteneces al equipo de esta sección.");
    if (direccion === "origen") builder = builder.eq("seccion_origen_id", section.id);
    else if (direccion === "destino") builder = builder.eq("seccion_destino_id", section.id);
    else scope = `seccion_origen_id.eq.${section.id},seccion_destino_id.eq.${section.id}`;
  }
  if (estado && estado !== "todas") builder = builder.eq("estado", estado);
  const search = String(req.query.search || "").trim().slice(0,80).replace(/[^\p{L}\p{N}\s-]/gu, "");
  const matching = search ? ["nombre_estudiante","numero_cuenta","origen_codigo","destino_codigo"].map(key => `${key}.ilike.%${search}%`).join(",") : null;
  if (scope && matching) builder = builder.or(`and(or(${scope}),or(${matching}))`);
  else if (scope || matching) builder = builder.or(scope || matching);
  const { data, error, count } = await builder;
  if (error) throw error;
  res.json({ success: true, data: await decorate(data || [], req.instructor), total: count, page });
});

export const getMakeupOptions = endpoints(async (req, res) => {
  const section = await sectionById(req.params.seccion_id);
  fail(!section || !titular(req.instructor, section), 403, "Solo el titular puede solicitar reposiciones de esta sección.");
  const [students, weeks, topics] = await Promise.all([
    query(supabase.from(normalizeCarreraToTable(section.carrera)).select("numero_cuenta,nombre_completo,notas,asistencias").eq("seccion_id", section.id).eq("activo", true)),
    weeksFor(section.carrera), query(forCareer(supabase.from("temario").select("*"), section.carrera))
  ]);
  res.json({ success: true, data: { students, weeks, topics } });
});

export const createStudentMakeup = endpoints(async (req, res) => {
  const { seccion_origen_id, numero_cuenta, numero_semana, motivo } = req.body || {};
  fail(typeof motivo !== "string" || motivo.trim().length < 10 || motivo.length > 1000, 400, "Describe la justificación entre 10 y 1000 caracteres.");
  fail(!Number.isInteger(Number(numero_semana)) || Number(numero_semana) < 1 || !numero_cuenta, 400, "Selecciona estudiante y práctica.");
  const section = await sectionById(seccion_origen_id);
  fail(!section || !titular(req.instructor, section), 403, "Solo el titular puede solicitar la reposición.");
  const [student, weeks, topics, deliveries] = await Promise.all([
    studentFor(section, numero_cuenta), weeksFor(section.carrera),
    query(forCareer(supabase.from("temario").select("*"), section.carrera).eq("semana", Number(numero_semana))),
    query(supabase.from("entregas_pruebas").select("id").eq("seccion_id", section.id).eq("numero_cuenta", String(numero_cuenta)).eq("numero_semana", Number(numero_semana)))
  ]);
  let week;
  try { week = assertMakeupWeek(weeks || [], numero_semana); } catch (error) { throw new MakeupError(400, error.message); }
  fail(!student, 404, "El estudiante no está matriculado en esta sección.");
  fail(!hasJustifiedAbsence(student, week), 409, "La práctica debe tener una falta justificada registrada.");
  fail(deliveries?.length, 409, "Este estudiante ya tiene una entrega para esta práctica. No se puede duplicar su evaluación.");
  const manualTopics = (topics || []).filter(topic => topic.tiene_manual !== false);
  const manuals = manualTopics.map(topic => `manual_${topic.id}`);
  fail(Number(getCanonicalQuizGrade(student.notas || {}, numero_semana, student)) > 0 || Number(student.notas?.[`prueba_${numero_semana}_real`]) > 0 ||
    manualTopics.some(topic => Number(getCanonicalManualGrade(student.notas || {}, topic, student)) > 0), 409, "La práctica ya tiene notas registradas. Revisa el registro antes de solicitar otra evaluación.");
  const row = { seccion_origen_id: section.id, numero_cuenta: String(student.numero_cuenta), nombre_estudiante: student.nombre_completo,
    numero_semana: Number(numero_semana), carrera: normalizeSectionCareer(section.carrera), origen_codigo: section.codigo,
    motivo: motivo.trim(), manual_ids: manuals, solicitado_por: req.instructor.id };
  const data = await query(supabase.from(MAKEUP_TABLE).insert(row).select("*").single());
  res.status(201).json({ success: true, data, message: "Solicitud enviada a Administración General." });
});

async function destinations(request) {
  const origin = await sectionById(request.seccion_origen_id);
  const student = await studentFor(origin, request.numero_cuenta);
  const weeks = await weeksFor(origin.carrera);
  const week = assertMakeupWeek(weeks || [], request.numero_semana);
  fail(!student || !hasJustifiedAbsence(student, week), 409, "La matrícula o la falta justificada cambiaron. Revisa la solicitud.");
  const sections = await query(supabase.from("secciones").select("*").eq("periodo_academico", origin.periodo_academico));
  const candidates = (sections || []).filter(section => sameMakeupProgram(origin, section));
  if (!candidates.length) return [];
  const ids = candidates.map(section => section.id);
  const [deliveries, sessions] = await Promise.all([
    query(supabase.from("entregas_pruebas").select("seccion_id").in("seccion_id", ids).eq("numero_semana", request.numero_semana)),
    query(supabase.from("sesiones_pruebas_en_vivo").select("seccion_id,estado").in("seccion_id", ids).eq("numero_semana", request.numero_semana))
  ]);
  const blocked = new Set([...(deliveries || []).map(row => row.seccion_id), ...(sessions || []).filter(row => ["en_pregunta", "esperando_siguiente", "finalizada"].includes(row.estado)).map(row => row.seccion_id)]);
  const data = await Promise.all(candidates.filter(section => !blocked.has(section.id)).map(async section => {
    const practice = makeupPractice(section, weeks, request.numero_semana, await getSectionAttendanceEvents(section));
    return practice.eligible ? { id: section.id, codigo: section.codigo, dia: section.dia, hora_inicio: section.hora_inicio, hora_fin: section.hora_fin, practica_at: practice.startsAt, fecha: practice.date, carrera: section.carrera } : null;
  }));
  return data.filter(Boolean).sort((a, b) => a.practica_at.localeCompare(b.practica_at));
}
export const getMakeupDestinations = endpoints(async (req, res) => {
  fail(!admin(req.instructor), 403, "Esta operación corresponde a Administración General.");
  const request = await requestById(req.params.id);
  fail(!request || request.estado !== "solicitada", 409, "La solicitud ya no está pendiente.");
  res.json({ success: true, data: await destinations(request) });
});
export const resolveStudentMakeup = endpoints(async (req, res) => {
  fail(!admin(req.instructor), 403, "Esta operación corresponde a Administración General.");
  const request = await requestById(req.params.id);
  fail(!request, 404, "Solicitud no encontrada.");
  const { accion, seccion_destino_id, observacion } = req.body || {};
  if (accion === "asignar") {
    fail(request.estado !== "solicitada", 409, "La solicitud ya fue resuelta.");
    const destination = (await destinations(request)).find(section => section.id === seccion_destino_id);
    fail(!destination, 409, "La sección seleccionada ya no está disponible para esta práctica.");
    const data = await query(supabase.rpc("assign_student_makeup", { p_id: request.id, p_destino: destination.id, p_practica: destination.practica_at, p_actor: req.instructor.id }));
    return res.json({ success: true, data, message: "Sección receptora asignada sin modificar la matrícula." });
  }
  fail(!["rechazar", "cancelar"].includes(accion), 400, "Acción inválida.");
  fail(typeof observacion !== "string" || observacion.trim().length < 5 || observacion.length > 1000, 400, "Explica el motivo de la decisión.");
  fail(request.estado !== "solicitada" || Object.keys(request.notas_aplicadas || {}).length, 409, "Solo se pueden retirar solicitudes pendientes; las reposiciones iniciadas conservan su historial.");
  const data = await query(supabase.from(MAKEUP_TABLE).update({ estado: accion === "rechazar" ? "rechazada" : "cancelada", observacion: observacion.trim(), resuelto_por: req.instructor.id, updated_at: new Date().toISOString() }).eq("id", request.id).eq("estado", "solicitada").select("*").maybeSingle());
  fail(!data, 409, "Otro administrador resolvió esta solicitud. Actualiza el listado.");
  res.json({ success: true, data });
});

export const getReceivingMakeup = endpoints(async (req, res) => {
  const request = await requestById(req.params.id);
  fail(!request || !request.seccion_destino_id, 404, "No se encontró una reposición asignada.");
  const section = await sectionById(request.seccion_destino_id);
  fail(!section || !team(req.instructor, section), 403, "No perteneces al equipo receptor.");
  const [weeks, events, deadlines, topics, submissions] = await Promise.all([
    weeksFor(section.carrera), getSectionAttendanceEvents(section),
    query(supabase.from("fechas_carga_manuales").select("numero_semana,fecha_carga").eq("seccion_id", section.id)),
    query(forCareer(supabase.from("temario").select("id,titulo"), section.carrera)),
    query(supabase.from("entregas_pruebas").select("id,estado,nota_obtenida").eq("seccion_id", section.id).eq("numero_semana", request.numero_semana).eq("numero_cuenta", request.numero_cuenta))
  ]);
  const { motivo, observacion, ...safe } = request;
  res.json({ success: true, data: { ...safe, topics: (topics || []).filter(topic => request.manual_ids.includes(`manual_${topic.id}`)),
    ...receivingWindows(request, section, weeks, events, deadlines), submission: submissions?.[0] || null } });
});
export const saveReceivingMakeup = endpoints(async (req, res) => {
  const request = await requestById(req.params.id);
  fail(!request || !["asignada", "completada"].includes(request.estado), 409, "La reposición no está habilitada.");
  const section = await sectionById(request.seccion_destino_id);
  fail(!section || !team(req.instructor, section), 403, "No perteneces al equipo receptor.");
  const { manuales, asistio: legacyAttendance, asistencia_reposicion } = req.body || {};
  fail(asistencia_reposicion !== undefined && !["Asistio","Falta injustificada"].includes(asistencia_reposicion), 400, "En la reposición solo puedes registrar Asistió o Falta injustificada.");
  const asistio = asistencia_reposicion === undefined ? legacyAttendance : asistencia_reposicion === "Asistio";
  fail(legacyAttendance !== undefined && asistencia_reposicion !== undefined && legacyAttendance !== asistio, 400, "Los estados de asistencia no coinciden.");
  fail(manuales != null && (typeof manuales !== "object" || Array.isArray(manuales)), 400, "Formato de notas inválido.");
  fail(asistio != null && typeof asistio !== "boolean", 400, "Asistencia inválida.");
  const patch = manuales || {};
  const absent = asistencia_reposicion === "Falta injustificada" || asistio === false ||
    (asistio == null && request.asistencia_reposicion === "Falta injustificada");
  fail(absent && Object.values(patch).some(value => Number(value) > 0), 409, "No puedes registrar una nota de manual con falta injustificada en la reposición.");
  fail(Object.entries(patch).some(([key, value]) => !request.manual_ids.includes(key) || !makeupGrade(value)), 400, "Revisa los manuales: de 0 a 1, con hasta tres decimales.");
  const [weeks, events, deadlines] = await Promise.all([weeksFor(section.carrera), getSectionAttendanceEvents(section),
    query(supabase.from("fechas_carga_manuales").select("numero_semana,fecha_carga").eq("seccion_id", section.id))]);
  const windows = receivingWindows(request, section, weeks, events, deadlines);
  fail(asistio != null && !windows.attendanceWindow.isOpen, 409, "La asistencia se registra durante el horario de la práctica receptora.");
  if (Object.keys(patch).length) {
    const window = windows.manualWindow;
    fail(!window.isOpen, 409, window.reason);
  }
  const data = await query(withGradeActor(supabase.rpc("apply_student_makeup", { p_id: request.id, p_manuales: patch, p_asistio: asistio ?? null, p_actor: req.instructor.id }), req.instructor));
  res.json({ success: true, data, message: "Registro guardado en la sección original del estudiante." });
});
