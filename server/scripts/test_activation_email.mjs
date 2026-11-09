import assert from "node:assert/strict";
import { createActivationEmail, buildActivationEmailMime } from "../src/services/activationEmailTemplate.js";

for (const pin of ["001234", "00123456"]) {
  const template = createActivationEmail(pin);
  assert(template.text.includes(`\n\n${pin}\n\n`));
  assert(template.html.includes(`>${pin}</p>`));
  assert(template.html.includes('lang="es"'));
  assert(!/<script|<img|https?:\/\//i.test(template.html), "Sin scripts ni recursos externos");
  assert(template.text.includes("10 minutos") && template.html.includes("10 minutos"));
  const mime = buildActivationEmailMime("sender@example.invalid", "recipient@example.invalid", pin);
  const boundary = mime.match(/boundary="([^"]+)"/)[1];
  const parts = mime.split(`--${boundary}`).filter(part => part.includes("Content-Transfer-Encoding: base64"));
  assert.equal(parts.length, 2);
  for (const [index, type] of ["text/plain", "text/html"].entries()) {
    assert(parts[index].includes(`Content-Type: ${type}; charset=UTF-8`));
    const body = parts[index].split("\r\n\r\n")[1].trim();
    assert(body.split("\r\n").every(line => line.length <= 76), "Base64 cumple límites MIME");
    assert.equal(Buffer.from(body, "base64").toString("utf8"), index === 0 ? template.text : template.html);
  }
  assert(mime.endsWith(`--${boundary}--\r\n`));
}
for (const pin of ["12345", "1234567", "123456789", "<script>", "123456\r\nBcc: extra@example.invalid", 123456, null]) {
  assert.throws(() => createActivationEmail(pin), /INVALID_EMAIL_CODE/);
}
assert.throws(() => buildActivationEmailMime("sender@example.invalid\r\nBcc: extra@example.invalid", "recipient@example.invalid", "00123456"), /INVALID_EMAIL_ADDRESS/);
assert.throws(() => buildActivationEmailMime("sender@example.invalid", "recipient@example.invalid\nBcc: extra@example.invalid", "00123456"), /INVALID_EMAIL_ADDRESS/);
console.log("PASS correo: MIME HTML/texto, UTF-8, códigos completos de 6/8 cifras con ceros iniciales, sin recursos externos e inyección de encabezados rechazada.");
