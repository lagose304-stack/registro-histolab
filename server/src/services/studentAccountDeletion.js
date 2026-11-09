import { supabase, isSupabaseConfigured } from "../db/supabase.js";
import { STUDENT_TABLES } from "./studentEnrollment.js";

const failure = (message, status = 503) => Object.assign(new Error(message), { status });

export async function deleteStudentAccount(table, section, account) {
  if (!isSupabaseConfigured || !supabase) throw failure("El servicio de cuentas no está disponible. No se eliminó al estudiante.");
  if (!STUDENT_TABLES.includes(table)) throw failure("Carrera no válida.", 400);
  const schema = await supabase.rpc("student_account_deletion_ready");
  if (schema.error || schema.data !== true) throw failure("La eliminación completa aún no está disponible. No se eliminó al estudiante.");
  const target = await supabase.from(table).select("id,auth_user_id").eq("seccion_id", section).eq("numero_cuenta", account).maybeSingle();
  if (target.error) throw failure("No pudimos consultar al estudiante. No se eliminó su cuenta.");
  if (!target.data) throw failure("El estudiante no existe en esta sección.", 404);
  const student = target.data;
  if (student.auth_user_id) {
    // Nunca eliminar una identidad que también pertenece a otro perfil.
    const references = await Promise.all(STUDENT_TABLES.map(async candidate => {
      const result = await supabase.from(candidate).select("id").eq("auth_user_id", student.auth_user_id);
      if (result.error) throw failure("No pudimos comprobar los vínculos de la cuenta. No se eliminó.");
      return (result.data || []).some(row => candidate !== table || row.id !== student.id);
    }));
    const teacher = await supabase.from("instructores").select("id").eq("id", student.auth_user_id).maybeSingle();
    if (teacher.error) throw failure("No pudimos comprobar los vínculos de la cuenta. No se eliminó.");
    if (references.some(Boolean) || teacher.data) throw failure("La cuenta Auth está vinculada a otro perfil. Requiere revisión de Administración General.", 409);
    const prepared = await supabase.rpc("prepare_student_auth_delete", {p_table:table,p_profile:student.id,p_section:section,p_account:account,p_auth:student.auth_user_id});
    if (prepared.error || !prepared.data?.allowed) throw failure("La cuenta cambió o no se pudo preparar la eliminación. Actualiza el listado y vuelve a intentarlo.", prepared.error ? 503 : 409);
    // La migración instala guardas y cascadas: si Auth falla, la ficha permanece.
    const result = await supabase.auth.admin.deleteUser(student.auth_user_id);
    if (result.error) throw failure("No pudimos eliminar la cuenta de acceso. La eliminación no se confirmó; vuelve a intentarlo.");
  } else {
    const result = await supabase.from(table).delete().eq("id", student.id).is("auth_user_id", null).select("id");
    if (result.error) throw failure("No pudimos eliminar al estudiante. Vuelve a intentarlo.");
    if (result.data?.length !== 1) throw failure("La cuenta cambió durante la eliminación. Actualiza el listado y vuelve a intentarlo.", 409);
  }
  const check = await supabase.from(table).select("id").eq("id", student.id).maybeSingle();
  if (check.error || check.data) throw failure("No pudimos confirmar la eliminación completa. Actualiza el listado antes de reintentar.");
  return student.id;
}
