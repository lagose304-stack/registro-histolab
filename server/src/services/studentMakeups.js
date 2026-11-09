import { supabase, isSupabaseConfigured } from "../db/supabase.js";
import { ACTIVE_MAKEUP_STATES } from "../../../shared/studentMakeups.mjs";

export const MAKEUP_TABLE = "reposiciones_estudiantes";
const missing = error => ["PGRST205", "42P01"].includes(error?.code);
export async function studentMakeups(section, account) {
  if (!isSupabaseConfigured || !supabase) return [];
  const { data, error } = await supabase.from(MAKEUP_TABLE).select("id,seccion_origen_id,seccion_destino_id,numero_cuenta,numero_semana,carrera,estado,practica_at,origen_codigo,destino_codigo")
    .eq("seccion_origen_id", section).eq("numero_cuenta", String(account)).in("estado", ACTIVE_MAKEUP_STATES);
  // Antes de aplicar la migración no se concede ninguna excepción de acceso.
  if (missing(error)) return [];
  if (error) throw error;
  return data || [];
}
export async function destinationMakeup(section, account, week) {
  if (!isSupabaseConfigured || !supabase) return null;
  const { data, error } = await supabase.from(MAKEUP_TABLE).select("*").eq("seccion_destino_id", section)
    .eq("numero_cuenta", String(account)).eq("numero_semana", Number(week)).in("estado", ACTIVE_MAKEUP_STATES).maybeSingle();
  if (missing(error)) return null;
  if (error) throw error;
  return data;
}
export async function syncMakeupSubmission(submission) {
  const request = await destinationMakeup(submission.seccion_id, submission.numero_cuenta, submission.numero_semana);
  if (!request) return false;
  if (submission.estado === "calificado") {
    const { error } = await supabase.rpc("apply_student_makeup", { p_id: request.id, p_entrega: submission.id });
    if (error) throw error;
  }
  return true;
}
export async function quizzesForMakeups(requests) {
  if (!requests.length) return [];
  const { data, error } = await supabase.from("pruebas_semanales").select("*")
    .in("seccion_id", [...new Set(requests.map(row => row.seccion_destino_id))]);
  if (error) throw error;
  return (data || []).flatMap(quiz => {
    const request = requests.find(row => row.seccion_destino_id === quiz.seccion_id && Number(row.numero_semana) === Number(quiz.numero_semana));
    return request ? [{ ...quiz, reposicion: { id: request.id, seccion: request.destino_codigo, semana: request.numero_semana } }] : [];
  });
}
