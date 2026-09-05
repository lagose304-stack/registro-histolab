import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import {
  FileEdit,
  Search,
  Save,
  CheckCircle2,
  AlertTriangle,
  Users,
  Calendar,
  ArrowLeft,
  RefreshCw,
  AlertCircle,
  ShieldAlert,
  ShieldCheck,
  CheckCheck,
  Lock,
  Sparkles,
  Info,
  GraduationCap,
  Eye,
  Clock,
  X,
  MessageSquare,
  Image as ImageIcon,
  Check,
  ExternalLink
} from "lucide-react";
import { api } from "../services/api";
import {
  calculateStudentAcademicSummary,
  getCanonicalQuizGrade
} from "../utils/academicEngine";

export default function WeeklyQuizGradingView({
  seccion,
  currentInstructor,
  hideBackButton = false,
  onClose = () => {},
  notify = () => {}
}) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // Referencia estable de notify
  const notifyRef = useRef(notify);
  notifyRef.current = notify;

  // Bandera para inicializar semana por defecto una sola vez
  const hasInitializedWeekRef = useRef(false);

  // Datos
  const [estudiantes, setEstudiantes] = useState([]);
  const [semanasConfig, setSemanasConfig] = useState([]);
  const [temario, setTemario] = useState([]);
  const [asignaciones, setAsignaciones] = useState([]);

  // Entregas online de la prueba semanal y cuestionario digital
  const [entregasOnline, setEntregasOnline] = useState([]);
  const [quizSemanal, setQuizSemanal] = useState(null);
  const [loadingEntregas, setLoadingEntregas] = useState(false);

  // Modal de revisión de entrega de un estudiante
  const [inspectingSubmission, setInspectingSubmission] = useState(null);
  const [inspectingStudent, setInspectingStudent] = useState(null);
  const [evalScore, setEvalScore] = useState("");
  const [evalComments, setEvalComments] = useState("");
  const [savingEvaluation, setSavingEvaluation] = useState(false);

  // Selección de semana persistente por sección
  const [selectedSemana, setSelectedSemana] = useState(() => {
    try {
      const saved = sessionStorage.getItem(`histolab_prueba_semana_${seccion?.id}`);
      return saved ? Number(saved) : 1;
    } catch {
      return 1;
    }
  });

  const [configPuntajes, setConfigPuntajes] = useState(null);

  const handleSelectSemana = (num) => {
    const n = Number(num);
    setSelectedSemana(n);
    hasInitializedWeekRef.current = true;
    try {
      sessionStorage.setItem(`histolab_prueba_semana_${seccion?.id}`, String(n));
    } catch (_) {}
  };

  const [searchTerm, setSearchTerm] = useState("");

  const carrera = seccion?.carrera || "Medicina";

  // 1. Cargar datos del servidor
  const loadData = useCallback(async (isInitial = false) => {
    if (!seccion?.id) return;
    if (isInitial) setLoading(true);

    try {
      const [resEst, resSemanas, resTemario, resAsig, resPuntajes] = await Promise.all([
        api.estudiantes.getBySeccion(seccion.id, carrera),
        api.semanas.getConfig(carrera).catch(() => ({ data: [] })),
        api.temario.getAll({ carrera }).catch(() => ({ data: [] })),
        api.asignaciones.getBySeccion(seccion.id).catch(() => ({ data: [] })),
        api.temario.getPuntajes(carrera).catch(() => ({ data: null }))
      ]);

      if (resEst?.data) {
        // Ordenar alfabéticamente por nombre_completo
        const sorted = [...resEst.data].sort((a, b) =>
          (a.nombre_completo || "").localeCompare(b.nombre_completo || "")
        );
        setEstudiantes(sorted);
      }

      if (resSemanas?.data) {
        setSemanasConfig(resSemanas.data);
      }

      if (resTemario?.data) {
        setTemario(resTemario.data);
      }

      if (resAsig?.data || Array.isArray(resAsig)) {
        setAsignaciones(resAsig.data || resAsig);
      }

      if (resPuntajes?.data) {
        setConfigPuntajes(resPuntajes.data);
      }

      // Solo elegir semana por defecto si no se había seleccionado previamente
      if (!hasInitializedWeekRef.current) {
        const savedWeek = sessionStorage.getItem(`histolab_prueba_semana_${seccion?.id}`);
        if (!savedWeek && resSemanas?.data && resSemanas.data.length > 0) {
          const actual = resSemanas.data.find((s) => s.es_semana_actual);
          if (actual && actual.numero_semana) {
            handleSelectSemana(Number(actual.numero_semana));
          } else {
            const first = Number(resSemanas.data[0].numero_semana);
            if (first) handleSelectSemana(first);
          }
        }
        hasInitializedWeekRef.current = true;
      }
    } catch (err) {
      console.error("Error al cargar notas de prueba semanal:", err);
      notifyRef.current("Error al cargar la información de estudiantes", "error");
    } finally {
      setLoading(false);
    }
  }, [seccion?.id, carrera]);

  useEffect(() => {
    loadData(true);
  }, [loadData]);

  // Cargar cuestionario y entregas digitales de la semana seleccionada
  const loadWeekQuizAndSubmissions = useCallback(async (semana) => {
    if (!seccion?.id || !semana) return;
    setLoadingEntregas(true);
    try {
      const [resQuiz, resEntregas] = await Promise.all([
        api.pruebas.getBySemana(seccion.id, semana).catch(() => ({ data: null })),
        api.pruebas.getEntregas(seccion.id, semana).catch(() => ({ data: [] }))
      ]);
      setQuizSemanal(resQuiz?.data || null);
      setEntregasOnline(Array.isArray(resEntregas?.data) ? resEntregas.data : []);
    } catch (err) {
      console.warn("Error al cargar entregas online de la prueba:", err);
    } finally {
      setLoadingEntregas(false);
    }
  }, [seccion?.id]);

  useEffect(() => {
    if (selectedSemana) {
      loadWeekQuizAndSubmissions(selectedSemana);
    }
  }, [selectedSemana, loadWeekQuizAndSubmissions]);

  // Helper para obtener el nombre visible de la semana
  const getWeekDisplayName = (w) => {
    if (!w) return "";
    const rawName = (w.nombre_semana || w.descripcion || "").trim();
    if (!rawName) return `Semana ${w.numero_semana}`;
    if (rawName.toLowerCase().startsWith("semana")) return rawName;
    return `Semana ${w.numero_semana}: ${rawName}`;
  };

  // Lista unificada de semanas
  const availableWeeks = useMemo(() => {
    const weekMap = new Map();

    semanasConfig.forEach((s) => {
      const num = Number(s.numero_semana);
      if (!num) return;
      const rawNombre = s.nombre_semana || s.descripcion || (Boolean(s.es_examen) ? `Semana ${num} (Examen)` : `Semana ${num}`);
      weekMap.set(num, {
        numero_semana: num,
        nombre_semana: rawNombre,
        parcial: s.parcial || "I Parcial",
        fecha_inicio: s.fecha_inicio,
        fecha_fin: s.fecha_fin,
        esExamen: Boolean(s.es_examen) || (s.temas || "").toUpperCase().includes("EXAMEN"),
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

    // Regla: En semana de examen no hay prueba semanal
    return Array.from(weekMap.values())
      .filter((w) => !w.esExamen)
      .sort((a, b) => a.numero_semana - b.numero_semana);
  }, [semanasConfig, temario]);

  // Si la semana seleccionada coincide con un examen o no está en las disponibles, ajustar
  useEffect(() => {
    if (availableWeeks.length > 0 && !availableWeeks.some((w) => w.numero_semana === selectedSemana)) {
      setSelectedSemana(availableWeeks[0].numero_semana);
    }
  }, [availableWeeks, selectedSemana]);

  // Información de la semana seleccionada
  const currentWeekInfo = useMemo(() => {
    return availableWeeks.find((w) => w.numero_semana === selectedSemana) || {
      numero_semana: selectedSemana,
      nombre_semana: `Semana ${selectedSemana}`,
      parcial: "I Parcial",
      descripcion: `Semana ${selectedSemana}`,
      esExamen: false
    };
  }, [availableWeeks, selectedSemana]);

  // Docente asignado al rol de "Subir nota de prueba semanal" en esta semana
  const assignedRecordForWeek = useMemo(() => {
    const targetRef = `semana_${selectedSemana}`;
    return (
      asignaciones.find(
        (a) =>
          a.tipo_asignacion === "Subir nota de prueba semanal" &&
          a.referencia_id === targetRef
      ) || null
    );
  }, [asignaciones, selectedSemana]);

  const assignedInstructorForWeek = assignedRecordForWeek?.instructor_nombre || null;

  // 🛡️ REGLA ESTRICTA: El usuario solo puede editar la prueba semanal si le asignaron el rol en esta semana
  const canEdit = useMemo(() => {
    if (currentWeekInfo.esExamen) return false;
    if (!assignedRecordForWeek || !assignedRecordForWeek.instructor_id) {
      return false; // Sin docente asignado -> solo lectura
    }

    const user = currentInstructor || api.auth.getCurrentInstructor();
    if (!user) return false;

    // 1. Coincidencia por ID de instructor UUID
    if (user.id && assignedRecordForWeek.instructor_id && String(user.id) === String(assignedRecordForWeek.instructor_id)) {
      return true;
    }

    // 2. Coincidencia por coordinador sintetizado (coord-{seccionId})
    if (assignedRecordForWeek.instructor_id === `coord-${seccion?.id}`) {
      const coordName = (seccion?.coordinador || "").toLowerCase().trim();
      const userName = (user.nombre_completo || `${user.primer_nombre || ""} ${user.primer_apellido || ""}`).toLowerCase().trim();
      if (coordName && (userName.includes(coordName) || coordName.includes(userName))) {
        return true;
      }
    }

    // 3. Coincidencia por nombre completo o primer nombre + primer apellido
    const targetName = (assignedRecordForWeek.instructor_nombre || "").toLowerCase().trim();
    if (!targetName) return false;

    const userFullName = (user.nombre_completo || "").toLowerCase().trim();
    const userCombinedName = `${user.primer_nombre || ""} ${user.primer_apellido || ""}`.toLowerCase().trim();

    if (userFullName && (userFullName === targetName || targetName.includes(userFullName))) {
      return true;
    }

    if (userCombinedName && (userCombinedName === targetName || targetName.includes(userCombinedName))) {
      return true;
    }

    const pNom = (user.primer_nombre || "").toLowerCase().trim();
    const pApe = (user.primer_apellido || "").toLowerCase().trim();
    if (pNom && pApe && targetName.includes(pNom) && targetName.includes(pApe)) {
      return true;
    }

    return false;
  }, [assignedRecordForWeek, currentInstructor, seccion, currentWeekInfo.esExamen]);

  // Clave canónica de la prueba semanal: prueba_<semana>
  const quizKey = `prueba_${selectedSemana}`;
  const quizLegacyExamencitoKey = `examencito_${selectedSemana}`;
  const quizLegacyKey = `Prueba de la semana ${selectedSemana}`;
  const quizLegacyAltKey = `Examencito de la semana ${selectedSemana}`;

  // Helper para leer la nota de la prueba semanal de un estudiante
  const getStudentQuizGrade = (est) => {
    if (!est) return "";
    const val = getCanonicalQuizGrade(est.notas || {}, selectedSemana, est);
    if (val === undefined || val === null || val === "") return "";
    return val;
  };

  // Helper para recalcular el total con precisión de 3 decimales (Suma de Exámenes + Nota Oro Manuales + Nota Oro Pruebas)
  const recalculateTotal = (est, updatedNotas) => {
    const summary = calculateStudentAcademicSummary(
      est,
      configPuntajes,
      temario,
      semanasConfig,
      updatedNotas
    );
    return summary.total;
  };

  // Manejar cambio en la nota de la prueba con soporte para hasta 3 decimales (Máx. 5.000 pts)
  const handleGradeChange = (numero_cuenta, rawValue) => {
    if (!canEdit) {
      notifyRef.current(
        `Solo ${assignedInstructorForWeek || "el docente asignado"} tiene permisos para editar la prueba en la Semana ${selectedSemana}.`,
        "warning"
      );
      return;
    }

    const cleanVal = String(rawValue).replace(",", ".");

    if (cleanVal === "") {
      setEstudiantes((prev) =>
        prev.map((est) => {
          if (est.numero_cuenta !== numero_cuenta) return est;
          const currentNotas = { ...(est.notas || {}) };
          delete currentNotas[quizKey];
          delete currentNotas[quizLegacyExamencitoKey];
          delete currentNotas[quizLegacyKey];
          delete currentNotas[quizLegacyAltKey];
          const nextTotal = recalculateTotal(est, currentNotas);
          return { ...est, notas: currentNotas, total: nextTotal };
        })
      );
      setHasUnsavedChanges(true);
      return;
    }

    if (!/^\d*(\.\d{0,3})?$/.test(cleanVal)) {
      return;
    }

    const numVal = parseFloat(cleanVal);
    // REGLA: Pruebas máximo 5 puntos (no mayor a 5)
    if (!cleanVal.endsWith(".") && numVal > 5) {
      notifyRef.current("La nota de la prueba no puede ser mayor a 5 puntos (máximo 5.000).", "warning");
      return;
    }

    const storedVal = cleanVal.endsWith(".") ? cleanVal : Number(cleanVal);

    setEstudiantes((prev) =>
      prev.map((est) => {
        if (est.numero_cuenta !== numero_cuenta) return est;

        const currentNotas = { ...(est.notas || {}) };
        delete currentNotas[quizLegacyExamencitoKey];
        delete currentNotas[quizLegacyAltKey];

        const updatedNotas = {
          ...currentNotas,
          [quizKey]: storedVal
        };

        const nextTotal = recalculateTotal(est, updatedNotas);

        return {
          ...est,
          notas: updatedNotas,
          total: nextTotal
        };
      })
    );
    setHasUnsavedChanges(true);
  };

  // Mapeo indexado por número de cuenta de las entregas online
  const submissionsMap = useMemo(() => {
    const map = new Map();
    entregasOnline.forEach((sub) => {
      if (sub.numero_cuenta) {
        map.set(String(sub.numero_cuenta), sub);
      }
    });
    return map;
  }, [entregasOnline]);

  // Abrir modal de inspección y calificación de entrega
  const handleOpenInspect = (sub, est) => {
    setInspectingSubmission(sub);
    setInspectingStudent(est || null);
    const existingGrade = getStudentQuizGrade(est);
    if (existingGrade !== "" && existingGrade !== undefined && existingGrade !== null) {
      setEvalScore(String(existingGrade));
    } else if (sub.nota_obtenida !== null && sub.nota_obtenida !== undefined) {
      setEvalScore(String(sub.nota_obtenida));
    } else {
      setEvalScore("");
    }
    setEvalComments(sub.comentarios || "");
  };

  const handleCloseInspect = () => {
    setInspectingSubmission(null);
    setInspectingStudent(null);
    setEvalScore("");
    setEvalComments("");
  };

  // Guardar calificación de la entrega en el servidor y sincronizar en el libro
  const handleSaveEvaluation = async () => {
    if (!inspectingSubmission) return;
    if (!canEdit) {
      notifyRef.current("No tienes permisos para calificar en esta semana.", "warning");
      return;
    }

    const cleanVal = String(evalScore).replace(",", ".").trim();
    if (cleanVal === "") {
      notifyRef.current("Por favor ingresa una nota numérica entre 0.000 y 5.000 puntos.", "warning");
      return;
    }

    const num = Number(cleanVal);
    if (isNaN(num) || num < 0 || num > 5) {
      notifyRef.current("La nota de la prueba debe ser un número entre 0.000 y 5.000 puntos.", "warning");
      return;
    }

    const roundedScore = Math.round(num * 1000) / 1000;
    setSavingEvaluation(true);

    try {
      const instructorName = currentInstructor?.nombre_completo || "Docente";
      const res = await api.pruebas.calificar(inspectingSubmission.id, {
        nota_obtenida: roundedScore,
        comentarios: evalComments,
        calificado_por: instructorName,
        carrera
      });

      if (res?.success) {
        // 1. Asignar calificación directamente en el listado de estudiantes
        handleGradeChange(inspectingSubmission.numero_cuenta, String(roundedScore));

        // 2. Actualizar la entrega en el estado local de entregas
        setEntregasOnline((prev) =>
          prev.map((e) =>
            e.id === inspectingSubmission.id
              ? {
                  ...e,
                  nota_obtenida: roundedScore,
                  comentarios: evalComments,
                  estado: "calificado",
                  calificado_por: instructorName
                }
              : e
          )
        );

        notifyRef.current(
          `¡Prueba evaluada con éxito! Calificación asignada: ${roundedScore} / 5.000 pts.`,
          "success"
        );
        handleCloseInspect();
      } else {
        notifyRef.current(res?.message || "Error al calificar la entrega", "error");
      }
    } catch (err) {
      console.error("Error al calificar entrega:", err);
      notifyRef.current(err.response?.data?.message || "Error al calificar entrega", "error");
    } finally {
      setSavingEvaluation(false);
    }
  };

  // Asignar nota rápida a todos en la prueba de esta semana (Máx. 5.000 pts)
  const handleBatchGradeQuiz = () => {
    if (!canEdit) {
      notifyRef.current("No tienes permisos para modificar notas en esta semana.", "warning");
      return;
    }

    const defaultScoreStr = window.prompt(
      `Ingresa la calificación a aplicar a TODOS los alumnos para la Prueba de la Semana ${selectedSemana} (Máximo 5.000 pts):`,
      "5.000"
    );

    if (defaultScoreStr === null) return;
    const cleanStr = defaultScoreStr.replace(",", ".");
    const num = Number(cleanStr);
    if (isNaN(num) || num < 0 || num > 5) {
      notifyRef.current("La nota de la prueba no puede ser mayor a 5 puntos (máximo 5.000).", "error");
      return;
    }

    const roundedNum = Math.round(num * 1000) / 1000;

    setEstudiantes((prev) =>
      prev.map((est) => {
        const currentNotas = { ...(est.notas || {}) };
        delete currentNotas[quizLegacyExamencitoKey];
        delete currentNotas[quizLegacyAltKey];

        const updatedNotas = {
          ...currentNotas,
          [quizKey]: roundedNum
        };

        const nextTotal = recalculateTotal(est, updatedNotas);

        return {
          ...est,
          notas: updatedNotas,
          total: nextTotal
        };
      })
    );
    setHasUnsavedChanges(true);
    notifyRef.current(`Nota ${roundedNum} aplicada a todos los alumnos para la Prueba de la Semana ${selectedSemana}`, "info");
  };

  // Limpiar notas de la prueba de esta semana
  const handleClearWeekQuiz = () => {
    if (!canEdit) {
      notifyRef.current("No tienes permisos para modificar notas en esta semana.", "warning");
      return;
    }

    if (!window.confirm(`¿Seguro que deseas limpiar las notas de la prueba de la Semana ${selectedSemana}?`)) {
      return;
    }

    setEstudiantes((prev) =>
      prev.map((est) => {
        const updatedNotas = { ...(est.notas || {}) };
        delete updatedNotas[quizKey];
        delete updatedNotas[quizLegacyExamencitoKey];
        delete updatedNotas[quizLegacyKey];
        delete updatedNotas[quizLegacyAltKey];

        const nextTotal = recalculateTotal(est, updatedNotas);

        return {
          ...est,
          notas: updatedNotas,
          total: nextTotal
        };
      })
    );
    setHasUnsavedChanges(true);
    notifyRef.current(`Se limpiaron las notas de la Prueba de la Semana ${selectedSemana}`, "info");
  };

  // Guardar calificaciones en el backend
  const handleSaveAll = async () => {
    if (!seccion?.id) return;
    if (!canEdit) {
      notifyRef.current(`No tienes permisos para guardar cambios en la Semana ${selectedSemana}.`, "warning");
      return;
    }

    // 🔒 Validación Académica Estricta: Ninguna nota de prueba puede superar 5 puntos
    for (const est of estudiantes) {
      const notas = est.notas || {};
      for (const [k, v] of Object.entries(notas)) {
        const numVal = Number(v);
        if (
          !isNaN(numVal) &&
          (k.startsWith("examencito_") ||
            k.startsWith("prueba_") ||
            k.startsWith("Examencito de ") ||
            k.startsWith("Prueba de ")) &&
          numVal > 5
        ) {
          notifyRef.current(
            `No se puede guardar: El estudiante "${est.nombre_completo || est.numero_cuenta}" tiene una nota de prueba de ${numVal} pts. El valor máximo permitido es 5.000 puntos.`,
            "error"
          );
          return;
        }
      }
    }

    setSaving(true);
    try {
      const updates = estudiantes.map((est) => ({
        numero_cuenta: est.numero_cuenta,
        notas: est.notas || {},
        asistencias: est.asistencias || {},
        primer_examen: est.primer_examen ?? 0,
        segundo_examen: est.segundo_examen ?? 0,
        tercer_examen: est.tercer_examen ?? 0,
        total: est.total ?? 0
      }));

      await api.estudiantes.saveBatch(seccion.id, updates, carrera);
      setHasUnsavedChanges(false);
      notifyRef.current("¡Notas de la prueba semanal guardadas con éxito!", "success");
    } catch (err) {
      console.error("Error al guardar notas de prueba semanal:", err);
      notifyRef.current(err.response?.data?.message || "Error al guardar las notas en el servidor", "error");
    } finally {
      setSaving(false);
    }
  };

  // Estadísticas de la prueba de la semana seleccionada
  const stats = useMemo(() => {
    if (currentWeekInfo.esExamen) return { gradedCount: 0, pendingCount: 0, average: "0.000" };

    let totalPoints = 0;
    let gradedCount = 0;

    estudiantes.forEach((est) => {
      const val = getStudentQuizGrade(est);
      if (val !== "" && val !== null && !isNaN(Number(val))) {
        totalPoints += Number(val);
        gradedCount++;
      }
    });

    const average = gradedCount > 0 ? (totalPoints / gradedCount).toFixed(3) : "0.000";

    return {
      gradedCount,
      pendingCount: estudiantes.length - gradedCount,
      average
    };
  }, [estudiantes, quizKey, currentWeekInfo.esExamen]);

  // Estadísticas de entregas online
  const onlineStats = useMemo(() => {
    const total = entregasOnline.length;
    const calificados = entregasOnline.filter((e) => e.estado === "calificado").length;
    const pendientes = total - calificados;
    return { total, calificados, pendientes };
  }, [entregasOnline]);

  // Alumnos con notas de prueba que exceden el límite de 5.000 puntos
  const invalidQuizStudents = useMemo(() => {
    return estudiantes.filter((est) => {
      const notas = est.notas || {};
      return Object.entries(notas).some(([k, v]) => {
        const num = Number(v);
        return (
          !isNaN(num) &&
          (k.startsWith("examencito_") ||
            k.startsWith("prueba_") ||
            k.startsWith("Examencito de ") ||
            k.startsWith("Prueba de ")) &&
          num > 5
        );
      });
    });
  }, [estudiantes]);

  // Filtrado por búsqueda
  const filteredEstudiantes = useMemo(() => {
    if (!searchTerm.trim()) return estudiantes;
    const s = searchTerm.toLowerCase().trim();
    return estudiantes.filter(
      (e) =>
        (e.nombre_completo || "").toLowerCase().includes(s) ||
        (e.numero_cuenta || "").toLowerCase().includes(s)
    );
  }, [estudiantes, searchTerm]);

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
        <RefreshCw size={28} className="animate-spin" color="#10b981" />
        <span style={{ fontSize: "0.95rem", fontWeight: 700 }}>
          Cargando pruebas semanales y calificaciones...
        </span>
      </div>
    );
  }

  return (
    <div
      className="glass-panel animate-fade-in"
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "1.5rem"
      }}
    >
      {/* =================================================================== */}
      {/* 1. CABECERA DEL MÓDULO                                             */}
      {/* =================================================================== */}
      <div
        style={{
          padding: "1.5rem 1.75rem",
          background: "#ffffff",
          borderRadius: "1.1rem",
          border: "1px solid #e2e8f0",
          boxShadow: "0 4px 15px -3px rgba(0, 0, 0, 0.04)",
          display: "flex",
          flexDirection: "column",
          gap: "1.1rem"
        }}
      >
        {/* Fila 1: Título, Sección, Botón Volver y Botón Guardar */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: "1rem" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "0.65rem", flexWrap: "wrap", marginBottom: "0.35rem" }}>
              {!hideBackButton && (
                <button
                  onClick={onClose}
                  style={{
                    background: "#f1f5f9",
                    border: "none",
                    borderRadius: "0.5rem",
                    padding: "0.4rem 0.65rem",
                    cursor: "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "0.3rem",
                    color: "#475569",
                    fontSize: "0.8rem",
                    fontWeight: 700,
                    marginRight: "0.35rem"
                  }}
                  title="Volver a los módulos de la sección"
                >
                  <ArrowLeft size={15} />
                  <span>Volver</span>
                </button>
              )}

              <div
                style={{
                  width: "34px",
                  height: "34px",
                  borderRadius: "0.55rem",
                  background: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
                  color: "#ffffff",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center"
                }}
              >
                <FileEdit size={20} />
              </div>

              <h2 style={{ fontSize: "1.35rem", fontWeight: 900, color: "#0f172a", margin: 0, letterSpacing: "-0.01em" }}>
                Subir Nota de Prueba Semanal
              </h2>

              <span
                style={{
                  background: "linear-gradient(135deg, #0284c7 0%, #0369a1 100%)",
                  color: "#ffffff",
                  padding: "0.2rem 0.65rem",
                  borderRadius: "0.45rem",
                  fontSize: "0.75rem",
                  fontWeight: 900,
                  letterSpacing: "0.03em"
                }}
              >
                {seccion?.codigo}
              </span>

              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "0.3rem",
                  background: "#f1f5f9",
                  color: "#475569",
                  padding: "0.2rem 0.6rem",
                  borderRadius: "9999px",
                  fontSize: "0.74rem",
                  fontWeight: 700
                }}
              >
                <Users size={12} />
                <span>{estudiantes.length} Alumnos</span>
              </span>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap", fontSize: "0.82rem", color: "#64748b" }}>
              <span>{carrera}</span>
              <span>•</span>
              <span>{seccion?.dia} {seccion?.hora_inicio} - {seccion?.hora_fin}</span>
              {assignedInstructorForWeek && (
                <>
                  <span>•</span>
                  <span style={{ color: "#059669", fontWeight: 700 }}>
                    Docente asignado: {assignedInstructorForWeek}
                  </span>
                </>
              )}
            </div>
          </div>

          {/* Botones de Acción / Guardar */}
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
            {hasUnsavedChanges && (
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "0.35rem",
                  fontSize: "0.76rem",
                  fontWeight: 800,
                  color: "#d97706",
                  background: "#fef3c7",
                  border: "1px solid #fde68a",
                  padding: "0.35rem 0.75rem",
                  borderRadius: "9999px"
                }}
              >
                <AlertCircle size={13} />
                <span>Cambios sin guardar</span>
              </span>
            )}

            <button
              onClick={handleSaveAll}
              disabled={saving || !canEdit}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "0.5rem",
                background: !canEdit
                  ? "#94a3b8"
                  : hasUnsavedChanges
                  ? "linear-gradient(135deg, #10b981 0%, #059669 100%)"
                  : "linear-gradient(135deg, #10b981 0%, #047857 100%)",
                color: "#ffffff",
                border: "none",
                padding: "0.6rem 1.25rem",
                borderRadius: "0.65rem",
                fontSize: "0.88rem",
                fontWeight: 800,
                cursor: (!canEdit || saving) ? "not-allowed" : "pointer",
                boxShadow: canEdit
                  ? (hasUnsavedChanges ? "0 4px 14px rgba(16, 185, 129, 0.3)" : "0 4px 14px rgba(16, 185, 129, 0.25)")
                  : "none",
                opacity: (!canEdit || saving) ? 0.7 : 1,
                transition: "all 0.2s ease"
              }}
              title={!canEdit ? "No tienes permisos de edición para esta semana" : "Guardar calificaciones"}
            >
              {saving ? (
                <>
                  <RefreshCw size={15} className="animate-spin" />
                  <span>Guardando...</span>
                </>
              ) : !canEdit ? (
                <>
                  <Lock size={15} />
                  <span>Solo Lectura</span>
                </>
              ) : (
                <>
                  <Save size={15} />
                  <span>Guardar Nota de Prueba</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* =================================================================== */}
        {/* BANNER DE REGLA Y PERMISO DE ASIGNACIÓN                             */}
        {/* =================================================================== */}
        {currentWeekInfo.esExamen ? (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.55rem",
              background: "#eff6ff",
              border: "1.5px solid #bfdbfe",
              borderRadius: "0.75rem",
              padding: "0.65rem 1rem",
              color: "#1e40af",
              fontSize: "0.82rem",
              fontWeight: 700
            }}
          >
            <Info size={18} color="#2563eb" style={{ flexShrink: 0 }} />
            <span>
              <strong>Semana de Examen Parcial:</strong> En las semanas de examen no hay prueba semanal. Únicamente se evalúa el examen parcial.
            </span>
          </div>
        ) : canEdit ? (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.55rem",
              background: "#f0fdf4",
              border: "1.5px solid #86efac",
              borderRadius: "0.75rem",
              padding: "0.65rem 1rem",
              color: "#166534",
              fontSize: "0.82rem",
              fontWeight: 700
            }}
          >
            <ShieldCheck size={18} color="#16a34a" style={{ flexShrink: 0 }} />
            <span>
              Tienes asignado el rol oficial de <strong>Subir nota de prueba semanal</strong> en la <strong>Semana {selectedSemana}</strong>. Puedes ingresar y modificar calificaciones.
            </span>
          </div>
        ) : (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.55rem",
              background: "#fffbeb",
              border: "1.5px solid #fde68a",
              borderRadius: "0.75rem",
              padding: "0.65rem 1rem",
              color: "#92400e",
              fontSize: "0.82rem",
              fontWeight: 700
            }}
          >
            <ShieldAlert size={18} color="#d97706" style={{ flexShrink: 0 }} />
            <span>
              <strong>Modo de Solo Lectura:</strong> Para la <strong>Semana {selectedSemana}</strong>, la subida de prueba semanal está asignada a <strong>{assignedInstructorForWeek || "ningún docente (sin asignar)"}</strong>. Solo la persona asignada tiene autorización para calificar.
            </span>
          </div>
        )}

        {/* =================================================================== */}
        {/* SELECTOR DE SEMANA Y RESUMEN                                        */}
        {/* =================================================================== */}
        <div
          style={{
            background: "#f0fdf4",
            border: "1.5px solid #bbf7d0",
            borderRadius: "0.85rem",
            padding: "0.85rem 1.15rem",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: "1rem"
          }}
        >
          {/* Selector de Semana */}
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap" }}>
            <span style={{ fontSize: "0.82rem", fontWeight: 800, color: "#166534", textTransform: "uppercase", letterSpacing: "0.02em" }}>
              Semana a Calificar:
            </span>

            <select
              value={selectedSemana}
              onChange={(e) => handleSelectSemana(Number(e.target.value))}
              style={{
                padding: "0.45rem 0.85rem",
                borderRadius: "0.55rem",
                border: "1.5px solid #16a34a",
                background: "#ffffff",
                color: "#166534",
                fontSize: "0.88rem",
                fontWeight: 800,
                outline: "none",
                cursor: "pointer"
              }}
            >
              {availableWeeks.map((w) => (
                <option key={w.numero_semana} value={w.numero_semana}>
                  {getWeekDisplayName(w)}
                </option>
              ))}
            </select>

            <span
              style={{
                background: currentWeekInfo.esExamen ? "#fef3c7" : "#dcfce7",
                color: currentWeekInfo.esExamen ? "#b45309" : "#15803d",
                padding: "0.2rem 0.6rem",
                borderRadius: "9999px",
                fontSize: "0.74rem",
                fontWeight: 800
              }}
            >
              {getWeekDisplayName(currentWeekInfo)}
            </span>

            {!currentWeekInfo.esExamen && (
              <span
                style={{
                  background: "#ffffff",
                  border: "1px solid #86efac",
                  color: "#166534",
                  padding: "0.2rem 0.55rem",
                  borderRadius: "0.45rem",
                  fontSize: "0.74rem",
                  fontWeight: 700,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "0.3rem"
                }}
              >
                <FileEdit size={11} color="#16a34a" />
                <span>Prueba Corta de la Semana {selectedSemana}</span>
              </span>
            )}
          </div>

          {/* Estadísticas de la semana */}
          {!currentWeekInfo.esExamen && (
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.35rem", background: "#ffffff", border: "1px solid #bbf7d0", padding: "0.3rem 0.65rem", borderRadius: "0.5rem", fontSize: "0.78rem" }}>
                <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#16a34a" }} />
                <span style={{ color: "#166534", fontWeight: 800 }}>Calificados: {stats.gradedCount}</span>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: "0.35rem", background: "#ffffff", border: "1px solid #fed7aa", padding: "0.3rem 0.65rem", borderRadius: "0.5rem", fontSize: "0.78rem" }}>
                <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#f97316" }} />
                <span style={{ color: "#c2410c", fontWeight: 800 }}>Pendientes: {stats.pendingCount}</span>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: "0.35rem", background: "#ffffff", border: "1px solid #a7f3d0", padding: "0.3rem 0.65rem", borderRadius: "0.5rem", fontSize: "0.78rem" }}>
                <span style={{ color: "#065f46", fontWeight: 800 }}>Promedio: {stats.average} pts</span>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: "0.35rem", background: "#ffffff", border: "1px solid #bfdbfe", padding: "0.3rem 0.65rem", borderRadius: "0.5rem", fontSize: "0.78rem" }}>
                <Clock size={12} color="#0284c7" />
                <span style={{ color: "#0369a1", fontWeight: 800 }}>
                  Entregas Online: {onlineStats.total} {onlineStats.pendientes > 0 ? `(${onlineStats.pendientes} por revisar)` : ""}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Banner informativo de prueba digital si existe para la semana */}
        {!currentWeekInfo.esExamen && quizSemanal && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "0.75rem",
              background: quizSemanal.publicada ? "#f0fdf4" : "#fefce8",
              border: quizSemanal.publicada ? "1.5px solid #86efac" : "1.5px solid #fef08a",
              borderRadius: "0.75rem",
              padding: "0.65rem 1rem",
              fontSize: "0.82rem"
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <span
                style={{
                  padding: "0.2rem 0.6rem",
                  borderRadius: "9999px",
                  fontSize: "0.74rem",
                  fontWeight: 800,
                  background: quizSemanal.publicada ? "#dcfce7" : "#fef9c3",
                  color: quizSemanal.publicada ? "#15803d" : "#854d0e"
                }}
              >
                {quizSemanal.publicada ? "🟢 Cuestionario Digital Publicado" : "🟡 Cuestionario en Borrador"}
              </span>
              <span style={{ color: "#1e293b", fontWeight: 800 }}>
                {quizSemanal.titulo || `Prueba de la Semana ${selectedSemana}`}
              </span>
              <span style={{ color: "#64748b" }}>
                • {quizSemanal.preguntas?.length || 0} Reactivos evaluativos
              </span>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <span style={{ color: "#0369a1", fontWeight: 700, fontSize: "0.78rem" }}>
                {onlineStats.total} alumnos han completado esta prueba desde su dashboard
              </span>
            </div>
          </div>
        )}

        {/* Fila 3: Acciones masivas y Barra de Búsqueda */}
        {!currentWeekInfo.esExamen && (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "0.75rem", paddingTop: "0.25rem" }}>
            {/* Acciones Rápidas */}
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
              <button
                onClick={handleBatchGradeQuiz}
                disabled={!canEdit}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "0.35rem",
                  background: canEdit ? "#f0fdf4" : "#f1f5f9",
                  border: canEdit ? "1.5px solid #86efac" : "1px solid #cbd5e1",
                  color: canEdit ? "#166534" : "#94a3b8",
                  padding: "0.4rem 0.75rem",
                  borderRadius: "0.55rem",
                  fontSize: "0.78rem",
                  fontWeight: 800,
                  cursor: canEdit ? "pointer" : "not-allowed",
                  opacity: canEdit ? 1 : 0.6,
                  transition: "all 0.15s ease"
                }}
                title={!canEdit ? "Solo lectura" : "Asignar nota rápida a todos en esta prueba"}
              >
                <CheckCheck size={14} />
                <span>Asignar nota a todos en esta prueba</span>
              </button>

              <button
                onClick={handleClearWeekQuiz}
                disabled={!canEdit}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "0.35rem",
                  background: "#f8fafc",
                  border: "1px solid #cbd5e1",
                  color: canEdit ? "#475569" : "#94a3b8",
                  padding: "0.4rem 0.75rem",
                  borderRadius: "0.55rem",
                  fontSize: "0.78rem",
                  fontWeight: 700,
                  cursor: canEdit ? "pointer" : "not-allowed",
                  opacity: canEdit ? 1 : 0.6,
                  transition: "all 0.15s ease"
                }}
                title={!canEdit ? "Solo lectura" : "Limpiar calificaciones de la prueba de esta semana"}
              >
                <span>Limpiar Prueba</span>
              </button>
            </div>

            {/* Barra de Búsqueda */}
            <div style={{ position: "relative", width: "100%", maxWidth: "300px" }}>
              <Search size={14} color="#94a3b8" style={{ position: "absolute", left: "0.75rem", top: "50%", transform: "translateY(-50%)" }} />
              <input
                type="text"
                placeholder="Buscar alumno por nombre o cuenta..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={{
                  width: "100%",
                  padding: "0.45rem 0.75rem 0.45rem 2rem",
                  borderRadius: "0.5rem",
                  border: "1px solid #cbd5e1",
                  fontSize: "0.82rem",
                  outline: "none",
                  background: "#f8fafc"
                }}
              />
            </div>
          </div>
        )}
      </div>

      {/* =================================================================== */}
      {/* 2. LISTA DE ALUMNOS CON LA CASILLA DE PRUEBA SEMANAL                */}
      {/* =================================================================== */}
      <div
        style={{
          background: "#ffffff",
          borderRadius: "1.1rem",
          border: "1px solid #e2e8f0",
          boxShadow: "0 4px 15px -3px rgba(0, 0, 0, 0.04)",
          padding: "1.25rem 1.5rem",
          display: "flex",
          flexDirection: "column",
          gap: "0.85rem"
        }}
      >
        {currentWeekInfo.esExamen ? (
          <div
            style={{
              padding: "3rem",
              textAlign: "center",
              background: "#f8fafc",
              borderRadius: "0.65rem",
              border: "1.5px dashed #cbd5e1",
              color: "#64748b",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "0.75rem"
            }}
          >
            <GraduationCap size={36} color="#94a3b8" />
            <strong style={{ fontSize: "1rem", color: "#334155" }}>
              Semana {selectedSemana} es Semana de Examen Parcial
            </strong>
            <span style={{ fontSize: "0.85rem", maxWidth: "450px" }}>
              En las semanas de exámenes parciales no hay prueba semanal. Únicamente se evalúa el examen parcial y la asistencia.
            </span>
          </div>
        ) : (
          <>
            {/* ⚠️ ALERTA: Si hay notas de prueba inválidas */}
            {invalidQuizStudents.length > 0 && (
              <div
                style={{
                  background: "#fef2f2",
                  border: "1.5px solid #f87171",
                  borderRadius: "0.75rem",
                  padding: "0.85rem 1.25rem",
                  display: "flex",
                  alignItems: "center",
                  gap: "0.85rem",
                  color: "#991b1b",
                  boxShadow: "0 2px 8px rgba(239, 68, 68, 0.08)"
                }}
              >
                <AlertCircle size={22} color="#dc2626" style={{ flexShrink: 0 }} />
                <div style={{ fontSize: "0.84rem", fontWeight: 700, lineHeight: 1.45 }}>
                  <strong style={{ color: "#b91c1c", fontSize: "0.88rem" }}>
                    ⚠️ Calificaciones fuera de límite detectadas:
                  </strong>{" "}
                  Las notas de pruebas semanales <strong>no pueden superar 5.000 puntos</strong>. Se encontraron valores superiores al límite (por ejemplo en{" "}
                  <strong>{invalidQuizStudents[0].nombre_completo || "un alumno"}</strong>). Debes corregir las casillas con etiqueta roja a un valor entre <strong>0.000 y 5.000</strong> antes de poder guardar los cambios.
                </div>
              </div>
            )}

            {/* Cabecera de la tabla */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "45px 1.5fr 1.3fr 1.2fr",
                gap: "0.75rem",
                padding: "0.65rem 0.85rem",
                background: "#f8fafc",
                borderRadius: "0.65rem",
                border: "1px solid #e2e8f0",
                fontSize: "0.75rem",
                fontWeight: 800,
                color: "#475569",
                textTransform: "uppercase",
                letterSpacing: "0.03em",
                alignItems: "center"
              }}
            >
              <span>#</span>
              <span>Alumno / N° de Cuenta</span>
              <span>Entrega Digital</span>
              <div style={{ textAlign: "center" }}>
                <div style={{ color: "#059669", fontWeight: 900, display: "flex", alignItems: "center", justifyContent: "center", gap: "0.35rem" }}>
                  <span>Prueba Corta Semana {selectedSemana}</span>
                  <span style={{ fontSize: "0.66rem", fontWeight: 800, background: "#dcfce7", color: "#15803d", padding: "0.1rem 0.4rem", borderRadius: "9999px" }}>
                    Máx. 5.000 pts
                  </span>
                </div>
                <div style={{ fontSize: "0.68rem", color: "#64748b", fontWeight: 600, textTransform: "none" }}>
                  {currentWeekInfo.parcial}
                </div>
              </div>
            </div>

            {/* Listado de alumnos */}
            {filteredEstudiantes.length === 0 ? (
              <div
                style={{
                  padding: "2.5rem",
                  textAlign: "center",
                  background: "#f8fafc",
                  borderRadius: "0.65rem",
                  border: "1.5px dashed #cbd5e1",
                  color: "#64748b",
                  fontSize: "0.85rem"
                }}
              >
                {searchTerm ? "No se encontraron alumnos con ese criterio de búsqueda." : "No hay alumnos matriculados en esta sección."}
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                {filteredEstudiantes.map((est, index) => {
                  const gradeVal = getStudentQuizGrade(est);
                  const onlineSub = submissionsMap.get(String(est.numero_cuenta));
                  const isGraded = onlineSub?.estado === "calificado";

                  return (
                    <div
                      key={est.numero_cuenta || est.id || index}
                      style={{
                        display: "grid",
                        gridTemplateColumns: "45px 1.5fr 1.3fr 1.2fr",
                        gap: "0.75rem",
                        alignItems: "center",
                        padding: "0.75rem 0.85rem",
                        borderRadius: "0.65rem",
                        border: "1px solid #e2e8f0",
                        background: "#ffffff",
                        transition: "all 0.15s ease"
                      }}
                    >
                      {/* Número correlativo */}
                      <span style={{ fontSize: "0.8rem", fontWeight: 800, color: "#94a3b8" }}>
                        {String(index + 1).padStart(2, "0")}
                      </span>

                      {/* Nombre Completo y Cuenta */}
                      <div style={{ display: "flex", flexDirection: "column", gap: "0.15rem", paddingRight: "0.5rem" }}>
                        <strong style={{ fontSize: "0.92rem", color: "#0f172a", lineHeight: 1.25 }}>
                          {est.nombre_completo || "Sin Nombre Registrado"}
                        </strong>
                        <span style={{ fontSize: "0.74rem", color: "#64748b", fontFamily: "monospace" }}>
                          Cuenta: {est.numero_cuenta || "Sin cuenta"}
                        </span>
                      </div>

                      {/* Estado de Entrega Digital / Botón de Revisión */}
                      <div style={{ display: "flex", alignItems: "center" }}>
                        {onlineSub ? (
                          <button
                            type="button"
                            onClick={() => handleOpenInspect(onlineSub, est)}
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "0.45rem",
                              background: isGraded ? "#f0fdf4" : "#fff7ed",
                              border: isGraded ? "1.5px solid #86efac" : "1.5px solid #fed7aa",
                              color: isGraded ? "#166534" : "#c2410c",
                              padding: "0.4rem 0.75rem",
                              borderRadius: "0.55rem",
                              fontSize: "0.76rem",
                              fontWeight: 800,
                              cursor: "pointer",
                              transition: "all 0.15s ease",
                              boxShadow: "0 1px 3px rgba(0,0,0,0.03)"
                            }}
                            title="Click para revisar las respuestas y calificar la prueba digital"
                          >
                            {isGraded ? (
                              <CheckCircle2 size={14} color="#16a34a" />
                            ) : (
                              <Clock size={14} color="#ea580c" />
                            )}
                            <span>
                              {isGraded
                                ? `Calificada (${onlineSub.nota_obtenida ?? gradeVal} pts)`
                                : "Revisar Respuestas"}
                            </span>
                            <Eye size={13} style={{ opacity: 0.7 }} />
                          </button>
                        ) : (
                          <span style={{ fontSize: "0.75rem", color: "#94a3b8", display: "inline-flex", alignItems: "center", gap: "0.3rem" }}>
                            Sin entrega digital
                          </span>
                        )}
                      </div>

                      {/* Casilla de calificación de la prueba semanal */}
                      <div style={{ display: "flex", justifyContent: "center" }}>
                        <div
                          style={{
                            position: "relative",
                            width: "100%",
                            maxWidth: "160px"
                          }}
                        >
                          <input
                            type="text"
                            inputMode="decimal"
                            value={gradeVal}
                            onChange={(e) => handleGradeChange(est.numero_cuenta, e.target.value)}
                            onBlur={() => {
                              if (typeof gradeVal === "string" && gradeVal.endsWith(".")) {
                                handleGradeChange(est.numero_cuenta, gradeVal.slice(0, -1));
                              }
                            }}
                            disabled={!canEdit}
                            placeholder="0.000"
                            style={{
                              width: "100%",
                              textAlign: "center",
                              padding: "0.55rem 0.75rem",
                              borderRadius: "0.55rem",
                              border:
                                gradeVal !== "" && Number(gradeVal) > 5
                                  ? "2px solid #ef4444"
                                  : gradeVal !== ""
                                  ? "2px solid #10b981"
                                  : "1.5px solid #cbd5e1",
                              background:
                                !canEdit
                                  ? "#f1f5f9"
                                  : gradeVal !== "" && Number(gradeVal) > 5
                                  ? "#fef2f2"
                                  : gradeVal !== ""
                                  ? "#f0fdf4"
                                  : "#ffffff",
                              color:
                                !canEdit
                                  ? "#94a3b8"
                                  : gradeVal !== "" && Number(gradeVal) > 5
                                  ? "#b91c1c"
                                  : "#065f46",
                              fontSize: "0.95rem",
                              fontWeight: 800,
                              outline: "none",
                              cursor: canEdit ? "text" : "not-allowed",
                              transition: "all 0.15s ease"
                            }}
                            title={
                              !canEdit
                                ? `Solo lectura. Docente asignado: ${assignedInstructorForWeek || "ninguno"}`
                                : gradeVal !== "" && Number(gradeVal) > 5
                                ? `⚠️ Error: La nota máxima es 5.000 puntos (ingresaste: ${gradeVal})`
                                : `Calificación Prueba: Semana ${selectedSemana}`
                            }
                          />

                          {/* 🏷️ ETIQUETA CLARA DE ERROR CUANDO SE EXCEDE EL LÍMITE */}
                          {gradeVal !== "" && Number(gradeVal) > 5 && (
                            <div
                              style={{
                                marginTop: "0.35rem",
                                padding: "0.22rem 0.45rem",
                                background: "#fee2e2",
                                border: "1.5px solid #f87171",
                                borderRadius: "0.45rem",
                                fontSize: "0.72rem",
                                fontWeight: 800,
                                color: "#b91c1c",
                                textAlign: "center",
                                lineHeight: 1.25,
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                gap: "0.25rem"
                              }}
                            >
                              <span>⚠️ Máx 5.000 pts (ingresaste: {gradeVal})</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Botón inferior de guardar */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: "0.75rem", paddingTop: "0.75rem" }}>
              <button
                onClick={handleSaveAll}
                disabled={saving || !canEdit}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "0.5rem",
                  background: !canEdit
                    ? "#94a3b8"
                    : hasUnsavedChanges
                    ? "linear-gradient(135deg, #10b981 0%, #059669 100%)"
                    : "linear-gradient(135deg, #10b981 0%, #047857 100%)",
                  color: "#ffffff",
                  border: "none",
                  padding: "0.65rem 1.5rem",
                  borderRadius: "0.65rem",
                  fontSize: "0.88rem",
                  fontWeight: 800,
                  cursor: (!canEdit || saving) ? "not-allowed" : "pointer",
                  boxShadow: canEdit ? "0 4px 14px rgba(16, 185, 129, 0.25)" : "none",
                  opacity: (!canEdit || saving) ? 0.7 : 1,
                  transition: "all 0.2s ease"
                }}
                title={!canEdit ? "Solo lectura" : "Guardar notas de prueba"}
              >
                {saving ? (
                  <>
                    <RefreshCw size={15} className="animate-spin" />
                    <span>Guardando notas...</span>
                  </>
                ) : !canEdit ? (
                  <>
                    <Lock size={15} />
                    <span>Solo Lectura (Semana {selectedSemana})</span>
                  </>
                ) : (
                  <>
                    <Save size={15} />
                    <span>Guardar Nota de Prueba (Semana {selectedSemana})</span>
                  </>
                )}
              </button>
            </div>
          </>
        )}
      </div>

      {/* =================================================================== */}
      {/* 3. MODAL DE REVISIÓN Y CALIFICACIÓN DE ENTREGA DIGITAL             */}
      {/* =================================================================== */}
      {inspectingSubmission && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(15, 23, 42, 0.65)",
            backdropFilter: "blur(4px)",
            zIndex: 9999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "1rem"
          }}
          onClick={handleCloseInspect}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "#ffffff",
              borderRadius: "1rem",
              width: "100%",
              maxWidth: "840px",
              maxHeight: "92vh",
              display: "flex",
              flexDirection: "column",
              boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
              border: "1px solid #e2e8f0",
              overflow: "hidden"
            }}
          >
            {/* Modal Header */}
            <div
              style={{
                padding: "1.25rem 1.5rem",
                borderBottom: "1px solid #e2e8f0",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                background: "linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)"
              }}
            >
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.25rem" }}>
                  <h3 style={{ fontSize: "1.15rem", fontWeight: 900, color: "#0f172a", margin: 0 }}>
                    Revisión de Entrega Digital
                  </h3>
                  <span
                    style={{
                      fontSize: "0.72rem",
                      fontWeight: 800,
                      padding: "0.15rem 0.5rem",
                      borderRadius: "9999px",
                      background: inspectingSubmission.estado === "calificado" ? "#dcfce7" : "#fef3c7",
                      color: inspectingSubmission.estado === "calificado" ? "#15803d" : "#b45309"
                    }}
                  >
                    {inspectingSubmission.estado === "calificado" ? "✓ Calificada" : "⏳ Pendiente"}
                  </span>
                </div>
                <div style={{ fontSize: "0.82rem", color: "#475569" }}>
                  <strong>{inspectingStudent?.nombre_completo || inspectingSubmission.nombre_completo || "Estudiante"}</strong>
                  {" • Cuenta: "}{inspectingSubmission.numero_cuenta}
                  {" • "}Semana {selectedSemana}
                  {inspectingSubmission.fecha_envio && (
                    <span style={{ color: "#64748b" }}>
                      {" • Enviado: "}{new Date(inspectingSubmission.fecha_envio).toLocaleString("es-HN")}
                    </span>
                  )}
                </div>
              </div>

              <button
                type="button"
                onClick={handleCloseInspect}
                style={{
                  background: "#ffffff",
                  border: "1px solid #cbd5e1",
                  borderRadius: "0.5rem",
                  padding: "0.4rem",
                  cursor: "pointer",
                  color: "#64748b",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center"
                }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Body: Questions and Student Answers */}
            <div
              style={{
                padding: "1.5rem",
                overflowY: "auto",
                display: "flex",
                flexDirection: "column",
                gap: "1.5rem",
                flex: 1
              }}
            >
              {quizSemanal?.preguntas && quizSemanal.preguntas.length > 0 ? (
                quizSemanal.preguntas.map((pregunta, qIdx) => (
                  <div
                    key={pregunta.id || qIdx}
                    style={{
                      border: "1px solid #e2e8f0",
                      borderRadius: "0.85rem",
                      padding: "1.25rem",
                      background: "#f8fafc"
                    }}
                  >
                    {/* Header Pregunta */}
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.75rem" }}>
                      <span style={{ fontSize: "0.82rem", fontWeight: 800, color: "#0f172a" }}>
                        Pregunta #{qIdx + 1}
                      </span>
                      {pregunta.puntos && (
                        <span style={{ fontSize: "0.74rem", fontWeight: 800, color: "#059669", background: "#dcfce7", padding: "0.15rem 0.5rem", borderRadius: "9999px" }}>
                          Valor: {pregunta.puntos} pts
                        </span>
                      )}
                    </div>

                    {/* Micrografía / Imagen si tiene */}
                    {pregunta.imagen_url && (
                      <div style={{ marginBottom: "1rem", textAlign: "center" }}>
                        <img
                          src={pregunta.imagen_url}
                          alt={`Micrografía Pregunta ${qIdx + 1}`}
                          style={{
                            maxHeight: "220px",
                            maxWidth: "100%",
                            borderRadius: "0.5rem",
                            border: "1px solid #cbd5e1",
                            objectFit: "contain",
                            boxShadow: "0 2px 8px rgba(0,0,0,0.06)"
                          }}
                        />
                      </div>
                    )}

                    {/* Enunciado */}
                    {pregunta.enunciado ? (
                      <div style={{ fontSize: "0.92rem", fontWeight: 700, color: "#1e293b", marginBottom: "1rem", whiteSpace: "pre-wrap" }}>
                        {pregunta.enunciado}
                      </div>
                    ) : null}

                    {/* Sub-items */}
                    <div style={{ display: "flex", flexDirection: "column", gap: "0.85rem" }}>
                      {(pregunta.items || []).map((item, iIdx) => {
                        return (
                          <div
                            key={item.id || iIdx}
                            style={{
                              background: "#ffffff",
                              borderRadius: "0.65rem",
                              border: "1px solid #cbd5e1",
                              padding: "0.85rem 1rem"
                            }}
                          >
                            <div style={{ fontSize: "0.82rem", fontWeight: 800, color: "#334155", marginBottom: "0.5rem" }}>
                              {item.instruccion || (item.tipo === "texto_corto" ? "Respuesta directa:" : "Listado numerado:")}
                            </div>

                            {item.tipo === "texto_corto" ? (
                              <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
                                <div style={{ fontSize: "0.78rem", color: "#64748b", fontWeight: 700 }}>
                                  Respuesta del estudiante:
                                </div>
                                <div
                                  style={{
                                    padding: "0.55rem 0.75rem",
                                    borderRadius: "0.45rem",
                                    background: "#f1f5f9",
                                    border: "1px solid #cbd5e1",
                                    fontSize: "0.88rem",
                                    color: inspectingSubmission.respuestas?.[`${pregunta.id}_${item.id}`] ? "#0f172a" : "#94a3b8",
                                    fontWeight: 600
                                  }}
                                >
                                  {inspectingSubmission.respuestas?.[`${pregunta.id}_${item.id}`] || "— (Sin respuesta) —"}
                                </div>

                                {item.respuesta_modelo && (
                                  <div
                                    style={{
                                      marginTop: "0.25rem",
                                      padding: "0.45rem 0.65rem",
                                      borderRadius: "0.45rem",
                                      background: "#ecfdf5",
                                      border: "1px solid #a7f3d0",
                                      fontSize: "0.78rem",
                                      color: "#065f46"
                                    }}
                                  >
                                    <strong>💡 Respuesta modelo docente:</strong> {item.respuesta_modelo}
                                  </div>
                                )}
                              </div>
                            ) : (
                              <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                                <div style={{ fontSize: "0.78rem", color: "#64748b", fontWeight: 700 }}>
                                  Elementos listados por el estudiante ({item.cantidad || 3}):
                                </div>
                                {Array.from({ length: item.cantidad || 3 }).map((_, slotIdx) => {
                                  const ans = inspectingSubmission.respuestas?.[`${pregunta.id}_${item.id}_${slotIdx}`];
                                  const modelAns = item.respuestas_esperadas?.[slotIdx];
                                  return (
                                    <div
                                      key={slotIdx}
                                      style={{
                                        display: "flex",
                                        flexDirection: "column",
                                        gap: "0.2rem",
                                        background: "#f8fafc",
                                        padding: "0.45rem 0.65rem",
                                        borderRadius: "0.45rem",
                                        border: "1px solid #e2e8f0"
                                      }}
                                    >
                                      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                                        <span style={{ fontSize: "0.78rem", fontWeight: 800, color: "#0284c7", width: "20px" }}>
                                          {slotIdx + 1}.
                                        </span>
                                        <span style={{ fontSize: "0.85rem", color: ans ? "#0f172a" : "#94a3b8", fontWeight: 600 }}>
                                          {ans || "— (Vacío) —"}
                                        </span>
                                      </div>
                                      {modelAns && (
                                        <div style={{ fontSize: "0.72rem", color: "#059669", paddingLeft: "26px" }}>
                                          <em>Esperado:</em> {modelAns}
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))
              ) : (
                /* Fallback si no hay preguntas estructuradas cargadas */
                <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                  <div style={{ fontSize: "0.85rem", color: "#64748b" }}>
                    Respuestas registradas por el alumno:
                  </div>
                  {Object.entries(inspectingSubmission.respuestas || {}).map(([k, v]) => (
                    <div
                      key={k}
                      style={{
                        padding: "0.6rem 0.85rem",
                        borderRadius: "0.5rem",
                        background: "#f8fafc",
                        border: "1px solid #e2e8f0",
                        fontSize: "0.85rem"
                      }}
                    >
                      <strong style={{ color: "#475569" }}>{k}:</strong> {String(v)}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Modal Footer: Calificar & Feedback */}
            <div
              style={{
                padding: "1.25rem 1.5rem",
                borderTop: "1px solid #e2e8f0",
                background: "#f8fafc",
                display: "flex",
                flexDirection: "column",
                gap: "1rem"
              }}
            >
              <div style={{ display: "grid", gridTemplateColumns: "180px 1fr", gap: "1rem", alignItems: "start" }}>
                {/* Input Calificación */}
                <div>
                  <label style={{ display: "block", fontSize: "0.78rem", fontWeight: 800, color: "#1e293b", marginBottom: "0.35rem" }}>
                    Nota (0.000 a 5.000 pts):
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    max="5"
                    value={evalScore}
                    onChange={(e) => setEvalScore(e.target.value)}
                    disabled={!canEdit || savingEvaluation}
                    placeholder="0.000"
                    style={{
                      width: "100%",
                      padding: "0.55rem 0.75rem",
                      borderRadius: "0.5rem",
                      border: "2px solid #10b981",
                      fontSize: "1rem",
                      fontWeight: 800,
                      color: "#065f46",
                      textAlign: "center",
                      background: "#ffffff",
                      outline: "none"
                    }}
                  />
                  {/* Botones rápidos */}
                  <div style={{ display: "flex", gap: "0.25rem", marginTop: "0.4rem", flexWrap: "wrap" }}>
                    {[0, 2.5, 3.5, 4.0, 5.0].map((quick) => (
                      <button
                        key={quick}
                        type="button"
                        onClick={() => setEvalScore(String(quick))}
                        disabled={!canEdit || savingEvaluation}
                        style={{
                          fontSize: "0.68rem",
                          fontWeight: 800,
                          padding: "0.15rem 0.35rem",
                          borderRadius: "0.3rem",
                          border: "1px solid #cbd5e1",
                          background: "#ffffff",
                          cursor: "pointer",
                          color: "#475569"
                        }}
                      >
                        {quick}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Comentarios de Retroalimentación */}
                <div>
                  <label style={{ display: "block", fontSize: "0.78rem", fontWeight: 800, color: "#1e293b", marginBottom: "0.35rem" }}>
                    Comentarios / Retroalimentación para el alumno:
                  </label>
                  <textarea
                    rows={2}
                    value={evalComments}
                    onChange={(e) => setEvalComments(e.target.value)}
                    disabled={!canEdit || savingEvaluation}
                    placeholder="Escribe observaciones que el alumno podrá leer en su portal (opcional)..."
                    style={{
                      width: "100%",
                      padding: "0.5rem 0.75rem",
                      borderRadius: "0.5rem",
                      border: "1px solid #cbd5e1",
                      fontSize: "0.82rem",
                      outline: "none",
                      resize: "none"
                    }}
                  />
                </div>
              </div>

              <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: "0.75rem" }}>
                <button
                  type="button"
                  onClick={handleCloseInspect}
                  disabled={savingEvaluation}
                  style={{
                    padding: "0.55rem 1.1rem",
                    borderRadius: "0.5rem",
                    border: "1px solid #cbd5e1",
                    background: "#ffffff",
                    color: "#475569",
                    fontSize: "0.84rem",
                    fontWeight: 700,
                    cursor: "pointer"
                  }}
                >
                  Cerrar
                </button>

                <button
                  type="button"
                  onClick={handleSaveEvaluation}
                  disabled={!canEdit || savingEvaluation}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "0.45rem",
                    padding: "0.55rem 1.25rem",
                    borderRadius: "0.5rem",
                    background: !canEdit ? "#94a3b8" : "linear-gradient(135deg, #10b981 0%, #059669 100%)",
                    color: "#ffffff",
                    border: "none",
                    fontSize: "0.85rem",
                    fontWeight: 800,
                    cursor: !canEdit || savingEvaluation ? "not-allowed" : "pointer",
                    boxShadow: "0 4px 12px rgba(16, 185, 129, 0.25)"
                  }}
                >
                  {savingEvaluation ? (
                    <>
                      <RefreshCw size={14} className="animate-spin" />
                      <span>Guardando...</span>
                    </>
                  ) : (
                    <>
                      <Check size={15} />
                      <span>Guardar y Asignar Calificación</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
