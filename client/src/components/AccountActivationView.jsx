import React,{useEffect,useRef,useState} from "react";
import {ArrowLeft,Mail,ShieldCheck,KeyRound,CheckCircle2,Eye,EyeOff,RefreshCw} from "lucide-react";
import {api} from "../services/api";
import {validActivationPassword} from "../../../shared/accountActivation.mjs";
import "./AccountActivationView.css";

let turnstileScript;
function Turnstile({siteKey,onToken,reset}) {
  const element=useRef(null);
  useEffect(()=>{
    let disposed=false,widget;
    if(!turnstileScript)turnstileScript=new Promise((resolve,reject)=>{
      if(window.turnstile)return resolve();
      const script=document.createElement("script");script.src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";script.async=true;script.onload=resolve;script.onerror=()=>{turnstileScript=null;reject(Error("captcha"));};document.head.appendChild(script);
    });
    turnstileScript.then(()=>{if(!disposed)widget=window.turnstile.render(element.current,{sitekey:siteKey,size:"flexible",callback:onToken,"expired-callback":()=>onToken(""),"error-callback":()=>onToken("")});}).catch(()=>onToken(""));
    return()=>{disposed=true;if(widget!==undefined)window.turnstile?.remove(widget);};
  },[siteKey,onToken,reset]);
  return <div className="account-activation__captcha" ref={element}/>;
}

export default function AccountActivationView({perfil,onClose,purpose="activation"}) {
  const recovering=purpose==="recovery";
  const [phase,setPhase]=useState("email"),[email,setEmail]=useState(""),[pin,setPin]=useState("");
  const [password,setPassword]=useState(""),[confirmation,setConfirmation]=useState(""),[visible,setVisible]=useState(false);
  const [status,setStatus]=useState(null),[loadingStatus,setLoadingStatus]=useState(true),[busy,setBusy]=useState(false),[error,setError]=useState("");
  const [challenge,setChallenge]=useState(""),[grant,setGrant]=useState(""),[captcha,setCaptcha]=useState(""),[captchaReset,setCaptchaReset]=useState(0);
  const [expiresAt,setExpiresAt]=useState(0),[resendAt,setResendAt]=useState(0),[now,setNow]=useState(Date.now());
  const inFlight=useRef(false),heading=useRef(null),alive=useRef(true),statusRequest=useRef(null);
  useEffect(()=>{alive.current=true;return()=>{alive.current=false;};},[]);
  const loadStatus=async()=>{setLoadingStatus(true);setError("");try{const result=await(statusRequest.current||=api.auth.activationStatus());if(alive.current)setStatus(result.data);}catch{if(alive.current)setError("No pudimos consultar el servicio. Intenta nuevamente.");}finally{statusRequest.current=null;if(alive.current)setLoadingStatus(false);}};
  useEffect(()=>{loadStatus();},[]);
  useEffect(()=>{heading.current?.focus();},[phase]);
  useEffect(()=>{if(!["pin","password"].includes(phase))return;const timer=setInterval(()=>setNow(Date.now()),1000);return()=>clearInterval(timer);},[phase]);
  const seconds=Math.max(0,Math.ceil((expiresAt-now)/1000)),wait=Math.max(0,Math.ceil((resendAt-now)/1000));
  const perform=async operation=>{if(inFlight.current)return;inFlight.current=true;setBusy(true);setError("");try{await operation();}catch(e){if(alive.current)setError(e.message||"No pudimos completar la solicitud. Intenta nuevamente.");}finally{inFlight.current=false;if(alive.current)setBusy(false);}};
  const send=()=>perform(async()=>{
    try{
      const result=await api.auth.requestActivation({perfil,correo:email,captchaToken:captcha,purpose});
      setChallenge(result.challengeId);setPin("");setGrant("");setExpiresAt(Date.now()+result.expiresIn*1000);setResendAt(Date.now()+result.resendAfter*1000);setNow(Date.now());setPhase("pin");
    }finally{setCaptcha("");setCaptchaReset(n=>n+1);}
  });
  const verify=()=>perform(async()=>{
    const result=await api.auth.verifyActivation({challengeId:challenge,pin});setGrant(result.activationToken);setPin("");setExpiresAt(Date.now()+result.expiresIn*1000);setNow(Date.now());setPhase("password");
  });
  const save=()=>perform(async()=>{
    if(password!==confirmation)throw Error("Las contraseñas no coinciden.");
    if(!validActivationPassword(password))throw Error("Usa una contraseña de al menos 12 caracteres. Si es muy larga, acórtala un poco.");
    const result=await api.auth.finishActivation({challengeId:challenge,activationToken:grant,nueva_contrasena:password,confirmar_contrasena:confirmation});
    if(!result.success)throw Error(result.message||"No se confirmó el guardado.");
    setPassword("");setConfirmation("");setGrant("");setPhase("success");
  });
  const step=["email","pin","password","success"].indexOf(phase);
  return <section className="account-activation" aria-labelledby="activation-title">
    <button type="button" className="account-activation__back" disabled={busy} onClick={onClose}><ArrowLeft size={17} aria-hidden="true"/>Volver al inicio de sesión</button>
    <div className="account-activation__icon">{phase==="success"?<CheckCircle2 aria-hidden="true"/>:phase==="password"?<KeyRound aria-hidden="true"/>:phase==="pin"?<ShieldCheck aria-hidden="true"/>:<Mail aria-hidden="true"/>}</div>
    <h2 id="activation-title" ref={heading} tabIndex={-1}>{({email:recovering?"Recupera tu contraseña":"Activa tu cuenta",pin:"Revisa tu correo",password:recovering?"Restablece tu contraseña":"Crea tu contraseña",success:recovering?"Contraseña restablecida":"Tu cuenta está lista"})[phase]}</h2>
    {phase!=="success"&&<ol className="account-activation__steps" aria-label="Pasos de activación">{["Correo","Código","Contraseña"].map((label,index)=><li key={label} aria-current={index===step?"step":undefined} data-done={index<step}><span>{index+1}</span>{label}</li>)}</ol>}
    {phase==="email"&&<><p>Ingresa el correo que registró tu titular o Administración General. Te enviaremos un código para verificar que la cuenta te pertenece.</p>
      {loadingStatus?<p role="status">Comprobando disponibilidad…</p>:!status?.enabled?<div className="account-activation__notice" role="status"><p>La activación por correo aún no está disponible. Si necesitas completar o corregir tu correo, comunícate con el titular de tu sección.</p><button type="button" onClick={loadStatus}><RefreshCw size={16} aria-hidden="true"/>Volver a comprobar</button></div>:<form onSubmit={e=>{e.preventDefault();send();}} aria-busy={busy}>
      <label className="histolab-login__field">Correo registrado<input type="email" name="correo" autoComplete="email" required maxLength={254} value={email} disabled={busy} onChange={e=>setEmail(e.target.value)}/></label>
      {status.turnstileSiteKey&&<Turnstile siteKey={status.turnstileSiteKey} onToken={setCaptcha} reset={captchaReset}/>}
      <button className="histolab-login__submit" disabled={busy||Boolean(status.turnstileSiteKey&&!captcha)}>{busy?"Enviando código…":"Enviar código"}</button></form>}
      <small>Usa el correo registrado en tu cuenta. Si necesitas corregirlo, consulta al titular de tu sección o a Administración General.</small></>}
    {phase==="pin"&&<><p>Si el correo <strong>{email}</strong> corresponde a una cuenta disponible para este proceso, recibirás un código de verificación. Revisa también la carpeta de spam.</p>
      <form onSubmit={e=>{e.preventDefault();verify();}} aria-busy={busy}><label className="histolab-login__field">Código de verificación<input className="account-activation__pin" type="text" inputMode="numeric" autoComplete="one-time-code" pattern="([0-9]{6}|[0-9]{8})" maxLength={8} required value={pin} disabled={busy||!seconds} onChange={e=>setPin(e.target.value.replace(/\D/g,""))}/></label>
      <small>{seconds?`El código vence en ${Math.floor(seconds/60)}:${String(seconds%60).padStart(2,"0")}.`:"El código ha vencido. Solicita uno nuevo."}</small>
      <button className="histolab-login__submit" disabled={busy||![6,8].includes(pin.length)||!seconds}>{busy?"Verificando…":"Verificar código"}</button></form>
      {!wait&&status?.turnstileSiteKey&&<Turnstile siteKey={status.turnstileSiteKey} onToken={setCaptcha} reset={captchaReset}/>}
      <button type="button" className="account-activation__back" disabled={busy||wait>0||Boolean(status?.turnstileSiteKey&&!captcha)} onClick={send}>{wait?`Podrás reenviar en ${wait} s`:"Reenviar código"}</button></>}
    {phase==="password"&&<><p>Correo verificado. Elige una contraseña personal de al menos 12 caracteres y guárdala en un lugar seguro.</p><form onSubmit={e=>{e.preventDefault();save();}} aria-busy={busy}>
      <label className="histolab-login__field">Nueva contraseña<input type={visible?"text":"password"} autoComplete="new-password" required minLength={12} maxLength={72} value={password} disabled={busy||!seconds} onChange={e=>setPassword(e.target.value)}/></label>
      <label className="histolab-login__field">Confirmar contraseña<input type={visible?"text":"password"} autoComplete="new-password" required minLength={12} maxLength={72} value={confirmation} disabled={busy||!seconds} onChange={e=>setConfirmation(e.target.value)}/></label>
      <button type="button" className="account-activation__back" onClick={()=>setVisible(v=>!v)}>{visible?<EyeOff size={17} aria-hidden="true"/>:<Eye size={17} aria-hidden="true"/>}{visible?"Ocultar contraseñas":"Mostrar contraseñas"}</button>
      {!seconds&&<p role="alert">La autorización venció. Vuelve a verificar tu correo.</p>}
      <button className="histolab-login__submit" disabled={busy||!seconds}>{busy?"Guardando contraseña…":"Guardar contraseña"}</button></form>
      {!seconds&&<button type="button" className="account-activation__back" onClick={()=>{setGrant("");setPassword("");setConfirmation("");setPhase("email");}}>Volver a verificar el correo</button>}</>}
    {phase==="success"&&<><p role="status">Contraseña guardada correctamente. Ya puedes iniciar sesión con tu número de cuenta o correo, según tu portal, y tu nueva contraseña.</p><button type="button" className="histolab-login__submit" onClick={onClose}>Ir a iniciar sesión</button></>}
    {error&&<p className="histolab-login__error" role="alert">{error}</p>}
  </section>;
}
