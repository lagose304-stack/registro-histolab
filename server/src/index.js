import app from "./app.js";
import { supabase, isSupabaseConfigured } from "./db/supabase.js";

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`\n========================================`);
  console.log(`🔬 Servidor Histolab ejecutándose en: http://localhost:${PORT}`);
  console.log(`📡 API Registros: http://localhost:${PORT}/api/registros`);
  console.log(`🩺 Health Check: http://localhost:${PORT}/api/health`);
  console.log(`========================================\n`);

  // Pre-calentamiento (Warm-up) de conexión a Supabase en segundo plano
  if (isSupabaseConfigured && supabase) {
    supabase
      .from("instructores")
      .select("count", { count: "exact", head: true })
      .then(() => {
        console.log("⚡ [WARM-UP]: Conexión con Supabase precalentada y lista.");
      })
      .catch((err) => {
        console.warn("⚠️ [WARM-UP]: Aviso al precalentar conexión a Supabase:", err.message);
      });
  }
});
