import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import {
  ArrowLeft,
  RefreshCw,
  Search,
  CheckCircle2,
  Clock,
  Award,
  Eye,
  MessageSquare,
  FileText,
  AlertCircle,
  HelpCircle,
  Sparkles,
  Check,
  X,
  Calendar,
  Send,
  User,
  GraduationCap,
  Trash2,
  ShieldAlert
} from "lucide-react";
import { api } from "../services/api";

export default function ReviewQuizSubmissionsView({
  seccion,
  currentInstructor,
  hideBackButton = false,
  onClose = () => {},
  notify = () => {}
}) {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedSemana, setSelectedSemana] = useState(1);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState("todos"); // 'todos' | 'pendientes' | 'calificados'

  const notifyRef = useRef(notify);
  notifyRef.current = notify;

  // Datos
  const [semanasConfig, setSemanasConfig] = useState([]);
  const [sectionQuizzes, setSectionQuizzes] = useState([]);
  const [entregasSemana, setEntregasSemana] = useState([]);
  const [quizSemanal, setQuizSemanal] = useState(null);

  // Modal de Calificación
  const [selectedEntrega, setSelectedEntrega] = useState(null);
  const [notaInput, setNotaInput] = useState("");
  const [notaRealInput, setNotaRealInput] = useState("");
  const [comentariosInput, setComentariosInput] = useState("");
  const [evaluaciones, setEvaluaciones] = useState({});
  const [savingGrade, setSavingGrade] = useState(false);
  const [gradeError, setGradeError] = useState("");

  const carrera = seccion?.carrera || "Medicina";

  // Cargar semanas configuradas y pruebas creadas de la sección
  const loadInitialData = useCallback(async () => {
    if (!seccion?.id) return;
    setLoading(true);
    try {
      const [resSemanas, resQuizzes] = await Promise.all([
        api.semanas.getConfig(carrera).catch(() => ({ data: [] })),
        api.pruebas.getBySeccion(seccion.id).catch(() => ({ data: [] }))
      ]);

      if (resSemanas?.data) setSemanasConfig(resSemanas.data);
      if (resQuizzes?.data && Array.isArray(resQuizzes.data)) {
        setSectionQuizzes(resQuizzes.data);
        // Seleccionar por defecto la primera semana que tenga prueba creada
        if (resQuizzes.data.length > 0) {
          const firstAvailable = resQuizzes.data[0].numero_semana;
          if (firstAvailable) setSelectedSemana(Number(firstAvailable));
        }
      }
    } catch (err) {
      console.error("Error al cargar datos en Revisar Respuestas:", err);
      notifyRef.current("Error al cargar la información inicial", "error");
    } finally {
      setLoading(false);
    }
  }, [seccion?.id, carrera]);

  useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);

  // Cargar entregas y detalle del cuestionario para la semana seleccionada
  const loadEntregasForSemana = useCallback(async (semana) => {
    if (!seccion?.id || !semana) return;
    setRefreshing(true);
    try {
      const [resEntregas, resQuiz] = await Promise.all([
        api.pruebas.getEntregas(seccion.id, semana).catch(() => ({ data: [] })),
        api.pruebas.getBySemana(seccion.id, semana).catch(() => ({ data: null }))
      ]);

      if (resEntregas?.data && Array.isArray(resEntregas.data)) {
        setEntregasSemana(resEntregas.data);
      } else {
        setEntregasSemana([]);
      }

      if (resQuiz?.data) {
        setQuizSemanal(resQuiz.data);
      } else {
        setQuizSemanal(null);
      }
    } catch (err) {
      console.warn("Aviso al consultar entregas de la semana:", err.message);
    } finally {
      setRefreshing(false);
    }
  }, [seccion?.id]);

  useEffect(() => {
    if (selectedSemana) {
      loadEntregasForSemana(selectedSemana);
    }
  }, [selectedSemana, loadEntregasForSemana]);

  // Semanas disponibles con prueba creada o configurada
  const availableWeeks = useMemo(() => {
    const weeks = [];
    // Priorizar semanas que tienen prueba creada
    const quizWeeks = new Set(sectionQuizzes.map((q) => Number(q.numero_semana)));
    
    // Agregar semanas configuradas
    semanasConfig.forEach((s) => {
      const num = Number(s.numero_semana);
      if (num && !s.es_examen) {
        weeks.push({
          numero_semana: num,
          nombre_semana: s.nombre_semana || `Semana ${num}`,
          tienePrueba: quizWeeks.has(num)
        });
      }
    });

    // Si no hay semanas configuradas, usar las semanas de sectionQuizzes
    if (weeks.length === 0 && sectionQuizzes.length > 0) {
      sectionQuizzes.forEach((q) => {
        const num = Number(q.numero_semana);
        if (num) {
          weeks.push({
            numero_semana: num,
            nombre_semana: `Semana ${num}`,
            tienePrueba: true
          });
        }
      });
    }

    // Fallback mínimo
    if (weeks.length === 0) {
      weeks.push({ numero_semana: 1, nombre_semana: "Semana 1", tienePrueba: false });
    }

    return weeks.sort((a, b) => a.numero_semana - b.numero_semana);
  }, [semanasConfig, sectionQuizzes]);

  // Filtrar entregas por buscador y estado
  const filteredEntregas = useMemo(() => {
    return entregasSemana.filter((ent) => {
      const q = searchTerm.toLowerCase().trim();
      const matchSearch =
        !q ||
        (ent.nombre_completo || "").toLowerCase().includes(q) ||
        (ent.numero_cuenta || "").toLowerCase().includes(q);

      if (!matchSearch) return false;

      if (filterStatus === "pendientes") return ent.estado !== "calificado";
      if (filterStatus === "calificados") return ent.estado === "calificado";
      return true;
    });
  }, [entregasSemana, searchTerm, filterStatus]);

  // Contadores de la semana
  const stats = useMemo(() => {
    const total = entregasSemana.length;
    const calificados = entregasSemana.filter((e) => e.estado === "calificado").length;
    const pendientes = total - calificados;
    return { total, calificados, pendientes };
  }, [entregasSemana]);

  // Abrir modal de calificación
  const handleOpenGradeModal = (entrega) => {
    setSelectedEntrega(entrega);
    const oficial =
      entrega.nota_obtenida !== null && entrega.nota_obtenida !== undefined
        ? Number(entrega.nota_obtenida)
        : null;
    const real =
      entrega.nota_real !== null && entrega.nota_real !== undefined
        ? Number(entrega.nota_real)
        : (entrega.nota_con_bonus !== null && entrega.nota_con_bonus !== undefined
            ? Number(entrega.nota_con_bonus)
            : (entrega.auditoria?.nota_real !== null && entrega.auditoria?.nota_real !== undefined
                ? Number(entrega.auditoria.nota_real)
                : oficial));

    setNotaInput(oficial !== null ? oficial.toFixed(3) : "");
    setNotaRealInput(real !== null ? real.toFixed(3) : "");
    setComentariosInput(entrega.comentarios || "");
    const initialEvals = entrega.evaluaciones_incisos || entrega.auditoria?.evaluaciones_incisos || {};
    setEvaluaciones(initialEvals);
    setGradeError("");
  };

  // Cerrar modal
  const handleCloseGradeModal = () => {
    setSelectedEntrega(null);
    setNotaInput("");
    setNotaRealInput("");
    setComentariosInput("");
    setEvaluaciones({});
    setGradeError("");
  };

  // Evaluar un ítem completo (texto corto o reactivo directo)
  const handleEvaluateItem = (preguntaId, itemId, status, maxPoints) => {
    const numMax = Number(maxPoints) || 0;
    let earned = 0;
    if (status === "buena") earned = numMax;
    else if (status === "regular") earned = Math.round((numMax / 2) * 1000) / 1000;
    else earned = 0;

    setEvaluaciones((prev) => {
      const key = itemId ? `${preguntaId}___${itemId}` : `${preguntaId}___direct`;
      const next = {
        ...prev,
        [key]: {
          estado: status,
          puntos_obtenidos: earned,
          puntos_max: numMax,
          pregunta_id: preguntaId,
          item_id: itemId || null
        }
      };

      // Recalcular la nota total sumando todas las evaluaciones activas
      const totalRaw = Object.values(next).reduce((sum, item) => sum + (Number(item.puntos_obtenidos) || 0), 0);
      const cleanRaw = Math.round(totalRaw * 1000) / 1000;
      const capped = Math.min(5.0, cleanRaw);
      setNotaInput(capped.toFixed(3));
      setNotaRealInput(cleanRaw.toFixed(3));
      return next;
    });
  };

  // Evaluar una casilla individual de un apartado tipo listado
  const handleEvaluateSlot = (preguntaId, itemId, slotIdx, status, slotMaxPoints) => {
    const numMax = Number(slotMaxPoints) || 0;
    let earned = 0;
    if (status === "buena") earned = numMax;
    else if (status === "regular") earned = Math.round((numMax / 2) * 1000) / 1000;
    else earned = 0;

    setEvaluaciones((prev) => {
      const clean = { ...prev };
      // Eliminar evaluación antigua global del apartado para evitar doble contabilización
      delete clean[`${preguntaId}___${itemId}`];

      const key = `${preguntaId}___${itemId}___slot_${slotIdx}`;
      const next = {
        ...clean,
        [key]: {
          estado: status,
          puntos_obtenidos: earned,
          puntos_max: numMax,
          pregunta_id: preguntaId,
          item_id: itemId,
          slot_idx: slotIdx
        }
      };

      const totalRaw = Object.values(next).reduce((sum, item) => sum + (Number(item.puntos_obtenidos) || 0), 0);
      const cleanRaw = Math.round(totalRaw * 1000) / 1000;
      const capped = Math.min(5.0, cleanRaw);
      setNotaInput(capped.toFixed(3));
      setNotaRealInput(cleanRaw.toFixed(3));
      return next;
    });
  };

  // Marcar todas las casillas de un apartado como Buenas o Malas de un solo clic
  const handleEvaluateAllSlotsInItem = (preguntaId, itemId, totalSlots, status, slotMaxPoints) => {
    const numMax = Number(slotMaxPoints) || 0;
    setEvaluaciones((prev) => {
      const clean = { ...prev };
      delete clean[`${preguntaId}___${itemId}`];

      for (let s = 0; s < totalSlots; s++) {
        let earned = 0;
        if (status === "buena") earned = numMax;
        else if (status === "regular") earned = Math.round((numMax / 2) * 1000) / 1000;
        else earned = 0;

        clean[`${preguntaId}___${itemId}___slot_${s}`] = {
          estado: status,
          puntos_obtenidos: earned,
          puntos_max: numMax,
          pregunta_id: preguntaId,
          item_id: itemId,
          slot_idx: s
        };
      }

      const totalRaw = Object.values(clean).reduce((sum, item) => sum + (Number(item.puntos_obtenidos) || 0), 0);
      const cleanRaw = Math.round(totalRaw * 1000) / 1000;
      const capped = Math.min(5.0, cleanRaw);
      setNotaInput(capped.toFixed(3));
      setNotaRealInput(cleanRaw.toFixed(3));
      return clean;
    });
  };

  // Marcar toda la prueba de un solo clic (desglosando casillas en listados)
  const handleMarkAll = (status) => {
    if (!quizSemanal?.preguntas) return;
    const next = {};
    let total = 0;

    quizSemanal.preguntas.forEach((pregunta) => {
      if (!pregunta.items || pregunta.items.length === 0) {
        const maxPts = Number(pregunta.puntos) || 1.0;
        let earned = 0;
        if (status === "buena") earned = maxPts;
        else if (status === "regular") earned = Math.round((maxPts / 2) * 1000) / 1000;
        total += earned;
        next[`${pregunta.id}___direct`] = {
          estado: status,
          puntos_obtenidos: earned,
          puntos_max: maxPts,
          pregunta_id: pregunta.id,
          item_id: null
        };
      } else {
        const defaultItemPts = Math.round((Number(pregunta.puntos || 1.0) / pregunta.items.length) * 1000) / 1000;
        pregunta.items.forEach((item) => {
          const maxPts = item.puntos !== undefined && !isNaN(Number(item.puntos)) ? Number(item.puntos) : defaultItemPts;
          const isList = item.tipo !== "texto_corto";
          const cantSlots = isList ? (parseInt(item.cantidad, 10) || 3) : 1;

          if (isList && cantSlots > 1) {
            const slotPts = Math.round((maxPts / cantSlots) * 1000) / 1000;
            for (let s = 0; s < cantSlots; s++) {
              let earned = 0;
              if (status === "buena") earned = slotPts;
              else if (status === "regular") earned = Math.round((slotPts / 2) * 1000) / 1000;
              total += earned;
              next[`${pregunta.id}___${item.id}___slot_${s}`] = {
                estado: status,
                puntos_obtenidos: earned,
                puntos_max: slotPts,
                pregunta_id: pregunta.id,
                item_id: item.id,
                slot_idx: s
              };
            }
          } else {
            let earned = 0;
            if (status === "buena") earned = maxPts;
            else if (status === "regular") earned = Math.round((maxPts / 2) * 1000) / 1000;
            total += earned;
            next[`${pregunta.id}___${item.id}`] = {
              estado: status,
              puntos_obtenidos: earned,
              puntos_max: maxPts,
              pregunta_id: pregunta.id,
              item_id: item.id
            };
          }
        });
      }
    });

    const cleanRaw = Math.round(total * 1000) / 1000;
    const capped = Math.min(5.0, cleanRaw);
    setEvaluaciones(next);
    setNotaInput(capped.toFixed(3));
    setNotaRealInput(cleanRaw.toFixed(3));
  };

  // Guardar calificación
  const handleSaveGrade = async (e) => {
    e.preventDefault();
    if (!selectedEntrega) return;

    const num = Number(notaInput);
    if (isNaN(num) || num < 0 || num > 5) {
      setGradeError("La nota oficial debe ser un número entre 0.000 y 5.000 puntos.");
      return;
    }

    setSavingGrade(true);
    setGradeError("");

    try {
      const cleanNotaOficial = Math.round(num * 1000) / 1000;
      const numReal = Number(notaRealInput);
      const cleanNotaReal = !isNaN(numReal) && numReal >= cleanNotaOficial
        ? Math.round(numReal * 1000) / 1000
        : cleanNotaOficial;

      const instructorName =
        currentInstructor?.nombre_completo ||
        `${currentInstructor?.primer_nombre || ""} ${currentInstructor?.primer_apellido || ""}`.trim() ||
        "Docente";

      const payload = {
        nota_obtenida: cleanNotaOficial,
        nota_real: cleanNotaReal,
        nota_con_bonus: cleanNotaReal,
        comentarios: comentariosInput.trim(),
        calificado_por: instructorName,
        carrera: seccion?.carrera || "Medicina",
        evaluaciones_incisos: evaluaciones
      };

      const res = await api.pruebas.calificar(selectedEntrega.id, payload);
      if (res?.success) {
        notifyRef.current(
          `¡Calificación guardada (${cleanNotaOficial.toFixed(3)} / 5.000 pts${cleanNotaReal > 5.0 ? ` • ${cleanNotaReal.toFixed(3)} pts con bonus` : ""}) para ${selectedEntrega.nombre_completo}!`,
          "success"
        );

        // Actualizar localmente la lista de entregas
        setEntregasSemana((prev) =>
          prev.map((it) =>
            it.id === selectedEntrega.id
              ? {
                  ...it,
                  nota_obtenida: cleanNotaOficial,
                  nota_real: cleanNotaReal,
                  nota_con_bonus: cleanNotaReal,
                  comentarios: payload.comentarios,
                  estado: "calificado",
                  calificado_por: instructorName,
                  evaluaciones_incisos: evaluaciones,
                  auditoria: {
                    ...(it.auditoria || {}),
                    evaluaciones_incisos: evaluaciones,
                    nota_real: cleanNotaReal
                  },
                  updated_at: new Date().toISOString()
                }
              : it
          )
        );

        handleCloseGradeModal();
      } else {
        setGradeError(res?.message || "Error al registrar la calificación.");
      }
    } catch (err) {
      console.error("Error al calificar entrega:", err);
      setGradeError(err.message || "Error de conexión al calificar.");
    } finally {
      setSavingGrade(false);
    }
  };

  // Eliminar entrega del estudiante (Habilitar que la vuelva a hacer)
  const handleDeleteSubmission = async () => {
    if (!selectedEntrega) return;

    const confirmDel = window.confirm(
      `¿Estás seguro de eliminar la entrega de ${selectedEntrega.nombre_completo || "este estudiante"}?\n\nEsta acción eliminará sus respuestas y le permitirá volver a realizar la prueba desde su portal de estudiante.`
    );
    if (!confirmDel) return;

    setSavingGrade(true);
    try {
      const res = await api.pruebas.deleteEntrega(selectedEntrega.id, {
        seccion_id: seccion?.id,
        semana: selectedSemana,
        numero_cuenta: selectedEntrega.numero_cuenta,
        carrera
      });

      if (res?.success) {
        notifyRef.current("Entrega eliminada con éxito. El estudiante ahora puede volver a realizar la prueba.", "success");
        setEntregasSemana((prev) => prev.filter((e) => e.id !== selectedEntrega.id));
        handleCloseGradeModal();
      } else {
        notifyRef.current(res?.message || "Error al eliminar la entrega", "error");
      }
    } catch (err) {
      console.error("Error al eliminar entrega:", err);
      notifyRef.current("Error al eliminar la entrega", "error");
    } finally {
      setSavingGrade(false);
    }
  };

  if (loading) {
    return (
      <div
        className="glass-panel"
        style={{
          padding: "3.5rem",
          background: "#ffffff",
          borderRadius: "1rem",
          border: "1px solid #e2e8f0",
          textAlign: "center",
          color: "#64748b",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "1rem"
        }}
      >
        <RefreshCw size={28} className="animate-spin" color="#0284c7" />
        <span style={{ fontSize: "0.95rem", fontWeight: 700 }}>
          Cargando módulo de revisión de respuestas...
        </span>
      </div>
    );
  }

  return (
    <div className="glass-panel animate-fade-in" style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      {/* 1. Cabecera Principal */}
      <div
        style={{
          padding: "1.5rem 1.75rem",
          background: "#ffffff",
          borderRadius: "1.1rem",
          border: "1px solid #e2e8f0",
          boxShadow: "0 4px 20px -2px rgba(0, 0, 0, 0.05)",
          display: "flex",
          flexDirection: "column",
          gap: "1.25rem"
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "1rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.85rem" }}>
            {!hideBackButton && (
              <button
                type="button"
                onClick={onClose}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: "38px",
                  height: "38px",
                  borderRadius: "0.6rem",
                  border: "1.5px solid #cbd5e1",
                  background: "#ffffff",
                  color: "#334155",
                  cursor: "pointer",
                  transition: "all 0.15s ease"
                }}
                title="Volver al panel de la sección"
              >
                <ArrowLeft size={20} />
              </button>
            )}

            <div
              style={{
                width: "44px",
                height: "44px",
                borderRadius: "0.75rem",
                background: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#ffffff",
                boxShadow: "0 4px 12px rgba(16, 185, 129, 0.25)"
              }}
            >
              <Award size={24} />
            </div>

            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
                <h2 style={{ margin: 0, fontSize: "1.3rem", fontWeight: 900, color: "#0f172a" }}>
                  Revisar Respuestas de Pruebas Semanales
                </h2>
                <span
                  style={{
                    background: "#ecfdf5",
                    color: "#047857",
                    fontWeight: 800,
                    fontSize: "0.75rem",
                    padding: "0.2rem 0.6rem",
                    borderRadius: "0.4rem",
                    border: "1px solid #a7f3d0"
                  }}
                >
                  {seccion?.codigo}
                </span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", fontSize: "0.82rem", color: "#64748b", marginTop: "0.2rem" }}>
                <span>{carrera}</span>
                <span>•</span>
                <span>Escala Oficial: <strong>0.000 a 5.000 pts</strong></span>
                <span>•</span>
                <span>La nota asignada se sincroniza al instante en el portal del alumno y el libro de calificaciones</span>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => loadEntregasForSemana(selectedSemana)}
            disabled={refreshing}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.4rem",
              padding: "0.5rem 1rem",
              borderRadius: "0.6rem",
              border: "1.5px solid #cbd5e1",
              background: "#ffffff",
              color: "#334155",
              fontSize: "0.82rem",
              fontWeight: 700,
              cursor: refreshing ? "not-allowed" : "pointer"
            }}
          >
            <RefreshCw size={15} className={refreshing ? "animate-spin" : ""} />
            <span>{refreshing ? "Actualizando..." : "Refrescar Entregas"}</span>
          </button>
        </div>

        {/* Selector de Semana en Formato Pills */}
        <div>
          <span style={{ fontSize: "0.76rem", fontWeight: 800, color: "#64748b", textTransform: "uppercase", display: "block", marginBottom: "0.5rem" }}>
            Selecciona la Semana a Revisar:
          </span>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", overflowX: "auto", paddingBottom: "0.25rem" }}>
            {availableWeeks.map((w) => {
              const isSelected = selectedSemana === w.numero_semana;
              return (
                <button
                  key={w.numero_semana}
                  type="button"
                  onClick={() => setSelectedSemana(w.numero_semana)}
                  style={{
                    padding: "0.55rem 1rem",
                    borderRadius: "0.6rem",
                    border: isSelected ? "2px solid #10b981" : "1.5px solid #e2e8f0",
                    background: isSelected ? "#ecfdf5" : "#ffffff",
                    color: isSelected ? "#065f46" : "#334155",
                    fontSize: "0.85rem",
                    fontWeight: isSelected ? 900 : 700,
                    cursor: "pointer",
                    whiteSpace: "nowrap",
                    display: "flex",
                    alignItems: "center",
                    gap: "0.45rem",
                    transition: "all 0.15s ease",
                    boxShadow: isSelected ? "0 2px 8px rgba(16, 185, 129, 0.15)" : "none"
                  }}
                >
                  <span>{w.nombre_semana}</span>
                  {w.tienePrueba && (
                    <span
                      style={{
                        fontSize: "0.65rem",
                        padding: "0.1rem 0.35rem",
                        borderRadius: "9999px",
                        background: isSelected ? "#059669" : "#e2e8f0",
                        color: isSelected ? "#ffffff" : "#475569",
                        fontWeight: 800
                      }}
                    >
                      Prueba
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Métricas de la Semana Seleccionada */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
            gap: "0.85rem"
          }}
        >
          <div style={{ padding: "0.85rem 1.1rem", borderRadius: "0.75rem", background: "#f8fafc", border: "1px solid #e2e8f0" }}>
            <span style={{ fontSize: "0.72rem", color: "#64748b", fontWeight: 700, textTransform: "uppercase" }}>
              Total Entregas Recibidas
            </span>
            <div style={{ fontSize: "1.4rem", fontWeight: 900, color: "#0f172a", marginTop: "0.15rem" }}>
              {stats.total} {stats.total === 1 ? "alumno" : "alumnos"}
            </div>
          </div>

          <div style={{ padding: "0.85rem 1.1rem", borderRadius: "0.75rem", background: "#fffbeb", border: "1px solid #fde68a" }}>
            <span style={{ fontSize: "0.72rem", color: "#b45309", fontWeight: 800, textTransform: "uppercase" }}>
              ⏳ Pendientes de Calificar
            </span>
            <div style={{ fontSize: "1.4rem", fontWeight: 900, color: "#b45309", marginTop: "0.15rem" }}>
              {stats.pendientes}
            </div>
          </div>

          <div style={{ padding: "0.85rem 1.1rem", borderRadius: "0.75rem", background: "#ecfdf5", border: "1px solid #a7f3d0" }}>
            <span style={{ fontSize: "0.72rem", color: "#047857", fontWeight: 800, textTransform: "uppercase" }}>
              ✅ Pruebas Calificadas
            </span>
            <div style={{ fontSize: "1.4rem", fontWeight: 900, color: "#047857", marginTop: "0.15rem" }}>
              {stats.calificados}
            </div>
          </div>
        </div>
      </div>

      {/* 2. Filtros y Búsqueda */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: "1rem",
          background: "#ffffff",
          padding: "1rem 1.25rem",
          borderRadius: "0.9rem",
          border: "1px solid #e2e8f0"
        }}
      >
        <div style={{ position: "relative", minWidth: "260px", flex: 1 }}>
          <Search size={16} color="#94a3b8" style={{ position: "absolute", left: "0.75rem", top: "50%", transform: "translateY(-50%)" }} />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar estudiante por nombre o número de cuenta..."
            style={{
              width: "100%",
              padding: "0.55rem 0.75rem 0.55rem 2.2rem",
              borderRadius: "0.55rem",
              border: "1.5px solid #cbd5e1",
              fontSize: "0.85rem",
              outline: "none"
            }}
          />
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <button
            type="button"
            onClick={() => setFilterStatus("todos")}
            style={{
              padding: "0.45rem 0.85rem",
              borderRadius: "0.5rem",
              border: filterStatus === "todos" ? "1.5px solid #0284c7" : "1px solid #cbd5e1",
              background: filterStatus === "todos" ? "#f0f9ff" : "#ffffff",
              color: filterStatus === "todos" ? "#0284c7" : "#475569",
              fontSize: "0.8rem",
              fontWeight: 800,
              cursor: "pointer"
            }}
          >
            Todos ({stats.total})
          </button>
          <button
            type="button"
            onClick={() => setFilterStatus("pendientes")}
            style={{
              padding: "0.45rem 0.85rem",
              borderRadius: "0.5rem",
              border: filterStatus === "pendientes" ? "1.5px solid #f59e0b" : "1px solid #cbd5e1",
              background: filterStatus === "pendientes" ? "#fffbeb" : "#ffffff",
              color: filterStatus === "pendientes" ? "#b45309" : "#475569",
              fontSize: "0.8rem",
              fontWeight: 800,
              cursor: "pointer"
            }}
          >
            Pendientes ({stats.pendientes})
          </button>
          <button
            type="button"
            onClick={() => setFilterStatus("calificados")}
            style={{
              padding: "0.45rem 0.85rem",
              borderRadius: "0.5rem",
              border: filterStatus === "calificados" ? "1.5px solid #10b981" : "1px solid #cbd5e1",
              background: filterStatus === "calificados" ? "#ecfdf5" : "#ffffff",
              color: filterStatus === "calificados" ? "#047857" : "#475569",
              fontSize: "0.8rem",
              fontWeight: 800,
              cursor: "pointer"
            }}
          >
            Calificados ({stats.calificados})
          </button>
        </div>
      </div>

      {/* 3. Listado de Entregas */}
      {filteredEntregas.length === 0 ? (
        <div
          style={{
            padding: "3.5rem",
            background: "#ffffff",
            borderRadius: "1rem",
            border: "1px solid #e2e8f0",
            textAlign: "center",
            color: "#64748b"
          }}
        >
          <HelpCircle size={38} color="#94a3b8" style={{ margin: "0 auto 0.75rem" }} />
          <h4 style={{ margin: "0 0 0.35rem", fontSize: "1.05rem", fontWeight: 800, color: "#0f172a" }}>
            No se encontraron entregas de estudiantes
          </h4>
          <p style={{ margin: 0, fontSize: "0.85rem" }}>
            {entregasSemana.length === 0
              ? `Aún ningún alumno ha enviado la prueba de la Semana ${selectedSemana}.`
              : "No hay entregas que coincidan con los filtros aplicados."}
          </p>
        </div>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
            gap: "1.25rem"
          }}
        >
          {filteredEntregas.map((entrega) => {
            const isGraded = entrega.estado === "calificado";

            return (
              <div
                key={entrega.id}
                style={{
                  background: "#ffffff",
                  borderRadius: "1rem",
                  border: isGraded ? "1.5px solid #86efac" : "1.5px solid #fde68a",
                  boxShadow: "0 4px 14px -2px rgba(0, 0, 0, 0.04)",
                  padding: "1.4rem",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                  gap: "1.1rem"
                }}
              >
                <div>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.5rem" }}>
                    <span
                      style={{
                        fontSize: "0.72rem",
                        fontWeight: 800,
                        padding: "0.2rem 0.55rem",
                        borderRadius: "9999px",
                        background: isGraded ? "#ecfdf5" : "#fffbeb",
                        color: isGraded ? "#15803d" : "#b45309",
                        border: isGraded ? "1px solid #86efac" : "1px solid #fde047"
                      }}
                    >
                      {isGraded ? "✅ Calificada" : "⏳ Pendiente"}
                    </span>

                    {entrega.fecha_envio && (
                      <span style={{ fontSize: "0.74rem", color: "#64748b", fontWeight: 600 }}>
                        {new Date(entrega.fecha_envio).toLocaleDateString("es-HN", {
                          day: "2-digit",
                          month: "short",
                          hour: "2-digit",
                          minute: "2-digit"
                        })}
                      </span>
                    )}
                  </div>

                  <h3 style={{ margin: "0 0 0.25rem", fontSize: "1.1rem", fontWeight: 900, color: "#0f172a" }}>
                    {entrega.nombre_completo || "Estudiante"}
                  </h3>
                  <div style={{ fontSize: "0.82rem", color: "#64748b", fontWeight: 700 }}>
                    Cuenta: <span style={{ color: "#0284c7" }}>{entrega.numero_cuenta}</span>
                  </div>

                  {/* Badge de Integridad Académica */}
                  {entrega.auditoria && (
                    <div style={{ marginTop: "0.55rem" }}>
                      {entrega.auditoria.strikes >= 3 || entrega.auditoria.motivo_finalizacion === "expulsion_infracciones" ? (
                        <span
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "0.3rem",
                            fontSize: "0.72rem",
                            fontWeight: 800,
                            padding: "0.2rem 0.5rem",
                            borderRadius: "0.4rem",
                            background: "#fef2f2",
                            color: "#b91c1c",
                            border: "1px solid #fecaca"
                          }}
                          title={`Auto-envío por 3 infracciones. ${entrega.auditoria.tiempo_fuera_segundos || 0}s fuera de pantalla`}
                        >
                          <ShieldAlert size={12} />
                          <span>Infracción Crítica ({entrega.auditoria.strikes} salidas • {entrega.auditoria.tiempo_fuera_segundos || 0}s fuera)</span>
                        </span>
                      ) : entrega.auditoria.strikes > 0 ? (
                        <span
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "0.3rem",
                            fontSize: "0.72rem",
                            fontWeight: 800,
                            padding: "0.2rem 0.5rem",
                            borderRadius: "0.4rem",
                            background: "#fffbeb",
                            color: "#b45309",
                            border: "1px solid #fde68a"
                          }}
                          title={`${entrega.auditoria.strikes} salida(s) de pantalla detectadas (${entrega.auditoria.tiempo_fuera_segundos || 0}s)`}
                        >
                          <AlertCircle size={12} />
                          <span>{entrega.auditoria.strikes} salida(s) detectadas ({entrega.auditoria.tiempo_fuera_segundos || 0}s fuera)</span>
                        </span>
                      ) : (
                        <span
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "0.3rem",
                            fontSize: "0.72rem",
                            fontWeight: 800,
                            padding: "0.2rem 0.5rem",
                            borderRadius: "0.4rem",
                            background: "#f0fdf4",
                            color: "#16a34a",
                            border: "1px solid #bbf7d0"
                          }}
                          title="Sin salidas de pantalla ni infracciones detectadas"
                        >
                          <CheckCircle2 size={12} />
                          <span>100% Limpio (Sin salidas)</span>
                        </span>
                      )}

                      {entrega.auditoria?.sincronizada_offline && (
                        <span
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "0.25rem",
                            fontSize: "0.7rem",
                            fontWeight: 800,
                            padding: "0.15rem 0.45rem",
                            borderRadius: "0.35rem",
                            background: "#fff7ed",
                            color: "#c2410c",
                            border: "1px solid #fed7aa"
                          }}
                          title="Esta prueba se selló localmente sin conexión y se sincronizó al regresar la red"
                        >
                          📶 Sincronizada Offline
                        </span>
                      )}
                    </div>
                  )}

                  {/* Nota Actual si ya fue calificada */}
                  <div
                    style={{
                      marginTop: "0.85rem",
                      padding: "0.65rem 0.85rem",
                      borderRadius: "0.55rem",
                      background: isGraded ? "#f0fdf4" : "#f8fafc",
                      border: isGraded ? "1px solid #bbf7d0" : "1px solid #e2e8f0",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between"
                    }}
                  >
                    <span style={{ fontSize: "0.78rem", fontWeight: 700, color: "#64748b" }}>
                      Calificación Oficial:
                    </span>
                    <strong
                      style={{
                        fontSize: "1.05rem",
                        fontWeight: 900,
                        color: isGraded ? "#15803d" : "#64748b"
                      }}
                    >
                      {isGraded
                        ? `${Number(entrega.nota_obtenida).toFixed(3)} / 5.000 pts`
                        : "Sin calificar"}
                    </strong>
                  </div>

                  {isGraded && Number(entrega.nota_real || entrega.nota_con_bonus || entrega.auditoria?.nota_real || 0) > 5.0 && (
                    <div
                      style={{
                        marginTop: "0.45rem",
                        padding: "0.4rem 0.75rem",
                        borderRadius: "0.5rem",
                        background: "#fef3c7",
                        border: "1px solid #fde68a",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between"
                      }}
                    >
                      <span style={{ fontSize: "0.72rem", fontWeight: 800, color: "#b45309" }}>
                        ⭐ Puntaje con Bonus (Premios):
                      </span>
                      <strong style={{ fontSize: "0.88rem", fontWeight: 900, color: "#b45309" }}>
                        {Number(entrega.nota_real || entrega.nota_con_bonus || entrega.auditoria?.nota_real).toFixed(3)} pts
                      </strong>
                    </div>
                  )}

                  {entrega.comentarios && (
                    <div
                      style={{
                        marginTop: "0.6rem",
                        fontSize: "0.78rem",
                        color: "#166534",
                        background: "#ecfdf5",
                        padding: "0.5rem 0.75rem",
                        borderRadius: "0.45rem",
                        lineHeight: 1.35
                      }}
                    >
                      💬 <em>{entrega.comentarios}</em>
                    </div>
                  )}
                </div>

                {/* Botón de Acción */}
                <button
                  type="button"
                  onClick={() => handleOpenGradeModal(entrega)}
                  style={{
                    width: "100%",
                    padding: "0.65rem",
                    borderRadius: "0.65rem",
                    border: "none",
                    background: isGraded
                      ? "linear-gradient(135deg, #0284c7 0%, #0369a1 100%)"
                      : "linear-gradient(135deg, #10b981 0%, #059669 100%)",
                    color: "#ffffff",
                    fontSize: "0.88rem",
                    fontWeight: 800,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "0.45rem",
                    boxShadow: isGraded
                      ? "0 4px 12px rgba(2, 132, 199, 0.25)"
                      : "0 4px 12px rgba(16, 185, 129, 0.25)",
                    transition: "all 0.15s ease"
                  }}
                >
                  <Eye size={16} />
                  <span>{isGraded ? "Editar Calificación y Respuestas" : "Revisar y Calificar Respuestas"}</span>
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* =================================================================== */}
      {/* 4. MODAL INTERACTIVO DE REVISIÓN Y CALIFICACIÓN                      */}
      {/* =================================================================== */}
      {selectedEntrega && (
        <div
          className="animate-fade-in"
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15, 23, 42, 0.7)",
            backdropFilter: "blur(4px)",
            zIndex: 9999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "1rem"
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget && !savingGrade) handleCloseGradeModal();
          }}
        >
          <div
            style={{
              background: "#ffffff",
              borderRadius: "1.2rem",
              width: "100%",
              maxWidth: "850px",
              maxHeight: "90vh",
              display: "flex",
              flexDirection: "column",
              boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
              overflow: "hidden"
            }}
          >
            {/* Header del Modal */}
            <div
              style={{
                padding: "1.25rem 1.5rem",
                borderBottom: "1.5px solid #e2e8f0",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                background: "#f8fafc"
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                <div
                  style={{
                    width: "42px",
                    height: "42px",
                    borderRadius: "0.65rem",
                    background: "#0284c7",
                    color: "#ffffff",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center"
                  }}
                >
                  <Award size={22} />
                </div>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    <h3 style={{ margin: 0, fontSize: "1.15rem", fontWeight: 900, color: "#0f172a" }}>
                      Revisión de Prueba: {selectedEntrega.nombre_completo}
                    </h3>
                    <span
                      style={{
                        fontSize: "0.72rem",
                        fontWeight: 800,
                        padding: "0.15rem 0.5rem",
                        borderRadius: "9999px",
                        background: "#eff6ff",
                        color: "#1d4ed8"
                      }}
                    >
                      Semana {selectedSemana}
                    </span>
                  </div>
                  <span style={{ fontSize: "0.8rem", color: "#64748b" }}>
                    Cuenta: <strong>{selectedEntrega.numero_cuenta}</strong> • {carrera}
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={handleCloseGradeModal}
                disabled={savingGrade}
                style={{
                  background: "transparent",
                  border: "none",
                  color: "#64748b",
                  cursor: "pointer",
                  padding: "0.4rem",
                  borderRadius: "0.4rem"
                }}
              >
                <X size={22} />
              </button>
            </div>

            {/* Contenido / Respuestas del Alumno */}
            <div
              style={{
                padding: "1.5rem",
                overflowY: "auto",
                flex: 1,
                display: "flex",
                flexDirection: "column",
                gap: "1.5rem"
              }}
            >
              {/* Información de la prueba con acciones de calificación rápida */}
              <div
                style={{
                  background: "#f0f9ff",
                  border: "1px solid #bae6fd",
                  padding: "0.85rem 1.1rem",
                  borderRadius: "0.75rem",
                  fontSize: "0.85rem",
                  color: "#0369a1",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  flexWrap: "wrap",
                  gap: "0.6rem"
                }}
              >
                <div>
                  <strong>{quizSemanal?.titulo || `Prueba Semanal ${selectedSemana}`}</strong>
                  {quizSemanal?.instrucciones && (
                    <div style={{ marginTop: "0.2rem", fontSize: "0.8rem", color: "#0284c7" }}>
                      {quizSemanal.instrucciones}
                    </div>
                  )}
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
                  <button
                    type="button"
                    onClick={() => handleMarkAll("buena")}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "0.25rem",
                      padding: "0.35rem 0.75rem",
                      borderRadius: "0.45rem",
                      background: "#dcfce7",
                      border: "1.5px solid #86efac",
                      color: "#15803d",
                      fontSize: "0.78rem",
                      fontWeight: 800,
                      cursor: "pointer"
                    }}
                    title="Marcar todos los reactivos como buenos automáticamente"
                  >
                    <Check size={14} strokeWidth={2.5} />
                    <span>✓ Todo Bueno</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleMarkAll("mala")}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "0.25rem",
                      padding: "0.35rem 0.75rem",
                      borderRadius: "0.45rem",
                      background: "#fee2e2",
                      border: "1.5px solid #fca5a5",
                      color: "#dc2626",
                      fontSize: "0.78rem",
                      fontWeight: 800,
                      cursor: "pointer"
                    }}
                    title="Poner en 0 todos los reactivos"
                  >
                    <X size={14} strokeWidth={2.5} />
                    <span>✗ Todo Malo</span>
                  </button>

                  <span
                    style={{
                      fontWeight: 900,
                      background: "#ffffff",
                      padding: "0.3rem 0.75rem",
                      borderRadius: "0.45rem",
                      border: "1.5px solid #0284c7",
                      color: "#0369a1",
                      fontSize: "0.84rem"
                    }}
                  >
                    Σ Puntos: {notaInput ? `${notaInput} / 5.000` : "0.000 / 5.000"}
                  </span>
                </div>
              </div>

              {/* Panel de Auditoría e Integridad Académica del Intento */}
              {selectedEntrega.auditoria && (
                <div
                  style={{
                    background:
                      selectedEntrega.auditoria.strikes >= 3 || selectedEntrega.auditoria.motivo_finalizacion === "expulsion_infracciones"
                        ? "#fef2f2"
                        : selectedEntrega.auditoria.strikes > 0
                        ? "#fffbeb"
                        : "#f0fdf4",
                    border:
                      selectedEntrega.auditoria.strikes >= 3 || selectedEntrega.auditoria.motivo_finalizacion === "expulsion_infracciones"
                        ? "1.5px solid #fca5a5"
                        : selectedEntrega.auditoria.strikes > 0
                        ? "1.5px solid #fde68a"
                        : "1.5px solid #bbf7d0",
                    borderRadius: "0.75rem",
                    padding: "0.9rem 1.1rem",
                    display: "flex",
                    flexDirection: "column",
                    gap: "0.6rem"
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "0.5rem" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.45rem" }}>
                      <ShieldAlert
                        size={18}
                        color={
                          selectedEntrega.auditoria.strikes >= 3 || selectedEntrega.auditoria.motivo_finalizacion === "expulsion_infracciones"
                            ? "#dc2626"
                            : selectedEntrega.auditoria.strikes > 0
                            ? "#d97706"
                            : "#16a34a"
                        }
                      />
                      <strong
                        style={{
                          fontSize: "0.88rem",
                          color:
                            selectedEntrega.auditoria.strikes >= 3 || selectedEntrega.auditoria.motivo_finalizacion === "expulsion_infracciones"
                              ? "#991b1b"
                              : selectedEntrega.auditoria.strikes > 0
                              ? "#92400e"
                              : "#166534"
                        }}
                      >
                        Auditoría de Seguridad e Integridad del Intento
                      </strong>
                    </div>

                    <span
                      style={{
                        fontSize: "0.76rem",
                        fontWeight: 800,
                        padding: "0.15rem 0.55rem",
                        borderRadius: "0.4rem",
                        background: "#ffffff",
                        color:
                          selectedEntrega.auditoria.strikes >= 3 || selectedEntrega.auditoria.motivo_finalizacion === "expulsion_infracciones"
                            ? "#dc2626"
                            : selectedEntrega.auditoria.strikes > 0
                            ? "#b45309"
                            : "#15803d"
                      }}
                    >
                      {selectedEntrega.auditoria.motivo_finalizacion === "expulsion_infracciones"
                        ? "🚨 Auto-envío por 3 infracciones de salida"
                        : selectedEntrega.auditoria.motivo_finalizacion === "tiempo_agotado"
                        ? "⏳ Auto-envío por tiempo límite agotado"
                        : "✅ Finalizada y enviada por el estudiante"}
                    </span>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: "0.6rem", fontSize: "0.8rem" }}>
                    <div style={{ background: "#ffffff", padding: "0.45rem 0.7rem", borderRadius: "0.45rem", border: "1px solid rgba(0,0,0,0.06)" }}>
                      <span style={{ color: "#64748b" }}>Duración real:</span>{" "}
                      <strong style={{ color: "#0f172a" }}>
                        {selectedEntrega.auditoria.duracion_total_segundos
                          ? `${Math.floor(selectedEntrega.auditoria.duracion_total_segundos / 60)}m ${selectedEntrega.auditoria.duracion_total_segundos % 60}s`
                          : "No registrado"}
                      </strong>
                    </div>

                    <div style={{ background: "#ffffff", padding: "0.45rem 0.7rem", borderRadius: "0.45rem", border: "1px solid rgba(0,0,0,0.06)" }}>
                      <span style={{ color: "#64748b" }}>Salidas de app:</span>{" "}
                      <strong
                        style={{
                          color: selectedEntrega.auditoria.strikes > 0 ? "#dc2626" : "#16a34a"
                        }}
                      >
                        {selectedEntrega.auditoria.strikes || 0} advertencias ({selectedEntrega.auditoria.tiempo_fuera_segundos || 0}s fuera)
                      </strong>
                    </div>

                    <div style={{ background: "#ffffff", padding: "0.45rem 0.7rem", borderRadius: "0.45rem", border: "1px solid rgba(0,0,0,0.06)" }}>
                      <span style={{ color: "#64748b" }}>Conectividad:</span>{" "}
                      <strong
                        style={{
                          color: selectedEntrega.auditoria.sincronizada_offline ? "#b45309" : "#16a34a"
                        }}
                      >
                        {selectedEntrega.auditoria.sincronizada_offline
                          ? "📶 Sincronizado tras reconexión"
                          : selectedEntrega.auditoria.conexion_al_enviar === "offline"
                          ? "📵 Sellado Offline"
                          : "🟢 Conexión Continua"}
                      </strong>
                    </div>

                    {selectedEntrega.auditoria.hora_recepcion_servidor && (
                      <div style={{ background: "#ffffff", padding: "0.45rem 0.7rem", borderRadius: "0.45rem", border: "1px solid rgba(0,0,0,0.06)" }}>
                        <span style={{ color: "#64748b" }}>Sello Servidor:</span>{" "}
                        <strong style={{ color: "#0f172a" }}>
                          {new Date(selectedEntrega.auditoria.hora_recepcion_servidor).toLocaleTimeString()}
                        </strong>
                      </div>
                    )}
                  </div>

                  {Array.isArray(selectedEntrega.auditoria.incidentes) && selectedEntrega.auditoria.incidentes.length > 0 && (
                    <div style={{ marginTop: "0.2rem", fontSize: "0.76rem", color: "#475569" }}>
                      <strong>Historial de incidencias:</strong>
                      <ul style={{ margin: "0.25rem 0 0", paddingLeft: "1.2rem", lineHeight: 1.4 }}>
                        {selectedEntrega.auditoria.incidentes.map((inc, iIdx) => (
                          <li key={iIdx}>
                            {inc.hora}: {inc.detalle || inc.tipo}{inc.segundosFuera ? ` (${inc.segundosFuera}s)` : ""}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}

              {/* Listado de Preguntas y Respuestas */}
              {(!quizSemanal?.preguntas || quizSemanal.preguntas.length === 0) ? (
                <div style={{ textAlign: "center", padding: "2rem", color: "#64748b" }}>
                  No se encontró el desglose de preguntas original para esta prueba.
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
                  {quizSemanal.preguntas.map((pregunta, qIdx) => (
                    <div
                      key={pregunta.id}
                      style={{
                        padding: "1.25rem",
                        borderRadius: "0.85rem",
                        border: "1.5px solid #e2e8f0",
                        background: "#ffffff",
                        display: "flex",
                        flexDirection: "column",
                        gap: "0.85rem"
                      }}
                    >
                      {/* Enunciado */}
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "0.75rem" }}>
                        <div style={{ fontSize: "0.96rem", fontWeight: 800, color: "#0f172a" }}>
                          <span style={{ color: "#0284c7", fontWeight: 900, marginRight: "0.4rem" }}>
                            {pregunta.enunciado ? `${pregunta.numero || qIdx + 1}.` : `Pregunta ${pregunta.numero || qIdx + 1}:`}
                          </span>
                          {pregunta.enunciado || ""}
                        </div>
                        {(pregunta.es_bonus || qIdx === 5) && (
                          <span
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "0.25rem",
                              background: "#fef3c7",
                              color: "#b45309",
                              border: "1px solid #fde68a",
                              padding: "0.2rem 0.6rem",
                              borderRadius: "9999px",
                              fontSize: "0.72rem",
                              fontWeight: 800,
                              whiteSpace: "nowrap"
                            }}
                          >
                            ⭐ Pregunta Bonus (+1.0 pt extra)
                          </span>
                        )}
                      </div>

                      {/* Imagen / Micrografía si existe */}
                      {pregunta.imagen_url && (
                        <div style={{ textAlign: "center", background: "#0f172a", padding: "0.5rem", borderRadius: "0.6rem" }}>
                          <img
                            src={pregunta.imagen_url}
                            alt="Micrografía"
                            style={{ maxHeight: "220px", maxWidth: "100%", objectFit: "contain", borderRadius: "0.4rem" }}
                          />
                        </div>
                      )}

                      {/* Incisos respondidos por el alumno */}
                      <div style={{ display: "flex", flexDirection: "column", gap: "0.85rem" }}>
                        {(() => {
                          const entregaRespuestas =
                            typeof selectedEntrega.respuestas === "string"
                              ? JSON.parse(selectedEntrega.respuestas || "{}")
                              : (selectedEntrega.respuestas || {});

                          if (!pregunta.items || pregunta.items.length === 0) {
                            const directAnswer =
                              entregaRespuestas?.[pregunta.id]?.respuesta ??
                              entregaRespuestas?.[pregunta.id] ??
                              null;
                            const maxPts = Number(pregunta.puntos) || 1.0;
                            const currentEval = evaluaciones[`${pregunta.id}___direct`];

                            return (
                              <div
                                style={{
                                  padding: "0.85rem 1rem",
                                  borderRadius: "0.65rem",
                                  background: "#f8fafc",
                                  border: "1px solid #e2e8f0",
                                  display: "flex",
                                  flexDirection: "column",
                                  gap: "0.65rem"
                                }}
                              >
                                <div style={{ padding: "0.6rem 0.8rem", borderRadius: "0.5rem", background: "#ffffff", border: "1.5px solid #bae6fd" }}>
                                  <span style={{ fontSize: "0.72rem", fontWeight: 800, color: "#0284c7", textTransform: "uppercase", display: "block", marginBottom: "0.2rem" }}>
                                    ✍️ Respuesta del Alumno:
                                  </span>
                                  <div style={{ fontSize: "0.9rem", fontWeight: 700, color: "#0f172a" }}>
                                    {typeof directAnswer === "string" && directAnswer.trim() ? (
                                      directAnswer
                                    ) : (
                                      <span style={{ color: "#94a3b8", fontStyle: "italic" }}>Sin respuesta enviada</span>
                                    )}
                                  </div>
                                </div>

                                {/* Barra de evaluación interactiva */}
                                <div
                                  style={{
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "space-between",
                                    flexWrap: "wrap",
                                    gap: "0.5rem",
                                    padding: "0.5rem 0.75rem",
                                    borderRadius: "0.5rem",
                                    background: currentEval?.estado === "buena" ? "#f0fdf4" : currentEval?.estado === "regular" ? "#fffbeb" : currentEval?.estado === "mala" ? "#fef2f2" : "#f1f5f9",
                                    border: currentEval?.estado === "buena" ? "1.5px solid #86efac" : currentEval?.estado === "regular" ? "1.5px solid #fde68a" : currentEval?.estado === "mala" ? "1.5px solid #fca5a5" : "1px solid #e2e8f0"
                                  }}
                                >
                                  <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                                    <span style={{ fontSize: "0.74rem", fontWeight: 800, color: "#475569" }}>Valor reactivo:</span>
                                    <span style={{ fontSize: "0.76rem", fontWeight: 900, color: "#0369a1", background: "#ffffff", padding: "0.1rem 0.45rem", borderRadius: "0.3rem", border: "1px solid #bae6fd" }}>
                                      {maxPts.toFixed(2)} pt
                                    </span>
                                    {currentEval && (
                                      <span
                                        style={{
                                          fontSize: "0.74rem",
                                          fontWeight: 900,
                                          color: currentEval.estado === "buena" ? "#15803d" : currentEval.estado === "regular" ? "#b45309" : "#dc2626",
                                          background: "#ffffff",
                                          padding: "0.1rem 0.45rem",
                                          borderRadius: "0.3rem",
                                          border: "1px solid #cbd5e1"
                                        }}
                                      >
                                        +{currentEval.puntos_obtenidos.toFixed(3)} pts
                                      </span>
                                    )}
                                  </div>

                                  <div style={{ display: "flex", alignItems: "center", gap: "0.35rem" }}>
                                    <button
                                      type="button"
                                      onClick={() => handleEvaluateItem(pregunta.id, null, "buena", maxPts)}
                                      style={{
                                        display: "inline-flex",
                                        alignItems: "center",
                                        gap: "0.25rem",
                                        padding: "0.32rem 0.65rem",
                                        borderRadius: "0.45rem",
                                        border: currentEval?.estado === "buena" ? "2px solid #16a34a" : "1.5px solid #cbd5e1",
                                        background: currentEval?.estado === "buena" ? "#16a34a" : "#ffffff",
                                        color: currentEval?.estado === "buena" ? "#ffffff" : "#15803d",
                                        fontSize: "0.78rem",
                                        fontWeight: 800,
                                        cursor: "pointer",
                                        boxShadow: currentEval?.estado === "buena" ? "0 2px 6px rgba(22, 163, 74, 0.3)" : "none",
                                        transition: "all 0.15s ease"
                                      }}
                                    >
                                      <Check size={14} strokeWidth={3} />
                                      <span>Buena</span>
                                    </button>

                                    <button
                                      type="button"
                                      onClick={() => handleEvaluateItem(pregunta.id, null, "regular", maxPts)}
                                      style={{
                                        display: "inline-flex",
                                        alignItems: "center",
                                        gap: "0.25rem",
                                        padding: "0.32rem 0.55rem",
                                        borderRadius: "0.45rem",
                                        border: currentEval?.estado === "regular" ? "2px solid #d97706" : "1.5px solid #cbd5e1",
                                        background: currentEval?.estado === "regular" ? "#d97706" : "#ffffff",
                                        color: currentEval?.estado === "regular" ? "#ffffff" : "#b45309",
                                        fontSize: "0.78rem",
                                        fontWeight: 800,
                                        cursor: "pointer",
                                        transition: "all 0.15s ease"
                                      }}
                                    >
                                      <span>½ Media</span>
                                    </button>

                                    <button
                                      type="button"
                                      onClick={() => handleEvaluateItem(pregunta.id, null, "mala", maxPts)}
                                      style={{
                                        display: "inline-flex",
                                        alignItems: "center",
                                        gap: "0.25rem",
                                        padding: "0.32rem 0.65rem",
                                        borderRadius: "0.45rem",
                                        border: currentEval?.estado === "mala" ? "2px solid #dc2626" : "1.5px solid #cbd5e1",
                                        background: currentEval?.estado === "mala" ? "#dc2626" : "#ffffff",
                                        color: currentEval?.estado === "mala" ? "#ffffff" : "#dc2626",
                                        fontSize: "0.78rem",
                                        fontWeight: 800,
                                        cursor: "pointer",
                                        boxShadow: currentEval?.estado === "mala" ? "0 2px 6px rgba(220, 38, 38, 0.3)" : "none",
                                        transition: "all 0.15s ease"
                                      }}
                                    >
                                      <X size={14} strokeWidth={3} />
                                      <span>Mala</span>
                                    </button>
                                  </div>
                                </div>
                              </div>
                            );
                          }

                          return pregunta.items.map((item, itemIdx) => {
                            const studentAnswer =
                              entregaRespuestas?.[pregunta.id]?.[item.id] ??
                              entregaRespuestas?.[item.id] ??
                              entregaRespuestas?.[pregunta.id] ??
                              null;
                            const itemLabel = item.instruccion || item.etiqueta || `Apartado ${itemIdx + 1}`;
                            const defaultItemPts = Math.round((Number(pregunta.puntos || 1.0) / pregunta.items.length) * 1000) / 1000;
                            const itemMaxPts = item.puntos !== undefined && !isNaN(Number(item.puntos)) ? Number(item.puntos) : defaultItemPts;
                            const isList = item.tipo !== "texto_corto";
                            const cantSlots = isList ? (parseInt(item.cantidad, 10) || 3) : 1;
                            const slotPts = isList ? Math.round((itemMaxPts / cantSlots) * 1000) / 1000 : itemMaxPts;

                            if (!isList) {
                              // Modo Texto Corto: evaluación directa para todo el apartado
                              const currentEval = evaluaciones[`${pregunta.id}___${item.id}`];
                              return (
                                <div
                                  key={item.id}
                                  style={{
                                    padding: "0.85rem 1rem",
                                    borderRadius: "0.65rem",
                                    background: "#f8fafc",
                                    border: "1px solid #e2e8f0",
                                    display: "flex",
                                    flexDirection: "column",
                                    gap: "0.6rem"
                                  }}
                                >
                                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "0.3rem" }}>
                                    <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                                      <strong style={{ fontSize: "0.84rem", color: "#334155" }}>
                                        {String.fromCharCode(97 + itemIdx)}) {itemLabel}:
                                      </strong>
                                      <span
                                        style={{
                                          fontSize: "0.72rem",
                                          fontWeight: 800,
                                          padding: "0.1rem 0.45rem",
                                          borderRadius: "0.3rem",
                                          background: "#eff6ff",
                                          color: "#1d4ed8",
                                          border: "1px solid #bfdbfe"
                                        }}
                                      >
                                        Valor: {itemMaxPts.toFixed(3)} pt(s)
                                      </span>
                                    </div>
                                    <span style={{ fontSize: "0.72rem", color: "#64748b", fontWeight: 700 }}>
                                      Texto corto
                                    </span>
                                  </div>

                                  {/* Respuesta del Alumno */}
                                  <div style={{ padding: "0.6rem 0.8rem", borderRadius: "0.5rem", background: "#ffffff", border: "1.5px solid #bae6fd" }}>
                                    <span style={{ fontSize: "0.72rem", fontWeight: 800, color: "#0284c7", textTransform: "uppercase", display: "block", marginBottom: "0.2rem" }}>
                                      ✍️ Respuesta del Alumno:
                                    </span>
                                    <div style={{ fontSize: "0.9rem", fontWeight: 700, color: "#0f172a" }}>
                                      {typeof studentAnswer === "string" && studentAnswer.trim() ? (
                                        studentAnswer
                                      ) : (
                                        <span style={{ color: "#94a3b8", fontStyle: "italic" }}>Sin respuesta enviada</span>
                                      )}
                                    </div>
                                  </div>

                                  {/* Respuesta Modelo */}
                                  {item.respuesta_modelo && (
                                    <div style={{ padding: "0.5rem 0.75rem", borderRadius: "0.45rem", background: "#ecfdf5", border: "1px solid #a7f3d0", fontSize: "0.78rem", color: "#065f46" }}>
                                      <strong>💡 Respuesta Modelo Docente:</strong> {item.respuesta_modelo}
                                    </div>
                                  )}

                                  {/* Barra de evaluación interactiva */}
                                  <div
                                    style={{
                                      display: "flex",
                                      alignItems: "center",
                                      justifyContent: "space-between",
                                      flexWrap: "wrap",
                                      gap: "0.5rem",
                                      padding: "0.45rem 0.75rem",
                                      borderRadius: "0.5rem",
                                      background: currentEval?.estado === "buena" ? "#f0fdf4" : currentEval?.estado === "regular" ? "#fffbeb" : currentEval?.estado === "mala" ? "#fef2f2" : "#f8fafc",
                                      border: currentEval?.estado === "buena" ? "1.5px solid #86efac" : currentEval?.estado === "regular" ? "1.5px solid #fde68a" : currentEval?.estado === "mala" ? "1.5px solid #fca5a5" : "1px solid #e2e8f0"
                                    }}
                                  >
                                    <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                                      <span style={{ fontSize: "0.74rem", fontWeight: 800, color: "#475569" }}>Calificar apartado:</span>
                                      {currentEval && (
                                        <span
                                          style={{
                                            fontSize: "0.74rem",
                                            fontWeight: 900,
                                            color: currentEval.estado === "buena" ? "#15803d" : currentEval.estado === "regular" ? "#b45309" : "#dc2626",
                                            background: "#ffffff",
                                            padding: "0.1rem 0.45rem",
                                            borderRadius: "0.3rem",
                                            border: "1px solid #cbd5e1"
                                          }}
                                        >
                                          +{currentEval.puntos_obtenidos.toFixed(3)} pts
                                        </span>
                                      )}
                                    </div>

                                    <div style={{ display: "flex", alignItems: "center", gap: "0.35rem" }}>
                                      <button
                                        type="button"
                                        onClick={() => handleEvaluateItem(pregunta.id, item.id, "buena", itemMaxPts)}
                                        style={{
                                          display: "inline-flex",
                                          alignItems: "center",
                                          gap: "0.25rem",
                                          padding: "0.3rem 0.65rem",
                                          borderRadius: "0.45rem",
                                          border: currentEval?.estado === "buena" ? "2px solid #16a34a" : "1.5px solid #cbd5e1",
                                          background: currentEval?.estado === "buena" ? "#16a34a" : "#ffffff",
                                          color: currentEval?.estado === "buena" ? "#ffffff" : "#15803d",
                                          fontSize: "0.78rem",
                                          fontWeight: 800,
                                          cursor: "pointer",
                                          boxShadow: currentEval?.estado === "buena" ? "0 2px 6px rgba(22, 163, 74, 0.3)" : "none"
                                        }}
                                      >
                                        <Check size={14} strokeWidth={3} />
                                        <span>Buena</span>
                                      </button>

                                      <button
                                        type="button"
                                        onClick={() => handleEvaluateItem(pregunta.id, item.id, "regular", itemMaxPts)}
                                        style={{
                                          display: "inline-flex",
                                          alignItems: "center",
                                          gap: "0.25rem",
                                          padding: "0.3rem 0.55rem",
                                          borderRadius: "0.45rem",
                                          border: currentEval?.estado === "regular" ? "2px solid #d97706" : "1.5px solid #cbd5e1",
                                          background: currentEval?.estado === "regular" ? "#d97706" : "#ffffff",
                                          color: currentEval?.estado === "regular" ? "#ffffff" : "#b45309",
                                          fontSize: "0.78rem",
                                          fontWeight: 800,
                                          cursor: "pointer"
                                        }}
                                      >
                                        <span>½ Media</span>
                                      </button>

                                      <button
                                        type="button"
                                        onClick={() => handleEvaluateItem(pregunta.id, item.id, "mala", itemMaxPts)}
                                        style={{
                                          display: "inline-flex",
                                          alignItems: "center",
                                          gap: "0.25rem",
                                          padding: "0.3rem 0.65rem",
                                          borderRadius: "0.45rem",
                                          border: currentEval?.estado === "mala" ? "2px solid #dc2626" : "1.5px solid #cbd5e1",
                                          background: currentEval?.estado === "mala" ? "#dc2626" : "#ffffff",
                                          color: currentEval?.estado === "mala" ? "#ffffff" : "#dc2626",
                                          fontSize: "0.78rem",
                                          fontWeight: 800,
                                          cursor: "pointer",
                                          boxShadow: currentEval?.estado === "mala" ? "0 2px 6px rgba(220, 38, 38, 0.3)" : "none"
                                        }}
                                      >
                                        <X size={14} strokeWidth={3} />
                                        <span>Mala</span>
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              );
                            }

                            // Modo Listado: División proporcional por casilla y calificación individual
                            let earnedInSlots = 0;
                            let buenasInSlots = 0;
                            let malasInSlots = 0;
                            for (let s = 0; s < cantSlots; s++) {
                              const ev = evaluaciones[`${pregunta.id}___${item.id}___slot_${s}`];
                              if (ev) {
                                earnedInSlots += Number(ev.puntos_obtenidos) || 0;
                                if (ev.estado === "buena") buenasInSlots++;
                                if (ev.estado === "mala") malasInSlots++;
                              }
                            }
                            earnedInSlots = Math.round(earnedInSlots * 1000) / 1000;
                            const lostInSlots = Math.max(0, Math.round((itemMaxPts - earnedInSlots) * 1000) / 1000);

                            return (
                              <div
                                key={item.id}
                                style={{
                                  padding: "0.85rem 1rem",
                                  borderRadius: "0.65rem",
                                  background: "#f8fafc",
                                  border: "1.5px solid #e2e8f0",
                                  display: "flex",
                                  flexDirection: "column",
                                  gap: "0.75rem"
                                }}
                              >
                                {/* Header del apartado tipo Listado */}
                                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "0.5rem" }}>
                                  <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", flexWrap: "wrap" }}>
                                    <strong style={{ fontSize: "0.86rem", color: "#334155" }}>
                                      {String.fromCharCode(97 + itemIdx)}) {itemLabel}:
                                    </strong>
                                    <span
                                      style={{
                                        fontSize: "0.72rem",
                                        fontWeight: 800,
                                        padding: "0.15rem 0.5rem",
                                        borderRadius: "0.35rem",
                                        background: "#eff6ff",
                                        color: "#1d4ed8",
                                        border: "1px solid #bfdbfe"
                                      }}
                                    >
                                      Valor Total: {itemMaxPts.toFixed(3)} pt ({cantSlots} respuestas • {slotPts.toFixed(3)} pt c/u)
                                    </span>
                                  </div>

                                  {/* Resumen de puntos del listado y acciones rápidas */}
                                  <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", flexWrap: "wrap" }}>
                                    <span
                                      style={{
                                        fontSize: "0.76rem",
                                        fontWeight: 900,
                                        padding: "0.2rem 0.55rem",
                                        borderRadius: "0.35rem",
                                        background: earnedInSlots === itemMaxPts ? "#dcfce7" : earnedInSlots > 0 ? "#fef3c7" : "#f1f5f9",
                                        color: earnedInSlots === itemMaxPts ? "#15803d" : earnedInSlots > 0 ? "#b45309" : "#475569",
                                        border: earnedInSlots === itemMaxPts ? "1px solid #86efac" : earnedInSlots > 0 ? "1px solid #fde68a" : "1px solid #cbd5e1"
                                      }}
                                    >
                                      Obtenido: +{earnedInSlots.toFixed(3)} / {itemMaxPts.toFixed(3)} pts
                                      {malasInSlots > 0 && ` (–${lostInSlots.toFixed(3)} pts por ${malasInSlots} fallas)`}
                                    </span>

                                    <button
                                      type="button"
                                      onClick={() => handleEvaluateAllSlotsInItem(pregunta.id, item.id, cantSlots, "buena", slotPts)}
                                      style={{
                                        padding: "0.22rem 0.5rem",
                                        borderRadius: "0.35rem",
                                        border: "1px solid #86efac",
                                        background: "#f0fdf4",
                                        color: "#15803d",
                                        fontSize: "0.72rem",
                                        fontWeight: 800,
                                        cursor: "pointer"
                                      }}
                                      title="Marcar todas las respuestas de este apartado como buenas"
                                    >
                                      ⚡ Todas Buenas
                                    </button>

                                    <button
                                      type="button"
                                      onClick={() => handleEvaluateAllSlotsInItem(pregunta.id, item.id, cantSlots, "mala", slotPts)}
                                      style={{
                                        padding: "0.22rem 0.5rem",
                                        borderRadius: "0.35rem",
                                        border: "1px solid #fca5a5",
                                        background: "#fef2f2",
                                        color: "#dc2626",
                                        fontSize: "0.72rem",
                                        fontWeight: 800,
                                        cursor: "pointer"
                                      }}
                                      title="Marcar todas las respuestas de este apartado como malas"
                                    >
                                      Todas Malas
                                    </button>
                                  </div>
                                </div>

                                {/* Listado de Casillas con evaluación individual */}
                                <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                                  {Array.from({ length: cantSlots }).map((_, rIdx) => {
                                    const rowVal = Array.isArray(studentAnswer)
                                      ? studentAnswer[rIdx]
                                      : (typeof studentAnswer === "object" && studentAnswer ? studentAnswer[rIdx] : "");
                                    const expectedAns = (item.respuestas_esperadas || [])[rIdx];
                                    const slotEval = evaluaciones[`${pregunta.id}___${item.id}___slot_${rIdx}`];

                                    return (
                                      <div
                                        key={rIdx}
                                        style={{
                                          display: "flex",
                                          alignItems: "center",
                                          justifyContent: "space-between",
                                          flexWrap: "wrap",
                                          gap: "0.5rem",
                                          padding: "0.55rem 0.75rem",
                                          borderRadius: "0.5rem",
                                          background:
                                            slotEval?.estado === "buena"
                                              ? "#f0fdf4"
                                              : slotEval?.estado === "regular"
                                              ? "#fffbeb"
                                              : slotEval?.estado === "mala"
                                              ? "#fef2f2"
                                              : "#ffffff",
                                          border:
                                            slotEval?.estado === "buena"
                                              ? "1.5px solid #86efac"
                                              : slotEval?.estado === "regular"
                                              ? "1.5px solid #fde68a"
                                              : slotEval?.estado === "mala"
                                              ? "1.5px solid #fca5a5"
                                              : "1.5px solid #e2e8f0",
                                          boxShadow: "0 1px 3px rgba(0,0,0,0.02)",
                                          transition: "all 0.15s ease"
                                        }}
                                      >
                                        {/* Respuesta del estudiante para esta casilla */}
                                        <div style={{ display: "flex", flexDirection: "column", gap: "0.15rem", flex: 1, minWidth: "200px" }}>
                                          <div style={{ display: "flex", alignItems: "center", gap: "0.45rem" }}>
                                            <span style={{ fontSize: "0.82rem", fontWeight: 900, color: "#64748b", width: "20px" }}>
                                              {rIdx + 1}.
                                            </span>
                                            <span
                                              style={{
                                                fontSize: "0.88rem",
                                                fontWeight: 700,
                                                color: rowVal && String(rowVal).trim() ? "#0f172a" : "#94a3b8"
                                              }}
                                            >
                                              {rowVal && String(rowVal).trim() ? String(rowVal) : "— (Sin respuesta) —"}
                                            </span>
                                          </div>
                                          {expectedAns && (
                                            <span style={{ fontSize: "0.72rem", color: "#065f46", paddingLeft: "24px" }}>
                                              <strong>💡 Esperado:</strong> {expectedAns}
                                            </span>
                                          )}
                                        </div>

                                        {/* Botones de Calificación para esta casilla */}
                                        <div style={{ display: "flex", alignItems: "center", gap: "0.35rem" }}>
                                          <span
                                            style={{
                                              fontSize: "0.74rem",
                                              fontWeight: 800,
                                              color:
                                                slotEval?.estado === "buena"
                                                  ? "#15803d"
                                                  : slotEval?.estado === "mala"
                                                  ? "#dc2626"
                                                  : slotEval?.estado === "regular"
                                                  ? "#b45309"
                                                  : "#64748b",
                                              marginRight: "0.35rem"
                                            }}
                                          >
                                            {slotEval?.estado === "buena"
                                              ? `+${slotPts.toFixed(3)} pt`
                                              : slotEval?.estado === "regular"
                                              ? `+${(slotPts / 2).toFixed(3)} pt`
                                              : slotEval?.estado === "mala"
                                              ? `0.000 pt (-${slotPts.toFixed(3)})`
                                              : `Valor: ${slotPts.toFixed(3)} pt`}
                                          </span>

                                          <button
                                            type="button"
                                            onClick={() => handleEvaluateSlot(pregunta.id, item.id, rIdx, "buena", slotPts)}
                                            style={{
                                              display: "inline-flex",
                                              alignItems: "center",
                                              gap: "0.2rem",
                                              padding: "0.25rem 0.55rem",
                                              borderRadius: "0.4rem",
                                              border: slotEval?.estado === "buena" ? "2px solid #16a34a" : "1.5px solid #cbd5e1",
                                              background: slotEval?.estado === "buena" ? "#16a34a" : "#ffffff",
                                              color: slotEval?.estado === "buena" ? "#ffffff" : "#15803d",
                                              fontSize: "0.74rem",
                                              fontWeight: 800,
                                              cursor: "pointer"
                                            }}
                                          >
                                            <Check size={13} strokeWidth={3} />
                                            <span>Buena</span>
                                          </button>

                                          <button
                                            type="button"
                                            onClick={() => handleEvaluateSlot(pregunta.id, item.id, rIdx, "regular", slotPts)}
                                            style={{
                                              display: "inline-flex",
                                              alignItems: "center",
                                              padding: "0.25rem 0.45rem",
                                              borderRadius: "0.4rem",
                                              border: slotEval?.estado === "regular" ? "2px solid #d97706" : "1.5px solid #cbd5e1",
                                              background: slotEval?.estado === "regular" ? "#d97706" : "#ffffff",
                                              color: slotEval?.estado === "regular" ? "#ffffff" : "#b45309",
                                              fontSize: "0.74rem",
                                              fontWeight: 800,
                                              cursor: "pointer"
                                            }}
                                          >
                                            <span>½ Media</span>
                                          </button>

                                          <button
                                            type="button"
                                            onClick={() => handleEvaluateSlot(pregunta.id, item.id, rIdx, "mala", slotPts)}
                                            style={{
                                              display: "inline-flex",
                                              alignItems: "center",
                                              gap: "0.2rem",
                                              padding: "0.25rem 0.55rem",
                                              borderRadius: "0.4rem",
                                              border: slotEval?.estado === "mala" ? "2px solid #dc2626" : "1.5px solid #cbd5e1",
                                              background: slotEval?.estado === "mala" ? "#dc2626" : "#ffffff",
                                              color: slotEval?.estado === "mala" ? "#ffffff" : "#dc2626",
                                              fontSize: "0.74rem",
                                              fontWeight: 800,
                                              cursor: "pointer"
                                            }}
                                          >
                                            <X size={13} strokeWidth={3} />
                                            <span>Mala</span>
                                          </button>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            );
                          });
                        })()}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Footer / Panel de Calificación */}
            <form
              onSubmit={handleSaveGrade}
              style={{
                padding: "1.25rem 1.5rem",
                borderTop: "2px solid #f1f5f9",
                background: "#f8fafc",
                display: "flex",
                flexDirection: "column",
                gap: "1rem"
              }}
            >
              {gradeError && (
                <div
                  style={{
                    padding: "0.6rem 0.9rem",
                    borderRadius: "0.5rem",
                    background: "#fee2e2",
                    border: "1px solid #fca5a5",
                    color: "#b91c1c",
                    fontSize: "0.84rem",
                    fontWeight: 700
                  }}
                >
                  ⚠️ {gradeError}
                </div>
              )}

              <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: "1rem" }}>
                {/* Asignación de Calificación */}
                <div>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.35rem" }}>
                    <label style={{ fontSize: "0.82rem", fontWeight: 800, color: "#1e293b", margin: 0 }}>
                      Calificación Oficial (Máx. 5.000 pts):
                    </label>
                    {Number(notaRealInput) > 5.0 && (
                      <span style={{ fontSize: "0.72rem", fontWeight: 800, color: "#b45309", background: "#fef3c7", padding: "0.1rem 0.45rem", borderRadius: "0.3rem", border: "1px solid #fde68a" }}>
                        ⭐ Con Bonus: {Number(notaRealInput).toFixed(3)} pts
                      </span>
                    )}
                  </div>
                  <div style={{ position: "relative" }}>
                    <input
                      type="number"
                      step="0.001"
                      min="0"
                      max="5"
                      required
                      value={notaInput}
                      onChange={(e) => setNotaInput(e.target.value)}
                      placeholder="Ej. 4.850"
                      style={{
                        width: "100%",
                        padding: "0.65rem 0.85rem",
                        borderRadius: "0.6rem",
                        border: "2px solid #10b981",
                        fontSize: "1.15rem",
                        fontWeight: 900,
                        color: "#065f46",
                        background: "#ffffff",
                        outline: "none"
                      }}
                    />
                    <span style={{ position: "absolute", right: "0.75rem", top: "50%", transform: "translateY(-50%)", fontSize: "0.8rem", fontWeight: 800, color: "#64748b" }}>
                      / 5.000
                    </span>
                  </div>

                  {/* Botones de atajo rápido */}
                  <div style={{ display: "flex", gap: "0.3rem", marginTop: "0.4rem" }}>
                    {["5.000", "4.500", "4.000", "3.000"].map((quickVal) => (
                      <button
                        key={quickVal}
                        type="button"
                        onClick={() => setNotaInput(quickVal)}
                        style={{
                          flex: 1,
                          padding: "0.25rem 0.4rem",
                          borderRadius: "0.35rem",
                          border: "1px solid #cbd5e1",
                          background: "#ffffff",
                          fontSize: "0.72rem",
                          fontWeight: 700,
                          cursor: "pointer",
                          color: "#334155"
                        }}
                      >
                        {quickVal}
                      </button>
                    ))}
                  </div>

                  {Number(notaRealInput) > 5.0 && (
                    <div style={{ marginTop: "0.5rem", padding: "0.45rem 0.65rem", borderRadius: "0.45rem", background: "#fffbeb", border: "1px solid #fde68a", fontSize: "0.75rem", color: "#92400e", lineHeight: 1.35 }}>
                      ⭐ <strong>Puntos con Bonus:</strong> {Number(notaRealInput).toFixed(3)} pts.
                      <div style={{ fontSize: "0.71rem", color: "#b45309", marginTop: "0.15rem" }}>
                        Oficialmente se registran 5.000 pts para notas académicas, y {Number(notaRealInput).toFixed(3)} pts se guardan para el Cuadro de Premios de la Sección.
                      </div>
                    </div>
                  )}
                </div>

                {/* Comentarios / Retroalimentación */}
                <div>
                  <label style={{ fontSize: "0.82rem", fontWeight: 800, color: "#1e293b", display: "block", marginBottom: "0.35rem" }}>
                    Retroalimentación para el Estudiante (Visible en su portal):
                  </label>
                  <input
                    type="text"
                    value={comentariosInput}
                    onChange={(e) => setComentariosInput(e.target.value)}
                    placeholder="Ej. Excelente identificación histológica y precisión morfológica."
                    style={{
                      width: "100%",
                      padding: "0.65rem 0.85rem",
                      borderRadius: "0.6rem",
                      border: "1.5px solid #cbd5e1",
                      fontSize: "0.85rem",
                      background: "#ffffff",
                      outline: "none"
                    }}
                  />
                </div>
              </div>

              {/* Botones de acción */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "0.75rem", borderTop: "1px solid #e2e8f0", paddingTop: "0.85rem" }}>
                <button
                  type="button"
                  onClick={handleDeleteSubmission}
                  disabled={savingGrade}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.45rem",
                    padding: "0.6rem 1rem",
                    borderRadius: "0.6rem",
                    border: "1.5px solid #fecaca",
                    background: "#fff1f2",
                    color: "#e11d48",
                    fontSize: "0.83rem",
                    fontWeight: 800,
                    cursor: savingGrade ? "not-allowed" : "pointer",
                    transition: "all 0.15s ease"
                  }}
                  title="Eliminar esta entrega para que el estudiante pueda realizar la prueba de nuevo"
                >
                  <Trash2 size={15} />
                  <span>Eliminar Entrega / Habilitar Reintento</span>
                </button>

                <div style={{ display: "flex", alignItems: "center", gap: "0.65rem" }}>
                  <button
                    type="button"
                    onClick={handleCloseGradeModal}
                    disabled={savingGrade}
                    style={{
                      padding: "0.6rem 1.25rem",
                      borderRadius: "0.6rem",
                      border: "1.5px solid #cbd5e1",
                      background: "#ffffff",
                      color: "#475569",
                      fontSize: "0.86rem",
                      fontWeight: 700,
                      cursor: "pointer"
                    }}
                  >
                    Cancelar
                  </button>

                  <button
                    type="submit"
                    disabled={savingGrade}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "0.45rem",
                      padding: "0.65rem 1.6rem",
                      borderRadius: "0.6rem",
                      border: "none",
                      background: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
                      color: "#ffffff",
                      fontSize: "0.9rem",
                      fontWeight: 900,
                      cursor: savingGrade ? "not-allowed" : "pointer",
                      boxShadow: "0 4px 14px rgba(16, 185, 129, 0.3)"
                    }}
                  >
                    {savingGrade ? <RefreshCw size={17} className="animate-spin" /> : <CheckCircle2 size={17} />}
                    <span>{savingGrade ? "Guardando Calificación..." : "Guardar y Asignar Calificación"}</span>
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
