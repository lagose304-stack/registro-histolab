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
  await db.exec((await source("../src/db/pruebas_schema.sql")).replace(/CREATE EXTENSION IF NOT EXISTS "pgcrypto";/i, ""));
  await db.exec(await source("../src/db/live_quizzes_migration.sql"));
  await db.exec(await source("../../supabase/migrations/20261113214049_quiz_activity_journal.sql"));
  await db.exec(await source("../../supabase/migrations/20261114023949_quiz_individual_reopening.sql"));
  await db.exec(await source("../../supabase/migrations/20261114030710_quiz_automatic_diagnostics.sql"));
  await db.exec(await source("../../supabase/migrations/20261114131404_quiz_submission_activity_cleanup.sql"));
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

  await db.exec(`RESET ROLE;
    INSERT INTO entregas_pruebas (id,seccion_id,numero_semana,numero_cuenta,estado,nota_obtenida,respuestas,auditoria,updated_at)
      VALUES ('${delivery}','${section}',1,'A','calificado',2,'{"q":{"a":"Conservar"}}','{"actividad":{"faltas":3}}','${validVersion}');
    UPDATE estudiantes_medicina SET notas=notas || '{"prueba_1":2,"prueba_1_real":3}' WHERE seccion_id='${section}' AND numero_cuenta='A';
    INSERT INTO sesiones_pruebas_en_vivo(seccion_id,numero_semana,estado,habilitada) VALUES ('${section}',1,'en_pregunta',true);
    INSERT INTO quiz_activity_attempts(quiz_id,seccion_id,numero_semana,alumno_id,numero_cuenta,politica,aceptado_cliente_at,faltas)
      VALUES ('quiz','${section}',1,'student','A','salidas-tres-faltas-v1',now(),3);
    GRANT SELECT ON sesiones_pruebas_en_vivo TO service_role;
    SET ROLE service_role;`);
  const request='00000000-0000-0000-0000-000000000009';
  const reopen=version=>db.query("SELECT reopen_quiz_submission($1,1,'A',$2,$3,'Conexión interrumpida','00000000-0000-0000-0000-000000000001','Docente Ejemplo') AS result",[section,version,request]);
  await assert.rejects(reopen(staleVersion), /entrega cambió/);
  assert.equal((await notes(section)).prueba_1,2);
  await db.exec("RESET ROLE; CREATE TRIGGER fail_reopening BEFORE INSERT ON historial_notas FOR EACH ROW EXECUTE FUNCTION fail_audit_for_test(); SET ROLE service_role;");
  await assert.rejects(reopen(validVersion), /Fallo simulado/);
  assert.equal((await notes(section)).prueba_1,2,'Fallo del historial revierte la nota y la reapertura');
  assert.equal((await db.query('SELECT estado FROM entregas_pruebas WHERE id=$1',[delivery])).rows[0].estado,'calificado');
  await db.exec('RESET ROLE; DROP TRIGGER fail_reopening ON historial_notas; SET ROLE service_role;');
  const reopened=(await reopen(validVersion)).rows[0].result;
  assert.equal(reopened.estado,'borrador');assert.equal(reopened.nota_obtenida,null);
  assert.equal(reopened.respuestas.q.a,'Conservar');
  assert.equal(reopened.auditoria.reaperturas.length,1);
  assert.equal(reopened.auditoria.reaperturas[0].entrega.auditoria.actividad.faltas,3);
  assert.equal(reopened.auditoria.reapertura.instructor_nombre,'Docente Ejemplo');
  assert.equal((await notes(section)).prueba_1,undefined);assert.equal((await notes(section)).prueba_1_real,undefined);
  assert.equal((await db.query('SELECT faltas,reemplazado_at IS NOT NULL AS retired FROM quiz_activity_attempts')).rows[0].retired,true);
  assert.equal((await reopen(validVersion)).rows[0].result.auditoria.reaperturas.length,1,'Reintentar la misma autorización no duplica el historial');
  await db.exec('RESET ROLE; SET ROLE authenticated;');
  await assert.rejects(reopen(validVersion),{code:'42501'});
  console.log('PASS reapertura SQL: respuestas y faltas conservadas, nota retirada atómicamente, versión vigente, historial, reintento único y acceso exclusivo de API.');

  const uuid=n=>`00000000-0000-0000-0000-${String(n).padStart(12,'0')}`;
  const quiz=uuid(30),current=uuid(40),archived=uuid(41),foreign=uuid(42),otherWeek=uuid(43);
  await db.exec(`RESET ROLE;
    INSERT INTO pruebas_semanales(id,seccion_id,numero_semana) VALUES ('${quiz}','${section}',1);
    INSERT INTO quiz_activity_attempts(id,quiz_id,seccion_id,numero_semana,alumno_id,numero_cuenta,politica,aceptado_cliente_at,faltas,reemplazado_at)
      VALUES ('${current}','${quiz}','${section}',1,'student','A','salidas-tres-faltas-v1',now(),1,NULL),
      ('${archived}','${quiz}','${section}',1,'student','A','salidas-tres-faltas-v1',now(),1,now()),
      ('${foreign}','${quiz}','${section}',1,'other','B','salidas-tres-faltas-v1',now(),1,NULL),
      ('${otherWeek}','${quiz}','${section}',2,'student','A','salidas-tres-faltas-v1',now(),1,NULL);
    INSERT INTO quiz_activity_events(id,intento_id,episodio_id,tipo,falta,senales,pregunta_indice,hora_cliente)
      SELECT gen_random_uuid(),id,gen_random_uuid(),'salida',1,'["ventana_sin_foco"]',0,now()
      FROM quiz_activity_attempts WHERE id IN ('${current}','${archived}','${foreign}','${otherWeek}');
    INSERT INTO quiz_diagnostic_batches(id,intento_id,datos)
      SELECT gen_random_uuid(),id,'{"version":1,"muestras":[]}'
      FROM quiz_activity_attempts WHERE id IN ('${current}','${archived}','${foreign}','${otherWeek}');
    UPDATE entregas_pruebas SET quiz_id='${quiz}',estado='calificado',nota_obtenida=2,
      auditoria='{"actividad":{"intento_id":"${current}"},"reaperturas":[{"entrega":{"auditoria":{"actividad":{"intento_id":"${archived}"}}}},{"entrega":{"auditoria":{"actividad":{"intento_id":"${foreign}"}}}},{"entrega":{"auditoria":{"actividad":{"intento_id":"${otherWeek}"}}}}]}'
      WHERE id='${delivery}';
    SET ROLE service_role;`);
  const activityCount=async(table,id)=>(await db.query(`SELECT count(*)::int AS n FROM ${table} WHERE ${table==='quiz_activity_attempts'?'id':'intento_id'}=$1`,[id])).rows[0].n;
  const currentVersion=(await db.query('SELECT updated_at FROM entregas_pruebas WHERE id=$1',[delivery])).rows[0].updated_at;
  await db.query("SELECT reopen_quiz_submission($1,1,'A',$2,$3,'Continuar prueba aislada','00000000-0000-0000-0000-000000000001','Docente Ejemplo')",[section,currentVersion,uuid(60)]);
  for(const table of ['quiz_activity_attempts','quiz_activity_events','quiz_diagnostic_batches']){
    assert.equal(await activityCount(table,current),1,'La reapertura no elimina el registro');
    assert.equal(await activityCount(table,archived),1);
  }
  await db.exec(`RESET ROLE;
    UPDATE estudiantes_medicina SET notas=notas || '{"prueba_1":2}' WHERE seccion_id='${section}' AND numero_cuenta='A';
    CREATE TRIGGER fail_activity_cleanup BEFORE DELETE ON quiz_activity_events FOR EACH ROW EXECUTE FUNCTION fail_audit_for_test();
    SET ROLE service_role;`);
  const deleteWithActivity=()=>db.query("SELECT delete_quiz_submission_with_grade($1,1,'A',$2)",[section,delivery]);
  await db.exec('BEGIN');await deleteWithActivity();
  await assert.rejects(db.exec('COMMIT'),/Fallo simulado/);
  await db.exec('ROLLBACK');
  assert.equal((await notes(section)).prueba_1,2,'Una falla de limpieza revierte la eliminación de la nota');
  assert.equal((await db.query('SELECT count(*)::int AS n FROM entregas_pruebas WHERE id=$1',[delivery])).rows[0].n,1);
  assert.equal(await activityCount('quiz_activity_events',current),1);
  await db.exec('RESET ROLE; DROP TRIGGER fail_activity_cleanup ON quiz_activity_events; SET ROLE service_role;');
  await db.exec('BEGIN');
  await deleteWithActivity();await db.exec('SET CONSTRAINTS quiz_delivery_activity_cleanup IMMEDIATE');
  assert.equal(await activityCount('quiz_activity_attempts',current),0);
  await db.exec('ROLLBACK');
  assert.equal(await activityCount('quiz_activity_attempts',current),1,'El rollback restaura también el intento');
  assert.equal(await activityCount('quiz_diagnostic_batches',current),1);
  await deleteWithActivity();
  for(const table of ['quiz_activity_attempts','quiz_activity_events','quiz_diagnostic_batches']){
    assert.equal(await activityCount(table,current),0);
    assert.equal(await activityCount(table,archived),0);
    assert.equal(await activityCount(table,foreign),1,'No borra otra cuenta aunque figure en metadatos inválidos');
    assert.equal(await activityCount(table,otherWeek),1,'No borra otra semana aunque figure en metadatos inválidos');
  }
  assert.equal((await notes(section)).prueba_1,undefined);
  assert.equal((await deleteWithActivity()).rows[0].delete_quiz_submission_with_grade,null,'Reintentar no borra otros registros');
  assert.equal((await db.query("SELECT has_table_privilege('service_role','quiz_activity_events','DELETE') AS allowed")).rows[0].allowed,false);
  await assert.rejects(db.query('SELECT cleanup_deleted_quiz_activity()'),{code:'42501'});
  await db.exec(`RESET ROLE;
    INSERT INTO entregas_pruebas(id,quiz_id,seccion_id,numero_semana,numero_cuenta,auditoria)
      VALUES ('${uuid(70)}','${quiz}','${section}',2,'A','{}'),
      ('${uuid(71)}','${quiz}','${section}',3,'A','{"actividad":{"intento_id":"invalid"},"reaperturas":{}}');
    DELETE FROM entregas_pruebas WHERE id IN ('${uuid(70)}','${uuid(71)}');`);
  assert.equal(await activityCount('quiz_activity_attempts',otherWeek),1,'Una entrega histórica sin vínculo no produce un borrado amplio');
  console.log('PASS limpieza de entrega: intentos/eventos/diagnóstico vinculados, rollback completo, aislamiento, legado, reapertura intacta y permisos privados.');
} finally {
  await db.close();
}
