import { validActivationPassword } from "../../../shared/accountActivation.mjs";
import React, { useId, useRef, useState } from "react";
import { ArrowLeft, KeyRound, LockKeyhole, Eye, EyeOff, CheckCircle2, Circle, AlertCircle, RefreshCw, UserRound, Mail, ShieldCheck, Hash } from "lucide-react";
import { api } from "../services/api";
import "./InstructorAccountView.css";

export default function InstructorAccountView({ currentInstructor, onClose = () => {} }) {
  const id = useId();
  const [values, setValues] = useState({ current: "", next: "", confirm: "" });
  const [visible, setVisible] = useState({});
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const inFlight = useRef(false);
  const longEnough = validActivationPassword(values.next);
  const different = Boolean(values.current && values.next && values.current !== values.next);
  const matches = Boolean(values.next && values.next === values.confirm);
  const valid = Boolean(values.current.trim() && longEnough && different && matches);
  const name = currentInstructor?.nombre_completo || [currentInstructor?.primer_nombre, currentInstructor?.segundo_nombre, currentInstructor?.primer_apellido, currentInstructor?.segundo_apellido].filter(Boolean).join(" ") || "Instructor";

  const submit = async event => {
    event.preventDefault();
    if (inFlight.current) return;
    if (!valid) {
      setFeedback({ type: "error", message: !values.current.trim() ? "Ingresa tu contraseña actual." : !longEnough ? "La nueva contraseña debe tener al menos 12 caracteres y no ser demasiado larga." : !different ? "Elige una contraseña diferente a la actual." : "La confirmación no coincide con la nueva contraseña." });
      return;
    }
    inFlight.current = true;
    setSaving(true);
    setFeedback(null);
    try {
      const result = await api.auth.changeInstructorPassword({ contrasena_actual: values.current, nueva_contrasena: values.next });
      if (!result?.success) throw new Error(result?.message || "No pudimos actualizar tu contraseña.");
      setValues({ current: "", next: "", confirm: "" });
      setVisible({});
      setFeedback({ type: "success", message: result.message || "Contraseña actualizada. Usa tu nueva clave la próxima vez que inicies sesión." });
    } catch (error) {
      setFeedback({ type: "error", message: error.message || "No pudimos guardar el cambio. Vuelve a intentarlo." });
    } finally {
      inFlight.current = false;
      setSaving(false);
    }
  };

  return <section className="instructor-account user-directory" aria-labelledby={`${id}-title`}>
    <button type="button" className="user-button instructor-account__back" onClick={onClose} disabled={saving}><ArrowLeft size={17} aria-hidden="true" />Panel docente</button>
    <header className="instructor-account__hero"><span><UserRound size={25} aria-hidden="true" /></span><div><p>Tu acceso a HistoLab</p><h1 id={`${id}-title`}>Mi cuenta</h1><p>Administra tu contraseña y consulta tus datos de acceso.</p></div></header>
    <div className="instructor-account__layout">
      <form className="instructor-account__panel" onSubmit={submit} aria-labelledby={`${id}-password-title`} aria-busy={saving}>
        <div className="instructor-account__heading"><KeyRound size={22} aria-hidden="true" /><div><h2 id={`${id}-password-title`}>Cambiar contraseña</h2><p>Confirma tu clave actual para guardar una nueva.</p></div></div>
        <input className="instructor-account__username" autoComplete="username" name="username" value={currentInstructor?.correo || currentInstructor?.numero_cuenta || ""} readOnly tabIndex={-1} aria-label="Cuenta de acceso" />
        <fieldset disabled={saving}>
          {[["current", "Contraseña actual", "current-password", "Ingresa tu contraseña actual"], ["next", "Nueva contraseña", "new-password", "Mínimo 12 caracteres"], ["confirm", "Confirmar nueva contraseña", "new-password", "Repite la nueva contraseña"]].map(([key, label, autocomplete, placeholder]) => <div className="instructor-account__field" key={key}>
            <label htmlFor={`${id}-${key}`}>{label}</label>
            <div className="instructor-account__input"><LockKeyhole size={17} aria-hidden="true" /><input id={`${id}-${key}`} name={key} type={visible[key] ? "text" : "password"} autoComplete={autocomplete} autoCapitalize="none" spellCheck={false} required maxLength={key === "current" ? 1024 : 72} placeholder={placeholder} value={values[key]}
              aria-describedby={key === "current" ? undefined : `${id}-requirements`}
              aria-invalid={key === "confirm" && values.confirm ? !matches : undefined}
              onChange={event => { setValues(previous => ({ ...previous, [key]: event.target.value })); setFeedback(null); }} />
              <button type="button" aria-label={`${visible[key] ? "Ocultar" : "Mostrar"} ${label.toLocaleLowerCase("es")}`} aria-pressed={Boolean(visible[key])} onClick={() => setVisible(previous => ({ ...previous, [key]: !previous[key] }))}>{visible[key] ? <EyeOff size={19} aria-hidden="true" /> : <Eye size={19} aria-hidden="true" />}</button></div>
          </div>)}
          <ul className="instructor-account__requirements" id={`${id}-requirements`}>{[[longEnough, "Mínimo 12 caracteres"], [different, "Diferente a tu contraseña actual"], [matches, "La confirmación coincide"]].map(([complete, label]) => <li key={label} data-complete={complete}>{complete ? <CheckCircle2 size={16} aria-hidden="true" /> : <Circle size={16} aria-hidden="true" />}{label}</li>)}</ul>
          {values.confirm && !matches && <p className="instructor-account__mismatch">Las contraseñas no coinciden. Revisa la confirmación.</p>}
          <button type="submit" className="user-button user-button--primary instructor-account__save" disabled={!valid || saving}>{saving ? <RefreshCw size={18} className="animate-spin" aria-hidden="true" /> : <KeyRound size={18} aria-hidden="true" />}{saving ? "Actualizando contraseña…" : "Actualizar contraseña"}</button>
        </fieldset>
        {feedback && <div className="instructor-account__feedback" data-type={feedback.type} role={feedback.type === "error" ? "alert" : "status"}>{feedback.type === "success" ? <CheckCircle2 size={20} aria-hidden="true" /> : <AlertCircle size={20} aria-hidden="true" />}<p>{feedback.message}</p></div>}
        <p className="instructor-account__note">La nueva contraseña se utilizará en tus próximos inicios de sesión.</p>
      </form>
      <aside className="instructor-account__sidebar">
        <section className="instructor-account__panel" aria-labelledby={`${id}-profile`}><h2 id={`${id}-profile`}>Datos de tu cuenta</h2><dl>{[[UserRound, "Nombre", name], [Hash, "Número de cuenta", currentInstructor?.numero_cuenta], [Mail, "Correo de acceso", currentInstructor?.correo], [ShieldCheck, "Rol", currentInstructor?.rol]].map(([Icon, label, value]) => <div key={label}><dt><Icon size={16} aria-hidden="true" />{label}</dt><dd>{value || "Sin registrar"}</dd></div>)}</dl></section>
        <section className="instructor-account__advice"><ShieldCheck size={21} aria-hidden="true" /><div><h2>Cuida tu acceso</h2><p>Usa una frase larga que puedas recordar. Evita datos personales y contraseñas que utilices en otros sitios.</p><p>Si olvidaste tu contraseña, vuelve al inicio de sesión y elige «Olvidé mi contraseña». Para corregir tu correo, comunícate con la administración.</p></div></section>
      </aside>
    </div>
  </section>;
}
