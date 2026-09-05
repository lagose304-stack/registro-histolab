import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import {
  HelpCircle,
  ArrowLeft,
  Save,
  RefreshCw,
  Plus,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Eye,
  FileText,
  Clock,
  Award,
  Image as ImageIcon,
  ListOrdered,
  Type,
  ChevronRight,
  ExternalLink,
  Check,
  Calendar,
  Sparkles,
  BookOpen,
  RotateCcw,
  Radio
} from "lucide-react";
import { api } from "../services/api";

const createDefaultQuestions = () => [
  { id: "q_1", numero: 1, enunciado: "", puntos: 1.0, es_bonus: false, items: [] },
  { id: "q_2", numero: 2, enunciado: "", puntos: 1.0, es_bonus: false, items: [] },
  { id: "q_3", numero: 3, enunciado: "", puntos: 1.0, es_bonus: false, items: [] },
  { id: "q_4", numero: 4, enunciado: "", puntos: 1.0, es_bonus: false, items: [] },
  { id: "q_5", numero: 5, enunciado: "", puntos: 1.0, es_bonus: false, items: [] },
  { id: "q_6", numero: 6, enunciado: "", puntos: 1.0, es_bonus: true, items: [] }
];

const normalizeSixQuestions = (rawQuestions = []) => {
  const defaults = createDefaultQuestions();
  if (!Array.isArray(rawQuestions) || rawQuestions.length === 0) {
    return defaults;
  }

  const result = [];
  for (let i = 0; i < 6; i++) {
    if (rawQuestions[i]) {
      const q = rawQuestions[i];
      const rawItems = Array.isArray(q.items) ? q.items : [];
      const normalizedItems = rawItems.map((it) => {
        const itemPts = it.puntos !== undefined && !isNaN(Number(it.puntos))
          ? Number(it.puntos)
          : (rawItems.length > 0 ? parseFloat((1.0 / rawItems.length).toFixed(3)) : 0.5);
        return {
          ...it,
          puntos: itemPts,
          cantidad: it.cantidad || (it.tipo === "listado" ? 3 : 1)
        };
      });

      let questionPts = 1.0;
      if (normalizedItems.length > 0) {
        const sumItems = normalizedItems.reduce((acc, it) => acc + (parseFloat(it.puntos) || 0), 0);
        questionPts = parseFloat(Math.min(1.0, Math.max(0, sumItems)).toFixed(3));
      } else if (q.puntos !== undefined && !isNaN(Number(q.puntos))) {
        questionPts = parseFloat(Math.min(1.0, Math.max(0, Number(q.puntos))).toFixed(3));
      }

      result.push({
        ...defaults[i],
        ...q,
        numero: i + 1,
        puntos: questionPts,
        es_bonus: i === 5, // La pregunta 6 (índice 5) SIEMPRE es bonus fijo; preguntas 1 a 5 nunca son bonus
        items: normalizedItems
      });
    } else {
      result.push(defaults[i]);
    }
  }
  return result;
};

export default function WeeklyQuizCreationView({
  seccion,
  currentInstructor,
  hideBackButton = false,
  onClose = () => {},
  notify = () => {},
  onOpenLiveControl = null
}) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [showResetModal, setShowResetModal] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [viewMode, setViewMode] = useState("builder"); // 'builder' | 'preview'

  const notifyRef = useRef(notify);
  notifyRef.current = notify;

  // Datos académicos de la sección
  const [semanasConfig, setSemanasConfig] = useState([]);
  const [temario, setTemario] = useState([]);
  const [sectionQuizzes, setSectionQuizzes] = useState([]);

  const carrera = seccion?.carrera || "Medicina";

  // Semana actualmente seleccionada para editar (null = vista catálogo de semanas)
  const [selectedSemana, setSelectedSemana] = useState(null);

  // Estructura de la prueba actual (por defecto 6 preguntas de 1.0 pt, con la 6ta como bonus)
  const [quizData, setQuizData] = useState({
    id: null,
    titulo: "",
    puntajeTotal: 6.0,
    duracionMinutos: 15,
    tiempoPorPreguntaSegundos: 90,
    estado: "borrador", // 'borrador' | 'publicada'
    instrucciones: "",
    preguntas: createDefaultQuestions()
  });

  // Clave de almacenamiento local de respaldo
  const getStorageKey = useCallback(
    (sem) => `histolab_quiz_${seccion?.id || "sec"}_sem_${sem}`,
    [seccion?.id]
  );

  const getWeekDisplayName = (w) => {
    if (!w) return "";
    const rawName = (w.nombre_semana || w.descripcion || "").trim();
    if (!rawName) return `Semana ${w.numero_semana}`;
    if (rawName.toLowerCase().startsWith("semana")) return rawName;
    return `Semana ${w.numero_semana}: ${rawName}`;
  };

  // 1. Cargar configuración de semanas, temario y pruebas existentes de la sección
  const loadInitialData = useCallback(async () => {
    if (!seccion?.id) return;
    setLoading(true);

    try {
      const [resSemanas, resTemario, resQuizzes] = await Promise.all([
        api.semanas.getConfig(carrera).catch(() => ({ data: [] })),
        api.temario.getAll({ carrera }).catch(() => ({ data: [] })),
        api.pruebas.getBySeccion(seccion.id).catch(() => ({ data: [] }))
      ]);

      if (resSemanas?.data) setSemanasConfig(resSemanas.data);
      if (resTemario?.data) setTemario(resTemario.data);
      if (resQuizzes?.data && Array.isArray(resQuizzes.data)) {
        setSectionQuizzes(resQuizzes.data);
      }
    } catch (err) {
      console.error("Error al cargar datos en Crear prueba semanal:", err);
      notifyRef.current("Error al cargar la información de la sección", "error");
    } finally {
      setLoading(false);
    }
  }, [seccion?.id, carrera]);

  useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);

  // Refrescar pruebas de la sección
  const refreshSectionQuizzes = async () => {
    if (!seccion?.id) return;
    try {
      const res = await api.pruebas.getBySeccion(seccion.id);
      if (res?.success && Array.isArray(res.data)) {
        setSectionQuizzes(res.data);
      }
    } catch (err) {
      console.warn("Aviso al refrescar pruebas de la sección:", err.message);
    }
  };

  // Lista unificada de semanas (excluyendo semanas de examen)
  const availableWeeks = useMemo(() => {
    const weekMap = new Map();

    semanasConfig.forEach((s) => {
      const num = Number(s.numero_semana);
      if (!num) return;
      const isExam = Boolean(s.es_examen) || (s.temas || "").toUpperCase().includes("EXAMEN");
      const rawNombre = s.nombre_semana || s.descripcion || (isExam ? `Semana ${num} - Examen` : `Semana ${num}`);

      weekMap.set(num, {
        numero_semana: num,
        nombre_semana: rawNombre,
        parcial: s.parcial || "I Parcial",
        fecha_inicio: s.fecha_inicio,
        fecha_fin: s.fecha_fin,
        esExamen: isExam,
        descripcion: rawNombre
      });
    });

    temario.forEach((t) => {
      const num = Number(t.semana);
      if (!num) return;
      if (!weekMap.has(num)) {
        weekMap.set(num, {
          numero_semana: num,
          nombre_semana: `Semana ${num}`,
          parcial: num <= 4 ? "I Parcial" : num <= 8 ? "II Parcial" : "III Parcial",
          fecha_inicio: null,
          fecha_fin: null,
          esExamen: false,
          descripcion: `Semana ${num}`
        });
      }
    });

    if (weekMap.size === 0) {
      weekMap.set(1, { numero_semana: 1, nombre_semana: "Semana 1", parcial: "I Parcial", descripcion: "Semana 1", esExamen: false });
    }

    return Array.from(weekMap.values())
      .filter((w) => !w.esExamen)
      .sort((a, b) => a.numero_semana - b.numero_semana);
  }, [semanasConfig, temario]);

  // Mapa de pruebas ya guardadas por semana
  const quizzesBySemanaMap = useMemo(() => {
    const map = new Map();
    sectionQuizzes.forEach((q) => {
      if (q.numero_semana) {
        map.set(Number(q.numero_semana), q);
      }
    });
    return map;
  }, [sectionQuizzes]);

  // Información de la semana actualmente seleccionada
  const currentWeekInfo = useMemo(() => {
    if (!selectedSemana) return null;
    return availableWeeks.find((w) => w.numero_semana === selectedSemana) || {
      numero_semana: selectedSemana,
      nombre_semana: `Semana ${selectedSemana}`,
      parcial: "I Parcial",
      descripcion: `Semana ${selectedSemana}`
    };
  }, [availableWeeks, selectedSemana]);

  // Cargar prueba al seleccionar una semana
  useEffect(() => {
    if (selectedSemana === null) return;
    let isMounted = true;

    const fetchQuiz = async () => {
      try {
        if (seccion?.id) {
          const res = await api.pruebas.getBySemana(seccion.id, selectedSemana);
          if (res?.success && res.data && isMounted) {
            const serverQuiz = res.data;
            const normalizedPreguntas = normalizeSixQuestions(serverQuiz.preguntas);
            setQuizData({
              id: serverQuiz.id || null,
              titulo: serverQuiz.titulo || `Prueba Semanal ${selectedSemana}`,
              puntajeTotal: serverQuiz.puntaje_total !== undefined ? Number(serverQuiz.puntaje_total) : 5.0,
              duracionMinutos: serverQuiz.duracion_minutos || 15,
              tiempoPorPreguntaSegundos: Number(serverQuiz.tiempo_por_pregunta_segundos) || 90,
              estado: serverQuiz.publicada ? "publicada" : (serverQuiz.estado || "borrador"),
              instrucciones: serverQuiz.instrucciones || "",
              preguntas: normalizedPreguntas
            });
            setHasUnsavedChanges(false);
            return;
          }
        }
      } catch (err) {
        console.warn("Aviso al consultar prueba del servidor:", err.message);
      }

      // Respaldo en localStorage si existiese
      const key = getStorageKey(selectedSemana);
      const saved = localStorage.getItem(key);
      if (saved && isMounted) {
        try {
          const parsed = JSON.parse(saved);
          parsed.preguntas = normalizeSixQuestions(parsed.preguntas);
          setQuizData(parsed);
          setHasUnsavedChanges(false);
          return;
        } catch (err) {
          console.warn("Error al leer localStorage:", err);
        }
      }

      // Si es una prueba nueva, inicializar con 6 preguntas vacías (la 6ta como bonus de 1.0 pt)
      if (isMounted) {
        setQuizData({
          id: null,
          titulo: `Prueba Semanal ${selectedSemana}`,
          puntajeTotal: 6.0,
          duracionMinutos: 15,
          tiempoPorPreguntaSegundos: 90,
          estado: "borrador",
          instrucciones: "",
          preguntas: createDefaultQuestions()
        });
        setHasUnsavedChanges(false);
      }
    };

    fetchQuiz();

    return () => {
      isMounted = false;
    };
  }, [selectedSemana, seccion?.id, getStorageKey]);

  // Salir de la edición y volver al catálogo de semanas
  const handleBackToCatalog = () => {
    if (hasUnsavedChanges) {
      const confirmLeave = window.confirm(
        "Tienes cambios sin guardar en esta prueba. ¿Seguro que deseas volver a la lista de pruebas?"
      );
      if (!confirmLeave) return;
    }
    setSelectedSemana(null);
    setHasUnsavedChanges(false);
    setViewMode("builder");
    refreshSectionQuizzes();
  };

  // Alternar estado entre Borrador y Publicar
  const handleToggleEstado = () => {
    const nextState = quizData.estado === "publicada" ? "borrador" : "publicada";
    setQuizData((prev) => ({ ...prev, estado: nextState }));
    setHasUnsavedChanges(true);
    notifyRef.current(
      nextState === "publicada"
        ? "Estado cambiado a: PUBLICADA. Los alumnos podrán verla al guardar los cambios."
        : "Estado cambiado a: BORRADOR. La prueba queda oculta para los alumnos.",
      "info"
    );
  };

  // Agregar nueva pregunta vacía (Valor por defecto 1.0 pt)
  const handleAddQuestion = () => {
    const newNum = quizData.preguntas.length + 1;
    const newQ = {
      id: "q_" + Date.now(),
      numero: newNum,
      enunciado: "",
      puntos: 1.0,
      items: [] // Sin items precargados
    };

    setQuizData((prev) => ({
      ...prev,
      preguntas: [...prev.preguntas, newQ]
    }));
    setHasUnsavedChanges(true);
  };

  // Eliminar pregunta
  const handleRemoveQuestion = (qId) => {
    setQuizData((prev) => {
      const filtered = prev.preguntas.filter((q) => q.id !== qId);
      const renumbered = filtered.map((q, idx) => ({ ...q, numero: idx + 1 }));
      return { ...prev, preguntas: renumbered };
    });
    setHasUnsavedChanges(true);
  };

  // Modificar campo de una pregunta (restringido a 1.0 pt máximo)
  const handleUpdateQuestion = (qId, field, value) => {
    if (field === "es_bonus") return; // La condición de bonus está fija exclusivamente en la Pregunta 6
    setQuizData((prev) => ({
      ...prev,
      preguntas: prev.preguntas.map((q) => {
        if (q.id !== qId) return q;
        if (field === "puntos") {
          const valNum = Math.max(0.05, Math.min(1.0, parseFloat(value) || 0));
          return { ...q, puntos: parseFloat(valNum.toFixed(3)) };
        }
        return { ...q, [field]: value };
      })
    }));
    setHasUnsavedChanges(true);
  };

  // Agregar sub-ítem (apartado) a una pregunta con puntaje proporcional
  const handleAddSubItem = (qId, tipo = "texto_corto", cantidad = 1) => {
    setQuizData((prev) => ({
      ...prev,
      preguntas: prev.preguntas.map((q) => {
        if (q.id !== qId) return q;
        const cantFinal = tipo === "texto_corto" ? 1 : Math.max(1, Math.min(10, parseInt(cantidad, 10) || 3));
        const currentItems = q.items || [];
        const currentSum = currentItems.reduce((acc, it) => acc + (parseFloat(it.puntos) || 0), 0);
        const remaining = Math.max(0, parseFloat((1.0 - currentSum).toFixed(3)));

        let defaultPts = 0.5;
        if (currentItems.length === 0) {
          defaultPts = 1.0;
        } else if (remaining > 0.05) {
          defaultPts = remaining;
        } else {
          defaultPts = parseFloat((1.0 / (currentItems.length + 1)).toFixed(3));
        }

        const newItem = {
          id: "item_" + Date.now() + "_" + Math.floor(Math.random() * 1000),
          tipo,
          instruccion: "",
          etiqueta: "",
          puntos: defaultPts,
          cantidad: cantFinal,
          respuesta_modelo: "",
          respuestas_esperadas: tipo === "texto_corto" ? [] : Array(cantFinal).fill("")
        };

        const newItemsList = [...currentItems, newItem];
        const newSum = newItemsList.reduce((acc, it) => acc + (parseFloat(it.puntos) || 0), 0);

        return {
          ...q,
          puntos: parseFloat(Math.min(1.0, newSum).toFixed(3)),
          items: newItemsList
        };
      })
    }));
    setHasUnsavedChanges(true);
  };

  // Distribuir 1.0 punto equitativamente entre los apartados de una pregunta
  const handleDistributeSubItemPoints = (qId) => {
    setQuizData((prev) => ({
      ...prev,
      preguntas: prev.preguntas.map((q) => {
        if (q.id !== qId) return q;
        const items = q.items || [];
        if (items.length === 0) return q;
        const base = parseFloat((1.0 / items.length).toFixed(3));
        const rem = parseFloat((1.0 - base * items.length).toFixed(3));
        const updated = items.map((it, idx) => ({
          ...it,
          puntos: idx === 0 ? parseFloat((base + rem).toFixed(3)) : base
        }));
        return {
          ...q,
          puntos: 1.0,
          items: updated
        };
      })
    }));
    setHasUnsavedChanges(true);
    notifyRef.current("Puntos distribuidos equitativamente (1.00 pt en total).", "info");
  };

  // Modificar sub-ítem (apartado)
  const handleUpdateSubItem = (qId, itemId, field, value) => {
    setQuizData((prev) => ({
      ...prev,
      preguntas: prev.preguntas.map((q) => {
        if (q.id !== qId) return q;
        const updatedItems = (q.items || []).map((it) => {
          if (it.id !== itemId) return it;
          if (field === "puntos") {
            const parsed = Math.max(0, Math.min(1.0, parseFloat(value) || 0));
            return { ...it, puntos: parsed };
          }
          if (field === "cantidad") {
            const newCant = Math.max(1, Math.min(10, parseInt(value, 10) || 1));
            const currentResps = it.respuestas_esperadas || [];
            const newResps = Array(newCant).fill("").map((_, i) => currentResps[i] || "");
            return { ...it, cantidad: newCant, respuestas_esperadas: newResps };
          }
          if (field === "instruccion") {
            return { ...it, instruccion: value, etiqueta: value };
          }
          return { ...it, [field]: value };
        });

        // Recalcular puntos de la pregunta como suma de los apartados
        const sumPts = updatedItems.reduce((acc, it) => acc + (parseFloat(it.puntos) || 0), 0);

        return {
          ...q,
          puntos: parseFloat(sumPts.toFixed(3)),
          items: updatedItems
        };
      })
    }));
    setHasUnsavedChanges(true);
  };

  // Modificar respuesta esperada en sub-ítem de listado
  const handleUpdateExpectedAnswer = (qId, itemId, index, text) => {
    setQuizData((prev) => ({
      ...prev,
      preguntas: prev.preguntas.map((q) => {
        if (q.id !== qId) return q;
        return {
          ...q,
          items: (q.items || []).map((it) => {
            if (it.id !== itemId) return it;
            const resps = [...(it.respuestas_esperadas || [])];
            resps[index] = text;
            return { ...it, respuestas_esperadas: resps };
          })
        };
      })
    }));
    setHasUnsavedChanges(true);
  };

  // Eliminar sub-ítem (apartado)
  const handleRemoveSubItem = (qId, itemId) => {
    setQuizData((prev) => ({
      ...prev,
      preguntas: prev.preguntas.map((q) => {
        if (q.id !== qId) return q;
        const remainingItems = (q.items || []).filter((it) => it.id !== itemId);
        const sumPts = remainingItems.length > 0
          ? remainingItems.reduce((acc, it) => acc + (parseFloat(it.puntos) || 0), 0)
          : 1.0;
        return {
          ...q,
          puntos: parseFloat(Math.min(1.0, sumPts).toFixed(3)),
          items: remainingItems
        };
      })
    }));
    setHasUnsavedChanges(true);
  };

  // Guardar prueba en la base de datos
  const handleSaveQuiz = async () => {
    if (!seccion?.id || selectedSemana === null) return;

    // Validación estricta: ninguna pregunta puede valer más de 1.00 pt
    for (let i = 0; i < quizData.preguntas.length; i++) {
      const q = quizData.preguntas[i];
      const qVal = parseFloat(q.puntos) || 0;
      if (qVal > 1.001) {
        notifyRef.current(
          `La Pregunta #${i + 1} tiene un valor de ${qVal.toFixed(3)} pts, superando el límite máximo permitido de 1.00 pt. Ajusta sus puntos antes de guardar.`,
          "error"
        );
        return;
      }
      if (q.items && q.items.length > 0) {
        const sumItems = q.items.reduce((acc, it) => acc + (parseFloat(it.puntos) || 0), 0);
        if (sumItems > 1.001) {
          notifyRef.current(
            `La suma de los apartados de la Pregunta #${i + 1} (${sumItems.toFixed(3)} pts) excede el máximo permitido de 1.00 pt.`,
            "error"
          );
          return;
        }
      }
    }

    setSaving(true);

    try {
      const isPublicada = quizData.estado === "publicada";
      const totalPoints = quizData.preguntas.reduce((acc, q) => acc + (parseFloat(q.puntos) || 0), 0);
      const cleanTotalPoints = parseFloat(totalPoints.toFixed(3));
      const cleanOfficialPoints = Math.min(5.0, cleanTotalPoints);

      const tiempoPorPregunta = quizData.tiempoPorPreguntaSegundos || 90;
      const estimatedMins = Math.ceil((quizData.preguntas.length * tiempoPorPregunta) / 60);

      const payload = {
        ...quizData,
        puntajeTotal: cleanOfficialPoints,
        puntaje_total: cleanOfficialPoints,
        puntaje_maximo_con_bonus: cleanTotalPoints,
        tiene_bonus: true,
        numero_semana: selectedSemana,
        carrera: seccion.carrera || "Medicina",
        seccion_id: seccion.id,
        publicada: isPublicada,
        estado: isPublicada ? "publicada" : "borrador",
        duracionMinutos: estimatedMins,
        duracion_minutos: estimatedMins,
        tiempo_limite_minutos: estimatedMins,
        tiempo_por_pregunta_segundos: tiempoPorPregunta,
        preguntas: quizData.preguntas.map((q) => ({
          ...q,
          tiempo_segundos: tiempoPorPregunta
        }))
      };

      const res = await api.pruebas.saveBySemana(seccion.id, payload);
      if (!res?.success) {
        throw new Error(res?.message || "Error al guardar la prueba en el servidor.");
      }

      const savedQuiz = res?.data || payload;

      // Actualizar el estado del quiz con el ID persistido devuelto por el servidor
      setQuizData((prev) => ({
        ...prev,
        id: savedQuiz.id || prev.id,
        puntajeTotal: cleanOfficialPoints
      }));

      const key = getStorageKey(selectedSemana);
      localStorage.setItem(key, JSON.stringify(savedQuiz));

      // Actualizar INMEDIATAMENTE la lista de pruebas de la sección en el estado
      // para que el catálogo cambie al instante de '⚪ Sin crear' a '🟢 Publicada' o '🟡 Borrador'
      setSectionQuizzes((prev) => {
        const others = (prev || []).filter((q) => Number(q.numero_semana) !== Number(selectedSemana));
        return [...others, savedQuiz];
      });

      setHasUnsavedChanges(false);
      notifyRef.current(
        `¡Prueba de la Semana ${selectedSemana} guardada con éxito (${isPublicada ? "PUBLICADA" : "BORRADOR"} • Oficial: ${cleanOfficialPoints.toFixed(3)} pts / Total con bonus: ${cleanTotalPoints.toFixed(3)} pts)!`,
        "success"
      );
      // Sincronizar en background
      await refreshSectionQuizzes();
    } catch (err) {
      console.error("Error al guardar prueba:", err);
      notifyRef.current(err.message || "Error al guardar la prueba semanal", "error");
    } finally {
      setSaving(false);
    }
  };

  // Reiniciar la prueba completa y borrar todas las preguntas guardadas
  const handleResetQuiz = async () => {
    if (!seccion?.id || selectedSemana === null) return;
    setResetting(true);

    try {
      const cleanDefaults = createDefaultQuestions();
      const resetPayload = {
        id: quizData.id || null,
        titulo: `Prueba Semanal ${selectedSemana}`,
        descripcion: "",
        instrucciones: "",
        duracionMinutos: 15,
        duracion_minutos: 15,
        tiempo_limite_minutos: 15,
        puntajeTotal: 5.0,
        puntaje_total: 5.0,
        puntaje_maximo_con_bonus: 6.0,
        tiene_bonus: true,
        numero_semana: selectedSemana,
        carrera: seccion.carrera || "Medicina",
        seccion_id: seccion.id,
        publicada: false,
        estado: "borrador",
        preguntas: cleanDefaults
      };

      const res = await api.pruebas.saveBySemana(seccion.id, resetPayload);
      if (!res?.success) {
        throw new Error(res?.message || "Error al reiniciar la prueba en el servidor.");
      }

      const savedQuiz = res?.data || resetPayload;

      setQuizData({
        id: savedQuiz.id || quizData.id,
        titulo: `Prueba Semanal ${selectedSemana}`,
        descripcion: "",
        instrucciones: "",
        duracionMinutos: 15,
        puntajeTotal: 5.0,
        estado: "borrador",
        preguntas: cleanDefaults
      });

      const key = getStorageKey(selectedSemana);
      localStorage.setItem(key, JSON.stringify(savedQuiz));

      setSectionQuizzes((prev) => {
        const others = (prev || []).filter((q) => Number(q.numero_semana) !== Number(selectedSemana));
        return [...others, savedQuiz];
      });

      setHasUnsavedChanges(false);
      setShowResetModal(false);
      notifyRef.current(
        `¡Prueba de la Semana ${selectedSemana} reiniciada con éxito! Todas las preguntas guardadas han sido eliminadas para comenzar desde cero.`,
        "success"
      );
      await refreshSectionQuizzes();
    } catch (err) {
      console.error("Error al reiniciar prueba:", err);
      notifyRef.current(err.message || "Error al reiniciar la prueba semanal", "error");
    } finally {
      setResetting(false);
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
          Cargando pruebas semanales de la sección...
        </span>
      </div>
    );
  }

  // =========================================================================
  // PANTALLA 1: CATÁLOGO Y SELECCIÓN DE PRUEBAS SEMANALES (selectedSemana === null)
  // =========================================================================
  if (selectedSemana === null) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "1.75rem", paddingBottom: "3.5rem" }}>
        {/* Cabecera del Catálogo */}
        <div
          className="glass-panel"
          style={{
            padding: "1.75rem 2rem",
            background: "#ffffff",
            borderRadius: "1.25rem",
            border: "1.5px solid #e2e8f0",
            boxShadow: "0 10px 30px -5px rgba(0, 0, 0, 0.05)",
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
                    cursor: "pointer"
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
                  background: "linear-gradient(135deg, #0284c7 0%, #0369a1 100%)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#ffffff",
                  boxShadow: "0 4px 12px rgba(2, 132, 199, 0.25)"
                }}
              >
                <HelpCircle size={24} />
              </div>

              <div>
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
                  <h2 style={{ margin: 0, fontSize: "1.3rem", fontWeight: 900, color: "#0f172a" }}>
                    Pruebas Semanales de la Sección
                  </h2>
                  <span
                    style={{
                      background: "#e0f2fe",
                      color: "#0369a1",
                      fontWeight: 800,
                      fontSize: "0.75rem",
                      padding: "0.2rem 0.6rem",
                      borderRadius: "0.4rem"
                    }}
                  >
                    {seccion?.codigo}
                  </span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", fontSize: "0.82rem", color: "#64748b", marginTop: "0.2rem" }}>
                  <span>{carrera}</span>
                  <span>•</span>
                  <span>{seccion?.dia} {seccion?.hora_inicio} - {seccion?.hora_fin}</span>
                  <span>•</span>
                  <span>Escala Oficial: <strong>5.000 pts c/u</strong></span>
                </div>
              </div>
            </div>
          </div>

          <div
            style={{
              padding: "0.75rem 1rem",
              borderRadius: "0.65rem",
              background: "#f8fafc",
              border: "1px solid #e2e8f0",
              color: "#475569",
              fontSize: "0.84rem",
              display: "flex",
              alignItems: "center",
              gap: "0.5rem"
            }}
          >
            <BookOpen size={16} color="#0284c7" style={{ flexShrink: 0 }} />
            <span>
              Selecciona la semana en la que deseas redactar reactivos, configurar o publicar la prueba para que los alumnos la contesten desde su portal.
            </span>
          </div>
        </div>

        {/* Grid de Semanas Disponibles */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
            gap: "1.25rem"
          }}
        >
          {availableWeeks.map((week) => {
            const existingQuiz = quizzesBySemanaMap.get(week.numero_semana);
            const isPublished = existingQuiz?.publicada || existingQuiz?.estado === "publicada";
            const isDraft = existingQuiz && !isPublished;
            const hasQuestions = (existingQuiz?.preguntas?.length || 0) > 0;

            return (
              <div
                key={week.numero_semana}
                onClick={() => setSelectedSemana(week.numero_semana)}
                style={{
                  background: "#ffffff",
                  borderRadius: "1rem",
                  border: isPublished
                    ? "2px solid #86efac"
                    : isDraft
                    ? "2px solid #fde68a"
                    : "1.5px solid #e2e8f0",
                  padding: "1.35rem",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                  gap: "1.1rem",
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                  boxShadow: "0 4px 12px -2px rgba(0, 0, 0, 0.04)"
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = "translateY(-3px)";
                  e.currentTarget.style.boxShadow = "0 10px 20px -3px rgba(0, 0, 0, 0.08)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = "translateY(0)";
                  e.currentTarget.style.boxShadow = "0 4px 12px -2px rgba(0, 0, 0, 0.04)";
                }}
              >
                {/* Header de la Tarjeta */}
                <div>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.5rem" }}>
                    <span
                      style={{
                        fontSize: "0.74rem",
                        fontWeight: 800,
                        padding: "0.15rem 0.5rem",
                        borderRadius: "9999px",
                        background: "#eff6ff",
                        color: "#1d4ed8"
                      }}
                    >
                      {week.parcial}
                    </span>

                    {/* Badge de Estado */}
                    {isPublished ? (
                      <span
                        style={{
                          fontSize: "0.72rem",
                          fontWeight: 800,
                          padding: "0.2rem 0.55rem",
                          borderRadius: "9999px",
                          background: "#dcfce7",
                          color: "#15803d",
                          border: "1px solid #86efac"
                        }}
                      >
                        🟢 Publicada
                      </span>
                    ) : isDraft ? (
                      <span
                        style={{
                          fontSize: "0.72rem",
                          fontWeight: 800,
                          padding: "0.2rem 0.55rem",
                          borderRadius: "9999px",
                          background: "#fef9c3",
                          color: "#854d0e",
                          border: "1px solid #fde047"
                        }}
                      >
                        🟡 Borrador
                      </span>
                    ) : (
                      <span
                        style={{
                          fontSize: "0.72rem",
                          fontWeight: 700,
                          padding: "0.2rem 0.55rem",
                          borderRadius: "9999px",
                          background: "#f1f5f9",
                          color: "#64748b"
                        }}
                      >
                        ⚪ Sin crear
                      </span>
                    )}
                  </div>

                  <h3 style={{ margin: "0 0 0.35rem 0", fontSize: "1.15rem", fontWeight: 800, color: "#0f172a" }}>
                    {getWeekDisplayName(week)}
                  </h3>

                  <p style={{ margin: 0, fontSize: "0.82rem", color: "#64748b", lineHeight: 1.35 }}>
                    {existingQuiz?.titulo
                      ? existingQuiz.titulo
                      : hasQuestions
                      ? `${existingQuiz.preguntas.length} preguntas redactadas`
                      : "Prueba semanal sin reactivos diseñados todavía."}
                  </p>
                </div>

                {/* Métricas y Botón de Acción */}
                <div style={{ paddingTop: "0.75rem", borderTop: "1px solid #f1f5f9", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", fontSize: "0.78rem", color: "#64748b", fontWeight: 700 }}>
                    <FileText size={14} color="#0284c7" />
                    <span>{existingQuiz?.preguntas?.length || 0} Preguntas</span>
                  </div>

                  <div
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "0.3rem",
                      fontSize: "0.82rem",
                      fontWeight: 800,
                      color: isPublished ? "#15803d" : "#0284c7"
                    }}
                  >
                    <span>{existingQuiz ? "Editar Prueba" : "Diseñar Prueba"}</span>
                    <ChevronRight size={15} />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // =========================================================================
  // PANTALLA 2: EDITOR DE LA PRUEBA SELECCIONADA (selectedSemana !== null)
  // =========================================================================
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.75rem", paddingBottom: "3.5rem" }}>
      {/* 1. Cabecera del Editor */}
      <div
        className="glass-panel"
        style={{
          padding: "1.75rem 2rem",
          background: "#ffffff",
          borderRadius: "1.25rem",
          border: "1.5px solid #e2e8f0",
          boxShadow: "0 10px 30px -5px rgba(0, 0, 0, 0.05)",
          display: "flex",
          flexDirection: "column",
          gap: "1.25rem"
        }}
      >
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: "1.25rem" }}>
          <div>
            {!hideBackButton && (
              <button
                type="button"
                onClick={handleBackToCatalog}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "0.45rem",
                  padding: "0.45rem 0.95rem",
                  borderRadius: "0.55rem",
                  background: "#f8fafc",
                  color: "#334155",
                  border: "1px solid #cbd5e1",
                  fontSize: "0.82rem",
                  fontWeight: 700,
                  cursor: "pointer",
                  marginBottom: "1rem",
                  transition: "all 0.15s ease",
                  boxShadow: "0 1px 3px rgba(0, 0, 0, 0.03)"
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "#f1f5f9";
                  e.currentTarget.style.color = "#0f172a";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "#f8fafc";
                  e.currentTarget.style.color = "#334155";
                }}
              >
                <ArrowLeft size={16} />
                <span>Volver al Catálogo de Pruebas</span>
              </button>
            )}

            <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", marginBottom: "0.45rem", flexWrap: "wrap" }}>
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "0.35rem",
                  background: "#eff6ff",
                  color: "#1d4ed8",
                  fontSize: "0.76rem",
                  fontWeight: 800,
                  padding: "0.25rem 0.75rem",
                  borderRadius: "9999px",
                  border: "1px solid #bfdbfe"
                }}
              >
                <Calendar size={13} color="#2563eb" />
                {currentWeekInfo?.parcial || "I Parcial"}
              </span>

              <span
                style={{
                  background: "#f0fdf4",
                  color: "#166534",
                  fontSize: "0.76rem",
                  fontWeight: 800,
                  padding: "0.25rem 0.75rem",
                  borderRadius: "9999px",
                  border: "1px solid #bbf7d0",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "0.3rem"
                }}
              >
                <CheckCircle2 size={13} color="#16a34a" />
                Escala Oficial: 5.000 pts máx.
              </span>

              <span
                style={{
                  background: "#fef3c7",
                  color: "#92400e",
                  fontSize: "0.76rem",
                  fontWeight: 800,
                  padding: "0.25rem 0.75rem",
                  borderRadius: "9999px",
                  border: "1px solid #fde68a",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "0.3rem"
                }}
              >
                <Sparkles size={13} color="#d97706" />
                Pregunta 6 Bonus Fijo (+1.0 pt para Premios)
              </span>
            </div>

            <h1
              style={{
                margin: "0 0 0.35rem",
                fontSize: "1.75rem",
                fontWeight: 900,
                color: "#0f172a",
                letterSpacing: "-0.02em",
                display: "flex",
                alignItems: "center",
                gap: "0.75rem"
              }}
            >
              <div
                style={{
                  width: "42px",
                  height: "42px",
                  borderRadius: "0.75rem",
                  background: "linear-gradient(135deg, #0284c7 0%, #0369a1 100%)",
                  color: "#ffffff",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  boxShadow: "0 4px 12px rgba(2, 132, 199, 0.3)",
                  flexShrink: 0
                }}
              >
                <HelpCircle size={24} />
              </div>
              <span>Diseño de Prueba: {getWeekDisplayName(currentWeekInfo)}</span>
            </h1>

            <div style={{ fontSize: "0.85rem", color: "#64748b", display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap", marginTop: "0.25rem" }}>
              <span>Sección: <strong style={{ color: "#0f172a" }}>{seccion?.codigo}</strong></span>
              <span>•</span>
              <span>Carrera: <strong style={{ color: "#0f172a" }}>{carrera}</strong></span>
              <span>•</span>
              <span>Estructura: <strong>6 preguntas fijas (máx. 1.000 pt c/u)</strong></span>
            </div>
          </div>

          {/* Botones de acción principales */}
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap" }}>
            {/* BOTÓN PROMINENTE DE BORRADOR / PUBLICAR */}
            <button
              type="button"
              onClick={handleToggleEstado}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "0.55rem",
                padding: "0.6rem 1.15rem",
                borderRadius: "0.65rem",
                fontSize: "0.84rem",
                fontWeight: 800,
                cursor: "pointer",
                border: quizData.estado === "publicada" ? "2px solid #10b981" : "2px solid #f59e0b",
                background: quizData.estado === "publicada" ? "#ecfdf5" : "#fffbeb",
                color: quizData.estado === "publicada" ? "#065f46" : "#b45309",
                boxShadow: "0 2px 6px rgba(0,0,0,0.04)",
                transition: "all 0.15s ease"
              }}
              title="Click para alternar entre Borrador y Publicada"
            >
              <span
                style={{
                  width: "10px",
                  height: "10px",
                  borderRadius: "50%",
                  background: quizData.estado === "publicada" ? "#10b981" : "#f59e0b"
                }}
              />
              <span>
                {quizData.estado === "publicada"
                  ? "🟢 Publicada (Visible para alumnos)"
                  : "🟡 Borrador (Oculta para alumnos)"}
              </span>
            </button>

            {/* Alternar Vista Previa */}
            <button
              type="button"
              onClick={() => setViewMode(viewMode === "builder" ? "preview" : "builder")}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "0.45rem",
                padding: "0.6rem 1.1rem",
                borderRadius: "0.65rem",
                border: "1.5px solid #cbd5e1",
                background: viewMode === "preview" ? "#eff6ff" : "#ffffff",
                color: viewMode === "preview" ? "#0284c7" : "#475569",
                fontSize: "0.84rem",
                fontWeight: 700,
                cursor: "pointer",
                transition: "all 0.15s ease"
              }}
            >
              <Eye size={16} />
              <span>{viewMode === "preview" ? "Volver a Edición" : "Vista Previa Alumno"}</span>
            </button>

            {/* Botón Control en Vivo si la función está disponible */}
            {onOpenLiveControl && (
              <button
                type="button"
                onClick={() => onOpenLiveControl(selectedSemana)}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "0.45rem",
                  padding: "0.6rem 1.1rem",
                  borderRadius: "0.65rem",
                  border: "1.5px solid #fca5a5",
                  background: "#fef2f2",
                  color: "#dc2626",
                  fontSize: "0.84rem",
                  fontWeight: 900,
                  cursor: "pointer",
                  transition: "all 0.15s ease"
                }}
                title="Abrir el panel de control de transmisión en directo para esta semana"
              >
                <Radio size={15} />
                <span>Control en Vivo</span>
              </button>
            )}

            {/* Botón Reiniciar Toda la Prueba */}
            <button
              type="button"
              onClick={() => setShowResetModal(true)}
              disabled={saving || resetting}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "0.45rem",
                padding: "0.6rem 1.1rem",
                borderRadius: "0.65rem",
                border: "1.5px solid #fecaca",
                background: "#fef2f2",
                color: "#b91c1c",
                fontSize: "0.84rem",
                fontWeight: 800,
                cursor: saving || resetting ? "not-allowed" : "pointer",
                transition: "all 0.15s ease"
              }}
              title="Borrar todas las preguntas guardadas y comenzar desde cero"
            >
              <RotateCcw size={15} />
              <span>Reiniciar Prueba</span>
            </button>

            {/* Botón Guardar */}
            <button
              type="button"
              onClick={handleSaveQuiz}
              disabled={saving}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "0.5rem",
                padding: "0.6rem 1.35rem",
                borderRadius: "0.65rem",
                border: "none",
                background: hasUnsavedChanges
                  ? "linear-gradient(135deg, #16a34a 0%, #15803d 100%)"
                  : "linear-gradient(135deg, #0284c7 0%, #0369a1 100%)",
                color: "#ffffff",
                fontSize: "0.86rem",
                fontWeight: 800,
                cursor: saving ? "not-allowed" : "pointer",
                boxShadow: hasUnsavedChanges
                  ? "0 4px 14px rgba(22, 163, 74, 0.3)"
                  : "0 4px 14px rgba(2, 132, 199, 0.25)",
                transition: "all 0.15s ease"
              }}
            >
              {saving ? <RefreshCw size={16} className="animate-spin" /> : <Save size={16} />}
              <span>{saving ? "Guardando..." : hasUnsavedChanges ? "Guardar Cambios" : "Guardar Prueba"}</span>
            </button>
          </div>
        </div>
      </div>

      {/* VISTA PREVIA DEL ESTUDIANTE */}
      {viewMode === "preview" ? (
        <div
          className="glass-panel"
          style={{
            background: "#ffffff",
            borderRadius: "1.25rem",
            border: "1.5px solid #e2e8f0",
            padding: "2rem",
            boxShadow: "0 4px 20px -2px rgba(0, 0, 0, 0.04)",
            display: "flex",
            flexDirection: "column",
            gap: "1.5rem"
          }}
        >
          <div style={{ borderBottom: "1.5px solid #e2e8f0", paddingBottom: "1rem" }}>
            <span style={{ fontSize: "0.74rem", fontWeight: 800, color: "#0284c7", textTransform: "uppercase" }}>
              Vista Previa • Portal del Estudiante
            </span>
            <h3 style={{ margin: "0.35rem 0", fontSize: "1.35rem", fontWeight: 900, color: "#0f172a" }}>
              {quizData.titulo || `Prueba Semanal — ${getWeekDisplayName(currentWeekInfo)}`}
            </h3>
            {quizData.instrucciones && (
              <p style={{ margin: "0.5rem 0 0 0", fontSize: "0.88rem", color: "#475569", lineHeight: 1.45 }}>
                {quizData.instrucciones}
              </p>
            )}
          </div>

          {quizData.preguntas.map((q, idx) => (
            <div
              key={q.id}
              style={{
                border: q.es_bonus ? "1.5px solid #f59e0b" : "1px solid #e2e8f0",
                borderRadius: "0.85rem",
                padding: "1.35rem",
                background: q.es_bonus ? "#fffdfa" : "#f8fafc"
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.85rem", flexWrap: "wrap", gap: "0.5rem" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                  <span style={{ fontSize: "0.85rem", fontWeight: 800, color: "#0f172a" }}>
                    Pregunta #{idx + 1}
                  </span>
                  {q.es_bonus && (
                    <span
                      style={{
                        background: "#fef3c7",
                        border: "1px solid #fde68a",
                        color: "#92400e",
                        fontSize: "0.72rem",
                        fontWeight: 900,
                        padding: "0.15rem 0.5rem",
                        borderRadius: "9999px"
                      }}
                    >
                      ⭐ BONUS (+1.0 PT)
                    </span>
                  )}
                </div>
                <span style={{ fontSize: "0.75rem", fontWeight: 800, color: "#059669", background: "#dcfce7", padding: "0.15rem 0.5rem", borderRadius: "9999px" }}>
                  Valor: {Number(q.puntos).toFixed(3)} pt(s)
                </span>
              </div>

              {q.enunciado ? (
                <p style={{ margin: "0 0 1rem 0", fontSize: "0.92rem", fontWeight: 700, color: "#1e293b" }}>
                  {q.enunciado}
                </p>
              ) : null}

              <div style={{ display: "flex", flexDirection: "column", gap: "0.85rem" }}>
                {(q.items || []).map((item, iIdx) => (
                  <div key={item.id || iIdx} style={{ background: "#ffffff", border: "1px solid #cbd5e1", borderRadius: "0.55rem", padding: "0.85rem" }}>
                    <label style={{ display: "block", fontSize: "0.82rem", fontWeight: 800, color: "#334155", marginBottom: "0.45rem" }}>
                      {item.instruccion || (item.tipo === "texto_corto" ? "Respuesta corta:" : "Listado:")}
                    </label>

                    {item.tipo === "texto_corto" ? (
                      <input
                        type="text"
                        disabled
                        placeholder="El estudiante escribirá su respuesta aquí..."
                        style={{
                          width: "100%",
                          padding: "0.5rem 0.75rem",
                          borderRadius: "0.45rem",
                          border: "1px solid #cbd5e1",
                          background: "#f8fafc",
                          fontSize: "0.85rem"
                        }}
                      />
                    ) : (
                      <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
                        {Array.from({ length: item.cantidad || 3 }).map((_, slotIdx) => (
                          <div key={slotIdx} style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                            <span style={{ fontSize: "0.8rem", fontWeight: 800, color: "#0284c7", width: "20px" }}>
                              {slotIdx + 1}.
                            </span>
                            <input
                              type="text"
                              disabled
                              placeholder={`Elemento #${slotIdx + 1}...`}
                              style={{
                                flex: 1,
                                padding: "0.45rem 0.75rem",
                                borderRadius: "0.45rem",
                                border: "1px solid #cbd5e1",
                                background: "#f8fafc",
                                fontSize: "0.85rem"
                              }}
                            />
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* MODO EDITOR DE REACTIVOS */
        <div style={{ display: "flex", flexDirection: "column", gap: "1.75rem" }}>
          {/* 2. Datos Generales de la Prueba */}
          <div
            className="glass-panel"
            style={{
              padding: "1.75rem 2rem",
              background: "#ffffff",
              borderRadius: "1.25rem",
              border: "1.5px solid #e2e8f0",
              boxShadow: "0 4px 20px -2px rgba(0,0,0,0.03)",
              display: "flex",
              flexDirection: "column",
              gap: "1.25rem"
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <FileText size={20} color="#0284c7" />
              <h3 style={{ margin: 0, fontSize: "1.1rem", fontWeight: 800, color: "#0f172a" }}>
                Datos Generales de la Prueba
              </h3>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "1.25rem" }}>
              <div>
                <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 800, color: "#334155", marginBottom: "0.35rem" }}>
                  Título de la Prueba Semanal:
                </label>
                <input
                  type="text"
                  value={quizData.titulo}
                  onChange={(e) => {
                    setQuizData((prev) => ({ ...prev, titulo: e.target.value }));
                    setHasUnsavedChanges(true);
                  }}
                  placeholder="Ej: Prueba Semanal 3 — Tejido Epitelial y Conectivo"
                  style={{
                    width: "100%",
                    padding: "0.65rem 0.85rem",
                    borderRadius: "0.55rem",
                    border: "1.5px solid #cbd5e1",
                    fontSize: "0.88rem",
                    outline: "none",
                    background: "#ffffff"
                  }}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 800, color: "#334155", marginBottom: "0.35rem" }}>
                  Tiempo individual por pregunta (sincronizado en vivo):
                </label>
                <select
                  value={quizData.tiempoPorPreguntaSegundos || 90}
                  onChange={(e) => {
                    const sec = parseInt(e.target.value, 10) || 90;
                    const estMins = Math.ceil((6 * sec) / 60);
                    setQuizData((prev) => ({
                      ...prev,
                      tiempoPorPreguntaSegundos: sec,
                      duracionMinutos: estMins
                    }));
                    setHasUnsavedChanges(true);
                  }}
                  style={{
                    width: "100%",
                    padding: "0.65rem 0.85rem",
                    borderRadius: "0.55rem",
                    border: "1.5px solid #0284c7",
                    fontSize: "0.88rem",
                    fontWeight: 800,
                    background: "#f0f9ff",
                    color: "#0369a1",
                    outline: "none"
                  }}
                >
                  <option value={60}>1:00 min (60 segundos por pregunta)</option>
                  <option value={90}>1:30 min (90 segundos por pregunta) — [Por defecto reglamentario]</option>
                  <option value={120}>2:00 min (120 segundos por pregunta)</option>
                  <option value={150}>2:30 min (150 segundos por pregunta)</option>
                  <option value={180}>3:00 min (180 segundos por pregunta)</option>
                </select>
                <div style={{ fontSize: "0.74rem", color: "#64748b", marginTop: "0.35rem" }}>
                  Duración total estimada: {Math.ceil((6 * (quizData.tiempoPorPreguntaSegundos || 90)) / 60)} min (6 preguntas × {((quizData.tiempoPorPreguntaSegundos || 90) / 60).toFixed(1)} min)
                </div>
              </div>
            </div>

            <div>
              <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 800, color: "#334155", marginBottom: "0.35rem" }}>
                Instrucciones Generales para el Alumno:
              </label>
              <textarea
                rows={2}
                value={quizData.instrucciones}
                onChange={(e) => {
                  setQuizData((prev) => ({ ...prev, instrucciones: e.target.value }));
                  setHasUnsavedChanges(true);
                }}
                placeholder="Escribe las indicaciones que el alumno leerá antes de empezar a contestar..."
                style={{
                  width: "100%",
                  padding: "0.65rem 0.85rem",
                  borderRadius: "0.55rem",
                  border: "1.5px solid #cbd5e1",
                  fontSize: "0.85rem",
                  outline: "none",
                  resize: "vertical",
                  background: "#ffffff"
                }}
              />
            </div>
          </div>

          {/* 3. Listado de 6 Preguntas Fijas */}
          <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                flexWrap: "wrap",
                gap: "1rem",
                padding: "0.25rem 0.5rem"
              }}
            >
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
                  <h3 style={{ margin: 0, fontSize: "1.2rem", fontWeight: 900, color: "#0f172a" }}>
                    Preguntas de la Prueba ({quizData.preguntas.length} Preguntas Fijas)
                  </h3>
                  <span
                    style={{
                      background: "#f1f5f9",
                      color: "#475569",
                      fontSize: "0.74rem",
                      fontWeight: 800,
                      padding: "0.2rem 0.65rem",
                      borderRadius: "9999px",
                      border: "1px solid #cbd5e1"
                    }}
                  >
                    Estructura Fija
                  </span>
                </div>
                <p style={{ margin: "0.3rem 0 0", fontSize: "0.84rem", color: "#64748b", maxWidth: "800px", lineHeight: 1.45 }}>
                  La prueba tiene 6 preguntas fijas (cada una de 1.000 pt máx.). Las preguntas 1 a 5 corresponden a la nota oficial regular (hasta 5.000 pts) y la Pregunta 6 es exclusivamente el reactivo bonus (+1.000 pt adicional para Premios de la Sección).
                </p>
              </div>

              {/* Badges de estado general */}
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "0.35rem",
                    padding: "0.4rem 0.8rem",
                    borderRadius: "0.6rem",
                    background: "#f0fdf4",
                    color: "#166534",
                    border: "1px solid #bbf7d0",
                    fontSize: "0.78rem",
                    fontWeight: 800
                  }}
                >
                  <Award size={14} color="#16a34a" />
                  Suma Base: {Math.min(5.0, quizData.preguntas.reduce((acc, q) => acc + (parseFloat(q.puntos) || 0), 0)).toFixed(3)} / 5.000 pts
                </span>

                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "0.35rem",
                    padding: "0.4rem 0.8rem",
                    borderRadius: "0.6rem",
                    background: "#fef3c7",
                    color: "#92400e",
                    border: "1px solid #fde68a",
                    fontSize: "0.78rem",
                    fontWeight: 800
                  }}
                >
                  <Sparkles size={14} color="#d97706" />
                  Total c/ Bonus: {quizData.preguntas.reduce((acc, q) => acc + (parseFloat(q.puntos) || 0), 0).toFixed(3)} pts
                </span>
              </div>
            </div>

            {/* Renderizado de las 6 Preguntas */}
            {quizData.preguntas.map((pregunta, qIdx) => {
              const isBonus = qIdx === 5;

              return (
                <div
                  key={pregunta.id}
                  className="glass-panel"
                  style={{
                    background: isBonus ? "linear-gradient(180deg, #fffdf8 0%, #ffffff 100%)" : "#ffffff",
                    borderRadius: "1.25rem",
                    border: isBonus ? "2px solid #f59e0b" : "1.5px solid #cbd5e1",
                    padding: "1.75rem 2rem",
                    boxShadow: isBonus
                      ? "0 6px 20px -3px rgba(245, 158, 11, 0.15)"
                      : "0 4px 16px -2px rgba(0, 0, 0, 0.04)",
                    display: "flex",
                    flexDirection: "column",
                    gap: "1.25rem",
                    transition: "all 0.2s ease"
                  }}
                >
                  {/* Header de la Pregunta */}
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "0.75rem", borderBottom: "1px solid #f1f5f9", paddingBottom: "1rem" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", flexWrap: "wrap" }}>
                      <span
                        style={{
                          width: "32px",
                          height: "32px",
                          borderRadius: "50%",
                          background: isBonus
                            ? "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)"
                            : "linear-gradient(135deg, #0284c7 0%, #0369a1 100%)",
                          color: "#ffffff",
                          fontSize: "0.9rem",
                          fontWeight: 900,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          boxShadow: isBonus ? "0 2px 8px rgba(245, 158, 11, 0.35)" : "0 2px 8px rgba(2, 132, 199, 0.3)"
                        }}
                      >
                        {qIdx + 1}
                      </span>

                      <strong style={{ fontSize: "1.08rem", color: "#0f172a" }}>
                        Pregunta #{qIdx + 1}
                      </strong>

                      {isBonus ? (
                        <span
                          style={{
                            background: "#fef3c7",
                            border: "1.5px solid #f59e0b",
                            color: "#92400e",
                            fontSize: "0.74rem",
                            fontWeight: 900,
                            padding: "0.2rem 0.65rem",
                            borderRadius: "9999px",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "0.3rem",
                            boxShadow: "0 2px 5px rgba(245, 158, 11, 0.15)"
                          }}
                        >
                          <Sparkles size={12} color="#d97706" />
                          PREGUNTA BONUS (+1.0 PT EXTRA PARA PREMIOS)
                        </span>
                      ) : (
                        <span
                          style={{
                            background: "#f8fafc",
                            border: "1px solid #e2e8f0",
                            color: "#64748b",
                            fontSize: "0.74rem",
                            fontWeight: 700,
                            padding: "0.2rem 0.65rem",
                            borderRadius: "9999px"
                          }}
                        >
                          PREGUNTA REGULAR (1.000 PT)
                        </span>
                      )}
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap" }}>
                      {/* Puntaje de la pregunta */}
                      <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                        <span style={{ fontSize: "0.78rem", fontWeight: 700, color: "#64748b" }}>Valor:</span>
                        {pregunta.items && pregunta.items.length > 0 ? (
                          <div
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "0.3rem",
                              padding: "0.3rem 0.65rem",
                              borderRadius: "0.5rem",
                              background: Number(pregunta.puntos) > 1.001 ? "#fee2e2" : "#f0fdf4",
                              border: `1.5px solid ${Number(pregunta.puntos) > 1.001 ? "#fca5a5" : "#86efac"}`,
                              color: Number(pregunta.puntos) > 1.001 ? "#dc2626" : "#166534",
                              fontSize: "0.84rem",
                              fontWeight: 900
                            }}
                            title="El puntaje de esta pregunta se calcula sumando sus apartados (máx 1.000 pt)"
                          >
                            <span>Σ {Number(pregunta.puntos).toFixed(3)} / 1.000 pt</span>
                          </div>
                        ) : (
                          <div style={{ display: "inline-flex", alignItems: "center", gap: "0.3rem" }}>
                            <input
                              type="number"
                              step="0.05"
                              min="0.05"
                              max="1"
                              value={pregunta.puntos}
                              onChange={(e) => {
                                const val = parseFloat(e.target.value) || 0;
                                handleUpdateQuestion(pregunta.id, "puntos", Math.min(1.0, Math.max(0, val)));
                              }}
                              style={{
                                width: "68px",
                                padding: "0.35rem 0.5rem",
                                borderRadius: "0.45rem",
                                border: "1.5px solid #0284c7",
                                fontSize: "0.84rem",
                                fontWeight: 800,
                                textAlign: "center",
                                background: "#f0f9ff",
                                color: "#0369a1"
                              }}
                            />
                            <span style={{ fontSize: "0.78rem", color: "#64748b", fontWeight: 700 }}>/ 1.000 pt</span>
                          </div>
                        )}
                      </div>

                      {/* DISTINTIVO FIJO DE BONUS PARA LA PREGUNTA 6 */}
                      {isBonus && (
                        <div
                          style={{
                            background: "linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)",
                            border: "1.5px solid #f59e0b",
                            color: "#92400e",
                            padding: "0.38rem 0.85rem",
                            borderRadius: "0.55rem",
                            fontSize: "0.78rem",
                            fontWeight: 800,
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "0.35rem",
                            boxShadow: "0 2px 6px rgba(245, 158, 11, 0.2)"
                          }}
                        >
                          <Sparkles size={14} color="#d97706" />
                          <span>⭐ Reactivo Bonus Fijo (Pregunta 6)</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {isBonus && (
                    <div
                      style={{
                        padding: "0.55rem 0.9rem",
                        borderRadius: "0.6rem",
                        background: "#fffbeb",
                        border: "1px solid #fde68a",
                        color: "#92400e",
                        fontSize: "0.8rem",
                        display: "flex",
                        alignItems: "center",
                        gap: "0.45rem"
                      }}
                    >
                      <Sparkles size={15} color="#d97706" style={{ flexShrink: 0 }} />
                      <span>
                        <strong>Reactivo Bonus Activo:</strong> Esta pregunta sumará hasta 1.000 pt extra acumulable directamente para el ranking de <strong>Premios de la Sección</strong>. En la nota oficial regular se mantendrá el tope máximo normativo de 5.000 pts.
                      </span>
                    </div>
                  )}

                  {/* Sub-reactivos de la pregunta (Apartados / Incisos) */}
                  <div
                    style={{
                      background: "#f8fafc",
                      borderRadius: "0.85rem",
                      border: "1.5px solid #e2e8f0",
                      padding: "1.25rem 1.5rem",
                      display: "flex",
                      flexDirection: "column",
                      gap: "1rem"
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "0.75rem" }}>
                      <div>
                        <span style={{ fontSize: "0.82rem", fontWeight: 800, color: "#334155", textTransform: "uppercase" }}>
                          Apartados / Sub-reactivos de respuesta:
                        </span>
                        <p style={{ margin: "0.2rem 0 0 0", fontSize: "0.74rem", color: "#64748b" }}>
                          Cada apartado puede tener diferente puntaje. La suma total no debe superar 1.000 pt.
                        </p>
                      </div>

                      {/* Botones para añadir campo de texto o lista y distribución equitativa */}
                      <div style={{ display: "flex", alignItems: "center", gap: "0.45rem", flexWrap: "wrap" }}>
                        {pregunta.items && pregunta.items.length > 0 && (
                          <button
                            type="button"
                            onClick={() => handleDistributeSubItemPoints(pregunta.id)}
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "0.35rem",
                              padding: "0.4rem 0.75rem",
                              borderRadius: "0.5rem",
                              background: "#fef3c7",
                              border: "1.5px solid #f59e0b",
                              color: "#b45309",
                              fontSize: "0.76rem",
                              fontWeight: 800,
                              cursor: "pointer"
                            }}
                            title="Reparte automáticamente 1.000 pt en partes iguales entre los apartados"
                          >
                            <span>⚡ Distribuir 1.0 pt</span>
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => handleAddSubItem(pregunta.id, "texto_corto", 1)}
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "0.35rem",
                            padding: "0.4rem 0.75rem",
                            borderRadius: "0.5rem",
                            background: "#ffffff",
                            border: "1.5px solid #38bdf8",
                            color: "#0284c7",
                            fontSize: "0.76rem",
                            fontWeight: 800,
                            cursor: "pointer"
                          }}
                        >
                          <Type size={13} />
                          <span>+ Campo Texto</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleAddSubItem(pregunta.id, "listado", 3)}
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "0.35rem",
                            padding: "0.4rem 0.75rem",
                            borderRadius: "0.5rem",
                            background: "#ffffff",
                            border: "1.5px solid #a855f7",
                            color: "#7e22ce",
                            fontSize: "0.76rem",
                            fontWeight: 800,
                            cursor: "pointer"
                          }}
                        >
                          <ListOrdered size={13} />
                          <span>+ Listado (N casillas)</span>
                        </button>
                      </div>
                    </div>

                    {pregunta.items && pregunta.items.length > 0 && Number(pregunta.puntos) > 1.001 && (
                      <div
                        style={{
                          padding: "0.55rem 0.85rem",
                          borderRadius: "0.55rem",
                          background: "#fef2f2",
                          border: "1px solid #fca5a5",
                          color: "#b91c1c",
                          fontSize: "0.78rem",
                          fontWeight: 700
                        }}
                      >
                        ⚠️ La suma de los apartados ({pregunta.puntos} pts) supera el máximo de 1.000 pt permitido para la pregunta. Ajusta los valores individuales o presiona "⚡ Distribuir 1.0 pt".
                      </div>
                    )}

                    {(!pregunta.items || pregunta.items.length === 0) ? (
                      <div style={{ textAlign: "center", padding: "1.5rem", color: "#94a3b8", fontSize: "0.84rem" }}>
                        Sin apartados secundarios. La pregunta se responderá en un único bloque de 1.000 pt (o el valor asignado arriba).
                      </div>
                    ) : (
                      pregunta.items.map((item, itemIdx) => (
                        <div
                          key={item.id || itemIdx}
                          style={{
                            background: "#ffffff",
                            borderRadius: "0.75rem",
                            border: "1.5px solid #cbd5e1",
                            padding: "1rem 1.15rem",
                            display: "flex",
                            flexDirection: "column",
                            gap: "0.75rem"
                          }}
                        >
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "0.5rem" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
                              <span
                                style={{
                                  fontSize: "0.72rem",
                                  fontWeight: 800,
                                  padding: "0.15rem 0.55rem",
                                  borderRadius: "9999px",
                                  background: item.tipo === "texto_corto" ? "#e0f2fe" : "#f3e8ff",
                                  color: item.tipo === "texto_corto" ? "#0369a1" : "#7e22ce"
                                }}
                              >
                                Apartado {itemIdx + 1}: {item.tipo === "texto_corto" ? "Texto Corto" : `Listado (${item.cantidad} casillas)`}
                              </span>

                              {/* Input de puntos por apartado */}
                              <div style={{ display: "inline-flex", alignItems: "center", gap: "0.35rem", flexWrap: "wrap" }}>
                                <span style={{ fontSize: "0.73rem", fontWeight: 700, color: "#475569" }}>Valor total:</span>
                                <input
                                  type="number"
                                  step="0.05"
                                  min="0.01"
                                  max="1"
                                  value={item.puntos !== undefined ? item.puntos : 0.5}
                                  onChange={(e) => handleUpdateSubItem(pregunta.id, item.id, "puntos", parseFloat(e.target.value) || 0)}
                                  style={{
                                    width: "62px",
                                    padding: "0.2rem 0.35rem",
                                    borderRadius: "0.4rem",
                                    border: "1.5px solid #0284c7",
                                    background: "#f0f9ff",
                                    fontSize: "0.8rem",
                                    fontWeight: 800,
                                    color: "#0369a1",
                                    textAlign: "center"
                                  }}
                                />
                                <span style={{ fontSize: "0.73rem", fontWeight: 800, color: "#0369a1" }}>pt(s)</span>

                                {item.tipo !== "texto_corto" && (
                                  <span
                                    style={{
                                      fontSize: "0.72rem",
                                      fontWeight: 800,
                                      color: "#6b21a8",
                                      background: "#f3e8ff",
                                      border: "1px solid #e9d5ff",
                                      padding: "0.15rem 0.45rem",
                                      borderRadius: "0.35rem"
                                    }}
                                    title="El valor total se divide equitativamente entre las casillas para calificar individualmente"
                                  >
                                    ⚡ {((parseFloat(item.puntos) || 0) / (parseInt(item.cantidad, 10) || 1)).toFixed(3)} pt c/ casilla
                                  </span>
                                )}
                              </div>
                            </div>

                            <button
                              type="button"
                              onClick={() => handleRemoveSubItem(pregunta.id, item.id)}
                              style={{
                                background: "none",
                                border: "none",
                                color: "#ef4444",
                                cursor: "pointer",
                                fontSize: "0.75rem",
                                fontWeight: 700,
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "0.25rem"
                              }}
                            >
                              <Trash2 size={13} />
                              <span>Quitar Apartado</span>
                            </button>
                          </div>

                          {/* Instrucción del sub-ítem */}
                          <div>
                            <label style={{ display: "block", fontSize: "0.76rem", fontWeight: 700, color: "#475569", marginBottom: "0.25rem" }}>
                              Instrucción o pregunta para este campo:
                            </label>
                            <input
                              type="text"
                              value={item.instruccion}
                              onChange={(e) => handleUpdateSubItem(pregunta.id, item.id, "instruccion", e.target.value)}
                              placeholder={
                                item.tipo === "texto_corto"
                                  ? "Ej: Identifique la estructura u órgano enfocado"
                                  : "Ej: Diga 3 características morfológicas observadas"
                              }
                              style={{
                                width: "100%",
                                padding: "0.5rem 0.75rem",
                                borderRadius: "0.5rem",
                                border: "1px solid #cbd5e1",
                                fontSize: "0.85rem",
                                outline: "none"
                              }}
                            />
                          </div>

                          {/* Si es Texto Corto: Respuesta modelo opcional */}
                          {item.tipo === "texto_corto" ? (
                            <div>
                              <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 700, color: "#065f46", marginBottom: "0.25rem" }}>
                                💡 Respuesta Modelo (Guía para calificar):
                              </label>
                              <input
                                type="text"
                                value={item.respuesta_modelo || ""}
                                onChange={(e) => handleUpdateSubItem(pregunta.id, item.id, "respuesta_modelo", e.target.value)}
                                placeholder="Ej: Epitelio seudoestratificado cilíndrico ciliado"
                                style={{
                                  width: "100%",
                                  padding: "0.5rem 0.75rem",
                                  borderRadius: "0.5rem",
                                  border: "1px solid #86efac",
                                  background: "#f0fdf4",
                                  fontSize: "0.84rem",
                                  outline: "none"
                                }}
                              />
                            </div>
                          ) : (
                            /* Si es Listado: Cantidad de casillas y respuestas esperadas */
                            <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
                              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
                                <label style={{ fontSize: "0.75rem", fontWeight: 700, color: "#581c87" }}>
                                  Cantidad de casillas para el alumno:
                                </label>
                                <input
                                  type="number"
                                  min="1"
                                  max="10"
                                  value={item.cantidad || 3}
                                  onChange={(e) => handleUpdateSubItem(pregunta.id, item.id, "cantidad", e.target.value)}
                                  style={{
                                    width: "55px",
                                    padding: "0.2rem 0.35rem",
                                    borderRadius: "0.4rem",
                                    border: "1.5px solid #a855f7",
                                    fontSize: "0.8rem",
                                    fontWeight: 800,
                                    textAlign: "center",
                                    color: "#6b21a8"
                                  }}
                                />
                                <span style={{ fontSize: "0.72rem", color: "#6b21a8", fontWeight: 700 }}>
                                  (Al calificar, cada casilla vale {((parseFloat(item.puntos) || 0) / (parseInt(item.cantidad, 10) || 3)).toFixed(3)} pt: cada acierto suma y cada fallo resta dicho valor)
                                </span>
                              </div>

                              <div>
                                <label style={{ display: "block", fontSize: "0.74rem", fontWeight: 700, color: "#065f46", marginBottom: "0.3rem" }}>
                                  💡 Respuestas Modelo (Guía opcional para cada casilla):
                                </label>
                                <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem" }}>
                                  {Array.from({ length: item.cantidad || 3 }).map((_, slotIdx) => (
                                    <div key={slotIdx} style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                                      <span style={{ fontSize: "0.75rem", fontWeight: 800, color: "#059669", width: "20px" }}>
                                        {slotIdx + 1}.
                                      </span>
                                      <input
                                        type="text"
                                        value={(item.respuestas_esperadas || [])[slotIdx] || ""}
                                        onChange={(e) => handleUpdateExpectedAnswer(pregunta.id, item.id, slotIdx, e.target.value)}
                                        placeholder={`Respuesta esperada para casilla #${slotIdx + 1}...`}
                                        style={{
                                          flex: 1,
                                          padding: "0.4rem 0.65rem",
                                          borderRadius: "0.45rem",
                                          border: "1px solid #86efac",
                                          background: "#f0fdf4",
                                          fontSize: "0.82rem",
                                          outline: "none"
                                        }}
                                      />
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          {/* Barra inferior de guardado */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: "0.75rem", paddingTop: "1rem", marginTop: "0.5rem", flexWrap: "wrap" }}>
            <button
              type="button"
              onClick={() => setShowResetModal(true)}
              disabled={saving || resetting}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "0.45rem",
                padding: "0.75rem 1.25rem",
                borderRadius: "0.65rem",
                border: "1.5px solid #fecaca",
                background: "#fef2f2",
                color: "#b91c1c",
                fontSize: "0.88rem",
                fontWeight: 800,
                cursor: saving || resetting ? "not-allowed" : "pointer",
                transition: "all 0.15s ease"
              }}
              title="Borrar todas las preguntas guardadas y comenzar desde cero"
            >
              <RotateCcw size={16} />
              <span>Reiniciar Toda la Prueba</span>
            </button>

            <button
              type="button"
              onClick={handleSaveQuiz}
              disabled={saving}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "0.5rem",
                padding: "0.75rem 1.75rem",
                borderRadius: "0.65rem",
                border: "none",
                background: hasUnsavedChanges
                  ? "linear-gradient(135deg, #16a34a 0%, #15803d 100%)"
                  : "linear-gradient(135deg, #0284c7 0%, #0369a1 100%)",
                color: "#ffffff",
                fontSize: "0.92rem",
                fontWeight: 800,
                cursor: saving ? "not-allowed" : "pointer",
                boxShadow: "0 4px 14px rgba(2, 132, 199, 0.25)"
              }}
            >
              {saving ? <RefreshCw size={16} className="animate-spin" /> : <Save size={16} />}
              <span>{saving ? "Guardando..." : "Guardar Prueba Semanal"}</span>
            </button>
          </div>
        </div>
      )}

      {/* MODAL DE CONFIRMACIÓN PARA REINICIAR LA PRUEBA Y BORRAR TODAS LAS PREGUNTAS */}
      {showResetModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 999999,
            background: "rgba(15, 23, 42, 0.82)",
            backdropFilter: "blur(8px)",
            WebkitBackdropFilter: "blur(8px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "1.25rem"
          }}
        >
          <div
            className="animate-scale-in"
            style={{
              background: "#ffffff",
              borderRadius: "1.25rem",
              border: "2px solid #fee2e2",
              maxWidth: "480px",
              width: "100%",
              padding: "2rem",
              boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.4)",
              textAlign: "center",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "1.1rem"
            }}
          >
            <div
              style={{
                width: "60px",
                height: "60px",
                borderRadius: "50%",
                background: "#fee2e2",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#dc2626"
              }}
            >
              <RotateCcw size={30} />
            </div>

            <div>
              <span
                style={{
                  fontSize: "0.78rem",
                  fontWeight: 900,
                  textTransform: "uppercase",
                  letterSpacing: "1px",
                  color: "#dc2626"
                }}
              >
                Acción Irreversible
              </span>
              <h3 style={{ margin: "0.3rem 0 0", fontSize: "1.35rem", fontWeight: 900, color: "#0f172a" }}>
                ¿Reiniciar toda la prueba?
              </h3>
              <p style={{ margin: "0.35rem 0 0", fontSize: "0.88rem", color: "#64748b", fontWeight: 600 }}>
                Semana {selectedSemana} • Sección {seccion?.codigo || ""}
              </p>
            </div>

            <p style={{ margin: 0, fontSize: "0.9rem", color: "#475569", lineHeight: 1.55 }}>
              Esta acción eliminará todos los apartados, respuestas modelo y configuraciones guardadas de esta semana. La prueba quedará vacía (6 preguntas en blanco) para que puedas elaborarla de nuevo desde cero.
            </p>

            <div
              style={{
                display: "flex",
                gap: "0.75rem",
                width: "100%",
                marginTop: "0.5rem"
              }}
            >
              <button
                type="button"
                onClick={() => setShowResetModal(false)}
                disabled={resetting}
                style={{
                  flex: 1,
                  padding: "0.75rem",
                  borderRadius: "0.7rem",
                  border: "1.5px solid #cbd5e1",
                  background: "#ffffff",
                  color: "#475569",
                  fontSize: "0.9rem",
                  fontWeight: 700,
                  cursor: resetting ? "not-allowed" : "pointer"
                }}
              >
                Cancelar
              </button>

              <button
                type="button"
                onClick={handleResetQuiz}
                disabled={resetting}
                style={{
                  flex: 1.3,
                  padding: "0.75rem",
                  borderRadius: "0.7rem",
                  border: "none",
                  background: "linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)",
                  color: "#ffffff",
                  fontSize: "0.9rem",
                  fontWeight: 900,
                  cursor: resetting ? "not-allowed" : "pointer",
                  boxShadow: "0 4px 14px rgba(220, 38, 38, 0.35)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "0.45rem"
                }}
              >
                {resetting ? <RefreshCw size={17} className="animate-spin" /> : <RotateCcw size={17} />}
                <span>{resetting ? "Reiniciando..." : "Sí, Reiniciar Todo"}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}