import { quizItemLabel } from "../../../shared/quizItems.mjs";
import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { Radio, Play, SkipForward, Square, RefreshCw, Users, Clock, CheckCircle2, AlertTriangle, ArrowLeft, Lock, User, Search, Wifi, WifiOff } from "lucide-react";
import { api } from "../services/api";
import { displaySectionCode } from "../../../shared/sectionCode.mjs";
import "./LiveQuizControlView.css";
import {
  hasFullSectionAccess,
  isWeekAssignedToUser,
  getAssignedRecordForWeek,
  checkSectionSchedule,
  SECTION_ROLES
} from "../utils/sectionRoleUtils";

export default function LiveQuizControlView({
  seccion,
  currentInstructor,
  initialSemana = null,
  hideBackButton = false,
  onClose = () => {},
  notify = () => {}
}) {
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [quizLoading, setQuizLoading] = useState(false);
  const [quizError, setQuizError] = useState("");
  const [quizRetry, setQuizRetry] = useState(0);
  const [syncError, setSyncError] = useState("");
  const [sessionSynced, setSessionSynced] = useState(false);
  const [actionError, setActionError] = useState("");
  const [studentSearch, setStudentSearch] = useState("");
  const [studentFilter, setStudentFilter] = useState("all");
  const sessionKeyRef = useRef("");
  const controlEpochRef = useRef(0);
  const [semanasConfig, setSemanasConfig] = useState([]);
  const [sectionQuizzes, setSectionQuizzes] = useState([]);
  const [studentsList, setStudentsList] = useState([]);
  const [asignaciones, setAsignaciones] = useState([]);
  const [temario, setTemario] = useState([]);
  const [selectedSemana, setSelectedSemana] = useState(initialSemana || null);

  // Estado de la sesión en vivo
  const [liveSession, setLiveSession] = useState({
    estado: "inactiva", // 'inactiva' | 'lobby' | 'en_pregunta' | 'esperando_siguiente' | 'finalizada'
    habilitada: false,
    pregunta_actual_idx: 0,
    duracion_segundos: 90,
    tiempo_restante_segundos: 90,
    tiempo_transcurrido_segundos: 0,
    alumnos_conectados: {},
    respuestas_globales: {},
    server_time: Date.now()
  });

  const [activeQuiz, setActiveQuiz] = useState(null);
  const [localSecondsRemaining, setLocalSecondsRemaining] = useState(90);

  const pollTimerRef = useRef(null);
  const countdownTimerRef = useRef(null);
  const notifyRef = useRef(notify);
  notifyRef.current = notify;

  const carrera = seccion?.carrera || "Medicina";
  sessionKeyRef.current = `${seccion?.id || ""}_${selectedSemana || ""}`;

  // Formatear segundos a mm:ss
  const formatTimer = (totalSec) => {
    const s = Math.max(0, Math.floor(totalSec));
    const m = Math.floor(s / 60);
    const rem = s % 60;
    return `${String(m).padStart(2, "0")}:${String(rem).padStart(2, "0")}`;
  };

  // Identificación del usuario y rol de instructor titular
  const currentUser = currentInstructor || api.auth.getCurrentInstructor();
  const hasFullAccess = useMemo(() => hasFullSectionAccess(currentUser, seccion), [currentUser, seccion]);

  // Verificación de horario exclusivo de la sección para el instructor asignado

  const QUIZ_ROLES = useMemo(
    () => [SECTION_ROLES.CREAR_PRUEBA, SECTION_ROLES.PRUEBAS, SECTION_ROLES.PRUEBAS_LEGACY],
    []
  );

  // Semanas visibles según permisos: el titular ve todas; el asignado solo donde tiene Crear/Revisar prueba
  const visibleSemanasConfig = useMemo(() => {
    if (hasFullAccess) return semanasConfig;
    return semanasConfig.filter((s) => {
      const num = Number(s.numero_semana);
      return num && isWeekAssignedToUser(asignaciones, QUIZ_ROLES, num, currentUser, seccion);
    });
  }, [hasFullAccess, semanasConfig, asignaciones, QUIZ_ROLES, currentUser, seccion]);

  // Cargar semanas, temario, pruebas, asignaciones y estudiantes de la sección
  const loadInitialData = useCallback(async () => {
    if (!seccion?.id) return;
    setLoading(true);
    setLoadError("");

    try {
      const [resSemanas, resTemario, resQuizzes, resStudents, resAsig] = await Promise.all([
        api.semanas.getConfig(carrera),
        api.temario.getAll({ carrera }),
        api.pruebas.getBySeccion(seccion.id),
        api.estudiantes.getBySeccion(seccion.id, carrera),
        api.asignaciones.getBySeccion(seccion.id)
      ]);

      if (resSemanas?.data) setSemanasConfig(resSemanas.data);
      if (resTemario?.data && Array.isArray(resTemario.data)) setTemario(resTemario.data);
      if (resQuizzes?.data) setSectionQuizzes(resQuizzes.data);
      if (resStudents?.data) setStudentsList(resStudents.data);
      if (resAsig?.data && Array.isArray(resAsig.data)) {
        setAsignaciones(resAsig.data);
      } else if (Array.isArray(resAsig)) {
        setAsignaciones(resAsig);
      }
    } catch (err) {
      console.error("Error al cargar datos de control en vivo:", err);
      setLoadError("No pudimos cargar las pruebas y los estudiantes de la sección.");
    } finally {
      setLoading(false);
    }
  }, [carrera, seccion?.id]);

  useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);

  // Obtener el nombre descriptivo completo de la semana académica
  const getWeekDisplayName = useCallback(
    (w) => {
      if (!w) return "";
      const semNum = Number(w.numero_semana);
      const rawNombre = (w.nombre_semana || "").trim();
      const rawDesc = (w.descripcion || "").trim();

      // 1. Si nombre_semana tiene texto personalizado
      if (rawNombre && !rawNombre.toLowerCase().startsWith("semana") && rawNombre !== `Semana ${semNum}`) {
        return `Semana ${semNum}: ${rawNombre}`;
      }
      if (rawNombre && rawNombre.toLowerCase().startsWith("semana") && rawNombre !== `Semana ${semNum}`) {
        return rawNombre;
      }

      // 2. Si descripcion tiene el nombre de los temas
      if (rawDesc && !rawDesc.toLowerCase().startsWith("semana") && rawDesc !== `Semana ${semNum}`) {
        return `Semana ${semNum}: ${rawDesc}`;
      }

      // 3. Si temario tiene temas registrados para esta semana
      const topics = temario.filter((t) => Number(t.semana) === semNum);
      if (topics.length > 0) {
        const topicNames = topics.map((t) => t.titulo || `Tema ${t.numero_tema}`).join(", ");
        return `Semana ${semNum}: ${topicNames}`;
      }

      // 4. Si la prueba tiene título descriptivo
      const quiz = sectionQuizzes.find((q) => Number(q.numero_semana) === semNum);
      if (quiz?.titulo && quiz.titulo.trim()) {
        const qTitle = quiz.titulo.trim();
        if (qTitle.toLowerCase().startsWith("semana")) return qTitle;
        return `Semana ${semNum}: ${qTitle}`;
      }

      return `Semana ${semNum}`;
    },
    [temario, sectionQuizzes]
  );

  // Sincronizar selectedSemana para que apunte a una semana válida dentro de las visibles
  useEffect(() => {
    if (visibleSemanasConfig.length > 0) {
      const exists = visibleSemanasConfig.some((w) => Number(w.numero_semana) === Number(selectedSemana));
      if (!exists) {
        const firstPub = visibleSemanasConfig.find((w) => {
          const q = sectionQuizzes.find((quiz) => Number(quiz.numero_semana) === Number(w.numero_semana));
          return q?.publicada === true || q?.estado === "publicada";
        });
        setSelectedSemana(Number(firstPub ? firstPub.numero_semana : visibleSemanasConfig[0].numero_semana));
      }
    } else if (!hasFullAccess) {
      setSelectedSemana(null);
    }
  }, [visibleSemanasConfig, selectedSemana, sectionQuizzes, hasFullAccess]);

  // Registro del docente asignado a la semana seleccionada
  const assignedRecord = useMemo(() => {
    if (!selectedSemana) return null;
    return getAssignedRecordForWeek(asignaciones, QUIZ_ROLES, selectedSemana);
  }, [asignaciones, QUIZ_ROLES, selectedSemana]);

  const assignedTeacherName = assignedRecord?.instructor_nombre || assignedRecord?.nombre_instructor || "Sin asignar";

  // Datos completos de la semana seleccionada actualmente
  const selectedWeekInfo = useMemo(() => {
    if (!selectedSemana) return null;
    return visibleSemanasConfig.find((w) => Number(w.numero_semana) === Number(selectedSemana)) || {
      numero_semana: selectedSemana,
      nombre_semana: `Semana ${selectedSemana}`
    };
  }, [visibleSemanasConfig, selectedSemana]);

  // Cargar la prueba específica cuando cambia la semana seleccionada
  useEffect(() => {
    if (!seccion?.id || !selectedSemana) return;

    let isMounted = true;
    setQuizLoading(true);
    setQuizError("");
    setActiveQuiz(null);
    setActionError("");
    const fetchQuiz = async () => {
      try {
        const res = await api.pruebas.getBySemana(seccion.id, selectedSemana);
        if (isMounted && res?.data) {
          setActiveQuiz(res.data);
        } else if (isMounted) {
          setActiveQuiz(null);
        }
      } catch (_) {
        if (isMounted) setQuizError("No pudimos consultar la prueba de esta semana.");
      } finally { if (isMounted) setQuizLoading(false); }
    };

    fetchQuiz();
    return () => {
      isMounted = false;
    };
  }, [seccion?.id, selectedSemana, quizRetry]);

  // Sincronización en vivo vía polling cada 1.2 segundos
  const syncLiveState = useCallback(async () => {
    if (!seccion?.id || !selectedSemana) return;

    const requestKey = `${seccion.id}_${selectedSemana}`;
    const controlEpoch = controlEpochRef.current;
    try {
      const res = await api.pruebas.getLiveState(seccion.id, selectedSemana);
      if (sessionKeyRef.current !== requestKey || controlEpochRef.current !== controlEpoch) return;
      if (res?.success && res.data) {
        setSyncError("");
        setSessionSynced(true);
        setLiveSession(res.data);
        setLocalSecondsRemaining(res.data.tiempo_restante_segundos ?? 90);
      } else throw new Error("Estado no disponible");
    } catch (e) {
      if (sessionKeyRef.current === requestKey && controlEpochRef.current === controlEpoch) setSyncError("Sin conexión con la sesión. Esperando sincronización…");
      console.warn("Aviso en syncLiveState:", e.message);
    }
  }, [seccion?.id, selectedSemana]);

  // Montar ciclo de polling
  useEffect(() => {
    setSessionSynced(false);
    setSyncError("");
    syncLiveState();

    if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    pollTimerRef.current = setInterval(syncLiveState, 1200);

    return () => {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    };
  }, [syncLiveState]);

  // Cuenta regresiva local fluida de segundo a segundo
  useEffect(() => {
    if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);

    if (liveSession.estado === "en_pregunta" && localSecondsRemaining > 0) {
      countdownTimerRef.current = setInterval(() => {
        setLocalSecondsRemaining((prev) => {
          if (prev <= 1) {
            clearInterval(countdownTimerRef.current);
            syncLiveState();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }

    return () => {
      if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
    };
  }, [liveSession.estado, localSecondsRemaining, syncLiveState]);

  // Ejecutar comando maestro de control
  const handleExecuteControl = async (accion, extra = {}) => {
    if (!seccion?.id || !selectedSemana || actionLoading || !sessionSynced || syncError) return;
    if (accion === "finalizar" && !window.confirm("¿Finalizar la prueba para toda la sección? Los estudiantes terminarán su intento con las respuestas registradas.")) return;

    // Validación estricta de permisos: solo asignado a crear/revisar o titular
    const canControl = hasFullAccess || isWeekAssignedToUser(asignaciones, QUIZ_ROLES, selectedSemana, currentUser, seccion);
    if (!canControl) {
      notifyRef.current("El control en vivo requiere acceso completo o una asignación para esta prueba.", "error");
      return;
    }

    // Regla de horario exclusivo: el instructor asignado ÚNICAMENTE puede habilitar la prueba en vivo el mismo día y dentro del rango de horario de la sección
    if (accion === "habilitar" && !hasFullAccess) {
      const currentSched = checkSectionSchedule(seccion);
      if (!currentSched.isWithin) {
        notifyRef.current(
          `Acceso denegado: Como instructor asignado, únicamente puedes habilitar la prueba en vivo el día ${seccion?.dia} dentro del horario exclusivo de la sección (${seccion?.hora_inicio} - ${seccion?.hora_fin || "Fin"}). ${currentSched.reason}`,
          "error"
        );
        return;
      }
    }

    setActionLoading(true);
    controlEpochRef.current++;
    setActionError("");

    try {
      const payload = { accion, es_titular: hasFullAccess, ...extra };
      const res = await api.pruebas.controlLive(seccion.id, selectedSemana, payload);
      if (!res?.success) {
        throw new Error(res?.message || "Error al enviar comando");
      }

      controlEpochRef.current++;
      setLiveSession(res.data);
      setLocalSecondsRemaining(res.data.tiempo_restante_segundos ?? 90);

      if (accion === "habilitar") {
        notify("Prueba habilitada en vivo. Los alumnos ya pueden ingresar al lobby y ver los Datos Generales.", "success");
      } else if (accion === "iniciar_pregunta") {
        notify(`Pregunta ${(extra.pregunta_idx ?? 0) + 1} lanzada en vivo. El tiempo está corriendo.`, "success");
      } else if (accion === "siguiente_pregunta") {
        notify("Avanzando a la siguiente pregunta en vivo para todos los alumnos.", "info");
      } else if (accion === "finalizar") {
        notify("Prueba semanal finalizada para toda la sección.", "warning");
      } else if (accion === "deshabilitar") {
        notify("Sesión en vivo deshabilitada.", "info");
      }
    } catch (err) {
      console.error("Error al ejecutar control:", err);
      setActionError(err.message || "No pudimos ejecutar la acción. El estado mostrado se actualizará al sincronizar.");
    } finally {
      setActionLoading(false);
    }
  };

  // Pregunta activa actual del cuestionario
  const currentQIdx = liveSession.pregunta_actual_idx || 0;
  const currentQuestion = activeQuiz?.preguntas?.[currentQIdx] || null;
  const totalPreguntas = activeQuiz?.preguntas?.length || 6;
  const isBonusQuestion = currentQIdx === 5;

  // Estadísticas de alumnos conectados en tiempo real (< 60 segundos)
  const connectedMap = liveSession.alumnos_conectados || {};
  const nowTs = Date.now();
  const activeConnectedStudents = Object.values(connectedMap).filter(
    (c) => c && (!c.ultimo_ping || (nowTs - c.ultimo_ping < 60000))
  );
  const connectedCount = activeConnectedStudents.length;

  const canControl = hasFullAccess || (selectedSemana && isWeekAssignedToUser(asignaciones,QUIZ_ROLES,selectedSemana,currentUser,seccion));
  const published = activeQuiz?.publicada === true || activeQuiz?.estado === "publicada";
  const state = sessionSynced ? liveSession.estado : "conectando";
  const stateDetails = {
    conectando: ["Conectando", "Consultando el estado de la sesión…"],
    inactiva: ["Sala cerrada", "Abre la sala para que los estudiantes ingresen y lean las instrucciones."],
    lobby: ["Sala de espera", "Los estudiantes pueden ingresar. Inicia la primera pregunta cuando el grupo esté listo."],
    en_pregunta: ["Pregunta en curso", "Todos responden la misma pregunta con un cronómetro sincronizado."],
    esperando_siguiente: ["Esperando la siguiente", "La pregunta quedó bloqueada. Puedes avanzar cuando estés listo."],
    finalizada: ["Prueba finalizada", "La sesión terminó. Las respuestas se entregan y los apartados objetivos se califican automáticamente."]
  };
  const [stateLabel,stateDescription] = stateDetails[state] || stateDetails.inactiva;
  const controlDisabled = actionLoading || !canControl || !sessionSynced || Boolean(syncError);
  const questionDuration = Number(currentQuestion?.tiempo_segundos || activeQuiz?.tiempo_por_pregunta_segundos || 90);
  const students = studentsList.map(student => {
    const key=String(student.numero_cuenta || "").trim();
    const connection=connectedMap[key];
    const connected=Boolean(connection && (!connection.ultimo_ping || nowTs-connection.ultimo_ping<60000));
    return {...student,key,connected,answered:connected && Boolean(connection?.ha_respondido)};
  });
  const shownStudents=students.filter(student => {
    const query=studentSearch.trim().toLocaleLowerCase();
    return (!query || `${student.nombre_completo || ""} ${student.key}`.toLocaleLowerCase().includes(query)) && (studentFilter==="all" || (studentFilter==="connected" ? student.connected : !student.connected));
  });
  const answeredCount=students.filter(student=>student.answered).length;
  const actionButton=(label,Icon,action,extra={},primary=false,disabled=false)=><button type="button" className={`user-button${primary?" user-button--primary":""}${action==="finalizar"?" user-button--danger":""}`} disabled={controlDisabled || disabled} onClick={()=>handleExecuteControl(action,extra)}><Icon size={18} aria-hidden="true" />{actionLoading?"Procesando…":label}</button>;

  return (
    <section className="user-directory live-quiz-panel" aria-labelledby="live-quiz-title">
      {!hideBackButton && <button type="button" className="user-button user-button--back" onClick={onClose}><ArrowLeft size={17} aria-hidden="true" /> Volver a módulos</button>}
      <header className="user-directory__hero"><div><p className="user-directory__eyebrow"><Radio size={18} aria-hidden="true" /> Sección {displaySectionCode(seccion?.codigo)} · {carrera}</p><h2 id="live-quiz-title">Panel de control en vivo</h2><p>Dirige la prueba semanal y acompaña al grupo en tiempo real.</p></div></header>
      {loading ? <div className="live-quiz-panel__skeleton" role="status" aria-label="Cargando panel en vivo"><span /><span /></div>
      : loadError ? <div className="user-directory__state" role="alert"><p>{loadError}</p><button type="button" className="user-button" onClick={loadInitialData}>Reintentar</button></div>
      : !visibleSemanasConfig.length ? <div className="user-directory__state"><Lock size={24} aria-hidden="true" /><h3>{hasFullAccess?"No hay semanas configuradas":"No tienes semanas asignadas para control en vivo"}</h3><p>{hasFullAccess?"Define las semanas de esta carrera para comenzar.":"El titular puede asignarte la creación y revisión de una prueba desde Proporcionar asignaciones."}</p></div> : <>
        <div className="live-quiz-panel__selection">
          <label className="user-field">Semana de la prueba<select aria-label="Semana de la prueba" value={selectedSemana || ""} disabled={actionLoading} onChange={event=>setSelectedSemana(Number(event.target.value))}>{visibleSemanasConfig.map(week=><option key={week.numero_semana} value={week.numero_semana}>{getWeekDisplayName(week)}</option>)}</select></label>
          <div><p><User size={16} aria-hidden="true" /> Responsable <strong>{assignedTeacherName}</strong></p><small>{hasFullAccess?"Acceso completo a la sección":`Horario de habilitación: ${seccion?.dia} · ${seccion?.hora_inicio} – ${seccion?.hora_fin}`}</small></div>
          <button type="button" className="user-button" disabled={!selectedSemana || actionLoading} onClick={syncLiveState}><RefreshCw size={17} aria-hidden="true" /> Actualizar estado</button>
        </div>
        {quizLoading ? <p className="user-directory__state" role="status">Cargando prueba…</p>
        : quizError ? <div className="user-directory__state" role="alert"><p>{quizError}</p><button type="button" className="user-button" onClick={()=>setQuizRetry(value=>value+1)}>Reintentar</button></div>
        : !activeQuiz ? <div className="user-directory__state"><h3>No hay una prueba creada para esta semana</h3><p>Prepárala desde Crear prueba semanal antes de abrir la sesión en vivo.</p></div>
        : !published ? <div className="live-quiz-panel__warning"><AlertTriangle size={22} aria-hidden="true" /><div><h3>La prueba está en borrador</h3><p>Publícala desde Crear prueba semanal para habilitar el acceso de los estudiantes.</p></div></div> : <>
          <dl className="live-quiz-panel__stats" aria-label="Resumen de la sesión">
            {[["Matriculados",studentsList.length],["Conectados",connectedCount],["Con respuesta",answeredCount],["Pregunta",state==="inactiva" || state==="lobby"?`— / ${totalPreguntas}`:`${currentQIdx+1} / ${totalPreguntas}`]].map(([label,value])=><div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}
          </dl>
          <div className="live-quiz-panel__layout">
            <div className="live-quiz-panel__main">
              <section className="live-quiz-panel__console" data-state={state} aria-labelledby="live-console-title">
                <div className="live-quiz-panel__console-top"><div><p className="live-quiz-panel__eyebrow">Sesión de la semana {selectedSemana}</p><h3 id="live-console-title">{stateLabel}</h3></div><span className="live-quiz-panel__connection" data-error={Boolean(syncError)}>{syncError?<WifiOff size={15} aria-hidden="true" />:<Wifi size={15} aria-hidden="true" />}{syncError?"Sin conexión":sessionSynced?"Sincronizado":"Conectando"}</span></div>
                <p className="live-quiz-panel__description">{stateDescription}</p>
                {state==="en_pregunta" && <div className="live-quiz-panel__timer" data-urgent={localSecondsRemaining<=15}><span><Clock size={18} aria-hidden="true" /> Tiempo restante</span><strong role="timer" aria-label="Tiempo restante de la pregunta">{formatTimer(localSecondsRemaining)}</strong><small>Pregunta {currentQIdx+1}{isBonusQuestion?" · Bonus":""} · {formatTimer(questionDuration)} de duración</small><progress max={questionDuration} value={Math.max(0,Math.min(questionDuration,localSecondsRemaining))} aria-label="Tiempo disponible" /></div>}
                <ol className="live-quiz-panel__progress" aria-label="Avance de preguntas">{activeQuiz.preguntas?.map((question,index)=><li key={question.id || index} data-current={index===currentQIdx && ["en_pregunta","esperando_siguiente"].includes(state)} data-done={state==="finalizada" || index<currentQIdx}><span>{index===5?"Bonus":index+1}</span></li>)}</ol>
                {!hasFullAccess && !checkSectionSchedule(seccion).isWithin && (state==="inactiva" || state==="finalizada") && <p className="live-quiz-panel__notice">La sala se puede habilitar durante el horario asignado a la sección: {seccion?.dia}, {seccion?.hora_inicio} – {seccion?.hora_fin}.</p>}
                {syncError && <p className="user-dialog__error" role="alert">{syncError} Los controles se habilitarán al recuperar la conexión.</p>}
                {actionError && <p className="user-dialog__error" role="alert">{actionError}</p>}
                <div className="live-quiz-panel__actions">
                  {(state==="inactiva" || state==="finalizada") && actionButton(state==="finalizada"?"Abrir sala nuevamente":"Abrir sala de espera",Radio,"habilitar",{duracion_segundos:activeQuiz.tiempo_por_pregunta_segundos || 90},true,!hasFullAccess && !checkSectionSchedule(seccion).isWithin)}
                  {state==="lobby" && <>{actionButton("Iniciar pregunta 1",Play,"iniciar_pregunta",{pregunta_idx:0,duracion_segundos:activeQuiz.preguntas?.[0]?.tiempo_segundos || 90},true)}{actionButton("Cerrar sala",Square,"deshabilitar")}</>}
                  {state==="en_pregunta" && <>{actionButton("Terminar tiempo de la pregunta",Square,"tiempo_agotado",{},true)}{actionButton("Finalizar prueba",Square,"finalizar")}</>}
                  {state==="esperando_siguiente" && <>{currentQIdx<totalPreguntas-1?actionButton(`Iniciar pregunta ${currentQIdx+2}${currentQIdx+1===5?" · Bonus":""}`,SkipForward,"siguiente_pregunta",{duracion_segundos:activeQuiz.preguntas?.[currentQIdx+1]?.tiempo_segundos || 90},true):actionButton("Finalizar y recoger entregas",CheckCircle2,"finalizar",{},true)}{currentQIdx<totalPreguntas-1 && actionButton("Finalizar prueba",Square,"finalizar")}</>}
                  {state==="finalizada" && actionButton("Deshabilitar sesión",Lock,"deshabilitar")}
                </div>
              </section>
              {currentQuestion && !["inactiva","lobby","conectando"].includes(state) && <section className="live-quiz-panel__question" aria-labelledby="live-current-question"><header><h3 id="live-current-question">Pregunta {currentQIdx+1}{isBonusQuestion?" · Bonus":""}</h3><span>{Number(currentQuestion.puntos ?? 1).toFixed(3)} puntos · {formatTimer(questionDuration)}</span></header>
                {currentQuestion.imagen_url && <img src={currentQuestion.imagen_url} alt={`Imagen de la pregunta ${currentQIdx+1}`} loading="lazy" />}
                {currentQuestion.enunciado && <p>{currentQuestion.enunciado}</p>}
                {!currentQuestion.items?.length && <p className="live-quiz-panel__notice">Pregunta de respuesta directa.</p>}
                {(currentQuestion.items || []).map((item,index)=><div className="live-quiz-panel__item" key={item.id || index}><strong>{index+1}. {item.instruccion || quizItemLabel(item)}</strong>{item.tipo==="completacion" && <p>{item.texto_completar}</p>}<small>{quizItemLabel(item)} · {Number(item.puntos ?? 0).toFixed(3)} puntos</small></div>)}
              </section>}
            </div>
            <aside className="live-quiz-panel__students" aria-labelledby="live-students-title">
              <header><div><h3 id="live-students-title">Estudiantes</h3><p>{connectedCount} conectados de {studentsList.length}</p></div><Users size={20} aria-hidden="true" /></header>
              <label className="user-directory__search"><Search size={17} aria-hidden="true" /><input type="search" aria-label="Buscar estudiante" placeholder="Nombre o cuenta" value={studentSearch} onChange={event=>setStudentSearch(event.target.value)} /></label>
              <label className="user-field">Mostrar<select aria-label="Filtrar estudiantes por conexión" value={studentFilter} onChange={event=>setStudentFilter(event.target.value)}><option value="all">Todo el grupo</option><option value="connected">Conectados</option><option value="offline">Sin conexión</option></select></label>
              {!shownStudents.length?<p className="live-quiz-panel__empty">{studentsList.length?"Ningún estudiante coincide con los filtros.":"Aún no hay estudiantes matriculados."}</p>:<ul>{shownStudents.map(student=><li key={student.key} data-connected={student.connected}><div><strong>{student.nombre_completo || "Estudiante"}</strong><small>{student.key}</small></div><span className="live-quiz-panel__student-state" data-answered={student.answered}>{!student.connected?"Sin conexión":state==="en_pregunta"?student.answered?"Respondió":"Respondiendo":state==="lobby"?"En sala":"Conectado"}</span></li>)}</ul>}
            </aside>
          </div>
        </>}
      </>}
    </section>
  );
}
