import { observeQuizIntegrity } from "../utils/quizIntegrity.mjs";
import StudentQuizPlayer from "./StudentQuizPlayer";
import StudentQuizzesView from "./StudentQuizzesView";
import StudentAccountView from "./StudentAccountView";
import StudentAttendanceView from "./StudentAttendanceView";
import { getMakeupOutcome } from "../../../shared/studentMakeups.mjs";
import StudentGradesView from "./StudentGradesView";
import StudentDashboard from "./StudentDashboard";
import "./StudentDashboard.css";
import { isQuizItemMultiSlot, quizItemSlotCount, quizSlotLabel } from "../../../shared/quizItems.mjs";
import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import {
  House,
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
  X,
  Eye,
  EyeOff,
  KeyRound,
  Lock,
  AlertCircle,
  Maximize2,
  Shield,
  Radio,
  Play,
  PlayCircle,
  ChevronRight,
  BarChart3,
  Layers,
  Layers3
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

  const [activeTab, setActiveTab] = useState(() => (savedActiveQuizSession?.quiz ? "pruebas" : "inicio"));
  const [currentStudentData, setCurrentStudentData] = useState(() => {
    if (student && student.notas && Object.keys(student.notas).length > 0) return student;
    try {
      const cKey = student?.numero_cuenta;
      if (cKey) {
        const cached = safeStorage.getItem(`histolab_student_user_${cKey}`);
        if (cached) {
          const parsed = JSON.parse(cached);
          if (parsed && parsed.numero_cuenta === cKey && parsed.id === student?.id && parsed.seccion_id === student?.seccion_id) {
            return parsed;
          }
        }
      }
    } catch (_) {}
    return student;
  });
  const [semanasConfig, setSemanasConfig] = useState([]);
  const [temario, setTemario] = useState([]);
  const [configPuntajes, setConfigPuntajes] = useState(null);
  const [loadingAcademic, setLoadingAcademic] = useState(true);
  const [academicError, setAcademicError] = useState("");
  const [academicReload, setAcademicReload] = useState(0);

  // Estados para Pruebas Semanales en Línea y Sincronización en Vivo
  const [onlineQuizzes, setOnlineQuizzes] = useState(() => {
    if (savedActiveQuizSession?.quiz) return [savedActiveQuizSession.quiz];
    return [];
  });
  const [makeupAssignments, setMakeupAssignments] = useState([]);
  const [loadingQuizzes, setLoadingQuizzes] = useState(true);
  const [quizLoadError, setQuizLoadError] = useState("");
  const quizLoadRequestRef = useRef(0);
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

  const quizAnswersRef = useRef(quizAnswers);
  quizAnswersRef.current = quizAnswers;
  const sendHeartbeatRef = useRef(null);
  const [liveConnection, setLiveConnection] = useState("connecting");
  const lastKnownQuestionIdxRef = useRef(null);

  // Estados del Sistema de Integridad Académica y Antitrampas (Móvil, Escritorio y Resiliencia de Red)
  const [shuffledQuestions, setShuffledQuestions] = useState(() => savedActiveQuizSession?.quiz?.preguntas || []);
  const [timeRemainingSeconds, setTimeRemainingSeconds] = useState(() => {
    if (savedActiveQuizSession?.liveSess?.tiempo_restante_segundos != null) {
      return savedActiveQuizSession.liveSess.tiempo_restante_segundos;
    }
    return 90;
  });
  const [strikesCount, setStrikesCount] = useState(0);
  const [incidentsList, setIncidentsList] = useState([]);
  const [violationModal, setViolationModal] = useState(null); // { strike, isFinal, mensaje, segundosFuera }
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
  const blackoutTimeoutRef = React.useRef(null);
  const lastAlertTimestampRef = React.useRef(0);
  const isFromTopBorderRef = React.useRef(false);
  const violationModalRef = React.useRef(null);
  const pasteCountRef = React.useRef(0);

  useEffect(() => {
    violationModalRef.current = violationModal;
  }, [violationModal]);

  // Desactivación segura e inmediata del apagón de pantalla (con resguardo total anti-bloqueo)
  const deactivateDrmBlackout = useCallback(() => {
    if (blackoutTimeoutRef.current) {
      clearTimeout(blackoutTimeoutRef.current);
      blackoutTimeoutRef.current = null;
    }
    setIsScreenBlackedOut(false);
    if (typeof document !== "undefined") {
      if (document.body) {
        document.body.classList.remove("anticheat-blackout-on");
      }
      const rawCurtain = document.getElementById("anti-cheat-blackout-curtain");
      if (rawCurtain) rawCurtain.style.display = "none";
    }
  }, []);

  // Activación con Watchdog de seguridad (la pantalla NUNCA se queda pegada en negro)
  const activateDrmBlackout = useCallback((autoDismissMs = 1800) => {
    setIsScreenBlackedOut(true);
    if (typeof document !== "undefined") {
      if (document.body) {
        document.body.classList.add("anticheat-blackout-on");
      }
      const rawCurtain = document.getElementById("anti-cheat-blackout-curtain");
      if (rawCurtain) rawCurtain.style.display = "flex";
    }
    // Watchdog automático que garantiza reactivación en máximo 1.8 segundos
    if (blackoutTimeoutRef.current) {
      clearTimeout(blackoutTimeoutRef.current);
    }
    blackoutTimeoutRef.current = setTimeout(() => {
      deactivateDrmBlackout();
    }, autoDismissMs);
  }, [deactivateDrmBlackout]);

  // Sincronizar si cambia el prop student desde el padre (aislamiento estricto por cuenta)
  useEffect(() => {
    if (student) {
      setCurrentStudentData((prev) => {
        // Si el estudiante cambió (número de cuenta distinto), descartar completamente el estado anterior
        if (!prev || prev.numero_cuenta !== student.numero_cuenta) {
          return student;
        }
        return {
          ...prev,
          ...student,
          notas: student.notas || prev.notas || {},
          asistencias: student.asistencias || prev.asistencias || {}
        };
      });
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
      setAcademicError("");
      try {
        const [resSemanas, resTemario, resPuntajes, resStudent] = await Promise.all([
          api.semanas.getConfig(carreraKey),
          api.temario.getAll({ carrera: carreraKey }),
          api.temario.getPuntajes(carreraKey),
          cuentaKey
            ? api.estudiantes.getByCuenta(carreraKey, cuentaKey, student?.seccion_id)
            : Promise.resolve({ data: null })
        ]);
        if (!Array.isArray(resSemanas?.data) || !Array.isArray(resTemario?.data) ||
          (cuentaKey && (!resStudent?.data || String(resStudent.data.numero_cuenta) !== String(cuentaKey)))) {
          throw new Error("La información académica está incompleta.");
        }
        if (isMounted) {
          setSemanasConfig(resSemanas.data);
          setTemario(resTemario.data);
          setConfigPuntajes(resPuntajes?.data || null);
          if (resStudent?.data && (!cuentaKey || String(resStudent.data.numero_cuenta) === String(cuentaKey))) {
            setCurrentStudentData(resStudent.data);
            try {
              if (cuentaKey) {
                safeStorage.setItem(`histolab_student_user_${cuentaKey}`, JSON.stringify(resStudent.data));
              }
            } catch (e) {
              console.warn("Aviso al actualizar sesión en safeStorage:", e);
            }
          }
        }
      } catch (err) {
        console.error("Error al cargar datos académicos de estudiante:", err);
        if (isMounted) setAcademicError("No pudimos actualizar tu información académica. Revisa tu conexión y vuelve a intentarlo.");
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
  }, [carreraKey, cuentaKey, student?.seccion_id, academicReload]);

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

  // Cargar catálogo, estado en vivo y entregas como una instantánea de la sección.
  const loadStudentQuizzes = useCallback(async () => {
    const request = ++quizLoadRequestRef.current;
    setLoadingQuizzes(true);
    setQuizLoadError("");
    try {
      const secId = effectiveStudent?.seccion_id || effectiveStudent?.seccion?.id || await resolveStudentSectionId();
      if (request !== quizLoadRequestRef.current) return;
      if (!secId) throw new Error("No se pudo identificar tu sección. Actualiza tus datos e inténtalo de nuevo.");
      const res = await api.pruebas.getBySeccion(secId);
      if (res?.success === false || !Array.isArray(res?.data)) throw new Error("No se pudo consultar el catálogo de pruebas.");
      const liveEntries = await Promise.all(res.data.map(async quiz => {
        const response = await api.pruebas.getLiveState(secId, quiz.numero_semana);
        if (response?.success === false) throw new Error("No se pudo verificar el estado de las pruebas.");
        return [quiz.numero_semana, response?.data || null];
      }));
      const liveMap = Object.fromEntries(liveEntries);
      const publishedOrLive = res.data.filter(quiz => {
        const session = liveMap[quiz.numero_semana];
        const live = Boolean(
          (session && (session.habilitada || ["lobby", "en_pregunta", "esperando_siguiente"].includes(session.estado)) && !["finalizada", "inactiva"].includes(session.estado)) ||
          (quiz.habilitada_en_vivo === true && (!session || session.estado !== "finalizada"))
        );
        return quiz.publicada === true || String(quiz.publicada) === "true" || quiz.estado === "publicada" || live;
      });
      const submissionEntries = await Promise.all(publishedOrLive.map(async quiz => {
        const response = await api.pruebas.getMiEntrega(secId, quiz.numero_semana, cuentaKey);
        if (response?.success === false) throw new Error("No se pudieron verificar tus entregas.");
        return [quiz.numero_semana, response?.data || null];
      }));
      if (request !== quizLoadRequestRef.current) return;
      setLiveSessionsMap(liveMap);
      setOnlineQuizzes(publishedOrLive);
      setMakeupAssignments(Array.isArray(res.reposiciones) ? res.reposiciones : []);
      setExistingSubmissions(Object.fromEntries(submissionEntries.filter(([, submission]) => submission)));
      if (cuentaKey) res.data.forEach(quiz => {
        api.pruebas.sendLiveHeartbeat(secId, quiz.numero_semana, {
          numero_cuenta: cuentaKey, nombre_completo: effectiveStudent?.nombre_completo || "Estudiante", pregunta_vista: -1
        }).catch(() => {});
      });
    } catch (error) {
      if (request === quizLoadRequestRef.current) setQuizLoadError(error.message || "No se pudieron cargar las pruebas. Revisa tu conexión e inténtalo de nuevo.");
    } finally {
      if (request === quizLoadRequestRef.current) setLoadingQuizzes(false);
    }
  }, [effectiveStudent, cuentaKey, resolveStudentSectionId]);

  // Cargar catálogo de pruebas de inmediato al montar la vista
  useEffect(() => {
    loadStudentQuizzes();
    return () => { quizLoadRequestRef.current += 1; };
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
    if (quizLoadError || loadingQuizzes) return null;
    return (onlineQuizzes || []).find((q) => {
      const s = liveSessionsMap[q.numero_semana];
      const isSubmitted = Boolean(existingSubmissions[q.numero_semana]);
      const isLiveActive = Boolean(
        (s && (s.habilitada || s.estado === "lobby" || s.estado === "en_pregunta" || s.estado === "esperando_siguiente") && s.estado !== "finalizada" && s.estado !== "inactiva") ||
        (q.habilitada_en_vivo === true && (!s || s.estado !== "finalizada"))
      );
      return isLiveActive && !isSubmitted;
    });
  }, [onlineQuizzes, liveSessionsMap, existingSubmissions, quizLoadError, loadingQuizzes]);

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
          if (isQuizItemMultiSlot(it)) {
            initAnswers[q.id][it.id] = esPreguntaPerdida
              ? Array(quizItemSlotCount(it)).fill("sin_responder")
              : Array(quizItemSlotCount(it)).fill("");
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
    setLiveConnection("connecting");

    const now = Date.now();
    quizStartTimeRef.current = now;
    quizEndTimeRef.current = now + initialSecs * 1000;
    lastTickTimeRef.current = now;

    // 4. Reiniciar auditoría y contadores de integridad
    setStrikesCount(0);
    setIncidentsList([]);
    setViolationModal(null);
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
      // La salida de pantalla completa ocurre antes de que React retire los
      // listeners del examen. No debe crear una infracción ni restaurar el intento.
      autoSubmitTriggeredRef.current = true;

      if (forcedReason?.motivo === "expulsion_infracciones") {
        notify("Prueba bloqueada y enviada automáticamente por exceder el límite de advertencias.", "warning");
      } else if (forcedReason?.motivo === "tiempo_agotado") {
        notify("Tiempo concluido. Tu prueba ha sido enviada exitosamente.", "info");
      } else if (forcedReason?.motivo === "entrega_anticipada_por_salida") {
        notify("Evaluación finalizada y enviada con las respuestas contestadas hasta este momento.", "info");
      } else {
        notify(submittedData?.estado === "calificado" ? "¡Prueba entregada y calificada automáticamente!" : "¡Prueba entregada! Los apartados automáticos están calificados; los demás esperan revisión del instructor titular de la sección.", "success");
      }

      const finalData = {
        ...submittedData,
        estado: submittedData?.estado || "enviado",
        fecha_envio: submittedData?.fecha_envio || new Date().toISOString()
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
      deactivateDrmBlackout();
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
    [activeQuizToTake, clearActiveAttemptFromDisk, getPendingSubmissionStorageKey, loadStudentQuizzes, notify, deactivateDrmBlackout]
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
      conexion_al_enviar: navigator.onLine ? "online" : "offline",
      politica_integridad: "visibilidad-v2",
      intentos_pegar_texto: pasteCountRef.current || 0,

    };

    const payload = {
      quiz_id: activeQuizToTake.id,
      numero_semana: activeQuizToTake.numero_semana,
      numero_cuenta: cuentaKey,
      nombre_completo: effectiveStudent?.nombre_completo,
      carrera: carreraKey,
      respuestas: quizAnswersRef.current || quizAnswers,
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
      const replacement = onlineQuizzes.find(quiz => Number(quiz.numero_semana) === Number(sem) && quiz.reposicion);
      if (replacement && replacement.id !== activeQuizToTake.id) {
        clearActiveAttemptFromDisk(sem);
        setActiveQuizToTake(null);
        setQuizAnswers({});
        notify("Tienes una prueba de reposición asignada. Ingresa desde el catálogo actualizado.", "info");
        return;
      }
      if (existingSubmissions[sem]) {
        autoSubmitTriggeredRef.current = true;
        clearActiveAttemptFromDisk(sem);
        setActiveQuizToTake(null);
        return;
      }
      const activeKey = getActiveAttemptStorageKey(sem);
      const activeRaw = safeStorage.getItem(activeKey);
      if (activeRaw) {
        try {
          const saved = JSON.parse(activeRaw);
          if (saved?.quiz?.id && saved.quiz.id !== activeQuizToTake.id) { clearActiveAttemptFromDisk(sem); return; }
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
      if (existingSubmissions[sem]) {
        clearActiveAttemptFromDisk(sem);
        continue;
      }
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
          if (saved?.quiz?.id && saved.quiz.id !== quiz.id) { clearActiveAttemptFromDisk(sem); continue; }
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
  }, [onlineQuizzes, activeQuizToTake, existingSubmissions, isExamSealedOffline, getActiveAttemptStorageKey, getPendingSubmissionStorageKey, clearActiveAttemptFromDisk, notify]);

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


  // A departure is an observed policy event, not proof of cheating.
  const submitQuizRef = useRef(handleSubmitQuiz);
  submitQuizRef.current = handleSubmitQuiz;
  const registerViolation = (tipo, detalle, segundosFuera = 0) => {
    if (!activeQuizToTake || autoSubmitTriggeredRef.current || isExamSealedOffline || isSubmittingRef.current || isConfirmingRef.current) return;
    const nextStrike = Math.min(3, strikesCountRef.current + 1);
    strikesCountRef.current = nextStrike;
    totalTimeOutRef.current += segundosFuera;
    setStrikesCount(nextStrike);
    const incident = { tipo, detalle, strike: nextStrike, segundosFuera, hora: new Date().toISOString(), origen: "cliente", politica: "visibilidad-v2" };
    incidentsListRef.current = [...incidentsListRef.current.slice(-99), incident];
    setIncidentsList(incidentsListRef.current);
    saveActiveAttemptToDisk(activeQuizToTake, shuffledQuestions, quizAnswersRef.current, quizStartTimeRef.current, quizEndTimeRef.current, nextStrike, incidentsListRef.current, totalTimeOutRef.current);
    deactivateDrmBlackout();
    if (nextStrike >= 3) {
      autoSubmitTriggeredRef.current = true;
      setViolationModal({ strike: 3, isFinal: true, mensaje: "Se registraron tres salidas prolongadas de la evaluación durante preguntas activas. La prueba se cerrará según las normas y las incidencias quedarán disponibles para revisión del instructor. Esto no determina por sí solo que hubo trampa." });
      submitQuizRef.current({ motivo: "expulsion_infracciones" });
    } else {
      setViolationModal({ strike: nextStrike, isFinal: false, segundosFuera, mensaje: `La evaluación dejó de estar visible durante ${segundosFuera} segundos. Advertencia ${nextStrike} de 3. Mantén esta pantalla abierta; la tercera salida prolongada cierra y envía la prueba para revisión del instructor.` });
    }
  };

  const confirmedAnswersRef = useRef(answeredQuestionsMap);
  confirmedAnswersRef.current = answeredQuestionsMap;

  // Sincronización en vivo vía Heartbeat con el servidor durante la prueba
  useEffect(() => {
    if (!activeQuizToTake || isExamSealedOffline) return;

    let isMounted = true;
    const sem = activeQuizToTake.numero_semana;
    let heartbeatPending = false;

    const sendHeartbeat = async () => {
      if (!isMounted || heartbeatPending) return;
      heartbeatPending = true;
      let slowConnectionTimeout;
      try {
        slowConnectionTimeout = setTimeout(() => { if (isMounted) setLiveConnection("reconnecting"); }, 8000);
        let secId = effectiveStudent?.seccion_id || effectiveStudent?.seccion?.id;
        if (!secId) {
          secId = await resolveStudentSectionId();
        }
        if (!secId || !isMounted) return;

        const curAnswers = quizAnswersRef.current || quizAnswers;
        const curIdx = activeLiveStateRef.current?.pregunta_actual_idx ?? 0;
        const curQ = (activeQuizToTake?.preguntas || [])[curIdx];
        const curAns = curQ ? curAnswers[curQ.id] : null;
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
        const hasAnswered = Boolean(confirmedAnswersRef.current[curIdx] || hasContent);

        const res = await api.pruebas.sendLiveHeartbeat(secId, sem, {
          numero_cuenta: cuentaKey,
          nombre_completo: effectiveStudent?.nombre_completo,
          respuestas_parciales: curAnswers,
          pregunta_vista: curIdx,
          ha_respondido: hasAnswered,
          integridad: { strikes: strikesCountRef.current, tiempo_fuera_segundos: totalTimeOutRef.current }
        });

        if (res?.success && res.data && isMounted) {
          const liveData = res.data;
          setLiveConnection("connected");
          const remoteStrikes = Math.min(3, Math.max(0, Number(liveData.integridad?.strikes) || 0));
          if (remoteStrikes > strikesCountRef.current) {
            strikesCountRef.current = remoteStrikes;
            setStrikesCount(remoteStrikes);
          }
          if (remoteStrikes >= 3 && !autoSubmitTriggeredRef.current) {
            autoSubmitTriggeredRef.current = true;
            submitQuizRef.current({ motivo: "expulsion_infracciones" });
          }
          setActiveLiveState(liveData);

          // Detección cuando el docente desde control en vivo cambia de pregunta con los botones
          const incomingIdx = liveData.pregunta_actual_idx;
          const prevIdx = lastKnownQuestionIdxRef.current;

          if (typeof incomingIdx === "number" && prevIdx !== null && incomingIdx !== prevIdx) {
            lastKnownQuestionIdxRef.current = incomingIdx;

            // 1. Marcar como respondida y guardada la pregunta anterior
            setAnsweredQuestionsMap((prev) => ({ ...prev, [prevIdx]: true }));

            // 2. Persistir en almacenamiento local inmediatamente
            saveActiveAttemptToDisk(
              activeQuizToTake,
              shuffledQuestions,
              curAnswers,
              quizStartTimeRef.current,
              quizEndTimeRef.current,
              strikesCountRef.current,
              incidentsListRef.current,
              totalTimeOutRef.current
            );

            // 3. Desenfocar input activo para ocultar teclado en móviles
            if (document.activeElement && typeof document.activeElement.blur === "function") {
              document.activeElement.blur();
            }

            notify(`Pregunta #${incomingIdx + 1} iniciada por el instructor titular de la sección. Tu respuesta previa quedó guardada.`, "info");
          } else if (typeof incomingIdx === "number") {
            lastKnownQuestionIdxRef.current = incomingIdx;
          }

          if (liveData.estado === "en_pregunta") {
            setTimeRemainingSeconds(liveData.tiempo_restante_segundos ?? 90);
          }

          // Si el docente finalizó la prueba para toda la sección
          if (liveData.estado === "finalizada" && !autoSubmitTriggeredRef.current) {
            autoSubmitTriggeredRef.current = true;
            handleSubmitQuiz({ motivo: "finalizada_por_docente" });
          }
        } else if (isMounted) {
          setLiveConnection("reconnecting");
        }
      } catch (err) {
        if (isMounted) setLiveConnection("reconnecting");
        console.warn("Aviso en heartbeat:", err.message);
      } finally {
        clearTimeout(slowConnectionTimeout);
        heartbeatPending = false;
      }
    };

    sendHeartbeatRef.current = sendHeartbeat;
    sendHeartbeat();
    const heartbeatInterval = setInterval(sendHeartbeat, 1200);

    return () => {
      isMounted = false;
      sendHeartbeatRef.current = null;
      clearInterval(heartbeatInterval);
    };
  }, [activeQuizToTake, effectiveStudent, cuentaKey, isExamSealedOffline, resolveStudentSectionId, shuffledQuestions, saveActiveAttemptToDisk, notify]);

  // Auto-guardado garantizado al terminarse el tiempo de cada pregunta
  useEffect(() => {
    if (!activeQuizToTake || isExamSealedOffline || activeLiveState?.estado !== "en_pregunta") return;
    if (timeRemainingSeconds === 0) {
      const curIdx = activeLiveStateRef.current?.pregunta_actual_idx ?? 0;
      setAnsweredQuestionsMap((prev) => ({ ...prev, [curIdx]: true }));
      saveActiveAttemptToDisk(
        activeQuizToTake,
        shuffledQuestions,
        quizAnswersRef.current || quizAnswers,
        quizStartTimeRef.current,
        quizEndTimeRef.current,
        strikesCountRef.current,
        incidentsListRef.current,
        totalTimeOutRef.current
      );
      if (sendHeartbeatRef.current) {
        sendHeartbeatRef.current();
      }
    }
  }, [timeRemainingSeconds, activeQuizToTake, isExamSealedOffline, activeLiveState?.estado, shuffledQuestions, saveActiveAttemptToDisk]);

  // Decremento local fluido de segundo a segundo mientras está en pregunta
  useEffect(() => {
    if (!activeQuizToTake || isExamSealedOffline || activeLiveState?.estado !== "en_pregunta") return;

    const interval = setInterval(() => {
      setTimeRemainingSeconds((prev) => {
        if (prev <= 1) {
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [activeQuizToTake, isExamSealedOffline, activeLiveState?.estado]);

  const integrityCallbacksRef = useRef({});
  integrityCallbacksRef.current = {
    isActive: () => Boolean(activeQuizToTake && !isExamSealedOffline && !autoSubmitTriggeredRef.current && activeLiveStateRef.current?.estado === "en_pregunta"),
    isSuppressed: () => isSubmittingRef.current || isConfirmingRef.current || Boolean(violationModalRef.current),
    onDeparture: seconds => registerViolation("salida_de_pantalla", "La evaluación dejó de estar visible durante una pregunta activa.", seconds),
    onBlocked: type => {
      if (type === "pegar_texto") pasteCountRef.current += 1;
      const incident = { tipo: type, detalle: "Acción bloqueada dentro de la evaluación; no implica una infracción confirmada.", strike: strikesCountRef.current, segundosFuera: 0, hora: new Date().toISOString(), origen: "cliente" };
      incidentsListRef.current = [...incidentsListRef.current.slice(-99), incident];
      setIncidentsList(incidentsListRef.current);
      saveActiveAttemptToDisk(activeQuizToTake, shuffledQuestions, quizAnswersRef.current, quizStartTimeRef.current, quizEndTimeRef.current, strikesCountRef.current, incidentsListRef.current, totalTimeOutRef.current);
      notify("Esta acción está deshabilitada durante la evaluación.", "warning");
    }
  };
  useEffect(() => {
    if (!activeQuizToTake || isExamSealedOffline) return;
    return observeQuizIntegrity({
      document, window,
      isActive: () => integrityCallbacksRef.current.isActive(),
      isSuppressed: () => integrityCallbacksRef.current.isSuppressed(),
      onHidden: () => activateDrmBlackout(),
      onVisible: deactivateDrmBlackout,
      onDeparture: seconds => integrityCallbacksRef.current.onDeparture(seconds),
      onBlocked: type => integrityCallbacksRef.current.onBlocked(type),
      onFullscreen: current => setIsFullscreenActive(current)
    });
  }, [activeQuizToTake, isExamSealedOffline, activateDrmBlackout, deactivateDrmBlackout]);

  // G. Auto-desplazamiento inteligente para cuando el teclado virtual de celular se abre
  useEffect(() => {
    if (!activeQuizToTake || isExamSealedOffline) return;

    let timeoutId = null;
    const handleViewportChange = () => {
      const el = document.activeElement;
      if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA")) {
        if (timeoutId) clearTimeout(timeoutId);
        timeoutId = setTimeout(() => {
          el.scrollIntoView({ behavior: "smooth", block: "center" });
        }, 180);
      }
    };

    if (typeof window !== "undefined" && window.visualViewport) {
      window.visualViewport.addEventListener("resize", handleViewportChange);
      window.visualViewport.addEventListener("scroll", handleViewportChange);
    }

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
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
      const prevVal = prev[preguntaId];
      const currentQ = (prevVal && typeof prevVal === "object" && !Array.isArray(prevVal)) ? { ...prevVal } : {};
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

      quizAnswersRef.current = updated;

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

  // Auto-guardado garantizado al terminar de escribir en una casilla de respuesta (onBlur)
  const handleAnswerBlur = (preguntaId) => {
    if (isExamSealedOffline || !activeQuizToTake) return;
    const curIdx = activeLiveStateRef.current?.pregunta_actual_idx ?? 0;
    const currentAnswers = quizAnswersRef.current || quizAnswers;
    const curQAnswer = currentAnswers[preguntaId];

    const hasValue = Boolean(
      curQAnswer &&
      (typeof curQAnswer === "string"
        ? curQAnswer.trim()
        : typeof curQAnswer?.respuesta === "string"
        ? curQAnswer.respuesta.trim()
        : Object.values(curQAnswer || {}).some((v) =>
            typeof v === "string" ? v.trim() : Array.isArray(v) && v.some((x) => String(x).trim())
          ))
    );

    if (hasValue) {
      setAnsweredQuestionsMap((prev) => ({ ...prev, [curIdx]: true }));
    }

    // Guardado persistente inmediato en almacenamiento local
    saveActiveAttemptToDisk(
      activeQuizToTake,
      shuffledQuestions,
      currentAnswers,
      quizStartTimeRef.current,
      quizEndTimeRef.current,
      strikesCountRef.current,
      incidentsListRef.current,
      totalTimeOutRef.current
    );

    // Sincronización inmediata de latido con respuestas parciales al servidor
    if (sendHeartbeatRef.current) {
      sendHeartbeatRef.current();
    }
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
    if (loadingAcademic || academicError || !effectiveStudent) {
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
  }, [effectiveStudent, configPuntajes, temario, semanasConfig, loadingAcademic, academicError]);

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

  // =========================================================================
  // AGRUPACIÓN INTEGRAL Y AUTORITATIVA POR PARCIALES (I, II, III PARCIAL)
  // Garantiza cero mezclas ni translocaciones entre periodos académicos
  // =========================================================================
  const parcialesData = useMemo(() => {
    const palette = [
      { accent: "#3b82f6", bgLight: "#eff6ff", borderLight: "#bfdbfe" },
      { accent: "#8b5cf6", bgLight: "#f5f3ff", borderLight: "#ddd6fe" },
      { accent: "#ec4899", bgLight: "#fdf2f8", borderLight: "#fbcfe8" }
    ];
    const groupName = week => {
      const exams = examenesList || [];
      const exam = exams.find(ex => Number(ex.semana) >= Number(week.numero_semana)) || exams[exams.length - 1];
      return String(week.parcial || exam?.parcialName || "I Parcial").trim();
    };
    const names = [...new Set((activeCareerWeeks || []).length ? activeCareerWeeks.map(groupName) : (examenesList || []).map(exam => exam.parcialName))];
    const pDefs = names.map((label, index) => ({
      key: label, label, roman: ["I", "II", "III", "IV", "V"][index] || String(index + 1), ...palette[index % palette.length]
    }));
    const weekToParcialMap = new Map((activeCareerWeeks || []).map(week => [Number(week.numero_semana), groupName(week)]));

    // Mapeo de tema a Parcial por medio del temario oficial
    const topicToParcialMap = new Map();
    (temario || []).forEach((t) => {
      const semNum = Number(t.semana) || 0;
      const key = weekToParcialMap.get(semNum) || groupName({ numero_semana: semNum, parcial: t.parcial });
      if (t.id) topicToParcialMap.set(String(t.id), key);
      if (t.titulo) topicToParcialMap.set(String(t.titulo).trim().toLowerCase(), key);
    });

    return pDefs.map((pDef) => {
      const pKey = pDef.key;

      // Semanas de este parcial
      const weeks = (activeCareerWeeks || []).filter((w) => {
        return weekToParcialMap.get(Number(w.numero_semana)) === pKey;
      });
      const weekNums = weeks.map((w) => Number(w.numero_semana));

      // Cada examen conserva su semana, incluso si hay varios en un parcial.
      const examenes = (examenesList || []).filter(ex => ex.semana ? weekNums.includes(Number(ex.semana)) : ex.parcialName === pDef.label);

      // Manuales pertenecientes a este parcial
      const manuales = (manualesList || []).filter((m) => {
        if (m.semana && weekNums.includes(Number(m.semana))) return true;
        if (m.temaId && topicToParcialMap.get(String(m.temaId)) === pKey) return true;
        if (m.titulo && topicToParcialMap.get(String(m.titulo).trim().toLowerCase()) === pKey) return true;
        return false;
      });

      // Pruebas cortas de este parcial
      const pruebas = (pruebasList || []).filter((pr) => {
        return weekNums.includes(Number(pr.semana));
      });

      // Historial y desglose de asistencias del parcial
      let asistenciasCount = 0;
      let faltasJustificadas = 0;
      let faltasInjustificadas = 0;
      let semanasRegistradas = 0;

      const semanasAsistencia = weeks.map((w) => {
        const sem = Number(w.numero_semana);
        const val =
          asistencias[`asistencia_${sem}`] ??
          asistencias[`semana_${sem}`] ??
          effectiveStudent?.[`Asistencia de la semana ${sem}`] ??
          effectiveStudent?.[`asistencia_${sem}`] ??
          null;

        if (val) {
          semanasRegistradas++;
          if (val === "Asistio") asistenciasCount++;
          else if (val === "Falta justificada") faltasJustificadas++;
          else if (val === "Falta injustificada") faltasInjustificadas++;
        }

        return {
          semana: sem,
          nombre: getWeekDisplayName(w),
          estado: val || "Sin registrar",
          reposicion: getMakeupOutcome(asistencias, sem),
          esExamen: Boolean(w.es_examen)
        };
      });

      // Pérdida de derecho a examen en este parcial por 2+ faltas injustificadas
      const perdioDerecho = faltasInjustificadas >= 2;

      // Subtotales de notas del parcial
      let subtotalManuales = 0;
      let manualesCalificadosCount = 0;
      manuales.forEach((m) => {
        if (m.nota !== null && m.nota !== undefined && m.nota !== "" && !isNaN(Number(m.nota))) {
          subtotalManuales += Number(m.nota);
          manualesCalificadosCount++;
        }
      });
      subtotalManuales = Math.round(subtotalManuales * 1000) / 1000;

      let subtotalPruebas = 0;
      let pruebasCalificadasCount = 0;
      pruebas.forEach((pr) => {
        if (pr.nota !== null && pr.nota !== undefined && pr.nota !== "" && !isNaN(Number(pr.nota))) {
          subtotalPruebas += Number(pr.nota);
          pruebasCalificadasCount++;
        }
      });
      subtotalPruebas = Math.round(subtotalPruebas * 1000) / 1000;

      const notaExamenNum = examenes.reduce((sum, exam) => sum + (Number(exam.nota) || 0), 0);

      const totalPuntosParcial = Math.round((subtotalManuales + subtotalPruebas + (notaExamenNum || 0)) * 1000) / 1000;
      const minSem = weekNums.length > 0 ? Math.min(...weekNums) : null;
      const maxSem = weekNums.length > 0 ? Math.max(...weekNums) : null;
      const rangoSemanasText = minSem !== null ? (minSem === maxSem ? `Semana ${minSem}` : `Semanas ${minSem} a ${maxSem}`) : "Por calendarizar";

      return {
        ...pDef,
        weeks,
        weekNums,
        rangoSemanasText,
        examenes,
        manuales,
        pruebas,
        semanasAsistencia,
        asistenciasCount,
        faltasJustificadas,
        faltasInjustificadas,
        semanasRegistradas,
        perdioDerecho,
        subtotalManuales,
        manualesCalificadosCount,
        subtotalPruebas,
        pruebasCalificadasCount,
        notaExamen: notaExamenNum,
        totalPuntosParcial
      };
    });
  }, [activeCareerWeeks, temario, examenesList, manualesList, pruebasList, asistencias, effectiveStudent]);

  const navigatePortal = tab => {
    setActiveTab(tab);
    if (tab === "pruebas" || tab === "seguridad") {
      setActiveQuizToTake(null);
      setReviewingSubmission(null);
    }
  };

  return (
    <div className="student-portal" data-taking-quiz={Boolean(activeQuizToTake)}
      style={{
        "--student-accent": theme.primary,
        "--student-soft": theme.bg,
        "--student-line": theme.border,
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
        .sp-hero-progress-card {
          transition: transform 0.2s ease, box-shadow 0.2s ease;
        }
        .sp-hero-progress-card:hover {
          box-shadow: 0 8px 26px -4px rgba(0, 0, 0, 0.07) !important;
        }
        .sp-parcial-selector::-webkit-scrollbar {
          display: none;
        }
        .sp-parcial-selector {
          -ms-overflow-style: none;
          scrollbar-width: none;
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
        /* Sistema DRM de Protección Anti-Capturas y Blackout Inmediato */
        body.anticheat-blackout-on {
          background: #000000 !important;
          overflow: hidden !important;
        }
        body.anticheat-blackout-on .sp-quiz-take-card {
          opacity: 0 !important;
          filter: brightness(0) !important;
        }
        #anti-cheat-blackout-curtain {
          display: none;
          position: fixed !important;
          inset: 0 !important;
          width: 100vw !important;
          height: 100vh !important;
          z-index: 9999990 !important;
          background: #000000 !important;
          color: #ffffff;
          align-items: center;
          justify-content: center;
          flex-direction: column;
          gap: 1.25rem;
          pointer-events: auto !important;
          cursor: pointer;
        }
        body.anticheat-blackout-on #anti-cheat-blackout-curtain {
          display: flex !important;
          opacity: 1 !important;
          visibility: visible !important;
        }
        .sp-violation-modal-overlay {
          position: fixed !important;
          inset: 0 !important;
          z-index: 2147483647 !important;
          display: flex !important;
          align-items: center !important;
          justify-content: center !important;
          visibility: visible !important;
          opacity: 1 !important;
          pointer-events: all !important;
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
            overflow-x: auto !important;
            -webkit-overflow-scrolling: touch;
          }
          .sp-tab-btn {
            flex: 1 1 0 !important;
            min-width: 0 !important;
            max-width: 25% !important;
            box-sizing: border-box !important;
            justify-content: center !important;
            align-items: center !important;
            padding: 0.42rem 0.12rem !important;
            font-size: 0.69rem !important;
            border-radius: 0.5rem !important;
            border-bottom: none !important;
            white-space: nowrap !important;
            gap: 0.18rem !important;
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
          .sp-hero-progress-card {
            padding: 1rem 0.85rem !important;
            border-radius: 0.85rem !important;
          }
          .sp-parcial-selector {
            width: 100% !important;
            justify-content: flex-start !important;
            -webkit-overflow-scrolling: touch !important;
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
            -webkit-user-select: none !important;
            -moz-user-select: none !important;
            -ms-user-select: none !important;
            user-select: none !important;
            -webkit-touch-callout: none !important;
          }
          .sp-quiz-take-card input,
          .sp-quiz-take-card textarea {
            -webkit-user-select: text !important;
            user-select: text !important;
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
              <div className="sp-live-alert student-portal__live">
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
                      El instructor titular de tu sección ha activado la sesión en vivo para tu sección. Ingresa ahora para realizar tu prueba sincronizado con la clase.
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

            <header className="student-portal__header">
              <div className="student-portal__identity"><span className="student-portal__avatar"><GraduationCap size={26} /></span>
                <div><p className="student-portal__eyebrow">PORTAL DE ESTUDIANTES · HISTOLAB</p><h2>{effectiveStudent?.nombre_completo || "Tu espacio de aprendizaje"}</h2><p>Cuenta {effectiveStudent?.numero_cuenta} <span aria-hidden="true">·</span> {carreraKey}</p></div>
              </div>
              <div className="student-portal__header-actions"><button type="button" className="student-portal__button" disabled={loadingAcademic} onClick={() => setAcademicReload(value => value + 1)}><RefreshCw size={16} className={loadingAcademic ? "animate-spin" : ""} />{loadingAcademic ? "Actualizando…" : "Actualizar datos"}</button><button type="button" className="student-portal__button" onClick={() => navigatePortal("seguridad")}><KeyRound size={16} />Mi cuenta</button></div>
            </header>

            {/* AVISO DESTACADO DE PRUEBA EN VIVO TIPO KAHOOT */}
            {!anyLiveQuiz && !quizLoadError && !loadingQuizzes && activeLiveBannerSession && !existingSubmissions[activeLiveBannerSession.numero_semana] && !activeQuizToTake && (
              <div
                className="student-portal__live student-portal__live--session"
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
                      El instructor titular de tu sección habilitó la evaluación en directo. Entra ahora para sincronizarte antes de la Pregunta 1.
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

            <nav className="student-portal__nav" aria-label="Navegación del portal de estudiantes">
              {[
                { id: "inicio", label: "Inicio", short: "Inicio", Icon: House },
                { id: "calificaciones", label: "Mis calificaciones", short: "Notas", Icon: Award },
                { id: "asistencia", label: "Mi asistencia", short: "Asistencia", Icon: CalendarCheck },
                { id: "pruebas", label: "Pruebas semanales", short: "Pruebas", Icon: FileEdit },
                { id: "seguridad", label: "Mi cuenta", short: "Cuenta", Icon: KeyRound }
              ].map(({ id, label, short, Icon }) => <button type="button" key={id} aria-label={label} aria-current={activeTab === id ? "page" : undefined} onClick={() => navigatePortal(id)}><Icon size={20} /><span className="student-portal__nav-label">{label}</span><span className="student-portal__nav-short" aria-hidden="true">{short}</span>{id === "pruebas" && (anyLiveQuiz || activeLiveBannerSession) && <span className="student-portal__live-dot" aria-label="Prueba en vivo disponible" />}</button>)}
            </nav>

            {!activeQuizToTake && makeupAssignments.filter(item => item.estado === "asignada").map(item => <div className="student-makeup-notice" key={item.id}>
              <CalendarCheck size={21} aria-hidden="true" /><div><strong>Reposición asignada · Semana {item.semana}</strong><p>Sección {item.seccion} · {new Intl.DateTimeFormat("es-HN", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Tegucigalpa" }).format(new Date(item.practica_at))}. Tu matrícula y las notas se conservan en tu sección original.</p></div><button type="button" className="student-portal__button" onClick={() => navigatePortal("pruebas")}>Ver prueba</button>
            </div>)}

            {academicError && ["inicio", "calificaciones", "asistencia"].includes(activeTab) && <div className="student-portal__error" role="alert"><AlertCircle size={22} /><p>{academicError}</p><button type="button" className="student-portal__button" onClick={() => setAcademicReload(value => value + 1)}>Reintentar carga</button></div>}
            {loadingAcademic && ["calificaciones", "asistencia"].includes(activeTab) && <div className="student-dashboard__loading" role="status"><RefreshCw size={24} className="animate-spin" /><p>Cargando tu información académica…</p></div>}
            {activeTab === "inicio" && <StudentDashboard summary={academicSummary} attendance={attendanceStats} examStatus={derechoExamenesStatus} section={seccion} loading={loadingAcademic} error={academicError} onNavigate={navigatePortal} />}

        {/* =================================================================== */}
        {/* PESTAÑA A: MIS CALIFICACIONES - ORGANIZADO POR PARCIALES            */}
        {/* =================================================================== */}
        {activeTab === "calificaciones" && !loadingAcademic && !academicError && (
          <StudentGradesView summary={academicSummary} parciales={parcialesData} submissions={existingSubmissions}
            onAttendance={() => navigatePortal("asistencia")}
            onReview={(prueba, submission) => {
              const quiz = (onlineQuizzes || []).find(q => Number(q.numero_semana) === Number(prueba.semana)) || {
                numero_semana: prueba.semana, titulo: prueba.label
              };
              setActiveTab("pruebas");
              handleOpenReview(quiz, submission);
            }} />
        )}

        {/* =================================================================== */}
        {/* PESTAÑA B: CONTROL DE ASISTENCIA                                    */}
        {/* =================================================================== */}
        {activeTab === "asistencia" && !loadingAcademic && !academicError && (
          <StudentAttendanceView parciales={parcialesData} examStatus={derechoExamenesStatus} />
        )}

        {/* =================================================================== */}
        {/* PESTAÑA C: PRUEBAS SEMANALES EN LÍNEA                               */}
        {/* =================================================================== */}
        {activeTab === "pruebas" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
            {reviewingSubmission ? (
              /* CASO 2: REVISIÓN DE COMPROBANTE Y RESPUESTAS ENTREGADAS */
              <div
                className="student-quiz-receipt"
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
                <div className="student-quiz-receipt__header" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1.5px solid #f1f5f9", paddingBottom: "1rem" }}>
                  <div className="student-quiz-receipt__identity" style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                    <button
                      type="button"
                      aria-label="Volver a pruebas semanales"
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
                        {reviewingSubmission.quiz.titulo || `Prueba semanal ${reviewingSubmission.quiz.numero_semana}`}
                      </h3>
                    </div>
                  </div>

                  <div className="student-quiz-receipt__status"
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
                      ? (reviewingSubmission.submission.nota_obtenida !== null && reviewingSubmission.submission.nota_obtenida !== undefined && Number.isFinite(Number(reviewingSubmission.submission.nota_obtenida))
                          ? `Nota oficial: ${Number(reviewingSubmission.submission.nota_obtenida).toFixed(3)} / 5.000 pts`
                          : "Calificada · nota por sincronizar")
                      : "Entregada · en revisión"}
                  </div>
                </div>

                {reviewingSubmission.submission.comentarios && (
                  <div style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", padding: "0.85rem 1.1rem", borderRadius: "0.65rem", fontSize: "0.85rem", color: "#166534" }}>
                    💬 <strong>Comentarios del instructor titular de la sección:</strong> {reviewingSubmission.submission.comentarios}
                  </div>
                )}

                {/* Respuestas registradas */}
                <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
                  {(reviewingSubmission.quiz.preguntas || []).map((pregunta, qIdx) => {
                    const isBonus = Boolean(pregunta.es_bonus || qIdx === 5);
                    const qMaxPts = Number(pregunta.puntos || 1.0);

                    return (
                      <div
                        key={pregunta.id}
                        style={{
                          borderRadius: "1rem",
                          border: isBonus ? "2px solid #fde68a" : "2px solid #cbd5e1",
                          borderLeft: isBonus ? "7px solid #f59e0b" : "7px solid #0284c7",
                          background: "#ffffff",
                          boxShadow: "0 8px 24px -4px rgba(15, 23, 42, 0.08)",
                          overflow: "hidden",
                          display: "flex",
                          flexDirection: "column"
                        }}
                      >
                        {/* Barra de Título / Identificador Superior de la Pregunta */}
                        <div
                          style={{
                            padding: "0.8rem 1.25rem",
                            background: isBonus
                              ? "linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%)"
                              : "linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)",
                            borderBottom: isBonus ? "1.5px solid #fde68a" : "1.5px solid #e2e8f0",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            flexWrap: "wrap",
                            gap: "0.6rem"
                          }}
                        >
                          <div style={{ display: "flex", alignItems: "center", gap: "0.65rem", flexWrap: "wrap" }}>
                            <span
                              style={{
                                background: isBonus ? "#d97706" : "#0284c7",
                                color: "#ffffff",
                                fontWeight: 900,
                                fontSize: "0.82rem",
                                padding: "0.25rem 0.75rem",
                                borderRadius: "0.5rem",
                                letterSpacing: "0.04em",
                                textTransform: "uppercase",
                                boxShadow: isBonus
                                  ? "0 2px 6px rgba(217, 119, 6, 0.3)"
                                  : "0 2px 6px rgba(2, 132, 199, 0.3)"
                              }}
                            >
                              {isBonus ? "⭐ PREGUNTA BONUS" : `PREGUNTA ${pregunta.numero || qIdx + 1}`}
                            </span>

                            <span style={{ fontSize: "0.82rem", fontWeight: 800, color: isBonus ? "#92400e" : "#475569" }}>
                              Valor: {qMaxPts.toFixed(3)} pts {isBonus ? "(Extra)" : ""}
                            </span>
                          </div>

                          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                            <span
                              style={{
                                fontSize: "0.78rem",
                                fontWeight: 800,
                                color: "#64748b",
                                background: "#ffffff",
                                padding: "0.2rem 0.6rem",
                                borderRadius: "0.4rem",
                                border: "1px solid #cbd5e1"
                              }}
                            >
                              Reactivo {qIdx + 1} de {reviewingSubmission.quiz.preguntas.length}
                            </span>


                          </div>
                        </div>

                        {/* Cuerpo de la Pregunta */}
                        <div style={{ padding: "1.25rem", display: "flex", flexDirection: "column", gap: "1rem" }}>
                          {pregunta.enunciado && (
                            <div style={{ fontSize: "1rem", fontWeight: 800, color: "#0f172a", lineHeight: 1.45 }}>
                              {pregunta.enunciado}
                            </div>
                          )}

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
                              <div
                                style={{
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "space-between",
                                  flexWrap: "wrap",
                                  gap: "0.6rem",
                                  padding: "0.65rem 0.85rem",
                                  borderRadius: "0.55rem",
                                  background:
                                    !isGraded || !evalItem
                                      ? "#f8fafc"
                                      : evalItem.estado === "buena"
                                      ? "#f0fdf4"
                                      : evalItem.estado === "regular"
                                      ? "#fffbeb"
                                      : "#fef2f2",
                                  border:
                                    !isGraded || !evalItem
                                      ? "1px solid #e2e8f0"
                                      : evalItem.estado === "buena"
                                      ? "1.5px solid #86efac"
                                      : evalItem.estado === "regular"
                                      ? "1.5px solid #fde68a"
                                      : "1.5px solid #fca5a5",
                                  transition: "all 0.15s ease"
                                }}
                              >
                                <div style={{ display: "flex", alignItems: "center", gap: "0.55rem", flex: 1, minWidth: "200px" }}>
                                  <span
                                    style={{
                                      width: "22px",
                                      height: "22px",
                                      borderRadius: "50%",
                                      background: "#ffffff",
                                      border: "1px solid #cbd5e1",
                                      color: "#0284c7",
                                      display: "flex",
                                      alignItems: "center",
                                      justifyContent: "center",
                                      fontSize: "0.72rem",
                                      fontWeight: 800,
                                      flexShrink: 0
                                    }}
                                  >
                                    ✍️
                                  </span>
                                  <span
                                    style={{
                                      fontSize: "0.88rem",
                                      fontWeight: 700,
                                      color: directAnswer && String(directAnswer).trim() ? "#0f172a" : "#94a3b8",
                                      fontStyle: directAnswer && String(directAnswer).trim() ? "normal" : "italic"
                                    }}
                                  >
                                    {directAnswer && String(directAnswer).trim() ? directAnswer : "Sin respuesta enviada"}
                                  </span>
                                </div>

                                {/* Retroalimentación individual */}
                                {isGraded && (
                                  <div>
                                    {evalItem ? (
                                      <span
                                        style={{
                                          display: "inline-flex",
                                          alignItems: "center",
                                          gap: "0.3rem",
                                          fontSize: "0.74rem",
                                          fontWeight: 800,
                                          padding: "0.2rem 0.55rem",
                                          borderRadius: "0.35rem",
                                          background:
                                            evalItem.estado === "buena"
                                              ? "#dcfce7"
                                              : evalItem.estado === "regular"
                                              ? "#fef3c7"
                                              : "#fee2e2",
                                          color:
                                            evalItem.estado === "buena"
                                              ? "#15803d"
                                              : evalItem.estado === "regular"
                                              ? "#b45309"
                                              : "#dc2626",
                                          border: `1px solid ${
                                            evalItem.estado === "buena"
                                              ? "#86efac"
                                              : evalItem.estado === "regular"
                                              ? "#fde68a"
                                              : "#fca5a5"
                                          }`
                                        }}
                                      >
                                        {evalItem.estado === "buena" ? (
                                          <>
                                            <Check size={13} strokeWidth={3} />
                                            <span>Correcta (+{Number(evalItem.puntos_obtenidos || 0).toFixed(3)} pts)</span>
                                          </>
                                        ) : evalItem.estado === "regular" ? (
                                          <>
                                            <span>½ Regular (+{Number(evalItem.puntos_obtenidos || 0).toFixed(3)} pts)</span>
                                          </>
                                        ) : (
                                          <>
                                            <X size={13} strokeWidth={3} />
                                            <span>Incorrecta (0.000 pts)</span>
                                          </>
                                        )}
                                      </span>
                                    ) : (
                                      <span style={{ fontSize: "0.72rem", color: "#94a3b8", fontStyle: "italic" }}>
                                        Sin calificar
                                      </span>
                                    )}
                                  </div>
                                )}
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
                            const displayCompletion = item.tipo === "completacion" ? item.texto_completar || "" : "";
                            const isList = isQuizItemMultiSlot(item);
                            const cantSlots = quizItemSlotCount(item);
                            const defaultItemPts = Math.round((Number(pregunta.puntos || 1.0) / (pregunta.items.length || 1)) * 1000) / 1000;
                            const itemMaxPts = item.puntos !== undefined && !isNaN(Number(item.puntos)) ? Number(item.puntos) : defaultItemPts;

                            // Evaluación directa de todo el apartado (modo texto corto o retrocompatibilidad)
                            const evalItem = evaluaciones[`${pregunta.id}___${item.id}`];

                            // Sumar puntos obtenidos si se evaluó casilla por casilla
                            let earnedInSlots = 0;
                            let hasSlotEvaluations = false;
                            if (isList) {
                              for (let s = 0; s < cantSlots; s++) {
                                const se = evaluaciones[`${pregunta.id}___${item.id}___slot_${s}`];
                                if (se) {
                                  hasSlotEvaluations = true;
                                  earnedInSlots += Number(se.puntos_obtenidos) || 0;
                                }
                              }
                              earnedInSlots = Math.round(earnedInSlots * 1000) / 1000;
                            }

                            return (
                              <div
                                key={item.id}
                                style={{
                                  background: "#ffffff",
                                  padding: "0.9rem 1.1rem",
                                  borderRadius: "0.65rem",
                                  border: "1px solid #e2e8f0",
                                  display: "flex",
                                  flexDirection: "column",
                                  gap: "0.6rem"
                                }}
                              >
                                {/* Cabecera del Apartado */}
                                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "0.4rem" }}>
                                  <div style={{ display: "flex", alignItems: "center", gap: "0.45rem", flexWrap: "wrap" }}>
                                    <strong style={{ fontSize: "0.85rem", color: "#334155" }}>
                                      {String.fromCharCode(97 + itemIdx)}) {itemLabel}: {displayCompletion}
                                    </strong>
                                    <span
                                      style={{
                                        fontSize: "0.72rem",
                                        fontWeight: 800,
                                        color: "#0369a1",
                                        background: "#f0f9ff",
                                        padding: "0.12rem 0.45rem",
                                        borderRadius: "0.3rem",
                                        border: "1px solid #bae6fd"
                                      }}
                                    >
                                      {itemMaxPts.toFixed(3)} pt(s) {isList ? `(${cantSlots} casillas • puntaje distribuido entre casillas)` : ""}
                                    </span>
                                  </div>

                                  {/* Resumen de Calificación del Apartado */}
                                  {isGraded && (
                                    <>
                                      {isList && hasSlotEvaluations ? (
                                        <span
                                          style={{
                                            fontSize: "0.74rem",
                                            fontWeight: 800,
                                            padding: "0.15rem 0.55rem",
                                            borderRadius: "0.35rem",
                                            background: earnedInSlots === itemMaxPts ? "#dcfce7" : earnedInSlots > 0 ? "#fef3c7" : "#fee2e2",
                                            color: earnedInSlots === itemMaxPts ? "#15803d" : earnedInSlots > 0 ? "#b45309" : "#dc2626",
                                            border: `1px solid ${earnedInSlots === itemMaxPts ? "#86efac" : earnedInSlots > 0 ? "#fde68a" : "#fca5a5"}`
                                          }}
                                        >
                                          Total apartado: +{earnedInSlots.toFixed(3)} / {itemMaxPts.toFixed(3)} pts
                                        </span>
                                      ) : evalItem ? (
                                        <span
                                          style={{
                                            fontSize: "0.74rem",
                                            fontWeight: 800,
                                            padding: "0.15rem 0.55rem",
                                            borderRadius: "0.35rem",
                                            background: evalItem.estado === "buena" ? "#dcfce7" : evalItem.estado === "regular" ? "#fef3c7" : "#fee2e2",
                                            color: evalItem.estado === "buena" ? "#15803d" : evalItem.estado === "regular" ? "#b45309" : "#dc2626",
                                            border: `1px solid ${evalItem.estado === "buena" ? "#86efac" : evalItem.estado === "regular" ? "#fde68a" : "#fca5a5"}`
                                          }}
                                        >
                                          {evalItem.estado === "buena"
                                            ? `✓ Correcta (+${Number(evalItem.puntos_obtenidos || 0).toFixed(3)} pts)`
                                            : evalItem.estado === "regular"
                                            ? `½ Regular (+${Number(evalItem.puntos_obtenidos || 0).toFixed(3)} pts)`
                                            : "✗ Incorrecta (0 pts)"}
                                        </span>
                                      ) : null}
                                    </>
                                  )}
                                </div>

                                {/* Contenido de Respuestas */}
                                {!isList ? (
                                  /* Apartado Texto Corto - RETROALIMENTACIÓN INDIVIDUAL */
                                  <div
                                    style={{
                                      display: "flex",
                                      alignItems: "center",
                                      justifyContent: "space-between",
                                      flexWrap: "wrap",
                                      gap: "0.5rem",
                                      padding: "0.55rem 0.75rem",
                                      borderRadius: "0.5rem",
                                      background:
                                        !isGraded || !evalItem
                                          ? "#f8fafc"
                                          : evalItem.estado === "buena"
                                          ? "#f0fdf4"
                                          : evalItem.estado === "regular"
                                          ? "#fffbeb"
                                          : "#fef2f2",
                                      border:
                                        !isGraded || !evalItem
                                          ? "1px solid #e2e8f0"
                                          : evalItem.estado === "buena"
                                          ? "1.5px solid #86efac"
                                          : evalItem.estado === "regular"
                                          ? "1.5px solid #fde68a"
                                          : "1.5px solid #fca5a5",
                                      transition: "all 0.15s ease"
                                    }}
                                  >
                                    <div style={{ display: "flex", alignItems: "center", gap: "0.55rem", flex: 1, minWidth: "200px" }}>
                                      <span
                                        style={{
                                          width: "22px",
                                          height: "22px",
                                          borderRadius: "50%",
                                          background: "#ffffff",
                                          border: "1px solid #cbd5e1",
                                          color: "#0284c7",
                                          display: "flex",
                                          alignItems: "center",
                                          justifyContent: "center",
                                          fontSize: "0.72rem",
                                          fontWeight: 800,
                                          flexShrink: 0
                                        }}
                                      >
                                        ✍️
                                      </span>
                                      <span
                                        style={{
                                          fontSize: "0.88rem",
                                          fontWeight: 700,
                                          color: typeof userAns === "string" && userAns.trim() ? "#0f172a" : "#94a3b8",
                                          fontStyle: typeof userAns === "string" && userAns.trim() ? "normal" : "italic"
                                        }}
                                      >
                                        {typeof userAns === "string" && userAns.trim() ? userAns : "Sin respuesta enviada"}
                                      </span>
                                    </div>

                                    {/* Retroalimentación individual de texto corto */}
                                    {isGraded && (
                                      <div>
                                        {evalItem ? (
                                          <span
                                            style={{
                                              display: "inline-flex",
                                              alignItems: "center",
                                              gap: "0.3rem",
                                              fontSize: "0.74rem",
                                              fontWeight: 800,
                                              padding: "0.2rem 0.55rem",
                                              borderRadius: "0.35rem",
                                              background:
                                                evalItem.estado === "buena"
                                                  ? "#dcfce7"
                                                  : evalItem.estado === "regular"
                                                  ? "#fef3c7"
                                                  : "#fee2e2",
                                              color:
                                                evalItem.estado === "buena"
                                                  ? "#15803d"
                                                  : evalItem.estado === "regular"
                                                  ? "#b45309"
                                                  : "#dc2626",
                                              border: `1px solid ${
                                                evalItem.estado === "buena"
                                                  ? "#86efac"
                                                  : evalItem.estado === "regular"
                                                  ? "#fde68a"
                                                  : "#fca5a5"
                                              }`
                                            }}
                                          >
                                            {evalItem.estado === "buena" ? (
                                              <>
                                                <Check size={13} strokeWidth={3} />
                                                <span>Correcta (+{Number(evalItem.puntos_obtenidos || 0).toFixed(3)} pts)</span>
                                              </>
                                            ) : evalItem.estado === "regular" ? (
                                              <>
                                                <span>½ Regular (+{Number(evalItem.puntos_obtenidos || 0).toFixed(3)} pts)</span>
                                              </>
                                            ) : (
                                              <>
                                                <X size={13} strokeWidth={3} />
                                                <span>Incorrecta (0.000 pts)</span>
                                              </>
                                            )}
                                          </span>
                                        ) : (
                                          <span style={{ fontSize: "0.72rem", color: "#94a3b8", fontStyle: "italic" }}>
                                            Sin calificar
                                          </span>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                ) : (
                                  /* Apartado Listado con Múltiples Casillas - RETROALIMENTACIÓN INDIVIDUAL */
                                  <div style={{ display: "flex", flexDirection: "column", gap: "0.45rem", marginTop: "0.2rem" }}>
                                    {Array.from({ length: cantSlots }).map((_, rIdx) => {
                                      const rowVal = Array.isArray(userAns)
                                        ? userAns[rIdx]
                                        : (typeof userAns === "object" && userAns ? userAns[rIdx] : "");
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
                                            padding: "0.5rem 0.75rem",
                                            borderRadius: "0.5rem",
                                            background:
                                              !isGraded || !slotEval
                                                ? "#f8fafc"
                                                : slotEval.estado === "buena"
                                                ? "#f0fdf4"
                                                : slotEval.estado === "regular"
                                                ? "#fffbeb"
                                                : "#fef2f2",
                                            border:
                                              !isGraded || !slotEval
                                                ? "1px solid #e2e8f0"
                                                : slotEval.estado === "buena"
                                                ? "1.5px solid #86efac"
                                                : slotEval.estado === "regular"
                                                ? "1.5px solid #fde68a"
                                                : "1.5px solid #fca5a5",
                                            transition: "all 0.15s ease"
                                          }}
                                        >
                                          {/* Casilla y Respuesta enviada */}
                                          <div style={{ display: "flex", alignItems: "center", gap: "0.55rem", flex: 1, minWidth: "200px" }}>
                                            <span
                                              style={{
                                                width: "22px",
                                                height: "22px",
                                                borderRadius: "50%",
                                                background: "#ffffff",
                                                border: "1px solid #cbd5e1",
                                                color: "#475569",
                                                display: "flex",
                                                alignItems: "center",
                                                justifyContent: "center",
                                                fontSize: "0.72rem",
                                                fontWeight: 800,
                                                flexShrink: 0
                                              }}
                                            >
                                              {rIdx + 1}.
                                            </span>
                                            <span
                                              style={{
                                                fontSize: "0.88rem",
                                                fontWeight: 700,
                                                color: rowVal && String(rowVal).trim() ? "#0f172a" : "#94a3b8",
                                                fontStyle: rowVal && String(rowVal).trim() ? "normal" : "italic"
                                              }}
                                            >
                                              {item.tipo === "terminos_pareados" && <strong>{quizSlotLabel(item,rIdx)} → </strong>}{rowVal && String(rowVal).trim() ? rowVal : "Sin respuesta enviada"}
                                            </span>
                                          </div>

                                          {/* Retroalimentación individual de la casilla */}
                                          {isGraded && (
                                            <div>
                                              {slotEval ? (
                                                <span
                                                  style={{
                                                    display: "inline-flex",
                                                    alignItems: "center",
                                                    gap: "0.3rem",
                                                    fontSize: "0.74rem",
                                                    fontWeight: 800,
                                                    padding: "0.2rem 0.55rem",
                                                    borderRadius: "0.35rem",
                                                    background:
                                                      slotEval.estado === "buena"
                                                        ? "#dcfce7"
                                                        : slotEval.estado === "regular"
                                                        ? "#fef3c7"
                                                        : "#fee2e2",
                                                    color:
                                                      slotEval.estado === "buena"
                                                        ? "#15803d"
                                                        : slotEval.estado === "regular"
                                                        ? "#b45309"
                                                        : "#dc2626",
                                                    border: `1px solid ${
                                                      slotEval.estado === "buena"
                                                        ? "#86efac"
                                                        : slotEval.estado === "regular"
                                                        ? "#fde68a"
                                                        : "#fca5a5"
                                                    }`
                                                  }}
                                                >
                                                  {slotEval.estado === "buena" ? (
                                                    <>
                                                      <Check size={13} strokeWidth={3} />
                                                      <span>Correcta (+{Number(slotEval.puntos_obtenidos || 0).toFixed(3)} pts)</span>
                                                    </>
                                                  ) : slotEval.estado === "regular" ? (
                                                    <>
                                                      <span>½ Regular (+{Number(slotEval.puntos_obtenidos || 0).toFixed(3)} pts)</span>
                                                    </>
                                                  ) : (
                                                    <>
                                                      <X size={13} strokeWidth={3} />
                                                      <span>Incorrecta (0.000 pts)</span>
                                                    </>
                                                  )}
                                                </span>
                                              ) : (
                                                <span style={{ fontSize: "0.72rem", color: "#94a3b8", fontStyle: "italic" }}>
                                                  Casilla sin calificar
                                                </span>
                                              )}
                                            </div>
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
                  </div>
                );
              })}
                </div>
              </div>
            ) : (
              <StudentQuizzesView quizzes={onlineQuizzes} submissions={existingSubmissions} sessions={liveSessionsMap} parciales={parcialesData} weeks={semanasConfig}
                loading={loadingQuizzes} error={quizLoadError} onRefresh={loadStudentQuizzes}
                onStart={handleStartQuiz} onReview={handleOpenReview} />
            )}
          </div>
        )}
          </>
        ) : (
          <StudentQuizPlayer quiz={activeQuizToTake} liveState={activeLiveState} answers={quizAnswers}
            seconds={timeRemainingSeconds} strikes={strikesCount} online={isOnline} connection={liveConnection}
            sealed={isExamSealedOffline} submitting={submittingQuiz} confirmed={answeredQuestionsMap}
            studentName={effectiveStudent?.nombre_completo} account={cuentaKey}
            onExit={() => {
              if (["lobby", "inactiva"].includes(activeLiveStateRef.current?.estado)) {
                autoSubmitTriggeredRef.current = true;
                clearActiveAttemptFromDisk(activeQuizToTake.numero_semana);
                setActiveQuizToTake(null);
                deactivateDrmBlackout();
                if (document.fullscreenElement && document.exitFullscreen) document.exitFullscreen().catch(() => {});
                return;
              }
              isConfirmingRef.current = true; outStartTimeRef.current = null; setConfirmExitModalOpen(true);
            }}
            onChange={handleAnswerChange} onBlur={handleAnswerBlur}
            onConfirm={index => setAnsweredQuestionsMap(previous => ({ ...previous, [index]: true }))}
            onSubmit={() => handleSubmitQuiz()}
            onPasteBlocked={() => notify("No está permitido pegar texto durante la prueba.", "warning")} />
        )}


        {/* TELÓN NEGRO ANTI-CAPTURAS Y CONTROL CENTER/NOTIFICACIONES (DRM STREAMING PROTECTION) */}
        <div
          id="anti-cheat-blackout-curtain"
          onClick={() => deactivateDrmBlackout()}
          onTouchStart={() => deactivateDrmBlackout()}
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            width: "100vw",
            height: "100vh",
            zIndex: 9999990,
            background: "#000000",
            color: "#ffffff",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: "1.25rem",
            pointerEvents: isScreenBlackedOut ? "auto" : "none",
            display: isScreenBlackedOut ? "flex" : "none",
            cursor: "pointer"
          }}
        >
          <ShieldAlert size={52} color="#ef4444" className="animate-pulse" />
          <div style={{ textAlign: "center", padding: "0 1.5rem", maxWidth: "480px" }}>
            <div style={{ fontSize: "1.2rem", fontWeight: 900, color: "#ffffff", letterSpacing: "0.5px" }}>
              EVALUACIÓN EN PAUSA
            </div>
            <div style={{ fontSize: "0.88rem", color: "#94a3b8", marginTop: "0.45rem", lineHeight: 1.5 }}>
              La evaluación dejó de estar visible. Vuelve a la prueba para continuar; tus respuestas se conservan.
            </div>
          </div>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              deactivateDrmBlackout();
            }}
            style={{
              marginTop: "0.5rem",
              padding: "0.75rem 1.75rem",
              borderRadius: "9999px",
              background: "linear-gradient(135deg, #0284c7 0%, #0369a1 100%)",
              color: "#ffffff",
              border: "1px solid #38bdf8",
              fontSize: "0.9rem",
              fontWeight: 900,
              cursor: "pointer",
              boxShadow: "0 0 20px rgba(2, 132, 199, 0.5)"
            }}
          >
            Tocar aquí para continuar evaluación
          </button>
        </div>

        {/* MODAL DE ADVERTENCIA / INFRACCIÓN DE SEGURIDAD ANTITRAMPAS */}
        {violationModal && (
          <div
            className="sp-violation-modal-overlay"
            style={{
              position: "fixed",
              inset: 0,
              zIndex: 99999999,
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
                  {violationModal.strike >= 3 ? "Cierre según las normas" : "Incidencia de Integridad Registrada"}
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
                    deactivateDrmBlackout();
                    setViolationModal(null);
                    isFromTopBorderRef.current = false;
                    requestQuizFullscreen();
                  }}
                  style={{
                    width: "100%",
                    marginTop: "0.5rem",
                    padding: "0.85rem",
                    borderRadius: "0.75rem",
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
                  <span>Entendido • Continuar Evaluación</span>
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

        {/* =================================================================== */}
        {/* PESTAÑA D: SEGURIDAD Y ACTUALIZAR CONTRASEÑA                        */}
        {/* =================================================================== */}
        {activeTab === "seguridad" && (
          <StudentAccountView student={effectiveStudent} career={carreraKey} account={cuentaKey} notify={notify} />
        )}

        {/* MODAL IN-APP DE CONFIRMACIÓN DE ENTREGA (NO DESENFOCA NI DISPARA FALSOS POSITIVOS DE SEGURIDAD) */}
        {confirmSubmitModalOpen && activeQuizToTake && (
          <div
            className="quiz-player-dialog"
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
                Una vez enviada, tus respuestas quedarán selladas definitivamente y no podrás modificarlas. Tu examen será registrado en el sistema y enviado para revisión del instructor titular de la sección.
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
            className="quiz-player-dialog"
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
                    color: "#0284c7"
                  }}
                >
                  Finalizar Evaluación
                </span>
                <h3 style={{ margin: "0.3rem 0 0", fontSize: "1.35rem", fontWeight: 900, color: "#0f172a" }}>
                  ¿Deseas concluir y salir de la prueba?
                </h3>
              </div>

              <p style={{ margin: 0, fontSize: "0.9rem", color: "#475569", lineHeight: 1.55 }}>
                Al presionar salir, se tomará como que deseas terminar tu evaluación. Se enviarán y registrarán todas las respuestas que hayas completado hasta este momento.
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
                    if (document.exitFullscreen) document.exitFullscreen().catch(() => {});
                    else if (document.webkitExitFullscreen) document.webkitExitFullscreen().catch(() => {});
                    executeSubmitQuiz({ motivo: "entrega_anticipada_por_salida" });
                  }}
                  style={{
                    flex: 1,
                    padding: "0.75rem",
                    borderRadius: "0.7rem",
                    border: "1.5px solid #fca5a5",
                    background: "#fff1f2",
                    color: "#b91c1c",
                    fontSize: "0.9rem",
                    fontWeight: 800,
                    cursor: "pointer"
                  }}
                >
                  Salir y Enviar Respuestas
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

