import { supabase, isSupabaseConfigured } from "../db/supabase.js";

export const STUDENT_TABLES = ["estudiantes_medicina", "estudiantes_enfermeria", "estudiantes_odontologia", "estudiantes_microbiologia", "estudiantes_nutricion"];
export const DUPLICATE_ACCOUNT_MESSAGE = "Este número de cuenta ya tiene una matrícula activa. Un estudiante no puede estar matriculado en dos secciones ni en carreras distintas al mismo tiempo.";

function assertEntriesAvailable(entries, exclude) {
  const duplicate = entries.some(({ table, rows }) => rows.some(row => !(exclude && table === exclude.table && String(row.seccion_id) === String(exclude.sectionId) && String(row.numero_cuenta).trim() === String(exclude.account).trim())));
  if (duplicate) throw Object.assign(new Error(DUPLICATE_ACCOUNT_MESSAGE), { status: 409, code: "DUPLICATE_STUDENT_ACCOUNT" });
}

export function assertLocalStudentAccountAvailable(account, exclude, local) {
  const clean = String(account ?? "").trim();
  if (!clean) throw Object.assign(new Error("El número de cuenta es obligatorio."), { status: 400 });
  assertEntriesAvailable(STUDENT_TABLES.map(table => ({ table, rows: (local[table] || []).filter(row => row.activo !== false && String(row.numero_cuenta).trim() === clean) })), exclude);
}

export async function assertStudentAccountAvailable(account, exclude = null, local = {}) {
  const clean = String(account ?? "").trim();
  if (!clean) throw Object.assign(new Error("El número de cuenta es obligatorio."), { status: 400 });
  let entries;
  if (isSupabaseConfigured && supabase) {
    try {
      entries = await Promise.all(STUDENT_TABLES.map(async table => {
        const { data, error } = await supabase.from(table).select("id,seccion_id,numero_cuenta").eq("numero_cuenta", clean).eq("activo", true);
        if (error) throw error;
        return { table, rows: data || [] };
      }));
    } catch {
      throw Object.assign(new Error("No pudimos verificar si la cuenta ya está matriculada. Intenta nuevamente."), { status: 503 });
    }
  } else {
    return assertLocalStudentAccountAvailable(clean, exclude, local);
  }
  assertEntriesAvailable(entries, exclude);
}
