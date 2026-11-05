import React, { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

export default function TemarioDialog({ title, career, Icon, busy, onClose, children, footer }) {
  const ref = useRef(null);
  useEffect(() => {
    const dialog = ref.current;
    dialog.showModal();
    return () => dialog.close();
  }, []);

  return createPortal(
    <dialog ref={ref} className="user-dialog temario-copy-dialog" aria-labelledby="temario-action-title"
      onCancel={event => {
        event.preventDefault();
        if (!busy) onClose();
      }}>
      <header className="user-dialog__header">
        <span className="user-dialog__icon"><Icon size={21} aria-hidden="true" /></span>
        <div><p>{career}</p><h2 id="temario-action-title">{title}</h2></div>
        <button type="button" className="user-button user-button--icon" aria-label="Cerrar ventana" disabled={busy}
          onClick={onClose}><X size={20} aria-hidden="true" /></button>
      </header>
      {children}
      <footer className="user-dialog__footer">{footer}</footer>
    </dialog>,
    document.body
  );
}
