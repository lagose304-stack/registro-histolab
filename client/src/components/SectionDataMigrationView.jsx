import GradeInput from "./GradeInput";
import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { ArrowLeft, Save, RefreshCw, Search, BookOpen, FileEdit, GraduationCap,
  Clock, CheckCircle2, AlertCircle, Users, Info, Calendar, Database, RotateCcw } from "lucide-react";
import "./SectionDataMigrationView.css";
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

  const [loadError, setLoadError] = useState("");
  const [saveMessage, setSaveMessage] = useState("");
  const [saveError, setSaveError] = useState("");
  const [editedAccounts, setEditedAccounts] = useState(() => new Set());
  const savedStudentsRef = useRef([]);
  const loadRequestRef = useRef(0);
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
  const markChanged = account => {
    setHasUnsavedChanges(true);
    setEditedAccounts(previous => new Set(previous).add(account));
    setSaveError("");
    setSaveMessage("");
  };

  useEffect(() => {
    if (!hasUnsavedChanges) return;
    const warnBeforeUnload = event => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", warnBeforeUnload);
    return () => window.removeEventListener("beforeunload", warnBeforeUnload);
  }, [hasUnsavedChanges]);

  const handleClose = () => {
    if (saving) return;
    if (!hasUnsavedChanges || window.confirm("Hay cambios sin guardar. ¿Quieres salir y descartarlos?")) onClose();
  };

  const discardChanges = () => {
    if (!window.confirm("¿Descartar los cambios de todas las categorías y volver a los últimos datos guardados?")) return;
    setEstudiantes(savedStudentsRef.current);
    setQuizInputBuffer({});
    setEditedAccounts(new Set());
    setHasUnsavedChanges(false);
    setSaveError("");
    setSaveMessage("");
  };

  // Limpiar buffer de entrada al cambiar de semana o de pestaña
  useEffect(() => {
    setQuizInputBuffer({});
  }, [selectedSemana, activeTab]);

  // Cargar datos completos de la sección
  const loadData = useCallback(async () => {
    if (!seccion?.id) return;
    const request = ++loadRequestRef.current;
    setLoading(true);
    setLoadError("");
    try {
      const [resEst, resSemanas, resTemario, resPuntajes] = await Promise.all([
        api.estudiantes.getBySeccion(seccion.id, carrera),
        api.semanas.getConfig(carrera),
        api.temario.getAll({ carrera }),
        api.temario.getPuntajes(carrera)
      ]);
      if (request !== loadRequestRef.current) return;
      if (!Array.isArray(resEst?.data) || !Array.isArray(resSemanas?.data) || !Array.isArray(resTemario?.data)) {
        throw new Error("La información recibida está incompleta.");
      }
      const sorted = [...resEst.data].sort((a, b) =>
        (a.nombre_completo || "").localeCompare(b.nombre_completo || "")
      );
      savedStudentsRef.current = sorted;
      setEstudiantes(sorted);
      setSemanasConfig(resSemanas.data);
      setTemario(resTemario.data);
      setConfigPuntajes(resPuntajes?.data || null);
      setQuizInputBuffer({});
      setHasUnsavedChanges(false);
      setEditedAccounts(new Set());
      setSaveError("");
      setSaveMessage("");
    } catch (err) {
      if (request !== loadRequestRef.current) return;
      console.error("Error al cargar datos de migración:", err);
      setLoadError("No se pudo cargar la información completa de la sección. Revisa tu conexión e inténtalo de nuevo.");
    } finally {
      if (request === loadRequestRef.current) setLoading(false);
    }
  }, [seccion?.id, carrera]);

  useEffect(() => {
    loadData();
    return () => { loadRequestRef.current += 1; };
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
    const cleanVal = String(rawValue).replace(",", ".").replace(/^\./, "0.");

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
      markChanged(numero_cuenta);
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
    markChanged(numero_cuenta);
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
    const cleanVal = String(rawValue).replace(",", ".").replace(/^\./, "0.");

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
      markChanged(numero_cuenta);
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
    markChanged(numero_cuenta);
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
  const currentExamIndex = ["examen_I", "examen_II", "examen_III"].indexOf(selectedExamParcial);
  const currentExamWeek = availableWeeks.filter(week => week.esExamen)[currentExamIndex] || null;
  const currentExamWeekKey = currentExamWeek ? `examen_semana_${currentExamWeek.numero_semana}` : null;

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
    // Conservar un decimal que aún se escribe, pero no mostrar como ingresado
    // el cero que las columnas históricas reciben automáticamente.
    if (typeof est[colKey] === "string" && (est[colKey] === "" || est[colKey].endsWith("."))) return est[colKey];
    const val = getCanonicalExamGrade(est, currentExamIndex, currentExamWeek);
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
          const currentNotas = { ...(est.notas || {}), [colKey]: fixed, [selectedExamParcial]: fixed, ...(currentExamWeekKey ? { [currentExamWeekKey]: fixed } : {}) };
          const updatedExamCols = { [colKey]: fixed };
          const nextTotal = recalculateTotal(est, currentNotas, updatedExamCols);
          return { ...est, [colKey]: fixed, notas: currentNotas, total: nextTotal };
        }
        return est;
      })
    );
  };

  const handleExamGradeChange = (numero_cuenta, rawValue) => {
    const cleanVal = String(rawValue).replace(",", ".").replace(/^\./, "0.");
    const colKey = currentExamInfo.col;

    if (cleanVal === "") {
      setEstudiantes((prev) =>
        prev.map((est) => {
          if (est.numero_cuenta !== numero_cuenta) return est;
          const currentNotas = { ...(est.notas || {}) };
          delete currentNotas[colKey];
          delete currentNotas[selectedExamParcial];
          if (currentExamWeekKey) {
            delete currentNotas[currentExamWeekKey];
            delete currentNotas[`examen_${currentExamWeek.numero_semana}`];
          }
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
      markChanged(numero_cuenta);
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
          [selectedExamParcial]: storedVal,
          ...(currentExamWeekKey ? { [currentExamWeekKey]: storedVal } : {})
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
    markChanged(numero_cuenta);
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
    markChanged(numero_cuenta);
  };

  // =========================================================================
  // GUARDAR TODO EN BATCH CON BARRERA DE INTEGRIDAD PREVIA
  // =========================================================================
  const handleSaveAll = async () => {
    if (!seccion?.id || loading || loadError || saving || !hasUnsavedChanges) return;

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

          if (((k.startsWith("prueba_") && !k.endsWith("_real")) || k.startsWith("examencito_")) && (numV > 5 || numV < 0)) {
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
    setSaveError("");
    setSaveMessage("");

    try {
      const updates = estudiantes.map((est) => ({
        id: est.id,
        expected_updated_at: est.updated_at,
        numero_cuenta: est.numero_cuenta,
        notas: est.notas || {},
        asistencias: est.asistencias || {},
        primer_examen: est.primer_examen !== "" && est.primer_examen !== undefined ? Number(est.primer_examen) : 0,
        segundo_examen: est.segundo_examen !== "" && est.segundo_examen !== undefined ? Number(est.segundo_examen) : 0,
        tercer_examen: est.tercer_examen !== "" && est.tercer_examen !== undefined ? Number(est.tercer_examen) : 0,
        total: est.total ?? 0
      }));

      const response = await api.estudiantes.saveMigration(seccion.id, updates, carrera);
      if (response?.success === false) throw new Error(response.message || "No se pudieron guardar los datos.");
      const confirmed = estudiantes.map(student => {
        const saved = response.data?.find(row => row.id === student.id && row.numero_cuenta === student.numero_cuenta);
        return saved ? { ...student, updated_at: saved.updated_at } : student;
      });
      setEstudiantes(confirmed);
      savedStudentsRef.current = confirmed;
      setEditedAccounts(new Set());
      setSaveMessage("Datos migrados y guardados correctamente.");
      setHasUnsavedChanges(false);
      notifyRef.current("¡Datos migrados y guardados con éxito!", "success");
    } catch (err) {
      console.error("Error al guardar migración:", err);
      setSaveError(err.message || "No se pudieron guardar los datos. Tus cambios siguen disponibles para reintentar.");
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
        String(e.numero_cuenta || "").toLowerCase().includes(s)
    );
  }, [estudiantes, searchTerm]);

  const tabs = [
    { id: "manuales", label: "Manuales", Icon: BookOpen, detail: "Notas por tema" },
    { id: "pruebas", label: "Pruebas", Icon: FileEdit, detail: "Conversión de notas" },
    { id: "examenes", label: "Exámenes", Icon: GraduationCap, detail: "Notas de parciales" },
    { id: "asistencia", label: "Asistencia", Icon: Clock, detail: "Registro por semana" }
  ];
  const currentTab = tabs.find(tab => tab.id === activeTab);
  const contextLabel = activeTab === "examenes" ? currentExamInfo.label : `Semana ${selectedSemana}`;
  const hasContext = activeTab === "examenes" || displayedWeeksForTab.length > 0;
  const hasFields = hasContext && (activeTab !== "manuales" || weekTopics.length > 0);
  const filledCount = estudiantes.filter(est => {
    if (activeTab === "manuales") return weekTopics.length > 0 && weekTopics.every(tema => getStudentManualGrade(est, tema) !== "");
    if (activeTab === "pruebas") return getConvertedQuizGrade5Pts(est) !== "";
    if (activeTab === "examenes") return getStudentExamGrade(est) !== "";
    return Boolean(getStudentAttendance(est));
  }).length;

  return (
    <section className="user-directory data-migration" data-category={activeTab} aria-labelledby="data-migration-title">
      <header className="data-migration__header">
        <div className="data-migration__heading">
          {!hideBackButton && <button type="button" className="user-button user-button--icon" onClick={handleClose} disabled={saving} aria-label="Volver a la sección"><ArrowLeft size={18} /></button>}
          <div><span className="data-migration__eyebrow">HISTORIAL ACADÉMICO · {seccion?.codigo} · {carrera}</span>
            <h2 id="data-migration-title">Migrar datos</h2><p>Registra notas y asistencia de periodos anteriores en tu sección.</p>
          </div>
        </div>
        <button type="button" className="user-button" disabled={loading || saving || hasUnsavedChanges} title={hasUnsavedChanges ? "Guarda o descarta los cambios antes de actualizar" : "Volver a cargar los datos de la sección"} onClick={loadData}><RefreshCw size={17} className={loading ? "animate-spin" : ""} />Actualizar datos</button>
      </header>
      {loading ? <div className="data-migration__empty" role="status"><RefreshCw size={28} className="animate-spin" /><h3>Cargando datos de la sección…</h3></div>
        : loadError ? <div className="data-migration__error" role="alert"><AlertCircle size={22} /><p>{loadError}</p><button type="button" className="user-button" onClick={loadData}>Reintentar</button></div>
        : <>
          <aside className="data-migration__notice"><Database size={20} /><p><strong>Registro de datos históricos.</strong> Puedes editar cualquier semana desde este módulo, sin depender de las asignaciones semanales. Revisa la categoría y el periodo antes de guardar.</p></aside>
          <fieldset className="data-migration__workspace" disabled={saving} aria-busy={saving} aria-label="Datos académicos de la sección">
            <div className="data-migration__tabs" role="group" aria-label="Categoría de datos">
              {tabs.map(({ id, label, Icon, detail }) => <button type="button" key={id} aria-pressed={activeTab === id} onClick={() => setActiveTab(id)}><Icon size={21} /><span><strong>{label}</strong><small>{detail}</small></span></button>)}
            </div>
            <div className="data-migration__selection">
              {activeTab === "examenes" ? <label htmlFor="migration-exam">Parcial a migrar<select id="migration-exam" value={selectedExamParcial} onChange={event => setSelectedExamParcial(event.target.value)}>{Object.entries(examColMap).map(([id, info]) => <option key={id} value={id}>{info.label}</option>)}</select></label>
                : <label htmlFor="migration-week">Semana a migrar<select id="migration-week" value={selectedSemana} disabled={!displayedWeeksForTab.length} onChange={event => setSelectedSemana(Number(event.target.value))}>{displayedWeeksForTab.length ? displayedWeeksForTab.map(week => <option key={week.numero_semana} value={week.numero_semana}>{getWeekDisplayName(week)}</option>) : <option value={selectedSemana}>Sin semanas disponibles</option>}</select>{displayedWeeksForTab.some(week => week.numero_semana === selectedSemana) && <small className="data-migration__week-description">{getWeekDisplayName(displayedWeeksForTab.find(week => week.numero_semana === selectedSemana))}</small>}</label>}
              <div className="data-migration__scale"><Info size={19} /><div>
                <strong>{activeTab === "pruebas" ? "Ingresa la nota sobre 1 punto" : activeTab === "manuales" ? "Cada manual se registra sobre 1 punto" : activeTab === "examenes" ? `Máximo del parcial: ${currentExamMaxPoints.toFixed(3)} puntos` : "Marca un estado de asistencia por estudiante"}</strong>
                <p>{activeTab === "pruebas" ? "La conversión a 5 puntos es automática: 0.800 × 5 = 4.000 pts." : activeTab === "asistencia" ? "Vuelve a tocar el estado seleccionado para dejarlo sin registrar." : "Admite hasta tres decimales. Un campo vacío significa que no hay nota; 0 es una nota registrada."}</p>
              </div></div>
            </div>
            <dl className="data-migration__stats">
              <div><dt><Users size={16} />Estudiantes</dt><dd>{estudiantes.length}</dd></div>
              <div><dt><CheckCircle2 size={16} />{activeTab === "asistencia" ? "Con asistencia" : "Con notas completas"}</dt><dd>{hasFields ? filledCount : "—"}<small>{contextLabel}</small></dd></div>
              <div><dt><Clock size={16} />{activeTab === "asistencia" ? "Sin registrar" : "Por completar"}</dt><dd>{hasFields ? estudiantes.length - filledCount : "—"}<small>{contextLabel}</small></dd></div>
            </dl>
            <div className="data-migration__toolbar"><label htmlFor="migration-search">Buscar estudiante<div><Search size={18} /><input id="migration-search" type="search" value={searchTerm} onChange={event => setSearchTerm(event.target.value)} placeholder="Nombre o número de cuenta" /></div></label><span role="status">{filteredEstudiantes.length} de {estudiantes.length} estudiantes</span></div>
            <div className="data-migration__list-heading"><h3>{currentTab.label} · {contextLabel}</h3>{activeTab === "manuales" && <span>{weekTopics.length} {weekTopics.length === 1 ? "manual evaluable" : "manuales evaluables"}</span>}</div>
            {activeTab !== "asistencia" && <p style={{fontSize:"0.78rem",color:"#526c80"}}>Teclado: Enter avanza; ↑ ↓ cambian de estudiante; ← → cambian de nota desde el borde del campo.</p>}
            {!estudiantes.length ? <div className="data-migration__empty"><Users size={28} /><h3>No hay estudiantes en esta sección</h3><p>Agrega estudiantes desde la gestión de la sección para registrar sus datos.</p></div>
              : !hasFields ? <div className="data-migration__empty"><Calendar size={28} /><h3>{hasContext ? "Esta semana no tiene manuales evaluables" : "No hay semanas disponibles para esta categoría"}</h3><p>Selecciona otro periodo o revisa la programación académica.</p></div>
              : !filteredEstudiantes.length ? <div className="data-migration__empty"><Search size={28} /><h3>No hay coincidencias</h3><p>Prueba con otro nombre o número de cuenta.</p><button type="button" className="user-button" onClick={() => setSearchTerm("")}>Limpiar búsqueda</button></div>
              : <ul className="data-migration__students" data-grade-grid>
                {filteredEstudiantes.map((est, index) => {
                  const account = est.numero_cuenta;
                  const quizGrade = getConvertedQuizGrade5Pts(est);
                  const examGrade = getStudentExamGrade(est);
                  const attendance = getStudentAttendance(est);
                  return <li key={account || index} className="data-migration__student" data-edited={editedAccounts.has(account)}>
                    <div className="data-migration__student-info"><span className="data-migration__avatar">{String(index + 1).padStart(2, "0")}</span><div><h4>{est.nombre_completo || "Estudiante"}</h4><p>Cuenta: {account}</p>{editedAccounts.has(account) && <small>Cambios sin guardar</small>}</div></div>
                    <div className="data-migration__fields">
                      {activeTab === "manuales" && weekTopics.map((tema, columnIndex) => <label className="data-migration__grade" key={tema.id} htmlFor={`manual-${account}-${tema.id}`}><span>Tema {tema.numero_tema} · {tema.titulo || "Manual"}</span><div><GradeInput max={1} data-grade-row={index} data-grade-column={columnIndex} id={`manual-${account}-${tema.id}`} value={getStudentManualGrade(est, tema)} onInvalidValue={value => handleManualGradeChange(account, tema, value)} onValueChange={value => handleManualGradeChange(account, tema, value)} onBlur={() => handleManualGradeBlur(account, tema)} placeholder="Sin nota" /><small>/ 1.000 pt</small></div></label>)}
                      {activeTab === "pruebas" && <div className="data-migration__conversion"><label className="data-migration__grade" htmlFor={`quiz-${account}`}><span>Nota original · base 1</span><div><GradeInput max={1} data-grade-row={index} id={`quiz-${account}`} value={getDisplayQuizGrade1Pt(est)} onInvalidValue={value => handleQuizGradeChange(account, value)} onValueChange={value => handleQuizGradeChange(account, value)} onBlur={() => handleQuizGradeBlur(account)} placeholder="Sin nota" /><small>/ 1.000 pt</small></div></label><div className="data-migration__converted"><span>Nota oficial · base 5</span><output htmlFor={`quiz-${account}`}>{quizGrade === "" ? "Sin nota" : `${Number(quizGrade).toFixed(3)} / 5.000 pts`}</output></div></div>}
                      {activeTab === "examenes" && <label className="data-migration__grade" htmlFor={`exam-${account}`}><span>{currentExamInfo.label}</span><div><GradeInput max={currentExamMaxPoints} data-grade-row={index} id={`exam-${account}`} value={examGrade} onInvalidValue={value => handleExamGradeChange(account, value)} onValueChange={value => handleExamGradeChange(account, value)} onBlur={() => handleExamGradeBlur(account)} placeholder="Sin nota" /><small>/ {currentExamMaxPoints.toFixed(3)} pts</small></div></label>}
                      {activeTab === "asistencia" && <div className="data-migration__attendance" role="group" aria-label={`Asistencia de ${est.nombre_completo}`}>
                        {[["Asistio", "Asistió"], ["Falta injustificada", "Falta injustificada"], ["Falta justificada", "Falta justificada"]].map(([value, label]) => <button type="button" key={value} aria-pressed={attendance === value} data-status={value} onClick={() => handleAttendanceChange(account, value)}>{attendance === value && <CheckCircle2 size={15} />}{label}</button>)}
                        <span>{attendance ? `Registrado: ${attendance === "Asistio" ? "Asistió" : attendance}` : "Sin asistencia registrada"}</span>
                      </div>}
                    </div>
                  </li>;
                })}
              </ul>}
          </fieldset>
          <footer className="data-migration__save">
            {saveError && <p className="data-migration__save-error" role="alert"><AlertCircle size={18} />{saveError}</p>}
            {saveMessage && <p className="data-migration__success" role="status"><CheckCircle2 size={18} />{saveMessage}</p>}
            <div><div className="data-migration__save-state"><strong>{saving ? "Guardando datos…" : hasUnsavedChanges ? `${editedAccounts.size} ${editedAccounts.size === 1 ? "estudiante con cambios" : "estudiantes con cambios"}` : "Sin cambios pendientes"}</strong><p>El guardado incluye las ediciones de todas las categorías y semanas, aunque estén ocultas por la búsqueda.</p></div>
              <div className="data-migration__save-actions">{hasUnsavedChanges && <button type="button" className="user-button" onClick={discardChanges} disabled={saving}><RotateCcw size={16} />Descartar</button>}<button type="button" className="user-button user-button--primary" onClick={handleSaveAll} disabled={saving || !hasUnsavedChanges || !estudiantes.length}>{saving ? <RefreshCw size={17} className="animate-spin" /> : <Save size={17} />}{saving ? "Guardando…" : "Guardar datos migrados"}</button></div>
            </div>
          </footer>
        </>}
    </section>
  );
}
