import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { supabase, isSupabaseConfigured } from "../db/supabase.js";
import { QUIZ_ACTIVITY_POLICY, appendLocalActivity, normalizeActivityEvent } from "../../../shared/quizActivity.mjs";

const file = (() => {
  try { return fileURLToPath(new URL("../../data/quiz_activity_data.json", import.meta.url)); }
  catch { return path.resolve(typeof process !== "undefined" && process.cwd ? process.cwd() : "/", "data/quiz_activity_data.json"); }
})();
const localLocks = new Map();
async function locked(callback) {
  const previous = localLocks.get(file) || Promise.resolve();
  let release;
  const current = new Promise(resolve => { release = resolve; });
  localLocks.set(file, current);
  await previous;
  try { return await callback(); } finally { release(); if (localLocks.get(file) === current) localLocks.delete(file); }
}
function loadLocal() {
  if (!fs.existsSync(file)) return [];
  return JSON.parse(fs.readFileSync(file, "utf8"));
}
function saveLocal(rows) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temp = `${file}.tmp`;
  fs.writeFileSync(temp, JSON.stringify(rows), "utf8");
  fs.renameSync(temp, file);
}
const scope = (section, week, student) => ({ seccion_id: String(section), numero_semana: Number(week), alumno_id: String(student.id), numero_cuenta: String(student.numero_cuenta) });
const belongs = (row, where) => Object.entries(where).every(([key, value]) => row[key] === value);

export async function beginQuizActivity(section, week, student, quiz, clientTime, notBefore = null, diagnosticVersion = null) {
  const where = { ...scope(section, week, student), quiz_id: String(quiz.id) };
  const date = new Date(clientTime);
  if (!Number.isFinite(date.getTime())) throw new Error("Hora de aceptación inválida.");
  const row = { id: crypto.randomUUID(), ...where, nombre_completo: student.nombre_completo || "", politica: QUIZ_ACTIVITY_POLICY, aceptado_at: new Date().toISOString(), aceptado_cliente_at: date.toISOString(), faltas: 0, episodio_abierto: null, finalizado_at: null, reemplazado_at: null, ...(diagnosticVersion === 1 ? {diagnostico_version:1} : {}) };
  if (isSupabaseConfigured && supabase) {
    let { data, error } = await supabase.from("quiz_activity_attempts").select("*").match(where).is("reemplazado_at", null).maybeSingle();
    if (error) throw error;
    if (data && (data.finalizado_at || (notBefore && new Date(data.aceptado_at) < new Date(notBefore)))) {
      const retired = await supabase.from("quiz_activity_attempts").update({ reemplazado_at: new Date().toISOString() }).eq("id", data.id).is("reemplazado_at", null);
      if (retired.error) throw retired.error;
      data = null;
    }
    if (!data) {
      let result = await supabase.from("quiz_activity_attempts").insert(row).select("*").single();
      // Publicar el cliente antes de aplicar la migración no debe impedir rendir.
      // Solo omitir el diagnóstico cuando falta exactamente su columna nueva.
      if (["PGRST204", "42703"].includes(result.error?.code) && /diagnostico_version/.test(result.error?.message || "")) {
        const { diagnostico_version, ...legacyRow } = row;
        result = await supabase.from("quiz_activity_attempts").insert(legacyRow).select("*").single();
      }
      if (result.error?.code === "23505") {
        const retry = await supabase.from("quiz_activity_attempts").select("*").match(where).is("reemplazado_at", null).single();
        if (retry.error) throw retry.error;
        data = retry.data;
      } else { if (result.error) throw result.error; data = result.data; }
    }
    return readQuizActivity(section, week, student, data.id);
  }
  return locked(() => {
    const rows = loadLocal();
    let found = rows.find(item => belongs(item, where) && !item.reemplazado_at);
    if (found && (found.finalizado_at || (notBefore && new Date(found.aceptado_at) < new Date(notBefore)))) { found.reemplazado_at = new Date().toISOString(); found = null; }
    if (!found) { found = { ...row, eventos: [] }; rows.push(found); saveLocal(rows); }
    return structuredClone(found);
  });
}

// Recuperación de una referencia perdida; nunca crea una aceptación ni retira intentos.
export async function findCurrentQuizActivity(section, week, student, quizId) {
  const where = { ...scope(section, week, student), quiz_id: String(quizId) };
  let found;
  if (isSupabaseConfigured && supabase) {
    const { data, error } = await supabase.from("quiz_activity_attempts").select("id").match(where).is("reemplazado_at", null).maybeSingle();
    if (error) throw error;
    found = data;
  } else found = loadLocal().find(row => belongs(row, where) && !row.reemplazado_at);
  return found ? readQuizActivity(section, week, student, found.id) : null;
}

export async function readQuizActivity(section, week, student, id) {
  const where = { ...scope(section, week, student), id };
  if (isSupabaseConfigured && supabase) {
    const { data, error } = await supabase.from("quiz_activity_attempts").select("*").match(where).maybeSingle();
    if (error) throw error;
    if (!data) throw new Error("Intento de actividad no encontrado para esta matrícula.");
    const events = await supabase.from("quiz_activity_events").select("*").eq("intento_id", id).order("secuencia");
    if (events.error) throw events.error;
    return { ...data, eventos: events.data || [] };
  }
  const found = loadLocal().find(row => belongs(row, where));
  if (!found) throw new Error("Intento de actividad no encontrado para esta matrícula.");
  return structuredClone(found);
}

export async function recordQuizActivity(section, week, student, id, events = []) {
  if (!Array.isArray(events) || events.length > 12) throw new Error("Lote de actividad inválido.");
  const clean = events.map(normalizeActivityEvent);
  const attempt = await readQuizActivity(section, week, student, id); // Nunca confiar en un ID ajeno.
  if (attempt.reemplazado_at) { const error=new Error("Este intento fue reemplazado por una reapertura docente."); error.code="QUIZ_REOPENED"; throw error; }
  if (isSupabaseConfigured && supabase) {
    const { error } = await supabase.rpc("append_quiz_activity", { p_attempt: id, p_student: String(student.id), p_events: clean });
    if (error) throw error;
    return readQuizActivity(section, week, student, id);
  }
  return locked(() => {
    const rows = loadLocal();
    const index = rows.findIndex(row => row.id === id && belongs(row, scope(section, week, student)));
    if (index < 0) throw new Error("Intento de actividad no encontrado.");
    const next = appendLocalActivity(rows[index], clean);
    rows[index] = next;
    saveLocal(rows);
    return structuredClone(next);
  });
}

export async function finishQuizActivity(section, week, student, id) {
  await readQuizActivity(section, week, student, id);
  if (isSupabaseConfigured && supabase) {
    const { error } = await supabase.from("quiz_activity_attempts").update({ finalizado_at: new Date().toISOString() }).eq("id", id).eq("alumno_id", String(student.id)).is("finalizado_at", null);
    if (error) throw error;
    return;
  }
  return locked(() => {
    const rows = loadLocal();
    const row = rows.find(item => item.id === id);
    row.finalizado_at ||= new Date().toISOString();
    saveLocal(rows);
  });
}

export async function listQuizActivity(section, week, account) {
  if (isSupabaseConfigured && supabase) {
    const { data, error } = await supabase.from("quiz_activity_attempts").select("*").eq("seccion_id", String(section)).eq("numero_semana", Number(week)).eq("numero_cuenta", String(account)).order("aceptado_at");
    if (error) throw error;
    return Promise.all((data || []).map(row => readQuizActivity(section, week, { id: row.alumno_id, numero_cuenta: row.numero_cuenta }, row.id)));
  }
  return loadLocal().filter(row => row.seccion_id === String(section) && row.numero_semana === Number(week) && row.numero_cuenta === String(account));
}
