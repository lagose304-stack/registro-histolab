import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  Radio,
  Play,
  SkipForward,
  Square,
  RefreshCw,
  Users,
  Clock,
  CheckCircle2,
  AlertTriangle,
  ArrowLeft,
  Eye,
  Sparkles,
  Award,
  Layers,
  HelpCircle,
  ShieldAlert,
  Send,
  Lock,
  Unlock,
  Check,
  Zap,
  Info
} from "lucide-react";
import { api } from "../services/api";

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
  const [semanasConfig, setSemanasConfig] = useState([]);
  const [sectionQuizzes, setSectionQuizzes] = useState([]);
  const [studentsList, setStudentsList] = useState([]);
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

  // Formatear segundos a mm:ss
  const formatTimer = (totalSec) => {
    const s = Math.max(0, Math.floor(totalSec));
    const m = Math.floor(s / 60);
    const rem = s % 60;
    return `${String(m).padStart(2, "0")}:${String(rem).padStart(2, "0")}`;
  };

  // Cargar semanas, pruebas y estudiantes de la sección
  const loadInitialData = useCallback(async () => {
    if (!seccion?.id) return;
    setLoading(true);

    try {
      const [resSemanas, resQuizzes, resStudents] = await Promise.all([
        api.semanas.getConfig(carrera).catch(() => ({ data: [] })),
        api.pruebas.getBySeccion(seccion.id).catch(() => ({ data: [] })),
        api.estudiantes.getBySeccion(seccion.id, carrera).catch(() => ({ data: [] }))
      ]);

      if (resSemanas?.data) setSemanasConfig(resSemanas.data);
      if (resQuizzes?.data) setSectionQuizzes(resQuizzes.data);
      if (resStudents?.data) setStudentsList(resStudents.data);

      // Si no hay semana preseleccionada, buscar la primera semana con prueba publicada
      if (!selectedSemana) {
        const firstPub = (resQuizzes?.data || []).find((q) => q.publicada === true || q.estado === "publicada");
        if (firstPub?.numero_semana) {
          setSelectedSemana(Number(firstPub.numero_semana));
        } else if (resSemanas?.data?.length > 0) {
          setSelectedSemana(Number(resSemanas.data[0].numero_semana));
        }
      }
    } catch (err) {
      console.error("Error al cargar datos de control en vivo:", err);
      notifyRef.current("Error al cargar datos de la sección", "error");
    } finally {
      setLoading(false);
    }
  }, [carrera, seccion?.id, selectedSemana]);

  useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);

  // Cargar la prueba específica cuando cambia la semana seleccionada
  useEffect(() => {
    if (!seccion?.id || !selectedSemana) return;

    let isMounted = true;
    const fetchQuiz = async () => {
      try {
        const res = await api.pruebas.getBySemana(seccion.id, selectedSemana);
        if (isMounted && res?.data) {
          setActiveQuiz(res.data);
        } else if (isMounted) {
          setActiveQuiz(null);
        }
      } catch (_) {
        if (isMounted) setActiveQuiz(null);
      }
    };

    fetchQuiz();
    return () => {
      isMounted = false;
    };
  }, [seccion?.id, selectedSemana]);

  // Sincronización en vivo vía polling cada 1.2 segundos
  const syncLiveState = useCallback(async () => {
    if (!seccion?.id || !selectedSemana) return;

    try {
      const res = await api.pruebas.getLiveState(seccion.id, selectedSemana);
      if (res?.success && res.data) {
        setLiveSession(res.data);
        setLocalSecondsRemaining(res.data.tiempo_restante_segundos ?? 90);
      }
    } catch (e) {
      console.warn("Aviso en syncLiveState:", e.message);
    }
  }, [seccion?.id, selectedSemana]);

  // Montar ciclo de polling
  useEffect(() => {
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
    if (!seccion?.id || !selectedSemana) return;
    setActionLoading(true);

    try {
      const payload = { accion, ...extra };
      const res = await api.pruebas.controlLive(seccion.id, selectedSemana, payload);
      if (!res?.success) {
        throw new Error(res?.message || "Error al enviar comando");
      }

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
      notify(err.message || "Error en comando maestro", "error");
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

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem", paddingBottom: "3rem" }}>
      {/* 1. BARRA SUPERIOR DE TRANSMISIÓN EN DIRECTO (MODO CLARO) */}
      <div
        className="glass-panel"
        style={{
          background: "#ffffff",
          borderRadius: "1.25rem",
          padding: "1.5rem 2rem",
          boxShadow: "0 10px 30px -5px rgba(0, 0, 0, 0.05)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: "1.25rem",
          border: "1.5px solid #e2e8f0"
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
          {!hideBackButton && (
            <button
              type="button"
              onClick={onClose}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: "40px",
                height: "40px",
                borderRadius: "0.65rem",
                border: "1.5px solid #cbd5e1",
                background: "#ffffff",
                color: "#334155",
                cursor: "pointer",
                transition: "all 0.15s ease",
                flexShrink: 0
              }}
              title="Volver al panel de la sección"
            >
              <ArrowLeft size={18} />
            </button>
          )}

          <div
            style={{
              width: "48px",
              height: "48px",
              borderRadius: "0.85rem",
              background: liveSession.habilitada
                ? "linear-gradient(135deg, #ef4444 0%, #dc2626 100%)"
                : "linear-gradient(135deg, #0284c7 0%, #0369a1 100%)",
              color: "#ffffff",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
              boxShadow: liveSession.habilitada ? "0 4px 14px rgba(239, 68, 68, 0.35)" : "0 4px 14px rgba(2, 132, 199, 0.25)"
            }}
          >
            <Radio size={24} className={liveSession.habilitada ? "animate-pulse" : ""} />
          </div>

          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", flexWrap: "wrap" }}>
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "0.4rem",
                  padding: "0.2rem 0.65rem",
                  borderRadius: "9999px",
                  background: liveSession.habilitada ? "#fef2f2" : "#f1f5f9",
                  border: liveSession.habilitada ? "1px solid #fecaca" : "1px solid #cbd5e1",
                  color: liveSession.habilitada ? "#dc2626" : "#475569",
                  fontSize: "0.74rem",
                  fontWeight: 900,
                  letterSpacing: "0.5px"
                }}
              >
                <Radio size={12} className={liveSession.habilitada ? "animate-pulse" : ""} />
                <span>{liveSession.habilitada ? "EN DIRECTO • SINCRONIZADO" : "EN ESPERA DE HABILITACIÓN"}</span>
              </span>

              <span style={{ fontSize: "0.78rem", color: "#64748b", fontWeight: 700 }}>
                Sección: <strong style={{ color: "#0f172a" }}>{seccion?.codigo || ""}</strong> • {carrera}
              </span>
            </div>

            <h2 style={{ margin: "0.3rem 0 0", fontSize: "1.45rem", fontWeight: 900, color: "#0f172a", letterSpacing: "-0.02em" }}>
              Panel de Control en Vivo de Pruebas Semanales
            </h2>
          </div>
        </div>

        {/* Indicadores rápidos de cabecera en modo claro */}
        <div style={{ display: "flex", alignItems: "center", gap: "1rem", flexWrap: "wrap" }}>
          <div
            style={{
              background: "#f8fafc",
              border: "1.5px solid #e2e8f0",
              padding: "0.6rem 1.1rem",
              borderRadius: "0.75rem",
              display: "flex",
              alignItems: "center",
              gap: "0.75rem"
            }}
          >
            <div
              style={{
                width: "36px",
                height: "36px",
                borderRadius: "0.5rem",
                background: "#eff6ff",
                border: "1px solid #bae6fd",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#0284c7"
              }}
            >
              <Users size={18} />
            </div>
            <div>
              <div style={{ fontSize: "0.7rem", color: "#64748b", fontWeight: 800, textTransform: "uppercase" }}>
                Alumnos en Vivo
              </div>
              <div style={{ fontSize: "1.15rem", fontWeight: 900, color: "#0284c7" }}>
                {connectedCount}{" "}
                <span style={{ fontSize: "0.78rem", color: "#94a3b8", fontWeight: 700 }}>
                  / {studentsList.length}
                </span>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={syncLiveState}
            style={{
              background: "#ffffff",
              border: "1.5px solid #cbd5e1",
              color: "#334155",
              padding: "0.65rem 1rem",
              borderRadius: "0.75rem",
              display: "flex",
              alignItems: "center",
              gap: "0.45rem",
              fontSize: "0.84rem",
              fontWeight: 800,
              cursor: "pointer",
              transition: "all 0.15s ease",
              boxShadow: "0 2px 4px rgba(0,0,0,0.02)"
            }}
            title="Forzar actualización de datos"
          >
            <RefreshCw size={15} color="#0284c7" />
            <span>Actualizar</span>
          </button>
        </div>
      </div>

      {/* 2. SELECTOR DE SEMANA */}
      <div
        className="glass-panel"
        style={{
          background: "#ffffff",
          borderRadius: "1rem",
          padding: "1rem 1.5rem",
          border: "1.5px solid #e2e8f0",
          display: "flex",
          flexDirection: "column",
          gap: "0.75rem"
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "0.5rem" }}>
          <div style={{ fontSize: "0.82rem", fontWeight: 800, color: "#334155", textTransform: "uppercase" }}>
            Selecciona la Semana Académica a Controlar:
          </div>
          <span style={{ fontSize: "0.76rem", color: "#64748b" }}>
            Los estudiantes solo podrán entrar a la semana que tú habilites en este panel.
          </span>
        </div>

        <div style={{ display: "flex", gap: "0.6rem", overflowX: "auto", paddingBottom: "0.3rem" }}>
          {semanasConfig.map((w) => {
            const semNum = Number(w.numero_semana);
            const isSelected = selectedSemana === semNum;
            const quizFound = sectionQuizzes.find((q) => Number(q.numero_semana) === semNum);
            const isPublished = quizFound?.publicada === true || quizFound?.estado === "publicada";

            return (
              <button
                key={semNum}
                type="button"
                onClick={() => setSelectedSemana(semNum)}
                style={{
                  flexShrink: 0,
                  padding: "0.55rem 0.95rem",
                  borderRadius: "0.65rem",
                  border: isSelected ? "2px solid #0284c7" : "1.5px solid #cbd5e1",
                  background: isSelected ? "#eff6ff" : "#ffffff",
                  color: isSelected ? "#0284c7" : "#334155",
                  fontWeight: isSelected ? 900 : 700,
                  fontSize: "0.82rem",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "0.45rem",
                  transition: "all 0.15s ease"
                }}
              >
                <span>Semana {semNum}</span>
                {isPublished ? (
                  <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#16a34a" }} title="Publicada" />
                ) : (
                  <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#cbd5e1" }} title="Sin publicar" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* 3. ESCENARIO MAESTRO DE CONTROL EN VIVO */}
      {!activeQuiz ? (
        <div
          style={{
            background: "#ffffff",
            borderRadius: "1.25rem",
            padding: "3.5rem 2rem",
            textAlign: "center",
            border: "2px dashed #cbd5e1"
          }}
        >
          <HelpCircle size={48} color="#94a3b8" style={{ margin: "0 auto 1rem" }} />
          <h3 style={{ fontSize: "1.2rem", fontWeight: 900, color: "#0f172a", margin: "0 0 0.4rem" }}>
            No hay prueba creada para la Semana {selectedSemana}
          </h3>
          <p style={{ margin: 0, fontSize: "0.88rem", color: "#64748b" }}>
            Primero debes elaborar la prueba en el módulo <strong>"Crear prueba semanal"</strong> antes de poder habilitar la sesión en directo.
          </p>
        </div>
      ) : activeQuiz.publicada !== true && activeQuiz.estado !== "publicada" ? (
        <div
          style={{
            background: "#fffbeb",
            borderRadius: "1.25rem",
            padding: "2rem",
            border: "2px solid #fde68a",
            display: "flex",
            alignItems: "center",
            gap: "1.25rem"
          }}
        >
          <AlertTriangle size={36} color="#d97706" style={{ flexShrink: 0 }} />
          <div>
            <h4 style={{ margin: "0 0 0.35rem", fontSize: "1.1rem", fontWeight: 900, color: "#92400e" }}>
              Prueba en modo Borrador (Semana {selectedSemana})
            </h4>
            <p style={{ margin: 0, fontSize: "0.88rem", color: "#b45309", lineHeight: 1.5 }}>
              Esta prueba aún está guardada como borrador. Para habilitarla en vivo a tus alumnos, entra a <strong>"Crear prueba semanal"</strong> y cámbiala a estado <strong>Publicada</strong>.
            </p>
          </div>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: "1.5rem", alignItems: "start" }}>
          {/* COLUMNA IZQUIERDA: CONTROLES MAESTROS Y MONITOR DE LA PREGUNTA */}
          <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
            {/* TARJETA DE ESTADO Y BOTONES DE MANDO */}
            <div
              className="glass-panel"
              style={{
                background: "#ffffff",
                borderRadius: "1.25rem",
                border: liveSession.habilitada ? "2px solid #ef4444" : "1.5px solid #cbd5e1",
                padding: "1.75rem 2rem",
                boxShadow: liveSession.habilitada ? "0 8px 30px rgba(239, 68, 68, 0.12)" : "0 4px 16px rgba(0,0,0,0.04)",
                display: "flex",
                flexDirection: "column",
                gap: "1.25rem"
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "1rem" }}>
                <div>
                  <span
                    style={{
                      fontSize: "0.78rem",
                      fontWeight: 900,
                      textTransform: "uppercase",
                      letterSpacing: "0.8px",
                      color: liveSession.habilitada ? "#dc2626" : "#64748b"
                    }}
                  >
                    Estado Actual de la Sesión:
                  </span>
                  <h3 style={{ margin: "0.2rem 0 0", fontSize: "1.55rem", fontWeight: 900, color: "#0f172a" }}>
                    {liveSession.estado === "inactiva" && "⚪ Sesión Inactiva (Alumnos Bloqueados)"}
                    {liveSession.estado === "lobby" && "🟢 Sala de Espera Activa (Lobby de Datos Generales)"}
                    {liveSession.estado === "en_pregunta" && `🔴 Pregunta #${currentQIdx + 1} de ${totalPreguntas} en Curso`}
                    {liveSession.estado === "esperando_siguiente" && "⏳ Tiempo Concluido • Esperando Siguiente Pregunta"}
                    {liveSession.estado === "finalizada" && "🏁 Prueba Semanal Finalizada"}
                  </h3>
                </div>

                {/* TEMPORIZADOR GLOBAL EN VIVO */}
                {liveSession.estado === "en_pregunta" && (
                  <div
                    style={{
                      background: localSecondsRemaining <= 15 ? "#fef2f2" : "#f0f9ff",
                      border: `2px solid ${localSecondsRemaining <= 15 ? "#f87171" : "#0284c7"}`,
                      borderRadius: "1rem",
                      padding: "0.75rem 1.35rem",
                      display: "flex",
                      alignItems: "center",
                      gap: "0.75rem",
                      boxShadow: localSecondsRemaining <= 15 ? "0 0 15px rgba(239, 68, 68, 0.3)" : "none"
                    }}
                  >
                    <Clock size={28} color={localSecondsRemaining <= 15 ? "#dc2626" : "#0284c7"} className={localSecondsRemaining <= 15 ? "animate-bounce" : ""} />
                    <div>
                      <div style={{ fontSize: "0.72rem", fontWeight: 800, color: localSecondsRemaining <= 15 ? "#dc2626" : "#0369a1", textTransform: "uppercase" }}>
                        Tiempo Restante Global
                      </div>
                      <div style={{ fontSize: "1.75rem", fontWeight: 900, color: localSecondsRemaining <= 15 ? "#dc2626" : "#0284c7", fontFamily: "monospace" }}>
                        {formatTimer(localSecondsRemaining)}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* DESCRIPCIÓN DEL ESTADO PARA EL DOCENTE */}
              <div
                style={{
                  background: "#f8fafc",
                  borderRadius: "0.75rem",
                  padding: "0.85rem 1.1rem",
                  border: "1px solid #e2e8f0",
                  fontSize: "0.85rem",
                  color: "#475569",
                  lineHeight: 1.5
                }}
              >
                {liveSession.estado === "inactiva" && (
                  <span>
                    La prueba está publicada, por lo que los alumnos pueden verla en su catálogo, pero <strong>el botón de entrar está deshabilitado</strong>. Al hacer clic en <strong>"Habilitar Prueba en Vivo"</strong>, se les permitirá entrar directamente a la pantalla de <strong>Datos Generales de la Prueba</strong> en espera.
                  </span>
                )}
                {liveSession.estado === "lobby" && (
                  <span>
                    <strong>Sala de espera abierta:</strong> Los estudiantes que entran están visualizando los Datos Generales y las indicaciones. Cuando estés listo para que todos arranquen al mismo tiempo, haz clic en <strong>"Iniciar Pregunta 1"</strong>.
                  </span>
                )}
                {liveSession.estado === "en_pregunta" && (
                  <span>
                    <strong>Pregunta en curso:</strong> El cronómetro de <strong>1:30 min</strong> corre sincronizado para todos los estudiantes de la sección. Si un estudiante entra tarde, saldrá automáticamente en esta pregunta con el tiempo que le quede y las preguntas anteriores quedarán sin responder.
                  </span>
                )}
                {liveSession.estado === "esperando_siguiente" && (
                  <span>
                    <strong>Tiempo terminado:</strong> Todos los estudiantes tienen la pregunta bloqueada y están en la pantalla <em>"Esperando la siguiente pregunta..."</em>. Haz clic en <strong>"Lanzar Siguiente Pregunta"</strong> cuando desees continuar.
                  </span>
                )}
                {liveSession.estado === "finalizada" && (
                  <span>
                    La prueba ha concluido. Todas las respuestas han sido registradas y los estudiantes tienen su comprobante de entrega. Puedes revisar las notas en el módulo <strong>"Revisar respuestas"</strong>.
                  </span>
                )}
              </div>

              {/* BARRA DE PROGRESO DE RESPUESTAS EN TIEMPO REAL TIPO KAHOOT */}
              {liveSession.estado === "en_pregunta" && (
                <div
                  style={{
                    background: "#f0fdf4",
                    border: "1.5px solid #86efac",
                    borderRadius: "0.85rem",
                    padding: "1rem 1.25rem",
                    display: "flex",
                    flexDirection: "column",
                    gap: "0.55rem"
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "0.5rem" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                      <span style={{ fontSize: "0.95rem" }}>📊</span>
                      <strong style={{ fontSize: "0.88rem", color: "#166534" }}>
                        Respuestas Recibidas en Tiempo Real:
                      </strong>
                    </div>
                    <span style={{ fontSize: "0.95rem", fontWeight: 900, color: "#15803d" }}>
                      {liveSession.respuestas_recibidas_count || 0} / {connectedCount} alumnos{" "}
                      <span style={{ fontSize: "0.78rem", fontWeight: 700, color: "#166534" }}>
                        ({connectedCount > 0 ? Math.min(100, Math.round(((liveSession.respuestas_recibidas_count || 0) / connectedCount) * 100)) : 0}%)
                      </span>
                    </span>
                  </div>

                  <div style={{ width: "100%", height: "10px", background: "#dcfce7", borderRadius: "9999px", overflow: "hidden" }}>
                    <div
                      style={{
                        width: `${connectedCount > 0 ? Math.min(100, Math.round(((liveSession.respuestas_recibidas_count || 0) / connectedCount) * 100)) : 0}%`,
                        height: "100%",
                        background: "linear-gradient(90deg, #16a34a, #22c55e)",
                        borderRadius: "9999px",
                        transition: "width 0.4s ease"
                      }}
                    />
                  </div>

                  {liveSession.todos_respondieron && (
                    <div style={{ fontSize: "0.8rem", fontWeight: 800, color: "#15803d" }}>
                      🎉 ¡Todos los alumnos conectados ya respondieron esta pregunta!
                    </div>
                  )}
                </div>
              )}

              {/* BOTONERA MAESTRA SEGÚN EL ESTADO */}
              <div style={{ display: "flex", gap: "0.85rem", flexWrap: "wrap", borderTop: "1px solid #f1f5f9", paddingTop: "1.1rem" }}>
                {/* 1. CASO INACTIVA: BOTÓN HABILITAR */}
                {liveSession.estado === "inactiva" && (
                  <button
                    type="button"
                    onClick={() => handleExecuteControl("habilitar", { duracion_segundos: activeQuiz.tiempo_por_pregunta_segundos || 90 })}
                    disabled={actionLoading}
                    style={{
                      flex: 1,
                      padding: "0.85rem 1.5rem",
                      borderRadius: "0.75rem",
                      border: "none",
                      background: "linear-gradient(135deg, #16a34a 0%, #15803d 100%)",
                      color: "#ffffff",
                      fontSize: "0.95rem",
                      fontWeight: 900,
                      cursor: actionLoading ? "not-allowed" : "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "0.5rem",
                      boxShadow: "0 4px 14px rgba(22, 163, 74, 0.35)"
                    }}
                  >
                    <Unlock size={18} />
                    <span>Habilitar Prueba en Vivo (Abrir Sala de Espera)</span>
                  </button>
                )}

                {/* 2. CASO LOBBY: BOTÓN INICIAR PREGUNTA 1 */}
                {liveSession.estado === "lobby" && (
                  <>
                    <button
                      type="button"
                      onClick={() => handleExecuteControl("iniciar_pregunta", { pregunta_idx: 0, duracion_segundos: activeQuiz.preguntas?.[0]?.tiempo_segundos || 90 })}
                      disabled={actionLoading}
                      style={{
                        flex: 1.5,
                        padding: "0.85rem 1.5rem",
                        borderRadius: "0.75rem",
                        border: "none",
                        background: "linear-gradient(135deg, #0284c7 0%, #0369a1 100%)",
                        color: "#ffffff",
                        fontSize: "0.95rem",
                        fontWeight: 900,
                        cursor: actionLoading ? "not-allowed" : "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: "0.5rem",
                        boxShadow: "0 4px 14px rgba(2, 132, 199, 0.35)"
                      }}
                    >
                      <Play size={18} />
                      <span>Dar Orden: Iniciar Pregunta 1 (1:30 min)</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleExecuteControl("deshabilitar")}
                      disabled={actionLoading}
                      style={{
                        padding: "0.85rem 1.25rem",
                        borderRadius: "0.75rem",
                        border: "1.5px solid #cbd5e1",
                        background: "#ffffff",
                        color: "#64748b",
                        fontSize: "0.88rem",
                        fontWeight: 700,
                        cursor: actionLoading ? "not-allowed" : "pointer"
                      }}
                    >
                      Cancelar / Volver a Inactiva
                    </button>
                  </>
                )}

                {/* 3. CASO EN PREGUNTA: BOTÓN FORZAR PASO A ESPERA */}
                {liveSession.estado === "en_pregunta" && (
                  <>
                    <button
                      type="button"
                      onClick={() => handleExecuteControl("tiempo_agotado")}
                      disabled={actionLoading}
                      style={{
                        flex: 1,
                        padding: "0.85rem 1.5rem",
                        borderRadius: "0.75rem",
                        border: "none",
                        background: "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)",
                        color: "#ffffff",
                        fontSize: "0.92rem",
                        fontWeight: 900,
                        cursor: actionLoading ? "not-allowed" : "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: "0.5rem",
                        boxShadow: "0 4px 14px rgba(245, 158, 11, 0.3)"
                      }}
                    >
                      <SkipForward size={18} />
                      <span>Terminar Tiempo Ahora (Pausar y Bloquear)</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleExecuteControl("finalizar")}
                      disabled={actionLoading}
                      style={{
                        padding: "0.85rem 1.25rem",
                        borderRadius: "0.75rem",
                        border: "1.5px solid #fecaca",
                        background: "#fef2f2",
                        color: "#dc2626",
                        fontSize: "0.88rem",
                        fontWeight: 800,
                        cursor: actionLoading ? "not-allowed" : "pointer"
                      }}
                    >
                      Finalizar Prueba Completa
                    </button>
                  </>
                )}

                {/* 4. CASO ESPERANDO SIGUIENTE: BOTÓN LANZAR SIGUIENTE */}
                {liveSession.estado === "esperando_siguiente" && (
                  <>
                    {currentQIdx + 1 < totalPreguntas ? (
                      <button
                        type="button"
                        onClick={() =>
                          handleExecuteControl("siguiente_pregunta", {
                            duracion_segundos: activeQuiz.preguntas?.[currentQIdx + 1]?.tiempo_segundos || 90
                          })
                        }
                        disabled={actionLoading}
                        style={{
                          flex: 1.5,
                          padding: "0.85rem 1.5rem",
                          borderRadius: "0.75rem",
                          border: "none",
                          background: "linear-gradient(135deg, #0284c7 0%, #0369a1 100%)",
                          color: "#ffffff",
                          fontSize: "0.95rem",
                          fontWeight: 900,
                          cursor: actionLoading ? "not-allowed" : "pointer",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          gap: "0.5rem",
                          boxShadow: "0 4px 14px rgba(2, 132, 199, 0.35)"
                        }}
                      >
                        <Play size={18} />
                        <span>
                          Lanzar Siguiente Pregunta: Pregunta #{currentQIdx + 2} {currentQIdx + 1 === 5 ? "⭐ (BONUS)" : ""} (1:30 min)
                        </span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleExecuteControl("finalizar")}
                        disabled={actionLoading}
                        style={{
                          flex: 1.5,
                          padding: "0.85rem 1.5rem",
                          borderRadius: "0.75rem",
                          border: "none",
                          background: "linear-gradient(135deg, #16a34a 0%, #15803d 100%)",
                          color: "#ffffff",
                          fontSize: "0.95rem",
                          fontWeight: 900,
                          cursor: actionLoading ? "not-allowed" : "pointer",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          gap: "0.5rem",
                          boxShadow: "0 4px 14px rgba(22, 163, 74, 0.35)"
                        }}
                      >
                        <CheckCircle2 size={18} />
                        <span>¡Todas las Preguntas Concluidas! Finalizar Prueba Semanal</span>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => handleExecuteControl("finalizar")}
                      disabled={actionLoading}
                      style={{
                        padding: "0.85rem 1.25rem",
                        borderRadius: "0.75rem",
                        border: "1.5px solid #cbd5e1",
                        background: "#ffffff",
                        color: "#64748b",
                        fontSize: "0.88rem",
                        fontWeight: 700,
                        cursor: actionLoading ? "not-allowed" : "pointer"
                      }}
                    >
                      Cerrar y Finalizar
                    </button>
                  </>
                )}

                {/* 5. CASO FINALIZADA */}
                {liveSession.estado === "finalizada" && (
                  <>
                    <button
                      type="button"
                      onClick={() => handleExecuteControl("deshabilitar")}
                      disabled={actionLoading}
                      style={{
                        padding: "0.85rem 1.5rem",
                        borderRadius: "0.75rem",
                        border: "1.5px solid #cbd5e1",
                        background: "#ffffff",
                        color: "#334155",
                        fontSize: "0.9rem",
                        fontWeight: 800,
                        cursor: actionLoading ? "not-allowed" : "pointer"
                      }}
                    >
                      Reiniciar Sesión para Nueva Aplicación
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* VISUALIZADOR DE LA PREGUNTA ACTIVA QUE VEN LOS ALUMNOS */}
            {currentQuestion && liveSession.estado !== "inactiva" && (
              <div
                className="glass-panel"
                style={{
                  background: isBonusQuestion ? "linear-gradient(180deg, #fffdf8 0%, #ffffff 100%)" : "#ffffff",
                  borderRadius: "1.25rem",
                  border: isBonusQuestion ? "2px solid #f59e0b" : "1.5px solid #cbd5e1",
                  padding: "1.75rem",
                  display: "flex",
                  flexDirection: "column",
                  gap: "1.1rem"
                }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "0.5rem" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    <span
                      style={{
                        width: "30px",
                        height: "30px",
                        borderRadius: "50%",
                        background: isBonusQuestion ? "#f59e0b" : "#0284c7",
                        color: "#ffffff",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontWeight: 900,
                        fontSize: "0.85rem"
                      }}
                    >
                      {currentQIdx + 1}
                    </span>
                    <strong style={{ fontSize: "1.05rem", color: "#0f172a" }}>
                      Pregunta #{currentQIdx + 1} {isBonusQuestion ? "⭐ (Reactivo Bonus)" : ""}
                    </strong>
                  </div>

                  <span style={{ fontSize: "0.78rem", fontWeight: 800, color: "#0369a1", background: "#f0f9ff", border: "1px solid #bae6fd", padding: "0.2rem 0.6rem", borderRadius: "0.4rem" }}>
                    Valor: {Number(currentQuestion.puntos || 1.0).toFixed(3)} pts • Tiempo: 1:30 min
                  </span>
                </div>

                {/* Micrografía histológica si tiene */}
                {currentQuestion.imagen_url && (
                  <div style={{ textAlign: "center", background: "#f8fafc", border: "1.5px solid #e2e8f0", padding: "0.65rem", borderRadius: "0.75rem" }}>
                    <img
                      src={currentQuestion.imagen_url}
                      alt={`Pregunta ${currentQIdx + 1}`}
                      style={{ maxHeight: "280px", maxWidth: "100%", objectFit: "contain", borderRadius: "0.5rem" }}
                    />
                  </div>
                )}

                {/* Apartados que el alumno está respondiendo */}
                <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                  <span style={{ fontSize: "0.78rem", fontWeight: 800, color: "#64748b", textTransform: "uppercase" }}>
                    Apartados e Indicaciones de Respuesta:
                  </span>
                  {(currentQuestion.items || []).map((it, idx) => (
                    <div key={it.id || idx} style={{ background: "#f8fafc", padding: "0.75rem 1rem", borderRadius: "0.6rem", border: "1px solid #e2e8f0" }}>
                      <div style={{ fontSize: "0.85rem", fontWeight: 800, color: "#334155" }}>
                        {idx + 1}. {it.instruccion || (it.tipo === "texto_corto" ? "Respuesta corta:" : "Listado:")}
                      </div>
                      <span style={{ fontSize: "0.74rem", color: "#64748b" }}>
                        Tipo: {it.tipo === "texto_corto" ? "Texto directo" : `Lista de ${it.cantidad || 3} elementos`} • Valor: {Number(it.puntos || 0).toFixed(3)} pt
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* COLUMNA DERECHA: MONITOR DE ESTUDIANTES EN VIVO */}
          <div
            className="glass-panel"
            style={{
              background: "#ffffff",
              borderRadius: "1.25rem",
              border: "1.5px solid #e2e8f0",
              padding: "1.25rem",
              display: "flex",
              flexDirection: "column",
              gap: "1rem"
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.45rem" }}>
                <Users size={18} color="#0284c7" />
                <h4 style={{ margin: 0, fontSize: "0.95rem", fontWeight: 800, color: "#0f172a" }}>
                  Alumnos de la Sección
                </h4>
              </div>
              <span
                style={{
                  fontSize: "0.75rem",
                  fontWeight: 900,
                  background: "#eff6ff",
                  color: "#0284c7",
                  padding: "0.15rem 0.5rem",
                  borderRadius: "9999px"
                }}
              >
                {connectedCount} activos
              </span>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", maxHeight: "550px", overflowY: "auto" }}>
              {studentsList.length === 0 ? (
                <div style={{ padding: "1.5rem", textAlign: "center", color: "#94a3b8", fontSize: "0.8rem" }}>
                  No hay estudiantes registrados en esta sección.
                </div>
              ) : (
                studentsList.map((est) => {
                  const cKey = String(est.numero_cuenta || "").trim();
                  const connInfo = connectedMap[cKey] || connectedMap[String(est.numero_cuenta)];
                  const isConnected = Boolean(
                    connInfo && (!connInfo.ultimo_ping || (nowTs - connInfo.ultimo_ping < 60000))
                  );
                  const isAnswering = connInfo && typeof connInfo.pregunta_vista === "number" && connInfo.pregunta_vista >= 0;

                  return (
                    <div
                      key={cKey}
                      style={{
                        padding: "0.6rem 0.8rem",
                        borderRadius: "0.65rem",
                        border: isConnected ? "1px solid #86efac" : "1px solid #f1f5f9",
                        background: isConnected ? "#f0fdf4" : "#ffffff",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: "0.5rem"
                      }}
                    >
                      <div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
                        <strong style={{ fontSize: "0.82rem", color: "#0f172a", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                          {est.nombre_completo || "Estudiante"}
                        </strong>
                        <span style={{ fontSize: "0.72rem", color: "#64748b" }}>
                          Cuenta: {cKey}
                        </span>
                      </div>

                      {isConnected ? (
                        <span
                          style={{
                            fontSize: "0.68rem",
                            fontWeight: 800,
                            padding: "0.2rem 0.55rem",
                            borderRadius: "9999px",
                            background:
                              liveSession.estado === "en_pregunta"
                                ? connInfo?.ha_respondido
                                  ? "#dcfce7"
                                  : "#fef3c7"
                                : "#dcfce7",
                            color:
                              liveSession.estado === "en_pregunta"
                                ? connInfo?.ha_respondido
                                  ? "#15803d"
                                  : "#b45309"
                                : "#15803d",
                            border:
                              liveSession.estado === "en_pregunta"
                                ? connInfo?.ha_respondido
                                  ? "1px solid #86efac"
                                  : "1px solid #fde68a"
                                : "1px solid #86efac",
                            whiteSpace: "nowrap",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "0.25rem"
                          }}
                        >
                          {liveSession.estado === "en_pregunta"
                            ? connInfo?.ha_respondido
                              ? "✓ Respondió"
                              : "⏳ Pensando..."
                            : liveSession.estado === "lobby"
                            ? "🟢 En Sala"
                            : "🟢 Conectado"}
                        </span>
                      ) : (
                        <span
                          style={{
                            fontSize: "0.68rem",
                            fontWeight: 700,
                            padding: "0.15rem 0.45rem",
                            borderRadius: "9999px",
                            background: "#f1f5f9",
                            color: "#94a3b8",
                            whiteSpace: "nowrap"
                          }}
                        >
                          Sin entrar
                        </span>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
