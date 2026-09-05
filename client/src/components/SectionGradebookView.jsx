import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  ArrowLeft,
  FileSpreadsheet,
  Download,
  Search,
  RefreshCw,
  Award,
  BookOpen,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  HelpCircle,
  Filter,
  UserCheck,
  CalendarCheck,
  GraduationCap,
  Sparkles,
  Calendar,
  Layers,
  Check,
  ShieldAlert,
  ShieldCheck,
  AlertOctagon,
  Save
} from "lucide-react";
import { api } from "../services/api";
import { exportStyledExcel } from "../utils/exportExcel";
import { getNavState, setNavState } from "../utils/navigationState";
import {
  isExamWeek as isExamWeekCore,
  calculateStudentAcademicSummary
} from "../utils/academicEngine";

// Helper: Calcula si el estudiante perdió derecho a examen por acumular 2 o más faltas injustificadas en un parcial
export const getStudentDerechoStatus = (est, parcialId = "TODOS", dynamicParcialesList = []) => {
  const getAsistVal = (sem) => {
    return (
      est?.asistencias?.[`asistencia_${sem}`] ??
      est?.asistencias?.[`semana_${sem}`] ??
      est?.[`Asistencia de la semana ${sem}`] ??
      null
    );
  };

  // Extraer lista de parciales reales (excluyendo 'TODOS')
  const realParciales = (Array.isArray(dynamicParcialesList) ? dynamicParcialesList : []).filter(
    (p) => p.id !== "TODOS"
  );

  const parcialesStatus = {};
  const parcialesPerdidos = [];

  realParciales.forEach((p) => {
    const faltas = (p.semanas || []).filter(
      (sem) => getAsistVal(sem) === "Falta injustificada"
    ).length;
    const perdio = faltas >= 2;

    const statusObj = { perdio, faltas, label: p.label, semanas: p.semanas };
    parcialesStatus[p.id] = statusObj;
    parcialesStatus[p.label] = statusObj;
    if (p.rawParcialName) parcialesStatus[p.rawParcialName] = statusObj;
    if (p.parcialKey) parcialesStatus[p.parcialKey] = statusObj;

    if (perdio) {
      parcialesPerdidos.push(`${p.label} (${faltas} faltas)`);
    }
  });

  // Si se consulta un parcial específico
  if (parcialId !== "TODOS" && parcialesStatus[parcialId]) {
    const curr = parcialesStatus[parcialId];
    return {
      perdioDerecho: curr.perdio,
      faltasInjustificadas: curr.faltas,
      parcialesStatus,
      motivo: curr.perdio
        ? `Perdió derecho en ${curr.label} (${curr.faltas} faltas injustificadas)`
        : "Habilitado",
      badgeText: curr.perdio
        ? `🚨 Perdió Derecho (${curr.faltas} Faltas Injust.)`
        : "✓ Habilitado",
      perdioI: parcialesStatus["I_PARCIAL"]?.perdio || parcialesStatus["I"]?.perdio || false,
      perdioII: parcialesStatus["II_PARCIAL"]?.perdio || parcialesStatus["II"]?.perdio || false,
      perdioIII: parcialesStatus["III_PARCIAL"]?.perdio || parcialesStatus["III"]?.perdio || false
    };
  }

  const perdioAlguno = parcialesPerdidos.length > 0;

  return {
    perdioDerecho: perdioAlguno,
    parcialesStatus,
    parcialesPerdidos,
    motivo: perdioAlguno
      ? `Perdió derecho en: ${parcialesPerdidos.join(", ")}`
      : "Habilitado en todos los parciales",
    badgeText: perdioAlguno
      ? `🚨 Perdió Derecho en ${parcialesPerdidos.length} parcial(es)`
      : "✓ Habilitado",
    perdioI: parcialesStatus["I_PARCIAL"]?.perdio || parcialesStatus["I"]?.perdio || false,
    perdioII: parcialesStatus["II_PARCIAL"]?.perdio || parcialesStatus["II"]?.perdio || false,
    perdioIII: parcialesStatus["III_PARCIAL"]?.perdio || parcialesStatus["III"]?.perdio || false
  };
};

// Helper que escribe en el espacio disponible de la primera línea y crea un segundo renglón vertical centrado con el resto del texto completo
// Helper para formatear calificaciones con hasta 3 decimales
const formatGradeValue = (val) => {
  if (val === undefined || val === null || val === "" || Number(val) === 0) return "—";
  const num = Number(val);
  if (isNaN(num)) return "—";
  return Math.round(num * 1000) / 1000;
};

const renderVerticalHeaderAutoWrap = (title, maxCharsFirstLine = 28) => {
  if (!title) return null;

  const words = title.trim().split(/\s+/);
  let line1Words = [];
  let line2Words = [];
  let currentLen = 0;

  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    const wouldBeLen = currentLen === 0 ? word.length : currentLen + 1 + word.length;

    if (wouldBeLen <= maxCharsFirstLine && line2Words.length === 0) {
      line1Words.push(word);
      currentLen = wouldBeLen;
    } else {
      line2Words.push(word);
    }
  }

  const line1 = line1Words.join(" ");
  const line2 = line2Words.join(" ");

  if (!line2) {
    return (
      <span style={{ whiteSpace: "nowrap", textAlign: "center", display: "inline-block" }}>
        {line1}
      </span>
    );
  }

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "4px",
        alignItems: "center",
        justifyContent: "center",
        height: "100%",
        textAlign: "center",
        lineHeight: 1.15
      }}
    >
      <span style={{ whiteSpace: "nowrap", textAlign: "center", display: "inline-block" }}>
        {line1}
      </span>
      <span style={{ whiteSpace: "nowrap", textAlign: "center", display: "inline-block" }}>
        {line2}
      </span>
    </div>
  );
};

export default function SectionGradebookView({
  seccion,
  onClose = () => {},
  notify = () => {},
  forcedViewType = null,
  hideBackButton = false
}) {
  const initialNav = getNavState();
  const [estudiantes, setEstudiantes] = useState([]);
  const [temario, setTemario] = useState([]);
  const [semanasConfig, setSemanasConfig] = useState([]);
  const [configPuntajes, setConfigPuntajes] = useState(null);
  const [loading, setLoading] = useState(false);
  const [savingChanges, setSavingChanges] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [viewType, setViewTypeState] = useState(() => forcedViewType || initialNav.gradebookViewType || "notas");
  const [selectedParcial, setSelectedParcialState] = useState(() => initialNav.gradebookSelectedParcial || "TODOS");
  const [activeCategory, setActiveCategoryState] = useState(() => initialNav.gradebookActiveCategory || "TODAS");

  useEffect(() => {
    if (forcedViewType) {
      setViewTypeState(forcedViewType);
    }
  }, [forcedViewType]);

  const setViewType = (vt) => {
    setViewTypeState(vt);
    setNavState({ gradebookViewType: vt });
  };

  const setSelectedParcial = (sp) => {
    setSelectedParcialState(sp);
    setNavState({ gradebookSelectedParcial: sp });
  };

  const setActiveCategory = (ac) => {
    setActiveCategoryState(ac);
    setNavState({ gradebookActiveCategory: ac });
  };

  // Carrera de la sección
  const carrera = seccion?.carrera || "Medicina";

  // Cargar Temario, Semanas Académicas y Configuración de Puntajes de la Carrera
  const loadAcademicConfig = useCallback(async () => {
    try {
      const [resTemario, resSemanas, resPuntajes] = await Promise.all([
        api.temario.getAll({ carrera }),
        api.semanas.getConfig(carrera),
        api.temario.getPuntajes(carrera).catch(() => ({ data: null }))
      ]);

      if (resTemario?.data) {
        const sortedTemas = [...resTemario.data].sort((a, b) => {
          const semA = Number(a.semana) || 999;
          const semB = Number(b.semana) || 999;
          if (semA !== semB) return semA - semB;
          return (Number(a.numero_tema) || 999) - (Number(b.numero_tema) || 999);
        });
        setTemario(sortedTemas);
      }
      if (resSemanas?.data) {
        const sortedSemanas = [...resSemanas.data].sort(
          (a, b) => Number(a.numero_semana) - Number(b.numero_semana)
        );
        setSemanasConfig(sortedSemanas);
      }
      if (resPuntajes?.data) {
        setConfigPuntajes(resPuntajes.data);
      }
    } catch (err) {
      console.warn("Aviso al cargar configuración académica de carrera:", err);
    }
  }, [carrera]);

  // Cargar estudiantes de la sección
  const loadEstudiantes = useCallback(async () => {
    if (!seccion?.id) return;
    setLoading(true);
    try {
      await loadAcademicConfig();
      const res = await api.estudiantes.getBySeccion(seccion.id, carrera);
      if (res?.data) {
        setEstudiantes(res.data);
        setHasUnsavedChanges(false);
      }
    } catch (err) {
      console.error("Error al cargar datos de la sección:", err);
      notify("Error al cargar la información de la sección", "error");
    } finally {
      setLoading(false);
    }
  }, [seccion?.id, carrera, loadAcademicConfig, notify]);

  useEffect(() => {
    loadEstudiantes();
  }, [loadEstudiantes]);

  // Construcción 100% DINÁMICA de Parciales según los temas y semanas de la carrera
  const dynamicParcialesConfig = useMemo(() => {
    // 1. Obtener todas las semanas configuradas para esta carrera
    const allSemanasNums = (
      semanasConfig.length > 0
        ? semanasConfig.map((s) => Number(s.numero_semana))
        : Array.from(new Set(temario.map((t) => Number(t.semana) || 1)))
    ).sort((a, b) => a - b);

    const minTotalSem = allSemanasNums[0] || 1;
    const maxTotalSem = allSemanasNums[allSemanasNums.length - 1] || 1;

    const isExamWeek = (semNum) => {
      const semObj = semanasConfig.find((s) => Number(s.numero_semana) === Number(semNum));
      return isExamWeekCore(semObj);
    };

    // Semanas marcadas explícitamente como examen
    const configuredExamWeeks = semanasConfig.filter((s) => isExamWeek(s.numero_semana));

    // Generador dinámico de exámenes según las semanas marcadas con examen
    const createExamenesForWeeks = (weeksFilter = null, pNameFallback = null) => {
      if (configuredExamWeeks.length > 0) {
        return configuredExamWeeks
          .filter((s) => !weeksFilter || weeksFilter.includes(Number(s.numero_semana)))
          .map((s) => {
            const numSem = Number(s.numero_semana);
            const parcialStr = String(s.parcial || pNameFallback || "").toLowerCase();
            let pKey = "I";
            let defaultKey = "primer_examen";

            if (parcialStr.includes("iii") || parcialStr.includes("tercer") || numSem > 8) {
              pKey = "III";
              defaultKey = "tercer_examen";
            } else if (parcialStr.includes("ii") || parcialStr.includes("segundo") || numSem > 4) {
              pKey = "II";
              defaultKey = "segundo_examen";
            }

            // Limpiar cualquier prefijo que mencione la semana (ej: "Semana 16 - ", "Semana 16:", "Semana 16 ")
            const rawLabel = (s.nombre_semana || s.descripcion || "").trim();
            let cleanLabel = rawLabel.replace(/^Semana\s*\d+\s*[-:•–—]?\s*/i, "").trim();

            // Si incluye la palabra "Parcial" al final de "Examen X Parcial", normalizar para que coincida con "Examen I", "Examen II"
            cleanLabel = cleanLabel.replace(/^Examen\s+([IVX\d]+)\s+Parcial$/i, "Examen $1").trim();

            let label = `Examen ${pKey}`;
            if (cleanLabel && cleanLabel.toLowerCase() !== "examen" && cleanLabel.toLowerCase() !== "examen parcial") {
              if (cleanLabel.toLowerCase().includes("examen")) {
                label = cleanLabel;
              } else {
                label = `Examen ${pKey}: ${cleanLabel}`;
              }
            }

            return {
              key: `examen_semana_${numSem}`,
              legacyKey: defaultKey,
              altKey: defaultKey,
              label,
              parcialName: s.parcial || pNameFallback || "Examen",
              parcialKey: pKey,
              semana: numSem
            };
          });
      }

      return [];
    };

    const createAsistenciasExamenesForWeeks = (examList) => {
      return examList.map((ex) => {
        const cleanExamTitle = (ex.label || `Examen ${ex.parcialKey || "I"}`)
          .replace(/^Semana\s*\d+\s*[-:•–—]?\s*/i, "")
          .replace(/^Examen\s+([IVX\d]+)\s+Parcial$/i, "Examen $1")
          .trim();

        return {
          key: `asistencia_examen_${ex.semana}`,
          legacyKey: ex.parcialKey === "I" ? "Asistencia Primer Examen" : ex.parcialKey === "II" ? "Asistencia Segundo Examen" : "Asistencia Tercer Examen",
          label: `Asistencia ${cleanExamTitle}`,
          shortLabel: `Asist. ${cleanExamTitle}`,
          semana: ex.semana,
          parcialKey: ex.parcialKey
        };
      });
    };

    // 2. Extraer grupos de Parciales ÚNICAMENTE definidos en el temario / configuración de semanas
    const parcialesMap = new Map(); // Map<parcialName, number[]>

    if (semanasConfig.length > 0) {
      const sortedSemanas = [...semanasConfig].sort((a, b) => Number(a.numero_semana) - Number(b.numero_semana));
      sortedSemanas.forEach((s) => {
        const pName = (s.parcial || "I Parcial").trim();
        const semNum = Number(s.numero_semana);
        if (!parcialesMap.has(pName)) {
          parcialesMap.set(pName, []);
        }
        if (!parcialesMap.get(pName).includes(semNum)) {
          parcialesMap.get(pName).push(semNum);
        }
      });
    } else if (temario.length > 0) {
      const sortedTemas = [...temario].sort((a, b) => Number(a.semana || 1) - Number(b.semana || 1));
      sortedTemas.forEach((t) => {
        const pName = (t.parcial || "I Parcial").trim();
        const semNum = Number(t.semana || 1);
        if (!parcialesMap.has(pName)) {
          parcialesMap.set(pName, []);
        }
        if (!parcialesMap.get(pName).includes(semNum)) {
          parcialesMap.get(pName).push(semNum);
        }
      });
    }

    // Paleta de colores visuales para los parciales dinámicos
    const PARCIAL_THEMES = [
      { color: "#7c3aed", bgActive: "#faf5ff", borderActive: "#e9d5ff" },
      { color: "#0284c7", bgActive: "#f0f9ff", borderActive: "#bae6fd" },
      { color: "#d97706", bgActive: "#fffbeb", borderActive: "#fde68a" },
      { color: "#16a34a", bgActive: "#f0fdf4", borderActive: "#bbf7d0" },
      { color: "#dc2626", bgActive: "#fef2f2", borderActive: "#fecaca" }
    ];

    const allExams = createExamenesForWeeks();
    const regularSemanasNums = allSemanasNums.filter((s) => !isExamWeek(s));

    // Filtro "Todo el Periodo"
    const result = [
      {
        id: "TODOS",
        label: "Todo el Periodo",
        badge: allSemanasNums.length > 0 ? `Semanas ${minTotalSem} - ${maxTotalSem}` : "Sin semanas",
        semanas: allSemanasNums,
        semanasClase: regularSemanasNums,
        semanasPruebas: regularSemanasNums,
        semanasAsistencia: regularSemanasNums,
        examenes: allExams,
        asistenciasExamenes: createAsistenciasExamenesForWeeks(allExams),
        temas: temario.filter((t) => t.tiene_manual !== false),
        color: "#2563eb",
        bgActive: "#eff6ff",
        borderActive: "#bfdbfe"
      }
    ];

    // Agregar cada parcial dinámico exactamente como fue configurado en el temario
    let pIdx = 0;
    parcialesMap.forEach((weeksList, pName) => {
      weeksList.sort((a, b) => a - b);
      const minS = weeksList[0];
      const maxS = weeksList[weeksList.length - 1];
      const theme = PARCIAL_THEMES[pIdx % PARCIAL_THEMES.length];
      const pId = `PARCIAL_${pName.replace(/\s+/g, "_").toUpperCase()}`;
      const parcialExams = createExamenesForWeeks(weeksList, pName);
      const parcialTemas = temario.filter(
        (t) => weeksList.includes(Number(t.semana)) && t.tiene_manual !== false
      );
      const regularParcialWeeks = weeksList.filter((s) => !isExamWeek(s));

      result.push({
        id: pId,
        rawParcialName: pName,
        label: pName,
        badge: minS === maxS ? `Semana ${minS}` : `Semanas ${minS} a ${maxS}`,
        semanas: weeksList,
        semanasClase: regularParcialWeeks,
        semanasPruebas: regularParcialWeeks,
        semanasAsistencia: regularParcialWeeks,
        examenes: parcialExams,
        asistenciasExamenes: createAsistenciasExamenesForWeeks(parcialExams),
        temas: parcialTemas,
        color: theme.color,
        bgActive: theme.bgActive,
        borderActive: theme.borderActive
      });

      pIdx++;
    });

    return result;
  }, [temario, semanasConfig]);

  // Parcial activo
  const currentParcialConfig = useMemo(() => {
    return dynamicParcialesConfig.find((p) => p.id === selectedParcial) || dynamicParcialesConfig[0];
  }, [dynamicParcialesConfig, selectedParcial]);

  // Mapa de Título de Semanas para Cabeceras
  const semanasTemasMap = useMemo(() => {
    const map = {};
    temario.forEach((t) => {
      const sem = Number(t.semana) || 1;
      if (!map[sem]) map[sem] = [];
      map[sem].push(t.titulo);
    });
    const result = {};
    Object.keys(map).forEach((k) => {
      result[k] = map[k].join(" y ");
    });
    return result;
  }, [temario]);

  // Helper para leer valor de nota de un estudiante
  const getStudentGrade = (est, key, defaultVal = 0) => {
    if (!est) return defaultVal;
    if (est.notas && est.notas[key] !== undefined) return Number(est.notas[key]);
    if (est[key] !== undefined && est[key] !== null) return Number(est[key]);
    return defaultVal;
  };

  // Helper para leer valor de asistencia de un estudiante
  const getStudentAsistencia = (est, key) => {
    if (!est) return null;
    if (est.asistencias && est.asistencias[key] !== undefined) return est.asistencias[key];
    if (est[key] !== undefined && est[key] !== null) return est[key];
    return null;
  };

  // Resumen y cálculos dinámicos de Puntos Oro basados en el motor académico centralizado
  const calcularNotaOroManuales = useCallback(
    (est, customNotas = null) => {
      const summary = calculateStudentAcademicSummary(est, configPuntajes, temario, semanasConfig, customNotas);
      return summary.notaOroManuales;
    },
    [temario, configPuntajes, semanasConfig]
  );

  const calcularNotaOroPruebas = useCallback(
    (est, customNotas = null) => {
      const summary = calculateStudentAcademicSummary(est, configPuntajes, temario, semanasConfig, customNotas);
      return summary.notaOroPruebas;
    },
    [temario, configPuntajes, semanasConfig]
  );

  const getStudentCalculatedTotal = useCallback(
    (est, customNotas = null) => {
      const summary = calculateStudentAcademicSummary(est, configPuntajes, temario, semanasConfig, customNotas);
      return summary.total;
    },
    [temario, configPuntajes, semanasConfig]
  );

  // Actualizar calificación de un estudiante en el estado
  const handleUpdateGrade = (numero_cuenta, key, value) => {
    const numVal = Math.max(0, Math.min(100, Number(value) || 0));
    setEstudiantes((prev) =>
      prev.map((est) => {
        if (est.numero_cuenta !== numero_cuenta) return est;

        const updatedNotas = { ...(est.notas || {}), [key]: numVal };
        if (key === "primer_examen") est.primer_examen = numVal;
        if (key === "segundo_examen") est.segundo_examen = numVal;
        if (key === "tercer_examen") est.tercer_examen = numVal;

        const newTotal = getStudentCalculatedTotal(est, updatedNotas);

        return {
          ...est,
          notas: updatedNotas,
          primer_examen: key === "primer_examen" ? numVal : (est.primer_examen ?? updatedNotas.primer_examen ?? 0),
          segundo_examen: key === "segundo_examen" ? numVal : (est.segundo_examen ?? updatedNotas.segundo_examen ?? 0),
          tercer_examen: key === "tercer_examen" ? numVal : (est.tercer_examen ?? updatedNotas.tercer_examen ?? 0),
          total: newTotal
        };
      })
    );
    setHasUnsavedChanges(true);
  };

  // Alternar Asistencia de un estudiante
  const handleToggleAsistencia = (numero_cuenta, key) => {
    const ESTADOS = [null, "Asistio", "Falta justificada", "Falta injustificada"];
    setEstudiantes((prev) =>
      prev.map((est) => {
        if (est.numero_cuenta !== numero_cuenta) return est;
        const currentVal = getStudentAsistencia(est, key);
        const currentIdx = ESTADOS.indexOf(currentVal);
        const nextVal = ESTADOS[(currentIdx + 1) % ESTADOS.length];

        const updatedAsist = { ...(est.asistencias || {}), [key]: nextVal };
        return {
          ...est,
          asistencias: updatedAsist,
          [key]: nextVal
        };
      })
    );
    setHasUnsavedChanges(true);
  };

  // Guardar todas las calificaciones y asistencias de la sección
  const handleSaveAll = async () => {
    if (!seccion?.id) return;

    // 🔒 Validación Académica Estricta: Manuales máx 1 pt, Pruebas máx 5 pts
    for (const est of estudiantes) {
      const notas = est.notas || {};
      for (const [k, v] of Object.entries(notas)) {
        const numVal = Number(v);
        if (isNaN(numVal)) continue;
        if ((k.startsWith("manual_") || k.startsWith("Manual de ")) && numVal > 1) {
          notify(
            `No se puede guardar: El estudiante "${est.nombre_completo || est.numero_cuenta}" tiene una nota de manual de ${numVal} pts (máximo permitido: 1.000 pt).`,
            "error"
          );
          return;
        }
        if (
          (k.startsWith("examencito_") ||
            k.startsWith("prueba_") ||
            k.startsWith("Examencito de ") ||
            k.startsWith("Prueba de ")) &&
          numVal > 5
        ) {
          notify(
            `No se puede guardar: El estudiante "${est.nombre_completo || est.numero_cuenta}" tiene una nota de prueba de ${numVal} pts (máximo permitido: 5.000 pts).`,
            "error"
          );
          return;
        }
      }
    }

    setSavingChanges(true);
    try {
      const updates = estudiantes.map((est) => ({
        numero_cuenta: est.numero_cuenta,
        notas: est.notas || {},
        asistencias: est.asistencias || {},
        total: getStudentCalculatedTotal(est),
        primer_examen: est.primer_examen || 0,
        segundo_examen: est.segundo_examen || 0,
        tercer_examen: est.tercer_examen || 0
      }));

      await api.estudiantes.saveBatch(seccion.id, updates, carrera);
      setHasUnsavedChanges(false);
      notify("¡Calificaciones y asistencias guardadas con éxito!", "success");
    } catch (err) {
      console.error("Error al guardar calificaciones:", err);
      notify("Error al guardar calificaciones: " + err.message, "error");
    } finally {
      setSavingChanges(false);
    }
  };

  // Filtrado de estudiantes por nombre o cuenta
  const filteredEstudiantes = useMemo(() => {
    const s = searchTerm.toLowerCase().trim();
    if (!s) return estudiantes;
    return estudiantes.filter(
      (est) =>
        (est.numero_cuenta || "").toLowerCase().includes(s) ||
        (est.nombre_completo || "").toLowerCase().includes(s)
    );
  }, [estudiantes, searchTerm]);

  // Exportar a Excel (.xlsx)
  const [exporting, setExporting] = useState(false);

  const handleExportExcel = async () => {
    if (estudiantes.length === 0) {
      notify("No hay estudiantes para exportar", "info");
      return;
    }

    setExporting(true);
    try {
      await exportStyledExcel({
        viewType,
        seccion,
        estudiantes: estudiantes.map((e) => ({
          ...e,
          total: getStudentCalculatedTotal(e),
          nota_oro_manuales: calcularNotaOroManuales(e),
          nota_oro_pruebas: calcularNotaOroPruebas(e)
        })),
        currentParcialConfig,
        selectedParcial,
        semanasTemasMap
      });
      notify(
        `Archivo Excel (.xlsx) de ${viewType === "notas" ? "calificaciones" : "asistencias"} (${currentParcialConfig.label}) exportado con éxito`,
        "success"
      );
    } catch (err) {
      console.error("Error al exportar archivo Excel:", err);
      notify("Error al generar el archivo Excel", "error");
    } finally {
      setExporting(false);
    }
  };

  const getAsistenciaBadge = (val) => {
    if (!val || val === "") {
      return (
        <span style={{ color: "#94a3b8", fontSize: "0.85rem", fontWeight: 700, opacity: 0.55 }}>
          —
        </span>
      );
    }
    if (val === "Asistio") {
      return (
        <span
          style={{
            background: "#dcfce7",
            color: "#15803d",
            padding: "0.25rem 0.55rem",
            borderRadius: "6px",
            fontSize: "0.75rem",
            fontWeight: 800,
            display: "inline-flex",
            alignItems: "center",
            gap: "0.25rem",
            whiteSpace: "nowrap"
          }}
        >
          ✓ Asistió
        </span>
      );
    }
    if (val === "Falta justificada") {
      return (
        <span
          style={{
            background: "#fef3c7",
            color: "#b45309",
            padding: "0.25rem 0.55rem",
            borderRadius: "6px",
            fontSize: "0.75rem",
            fontWeight: 800,
            display: "inline-flex",
            alignItems: "center",
            gap: "0.25rem",
            whiteSpace: "nowrap"
          }}
        >
          ⏱ Justificada
        </span>
      );
    }
    if (val === "Falta injustificada") {
      return (
        <span
          style={{
            background: "#fee2e2",
            color: "#b91c1c",
            padding: "0.25rem 0.55rem",
            borderRadius: "6px",
            fontSize: "0.75rem",
            fontWeight: 800,
            display: "inline-flex",
            alignItems: "center",
            gap: "0.25rem",
            whiteSpace: "nowrap"
          }}
        >
          ✕ Injustificada
        </span>
      );
    }
    return <span style={{ color: "#94a3b8" }}>—</span>;
  };

  return (
    <div className="animate-fade-in" style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      {/* =================================================================== */}
      {/* 📋 ENCABEZADO PRINCIPAL */}
      {/* =================================================================== */}
      <div
        className="glass-panel"
        style={{
          padding: "1.75rem",
          background:
            viewType === "notas"
              ? "linear-gradient(135deg, #ffffff 0%, #f0fdf4 100%)"
              : "linear-gradient(135deg, #ffffff 0%, #fffbeb 100%)",
          border: viewType === "notas" ? "1px solid #bbf7d0" : "1px solid #fde68a",
          borderRadius: "1.25rem",
          boxShadow:
            viewType === "notas"
              ? "0 8px 25px -5px rgba(22, 163, 74, 0.08)"
              : "0 8px 25px -5px rgba(217, 119, 6, 0.08)",
          display: "flex",
          flexDirection: "column",
          gap: "1.25rem"
        }}
      >
        {/* Fila 1: Botón Volver y Botones de Acción */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "0.75rem" }}>
          {!hideBackButton ? (
            <button
              onClick={onClose}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "0.5rem",
                background: "#ffffff",
                border: "1px solid #cbd5e1",
                color: "#334155",
                padding: "0.5rem 1rem",
                borderRadius: "0.65rem",
                fontSize: "0.85rem",
                fontWeight: 700,
                cursor: "pointer",
                boxShadow: "0 2px 5px rgba(0,0,0,0.04)",
                transition: "all 0.15s ease"
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "#f8fafc";
                e.currentTarget.style.transform = "translateX(-2px)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "#ffffff";
                e.currentTarget.style.transform = "translateX(0)";
              }}
            >
              <ArrowLeft size={16} />
              <span>Volver</span>
            </button>
          ) : (
            <div />
          )}

          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap" }}>
            {/* 💾 BOTÓN GUARDAR CAMBIOS */}
            {hasUnsavedChanges && (
              <button
                onClick={handleSaveAll}
                disabled={savingChanges}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "0.45rem",
                  background: "linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)",
                  border: "none",
                  color: "#ffffff",
                  padding: "0.55rem 1.15rem",
                  borderRadius: "0.65rem",
                  fontSize: "0.85rem",
                  fontWeight: 800,
                  cursor: savingChanges ? "not-allowed" : "pointer",
                  boxShadow: "0 4px 14px rgba(37, 99, 235, 0.35)",
                  animation: "pulse 2s infinite"
                }}
              >
                <Save size={16} />
                <span>{savingChanges ? "Guardando..." : "Guardar Cambios"}</span>
              </button>
            )}

            {/* 🌟 BOTÓN PARA CAMBIAR A LISTA DE ASISTENCIA / CUADRO DE NOTAS (Solo si no está forzado) */}
            {!forcedViewType && (
              viewType === "notas" ? (
                <button
                  onClick={() => setViewType("asistencia")}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "0.45rem",
                    background: "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)",
                    border: "none",
                    color: "#ffffff",
                    padding: "0.55rem 1.15rem",
                    borderRadius: "0.65rem",
                    fontSize: "0.85rem",
                    fontWeight: 800,
                    cursor: "pointer",
                    boxShadow: "0 4px 12px rgba(217, 119, 6, 0.25)",
                    transition: "all 0.15s ease"
                  }}
                >
                  <CalendarCheck size={16} />
                  <span>Ver Lista de Asistencia</span>
                </button>
              ) : (
                <button
                  onClick={() => setViewType("notas")}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "0.45rem",
                    background: "linear-gradient(135deg, #16a34a 0%, #15803d 100%)",
                    border: "none",
                    color: "#ffffff",
                    padding: "0.55rem 1.15rem",
                    borderRadius: "0.65rem",
                    fontSize: "0.85rem",
                    fontWeight: 800,
                    cursor: "pointer",
                    boxShadow: "0 4px 12px rgba(22, 163, 74, 0.25)",
                    transition: "all 0.15s ease"
                  }}
                >
                  <FileSpreadsheet size={16} />
                  <span>Ver Cuadro de Calificaciones</span>
                </button>
              )
            )}

            <button
              onClick={handleExportExcel}
              disabled={exporting}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "0.45rem",
                background: exporting ? "#f1f5f9" : "#ffffff",
                border: "1px solid #cbd5e1",
                color: exporting ? "#94a3b8" : "#334155",
                padding: "0.55rem 1rem",
                borderRadius: "0.65rem",
                fontSize: "0.85rem",
                fontWeight: 700,
                cursor: exporting ? "not-allowed" : "pointer",
                boxShadow: "0 2px 5px rgba(0,0,0,0.04)",
                transition: "all 0.15s ease"
              }}
            >
              <Download size={15} color={exporting ? "#94a3b8" : "#15803d"} />
              <span>{exporting ? "Generando Excel..." : "Exportar a Excel (.xlsx)"}</span>
            </button>
          </div>
        </div>

        {/* Fila 2: Título (solo si no está incrustado en el panel de sección) */}
        {!hideBackButton && (
          <div style={{ display: "flex", flexDirection: "column", gap: "0.45rem" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap" }}>
              <h1
                style={{
                  fontSize: "1.5rem",
                  fontWeight: 900,
                  color: "#0f172a",
                  margin: 0,
                  letterSpacing: "-0.02em"
                }}
              >
                {viewType === "notas" ? "Cuadro de Calificaciones" : "Lista de Asistencia"}
              </h1>

              <span
                style={{
                  background:
                    viewType === "notas"
                      ? "linear-gradient(135deg, #16a34a 0%, #15803d 100%)"
                      : "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)",
                  color: "#ffffff",
                  fontWeight: 900,
                  fontSize: "0.8rem",
                  padding: "0.2rem 0.65rem",
                  borderRadius: "9999px",
                  textTransform: "uppercase"
                }}
              >
                {carrera}
              </span>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "1rem", fontSize: "0.85rem", color: "#64748b" }}>
              <div>
                <strong>Doctor:</strong> {seccion?.doctor_encargado || "Dr. Rafael Perdomo Vaquero"}
              </div>
              <div style={{ width: "1px", height: "14px", background: "#cbd5e1" }} />
              <div>
                <strong>Instructor Titular:</strong> {seccion?.coordinador || "Sin asignar"}
              </div>
            </div>
          </div>
        )}

        {/* =================================================================== */}
        {/* 🎯 FILTRO ESPECIAL POR PARCIALES */}
        {/* =================================================================== */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: "0.75rem",
            paddingTop: "0.85rem",
            borderTop: "1px dashed #cbd5e1"
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <Layers size={16} color="#0f172a" />
            <span style={{ fontSize: "0.86rem", fontWeight: 800, color: "#0f172a" }}>
              Filtrar por Parcial ({carrera}):
            </span>
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.4rem",
              background: "#ffffff",
              padding: "0.3rem",
              borderRadius: "0.75rem",
              border: "1px solid #cbd5e1",
              boxShadow: "0 2px 6px rgba(0,0,0,0.03)",
              overflowX: "auto"
            }}
          >
            {dynamicParcialesConfig.map((parcial) => {
              const isSelected = selectedParcial === parcial.id;
              return (
                <button
                  key={parcial.id}
                  onClick={() => setSelectedParcial(parcial.id)}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "0.45rem",
                    padding: "0.4rem 0.85rem",
                    borderRadius: "0.55rem",
                    border: isSelected ? `1px solid ${parcial.borderActive}` : "1px solid transparent",
                    background: isSelected ? parcial.bgActive : "transparent",
                    color: isSelected ? parcial.color : "#475569",
                    fontWeight: isSelected ? 800 : 600,
                    fontSize: "0.82rem",
                    cursor: "pointer",
                    transition: "all 0.15s ease",
                    whiteSpace: "nowrap"
                  }}
                >
                  {isSelected && <Check size={14} style={{ strokeWidth: 3 }} />}
                  <span>{parcial.label}</span>
                  <span
                    style={{
                      fontSize: "0.7rem",
                      padding: "0.1rem 0.4rem",
                      borderRadius: "9999px",
                      background: isSelected ? parcial.color : "#f1f5f9",
                      color: isSelected ? "#ffffff" : "#64748b",
                      fontWeight: 700
                    }}
                  >
                    {parcial.badge}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* =================================================================== */}
      {/* 📊 CONTENEDOR DE LA TABLA */}
      {/* =================================================================== */}
      <div
        className="glass-panel"
        style={{
          background: "#ffffff",
          borderRadius: "1.25rem",
          border: "1px solid #e2e8f0",
          boxShadow: "0 10px 30px -5px rgba(0, 0, 0, 0.05)",
          padding: "1.5rem",
          display: "flex",
          flexDirection: "column",
          gap: "1.25rem"
        }}
      >
        {/* Barra de Filtros de Categorías y Buscador */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "1rem" }}>
          {viewType === "notas" ? (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.4rem",
                background: "#f1f5f9",
                padding: "0.25rem",
                borderRadius: "0.75rem",
                overflowX: "auto"
              }}
            >
              {[
                { id: "TODAS", label: "Todas las Columnas", icon: FileSpreadsheet },
                { id: "EXAMENES", label: `Exámenes (${currentParcialConfig.examenes.length})`, icon: Award },
                { id: "MANUALES", label: `Temas/Manuales (${currentParcialConfig.temas.length})`, icon: BookOpen },
                { id: "EXAMENCITOS", label: `Pruebas (${currentParcialConfig.semanas.length})`, icon: GraduationCap }
              ].map((cat) => {
                const Icon = cat.icon;
                const isSel = activeCategory === cat.id;
                return (
                  <button
                    key={cat.id}
                    onClick={() => setActiveCategory(cat.id)}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "0.4rem",
                      padding: "0.45rem 0.85rem",
                      borderRadius: "0.55rem",
                      border: "none",
                      fontSize: "0.82rem",
                      fontWeight: isSel ? 800 : 600,
                      cursor: "pointer",
                      background: isSel ? "#ffffff" : "transparent",
                      color: isSel ? "#15803d" : "#64748b",
                      boxShadow: isSel ? "0 2px 5px rgba(0,0,0,0.06)" : "none",
                      whiteSpace: "nowrap",
                      transition: "all 0.15s ease"
                    }}
                  >
                    <Icon size={14} />
                    <span>{cat.label}</span>
                  </button>
                );
              })}
            </div>
          ) : (
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <span
                style={{
                  background: currentParcialConfig.bgActive,
                  border: `1px solid ${currentParcialConfig.borderActive}`,
                  color: currentParcialConfig.color,
                  fontSize: "0.82rem",
                  fontWeight: 800,
                  padding: "0.4rem 0.85rem",
                  borderRadius: "9999px",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "0.35rem"
                }}
              >
                <CalendarCheck size={14} />
                {currentParcialConfig.label} ({currentParcialConfig.badge})
              </span>
            </div>
          )}

          {/* Buscador de Alumnos */}
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flex: 1, justifyContent: "flex-end", minWidth: "260px" }}>
            <div style={{ position: "relative", width: "100%", maxWidth: "320px" }}>
              <Search size={15} color="#94a3b8" style={{ position: "absolute", left: "0.85rem", top: "50%", transform: "translateY(-50%)" }} />
              <input
                type="text"
                placeholder={viewType === "notas" ? "Buscar alumno en el cuadro..." : "Buscar alumno en la lista..."}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={{
                  width: "100%",
                  padding: "0.55rem 0.85rem 0.55rem 2.2rem",
                  borderRadius: "0.6rem",
                  border: "1px solid #cbd5e1",
                  fontSize: "0.85rem",
                  outline: "none",
                  background: "#f8fafc"
                }}
              />
            </div>

            <button
              onClick={loadEstudiantes}
              disabled={loading}
              style={{
                background: "#ffffff",
                border: "1px solid #cbd5e1",
                borderRadius: "0.6rem",
                padding: "0.55rem 0.75rem",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                color: "#64748b"
              }}
              title="Recargar datos"
            >
              <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
            </button>
          </div>
        </div>

        {/* =================================================================== */}
        {/* 📑 TABLA: MODO CALIFICACIONES */}
        {/* =================================================================== */}
        {loading ? (
          <div style={{ padding: "4rem", textAlign: "center", color: "#64748b", fontSize: "0.95rem" }}>
            Cargando información académica...
          </div>
        ) : filteredEstudiantes.length === 0 ? (
          <div
            style={{
              padding: "4rem 2rem",
              textAlign: "center",
              background: "#f8fafc",
              border: "1.5px dashed #cbd5e1",
              borderRadius: "1rem",
              color: "#64748b"
            }}
          >
            <GraduationCap size={36} color="#16a34a" style={{ margin: "0 auto 0.75rem" }} />
            <strong style={{ fontSize: "1.1rem", color: "#0f172a", display: "block" }}>
              {searchTerm ? "No se encontraron estudiantes" : "No hay estudiantes registrados en esta sección"}
            </strong>
            <span style={{ fontSize: "0.85rem", marginTop: "0.3rem", display: "block" }}>
              {searchTerm ? "Prueba con otro número de cuenta o nombre" : "Matricula estudiantes primero para ver sus registros."}
            </span>
          </div>
        ) : viewType === "notas" ? (
          <div
            style={{
              overflowX: "auto",
              border: "1px solid #e2e8f0",
              borderRadius: "0.85rem",
              maxHeight: "680px",
              position: "relative"
            }}
          >
            <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: 0, textAlign: "left" }}>
              <thead>
                <tr style={{ background: "#f8fafc", position: "sticky", top: 0, zIndex: 10 }}>
                  <th
                    style={{
                      padding: "0.85rem 0.75rem",
                      fontSize: "0.76rem",
                      fontWeight: 800,
                      color: "#475569",
                      background: "#f1f5f9",
                      borderBottom: "2px solid #cbd5e1",
                      borderRight: "1px solid #e2e8f0",
                      width: "45px",
                      position: "sticky",
                      left: 0,
                      zIndex: 11
                    }}
                  >
                    #
                  </th>
                  <th
                    style={{
                      padding: "0.85rem 1rem",
                      fontSize: "0.76rem",
                      fontWeight: 800,
                      color: "#475569",
                      background: "#f1f5f9",
                      borderBottom: "2px solid #cbd5e1",
                      borderRight: "1px solid #e2e8f0",
                      minWidth: "120px",
                      position: "sticky",
                      left: "45px",
                      zIndex: 11
                    }}
                  >
                    No. Cuenta
                  </th>
                  <th
                    style={{
                      padding: "0.85rem 1rem",
                      fontSize: "0.76rem",
                      fontWeight: 800,
                      color: "#475569",
                      background: "#f1f5f9",
                      borderBottom: "2px solid #cbd5e1",
                      borderRight: "2px solid #cbd5e1",
                      minWidth: "240px",
                      position: "sticky",
                      left: "165px",
                      zIndex: 11
                    }}
                  >
                    Nombre Completo
                  </th>

                  {/* Columna Total */}
                  {(activeCategory === "TODAS" || activeCategory === "EXAMENES") && selectedParcial === "TODOS" && (
                    <th
                      style={{
                        padding: "0.75rem 0.25rem",
                        background: "#dcfce7",
                        borderBottom: "2px solid #86efac",
                        borderRight: "1px solid #86efac",
                        minWidth: "48px",
                        maxWidth: "54px",
                        width: "50px",
                        height: "175px",
                        verticalAlign: "middle",
                        textAlign: "center"
                      }}
                      title="Calificación Total Acumulada (Suma de Exámenes + Nota Oro Manuales + Nota Oro Pruebas)"
                    >
                      <div
                        style={{
                          writingMode: "vertical-rl",
                          transform: "rotate(180deg)",
                          fontSize: "0.75rem",
                          fontWeight: 900,
                          color: "#15803d",
                          margin: "0 auto",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          textAlign: "center",
                          height: "100%",
                          maxHeight: "165px"
                        }}
                      >
                        Total
                      </div>
                    </th>
                  )}

                  {/* 🥇 Columna: Nota Oro de Manuales */}
                  {(activeCategory === "TODAS" || activeCategory === "MANUALES") && (
                    <th
                      style={{
                        padding: "0.5rem 0.25rem",
                        background: "#eff6ff",
                        borderBottom: "2px solid #93c5fd",
                        borderRight: "1px solid #bfdbfe",
                        minWidth: "54px",
                        maxWidth: "62px",
                        width: "58px",
                        height: "175px",
                        verticalAlign: "middle",
                        textAlign: "center"
                      }}
                      title={`Nota Oro de Manuales (Ponderado: ${configPuntajes?.nota_total_manuales ?? "—"} pts oro)`}
                    >
                      <div
                        style={{
                          writingMode: "vertical-rl",
                          transform: "rotate(180deg)",
                          fontSize: "0.73rem",
                          fontWeight: 900,
                          color: "#1d4ed8",
                          margin: "0 auto",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          textAlign: "center",
                          height: "100%",
                          maxHeight: "165px"
                        }}
                      >
                        Nota Oro Manuales
                      </div>
                    </th>
                  )}

                  {/* 🥇 Columna: Nota Oro de Pruebas */}
                  {(activeCategory === "TODAS" || activeCategory === "EXAMENCITOS") && (
                    <th
                      style={{
                        padding: "0.5rem 0.25rem",
                        background: "#f0fdf4",
                        borderBottom: "2px solid #86efac",
                        borderRight: "2px solid #cbd5e1",
                        minWidth: "54px",
                        maxWidth: "62px",
                        width: "58px",
                        height: "175px",
                        verticalAlign: "middle",
                        textAlign: "center"
                      }}
                      title={`Nota Oro de Pruebas (Ponderado: ${configPuntajes?.nota_total_pruebas ?? "—"} pts oro)`}
                    >
                      <div
                        style={{
                          writingMode: "vertical-rl",
                          transform: "rotate(180deg)",
                          fontSize: "0.73rem",
                          fontWeight: 900,
                          color: "#15803d",
                          margin: "0 auto",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          textAlign: "center",
                          height: "100%",
                          maxHeight: "165px"
                        }}
                      >
                        Nota Oro Pruebas
                      </div>
                    </th>
                  )}

                  {/* Exámenes */}
                  {(activeCategory === "TODAS" || activeCategory === "EXAMENES") &&
                    currentParcialConfig.examenes.map((ex, idx) => (
                      <th
                        key={ex.key}
                        style={{
                          padding: "0.5rem 0.25rem",
                          background: "#f8fafc",
                          borderBottom: "2px solid #cbd5e1",
                          borderRight: idx === currentParcialConfig.examenes.length - 1 ? "2px solid #cbd5e1" : "1px solid #e2e8f0",
                          minWidth: "48px",
                          maxWidth: "54px",
                          width: "50px",
                          height: "175px",
                          verticalAlign: "middle",
                          textAlign: "center"
                        }}
                        title={ex.label}
                      >
                        <div
                          style={{
                            writingMode: "vertical-rl",
                            transform: "rotate(180deg)",
                            fontSize: "0.75rem",
                            fontWeight: 800,
                            color: "#1e293b",
                            margin: "0 auto",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            textAlign: "center",
                            height: "100%",
                            maxHeight: "165px"
                          }}
                        >
                          {ex.label}
                        </div>
                      </th>
                    ))}

                  {/* Temas / Manuales dinámicos de la carrera */}
                  {(activeCategory === "TODAS" || activeCategory === "MANUALES") &&
                    currentParcialConfig.temas.map((tema, idx) => {
                      const numPrefix = tema.numero_tema ? `#${tema.numero_tema} ` : "";
                      const displayTitle = `${numPrefix}Manual - ${tema.titulo}`;
                      return (
                        <th
                          key={tema.id || `tema_${idx}`}
                          style={{
                            padding: "0.4rem 0.2rem",
                            background: idx % 2 === 0 ? "#f0f9ff" : "#e0f2fe",
                            borderBottom: "2px solid #cbd5e1",
                            borderRight: "1px solid #e2e8f0",
                            minWidth: "50px",
                            maxWidth: "62px",
                            width: "56px",
                            height: "185px",
                            verticalAlign: "middle",
                            textAlign: "center"
                          }}
                          title={`Semana ${tema.semana}: ${displayTitle}`}
                        >
                          <div
                            style={{
                              writingMode: "vertical-rl",
                              transform: "rotate(180deg)",
                              fontSize: "0.72rem",
                              fontWeight: 700,
                              color: "#0369a1",
                              margin: "0 auto",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              textAlign: "center",
                              height: "100%",
                              maxHeight: "175px"
                            }}
                          >
                            {renderVerticalHeaderAutoWrap(displayTitle, 26)}
                          </div>
                        </th>
                      );
                    })}

                  {/* Examencitos según las semanas de la carrera (excluyendo semanas de examen) */}
                  {(activeCategory === "TODAS" || activeCategory === "EXAMENCITOS") &&
                    (currentParcialConfig.semanasPruebas || currentParcialConfig.semanas).map((sem) => {
                      const fullTitle = `Prueba - ${semanasTemasMap[sem] || `Semana ${sem}`}`;
                      return (
                        <th
                          key={`exam_${sem}`}
                          style={{
                            padding: "0.4rem 0.2rem",
                            background: "#faf5ff",
                            borderBottom: "2px solid #cbd5e1",
                            borderRight: "1px solid #e2e8f0",
                            minWidth: "52px",
                            maxWidth: "64px",
                            width: "58px",
                            height: "185px",
                            verticalAlign: "middle",
                            textAlign: "center"
                          }}
                          title={`Semana ${sem}: ${fullTitle}`}
                        >
                          <div
                            style={{
                              writingMode: "vertical-rl",
                              transform: "rotate(180deg)",
                              fontSize: "0.72rem",
                              fontWeight: 700,
                              color: "#7c3aed",
                              margin: "0 auto",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              textAlign: "center",
                              height: "100%",
                              maxHeight: "175px"
                            }}
                          >
                            {renderVerticalHeaderAutoWrap(fullTitle, 26)}
                          </div>
                        </th>
                      );
                    })}
                </tr>
              </thead>

              <tbody>
                {filteredEstudiantes.map((est, idx) => {
                  const isEven = idx % 2 === 0;
                  const rowBg = isEven ? "#ffffff" : "#f8fafc";
                  const derecho = getStudentDerechoStatus(est, selectedParcial, dynamicParcialesConfig);

                  return (
                    <tr
                      key={est.numero_cuenta}
                      style={{
                        background: derecho.perdioDerecho ? (isEven ? "#fff1f2" : "#ffe4e6") : rowBg,
                        borderBottom: "1px solid #e2e8f0",
                        transition: "background 0.15s ease"
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = derecho.perdioDerecho ? "#fecdd3" : "#f0fdf4";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = derecho.perdioDerecho ? (isEven ? "#fff1f2" : "#ffe4e6") : rowBg;
                      }}
                    >
                      {/* # */}
                      <td
                        style={{
                          padding: "0.6rem 0.5rem",
                          fontSize: "0.78rem",
                          color: "#64748b",
                          fontWeight: 700,
                          borderRight: "1px solid #e2e8f0",
                          background: derecho.perdioDerecho ? (isEven ? "#fff1f2" : "#ffe4e6") : isEven ? "#ffffff" : "#f8fafc",
                          position: "sticky",
                          left: 0,
                          zIndex: 5,
                          textAlign: "center"
                        }}
                      >
                        {idx + 1}
                      </td>

                      {/* No. Cuenta */}
                      <td
                        style={{
                          padding: "0.6rem 0.85rem",
                          fontSize: "0.85rem",
                          fontWeight: 800,
                          color: "#0f172a",
                          borderRight: "1px solid #e2e8f0",
                          background: derecho.perdioDerecho ? (isEven ? "#fff1f2" : "#ffe4e6") : isEven ? "#ffffff" : "#f8fafc",
                          position: "sticky",
                          left: "45px",
                          zIndex: 5
                        }}
                      >
                        {est.numero_cuenta}
                      </td>

                      {/* Nombre Completo */}
                      <td
                        style={{
                          padding: "0.6rem 0.85rem",
                          fontSize: "0.85rem",
                          fontWeight: 700,
                          color: "#334155",
                          borderRight: "2px solid #cbd5e1",
                          background: derecho.perdioDerecho ? (isEven ? "#fff1f2" : "#ffe4e6") : isEven ? "#ffffff" : "#fafcff",
                          position: "sticky",
                          left: "165px",
                          zIndex: 5,
                          whiteSpace: "nowrap"
                        }}
                      >
                        <div style={{ display: "flex", flexDirection: "column", gap: "0.15rem" }}>
                          <span>{est.nombre_completo}</span>
                          {derecho.perdioDerecho && (
                            <span
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "0.2rem",
                                background: "#fee2e2",
                                color: "#b91c1c",
                                border: "1px solid #fca5a5",
                                padding: "0.1rem 0.4rem",
                                borderRadius: "9999px",
                                fontSize: "0.68rem",
                                fontWeight: 800,
                                width: "fit-content"
                              }}
                              title={derecho.motivo}
                            >
                              <AlertOctagon size={11} color="#dc2626" />
                              <span>{derecho.badgeText}</span>
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Total */}
                      {(activeCategory === "TODAS" || activeCategory === "EXAMENES") && selectedParcial === "TODOS" && (
                        <td
                          style={{
                            padding: "0.5rem 0.2rem",
                            fontSize: "0.85rem",
                            fontWeight: 900,
                            color: Number(getStudentCalculatedTotal(est) || 0) >= 65 ? "#15803d" : "#dc2626",
                            background: isEven ? "#f0fdf4" : "#ecfdf5",
                            borderRight: "1px solid #86efac",
                            textAlign: "center",
                            width: "50px"
                          }}
                        >
                          {formatGradeValue(getStudentCalculatedTotal(est))}
                        </td>
                      )}

                      {/* 🥇 Nota Oro de Manuales */}
                      {(activeCategory === "TODAS" || activeCategory === "MANUALES") && (
                        <td
                          style={{
                            padding: "0.5rem 0.2rem",
                            fontSize: "0.84rem",
                            fontWeight: 800,
                            color: "#1d4ed8",
                            background: isEven ? "#eff6ff" : "#dbeafe",
                            borderRight: "1px solid #bfdbfe",
                            textAlign: "center",
                            width: "58px"
                          }}
                          title={`Nota Oro Manuales: ${calcularNotaOroManuales(est)} pts`}
                        >
                          {formatGradeValue(calcularNotaOroManuales(est))}
                        </td>
                      )}

                      {/* 🥇 Nota Oro de Pruebas */}
                      {(activeCategory === "TODAS" || activeCategory === "EXAMENCITOS") && (
                        <td
                          style={{
                            padding: "0.5rem 0.2rem",
                            fontSize: "0.84rem",
                            fontWeight: 800,
                            color: "#15803d",
                            background: isEven ? "#f0fdf4" : "#dcfce7",
                            borderRight: "2px solid #cbd5e1",
                            textAlign: "center",
                            width: "58px"
                          }}
                          title={`Nota Oro Pruebas: ${calcularNotaOroPruebas(est)} pts`}
                        >
                          {formatGradeValue(calcularNotaOroPruebas(est))}
                        </td>
                      )}

                      {/* Exámenes */}
                      {(activeCategory === "TODAS" || activeCategory === "EXAMENES") &&
                        currentParcialConfig.examenes.map((ex, exIdx) => {
                          const perdioEsteExamen =
                            (ex.parcialName && derecho.parcialesStatus?.[ex.parcialName]?.perdio) ||
                            (ex.parcialKey && derecho.parcialesStatus?.[ex.parcialKey]?.perdio) ||
                            (ex.parcialKey === "I" && derecho.perdioI) ||
                            (ex.parcialKey === "II" && derecho.perdioII) ||
                            (ex.parcialKey === "III" && derecho.perdioIII);

                          const gradeVal = getStudentGrade(
                            est,
                            ex.key,
                            getStudentGrade(est, ex.legacyKey, getStudentGrade(est, ex.altKey, 0))
                          );

                          return (
                            <td
                              key={ex.key}
                              style={{
                                padding: "0.5rem 0.2rem",
                                borderRight: exIdx === currentParcialConfig.examenes.length - 1 ? "2px solid #cbd5e1" : "1px solid #e2e8f0",
                                textAlign: "center",
                                width: "50px",
                                background: perdioEsteExamen ? "#fee2e2" : "transparent"
                              }}
                            >
                              {perdioEsteExamen ? (
                                <span style={{ color: "#dc2626", fontSize: "0.75rem", fontWeight: 800 }}>SDE</span>
                              ) : (
                                <span
                                  style={{
                                    fontSize: "0.82rem",
                                    fontWeight: 800,
                                    color: gradeVal > 0 ? "#1e293b" : "#94a3b8"
                                  }}
                                >
                                  {formatGradeValue(gradeVal)}
                                </span>
                              )}
                            </td>
                          );
                        })}

                      {/* Temas / Manuales dinámicos */}
                      {(activeCategory === "TODAS" || activeCategory === "MANUALES") &&
                        currentParcialConfig.temas.map((tema) => {
                          const key = `manual_${tema.id}`;
                          const gradeVal = getStudentGrade(
                            est,
                            key,
                            getStudentGrade(
                              est,
                              tema.id,
                              getStudentGrade(
                                est,
                                `Manual de ${tema.titulo}`,
                                !tema.id ? getStudentGrade(est, `manual_tema_${tema.numero_tema}`, 0) : 0
                              )
                            )
                          );

                          return (
                            <td
                              key={tema.id}
                              style={{
                                padding: "0.5rem 0.2rem",
                                borderRight: "1px solid #e2e8f0",
                                textAlign: "center",
                                width: "56px"
                              }}
                            >
                              <span
                                style={{
                                  fontSize: "0.82rem",
                                  fontWeight: 700,
                                  color: gradeVal > 0 ? "#0369a1" : "#94a3b8"
                                }}
                              >
                                {formatGradeValue(gradeVal)}
                              </span>
                            </td>
                          );
                        })}

                      {/* Pruebas semanales (excluyendo semanas de examen) */}
                      {(activeCategory === "TODAS" || activeCategory === "EXAMENCITOS") &&
                        (currentParcialConfig.semanasPruebas || currentParcialConfig.semanas).map((sem) => {
                          const key = `prueba_${sem}`;
                          const gradeVal = getStudentGrade(
                            est,
                            key,
                            getStudentGrade(
                              est,
                              `examencito_${sem}`,
                              getStudentGrade(est, `Prueba de la semana ${sem}`, getStudentGrade(est, `Examencito de la semana ${sem}`, 0))
                            )
                          );

                          return (
                            <td
                              key={`exam_${sem}`}
                              style={{
                                padding: "0.5rem 0.2rem",
                                borderRight: "1px solid #e2e8f0",
                                textAlign: "center",
                                width: "58px"
                              }}
                            >
                              <span
                                style={{
                                  fontSize: "0.82rem",
                                  fontWeight: 700,
                                  color: gradeVal > 0 ? "#7c3aed" : "#94a3b8"
                                }}
                              >
                                {formatGradeValue(gradeVal)}
                              </span>
                            </td>
                          );
                        })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          /* =================================================================== */
          /* 📋 TABLA: MODO LISTA DE ASISTENCIA */
          /* =================================================================== */
          <div
            style={{
              overflowX: "auto",
              border: "1px solid #e2e8f0",
              borderRadius: "0.85rem",
              maxHeight: "680px",
              position: "relative"
            }}
          >
            <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: 0, textAlign: "left" }}>
              <thead>
                <tr style={{ background: "#f8fafc", position: "sticky", top: 0, zIndex: 10 }}>
                  <th
                    style={{
                      padding: "0.85rem 0.75rem",
                      fontSize: "0.76rem",
                      fontWeight: 800,
                      color: "#475569",
                      background: "#f1f5f9",
                      borderBottom: "2px solid #cbd5e1",
                      borderRight: "1px solid #e2e8f0",
                      width: "45px",
                      position: "sticky",
                      left: 0,
                      zIndex: 11
                    }}
                  >
                    #
                  </th>
                  <th
                    style={{
                      padding: "0.85rem 1rem",
                      fontSize: "0.76rem",
                      fontWeight: 800,
                      color: "#475569",
                      background: "#f1f5f9",
                      borderBottom: "2px solid #cbd5e1",
                      borderRight: "1px solid #e2e8f0",
                      minWidth: "120px",
                      position: "sticky",
                      left: "45px",
                      zIndex: 11
                    }}
                  >
                    No. Cuenta
                  </th>
                  <th
                    style={{
                      padding: "0.85rem 1rem",
                      fontSize: "0.76rem",
                      fontWeight: 800,
                      color: "#475569",
                      background: "#f1f5f9",
                      borderBottom: "2px solid #cbd5e1",
                      borderRight: "2px solid #cbd5e1",
                      minWidth: "240px",
                      position: "sticky",
                      left: "165px",
                      zIndex: 11
                    }}
                  >
                    Nombre Completo
                  </th>

                  {/* Asistencias a Exámenes */}
                  {currentParcialConfig.asistenciasExamenes.map((ae, idx) => (
                    <th
                      key={ae.key}
                      style={{
                        padding: "0.5rem 0.25rem",
                        background: "#eff6ff",
                        borderBottom: "2px solid #cbd5e1",
                        borderRight: idx === currentParcialConfig.asistenciasExamenes.length - 1 ? "2px solid #cbd5e1" : "1px solid #e2e8f0",
                        minWidth: "60px",
                        maxWidth: "70px",
                        width: "65px",
                        height: "175px",
                        verticalAlign: "middle",
                        textAlign: "center"
                      }}
                      title={ae.label}
                    >
                      <div
                        style={{
                          writingMode: "vertical-rl",
                          transform: "rotate(180deg)",
                          fontSize: "0.74rem",
                          fontWeight: 800,
                          color: "#1d4ed8",
                          margin: "0 auto",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          textAlign: "center",
                          height: "100%",
                          maxHeight: "165px"
                        }}
                      >
                        {ae.shortLabel || ae.label}
                      </div>
                    </th>
                  ))}

                  {/* Semanas de Asistencia regulares (excluyendo semanas de examen porque ya tienen su casilla de Asistencia de Examen) */}
                  {(currentParcialConfig.semanasAsistencia || currentParcialConfig.semanas).map((sem) => {
                    const semObj = semanasConfig.find((s) => Number(s.numero_semana) === Number(sem));
                    const rawName = (semObj?.nombre_semana || semObj?.descripcion || "").trim();
                    const topicName = (semanasTemasMap[sem] || "").trim();

                    let fullTitle = `Semana ${sem}`;
                    if (topicName && topicName.toLowerCase() !== `semana ${sem}`.toLowerCase()) {
                      fullTitle = `Semana ${sem} - ${topicName}`;
                    } else if (rawName && rawName.toLowerCase() !== `semana ${sem}`.toLowerCase()) {
                      const cleanRaw = rawName.replace(/^Semana\s*\d+\s*[-:•]?\s*/i, "").trim();
                      if (cleanRaw && cleanRaw.toLowerCase() !== `semana ${sem}`.toLowerCase()) {
                        fullTitle = `Semana ${sem} - ${cleanRaw}`;
                      }
                    }

                    return (
                      <th
                        key={`asist_sem_${sem}`}
                        style={{
                          padding: "0.4rem 0.2rem",
                          background: sem % 2 === 0 ? "#f8fafc" : "#ffffff",
                          borderBottom: "2px solid #cbd5e1",
                          borderRight: "1px solid #e2e8f0",
                          minWidth: "55px",
                          maxWidth: "68px",
                          width: "60px",
                          height: "185px",
                          verticalAlign: "middle",
                          textAlign: "center"
                        }}
                        title={fullTitle}
                      >
                        <div
                          style={{
                            writingMode: "vertical-rl",
                            transform: "rotate(180deg)",
                            fontSize: "0.72rem",
                            fontWeight: 700,
                            color: "#334155",
                            margin: "0 auto",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            textAlign: "center",
                            height: "100%",
                            maxHeight: "175px"
                          }}
                        >
                          {renderVerticalHeaderAutoWrap(fullTitle, 26)}
                        </div>
                      </th>
                    );
                  })}
                </tr>
              </thead>

              <tbody>
                {filteredEstudiantes.map((est, idx) => {
                  const isEven = idx % 2 === 0;
                  const rowBg = isEven ? "#ffffff" : "#f8fafc";
                  const derecho = getStudentDerechoStatus(est, selectedParcial, dynamicParcialesConfig);

                  return (
                    <tr
                      key={est.numero_cuenta}
                      style={{
                        background: derecho.perdioDerecho ? (isEven ? "#fff1f2" : "#ffe4e6") : rowBg,
                        borderBottom: "1px solid #e2e8f0",
                        transition: "background 0.15s ease"
                      }}
                    >
                      <td
                        style={{
                          padding: "0.6rem 0.5rem",
                          fontSize: "0.78rem",
                          color: "#64748b",
                          fontWeight: 700,
                          borderRight: "1px solid #e2e8f0",
                          background: isEven ? "#ffffff" : "#f8fafc",
                          position: "sticky",
                          left: 0,
                          zIndex: 5,
                          textAlign: "center"
                        }}
                      >
                        {idx + 1}
                      </td>

                      <td
                        style={{
                          padding: "0.6rem 0.85rem",
                          fontSize: "0.85rem",
                          fontWeight: 800,
                          color: "#0f172a",
                          borderRight: "1px solid #e2e8f0",
                          background: isEven ? "#ffffff" : "#f8fafc",
                          position: "sticky",
                          left: "45px",
                          zIndex: 5
                        }}
                      >
                        {est.numero_cuenta}
                      </td>

                      <td
                        style={{
                          padding: "0.6rem 0.85rem",
                          fontSize: "0.85rem",
                          fontWeight: 700,
                          color: "#334155",
                          borderRight: "2px solid #cbd5e1",
                          background: isEven ? "#ffffff" : "#fafcff",
                          position: "sticky",
                          left: "165px",
                          zIndex: 5,
                          whiteSpace: "nowrap"
                        }}
                      >
                        <div style={{ display: "flex", flexDirection: "column", gap: "0.15rem" }}>
                          <span>{est.nombre_completo}</span>
                          {derecho.perdioDerecho && (
                            <span
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "0.2rem",
                                background: "#fee2e2",
                                color: "#b91c1c",
                                border: "1px solid #fca5a5",
                                padding: "0.1rem 0.4rem",
                                borderRadius: "9999px",
                                fontSize: "0.68rem",
                                fontWeight: 800,
                                width: "fit-content"
                              }}
                            >
                              <AlertOctagon size={11} color="#dc2626" />
                              <span>{derecho.badgeText}</span>
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Asistencias a Exámenes */}
                      {currentParcialConfig.asistenciasExamenes.map((ae, aeIdx) => {
                        const val =
                          getStudentAsistencia(est, ae.key) ||
                          getStudentAsistencia(est, ae.legacyKey) ||
                          getStudentAsistencia(est, `asistencia_${ae.semana}`) ||
                          getStudentAsistencia(est, `semana_${ae.semana}`) ||
                          getStudentAsistencia(est, `Asistencia de la semana ${ae.semana}`);
                        return (
                          <td
                            key={ae.key}
                            style={{
                              padding: "0.4rem 0.2rem",
                              borderRight: aeIdx === currentParcialConfig.asistenciasExamenes.length - 1 ? "2px solid #cbd5e1" : "1px solid #e2e8f0",
                              textAlign: "center",
                              width: "65px",
                              cursor: "default",
                              userSelect: "none"
                            }}
                            title={ae.label}
                          >
                            {getAsistenciaBadge(val)}
                          </td>
                        );
                      })}

                      {/* Asistencia Semanal regular (excluyendo semanas de examen) */}
                      {(currentParcialConfig.semanasAsistencia || currentParcialConfig.semanas).map((sem) => {
                        const key = `asistencia_${sem}`;
                        const val = getStudentAsistencia(est, key) || getStudentAsistencia(est, `Asistencia de la semana ${sem}`);
                        return (
                          <td
                            key={`asist_val_${sem}`}
                            style={{
                              padding: "0.4rem 0.2rem",
                              borderRight: "1px solid #e2e8f0",
                              textAlign: "center",
                              width: "60px",
                              cursor: "default",
                              userSelect: "none"
                            }}
                            title={`Semana ${sem}`}
                          >
                            {getAsistenciaBadge(val)}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
