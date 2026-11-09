let cachedToken = null;
let refreshing = null;
export function gmailReady() {
  return Boolean(process.env.GMAIL_SENDER && process.env.GMAIL_CLIENT_ID && process.env.GMAIL_CLIENT_SECRET && process.env.GMAIL_REFRESH_TOKEN);
}
async function accessToken() {
  if (cachedToken?.expires > Date.now() + 60_000) return cachedToken.value;
  if (refreshing) return refreshing;
  refreshing = (async () => {
    const response = await fetch("https://oauth2.googleapis.com/token", { method: "POST", signal: AbortSignal.timeout(10_000),
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ grant_type: "refresh_token", client_id: process.env.GMAIL_CLIENT_ID, client_secret: process.env.GMAIL_CLIENT_SECRET, refresh_token: process.env.GMAIL_REFRESH_TOKEN }) });
    const data = await response.json();
    if (!response.ok || !data.access_token) throw new Error("GMAIL_AUTH_UNAVAILABLE");
    cachedToken = { value: data.access_token, expires: Date.now() + Number(data.expires_in || 3600) * 1000 };
    return cachedToken.value;
  })();
  try { return await refreshing; } finally { refreshing = null; }
}
export async function sendActivationEmail(email, pin) {
  if (!gmailReady() || !/^\d{6}$/.test(pin) || /[\r\n]/.test(email) || /[\r\n]/.test(process.env.GMAIL_SENDER)) throw new Error("EMAIL_UNAVAILABLE");
  const body = `Tu código para crear o restablecer tu contraseña de Registro HistoLab es:\n\n${pin}\n\nVence en 10 minutos y solo puedes utilizarlo una vez.\nNo compartas este código. Si no lo solicitaste, ignora este correo.\n\nRegistro HistoLab`;
  const mime = [`From: Registro HistoLab <${process.env.GMAIL_SENDER}>`,`To: ${email}`,"Subject: Codigo de verificacion de Registro HistoLab","MIME-Version: 1.0","Content-Type: text/plain; charset=UTF-8","Content-Transfer-Encoding: base64","",Buffer.from(body).toString("base64")].join("\r\n");
  const response = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", { method: "POST", signal: AbortSignal.timeout(15_000),
    headers: { Authorization: `Bearer ${await accessToken()}`, "Content-Type": "application/json" }, body: JSON.stringify({ raw: Buffer.from(mime).toString("base64url") }) });
  if (!response.ok) throw new Error("EMAIL_DELIVERY_UNAVAILABLE");
  const data = await response.json();
  if (!data.id) throw new Error("EMAIL_DELIVERY_UNAVAILABLE");
}
