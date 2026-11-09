// Login y sesión reales con base de datos aislada, sin cuentas ni escrituras reales.
import assert from "node:assert/strict";
import vm from "node:vm";
import path from "node:path";
import { createRequire } from "node:module";
import { build } from "esbuild";
const require = createRequire(new URL("../package.json", import.meta.url));
const jwt = require("jsonwebtoken");
const secret = "isolated-student-auth-secret";
const careers = ["Medicina", "Enfermeria", "Odontologia", "Microbiologia", "Nutricion"];
const tables = Object.fromEntries(careers.map(career => [`estudiantes_${career.toLowerCase()}`, [{ id: career, numero_cuenta: "DEMO", activo: true, nombre_completo: "Estudiante de prueba", seccion_id: "section", auth_user_id:'auth-'+career,correo:career.toLowerCase()+'@example.invalid',activation_required:false,activation_completed_at:'2026-11-08T00:00:00Z', current_session_token: "previous", notas: {}, asistencias: {} }]]));
tables.secciones = [{ id: "section", codigo: "DEMO", carrera: "Medicina" }];
let mode = "normal";
const nativeAccounts=new Map();
for(const career of careers)nativeAccounts.set(career.toLowerCase()+'@example.invalid',{id:'auth-'+career,password:'Clave propia'});
const nativeClient=()=>{let account;return {auth:{async signInWithPassword({email,password}){account=nativeAccounts.get(email);return account?.password===password?{data:{user:{id:account.id}}}:{error:{code:"invalid_credentials"}};},async updateUser({password,current_password}){assert.equal(account.password,current_password);account.password=password;return {data:{user:{id:account.id}}};},async signOut({scope}){assert.equal(scope,"local");}}};};
const database = { from(table) {
  let updates, single = false;
  const filters = [];
  const query = {
    select() { return query; }, eq(key, value) { filters.push(row => row[key] === value); return query; },
    in(key, values) { filters.push(row => values.includes(row[key])); return query; },
    update(value) { updates = value; return query; }, maybeSingle() { single = true; return query; },
    then(resolve, reject) { return Promise.resolve().then(() => {
      if (mode === "throw-read" && !updates && table.startsWith("estudiantes")) throw Error("Database unavailable");
      if ((mode === "read-error" && !updates || mode === "write-error" && updates) && table.startsWith("estudiantes")) return { data: null, error: { code: "test-failure" } };
      if (mode === "throw-write" && updates) throw Error("Database unavailable");
      const rows = (tables[table] || []).filter(row => filters.every(filter => filter(row)));
      if (updates && mode === "zero-write") return { data: null, error: null };
      if (updates) rows.forEach(row => Object.assign(row, updates));
      return { data: structuredClone(single ? rows[0] || null : rows), error: null };
    }).then(resolve, reject); },
    catch(reject) { return query.then(value => value, reject); }
  };
  return query;
} };
const bundle = await build({ stdin: { contents: 'export {loginStudent,logoutStudent,changeStudentPassword} from "./server/src/controllers/auth.controller.js"; export {authenticateStudent} from "./server/src/middlewares/auth.middleware.js";', resolveDir: path.resolve(".") }, bundle: true, platform: "node", format: "cjs", external: ["jsonwebtoken"], write: false,
  plugins: [{ name: "isolated-student-auth", setup(b) {
    b.onResolve({ filter: /db\/supabase\.js$/ }, () => ({ path: "db", namespace: "fixture" }));
    b.onResolve({ filter: /^dotenv$/ }, () => ({ path: "env", namespace: "fixture" }));
    b.onLoad({ filter: /.*/, namespace: "fixture" }, ({ path }) => ({ contents: path === "env" ? "export default {config(){}};" : "export const isSupabaseConfigured=true,supabase=globalThis.database; export const createSupabaseLoginClient=globalThis.nativeClient;" }));
  } }]
});
const module = { exports: {} };
vm.runInNewContext(bundle.outputFiles[0].text, { module, exports: module.exports, require, console, database, nativeClient,TextEncoder, process: { env: { JWT_SECRET: secret } } });
const api = module.exports;
async function call(handler, req) { let status = 200, data, accepted = false; await handler(req, { set(){return this;}, status(value) { status = value; return this; }, json(value) { data = value; return this; } }, () => accepted = true); return { status, data, accepted, req }; }
const login = (career = "Medicina", password = "Clave propia", section) => call(api.loginStudent, { body: { carrera: career, numero_cuenta: "DEMO", contrasena: password, seccion_id: section } });
const auth = token => call(api.authenticateStudent, { headers: { authorization: `Bearer ${token}` } });
for (const career of careers) {
  const first = await login(career); assert.equal(first.status, 200);
  assert((await auth(first.data.token)).accepted);
  const firstRequest = (await auth(first.data.token)).req;
  const second = await login(career); assert.equal(second.status, 200);
  assert.equal((await auth(first.data.token)).data.reason, "CONCURRENT_SESSION_DETECTED");
  assert((await auth(second.data.token)).accepted);
  await call(api.logoutStudent, firstRequest);
  assert((await auth(second.data.token)).accepted, "Un cierre atrasado no borra la sesión nueva");
  assert.equal(jwt.verify(second.data.token, secret).rol, "ESTUDIANTE");
  assert(!JSON.stringify(second.data).includes("Clave propia"));
}
assert.equal((await login("Medicina", "histolab123")).status, 401, "La contraseña inicial deja de funcionar cuando existe una propia");
assert.equal((await call(api.changeStudentPassword, { student: { ...tables.estudiantes_medicina[0], carrera: "Medicina" }, body: { carrera: "Medicina", numero_cuenta: "DEMO", contrasena_actual: "histolab123", nueva_contrasena: "No debe guardar" } })).status, 400);
tables.estudiantes_medicina[0].contrasena = null;
assert.equal((await login("Medicina", "histolab123")).status, 401, "No permite una clave compartida cuando no hay contraseña configurada");
tables.estudiantes_medicina[0].contrasena = "Clave propia";
const enrolled=tables.estudiantes_medicina[0];
const authId=enrolled.auth_user_id;delete enrolled.auth_user_id;
assert.equal((await login()).status,403,'Nunca utiliza una contraseña histórica aunque coincida');
enrolled.auth_user_id=authId;
const previous = await login();
const persisted = tables.estudiantes_medicina[0].current_session_token;
for (mode of ["write-error", "zero-write", "throw-write", "read-error", "throw-read"]) {
  const response = await login(); assert.equal(response.status, 503);
  assert(!response.data.token); assert.equal(tables.estudiantes_medicina[0].current_session_token, persisted);
}
mode = "read-error";
assert.equal((await auth(previous.data.token)).status, 503, "Un fallo temporal no anuncia sesión revocada");
mode = "normal";
assert((await auth(previous.data.token)).accepted);
tables.estudiantes_medicina.push({ ...tables.estudiantes_medicina[0], id: "second-enrollment", seccion_id: "section-2", notas: { prueba_1: 4 }, current_session_token: null });
tables.secciones.push({ id: "section-2", codigo: "DEMO-2", carrera: "Medicina" });
const duplicate = await login();
assert.equal(duplicate.status, 409);
assert.equal(duplicate.data.reason, "SECTION_SELECTION_REQUIRED");
assert.equal(duplicate.data.sections.length, 2);
assert(!JSON.stringify(duplicate.data).includes("Clave propia"));
assert.equal((await login("Medicina", "incorrecta")).status, 401);
assert.equal((await login("Medicina", "incorrecta")).data.sections, undefined);
const selected = await login("Medicina", "Clave propia", "section-2");
assert.equal(selected.status, 200);
assert.equal(selected.data.estudiante.seccion_id, "section-2");
assert.equal((await auth(selected.data.token)).req.student.id, "second-enrollment");
assert((await auth(previous.data.token)).accepted, "Identifica la matrícula por ID sin confundir secciones");
const selectedRequest = (await auth(selected.data.token)).req;
assert.equal((await call(api.changeStudentPassword, { student: selectedRequest.student, body: { carrera: "Medicina", numero_cuenta: "DEMO", contrasena_actual: "Clave propia", nueva_contrasena: "Nueva clave" } })).status, 400);
assert.equal(tables.estudiantes_medicina[0].contrasena, "Clave propia");
assert.equal(tables.estudiantes_medicina[1].contrasena, "Clave propia");
const activated=tables.estudiantes_medicina[1];
Object.assign(activated,{contrasena:null,correo:"student@example.invalid",auth_user_id:"native-student",activation_required:false,activation_completed_at:new Date().toISOString()});
nativeAccounts.set(activated.correo,{id:activated.auth_user_id,password:"  Contraseña propia segura  "});
const nativeLogin=await login("Medicina","  Contraseña propia segura  ","section-2");assert.equal(nativeLogin.status,200);assert((await auth(nativeLogin.data.token)).accepted);
assert.equal((await login("Medicina","histolab123","section-2")).status,401);
const nativeRequest=(await auth(nativeLogin.data.token)).req;
assert.equal((await call(api.changeStudentPassword,{student:nativeRequest.student,body:{carrera:"Medicina",numero_cuenta:"DEMO",contrasena_actual:"  Contraseña propia segura  ",nueva_contrasena:"Otra contraseña fuerte personal"}})).status,200);
assert.equal(nativeAccounts.get(activated.correo).password,"Otra contraseña fuerte personal");assert.equal(activated.contrasena,null,"La contraseña nueva no se guarda en la matrícula");
activated.activation_required=true;assert.equal((await auth(nativeLogin.data.token)).status,403);assert.equal((await login("Medicina","Otra contraseña fuerte personal","section-2")).status,403);
console.log("PASS: entrada en cinco carreras, sesión persistida, reemplazo y cierre atrasado, primer ingreso y clave propia, fallos de base de datos sin sesiones falsas ni expulsiones incorrectas.");
console.log("PASS: cuenta repetida en dos secciones, elección tras verificar clave, JWT y cambio de contraseña limitados a la matrícula elegida.");
console.log("PASS: estudiantes activados usan Auth para ingresar y cambiar contraseña, conservan espacios y bloquean sesiones pendientes sin guardar claves en la ficha.");
