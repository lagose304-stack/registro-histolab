// PostgreSQL en memoria: no usa la base real ni modifica matrículas reales.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
const require = createRequire(path.resolve(process.env.HISTOLAB_PGLITE_DIR || ".", "package.json"));
const { PGlite } = require("@electric-sql/pglite");
const migration = await readFile(new URL("../../supabase/migrations/20261107222157_global_student_accounts.sql", import.meta.url), "utf8");
const careers = ["medicina","enfermeria","odontologia","microbiologia","nutricion"];
const id = n => `00000000-0000-4000-8000-${String(n).padStart(12,"0")}`;
async function setup(db) {
  await db.exec("CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;");
  for (const career of careers) await db.exec(`CREATE TABLE estudiantes_${career}(id uuid PRIMARY KEY,seccion_id uuid,numero_cuenta text NOT NULL,activo boolean DEFAULT true,notas jsonb DEFAULT '{}',UNIQUE(seccion_id,numero_cuenta)); GRANT SELECT,INSERT,UPDATE,DELETE ON estudiantes_${career} TO service_role;`);
}
const db = new PGlite();
try {
  await setup(db);
  await db.query("INSERT INTO estudiantes_medicina(id,seccion_id,numero_cuenta,notas) VALUES ($1,$2,'001','{\"manual_demo\":0.875}')", [id(1),id(11)]);
  await db.exec(migration); await db.exec(migration);
  assert.equal((await db.query("SELECT count(*)::int n FROM histolab_private.student_enrollments")).rows[0].n, 1);
  for (const career of careers) await assert.rejects(db.query(`INSERT INTO estudiantes_${career}(id,seccion_id,numero_cuenta) VALUES ($1,$2,'001')`, [id(2),id(12)]), { code: "23505" });
  await assert.rejects(db.query("INSERT INTO estudiantes_nutricion(id,numero_cuenta) VALUES ($1,' 001 ')", [id(3)]), { code: "23505" });
  await assert.rejects(db.query("INSERT INTO estudiantes_nutricion(id,numero_cuenta) VALUES ($1,' ')", [id(3)]), { code: "23514" });
  await db.query("INSERT INTO estudiantes_enfermeria(id,numero_cuenta) VALUES ($1,'002')", [id(4)]);
  await assert.rejects(db.exec("UPDATE estudiantes_enfermeria SET numero_cuenta='001' WHERE numero_cuenta='002'"), { code: "23505" });
  assert.equal((await db.query("SELECT numero_cuenta FROM estudiantes_enfermeria")).rows[0].numero_cuenta,"002");
  assert.equal((await db.query("SELECT count(*)::int n FROM histolab_private.student_enrollments WHERE numero_cuenta='002'")).rows[0].n,1,"El rechazo no pierde la reserva anterior");
  await db.query("INSERT INTO estudiantes_odontologia(id,numero_cuenta,activo) VALUES ($1,'001',false)",[id(5)]);
  await assert.rejects(db.exec("UPDATE estudiantes_odontologia SET activo=true"),{code:"23505"});
  await db.exec("UPDATE estudiantes_medicina SET activo=false WHERE numero_cuenta='001'");
  await db.exec("UPDATE estudiantes_odontologia SET activo=true");
  await db.exec("DELETE FROM estudiantes_odontologia");
  await db.query("INSERT INTO estudiantes_microbiologia(id,numero_cuenta) VALUES ($1,'001')",[id(6)]);
  assert.equal((await db.query("SELECT notas FROM estudiantes_medicina")).rows[0].notas.manual_demo,.875,"Conserva historial y notas");
  await db.exec("SET ROLE service_role;");
  await db.query("INSERT INTO estudiantes_nutricion(id,numero_cuenta) VALUES ($1,'003')",[id(7)]);
  await assert.rejects(db.exec("DELETE FROM histolab_private.student_enrollments"),{code:"42501"});
  await db.exec("RESET ROLE;");
  const attempts = await Promise.allSettled([
    db.query("INSERT INTO estudiantes_medicina(id,numero_cuenta) VALUES ($1,'CONCURRENT')",[id(8)]),
    db.query("INSERT INTO estudiantes_nutricion(id,numero_cuenta) VALUES ($1,'CONCURRENT')",[id(9)])
  ]);
  assert.equal(attempts.filter(r=>r.status==="fulfilled").length,1);
  assert.equal((await db.query("SELECT count(*)::int n FROM pg_trigger WHERE tgname='enforce_global_student_account'")).rows[0].n,5);
  for (const role of ["anon","authenticated"]) {
    assert.equal((await db.query("SELECT has_schema_privilege($1,'histolab_private','USAGE') allowed",[role])).rows[0].allowed,false);
    assert.equal((await db.query("SELECT has_function_privilege($1,'histolab_private.enforce_student_enrollment()','EXECUTE') allowed",[role])).rows[0].allowed,false);
  }
  console.log("PASS SQL: reserva global en cinco carreras, altas/ediciones/reactivaciones, espacios, reintentos simultáneos, rollback, bajas, historial conservado y registro privado.");
} finally { await db.close(); }
const legacy = new PGlite();
try {
  await setup(legacy);
  await legacy.query("INSERT INTO estudiantes_medicina(id,numero_cuenta) VALUES ($1,'DUP')",[id(1)]);
  await legacy.query("INSERT INTO estudiantes_nutricion(id,numero_cuenta) VALUES ($1,'DUP')",[id(2)]);
  await assert.rejects(legacy.exec(migration)); await legacy.exec("ROLLBACK;");
  assert.equal((await legacy.query("SELECT count(*)::int n FROM estudiantes_medicina")).rows[0].n,1);
  assert.equal((await legacy.query("SELECT count(*)::int n FROM estudiantes_nutricion")).rows[0].n,1);
  console.log("PASS SQL: si existen duplicados previos, la instalación se detiene sin borrar ni desactivar estudiantes.");
} finally { await legacy.close(); }
