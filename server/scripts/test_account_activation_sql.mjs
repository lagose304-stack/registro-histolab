import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {createRequire} from "node:module";
import path from "node:path";
const require=createRequire(path.resolve(process.env.HISTOLAB_PGLITE_DIR||".","package.json"));
const {PGlite}=require("@electric-sql/pglite");const db=new PGlite();
const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,"0")}`;
const careers=["medicina","enfermeria","odontologia","microbiologia","nutricion"];
const action=async(name,n,nonce=null,grant=null)=>(await db.query("SELECT account_activation_action($1,$2,$3,$4) result",[name,id(n),nonce,grant])).rows[0].result;
try{
 await db.exec("CREATE ROLE anon;CREATE ROLE authenticated;CREATE ROLE service_role BYPASSRLS;CREATE SCHEMA auth;CREATE TABLE auth.users(id uuid PRIMARY KEY);CREATE TABLE instructores(id uuid PRIMARY KEY,correo text,activo boolean DEFAULT true,current_session_token text);");
 for(const career of careers)await db.exec(`CREATE TABLE estudiantes_${career}(id uuid PRIMARY KEY,numero_cuenta text,seccion_id uuid,contrasena text DEFAULT 'histolab123',activo boolean DEFAULT true,current_session_token text);`);
 await db.query("INSERT INTO auth.users VALUES($1),($2)",[id(1),id(2)]);
 await db.query("INSERT INTO instructores(id,correo) VALUES($1,'admin@example.invalid')",[id(1)]);
 await db.query("INSERT INTO estudiantes_medicina(id,numero_cuenta) VALUES($1,'DEMO')",[id(3)]);
 const sql=await readFile(new URL("../../supabase/migrations/20261108041109_account_activation.sql",import.meta.url),"utf8");
 await db.exec(sql);await db.exec(sql);
 const recoverySql=await readFile(new URL('../../supabase/migrations/20261108060000_account_recovery.sql',import.meta.url),'utf8');
 await db.exec(recoverySql);await db.exec(recoverySql);
 assert.equal((await db.query("SELECT activation_required FROM instructores")).rows[0].activation_required,false,"Migración aditiva no bloquea cuentas existentes antes del despliegue");
 await db.query("UPDATE estudiantes_medicina SET correo='  alumno@example.invalid  ',auth_user_id=$1,current_session_token='old' WHERE id=$2",[id(2),id(3)]);
 const student=(await db.query("SELECT * FROM estudiantes_medicina")).rows[0];
 assert.equal(student.correo,"alumno@example.invalid");assert.equal(student.activation_required,true);assert.equal(student.current_session_token,null);assert.equal(student.contrasena,null);
 // El trigger elimina un vínculo antiguo al cambiar correo; el servicio lo enlaza después.
 await db.query("UPDATE estudiantes_medicina SET auth_user_id=$1 WHERE id=$2",[id(2),id(3)]);
 await assert.rejects(db.query("INSERT INTO estudiantes_nutricion(id,correo) VALUES($1,'ALUMNO@example.invalid')",[id(4)]),{code:"23505"});
 const rate=async()=>(await db.query("SELECT account_activation_rate('email-hash','ip-hash') result")).rows[0].result;
 assert((await rate()).allowed);assert.equal((await rate()).allowed,false);
 const issue=async n=>(await db.query("SELECT account_activation_issue($1,'estudiantes_medicina',$2,$3,'alumno@example.invalid') result",[id(n),id(3),id(2)])).rows[0].result;
 assert((await issue(10)).allowed);assert((await action("sent",10)).allowed);
 for(let attempt=0;attempt<5;attempt++){assert((await action("verify",10,"lease"+attempt)).allowed);assert.equal((await action("verify",10,"overlap")).allowed,false);assert((await action("invalid",10,"lease"+attempt)).allowed);}
 assert.equal((await action("verify",10,"sixth")).allowed,false);
 assert((await issue(11)).allowed);await action("sent",11);await action("verify",11,"verify-lease");
 assert.equal((await action("verified",11,"wrong","grant")).allowed,false);
 assert((await action("verified",11,"verify-lease","grant")).allowed);
 assert.equal((await action("verify",11,"replay")).allowed,false);
 assert.equal((await action("save",11,"save-lease","wrong")).allowed,false);
 assert((await action("save",11,"save-lease","grant")).allowed);
 assert.equal((await action("save",11,"parallel","grant")).allowed,false);
 assert.equal((await issue(12)).allowed,false,"No invalida un guardado vigente con un reenvío");
 assert((await action("retry",11,"save-lease")).allowed);await action("save",11,"retry-lease","grant");
 assert((await action("complete",11,"retry-lease","grant")).allowed);
 assert((await action("save",11,"replay","grant")).completed,"Reintento confirmado no cambia de nuevo la contraseña");
 const activated=(await db.query("SELECT * FROM estudiantes_medicina")).rows[0];assert.equal(activated.activation_required,false);assert(activated.activation_completed_at);assert.equal(activated.contrasena,null);
 await db.query("UPDATE estudiantes_medicina SET correo='otro@example.invalid',current_session_token='legacy' WHERE id=$1",[id(3)]);
 const changed=(await db.query("SELECT * FROM estudiantes_medicina")).rows[0];assert.equal(changed.activation_required,true);assert.equal(changed.activation_completed_at,null);assert.equal(changed.auth_user_id,null);assert.equal(changed.current_session_token,null);
 for(const role of ["anon","authenticated"]){assert.equal((await db.query("SELECT has_table_privilege($1,'account_activation_challenges','SELECT') allowed",[role])).rows[0].allowed,false);assert.equal((await db.query("SELECT has_function_privilege($1,'account_activation_action(text,uuid,text,text)','EXECUTE') allowed",[role])).rows[0].allowed,false);}
 console.log("PASS SQL activación: migración aditiva e idempotente, correo único, límites persistentes, cinco intentos, PIN y autorización de un uso, concurrencia, reintentos y cambio de correo seguro.");
}finally{await db.close()}
