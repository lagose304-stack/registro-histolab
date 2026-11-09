import React, { useEffect } from "react";
import { createPortal } from "react-dom";
import { CheckCircle2, AlertCircle, Info, X } from "lucide-react";

export default function Notification({ message, type = "success", title, onClose }) {
  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(onClose, 5000);
    return () => clearTimeout(timer);
  }, [message, onClose]);
  if (!message) return null;
  const isError = type === "error";
  const Icon = isError ? AlertCircle : type === "success" ? CheckCircle2 : Info;
  return createPortal(
    <div className="site-notification animate-fade-in" data-type={type} role={isError ? "alert" : "status"}>
      <Icon size={22} aria-hidden="true" />
      <div className="site-notification__content">
        {(title || isError) && <strong>{title || "No se pudo completar la acción"}</strong>}
        <p>{message}</p>
      </div>
      <button type="button" onClick={onClose} aria-label="Cerrar aviso"><X size={20} aria-hidden="true" /></button>
    </div>, document.body
  );
}
