import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import {
  GraduationCap,
  LogOut,
  Award,
  CalendarCheck,
  BookOpen,
  FileEdit,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Clock,
  User,
  ShieldCheck,
  ShieldAlert,
  Building2,
  Sparkles,
  RefreshCw,
  FileSpreadsheet,
  HelpCircle,
  Image as ImageIcon,
  ListOrdered,
  Type,
  ArrowLeft,
  Send,
  Check,
  Eye,
  Lock,
  Maximize2,
  Shield,
  Radio,
  Play,
  PlayCircle
} from "lucide-react";
import { api } from "../services/api";
import { safeStorage } from "../utils/safeStorage";
import {
  formatGrade,
  getWeekDisplayName,
  getManualDisplayName,
  calculateStudentAcademicSummary
} from "../utils/academicEngine";
import laboratorioLogo from "../assets/logos/laboratorio.png";
import facultadLogo from "../assets/logos/facultad.png";
import universidadLogo from "../assets/logos/universidad.png";

const CARRERA_THEMES = {
  Medicina: {
    primary: "#0284c7",
    bg: "#eff6ff",
    border: "#bfdbfe",
    text: "#1d4ed8",
    gradient: "linear-gradient(135deg, #0284c7 0%, #0369a1 100%)"
  },
  Enfermeria: {
    primary: "#16a34a",
    bg: "#f0fdf4",
    border: "#bbf7d0",
    text: "#15803d",
    gradient: "linear-gradient(135deg, #16a34a 0%, #15803d 100%)"
  },
  Odontologia: {
    primary: "#c026d3",
    bg: "#fdf4ff",
    border: "#f5d0fe",
    text: "#a21caf",
    gradient: "linear-gradient(135deg, #c026d3 0%, #a21caf 100%)"
  },
  Microbiologia: {
    primary: "#ea580c",
    bg: "#fff7ed",
    border: "#fed7aa",
    text: "#c2410c",
    gradient: "linear-gradient(135deg, #ea580c 0%, #c2410c 100%)"
  },
  Nutricion: {
    primary: "#0891b2",
    bg: "#ecfeff",
    border: "#a5f3fc",
    text: "#0e7490",
    gradient: "linear-gradient(135deg, #0891b2 0%, #0e7490 100%)"
  }
};

export default function StudentPortalView({ student, notify = () => {} }) {
  const cuentaKey = student?.numero_cuenta || "";

  // Recuperar sesión activa de evaluación persistida si hubo recarga
  const savedActiveQuizSession = useMemo(() => {
    try {
      const cKey = student?.numero_cuenta || "estudiante";
      const raw = safeStorage.getItem(`histolab_active_quiz_session_${cKey}`);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && parsed.quiz) return parsed;
      }
    } catch (_) {}
    return null;
  }, [student?.numero_cuenta]);

  const [activeTab, setActiveTab] = useState(() => (savedActiveQuizSession?.quiz ? "pruebas" : "calificaciones"));
  const [currentStudentData, setCurrentStudentData] = useState(() => {
    if (student && student.notas && Object.keys(student.notas).length > 0) return student;
    try {
      const cached = safeStorage.getItem("histolab_student_user");
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed && (parsed.numero_cuenta === student?.numero_cuenta || !student)) {
          return { ...(parsed || {}), ...(student || {}) };
        }
      }
    } catch (_) {}
    return student;
  });
  const [semanasConfig, setSemanasConfig] = useState([]);
  const [temario, setTemario] = useState([]);
  const [configPuntajes, setConfigPuntajes] = useState(null);
  const [loadingAcademic, setLoadingAcademic] = useState(true);

  // Estados para Pruebas Semanales en Línea y Sincronización en Vivo
  const [onlineQuizzes, setOnlineQuizzes] = useState(() => {
    if (savedActiveQuizSession?.quiz) return [savedActiveQuizSession.quiz];
    return [];
  });
  const [loadingQuizzes, setLoadingQuizzes] = useState(false);
  const [activeQuizToTake, setActiveQuizToTake] = useState(() => savedActiveQuizSession?.quiz || null);
  const [quizAnswers, setQuizAnswers] = useState(() => {
    if (savedActiveQuizSession?.quiz?.numero_semana) {
      try {
        const cKey = student?.numero_cuenta || "estudiante";
        const sem = savedActiveQuizSession.quiz.numero_semana;
        const attemptRaw = safeStorage.getItem(`histolab_active_quiz_${cKey}_sem_${sem}`);
        if (attemptRaw) {
          const attempt = JSON.parse(attemptRaw);
          if (attempt?.quizAnswers) return attempt.quizAnswers;
        }
      } catch (_) {}
    }
    return {};
  });
  const [submittingQuiz, setSubmittingQuiz] = useState(false);
  const [existingSubmissions, setExistingSubmissions] = useState({});
  const [reviewingSubmission, setReviewingSubmission] = useState(null);

  // Estados de Control en Vivo y Sincronización Global
  const [liveSessionsMap, setLiveSessionsMap] = useState(() => {
    if (savedActiveQuizSession?.quiz && savedActiveQuizSession?.liveSess) {
      return { [savedActiveQuizSession.quiz.numero_semana]: savedActiveQuizSession.liveSess };
    }
    return {};
  });
  const [activeLiveState, setActiveLiveState] = useState(() => savedActiveQuizSession?.liveSess || null);
  const activeLiveStateRef = useRef(null);
  activeLiveStateRef.current = activeLiveState;

  // Estados del Sistema de Integridad Académica y Antitrampas (Móvil, Escritorio y Resiliencia de Red)
  const [shuffledQuestions, setShuffledQuestions] = useState(() => savedActiveQuizSession?.quiz?.preguntas || []);
  const [timeRemainingSeconds, setTimeRemainingSeconds] = useState(() => {
    if (savedActiveQuizSession?.liveSess?.tiempo_restante_segundos) {
      return savedActiveQuizSession.liveSess.tiempo_restante_segundos;
    }
    return 90;
  });
  const [strikesCount, setStrikesCount] = useState(0);
  const [incidentsList, setIncidentsList] = useState([]);
  const [violationModal, setViolationModal] = useState(null); // { strike, isFinal, mensaje, segundosFuera }
  const [isSplitScreenDetected, setIsSplitScreenDetected] = useState(false);
  const [isFullscreenActive, setIsFullscreenActive] = useState(false);
  const [isOnline, setIsOnline] = useState(typeof navigator !== "undefined" ? navigator.onLine : true);
  const [isExamSealedOffline, setIsExamSealedOffline] = useState(false);
  const [pendingSubmissionPayload, setPendingSubmissionPayload] = useState(null);
  const [syncingOfflineSubmission, setSyncingOfflineSubmission] = useState(false);
  const [confirmSubmitModalOpen, setConfirmSubmitModalOpen] = useState(false);
  const [confirmExitModalOpen, setConfirmExitModalOpen] = useState(false);
  const [activeLiveBannerSession, setActiveLiveBannerSession] = useState(null);
  const [answeredQuestionsMap, setAnsweredQuestionsMap] = useState({});
  const [isScreenBlackedOut, setIsScreenBlackedOut] = useState(false);

  const quizStartTimeRef = React.useRef(null);
  const quizEndTimeRef = React.useRef(null);
  const lastTickTimeRef = React.useRef(Date.now());
  const reloadAuditLoggedRef = React.useRef(false);
  const outStartTimeRef = React.useRef(null);
  const totalTimeOutRef = React.useRef(0);
  const strikesCountRef = React.useRef(0);
  const incidentsListRef = React.useRef([]);
  const autoSubmitTriggeredRef = React.useRef(false);
  const isConfirmingRef = React.useRef(false);
  const isSubmittingRef = React.useRef(false);

  // Sincronizar si cambia el prop student desde el padre
  useEffect(() => {
    if (student) {
      setCurrentStudentData((prev) => ({
        ...(prev || {}),
        ...student,
        notas: {
          ...((prev && prev.notas) || {}),
          ...((student && student.notas) || {})
        },
        asistencias: {
          ...((prev && prev.asistencias) || {}),
          ...((student && student.asistencias) || {})
        }
      }));
    }
  }, [student]);

  const effectiveStudent = currentStudentData || student;
  const carreraKey = effectiveStudent?.carrera || "Medicina";
  const theme = CARRERA_THEMES[carreraKey] || CARRERA_THEMES.Medicina;

  const notas = effectiveStudent?.notas || {};
  const asistencias = effectiveStudent?.asistencias || {};
  const seccion = effectiveStudent?.seccion || {};

  // Cargar configuración de semanas, temario, puntajes y perfil actualizado del estudiante
  useEffect(() => {
    let isMounted = true;
    const loadAcademicData = async () => {
      setLoadingAcademic(true);
      try {
        const [resSemanas, resTemario, resPuntajes, resStudent] = await Promise.all([
          api.semanas.getConfig(carreraKey).catch(() => ({ data: [] })),
          api.temario.getAll({ carrera: carreraKey }).catch(() => ({ data: [] })),
          api.temario.getPuntajes(carreraKey).catch(() => ({ data: null })),
          cuentaKey
            ? api.estudiantes.getByCuenta(carreraKey, cuentaKey).catch(() => ({ data: null }))
            : Promise.resolve({ data: null })
        ]);
        if (isMounted) {
          if (resSemanas?.data && Array.isArray(resSemanas.data) && resSemanas.data.length > 0) {
            setSemanasConfig(resSemanas.data);
          }
          if (resTemario?.data && Array.isArray(resTemario.data) && resTemario.data.length > 0) {
            setTemario(resTemario.data);
          }
          if (resPuntajes?.data) {
            setConfigPuntajes(resPuntajes.data);
          }
          if (resStudent?.data) {
            setCurrentStudentData((prev) => ({
              ...(prev || {}),
              ...resStudent.data,
              notas: {
                ...((prev && prev.notas) || {}),
                ...((resStudent.data && resStudent.data.notas) || {})
              },
              asistencias: {
                ...((prev && prev.asistencias) || {}),
                ...((resStudent.data && resStudent.data.asistencias) || {})
              },
              seccion: resStudent.data.seccion || (prev && prev.seccion) || null
            }));
            try {
              safeStorage.setItem("histolab_student_user", JSON.stringify(resStudent.data));
            } catch (e) {
              console.warn("Aviso al actualizar sesión en safeStorage:", e);
            }
          }
        }
      } catch (err) {
        console.error("Error al cargar datos académicos de estudiante:", err);
      } finally {
        if (isMounted) {
          setLoadingAcademic(false);
        }
      }
    };
    loadAcademicData();
    return () => {
      isMounted = false;
    };
  }, [carreraKey, cuentaKey]);

  // Resolver el ID real de la sección del estudiante con múltiples niveles de contingencia
  const resolveStudentSectionId = useCallback(async () => {
    if (effectiveStudent?.seccion_id) return effectiveStudent.seccion_id;
    if (effectiveStudent?.seccion?.id) return effectiveStudent.seccion.id;

    const secIdentifier =
      (typeof effectiveStudent?.seccion === "string" ? effectiveStudent.seccion : null) ||
      effectiveStudent?.seccion_codigo ||
      null;

    if (secIdentifier) {
      try {
        const secRes = await api.secciones.getAll(carreraKey);
        if (secRes?.success && Array.isArray(secRes.data)) {
          const matched = secRes.data.find(
            (s) =>
              String(s.id).toLowerCase() === String(secIdentifier).toLowerCase() ||
              String(s.codigo).trim().toUpperCase() === String(secIdentifier).trim().toUpperCase()
          );
          if (matched?.id) return matched.id;
        }
      } catch (_) {}
    }
    return null;
  }, [effectiveStudent, carreraKey]);

  // Cargar pruebas semanales de la sección (publicadas o habilitadas en vivo)
  // Cargar pruebas semanales de la sección (publicadas o habilitadas en vivo)
  const loadStudentQuizzes = useCallback(async () => {
    let secId = effectiveStudent?.seccion_id || effectiveStudent?.seccion?.id;
    if (!secId) {
      secId = await resolveStudentSectionId();
    }
    if (!secId) return;

    setLoadingQuizzes(true);
    try {
      const res = await api.pruebas.getBySeccion(secId);
      if (res?.success && Array.isArray(res.data)) {
        // Consultar estado en vivo de cada prueba encontrada en la sección
        const liveMap = {};
        await Promise.all(
          res.data.map(async (q) => {
            try {
              const liveRes = await api.pruebas.getLiveState(secId, q.numero_semana);
              if (liveRes?.success && liveRes.data) {
                liveMap[q.numero_semana] = liveRes.data;
              }
            } catch (_) {}
          })
        );
        setLiveSessionsMap(liveMap);

        // Incluir pruebas publicadas Y pruebas habilitadas en vivo por el docente
        const publishedOrLive = res.data.filter((q) => {
          const s = liveMap[q.numero_semana];
          const isLiveActive = Boolean(
            (s && (s.habilitada || s.estado === "lobby" || s.estado === "en_pregunta" || s.estado === "esperando_siguiente") && s.estado !== "finalizada" && s.estado !== "inactiva") ||
            (q.habilitada_en_vivo === true && (!s || s.estado !== "finalizada"))
          );
          return q.publicada === true || String(q.publicada) === "true" || q.estado === "publicada" || isLiveActive;
        });

        setOnlineQuizzes(publishedOrLive);

        // Enviar latido de presencia para registrar al alumno como conectado ante el docente
        if (cuentaKey && res.data.length > 0) {
          res.data.forEach((q) => {
            api.pruebas.sendLiveHeartbeat(secId, q.numero_semana, {
              numero_cuenta: cuentaKey,
              nombre_completo: effectiveStudent?.nombre_completo || "Estudiante",
              pregunta_vista: -1
            }).catch(() => {});
          });
        }

        // Cargar las entregas de este estudiante
        const subsMap = {};
        await Promise.all(
          publishedOrLive.map(async (q) => {
            try {
              const subRes = await api.pruebas.getMiEntrega(secId, q.numero_semana, cuentaKey);
              if (subRes?.success && subRes.data) {
                subsMap[q.numero_semana] = subRes.data;
              }
            } catch (_) {}
          })
        );
        setExistingSubmissions(subsMap);
      }
    } catch (err) {
      console.warn("Aviso al cargar pruebas online del estudiante:", err.message);
    } finally {
      setLoadingQuizzes(false);
    }
  }, [effectiveStudent, cuentaKey, resolveStudentSectionId]);

  // Cargar catálogo de pruebas de inmediato al montar la vista
  useEffect(() => {
    loadStudentQuizzes();
  }, [loadStudentQuizzes]);

  // Refrescar si el usuario entra explícitamente a la pestaña de pruebas
  useEffect(() => {
    if (activeTab === "pruebas") {
      loadStudentQuizzes();
    }
  }, [activeTab, loadStudentQuizzes]);

  // Sondeo continuo cada 1.8s con detección instantánea tipo Kahoot
  useEffect(() => {
    if (activeQuizToTake) return; // Si ya está dentro del examen, la sincronización se realiza por el heartbeat del examen

    let isMounted = true;
    const pollLiveSession = async () => {
      let secId = effectiveStudent?.seccion_id || effectiveStudent?.seccion?.id;
      if (!secId) {
        secId = await resolveStudentSectionId();
      }
      if (!secId || !isMounted) return;

      try {
        // 1. Consulta ultra-liviana directa al despachador en vivo
        const activeRes = await api.pruebas.getActiveLiveSession(secId);
        if (!isMounted) return;

        if (activeRes?.activa && activeRes.data) {
          const liveData = activeRes.data;
          const liveSem = Number(liveData.numero_semana);
          setActiveLiveBannerSession(liveData);
          setLiveSessionsMap((prev) => ({ ...prev, [liveSem]: liveData }));

          // 2. Registrar presencia del estudiante en la sala de espera ante el docente
          if (cuentaKey) {
            api.pruebas.sendLiveHeartbeat(secId, liveSem, {
              numero_cuenta: cuentaKey,
              nombre_completo: effectiveStudent?.nombre_completo || "Estudiante",
              pregunta_vista: -1
            }).catch(() => {});
          }

          // Si aún no tenemos las pruebas en memoria o falta esta semana, refrescar catálogo
          if (!onlineQuizzes || !onlineQuizzes.some((q) => Number(q.numero_semana) === liveSem)) {
            loadStudentQuizzes();
          }
        } else {
          setActiveLiveBannerSession(null);
        }
      } catch (_) {}
    };

    pollLiveSession();
    const interval = setInterval(pollLiveSession, 1800);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [activeQuizToTake, effectiveStudent, resolveStudentSectionId, cuentaKey, onlineQuizzes, loadStudentQuizzes]);

  // Identificar si existe alguna prueba con sesión en vivo habilitada por el docente pendiente de realizar
  const anyLiveQuiz = useMemo(() => {
    return (onlineQuizzes || []).find((q) => {
      const s = liveSessionsMap[q.numero_semana];
      const isSubmitted = Boolean(existingSubmissions[q.numero_semana]);
      const isLiveActive = Boolean(
        (s && (s.habilitada || s.estado === "lobby" || s.estado === "en_pregunta" || s.estado === "esperando_siguiente") && s.estado !== "finalizada" && s.estado !== "inactiva") ||
        (q.habilitada_en_vivo === true && (!s || s.estado !== "finalizada"))
      );
      return isLiveActive && !isSubmitted;
    });
  }, [onlineQuizzes, liveSessionsMap, existingSubmissions]);

  // Formateador de tiempo mm:ss
  const formatTimer = (totalSeconds) => {
    const safeSec = Math.max(0, totalSeconds);
    const mins = Math.floor(safeSec / 60);
    const secs = safeSec % 60;
    return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  };

  // Solicitar pantalla completa en dispositivo
  const requestQuizFullscreen = () => {
    try {
      if (document.documentElement.requestFullscreen) {
        document.documentElement.requestFullscreen().catch(() => {});
      } else if (document.documentElement.webkitRequestFullscreen) {
        document.documentElement.webkitRequestFullscreen().catch(() => {});
      }
      setIsFullscreenActive(true);
    } catch (_) {}
  };

  // Claves para persistencia y contingencia de evaluaciones
  const getActiveAttemptStorageKey = useCallback(
    (sem) => {
      const cKey = cuentaKey || "estudiante";
      return `histolab_active_quiz_${cKey}_sem_${sem}`;
    },
    [cuentaKey]
  );

  const getPendingSubmissionStorageKey = useCallback(
    (sem) => {
      const cKey = cuentaKey || "estudiante";
      return `histolab_sealed_quiz_${cKey}_sem_${sem}`;
    },
    [cuentaKey]
  );

  const saveActiveAttemptToDisk = useCallback(
    (quizObj, questions, answers, startTime, endTime, strikes, incidents, timeOut) => {
      if (!quizObj) return;
      try {
        const cKey = cuentaKey || "estudiante";
        const key = getActiveAttemptStorageKey(quizObj.numero_semana);
        const stateToSave = {
          quiz: quizObj,
          shuffledQuestions: questions,
          quizAnswers: answers,
          startTime,
          endTime,
          strikes,
          incidents,
          totalTimeOut: timeOut,
          savedAt: Date.now()
        };
        safeStorage.setItem(key, JSON.stringify(stateToSave));
        safeStorage.setItem(
          `histolab_active_quiz_session_${cKey}`,
          JSON.stringify({ quiz: quizObj, liveSess: activeLiveStateRef.current, savedAt: Date.now() })
        );
      } catch (e) {
        console.warn("Aviso al guardar borrador de prueba en safeStorage:", e);
      }
    },
    [cuentaKey, getActiveAttemptStorageKey]
  );

  const clearActiveAttemptFromDisk = useCallback(
    (numeroSemana) => {
      try {
        const cKey = cuentaKey || "estudiante";
        const key = getActiveAttemptStorageKey(numeroSemana);
        safeStorage.removeItem(key);
        safeStorage.removeItem(`histolab_active_quiz_session_${cKey}`);
      } catch (_) {}
    },
    [cuentaKey, getActiveAttemptStorageKey]
  );

  // Iniciar la realización de una prueba semanal en vivo
  const handleStartQuiz = (quiz, liveSess = null) => {
    // 1. Las preguntas se mantienen en orden secuencial estricto para sincronización global
    const originalQuestions = quiz.preguntas || [];
    setShuffledQuestions(originalQuestions);

    // 2. Determinar estado inicial según sesión en vivo
    const liveQIdx = liveSess?.pregunta_actual_idx ?? 0;
    const isEnPregunta = liveSess?.estado === "en_pregunta";
    const duracionQ = Number(originalQuestions[liveQIdx]?.tiempo_segundos || quiz.tiempo_por_pregunta_segundos || 90);
    const initialSecs = isEnPregunta
      ? (liveSess?.tiempo_restante_segundos ?? duracionQ)
      : duracionQ;

    // 3. Inicializar respuestas vacías; marcar preguntas previas como sin_responder si entra tarde
    const initAnswers = {};
    originalQuestions.forEach((q, qIdx) => {
      initAnswers[q.id] = {};
      const esPreguntaPerdida = isEnPregunta && qIdx < liveQIdx;

      if (!q.items || q.items.length === 0) {
        initAnswers[q.id]["respuesta"] = esPreguntaPerdida ? "sin_responder" : "";
      } else {
        (q.items || []).forEach((it) => {
          if (it.tipo === "listado") {
            initAnswers[q.id][it.id] = esPreguntaPerdida
              ? Array(it.cantidad || 3).fill("sin_responder")
              : Array(it.cantidad || 3).fill("");
          } else {
            initAnswers[q.id][it.id] = esPreguntaPerdida ? "sin_responder" : "";
          }
        });
      }
    });
    setQuizAnswers(initAnswers);

    setTimeRemainingSeconds(initialSecs);
    const effectiveLive = liveSess || {
      estado: "lobby",
      habilitada: true,
      pregunta_actual_idx: 0,
      duracion_segundos: duracionQ,
      tiempo_restante_segundos: initialSecs
    };
    setActiveLiveState(effectiveLive);

    const now = Date.now();
    quizStartTimeRef.current = now;
    quizEndTimeRef.current = now + initialSecs * 1000;
    lastTickTimeRef.current = now;

    // 4. Reiniciar auditoría y contadores de integridad
    setStrikesCount(0);
    setIncidentsList([]);
    setViolationModal(null);
    setIsSplitScreenDetected(false);
    setIsExamSealedOffline(false);
    setPendingSubmissionPayload(null);
    strikesCountRef.current = 0;
    incidentsListRef.current = [];
    totalTimeOutRef.current = 0;
    outStartTimeRef.current = null;
    autoSubmitTriggeredRef.current = false;
    reloadAuditLoggedRef.current = false;

    setActiveQuizToTake(quiz);
    setActiveTab("pruebas");
    setReviewingSubmission(null);

    // Guardar en almacenamiento local persistente
    saveActiveAttemptToDisk(quiz, originalQuestions, initAnswers, now, now + initialSecs * 1000, 0, [], 0);
    try {
      const cKey = cuentaKey || "estudiante";
      safeStorage.setItem(
        `histolab_active_quiz_session_${cKey}`,
        JSON.stringify({ quiz, liveSess: effectiveLive, savedAt: Date.now() })
      );
    } catch (_) {}

    // 5. Bloquear pantalla completa
    requestQuizFullscreen();
  };

  // Procesar éxito de entrega de prueba
  const handlePostSubmitSuccess = useCallback(
    (submittedData, forcedReason, targetQuiz = activeQuizToTake) => {
      const quizSem = targetQuiz?.numero_semana || submittedData?.numero_semana;

      if (forcedReason?.motivo === "expulsion_infracciones") {
        notify("Prueba bloqueada y enviada automáticamente por exceder el límite de advertencias.", "warning");
      } else if (forcedReason?.motivo === "tiempo_agotado") {
        notify("Tiempo concluido. Tu prueba ha sido enviada exitosamente.", "info");
      } else {
        notify("¡Prueba semanal entregada con éxito! Queda registrada en espera de revisión docente.", "success");
      }

      const finalData = {
        ...submittedData,
        estado: "enviado",
        fecha_envio: new Date().toISOString()
      };

      if (quizSem) {
        setExistingSubmissions((prev) => ({
          ...prev,
          [quizSem]: finalData
        }));
        clearActiveAttemptFromDisk(quizSem);
        try {
          safeStorage.removeItem(getPendingSubmissionStorageKey(quizSem));
        } catch (_) {}
      }

      setReviewingSubmission({
        quiz: targetQuiz || { numero_semana: quizSem, titulo: `Semana ${quizSem}` },
        submission: finalData
      });
      setActiveQuizToTake(null);
      setQuizAnswers({});
      setViolationModal(null);
      setConfirmSubmitModalOpen(false);
      setConfirmExitModalOpen(false);
      isConfirmingRef.current = false;
      isSubmittingRef.current = false;
      outStartTimeRef.current = null;
      setIsExamSealedOffline(false);
      setPendingSubmissionPayload(null);
      loadStudentQuizzes();

      try {
        if (document.exitFullscreen) document.exitFullscreen().catch(() => {});
        else if (document.webkitExitFullscreen) document.webkitExitFullscreen().catch(() => {});
      } catch (_) {}
    },
    [activeQuizToTake, clearActiveAttemptFromDisk, getPendingSubmissionStorageKey, loadStudentQuizzes, notify]
  );

  // Estadísticas de preguntas respondidas para el diálogo de confirmación de entrega
  const getAnsweredStats = useMemo(() => {
    if (!activeQuizToTake || !Array.isArray(activeQuizToTake.preguntas)) {
      return { answered: 0, total: 0 };
    }
    const total = activeQuizToTake.preguntas.length;
    let answered = 0;

    activeQuizToTake.preguntas.forEach((q) => {
      const qAns = quizAnswers[q.id];
      if (!qAns) return;

      if (typeof qAns === "string" && qAns.trim().length > 0) {
        answered++;
        return;
      }

      if (typeof qAns === "object") {
        if (q.items && q.items.length > 0) {
          const hasAnyItemAnswer = q.items.some((it) => {
            const val = qAns[it.id];
            if (!val) return false;
            if (typeof val === "string") return val.trim().length > 0;
            if (Array.isArray(val)) return val.some((v) => typeof v === "string" && v.trim().length > 0);
            return false;
          });
          if (hasAnyItemAnswer) answered++;
        } else {
          const hasAnyAnswer = Object.values(qAns).some((val) => {
            if (typeof val === "string") return val.trim().length > 0;
            if (Array.isArray(val)) return val.some((v) => typeof v === "string" && v.trim().length > 0);
            return false;
          });
          if (hasAnyAnswer) answered++;
        }
      }
    });

    return { answered, total };
  }, [activeQuizToTake, quizAnswers]);

  // Ejecución del envío de la prueba semanal al servidor (sellado e inmutabilidad)
  const executeSubmitQuiz = async (forcedReason = null) => {
    if (!activeQuizToTake || submittingQuiz) return;
    let secId = effectiveStudent?.seccion_id || effectiveStudent?.seccion?.id;
    if (!secId) {
      secId = await resolveStudentSectionId();
    }
    if (!secId) {
      notify("No se pudo identificar la sección del estudiante para registrar la entrega.", "error");
      isSubmittingRef.current = false;
      return;
    }

    isSubmittingRef.current = true;
    isConfirmingRef.current = false;
    outStartTimeRef.current = null;
    setSubmittingQuiz(true);

    const now = Date.now();
    const startTime = quizStartTimeRef.current || now;
    const totalDurSec = Math.max(1, Math.round((now - startTime) / 1000));

    const auditoriaPayload = {
      strikes: strikesCountRef.current,
      total_salidas: incidentsListRef.current.length,
      tiempo_fuera_segundos: totalTimeOutRef.current,
      motivo_finalizacion: forcedReason?.motivo || "entrega_alumno",
      duracion_total_segundos: totalDurSec,
      hora_inicio: new Date(startTime).toISOString(),
      hora_fin: new Date(now).toISOString(),
      incidentes: incidentsListRef.current,
      pantalla_completa_solicitada: true,
      conexion_al_enviar: navigator.onLine ? "online" : "offline"
    };

    const payload = {
      quiz_id: activeQuizToTake.id,
      numero_semana: activeQuizToTake.numero_semana,
      numero_cuenta: cuentaKey,
      nombre_completo: effectiveStudent?.nombre_completo,
      carrera: carreraKey,
      respuestas: quizAnswers,
      auditoria: auditoriaPayload
    };

    try {
      if (!navigator.onLine) {
        throw new Error("Conexión offline en dispositivo");
      }

      const res = await api.pruebas.submit(secId, payload);
      if (res?.success) {
        handlePostSubmitSuccess(res.data || payload, forcedReason);
      } else {
        throw new Error(res?.message || "Error al registrar en servidor");
      }
    } catch (err) {
      console.warn("Aviso al entregar prueba (activando sellado offline inmutable):", err.message);
      // Activar sellado inmutable en dispositivo
      setIsExamSealedOffline(true);
      setPendingSubmissionPayload(payload);
      try {
        const pKey = getPendingSubmissionStorageKey(activeQuizToTake.numero_semana);
        safeStorage.setItem(pKey, JSON.stringify(payload));
        clearActiveAttemptFromDisk(activeQuizToTake.numero_semana);
      } catch (_) {}

      notify(
        "📶 Sin conexión con el servidor. Tu evaluación ha sido sellada y resguardada de forma segura en este dispositivo. Se enviará de inmediato al restablecerse la señal.",
        "warning"
      );
    } finally {
      setSubmittingQuiz(false);
      isSubmittingRef.current = false;
    }
  };

  // Apertura del modal in-app de confirmación de entrega (sin disparar alertas de seguridad ni desenfoque)
  const handleSubmitQuiz = (forcedReason = null) => {
    if (forcedReason || isExamSealedOffline) {
      executeSubmitQuiz(forcedReason);
    } else {
      isConfirmingRef.current = true;
      outStartTimeRef.current = null;
      setConfirmSubmitModalOpen(true);
    }
  };

  // Sincronización automática de entrega sellada al recuperar señal
  const dispatchPendingOfflineSubmission = useCallback(async () => {
    if (!pendingSubmissionPayload || syncingOfflineSubmission) return;
    let secId = effectiveStudent?.seccion_id || effectiveStudent?.seccion?.id;
    if (!secId) {
      secId = await resolveStudentSectionId();
    }
    if (!secId) return;

    setSyncingOfflineSubmission(true);
    try {
      const payloadToSend = {
        ...pendingSubmissionPayload,
        auditoria: {
          ...(pendingSubmissionPayload.auditoria || {}),
          sincronizada_offline: true,
          hora_sincronizacion: new Date().toISOString()
        }
      };
      const res = await api.pruebas.submit(secId, payloadToSend);
      if (res?.success) {
        notify("✅ ¡Conexión restablecida! Tu evaluación sellada ha sido entregada exitosamente al servidor.", "success");
        handlePostSubmitSuccess(
          res.data || payloadToSend,
          { motivo: pendingSubmissionPayload.auditoria?.motivo_finalizacion },
          activeQuizToTake
        );
      } else {
        notify("No se pudo sincronizar en este momento. Vuelve a intentarlo.", "warning");
      }
    } catch (err) {
      console.warn("Aviso al sincronizar entrega offline:", err.message);
      notify("Fallo al contactar el servidor. Verifica tu conexión e inténtalo de nuevo.", "error");
    } finally {
      setSyncingOfflineSubmission(false);
    }
  }, [pendingSubmissionPayload, syncingOfflineSubmission, effectiveStudent, resolveStudentSectionId, notify, handlePostSubmitSuccess, activeQuizToTake]);

  // Escuchar eventos de red (Online / Offline)
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      if (isExamSealedOffline && pendingSubmissionPayload) {
        dispatchPendingOfflineSubmission();
      }
    };
    const handleOffline = () => {
      setIsOnline(false);
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [isExamSealedOffline, pendingSubmissionPayload, dispatchPendingOfflineSubmission]);

  // Restaurar intento activo tras recarga (F5, cierre involuntario de navegador, o pull-to-refresh)
  useEffect(() => {
    if (isExamSealedOffline) return;

    // Si ya tenemos activeQuizToTake activo (ej. restaurado directamente al montar desde safeStorage)
    if (activeQuizToTake) {
      const sem = activeQuizToTake.numero_semana;
      const activeKey = getActiveAttemptStorageKey(sem);
      const activeRaw = safeStorage.getItem(activeKey);
      if (activeRaw) {
        try {
          const saved = JSON.parse(activeRaw);
          if (saved) {
            if (saved.shuffledQuestions && saved.shuffledQuestions.length > 0) {
              setShuffledQuestions(saved.shuffledQuestions);
            }
            if (saved.quizAnswers && Object.keys(saved.quizAnswers).length > 0) {
              setQuizAnswers((prev) => ({ ...(prev || {}), ...saved.quizAnswers }));
            }
            if (typeof saved.strikes === "number") {
              setStrikesCount(saved.strikes);
              strikesCountRef.current = saved.strikes;
            }
            if (Array.isArray(saved.incidents)) {
              const restoredIncidents = [...saved.incidents];
              if (!reloadAuditLoggedRef.current) {
                reloadAuditLoggedRef.current = true;
                restoredIncidents.push({
                  tipo: "recarga_o_reapertura",
                  detalle: "El estudiante recargó o reabrió la página de la evaluación",
                  strike: saved.strikes || 0,
                  segundosFuera: 0,
                  hora: new Date().toLocaleTimeString()
                });
              }
              setIncidentsList(restoredIncidents);
              incidentsListRef.current = restoredIncidents;
            }
            if (saved.startTime) quizStartTimeRef.current = saved.startTime;
            if (saved.endTime) quizEndTimeRef.current = saved.endTime;
            if (saved.totalTimeOut) totalTimeOutRef.current = saved.totalTimeOut;
          }
        } catch (_) {}
      }
      return;
    }

    if (!onlineQuizzes || onlineQuizzes.length === 0) return;

    for (const quiz of onlineQuizzes) {
      const sem = quiz.numero_semana;
      const pendingKey = getPendingSubmissionStorageKey(sem);
      const activeKey = getActiveAttemptStorageKey(sem);

      // 1. Revisar si hay un envío sellado pendiente de sincronización
      const pendingRaw = safeStorage.getItem(pendingKey);
      if (pendingRaw) {
        try {
          const parsedPending = JSON.parse(pendingRaw);
          if (parsedPending) {
            setPendingSubmissionPayload(parsedPending);
            setIsExamSealedOffline(true);
            setActiveQuizToTake(quiz);
            return;
          }
        } catch (_) {}
      }

      // 2. Revisar si hay un intento activo no finalizado
      const activeRaw = safeStorage.getItem(activeKey);
      if (activeRaw) {
        try {
          const saved = JSON.parse(activeRaw);
          if (saved) {
            const now = Date.now();
            // Intento vigente: restaurar íntegramente
            setActiveQuizToTake(saved.quiz || quiz);
            setShuffledQuestions(saved.shuffledQuestions || quiz.preguntas || []);
            setQuizAnswers(saved.quizAnswers || {});
            setStrikesCount(saved.strikes || 0);
            strikesCountRef.current = saved.strikes || 0;

            const restoredIncidents = [...(saved.incidents || [])];
            if (!reloadAuditLoggedRef.current) {
              reloadAuditLoggedRef.current = true;
              restoredIncidents.push({
                tipo: "recarga_o_reapertura",
                detalle: "El estudiante recargó o reabrió la página de la evaluación",
                strike: saved.strikes || 0,
                segundosFuera: 0,
                hora: new Date().toLocaleTimeString()
              });
            }
            setIncidentsList(restoredIncidents);
            incidentsListRef.current = restoredIncidents;
            totalTimeOutRef.current = saved.totalTimeOut || 0;
            quizStartTimeRef.current = saved.startTime || now;
            quizEndTimeRef.current = saved.endTime || now + 90000;
            lastTickTimeRef.current = now;

            const remainingSec = saved.endTime ? Math.max(1, Math.floor((saved.endTime - now) / 1000)) : 90;
            setTimeRemainingSeconds(remainingSec);

            notify("⚠️ Evaluación restaurada. La recarga de la página ha quedado registrada en tu bitácora de integridad.", "info");
            return;
          }
        } catch (e) {
          console.warn("Aviso al restaurar intento activo:", e);
        }
      }
    }
  }, [onlineQuizzes, activeQuizToTake, isExamSealedOffline, getActiveAttemptStorageKey, getPendingSubmissionStorageKey, notify]);

  // Interceptor para evitar cierre o recarga involuntaria de pestaña durante la prueba
  useEffect(() => {
    if (!activeQuizToTake || isExamSealedOffline) return;

    const handleBeforeUnload = (e) => {
      e.preventDefault();
      e.returnValue = "Tienes una evaluación activa. Si sales o recargas, se registrará una incidencia en tu bitácora.";
      return e.returnValue;
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [activeQuizToTake, isExamSealedOffline]);

  // Registrar una infracción de integridad (Salida de app, cambio de pestaña, split screen)
  const registerViolation = useCallback(
    (tipo, detalle, segundosFuera = 0) => {
      if (!activeQuizToTake || autoSubmitTriggeredRef.current || isExamSealedOffline || isSubmittingRef.current || isConfirmingRef.current) return;

      const nextStrike = strikesCountRef.current + 1;
      strikesCountRef.current = nextStrike;
      setStrikesCount(nextStrike);

      const incident = {
        tipo,
        detalle,
        strike: nextStrike,
        segundosFuera,
        hora: new Date().toLocaleTimeString()
      };
      incidentsListRef.current.push(incident);
      setIncidentsList([...incidentsListRef.current]);

      // Guardar de inmediato en localStorage para que persista aun si recarga
      saveActiveAttemptToDisk(
        activeQuizToTake,
        shuffledQuestions,
        quizAnswers,
        quizStartTimeRef.current,
        quizEndTimeRef.current,
        nextStrike,
        incidentsListRef.current,
        totalTimeOutRef.current
      );

      // Alerta háptica si el móvil lo soporta
      if (navigator.vibrate) {
        navigator.vibrate([200, 100, 200]);
      }

      if (nextStrike >= 3) {
        // 3ª Infracción: Auto-envío forzado y cierre
        autoSubmitTriggeredRef.current = true;
        setViolationModal({
          strike: 3,
          isFinal: true,
          mensaje:
            "Has alcanzado el límite de 3 advertencias de integridad (salida de app, captura de pantalla o despliegue de barra de notificaciones). Tu examen ha sido bloqueado y enviado automáticamente para revisión docente."
        });
        setTimeout(() => {
          handleSubmitQuiz({ motivo: "expulsion_infracciones" });
        }, 2200);
      } else {
        // Advertencia intermedia 1 o 2
        let mensajePersonalizado = detalle;
        if (tipo === "captura_de_pantalla") {
          mensajePersonalizado = "Se detectó un intento de captura de pantalla o grabación del examen. El contenido fue ocultado en negro y la infracción quedó registrada en tu auditoría.";
        } else if (tipo === "barra_notificaciones_o_salida") {
          mensajePersonalizado = `Se detectó que bajaste la barra de notificaciones, centro de control o cambiaste de ventana${segundosFuera > 0 ? ` durante ${segundosFuera} seg` : ""}. El contenido fue ocultado y la incidencia quedó registrada en tu auditoría.`;
        } else if (tipo === "pantalla_dividida") {
          mensajePersonalizado = "Se detectó uso de pantalla dividida o ventana flotante en el dispositivo. Esta acción no está permitida durante la evaluación.";
        } else if (segundosFuera > 0) {
          mensajePersonalizado = `Se detectó salida de la pantalla de la evaluación durante ${segundosFuera} segundos.`;
        }

        setViolationModal({
          strike: nextStrike,
          isFinal: false,
          segundosFuera,
          mensaje: `${mensajePersonalizado} A la 3ª advertencia, la prueba se sellará y enviará automáticamente sin derecho a reintento.`
        });
      }
    },
    [activeQuizToTake, isExamSealedOffline, saveActiveAttemptToDisk, shuffledQuestions, quizAnswers]
  );

  // Sincronización en vivo vía Heartbeat con el servidor durante la prueba
  useEffect(() => {
    if (!activeQuizToTake || isExamSealedOffline) return;

    let isMounted = true;
    const sem = activeQuizToTake.numero_semana;

    const sendHeartbeat = async () => {
      let secId = effectiveStudent?.seccion_id || effectiveStudent?.seccion?.id;
      if (!secId) {
        secId = await resolveStudentSectionId();
      }
      if (!secId || !isMounted) return;

      try {
        const curIdx = activeLiveStateRef.current?.pregunta_actual_idx ?? 0;
        const curQ = (activeQuizToTake?.preguntas || [])[curIdx];
        const curAns = curQ ? quizAnswers[curQ.id] : null;
        const hasContent = Boolean(
          curAns &&
          (typeof curAns === "string"
            ? curAns.trim()
            : typeof curAns?.respuesta === "string"
            ? curAns.respuesta.trim()
            : Object.values(curAns || {}).some((v) =>
                typeof v === "string" ? v.trim() : Array.isArray(v) && v.some((x) => String(x).trim())
              ))
        );
        const hasAnswered = Boolean(answeredQuestionsMap[curIdx] || hasContent);

        const res = await api.pruebas.sendLiveHeartbeat(secId, sem, {
          numero_cuenta: cuentaKey,
          nombre_completo: effectiveStudent?.nombre_completo,
          respuestas_parciales: quizAnswers,
          pregunta_vista: curIdx,
          ha_respondido: hasAnswered
        });

        if (res?.success && res.data && isMounted) {
          const liveData = res.data;
          setActiveLiveState(liveData);

          if (liveData.estado === "en_pregunta") {
            setTimeRemainingSeconds(liveData.tiempo_restante_segundos ?? 90);
          }

          // Si el docente finalizó la prueba para toda la sección
          if (liveData.estado === "finalizada" && !autoSubmitTriggeredRef.current) {
            autoSubmitTriggeredRef.current = true;
            handleSubmitQuiz({ motivo: "finalizada_por_docente" });
          }
        }
      } catch (err) {
        console.warn("Aviso en heartbeat:", err.message);
      }
    };

    sendHeartbeat();
    const heartbeatInterval = setInterval(sendHeartbeat, 1200);

    return () => {
      isMounted = false;
      clearInterval(heartbeatInterval);
    };
  }, [activeQuizToTake, effectiveStudent, cuentaKey, quizAnswers, isExamSealedOffline, resolveStudentSectionId, answeredQuestionsMap]);

  // Decremento local fluido de segundo a segundo mientras está en pregunta
  useEffect(() => {
    if (!activeQuizToTake || isExamSealedOffline) return;

    const interval = setInterval(() => {
      setTimeRemainingSeconds((prev) => {
        if (prev <= 1) {
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [activeQuizToTake, isExamSealedOffline]);

  // Listeners del navegador para control antitrampas estricto en móvil y escritorio
  useEffect(() => {
    if (!activeQuizToTake || isExamSealedOffline) return;

    // A. Salida de app en celular / cambio de pestaña en navegador
    const handleVisibilityChange = () => {
      if (isSubmittingRef.current || isConfirmingRef.current) {
        outStartTimeRef.current = null;
        return;
      }
      if (document.hidden) {
        if (!outStartTimeRef.current) {
          outStartTimeRef.current = Date.now();
        }
        setIsScreenBlackedOut(true);
        if (typeof document !== "undefined" && document.body) {
          document.body.classList.add("anticheat-blackout-on");
        }
      } else {
        setIsScreenBlackedOut(false);
        if (typeof document !== "undefined" && document.body) {
          document.body.classList.remove("anticheat-blackout-on");
        }
        if (outStartTimeRef.current) {
          const elapsed = Math.max(1, Math.round((Date.now() - outStartTimeRef.current) / 1000));
          totalTimeOutRef.current += elapsed;
          outStartTimeRef.current = null;
          registerViolation("salida_de_pantalla", "Cambio de aplicación o pestaña en el dispositivo", elapsed);
        }
      }
    };

    // B. Pérdida de foco (despliegue de barra de notificaciones en Android, Control Center en iOS, capturas)
    const handleBlur = () => {
      if (isSubmittingRef.current || isConfirmingRef.current) {
        outStartTimeRef.current = null;
        return;
      }
      if (!outStartTimeRef.current) {
        outStartTimeRef.current = Date.now();
      }
      // Ocultar pantalla de inmediato en negro absoluto para que cualquier captura o vista previa salga 100% negra
      setIsScreenBlackedOut(true);
      if (typeof document !== "undefined" && document.body) {
        document.body.classList.add("anticheat-blackout-on");
      }
    };

    const handleFocus = () => {
      if (isSubmittingRef.current || isConfirmingRef.current) {
        outStartTimeRef.current = null;
        return;
      }
      setIsScreenBlackedOut(false);
      if (typeof document !== "undefined" && document.body) {
        document.body.classList.remove("anticheat-blackout-on");
      }
      if (outStartTimeRef.current) {
        const elapsed = Math.max(1, Math.round((Date.now() - outStartTimeRef.current) / 1000));
        totalTimeOutRef.current += elapsed;
        outStartTimeRef.current = null;
        registerViolation("barra_notificaciones_o_salida", "Despliegue de barra de notificaciones, centro de control o pérdida de foco", elapsed);
      }
    };

    // C. Detección de pantalla dividida (Split-Screen en Android / iPad) ignorando cuando el teclado virtual esté abierto
    const handleResize = () => {
      const isInputActive = Boolean(
        document.activeElement &&
        (document.activeElement.tagName === "INPUT" || document.activeElement.tagName === "TEXTAREA")
      );
      if (isInputActive) return; // Teclado móvil abierto, no es pantalla dividida

      const isSplit = window.innerHeight < window.screen.height * 0.48;
      setIsSplitScreenDetected(isSplit);
      if (isSplit && !violationModal) {
        registerViolation("pantalla_dividida", "Se detectó modo de pantalla dividida o ventana flotante en el dispositivo", 0);
      }
    };

    // D. Pantalla completa
    const handleFullscreenChange = () => {
      const isFs = Boolean(document.fullscreenElement || document.webkitFullscreenElement);
      setIsFullscreenActive(isFs);
    };

    // E. Detección directa de capturas de pantalla por teclado y bloqueo de atajos de desarrollo
    const handleKeyDown = (e) => {
      const isPrintScreen = e.key === "PrintScreen" || e.key === "Snapshot";
      const isMacScreenshot = (e.metaKey || e.ctrlKey) && e.shiftKey && (e.key === "3" || e.key === "4" || e.key === "5");

      if (isPrintScreen || isMacScreenshot) {
        e.preventDefault();
        setIsScreenBlackedOut(true);
        registerViolation("captura_de_pantalla", "Intento de captura de pantalla detectado", 0);
        setTimeout(() => {
          setIsScreenBlackedOut(false);
        }, 2500);
        return;
      }

      if (
        e.key === "F12" ||
        (e.ctrlKey && e.shiftKey && (e.key === "I" || e.key === "i" || e.key === "C" || e.key === "c" || e.key === "J" || e.key === "j")) ||
        (e.ctrlKey && (e.key === "u" || e.key === "U" || e.key === "s" || e.key === "S" || e.key === "p" || e.key === "P"))
      ) {
        e.preventDefault();
        notify("⚠️ Función del navegador restringida durante la evaluación.", "warning");
      }
    };

    // F. Menú contextual
    const handleContextMenu = (e) => {
      e.preventDefault();
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("blur", handleBlur);
    window.addEventListener("focus", handleFocus);
    window.addEventListener("resize", handleResize);
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    document.addEventListener("webkitfullscreenchange", handleFullscreenChange);
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("contextmenu", handleContextMenu);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("blur", handleBlur);
      window.removeEventListener("focus", handleFocus);
      window.removeEventListener("resize", handleResize);
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
      document.removeEventListener("webkitfullscreenchange", handleFullscreenChange);
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("contextmenu", handleContextMenu);
    };
  }, [activeQuizToTake, isExamSealedOffline, registerViolation, violationModal]);

  // G. Auto-desplazamiento inteligente para cuando el teclado virtual de celular se abre
  useEffect(() => {
    if (!activeQuizToTake || isExamSealedOffline) return;

    const handleViewportChange = () => {
      const el = document.activeElement;
      if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA")) {
        setTimeout(() => {
          el.scrollIntoView({ behavior: "smooth", block: "center" });
        }, 120);
      }
    };

    if (typeof window !== "undefined" && window.visualViewport) {
      window.visualViewport.addEventListener("resize", handleViewportChange);
      window.visualViewport.addEventListener("scroll", handleViewportChange);
    }

    return () => {
      if (typeof window !== "undefined" && window.visualViewport) {
        window.visualViewport.removeEventListener("resize", handleViewportChange);
        window.visualViewport.removeEventListener("scroll", handleViewportChange);
      }
    };
  }, [activeQuizToTake, isExamSealedOffline]);

  // Manejar cambio en casilla de respuesta con auto-guardado persistente
  const handleAnswerChange = (preguntaId, itemId, indexOrText, textIfList = null) => {
    if (isExamSealedOffline) return;
    setQuizAnswers((prev) => {
      const currentQ = prev[preguntaId] || {};
      let updated;
      if (textIfList !== null) {
        // Listado numerado
        const currentList = Array.isArray(currentQ[itemId]) ? [...currentQ[itemId]] : [];
        currentList[indexOrText] = textIfList;
        updated = {
          ...prev,
          [preguntaId]: {
            ...currentQ,
            [itemId]: currentList
          }
        };
      } else {
        // Texto corto
        updated = {
          ...prev,
          [preguntaId]: {
            ...currentQ,
            [itemId]: indexOrText
          }
        };
      }

      // Auto-guardado inmediato en almacenamiento local para no perder respuestas por corte o recarga
      if (activeQuizToTake) {
        saveActiveAttemptToDisk(
          activeQuizToTake,
          shuffledQuestions,
          updated,
          quizStartTimeRef.current,
          quizEndTimeRef.current,
          strikesCountRef.current,
          incidentsListRef.current,
          totalTimeOutRef.current
        );
      }

      return updated;
    });
  };

  // Ver comprobante / revisión de una prueba entregada
  const handleOpenReview = (quiz, submission) => {
    setReviewingSubmission({ quiz, submission });
    setActiveQuizToTake(null);
  };

  // Semanas reales configuradas para la carrera matriculada (sin asumir número fijo)
  const activeCareerWeeks = useMemo(() => {
    if (Array.isArray(semanasConfig) && semanasConfig.length > 0) {
      return [...semanasConfig].sort((a, b) => Number(a.numero_semana) - Number(b.numero_semana));
    }
    // Fallback dinámico: solo semanas que tengan algún registro
    const fallbackList = [];
    for (let i = 1; i <= 20; i++) {
      if (
        asistencias[`asistencia_${i}`] ||
        asistencias[`semana_${i}`] ||
        effectiveStudent?.[`Asistencia de la semana ${i}`] ||
        notas[`examencito_${i}`]
      ) {
        fallbackList.push({
          numero_semana: i,
          nombre_semana: `Semana ${i}`,
          descripcion: `Semana ${i}`
        });
      }
    }
    return fallbackList;
  }, [semanasConfig, asistencias, effectiveStudent, notas]);

  // Calcular métricas de asistencia basadas en las semanas reales de la carrera
  const attendanceStats = useMemo(() => {
    if (loadingAcademic) {
      return {
        totalSemanas: 0,
        asistenciasCount: 0,
        faltasJustificadas: 0,
        faltasInjustificadas: 0,
        pct: 100,
        perdioDerecho: false
      };
    }
    let totalSemanas = 0;
    let asistenciasCount = 0;
    let faltasJustificadas = 0;
    let faltasInjustificadas = 0;

    activeCareerWeeks.forEach((w) => {
      const sem = Number(w.numero_semana);
      const val =
        asistencias[`asistencia_${sem}`] ??
        asistencias[`semana_${sem}`] ??
        effectiveStudent?.[`Asistencia de la semana ${sem}`] ??
        effectiveStudent?.[`asistencia_${sem}`] ??
        null;

      if (val) {
        totalSemanas++;
        if (val === "Asistio") asistenciasCount++;
        else if (val === "Falta justificada") faltasJustificadas++;
        else if (val === "Falta injustificada") faltasInjustificadas++;
      }
    });

    const pct = totalSemanas > 0 ? Math.round((asistenciasCount / totalSemanas) * 100) : 100;
    const perdioDerecho = faltasInjustificadas >= 2;

    return {
      totalSemanas,
      asistenciasCount,
      faltasJustificadas,
      faltasInjustificadas,
      pct,
      perdioDerecho
    };
  }, [activeCareerWeeks, asistencias, effectiveStudent, loadingAcademic]);

  // =========================================================================
  // CÁLCULOS DINÁMICOS ACADÉMICOS UNIFICADOS (MOTOR CENTRAL ACADÉMICO)
  // =========================================================================
  const academicSummary = useMemo(() => {
    if (loadingAcademic || !effectiveStudent) {
      return {
        total: 0,
        notaOroManuales: 0,
        notaOroPruebas: 0,
        sumaExamenes: 0,
        countManuales: 1,
        countPruebas: 1,
        maxNotaManuales: 0,
        maxNotaPruebas: 0,
        maxExamenesPuntaje: 0,
        maxPuntajeCarrera: 0,
        examenesList: [],
        manualesList: [],
        pruebasList: []
      };
    }
    return calculateStudentAcademicSummary(
      effectiveStudent,
      configPuntajes,
      temario,
      semanasConfig
    );
  }, [effectiveStudent, configPuntajes, temario, semanasConfig, loadingAcademic]);

  const {
    total: totalDinamico,
    notaOroManuales,
    notaOroPruebas,
    sumaExamenes,
    countManuales,
    countPruebas,
    maxNotaManuales,
    maxNotaPruebas,
    maxExamenesPuntaje,
    maxPuntajeCarrera,
    examenesList,
    manualesList,
    pruebasList
  } = academicSummary;

  // 8. Cálculo dinámico de Derecho a Examen por cada examen de la carrera
  const derechoExamenesStatus = useMemo(() => {
    if (loadingAcademic) {
      return {
        totalExams: 0,
        exams: [],
        perdioAlguno: false,
        todosHabilitados: true,
        habilitadosCount: 0,
        titulo: "Verificando..."
      };
    }

    const exams = examenesList && examenesList.length > 0 ? examenesList : [];

    const getAsistVal = (sem) => {
      return (
        asistencias[`asistencia_${sem}`] ??
        asistencias[`semana_${sem}`] ??
        effectiveStudent?.[`Asistencia de la semana ${sem}`] ??
        effectiveStudent?.[`asistencia_${sem}`] ??
        null
      );
    };

    // Agrupar semanas por parcial
    const parcialesMap = new Map();
    if (semanasConfig && semanasConfig.length > 0) {
      semanasConfig.forEach((s) => {
        const pName = (s.parcial || "I Parcial").trim();
        const semNum = Number(s.numero_semana);
        if (!parcialesMap.has(pName)) {
          parcialesMap.set(pName, []);
        }
        if (!parcialesMap.get(pName).includes(semNum)) {
          parcialesMap.get(pName).push(semNum);
        }
      });
    }

    const list = exams.map((ex, idx) => {
      let weeksForExam = [];

      if (ex.parcialName && parcialesMap.has(ex.parcialName)) {
        weeksForExam = parcialesMap.get(ex.parcialName);
      } else {
        const prevExamSem = idx > 0 ? exams[idx - 1].semana : 0;
        weeksForExam = (semanasConfig || [])
          .map((s) => Number(s.numero_semana))
          .filter((s) => s > prevExamSem && s <= ex.semana);
      }

      const faltasInjustificadas = weeksForExam.filter(
        (sem) => getAsistVal(sem) === "Falta injustificada"
      ).length;

      const perdio = faltasInjustificadas >= 2;

      return {
        id: ex.id,
        label: ex.label,
        semana: ex.semana,
        parcialName: ex.parcialName,
        faltasInjustificadas,
        perdio
      };
    });

    if (list.length === 0) {
      let faltasGen = 0;
      activeCareerWeeks.forEach((w) => {
        if (getAsistVal(w.numero_semana) === "Falta injustificada") {
          faltasGen++;
        }
      });
      const perdio = faltasGen >= 2;
      return {
        totalExams: 1,
        exams: [{ id: "exam_1", label: "Examen Parcial", perdio, faltasInjustificadas: faltasGen }],
        perdioAlguno: perdio,
        todosHabilitados: !perdio,
        habilitadosCount: perdio ? 0 : 1,
        titulo: perdio ? "Sin Derecho (2+ Faltas)" : "Habilitado (1 Examen) ✓"
      };
    }

    const perdidos = list.filter((e) => e.perdio);
    const perdioAlguno = perdidos.length > 0;
    const habilitadosCount = list.length - perdidos.length;

    let titulo = "";
    if (!perdioAlguno) {
      titulo = list.length === 1
        ? "Habilitado (1 Examen) ✓"
        : `Habilitado (${list.length} Exámenes) ✓`;
    } else if (habilitadosCount === 0) {
      titulo = `Sin Derecho en todos (${list.length} Exámenes)`;
    } else {
      titulo = `Sin Derecho en ${perdidos.map((p) => p.label).join(", ")}`;
    }

    return {
      totalExams: list.length,
      exams: list,
      perdioAlguno,
      todosHabilitados: !perdioAlguno,
      habilitadosCount,
      titulo
    };
  }, [examenesList, semanasConfig, asistencias, effectiveStudent, activeCareerWeeks, loadingAcademic]);

  return (
    <div
      style={{
        minHeight: "100%",
        background: "transparent",
        color: "#0f172a",
        display: "flex",
        flexDirection: "column"
      }}
    >
      <style>{`
        @keyframes pulseSkeleton {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.35; }
        }
        @keyframes pulseLiveBadge {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.8; transform: scale(1.04); }
        }
        ${activeQuizToTake ? `
          header { display: none !important; }
          main.main-content { padding: 0.5rem 0.5rem !important; }
        ` : ""}

        /* Contenedor Principal */
        .sp-portal-container {
          max-width: ${activeQuizToTake ? "1200px" : "1280px"};
          width: 100%;
          margin: 0 auto;
          padding: 0 0 2rem 0;
          display: flex;
          flex-direction: column;
          gap: 1.25rem;
        }

        /* Banner de Notificación de Prueba en Vivo */
        .sp-live-alert {
          background: linear-gradient(135deg, #fff1f2 0%, #fee2e2 100%);
          border: 2px solid #f87171;
          border-radius: 1rem;
          padding: 1.1rem 1.4rem;
          display: flex;
          align-items: center;
          justify-content: space-between;
          flex-wrap: wrap;
          gap: 1rem;
          box-shadow: 0 8px 20px -4px rgba(225, 29, 72, 0.15);
        }

        /* Hero Banner de Perfil */
        .sp-profile-banner {
          background: #ffffff;
          border-radius: 1rem;
          border: 1px solid #e2e8f0;
          padding: 1.35rem 1.6rem;
          box-shadow: 0 4px 20px -2px rgba(0, 0, 0, 0.03);
        }
        .sp-profile-inner {
          display: flex;
          align-items: center;
          gap: 1.15rem;
        }
        .sp-profile-avatar {
          width: 56px;
          height: 56px;
          border-radius: 1rem;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }
        .sp-profile-name {
          font-size: 1.45rem;
          font-weight: 900;
          color: #0f172a;
          margin: 0;
          line-height: 1.25;
        }
        .sp-profile-tags {
          display: flex;
          align-items: center;
          gap: 0.45rem;
          flex-wrap: wrap;
          margin-top: 0.4rem;
        }
        .sp-tag-pill {
          font-size: 0.8rem;
          font-weight: 700;
          padding: 0.22rem 0.6rem;
          border-radius: 0.45rem;
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          color: #334155;
          display: inline-flex;
          align-items: center;
          gap: 0.35rem;
        }

        /* Grid de Tarjetas de Métricas */
        .sp-metrics-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
          gap: 1.1rem;
        }
        .sp-metric-card {
          background: #ffffff;
          border-radius: 1rem;
          border: 1px solid #e2e8f0;
          padding: 1.15rem 1.35rem;
          display: flex;
          align-items: center;
          gap: 1rem;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.02);
        }
        .sp-metric-icon {
          width: 48px;
          height: 48px;
          border-radius: 0.75rem;
          color: #ffffff;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }
        .sp-metric-val {
          font-size: 1.45rem;
          font-weight: 900;
          color: #0f172a;
          line-height: 1.2;
        }

        /* Barra de Pestañas Moderna (Segmented Control) */
        .sp-tabs-nav {
          display: flex;
          gap: 0.5rem;
          border-bottom: 2px solid #e2e8f0;
          padding-bottom: 0.2rem;
          width: 100%;
          box-sizing: border-box;
        }
        .sp-tab-btn {
          padding: 0.65rem 1.25rem;
          border: none;
          background: transparent;
          font-weight: 800;
          font-size: 0.88rem;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 0.45rem;
          border-radius: 0.6rem 0.6rem 0 0;
          transition: all 0.15s ease;
          box-sizing: border-box;
        }
        .sp-tab-label-desktop {
          display: inline;
        }
        .sp-tab-label-mobile {
          display: none;
        }
        .sp-live-badge {
          background: #dc2626;
          color: #ffffff;
          font-size: 0.68rem;
          font-weight: 900;
          padding: 0.15rem 0.5rem;
          border-radius: 9999px;
          display: inline-flex;
          align-items: center;
          gap: 0.3rem;
          letter-spacing: 0.5px;
          animation: pulseLiveBadge 1.5s infinite;
          flex-shrink: 0;
        }

        /* Auto-altura para respuestas multilínea en móvil y escritorio */
        .sp-quiz-textarea {
          font-family: inherit;
          line-height: 1.45;
          resize: vertical;
          min-height: 56px;
        }
        /* Bloqueo de impresión y capturas por CSS */
        @media print {
          body * {
            display: none !important;
          }
          body::after {
            content: "EVALUACIÓN PROTEGIDA - CAPTURA O IMPRESIÓN PROHIBIDA";
            display: block !important;
            font-size: 24pt !important;
            font-weight: 900 !important;
            color: #000000 !important;
            text-align: center !important;
            margin-top: 40vh !important;
          }
        }
        /* Blackout total cuando la ventana pierde el foco */
        body.anticheat-blackout-on #root {
          filter: brightness(0) !important;
          background: #000000 !important;
          user-select: none !important;
          -webkit-user-select: none !important;
        }

        /* Grids de Contenido */
        .sp-exams-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
          gap: 1rem;
        }
        .sp-exam-card {
          background: #faf5ff;
          border: 1.5px solid #e9d5ff;
          border-radius: 0.75rem;
          padding: 1rem;
          text-align: center;
        }
        .sp-subscores-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
          gap: 1.25rem;
        }
        .sp-asistencia-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
          gap: 0.85rem;
        }
        .sp-quizzes-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
          gap: 1.1rem;
        }
        .sp-card-panel {
          background: #ffffff;
          border-radius: 1rem;
          border: 1px solid #e2e8f0;
          padding: 1.4rem;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.02);
        }

        /* AJUSTES RESPONSIVOS PARA MÓVIL (< 768px): COMPACTO, PROPORCIONAL Y ESTILO ESCRITORIO */
        @media (max-width: 768px) {
          .sp-portal-container {
            gap: 0.65rem !important;
          }

          /* Alerta de prueba en vivo compacta */
          .sp-live-alert {
            padding: 0.65rem 0.85rem !important;
            border-radius: 0.75rem !important;
            flex-direction: column !important;
            align-items: stretch !important;
            gap: 0.5rem !important;
          }
          .sp-live-alert button {
            width: 100% !important;
            justify-content: center !important;
            padding: 0.55rem !important;
            font-size: 0.82rem !important;
          }

          /* Banner de Perfil compacto horizontal */
          .sp-profile-banner {
            padding: 0.65rem 0.8rem !important;
            border-radius: 0.75rem !important;
          }
          .sp-profile-inner {
            gap: 0.65rem !important;
            align-items: center !important;
          }
          .sp-profile-avatar {
            width: 38px !important;
            height: 38px !important;
            border-radius: 0.55rem !important;
          }
          .sp-profile-avatar svg {
            width: 20px !important;
            height: 20px !important;
          }
          .sp-profile-name {
            font-size: 0.98rem !important;
            line-height: 1.2 !important;
          }
          .sp-profile-tags {
            gap: 0.25rem !important;
            margin-top: 0.2rem !important;
          }
          .sp-tag-pill {
            font-size: 0.66rem !important;
            padding: 0.12rem 0.38rem !important;
            border-radius: 0.35rem !important;
          }

          /* 3 Métricas en fila horizontal proporcional, igual que en pantalla grande */
          .sp-metrics-grid {
            grid-template-columns: repeat(3, minmax(0, 1fr)) !important;
            gap: 0.35rem !important;
          }
          .sp-metric-card {
            padding: 0.5rem 0.35rem !important;
            border-radius: 0.65rem !important;
            flex-direction: column !important;
            align-items: center !important;
            text-align: center !important;
            gap: 0.25rem !important;
          }
          .sp-metric-card > div:first-child {
            display: flex !important;
            justify-content: center !important;
          }
          .sp-metric-icon {
            width: 28px !important;
            height: 28px !important;
            border-radius: 0.45rem !important;
          }
          .sp-metric-icon svg {
            width: 14px !important;
            height: 14px !important;
          }
          .sp-metric-card span[style*="uppercase"] {
            font-size: 0.58rem !important;
            display: block !important;
            white-space: nowrap !important;
            overflow: hidden !important;
            text-overflow: ellipsis !important;
          }
          .sp-metric-val {
            font-size: 0.98rem !important;
            line-height: 1.1 !important;
          }
          .sp-metric-val span {
            font-size: 0.62rem !important;
          }
          .sp-metric-breakdown {
            font-size: 0.56rem !important;
            margin-top: 0.15rem !important;
            line-height: 1.15 !important;
          }
          .sp-derecho-title {
            font-size: 0.82rem !important;
          }
          .sp-derecho-badges {
            gap: 0.18rem !important;
            margin-top: 0.2rem !important;
            flex-direction: column !important;
            align-items: center !important;
          }
          .sp-derecho-pill {
            font-size: 0.55rem !important;
            padding: 0.08rem 0.25rem !important;
            white-space: nowrap !important;
          }

          /* Barra de Navegación Segmentada compacta que NUNCA se sale de la pantalla */
          .sp-tabs-nav {
            border-bottom: 1px solid #e2e8f0 !important;
            padding: 0.2rem !important;
            background: #f1f5f9 !important;
            border-radius: 0.65rem !important;
            display: flex !important;
            width: 100% !important;
            max-width: 100% !important;
            box-sizing: border-box !important;
            gap: 0.2rem !important;
            overflow: hidden !important;
          }
          .sp-tab-btn {
            flex: 1 1 0 !important;
            min-width: 0 !important;
            max-width: 33.333% !important;
            box-sizing: border-box !important;
            justify-content: center !important;
            align-items: center !important;
            padding: 0.42rem 0.15rem !important;
            font-size: 0.72rem !important;
            border-radius: 0.5rem !important;
            border-bottom: none !important;
            white-space: nowrap !important;
            gap: 0.2rem !important;
            overflow: hidden !important;
            text-overflow: ellipsis !important;
          }
          .sp-tab-label-desktop {
            display: none !important;
          }
          .sp-tab-label-mobile {
            display: inline !important;
            overflow: hidden !important;
            text-overflow: ellipsis !important;
            white-space: nowrap !important;
          }
          .sp-tab-btn svg {
            width: 14px !important;
            height: 14px !important;
            flex-shrink: 0 !important;
          }
          .sp-tab-btn.active {
            background: #ffffff !important;
            box-shadow: 0 1px 4px rgba(0, 0, 0, 0.08) !important;
          }
          .sp-tab-btn:not(.active) {
            color: #64748b !important;
          }
          .sp-live-badge {
            padding: 0.08rem 0.25rem !important;
            font-size: 0.58rem !important;
            gap: 0.15rem !important;
          }

          /* Paneles de pestañas */
          .sp-tab-content-container {
            gap: 0.65rem !important;
          }
          .sp-card-panel {
            padding: 0.75rem 0.65rem !important;
            border-radius: 0.75rem !important;
          }

          /* Exámenes Parciales en 3 columnas proporcionales */
          .sp-exams-grid {
            grid-template-columns: repeat(3, minmax(0, 1fr)) !important;
            gap: 0.35rem !important;
          }
          .sp-exam-card {
            padding: 0.45rem 0.35rem !important;
            border-radius: 0.55rem !important;
          }
          .sp-exam-card span[style*="uppercase"] {
            font-size: 0.62rem !important;
          }
          .sp-exam-card div[style*="fontSize: 1.5rem"],
          .sp-exam-card div[style*="font-size: 1.5rem"] {
            font-size: 1.05rem !important;
          }
          .sp-exam-card div span {
            font-size: 0.64rem !important;
          }

          /* Manuales y Pruebas en 2 columnas paralelas, IGUAL QUE EN ESCRITORIO */
          .sp-subscores-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
            gap: 0.45rem !important;
          }
          .sp-subscores-card {
            padding: 0.55rem 0.45rem !important;
            border-radius: 0.65rem !important;
          }
          .sp-subscores-header {
            flex-direction: column !important;
            align-items: flex-start !important;
            gap: 0.2rem !important;
            margin-bottom: 0.45rem !important;
          }
          .sp-subscores-header h3 {
            font-size: 0.76rem !important;
          }
          .sp-subscores-header svg {
            width: 14px !important;
            height: 14px !important;
          }
          .sp-subscores-header span {
            font-size: 0.62rem !important;
            padding: 0.1rem 0.35rem !important;
          }
          .sp-subscore-item {
            padding: 0.3rem 0.4rem !important;
            border-radius: 0.4rem !important;
            font-size: 0.7rem !important;
          }
          .sp-subscore-item strong {
            font-size: 0.8rem !important;
          }

          /* Control de Asistencia en cuadrícula compacta de 3 columnas */
          .sp-asistencia-grid {
            grid-template-columns: repeat(3, minmax(0, 1fr)) !important;
            gap: 0.35rem !important;
          }
          .sp-asistencia-item {
            padding: 0.42rem 0.28rem !important;
            border-radius: 0.5rem !important;
            gap: 0.2rem !important;
          }
          .sp-asistencia-name {
            font-size: 0.67rem !important;
            line-height: 1.15 !important;
          }
          .sp-asistencia-badge {
            font-size: 0.67rem !important;
          }
          .sp-asistencia-legend {
            gap: 0.35rem !important;
            font-size: 0.65rem !important;
          }
          .sp-asistencia-banner {
            padding: 0.55rem 0.75rem !important;
            margin-bottom: 0.75rem !important;
            gap: 0.45rem !important;
          }

          /* Módulo de Pruebas Semanales */
          .sp-quizzes-grid {
            grid-template-columns: 1fr !important;
            gap: 0.65rem !important;
          }
          .sp-quiz-card {
            padding: 0.75rem 0.85rem !important;
            border-radius: 0.75rem !important;
            gap: 0.65rem !important;
          }
          .sp-quiz-card h4 {
            font-size: 0.95rem !important;
          }
          .sp-quiz-card p {
            font-size: 0.76rem !important;
          }

          /* Interfaz de Examen Activo en Móvil */
          .sp-quiz-take-card {
            padding: 0.85rem !important;
            border-radius: 0.75rem !important;
            gap: 0.85rem !important;
          }
          .sp-quiz-image-container img {
            max-height: 200px !important;
          }
          .sp-quiz-input {
            font-size: 15px !important;
            padding: 0.65rem 0.75rem !important;
          }
        }
      `}</style>

      {/* =================================================================== */}
      {/* CONTENIDO PRINCIPAL DEL PORTAL                                      */}
      {/* =================================================================== */}
      <div className="sp-portal-container">
        {!activeQuizToTake ? (
          <>
            {/* Banner de Notificación de Prueba en Vivo Habilitada */}
            {anyLiveQuiz && (
              <div className="sp-live-alert">
                <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
                  <div
                    style={{
                      width: "46px",
                      height: "46px",
                      borderRadius: "0.75rem",
                      background: "#ef4444",
                      color: "#ffffff",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      boxShadow: "0 4px 12px rgba(239, 68, 68, 0.35)",
                      flexShrink: 0
                    }}
                  >
                    <Radio size={24} />
                  </div>
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
                      <span
                        style={{
                          background: "#dc2626",
                          color: "#ffffff",
                          fontSize: "0.72rem",
                          fontWeight: 900,
                          padding: "0.15rem 0.55rem",
                          borderRadius: "0.4rem",
                          letterSpacing: "0.5px"
                        }}
                      >
                        🔴 PRUEBA EN VIVO HABILITADA
                      </span>
                      <strong style={{ fontSize: "1.05rem", color: "#991b1b", fontWeight: 900 }}>
                        {anyLiveQuiz.titulo || `Prueba Semanal ${anyLiveQuiz.numero_semana}`} (Semana {anyLiveQuiz.numero_semana})
                      </strong>
                    </div>
                    <p style={{ margin: "0.25rem 0 0", fontSize: "0.86rem", color: "#7f1d1d", fontWeight: 600 }}>
                      Tu docente ha activado la sesión en vivo para tu sección. Ingresa ahora para realizar tu prueba sincronizado con la clase.
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    handleStartQuiz(anyLiveQuiz, liveSessionsMap[anyLiveQuiz.numero_semana]);
                  }}
                  style={{
                    background: "linear-gradient(135deg, #ef4444 0%, #dc2626 100%)",
                    color: "#ffffff",
                    border: "none",
                    padding: "0.75rem 1.4rem",
                    borderRadius: "0.75rem",
                    fontWeight: 900,
                    fontSize: "0.92rem",
                    cursor: "pointer",
                    boxShadow: "0 4px 14px rgba(239, 68, 68, 0.35)",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "0.5rem"
                  }}
                >
                  <PlayCircle size={18} />
                  <span>Ingresar a la Prueba en Vivo →</span>
                </button>
              </div>
            )}

            {/* Banner Superior de Perfil del Estudiante */}
            <div className="sp-profile-banner">
              <div className="sp-profile-inner">
                <div
                  className="sp-profile-avatar"
                  style={{
                    background: theme.gradient,
                    boxShadow: `0 8px 24px -4px ${theme.primary}50`
                  }}
                >
                  <GraduationCap size={32} />
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.65rem", flexWrap: "wrap" }}>
                    <h2 className="sp-profile-name">
                      {effectiveStudent?.nombre_completo || "Estudiante de Histología"}
                    </h2>
                    <span
                      style={{
                        background: "#f1f5f9",
                        color: "#334155",
                        fontFamily: "monospace",
                        fontSize: "0.82rem",
                        fontWeight: 800,
                        padding: "0.18rem 0.55rem",
                        borderRadius: "0.45rem",
                        border: "1px solid #e2e8f0"
                      }}
                    >
                      Cuenta: {effectiveStudent?.numero_cuenta}
                    </span>
                  </div>

                  <div className="sp-profile-tags">
                    <span className="sp-tag-pill" style={{ background: theme.bg, borderColor: theme.border, color: theme.text }}>
                      🎓 <strong>{carreraKey}</strong>
                    </span>
                    <span className="sp-tag-pill">
                      🏛️ Sec: <strong>{seccion?.codigo || "Sin sección"}</strong>
                    </span>
                    {seccion?.dia && (
                      <span className="sp-tag-pill">
                        📅 {seccion.dia} {seccion.hora_inicio} - {seccion.hora_fin}
                      </span>
                    )}
                    {seccion?.coordinador && (
                      <span className="sp-tag-pill">
                        👨‍🏫 Coord: {seccion.coordinador}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Tarjetas de Métricas Principales */}
            <div className="sp-metrics-grid">
              {/* Métrica 1: Nota Total Acumulada */}
              <div className="sp-metric-card">
                <div
                  className="sp-metric-icon"
                  style={{
                    background: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
                    boxShadow: "0 4px 12px rgba(16, 185, 129, 0.25)"
                  }}
                >
                  <Award size={24} />
                </div>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <span style={{ fontSize: "0.74rem", fontWeight: 800, color: "#64748b", textTransform: "uppercase" }}>
                    Total Acumulado
                  </span>
                  {loadingAcademic ? (
                    <div style={{ padding: "0.2rem 0" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                        <div style={{ width: "70px", height: "24px", background: "#e2e8f0", borderRadius: "6px", animation: "pulseSkeleton 1.5s infinite" }} />
                        <span style={{ fontSize: "0.85rem", color: "#94a3b8", fontWeight: 700 }}>pts</span>
                      </div>
                      <div style={{ fontSize: "0.72rem", color: "#94a3b8", marginTop: "0.25rem" }}>
                        Cargando calificaciones...
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="sp-metric-val">
                        {totalDinamico}{" "}
                        <span style={{ fontSize: "0.85rem", color: "#64748b", fontWeight: 700 }}>
                          / {maxPuntajeCarrera > 0 ? maxPuntajeCarrera : "—"} pts
                        </span>
                      </div>
                      <div className="sp-metric-breakdown" style={{ fontSize: "0.72rem", color: "#64748b", fontWeight: 600, marginTop: "0.25rem" }}>
                        Manuales: <strong style={{ color: "#0284c7" }}>{notaOroManuales}</strong> • Pruebas: <strong style={{ color: "#16a34a" }}>{notaOroPruebas}</strong> • Exám: <strong style={{ color: "#7c3aed" }}>{sumaExamenes}</strong>
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Métrica 2: Estatus Derecho a Examen */}
              <div className="sp-metric-card">
                <div
                  className="sp-metric-icon"
                  style={{
                    background: derechoExamenesStatus.perdioAlguno
                      ? "linear-gradient(135deg, #ef4444 0%, #dc2626 100%)"
                      : "linear-gradient(135deg, #0284c7 0%, #0369a1 100%)",
                    boxShadow: derechoExamenesStatus.perdioAlguno
                      ? "0 4px 12px rgba(239, 68, 68, 0.25)"
                      : "0 4px 12px rgba(2, 132, 199, 0.25)"
                  }}
                >
                  {derechoExamenesStatus.perdioAlguno ? <ShieldAlert size={24} /> : <ShieldCheck size={24} />}
                </div>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <span style={{ fontSize: "0.74rem", fontWeight: 800, color: "#64748b", textTransform: "uppercase" }}>
                    Derecho a Examen
                  </span>
                  {loadingAcademic ? (
                    <div style={{ padding: "0.2rem 0" }}>
                      <div style={{ width: "120px", height: "20px", background: "#e2e8f0", borderRadius: "6px", animation: "pulseSkeleton 1.5s infinite" }} />
                      <div style={{ fontSize: "0.72rem", color: "#94a3b8", marginTop: "0.25rem" }}>
                        Verificando asistencia...
                      </div>
                    </div>
                  ) : (
                    <>
                      <div
                        className="sp-metric-val sp-derecho-title"
                        style={{
                          fontSize: "1.05rem",
                          fontWeight: 900,
                          color: derechoExamenesStatus.perdioAlguno ? "#dc2626" : "#0284c7",
                          lineHeight: 1.25
                        }}
                      >
                        {derechoExamenesStatus.titulo}
                      </div>
                      {/* Desglose por examen */}
                      <div className="sp-derecho-badges" style={{ display: "flex", flexWrap: "wrap", gap: "0.3rem", marginTop: "0.35rem" }}>
                        {derechoExamenesStatus.exams.map((dex) => (
                          <span
                            key={dex.id}
                            className="sp-derecho-pill"
                            style={{
                              fontSize: "0.68rem",
                              fontWeight: 800,
                              padding: "0.12rem 0.45rem",
                              borderRadius: "0.35rem",
                              background: dex.perdio ? "#fee2e2" : "#f0fdf4",
                              color: dex.perdio ? "#b91c1c" : "#15803d",
                              border: dex.perdio ? "1px solid #fca5a5" : "1px solid #bbf7d0"
                            }}
                          >
                            {dex.label}: {dex.perdio ? `🚨 SDE (${dex.faltasInjustificadas} faltas)` : "✓ Habilitado"}
                          </span>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Métrica 3: Asistencias */}
              <div className="sp-metric-card">
                <div
                  className="sp-metric-icon"
                  style={{
                    background: "linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)",
                    boxShadow: "0 4px 12px rgba(139, 92, 246, 0.25)"
                  }}
                >
                  <CalendarCheck size={24} />
                </div>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <span style={{ fontSize: "0.74rem", fontWeight: 800, color: "#64748b", textTransform: "uppercase" }}>
                    Asistencia
                  </span>
                  {loadingAcademic ? (
                    <div style={{ padding: "0.2rem 0" }}>
                      <div style={{ width: "90px", height: "22px", background: "#e2e8f0", borderRadius: "6px", animation: "pulseSkeleton 1.5s infinite" }} />
                      <div style={{ fontSize: "0.72rem", color: "#94a3b8", marginTop: "0.25rem" }}>
                        Calculando semanas...
                      </div>
                    </div>
                  ) : (
                    <div className="sp-metric-val">
                      {attendanceStats.asistenciasCount}{" "}
                      <span style={{ fontSize: "0.85rem", color: "#64748b", fontWeight: 700 }}>
                        de {attendanceStats.totalSemanas} sem ({attendanceStats.pct}%)
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* AVISO DESTACADO DE PRUEBA EN VIVO TIPO KAHOOT */}
            {activeLiveBannerSession && !existingSubmissions[activeLiveBannerSession.numero_semana] && !activeQuizToTake && (
              <div
                className="animate-fade-in"
                style={{
                  background: "linear-gradient(135deg, #16a34a 0%, #15803d 100%)",
                  borderRadius: "1rem",
                  padding: "1.25rem 1.75rem",
                  color: "#ffffff",
                  boxShadow: "0 10px 25px -5px rgba(22, 163, 74, 0.45)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  flexWrap: "wrap",
                  gap: "1.25rem",
                  border: "2px solid #86efac",
                  marginBottom: "1rem"
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
                  <div
                    style={{
                      width: "52px",
                      height: "52px",
                      borderRadius: "50%",
                      background: "rgba(255, 255, 255, 0.2)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0
                    }}
                  >
                    <Radio size={28} className="animate-pulse" color="#ffffff" />
                  </div>
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                      <span
                        style={{
                          background: "#ffffff",
                          color: "#15803d",
                          fontSize: "0.72rem",
                          fontWeight: 900,
                          padding: "0.15rem 0.55rem",
                          borderRadius: "9999px",
                          letterSpacing: "0.5px"
                        }}
                      >
                        🔴 EN DIRECTO
                      </span>
                      <span style={{ fontSize: "0.85rem", fontWeight: 800, opacity: 0.95 }}>
                        Semana {activeLiveBannerSession.numero_semana}
                      </span>
                    </div>
                    <h3 style={{ margin: "0.25rem 0 0", fontSize: "1.2rem", fontWeight: 900, letterSpacing: "-0.01em" }}>
                      ¡Prueba en vivo activa! Sala de espera abierta
                    </h3>
                    <p style={{ margin: "0.2rem 0 0", fontSize: "0.85rem", opacity: 0.95 }}>
                      Tu docente habilitó la evaluación en directo. Entra ahora para sincronizarte antes de la Pregunta 1.
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={async () => {
                    let targetQ = (onlineQuizzes || []).find(
                      (q) => Number(q.numero_semana) === Number(activeLiveBannerSession.numero_semana)
                    );
                    if (!targetQ) {
                      let secId = effectiveStudent?.seccion_id || effectiveStudent?.seccion?.id;
                      if (!secId) secId = await resolveStudentSectionId();
                      if (secId) {
                        try {
                          const qRes = await api.pruebas.getBySemana(secId, activeLiveBannerSession.numero_semana);
                          if (qRes?.data) targetQ = qRes.data;
                        } catch (_) {}
                      }
                    }
                    if (targetQ) {
                      handleStartQuiz(targetQ, activeLiveBannerSession);
                    } else {
                      setActiveTab("pruebas");
                      loadStudentQuizzes();
                    }
                  }}
                  style={{
                    padding: "0.8rem 1.75rem",
                    borderRadius: "0.75rem",
                    border: "none",
                    background: "#ffffff",
                    color: "#15803d",
                    fontSize: "0.95rem",
                    fontWeight: 900,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: "0.6rem",
                    boxShadow: "0 4px 15px rgba(0, 0, 0, 0.2)",
                    whiteSpace: "nowrap"
                  }}
                >
                  <Play size={18} />
                  <span>Entrar a la Prueba en Vivo</span>
                </button>
              </div>
            )}

            {/* Pestañas de Navegación del Portal */}
            <div className="sp-tabs-nav">
              <button
                type="button"
                onClick={() => setActiveTab("calificaciones")}
                className={`sp-tab-btn ${activeTab === "calificaciones" ? "active" : ""}`}
                style={{
                  color: activeTab === "calificaciones" ? theme.primary : "#64748b",
                  borderBottom: activeTab === "calificaciones" ? `3px solid ${theme.primary}` : "3px solid transparent"
                }}
              >
                <Award size={16} />
                <span className="sp-tab-label-desktop">Mis Calificaciones</span>
                <span className="sp-tab-label-mobile">Notas</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab("asistencia")}
                className={`sp-tab-btn ${activeTab === "asistencia" ? "active" : ""}`}
                style={{
                  color: activeTab === "asistencia" ? theme.primary : "#64748b",
                  borderBottom: activeTab === "asistencia" ? `3px solid ${theme.primary}` : "3px solid transparent"
                }}
              >
                <CalendarCheck size={16} />
                <span className="sp-tab-label-desktop">Control de Asistencia</span>
                <span className="sp-tab-label-mobile">Asistencia</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setActiveTab("pruebas");
                  setActiveQuizToTake(null);
                  setReviewingSubmission(null);
                }}
                className={`sp-tab-btn ${activeTab === "pruebas" ? "active" : ""}`}
                style={{
                  color: activeTab === "pruebas" ? theme.primary : "#64748b",
                  borderBottom: activeTab === "pruebas" ? `3px solid ${theme.primary}` : "3px solid transparent"
                }}
              >
                <HelpCircle size={16} />
                <span className="sp-tab-label-desktop">Pruebas Semanales</span>
                <span className="sp-tab-label-mobile">Pruebas</span>
                {anyLiveQuiz && (
                  <span className="sp-live-badge">
                    <span style={{ width: "5px", height: "5px", borderRadius: "50%", background: "#ffffff" }} />
                    <span className="sp-tab-label-desktop">EN VIVO</span>
                  </span>
                )}
              </button>
            </div>

        {/* =================================================================== */}
        {/* PESTAÑA A: CALIFICACIONES DETALLADAS                                */}
        {/* =================================================================== */}
        {activeTab === "calificaciones" && (
          <div className="sp-tab-content-container" style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
            {/* 1. Exámenes Parciales */}
            <div
              className="sp-card-panel"
              style={{
                background: "#ffffff",
                borderRadius: "1rem",
                border: "1px solid #e2e8f0",
                padding: "1.5rem",
                boxShadow: "0 2px 8px rgba(0, 0, 0, 0.02)"
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "0.5rem", marginBottom: "1rem" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                  <GraduationCap size={20} color="#7c3aed" />
                  <h3 style={{ fontSize: "1.05rem", fontWeight: 800, color: "#0f172a", margin: 0 }}>
                    Exámenes Parciales
                  </h3>
                </div>
                <span style={{ fontSize: "0.78rem", fontWeight: 800, background: "#f3e8ff", color: "#7e22ce", padding: "0.25rem 0.65rem", borderRadius: "9999px", border: "1px solid #e9d5ff" }}>
                  Suma Exámenes: {loadingAcademic ? "..." : `${sumaExamenes} / ${maxExamenesPuntaje > 0 ? maxExamenesPuntaje : "—"} pts`}
                </span>
              </div>

              {loadingAcademic ? (
                <div style={{ display: "flex", flexWrap: "wrap", gap: "1rem" }}>
                  {[1, 2, 3].map((idx) => (
                    <div
                      key={idx}
                      style={{
                        width: "220px",
                        height: "90px",
                        background: "#faf5ff",
                        border: "1.5px solid #e9d5ff",
                        borderRadius: "0.75rem",
                        padding: "1rem",
                        display: "flex",
                        flexDirection: "column",
                        gap: "0.5rem",
                        animation: "pulseSkeleton 1.5s infinite"
                      }}
                    >
                      <div style={{ width: "65%", height: "14px", background: "#e9d5ff", borderRadius: "4px" }} />
                      <div style={{ width: "45%", height: "24px", background: "#d8b4fe", borderRadius: "4px" }} />
                    </div>
                  ))}
                </div>
              ) : examenesList.length === 0 ? (
                <div style={{ padding: "1.5rem", textAlign: "center", color: "#94a3b8", fontSize: "0.82rem" }}>
                  No hay semanas de examen programadas en el calendario de esta carrera.
                </div>
              ) : (
                <div className="sp-exams-grid">
                  {examenesList.map((ex) => (
                    <div
                      key={ex.id}
                      className="sp-exam-card"
                    >
                      <span style={{ fontSize: "0.78rem", fontWeight: 900, color: "#7e22ce", textTransform: "uppercase", display: "block" }}>
                        {ex.label}
                      </span>
                      <div style={{ fontSize: "1.5rem", fontWeight: 900, color: "#581c87", marginTop: "0.25rem" }}>
                        {formatGrade(ex.nota)}{" "}
                        {ex.ptsMax > 0 && (
                          <span style={{ fontSize: "0.82rem", color: "#9333ea", fontWeight: 700 }}>
                            / {ex.ptsMax} pts
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 2. Manuales y Pruebas Semanales en 2 Columnas */}
            <div className="sp-subscores-grid">
              {/* Manuales de Laboratorio */}
              <div
                className="sp-card-panel sp-subscores-card"
                style={{
                  background: "#ffffff",
                  borderRadius: "1rem",
                  border: "1px solid #e2e8f0",
                  padding: "1.25rem",
                  boxShadow: "0 2px 8px rgba(0, 0, 0, 0.02)"
                }}
              >
                <div className="sp-subscores-header" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "0.5rem", marginBottom: "0.85rem" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    <BookOpen size={18} color="#0284c7" />
                    <h3 style={{ fontSize: "0.95rem", fontWeight: 800, color: "#0f172a", margin: 0 }}>
                      Notas de Manuales
                    </h3>
                  </div>
                  <span style={{ fontSize: "0.76rem", fontWeight: 800, background: "#e0f2fe", color: "#0369a1", padding: "0.2rem 0.55rem", borderRadius: "9999px", border: "1px solid #bae6fd" }}>
                    Nota Oro: {loadingAcademic ? "..." : `${notaOroManuales} / ${maxNotaManuales > 0 ? maxNotaManuales : "—"} pts`}
                  </span>
                </div>

                {loadingAcademic ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.45rem" }}>
                    {[1, 2, 3, 4].map((idx) => (
                      <div
                        key={idx}
                        style={{
                          height: "38px",
                          borderRadius: "0.5rem",
                          background: "#f0f9ff",
                          border: "1px solid #bae6fd",
                          animation: "pulseSkeleton 1.5s infinite"
                        }}
                      />
                    ))}
                  </div>
                ) : manualesList.length === 0 ? (
                  <div style={{ padding: "1.5rem", textAlign: "center", color: "#94a3b8", fontSize: "0.82rem" }}>
                    No hay calificaciones de manuales registradas aún.
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.45rem" }}>
                    {manualesList.map((m) => (
                      <div
                        key={m.key}
                        className="sp-subscore-item"
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          padding: "0.5rem 0.75rem",
                          borderRadius: "0.5rem",
                          background: "#f0f9ff",
                          border: "1px solid #bae6fd",
                          fontSize: "0.82rem"
                        }}
                      >
                        <span style={{ fontWeight: 700, color: "#0369a1" }}>{m.label}</span>
                        <strong style={{ fontSize: "0.95rem", color: "#0c4a6e" }}>{formatGrade(m.nota)}</strong>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Pruebas Semanales Cortas */}
              <div
                className="sp-card-panel sp-subscores-card"
                style={{
                  background: "#ffffff",
                  borderRadius: "1rem",
                  border: "1px solid #e2e8f0",
                  padding: "1.25rem",
                  boxShadow: "0 2px 8px rgba(0, 0, 0, 0.02)"
                }}
              >
                <div className="sp-subscores-header" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "0.5rem", marginBottom: "0.85rem" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    <FileEdit size={18} color="#16a34a" />
                    <h3 style={{ fontSize: "0.95rem", fontWeight: 800, color: "#0f172a", margin: 0 }}>
                      Pruebas Semanales
                    </h3>
                  </div>
                  <span style={{ fontSize: "0.76rem", fontWeight: 800, background: "#dcfce7", color: "#15803d", padding: "0.2rem 0.55rem", borderRadius: "9999px", border: "1px solid #bbf7d0" }}>
                    Nota Oro: {loadingAcademic ? "..." : `${notaOroPruebas} / ${maxNotaPruebas > 0 ? maxNotaPruebas : "—"} pts`}
                  </span>
                </div>

                {loadingAcademic ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.45rem" }}>
                    {[1, 2, 3, 4].map((idx) => (
                      <div
                        key={idx}
                        style={{
                          height: "38px",
                          borderRadius: "0.5rem",
                          background: "#f0fdf4",
                          border: "1px solid #bbf7d0",
                          animation: "pulseSkeleton 1.5s infinite"
                        }}
                      />
                    ))}
                  </div>
                ) : pruebasList.length === 0 ? (
                  <div style={{ padding: "1.5rem", textAlign: "center", color: "#94a3b8", fontSize: "0.82rem" }}>
                    No hay calificaciones de pruebas registradas aún.
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.45rem" }}>
                    {pruebasList.map((p) => (
                      <div
                        key={p.key}
                        className="sp-subscore-item"
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          padding: "0.5rem 0.75rem",
                          borderRadius: "0.5rem",
                          background: "#f0fdf4",
                          border: "1px solid #bbf7d0",
                          fontSize: "0.82rem"
                        }}
                      >
                        <span style={{ fontWeight: 700, color: "#15803d" }}>{p.label}</span>
                        <strong style={{ fontSize: "0.95rem", color: "#14532d" }}>{formatGrade(p.nota)}</strong>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* =================================================================== */}
        {/* PESTAÑA B: CONTROL DE ASISTENCIA                                    */}
        {/* =================================================================== */}
        {activeTab === "asistencia" && (
          <div
            className="sp-card-panel"
            style={{
              background: "#ffffff",
              borderRadius: "1rem",
              border: "1px solid #e2e8f0",
              padding: "1.5rem",
              boxShadow: "0 2px 8px rgba(0, 0, 0, 0.02)"
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1rem", flexWrap: "wrap", gap: "0.75rem" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <CalendarCheck size={20} color="#0284c7" />
                <h3 style={{ fontSize: "1.05rem", fontWeight: 800, color: "#0f172a", margin: 0 }}>
                  Historial de Asistencias por Semana
                </h3>
              </div>

              <div className="sp-asistencia-legend" style={{ display: "flex", gap: "0.75rem", fontSize: "0.76rem", fontWeight: 700 }}>
                <span style={{ color: "#16a34a" }}>✓ Asistió ({attendanceStats.asistenciasCount})</span>
                <span style={{ color: "#d97706" }}>FJ Falta Justificada ({attendanceStats.faltasJustificadas})</span>
                <span style={{ color: "#dc2626" }}>FI Falta Injustificada ({attendanceStats.faltasInjustificadas})</span>
              </div>
            </div>

            {/* Banner de Estado de Derecho por Examen */}
            <div
              className="sp-asistencia-banner"
              style={{
                background: derechoExamenesStatus.perdioAlguno ? "#fef2f2" : "#f0fdf4",
                border: `1.5px solid ${derechoExamenesStatus.perdioAlguno ? "#f87171" : "#86efac"}`,
                borderRadius: "0.75rem",
                padding: "0.85rem 1.25rem",
                marginBottom: "1.25rem",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                flexWrap: "wrap",
                gap: "0.75rem"
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "0.65rem" }}>
                {derechoExamenesStatus.perdioAlguno ? (
                  <ShieldAlert size={20} color="#dc2626" />
                ) : (
                  <ShieldCheck size={20} color="#16a34a" />
                )}
                <div>
                  <div style={{ fontSize: "0.86rem", fontWeight: 800, color: derechoExamenesStatus.perdioAlguno ? "#991b1b" : "#166534" }}>
                    Estado de Derecho: {derechoExamenesStatus.titulo}
                  </div>
                  <div style={{ fontSize: "0.74rem", color: derechoExamenesStatus.perdioAlguno ? "#b91c1c" : "#15803d" }}>
                    {derechoExamenesStatus.perdioAlguno
                      ? "Se pierde el derecho a examen al acumular 2 o más faltas injustificadas en el periodo evaluado."
                      : `El estudiante cumple con la asistencia reglamentaria para los ${derechoExamenesStatus.totalExams} exámenes del periodo.`}
                  </div>
                </div>
              </div>
              <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap" }}>
                {derechoExamenesStatus.exams.map((dex) => (
                  <span
                    key={dex.id}
                    style={{
                      fontSize: "0.74rem",
                      fontWeight: 800,
                      padding: "0.2rem 0.6rem",
                      borderRadius: "0.4rem",
                      background: dex.perdio ? "#fee2e2" : "#ffffff",
                      color: dex.perdio ? "#b91c1c" : "#15803d",
                      border: dex.perdio ? "1px solid #fca5a5" : "1px solid #bbf7d0"
                    }}
                  >
                    {dex.label}: {dex.perdio ? `🚨 Sin Derecho (${dex.faltasInjustificadas} faltas)` : "✓ Habilitado"}
                  </span>
                ))}
              </div>
            </div>

            {activeCareerWeeks.length === 0 ? (
              <div style={{ padding: "1.5rem", textAlign: "center", color: "#94a3b8", fontSize: "0.82rem" }}>
                No hay semanas académicas configuradas para esta carrera.
              </div>
            ) : (
              <div className="sp-asistencia-grid">
                {activeCareerWeeks.map((w) => {
                  const sem = Number(w.numero_semana);
                  const val =
                    asistencias[`asistencia_${sem}`] ??
                    asistencias[`semana_${sem}`] ??
                    student?.[`Asistencia de la semana ${sem}`] ??
                    student?.[`asistencia_${sem}`] ??
                    null;

                  let bg = "#f8fafc";
                  let border = "#e2e8f0";
                  let textColor = "#64748b";
                  let badgeText = "Sin registro";

                  if (val === "Asistio") {
                    bg = "#f0fdf4";
                    border = "#86efac";
                    textColor = "#15803d";
                    badgeText = "Asistió ✓";
                  } else if (val === "Falta justificada") {
                    bg = "#fffbeb";
                    border = "#fde68a";
                    textColor = "#b45309";
                    badgeText = "Falta Justificada";
                  } else if (val === "Falta injustificada") {
                    bg = "#fef2f2";
                    border = "#fecdd3";
                    textColor = "#dc2626";
                    badgeText = "Falta Injustificada ✗";
                  }

                  const displayName = getWeekDisplayName(w);

                  return (
                    <div
                      key={`asist_sem_${sem}`}
                      className="sp-asistencia-item"
                      style={{
                        background: bg,
                        border: `1.5px solid ${border}`,
                        borderRadius: "0.75rem",
                        padding: "0.85rem",
                        textAlign: "center",
                        display: "flex",
                        flexDirection: "column",
                        gap: "0.35rem"
                      }}
                    >
                      <span className="sp-asistencia-name" style={{ fontSize: "0.78rem", fontWeight: 800, color: "#1e293b", lineHeight: 1.25 }}>
                        {displayName}
                      </span>
                      <strong className="sp-asistencia-badge" style={{ fontSize: "0.82rem", color: textColor, fontWeight: 800 }}>
                        {badgeText}
                      </strong>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* =================================================================== */}
        {/* PESTAÑA C: PRUEBAS SEMANALES EN LÍNEA                               */}
        {/* =================================================================== */}
        {activeTab === "pruebas" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
            {reviewingSubmission ? (
              /* CASO 2: REVISIÓN DE COMPROBANTE Y RESPUESTAS ENTREGADAS */
              <div
                className="animate-fade-in"
                style={{
                  background: "#ffffff",
                  borderRadius: "1rem",
                  border: "1px solid #e2e8f0",
                  padding: "1.75rem",
                  display: "flex",
                  flexDirection: "column",
                  gap: "1.5rem"
                }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1.5px solid #f1f5f9", paddingBottom: "1rem" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                    <button
                      type="button"
                      onClick={() => setReviewingSubmission(null)}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        width: "36px",
                        height: "36px",
                        borderRadius: "0.55rem",
                        border: "1.5px solid #cbd5e1",
                        background: "#ffffff",
                        color: "#475569",
                        cursor: "pointer"
                      }}
                    >
                      <ArrowLeft size={18} />
                    </button>
                    <div>
                      <span style={{ fontSize: "0.76rem", fontWeight: 800, color: "#16a34a", textTransform: "uppercase" }}>
                        Comprobante de Entrega • Semana {reviewingSubmission.quiz.numero_semana}
                      </span>
                      <h3 style={{ margin: "0.15rem 0 0", fontSize: "1.25rem", fontWeight: 900, color: "#0f172a" }}>
                        {reviewingSubmission.quiz.titulo}
                      </h3>
                    </div>
                  </div>

                  <div
                    style={{
                      padding: "0.5rem 1rem",
                      borderRadius: "0.6rem",
                      background: reviewingSubmission.submission.estado === "calificado" ? "#ecfdf5" : "#fffbeb",
                      border: reviewingSubmission.submission.estado === "calificado" ? "1.5px solid #86efac" : "1.5px solid #fde68a",
                      color: reviewingSubmission.submission.estado === "calificado" ? "#15803d" : "#b45309",
                      fontWeight: 900,
                      fontSize: "0.9rem"
                    }}
                  >
                    {reviewingSubmission.submission.estado === "calificado"
                      ? `Nota Obtenida: ${Number(reviewingSubmission.submission.nota_obtenida).toFixed(3)} / 5.000 pts`
                      : "Estado: Entregada (En espera de calificación docente)"}
                  </div>
                </div>

                {reviewingSubmission.submission.comentarios && (
                  <div style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", padding: "0.85rem 1.1rem", borderRadius: "0.65rem", fontSize: "0.85rem", color: "#166534" }}>
                    💬 <strong>Comentarios del Docente:</strong> {reviewingSubmission.submission.comentarios}
                  </div>
                )}

                {/* Respuestas registradas */}
                <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
                  {(reviewingSubmission.quiz.preguntas || []).map((pregunta, qIdx) => (
                    <div
                      key={pregunta.id}
                      style={{
                        padding: "1.25rem",
                        borderRadius: "0.85rem",
                        border: "1px solid #e2e8f0",
                        background: "#f8fafc",
                        display: "flex",
                        flexDirection: "column",
                        gap: "0.85rem"
                      }}
                    >
                      <div style={{ fontSize: "0.92rem", fontWeight: 800, color: "#0f172a" }}>
                        {pregunta.numero || qIdx + 1}. {pregunta.enunciado || (pregunta.es_bonus ? "⭐ Reactivo Bonus" : `Pregunta ${pregunta.numero || qIdx + 1}`)}
                      </div>

                      {pregunta.imagen_url && (
                        <div style={{ textAlign: "center" }}>
                          <img
                            src={pregunta.imagen_url}
                            alt="Micrografía"
                            style={{ maxHeight: "200px", borderRadius: "0.5rem", border: "1px solid #cbd5e1" }}
                          />
                        </div>
                      )}

                      <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                        {(() => {
                          const studentRespuestas =
                            typeof reviewingSubmission.submission.respuestas === "string"
                              ? JSON.parse(reviewingSubmission.submission.respuestas || "{}")
                              : (reviewingSubmission.submission.respuestas || {});

                          const evaluaciones =
                            reviewingSubmission.submission.evaluaciones_incisos ||
                            reviewingSubmission.submission.auditoria?.evaluaciones_incisos ||
                            {};

                          const isGraded = reviewingSubmission.submission.estado === "calificado";

                          if (!pregunta.items || pregunta.items.length === 0) {
                            const directAnswer =
                              studentRespuestas?.[pregunta.id]?.respuesta ??
                              studentRespuestas?.[pregunta.id] ??
                              null;
                            const evalItem = evaluaciones[`${pregunta.id}___direct`];

                            return (
                              <div style={{ background: "#ffffff", padding: "0.85rem 1rem", borderRadius: "0.55rem", border: "1px solid #e2e8f0", display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "0.4rem" }}>
                                  <strong style={{ fontSize: "0.82rem", color: "#475569" }}>
                                    Respuesta:
                                  </strong>
                                  {isGraded && evalItem && (
                                    <span
                                      style={{
                                        fontSize: "0.74rem",
                                        fontWeight: 800,
                                        padding: "0.15rem 0.5rem",
                                        borderRadius: "0.35rem",
                                        background: evalItem.estado === "buena" ? "#dcfce7" : evalItem.estado === "regular" ? "#fef3c7" : "#fee2e2",
                                        color: evalItem.estado === "buena" ? "#15803d" : evalItem.estado === "regular" ? "#b45309" : "#dc2626",
                                        border: `1px solid ${evalItem.estado === "buena" ? "#86efac" : evalItem.estado === "regular" ? "#fde68a" : "#fca5a5"}`
                                      }}
                                    >
                                      {evalItem.estado === "buena" ? `✓ Correcta (+${Number(evalItem.puntos_obtenidos || 0).toFixed(3)} pts)` : evalItem.estado === "regular" ? `½ Regular (+${Number(evalItem.puntos_obtenidos || 0).toFixed(3)} pts)` : "✗ Incorrecta (0 pts)"}
                                    </span>
                                  )}
                                </div>
                                <div style={{ fontSize: "0.88rem", fontWeight: 700, color: "#0f172a" }}>
                                  {directAnswer || <span style={{ color: "#94a3b8", fontStyle: "italic" }}>Sin respuesta</span>}
                                </div>
                              </div>
                            );
                          }

                          return pregunta.items.map((item, itemIdx) => {
                            const userAns =
                              studentRespuestas?.[pregunta.id]?.[item.id] ??
                              studentRespuestas?.[item.id] ??
                              studentRespuestas?.[pregunta.id] ??
                              null;
                            const itemLabel = item.instruccion || item.etiqueta || `Inciso ${itemIdx + 1}`;
                            const evalItem = evaluaciones[`${pregunta.id}___${item.id}`];

                            return (
                              <div key={item.id} style={{ background: "#ffffff", padding: "0.85rem 1rem", borderRadius: "0.55rem", border: "1px solid #e2e8f0", display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "0.4rem" }}>
                                  <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                                    <strong style={{ fontSize: "0.82rem", color: "#334155" }}>
                                      {String.fromCharCode(97 + itemIdx)}) {itemLabel}:
                                    </strong>
                                    {item.puntos !== undefined && (
                                      <span style={{ fontSize: "0.72rem", fontWeight: 800, color: "#0369a1", background: "#f0f9ff", padding: "0.1rem 0.4rem", borderRadius: "0.3rem", border: "1px solid #bae6fd" }}>
                                        {item.puntos} pt(s)
                                      </span>
                                    )}
                                  </div>

                                  {isGraded && evalItem && (
                                    <span
                                      style={{
                                        fontSize: "0.74rem",
                                        fontWeight: 800,
                                        padding: "0.15rem 0.5rem",
                                        borderRadius: "0.35rem",
                                        background: evalItem.estado === "buena" ? "#dcfce7" : evalItem.estado === "regular" ? "#fef3c7" : "#fee2e2",
                                        color: evalItem.estado === "buena" ? "#15803d" : evalItem.estado === "regular" ? "#b45309" : "#dc2626",
                                        border: `1px solid ${evalItem.estado === "buena" ? "#86efac" : evalItem.estado === "regular" ? "#fde68a" : "#fca5a5"}`
                                      }}
                                    >
                                      {evalItem.estado === "buena" ? `✓ Correcta (+${Number(evalItem.puntos_obtenidos || 0).toFixed(3)} pts)` : evalItem.estado === "regular" ? `½ Regular (+${Number(evalItem.puntos_obtenidos || 0).toFixed(3)} pts)` : "✗ Incorrecta (0 pts)"}
                                    </span>
                                  )}
                                </div>

                                {item.tipo === "texto_corto" ? (
                                  <div style={{ fontSize: "0.88rem", fontWeight: 700, color: "#0f172a" }}>
                                    {typeof userAns === "string" && userAns.trim() ? (
                                      userAns
                                    ) : (
                                      <span style={{ color: "#94a3b8", fontStyle: "italic" }}>Sin respuesta</span>
                                    )}
                                  </div>
                                ) : (
                                  <div style={{ display: "flex", flexDirection: "column", gap: "0.3rem" }}>
                                    {Array.from({ length: item.cantidad || 3 }).map((_, rIdx) => {
                                      const rowVal = Array.isArray(userAns) ? userAns[rIdx] : "";
                                      return (
                                        <div key={rIdx} style={{ fontSize: "0.84rem", color: "#0f172a" }}>
                                          <strong style={{ color: "#64748b" }}>{rIdx + 1}.</strong>{" "}
                                          {rowVal && String(rowVal).trim() ? (
                                            rowVal
                                          ) : (
                                            <span style={{ color: "#94a3b8", fontStyle: "italic" }}>Sin respuesta</span>
                                          )}
                                        </div>
                                      );
                                    })}
                                  </div>
                                )}
                              </div>
                            );
                          });
                        })()}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              /* CASO 3: CATÁLOGO DE PRUEBAS SEMANALES DISPONIBLES */
              <>
                <div
                  style={{
                    background: "linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%)",
                    border: "1.5px solid #bae6fd",
                    borderRadius: "1rem",
                    padding: "1.25rem 1.5rem",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    flexWrap: "wrap",
                    gap: "1rem"
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "0.85rem" }}>
                    <div
                      style={{
                        width: "42px",
                        height: "42px",
                        borderRadius: "0.75rem",
                        background: "#0284c7",
                        color: "#ffffff",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center"
                      }}
                    >
                      <HelpCircle size={22} />
                    </div>
                    <div>
                      <h3 style={{ margin: 0, fontSize: "1.05rem", fontWeight: 900, color: "#0369a1" }}>
                        Módulo de Pruebas Semanales de Laboratorio
                      </h3>
                      <p style={{ margin: "0.15rem 0 0", fontSize: "0.82rem", color: "#0284c7" }}>
                        Aquí puedes realizar tus pruebas prácticas de micrografías histológicas y consultar tus calificaciones oficiales.
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={loadStudentQuizzes}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "0.4rem",
                      padding: "0.45rem 0.85rem",
                      borderRadius: "0.55rem",
                      border: "1px solid #bae6fd",
                      background: "#ffffff",
                      color: "#0369a1",
                      fontSize: "0.8rem",
                      fontWeight: 700,
                      cursor: "pointer"
                    }}
                  >
                    <RefreshCw size={14} className={loadingQuizzes ? "animate-spin" : ""} />
                    <span>Actualizar</span>
                  </button>
                </div>

                {loadingQuizzes ? (
                  <div style={{ padding: "3rem", textAlign: "center", color: "#64748b" }}>
                    <RefreshCw size={24} className="animate-spin" color="#0284c7" style={{ margin: "0 auto 0.75rem" }} />
                    <span style={{ fontSize: "0.88rem", fontWeight: 700 }}>Cargando pruebas semanales disponibles...</span>
                  </div>
                ) : onlineQuizzes.length === 0 ? (
                  <div
                    style={{
                      background: "#ffffff",
                      borderRadius: "1rem",
                      border: "1px solid #e2e8f0",
                      padding: "3rem",
                      textAlign: "center",
                      color: "#64748b"
                    }}
                  >
                    <HelpCircle size={36} color="#94a3b8" style={{ margin: "0 auto 0.75rem" }} />
                    <h4 style={{ margin: "0 0 0.35rem", fontSize: "1rem", fontWeight: 800, color: "#0f172a" }}>
                      No hay pruebas semanales publicadas en este momento
                    </h4>
                    <p style={{ margin: 0, fontSize: "0.84rem" }}>
                      Tu docente publicará aquí las evaluaciones correspondientes a cada semana de laboratorio.
                    </p>
                  </div>
                ) : (
                  <div className="sp-quizzes-grid">
                    {onlineQuizzes.map((quiz) => {
                      const submission = existingSubmissions[quiz.numero_semana];
                      const isSubmitted = Boolean(submission);
                      const isGraded = submission?.estado === "calificado";
                      const liveSess = liveSessionsMap[quiz.numero_semana] || null;
                      const isLiveEnabled = Boolean(
                        liveSess &&
                        (liveSess.habilitada ||
                          liveSess.estado === "lobby" ||
                          liveSess.estado === "en_pregunta" ||
                          liveSess.estado === "esperando_siguiente")
                      );

                      return (
                        <div
                          key={quiz.id || quiz.numero_semana}
                          className="sp-quiz-card"
                          style={{
                            background: "#ffffff",
                            borderRadius: "1rem",
                            border: "1.5px solid #e2e8f0",
                            boxShadow: "0 2px 8px rgba(0, 0, 0, 0.03)",
                            padding: "1.4rem",
                            display: "flex",
                            flexDirection: "column",
                            justifyContent: "space-between",
                            gap: "1.1rem",
                            transition: "transform 0.15s ease, box-shadow 0.15s ease"
                          }}
                        >
                          <div>
                            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.6rem" }}>
                              <span
                                style={{
                                  fontSize: "0.75rem",
                                  fontWeight: 900,
                                  color: "#0284c7",
                                  background: "#f0f9ff",
                                  border: "1px solid #bae6fd",
                                  padding: "0.2rem 0.6rem",
                                  borderRadius: "0.45rem"
                                }}
                              >
                                SEMANA {quiz.numero_semana}
                              </span>

                              <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                                <Clock size={14} color="#64748b" />
                                <span style={{ fontSize: "0.76rem", color: "#64748b", fontWeight: 700 }}>
                                  {quiz.duracionMinutos || 15} min
                                </span>
                              </div>
                            </div>

                            <h4 style={{ margin: "0 0 0.4rem", fontSize: "1.05rem", fontWeight: 900, color: "#0f172a" }}>
                              {quiz.titulo || `Prueba Semanal ${quiz.numero_semana}`}
                            </h4>

                            <p style={{ margin: 0, fontSize: "0.82rem", color: "#64748b", lineHeight: 1.45, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                              {quiz.instrucciones}
                            </p>
                          </div>

                          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem", borderTop: "1px solid #f1f5f9", paddingTop: "0.9rem" }}>
                            {/* Estatus */}
                            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                              <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "#64748b" }}>
                                {quiz.preguntas?.length || 0} preguntas • 1:30 min c/u
                              </span>

                              {isGraded ? (
                                <span style={{ fontSize: "0.78rem", fontWeight: 900, color: "#16a34a", background: "#f0fdf4", border: "1px solid #86efac", padding: "0.2rem 0.55rem", borderRadius: "0.4rem" }}>
                                  ✓ {Number(submission.nota_obtenida).toFixed(3)} / 5.000 pts
                                </span>
                              ) : isSubmitted ? (
                                <span style={{ fontSize: "0.78rem", fontWeight: 800, color: "#d97706", background: "#fffbeb", border: "1px solid #fde68a", padding: "0.2rem 0.55rem", borderRadius: "0.4rem" }}>
                                  ⏳ Entregada • En revisión
                                </span>
                              ) : isLiveEnabled ? (
                                <span style={{ fontSize: "0.78rem", fontWeight: 900, color: "#16a34a", background: "#f0fdf4", border: "1px solid #86efac", padding: "0.2rem 0.55rem", borderRadius: "0.4rem", display: "inline-flex", alignItems: "center", gap: "0.3rem" }}>
                                  <Radio size={12} className="animate-pulse" />
                                  <span>🔴 EN VIVO • Habilitada</span>
                                </span>
                              ) : (
                                <span style={{ fontSize: "0.78rem", fontWeight: 800, color: "#d97706", background: "#fffbeb", border: "1px solid #fde68a", padding: "0.2rem 0.55rem", borderRadius: "0.4rem", display: "inline-flex", alignItems: "center", gap: "0.3rem" }}>
                                  <Lock size={12} />
                                  <span>🔒 Publicada • En espera</span>
                                </span>
                              )}
                            </div>

                            {/* Botón de acción */}
                            {isSubmitted ? (
                              <button
                                type="button"
                                onClick={() => handleOpenReview(quiz, submission)}
                                style={{
                                  width: "100%",
                                  padding: "0.55rem",
                                  borderRadius: "0.6rem",
                                  border: "1.5px solid #cbd5e1",
                                  background: "#ffffff",
                                  color: "#334155",
                                  fontSize: "0.84rem",
                                  fontWeight: 800,
                                  cursor: "pointer",
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  gap: "0.45rem"
                                }}
                              >
                                <Eye size={16} />
                                <span>Ver Mis Respuestas / Comprobante</span>
                              </button>
                            ) : isLiveEnabled ? (
                              <button
                                type="button"
                                onClick={() => handleStartQuiz(quiz, liveSess)}
                                style={{
                                  width: "100%",
                                  padding: "0.65rem",
                                  borderRadius: "0.6rem",
                                  border: "none",
                                  background: "linear-gradient(135deg, #16a34a 0%, #15803d 100%)",
                                  color: "#ffffff",
                                  fontSize: "0.88rem",
                                  fontWeight: 900,
                                  cursor: "pointer",
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  gap: "0.45rem",
                                  boxShadow: "0 4px 14px rgba(22, 163, 74, 0.35)"
                                }}
                              >
                                <Radio size={16} className="animate-pulse" />
                                <span>Entrar a la Prueba en Vivo</span>
                              </button>
                            ) : (
                              <button
                                type="button"
                                disabled
                                style={{
                                  width: "100%",
                                  padding: "0.6rem",
                                  borderRadius: "0.6rem",
                                  border: "1.5px solid #e2e8f0",
                                  background: "#f8fafc",
                                  color: "#94a3b8",
                                  fontSize: "0.85rem",
                                  fontWeight: 800,
                                  cursor: "not-allowed",
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  gap: "0.45rem"
                                }}
                                title="La prueba está publicada pero el docente aún no la ha habilitado en vivo."
                              >
                                <Lock size={15} />
                                <span>En Espera de Habilitación Docente</span>
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </>
            )}
          </div>
        )}
          </>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem", width: "100%" }}>
            <div
                className="animate-fade-in sp-quiz-take-card"
                style={{
                  position: "relative",
                  background: "#ffffff",
                  borderRadius: "1rem",
                  border: strikesCount >= 2 ? "2px solid #ef4444" : strikesCount === 1 ? "2px solid #f59e0b" : "1.5px solid #cbd5e1",
                  boxShadow: "0 8px 30px rgba(0, 0, 0, 0.08)",
                  padding: "1.75rem",
                  display: "flex",
                  flexDirection: "column",
                  gap: "1.5rem",
                  userSelect: "none",
                  WebkitUserSelect: "none",
                  WebkitTouchCallout: "none",
                  overscrollBehaviorY: "contain"
                }}
                onContextMenu={(e) => e.preventDefault()}
                onCopy={(e) => {
                  e.preventDefault();
                  notify("⚠️ Acción bloqueada: No está permitido copiar durante la evaluación.", "warning");
                }}
              >
                {/* Marca de agua forense de fondo sutil sobre todo el examen */}
                <div
                  style={{
                    position: "absolute",
                    inset: 0,
                    pointerEvents: "none",
                    zIndex: 1,
                    opacity: 0.035,
                    backgroundImage: `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='320' height='120' viewBox='0 0 320 120'><text x='20' y='60' fill='%23000000' font-family='sans-serif' font-weight='900' font-size='13' transform='rotate(-22 160 60)' letter-spacing='1'>${encodeURIComponent((effectiveStudent?.nombre_completo || "HISTOLAB").toUpperCase())} • ${encodeURIComponent(cuentaKey || "")}</text></svg>")`,
                    backgroundRepeat: "repeat"
                  }}
                />

                {/* Cabecera de Seguridad del Examen */}
                <div
                  style={{
                    position: "relative",
                    zIndex: 2,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    flexWrap: "wrap",
                    gap: "1rem",
                    borderBottom: "2px solid #f1f5f9",
                    paddingBottom: "1.1rem"
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                    <button
                      type="button"
                      onClick={() => {
                        isConfirmingRef.current = true;
                        outStartTimeRef.current = null;
                        setConfirmExitModalOpen(true);
                      }}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        width: "36px",
                        height: "36px",
                        borderRadius: "0.55rem",
                        border: "1.5px solid #cbd5e1",
                        background: "#ffffff",
                        color: "#475569",
                        cursor: "pointer"
                      }}
                      title="Salir de la prueba"
                    >
                      <ArrowLeft size={18} />
                    </button>
                    <div>
                      <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: "0.5rem" }}>
                        <span style={{ fontSize: "0.76rem", fontWeight: 800, color: "#0284c7", textTransform: "uppercase" }}>
                          Semana {activeQuizToTake.numero_semana} • Evaluación Práctica
                        </span>
                        <span
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "0.25rem",
                            fontSize: "0.72rem",
                            fontWeight: 800,
                            padding: "0.15rem 0.5rem",
                            borderRadius: "0.4rem",
                            background: strikesCount >= 2 ? "#fef2f2" : strikesCount === 1 ? "#fffbeb" : "#f0fdf4",
                            color: strikesCount >= 2 ? "#dc2626" : strikesCount === 1 ? "#b45309" : "#16a34a",
                            border: strikesCount >= 2 ? "1px solid #fecaca" : strikesCount === 1 ? "1px solid #fde68a" : "1px solid #bbf7d0"
                          }}
                        >
                          <Shield size={12} />
                          <span>
                            {strikesCount === 0
                              ? "Supervisión Activa (0/3)"
                              : strikesCount === 1
                              ? "Advertencia (1/3)"
                              : "Infracción Crítica (2/3)"}
                          </span>
                        </span>

                        {/* Indicador de Conectividad en Tiempo Real (Online / Respaldo Offline) */}
                        <span
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "0.3rem",
                            fontSize: "0.72rem",
                            fontWeight: 800,
                            padding: "0.15rem 0.5rem",
                            borderRadius: "0.4rem",
                            background: isOnline ? "#f0fdf4" : "#fff7ed",
                            color: isOnline ? "#16a34a" : "#c2410c",
                            border: isOnline ? "1px solid #bbf7d0" : "1px solid #fed7aa"
                          }}
                          title={isOnline ? "Conexión a internet activa" : "Sin internet. Tus respuestas están resguardadas en este dispositivo."}
                        >
                          <span style={{ width: "7px", height: "7px", borderRadius: "50%", background: isOnline ? "#22c55e" : "#ea580c" }} />
                          <span>{isOnline ? "En Línea" : "Offline (Respaldo Seguro)"}</span>
                        </span>
                      </div>

                      <h2 style={{ margin: "0.2rem 0 0", fontSize: "1.25rem", fontWeight: 900, color: "#0f172a" }}>
                        {activeQuizToTake.titulo}
                      </h2>
                    </div>
                  </div>

                  {/* Bloque Derecho: Temporizador Dinámico + Pantalla Completa + Valor */}
                  <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: "0.6rem" }}>
                    {/* Botón para forzar pantalla completa si el usuario la quitó */}
                    {!isFullscreenActive && (
                      <button
                        type="button"
                        onClick={requestQuizFullscreen}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "0.35rem",
                          padding: "0.45rem 0.75rem",
                          borderRadius: "0.5rem",
                          background: "#eff6ff",
                          border: "1px solid #93c5fd",
                          color: "#1d4ed8",
                          fontSize: "0.78rem",
                          fontWeight: 800,
                          cursor: "pointer"
                        }}
                        title="Activar Pantalla Completa para evitar sanciones"
                      >
                        <Maximize2 size={14} />
                        <span>Pantalla Completa</span>
                      </button>
                    )}

                    {/* Indicador de Estado y Temporizador Dinámico */}
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "0.45rem",
                        padding: "0.45rem 0.85rem",
                        borderRadius: "0.55rem",
                        background:
                          activeLiveState?.estado === "lobby"
                            ? "#eff6ff"
                            : activeLiveState?.estado === "esperando_siguiente"
                            ? "#fffbeb"
                            : timeRemainingSeconds <= 15
                            ? "#fee2e2"
                            : timeRemainingSeconds <= 30
                            ? "#fffbeb"
                            : "#f0f9ff",
                        border:
                          activeLiveState?.estado === "lobby"
                            ? "1.5px solid #bfdbfe"
                            : activeLiveState?.estado === "esperando_siguiente"
                            ? "1.5px solid #fde68a"
                            : timeRemainingSeconds <= 15
                            ? "2px solid #ef4444"
                            : "1.5px solid #bae6fd",
                        color:
                          activeLiveState?.estado === "lobby"
                            ? "#1d4ed8"
                            : activeLiveState?.estado === "esperando_siguiente"
                            ? "#b45309"
                            : timeRemainingSeconds <= 15
                            ? "#b91c1c"
                            : "#0369a1",
                        fontSize: "0.95rem",
                        fontWeight: 900,
                        animation: (activeLiveState?.estado === "en_pregunta" && timeRemainingSeconds <= 15) ? "pulse 1s infinite" : "none"
                      }}
                    >
                      {activeLiveState?.estado === "lobby" ? (
                        <>
                          <Clock size={17} />
                          <span>Lobby en Espera</span>
                        </>
                      ) : activeLiveState?.estado === "esperando_siguiente" ? (
                        <>
                          <Clock size={17} className="animate-bounce" />
                          <span>Esperando Siguiente</span>
                        </>
                      ) : (
                        <>
                          <Clock size={17} />
                          <span>{formatTimer(timeRemainingSeconds)}</span>
                        </>
                      )}
                    </div>

                    <div
                      style={{
                        padding: "0.45rem 0.85rem",
                        borderRadius: "0.55rem",
                        background: "#ecfdf5",
                        border: "1.5px solid #a7f3d0",
                        color: "#047857",
                        fontSize: "0.82rem",
                        fontWeight: 900
                      }}
                    >
                      Valor: 5.000 pts
                    </div>
                  </div>
                </div>

                {/* Banner de Advertencia Informativa de Seguridad */}
                <div
                  style={{
                    position: "relative",
                    zIndex: 2,
                    background: "#f8fafc",
                    border: "1px solid #e2e8f0",
                    borderRadius: "0.65rem",
                    padding: "0.75rem 1rem",
                    fontSize: "0.82rem",
                    color: "#475569",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    flexWrap: "wrap",
                    gap: "0.6rem"
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    <Lock size={15} color="#0284c7" />
                    <span>
                      <strong>Protocolo Antitrampas Activo:</strong> Prohibido salir de la app, cambiar de pestaña, dividir pantalla o copiar texto. Se permite un máximo de 2 advertencias; al 3er intento la prueba se bloqueará y enviará automáticamente.
                    </span>
                  </div>

                  {activeQuizToTake.instrucciones && (
                    <div style={{ width: "100%", marginTop: "0.25rem", color: "#334155" }}>
                      📌 <strong>Instrucciones:</strong> {activeQuizToTake.instrucciones}
                    </div>
                  )}
                </div>

                {/* RENDERIZADO DINÁMICO SEGÚN FASE DE LA SESIÓN EN VIVO */}
                {(() => {
                  const liveEstado = activeLiveState?.estado || "lobby";
                  const currentActiveIdx = activeLiveState?.pregunta_actual_idx ?? 0;
                  const totalQuestionsCount = activeQuizToTake.preguntas?.length || 6;
                  const currentActiveQ = activeQuizToTake.preguntas?.[currentActiveIdx] || activeQuizToTake.preguntas?.[0];
                  const isBonusActive = currentActiveIdx === 5;

                  // FASE 1: LOBBY DE DATOS GENERALES
                  if (liveEstado === "lobby") {
                    return (
                      <div style={{ position: "relative", zIndex: 2, display: "flex", flexDirection: "column", gap: "1.5rem" }}>
                        {/* Tarjeta de Datos Generales de la Prueba */}
                        <div
                          style={{
                            background: "#ffffff",
                            borderRadius: "1rem",
                            border: "1.5px solid #bae6fd",
                            padding: "2rem",
                            boxShadow: "0 4px 20px rgba(2, 132, 199, 0.08)",
                            display: "flex",
                            flexDirection: "column",
                            gap: "1.25rem"
                          }}
                        >
                          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", borderBottom: "1px solid #f1f5f9", paddingBottom: "1rem" }}>
                            <div style={{ width: "42px", height: "42px", borderRadius: "0.65rem", background: "#0284c7", color: "#ffffff", display: "flex", alignItems: "center", justifyContent: "center" }}>
                              <BookOpen size={22} />
                            </div>
                            <div>
                              <span style={{ fontSize: "0.75rem", fontWeight: 900, color: "#0284c7", textTransform: "uppercase" }}>
                                Datos Generales de la Prueba • Semana {activeQuizToTake.numero_semana}
                              </span>
                              <h3 style={{ margin: "0.2rem 0 0", fontSize: "1.35rem", fontWeight: 900, color: "#0f172a" }}>
                                {activeQuizToTake.titulo}
                              </h3>
                            </div>
                          </div>

                          {activeQuizToTake.instrucciones && (
                            <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: "0.75rem", padding: "1rem 1.25rem", color: "#334155", fontSize: "0.88rem", lineHeight: 1.55 }}>
                              <strong>📌 Instrucciones del Docente:</strong> {activeQuizToTake.instrucciones}
                            </div>
                          )}

                          {/* Requisitos y Normas de la Prueba Sincronizada */}
                          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "1rem" }}>
                            <div style={{ background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: "0.75rem", padding: "1rem", display: "flex", flexDirection: "column", gap: "0.3rem" }}>
                              <strong style={{ fontSize: "0.86rem", color: "#1d4ed8" }}>📋 6 Preguntas Fijas</strong>
                              <span style={{ fontSize: "0.76rem", color: "#1e40af" }}>5 reactivos oficiales (5.0 pts) + 1 reactivo bonus (+1.0 pt para Premios).</span>
                            </div>

                            <div style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: "0.75rem", padding: "1rem", display: "flex", flexDirection: "column", gap: "0.3rem" }}>
                              <strong style={{ fontSize: "0.86rem", color: "#15803d" }}>⏱️ 1:30 min por Pregunta</strong>
                              <span style={{ fontSize: "0.76rem", color: "#166534" }}>Tiempo global sincronizado. El cronómetro corre en directo para toda la sección.</span>
                            </div>

                            <div style={{ background: "#fff7ed", border: "1px solid #fed7aa", borderRadius: "0.75rem", padding: "1rem", display: "flex", flexDirection: "column", gap: "0.3rem" }}>
                              <strong style={{ fontSize: "0.86rem", color: "#c2410c" }}>🚫 Sin Retroceso</strong>
                              <span style={{ fontSize: "0.76rem", color: "#9a3412" }}>Al terminar el tiempo de cada pregunta, se bloquea y pasa a espera de la siguiente.</span>
                            </div>

                            <div style={{ background: "#faf5ff", border: "1px solid #e9d5ff", borderRadius: "0.75rem", padding: "1rem", display: "flex", flexDirection: "column", gap: "0.3rem" }}>
                              <strong style={{ fontSize: "0.86rem", color: "#7e22ce" }}>🛡️ Supervisión Activa</strong>
                              <span style={{ fontSize: "0.76rem", color: "#6b21a8" }}>No salgas de la pantalla ni cambies de aplicación para evitar sanciones antitrampas.</span>
                            </div>
                          </div>

                          {/* Banner de Sala de Espera Activa */}
                          <div
                            style={{
                              background: "linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)",
                              border: "2px solid #86efac",
                              borderRadius: "1rem",
                              padding: "2.5rem 1.5rem",
                              textAlign: "center",
                              display: "flex",
                              flexDirection: "column",
                              alignItems: "center",
                              gap: "0.9rem"
                            }}
                          >
                            <div
                              style={{
                                width: "64px",
                                height: "64px",
                                borderRadius: "50%",
                                background: "#16a34a",
                                color: "#ffffff",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                boxShadow: "0 0 25px rgba(22, 163, 74, 0.45)"
                              }}
                            >
                              <Radio size={32} className="animate-pulse" />
                            </div>

                            <h3 style={{ margin: 0, fontSize: "1.35rem", fontWeight: 900, color: "#166534" }}>
                              Sala de Espera Activa • Conectado Exitosamente
                            </h3>

                            <p style={{ margin: 0, fontSize: "0.92rem", color: "#15803d", maxWidth: "520px", lineHeight: 1.55 }}>
                              Por favor mantén esta pantalla abierta. El docente dará la orden de inicio desde su panel para que la <strong>Pregunta 1</strong> comience en simultáneo para todos.
                            </p>

                            <div style={{ display: "inline-flex", alignItems: "center", gap: "0.5rem", background: "#ffffff", padding: "0.45rem 1.2rem", borderRadius: "9999px", fontSize: "0.82rem", fontWeight: 800, color: "#15803d", border: "1px solid #bbf7d0", boxShadow: "0 2px 8px rgba(0,0,0,0.04)" }}>
                              <RefreshCw size={14} className="animate-spin" />
                              <span>Sincronizando con el docente en tiempo real...</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  }

                  // FASE 2: ESPERANDO LA SIGUIENTE PREGUNTA
                  if (liveEstado === "esperando_siguiente") {
                    return (
                      <div style={{ position: "relative", zIndex: 2, display: "flex", flexDirection: "column", gap: "1.5rem" }}>
                        <div
                          style={{
                            background: "linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%)",
                            border: "2px solid #f59e0b",
                            borderRadius: "1rem",
                            padding: "3rem 1.5rem",
                            textAlign: "center",
                            display: "flex",
                            flexDirection: "column",
                            alignItems: "center",
                            gap: "1rem",
                            boxShadow: "0 10px 30px rgba(245, 158, 11, 0.15)"
                          }}
                        >
                          <div
                            style={{
                              width: "68px",
                              height: "68px",
                              borderRadius: "50%",
                              background: "#d97706",
                              color: "#ffffff",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              boxShadow: "0 0 25px rgba(217, 119, 6, 0.35)"
                            }}
                          >
                            <Clock size={36} className="animate-bounce" />
                          </div>

                          <div>
                            <span style={{ fontSize: "0.8rem", fontWeight: 900, color: "#d97706", textTransform: "uppercase", letterSpacing: "1px" }}>
                              Pregunta #{currentActiveIdx + 1} Concluida
                            </span>
                            <h3 style={{ margin: "0.3rem 0 0", fontSize: "1.45rem", fontWeight: 900, color: "#92400e" }}>
                              Esperando la Siguiente Pregunta...
                            </h3>
                          </div>

                          <p style={{ margin: 0, fontSize: "0.94rem", color: "#b45309", maxWidth: "520px", lineHeight: 1.55 }}>
                            El tiempo para la pregunta anterior ha terminado y tus respuestas han sido resguardadas en el servidor. Por favor espera en esta pantalla; la siguiente pregunta se abrirá automáticamente en cuanto el docente dé la orden.
                          </p>

                          <div style={{ display: "inline-flex", alignItems: "center", gap: "0.5rem", background: "#ffffff", padding: "0.5rem 1.25rem", borderRadius: "9999px", fontSize: "0.84rem", fontWeight: 800, color: "#92400e", border: "1px solid #fde68a" }}>
                            <RefreshCw size={14} className="animate-spin" />
                            <span>Progreso: Pregunta {currentActiveIdx + 1} de {totalQuestionsCount} completada</span>
                          </div>
                        </div>
                      </div>
                    );
                  }

                  // FASE 3: EN PREGUNTA ACTIVA (Únicamente se muestra la pregunta asignada)
                  if (!currentActiveQ) return null;

                  return (
                    <div style={{ position: "relative", zIndex: 2, display: "flex", flexDirection: "column", gap: "1.5rem", paddingBottom: "min(45vh, 320px)" }}>
                      <div
                        key={currentActiveQ.id}
                        style={{
                          padding: "1.75rem",
                          borderRadius: "1rem",
                          border: isBonusActive ? "2px solid #f59e0b" : "1.5px solid #cbd5e1",
                          background: isBonusActive ? "linear-gradient(180deg, #fffdf8 0%, #ffffff 100%)" : "#ffffff",
                          boxShadow: "0 4px 20px rgba(0, 0, 0, 0.05)",
                          display: "flex",
                          flexDirection: "column",
                          gap: "1.25rem"
                        }}
                      >
                        {/* Cabecera del Reactivo Activo */}
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "0.75rem", borderBottom: "1px solid #f1f5f9", paddingBottom: "0.85rem" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
                            <span
                              style={{
                                width: "32px",
                                height: "32px",
                                borderRadius: "50%",
                                background: isBonusActive ? "#f59e0b" : "#0284c7",
                                color: "#ffffff",
                                fontWeight: 900,
                                fontSize: "0.9rem",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center"
                              }}
                            >
                              {currentActiveIdx + 1}
                            </span>
                            <div style={{ fontSize: "1.1rem", fontWeight: 900, color: "#0f172a" }}>
                              Pregunta #{currentActiveIdx + 1} de {totalQuestionsCount}
                              {isBonusActive && (
                                <span style={{ marginLeft: "0.5rem", fontSize: "0.78rem", color: "#92400e", background: "#fef3c7", padding: "0.2rem 0.55rem", borderRadius: "9999px", border: "1px solid #fde68a" }}>
                                  ⭐ Reactivo Bonus
                                </span>
                              )}
                            </div>
                          </div>

                          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                            <span style={{ fontSize: "0.8rem", fontWeight: 800, color: "#0369a1", background: "#e0f2fe", padding: "0.25rem 0.65rem", borderRadius: "0.45rem" }}>
                              Valor: {Number(currentActiveQ.puntos || 1.0).toFixed(3)} pts
                            </span>
                          </div>
                        </div>

                        {/* Micrografía histológica protegida contra Google Lens y capturas */}
                        {currentActiveQ.imagen_url && (
                          <div
                            className="sp-quiz-image-container"
                            style={{
                              position: "relative",
                              textAlign: "center",
                              background: "#0f172a",
                              padding: "0.65rem",
                              borderRadius: "0.75rem",
                              border: "1px solid #cbd5e1",
                              overflow: "hidden",
                              userSelect: "none",
                              WebkitUserSelect: "none"
                            }}
                            onContextMenu={(e) => e.preventDefault()}
                          >
                            <div
                              style={{
                                position: "absolute",
                                inset: 0,
                                pointerEvents: "none",
                                zIndex: 2,
                                opacity: 0.18,
                                backgroundImage: `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='260' height='90' viewBox='0 0 260 90'><text x='20' y='45' fill='%23ffffff' font-family='sans-serif' font-weight='900' font-size='12' transform='rotate(-20 130 45)' letter-spacing='1'>${encodeURIComponent((effectiveStudent?.nombre_completo || "HISTOLAB").toUpperCase())} • ${encodeURIComponent(cuentaKey || "")}</text></svg>")`,
                                backgroundRepeat: "repeat"
                              }}
                            />
                            <div
                              style={{
                                position: "absolute",
                                inset: 0,
                                zIndex: 3,
                                background: "transparent",
                                touchAction: "manipulation",
                                WebkitTouchCallout: "none"
                              }}
                              onContextMenu={(e) => e.preventDefault()}
                            />
                            <img
                              src={currentActiveQ.imagen_url}
                              alt={`Micrografía pregunta ${currentActiveIdx + 1}`}
                              draggable="false"
                              style={{
                                maxHeight: "320px",
                                maxWidth: "100%",
                                borderRadius: "0.5rem",
                                objectFit: "contain",
                                pointerEvents: "none",
                                userSelect: "none",
                                WebkitUserSelect: "none"
                              }}
                            />
                          </div>
                        )}

                        {/* Apartados / Sub-reactivos de respuesta */}
                        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                          {(!currentActiveQ.items || currentActiveQ.items.length === 0) ? (
                            <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
                              <label style={{ fontSize: "0.88rem", fontWeight: 800, color: "#1e293b" }}>
                                Respuesta:
                              </label>
                              <textarea
                                rows={2}
                                className="sp-quiz-input sp-quiz-textarea"
                                value={
                                  typeof quizAnswers?.[currentActiveQ.id]?.respuesta === "string"
                                    ? quizAnswers[currentActiveQ.id].respuesta
                                    : typeof quizAnswers?.[currentActiveQ.id] === "string"
                                    ? quizAnswers[currentActiveQ.id]
                                    : ""
                                }
                                readOnly={isExamSealedOffline || submittingQuiz || timeRemainingSeconds <= 0}
                                onChange={(e) => handleAnswerChange(currentActiveQ.id, "respuesta", e.target.value)}
                                onFocus={(e) => {
                                  const target = e.target;
                                  setTimeout(() => target.scrollIntoView({ behavior: "smooth", block: "center" }), 150);
                                }}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter" && !e.shiftKey) e.preventDefault();
                                }}
                                onPaste={(e) => {
                                  e.preventDefault();
                                  notify("⚠️ Acción bloqueada por seguridad: No está permitido pegar texto.", "warning");
                                }}
                                autoComplete="off"
                                autoCorrect="off"
                                spellCheck="false"
                                placeholder="Escribe tu respuesta aquí (se ajusta automáticamente)..."
                                style={{
                                  width: "100%",
                                  boxSizing: "border-box",
                                  padding: "0.65rem 0.85rem",
                                  borderRadius: "0.55rem",
                                  border: "1.5px solid #cbd5e1",
                                  background: (isExamSealedOffline || submittingQuiz || timeRemainingSeconds <= 0) ? "#f8fafc" : "#ffffff",
                                  fontSize: "0.9rem",
                                  lineHeight: "1.45",
                                  fontWeight: 600,
                                  color: "#0f172a",
                                  outline: "none",
                                  resize: "vertical",
                                  minHeight: "56px",
                                  fontFamily: "inherit",
                                  cursor: (isExamSealedOffline || submittingQuiz || timeRemainingSeconds <= 0) ? "not-allowed" : "text"
                                }}
                              />
                            </div>
                          ) : (
                            (currentActiveQ.items || []).map((item, itemIdx) => {
                              const currentVal = quizAnswers?.[currentActiveQ.id]?.[item.id];
                              const itemLabel = item.instruccion || item.etiqueta || `Inciso ${itemIdx + 1}`;
                              return (
                                <div key={item.id} style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
                                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "0.4rem" }}>
                                    <label style={{ fontSize: "0.85rem", fontWeight: 800, color: "#1e293b", margin: 0 }}>
                                      {String.fromCharCode(97 + itemIdx)}) {itemLabel}:
                                    </label>
                                    {item.puntos !== undefined && (
                                      <span style={{ fontSize: "0.74rem", fontWeight: 800, color: "#0369a1", background: "#f0f9ff", border: "1px solid #bae6fd", padding: "0.1rem 0.45rem", borderRadius: "0.35rem" }}>
                                        {item.puntos} pt(s)
                                      </span>
                                    )}
                                  </div>

                                  {item.tipo === "texto_corto" ? (
                                    <textarea
                                      rows={2}
                                      className="sp-quiz-input sp-quiz-textarea"
                                      value={typeof currentVal === "string" ? currentVal : ""}
                                      readOnly={isExamSealedOffline || submittingQuiz || timeRemainingSeconds <= 0}
                                      onChange={(e) => handleAnswerChange(currentActiveQ.id, item.id, e.target.value)}
                                      onFocus={(e) => {
                                        const target = e.target;
                                        setTimeout(() => target.scrollIntoView({ behavior: "smooth", block: "center" }), 150);
                                      }}
                                      onKeyDown={(e) => {
                                        if (e.key === "Enter" && !e.shiftKey) e.preventDefault();
                                      }}
                                      onPaste={(e) => {
                                        e.preventDefault();
                                        notify("⚠️ Acción bloqueada por seguridad académica: No está permitido pegar texto.", "warning");
                                      }}
                                      autoComplete="off"
                                      autoCorrect="off"
                                      spellCheck="false"
                                      placeholder="Escribe tu respuesta manualmente aquí..."
                                      style={{
                                        width: "100%",
                                        boxSizing: "border-box",
                                        padding: "0.65rem 0.85rem",
                                        borderRadius: "0.55rem",
                                        border: currentVal ? "2px solid #0284c7" : "1.5px solid #cbd5e1",
                                        background: (isExamSealedOffline || submittingQuiz || timeRemainingSeconds <= 0) ? "#f8fafc" : currentVal ? "#f0f9ff" : "#ffffff",
                                        fontSize: "0.9rem",
                                        lineHeight: "1.45",
                                        fontWeight: 600,
                                        color: "#0f172a",
                                        outline: "none",
                                        resize: "vertical",
                                        minHeight: "56px",
                                        fontFamily: "inherit",
                                        cursor: (isExamSealedOffline || submittingQuiz || timeRemainingSeconds <= 0) ? "not-allowed" : "text"
                                      }}
                                    />
                                  ) : (
                                    <div style={{ display: "flex", flexDirection: "column", gap: "0.45rem" }}>
                                      {Array.from({ length: item.cantidad || 3 }).map((_, rIdx) => {
                                        const rowVal = Array.isArray(currentVal) ? currentVal[rIdx] || "" : "";
                                        return (
                                          <div key={rIdx} style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                                            <span style={{ fontSize: "0.84rem", fontWeight: 800, color: "#64748b", width: "22px" }}>
                                              {rIdx + 1}.
                                            </span>
                                            <input
                                              type="text"
                                              className="sp-quiz-input"
                                              value={rowVal}
                                              readOnly={isExamSealedOffline || submittingQuiz || timeRemainingSeconds <= 0}
                                              onChange={(e) => handleAnswerChange(currentActiveQ.id, item.id, rIdx, e.target.value)}
                                              onFocus={(e) => {
                                                const target = e.target;
                                                setTimeout(() => target.scrollIntoView({ behavior: "smooth", block: "center" }), 150);
                                              }}
                                              onPaste={(e) => {
                                                e.preventDefault();
                                                notify("⚠️ Acción bloqueada por seguridad: No está permitido pegar texto.", "warning");
                                              }}
                                              autoComplete="off"
                                              autoCorrect="off"
                                              spellCheck="false"
                                              placeholder={`Elemento ${rIdx + 1}...`}
                                              style={{
                                                flex: 1,
                                                padding: "0.55rem 0.8rem",
                                                borderRadius: "0.5rem",
                                                border: rowVal ? "2px solid #0284c7" : "1.5px solid #cbd5e1",
                                                background: (isExamSealedOffline || submittingQuiz || timeRemainingSeconds <= 0) ? "#f8fafc" : rowVal ? "#f0f9ff" : "#ffffff",
                                                fontSize: "0.86rem",
                                                fontWeight: 600,
                                                color: "#0f172a",
                                                outline: "none",
                                                cursor: (isExamSealedOffline || submittingQuiz || timeRemainingSeconds <= 0) ? "not-allowed" : "text"
                                              }}
                                            />
                                          </div>
                                        );
                                      })}
                                    </div>
                                  )}
                                </div>
                              );
                            })
                          )}
                        </div>
                      </div>

                      {/* Barra Inferior del Reactivo */}
                      <div
                        style={{
                          position: "relative",
                          zIndex: 2,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          flexWrap: "wrap",
                          gap: "1rem",
                          borderTop: "2px solid #f1f5f9",
                          paddingTop: "1.25rem"
                        }}
                      >
                        <span style={{ fontSize: "0.84rem", color: "#64748b", fontWeight: 600 }}>
                          {currentActiveIdx === totalQuestionsCount - 1
                            ? "Última pregunta de la prueba semanal (Reactivo Bonus). Al terminar el tiempo o pulsar enviar se sellará tu entrega."
                            : `Pregunta ${currentActiveIdx + 1} de ${totalQuestionsCount}. Tus respuestas se guardan automáticamente al cumplirse el tiempo.`}
                        </span>

                        {currentActiveIdx < totalQuestionsCount - 1 && (
                          <button
                            type="button"
                            onClick={() => {
                              setAnsweredQuestionsMap((prev) => ({ ...prev, [currentActiveIdx]: true }));
                              notify("✓ Respuesta guardada. Esperando a que el tiempo concluya o el docente avance.", "success");
                            }}
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: "0.5rem",
                              padding: "0.6rem 1.25rem",
                              borderRadius: "0.65rem",
                              border: answeredQuestionsMap[currentActiveIdx] ? "1.5px solid #86efac" : "none",
                              background: answeredQuestionsMap[currentActiveIdx] ? "#f0fdf4" : "linear-gradient(135deg, #0284c7 0%, #0369a1 100%)",
                              color: answeredQuestionsMap[currentActiveIdx] ? "#15803d" : "#ffffff",
                              fontSize: "0.86rem",
                              fontWeight: 800,
                              cursor: "pointer",
                              boxShadow: answeredQuestionsMap[currentActiveIdx] ? "none" : "0 3px 10px rgba(2, 132, 199, 0.25)",
                              transition: "all 0.15s ease"
                            }}
                          >
                            <CheckCircle2 size={16} color={answeredQuestionsMap[currentActiveIdx] ? "#16a34a" : "#ffffff"} />
                            <span>{answeredQuestionsMap[currentActiveIdx] ? "Respuesta Guardada ✓" : "Confirmar Respuesta"}</span>
                          </button>
                        )}

                        {currentActiveIdx === totalQuestionsCount - 1 && (
                          <button
                            type="button"
                            onClick={() => handleSubmitQuiz()}
                            disabled={submittingQuiz}
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: "0.5rem",
                              padding: "0.7rem 1.6rem",
                              borderRadius: "0.65rem",
                              border: "none",
                              background: "linear-gradient(135deg, #16a34a 0%, #15803d 100%)",
                              color: "#ffffff",
                              fontSize: "0.92rem",
                              fontWeight: 900,
                              cursor: submittingQuiz ? "not-allowed" : "pointer",
                              boxShadow: "0 4px 14px rgba(22, 163, 74, 0.3)"
                            }}
                          >
                            {submittingQuiz ? <RefreshCw size={18} className="animate-spin" /> : <Send size={18} />}
                            <span>{submittingQuiz ? "Enviando Respuestas..." : "Finalizar y Entregar Prueba"}</span>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })()}
              </div>
          </div>
        )}


        {/* TELÓN NEGRO ANTI-CAPTURAS Y CONTROL CENTER/NOTIFICACIONES */}
        {isScreenBlackedOut && (
          <div
            id="anti-cheat-blackout-curtain"
            style={{
              position: "fixed",
              top: 0,
              left: 0,
              width: "100vw",
              height: "100vh",
              zIndex: 99999999,
              background: "#000000",
              pointerEvents: "all"
            }}
          />
        )}

        {/* MODAL DE ADVERTENCIA / INFRACCIÓN DE SEGURIDAD ANTITRAMPAS */}
        {violationModal && (
          <div
            style={{
              position: "fixed",
              inset: 0,
              zIndex: 999999,
              background: "rgba(15, 23, 42, 0.88)",
              backdropFilter: "blur(10px)",
              WebkitBackdropFilter: "blur(10px)",
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
                borderRadius: "1.2rem",
                border: violationModal.strike >= 3 ? "3px solid #ef4444" : "3px solid #f59e0b",
                maxWidth: "480px",
                width: "100%",
                padding: "2rem",
                boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.45)",
                textAlign: "center",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: "1.1rem"
              }}
            >
              <div
                style={{
                  width: "64px",
                  height: "64px",
                  borderRadius: "50%",
                  background: violationModal.strike >= 3 ? "#fee2e2" : "#fef3c7",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: violationModal.strike >= 3 ? "#dc2626" : "#d97706"
                }}
              >
                <ShieldAlert size={36} />
              </div>

              <div>
                <span
                  style={{
                    fontSize: "0.78rem",
                    fontWeight: 900,
                    textTransform: "uppercase",
                    letterSpacing: "1px",
                    color: violationModal.strike >= 3 ? "#dc2626" : "#d97706"
                  }}
                >
                  {violationModal.strike >= 3 ? "Bloqueo por Infracción Crítica" : "Incidencia de Integridad Registrada"}
                </span>
                <h3 style={{ margin: "0.3rem 0 0", fontSize: "1.35rem", fontWeight: 900, color: "#0f172a" }}>
                  {violationModal.strike >= 3 ? "Evaluación Bloqueada" : `Advertencia ${violationModal.strike} de 3`}
                </h3>
              </div>

              <p style={{ margin: 0, fontSize: "0.92rem", color: "#475569", lineHeight: 1.55 }}>
                {violationModal.mensaje}
              </p>

              {violationModal.strike < 3 ? (
                <button
                  type="button"
                  onClick={() => {
                    setViolationModal(null);
                    requestQuizFullscreen();
                  }}
                  style={{
                    width: "100%",
                    marginTop: "0.5rem",
                    padding: "0.75rem",
                    borderRadius: "0.7rem",
                    border: "none",
                    background: "linear-gradient(135deg, #0284c7 0%, #0369a1 100%)",
                    color: "#ffffff",
                    fontSize: "0.95rem",
                    fontWeight: 900,
                    cursor: "pointer",
                    boxShadow: "0 4px 14px rgba(2, 132, 199, 0.35)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "0.5rem"
                  }}
                >
                  <Maximize2 size={18} />
                  <span>Entendido • Reanudar Pantalla Completa</span>
                </button>
              ) : (
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.6rem",
                    marginTop: "0.5rem",
                    padding: "0.75rem",
                    borderRadius: "0.7rem",
                    background: "#fee2e2",
                    color: "#991b1b",
                    fontSize: "0.9rem",
                    fontWeight: 800
                  }}
                >
                  <RefreshCw size={18} className="animate-spin" />
                  <span>Cerrando y enviando prueba automáticamente al servidor...</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* MODAL IN-APP DE CONFIRMACIÓN DE ENTREGA (NO DESENFOCA NI DISPARA FALSOS POSITIVOS DE SEGURIDAD) */}
        {confirmSubmitModalOpen && activeQuizToTake && (
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
                border: "2px solid #e2e8f0",
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
                  width: "62px",
                  height: "62px",
                  borderRadius: "50%",
                  background: "linear-gradient(135deg, #e0f2fe 0%, #bae6fd 100%)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#0284c7"
                }}
              >
                <Send size={30} />
              </div>

              <div>
                <span
                  style={{
                    fontSize: "0.78rem",
                    fontWeight: 900,
                    textTransform: "uppercase",
                    letterSpacing: "1px",
                    color: "#0284c7"
                  }}
                >
                  Confirmación de Entrega
                </span>
                <h3 style={{ margin: "0.3rem 0 0", fontSize: "1.35rem", fontWeight: 900, color: "#0f172a" }}>
                  ¿Finalizar y Entregar Prueba?
                </h3>
                <p style={{ margin: "0.35rem 0 0", fontSize: "0.88rem", color: "#64748b", fontWeight: 600 }}>
                  Semana {activeQuizToTake.numero_semana} • {activeQuizToTake.titulo || `Prueba Semanal ${activeQuizToTake.numero_semana}`}
                </p>
              </div>

              {/* Resumen de respuestas contestadas */}
              <div
                style={{
                  width: "100%",
                  padding: "0.85rem 1rem",
                  borderRadius: "0.85rem",
                  background: getAnsweredStats.answered === getAnsweredStats.total ? "#f0fdf4" : "#fffbeb",
                  border: getAnsweredStats.answered === getAnsweredStats.total ? "1.5px solid #86efac" : "1.5px solid #fde68a",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "0.6rem",
                  fontSize: "0.88rem",
                  fontWeight: 700,
                  color: getAnsweredStats.answered === getAnsweredStats.total ? "#166534" : "#92400e"
                }}
              >
                {getAnsweredStats.answered === getAnsweredStats.total ? (
                  <>
                    <CheckCircle2 size={19} color="#16a34a" />
                    <span>Has respondido las {getAnsweredStats.total} preguntas ({getAnsweredStats.answered}/{getAnsweredStats.total}).</span>
                  </>
                ) : (
                  <>
                    <AlertTriangle size={19} color="#d97706" />
                    <span>
                      {getAnsweredStats.answered} de {getAnsweredStats.total} preguntas respondidas ({getAnsweredStats.total - getAnsweredStats.answered} sin contestar).
                    </span>
                  </>
                )}
              </div>

              <p style={{ margin: 0, fontSize: "0.86rem", color: "#475569", lineHeight: 1.5 }}>
                Una vez enviada, tus respuestas quedarán selladas definitivamente y no podrás modificarlas. Tu examen será registrado en el sistema y enviado para revisión docente.
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
                  onClick={() => {
                    setConfirmSubmitModalOpen(false);
                    isConfirmingRef.current = false;
                    outStartTimeRef.current = null;
                  }}
                  disabled={submittingQuiz}
                  style={{
                    flex: 1,
                    padding: "0.75rem",
                    borderRadius: "0.7rem",
                    border: "1.5px solid #cbd5e1",
                    background: "#ffffff",
                    color: "#475569",
                    fontSize: "0.9rem",
                    fontWeight: 700,
                    cursor: submittingQuiz ? "not-allowed" : "pointer"
                  }}
                >
                  Seguir Revisando
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setConfirmSubmitModalOpen(false);
                    isConfirmingRef.current = false;
                    outStartTimeRef.current = null;
                    executeSubmitQuiz();
                  }}
                  disabled={submittingQuiz}
                  style={{
                    flex: 1.3,
                    padding: "0.75rem",
                    borderRadius: "0.7rem",
                    border: "none",
                    background: "linear-gradient(135deg, #0284c7 0%, #0369a1 100%)",
                    color: "#ffffff",
                    fontSize: "0.9rem",
                    fontWeight: 900,
                    cursor: submittingQuiz ? "not-allowed" : "pointer",
                    boxShadow: "0 4px 14px rgba(2, 132, 199, 0.35)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "0.45rem"
                  }}
                >
                  {submittingQuiz ? <RefreshCw size={17} className="animate-spin" /> : <Send size={17} />}
                  <span>{submittingQuiz ? "Enviando..." : "Sí, Entregar Ahora"}</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* MODAL IN-APP DE CONFIRMACIÓN PARA SALIR DE LA PRUEBA */}
        {confirmExitModalOpen && (
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
                maxWidth: "460px",
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
                <AlertTriangle size={30} />
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
                  Salir de la Evaluación
                </span>
                <h3 style={{ margin: "0.3rem 0 0", fontSize: "1.35rem", fontWeight: 900, color: "#0f172a" }}>
                  ¿Deseas salir de la prueba?
                </h3>
              </div>

              <p style={{ margin: 0, fontSize: "0.9rem", color: "#475569", lineHeight: 1.55 }}>
                Si sales en este momento, las respuestas que no hayas enviado se descartarán y se cancelará tu sesión actual de la evaluación.
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
                  onClick={() => {
                    setConfirmExitModalOpen(false);
                    isConfirmingRef.current = false;
                    outStartTimeRef.current = null;
                  }}
                  style={{
                    flex: 1.2,
                    padding: "0.75rem",
                    borderRadius: "0.7rem",
                    border: "none",
                    background: "linear-gradient(135deg, #0284c7 0%, #0369a1 100%)",
                    color: "#ffffff",
                    fontSize: "0.9rem",
                    fontWeight: 900,
                    cursor: "pointer",
                    boxShadow: "0 4px 14px rgba(2, 132, 199, 0.3)"
                  }}
                >
                  Permanecer en la Prueba
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setConfirmExitModalOpen(false);
                    isConfirmingRef.current = false;
                    outStartTimeRef.current = null;
                    if (activeQuizToTake?.numero_semana) {
                      clearActiveAttemptFromDisk(activeQuizToTake.numero_semana);
                    }
                    setActiveQuizToTake(null);
                    setViolationModal(null);
                    if (document.exitFullscreen) document.exitFullscreen().catch(() => {});
                  }}
                  style={{
                    flex: 1,
                    padding: "0.75rem",
                    borderRadius: "0.7rem",
                    border: "1.5px solid #fca5a5",
                    background: "#fff1f2",
                    color: "#b91c1c",
                    fontSize: "0.9rem",
                    fontWeight: 700,
                    cursor: "pointer"
                  }}
                >
                  Salir y Descartar
                </button>
              </div>
            </div>
          </div>
        )}

        {/* MODAL DE RESGUARDO Y SELLADO OFFLINE INMUTABLE */}
        {isExamSealedOffline && (
          <div
            style={{
              position: "fixed",
              inset: 0,
              zIndex: 9999999,
              background: "rgba(15, 23, 42, 0.92)",
              backdropFilter: "blur(12px)",
              WebkitBackdropFilter: "blur(12px)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "1.25rem"
            }}
          >
            <div
              className="animate-scale-in"
              style={{
                maxWidth: "520px",
                width: "100%",
                background: "#ffffff",
                borderRadius: "1.25rem",
                padding: "2.25rem 2rem",
                boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.5)",
                border: "3px solid #0284c7",
                textAlign: "center",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: "1.2rem"
              }}
            >
              <div
                style={{
                  width: "68px",
                  height: "68px",
                  borderRadius: "50%",
                  background: "#e0f2fe",
                  color: "#0284c7",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center"
                }}
              >
                <ShieldCheck size={38} />
              </div>

              <div>
                <div
                  style={{
                    fontSize: "0.78rem",
                    fontWeight: 900,
                    color: "#0284c7",
                    textTransform: "uppercase",
                    letterSpacing: "1px"
                  }}
                >
                  Integridad Académica Resguardada
                </div>
                <h3 style={{ margin: "0.3rem 0 0", fontSize: "1.4rem", fontWeight: 900, color: "#0f172a" }}>
                  Evaluación Finalizada y Sellada
                </h3>
              </div>

              <p style={{ margin: 0, fontSize: "0.92rem", color: "#475569", lineHeight: 1.55 }}>
                Tu evaluación de la <strong>Semana {activeQuizToTake?.numero_semana}</strong> ha concluido. Todas tus respuestas han sido congeladas y selladas de forma <strong>inmutable</strong> en la memoria de este dispositivo.
              </p>

              <div
                style={{
                  width: "100%",
                  background: isOnline ? "#f0fdf4" : "#fff7ed",
                  border: isOnline ? "1.5px solid #86efac" : "1.5px solid #fdba74",
                  borderRadius: "0.75rem",
                  padding: "0.85rem 1rem",
                  fontSize: "0.84rem",
                  color: isOnline ? "#166534" : "#9a3412",
                  textAlign: "left",
                  display: "flex",
                  alignItems: "center",
                  gap: "0.65rem"
                }}
              >
                <Clock size={22} style={{ flexShrink: 0 }} />
                <span>
                  {isOnline
                    ? "Señal de internet detectada. Listo para sincronizar con la base de datos de Histolab."
                    : "Sin conexión a internet. Conecta tu teléfono o computadora a Wi-Fi o datos móviles para completar la sincronización."}
                </span>
              </div>

              <button
                type="button"
                onClick={dispatchPendingOfflineSubmission}
                disabled={syncingOfflineSubmission}
                style={{
                  width: "100%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "0.5rem",
                  padding: "0.85rem 1.5rem",
                  borderRadius: "0.75rem",
                  border: "none",
                  background: "linear-gradient(135deg, #0284c7 0%, #0369a1 100%)",
                  color: "#ffffff",
                  fontSize: "0.95rem",
                  fontWeight: 900,
                  cursor: syncingOfflineSubmission ? "not-allowed" : "pointer",
                  boxShadow: "0 4px 15px rgba(2, 132, 199, 0.35)"
                }}
              >
                {syncingOfflineSubmission ? <RefreshCw size={18} className="animate-spin" /> : <Send size={18} />}
                <span>{syncingOfflineSubmission ? "Sincronizando con Servidor..." : "Reintentar Sincronización Ahora"}</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

