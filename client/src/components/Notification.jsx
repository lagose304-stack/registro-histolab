import React, { useEffect } from "react";
import { createPortal } from "react-dom";
import { CheckCircle2, AlertCircle, Info, X } from "lucide-react";

export default function Notification({ message, type = "success", title, onClose }) {
  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(() => {
      onClose();
    }, 5000);
    return () => clearTimeout(timer);
  }, [message, onClose]);

  if (!message) return null;

  const isSuccess = type === "success";
  const isError = type === "error";

  const content = (
    <div
      className="animate-fade-in"
      style={{
        position: "fixed",
        top: "1.5rem",
        right: "1.5rem",
        zIndex: 99999999,
        background: isSuccess
          ? "rgba(6, 78, 59, 0.98)"
          : isError
          ? "rgba(127, 29, 29, 0.98)"
          : "rgba(15, 23, 42, 0.98)",
        backdropFilter: "blur(16px)",
        border: `1px solid ${
          isSuccess
            ? "rgba(52, 211, 153, 0.6)"
            : isError
            ? "rgba(248, 113, 113, 0.7)"
            : "rgba(148, 163, 184, 0.4)"
        }`,
        color: "#ffffff",
        padding: "1rem 1.4rem",
        borderRadius: "0.75rem",
        boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.5), 0 8px 10px -6px rgba(0, 0, 0, 0.5)",
        display: "flex",
        alignItems: "flex-start",
        gap: "0.85rem",
        minWidth: "320px",
        maxWidth: "460px",
        pointerEvents: "auto"
      }}
    >
      <div style={{ marginTop: "0.1rem", flexShrink: 0 }}>
        {isSuccess && <CheckCircle2 size={22} color="#34d399" />}
        {isError && <AlertCircle size={22} color="#f87171" />}
        {!isSuccess && !isError && <Info size={22} color="#38bdf8" />}
      </div>
      <div style={{ flex: 1 }}>
        {(title || isError) && (
          <div
            style={{
              fontSize: "0.74rem",
              fontWeight: 900,
              textTransform: "uppercase",
              letterSpacing: "0.05em",
              color: isSuccess ? "#6ee7b7" : isError ? "#fca5a5" : "#7dd3fc",
              marginBottom: "0.25rem",
              display: "flex",
              alignItems: "center",
              gap: "0.35rem"
            }}
          >
            <span>{title || (isError ? "⚠️ Error del Sistema" : "Aviso")}</span>
          </div>
        )}
        <p style={{ margin: 0, fontSize: "0.88rem", fontWeight: 600, lineHeight: 1.45, color: "#ffffff" }}>
          {message}
        </p>
      </div>
      <button
        onClick={onClose}
        style={{
          background: "transparent",
          border: "none",
          color: "rgba(255, 255, 255, 0.8)",
          cursor: "pointer",
          padding: "0.2rem",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0
        }}
        title="Cerrar"
      >
        <X size={18} />
      </button>
    </div>
  );

  return createPortal(content, document.body);
}
