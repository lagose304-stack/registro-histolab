import crypto from "node:crypto";
import { supabase, isSupabaseConfigured, createSupabaseLoginClient } from "../db/supabase.js";
import { gmailReady, sendActivationEmail } from "../services/gmailSender.js";
import { normalizeAccountEmail, validAccountEmail, validActivationPassword } from "../../../shared/accountActivation.mjs";
import { clearInstructorAuthCache } from "./auth.controller.js";

const TABLES = ["instructores","estudiantes_medicina","estudiantes_enfermeria","estudiantes_odontologia","estudiantes_microbiologia","estudiantes_nutricion"];
const CHALLENGES = "account_activation_challenges";
const GENERIC = "Si el correo corresponde a una cuenta disponible para este proceso, recibirás un código de seis cifras. Si no llega, consulta al titular de tu sección.";
const hash = value => crypto.createHmac("sha256",process.env.JWT_SECRET).update(value).digest("hex");
const reply = (res,status,message,extra={}) => res.status(status).json({success:status<400,message,...extra});
const ready = () => isSupabaseConfigured && gmailReady() && process.env.ACCOUNT_ACTIVATION_ENABLED === "true" && (process.env.NODE_ENV !== "production" || Boolean(process.env.TURNSTILE_SECRET_KEY && process.env.TURNSTILE_SITE_KEY));
async function rpc(name,args) { const {data,error}=await supabase.rpc(name,args); if(error)throw new Error("ACTIVATION_STORAGE_UNAVAILABLE"); return data; }
async function action(name,id,nonce=null,grant=null) { return rpc("account_activation_action",{p_action:name,p_id:id,p_nonce:nonce,p_grant:grant}); }
async function profile(table,id) { if(!TABLES.includes(table))throw Error("INVALID_TABLE");const {data,error}=await supabase.from(table).select("*").eq("id",id).eq("activo",true).maybeSingle();if(error)throw error;return data; }
const pending = row => row && !row.activation_completed_at;
async function challenge(id) { if(typeof id!=="string"||!/^[0-9a-f-]{36}$/i.test(id))return null;const {data,error}=await supabase.from(CHALLENGES).select("*").eq("id",id).maybeSingle();if(error)throw error;return data; }

export function activationStatus(req,res) { return res.json({success:true,data:{enabled:Boolean(ready()),turnstileSiteKey:process.env.TURNSTILE_SITE_KEY||null}}); }

export async function requestActivation(req,res) {
  res.set("Cache-Control","no-store");
  if(!ready())return reply(res,503,"La activación por correo aún no está disponible. Consulta a Administración General.");
  const email=normalizeAccountEmail(req.body?.correo),kind=req.body?.perfil;
  const purpose=req.body?.purpose||"activation";
  if(!["activation","recovery"].includes(purpose))return reply(res,400,"Selecciona un proceso de acceso válido.");
  if(!validAccountEmail(email)||!["ESTUDIANTE","INSTRUCTOR"].includes(kind))return reply(res,400,"Ingresa el correo registrado en tu cuenta.");
  const ip=process.env.NODE_ENV==="production"?String(req.headers["cf-connecting-ip"]||req.ip):String(req.ip);
  try {
    if(process.env.TURNSTILE_SECRET_KEY){
      const captchaToken=req.body?.captchaToken;
      if(typeof captchaToken!=="string"||!captchaToken.trim()||captchaToken.length>2048)return reply(res,400,"Completa la verificación de seguridad e inténtalo nuevamente.");
      const captcha=await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify",{method:"POST",signal:AbortSignal.timeout(10_000),headers:{"Content-Type":"application/json"},body:JSON.stringify({secret:process.env.TURNSTILE_SECRET_KEY,response:req.body?.captchaToken||"",remoteip:ip})});
      const result=await captcha.json();
      const expectedHostname=process.env.TURNSTILE_EXPECTED_HOSTNAME||(process.env.NODE_ENV==="production"?"registrohistolab.pages.dev":null);
      if(!captcha.ok||result.success!==true||(expectedHostname&&result.hostname!==expectedHostname))return reply(res,400,"Completa la verificación de seguridad e inténtalo nuevamente.");
    }
    const gate=await rpc("account_activation_rate",{p_email:hash(email),p_ip:hash(ip)});
    if(!gate?.allowed){res.set("Retry-After",String(gate?.retry_after||60));return reply(res,429,"Espera antes de solicitar otro código.");}
    const tables=kind==="INSTRUCTOR"?["instructores"]:TABLES.slice(1);
    const matches=(await Promise.all(tables.map(async table=>{const {data,error}=await supabase.from(table).select("*").eq("correo",email).eq("activo",true);if(error)throw error;return (data||[]).map(row=>({row,table}));}))).flat();
    // Siempre devuelve un identificador aleatorio: no revela qué correos existen.
    const id=crypto.randomUUID();
    if(matches.length!==1||(purpose==="activation"&&!pending(matches[0].row)))return reply(res,200,GENERIC,{challengeId:id,expiresIn:600,resendAfter:60});
    const {row,table}=matches[0];
    const budget=await rpc("account_activation_mail_budget",{});
    if(!budget?.allowed)return reply(res,503,"El servicio de correo alcanzó su límite de envíos. Intenta más tarde.");
    let authId=table==="instructores"?row.id:row.auth_user_id;
    let generated=await supabase.auth.admin.generateLink({type:"recovery",email});
    if(generated.error&&!authId){
      const created=await supabase.auth.admin.createUser({email,password:crypto.randomBytes(48).toString("base64url"),email_confirm:false});
      if(created.error)throw Error("AUTH_PROVISION_UNAVAILABLE");
      generated=await supabase.auth.admin.generateLink({type:"recovery",email});
    }
    if(generated.error||!generated.data?.user?.id||!/^\d{6}$/.test(generated.data.properties?.email_otp||""))throw Error("OTP_UNAVAILABLE");
    const actualId=generated.data.user.id;
    if(authId&&authId!==actualId)throw Error("AUTH_IDENTITY_MISMATCH");
    authId=actualId;
    if(table!=="instructores"&&!row.auth_user_id){
      const linked=await supabase.from(table).update({auth_user_id:authId}).eq("id",row.id).eq("correo",email).is("auth_user_id",null).select("id");
      if(linked.error||!linked.data?.length)throw Error("AUTH_LINK_UNAVAILABLE");
    }
    const issued=await rpc("account_activation_issue",{p_id:id,p_table:table,p_profile:row.id,p_auth:authId,p_email:email});
    if(!issued?.allowed)return reply(res,200,GENERIC,{challengeId:crypto.randomUUID(),expiresIn:600,resendAfter:60});
    try { await sendActivationEmail(email,generated.data.properties.email_otp); }
    catch { await action("cancel",id);return reply(res,503,"No pudimos enviar el correo. Intenta nuevamente más tarde."); }
    const sent=await action("sent",id);if(!sent?.allowed)throw Error("CHALLENGE_NOT_READY");
    return reply(res,200,GENERIC,{challengeId:id,expiresIn:600,resendAfter:60});
  }catch{return reply(res,503,"No pudimos solicitar el código en este momento. Intenta nuevamente.");}
}

export async function verifyActivation(req,res) {
  res.set("Cache-Control","no-store");
  const {challengeId,pin}=req.body||{};
  if(typeof pin!=="string"||!/^\d{6}$/.test(pin))return reply(res,400,"Ingresa las seis cifras del código.");
  let client;
  const lease=crypto.randomUUID();
  try{
    const row=await challenge(challengeId);
    if(!row)return reply(res,400,"El código no es válido o ha vencido. Solicita uno nuevo.");
    const claim=await action("verify",row.id,lease);
    if(!claim?.allowed)return reply(res,400,"El código venció o agotó sus intentos. Solicita uno nuevo.");
    client=createSupabaseLoginClient();
    const result=await client.auth.verifyOtp({email:row.correo,token:pin,type:"recovery"});
    if(result.error||result.data?.user?.id!==row.auth_user_id){await action("invalid",row.id,lease);return reply(res,400,"El código no es correcto o ha vencido.");}
    const grant=crypto.randomBytes(32).toString("base64url");
    const verified=await action("verified",row.id,lease,hash(grant));
    if(!verified?.allowed)return reply(res,400,"Esta solicitud ya no está vigente. Solicita otro código.");
    return reply(res,200,"Correo verificado. Ahora crea tu contraseña.",{activationToken:grant,expiresIn:300});
  }catch{return reply(res,503,"No pudimos verificar el código. Intenta nuevamente.");}
  finally{try{await client?.auth.signOut({scope:"local"});}catch{}}
}

export async function finishActivation(req,res) {
  res.set("Cache-Control","no-store");
  const {challengeId,activationToken,nueva_contrasena,confirmar_contrasena}=req.body||{};
  if(!validActivationPassword(nueva_contrasena))return reply(res,400,"Usa una contraseña de al menos 12 caracteres. Si es muy larga, acórtala un poco.");
  if(nueva_contrasena!==confirmar_contrasena)return reply(res,400,"Las contraseñas no coinciden.");
  if(typeof activationToken!=="string"||!/^[A-Za-z0-9_-]{43}$/.test(activationToken))return reply(res,403,"Verifica primero el código enviado a tu correo.");
  const lease=crypto.randomUUID();let claimed=false;
  try{
    const row=await challenge(challengeId);
    if(!row)return reply(res,403,"La autorización venció. Vuelve a verificar tu correo.");
    const grantHash=hash(activationToken);
    const claim=await action("save",row.id,lease,grantHash);
    if(claim?.completed)return reply(res,200,"Contraseña guardada. Ya puedes iniciar sesión.");
    if(!claim?.allowed)return reply(res,403,"La autorización venció o ya está en uso. Intenta nuevamente.");
    claimed=true;
    const current=await profile(row.profile_table,row.profile_id);
    if(!current||normalizeAccountEmail(current.correo)!==row.correo||(row.profile_table==="instructores"?current.id:current.auth_user_id)!==row.auth_user_id)throw Error("IDENTITY_CHANGED");
    const updated=await supabase.auth.admin.updateUserById(row.auth_user_id,{password:nueva_contrasena,email_confirm:true});
    if(updated.error||updated.data?.user?.id!==row.auth_user_id)throw Error("PASSWORD_NOT_SAVED");
    const completed=await action("complete",row.id,lease,grantHash);
    if(!completed?.allowed)throw Error("PROFILE_NOT_SAVED");
    clearInstructorAuthCache();
    return reply(res,200,"Contraseña guardada. Ya puedes iniciar sesión.");
  }catch{
    if(claimed)try{await action("retry",challengeId,lease);}catch{}
    return reply(res,503,"No pudimos confirmar el guardado. Conservamos tu autorización para que puedas reintentar.");
  }
}
