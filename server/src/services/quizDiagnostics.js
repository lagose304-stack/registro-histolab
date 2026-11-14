import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { supabase, isSupabaseConfigured } from "../db/supabase.js";
import { readQuizActivity, listQuizActivity } from "./quizActivity.js";
import { normalizeDiagnosticPayload, QUIZ_DIAGNOSTIC_MAX_BATCHES } from "../../../shared/quizDiagnostics.mjs";

const file = (() => { try { return fileURLToPath(new URL("../../data/quiz_diagnostics_data.json",import.meta.url)); } catch { return path.resolve(typeof process !== "undefined" && process.cwd ? process.cwd() : "/","data/quiz_diagnostics_data.json"); } })();
const read = () => fs.existsSync(file) ? JSON.parse(fs.readFileSync(file,"utf8")) : [];
let localQueue = Promise.resolve();
async function locked(callback) {
  const previous = localQueue; let release;
  localQueue = new Promise(resolve=>{release=resolve;});
  await previous;
  try { return await callback(); } finally { release(); }
}
export async function saveQuizDiagnostic(section, week, student, attemptId, batch) {
  if (!/^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i.test(batch?.id || "")) throw new Error("Identificador de lote inválido.");
  const payload = normalizeDiagnosticPayload(batch.datos);
  const attempt = await readQuizActivity(section,week,student,attemptId);
  if (attempt.diagnostico_version !== 1) throw new Error("Este intento no tiene aceptación del diagnóstico.");
  if (isSupabaseConfigured && supabase) {
    const result = await supabase.rpc("append_quiz_diagnostic",{p_attempt:attemptId,p_student:String(student.id),p_batch:batch.id,p_payload:payload});
    if (result.error) throw result.error;
    return result.data;
  }
  return locked(()=>{
    const rows = read();
    const duplicate=rows.find(row=>row.id === batch.id);
    if (duplicate) { if (duplicate.intento_id !== attemptId) throw new Error("El lote pertenece a otro intento."); return {aceptado:true,limite:false}; }
    const end = attempt.finalizado_at || attempt.reemplazado_at;
    if ((end && new Date(end).getTime() < Date.now()-86400000) || rows.filter(row=>row.intento_id === attemptId).length >= QUIZ_DIAGNOSTIC_MAX_BATCHES) return {aceptado:false,limite:true};
    rows.push({id:batch.id,intento_id:attemptId,recibido_at:new Date().toISOString(),datos:payload});
    fs.mkdirSync(path.dirname(file),{recursive:true});
    fs.writeFileSync(`${file}.tmp`,JSON.stringify(rows),"utf8");fs.renameSync(`${file}.tmp`,file);
    return {aceptado:true,limite:false};
  });
}

export async function listQuizDiagnostics(section, week, account) {
  const attempts = await listQuizActivity(section,week,account);
  const ids = attempts.map(row=>row.id);
  if (!ids.length) return [];
  if (isSupabaseConfigured && supabase) {
    const {data,error} = await supabase.from("quiz_diagnostic_batches").select("id,intento_id,recibido_at,datos").in("intento_id",ids).order("recibido_at");
    if (error) throw error;
    return data || [];
  }
  return read().filter(row=>ids.includes(row.intento_id));
}
