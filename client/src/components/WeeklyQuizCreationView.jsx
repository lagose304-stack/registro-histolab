import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import { ArrowLeft, Save, Plus, Trash2, CheckCircle2, Eye, FileText, Clock, Award, ListOrdered, Type, ChevronRight, Search, BookOpen, RotateCcw, Radio, User, SlidersHorizontal } from "lucide-react";
import { api } from "../services/api";
import {
  hasFullSectionAccess,
  isWeekAssignedToUser,
  getAssignedRecordForWeek,
  SECTION_ROLES
} from "../utils/sectionRoleUtils";

import { displaySectionCode } from "../../../shared/sectionCode.mjs";
import { QUIZ_ITEM_TYPES, createQuizItem, syncQuizItemAnswerKey, quizPublicationIssues } from "../../../shared/quizItems.mjs";
import QuizItemResponse from "./QuizItemResponse";
import QuizItemEditor from "./QuizItemEditor";
import "./WeeklyQuizCreationView.css";

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
  const [loadError, setLoadError] = useState("");
  const [saveError, setSaveError] = useState("");
  const [saveErrorLocation, setSaveErrorLocation] = useState("content");
  const [pendingPublication, setPendingPublication] = useState(null);
  const [quizLoading, setQuizLoading] = useState(false);
  const [catalogSearch, setCatalogSearch] = useState("");
  const [catalogStatus, setCatalogStatus] = useState("all");
  const resetDialogRef = useRef(null);
  const [resetting, setResetting] = useState(false);
  const [showResetModal, setShowResetModal] = useState(false);
  const [resetError, setResetError] = useState("");
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [activeQuestion, setActiveQuestion] = useState(0);
  const [previewAnswers, setPreviewAnswers] = useState({});
  const [viewMode, setViewMode] = useState("builder"); // 'builder' | 'preview'

  const notifyRef = useRef(notify);
  notifyRef.current = notify;

  // Bloquear el scroll de fondo mientras el modal de reinicio esté abierto (Modal Global)
  useEffect(() => {
    if (showResetModal) {
      resetDialogRef.current?.showModal();
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = originalOverflow;
      };
    }
  }, [showResetModal]);

  // Datos académicos de la sección
  const [semanasConfig, setSemanasConfig] = useState([]);
  const [temario, setTemario] = useState([]);
  const [sectionQuizzes, setSectionQuizzes] = useState([]);
  const [asignaciones, setAsignaciones] = useState([]);

  const currentUser = currentInstructor || api.auth.getCurrentInstructor();
  const hasFullAccess = useMemo(() => hasFullSectionAccess(currentUser, seccion), [currentUser, seccion]);

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
    setLoadError("");

    try {
      const [resSemanas, resTemario, resQuizzes, resAsig] = await Promise.all([
        api.semanas.getConfig(carrera),
        api.temario.getAll({ carrera }),
        api.pruebas.getBySeccion(seccion.id),
        api.asignaciones.getBySeccion(seccion.id)
      ]);

      if (resSemanas?.data) setSemanasConfig(resSemanas.data);
      if (resTemario?.data) setTemario(resTemario.data);
      if (resQuizzes?.data && Array.isArray(resQuizzes.data)) {
        setSectionQuizzes(resQuizzes.data);
      }
      if (resAsig?.data && Array.isArray(resAsig.data)) {
        setAsignaciones(resAsig.data);
      } else if (Array.isArray(resAsig)) {
        setAsignaciones(resAsig);
      }
    } catch (err) {
      console.error("Error al cargar datos en Crear prueba semanal:", err);
      setLoadError("No pudimos cargar las semanas y pruebas de la sección.");
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

  // Semanas filtradas por rol del docente (el titular ve todas; los asignados solo las suyas)
  const visibleWeeks = useMemo(() => {
    if (hasFullAccess) return availableWeeks;
    return availableWeeks.filter((w) =>
      isWeekAssignedToUser(asignaciones, SECTION_ROLES.CREAR_PRUEBA, w.numero_semana, currentUser, seccion)
    );
  }, [availableWeeks, hasFullAccess, asignaciones, currentUser, seccion]);

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
    setQuizLoading(true);
    setActiveQuestion(0);
    setPreviewAnswers({});
    setSaveError("");

    const fetchQuiz = async () => {
      try {
        if (seccion?.id) {
          const res = await api.pruebas.getBySemana(seccion.id, selectedSemana);
          if (res?.success && res.data && isMounted) {
            const serverQuiz = res.data;
            const normalizedPreguntas = normalizeSixQuestions(serverQuiz.preguntas);
            const defaultWeekTitle = getWeekDisplayName(availableWeeks.find((w) => w.numero_semana === selectedSemana)) || `Prueba Semanal — Semana ${selectedSemana}`;
            setQuizData({
              id: serverQuiz.id || null,
              titulo: defaultWeekTitle,
              puntajeTotal: serverQuiz.puntaje_total !== undefined ? Number(serverQuiz.puntaje_total) : 5.0,
              duracionMinutos: serverQuiz.duracion_minutos || 15,
              tiempoPorPreguntaSegundos: Number(serverQuiz.tiempo_por_pregunta_segundos) || 90,
              estado: serverQuiz.publicada ? "publicada" : (serverQuiz.estado || "borrador"),
              instrucciones: "",
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
        const defaultWeekTitle = getWeekDisplayName(availableWeeks.find((w) => w.numero_semana === selectedSemana)) || `Prueba Semanal — Semana ${selectedSemana}`;
        setQuizData({
          id: null,
          titulo: defaultWeekTitle,
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

    fetchQuiz().finally(() => { if (isMounted) setQuizLoading(false); });

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

  // Cada opción de visibilidad guarda el contenido y confirma el estado en el servidor.
  const handleSetPublication = async nextState => {
    if (saving || resetting || quizLoading || (quizData.estado === nextState && !hasUnsavedChanges && quizData.id)) return;
    setPendingPublication(nextState);
    try { await handleSaveQuiz(nextState, "publication"); }
    finally { setPendingPublication(null); }
  };

  // Agregar sub-ítem (apartado) a una pregunta con puntaje proporcional
  const handleAddSubItem = (qId, tipo = "texto_corto") => {
    setQuizData((prev) => ({
      ...prev,
      preguntas: prev.preguntas.map((q) => {
        if (q.id !== qId) return q;
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

        const newItem = { ...createQuizItem(tipo, "item_" + Date.now() + "_" + Math.random().toString(36).slice(2,8)), puntos: defaultPts };

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

  const handleReplaceSubItem = (questionId, itemId, replacement) => {
    setQuizData(previous => ({ ...previous, preguntas: previous.preguntas.map(question => {
      if (question.id !== questionId) return question;
      const items = (question.items || []).map(item => item.id === itemId ? syncQuizItemAnswerKey(replacement) : item);
      return { ...question, items, puntos: Number(items.reduce((sum,item) => sum + (Number(item.puntos)||0),0).toFixed(3)) };
    }) }));
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
  const handleSaveQuiz = async (nextState = quizData.estado, errorLocation = "content") => {
    if (!seccion?.id || selectedSemana === null || saving || resetting || quizLoading) return;

    setSaveErrorLocation(errorLocation);
    setSaveError("");
    if (nextState === "publicada") {
      const issues = quizPublicationIssues(quizData.preguntas);
      if (issues.length) { setSaveError(`Antes de publicar: ${issues.slice(0,3).join(" ")}${issues.length > 3 ? ` Hay ${issues.length - 3} detalles adicionales por completar.` : ""}`); return; }
    }
    // Validación estricta: ninguna pregunta puede valer más de 1.00 pt
    for (let i = 0; i < quizData.preguntas.length; i++) {
      const q = quizData.preguntas[i];
      const qVal = parseFloat(q.puntos) || 0;
      if (qVal > 1.001) {
        setSaveError(`La pregunta ${i + 1} supera 1 punto. Ajusta sus puntos antes de guardar.`);
        return;
      }
      if (q.items && q.items.length > 0) {
        const sumItems = q.items.reduce((acc, it) => acc + (parseFloat(it.puntos) || 0), 0);
        if (sumItems > 1.001) {
          setSaveError(`La suma de los apartados de la pregunta ${i + 1} supera 1 punto.`);
          return;
        }
      }
    }

    setSaving(true);
    setSaveError("");

    try {
      const isPublicada = nextState === "publicada";
      const totalPoints = quizData.preguntas.reduce((acc, q) => acc + (parseFloat(q.puntos) || 0), 0);
      const cleanTotalPoints = parseFloat(totalPoints.toFixed(3));
      const cleanOfficialPoints = Math.min(5.0, cleanTotalPoints);

      const tiempoPorPregunta = quizData.tiempoPorPreguntaSegundos || 90;
      const estimatedMins = Math.ceil((quizData.preguntas.length * tiempoPorPregunta) / 60);

      const defaultWeekTitle = getWeekDisplayName(currentWeekInfo) || `Prueba Semanal — Semana ${selectedSemana}`;

      const payload = {
        ...quizData,
        titulo: defaultWeekTitle,
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
          items: (q.items || []).map(syncQuizItemAnswerKey),
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
        estado: isPublicada ? "publicada" : "borrador",
        puntajeTotal: cleanOfficialPoints
      }));

      const key = getStorageKey(selectedSemana);
      try { localStorage.setItem(key, JSON.stringify(savedQuiz)); } catch { /* El guardado en servidor ya fue confirmado. */ }

      // Actualizar INMEDIATAMENTE la lista de pruebas de la sección en el estado
      // para que el catálogo cambie al instante de '⚪ Sin crear' a '🟢 Publicada' o '🟡 Borrador'
      setSectionQuizzes((prev) => {
        const others = (prev || []).filter((q) => Number(q.numero_semana) !== Number(selectedSemana));
        return [...others, savedQuiz];
      });

      setHasUnsavedChanges(false);
      notifyRef.current(
        `¡Prueba de la Semana ${selectedSemana} guardada con éxito!`,
        "success"
      );
      // Sincronizar en background
      await refreshSectionQuizzes();
    } catch (err) {
      console.error("Error al guardar prueba:", err);
      setSaveError(err.message || "No pudimos guardar la prueba. Tus cambios se conservan para reintentar.");
    } finally {
      setSaving(false);
    }
  };

  // Reiniciar la prueba completa y borrar todas las preguntas guardadas
  const handleResetQuiz = async () => {
    if (!seccion?.id || selectedSemana === null || saving || resetting || quizLoading) return;
    setResetting(true);
    setResetError("");

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
        tiempoPorPreguntaSegundos: 90,
        puntajeTotal: 5.0,
        estado: "borrador",
        preguntas: cleanDefaults
      });

      setActiveQuestion(0);
      setViewMode("builder");
      setPreviewAnswers({});
      setSaveError("");
      const key = getStorageKey(selectedSemana);
      try { localStorage.setItem(key, JSON.stringify(savedQuiz)); } catch { /* El guardado en servidor ya fue confirmado. */ }

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
      setResetError(err.message || "No pudimos reiniciar la prueba. Su contenido se conserva; puedes reintentar.");
    } finally {
      setResetting(false);
    }
  };

  const quizStatus = quiz => !quiz ? "new" : quiz.publicada || quiz.estado === "publicada" ? "published" : "draft";
  const statusLabels = { new: "Sin crear", published: "Publicada", draft: "Borrador" };
  const catalogCounts = visibleWeeks.reduce((counts, week) => {
    counts[quizStatus(quizzesBySemanaMap.get(week.numero_semana))]++;
    return counts;
  }, { new: 0, published: 0, draft: 0 });
  const filteredWeeks = visibleWeeks.filter(week => {
    const status = quizStatus(quizzesBySemanaMap.get(week.numero_semana));
    const text = `${getWeekDisplayName(week)} ${week.parcial}`.toLocaleLowerCase();
    return (catalogStatus === "all" || status === catalogStatus) && text.includes(catalogSearch.trim().toLocaleLowerCase());
  });
  const totalPoints = quizData.preguntas.reduce((sum, question) => sum + (Number(question.puntos) || 0), 0);
  const basePoints = quizData.preguntas.slice(0, 5).reduce((sum, question) => sum + (Number(question.puntos) || 0), 0);
  const publicationIssues = quizPublicationIssues(quizData.preguntas);
  const completeQuestions = quizData.preguntas.filter(question => !quizPublicationIssues([question]).length).length;
  const busy = saving || resetting || quizLoading;

  const renderHeader = title => (
    <header className="user-directory__hero"><div>
      <p className="user-directory__eyebrow"><BookOpen size={18} aria-hidden="true" /> Sección {displaySectionCode(seccion?.codigo)} · {carrera}</p>
      <h2 id="section-quizzes-title">{title}</h2>
      <p>{selectedSemana === null ? "Prepara y administra las pruebas de cada semana." : getWeekDisplayName(currentWeekInfo)}</p>
    </div></header>
  );

  if (loading || loadError) return (
    <section className="user-directory section-quizzes" aria-labelledby="section-quizzes-title">
      {renderHeader("Pruebas semanales de la sección")}
      {loadError ? <div className="user-directory__state" role="alert"><p>{loadError}</p><button type="button" className="user-button" onClick={loadInitialData}>Reintentar</button></div>
        : <div className="section-quizzes__skeleton" role="status" aria-label="Cargando pruebas semanales"><span /><span /><span /></div>}
    </section>
  );

  if (selectedSemana === null) return (
    <section className="user-directory section-quizzes" aria-labelledby="section-quizzes-title">
      {!hideBackButton && <button type="button" className="user-button user-button--back" onClick={onClose}><ArrowLeft size={17} aria-hidden="true" /> Volver a módulos</button>}
      {renderHeader("Pruebas semanales de la sección")}
      <dl className="section-quizzes__stats">
        {[["Semanas disponibles", visibleWeeks.length], ["Publicadas", catalogCounts.published], ["Borradores", catalogCounts.draft], ["Sin crear", catalogCounts.new]].map(([label,value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}
      </dl>
      <div className="section-quizzes__filters">
        <label className="user-directory__search"><Search size={17} aria-hidden="true" /><input type="search" aria-label="Buscar semana o tema" placeholder="Buscar semana o tema" value={catalogSearch} onChange={event => setCatalogSearch(event.target.value)} /></label>
        <label className="user-field">Estado de la prueba<select value={catalogStatus} onChange={event => setCatalogStatus(event.target.value)}><option value="all">Todos los estados</option><option value="new">Sin crear</option><option value="draft">Borrador</option><option value="published">Publicada</option></select></label>
      </div>
      {!visibleWeeks.length ? <div className="user-directory__state"><h3>No tienes semanas asignadas para crear pruebas</h3><p>El titular de sección puede asignarte esta tarea desde Proporcionar asignaciones.</p></div>
      : !filteredWeeks.length ? <p className="user-directory__state">Ninguna semana coincide con los filtros.</p> : (
        <div className="section-quizzes__catalog">
          {filteredWeeks.map(week => {
            const quiz = quizzesBySemanaMap.get(week.numero_semana);
            const status = quizStatus(quiz);
            const assigned = getAssignedRecordForWeek(asignaciones, SECTION_ROLES.CREAR_PRUEBA, week.numero_semana);
            return <article className="section-quizzes__week" data-status={status} key={week.numero_semana}>
              <div className="section-quizzes__row"><span className="section-quizzes__partial">{week.parcial}</span><span className="section-quizzes__badge" data-status={status}>{statusLabels[status]}</span></div>
              <h3>{getWeekDisplayName(week)}</h3>
              <p><User size={16} aria-hidden="true" /> {assigned?.instructor_nombre || "Sin responsable asignado"}</p>
              <div className="section-quizzes__week-footer"><small>{quiz ? `${quiz.preguntas?.length || 0} preguntas guardadas` : "Lista para preparar"}</small><button type="button" className="user-button" onClick={() => setSelectedSemana(week.numero_semana)}>{quiz ? "Editar prueba" : "Crear prueba"}<ChevronRight size={16} aria-hidden="true" /></button></div>
            </article>;
          })}
        </div>
      )}
    </section>
  );

  return (
    <section className="user-directory section-quizzes" aria-labelledby="section-quizzes-title">
      <button type="button" className="user-button user-button--back" disabled={busy} onClick={handleBackToCatalog}><ArrowLeft size={17} aria-hidden="true" /> Volver a pruebas semanales</button>
      {renderHeader("Preparar prueba semanal")}
      {quizLoading ? <div className="section-quizzes__skeleton" role="status" aria-label="Cargando prueba"><span /><span /></div> : <>
        <div className="section-quizzes__editor-tools">
          <div className="section-quizzes__modes" role="group" aria-label="Modo de trabajo">
            <button type="button" aria-pressed={viewMode === "builder"} onClick={() => setViewMode("builder")}><FileText size={17} aria-hidden="true" /> Editar preguntas</button>
            <button type="button" aria-pressed={viewMode === "preview"} onClick={() => setViewMode("preview")}><Eye size={17} aria-hidden="true" /> Vista del estudiante</button>
          </div>
          {onOpenLiveControl && <button type="button" className="user-button" disabled={busy} onClick={() => onOpenLiveControl(selectedSemana)}><Radio size={17} aria-hidden="true" /> Control en vivo</button>}
        </div>
        <fieldset disabled={busy} className="section-quizzes__fieldset">
          <div className="section-quizzes__settings">
            <label className="user-field">Tiempo por pregunta
              <select value={quizData.tiempoPorPreguntaSegundos || 90} onChange={event => {
                const seconds = Number(event.target.value);
                setQuizData(previous => ({ ...previous, tiempoPorPreguntaSegundos: seconds, duracionMinutos: Math.ceil(6 * seconds / 60) }));
                setHasUnsavedChanges(true);
              }}>{[[60,"1 minuto"],[90,"1 minuto 30 segundos"],[120,"2 minutos"],[150,"2 minutos 30 segundos"],[180,"3 minutos"]].map(([value,label]) => <option key={value} value={value}>{label}</option>)}</select>
              <small>Duración estimada: {Math.ceil(6 * (quizData.tiempoPorPreguntaSegundos || 90) / 60)} minutos.</small>
            </label>
            <section className="section-quizzes__publication" aria-labelledby="quiz-publication-title">
              <div><h3 id="quiz-publication-title">Publicación de la prueba</h3><p>Elige si los estudiantes pueden verla.</p></div>
              <div className="section-quizzes__visibility" role="group" aria-label="Visibilidad de la prueba">
                <button type="button" aria-label="Mantener en borrador" aria-pressed={quizData.estado !== "publicada"} onClick={() => handleSetPublication("borrador")}>
                  <Clock size={20} aria-hidden="true" /><strong>Borrador</strong><small>{saving && pendingPublication === "borrador" ? "Guardando borrador…" : "Oculta para estudiantes"}</small>
                </button>
                <button type="button" aria-label="Publicar para estudiantes" aria-pressed={quizData.estado === "publicada"} onClick={() => handleSetPublication("publicada")}>
                  <CheckCircle2 size={20} aria-hidden="true" /><strong>Publicada</strong><small>{saving && pendingPublication === "publicada" ? "Publicando…" : "Visible para estudiantes"}</small>
                </button>
              </div>
              <p className="section-quizzes__publication-guide">Al pulsar una opción se guardan el estado y los cambios actuales de la prueba.</p>
              {saveError && saveErrorLocation === "publication" && <p className="user-dialog__error" role="alert">{saveError}</p>}
              <span className="section-quizzes__saved-visibility" role="status">{quizStatus(quizzesBySemanaMap.get(selectedSemana)) === "new" ? "Todavía no se ha guardado esta prueba." : quizStatus(quizzesBySemanaMap.get(selectedSemana)) === "published" ? "Estado guardado: Publicada" : "Estado guardado: Borrador"}</span>
            </section>
            <div className="section-quizzes__scores"><span>Nota oficial <b>{Math.min(5,basePoints).toFixed(3)} / 5.000</b></span><span>Con bonus <b>{totalPoints.toFixed(3)} puntos</b></span></div>
          </div>
        </fieldset>
        {viewMode === "preview" ? (
          <section className="section-quizzes__preview" aria-label="Vista previa del estudiante">
            <p className="section-quizzes__hint">Prueba los controles como estudiante. Estas respuestas son de demostración y no se guardan como entregas.</p>
            {quizData.preguntas.map((question,index) => <article className="section-quizzes__question" data-bonus={index === 5} key={question.id}>
              <header><h3>{index === 5 ? "Pregunta 6 · Bonus" : `Pregunta ${index + 1}`}</h3><span>{Number(question.puntos).toFixed(3)} puntos</span></header>
              <div className="section-quizzes__question-body">{question.enunciado && <p>{question.enunciado}</p>}
                {!question.items?.length && <p className="section-quizzes__hint">Sin apartados de respuesta configurados.</p>}
                {(question.items || []).map((item,itemIndex) => <div className="section-quizzes__preview-item" key={item.id || itemIndex}><strong>{item.instruccion || item.etiqueta || `Apartado ${itemIndex + 1}`}</strong>
                  <QuizItemResponse item={item} value={previewAnswers[item.id]} onChange={value => setPreviewAnswers(previous => ({...previous,[item.id]:value}))} />
                </div>)}
              </div>
            </article>)}
          </section>
        ) : <div className="quiz-builder">
          <nav className="quiz-builder__nav" aria-label="Preguntas de la prueba">
            <div><h3>Preguntas</h3><p>{completeQuestions} de 6 completas</p><progress max="6" value={completeQuestions} aria-label="Preguntas completas" /></div>
            <div className="quiz-builder__steps">{quizData.preguntas.map((question,index) => {
              const complete = !quizPublicationIssues([question]).length;
              return <button type="button" key={question.id} disabled={busy} aria-current={activeQuestion === index ? "step" : undefined} aria-label={`${index === 5 ? "Bonus" : `Pregunta ${index + 1}`} · ${complete ? "Completa" : "Por completar"}`} data-complete={complete} data-bonus={index === 5} onClick={() => setActiveQuestion(index)}>
                <b>{index + 1}</b><span>{index === 5 ? "Bonus" : `Pregunta ${index + 1}`}<small>{complete ? "Completa" : question.items?.length ? "Por completar" : "Sin preparar"}</small></span>{complete && <CheckCircle2 size={16} aria-hidden="true" />}
              </button>;
            })}</div>
          </nav>
          <fieldset data-grade-grid className="section-quizzes__fieldset quiz-builder__workspace" disabled={busy}>
            {quizData.preguntas.filter((_,index)=>index===activeQuestion).map(question => <div key={question.id} className="quiz-builder__question">
              <header><div><p className="user-directory__eyebrow">Paso {activeQuestion + 1} de 6</p><h3>{activeQuestion === 5 ? "Pregunta 6 · Bonus" : `Pregunta ${activeQuestion + 1}`}</h3></div><span className="section-quizzes__badge">{Number(question.puntos).toFixed(3)} / 1.000 punto</span></header>
              {activeQuestion === 5 && <p className="section-quizzes__bonus-note">Esta pregunta aporta hasta 1 punto extra a Premios de la sección.</p>}
              <div className="quiz-builder__items-heading"><div><h4>Configura tus apartados</h4><p>Cada apartado tiene su instrucción, formato y puntos.</p></div>{question.items?.length > 0 && <button type="button" className="user-button" onClick={()=>handleDistributeSubItemPoints(question.id)}><SlidersHorizontal size={16} aria-hidden="true" /> Repartir 1 punto</button>}</div>
              {Number(question.puntos)>1.001 && <p className="user-dialog__error" role="alert">La suma supera 1 punto. Ajusta los valores o usa Repartir 1 punto.</p>}
              {(question.items || []).map((item,index) => <QuizItemEditor key={item.id} item={item} index={index} onChange={replacement=>handleReplaceSubItem(question.id,item.id,replacement)} onRemove={()=>handleRemoveSubItem(question.id,item.id)} />)}
              <section className="quiz-builder__type-picker" aria-label="Añadir apartado">
                <h4>{question.items?.length ? "Añadir otro apartado" : "Elige cómo responderá el estudiante"}</h4>
                <p>Puedes combinar distintos tipos dentro de una pregunta.</p>
                <div>{QUIZ_ITEM_TYPES.map(type=><button type="button" key={type.id} onClick={()=>handleAddSubItem(question.id,type.id)}><span><Plus size={17} aria-hidden="true" /><b>{type.label}</b></span><small>{type.description}</small></button>)}</div>
              </section>
              <div className="quiz-builder__next"><button type="button" className="user-button" disabled={activeQuestion===0} onClick={()=>setActiveQuestion(index=>index-1)}><ArrowLeft size={16} aria-hidden="true" /> Anterior</button><button type="button" className="user-button" onClick={()=>activeQuestion===5 ? setViewMode("preview") : setActiveQuestion(index=>index+1)}>{activeQuestion===5 ? "Ver prueba completa" : "Siguiente pregunta"}<ChevronRight size={16} aria-hidden="true" /></button></div>
            </div>)}
          </fieldset>
        </div>}
        {publicationIssues.length > 0 && <div className="quiz-builder__readiness"><strong>{publicationIssues.length} detalles por completar antes de publicar</strong><p>Puedes guardar un borrador y continuar después. Abre cada pregunta para revisar lo que falta.</p></div>}
        <footer className="section-quizzes__save">
          {saveError && saveErrorLocation !== "publication" && <p className="user-dialog__error" role="alert">{saveError}</p>}
          <div><p role="status">{hasUnsavedChanges ? "Cambios sin guardar" : "Sin cambios pendientes"}</p><div>
            <button type="button" className="user-button user-button--danger" disabled={busy} onClick={() => {setResetError("");setShowResetModal(true);}}><RotateCcw size={17} aria-hidden="true" /> Reiniciar prueba</button>
            <button type="button" className="user-button user-button--primary" disabled={busy} onClick={() => handleSaveQuiz()}><Save size={17} aria-hidden="true" />{saving ? "Guardando…" : "Guardar cambios"}</button>
          </div></div>
        </footer>
      </>}
      {showResetModal && createPortal(<dialog className="section-quiz-reset" ref={resetDialogRef} aria-labelledby="quiz-reset-title" onCancel={event => { if (resetting) event.preventDefault(); else setShowResetModal(false); }}>
        <h3 id="quiz-reset-title">¿Reiniciar toda la prueba?</h3><p>Semana {selectedSemana} · Sección {displaySectionCode(seccion?.codigo)}</p>
        <p>Se eliminarán todos los apartados y respuestas modelo guardados. La prueba volverá a borrador con seis preguntas vacías.</p>
        {resetError && <p className="user-dialog__error" role="alert">{resetError}</p>}
        <div><button type="button" className="user-button" autoFocus disabled={resetting} onClick={() => setShowResetModal(false)}>Cancelar</button><button type="button" className="user-button user-button--danger" disabled={resetting} onClick={handleResetQuiz}>{resetting ? "Reiniciando…" : "Sí, reiniciar prueba"}</button></div>
      </dialog>,document.body)}
    </section>
  );
}
