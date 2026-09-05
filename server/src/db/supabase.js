import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey =
  process.env.SUPABASE_KEY ||
  process.env.SUPABASE_ANON_KEY ||
  process.env.SUPABASE_SERVICE_ROLE_KEY;

export const isSupabaseConfigured = Boolean(
  supabaseUrl &&
    supabaseKey &&
    !supabaseUrl.includes("tu_supabase_url") &&
    !supabaseKey.includes("tu_supabase_key")
);

if (!isSupabaseConfigured) {
  console.log("\n========================================================");
  console.log("⚠️  [SUPABASE]: Variables SUPABASE_URL y/o SUPABASE_KEY no configuradas en server/.env.");
  console.log("ℹ️  El servidor funcionará con la base de datos en memoria hasta que agregues tus credenciales.");
  console.log("========================================================\n");
} else {
  console.log("\n========================================================");
  console.log(`⚡ [SUPABASE]: Conexión inicializada con éxito hacia: ${supabaseUrl}`);
  console.log("========================================================\n");
}

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseKey)
  : null;
