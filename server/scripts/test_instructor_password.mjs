// Prueba el controlador real con Auth aislado; no consulta ni cambia cuentas reales.
import assert from "node:assert/strict";
import vm from "node:vm";
import { build } from "esbuild";

let clock = Date.now();
class TestDate extends Date { static now() { return clock; } }
let configured = true;
let mode = "normal";
const accounts = new Map();
const updates = [];
const logins = [];
const cleanups = [];
const fake = {
  configured: () => configured,
  clientFactory() {
    let identity;
    return { auth: {
      async signInWithPassword(credentials) {
        logins.push(credentials);
        if (mode === "offline") throw new Error("Network unavailable");
        if (mode === "rate") return { error: { status: 429 } };
        if (mode === "provider-failure") return { error: { status: 500 } };
        const account = accounts.get(credentials.email);
        if (!account || account.password !== credentials.password) return { error: { code: "invalid_credentials", status: 400 } };
        identity = account;
        return { data: { user: { id: mode === "wrong-id" ? "another-account" : account.id }, session: { access_token: "test-only" } } };
      },
      async updateUser(payload) {
        updates.push(payload);
        if (mode === "weak") return { error: { code: "weak_password", status: 422 } };
        assert(identity, "Debe verificar la identidad antes de actualizar");
        assert.equal(payload.current_password, identity.password);
        identity.password = payload.password;
        return { data: { user: { id: identity.id } } };
      },
      async signOut(options) {
        cleanups.push(options);
        assert.equal(options.scope, "local");
        if (mode === "cleanup-failure") throw new Error("Cleanup unavailable");
        return { error: null };
      }
    } };
  }
};
const result = await build({
  entryPoints: ["server/src/controllers/instructorAccount.controller.js"], bundle: true, platform: "node", format: "cjs", write: false,
  plugins: [{ name: "isolated-auth", setup(builder) {
    builder.onResolve({ filter: /db\/supabase\.js$/ }, () => ({ path: "auth-fixture", namespace: "fixture" }));
    builder.onLoad({ filter: /.*/, namespace: "fixture" }, () => ({ contents: "export const isSupabaseConfigured=globalThis.fixture.configured(); export const createSupabaseLoginClient=()=>globalThis.fixture.clientFactory();" }));
  } }]
});
const context = vm.createContext({ exports: {}, module: { exports: {} }, fixture: fake, Date: TestDate, TextEncoder, console });
vm.runInContext(result.outputFiles[0].text, context);
const { changeInstructorPassword } = context.module.exports;
let nextId = 0;
const user = (rol = "Instructor") => {
  const id = `isolated-${++nextId}`;
  const profile = { id, correo: `${id}@example.invalid`, rol, current_session_token: "histolab-session-preserved" };
  accounts.set(profile.correo, { id, password: "Clave actual segura" });
  return profile;
};
const call = async (instructor, body) => {
  let status = 200, payload;
  const headers = {};
  const res = { status(value) { status = value; return this; }, set(key, value) { headers[key] = value; return this; }, json(value) { payload = value; return this; } };
  await changeInstructorPassword({ instructor, body }, res);
  return { status, payload, headers };
};
const valid = { contrasena_actual: "Clave actual segura", nueva_contrasena: "Otra frase segura 2026" };
assert.equal((await call(null, valid)).status, 401);
const profile = user();
for (const body of [null, {}, { ...valid, contrasena_actual: [] }, { ...valid, nueva_contrasena: {} }, { ...valid, nueva_contrasena: "corta" }, { ...valid, nueva_contrasena: " ".repeat(8) }, { ...valid, nueva_contrasena: "x".repeat(129) }, { ...valid, nueva_contrasena: valid.contrasena_actual }]) {
  assert.equal((await call(profile, body)).status, 400);
}
assert.equal(logins.length, 0, "Rechazar datos inválidos antes de consultar Auth");
assert.equal((await call(profile, { ...valid, contrasena_actual: "incorrecta" })).status, 400);
assert.equal(updates.length, 0);
mode = "wrong-id";
assert.equal((await call(profile, valid)).status, 403);
assert.equal(updates.length, 0, "Una identidad diferente nunca se actualiza");
mode = "normal";
for (const role of ["Instructor", "Coordinador", "Creador"]) {
  const instructor = user(role);
  const snapshot = JSON.stringify(instructor);
  const response = await call(instructor, { ...valid, id: "victim", correo: "victim@example.invalid", rol: "Creador" });
  assert.equal(response.status, 200);
  assert.equal(response.payload.success, true);
  assert.equal(response.headers["Cache-Control"], "no-store");
  assert.equal(accounts.get(instructor.correo).password, valid.nueva_contrasena);
  assert.equal(JSON.stringify(instructor), snapshot, "Conserva perfil, rol y sesión de HistoLab");
  assert.equal((await call(instructor, valid)).status, 400, "La clave anterior deja de verificar");
  assert.equal((await call(instructor, { contrasena_actual: valid.nueva_contrasena, nueva_contrasena: "Una tercera frase segura" })).status, 200);
  assert(!JSON.stringify(response.payload).includes(valid.nueva_contrasena));
}
const spaced = user();
assert.equal((await call(spaced, { ...valid, nueva_contrasena: "  Frase con espacios  " })).status, 200);
assert.equal(accounts.get(spaced.correo).password, "  Frase con espacios  ", "No modifica silenciosamente la contraseña");
mode = "weak";
const weak = user();
assert.equal((await call(weak, valid)).status, 400);
assert.equal(accounts.get(weak.correo).password, valid.contrasena_actual);
mode = "provider-failure";
assert.equal((await call(user(), valid)).status, 503);
mode = "offline";
assert.equal((await call(user(), valid)).status, 503);
mode = "rate";
assert.equal((await call(user(), valid)).status, 429);
mode = "normal";
const limited = user();
for (let i = 0; i < 5; i++) assert.equal((await call(limited, { ...valid, contrasena_actual: "incorrecta" })).status, 400);
const count = logins.length;
const blocked = await call(limited, valid);
assert.equal(blocked.status, 429);
assert.equal(logins.length, count);
assert.equal(blocked.headers["Retry-After"], "300");
clock += 5 * 60 * 1000 + 1;
assert.equal((await call(limited, valid)).status, 200);
mode = "cleanup-failure";
assert.equal((await call(user(), valid)).payload.success, true, "El fallo de limpieza no oculta un guardado exitoso");
assert(cleanups.length > 0);
console.log("PASS: contraseña actual, identidad y cuenta propia, validaciones, tres roles, cambio efectivo, espacios, rechazo del proveedor, desconexión, límites de intentos y limpieza local sin alterar sesiones de HistoLab.");
