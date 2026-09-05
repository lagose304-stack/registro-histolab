import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import {
  Database,
  ArrowLeft,
  Save,
  RefreshCw,
  Search,
  BookOpen,
  FileEdit,
  GraduationCap,
  Clock,
  CheckCircle2,
  AlertCircle,
  Users,
  CheckCheck,
  ShieldOff,
  Sparkles,
  Zap,
  Info,
  Calendar,
  HelpCircle
} from "lucide-react";
import { api } from "../services/api";
import {
  calculateStudentAcademicSummary,
  getCanonicalManualGrade,
  getCanonicalQuizGrade,
  getCanonicalExamGrade
} from "../utils/academicEngine";

export default function SectionDataMigrationView({
  seccion,
  currentInstructor,
  hideBackButton = false,
  onClose = () => {},
  notify = () => {}
}) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  const notifyRef = useRef(notify);
  notifyRef.current = notify;

  // Sub-pestaña de migración: 'manuales' | 'pruebas' | 'examenes' | 'asistencia'
  const [activeTab, setActiveTab] = useState("manuales");

  // Datos
  const [estudiantes, setEstudiantes] = useState([]);
  const [semanasConfig, setSemanasConfig] = useState([]);
  const [temario, setTemario] = useState([]);
  const [configPuntajes, setConfigPuntajes] = useState(null);

  // Buffer de entrada para notas de pruebas ingresadas en base 1
  const [quizInputBuffer, setQuizInputBuffer] = useState({});

  // Selección de semana para manuales, pruebas y asistencia
  const [selectedSemana, setSelectedSemana] = useState(1);
  const [selectedExamParcial, setSelectedExamParcial] = useState("examen_I"); // 'examen_I' | 'examen_II' | 'examen_III'
  const [searchTerm, setSearchTerm] = useState("");

  const carrera = seccion?.carrera || "Medicina";

  // Limpiar buffer de entrada al cambiar de semana o de pestaña
  useEffect(() => {
    setQuizInputBuffer({});
  }, [selectedSemana, activeTab]);

  // Cargar datos completos de la sección
  const loadData = useCallback(async (isInitial = false) => {
    if (!seccion?.id) return;
    if (isInitial) setLoading(true);

    try {
      const [resEst, resSemanas, resTemario, resPuntajes] = await Promise.all([
        api.estudiantes.getBySeccion(seccion.id, carrera),
        api.semanas.getConfig(carrera).catch(() => ({ data: [] })),
        api.temario.getAll({ carrera }).catch(() => ({ data: [] })),
        api.temario.getPuntajes(carrera).catch(() => ({ data: null }))
      ]);

      if (resEst?.data) {
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

      if (resPuntajes?.data) {
        setConfigPuntajes(resPuntajes.data);
      }
    } catch (err) {
      console.error("Error al cargar datos de migración:", err);
      notifyRef.current("Error al cargar datos de la sección", "error");
    } finally {
      setLoading(false);
    }
  }, [seccion?.id, carrera]);

  useEffect(() => {
    loadData(true);
  }, [loadData]);

  // Helper para obtener el nombre visible de la semana
  const getWeekDisplayName = (w) => {
    if (!w) return "";
    const rawName = (w.nombre_semana || w.descripcion || "").trim();
    if (!rawName) return `Semana ${w.numero_semana}`;
    if (rawName.toLowerCase().startsWith("semana")) return rawName;
    return `Semana ${w.numero_semana}: ${rawName}`;
  };

  // Semanas disponibles
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
        parcial: s.parcial || (num <= 4 ? "I Parcial" : num <= 8 ? "II Parcial" : "III Parcial"),
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
          esExamen: false,
          descripcion: `Semana ${num}`
        });
      }
    });

    if (weekMap.size === 0) {
      for (let i = 1; i <= 12; i++) {
        weekMap.set(i, {
          numero_semana: i,
          nombre_semana: `Semana ${i}`,
          parcial: i <= 4 ? "I Parcial" : i <= 8 ? "II Parcial" : "III Parcial",
          esExamen: i === 4 || i === 8 || i === 12,
          descripcion: `Semana ${i}`
        });
      }
    }

    return Array.from(weekMap.values()).sort((a, b) => a.numero_semana - b.numero_semana);
  }, [semanasConfig, temario]);

  // Semanas mostradas según la pestaña: en manuales y pruebas NO hay semanas de examen
  const displayedWeeksForTab = useMemo(() => {
    if (activeTab === "manuales" || activeTab === "pruebas") {
      return availableWeeks.filter((w) => !w.esExamen);
    }
    return availableWeeks;
  }, [availableWeeks, activeTab]);

  // Ajustar la semana seleccionada si se cambia a una pestaña donde no aplica (ej. examen en manuales/pruebas)
  useEffect(() => {
    if (
      (activeTab === "manuales" || activeTab === "pruebas") &&
      displayedWeeksForTab.length > 0 &&
      !displayedWeeksForTab.some((w) => w.numero_semana === selectedSemana)
    ) {
      setSelectedSemana(displayedWeeksForTab[0].numero_semana);
    }
  }, [activeTab, displayedWeeksForTab, selectedSemana]);

  // Temas de la semana seleccionada (para manuales)
  const weekTopics = useMemo(() => {
    return temario
      .filter((t) => Number(t.semana) === Number(selectedSemana) && t.tiene_manual !== false)
      .sort((a, b) => (Number(a.numero_tema) || 0) - (Number(b.numero_tema) || 0));
  }, [temario, selectedSemana]);

  // Recalcular total acumulado general con 3 decimales usando el motor académico unificado
  const recalculateTotal = (est, updatedNotas, updatedExamCols = {}) => {
    const studentWithExams = {
      ...est,
      ...updatedExamCols,
      notas: updatedNotas
    };
    const summary = calculateStudentAcademicSummary(
      studentWithExams,
      configPuntajes,
      temario,
      semanasConfig,
      updatedNotas
    );
    return summary.total;
  };

  // =========================================================================
  // 1. GESTIÓN DE MANUALES (SIN RESTRICCIÓN - ASOCIACIÓN INMUTABLE POR UUID)
  // =========================================================================
  const getStudentManualGrade = (est, tema) => {
    if (!est) return "";
    const val = getCanonicalManualGrade(est.notas || {}, tema, est);
    if (val === undefined || val === null || val === "") return "";
    return val;
  };

  const handleManualGradeChange = (numero_cuenta, tema, rawValue) => {
    const cleanVal = String(rawValue).replace(",", ".");

    if (cleanVal === "") {
      setEstudiantes((prev) =>
        prev.map((est) => {
          if (est.numero_cuenta !== numero_cuenta) return est;
          const currentNotas = { ...(est.notas || {}) };
          delete currentNotas[`manual_${tema.id}`];
          delete currentNotas[`manual_tema_${tema.numero_tema}`];
          const nextTotal = recalculateTotal(est, currentNotas);
          return { ...est, notas: currentNotas, total: nextTotal };
        })
      );
      setHasUnsavedChanges(true);
      return;
    }

    if (!/^\d*(\.\d{0,3})?$/.test(cleanVal)) return;

    const numVal = Number(cleanVal);
    if (numVal > 1 || numVal < 0) {
      notifyRef.current(
        `¡Nota fuera de rango! El manual se califica sobre 1 punto máximo (de 0.000 a 1.000). Se rechazó el valor ${cleanVal}.`,
        "error"
      );
      return;
    }

    const storedVal = cleanVal.endsWith(".") ? cleanVal : Number(cleanVal);

    setEstudiantes((prev) =>
      prev.map((est) => {
        if (est.numero_cuenta !== numero_cuenta) return est;
        const currentNotas = est.notas || {};
        const updatedNotas = {
          ...currentNotas,
          [`manual_${tema.id}`]: storedVal
        };
        const nextTotal = recalculateTotal(est, updatedNotas);
        return { ...est, notas: updatedNotas, total: nextTotal };
      })
    );
    setHasUnsavedChanges(true);
  };

  // Limpieza al desenfocar casilla de manual (eliminar punto huérfano)
  const handleManualGradeBlur = (numero_cuenta, tema) => {
    const key = `manual_${tema.id}`;
    setEstudiantes((prev) =>
      prev.map((est) => {
        if (est.numero_cuenta !== numero_cuenta) return est;
        const currentNotas = est.notas || {};
        const val = currentNotas[key];
        if (typeof val === "string" && val.endsWith(".")) {
          const fixed = Number(val.slice(0, -1));
          const updatedNotas = { ...currentNotas, [key]: fixed };
          const nextTotal = recalculateTotal(est, updatedNotas);
          return { ...est, notas: updatedNotas, total: nextTotal };
        }
        return est;
      })
    );
  };

  // =========================================================================
  // 2. GESTIÓN DE PRUEBAS SEMANALES (MIGRACIÓN EN BASE 1 -> CONVERSIÓN REGLA DE TRES A BASE 5)
  // =========================================================================
  const quizKey = `prueba_${selectedSemana}`;

  // Helper para leer la nota ingresada o calculada en base a 1 punto (para el input de migración)
  const getDisplayQuizGrade1Pt = (est) => {
    if (quizInputBuffer[est.numero_cuenta] !== undefined) {
      return quizInputBuffer[est.numero_cuenta];
    }
    const val5 = getCanonicalQuizGrade(est.notas || {}, selectedSemana, est);
    if (val5 === undefined || val5 === null || val5 === "") return "";
    const num5 = Number(val5);
    if (isNaN(num5)) return "";
    // Convertir de base 5 a base 1: num5 / 5
    const num1 = Math.round((num5 / 5) * 1000) / 1000;
    return String(num1);
  };

  // Helper para obtener el valor convertido en base a 5 puntos (para mostrar en el badge explicativo)
  const getConvertedQuizGrade5Pts = (est) => {
    const bufVal = quizInputBuffer[est.numero_cuenta];
    if (bufVal !== undefined) {
      if (bufVal === "" || isNaN(Number(bufVal))) return "";
      return Math.round((Number(bufVal) * 5) * 1000) / 1000;
    }
    const val5 = getCanonicalQuizGrade(est.notas || {}, selectedSemana, est);
    if (val5 === undefined || val5 === null || val5 === "") return "";
    return Math.round(Number(val5) * 1000) / 1000;
  };

  // Limpieza al desenfocar la casilla de prueba (eliminar punto decimal huérfano)
  const handleQuizGradeBlur = (numero_cuenta) => {
    setQuizInputBuffer((prev) => {
      const current = prev[numero_cuenta];
      if (current && current.endsWith(".")) {
        const fixed = current.slice(0, -1);
        return { ...prev, [numero_cuenta]: fixed };
      }
      return prev;
    });
  };

  // Manejar cambio en la nota de la prueba (ingresada en base 1 -> convertida con regla de tres a base 5)
  // Regla de tres: 1.0 pt base = 5.0 pts sistema => Nota_base_5 = Nota_base_1 * 5
  const handleQuizGradeChange = (numero_cuenta, rawValue) => {
    const cleanVal = String(rawValue).replace(",", ".");

    // Si está vacío, borrar la nota y limpiar el buffer
    if (cleanVal === "") {
      setQuizInputBuffer((prev) => {
        const next = { ...prev };
        delete next[numero_cuenta];
        return next;
      });
      setEstudiantes((prev) =>
        prev.map((est) => {
          if (est.numero_cuenta !== numero_cuenta) return est;
          const currentNotas = { ...(est.notas || {}) };
          delete currentNotas[quizKey];
          delete currentNotas[`examencito_${selectedSemana}`];
          delete currentNotas[`Prueba de la semana ${selectedSemana}`];
          delete currentNotas[`Examencito de la semana ${selectedSemana}`];
          const nextTotal = recalculateTotal(est, currentNotas);
          return { ...est, notas: currentNotas, total: nextTotal };
        })
      );
      setHasUnsavedChanges(true);
      return;
    }

    if (!/^\d*(\.\d{0,3})?$/.test(cleanVal)) return;

    const num1 = Number(cleanVal);
    // BARRERA ESTRICTA INMEDIATA: Rechazar cualquier valor > 1.000 sin tocar el buffer
    if (num1 > 1) {
      notifyRef.current(
        `¡Nota fuera de rango! En migración, la prueba se evalúa en base a 1 punto máximo (de 0.000 a 1.000). Se rechazó el valor ${cleanVal}.`,
        "error"
      );
      return;
    }

    // Solo si es un valor reglamentario (0 <= valor <= 1) actualizamos el buffer de escritura
    setQuizInputBuffer((prev) => ({ ...prev, [numero_cuenta]: cleanVal }));

    // Regla de tres directa: Nota en base 5 = Nota en base 1 * 5
    const storedVal5 = Math.round((num1 * 5) * 1000) / 1000;

    setEstudiantes((prev) =>
      prev.map((est) => {
        if (est.numero_cuenta !== numero_cuenta) return est;
        const currentNotas = est.notas || {};
        const updatedNotas = {
          ...currentNotas,
          [quizKey]: storedVal5
        };
        // Eliminar clave redundante si existía
        delete updatedNotas[`examencito_${selectedSemana}`];

        const nextTotal = recalculateTotal(est, updatedNotas);
        return { ...est, notas: updatedNotas, total: nextTotal };
      })
    );
    setHasUnsavedChanges(true);
  };

  // =========================================================================
  // 3. GESTIÓN DE EXÁMENES PARCIALES (SIN RESTRICCIÓN)
  // =========================================================================
  const examColMap = {
    examen_I: { col: "primer_examen", label: "I Examen Parcial" },
    examen_II: { col: "segundo_examen", label: "II Examen Parcial" },
    examen_III: { col: "tercer_examen", label: "III Examen Parcial" }
  };

  const currentExamInfo = examColMap[selectedExamParcial] || examColMap.examen_I;

  // Puntaje máximo reglamentario para el examen actualmente seleccionado según la carrera
  const currentExamMaxPoints = useMemo(() => {
    const examIndex = selectedExamParcial === "examen_I" ? 0 : selectedExamParcial === "examen_II" ? 1 : 2;

    const examWeeksList = availableWeeks.filter((w) => w.esExamen);
    const matchingWeek = examWeeksList[examIndex];
    if (matchingWeek && configPuntajes?.examenes?.[String(matchingWeek.numero_semana)]) {
      const val = Number(configPuntajes.examenes[String(matchingWeek.numero_semana)]);
      if (!isNaN(val) && val > 0) return val;
    }

    if (configPuntajes?.examenes && typeof configPuntajes.examenes === "object") {
      const examVals = Object.values(configPuntajes.examenes).map(Number).filter((n) => !isNaN(n) && n > 0);
      if (examVals[examIndex] !== undefined) {
        return examVals[examIndex];
      }
    }

    // Fallbacks reglamentarios: Odontología 15 pts, resto 10 pts
    if (String(carrera || "").toLowerCase().includes("odonto")) {
      return 15;
    }
    return 10;
  }, [availableWeeks, selectedExamParcial, configPuntajes, carrera]);

  const getStudentExamGrade = (est) => {
    const colKey = currentExamInfo.col;
    const val = est[colKey] ?? est?.notas?.[colKey] ?? est?.notas?.[selectedExamParcial];
    if (val === undefined || val === null || val === "") return "";
    return val;
  };

  // Limpieza al desenfocar casilla de examen (eliminar punto huérfano)
  const handleExamGradeBlur = (numero_cuenta) => {
    const colKey = currentExamInfo.col;
    setEstudiantes((prev) =>
      prev.map((est) => {
        if (est.numero_cuenta !== numero_cuenta) return est;
        const val = est[colKey];
        if (typeof val === "string" && val.endsWith(".")) {
          const fixed = Number(val.slice(0, -1));
          const currentNotas = { ...(est.notas || {}), [colKey]: fixed, [selectedExamParcial]: fixed };
          const updatedExamCols = { [colKey]: fixed };
          const nextTotal = recalculateTotal(est, currentNotas, updatedExamCols);
          return { ...est, [colKey]: fixed, notas: currentNotas, total: nextTotal };
        }
        return est;
      })
    );
  };

  const handleExamGradeChange = (numero_cuenta, rawValue) => {
    const cleanVal = String(rawValue).replace(",", ".");
    const colKey = currentExamInfo.col;

    if (cleanVal === "") {
      setEstudiantes((prev) =>
        prev.map((est) => {
          if (est.numero_cuenta !== numero_cuenta) return est;
          const currentNotas = { ...(est.notas || {}) };
          delete currentNotas[colKey];
          delete currentNotas[selectedExamParcial];
          const updatedExamCols = { [colKey]: 0 };
          const nextTotal = recalculateTotal(est, currentNotas, updatedExamCols);
          return {
            ...est,
            [colKey]: "",
            notas: currentNotas,
            total: nextTotal
          };
        })
      );
      setHasUnsavedChanges(true);
      return;
    }

    if (!/^\d*(\.\d{0,3})?$/.test(cleanVal)) return;

    const numVal = Number(cleanVal);
    // BARRERA ESTRICTA INMEDIATA: No superar el puntaje máximo asignado a este examen
    if (numVal > currentExamMaxPoints || numVal < 0) {
      notifyRef.current(
        `¡Nota fuera de rango! El ${currentExamInfo.label} tiene un valor reglamentario máximo de ${currentExamMaxPoints} puntos (máx. ${currentExamMaxPoints}.000). Se rechazó el valor ${cleanVal}.`,
        "error"
      );
      return;
    }

    const storedVal = cleanVal.endsWith(".") ? cleanVal : Number(cleanVal);

    setEstudiantes((prev) =>
      prev.map((est) => {
        if (est.numero_cuenta !== numero_cuenta) return est;
        const currentNotas = est.notas || {};
        const updatedNotas = {
          ...currentNotas,
          [colKey]: storedVal,
          [selectedExamParcial]: storedVal
        };
        const updatedExamCols = { [colKey]: storedVal };
        const nextTotal = recalculateTotal(est, updatedNotas, updatedExamCols);
        return {
          ...est,
          [colKey]: storedVal,
          notas: updatedNotas,
          total: nextTotal
        };
      })
    );
    setHasUnsavedChanges(true);
  };

  // =========================================================================
  // 4. GESTIÓN DE ASISTENCIA (SIN RESTRICCIÓN)
  // =========================================================================
  const attendanceKey = `asistencia_${selectedSemana}`;

  const getStudentAttendance = (est) => {
    return est?.asistencias?.[attendanceKey] || "";
  };

  const handleAttendanceChange = (numero_cuenta, status) => {
    setEstudiantes((prev) =>
      prev.map((est) => {
        if (est.numero_cuenta !== numero_cuenta) return est;
        const currentAsist = est.asistencias || {};
        const currentVal = currentAsist[attendanceKey];
        const nextVal = currentVal === status ? "" : status;

        const updatedAsist = {
          ...currentAsist,
          [attendanceKey]: nextVal
        };

        return {
          ...est,
          asistencias: updatedAsist
        };
      })
    );
    setHasUnsavedChanges(true);
  };

  // =========================================================================
  // GUARDAR TODO EN BATCH CON BARRERA DE INTEGRIDAD PREVIA
  // =========================================================================
  const handleSaveAll = async () => {
    if (!seccion?.id) return;

    // 1. Barrera de validación en buffers activos de pruebas semanales
    for (const [cuenta, bufVal] of Object.entries(quizInputBuffer)) {
      if (bufVal !== "" && bufVal !== undefined && bufVal !== null) {
        const numVal = Number(bufVal);
        if (isNaN(numVal) || numVal > 1 || numVal < 0) {
          notifyRef.current(
            `Error al guardar: La nota de prueba para la cuenta ${cuenta} (${bufVal}) no es válida o supera el máximo de 1.000 punto. Por favor corrígela antes de guardar.`,
            "error"
          );
          return;
        }
      }
    }

    // Deducir topes máximos por examen para validar el lote completo
    const examVals = configPuntajes?.examenes && typeof configPuntajes.examenes === "object"
      ? Object.values(configPuntajes.examenes).map(Number).filter((n) => !isNaN(n) && n > 0)
      : [];
    const defaultExamMax = String(carrera || "").toLowerCase().includes("odonto") ? 15 : 10;
    const maxEx1 = examVals[0] || defaultExamMax;
    const maxEx2 = examVals[1] || defaultExamMax;
    const maxEx3 = examVals[2] || (String(carrera || "").toLowerCase().includes("odonto") ? 15 : 15);

    // 2. Barrera de validación de calificaciones en el listado de estudiantes
    for (const est of estudiantes) {
      if (est.notas && typeof est.notas === "object") {
        for (const [k, v] of Object.entries(est.notas)) {
          if (v === "" || v === undefined || v === null) continue;
          const numV = Number(v);
          if (isNaN(numV)) continue;

          if (k.startsWith("manual_") && (numV > 1 || numV < 0)) {
            notifyRef.current(
              `Error al guardar: La nota de manual en ${est.nombre_completo || est.numero_cuenta} (${numV}) está fuera del rango reglamentario (máx. 1.000 pt).`,
              "error"
            );
            return;
          }

          if ((k.startsWith("prueba_") || k.startsWith("examencito_")) && (numV > 5 || numV < 0)) {
            notifyRef.current(
              `Error al guardar: La nota de prueba en ${est.nombre_completo || est.numero_cuenta} (${numV}) supera el máximo de 5.000 puntos.`,
              "error"
            );
            return;
          }
        }
      }

      const ex1 = Number(est.primer_examen || 0);
      const ex2 = Number(est.segundo_examen || 0);
      const ex3 = Number(est.tercer_examen || 0);

      if (ex1 > maxEx1 || ex1 < 0) {
        notifyRef.current(
          `Error al guardar: El I Examen Parcial para ${est.nombre_completo || est.numero_cuenta} (${ex1}) supera el máximo permitido de ${maxEx1} puntos.`,
          "error"
        );
        return;
      }
      if (ex2 > maxEx2 || ex2 < 0) {
        notifyRef.current(
          `Error al guardar: El II Examen Parcial para ${est.nombre_completo || est.numero_cuenta} (${ex2}) supera el máximo permitido de ${maxEx2} puntos.`,
          "error"
        );
        return;
      }
      if (ex3 > maxEx3 || ex3 < 0) {
        notifyRef.current(
          `Error al guardar: El III Examen Parcial para ${est.nombre_completo || est.numero_cuenta} (${ex3}) supera el máximo permitido de ${maxEx3} puntos.`,
          "error"
        );
        return;
      }
    }

    setSaving(true);

    try {
      const updates = estudiantes.map((est) => ({
        numero_cuenta: est.numero_cuenta,
        notas: est.notas || {},
        asistencias: est.asistencias || {},
        primer_examen: est.primer_examen !== "" && est.primer_examen !== undefined ? Number(est.primer_examen) : 0,
        segundo_examen: est.segundo_examen !== "" && est.segundo_examen !== undefined ? Number(est.segundo_examen) : 0,
        tercer_examen: est.tercer_examen !== "" && est.tercer_examen !== undefined ? Number(est.tercer_examen) : 0,
        total: est.total ?? 0
      }));

      await api.estudiantes.saveBatch(seccion.id, updates, carrera);
      setHasUnsavedChanges(false);
      notifyRef.current("¡Datos migrados y guardados con éxito!", "success");
    } catch (err) {
      console.error("Error al guardar migración:", err);
      notifyRef.current("Error al guardar datos de migración en el servidor", "error");
    } finally {
      setSaving(false);
    }
  };

  // Filtrado de alumnos
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
        <RefreshCw size={28} className="animate-spin" color="#d97706" />
        <span style={{ fontSize: "0.95rem", fontWeight: 700 }}>
          Cargando entorno de migración de datos...
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
      {/* 1. CABECERA PRINCIPAL DEL MÓDULO DE MIGRACIÓN                       */}
      {/* =================================================================== */}
      <div
        style={{
          padding: "1.5rem 1.75rem",
          background: "#ffffff",
          borderRadius: "1.1rem",
          border: "1.5px solid #fde68a",
          boxShadow: "0 6px 20px -4px rgba(245, 158, 11, 0.1)",
          display: "flex",
          flexDirection: "column",
          gap: "1.1rem"
        }}
      >
        {/* Fila 1: Título, Sección, Botón Volver y Guardar */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: "1rem" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "0.65rem", flexWrap: "wrap", marginBottom: "0.35rem" }}>
              {!hideBackButton && (
                <button
                  onClick={onClose}
                  style={{
                    background: "#f8fafc",
                    border: "1px solid #cbd5e1",
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
                  width: "36px",
                  height: "36px",
                  borderRadius: "0.65rem",
                  background: "linear-gradient(135deg, #d97706 0%, #b45309 100%)",
                  color: "#ffffff",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  boxShadow: "0 4px 10px rgba(217, 119, 6, 0.3)"
                }}
              >
                <Database size={20} />
              </div>

              <h2 style={{ fontSize: "1.35rem", fontWeight: 900, color: "#0f172a", margin: 0, letterSpacing: "-0.01em" }}>
                Migrar Datos — Acceso Sin Restricciones
              </h2>

              <span
                style={{
                  background: "linear-gradient(135deg, #0284c7 0%, #0369a1 100%)",
                  color: "#ffffff",
                  padding: "0.2rem 0.65rem",
                  borderRadius: "0.45rem",
                  fontSize: "0.75rem",
                  fontWeight: 900
                }}
              >
                {seccion?.codigo}
              </span>

              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "0.3rem",
                  background: "#fef3c7",
                  color: "#92400e",
                  border: "1px solid #fde68a",
                  padding: "0.2rem 0.65rem",
                  borderRadius: "9999px",
                  fontSize: "0.74rem",
                  fontWeight: 800
                }}
              >
                <ShieldOff size={13} color="#d97706" />
                <span>Modo Migración Libre</span>
              </span>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap", fontSize: "0.82rem", color: "#64748b" }}>
              <span>{carrera}</span>
              <span>•</span>
              <span>{seccion?.dia} {seccion?.hora_inicio} - {seccion?.hora_fin}</span>
              <span>•</span>
              <span>{estudiantes.length} Alumnos en sección</span>
            </div>
          </div>

          {/* Botón Guardar */}
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
              disabled={saving}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "0.5rem",
                background: hasUnsavedChanges
                  ? "linear-gradient(135deg, #10b981 0%, #059669 100%)"
                  : "linear-gradient(135deg, #d97706 0%, #b45309 100%)",
                color: "#ffffff",
                border: "none",
                padding: "0.6rem 1.35rem",
                borderRadius: "0.65rem",
                fontSize: "0.88rem",
                fontWeight: 800,
                cursor: saving ? "not-allowed" : "pointer",
                boxShadow: hasUnsavedChanges ? "0 4px 14px rgba(16, 185, 129, 0.3)" : "0 4px 14px rgba(217, 119, 6, 0.3)",
                opacity: saving ? 0.7 : 1,
                transition: "all 0.2s ease"
              }}
            >
              {saving ? (
                <>
                  <RefreshCw size={15} className="animate-spin" />
                  <span>Guardando...</span>
                </>
              ) : (
                <>
                  <Save size={15} />
                  <span>Guardar Datos Migrados</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Banner Informativo de Migración */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.6rem",
            background: "#fffbeb",
            border: "1.5px solid #fde68a",
            borderRadius: "0.75rem",
            padding: "0.7rem 1.1rem",
            color: "#92400e",
            fontSize: "0.83rem",
            lineHeight: 1.4
          }}
        >
          <Zap size={18} color="#d97706" style={{ flexShrink: 0 }} />
          <span>
            <strong>Herramienta Exclusiva de Migración:</strong> Aquí puedes subir y modificar libremente las <strong>Notas de Manuales</strong>, <strong>Pruebas Semanales</strong>, <strong>Exámenes Parciales</strong> y <strong>Lista de Asistencia</strong> de cualquier semana, sin restricciones de asignaciones ni bloqueos de rol.
          </span>
        </div>

        {/* =================================================================== */}
        {/* PESTAÑAS DE LOS 4 MÓDULOS DE MIGRACIÓN                             */}
        {/* =================================================================== */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
            gap: "0.65rem"
          }}
        >
          {/* TAB 1: MANUALES */}
          <button
            onClick={() => setActiveTab("manuales")}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.6rem",
              padding: "0.75rem 1rem",
              borderRadius: "0.75rem",
              border: activeTab === "manuales" ? "2px solid #2563eb" : "1.5px solid #e2e8f0",
              background: activeTab === "manuales" ? "#eff6ff" : "#ffffff",
              color: activeTab === "manuales" ? "#1e40af" : "#475569",
              fontWeight: 800,
              fontSize: "0.85rem",
              cursor: "pointer",
              transition: "all 0.15s ease",
              boxShadow: activeTab === "manuales" ? "0 4px 12px rgba(37, 99, 235, 0.15)" : "none"
            }}
          >
            <BookOpen size={18} color={activeTab === "manuales" ? "#2563eb" : "#64748b"} />
            <span>Notas de Manuales</span>
          </button>

          {/* TAB 2: PRUEBAS */}
          <button
            onClick={() => setActiveTab("pruebas")}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.6rem",
              padding: "0.75rem 1rem",
              borderRadius: "0.75rem",
              border: activeTab === "pruebas" ? "2px solid #10b981" : "1.5px solid #e2e8f0",
              background: activeTab === "pruebas" ? "#f0fdf4" : "#ffffff",
              color: activeTab === "pruebas" ? "#065f46" : "#475569",
              fontWeight: 800,
              fontSize: "0.85rem",
              cursor: "pointer",
              transition: "all 0.15s ease",
              boxShadow: activeTab === "pruebas" ? "0 4px 12px rgba(16, 185, 129, 0.15)" : "none"
            }}
          >
            <FileEdit size={18} color={activeTab === "pruebas" ? "#10b981" : "#64748b"} />
            <span>Notas de Pruebas</span>
          </button>

          {/* TAB 3: EXÁMENES */}
          <button
            onClick={() => setActiveTab("examenes")}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.6rem",
              padding: "0.75rem 1rem",
              borderRadius: "0.75rem",
              border: activeTab === "examenes" ? "2px solid #7c3aed" : "1.5px solid #e2e8f0",
              background: activeTab === "examenes" ? "#faf5ff" : "#ffffff",
              color: activeTab === "examenes" ? "#581c87" : "#475569",
              fontWeight: 800,
              fontSize: "0.85rem",
              cursor: "pointer",
              transition: "all 0.15s ease",
              boxShadow: activeTab === "examenes" ? "0 4px 12px rgba(124, 58, 237, 0.15)" : "none"
            }}
          >
            <GraduationCap size={18} color={activeTab === "examenes" ? "#7c3aed" : "#64748b"} />
            <span>Notas de Exámenes</span>
          </button>

          {/* TAB 4: ASISTENCIA */}
          <button
            onClick={() => setActiveTab("asistencia")}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.6rem",
              padding: "0.75rem 1rem",
              borderRadius: "0.75rem",
              border: activeTab === "asistencia" ? "2px solid #0891b2" : "1.5px solid #e2e8f0",
              background: activeTab === "asistencia" ? "#ecfeff" : "#ffffff",
              color: activeTab === "asistencia" ? "#155e75" : "#475569",
              fontWeight: 800,
              fontSize: "0.85rem",
              cursor: "pointer",
              transition: "all 0.15s ease",
              boxShadow: activeTab === "asistencia" ? "0 4px 12px rgba(8, 145, 178, 0.15)" : "none"
            }}
          >
            <Clock size={18} color={activeTab === "asistencia" ? "#0891b2" : "#64748b"} />
            <span>Lista de Asistencia</span>
          </button>
        </div>

        {/* =================================================================== */}
        {/* SELECTORES Y CONTROLES SEGÚN SUB-PESTAÑA                           */}
        {/* =================================================================== */}
        <div
          style={{
            background: "#f8fafc",
            border: "1px solid #e2e8f0",
            borderRadius: "0.85rem",
            padding: "0.85rem 1.15rem",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: "1rem"
          }}
        >
          {/* Selector de Semana (para manuales, pruebas, asistencia) */}
          {activeTab !== "examenes" ? (
            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap" }}>
              <span style={{ fontSize: "0.82rem", fontWeight: 800, color: "#334155", textTransform: "uppercase" }}>
                Semana a Migrar:
              </span>
              <select
                value={selectedSemana}
                onChange={(e) => setSelectedSemana(Number(e.target.value))}
                style={{
                  padding: "0.45rem 0.85rem",
                  borderRadius: "0.55rem",
                  border: "1.5px solid #cbd5e1",
                  background: "#ffffff",
                  color: "#0f172a",
                  fontSize: "0.88rem",
                  fontWeight: 800,
                  outline: "none",
                  cursor: "pointer"
                }}
              >
                {displayedWeeksForTab.map((w) => (
                  <option key={w.numero_semana} value={w.numero_semana}>
                    {getWeekDisplayName(w)}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            /* Selector de Examen Parcial */
            <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", flexWrap: "wrap" }}>
              <span style={{ fontSize: "0.82rem", fontWeight: 800, color: "#334155", textTransform: "uppercase" }}>
                Examen Parcial:
              </span>
              {Object.entries(examColMap).map(([id, info]) => {
                const isSel = selectedExamParcial === id;
                return (
                  <button
                    key={id}
                    onClick={() => setSelectedExamParcial(id)}
                    style={{
                      padding: "0.45rem 0.85rem",
                      borderRadius: "0.55rem",
                      border: isSel ? "2px solid #7c3aed" : "1.5px solid #d8b4fe",
                      background: isSel ? "#7c3aed" : "#ffffff",
                      color: isSel ? "#ffffff" : "#581c87",
                      fontSize: "0.82rem",
                      fontWeight: 800,
                      cursor: "pointer"
                    }}
                  >
                    {info.label}
                  </button>
                );
              })}
            </div>
          )}

          {/* Barra de Búsqueda */}
          <div style={{ position: "relative", width: "100%", maxWidth: "280px" }}>
            <Search size={14} color="#94a3b8" style={{ position: "absolute", left: "0.75rem", top: "50%", transform: "translateY(-50%)" }} />
            <input
              type="text"
              placeholder="Buscar alumno..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{
                width: "100%",
                padding: "0.45rem 0.75rem 0.45rem 2rem",
                borderRadius: "0.5rem",
                border: "1px solid #cbd5e1",
                fontSize: "0.82rem",
                outline: "none",
                background: "#ffffff"
              }}
            />
          </div>
        </div>
      </div>

      {/* =================================================================== */}
      {/* 2. TABLA DE MIGRACIÓN SEGÚN PESTAÑA ACTIVA                          */}
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
        {filteredEstudiantes.length === 0 ? (
          <div style={{ padding: "2.5rem", textAlign: "center", color: "#64748b", fontSize: "0.85rem" }}>
            No se encontraron alumnos para mostrar.
          </div>
        ) : (
          <>
            {/* =============================================================== */}
            {/* SUB-VISTA A: MANUALES                                           */}
            {/* =============================================================== */}
            {activeTab === "manuales" && (
              <>
                {weekTopics.length === 0 ? (
                  <div style={{ padding: "2.5rem", textAlign: "center", color: "#64748b" }}>
                    No hay temas con manual evaluable asignados a la Semana {selectedSemana}.
                  </div>
                ) : (
                  <>
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: `50px 1.4fr repeat(${weekTopics.length}, minmax(140px, 1fr))`,
                        gap: "0.75rem",
                        padding: "0.65rem 0.85rem",
                        background: "#f8fafc",
                        borderRadius: "0.65rem",
                        border: "1px solid #e2e8f0",
                        fontSize: "0.75rem",
                        fontWeight: 800,
                        color: "#475569",
                        textTransform: "uppercase",
                        alignItems: "center"
                      }}
                    >
                      <span>#</span>
                      <span>Alumno / N° de Cuenta</span>
                      {weekTopics.map((tema) => (
                        <div key={tema.id} style={{ textAlign: "center" }}>
                          <div style={{ color: "#1d4ed8", fontWeight: 900 }}>
                            Manual Tema {tema.numero_tema} <span style={{ fontSize: "0.72rem", color: "#2563eb", fontWeight: 800 }}>(Máx. 1.000 pt)</span>
                          </div>
                          <div style={{ fontSize: "0.68rem", color: "#64748b", fontWeight: 600, textTransform: "none", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {tema.titulo}
                          </div>
                        </div>
                      ))}
                    </div>

                    <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                      {filteredEstudiantes.map((est, idx) => (
                        <div
                          key={est.numero_cuenta || idx}
                          style={{
                            display: "grid",
                            gridTemplateColumns: `50px 1.4fr repeat(${weekTopics.length}, minmax(140px, 1fr))`,
                            gap: "0.75rem",
                            alignItems: "center",
                            padding: "0.7rem 0.85rem",
                            borderRadius: "0.65rem",
                            border: "1px solid #e2e8f0",
                            background: "#ffffff"
                          }}
                        >
                          <span style={{ fontSize: "0.8rem", fontWeight: 800, color: "#94a3b8" }}>
                            {String(idx + 1).padStart(2, "0")}
                          </span>
                          <div>
                            <strong style={{ fontSize: "0.92rem", color: "#0f172a" }}>{est.nombre_completo}</strong>
                            <div style={{ fontSize: "0.74rem", color: "#64748b", fontFamily: "monospace" }}>
                              Cuenta: {est.numero_cuenta}
                            </div>
                          </div>

                          {weekTopics.map((tema) => {
                            const gradeVal = getStudentManualGrade(est, tema);
                            return (
                              <div key={tema.id} style={{ display: "flex", justifyContent: "center" }}>
                                <input
                                  type="text"
                                  inputMode="decimal"
                                  value={gradeVal}
                                  onChange={(e) => handleManualGradeChange(est.numero_cuenta, tema, e.target.value)}
                                  onBlur={() => handleManualGradeBlur(est.numero_cuenta, tema)}
                                  placeholder="0.000"
                                  title="Calificación del manual sobre 1 punto máximo (de 0.000 a 1.000)"
                                  style={{
                                    width: "100%",
                                    maxWidth: "140px",
                                    textAlign: "center",
                                    padding: "0.45rem 0.6rem",
                                    borderRadius: "0.5rem",
                                    border: gradeVal !== "" ? "2px solid #3b82f6" : "1.5px solid #cbd5e1",
                                    background: gradeVal !== "" ? "#eff6ff" : "#ffffff",
                                    color: "#1e3a8a",
                                    fontSize: "0.9rem",
                                    fontWeight: 800,
                                    outline: "none"
                                  }}
                                />
                              </div>
                            );
                          })}
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </>
            )}

            {/* =============================================================== */}
            {/* SUB-VISTA B: PRUEBAS SEMANALES                                  */}
            {/* =============================================================== */}
            {activeTab === "pruebas" && (
              <>
                {/* CUADRITO EXPLICATIVO: CONVERSIÓN CON REGLA DE TRES (BASE 1 -> BASE 5) */}
                <div
                  style={{
                    background: "linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)",
                    border: "2px solid #86efac",
                    borderRadius: "0.85rem",
                    padding: "1rem 1.25rem",
                    boxShadow: "0 4px 14px rgba(22, 163, 74, 0.08)",
                    display: "flex",
                    flexDirection: "column",
                    gap: "0.75rem",
                    marginBottom: "0.5rem"
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "0.65rem" }}>
                    <div
                      style={{
                        background: "#16a34a",
                        color: "#ffffff",
                        width: "32px",
                        height: "32px",
                        borderRadius: "0.5rem",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0
                      }}
                    >
                      <Sparkles size={18} />
                    </div>
                    <div>
                      <h4 style={{ margin: 0, fontSize: "0.96rem", fontWeight: 900, color: "#14532d" }}>
                        Conversión Automática de Pruebas Semanales (Regla de Tres: Base 1.0 pt ➜ Base 5.0 pts)
                      </h4>
                      <p style={{ margin: "0.15rem 0 0", fontSize: "0.8rem", color: "#166534" }}>
                        Herramienta de migración para compatibilidad con registros calificados sobre 1 punto
                      </p>
                    </div>
                  </div>

                  <div
                    style={{
                      background: "#ffffff",
                      borderRadius: "0.65rem",
                      padding: "0.85rem 1.1rem",
                      border: "1px solid #bbf7d0",
                      fontSize: "0.84rem",
                      color: "#1e293b",
                      lineHeight: 1.55
                    }}
                  >
                    <p style={{ margin: "0 0 0.55rem" }}>
                      📌 <strong>¿Cómo funciona esta herramienta?</strong> En este módulo de migración debes ingresar la nota obtenida por el estudiante valorada en <strong>base a 1 punto máximo</strong> (de 0.000 a 1.000 pts). El sistema aplica automáticamente una <strong>regla de tres</strong> (multiplicando la nota por <strong>5</strong>) para calcular y almacenar el puntaje oficial sobre <strong>5.000 puntos</strong> que exige el reglamento académico:
                    </p>

                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(auto-fit, minmax(135px, 1fr))",
                        gap: "0.5rem",
                        margin: "0.5rem 0"
                      }}
                    >
                      <div style={{ background: "#f8fafc", padding: "0.45rem 0.65rem", borderRadius: "0.45rem", border: "1px solid #e2e8f0", textAlign: "center" }}>
                        <span style={{ fontSize: "0.72rem", color: "#64748b", display: "block" }}>Ingresas (base 1 pt):</span>
                        <strong style={{ color: "#0f172a", fontSize: "0.92rem" }}>1.000 pt</strong>
                        <span style={{ fontSize: "0.76rem", color: "#16a34a", display: "block", fontWeight: 800 }}>➜ 5.000 pts</span>
                      </div>
                      <div style={{ background: "#f8fafc", padding: "0.45rem 0.65rem", borderRadius: "0.45rem", border: "1px solid #e2e8f0", textAlign: "center" }}>
                        <span style={{ fontSize: "0.72rem", color: "#64748b", display: "block" }}>Ingresas (base 1 pt):</span>
                        <strong style={{ color: "#0f172a", fontSize: "0.92rem" }}>0.800 pt</strong>
                        <span style={{ fontSize: "0.76rem", color: "#16a34a", display: "block", fontWeight: 800 }}>➜ 4.000 pts</span>
                      </div>
                      <div style={{ background: "#f8fafc", padding: "0.45rem 0.65rem", borderRadius: "0.45rem", border: "1px solid #e2e8f0", textAlign: "center" }}>
                        <span style={{ fontSize: "0.72rem", color: "#64748b", display: "block" }}>Ingresas (base 1 pt):</span>
                        <strong style={{ color: "#0f172a", fontSize: "0.92rem" }}>0.600 pt</strong>
                        <span style={{ fontSize: "0.76rem", color: "#16a34a", display: "block", fontWeight: 800 }}>➜ 3.000 pts</span>
                      </div>
                      <div style={{ background: "#f8fafc", padding: "0.45rem 0.65rem", borderRadius: "0.45rem", border: "1px solid #e2e8f0", textAlign: "center" }}>
                        <span style={{ fontSize: "0.72rem", color: "#64748b", display: "block" }}>Ingresas (base 1 pt):</span>
                        <strong style={{ color: "#0f172a", fontSize: "0.92rem" }}>0.500 pt</strong>
                        <span style={{ fontSize: "0.76rem", color: "#16a34a", display: "block", fontWeight: 800 }}>➜ 2.500 pts</span>
                      </div>
                    </div>

                    <div style={{ fontSize: "0.76rem", color: "#15803d", fontWeight: 700, marginTop: "0.5rem" }}>
                      ✓ Al hacer clic en <strong>Guardar Datos Migrados</strong>, tanto el Libro de Calificaciones como el Portal de Estudiantes y los reportes Excel reflejarán la nota oficial convertida sobre 5.000 puntos y sus Puntos Oro acumulados.
                    </div>
                  </div>
                </div>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "50px 1.2fr 1.8fr",
                    gap: "0.75rem",
                    padding: "0.65rem 0.85rem",
                    background: "#f8fafc",
                    borderRadius: "0.65rem",
                    border: "1px solid #e2e8f0",
                    fontSize: "0.75rem",
                    fontWeight: 800,
                    color: "#475569",
                    textTransform: "uppercase",
                    alignItems: "center"
                  }}
                >
                  <span>#</span>
                  <span>Alumno / N° de Cuenta</span>
                  <div style={{ textAlign: "center", color: "#16a34a", fontWeight: 900 }}>
                    Semana {selectedSemana}: Ingreso Base 1.0 pt ➜ Equivalente Oficial (Base 5.0 pts)
                  </div>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                  {filteredEstudiantes.map((est, idx) => {
                    const gradeVal1 = getDisplayQuizGrade1Pt(est);
                    const gradeVal5 = getConvertedQuizGrade5Pts(est);
                    return (
                      <div
                        key={est.numero_cuenta || idx}
                        style={{
                          display: "grid",
                          gridTemplateColumns: "50px 1.2fr 1.8fr",
                          gap: "0.75rem",
                          alignItems: "center",
                          padding: "0.7rem 0.85rem",
                          borderRadius: "0.65rem",
                          border: "1px solid #e2e8f0",
                          background: "#ffffff"
                        }}
                      >
                        <span style={{ fontSize: "0.8rem", fontWeight: 800, color: "#94a3b8" }}>
                          {String(idx + 1).padStart(2, "0")}
                        </span>
                        <div>
                          <strong style={{ fontSize: "0.92rem", color: "#0f172a" }}>{est.nombre_completo}</strong>
                          <div style={{ fontSize: "0.74rem", color: "#64748b", fontFamily: "monospace" }}>
                            Cuenta: {est.numero_cuenta}
                          </div>
                        </div>

                        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "0.85rem", flexWrap: "wrap" }}>
                          {/* Input en base a 1 punto */}
                          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "0.2rem" }}>
                            <input
                              type="text"
                              inputMode="decimal"
                              value={gradeVal1}
                              onChange={(e) => handleQuizGradeChange(est.numero_cuenta, e.target.value)}
                              onBlur={() => handleQuizGradeBlur(est.numero_cuenta)}
                              placeholder="0.000"
                              title="Ingresa la nota de prueba valorada en base a 1 punto máximo (máx. 1.000)"
                              style={{
                                width: "115px",
                                textAlign: "center",
                                padding: "0.45rem 0.6rem",
                                borderRadius: "0.5rem",
                                border: gradeVal1 !== "" ? "2px solid #10b981" : "1.5px solid #cbd5e1",
                                background: gradeVal1 !== "" ? "#f0fdf4" : "#ffffff",
                                color: "#065f46",
                                fontSize: "0.92rem",
                                fontWeight: 800,
                                outline: "none"
                              }}
                            />
                            <span style={{ fontSize: "0.68rem", color: "#64748b", fontWeight: 700 }}>
                              Base 1.0 pt (máx 1)
                            </span>
                          </div>

                          {/* Flecha y Badge con nota equivalente en base a 5 puntos */}
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: "0.4rem",
                              background: gradeVal5 !== "" ? "#ecfdf5" : "#f8fafc",
                              border: gradeVal5 !== "" ? "1.5px solid #a7f3d0" : "1.5px solid #e2e8f0",
                              padding: "0.4rem 0.75rem",
                              borderRadius: "0.55rem",
                              minWidth: "155px",
                              justifyContent: "center"
                            }}
                            title="Nota oficial convertida por regla de tres (Base 1 pt x 5 = Base 5 pts)"
                          >
                            <span style={{ fontSize: "0.74rem", color: "#059669", fontWeight: 800 }}>➜</span>
                            <span style={{ fontSize: "0.84rem", fontWeight: 900, color: gradeVal5 !== "" ? "#047857" : "#94a3b8" }}>
                              {gradeVal5 !== "" ? `${Number(gradeVal5).toFixed(3)} / 5.0 pts` : "— / 5.0 pts"}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}

            {/* =============================================================== */}
            {/* SUB-VISTA C: EXÁMENES PARCIALES                                 */}
            {/* =============================================================== */}
            {activeTab === "examenes" && (
              <>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "50px 1.4fr 1.6fr",
                    gap: "0.75rem",
                    padding: "0.65rem 0.85rem",
                    background: "#f8fafc",
                    borderRadius: "0.65rem",
                    border: "1px solid #e2e8f0",
                    fontSize: "0.75rem",
                    fontWeight: 800,
                    color: "#475569",
                    textTransform: "uppercase",
                    alignItems: "center"
                  }}
                >
                  <span>#</span>
                  <span>Alumno / N° de Cuenta</span>
                  <div style={{ textAlign: "center", color: "#7c3aed", fontWeight: 900 }}>
                    {currentExamInfo.label} <span style={{ fontSize: "0.74rem", color: "#6d28d9", fontWeight: 800 }}>(Máximo Oficial: {currentExamMaxPoints}.000 pts)</span>
                  </div>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                  {filteredEstudiantes.map((est, idx) => {
                    const gradeVal = getStudentExamGrade(est);
                    return (
                      <div
                        key={est.numero_cuenta || idx}
                        style={{
                          display: "grid",
                          gridTemplateColumns: "50px 1.4fr 1.6fr",
                          gap: "0.75rem",
                          alignItems: "center",
                          padding: "0.7rem 0.85rem",
                          borderRadius: "0.65rem",
                          border: "1px solid #e2e8f0",
                          background: "#ffffff"
                        }}
                      >
                        <span style={{ fontSize: "0.8rem", fontWeight: 800, color: "#94a3b8" }}>
                          {String(idx + 1).padStart(2, "0")}
                        </span>
                        <div>
                          <strong style={{ fontSize: "0.92rem", color: "#0f172a" }}>{est.nombre_completo}</strong>
                          <div style={{ fontSize: "0.74rem", color: "#64748b", fontFamily: "monospace" }}>
                            Cuenta: {est.numero_cuenta}
                          </div>
                        </div>

                        <div style={{ display: "flex", justifyContent: "center" }}>
                          <input
                            type="text"
                            inputMode="decimal"
                            value={gradeVal}
                            onChange={(e) => handleExamGradeChange(est.numero_cuenta, e.target.value)}
                            onBlur={() => handleExamGradeBlur(est.numero_cuenta)}
                            placeholder="0.000"
                            title={`Calificación del ${currentExamInfo.label}: máximo ${currentExamMaxPoints}.000 puntos`}
                            style={{
                              width: "100%",
                              maxWidth: "180px",
                              textAlign: "center",
                              padding: "0.45rem 0.75rem",
                              borderRadius: "0.5rem",
                              border: gradeVal !== "" ? "2px solid #7c3aed" : "1.5px solid #cbd5e1",
                              background: gradeVal !== "" ? "#faf5ff" : "#ffffff",
                              color: "#581c87",
                              fontSize: "0.92rem",
                              fontWeight: 800,
                              outline: "none"
                            }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}

            {/* =============================================================== */}
            {/* SUB-VISTA D: LISTA DE ASISTENCIA                                */}
            {/* =============================================================== */}
            {activeTab === "asistencia" && (
              <>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "50px 1.4fr 1.6fr",
                    gap: "0.75rem",
                    padding: "0.65rem 0.85rem",
                    background: "#f8fafc",
                    borderRadius: "0.65rem",
                    border: "1px solid #e2e8f0",
                    fontSize: "0.75rem",
                    fontWeight: 800,
                    color: "#475569",
                    textTransform: "uppercase",
                    alignItems: "center"
                  }}
                >
                  <span>#</span>
                  <span>Alumno / N° de Cuenta</span>
                  <div style={{ textAlign: "center", color: "#0891b2", fontWeight: 900 }}>
                    Asistencia Semana {selectedSemana} (3 casillas)
                  </div>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                  {filteredEstudiantes.map((est, idx) => {
                    const currentStatus = getStudentAttendance(est);
                    const isAsistio = currentStatus === "Asistio";
                    const isInjustificada = currentStatus === "Falta injustificada";
                    const isJustificada = currentStatus === "Falta justificada";

                    return (
                      <div
                        key={est.numero_cuenta || idx}
                        style={{
                          display: "grid",
                          gridTemplateColumns: "50px 1.4fr 1.6fr",
                          gap: "0.75rem",
                          alignItems: "center",
                          padding: "0.7rem 0.85rem",
                          borderRadius: "0.65rem",
                          border: "1px solid #e2e8f0",
                          background: "#ffffff"
                        }}
                      >
                        <span style={{ fontSize: "0.8rem", fontWeight: 800, color: "#94a3b8" }}>
                          {String(idx + 1).padStart(2, "0")}
                        </span>
                        <div>
                          <strong style={{ fontSize: "0.92rem", color: "#0f172a" }}>{est.nombre_completo}</strong>
                          <div style={{ fontSize: "0.74rem", color: "#64748b", fontFamily: "monospace" }}>
                            Cuenta: {est.numero_cuenta}
                          </div>
                        </div>

                        {/* Las 3 casillas de asistencia */}
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "0.5rem" }}>
                          {/* 1. Asistencia */}
                          <button
                            onClick={() => handleAttendanceChange(est.numero_cuenta, "Asistio")}
                            style={{
                              flex: 1,
                              maxWidth: "110px",
                              padding: "0.45rem 0.6rem",
                              borderRadius: "0.5rem",
                              border: isAsistio ? "2px solid #16a34a" : "1.5px solid #e2e8f0",
                              background: isAsistio ? "#dcfce7" : "#ffffff",
                              color: isAsistio ? "#15803d" : "#64748b",
                              fontSize: "0.78rem",
                              fontWeight: 800,
                              cursor: "pointer",
                              transition: "all 0.15s ease"
                            }}
                          >
                            Asistió
                          </button>

                          {/* 2. Falta Injustificada */}
                          <button
                            onClick={() => handleAttendanceChange(est.numero_cuenta, "Falta injustificada")}
                            style={{
                              flex: 1,
                              maxWidth: "125px",
                              padding: "0.45rem 0.6rem",
                              borderRadius: "0.5rem",
                              border: isInjustificada ? "2px solid #dc2626" : "1.5px solid #e2e8f0",
                              background: isInjustificada ? "#fee2e2" : "#ffffff",
                              color: isInjustificada ? "#b91c1c" : "#64748b",
                              fontSize: "0.78rem",
                              fontWeight: 800,
                              cursor: "pointer",
                              transition: "all 0.15s ease"
                            }}
                          >
                            Falta Injust.
                          </button>

                          {/* 3. Falta Justificada */}
                          <button
                            onClick={() => handleAttendanceChange(est.numero_cuenta, "Falta justificada")}
                            style={{
                              flex: 1,
                              maxWidth: "125px",
                              padding: "0.45rem 0.6rem",
                              borderRadius: "0.5rem",
                              border: isJustificada ? "2px solid #d97706" : "1.5px solid #e2e8f0",
                              background: isJustificada ? "#fef3c7" : "#ffffff",
                              color: isJustificada ? "#b45309" : "#64748b",
                              fontSize: "0.78rem",
                              fontWeight: 800,
                              cursor: "pointer",
                              transition: "all 0.15s ease"
                            }}
                          >
                            Falta Just.
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
