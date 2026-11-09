// Rutas y permisos reales con identidades y persistencia aisladas; no guarda notas.
import assert from "node:assert/strict";
import vm from "node:vm";
import { createRequire } from "node:module";
import { build } from "esbuild";

const require = createRequire(new URL("../package.json", import.meta.url));
const jwt = require("jsonwebtoken");
const secret = "isolated-migration-access-secret";
const users = new Map(["Creador", "Coordinador", "Instructor"].map(rol => [rol, { id: rol, rol, activo: true }]));
let saves = 0;
const bundle = await build({
  entryPoints: ["server/src/routes/estudiantes.routes.js"], bundle: true, platform: "node", format: "cjs", write: false,
  external: ["express", "jsonwebtoken"],
  plugins: [{ name: "isolated-migration", setup(b) {
    b.onResolve({ filter: /controllers\/(estudiantes|auth|manualsSchedule)\.controller\.js$/ }, args => ({ path: args.path.split("/").at(-1), namespace: "fixture" }));
    b.onResolve({ filter: /db\/supabase\.js$/ }, () => ({ path: "database", namespace: "fixture" }));
    b.onResolve({ filter: /^dotenv$/ }, () => ({ path: "dotenv", namespace: "fixture" }));
    b.onLoad({ filter: /.*/, namespace: "fixture" }, ({ path }) => ({ contents:
      path === "dotenv" ? "export default {config(){}};" :
      path === "database" ? "export const isSupabaseConfigured=true; export const supabase=globalThis.database;" :
      path === "auth.controller.js" ? "export const getInstructorByIdOrEmail=async id=>globalThis.users.get(id); export const getStudentByCuentaAndCarrera=async()=>null; export const getStudentSession=async()=>null;" :
      path === "manualsSchedule.controller.js" ? "export const listManualDates=(req,res)=>res.json({}); export const saveManualDate=listManualDates;" :
      "export const updateBatchGrades=(req,res)=>{globalThis.saved();res.json({success:true})}; export const getEstudiantesBySeccion=updateBatchGrades,getEstudianteByCuenta=updateBatchGrades,createEstudiante=updateBatchGrades,updateEstudiante=updateBatchGrades,saveWeeklyAttendance=updateBatchGrades,saveWeeklyManuals=updateBatchGrades,deleteEstudiante=updateBatchGrades;"
    }));
  } }]
});
const module = { exports: {} };
const database = { from() { const query = { select() { return query; }, eq() { return query; }, gt() { return query; }, async maybeSingle() { return { data: { session_id: "test-session" } }; } }; return query; } };
vm.runInNewContext(bundle.outputFiles[0].text, { module, exports: module.exports, require, console, users, database, saved: () => saves++, process: { env: { JWT_SECRET: secret } } });
const router = module.exports.default;
const route = router.stack.find(layer => layer.route?.path === "/seccion/:seccion_id/migracion").route;
assert.equal(route.methods.put, true);
assert.equal(route.stack.length, 3, "Autentica y exige Creador antes de guardar");
for (const path of ["/seccion/:seccion_id/batch", "/batch/:seccion_id"]) {
  for (const layer of router.stack.filter(layer => layer.route?.path === path)) {
    assert.equal(layer.route.stack.length, 3, "Las cargas ordinarias autentican y verifican acceso a la sección");
    assert.equal(layer.route.stack[0].handle.name, "authenticateInstructor");
  }
}

async function call(role, declaredRole = "Creador") {
  let status = 200, payload;
  const req = { params: { seccion_id: "isolated-section" }, body: { rol: declaredRole, updates: [] }, headers: {} };
  if (role) req.headers.authorization = `Bearer ${jwt.sign({ id: role, rol: role, session_id: "test-session" }, secret)}`;
  const res = { status(value) { status = value; return this; }, json(value) { payload = value; return this; } };
  for (const layer of route.stack) {
    let next = false;
    await layer.handle(req, res, () => { next = true; });
    if (!next) break;
  }
  return { status, payload };
}
assert.equal((await call(null)).status, 401);
for (const role of ["Coordinador", "Instructor", "ESTUDIANTE"]) assert.equal((await call(role)).status, 403);
assert.equal(saves, 0, "No guarda para otros perfiles ni acepta el rol declarado en el cuerpo");
assert.equal((await call("Creador")).status, 200);
assert.equal(saves, 1);
assert(router.stack.some(layer => layer.route?.path === "/seccion/:seccion_id/batch"), "Conserva las cargas ordinarias");
console.log("PASS: migración exclusiva del Creador, sesión obligatoria, rechazo de otros perfiles y de rol falsificado sin escrituras reales.");
