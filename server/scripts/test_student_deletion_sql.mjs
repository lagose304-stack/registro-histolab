// Base aislada: nunca consulta ni modifica Supabase real.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
const db=new PGlite();
const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const count=async(table,where='true')=>Number((await db.query(`SELECT count(*) n FROM ${table} WHERE ${where}`)).rows[0].n);
try{
 await db.exec('CREATE ROLE anon;CREATE ROLE authenticated;CREATE ROLE service_role BYPASSRLS;CREATE SCHEMA auth;CREATE TABLE auth.users(id uuid PRIMARY KEY);CREATE TABLE instructores(id uuid PRIMARY KEY,correo text,activo boolean DEFAULT true,current_session_token text);');
 for(const career of ['medicina','enfermeria','odontologia','microbiologia','nutricion'])await db.exec(`CREATE TABLE estudiantes_${career}(id uuid PRIMARY KEY,numero_cuenta text,seccion_id uuid,nombre_completo text,contrasena text,activo boolean DEFAULT true,current_session_token text,notas jsonb DEFAULT '{}',asistencias jsonb DEFAULT '{}');`);
 await db.query('INSERT INTO estudiantes_medicina(id,numero_cuenta,seccion_id,contrasena,current_session_token) VALUES($1,$2,$3,$4,$5)',[id(1),'PENDING',id(10),'unused-password','old-session']);
 for(const migration of ['20261108041109_account_activation.sql','20261108060000_account_recovery.sql','20261109020000_student_auth_only.sql'])await db.exec(await readFile(new URL('../../supabase/migrations/'+migration,import.meta.url),'utf8'));
 const pending=(await db.query('SELECT * FROM estudiantes_medicina')).rows[0];
 assert(!('contrasena' in pending));assert.equal(pending.activation_required,true);assert.equal(pending.current_session_token,null);
 await db.exec("CREATE TABLE entregas_pruebas(id uuid PRIMARY KEY,seccion_id uuid,numero_cuenta text);CREATE TABLE reposiciones_estudiantes(id uuid PRIMARY KEY,seccion_origen_id uuid,seccion_destino_id uuid,numero_cuenta text,prueba_entrega_id uuid REFERENCES entregas_pruebas(id));CREATE TABLE sesiones_pruebas_en_vivo(id uuid PRIMARY KEY,seccion_id uuid,alumnos_conectados jsonb,respuestas_globales jsonb);");
 const cleanup=await readFile(new URL('../../supabase/migrations/20261109021000_student_account_deletion.sql',import.meta.url),'utf8');await db.exec(cleanup);await db.exec(cleanup);
 await db.query('INSERT INTO auth.users VALUES($1),($2),($3),($4)',[id(100),id(101),id(102),id(103)]);
 await db.query('INSERT INTO estudiantes_medicina(id,numero_cuenta,seccion_id,correo,auth_user_id) VALUES($1,$2,$3,$4,$5)',[id(2),'DELETE',id(10),'delete@example.invalid',id(100)]);
 await db.query('INSERT INTO estudiantes_nutricion(id,numero_cuenta,seccion_id,correo,auth_user_id) VALUES($1,$2,$3,$4,$5)',[id(3),'KEEP',id(11),'keep@example.invalid',id(101)]);
 await db.query("INSERT INTO account_activation_challenges(id,profile_table,profile_id,auth_user_id,correo) VALUES($1,'estudiantes_medicina',$2,$3,'delete@example.invalid')",[id(20),id(2),id(100)]);
 await db.query("INSERT INTO entregas_pruebas VALUES($1,$2,'DELETE'),($3,$4,'DELETE'),($5,$6,'DELETE'),($7,$2,'KEEP')",[id(30),id(10),id(31),id(11),id(32),id(12),id(33)]);
 await db.query("INSERT INTO reposiciones_estudiantes VALUES($1,$2,$3,'DELETE',$4)",[id(40),id(10),id(11),id(31)]);
 for(const section of [10,11,12])await db.query('INSERT INTO sesiones_pruebas_en_vivo VALUES($1,$2,$3,$3)',[id(50+section),id(section),JSON.stringify({DELETE:{name:'Deleted'},KEEP:{name:'Kept'}})]);
 // Un error de limpieza revierte también el borrado de Auth y de la ficha.
 await db.exec('CREATE TABLE deletion_blocker(delivery uuid REFERENCES entregas_pruebas(id))');await db.query('INSERT INTO deletion_blocker VALUES($1)',[id(30)]);
 await db.query("SELECT prepare_student_auth_delete('estudiantes_medicina',$1,$2,'DELETE',$3)",[id(2),id(10),id(100)]);
 await assert.rejects(db.query('DELETE FROM auth.users WHERE id=$1',[id(100)]));
 assert.equal(await count('auth.users',`id='${id(100)}'`),1);assert.equal(await count('account_activation_challenges'),1);assert.equal(await count('reposiciones_estudiantes'),1);
 await db.exec('DELETE FROM deletion_blocker');await db.query('DELETE FROM auth.users WHERE id=$1',[id(100)]);
 assert.equal(await count('estudiantes_medicina',"numero_cuenta='DELETE'"),0);assert.equal(await count('account_activation_challenges'),0);assert.equal(await count('reposiciones_estudiantes'),0);
 assert.equal(await count('entregas_pruebas'),2);assert.equal(await count('estudiantes_nutricion'),1);
 const sessions=(await db.query('SELECT * FROM sesiones_pruebas_en_vivo ORDER BY seccion_id')).rows;
 assert(!sessions[0].alumnos_conectados.DELETE);assert(!sessions[1].respuestas_globales.DELETE);assert(sessions[2].alumnos_conectados.DELETE);assert(sessions.every(row=>row.alumnos_conectados.KEEP));
 // Auth compartido: conservar ambas matrículas y la identidad.
 await db.query("INSERT INTO estudiantes_medicina(id,numero_cuenta,seccion_id,correo,auth_user_id) VALUES($1,'SHARED',$2,'one@example.invalid',$3)",[id(4),id(10),id(102)]);
 await db.query("INSERT INTO estudiantes_nutricion(id,numero_cuenta,seccion_id,correo,auth_user_id) VALUES($1,'SHARED',$2,'two@example.invalid',$3)",[id(5),id(11),id(102)]);
 await assert.rejects(db.query('DELETE FROM auth.users WHERE id=$1',[id(102)]));assert.equal(await count('auth.users',`id='${id(102)}'`),1);
 // Un permiso preparado para otra ficha no permite eliminar un perfil distinto.
 await db.query('DELETE FROM estudiantes_nutricion WHERE id=$1',[id(5)]);
 await db.query("INSERT INTO histolab_private.student_auth_deletions VALUES($1,'estudiantes_nutricion',$2,now()+interval '5 minutes')",[id(102),id(5)]);
 await assert.rejects(db.query('DELETE FROM auth.users WHERE id=$1',[id(102)]));assert.equal(await count('estudiantes_medicina',"numero_cuenta='SHARED'"),1);
 await db.query("INSERT INTO instructores(id,correo) VALUES($1,'teacher@example.invalid')",[id(103)]);
 await assert.rejects(db.query('DELETE FROM auth.users WHERE id=$1',[id(103)]));
 await db.query('DELETE FROM estudiantes_medicina WHERE id=$1',[id(1)]);assert.equal(await count('estudiantes_medicina',"numero_cuenta='PENDING'"),0);
 for(const role of ['anon','authenticated'])assert.equal((await db.query("SELECT has_function_privilege($1,'histolab_private.cleanup_deleted_student()','EXECUTE') allowed",[role])).rows[0].allowed,false);
 console.log('PASS SQL: sin columna de contraseña, activación obligatoria, borrado Auth/ficha/desafíos/entregas/reposiciones/presencia, conservación de otras secciones y perfiles, bloqueo de identidad compartida e instructor, rollback completo ante errores e idempotencia de migración.');
}finally{await db.close();}
