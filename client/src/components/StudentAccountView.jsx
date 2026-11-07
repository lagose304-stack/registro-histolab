import React, { useId, useState } from "react";
import { KeyRound, Lock, Eye, EyeOff, CheckCircle2, Circle, AlertCircle, RefreshCw, User, GraduationCap, Building2, Info } from "lucide-react";
import { api } from "../services/api";
import "./StudentAccountView.css";

export default function StudentAccountView({ student, career, account, notify = () => {} }) {
  const formId = useId();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [visible, setVisible] = useState({ current: false, next: false, confirm: false });
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const cleanCurrent = currentPassword.trim();
  const cleanNew = newPassword.trim();
  const cleanConfirm = confirmation.trim();
  const longEnough = cleanNew.length >= 6;
  const different = Boolean(cleanNew && cleanCurrent && cleanNew !== cleanCurrent);
  const matches = Boolean(cleanNew && cleanConfirm && cleanNew === cleanConfirm);
  const canSave = Boolean(cleanCurrent && longEnough && different && matches);
  const section = student?.seccion;
  const sectionCode = typeof section === "string" ? section : section?.codigo;
  const changeValue = setter => event => { setter(event.target.value); setFeedback(null); };

  const handleSubmit = async event => {
    event.preventDefault();
    if (saving) return;
    setFeedback(null);
    const error = !cleanCurrent ? "Ingresa tu contraseña actual."
      : !cleanNew ? "Ingresa una nueva contraseña."
      : !longEnough ? "La nueva contraseña debe tener un mínimo de 6 caracteres."
      : !different ? "La nueva contraseña debe ser diferente a la actual."
      : !matches ? "La confirmación de la nueva contraseña no coincide." : null;
    if (error) { setFeedback({ type: "error", message: error }); return; }
    setSaving(true);
    try {
      const response = await api.auth.changeStudentPassword({
        carrera: career, numero_cuenta: account, contrasena_actual: cleanCurrent, nueva_contrasena: cleanNew
      });
      if (!response?.success) throw new Error(response?.message || "No se pudo actualizar la contraseña.");
      const message = response.message || "Tu contraseña se actualizó correctamente.";
      setCurrentPassword(""); setNewPassword(""); setConfirmation("");
      setVisible({ current: false, next: false, confirm: false });
      setFeedback({ type: "success", message });
      notify("Contraseña actualizada correctamente", "success");
    } catch (error) {
      const message = error?.message || "No se pudo actualizar la contraseña. Puedes volver a intentarlo.";
      setFeedback({ type: "error", message });
      notify(message, "error");
    } finally { setSaving(false); }
  };

  const fields = [
    { id: "current", label: "Contraseña actual", value: currentPassword, setter: setCurrentPassword, autocomplete: "current-password", placeholder: "Ingresa tu contraseña actual" },
    { id: "next", label: "Nueva contraseña", value: newPassword, setter: setNewPassword, autocomplete: "new-password", placeholder: "Mínimo 6 caracteres" },
    { id: "confirm", label: "Confirmar nueva contraseña", value: confirmation, setter: setConfirmation, autocomplete: "new-password", placeholder: "Repite tu nueva contraseña" }
  ];

  return <section className="student-account" aria-label="Mi cuenta">
    <form className="student-account__form" onSubmit={handleSubmit} aria-labelledby={`${formId}-title`} aria-busy={saving}>
      <div className="student-account__card-title"><span><KeyRound size={22} /></span><div><h3 id={`${formId}-title`}>Cambiar contraseña</h3><p>Actualiza la clave con la que ingresas a HistoLab.</p></div></div>
      <fieldset disabled={saving} aria-label="Cambio de contraseña">
        {fields.map(field => <div className="student-account__field" key={field.id}>
          <label htmlFor={`${formId}-${field.id}`}>{field.label}</label>
          <div><Lock size={17} /><input id={`${formId}-${field.id}`} name={field.id === "current" ? "current-password" : field.id === "next" ? "new-password" : "confirm-password"} type={visible[field.id] ? "text" : "password"} value={field.value} onChange={changeValue(field.setter)} autoComplete={field.autocomplete} autoCapitalize="none" spellCheck={false} required placeholder={field.placeholder} aria-describedby={field.id === "current" ? undefined : `${formId}-requirements`} aria-invalid={field.id === "confirm" && cleanConfirm ? !matches : field.id === "next" && cleanNew ? !(longEnough && (!cleanCurrent || different)) : undefined} /><button type="button" aria-label={`${visible[field.id] ? "Ocultar" : "Mostrar"} ${field.label.toLocaleLowerCase("es")}`} aria-pressed={visible[field.id]} onClick={() => setVisible(previous => ({ ...previous, [field.id]: !previous[field.id] }))}>{visible[field.id] ? <EyeOff size={19} /> : <Eye size={19} />}</button></div>
        </div>)}
        <ul className="student-account__requirements" id={`${formId}-requirements`}>
          {[[longEnough, "Mínimo 6 caracteres"], [different, "Diferente a tu contraseña actual"], [matches, "La confirmación coincide"]].map(([complete, label]) => <li key={label} data-complete={complete}>{complete ? <CheckCircle2 size={16} /> : <Circle size={16} />}<span>{label}</span></li>)}
        </ul>
        {cleanConfirm && !matches && <p className="student-account__mismatch">Las contraseñas no coinciden. Revisa la confirmación.</p>}
        <button className="student-account__submit" type="submit" disabled={!canSave || saving}>{saving ? <RefreshCw size={18} className="animate-spin" /> : <KeyRound size={18} />}{saving ? "Actualizando contraseña…" : "Actualizar contraseña"}</button>
      </fieldset>
      {feedback && <div className="student-account__feedback" data-type={feedback.type} role={feedback.type === "error" ? "alert" : "status"}>{feedback.type === "success" ? <CheckCircle2 size={19} /> : <AlertCircle size={19} />}<p>{feedback.message}</p></div>}
      <p className="student-account__save-note">La nueva clave se utilizará en tus próximos inicios de sesión.</p>
    </form>
    <aside className="student-account__sidebar">
      <section className="student-account__identity" aria-labelledby={`${formId}-identity`}><h4 id={`${formId}-identity`}>Datos de acceso</h4><dl><div><dt><User size={16} />Estudiante</dt><dd>{student?.nombre_completo || "Por confirmar"}</dd></div><div><dt><KeyRound size={16} />Cuenta</dt><dd>{account || "Por confirmar"}</dd></div><div><dt><GraduationCap size={16} />Carrera</dt><dd>{career || "Por confirmar"}</dd></div><div><dt><Building2 size={16} />Sección</dt><dd>{sectionCode || "Por confirmar"}</dd></div></dl><p>Si alguno de estos datos necesita corregirse, comunícate con el instructor titular de tu sección.</p></section>
      <details className="student-account__help"><summary><Info size={18} /><span>¿Es tu primer cambio de contraseña?</span></summary><p>Si tu cuenta conserva la clave inicial, usa <strong>histolab123</strong> como contraseña actual. Si ya la cambiaste, ingresa la que utilizas para iniciar sesión.</p></details>
      <section className="student-account__tips"><h4>Cuida tu acceso</h4><p>Tu cuenta es personal. Elige una clave que recuerdes y evita compartirla.</p><p>Si no recuerdas tu contraseña actual, comunícate con el instructor titular de tu sección.</p></section>
    </aside>
  </section>;
}
