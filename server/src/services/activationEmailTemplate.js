import crypto from "node:crypto";

export function createActivationEmail(pin) {
  if (typeof pin !== "string" || !/^(?:\d{6}|\d{8})$/.test(pin)) throw new Error("INVALID_EMAIL_CODE");
  return {
    subject: "Tu codigo de verificacion de HistoLab",
    text: `Registro HistoLab · Laboratorio de Histología\n\nVerifica tu correo\n\nTu código para crear o restablecer tu contraseña es:\n\n${pin}\n\nIngresa este código en la pantalla de verificación de HistoLab.\nVence en 10 minutos y solo puedes utilizarlo una vez.\n\nNo compartas este código. El equipo de HistoLab nunca te lo pedirá.\nSi no solicitaste este correo, puedes ignorarlo. Tu contraseña no cambiará.\n\nRegistro HistoLab · UNAH\nEste es un mensaje automático.`,
    html: `<!doctype html>
<html lang="es"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Verifica tu correo · HistoLab</title></head>
<body style="margin:0;padding:0;background-color:#edf3f6;color:#173f55;font-family:Arial,Helvetica,sans-serif;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:#edf3f6;mso-hide:all;">Tu código de HistoLab vence en 10 minutos. Úsalo para verificar tu correo.</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#edf3f6;"><tr><td align="center" style="padding:28px 16px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;background-color:#ffffff;border:1px solid #d7e3e9;border-radius:16px;">
      <tr><td style="padding:28px 24px;background-color:#163d54;border-top:4px solid #d6b36b;border-radius:16px 16px 0 0;">
        <p style="margin:0 0 8px;color:#e7cf99;font-size:12px;font-weight:bold;letter-spacing:2px;">REGISTRO HISTOLAB</p>
        <p style="margin:0;color:#d3e4ea;font-size:13px;line-height:20px;">UNAH · Laboratorio de Histología</p>
      </td></tr>
      <tr><td style="padding:30px 24px 16px;">
        <h1 style="margin:0 0 16px;color:#163d54;font-size:26px;line-height:34px;">Verifica tu correo</h1>
        <p style="margin:0;color:#516979;font-size:15px;line-height:24px;">Usa el siguiente código para crear o restablecer tu contraseña en HistoLab.</p>
      </td></tr>
      <tr><td style="padding:8px 24px 24px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#edf7f8;border:1px solid #bbdadd;border-radius:12px;"><tr><td align="center" style="padding:22px 8px;">
          <p style="margin:0 0 12px;color:#49737a;font-size:11px;font-weight:bold;letter-spacing:1px;">TU CÓDIGO DE VERIFICACIÓN</p>
          <p style="margin:0;color:#096c73;font-family:'Courier New',Courier,monospace;font-size:30px;font-weight:bold;line-height:40px;letter-spacing:4px;white-space:nowrap;">${pin}</p>
          <p style="margin:12px 0 0;color:#49737a;font-size:13px;line-height:20px;">Válido durante <strong>10 minutos</strong> · Un solo uso</p>
        </td></tr></table>
      </td></tr>
      <tr><td style="padding:0 24px 28px;">
        <p style="margin:0 0 22px;color:#516979;font-size:14px;line-height:23px;">Vuelve a la pantalla de verificación de HistoLab e ingresa el código completo.</p>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td style="border-left:3px solid #d6b36b;padding:2px 0 2px 14px;">
          <p style="margin:0 0 6px;color:#173f55;font-size:13px;font-weight:bold;line-height:21px;">Cuida tu acceso</p>
          <p style="margin:0;color:#617482;font-size:13px;line-height:21px;">No compartas este código. El equipo de HistoLab nunca te lo pedirá.</p>
        </td></tr></table>
      </td></tr>
      <tr><td style="padding:20px 24px;background-color:#f7fafb;border-top:1px solid #e1eaef;border-radius:0 0 16px 16px;">
        <p style="margin:0;color:#687e8b;font-size:12px;line-height:20px;">Si no solicitaste este correo, puedes ignorarlo. Tu contraseña no cambiará.</p>
      </td></tr>
    </table>
    <p style="margin:20px 0 0;color:#7a909c;font-size:11px;line-height:18px;">Registro HistoLab · Mensaje automático</p>
  </td></tr></table>
</body></html>`
  };
}

export function buildActivationEmailMime(sender, email, pin) {
  if (typeof sender !== "string" || typeof email !== "string" || /[\r\n]/.test(sender + email)) throw new Error("INVALID_EMAIL_ADDRESS");
  const content = createActivationEmail(pin);
  const boundary = `histolab_${crypto.randomUUID()}`;
  const encode = value => Buffer.from(value, "utf8").toString("base64").match(/.{1,76}/g).join("\r\n");
  return [
    `From: Registro HistoLab <${sender}>`, `To: ${email}`, `Subject: ${content.subject}`,
    "MIME-Version: 1.0", `Content-Type: multipart/alternative; boundary="${boundary}"`, "",
    `--${boundary}`, "Content-Type: text/plain; charset=UTF-8", "Content-Transfer-Encoding: base64", "", encode(content.text),
    `--${boundary}`, "Content-Type: text/html; charset=UTF-8", "Content-Transfer-Encoding: base64", "", encode(content.html),
    `--${boundary}--`, ""
  ].join("\r\n");
}
