import { createSupabaseLoginClient, isSupabaseConfigured } from "../db/supabase.js";
import { validActivationPassword } from "../../../shared/accountActivation.mjs";

// Complementa el límite de Auth sin guardar contraseñas ni tokens.
const attempts = new Map();
const WINDOW_MS = 5 * 60 * 1000;
const MAX_ATTEMPTS = 5;

export async function changeInstructorPassword(req, res) {
  const instructor = req.instructor;
  if (!instructor?.id || !instructor.correo) {
    return res.status(401).json({ success: false, message: "Inicia sesión para cambiar tu contraseña." });
  }
  const { contrasena_actual: current, nueva_contrasena: next } = req.body || {};
  if (typeof current !== "string" || typeof next !== "string" || !current.trim() || current.length > 1024) {
    return res.status(400).json({ success: false, message: "Ingresa tu contraseña actual y una nueva contraseña." });
  }
  if (!validActivationPassword(next)) {
    return res.status(400).json({ success: false, message: "La nueva contraseña debe tener al menos 12 caracteres y no ser demasiado larga." });
  }
  if (current === next) {
    return res.status(400).json({ success: false, message: "La nueva contraseña debe ser diferente a la actual." });
  }
  if (!isSupabaseConfigured) {
    return res.status(503).json({ success: false, message: "El servicio de cuentas no está disponible. Intenta más tarde." });
  }
  const now = Date.now();
  for (const [id, record] of attempts) if (record.expiresAt <= now) attempts.delete(id);
  const record = attempts.get(instructor.id);
  if (record?.count >= MAX_ATTEMPTS) {
    res.set("Retry-After", String(Math.ceil((record.expiresAt - now) / 1000)));
    return res.status(429).json({ success: false, message: "Has realizado varios intentos. Espera cinco minutos antes de volver a intentarlo." });
  }
  if (attempts.size >= 1000 && !record) {
    return res.status(429).json({ success: false, message: "Hay demasiadas solicitudes. Intenta más tarde." });
  }
  attempts.set(instructor.id, { count: (record?.count || 0) + 1, expiresAt: record?.expiresAt || now + WINDOW_MS });

  let client;
  try {
    // Cliente aislado: nunca iniciar sesión en el cliente privilegiado compartido.
    client = createSupabaseLoginClient();
    const { data, error } = await client.auth.signInWithPassword({ email: instructor.correo, password: current });
    if (error) {
      const status = error.status === 429 ? 429 : error.code === "invalid_credentials" ? 400 : 503;
      return res.status(status).json({ success: false, message: status === 400
        ? "La contraseña actual no es correcta."
        : status === 429 ? "Espera unos minutos antes de volver a intentarlo."
        : "No pudimos verificar tu contraseña. Intenta de nuevo más tarde." });
    }
    if (!data?.user?.id || data.user.id !== instructor.id) {
      return res.status(403).json({ success: false, message: "No pudimos verificar la identidad de tu cuenta." });
    }
    const { error: updateError } = await client.auth.updateUser({ password: next, current_password: current });
    if (updateError) {
      const status = updateError.status === 429 ? 429 : updateError.status >= 500 ? 503 : 400;
      return res.status(status).json({ success: false, message: status === 400
        ? "La nueva contraseña no cumple los requisitos de seguridad. Prueba con una clave más larga y evita contraseñas comunes."
        : "No pudimos actualizar la contraseña en este momento. Intenta más tarde." });
    }
    attempts.delete(instructor.id);
    res.set("Cache-Control", "no-store");
    return res.json({ success: true, message: "Tu contraseña se actualizó correctamente. Úsala la próxima vez que inicies sesión." });
  } catch {
    return res.status(503).json({ success: false, message: "No pudimos conectar con el servicio de cuentas. Vuelve a intentarlo." });
  } finally {
    // Revocar solo la sesión temporal usada para verificar la clave.
    if (client) {
      try { await client.auth.signOut({ scope: "local" }); } catch { /* No cambia el resultado del guardado. */ }
    }
  }
}
