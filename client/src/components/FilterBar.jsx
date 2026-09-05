import React from "react";
import { Search, Filter } from "lucide-react";

export default function FilterBar({ filters, onFilterChange }) {
  return (
    <div
      className="glass-panel filter-container"
      style={{
        padding: "0.9rem 1.15rem",
        marginBottom: "1.5rem",
        display: "flex",
        flexWrap: "wrap",
        alignItems: "center",
        gap: "0.85rem",
        justifyContent: "space-between"
      }}
    >
      {/* Search Input */}
      <div style={{ position: "relative", flex: "1 1 260px", minWidth: "220px" }}>
        <Search
          size={17}
          style={{
            position: "absolute",
            left: "0.9rem",
            top: "50%",
            transform: "translateY(-50%)",
            color: "var(--text-dim)"
          }}
        />
        <input
          type="text"
          placeholder="Buscar por paciente, código o estudio..."
          className="form-control"
          style={{ paddingLeft: "2.5rem", fontSize: "0.88rem" }}
          value={filters.search}
          onChange={(e) => onFilterChange("search", e.target.value)}
        />
      </div>

      {/* Selectors */}
      <div className="filter-selectors" style={{ display: "flex", alignItems: "center", gap: "0.65rem", flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", flex: "1 1 auto" }}>
          <Filter size={15} color="var(--text-muted)" />
          <span style={{ fontSize: "0.82rem", color: "var(--text-muted)", fontWeight: 600, whiteSpace: "nowrap" }}>
            Estado:
          </span>
          <select
            className="form-select"
            style={{ width: "auto", minWidth: "125px", padding: "0.45rem 0.75rem", fontSize: "0.84rem" }}
            value={filters.estado}
            onChange={(e) => onFilterChange("estado", e.target.value)}
          >
            <option value="Todos">Todos</option>
            <option value="Pendiente">Pendiente</option>
            <option value="En Proceso">En Proceso</option>
            <option value="Completado">Completado</option>
          </select>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", flex: "1 1 auto" }}>
          <span style={{ fontSize: "0.82rem", color: "var(--text-muted)", fontWeight: 600, whiteSpace: "nowrap" }}>
            Prioridad:
          </span>
          <select
            className="form-select"
            style={{ width: "auto", minWidth: "115px", padding: "0.45rem 0.75rem", fontSize: "0.84rem" }}
            value={filters.prioridad}
            onChange={(e) => onFilterChange("prioridad", e.target.value)}
          >
            <option value="Todas">Todas</option>
            <option value="Normal">Normal</option>
            <option value="Alta">Alta</option>
            <option value="Urgente">Urgente</option>
          </select>
        </div>
      </div>
    </div>
  );
}
