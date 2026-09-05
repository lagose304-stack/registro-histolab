import React, { useState } from "react";
import { createPortal } from "react-dom";
import {
  X,
  UserPlus,
  Trash2,
  Users,
  Search,
  CheckCircle2,
  Calendar,
  Clock,
  ShieldCheck,
  ChevronDown,
  ChevronUp,
  AlertCircle
} from "lucide-react";
import { api } from "../services/api";

export default function SectionInstructorsModal({
  section,
  allInstructors = [],
  onClose = () => {},
  onSuccess = () => {},
  notify = () => {}
}) {
  const [assignedIds, setAssignedIds] = useState(
    Array.isArray(section.instructores_asignados) ? section.instructores_asignados : []
  );
  const [accordionOpen, setAccordionOpen] = useState(false);
  const [searchInstructor, setSearchInstructor] = useState("");
  const [saving, setSaving] = useState(false);

  if (!section) return null;

  // Verificar si un instructor es el Coordinador de la sección
  const isSectionCoordinator = (inst) => {
    if (!section.coordinador) return false;
    const coordStr = section.coordinador.toLowerCase().trim();
    const pNom = (inst.primer_nombre || "").toLowerCase().trim();
    const pApe = (inst.primer_apellido || "").toLowerCase().trim();
    const fName = `${pNom} ${pApe}`.trim();
    const full = (inst.nombre_completo || "").toLowerCase().trim();

    return (
      (pNom && pApe && coordStr.includes(pNom) && coordStr.includes(pApe)) ||
      coordStr === fName ||
      coordStr === full ||
      coordStr.includes(fName)
    );
  };

  // Filtrar instructores asignados
  const assignedInstructors = allInstructors.filter((inst) =>
    assignedIds.includes(inst.id)
  );

  // Instructores disponibles para agregar en el acordeón (excluye ya asignados Y al coordinador)
  const availableInstructors = allInstructors.filter(
    (inst) =>
      !assignedIds.includes(inst.id) &&
      !isSectionCoordinator(inst) &&
      (`${inst.primer_nombre || ''} ${inst.primer_apellido || ''} ${inst.numero_cuenta || ''} ${inst.correo || ''}`)
        .toLowerCase()
        .includes(searchInstructor.toLowerCase())
  );

  // Agregar instructor
  const handleAddInstructor = async (instructorId) => {
    const updated = [...assignedIds, instructorId];
    setAssignedIds(updated);
    await saveChanges(updated, "Instructor agregado con éxito");
  };

  // Quitar instructor
  const handleRemoveInstructor = async (instructorId) => {
    const updated = assignedIds.filter((id) => id !== instructorId);
    setAssignedIds(updated);
    await saveChanges(updated, "Instructor removido de la sección");
  };

  // Guardar en la base de datos
  const saveChanges = async (newIds, successMessage) => {
    setSaving(true);
    try {
      await api.secciones.update(section.id, {
        instructores_asignados: newIds
      });
      notify(successMessage, "success");
      onSuccess();
    } catch (err) {
      console.error("Error al actualizar instructores de la sección:", err);
      notify("Error al guardar cambios de instructores", "error");
    } finally {
      setSaving(false);
    }
  };

  const modalContent = (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: "rgba(15, 23, 42, 0.65)",
        backdropFilter: "blur(8px)",
        WebkitBackdropFilter: "blur(8px)",
        zIndex: 99999999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "1rem"
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget && !saving) onClose();
      }}
    >
      <div
        className="glass-panel animate-scale-up"
        style={{
          background: "#ffffff",
          borderRadius: "1.5rem",
          maxWidth: "600px",
          width: "100%",
          maxHeight: "90vh",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
          border: "1px solid #e2e8f0"
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Cabecera del Modal */}
        <div
          style={{
            padding: "1.5rem 1.75rem",
            background: "linear-gradient(135deg, #0d9488 0%, #0f766e 100%)",
            color: "#ffffff",
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            gap: "1rem"
          }}
        >
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.4rem" }}>
              <span
                style={{
                  background: "#ffffff",
                  color: "#0f766e",
                  fontWeight: 900,
                  fontSize: "0.85rem",
                  padding: "0.2rem 0.65rem",
                  borderRadius: "0.45rem"
                }}
              >
                {section.codigo}
              </span>
              <span
                style={{
                  background: "rgba(255, 255, 255, 0.2)",
                  color: "#ffffff",
                  fontWeight: 700,
                  fontSize: "0.75rem",
                  padding: "0.2rem 0.6rem",
                  borderRadius: "9999px",
                  textTransform: "uppercase"
                }}
              >
                {section.carrera}
              </span>
            </div>

            <h2 style={{ fontSize: "1.3rem", fontWeight: 800, margin: 0, color: "#ffffff" }}>
              Asignación de Instructores
            </h2>

            <div style={{ display: "flex", alignItems: "center", gap: "1rem", fontSize: "0.8rem", opacity: 0.9, marginTop: "0.35rem" }}>
              <span style={{ display: "flex", alignItems: "center", gap: "0.3rem" }}>
                <Clock size={13} /> {section.dia} {section.hora_inicio} - {section.hora_fin || "Fin"}
              </span>
              {section.coordinador && (
                <span>
                  <strong>Coordinador:</strong> {section.coordinador}
                </span>
              )}
            </div>
          </div>

          <button
            onClick={onClose}
            disabled={saving}
            style={{
              background: "rgba(255, 255, 255, 0.2)",
              border: "none",
              borderRadius: "50%",
              width: "36px",
              height: "36px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#ffffff",
              cursor: "pointer",
              transition: "all 0.15s ease",
              flexShrink: 0
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255, 255, 255, 0.35)")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "rgba(255, 255, 255, 0.2)")}
          >
            <X size={18} />
          </button>
        </div>

        {/* Cuerpo del Modal */}
        <div
          style={{
            padding: "1.5rem",
            overflowY: "auto",
            display: "flex",
            flexDirection: "column",
            gap: "1.5rem"
          }}
        >
          {/* =============================================================== */}
          {/* 1. BOTÓN Y ACORDEÓN PARA AÑADIR INSTRUCTOR */}
          {/* =============================================================== */}
          <div
            style={{
              background: "#f8fafc",
              border: "1.5px solid #cbd5e1",
              borderRadius: "1rem",
              overflow: "hidden",
              transition: "all 0.2s ease"
            }}
          >
            <button
              onClick={() => setAccordionOpen(!accordionOpen)}
              style={{
                width: "100%",
                padding: "1rem 1.25rem",
                background: accordionOpen ? "#f1f5f9" : "#ffffff",
                border: "none",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                cursor: "pointer",
                fontWeight: 800,
                color: "#0f766e",
                fontSize: "0.95rem",
                transition: "all 0.15s ease"
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
                <UserPlus size={18} color="#0d9488" />
                <span>Añadir Instructor a esta Sección</span>
              </div>
              {accordionOpen ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
            </button>

            {/* Contenido desplegable del acordeón */}
            {accordionOpen && (
              <div
                style={{
                  padding: "1.25rem",
                  borderTop: "1px solid #e2e8f0",
                  display: "flex",
                  flexDirection: "column",
                  gap: "0.85rem",
                  background: "#f8fafc"
                }}
              >
                {/* Buscador de instructores disponibles */}
                <div style={{ position: "relative" }}>
                  <Search
                    size={16}
                    color="#94a3b8"
                    style={{ position: "absolute", left: "0.85rem", top: "50%", transform: "translateY(-50%)" }}
                  />
                  <input
                    type="text"
                    placeholder="Buscar por nombre, no. de cuenta o correo..."
                    value={searchInstructor}
                    onChange={(e) => setSearchInstructor(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "0.6rem 0.85rem 0.6rem 2.4rem",
                      borderRadius: "0.55rem",
                      border: "1px solid #cbd5e1",
                      fontSize: "0.85rem",
                      background: "#ffffff",
                      outline: "none"
                    }}
                  />
                </div>

                {/* Lista de instructores elegibles */}
                <div style={{ maxHeight: "200px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                  {availableInstructors.length === 0 ? (
                    <div style={{ padding: "1.25rem", textAlign: "center", color: "#64748b", fontSize: "0.84rem" }}>
                      {searchInstructor
                        ? "No se encontraron instructores disponibles con ese nombre."
                        : "Todos los instructores disponibles ya están asignados a esta sección."}
                    </div>
                  ) : (
                    availableInstructors.map((inst) => {
                      const name = `${inst.primer_nombre || ''} ${inst.primer_apellido || ''}`.trim() || inst.nombre_completo || "Instructor";
                      return (
                        <div
                          key={inst.id}
                          style={{
                            background: "#ffffff",
                            padding: "0.65rem 0.85rem",
                            borderRadius: "0.6rem",
                            border: "1px solid #e2e8f0",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            gap: "0.75rem",
                            boxShadow: "0 1px 3px rgba(0,0,0,0.03)"
                          }}
                        >
                          <div style={{ display: "flex", flexDirection: "column" }}>
                            <strong style={{ fontSize: "0.88rem", color: "#0f172a" }}>{name}</strong>
                            <span style={{ fontSize: "0.74rem", color: "#64748b" }}>
                              Cuenta: {inst.numero_cuenta} {inst.comite ? `· Comité: ${inst.comite}` : ""}
                            </span>
                          </div>

                          <button
                            onClick={() => handleAddInstructor(inst.id)}
                            disabled={saving}
                            style={{
                              padding: "0.4rem 0.85rem",
                              borderRadius: "0.5rem",
                              border: "none",
                              background: "linear-gradient(135deg, #0d9488 0%, #0f766e 100%)",
                              color: "#ffffff",
                              fontSize: "0.78rem",
                              fontWeight: 700,
                              cursor: "pointer",
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "0.3rem",
                              boxShadow: "0 2px 6px rgba(13, 148, 136, 0.25)"
                            }}
                          >
                            <UserPlus size={14} />
                            Asignar
                          </button>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}
          </div>

          {/* =============================================================== */}
          {/* 2. LISTADO DE INSTRUCTORES ASIGNADOS CON BOTÓN DE QUITAR */}
          {/* =============================================================== */}
          <div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.75rem" }}>
              <h3 style={{ fontSize: "1rem", fontWeight: 800, color: "#0f172a", margin: 0, display: "flex", alignItems: "center", gap: "0.45rem" }}>
                <Users size={18} color="#0284c7" />
                Instructores Matriculados en esta Sección
              </h3>
              <span
                style={{
                  background: "#e0f2fe",
                  color: "#0369a1",
                  fontWeight: 700,
                  fontSize: "0.76rem",
                  padding: "0.2rem 0.6rem",
                  borderRadius: "9999px"
                }}
              >
                {assignedInstructors.length} {assignedInstructors.length === 1 ? "Instructor" : "Instructores"}
              </span>
            </div>

            {assignedInstructors.length === 0 ? (
              <div
                style={{
                  background: "#f8fafc",
                  borderRadius: "0.85rem",
                  border: "1px dashed #cbd5e1",
                  padding: "2.5rem 1.5rem",
                  textAlign: "center",
                  color: "#64748b"
                }}
              >
                <Users size={32} color="#94a3b8" style={{ marginBottom: "0.5rem" }} />
                <p style={{ margin: "0 0 0.25rem", fontSize: "0.95rem", fontWeight: 700, color: "#334155" }}>
                  Aún no hay instructores asignados a esta sección
                </p>
                <span style={{ fontSize: "0.82rem", color: "#64748b" }}>
                  Haz clic en el botón superior <strong>"Añadir Instructor"</strong> para matricular instructores en esta sección.
                </span>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
                {assignedInstructors.map((inst) => {
                  const name = `${inst.primer_nombre || ''} ${inst.primer_apellido || ''}`.trim() || inst.nombre_completo || "Instructor";
                  const isCoord = section.coordinador && section.coordinador.toLowerCase().includes((inst.primer_nombre || '').toLowerCase());

                  return (
                    <div
                      key={inst.id}
                      style={{
                        background: "#ffffff",
                        padding: "0.85rem 1rem",
                        borderRadius: "0.75rem",
                        border: "1px solid #e2e8f0",
                        boxShadow: "0 2px 6px rgba(0, 0, 0, 0.03)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: "1rem"
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                        <div
                          style={{
                            width: "38px",
                            height: "38px",
                            borderRadius: "50%",
                            background: "linear-gradient(135deg, #0284c7 0%, #0369a1 100%)",
                            color: "#ffffff",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontWeight: 800,
                            fontSize: "0.85rem"
                          }}
                        >
                          {name.charAt(0).toUpperCase()}
                        </div>

                        <div style={{ display: "flex", flexDirection: "column" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                            <strong style={{ fontSize: "0.92rem", color: "#0f172a" }}>{name}</strong>
                            {isCoord && (
                              <span
                                style={{
                                  background: "#fef3c7",
                                  color: "#b45309",
                                  fontSize: "0.68rem",
                                  fontWeight: 800,
                                  padding: "0.1rem 0.45rem",
                                  borderRadius: "4px",
                                  border: "1px solid #fde68a"
                                }}
                              >
                                Coordinador
                              </span>
                            )}
                          </div>
                          <span style={{ fontSize: "0.76rem", color: "#64748b" }}>
                            Cuenta: {inst.numero_cuenta} {inst.correo ? `· ${inst.correo}` : ""}
                          </span>
                        </div>
                      </div>

                      {/* Botón Quitar */}
                      <button
                        onClick={() => handleRemoveInstructor(inst.id)}
                        disabled={saving}
                        style={{
                          padding: "0.45rem 0.85rem",
                          borderRadius: "0.55rem",
                          border: "1px solid #fecaca",
                          background: "#fee2e2",
                          color: "#dc2626",
                          fontSize: "0.78rem",
                          fontWeight: 700,
                          cursor: "pointer",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "0.35rem",
                          transition: "all 0.15s ease"
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = "#fca5a5";
                          e.currentTarget.style.color = "#991b1b";
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = "#fee2e2";
                          e.currentTarget.style.color = "#dc2626";
                        }}
                        title="Quitar instructor de esta sección"
                      >
                        <Trash2 size={14} />
                        <span>Quitar</span>
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Pie del Modal */}
        <div
          style={{
            padding: "1rem 1.5rem",
            background: "#f8fafc",
            borderTop: "1px solid #e2e8f0",
            display: "flex",
            alignItems: "center",
            justifyContent: "flex-end"
          }}
        >
          <button
            onClick={() => {
              onSuccess();
              onClose();
            }}
            style={{
              padding: "0.6rem 1.25rem",
              borderRadius: "0.65rem",
              border: "1px solid #cbd5e1",
              background: "#ffffff",
              color: "#334155",
              fontSize: "0.88rem",
              fontWeight: 700,
              cursor: "pointer"
            }}
          >
            Listo / Cerrar
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}
