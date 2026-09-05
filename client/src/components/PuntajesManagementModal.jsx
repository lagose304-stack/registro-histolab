import React, { useState, useEffect, useMemo, useCallback } from "react";
import { createPortal } from "react-dom";
import {
  X,
  Award,
  BookOpen,
  FileCheck2,
  GraduationCap,
  Sparkles,
  Save,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Calculator
} from "lucide-react";
import { api } from "../services/api";

export default function PuntajesManagementModal({
  carrera = "Medicina",
  carreraConfig = {},
  onClose,
  notify = () => {}
}) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Semanas y temas de la carrera para calcular cantidades reales
  const [semanasConfig, setSemanasConfig] = useState([]);
  const [temasList, setTemasList] = useState([]);

  // Estados de puntajes (sin valores por defecto)
  const [notaManuales, setNotaManuales] = useState("");
  const [notaPruebas, setNotaPruebas] = useState("");
  const [examenesPuntajes, setExamenesPuntajes] = useState({});

  // Cargar datos de la carrera
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [resSemanas, resTemas, resPuntajes] = await Promise.all([
        api.semanas.getConfig(carrera).catch(() => ({ data: [] })),
        api.temario.getAll({ carrera }).catch(() => ({ data: [] })),
        api.temario.getPuntajes(carrera).catch(() => ({ data: null }))
      ]);

      if (resSemanas?.data) {
        setSemanasConfig(resSemanas.data);
      }
      if (resTemas?.data) {
        setTemasList(resTemas.data);
      }

      // Semanas de examen para esta carrera
      const exams = (resSemanas?.data || []).filter(
        (w) => Boolean(w.es_examen) || (w.temas || "").toUpperCase().includes("EXAMEN")
      );

      // Si ya existen puntajes guardados
      if (resPuntajes?.data) {
        const d = resPuntajes.data;
        setNotaManuales(
          d.nota_total_manuales !== null && d.nota_total_manuales !== undefined
            ? String(d.nota_total_manuales)
            : ""
        );
        setNotaPruebas(
          d.nota_total_pruebas !== null && d.nota_total_pruebas !== undefined
            ? String(d.nota_total_pruebas)
            : ""
        );
        const currentExams = d.examenes || {};

        const initEx = {};
        exams.forEach((w) => {
          const sem = String(w.numero_semana);
          initEx[sem] =
            currentExams[sem] !== undefined && currentExams[sem] !== null
              ? String(currentExams[sem])
              : "";
        });
        setExamenesPuntajes(initEx);
      } else {
        // Cero valores por defecto: campos limpios
        setNotaManuales("");
        setNotaPruebas("");
        const initEx = {};
        exams.forEach((w) => {
          initEx[String(w.numero_semana)] = "";
        });
        setExamenesPuntajes(initEx);
      }
    } catch (err) {
      console.error("Error al cargar configuración de puntajes:", err);
      notify("Error al cargar puntajes de la carrera", "error");
    } finally {
      setLoading(false);
    }
  }, [carrera, notify]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Semanas de examen que realmente existen para esta carrera
  const examWeeks = useMemo(() => {
    if (!Array.isArray(semanasConfig) || semanasConfig.length === 0) return [];
    return semanasConfig
      .filter((w) => Boolean(w.es_examen) || (w.temas || "").toUpperCase().includes("EXAMEN"))
      .sort((a, b) => Number(a.numero_semana) - Number(b.numero_semana));
  }, [semanasConfig]);

  // Temas que tienen manual evaluable
  const temasConManual = useMemo(() => {
    return temasList.filter((t) => t.tiene_manual !== false);
  }, [temasList]);

  // Semanas regulares de clase (sin examen) para pruebas
  const semanasRegulares = useMemo(() => {
    return semanasConfig.filter(
      (w) => !w.es_examen && !(w.temas || "").toUpperCase().includes("EXAMEN")
    );
  }, [semanasConfig]);

  // Cálculo reactivo del promedio por manual según el valor actual escrito
  const promedioPorManual = useMemo(() => {
    const count = temasConManual.length;
    if (!count) return null;
    const clean = String(notaManuales).trim();
    if (!clean) return null;
    const pts = parseFloat(clean);
    if (isNaN(pts) || pts <= 0) return null;
    const val = pts / count;
    return Math.round(val * 1000) / 1000;
  }, [temasConManual.length, notaManuales]);

  // Cálculo reactivo del promedio por prueba semanal según el valor actual escrito
  const promedioPorPrueba = useMemo(() => {
    const count = semanasRegulares.length;
    if (!count) return null;
    const clean = String(notaPruebas).trim();
    if (!clean) return null;
    const pts = parseFloat(clean);
    if (isNaN(pts) || pts <= 0) return null;
    const val = pts / count;
    return Math.round(val * 1000) / 1000;
  }, [semanasRegulares.length, notaPruebas]);

  // Manejo de cambio en inputs numéricos con soporte para hasta 3 decimales
  const handleDecimalChange = (raw, setter) => {
    const clean = String(raw).replace(",", ".");
    if (clean === "" || /^\d*(\.\d{0,3})?$/.test(clean)) {
      setter(clean);
    }
  };

  const handleExamScoreChange = (semNum, raw) => {
    const clean = String(raw).replace(",", ".");
    if (clean === "" || /^\d*(\.\d{0,3})?$/.test(clean)) {
      setExamenesPuntajes((prev) => ({
        ...prev,
        [String(semNum)]: clean
      }));
    }
  };

  // Suma de los exámenes ingresados
  const sumaExamenes = useMemo(() => {
    let sum = 0;
    Object.values(examenesPuntajes).forEach((val) => {
      sum += Number(val) || 0;
    });
    return Math.round(sum * 1000) / 1000;
  }, [examenesPuntajes]);

  // Cálculo del puntaje total en tiempo real (suma de manuales + pruebas + todos los exámenes)
  const totalCalculado = useMemo(() => {
    const m = Number(notaManuales) || 0;
    const p = Number(notaPruebas) || 0;
    return Math.round((m + p + sumaExamenes) * 1000) / 1000;
  }, [notaManuales, notaPruebas, sumaExamenes]);

  // Guardar puntajes
  const handleSave = async () => {
    const valManuales = Number(notaManuales) || 0;
    const valPruebas = Number(notaPruebas) || 0;

    const formattedExams = {};
    Object.entries(examenesPuntajes).forEach(([sem, val]) => {
      formattedExams[sem] = Math.round((Number(val) || 0) * 1000) / 1000;
    });

    setSaving(true);
    try {
      const payload = {
        nota_total_manuales: Math.round(valManuales * 1000) / 1000,
        nota_total_pruebas: Math.round(valPruebas * 1000) / 1000,
        examenes: formattedExams,
        puntaje_total: totalCalculado
      };

      const res = await api.temario.savePuntajes(carrera, payload);
      notify(res.message || `Puntajes de ${carrera} guardados exitosamente.`, "success");
      onClose();
    } catch (err) {
      console.error("Error al guardar puntajes:", err);
      notify(err.message || "Error al guardar los puntajes", "error");
    } finally {
      setSaving(false);
    }
  };

  // Helper para nombre visible de semana de examen
  const getExamTitle = (w, index) => {
    const custom = (w.nombre_semana || w.descripcion || "").trim();
    if (custom && !custom.toLowerCase().startsWith("semana")) {
      return custom;
    }
    return `Examen Parcial ${index + 1}`;
  };

  return createPortal(
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: "rgba(15, 23, 42, 0.65)",
        backdropFilter: "blur(5px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 9999,
        padding: "1rem"
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget && !saving) onClose();
      }}
    >
      <div
        style={{
          background: "#ffffff",
          borderRadius: "1.25rem",
          maxWidth: "680px",
          width: "100%",
          maxHeight: "92vh",
          display: "flex",
          flexDirection: "column",
          boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
          border: "1px solid #e2e8f0",
          overflow: "hidden",
          animation: "modalFadeIn 0.2s ease-out"
        }}
      >
        {/* Cabecera del Modal */}
        <div
          style={{
            padding: "1.25rem 1.75rem",
            borderBottom: "1px solid #e2e8f0",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            background: "#f8fafc"
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "0.85rem" }}>
            <div
              style={{
                width: "44px",
                height: "44px",
                borderRadius: "0.85rem",
                background: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
                color: "#ffffff",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: "0 4px 12px rgba(16, 185, 129, 0.25)"
              }}
            >
              <Award size={22} />
            </div>
            <div>
              <h3 style={{ fontSize: "1.2rem", fontWeight: 800, color: "#0f172a", margin: 0 }}>
                Administrar Puntaje por Carrera
              </h3>
              <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", marginTop: "0.2rem" }}>
                <span style={{ fontSize: "0.82rem", color: "#64748b" }}>Carrera seleccionada:</span>
                <span
                  style={{
                    background: carreraConfig.bg || "#f0fdf4",
                    border: `1px solid ${carreraConfig.border || "#bbf7d0"}`,
                    color: carreraConfig.color || "#16a34a",
                    fontWeight: 800,
                    fontSize: "0.78rem",
                    padding: "0.15rem 0.6rem",
                    borderRadius: "9999px"
                  }}
                >
                  {carreraConfig.icon || "🎓"} {carrera}
                </span>
              </div>
            </div>
          </div>

          <button
            onClick={onClose}
            disabled={saving}
            style={{
              background: "#ffffff",
              border: "1px solid #cbd5e1",
              borderRadius: "0.6rem",
              width: "34px",
              height: "34px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#64748b",
              cursor: "pointer",
              transition: "all 0.15s ease"
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Cuerpo del Modal con scroll */}
        <div
          style={{
            padding: "1.5rem 1.75rem",
            overflowY: "auto",
            display: "flex",
            flexDirection: "column",
            gap: "1.5rem"
          }}
        >
          {loading ? (
            <div style={{ padding: "3rem", textAlign: "center", color: "#64748b" }}>
              Cargando configuración de puntajes...
            </div>
          ) : (
            <>
              {/* Bloque 1: Nota Total de Manuales */}
              <div
                style={{
                  background: "#f0f9ff",
                  border: "1.5px solid #bae6fd",
                  borderRadius: "1rem",
                  padding: "1.25rem",
                  display: "flex",
                  flexDirection: "column",
                  gap: "0.75rem"
                }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "0.5rem" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
                    <BookOpen size={20} color="#0284c7" />
                    <div>
                      <strong style={{ fontSize: "0.98rem", color: "#0369a1", display: "block" }}>
                        Nota Total de Manuales
                      </strong>
                      <span style={{ fontSize: "0.76rem", color: "#0284c7" }}>
                        Puntaje total acumulado por todos los manuales de laboratorio
                      </span>
                    </div>
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                    <input
                      type="text"
                      value={notaManuales}
                      onChange={(e) => handleDecimalChange(e.target.value, setNotaManuales)}
                      placeholder="0.000"
                      style={{
                        width: "110px",
                        textAlign: "center",
                        fontWeight: 900,
                        fontSize: "1.15rem",
                        color: "#0369a1",
                        background: "#ffffff",
                        border: "2px solid #38bdf8",
                        borderRadius: "0.65rem",
                        padding: "0.45rem 0.5rem",
                        outline: "none"
                      }}
                    />
                    <span style={{ fontSize: "0.85rem", fontWeight: 800, color: "#0284c7" }}>pts</span>
                  </div>
                </div>

                <div style={{ fontSize: "0.76rem", color: "#075985", background: "#e0f2fe", padding: "0.45rem 0.85rem", borderRadius: "0.55rem", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "0.5rem" }}>
                  <span>ℹ️ Esta carrera tiene <strong>{temasConManual.length} temas con manual evaluable</strong> programados.</span>
                  {promedioPorManual !== null ? (
                    <span style={{ fontWeight: 800, color: "#0369a1" }}>
                      Equivale aprox. a <strong>{promedioPorManual} pts</strong> por manual.
                    </span>
                  ) : (
                    <span style={{ color: "#0284c7", opacity: 0.8, fontStyle: "italic" }}>
                      (Ingresa un puntaje para calcular el valor por manual)
                    </span>
                  )}
                </div>
              </div>

              {/* Bloque 2: Nota Total de Pruebas Semanales */}
              <div
                style={{
                  background: "#f0fdf4",
                  border: "1.5px solid #bbf7d0",
                  borderRadius: "1rem",
                  padding: "1.25rem",
                  display: "flex",
                  flexDirection: "column",
                  gap: "0.75rem"
                }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "0.5rem" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
                    <FileCheck2 size={20} color="#16a34a" />
                    <div>
                      <strong style={{ fontSize: "0.98rem", color: "#15803d", display: "block" }}>
                        Nota Total de Pruebas Semanales
                      </strong>
                      <span style={{ fontSize: "0.76rem", color: "#16a34a" }}>
                        Puntaje total acumulado por todos los reactivos/pruebas semanales
                      </span>
                    </div>
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                    <input
                      type="text"
                      value={notaPruebas}
                      onChange={(e) => handleDecimalChange(e.target.value, setNotaPruebas)}
                      placeholder="0.000"
                      style={{
                        width: "110px",
                        textAlign: "center",
                        fontWeight: 900,
                        fontSize: "1.15rem",
                        color: "#15803d",
                        background: "#ffffff",
                        border: "2px solid #4ade80",
                        borderRadius: "0.65rem",
                        padding: "0.45rem 0.5rem",
                        outline: "none"
                      }}
                    />
                    <span style={{ fontSize: "0.85rem", fontWeight: 800, color: "#16a34a" }}>pts</span>
                  </div>
                </div>

                <div style={{ fontSize: "0.76rem", color: "#14532d", background: "#dcfce7", padding: "0.45rem 0.85rem", borderRadius: "0.55rem", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "0.5rem" }}>
                  <span>ℹ️ Esta carrera tiene <strong>{semanasRegulares.length} semanas de clase regular</strong> para pruebas.</span>
                  {promedioPorPrueba !== null ? (
                    <span style={{ fontWeight: 800, color: "#15803d" }}>
                      Equivale aprox. a <strong>{promedioPorPrueba} pts</strong> por prueba semanal.
                    </span>
                  ) : (
                    <span style={{ color: "#16a34a", opacity: 0.8, fontStyle: "italic" }}>
                      (Ingresa un puntaje para calcular el valor por prueba semanal)
                    </span>
                  )}
                </div>
              </div>

              {/* Bloque 3: Nota Individual por Examen (Dinámico según exámenes de la carrera) */}
              <div
                style={{
                  background: "#faf5ff",
                  border: "1.5px solid #e9d5ff",
                  borderRadius: "1rem",
                  padding: "1.25rem",
                  display: "flex",
                  flexDirection: "column",
                  gap: "1rem"
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
                  <GraduationCap size={20} color="#7c3aed" />
                  <div>
                    <strong style={{ fontSize: "0.98rem", color: "#6d28d9", display: "block" }}>
                      Nota Individual por Examen Parcial
                    </strong>
                    <span style={{ fontSize: "0.76rem", color: "#7c3aed" }}>
                      Asigna el valor específico a cada examen existente en el calendario de {carrera}
                    </span>
                  </div>
                </div>

                {examWeeks.length === 0 ? (
                  <div style={{ padding: "1.25rem", textAlign: "center", background: "#ffffff", borderRadius: "0.75rem", border: "1px dashed #d8b4fe", color: "#7c3aed", fontSize: "0.82rem" }}>
                    No hay semanas marcadas como examen para esta carrera en el calendario. Puedes agregar semanas de examen desde la etiqueta <strong>"Administrar Semanas"</strong>.
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.65rem" }}>
                    {examWeeks.map((w, idx) => {
                      const semNum = String(w.numero_semana);
                      const title = getExamTitle(w, idx);
                      const val = examenesPuntajes[semNum] ?? "";

                      return (
                        <div
                          key={`exam_cfg_${semNum}`}
                          style={{
                            background: "#ffffff",
                            border: "1px solid #d8b4fe",
                            borderRadius: "0.75rem",
                            padding: "0.75rem 1rem",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            flexWrap: "wrap",
                            gap: "0.75rem"
                          }}
                        >
                          <div>
                            <span style={{ fontSize: "0.92rem", fontWeight: 800, color: "#4c1d95" }}>
                              {title}
                            </span>
                          </div>

                          <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                            <input
                              type="text"
                              value={val}
                              onChange={(e) => handleExamScoreChange(semNum, e.target.value)}
                              placeholder="0.000"
                              style={{
                                width: "100px",
                                textAlign: "center",
                                fontWeight: 900,
                                fontSize: "1.05rem",
                                color: "#581c87",
                                background: "#faf5ff",
                                border: "1.5px solid #c084fc",
                                borderRadius: "0.6rem",
                                padding: "0.35rem 0.5rem",
                                outline: "none"
                              }}
                            />
                            <span style={{ fontSize: "0.82rem", fontWeight: 800, color: "#6d28d9" }}>pts</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Bloque 4: Barra de Resumen del Puntaje Total Acumulado */}
              <div
                style={{
                  background: "#f8fafc",
                  border: "1.5px solid #cbd5e1",
                  borderRadius: "1rem",
                  padding: "1.1rem 1.35rem",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  flexWrap: "wrap",
                  gap: "0.85rem"
                }}
              >
                <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    <Calculator size={20} color="#0f172a" />
                    <strong style={{ fontSize: "0.95rem", color: "#0f172a" }}>
                      Puntaje Total Acumulado
                    </strong>
                  </div>

                  {/* Desglose en vivo de la suma */}
                  <div style={{ display: "flex", alignItems: "center", gap: "0.45rem", flexWrap: "wrap", fontSize: "0.78rem" }}>
                    <span style={{ color: "#0369a1", background: "#e0f2fe", padding: "0.2rem 0.55rem", borderRadius: "0.4rem", fontWeight: 700 }}>
                      Manuales: {Number(notaManuales) || 0} pts
                    </span>
                    <span style={{ color: "#64748b", fontWeight: 800 }}>+</span>
                    <span style={{ color: "#15803d", background: "#dcfce7", padding: "0.2rem 0.55rem", borderRadius: "0.4rem", fontWeight: 700 }}>
                      Pruebas: {Number(notaPruebas) || 0} pts
                    </span>
                    <span style={{ color: "#64748b", fontWeight: 800 }}>+</span>
                    <span style={{ color: "#6d28d9", background: "#ede9fe", padding: "0.2rem 0.55rem", borderRadius: "0.4rem", fontWeight: 700 }}>
                      Exámenes ({examWeeks.length}): {sumaExamenes} pts
                    </span>
                  </div>
                </div>

                <div
                  style={{
                    fontSize: "1.65rem",
                    fontWeight: 900,
                    color: "#0f172a",
                    background: "#ffffff",
                    padding: "0.4rem 1.15rem",
                    borderRadius: "0.75rem",
                    border: "2px solid #0f172a",
                    boxShadow: "0 2px 6px rgba(0, 0, 0, 0.04)"
                  }}
                >
                  {totalCalculado} <span style={{ fontSize: "0.85rem", color: "#64748b", fontWeight: 700 }}>pts</span>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Pie del Modal: Botones de Acción */}
        <div
          style={{
            padding: "1.1rem 1.75rem",
            borderTop: "1px solid #e2e8f0",
            display: "flex",
            alignItems: "center",
            justifyContent: "flex-end",
            gap: "0.85rem",
            background: "#f8fafc"
          }}
        >
          <button
            onClick={onClose}
            disabled={saving}
            style={{
              padding: "0.6rem 1.25rem",
              borderRadius: "0.75rem",
              background: "#ffffff",
              border: "1px solid #cbd5e1",
              color: "#334155",
              fontSize: "0.88rem",
              fontWeight: 700,
              cursor: "pointer"
            }}
          >
            Cancelar
          </button>

          <button
            onClick={handleSave}
            disabled={saving || loading}
            style={{
              padding: "0.6rem 1.5rem",
              borderRadius: "0.75rem",
              background: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
              border: "none",
              color: "#ffffff",
              fontSize: "0.88rem",
              fontWeight: 800,
              cursor: saving || loading ? "not-allowed" : "pointer",
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
              boxShadow: "0 4px 12px rgba(16, 185, 129, 0.3)"
            }}
          >
            <Save size={16} />
            <span>{saving ? "Guardando..." : "Guardar Puntajes"}</span>
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
