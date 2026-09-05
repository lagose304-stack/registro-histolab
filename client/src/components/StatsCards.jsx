import React from "react";
import { FolderGit2, Clock, AlertTriangle, CheckCircle2 } from "lucide-react";

export default function StatsCards({ stats }) {
  const cards = [
    {
      title: "Total Muestras",
      value: stats?.total || 0,
      icon: FolderGit2,
      color: "#0284c7",
      bg: "rgba(2, 132, 199, 0.08)",
      border: "rgba(2, 132, 199, 0.2)"
    },
    {
      title: "En Proceso",
      value: stats?.enProceso || 0,
      icon: Clock,
      color: "#3b82f6",
      bg: "rgba(59, 130, 246, 0.08)",
      border: "rgba(59, 130, 246, 0.2)"
    },
    {
      title: "Prioridad Urgente / Alta",
      value: stats?.urgentes || 0,
      icon: AlertTriangle,
      color: "#d97706",
      bg: "rgba(245, 158, 11, 0.08)",
      border: "rgba(245, 158, 11, 0.2)"
    },
    {
      title: "Diagnósticos Emitidos",
      value: stats?.completados || 0,
      icon: CheckCircle2,
      color: "#059669",
      bg: "rgba(16, 185, 129, 0.08)",
      border: "rgba(16, 185, 129, 0.2)"
    }
  ];

  return (
    <div
      className="stats-grid"
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
        gap: "1.1rem",
        marginBottom: "1.75rem"
      }}
    >
      {cards.map((card, idx) => {
        const Icon = card.icon;
        return (
          <div
            key={idx}
            className="glass-panel"
            style={{
              padding: "1.15rem 1.35rem",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              border: `1px solid ${card.border}`,
              background: `linear-gradient(135deg, #ffffff 0%, ${card.bg} 100%)`
            }}
          >
            <div>
              <p style={{ fontSize: "0.78rem", color: "var(--text-muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em" }}>
                {card.title}
              </p>
              <h3 style={{ fontSize: "1.9rem", fontWeight: 800, marginTop: "0.2rem", color: "var(--text-main)" }}>
                {card.value}
              </h3>
            </div>
            <div style={{
              width: "46px",
              height: "46px",
              borderRadius: "var(--radius-md)",
              backgroundColor: card.bg,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: card.color,
              border: `1px solid ${card.border}`,
              flexShrink: 0
            }}>
              <Icon size={23} />
            </div>
          </div>
        );
      })}
    </div>
  );
}
