import React, { useState, useEffect, useCallback, useMemo } from "react";
import { createPortal } from "react-dom";
import {
  X,
  PlusCircle,
  Edit3,
  Trash2,
  AlertTriangle,
  Calendar,
  Check,
  ArrowLeft,
  Search,
  Plus,
  FileCheck2,
  BookOpen,
  GraduationCap,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
  Sparkles,
  CheckCircle2,
  RefreshCw
} from "lucide-react";
import { api } from "../services/api";

const PARCIALES_OPTIONS = [
  { id: "I Parcial", label: "1er Parcial (I Parcial)", badge: "Semanas 1 a 5 (Clases + Examen)", color: "#7c3aed", bg: "#faf5ff", border: "#e9d5ff" },
  { id: "II Parcial", label: "2do Parcial (II Parcial)", badge: "Semanas 6 a 10/11 (Clases + Examen)", color: "#0284c7", bg: "#f0f9ff", border: "#bae6fd" },
  { id: "III Parcial", label: "3er Parcial (III Parcial)", badge: "Semanas 11/12 a 15/16 (Clases + Examen)", color: "#d97706", bg: "#fffbeb", border: "#fde68a" }
];

export default function TemarioManagementModal({
  mode = "create", // 'create' | 'edit' | 'reorder_temas' | 'weeks' | 'reorder' | 'delete'
  temas = [],
  selectedTema = null,
  carrera = "Medicina",
  onClose,
  onSuccess,
  notify = () => {}
}) {
  // Modo activo según la herramienta invocada desde el panel principal
  const activeMode = mode === "reorder" ? "weeks" : (mode || "create");

  const [targetId, setTargetId] = useState(selectedTema?.id || "");
  const [loading, setLoading] = useState(false);
  const [inlineError, setInlineError] = useState("");
  const [inlineSuccess, setInlineSuccess] = useState("");

  // Desplazamiento automático de temas siguientes al insertar (+1)
  const [desplazarSiguientes, setDesplazarSiguientes] = useState(true);

  // Formulario de Crear / Editar Tema
  const [formData, setFormData] = useState({
    numero_tema: 1,
    titulo: "",
    tiene_manual: true
  });

  // Lista local de temas para reordenamiento interactivo
  const [orderedTemas, setOrderedTemas] = useState([]);
  const [savingOrder, setSavingOrder] = useState(false);

  // =========================================================================
  // 📅 ESTADO PARA LA ADMINISTRACIÓN DE SEMANAS
  // =========================================================================
  const [weekViewMode, setWeekViewMode] = useState("list"); // 'list' | 'form'
  const [semanasConfigList, setSemanasConfigList] = useState([]);
  const [loadingWeeks, setLoadingWeeks] = useState(false);
  const [topicSearchTerm, setTopicSearchTerm] = useState("");

  // Formulario de Semana
  const [weekFormData, setWeekFormData] = useState({
    numero_semana: 1,
    nombre_semana: "Semana 1",
    parcial: "I Parcial",
    es_examen: false,
    tema_ids: []
  });
  const [isEditingExistingWeek, setIsEditingExistingWeek] = useState(false);

  // Cargar lista de semanas de la carrera
  const loadCareerWeeks = useCallback(async () => {
    setLoadingWeeks(true);
    try {
      const res = await api.semanas.getConfig(carrera);
      if (res?.data) {
        setSemanasConfigList(res.data);
      }
    } catch (err) {
      console.warn("Aviso al cargar semanas de carrera:", err);
    } finally {
      setLoadingWeeks(false);
    }
  }, [carrera]);

  // Sincronizar lista ordenada de temas al cambiar 'temas'
  useEffect(() => {
    const sorted = [...temas].sort(
      (a, b) => (Number(a.numero_tema) || 999) - (Number(b.numero_tema) || 999)
    );
    setOrderedTemas(sorted);
  }, [temas]);

  // Detección de colisión de número de tema
  const duplicateTopic = useMemo(() => {
    if (activeMode !== "create" && activeMode !== "edit") return null;
    const num = Number(formData.numero_tema);
    if (!num || isNaN(num)) return null;
    return temas.find(
      (t) =>
        Number(t.numero_tema) === num &&
        t.id !== targetId
    );
  }, [temas, formData.numero_tema, targetId, activeMode]);

  // Inicializar estado según el modo
  useEffect(() => {
    setInlineError("");
    setInlineSuccess("");

    if (activeMode === "weeks" || activeMode === "reorder") {
      setWeekViewMode("list");
      loadCareerWeeks();
    } else if (activeMode === "edit" && selectedTema) {
      setTargetId(selectedTema.id);
      setFormData({
        numero_tema: Number(selectedTema.numero_tema) || 1,
        titulo: selectedTema.titulo || selectedTema.nombre || "",
        tiene_manual: selectedTema.tiene_manual !== false
      });
    } else if (activeMode === "create") {
      const existingNums = temas.map((t) => Number(t.numero_tema) || 0);
      const nextNum = existingNums.length > 0 ? Math.max(...existingNums) + 1 : 1;
      setTargetId("");
      setFormData({
        numero_tema: nextNum,
        titulo: "",
        tiene_manual: true
      });
    } else if (activeMode === "reorder_temas") {
      const sorted = [...temas].sort(
        (a, b) => (Number(a.numero_tema) || 999) - (Number(b.numero_tema) || 999)
      );
      setOrderedTemas(sorted);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeMode, selectedTema?.id, carrera]);

  // Mostrar mensaje de éxito temporal
  const showSuccessFeedback = (msg) => {
    setInlineSuccess(msg);
    setTimeout(() => {
      setInlineSuccess("");
    }, 4000);
  };

  // Al seleccionar un tema en modo edición o eliminación
  const handleSelectTema = (e) => {
    const id = e.target.value;
    setTargetId(id);
    setInlineError("");
    setInlineSuccess("");

    if (!id) {
      const existingNums = temas.map((t) => Number(t.numero_tema) || 0);
      const nextNum = existingNums.length > 0 ? Math.max(...existingNums) + 1 : 1;
      setFormData({ numero_tema: nextNum, titulo: "", tiene_manual: true });
      return;
    }

    const t = temas.find((item) => item.id === id);
    if (t) {
      setFormData({
        numero_tema: Number(t.numero_tema) || 1,
        titulo: t.titulo || t.nombre || "",
        tiene_manual: t.tiene_manual !== false
      });
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setInlineError("");
    setInlineSuccess("");
    setFormData((prev) => ({
      ...prev,
      [name]: value
    }));
  };

  // =========================================================================
  // 🔄 REORDENAMIENTO DE SEMANAS (▲ Subir / ▼ Bajar)
  // =========================================================================
  const handleMoveWeek = async (index, direction) => {
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= semanasConfigList.length) return;

    const updatedList = [...semanasConfigList];
    const temp = updatedList[index];
    updatedList[index] = updatedList[targetIndex];
    updatedList[targetIndex] = temp;

    // Actualización inmediata en UI
    setSemanasConfigList(updatedList);
    setLoadingWeeks(true);

    try {
      const payload = updatedList.map((w, idx) => ({
        original_numero_semana: Number(w.numero_semana),
        nombre_semana: w.nombre_semana || w.descripcion,
        parcial: w.parcial,
        es_examen: Boolean(w.es_examen),
        tema_ids:
          w.temas_ids ||
          temas.filter((t) => Number(t.semana) === Number(w.numero_semana)).map((t) => t.id)
      }));

      await api.semanas.reorder(carrera, payload);
      notify("Orden de semanas actualizado. Secuencia y temas recalculados.", "success");
      await loadCareerWeeks();
      if (onSuccess) onSuccess();
    } catch (err) {
      console.error("Error al reordenar semanas:", err);
      notify(err.message || "Error al reordenar semanas", "error");
      await loadCareerWeeks();
    } finally {
      setLoadingWeeks(false);
    }
  };

  // Renumerar semanas consecutivas (1..N)
  const handleRenumberWeeksSequentially = async () => {
    if (semanasConfigList.length === 0) return;
    setLoadingWeeks(true);
    try {
      const payload = semanasConfigList.map((w, idx) => ({
        original_numero_semana: Number(w.numero_semana),
        nombre_semana: `Semana ${idx + 1}`,
        parcial: w.parcial,
        es_examen: Boolean(w.es_examen),
        tema_ids:
          w.temas_ids ||
          temas.filter((t) => Number(t.semana) === Number(w.numero_semana)).map((t) => t.id)
      }));

      await api.semanas.reorder(carrera, payload);
      notify("Semanas renumeradas secuencialmente (1.." + semanasConfigList.length + ").", "success");
      await loadCareerWeeks();
      if (onSuccess) onSuccess();
    } catch (err) {
      console.error("Error al renumerar semanas:", err);
      notify(err.message || "Error al renumerar semanas", "error");
    } finally {
      setLoadingWeeks(false);
    }
  };

  // Abrir formulario para AGREGAR NUEVA SEMANA
  const handleOpenAddWeek = () => {
    const existingNums = semanasConfigList.map((s) => Number(s.numero_semana));
    const nextSemNum = existingNums.length > 0 ? Math.max(...existingNums) + 1 : 1;

    let defaultParcial = "I Parcial";
    if (nextSemNum > 10) defaultParcial = "III Parcial";
    else if (nextSemNum > 5) defaultParcial = "II Parcial";

    setWeekFormData({
      numero_semana: nextSemNum,
      nombre_semana: `Semana ${nextSemNum}`,
      parcial: defaultParcial,
      es_examen: false,
      tema_ids: []
    });
    setIsEditingExistingWeek(false);
    setTopicSearchTerm("");
    setInlineError("");
    setInlineSuccess("");
    setWeekViewMode("form");
  };

  // Abrir formulario para EDITAR SEMANA EXISTENTE
  const handleOpenEditWeek = (semanaObj) => {
    const currentWeekNum = Number(semanaObj.numero_semana);
    const isExam = Boolean(semanaObj.es_examen);
    const assignedIds = temas
      .filter((t) => Number(t.semana) === currentWeekNum)
      .map((t) => t.id);

    setWeekFormData({
      numero_semana: currentWeekNum,
      nombre_semana: semanaObj.nombre_semana || semanaObj.descripcion || `Semana ${currentWeekNum}`,
      parcial: semanaObj.parcial || "I Parcial",
      es_examen: isExam,
      tema_ids: isExam ? [] : assignedIds
    });
    setIsEditingExistingWeek(true);
    setTopicSearchTerm("");
    setInlineError("");
    setInlineSuccess("");
    setWeekViewMode("form");
  };

  // Alternar selección de tema con checkbox en semana
  const handleToggleTopicCheckbox = (temaId) => {
    setWeekFormData((prev) => {
      const isSelected = prev.tema_ids.includes(temaId);
      return {
        ...prev,
        tema_ids: isSelected
          ? prev.tema_ids.filter((id) => id !== temaId)
          : [...prev.tema_ids, temaId]
      };
    });
  };

  const handleSelectAllTopics = () => {
    setWeekFormData((prev) => ({
      ...prev,
      tema_ids: temas.map((t) => t.id)
    }));
  };

  const handleDeselectAllTopics = () => {
    setWeekFormData((prev) => ({
      ...prev,
      tema_ids: []
    }));
  };

  // Guardar Semana (con opción de permanecer en el formulario o volver a la lista)
  const handleSaveSingleWeek = async (e, returnToList = true) => {
    if (e) e.preventDefault();
    setInlineError("");
    setInlineSuccess("");
    setLoading(true);

    try {
      if (!weekFormData.numero_semana || isNaN(weekFormData.numero_semana)) {
        throw new Error("Por favor ingresa un número de semana válido.");
      }

      await api.semanas.saveWeek({
        carrera,
        numero_semana: Number(weekFormData.numero_semana),
        nombre_semana:
          weekFormData.nombre_semana?.trim() ||
          (weekFormData.es_examen
            ? `Examen ${String(weekFormData.parcial || "").includes("III") ? "III" : String(weekFormData.parcial || "").includes("II") ? "II" : "I"}`
            : `Semana ${weekFormData.numero_semana}`),
        parcial: weekFormData.parcial || "I Parcial",
        es_examen: Boolean(weekFormData.es_examen),
        tema_ids: weekFormData.es_examen ? [] : weekFormData.tema_ids || []
      });

      notify(
        weekFormData.es_examen
          ? `Semana ${weekFormData.numero_semana} configurada como Semana de Examen (${weekFormData.parcial}).`
          : `Semana ${weekFormData.numero_semana} (${weekFormData.parcial}) guardada con ${weekFormData.tema_ids.length} tema(s).`,
        "success"
      );

      await loadCareerWeeks();
      if (onSuccess) onSuccess();

      if (returnToList) {
        setWeekViewMode("list");
      } else {
        showSuccessFeedback(`✓ Semana ${weekFormData.numero_semana} guardada exitosamente.`);
      }
    } catch (err) {
      console.error("Error al guardar semana:", err);
      setInlineError(err.message || "Error al guardar la semana");
      notify(err.message || "Error al guardar la semana", "error");
    } finally {
      setLoading(false);
    }
  };

  // Eliminar Semana
  const handleDeleteWeek = async (numeroSemana) => {
    if (!window.confirm(`¿Estás seguro de eliminar la Semana ${numeroSemana}?`)) {
      return;
    }

    setLoading(true);
    try {
      await api.semanas.deleteWeek(numeroSemana, carrera);
      notify(`Semana ${numeroSemana} eliminada correctamente.`, "success");
      await loadCareerWeeks();
      if (onSuccess) onSuccess();
    } catch (err) {
      console.error("Error al eliminar semana:", err);
      notify(err.message || "Error al eliminar semana", "error");
    } finally {
      setLoading(false);
    }
  };

  // =========================================================================
  // 📑 REORDENAMIENTO DE TEMAS (▲ Subir / ▼ Bajar)
  // =========================================================================
  const handleMoveTopic = (index, direction) => {
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= orderedTemas.length) return;

    const list = [...orderedTemas];
    const temp = list[index];
    list[index] = list[targetIndex];
    list[targetIndex] = temp;
    setOrderedTemas(list);
  };

  // Renumerar temas secuencialmente 1, 2, 3...
  const handleRenumberTopicsSequentially = () => {
    const renumbered = orderedTemas.map((t, idx) => ({
      ...t,
      numero_tema: idx + 1
    }));
    setOrderedTemas(renumbered);
    showSuccessFeedback("✓ Temas renumerados del 1 al " + renumbered.length + " en vista previa. Presiona Guardar para aplicar.");
  };

  // Guardar nuevo orden de temas en backend
  const handleSaveTopicOrder = async (closeOnDone = false) => {
    setSavingOrder(true);
    setInlineError("");
    setInlineSuccess("");

    try {
      const items = orderedTemas.map((t, idx) => ({
        id: t.id,
        numero_tema: idx + 1,
        semana: t.semana
      }));

      await api.temario.reorder({ carrera, items });
      notify("Orden y numeración de temas actualizados exitosamente.", "success");
      showSuccessFeedback("✓ Orden de temas guardado exitosamente en base de datos.");
      if (onSuccess) onSuccess();

      if (closeOnDone) {
        onClose();
      }
    } catch (err) {
      console.error("Error al guardar orden de temas:", err);
      setInlineError(err.message || "Error al guardar el nuevo orden");
      notify(err.message || "Error al guardar el nuevo orden", "error");
    } finally {
      setSavingOrder(false);
    }
  };

  // =========================================================================
  // 📝 ENVÍO DE FORMULARIO ESTÁNDAR (Crear / Editar / Eliminar TEMA)
  // actionType: 'stay' (Guardar y seguir editando) | 'next' (Crear siguiente) | 'close' (Guardar y salir)
  // =========================================================================
  const handleSubmitTopic = async (e, actionType = "stay") => {
    if (e) e.preventDefault();
    setInlineError("");
    setInlineSuccess("");
    setLoading(true);

    try {
      const realDuplicate = duplicateTopic && duplicateTopic.id !== targetId ? duplicateTopic : null;

      if (realDuplicate && !desplazarSiguientes) {
        throw new Error(
          `El número de tema #${formData.numero_tema} ya está asignado al tema "${realDuplicate.titulo || realDuplicate.nombre}". Marca la opción "Desplazar temas siguientes" para insertarlo aquí automáticamente.`
        );
      }

      if (activeMode === "create") {
        if (!formData.titulo || !formData.titulo.trim()) {
          throw new Error("Por favor ingresa el nombre del tema.");
        }

        await api.temario.create({
          numero_tema: Number(formData.numero_tema) || 1,
          titulo: formData.titulo.trim(),
          carrera: carrera || "Medicina",
          tiene_manual: Boolean(formData.tiene_manual),
          desplazar_siguientes: Boolean(desplazarSiguientes && realDuplicate)
        });

        notify(
          `Tema #${formData.numero_tema} "${formData.titulo.trim()}" registrado exitosamente.`,
          "success"
        );

        if (onSuccess) onSuccess();

        if (actionType === "next") {
          const nextNum = Number(formData.numero_tema) + 1;
          setFormData({
            numero_tema: nextNum,
            titulo: "",
            tiene_manual: true
          });
          showSuccessFeedback(`✓ Tema #${formData.numero_tema} guardado. Formulario listo para el tema #${nextNum}.`);
        } else if (actionType === "stay") {
          showSuccessFeedback(`✓ Tema #${formData.numero_tema} guardado exitosamente.`);
        } else {
          onClose();
        }
      } else if (activeMode === "edit") {
        if (!targetId) {
          throw new Error("Por favor selecciona el tema que deseas modificar.");
        }
        if (!formData.titulo || !formData.titulo.trim()) {
          throw new Error("El nombre del tema no puede quedar vacío.");
        }

        await api.temario.update(targetId, {
          numero_tema: Number(formData.numero_tema) || 1,
          titulo: formData.titulo.trim(),
          carrera,
          tiene_manual: Boolean(formData.tiene_manual),
          desplazar_siguientes: Boolean(desplazarSiguientes && realDuplicate)
        });

        notify("Tema actualizado correctamente.", "success");
        if (onSuccess) onSuccess();

        if (actionType === "stay") {
          showSuccessFeedback("✓ Cambios guardados correctamente.");
        } else {
          onClose();
        }
      } else if (activeMode === "delete") {
        if (!targetId) {
          throw new Error("Por favor selecciona el tema que deseas eliminar.");
        }

        await api.temario.delete(targetId);
        notify(`Tema eliminado exitosamente de ${carrera}.`, "success");
        if (onSuccess) onSuccess();
        onClose();
      }
    } catch (err) {
      console.error("Error en operación de temario:", err);
      setInlineError(err.message || "Error al procesar la solicitud");
      notify(err.message || "Error al procesar la solicitud", "error");
    } finally {
      setLoading(false);
    }
  };

  // Filtrado de temas para el formulario de selección de semanas
  const filteredTopicsInForm = temas.filter((t) => {
    const s = topicSearchTerm.toLowerCase().trim();
    if (!s) return true;
    const tit = (t.titulo || t.nombre || "").toLowerCase();
    return tit.includes(s) || String(t.semana || "").includes(s);
  });

  const modalContent = (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: "rgba(15, 23, 42, 0.65)",
        backdropFilter: "blur(6px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 9999,
        padding: "1rem"
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget && !loading && !savingOrder) onClose();
      }}
    >
      <div
        className="glass-panel"
        style={{
          width: "100%",
          maxWidth:
            activeMode === "weeks" || activeMode === "reorder"
              ? weekViewMode === "form"
                ? "680px"
                : "780px"
              : activeMode === "reorder_temas"
              ? "720px"
              : "540px",
          background: "#ffffff",
          borderRadius: "1.25rem",
          boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
          border: "1px solid #e2e8f0",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          maxHeight: "92vh",
          animation: "modalPop 0.2s cubic-bezier(0.16, 1, 0.3, 1)"
        }}
      >
        {/* =================================================================== */}
        {/* 🎯 ENCABEZADO DEL MODAL                                             */}
        {/* =================================================================== */}
        <div
          style={{
            padding: "1.15rem 1.5rem",
            borderBottom: "1px solid #e2e8f0",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            background:
              activeMode === "create"
                ? "linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)"
                : activeMode === "edit"
                ? "linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)"
                : activeMode === "reorder_temas"
                ? "linear-gradient(135deg, #e0e7ff 0%, #ede9fe 100%)"
                : activeMode === "weeks" || activeMode === "reorder"
                ? "linear-gradient(135deg, #f5f3ff 0%, #ede9fe 100%)"
                : "linear-gradient(135deg, #fff1f2 0%, #ffe4e6 100%)"
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
            <div
              style={{
                width: "40px",
                height: "40px",
                borderRadius: "0.75rem",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background:
                  activeMode === "create"
                    ? "#16a34a"
                    : activeMode === "edit"
                    ? "#2563eb"
                    : activeMode === "reorder_temas"
                    ? "#4f46e5"
                    : activeMode === "weeks" || activeMode === "reorder"
                    ? "#7c3aed"
                    : "#e11d48",
                color: "#ffffff"
              }}
            >
              {activeMode === "create" && <PlusCircle size={22} />}
              {activeMode === "edit" && <Edit3 size={22} />}
              {activeMode === "reorder_temas" && <ArrowUpDown size={22} />}
              {(activeMode === "weeks" || activeMode === "reorder") && <Calendar size={22} />}
              {activeMode === "delete" && <Trash2 size={22} />}
            </div>

            <div>
              <h2 style={{ fontSize: "1.15rem", fontWeight: 800, color: "#0f172a", margin: 0 }}>
                {activeMode === "create" && "Crear Nuevo Tema"}
                {activeMode === "edit" && "Editar Tema"}
                {activeMode === "reorder_temas" && "Reordenar y Renumerar Temas"}
                {(activeMode === "weeks" || activeMode === "reorder") &&
                  (weekViewMode === "form"
                    ? isEditingExistingWeek
                      ? `Editar ${weekFormData.nombre_semana}`
                      : "Agregar Nueva Semana"
                    : `Administrar Semanas (${carrera})`)}
                {activeMode === "delete" && "Eliminar Tema"}
              </h2>
              <span style={{ fontSize: "0.78rem", color: "#64748b", fontWeight: 600 }}>
                Carrera: <strong style={{ color: "#0f172a" }}>{carrera}</strong>
              </span>
            </div>
          </div>

          <button
            onClick={onClose}
            disabled={loading || savingOrder}
            style={{
              background: "transparent",
              border: "none",
              cursor: "pointer",
              padding: "0.4rem",
              borderRadius: "0.5rem",
              color: "#64748b",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              transition: "color 0.15s ease"
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = "#0f172a")}
            onMouseLeave={(e) => (e.currentTarget.style.color = "#64748b")}
            title="Cerrar modal"
          >
            <X size={20} />
          </button>
        </div>

        {/* =================================================================== */}
        {/* 📋 CUERPO DEL MODAL                                                 */}
        {/* =================================================================== */}
        <div style={{ padding: "1.35rem 1.5rem", overflowY: "auto", flex: 1 }}>
          {/* Alerta de Error Inline */}
          {inlineError && (
            <div
              style={{
                marginBottom: "1.15rem",
                padding: "0.85rem 1rem",
                background: "#fef2f2",
                border: "1px solid #fecaca",
                borderRadius: "0.75rem",
                display: "flex",
                alignItems: "center",
                gap: "0.5rem",
                color: "#b91c1c",
                fontSize: "0.85rem",
                fontWeight: 600
              }}
            >
              <AlertTriangle size={17} />
              <span>{inlineError}</span>
            </div>
          )}

          {/* Alerta de Éxito Inline (permanencia en modal) */}
          {inlineSuccess && (
            <div
              style={{
                marginBottom: "1.15rem",
                padding: "0.85rem 1rem",
                background: "#f0fdf4",
                border: "1px solid #86efac",
                borderRadius: "0.75rem",
                display: "flex",
                alignItems: "center",
                gap: "0.5rem",
                color: "#166534",
                fontSize: "0.85rem",
                fontWeight: 700,
                animation: "fadeIn 0.2s ease"
              }}
            >
              <CheckCircle2 size={17} color="#16a34a" />
              <span>{inlineSuccess}</span>
            </div>
          )}

          {/* ================================================================= */}
          {/* 🌟 VISTA A: ADMINISTRADOR DE SEMANAS (LISTADO O FORMULARIO)        */}
          {/* ================================================================= */}
          {activeMode === "weeks" || activeMode === "reorder" ? (
            weekViewMode === "list" ? (
              /* --- SUB-VISTA A1: LISTADO DE SEMANAS CON BOTONES ▲ Y ▼ --- */
              <div style={{ display: "flex", flexDirection: "column", gap: "1.15rem" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "0.5rem" }}>
                  <div>
                    <span style={{ fontSize: "0.88rem", fontWeight: 700, color: "#1e293b" }}>
                      Semanas y Temas Asignados ({semanasConfigList.length} Semanas)
                    </span>
                    <p style={{ fontSize: "0.78rem", color: "#64748b", margin: "0.15rem 0 0 0" }}>
                      Usa <strong>▲</strong> y <strong>▼</strong> para cambiar el orden. La numeración y los temas asignados se actualizan automáticamente en secuencia.
                    </p>
                  </div>

                  {semanasConfigList.length > 1 && (
                    <button
                      type="button"
                      onClick={handleRenumberWeeksSequentially}
                      disabled={loadingWeeks}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "0.35rem",
                        background: "#f1f5f9",
                        border: "1px solid #cbd5e1",
                        color: "#334155",
                        padding: "0.35rem 0.75rem",
                        borderRadius: "0.5rem",
                        fontSize: "0.76rem",
                        fontWeight: 700,
                        cursor: "pointer"
                      }}
                      title="Renumerar semanas consecutivas del 1 al N"
                    >
                      <Sparkles size={13} color="#7c3aed" />
                      <span>Renumerar 1..{semanasConfigList.length}</span>
                    </button>
                  )}
                </div>

                {loadingWeeks ? (
                  <div style={{ padding: "3rem", textAlign: "center", color: "#64748b", fontSize: "0.9rem" }}>
                    <RefreshCw size={24} className="animate-spin" style={{ margin: "0 auto 0.5rem", color: "#7c3aed" }} />
                    <p>Actualizando programación de semanas...</p>
                  </div>
                ) : semanasConfigList.length === 0 ? (
                  <div
                    style={{
                      padding: "3rem 1.5rem",
                      textAlign: "center",
                      background: "#f8fafc",
                      border: "1.5px dashed #cbd5e1",
                      borderRadius: "1rem",
                      color: "#64748b"
                    }}
                  >
                    <Calendar size={36} color="#7c3aed" style={{ margin: "0 auto 0.75rem" }} />
                    <strong style={{ fontSize: "1rem", color: "#0f172a", display: "block" }}>
                      No hay semanas configuradas para {carrera}
                    </strong>
                    <span style={{ fontSize: "0.82rem", marginTop: "0.3rem", display: "block" }}>
                      Haz clic en el botón de abajo para agregar la primera semana.
                    </span>
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem", maxHeight: "430px", overflowY: "auto", paddingRight: "0.25rem" }}>
                    {semanasConfigList.map((sem, idx) => {
                      const semNum = Number(sem.numero_semana);
                      const isExam = Boolean(sem.es_examen);
                      const temasDeEstaSemana = isExam ? [] : temas.filter((t) => Number(t.semana) === semNum);
                      const parcialOpt = PARCIALES_OPTIONS.find((p) => p.id === sem.parcial) || PARCIALES_OPTIONS[0];

                      return (
                        <div
                          key={`sem_row_${semNum}_${idx}`}
                          style={{
                            background: isExam ? "#fffbeb" : "#ffffff",
                            border: isExam ? "1.5px solid #fde68a" : "1px solid #e2e8f0",
                            borderRadius: "0.85rem",
                            padding: "0.85rem 1.15rem",
                            display: "flex",
                            flexDirection: "column",
                            gap: "0.6rem",
                            boxShadow: "0 2px 5px rgba(0,0,0,0.02)",
                            transition: "all 0.15s ease"
                          }}
                        >
                          {/* Fila Principal de la Semana */}
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "0.5rem" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
                              {/* Botones de Reordenamiento ▲ Subir y ▼ Bajar */}
                              <div style={{ display: "inline-flex", gap: "2px", background: "#f1f5f9", borderRadius: "0.45rem", padding: "2px", border: "1px solid #e2e8f0" }}>
                                <button
                                  type="button"
                                  onClick={() => handleMoveWeek(idx, "up")}
                                  disabled={idx === 0 || loadingWeeks}
                                  style={{
                                    border: "none",
                                    background: idx === 0 ? "transparent" : "#ffffff",
                                    color: idx === 0 ? "#cbd5e1" : "#1e293b",
                                    width: "26px",
                                    height: "26px",
                                    borderRadius: "4px",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    cursor: idx === 0 ? "not-allowed" : "pointer"
                                  }}
                                  title="Mover semana hacia arriba"
                                >
                                  <ArrowUp size={14} />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleMoveWeek(idx, "down")}
                                  disabled={idx === semanasConfigList.length - 1 || loadingWeeks}
                                  style={{
                                    border: "none",
                                    background: idx === semanasConfigList.length - 1 ? "transparent" : "#ffffff",
                                    color: idx === semanasConfigList.length - 1 ? "#cbd5e1" : "#1e293b",
                                    width: "26px",
                                    height: "26px",
                                    borderRadius: "4px",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    cursor: idx === semanasConfigList.length - 1 ? "not-allowed" : "pointer"
                                  }}
                                  title="Mover semana hacia abajo"
                                >
                                  <ArrowDown size={14} />
                                </button>
                              </div>

                              <span
                                style={{
                                  background: isExam ? "#fef3c7" : "#f1f5f9",
                                  color: isExam ? "#b45309" : "#0f172a",
                                  fontWeight: 900,
                                  fontSize: "0.82rem",
                                  padding: "0.2rem 0.6rem",
                                  borderRadius: "6px"
                                }}
                              >
                                Semana {semNum}
                              </span>

                              <strong style={{ fontSize: "0.92rem", color: "#1e293b" }}>
                                {sem.nombre_semana || sem.descripcion || `Semana ${semNum}`}
                              </strong>

                              <span
                                style={{
                                  background: parcialOpt.bg,
                                  border: `1px solid ${parcialOpt.border}`,
                                  color: parcialOpt.color,
                                  fontSize: "0.72rem",
                                  fontWeight: 800,
                                  padding: "0.15rem 0.55rem",
                                  borderRadius: "9999px"
                                }}
                              >
                                {sem.parcial || "I Parcial"}
                              </span>

                              {isExam && (
                                <span
                                  style={{
                                    background: "#fef3c7",
                                    border: "1px solid #fcd34d",
                                    color: "#b45309",
                                    fontSize: "0.72rem",
                                    fontWeight: 800,
                                    padding: "0.15rem 0.55rem",
                                    borderRadius: "9999px",
                                    display: "inline-flex",
                                    alignItems: "center",
                                    gap: "0.25rem"
                                  }}
                                >
                                  <GraduationCap size={12} />
                                  Semana de Examen
                                </span>
                              )}
                            </div>

                            {/* Acciones: Editar y Eliminar Semana */}
                            <div style={{ display: "flex", alignItems: "center", gap: "0.35rem" }}>
                              <button
                                type="button"
                                onClick={() => handleOpenEditWeek(sem)}
                                style={{
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: "0.3rem",
                                  background: "#f0f9ff",
                                  border: "1px solid #bae6fd",
                                  color: "#0284c7",
                                  padding: "0.3rem 0.6rem",
                                  borderRadius: "0.45rem",
                                  fontSize: "0.75rem",
                                  fontWeight: 700,
                                  cursor: "pointer"
                                }}
                                title="Editar semana y temas"
                              >
                                <Edit3 size={12} />
                                <span>Editar</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => handleDeleteWeek(semNum)}
                                style={{
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: "0.3rem",
                                  background: "#fff1f2",
                                  border: "1px solid #fecdd3",
                                  color: "#e11d48",
                                  padding: "0.3rem 0.6rem",
                                  borderRadius: "0.45rem",
                                  fontSize: "0.75rem",
                                  fontWeight: 700,
                                  cursor: "pointer"
                                }}
                                title="Eliminar semana"
                              >
                                <Trash2 size={12} />
                                <span>Eliminar</span>
                              </button>
                            </div>
                          </div>

                          {/* Lista de Temas Asignados */}
                          {isExam ? (
                            <div
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "0.4rem",
                                padding: "0.35rem 0.65rem",
                                background: "#fffbeb",
                                border: "1px solid #fde68a",
                                borderRadius: "0.45rem",
                                color: "#92400e",
                                fontSize: "0.76rem",
                                fontWeight: 700
                              }}
                            >
                              <FileCheck2 size={14} color="#d97706" />
                              <span>Evaluación de Examen ({sem.parcial || "Examen"}) — Sin temas de clase regulares</span>
                            </div>
                          ) : (
                            <div style={{ display: "flex", flexWrap: "wrap", gap: "0.35rem", alignItems: "center" }}>
                              <span style={{ fontSize: "0.74rem", fontWeight: 700, color: "#64748b" }}>
                                Temas ({temasDeEstaSemana.length}):
                              </span>

                              {temasDeEstaSemana.length === 0 ? (
                                <span style={{ fontSize: "0.75rem", color: "#94a3b8", fontStyle: "italic" }}>
                                  Sin temas asignados
                                </span>
                              ) : (
                                temasDeEstaSemana.map((tema) => (
                                  <span
                                    key={tema.id}
                                    style={{
                                      display: "inline-flex",
                                      alignItems: "center",
                                      gap: "0.25rem",
                                      background: "#f0fdf4",
                                      border: "1px solid #bbf7d0",
                                      color: "#15803d",
                                      padding: "0.15rem 0.45rem",
                                      borderRadius: "5px",
                                      fontSize: "0.73rem",
                                      fontWeight: 700
                                    }}
                                  >
                                    <Check size={11} style={{ strokeWidth: 3 }} />
                                    #{tema.numero_tema || "?"} {tema.titulo || tema.nombre}
                                  </span>
                                ))
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Botón para Agregar Semana */}
                <button
                  type="button"
                  onClick={handleOpenAddWeek}
                  style={{
                    width: "100%",
                    padding: "0.85rem 1rem",
                    borderRadius: "0.75rem",
                    border: "1.5px dashed #c4b5fd",
                    background: "#faf5ff",
                    color: "#7c3aed",
                    fontSize: "0.86rem",
                    fontWeight: 800,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "0.5rem",
                    transition: "all 0.15s ease"
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = "#f3e8ff";
                    e.currentTarget.style.borderColor = "#a855f7";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = "#faf5ff";
                    e.currentTarget.style.borderColor = "#c4b5fd";
                  }}
                >
                  <PlusCircle size={18} />
                  <span>+ Agregar Semana</span>
                </button>
              </div>
            ) : (
              /* --- SUB-VISTA A2: FORMULARIO EDITAR / AGREGAR SEMANA --- */
              <form id="week-single-form" onSubmit={(e) => handleSaveSingleWeek(e, true)} style={{ display: "flex", flexDirection: "column", gap: "1.2rem" }}>
                {/* Botón Volver a la lista */}
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                  <button
                    type="button"
                    onClick={() => setWeekViewMode("list")}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "0.35rem",
                      background: "#f1f5f9",
                      border: "1px solid #cbd5e1",
                      color: "#475569",
                      padding: "0.35rem 0.75rem",
                      borderRadius: "0.5rem",
                      fontSize: "0.78rem",
                      fontWeight: 700,
                      cursor: "pointer"
                    }}
                  >
                    <ArrowLeft size={13} />
                    <span>Volver al listado de semanas</span>
                  </button>
                  <span style={{ fontSize: "0.8rem", color: "#64748b" }}>
                    {isEditingExistingWeek ? `Modificando Semana ${weekFormData.numero_semana}` : "Creando nueva semana"}
                  </span>
                </div>

                {/* Número y Nombre */}
                <div style={{ display: "grid", gridTemplateColumns: "120px 1fr", gap: "0.85rem" }}>
                  <div>
                    <label style={{ display: "block", fontSize: "0.82rem", fontWeight: 700, color: "#334155", marginBottom: "0.35rem" }}>
                      No. Semana *
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="30"
                      value={weekFormData.numero_semana}
                      onChange={(e) => setWeekFormData({ ...weekFormData, numero_semana: parseInt(e.target.value, 10) || 1 })}
                      required
                      style={{
                        width: "100%",
                        boxSizing: "border-box",
                        padding: "0.65rem 0.85rem",
                        borderRadius: "0.55rem",
                        border: "1.5px solid #cbd5e1",
                        fontSize: "0.9rem",
                        fontWeight: 800,
                        textAlign: "center",
                        outline: "none"
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ display: "block", fontSize: "0.82rem", fontWeight: 700, color: "#334155", marginBottom: "0.35rem" }}>
                      Nombre de la Semana
                    </label>
                    <input
                      type="text"
                      placeholder={weekFormData.es_examen ? `Examen ${String(weekFormData.parcial || "").includes("III") ? "III" : String(weekFormData.parcial || "").includes("II") ? "II" : "I"}` : `Semana ${weekFormData.numero_semana}`}
                      value={weekFormData.nombre_semana}
                      onChange={(e) => setWeekFormData({ ...weekFormData, nombre_semana: e.target.value })}
                      style={{
                        width: "100%",
                        boxSizing: "border-box",
                        padding: "0.65rem 0.85rem",
                        borderRadius: "0.55rem",
                        border: "1.5px solid #cbd5e1",
                        fontSize: "0.88rem",
                        outline: "none"
                      }}
                    />
                  </div>
                </div>

                {/* Tipo de Semana (Clase vs Examen) */}
                <div>
                  <label style={{ display: "block", fontSize: "0.82rem", fontWeight: 700, color: "#334155", marginBottom: "0.45rem" }}>
                    Tipo de Semana *
                  </label>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
                    <div
                      onClick={() => setWeekFormData({ ...weekFormData, es_examen: false })}
                      style={{
                        padding: "0.75rem 1rem",
                        borderRadius: "0.65rem",
                        border: !weekFormData.es_examen ? "2px solid #0284c7" : "1.5px solid #e2e8f0",
                        background: !weekFormData.es_examen ? "#f0f9ff" : "#ffffff",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        gap: "0.65rem"
                      }}
                    >
                      <BookOpen size={18} color={!weekFormData.es_examen ? "#0284c7" : "#64748b"} />
                      <div>
                        <strong style={{ fontSize: "0.85rem", color: !weekFormData.es_examen ? "#0369a1" : "#1e293b", display: "block" }}>
                          Clase Regular
                        </strong>
                        <span style={{ fontSize: "0.72rem", color: "#64748b" }}>Con temas y manuales</span>
                      </div>
                    </div>

                    <div
                      onClick={() => setWeekFormData({ ...weekFormData, es_examen: true, tema_ids: [] })}
                      style={{
                        padding: "0.75rem 1rem",
                        borderRadius: "0.65rem",
                        border: weekFormData.es_examen ? "2px solid #d97706" : "1.5px solid #e2e8f0",
                        background: weekFormData.es_examen ? "#fffbeb" : "#ffffff",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        gap: "0.65rem"
                      }}
                    >
                      <GraduationCap size={18} color={weekFormData.es_examen ? "#d97706" : "#64748b"} />
                      <div>
                        <strong style={{ fontSize: "0.85rem", color: weekFormData.es_examen ? "#b45309" : "#1e293b", display: "block" }}>
                          Semana de Examen
                        </strong>
                        <span style={{ fontSize: "0.72rem", color: "#64748b" }}>Evaluación (Sin temas)</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Parcial */}
                <div>
                  <label style={{ display: "block", fontSize: "0.82rem", fontWeight: 700, color: "#334155", marginBottom: "0.45rem" }}>
                    ¿A qué parcial pertenece? *
                  </label>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: "0.65rem" }}>
                    {PARCIALES_OPTIONS.map((parcial) => {
                      const isSelected = weekFormData.parcial === parcial.id;
                      return (
                        <div
                          key={parcial.id}
                          onClick={() => setWeekFormData({ ...weekFormData, parcial: parcial.id })}
                          style={{
                            padding: "0.7rem 0.9rem",
                            borderRadius: "0.65rem",
                            border: isSelected ? `2px solid ${parcial.color}` : "1.5px solid #e2e8f0",
                            background: isSelected ? parcial.bg : "#ffffff",
                            cursor: "pointer",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between"
                          }}
                        >
                          <strong style={{ fontSize: "0.84rem", color: isSelected ? parcial.color : "#1e293b" }}>
                            {parcial.label}
                          </strong>
                          {isSelected && <Check size={16} color={parcial.color} style={{ strokeWidth: 3 }} />}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Checkbox de temas de la semana si es clase regular */}
                {weekFormData.es_examen ? (
                  <div
                    style={{
                      padding: "1.1rem",
                      borderRadius: "0.75rem",
                      background: "linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%)",
                      border: "1.5px solid #fde68a",
                      display: "flex",
                      alignItems: "center",
                      gap: "0.75rem"
                    }}
                  >
                    <GraduationCap size={22} color="#d97706" style={{ flexShrink: 0 }} />
                    <span style={{ fontSize: "0.84rem", color: "#92400e", fontWeight: 700 }}>
                      Esta semana está reservada para el examen del <strong>{weekFormData.parcial}</strong>.
                    </span>
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.65rem" }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "0.5rem" }}>
                      <label style={{ fontSize: "0.82rem", fontWeight: 800, color: "#0f172a" }}>
                        Selecciona los temas de esta semana ({weekFormData.tema_ids.length} seleccionados):
                      </label>
                      <div style={{ display: "flex", gap: "0.4rem" }}>
                        <button
                          type="button"
                          onClick={handleSelectAllTopics}
                          style={{
                            background: "#f1f5f9",
                            border: "1px solid #cbd5e1",
                            color: "#334155",
                            borderRadius: "0.45rem",
                            padding: "0.2rem 0.5rem",
                            fontSize: "0.72rem",
                            fontWeight: 700,
                            cursor: "pointer"
                          }}
                        >
                          Todos
                        </button>
                        <button
                          type="button"
                          onClick={handleDeselectAllTopics}
                          style={{
                            background: "#f1f5f9",
                            border: "1px solid #cbd5e1",
                            color: "#334155",
                            borderRadius: "0.45rem",
                            padding: "0.2rem 0.5rem",
                            fontSize: "0.72rem",
                            fontWeight: 700,
                            cursor: "pointer"
                          }}
                        >
                          Desmarcar
                        </button>
                      </div>
                    </div>

                    <div style={{ position: "relative", width: "100%" }}>
                      <Search size={14} color="#94a3b8" style={{ position: "absolute", left: "0.75rem", top: "50%", transform: "translateY(-50%)" }} />
                      <input
                        type="text"
                        placeholder="Filtrar temas por nombre..."
                        value={topicSearchTerm}
                        onChange={(e) => setTopicSearchTerm(e.target.value)}
                        style={{
                          width: "100%",
                          boxSizing: "border-box",
                          padding: "0.45rem 0.75rem 0.45rem 2rem",
                          borderRadius: "0.5rem",
                          border: "1px solid #cbd5e1",
                          fontSize: "0.8rem",
                          outline: "none",
                          background: "#f8fafc"
                        }}
                      />
                    </div>

                    <div
                      style={{
                        border: "1px solid #cbd5e1",
                        borderRadius: "0.75rem",
                        maxHeight: "220px",
                        overflowY: "auto",
                        background: "#ffffff",
                        padding: "0.35rem"
                      }}
                    >
                      {filteredTopicsInForm.map((t) => {
                        const isChecked = weekFormData.tema_ids.includes(t.id);
                        return (
                          <div
                            key={t.id}
                            onClick={() => handleToggleTopicCheckbox(t.id)}
                            style={{
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "space-between",
                              gap: "0.65rem",
                              padding: "0.5rem 0.75rem",
                              borderRadius: "0.5rem",
                              background: isChecked ? "#f0fdf4" : "transparent",
                              border: isChecked ? "1px solid #86efac" : "1px solid transparent",
                              cursor: "pointer",
                              marginBottom: "0.2rem"
                            }}
                          >
                            <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", flex: 1, minWidth: 0 }}>
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => {}}
                                style={{ width: "16px", height: "16px", accentColor: "#16a34a", cursor: "pointer" }}
                              />
                              <span style={{ fontSize: "0.82rem", fontWeight: isChecked ? 800 : 600, color: isChecked ? "#15803d" : "#1e293b" }}>
                                #{t.numero_tema || "?"} {t.titulo || t.nombre}
                              </span>
                            </div>

                            {t.semana && Number(t.semana) > 0 && Number(t.semana) !== Number(weekFormData.numero_semana) && (
                              <span
                                style={{
                                  fontSize: "0.7rem",
                                  color: isChecked ? "#15803d" : "#d97706",
                                  background: isChecked ? "#dcfce7" : "#fef3c7",
                                  padding: "0.1rem 0.4rem",
                                  borderRadius: "4px",
                                  fontWeight: 700
                                }}
                              >
                                {isChecked ? `→ Pasará a Sem. ${weekFormData.numero_semana}` : `En Sem. ${t.semana}`}
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </form>
            )
          ) : activeMode === "reorder_temas" ? (
            /* =============================================================== */
            /* 🌟 VISTA B: HERRAMIENTA DE REORDENAR Y RENUMERAR TEMAS          */
            /* =============================================================== */
            <div style={{ display: "flex", flexDirection: "column", gap: "1.15rem" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "0.5rem" }}>
                <div>
                  <span style={{ fontSize: "0.88rem", fontWeight: 700, color: "#1e293b" }}>
                    Secuencia y Números de Temas ({orderedTemas.length} Temas en {carrera})
                  </span>
                  <p style={{ fontSize: "0.78rem", color: "#64748b", margin: "0.15rem 0 0 0" }}>
                    Usa <strong>▲</strong> y <strong>▼</strong> para mover los temas. Puedes presionar <em>Renumerar en Secuencia</em> para asignar 1, 2, 3... automáticamente.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleRenumberTopicsSequentially}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "0.4rem",
                    background: "#ede9fe",
                    border: "1px solid #c4b5fd",
                    color: "#6d28d9",
                    padding: "0.4rem 0.8rem",
                    borderRadius: "0.55rem",
                    fontSize: "0.78rem",
                    fontWeight: 800,
                    cursor: "pointer"
                  }}
                  title="Asignar números secuenciales 1, 2, 3... a la lista actual"
                >
                  <Sparkles size={14} color="#7c3aed" />
                  <span>⚡ Renumerar Todo (1, 2, 3...)</span>
                </button>
              </div>

              {orderedTemas.length === 0 ? (
                <div style={{ padding: "3rem 1.5rem", textAlign: "center", background: "#f8fafc", borderRadius: "1rem", color: "#64748b" }}>
                  No hay temas registrados para {carrera}.
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", maxHeight: "430px", overflowY: "auto", paddingRight: "0.25rem" }}>
                  {orderedTemas.map((tema, idx) => (
                    <div
                      key={tema.id}
                      style={{
                        background: "#ffffff",
                        border: "1px solid #e2e8f0",
                        borderRadius: "0.75rem",
                        padding: "0.75rem 1rem",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: "0.75rem",
                        boxShadow: "0 1px 4px rgba(0,0,0,0.02)"
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: "0.65rem", flex: 1, minWidth: 0 }}>
                        {/* Botones de Reordenar ▲ Subir y ▼ Bajar */}
                        <div style={{ display: "inline-flex", gap: "2px", background: "#f1f5f9", borderRadius: "0.45rem", padding: "2px", border: "1px solid #e2e8f0" }}>
                          <button
                            type="button"
                            onClick={() => handleMoveTopic(idx, "up")}
                            disabled={idx === 0}
                            style={{
                              border: "none",
                              background: idx === 0 ? "transparent" : "#ffffff",
                              color: idx === 0 ? "#cbd5e1" : "#1e293b",
                              width: "26px",
                              height: "26px",
                              borderRadius: "4px",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              cursor: idx === 0 ? "not-allowed" : "pointer"
                            }}
                            title="Mover tema hacia arriba"
                          >
                            <ArrowUp size={14} />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleMoveTopic(idx, "down")}
                            disabled={idx === orderedTemas.length - 1}
                            style={{
                              border: "none",
                              background: idx === orderedTemas.length - 1 ? "transparent" : "#ffffff",
                              color: idx === orderedTemas.length - 1 ? "#cbd5e1" : "#1e293b",
                              width: "26px",
                              height: "26px",
                              borderRadius: "4px",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              cursor: idx === orderedTemas.length - 1 ? "not-allowed" : "pointer"
                            }}
                            title="Mover tema hacia abajo"
                          >
                            <ArrowDown size={14} />
                          </button>
                        </div>

                        {/* Badge de Número de Tema */}
                        <span
                          style={{
                            background: "#f1f5f9",
                            color: "#0f172a",
                            fontWeight: 900,
                            fontSize: "0.82rem",
                            padding: "0.25rem 0.6rem",
                            borderRadius: "6px",
                            minWidth: "60px",
                            textAlign: "center"
                          }}
                        >
                          Tema #{tema.numero_tema || idx + 1}
                        </span>

                        <strong
                          style={{
                            fontSize: "0.88rem",
                            color: "#1e293b",
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis"
                          }}
                          title={tema.titulo || tema.nombre}
                        >
                          {tema.titulo || tema.nombre}
                        </strong>
                      </div>

                      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexShrink: 0 }}>
                        {tema.semana ? (
                          <span
                            style={{
                              background: "#f0f9ff",
                              color: "#0369a1",
                              border: "1px solid #bae6fd",
                              fontSize: "0.72rem",
                              fontWeight: 700,
                              padding: "0.15rem 0.5rem",
                              borderRadius: "9999px"
                            }}
                          >
                            Semana {tema.semana}
                          </span>
                        ) : (
                          <span style={{ fontSize: "0.72rem", color: "#94a3b8" }}>Sin semana</span>
                        )}

                        {tema.tiene_manual !== false && (
                          <span
                            style={{
                              background: "#f0fdf4",
                              color: "#166534",
                              border: "1px solid #bbf7d0",
                              fontSize: "0.7rem",
                              fontWeight: 700,
                              padding: "0.15rem 0.45rem",
                              borderRadius: "4px"
                            }}
                          >
                            Manual
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            /* =============================================================== */
            /* 🌟 VISTA C: FORMULARIO CREAR / EDITAR / ELIMINAR TEMA           */
            /* =============================================================== */
            <form id="temario-mgmt-form" onSubmit={(e) => handleSubmitTopic(e, "stay")} style={{ display: "flex", flexDirection: "column", gap: "1.2rem" }}>
              {/* Selector de tema en modo editar o eliminar */}
              {(activeMode === "edit" || activeMode === "delete") && (
                <div>
                  <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 700, color: "#334155", marginBottom: "0.45rem" }}>
                    Selecciona el Tema a {activeMode === "edit" ? "Modificar" : "Eliminar"} *
                  </label>
                  <select
                    value={targetId}
                    onChange={handleSelectTema}
                    required
                    style={{
                      width: "100%",
                      padding: "0.75rem 1rem",
                      borderRadius: "0.6rem",
                      border: "1.5px solid #cbd5e1",
                      fontSize: "0.9rem",
                      outline: "none",
                      background: "#ffffff"
                    }}
                  >
                    <option value="">-- Elige un tema de {carrera} --</option>
                    {temas.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.numero_tema ? `#${t.numero_tema} - ` : ""}
                        {t.titulo || t.nombre} {t.semana ? `(Semana ${t.semana})` : ""}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Campos del tema */}
              {(activeMode === "create" || (activeMode === "edit" && targetId)) && (
                <>
                  <div style={{ display: "grid", gridTemplateColumns: "110px 1fr", gap: "0.85rem" }}>
                    <div>
                      <label style={{ display: "block", fontSize: "0.82rem", fontWeight: 700, color: "#334155", marginBottom: "0.35rem" }}>
                        No. Tema *
                      </label>
                      <input
                        type="number"
                        name="numero_tema"
                        min="1"
                        max="99"
                        value={formData.numero_tema}
                        onChange={handleChange}
                        required
                        style={{
                          width: "100%",
                          boxSizing: "border-box",
                          padding: "0.75rem 0.5rem",
                          borderRadius: "0.6rem",
                          border: "1.5px solid #cbd5e1",
                          fontSize: "0.95rem",
                          fontWeight: 800,
                          textAlign: "center",
                          outline: "none"
                        }}
                      />
                    </div>

                    <div>
                      <label style={{ display: "block", fontSize: "0.82rem", fontWeight: 700, color: "#334155", marginBottom: "0.35rem" }}>
                        Nombre del Tema *
                      </label>
                      <input
                        type="text"
                        name="titulo"
                        placeholder="Ej. Introducción al Microscopio y Técnica Histológica"
                        value={formData.titulo}
                        onChange={handleChange}
                        required
                        autoFocus
                        style={{
                          width: "100%",
                          boxSizing: "border-box",
                          padding: "0.75rem 1rem",
                          borderRadius: "0.6rem",
                          border: "1.5px solid #cbd5e1",
                          fontSize: "0.95rem",
                          outline: "none"
                        }}
                      />
                    </div>
                  </div>

                  {/* AVISO Y CONTROL DE DESPLAZAMIENTO AUTOMÁTICO (+1) */}
                  {duplicateTopic && (
                    <div
                      style={{
                        padding: "0.85rem 1rem",
                        background: "#f0fdf4",
                        border: "1.5px solid #86efac",
                        borderRadius: "0.75rem",
                        display: "flex",
                        flexDirection: "column",
                        gap: "0.45rem",
                        animation: "fadeIn 0.2s ease"
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "flex-start", gap: "0.65rem" }}>
                        <Sparkles size={18} color="#16a34a" style={{ flexShrink: 0, marginTop: "2px" }} />
                        <div>
                          <strong style={{ fontSize: "0.86rem", color: "#166534", display: "block" }}>
                            El número #{formData.numero_tema} ya está asignado a "{duplicateTopic.titulo || duplicateTopic.nombre}"
                          </strong>
                          <label
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: "0.5rem",
                              marginTop: "0.35rem",
                              cursor: "pointer",
                              userSelect: "none"
                            }}
                          >
                            <input
                              type="checkbox"
                              checked={desplazarSiguientes}
                              onChange={(e) => setDesplazarSiguientes(e.target.checked)}
                              style={{ width: "16px", height: "16px", accentColor: "#16a34a", cursor: "pointer" }}
                            />
                            <span style={{ fontSize: "0.84rem", fontWeight: 800, color: "#15803d" }}>
                              ⚡ Desplazar temas siguientes automáticamente (+1)
                            </span>
                          </label>
                          <p style={{ fontSize: "0.76rem", color: "#4b5563", margin: "0.25rem 0 0 0", lineHeight: 1.3 }}>
                            Al guardar, los temas del #{formData.numero_tema} en adelante se moverán un número hacia adelante (+1) para abrir espacio a este tema en secuencia.
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Checkbox de Manual Evaluable */}
                  <label
                    style={{
                      padding: "0.85rem 1rem",
                      borderRadius: "0.75rem",
                      border: formData.tiene_manual ? "1.5px solid #86efac" : "1.5px solid #cbd5e1",
                      background: formData.tiene_manual ? "#f0fdf4" : "#f8fafc",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: "0.75rem",
                      userSelect: "none"
                    }}
                  >
                    <input
                      type="checkbox"
                      name="tiene_manual"
                      checked={Boolean(formData.tiene_manual)}
                      onChange={(e) => setFormData((prev) => ({ ...prev, tiene_manual: e.target.checked }))}
                      style={{
                        width: "18px",
                        height: "18px",
                        accentColor: "#16a34a",
                        cursor: "pointer",
                        flexShrink: 0
                      }}
                    />
                    <div>
                      <strong style={{ fontSize: "0.88rem", color: formData.tiene_manual ? "#15803d" : "#334155", display: "block" }}>
                        ¿Este tema posee Manual evaluable?
                      </strong>
                      <span style={{ fontSize: "0.75rem", color: "#64748b" }}>
                        {formData.tiene_manual
                          ? "✓ Habilita la casilla de calificación de manual para este tema."
                          : "Tema de clase sin nota de manual individual."}
                      </span>
                    </div>
                  </label>
                </>
              )}
            </form>
          )}
        </div>

        {/* =================================================================== */}
        {/* 🔘 BARRA INFERIOR DE ACCIONES (Persistencia y Agilidad)             */}
        {/* =================================================================== */}
        <div
          style={{
            padding: "0.9rem 1.5rem",
            borderTop: "1px solid #e2e8f0",
            background: "#f8fafc",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: "0.75rem",
            flexShrink: 0
          }}
        >
          <div>
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: "0.6rem 1.15rem",
                borderRadius: "0.6rem",
                border: "1px solid #cbd5e1",
                background: "#ffffff",
                color: "#475569",
                fontSize: "0.86rem",
                fontWeight: 700,
                cursor: "pointer"
              }}
            >
              Cerrar
            </button>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "0.65rem", flexWrap: "wrap" }}>
            {activeMode === "weeks" || activeMode === "reorder" ? (
              weekViewMode === "form" ? (
                <>
                  <button
                    type="button"
                    onClick={() => setWeekViewMode("list")}
                    style={{
                      padding: "0.6rem 1rem",
                      borderRadius: "0.6rem",
                      border: "1px solid #cbd5e1",
                      background: "#ffffff",
                      color: "#475569",
                      fontSize: "0.86rem",
                      fontWeight: 700,
                      cursor: "pointer"
                    }}
                  >
                    Volver a la Lista
                  </button>
                  <button
                    type="button"
                    onClick={(e) => handleSaveSingleWeek(e, false)}
                    disabled={loading}
                    style={{
                      padding: "0.6rem 1.15rem",
                      borderRadius: "0.6rem",
                      border: "1px solid #c4b5fd",
                      background: "#faf5ff",
                      color: "#7c3aed",
                      fontSize: "0.86rem",
                      fontWeight: 800,
                      cursor: loading ? "not-allowed" : "pointer"
                    }}
                  >
                    {loading ? "Guardando..." : "Guardar Cambios"}
                  </button>
                  <button
                    type="button"
                    onClick={(e) => handleSaveSingleWeek(e, true)}
                    disabled={loading}
                    style={{
                      padding: "0.6rem 1.25rem",
                      borderRadius: "0.6rem",
                      border: "none",
                      background: "linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%)",
                      color: "#ffffff",
                      fontSize: "0.86rem",
                      fontWeight: 800,
                      cursor: loading ? "not-allowed" : "pointer",
                      boxShadow: "0 4px 12px rgba(124, 58, 237, 0.25)"
                    }}
                  >
                    Guardar y Volver a Lista
                  </button>
                </>
              ) : null
            ) : activeMode === "reorder_temas" ? (
              <>
                <button
                  type="button"
                  onClick={() => handleSaveTopicOrder(false)}
                  disabled={savingOrder}
                  style={{
                    padding: "0.6rem 1.15rem",
                    borderRadius: "0.6rem",
                    border: "1px solid #c7d2fe",
                    background: "#eef2ff",
                    color: "#4f46e5",
                    fontSize: "0.86rem",
                    fontWeight: 800,
                    cursor: savingOrder ? "not-allowed" : "pointer"
                  }}
                >
                  {savingOrder ? "Guardando..." : "Guardar Orden"}
                </button>
                <button
                  type="button"
                  onClick={() => handleSaveTopicOrder(true)}
                  disabled={savingOrder}
                  style={{
                    padding: "0.6rem 1.25rem",
                    borderRadius: "0.6rem",
                    border: "none",
                    background: "linear-gradient(135deg, #4f46e5 0%, #4338ca 100%)",
                    color: "#ffffff",
                    fontSize: "0.86rem",
                    fontWeight: 800,
                    cursor: savingOrder ? "not-allowed" : "pointer",
                    boxShadow: "0 4px 12px rgba(79, 70, 229, 0.25)"
                  }}
                >
                  Guardar y Salir
                </button>
              </>
            ) : activeMode === "create" ? (
              <>
                <button
                  type="button"
                  onClick={(e) => handleSubmitTopic(e, "next")}
                  disabled={loading}
                  style={{
                    padding: "0.6rem 1.15rem",
                    borderRadius: "0.6rem",
                    border: "1.5px solid #86efac",
                    background: "#f0fdf4",
                    color: "#16a34a",
                    fontSize: "0.86rem",
                    fontWeight: 800,
                    cursor: loading ? "not-allowed" : "pointer"
                  }}
                >
                  {loading ? "Guardando..." : "Guardar y Crear Siguiente"}
                </button>
                <button
                  type="button"
                  onClick={(e) => handleSubmitTopic(e, "close")}
                  disabled={loading}
                  style={{
                    padding: "0.6rem 1.25rem",
                    borderRadius: "0.6rem",
                    border: "none",
                    background: "linear-gradient(135deg, #16a34a 0%, #15803d 100%)",
                    color: "#ffffff",
                    fontSize: "0.86rem",
                    fontWeight: 800,
                    cursor: loading ? "not-allowed" : "pointer",
                    boxShadow: "0 4px 12px rgba(22, 163, 74, 0.25)"
                  }}
                >
                  Guardar y Salir
                </button>
              </>
            ) : activeMode === "edit" ? (
              <>
                <button
                  type="button"
                  onClick={(e) => handleSubmitTopic(e, "stay")}
                  disabled={loading || !targetId}
                  style={{
                    padding: "0.6rem 1.15rem",
                    borderRadius: "0.6rem",
                    border: "1.5px solid #fde68a",
                    background: "#fffbeb",
                    color: "#d97706",
                    fontSize: "0.86rem",
                    fontWeight: 800,
                    cursor: loading || !targetId ? "not-allowed" : "pointer"
                  }}
                >
                  {loading ? "Guardando..." : "Guardar Cambios"}
                </button>
                <button
                  type="button"
                  onClick={(e) => handleSubmitTopic(e, "close")}
                  disabled={loading || !targetId}
                  style={{
                    padding: "0.6rem 1.25rem",
                    borderRadius: "0.6rem",
                    border: "none",
                    background: "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)",
                    color: "#ffffff",
                    fontSize: "0.86rem",
                    fontWeight: 800,
                    cursor: loading || !targetId ? "not-allowed" : "pointer",
                    boxShadow: "0 4px 12px rgba(217, 119, 6, 0.25)"
                  }}
                >
                  Guardar y Salir
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={(e) => handleSubmitTopic(e, "close")}
                disabled={loading || !targetId}
                style={{
                  padding: "0.6rem 1.25rem",
                  borderRadius: "0.6rem",
                  border: "none",
                  background: "linear-gradient(135deg, #ef4444 0%, #dc2626 100%)",
                  color: "#ffffff",
                  fontSize: "0.86rem",
                  fontWeight: 800,
                  cursor: loading || !targetId ? "not-allowed" : "pointer",
                  boxShadow: "0 4px 12px rgba(239, 68, 68, 0.25)"
                }}
              >
                {loading ? "Eliminando..." : "Confirmar Eliminación"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}
