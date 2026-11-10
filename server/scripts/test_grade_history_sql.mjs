import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";

const db = new PGlite();
const source = path => readFile(new URL(path, import.meta.url), "utf8");
try {
  await db.exec("CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS");
  await db.exec(await source("../src/db/schema.sql"));
  await db.exec(await source("../../supabase/migrations/20261109022000_grade_history.sql"));
  await db.exec(await source("../../supabase/migrations/20261109023000_grade_history_instructor_name.sql"));
  await db.exec(await source("../src/db/student_makeups_migration.sql"));
  await db.exec(await source("../src/db/student_makeup_attendance_migration.sql"));
  await db.exec(await source("../../supabase/migrations/20261109024000_grade_history_quiz_integrity.sql"));
  await db.exec(`
    GRANT SELECT ON instructores, temario, configuracion_semanas TO service_role;
    GRANT SELECT, INSERT, UPDATE ON estudiantes_medicina TO service_role;
    GRANT SELECT, UPDATE ON estudiantes_medicina TO authenticated;
    INSERT INTO instructores (id, numero_empleado, nombre_completo, correo, contrasena)
    VALUES ('00000000-0000-0000-0000-000000000001', 'DOC', 'Docente Ejemplo', 'doc@example.invalid', 'unused');
    INSERT INTO secciones (id, codigo, dia, hora_inicio, hora_fin, periodo_academico, coordinador)
    VALUES ('00000000-0000-0000-0000-000000000002', '001', 'Lunes', '09:00', '10:00', 'Test', 'Docente Ejemplo');
    INSERT INTO temario (id, titulo, numero_tema)
    VALUES ('00000000-0000-0000-0000-000000000003', 'Tejidos', 1);
    INSERT INTO configuracion_semanas (numero_semana, parcial, es_examen) VALUES (3, 'I', true);
    INSERT INTO estudiantes_medicina (seccion_id, numero_cuenta, nombre_completo, notas)
    VALUES ('00000000-0000-0000-0000-000000000002', 'A', 'Estudiante Ejemplo', '{"examencito_1":2,"Manual de Tejidos":0.5}');
    ALTER TABLE instructores ADD COLUMN primer_nombre text, ADD COLUMN segundo_nombre text,
      ADD COLUMN primer_apellido text, ADD COLUMN segundo_apellido text;
    UPDATE instructores SET primer_nombre = ' Docente ', segundo_nombre = '', primer_apellido = 'Ejemplo';
    ALTER TABLE instructores DROP COLUMN nombre_completo;
    SET ROLE service_role;
    SET request.headers TO '{"x-histolab-grade-actor":"00000000-0000-0000-0000-000000000001"}';
    UPDATE estudiantes_medicina SET notas = '{"prueba_1":2,"manual_00000000-0000-0000-0000-000000000003":0.5}';
    UPDATE estudiantes_medicina SET notas = notas || '{"examen_semana_3":"0","examen_I":0,"primer_examen":0,"prueba_1":3}';
    UPDATE estudiantes_medicina SET notas = notas - ARRAY['examen_semana_3','examen_I','primer_examen','manual_00000000-0000-0000-0000-000000000003'];
    UPDATE estudiantes_medicina SET total = 99, notas = notas || '{"prueba_1_real":6}';
    INSERT INTO estudiantes_medicina (seccion_id, numero_cuenta, nombre_completo)
    VALUES ('00000000-0000-0000-0000-000000000002', 'NEW', 'Matrícula sin notas');
  `);
  const { rows } = await db.query("SELECT evaluacion, anterior, nueva, instructor_nombre, numero_cuenta FROM historial_notas ORDER BY id");
  assert.equal(rows.length, 4);
  assert.equal((await db.query("SELECT count(*) FROM estudiantes_medicina WHERE numero_cuenta = 'NEW'")).rows[0].count, 1);
  for (const row of rows) {
    assert.equal(row.instructor_nombre, "Docente Ejemplo");
    assert.equal(row.numero_cuenta, "A");
  }
  assert.deepEqual(rows.filter(row => row.evaluacion === "examen_semana_3").map(row => [row.anterior, row.nueva]),
    [[null, "0"], ["0", null]]);
  assert.ok(rows.some(row => row.evaluacion === "prueba_1" && row.anterior === "2" && row.nueva === "3"));
  assert.ok(rows.some(row => row.evaluacion.startsWith("manual_") && row.anterior === "0.5" && row.nueva === null));

  await db.exec("BEGIN; UPDATE estudiantes_medicina SET notas = '{}'; ROLLBACK");
  assert.equal((await db.query("SELECT count(*) FROM historial_notas")).rows[0].count, 4);
  await db.exec("RESET request.headers; UPDATE estudiantes_medicina SET notas = '{}'");
  assert.equal((await db.query("SELECT count(*) FROM historial_notas")).rows[0].count, 4);
  await db.exec("RESET ROLE; SET ROLE authenticated");
  await assert.rejects(db.query("SELECT * FROM historial_notas"), { code: "42501" });
  await db.exec(`
    RESET ROLE;
    GRANT SELECT ON secciones TO service_role;
    GRANT SELECT, INSERT, UPDATE, DELETE ON entregas_pruebas TO service_role;
    INSERT INTO temario (id, titulo, numero_tema)
    VALUES ('00000000-0000-0000-0000-000000000004', 'Epitelio', 1);
    INSERT INTO secciones (id, codigo, dia, hora_inicio, hora_fin, periodo_academico, coordinador)
    VALUES ('00000000-0000-0000-0000-000000000005', '002', 'Martes', '09:00', '10:00', 'Test', 'Docente Ejemplo');
    UPDATE estudiantes_medicina SET notas = '{"manual_tema_1":0.5,"prueba_1":2,"prueba_1_real":3}' WHERE numero_cuenta = 'A';
    INSERT INTO estudiantes_medicina (seccion_id, numero_cuenta, nombre_completo, notas)
    VALUES ('00000000-0000-0000-0000-000000000005', 'A', 'Otro registro', '{"prueba_1":5}');
    INSERT INTO entregas_pruebas (id, seccion_id, numero_semana, numero_cuenta, estado, nota_obtenida, updated_at)
    VALUES ('00000000-0000-0000-0000-000000000006','00000000-0000-0000-0000-000000000002',1,'A','calificado',2,'2026-11-09T09:00:00Z');
    CREATE FUNCTION fail_audit_for_test() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN RAISE EXCEPTION 'Fallo simulado del historial'; END;
    $$;
    CREATE TRIGGER fail_audit_for_test BEFORE INSERT ON historial_notas FOR EACH ROW EXECUTE FUNCTION fail_audit_for_test();
    SET ROLE service_role;
    SET request.headers TO '{"x-histolab-grade-actor":"00000000-0000-0000-0000-000000000001"}';
  `);
  const section = "00000000-0000-0000-0000-000000000002";
  const destination = "00000000-0000-0000-0000-000000000005";
  const delivery = "00000000-0000-0000-0000-000000000006";
  const deletion = () => db.query("SELECT delete_quiz_submission_with_grade($1,1,'A',$2) AS id", [section, delivery]);
  const notes = async target => (await db.query("SELECT notas FROM estudiantes_medicina WHERE seccion_id=$1 AND numero_cuenta='A'", [target])).rows[0].notas;
  await assert.rejects(deletion(), /Fallo simulado del historial/);
  assert.equal((await notes(section)).prueba_1, 2);
  assert.equal((await db.query("SELECT id FROM entregas_pruebas WHERE id=$1", [delivery])).rows.length, 1);
  await db.exec("RESET ROLE; DROP TRIGGER fail_audit_for_test ON historial_notas; SET ROLE service_role");
  const validVersion = "2026-11-09T09:00:00Z";
  const staleVersion = "2026-11-09T08:00:00Z";
  const sync = async version => (await db.query("SELECT sync_quiz_student_grade($1,$2,$3,'A','estudiantes_medicina',$4,$5) AS ok",
    [delivery, version, section, JSON.stringify(await notes(section)), '{"prueba_1":4,"prueba_1_real":5,"manual_00000000-0000-0000-0000-000000000003":0.8}'])).rows[0].ok;
  assert.equal(await sync(staleVersion), false);
  assert.equal(await sync(validVersion), true);
  const manual = (await db.query("SELECT etiqueta, anterior, nueva FROM historial_notas WHERE etiqueta LIKE 'Manual%' ORDER BY id DESC LIMIT 1")).rows[0];
  assert.deepEqual(manual, { etiqueta: "Manual · Tejidos", anterior: null, nueva: "0.8" });
  assert.equal((await db.query("SELECT count(*) FROM historial_notas WHERE etiqueta='Manual · Epitelio'")).rows[0].count, 0);
  assert.equal((await deletion()).rows[0].id, delivery);
  assert.equal((await notes(section)).prueba_1, undefined);
  assert.equal((await notes(section)).prueba_1_real, undefined);
  assert.equal((await notes(destination)).prueba_1, 5);
  assert.equal(await sync(validVersion), false);
  assert.equal((await deletion()).rows[0].id, null);
  assert.equal((await db.query("SELECT nueva FROM historial_notas WHERE seccion_id=$1 AND evaluacion='prueba_1' ORDER BY id DESC LIMIT 1", [section])).rows[0].nueva, null);

  const makeup = "00000000-0000-0000-0000-000000000007";
  const makeupDelivery = "00000000-0000-0000-0000-000000000008";
  await db.exec(`
    RESET ROLE;
    INSERT INTO reposiciones_estudiantes (id,seccion_origen_id,seccion_destino_id,carrera,numero_cuenta,nombre_estudiante,numero_semana,origen_codigo,destino_codigo,motivo,estado,practica_at,solicitado_por,manual_ids)
    VALUES ('${makeup}','${section}','${destination}','MEDICINA','A','Ejemplo',2,'001','002','Prueba aislada','asignada',now()-interval '1 day','00000000-0000-0000-0000-000000000001',ARRAY['manual_00000000-0000-0000-0000-000000000003']);
    INSERT INTO entregas_pruebas (id,seccion_id,numero_semana,numero_cuenta,estado,nota_obtenida,updated_at)
    VALUES ('${makeupDelivery}','${destination}',2,'A','calificado',4,'${validVersion}');
    SET ROLE service_role;
  `);
  await db.query("SELECT apply_student_makeup($1,$2,true)", [makeup, '{"manual_00000000-0000-0000-0000-000000000003":0.8}']);
  assert.equal((await db.query("SELECT sync_quiz_makeup_grade($1,$2,$3) AS ok", [makeup, makeupDelivery, staleVersion])).rows[0].ok, false);
  assert.equal((await db.query("SELECT sync_quiz_makeup_grade($1,$2,$3) AS ok", [makeup, makeupDelivery, validVersion])).rows[0].ok, true);
  assert.equal((await notes(section)).prueba_2, 4);
  assert.equal((await db.query("SELECT delete_quiz_submission_with_grade($1,2,'A',$2) AS id", [destination, makeupDelivery])).rows[0].id, makeupDelivery);
  const reset = (await db.query("SELECT estado, asistio, prueba_entrega_id, notas_aplicadas FROM reposiciones_estudiantes WHERE id=$1", [makeup])).rows[0];
  assert.deepEqual(reset, { estado: "asignada", asistio: true, prueba_entrega_id: null, notas_aplicadas: { "manual_00000000-0000-0000-0000-000000000003": 0.8 } });
  assert.equal((await notes(section)).prueba_2, undefined);
  assert.equal((await notes(section))["manual_00000000-0000-0000-0000-000000000003"], 0.8);
  console.log("PASS borrado transaccional, reposiciones, reintentos atrasados y manuales históricos.");
  console.log("PASS historial de notas: cambios efectivos, cero, alias, rollback, identidad y acceso privado.");
} finally {
  await db.close();
}
