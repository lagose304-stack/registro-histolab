import {activationLimitFixture} from "./activation_limit_fixture.mjs";
// Controladores, SQL y transporte reales; Google/Auth simulados. No envía correos reales.
import assert from "node:assert/strict";
import vm from "node:vm";
import {build} from "esbuild";
import {readFile} from "node:fs/promises";
import path from "node:path";
import {createRequire} from "node:module";
import crypto from "node:crypto";
const require=createRequire(import.meta.url),pgRequire=createRequire(path.resolve(process.env.HISTOLAB_PGLITE_DIR||".","package.json"));
const {PGlite}=pgRequire("@electric-sql/pglite");const pg=new PGlite();
const testPin=process.env.TEST_ACTIVATION_OTP_LENGTH==="8"?"00123456":"001234";
const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,"0")}`;
const providerUsers=new Map(),codes=new Map(),mail=[],passwordWrites=[];let failPassword=false,dbCalls=0,rateChecks=0,tokenFetches=0,hold,release;
try{
 await pg.exec("CREATE ROLE anon;CREATE ROLE authenticated;CREATE ROLE service_role BYPASSRLS;CREATE SCHEMA auth;CREATE TABLE auth.users(id uuid PRIMARY KEY);CREATE TABLE instructores(id uuid PRIMARY KEY,correo text,activo boolean DEFAULT true,current_session_token text);");
 for(const c of ["medicina","enfermeria","odontologia","microbiologia","nutricion"])await pg.exec(`CREATE TABLE estudiantes_${c}(id uuid PRIMARY KEY,numero_cuenta text,seccion_id uuid,contrasena text,activo boolean DEFAULT true,current_session_token text);`);
 await pg.query("INSERT INTO auth.users VALUES($1)",[id(1)]);providerUsers.set("instructor@example.invalid",{id:id(1)});
 await pg.query("INSERT INTO instructores(id,correo) VALUES($1,'instructor@example.invalid')",[id(1)]);
 await pg.exec(await readFile(new URL("../../supabase/migrations/20261108041109_account_activation.sql",import.meta.url),"utf8"));
 await pg.exec(await readFile(new URL("../../supabase/migrations/20261108060000_account_recovery.sql",import.meta.url),"utf8"));
 await pg.exec(await readFile(new URL("../../supabase/migrations/20261109020000_student_auth_only.sql",import.meta.url),"utf8"));
 await pg.query("INSERT INTO estudiantes_medicina(id,numero_cuenta,correo) VALUES($1,'DEMO','alumno@example.invalid')",[id(2)]);
 const admin={async generateLink({email,type}){assert.equal(type,"recovery");const user=providerUsers.get(email);if(!user)return {error:{code:"user_not_found"}};codes.set(email,testPin);return {data:{user,properties:{email_otp:testPin}}};},
  async createUser({email,password}){assert(password.length>40);assert(!password.includes("histolab"));const user={id:crypto.randomUUID()};await pg.query("INSERT INTO auth.users VALUES($1)",[user.id]);providerUsers.set(email,user);return {data:{user}};},
  async updateUserById(authId,{password,email_confirm}){if(failPassword)return {error:{code:"unavailable"}};if(hold)await new Promise(resolve=>release=resolve);passwordWrites.push({authId,password});assert.equal(email_confirm,true);return {data:{user:{id:authId}}};}
 };
 const database={auth:{admin},async rpc(name,args){dbCalls++;const entries=Object.entries(args);const sql=`SELECT public.${name}(${entries.map(([key],i)=>key+' => $'+(i+1)).join(',')}) AS result`;return {data:(await pg.query(sql,entries.map(([,value])=>value))).rows[0].result};},from(table){if(table==="account_activation_limits"){dbCalls++;rateChecks++;return activationLimitFixture(pg).from(table);}assert(/^[a-z_]+$/.test(table));let updates,single=false;const conditions=[];const q={select(){return q},eq(key,value){conditions.push([key,value]);return q},is(key,value){assert.equal(value,null);conditions.push([key,null]);return q},update(value){updates=value;return q},maybeSingle(){single=true;return q},then(resolve,reject){return(async()=>{dbCalls++;const values=[];let sql;if(updates){sql=`UPDATE public.${table} SET `+Object.entries(updates).map(([key,value])=>{values.push(value);return key+'=$'+values.length}).join(',');}else sql=`SELECT * FROM public.${table}`;if(conditions.length)sql+=' WHERE '+conditions.map(([key,value])=>{if(value===null)return key+' IS NULL';values.push(value);return key+'=$'+values.length}).join(' AND ');if(updates)sql+=' RETURNING *';const rows=(await pg.query(sql,values)).rows;return {data:single?rows[0]||null:rows};})().then(resolve,reject)}};return q}};
 const client=()=>({auth:{async verifyOtp({email,token,type}){assert.equal(type,"recovery");if(codes.get(email)!==token)return {error:{code:"bad_code"}};codes.delete(email);return {data:{user:providerUsers.get(email),session:{access_token:"must-not-leave-server"}}};},async signOut(options){assert.equal(options.scope,"local");}}});
 const environment={NODE_ENV:"test",JWT_SECRET:"isolated-activation-secret",ACCOUNT_ACTIVATION_ENABLED:"false",GMAIL_SENDER:"sender@example.invalid",GMAIL_CLIENT_ID:"test-client",GMAIL_CLIENT_SECRET:"test-secret",GMAIL_REFRESH_TOKEN:"test-refresh"};
 const fetch=async(url,options)=>{if(url==='https://oauth2.googleapis.com/token'){tokenFetches++;return new Response(JSON.stringify({access_token:"test-access",expires_in:3600}),{status:200});}assert.equal(url,"https://gmail.googleapis.com/gmail/v1/users/me/messages/send");const raw=Buffer.from(JSON.parse(options.body).raw,"base64url").toString();mail.push(raw);assert(raw.includes("From: Registro HistoLab <sender@example.invalid>"));assert(Buffer.from(raw.split('\r\n\r\n')[1],"base64").toString().includes(testPin));return new Response(JSON.stringify({id:'message-'+mail.length}),{status:200});};
 const bundle=await build({entryPoints:["server/src/controllers/accountActivation.controller.js"],bundle:true,platform:"node",format:"cjs",write:false,plugins:[{name:"isolated-provider",setup(b){b.onResolve({filter:/db\/supabase\.js$/},()=>({path:"db",namespace:"fixture"}));b.onResolve({filter:/\.\/auth\.controller\.js$/},()=>({path:"cache",namespace:"fixture"}));b.onLoad({filter:/.*/,namespace:"fixture"},({path})=>({contents:path==='cache'?'export const clearInstructorAuthCache=()=>{};':'export const isSupabaseConfigured=true,supabase=globalThis.database;export const createSupabaseLoginClient=globalThis.client;'}));}}]});
 let captchaResult={success:true,hostname:'registrohistolab.pages.dev'},captchaStatus=200,captchaCalls=0;
 const guardedFetch=async(url,options)=>{
  if(url==='https://challenges.cloudflare.com/turnstile/v0/siteverify'){
   captchaCalls++;assert.equal(JSON.parse(options.body).secret,'test-turnstile-secret');
   return new Response(JSON.stringify(captchaResult),{status:captchaStatus});
  }
  return fetch(url,options);
 };
 const module={exports:{}};vm.runInNewContext(bundle.outputFiles[0].text,{module,exports:module.exports,require,database,client,process:{env:environment},crypto,Buffer,Date,TextEncoder,AbortSignal,Response,URLSearchParams,fetch:guardedFetch});const api=module.exports;
 const call=async(handler,body={})=>{let status=200,data;await handler({body,ip:'192.0.2.1',headers:{}},{set(){},status(v){status=v;return this},json(v){data=v;return this}});return {status,data}};
 assert.equal((await call(api.activationStatus)).data.data.enabled,false);assert.equal((await call(api.requestActivation,{perfil:'ESTUDIANTE',correo:'alumno@example.invalid'})).status,503);assert.equal(dbCalls,0);
 environment.ACCOUNT_ACTIVATION_ENABLED='true';
 const request=()=>call(api.requestActivation,{perfil:'ESTUDIANTE',correo:'alumno@example.invalid'});
 const unknown=await call(api.requestActivation,{perfil:'ESTUDIANTE',correo:'missing@example.invalid'});assert.equal(unknown.status,200);assert.equal(mail.length,0);
 let issued=await request();assert.equal(issued.status,200);assert.equal(mail.length,1);assert.equal((await request()).status,429);
 for(let attempt=0;attempt<6;attempt++)assert.equal((await call(api.verifyActivation,{challengeId:issued.data.challengeId,pin:'999999'})).status,400);
 await pg.exec("UPDATE account_activation_limits SET expires_at=now()-interval '1 second'");issued=await request();assert.equal(issued.status,200);assert.equal(mail.length,2);assert.equal(tokenFetches,1);
 const verified=await call(api.verifyActivation,{challengeId:issued.data.challengeId,pin:testPin});assert.equal(verified.status,200);assert.equal(verified.data.activationToken.length,43);assert(!JSON.stringify(verified).includes('must-not-leave-server'));
 const payload={challengeId:issued.data.challengeId,activationToken:verified.data.activationToken,nueva_contrasena:'Una frase segura de prueba',confirmar_contrasena:'Una frase segura de prueba',auth_user_id:'ignored-attacker'};
 assert.equal((await call(api.finishActivation,{...payload,confirmar_contrasena:'otra'})).status,400);assert.equal(passwordWrites.length,0);
 failPassword=true;assert.equal((await call(api.finishActivation,payload)).status,503);assert.equal((await pg.query("SELECT activation_completed_at FROM estudiantes_medicina")).rows[0].activation_completed_at,null);failPassword=false;
 hold=true;const first=call(api.finishActivation,payload);while(!release)await new Promise(resolve=>setTimeout(resolve,1));const concurrent=await call(api.finishActivation,payload);assert.equal(concurrent.status,403);hold=false;release();assert.equal((await first).status,200);assert.equal(passwordWrites.length,1);
 assert.equal(passwordWrites[0].authId,providerUsers.get('alumno@example.invalid').id);
 assert.equal((await call(api.finishActivation,payload)).status,200);assert.equal(passwordWrites.length,1);
 await pg.exec("UPDATE account_activation_limits SET expires_at=now()-interval '1 second'");assert.equal((await request()).status,200);assert.equal(mail.length,2,"Primer ingreso no restablece una cuenta ya activada");
 const teacher=await call(api.requestActivation,{perfil:'INSTRUCTOR',correo:'instructor@example.invalid'});assert.equal(teacher.status,200);const teacherVerify=await call(api.verifyActivation,{challengeId:teacher.data.challengeId,pin:testPin});assert.equal(teacherVerify.status,200);assert.equal((await call(api.finishActivation,{...payload,challengeId:teacher.data.challengeId,activationToken:teacherVerify.data.activationToken})).status,200);assert.equal(passwordWrites.at(-1).authId,id(1));
 // Una cuenta activada solo recibe otro correo al elegir recuperación.
 const recover=()=>call(api.requestActivation,{perfil:'ESTUDIANTE',correo:'alumno@example.invalid',purpose:'recovery'});
 await pg.exec("UPDATE account_activation_limits SET expires_at=now()-interval '1 second'; UPDATE estudiantes_medicina SET current_session_token='old-session'");
 const recovery=await recover();assert.equal(recovery.status,200);assert.equal(mail.length,4);
 assert.equal((await call(api.finishActivation,{...payload,challengeId:recovery.data.challengeId})).status,403,"Una autorización anterior no sirve para un desafío nuevo");
 const recovered=await call(api.verifyActivation,{challengeId:recovery.data.challengeId,pin:testPin});assert.equal(recovered.status,200);
 const reset={...payload,challengeId:recovery.data.challengeId,activationToken:recovered.data.activationToken,nueva_contrasena:'Otra frase personal segura',confirmar_contrasena:'Otra frase personal segura'};
 assert.equal((await call(api.finishActivation,reset)).status,200);
 const saved=(await pg.query('SELECT * FROM estudiantes_medicina')).rows[0];assert.equal(saved.current_session_token,null);assert(!('contrasena' in saved));assert.equal(saved.activation_required,false);
 assert.equal(passwordWrites.at(-1).password,reset.nueva_contrasena);
 const writes=passwordWrites.length;assert.equal((await call(api.finishActivation,reset)).status,200);assert.equal(passwordWrites.length,writes);
 // Reenviar cancela la autorización anterior y no permite reutilizarla.
 await pg.exec("UPDATE account_activation_limits SET expires_at=now()-interval '1 second'");
 const before=await recover();const beforeVerify=await call(api.verifyActivation,{challengeId:before.data.challengeId,pin:testPin});
 await pg.exec("UPDATE account_activation_limits SET expires_at=now()-interval '1 second'");await recover();
 assert.equal((await call(api.finishActivation,{...reset,challengeId:before.data.challengeId,activationToken:beforeVerify.data.activationToken})).status,403);
 assert.equal((await call(api.requestActivation,{perfil:'ESTUDIANTE',correo:'alumno@example.invalid',purpose:'invalid'})).status,400);
 environment.NODE_ENV='production';
 assert.equal((await call(api.activationStatus)).data.data.enabled,false,'Producción no habilita envíos sin Turnstile');
 environment.TURNSTILE_SECRET_KEY='test-turnstile-secret';environment.TURNSTILE_SITE_KEY='test-site-key';
 const guardedRequest=captchaToken=>call(api.requestActivation,{perfil:'ESTUDIANTE',correo:'guarded@example.invalid',purpose:'recovery',captchaToken});
 const callsBeforeCaptcha=dbCalls;
 for(const invalid of [undefined,'',' '.repeat(3),'x'.repeat(2049),123])assert.equal((await guardedRequest(invalid)).status,400);
 assert.equal(captchaCalls,0,'Tokens ausentes o demasiado largos se rechazan sin llamar al proveedor');
 for(const rejected of [{success:false},{success:true},{success:true,hostname:'atlas-histolab.pages.dev'}]){captchaResult=rejected;assert.equal((await guardedRequest('test-token')).status,400);}
 captchaResult={success:true,hostname:'registrohistolab.pages.dev'};captchaStatus=503;
 assert.equal((await guardedRequest('test-token')).status,400);
 assert.equal(dbCalls,callsBeforeCaptcha,'Un CAPTCHA inválido no toca perfiles ni límites de correo');
 captchaStatus=200;assert.equal((await guardedRequest('test-token')).status,200);
 const checksBeforePause=rateChecks;
 environment.ACCOUNT_ACTIVATION_RATE_LIMITS_ENABLED='false';
 assert.equal((await guardedRequest('test-token')).status,200);
 assert.equal(rateChecks,checksBeforePause,'La pausa temporal omite únicamente el límite de solicitudes');
 assert.equal((await guardedRequest('')).status,400,'La pausa conserva el CAPTCHA');
 environment.ACCOUNT_ACTIVATION_RATE_LIMITS_ENABLED='true';
 assert.equal((await guardedRequest('test-token')).status,429,'Reactivar el límite vuelve a bloquear solicitudes');
 delete environment.ACCOUNT_ACTIVATION_RATE_LIMITS_ENABLED;
 assert.equal((await guardedRequest('test-token')).status,429,'El límite está activo por defecto');
 console.log('PASS pausa temporal de solicitudes: reversible, activa por defecto y conserva CAPTCHA.');
 console.log('PASS Turnstile en producción: configuración obligatoria, tamaño y presencia del token, rechazo de Atlas y hostname ausente, error HTTP y aceptación exclusiva del dominio de Registro.');
 console.log("PASS activación y recuperación: correo registrado, PIN con cero inicial, límites SQL, Auth estudiantil/docente, Gmail con token reutilizado, sin sesión académica prematura, error sin falso éxito, guardado único concurrente, reintento idempotente, autorización ligada al desafío, reenvío cancela autorización previa y recuperación invalida sesiones sin guardar contraseñas en la ficha.");
}finally{await pg.close()}
