// Configuración local: solo imprime la URL de autorización, nunca códigos ni tokens.
import {createServer} from "node:http";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import dotenv from "dotenv";
dotenv.config({path:"server/.env",quiet:true});
const configPath=process.argv[2];
let config;
if(configPath){const parsed=JSON.parse(await fs.readFile(configPath,"utf8"));config=parsed.web||parsed.installed;}
const clientId=config?.client_id||process.env.GMAIL_CLIENT_ID;
const clientSecret=config?.client_secret||process.env.GMAIL_CLIENT_SECRET;
const sender=process.env.GMAIL_SENDER||"registrohistolab@gmail.com";
if(!clientId||!clientSecret)throw Error("Falta el archivo de cliente OAuth de Google o su configuración privada.");
const state=crypto.randomBytes(32).toString("base64url"),verifier=crypto.randomBytes(48).toString("base64url");
const redirect="http://127.0.0.1:43175/callback";
async function savePrivate(path,values){let text="";try{text=await fs.readFile(path,"utf8");}catch{}for(const [key,value]of Object.entries(values)){const line=key+"="+JSON.stringify(value);const pattern=new RegExp("^"+key+"=.*$","m");text=pattern.test(text)?text.replace(pattern,()=>line):text.replace(/\s*$/,"\n")+line+"\n";}await fs.writeFile(path,text,"utf8");}
const server=createServer(async(req,res)=>{
 const url=new URL(req.url,"http://127.0.0.1:43175");
 if(url.pathname!=="/callback"){res.writeHead(404).end();return;}
 if(url.searchParams.get("state")!==state){res.writeHead(400).end("Solicitud no valida.");return;}
 if(!url.searchParams.get("code")){res.writeHead(400).end("No se autorizo Gmail. Puedes cerrar esta ventana.");return;}
 try{
  const tokenResponse=await fetch("https://oauth2.googleapis.com/token",{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},body:new URLSearchParams({code:url.searchParams.get("code"),client_id:clientId,client_secret:clientSecret,redirect_uri:redirect,grant_type:"authorization_code",code_verifier:verifier}),signal:AbortSignal.timeout(15_000)});
  const token=await tokenResponse.json();if(!tokenResponse.ok||!token.refresh_token||!token.id_token)throw Error("OAuth no confirmado");
  const identityResponse=await fetch("https://oauth2.googleapis.com/tokeninfo?id_token="+encodeURIComponent(token.id_token),{signal:AbortSignal.timeout(10_000)});
  const identity=await identityResponse.json();
  if(!identityResponse.ok||identity.aud!==clientId||identity.email?.toLowerCase()!==sender.toLowerCase()||![true,"true"].includes(identity.email_verified)||Number(identity.exp)*1000<Date.now())throw Error("La cuenta autorizada no coincide con el remitente");
  const values={GMAIL_SENDER:sender,GMAIL_CLIENT_ID:clientId,GMAIL_CLIENT_SECRET:clientSecret,GMAIL_REFRESH_TOKEN:token.refresh_token};
  await savePrivate("server/.env",values);await savePrivate(".dev.vars",values);
  res.writeHead(200,{"Content-Type":"text/html; charset=utf-8","Cache-Control":"no-store","Referrer-Policy":"no-referrer"}).end("<!doctype html><meta name='viewport' content='width=device-width, initial-scale=1'><script>history.replaceState({},'', '/connected')</script><title>Gmail conectado · HistoLab</title><h1>Gmail conectado correctamente</h1><p>La autorización se guardó de forma privada. Puedes cerrar esta ventana y volver a HistoLab.</p>");
  console.log("Gmail autorizado para el remitente esperado. Configuración guardada en archivos privados; la activación pública permanece deshabilitada hasta verificar los envíos.");
  clearTimeout(expiry);server.close();
 }catch{res.writeHead(400,{"Content-Type":"text/plain; charset=utf-8"}).end("No se pudo confirmar la autorización. Verifica que elegiste la cuenta de HistoLab y vuelve a intentarlo.");console.error("No se guardó la autorización de Gmail.");}
});
const expiry=setTimeout(()=>{console.error("El paso de autorización venció sin guardar cambios.");server.close();},10*60*1000);
await new Promise((resolve,reject)=>{server.once("error",reject);server.listen(43175,"127.0.0.1",resolve);});
const authorize=new URL("https://accounts.google.com/o/oauth2/v2/auth");
authorize.search=new URLSearchParams({client_id:clientId,redirect_uri:redirect,response_type:"code",scope:"https://www.googleapis.com/auth/gmail.send openid email",access_type:"offline",prompt:"consent",login_hint:sender,state,code_challenge:crypto.createHash("sha256").update(verifier).digest("base64url"),code_challenge_method:"S256"}).toString();
console.log(authorize.href);
