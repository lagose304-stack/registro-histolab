export const ACTIVATION_REQUEST_WAIT_SECONDS = 600;

// La clave única y el UPDATE condicionado hacen que solo gane una solicitud,
// incluso entre distintas instancias del servidor.
export async function reserveActivationRequest(db, emailHash, now = Date.now()) {
  const key = `email-cooldown:${emailHash}`;
  const expires_at = new Date(now + ACTIVATION_REQUEST_WAIT_SECONDS * 1000).toISOString();
  const updated = await db.from("account_activation_limits")
    .update({ count: 1, expires_at }).eq("key", key)
    .lte("expires_at", new Date(now).toISOString()).select("key");
  if (updated.error) throw updated.error;
  if (updated.data?.length) return { allowed: true };

  const inserted = await db.from("account_activation_limits").insert({ key, count: 1, expires_at });
  if (!inserted.error) return { allowed: true };
  if (inserted.error.code !== "23505") throw inserted.error;

  const existing = await db.from("account_activation_limits").select("expires_at").eq("key", key).maybeSingle();
  if (existing.error) throw existing.error;
  if (!existing.data) throw new Error("ACTIVATION_STORAGE_UNAVAILABLE");
  return { allowed: false, retry_after: Math.max(1, Math.ceil((Date.parse(existing.data.expires_at) - now) / 1000)) };
}
