import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  BookOpen,
  Search,
  Save,
  CheckCircle2,
  AlertCircle,
  Users,
  Calendar,
  Clock,
  GraduationCap,
  Sparkles,
  Layers,
  FileText,
  CheckSquare,
  HelpCircle,
  ArrowRight,
  Filter,
  RefreshCw,
  UserCheck,
  ShieldCheck,
  ChevronRight,
  Info,
  Check,
  XCircle,
  AlertOctagon,
  Crown
} from "lucide-react";
import { api } from "../services/api";

// Nombres oficiales de los 5 Roles de Sección
const ROLES = {
  CREAR_PRUEBA: "Crear prueba semanal",
  MANUALES: "Subir nota de manuales semanal",
  PRUEBAS: "Revisión de prueba semanal",
  EXAMENES: "Subir nota de examen parcial",
  ASISTENCIA: "Pasar lista de asistencia semanal"
};

const CARRERA_THEMES = {
  MEDICINA: { bg: "#eff6ff", border: "#bfdbfe", text: "#1d4ed8", badge: "#3b82f6" },
  ENFERMERIA: { bg: "#f0fdf4", border: "#bbf7d0", text: "#15803d", badge: "#22c55e" },
  ODONTOLOGIA: { bg: "#fdf4ff", border: "#f5d0fe", text: "#a21caf", badge: "#d946ef" },
  MICROBIOLOGIA: { bg: "#fff7ed", border: "#ffedd5", text: "#c2410c", badge: "#f97316" },
  NUTRICION: { bg: "#ecfeff", border: "#cffafe", text: "#0e7490", badge: "#06b6d4" },
  DEFAULT: { bg: "#f8fafc", border: "#e2e8f0", text: "#475569", badge: "#64748b" }
};

export default function SectionAssignmentsView({ seccion, hideBackButton, notify = () => {} }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // Datos académicos
  const [temario, setTemario] = useState([]);
  const [semanasConfig, setSemanasConfig] = useState([]);
  const [allInstructores, setAllInstructores] = useState([]);

  // Mapa de asignaciones: key = `${tipo_asignacion}__${referencia_id}` -> instructor_id
  const [assignmentsMap, setAssignmentsMap] = useState({});

  // Filtros de vista
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedParcialFilter, setSelectedParcialFilter] = useState("TODOS");

  const carrera = seccion?.carrera || "Medicina";

  // 1. Obtener los Miembros del Equipo Docente de la sección
  const sectionMembers = useMemo(() => {
    const list = [];
    const seenIds = new Set();

    // A. Coordinador de la sección
    if (seccion?.coordinador) {
      const coordName = seccion.coordinador.trim();
      const matchedCoord = allInstructores.find((inst) => {
        const pNom = (inst.primer_nombre || "").toLowerCase().trim();
        const pApe = (inst.primer_apellido || "").toLowerCase().trim();
        const fName = `${pNom} ${pApe}`.trim();
        const full = (inst.nombre_completo || "").toLowerCase().trim();
        const cLower = coordName.toLowerCase();
        return (pNom && pApe && cLower.includes(pNom) && cLower.includes(pApe)) || cLower === fName || cLower === full;
      });

      const coordId = matchedCoord ? matchedCoord.id : `coord-${seccion.id}`;
      seenIds.add(coordId);

      list.push({
        id: coordId,
        nombre: coordName,
        correo: matchedCoord?.correo || "",
        numero_cuenta: matchedCoord?.numero_cuenta || "",
        esCoordinador: true,
        rolLabel: "Coordinador"
      });
    }

    // B. Instructores Asignados a la sección
    const assignedIds = Array.isArray(seccion?.instructores_asignados) ? seccion.instructores_asignados : [];
    assignedIds.forEach((id) => {
      if (seenIds.has(id)) return;
      seenIds.add(id);

      const inst = allInstructores.find((i) => i.id === id);
      if (inst) {
        const nom = `${inst.primer_nombre || ''} ${inst.primer_apellido || ''}`.trim() || inst.nombre_completo || "Instructor";
        list.push({
          id: inst.id,
          nombre: nom,
          correo: inst.correo || "",
          numero_cuenta: inst.numero_cuenta || "",
          esCoordinador: false,
          rolLabel: "Instructor Asignado"
        });
      } else {
        list.push({
          id,
          nombre: `Instructor (${id.slice(0, 8)})`,
          correo: "",
          numero_cuenta: "",
          esCoordinador: false,
          rolLabel: "Instructor Asignado"
        });
      }
    });

    return list;
  }, [seccion, allInstructores]);

  // Cargar toda la información académica y asignaciones existentes
  const loadInitialData = useCallback(async () => {
    if (!seccion?.id) return;
    setLoading(true);

    try {
      const [resTemario, resSemanas, resInst, resAsig] = await Promise.all([
        api.temario.getAll({ carrera }).catch(() => ({ data: [] })),
        api.semanas.getConfig(carrera).catch(() => ({ data: [] })),
        api.auth.getInstructores().catch(() => ({ data: [] })),
        api.asignaciones.getBySeccion(seccion.id).catch(() => ({ data: [] }))
      ]);

      if (resTemario?.data) {
        setTemario(resTemario.data);
      }
      if (resSemanas?.data) {
        setSemanasConfig(resSemanas.data);
      }
      if (resInst?.data) {
        setAllInstructores(resInst.data);
      }

      // Procesar asignaciones existentes
      const asigList = resAsig?.data || (Array.isArray(resAsig) ? resAsig : []);
      const map = {};
      asigList.forEach((a) => {
        if (a.tipo_asignacion && a.referencia_id) {
          const key = `${a.tipo_asignacion}__${a.referencia_id}`;
          map[key] = a.instructor_id || "";
          if (a.tipo_asignacion === "Subir nota de prueba semanal") {
            map[`${ROLES.PRUEBAS}__${a.referencia_id}`] = a.instructor_id || "";
          }
        }
      });

      // 🛡️ REGLA: Subir nota de examen parcial ÚNICAMENTE y por defecto para el Coordinador de la sección
      const coordName = (seccion?.coordinador || "").trim();
      let coordId = `coord-${seccion.id}`;
      if (resInst?.data) {
        const matched = resInst.data.find((inst) => {
          const fName = (inst.nombre_completo || "").trim().toLowerCase();
          const full = `${inst.primer_nombre || ""} ${inst.primer_apellido || ""}`.trim().toLowerCase();
          const cLower = coordName.toLowerCase();
          return cLower && (cLower === fName || cLower === full || (inst.primer_nombre && inst.primer_apellido && cLower.includes(inst.primer_nombre.toLowerCase()) && cLower.includes(inst.primer_apellido.toLowerCase())));
        });
        if (matched) coordId = matched.id;
      }

      ["examen_I", "examen_II", "examen_III"].forEach((exId) => {
        map[`${ROLES.EXAMENES}__${exId}`] = coordId;
      });

      setAssignmentsMap(map);
      setHasUnsavedChanges(false);
    } catch (err) {
      console.error("Error al cargar datos de asignaciones:", err);
      notify("Error al cargar la información de asignaciones de la sección", "error");
    } finally {
      setLoading(false);
    }
  }, [seccion?.id, carrera, notify]);

  useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);

  // Helper para obtener el nombre visible de la semana
  const getWeekDisplayName = (w) => {
    if (!w) return "";
    const rawName = (w.nombre_semana || w.descripcion || "").trim();
    if (!rawName) return `Semana ${w.numero_semana}`;
    if (rawName.toLowerCase().startsWith("semana")) return rawName;
    return `Semana ${w.numero_semana}: ${rawName}`;
  };

  // 2. Extraer lista unificada y ordenada de Semanas
  const academicWeeks = useMemo(() => {
    const weekMap = new Map();

    // A. De configuracion_semanas
    semanasConfig.forEach((s) => {
      const num = Number(s.numero_semana);
      if (!num) return;
      const temasText = (s.temas || "").toUpperCase();
      const descText = (s.descripcion || "").toUpperCase();
      const isEx = temasText.includes("EXAMEN") || descText.includes("EXAMEN") || Boolean(s.es_examen);
      const rawNombre = s.nombre_semana || s.descripcion || (isEx ? `Semana ${num} - Examen` : `Semana ${num}`);

      weekMap.set(num, {
        numero_semana: num,
        nombre_semana: rawNombre,
        parcial: s.parcial || "I Parcial",
        temasDesc: s.temas || "",
        fecha_inicio: s.fecha_inicio,
        fecha_fin: s.fecha_fin,
        esExamen: isEx,
        descripcion: rawNombre
      });
    });

    // B. De temario
    temario.forEach((t) => {
      const num = Number(t.semana);
      if (!num) return;
      if (!weekMap.has(num)) {
        weekMap.set(num, {
          numero_semana: num,
          nombre_semana: `Semana ${num}`,
          parcial: num <= 4 ? "I Parcial" : num <= 8 ? "II Parcial" : "III Parcial",
          temasDesc: "",
          fecha_inicio: null,
          fecha_fin: null,
          esExamen: false,
          descripcion: `Semana ${num}`
        });
      }
    });

    return Array.from(weekMap.values()).sort((a, b) => a.numero_semana - b.numero_semana);
  }, [semanasConfig, temario]);

  // Helper para saber si una semana es de examen
  const isWeekExam = (week) => Boolean(week?.esExamen);

  // Helper para determinar el identificador del examen según el parcial de la semana
  const getExamIdForWeek = (week) => {
    const p = (week.parcial || "").toUpperCase();
    if (p.includes("III") || p.includes("TERCER")) return "examen_III";
    if (p.includes("II") || p.includes("SEGUNDO")) return "examen_II";
    return "examen_I";
  };

  // 3. Temas agrupados por semana
  const topicsByWeek = useMemo(() => {
    const map = {};
    temario.forEach((t) => {
      const sem = Number(t.semana) || 1;
      if (!map[sem]) map[sem] = [];
      map[sem].push(t);
    });

    Object.keys(map).forEach((sem) => {
      map[sem].sort((a, b) => (Number(a.numero_tema) || 0) - (Number(b.numero_tema) || 0));
    });

    return map;
  }, [temario]);

  // 4. Lista de Exámenes Parciales
  const partialExams = useMemo(() => {
    return [
      { id: "examen_I", label: "Examen I Parcial", parcial: "I Parcial", descripcion: "Evaluación teórica y práctica del Primer Parcial" },
      { id: "examen_II", label: "Examen II Parcial", parcial: "II Parcial", descripcion: "Evaluación teórica y práctica del Segundo Parcial" },
      { id: "examen_III", label: "Examen III Parcial", parcial: "III Parcial", descripcion: "Evaluación teórica y práctica del Tercer Parcial" }
    ];
  }, []);

  // Manejar cambio de asignación en memoria local
  const handleAssignmentChange = (tipo, referencia, instructorId) => {
    const key = `${tipo}__${referencia}`;
    setAssignmentsMap((prev) => ({
      ...prev,
      [key]: instructorId || ""
    }));
    setHasUnsavedChanges(true);
  };

  // Guardar todas las asignaciones en el backend (batch)
  const handleSaveAll = async () => {
    if (!seccion?.id) return;
    setSaving(true);

    try {
      const coordMember = sectionMembers.find((m) => m.esCoordinador) || sectionMembers[0];
      const coordId = coordMember?.id || `coord-${seccion.id}`;

      const payload = Object.entries(assignmentsMap).map(([key, instId]) => {
        const [tipo_asignacion, referencia_id] = key.split("__");
        let finalId = instId;
        let finalNombre = "";

        if (tipo_asignacion === ROLES.EXAMENES) {
          finalId = coordId;
          finalNombre = coordMember ? coordMember.nombre : (seccion?.coordinador || "Coordinador");
        } else {
          const member = sectionMembers.find((m) => m.id === instId);
          finalNombre = member ? member.nombre : "";
        }

        return {
          tipo_asignacion,
          referencia_id,
          instructor_id: finalId || null,
          instructor_nombre: finalNombre
        };
      });

      await api.asignaciones.saveBatch(seccion.id, payload);
      setHasUnsavedChanges(false);
      notify("¡Roles de sección y asignaciones guardados con éxito!", "success");
    } catch (err) {
      console.error("Error al guardar asignaciones:", err);
      notify("Error al guardar las asignaciones en el servidor", "error");
    } finally {
      setSaving(false);
    }
  };

  // Contador de carga de trabajo por cada miembro de la sección
  const workloadStats = useMemo(() => {
    const counts = {};
    sectionMembers.forEach((m) => {
      counts[m.id] = {
        manuales: 0,
        pruebas: 0,
        examenes: 0,
        asistencia: 0,
        total: 0
      };
    });

    Object.entries(assignmentsMap).forEach(([key, instId]) => {
      if (!instId || !counts[instId]) return;
      const [tipo] = key.split("__");

      if (tipo === ROLES.MANUALES) counts[instId].manuales++;
      else if (tipo === ROLES.PRUEBAS) counts[instId].pruebas++;
      else if (tipo === ROLES.EXAMENES) counts[instId].examenes++;
      else if (tipo === ROLES.ASISTENCIA) counts[instId].asistencia++;

      counts[instId].total++;
    });

    return counts;
  }, [sectionMembers, assignmentsMap]);

  // Filtrado de semanas según búsqueda y parcial
  const filteredWeeks = useMemo(() => {
    return academicWeeks.filter((w) => {
      // Filtro por Parcial
      if (selectedParcialFilter !== "TODOS") {
        if (!w.parcial.toLowerCase().includes(selectedParcialFilter.toLowerCase())) {
          return false;
        }
      }

      // Filtro por Búsqueda
      if (searchTerm.trim()) {
        const s = searchTerm.toLowerCase();
        const semStr = `semana ${w.numero_semana}`;
        const matchSem = semStr.includes(s) || String(w.numero_semana) === s;
        const matchParcial = w.parcial.toLowerCase().includes(s);

        const topics = topicsByWeek[w.numero_semana] || [];
        const matchTopics = topics.some((t) => (t.titulo || "").toLowerCase().includes(s));

        return matchSem || matchParcial || matchTopics;
      }

      return true;
    });
  }, [academicWeeks, selectedParcialFilter, searchTerm, topicsByWeek]);

  // Helper selector de instructor para cualquier rol
  const renderInstructorSelect = (tipo, referencia, currentId) => {
    // 🛡️ REGLA: Subir nota de examen parcial ÚNICAMENTE y por defecto asignado al Coordinador
    if (tipo === ROLES.EXAMENES) {
      const coordMember = sectionMembers.find((m) => m.esCoordinador) || sectionMembers[0];
      return (
        <div
          style={{
            width: "100%",
            padding: "0.45rem 0.65rem",
            borderRadius: "0.55rem",
            border: "1.5px solid #d8b4fe",
            background: "#f5f3ff",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "0.4rem"
          }}
          title="Regla del Laboratorio: La nota del examen parcial es asignada exclusivamente al Coordinador de la sección"
        >
          <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", minWidth: 0 }}>
            <Crown size={14} color="#7e22ce" style={{ flexShrink: 0 }} />
            <span style={{ fontSize: "0.82rem", color: "#581c87", fontWeight: 800, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {coordMember?.nombre || seccion?.coordinador || "Coordinador de Sección"}
            </span>
          </div>
          <span
            style={{
              fontSize: "0.68rem",
              fontWeight: 800,
              background: "#e9d5ff",
              color: "#6b21a8",
              padding: "0.15rem 0.45rem",
              borderRadius: "9999px",
              flexShrink: 0
            }}
          >
            Exclusivo Coordinador
          </span>
        </div>
      );
    }

    return (
      <select
        value={currentId || ""}
        onChange={(e) => handleAssignmentChange(tipo, referencia, e.target.value)}
        style={{
          width: "100%",
          padding: "0.45rem 0.65rem",
          borderRadius: "0.55rem",
          border: currentId ? "1.5px solid #93c5fd" : "1px dashed #cbd5e1",
          background: currentId ? "#ffffff" : "#f8fafc",
          fontSize: "0.82rem",
          color: currentId ? "#0f172a" : "#64748b",
          fontWeight: currentId ? 700 : 500,
          outline: "none",
          cursor: "pointer",
          transition: "all 0.15s ease"
        }}
      >
        <option value="">-- Sin asignar --</option>
        {sectionMembers.map((m) => (
          <option key={m.id} value={m.id}>
            {m.nombre} {m.esCoordinador ? "(Coordinador)" : "(Instructor)"}
          </option>
        ))}
      </select>
    );
  };

  const carTheme = CARRERA_THEMES[carrera.toUpperCase()] || CARRERA_THEMES.DEFAULT;

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
        <RefreshCw size={28} className="animate-spin" color="#3b82f6" />
        <span style={{ fontSize: "0.95rem", fontWeight: 700 }}>
          Cargando temario, semanas académicas y miembros de la sección...
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
      {/* 1. CABECERA PRINCIPAL DEL MÓDULO                                   */}
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
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: "1rem" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "0.65rem", flexWrap: "wrap", marginBottom: "0.35rem" }}>
              <h2 style={{ fontSize: "1.35rem", fontWeight: 900, color: "#0f172a", margin: 0, letterSpacing: "-0.01em" }}>
                Proporcionar Asignaciones
              </h2>

              <span
                style={{
                  background: carTheme.bg,
                  color: carTheme.text,
                  border: `1px solid ${carTheme.border}`,
                  padding: "0.2rem 0.65rem",
                  borderRadius: "9999px",
                  fontSize: "0.75rem",
                  fontWeight: 800,
                  textTransform: "uppercase"
                }}
              >
                {carrera}
              </span>

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
                <span>{sectionMembers.length} Miembros del Equipo</span>
              </span>
            </div>

            <p style={{ margin: 0, fontSize: "0.85rem", color: "#64748b", maxWidth: "720px", lineHeight: 1.45 }}>
              Define y distribuye los <strong>Roles de Sección</strong> entre el equipo docente de la sección.
            </p>
          </div>

          {/* Botón de Guardado */}
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
                  borderRadius: "9999px",
                  animation: "pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite"
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
                  : "linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)",
                color: "#ffffff",
                border: "none",
                padding: "0.6rem 1.25rem",
                borderRadius: "0.65rem",
                fontSize: "0.88rem",
                fontWeight: 800,
                cursor: saving ? "not-allowed" : "pointer",
                boxShadow: hasUnsavedChanges
                  ? "0 4px 14px rgba(16, 185, 129, 0.3)"
                  : "0 4px 12px rgba(37, 99, 235, 0.2)",
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
                  <span>Guardar Asignaciones</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* =================================================================== */}
        {/* RESUMEN DE MIEMBROS Y DISTRIBUCIÓN DE CARGA                         */}
        {/* =================================================================== */}
        <div
          style={{
            background: "#f8fafc",
            borderRadius: "0.85rem",
            border: "1px solid #e2e8f0",
            padding: "0.85rem 1rem",
            display: "flex",
            flexDirection: "column",
            gap: "0.6rem"
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "0.5rem" }}>
            <span style={{ fontSize: "0.76rem", fontWeight: 800, color: "#475569", textTransform: "uppercase", letterSpacing: "0.03em" }}>
              Equipo Docente Elegible para Asignaciones
            </span>
            <span style={{ fontSize: "0.72rem", color: "#64748b" }}>
              Distribución de funciones asignadas
            </span>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "0.75rem" }}>
            {sectionMembers.map((m) => {
              const stats = workloadStats[m.id] || { total: 0, manuales: 0, pruebas: 0, examenes: 0, asistencia: 0 };

              return (
                <div
                  key={m.id}
                  style={{
                    background: "#ffffff",
                    borderRadius: "0.65rem",
                    border: m.esCoordinador ? "1.5px solid #fed7aa" : "1px solid #cbd5e1",
                    padding: "0.65rem 0.85rem",
                    display: "flex",
                    flexDirection: "column",
                    gap: "0.35rem"
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.3rem" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.45rem", overflow: "hidden" }}>
                      <div
                        style={{
                          width: "24px",
                          height: "24px",
                          borderRadius: "50%",
                          background: m.esCoordinador ? "#f97316" : "#0284c7",
                          color: "#ffffff",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: "0.7rem",
                          fontWeight: 900,
                          flexShrink: 0
                        }}
                      >
                        {m.nombre.charAt(0)}
                      </div>
                      <span style={{ fontSize: "0.82rem", fontWeight: 800, color: "#0f172a", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {m.nombre}
                      </span>
                    </div>

                    <span
                      style={{
                        fontSize: "0.68rem",
                        fontWeight: 800,
                        padding: "0.15rem 0.45rem",
                        borderRadius: "9999px",
                        background: m.esCoordinador ? "#ffedd5" : "#e0f2fe",
                        color: m.esCoordinador ? "#c2410c" : "#0369a1",
                        flexShrink: 0
                      }}
                    >
                      {m.rolLabel}
                    </span>
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", flexWrap: "wrap", fontSize: "0.7rem", color: "#64748b" }}>
                    <span>Total: <strong style={{ color: "#0f172a" }}>{stats.total}</strong></span>
                    <span>•</span>
                    <span>Manuales: <strong>{stats.manuales}</strong></span>
                    <span>•</span>
                    <span>Pruebas: <strong>{stats.pruebas}</strong></span>
                    <span>•</span>
                    <span>Exámenes: <strong>{stats.examenes}</strong></span>
                    <span>•</span>
                    <span>Asist: <strong>{stats.asistencia}</strong></span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* =================================================================== */}
        {/* BARRA DE BÚSQUEDA Y FILTROS POR PARCIAL                             */}
        {/* =================================================================== */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "0.75rem", paddingTop: "0.25rem" }}>
          {/* Pills de Parcial */}
          <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", flexWrap: "wrap" }}>
            {["TODOS", "I Parcial", "II Parcial", "III Parcial"].map((p) => {
              const active = selectedParcialFilter === p;
              return (
                <button
                  key={p}
                  onClick={() => setSelectedParcialFilter(p)}
                  style={{
                    padding: "0.35rem 0.85rem",
                    borderRadius: "0.5rem",
                    border: active ? "1.5px solid #3b82f6" : "1px solid #cbd5e1",
                    background: active ? "#eff6ff" : "#ffffff",
                    color: active ? "#1d4ed8" : "#475569",
                    fontSize: "0.78rem",
                    fontWeight: active ? 800 : 600,
                    cursor: "pointer",
                    transition: "all 0.15s ease"
                  }}
                >
                  {p}
                </button>
              );
            })}
          </div>

          {/* Buscador */}
          <div style={{ position: "relative", width: "100%", maxWidth: "260px" }}>
            <Search size={14} color="#94a3b8" style={{ position: "absolute", left: "0.75rem", top: "50%", transform: "translateY(-50%)" }} />
            <input
              type="text"
              placeholder="Buscar semana o tema..."
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
      </div>

      {/* =================================================================== */}
      {/* 2. MATRIZ DINÁMICA DE ROLES POR SEMANA Y EXÁMENES                   */}
      {/* =================================================================== */}
      <div
        style={{
          background: "#ffffff",
          borderRadius: "1.1rem",
          border: "1px solid #e2e8f0",
          boxShadow: "0 4px 15px -3px rgba(0, 0, 0, 0.04)",
          padding: "1.5rem",
          display: "flex",
          flexDirection: "column",
          gap: "1.25rem"
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "0.5rem" }}>
          <div>
            <h3 style={{ fontSize: "1.05rem", fontWeight: 800, color: "#0f172a", margin: 0 }}>
              Roles Asignados por Semana ({filteredWeeks.length} Semanas)
            </h3>
            <span style={{ fontSize: "0.78rem", color: "#64748b" }}>
              En <strong>Semanas de Clase</strong> se asigna Manual, Prueba y Asistencia. En <strong>Semanas de Examen</strong> solo aplica Nota de Examen y Asistencia.
            </span>
          </div>

          <span style={{ fontSize: "0.74rem", color: "#64748b" }}>
            Mostrando: <strong>{filteredWeeks.length}</strong> de {academicWeeks.length} semanas
          </span>
        </div>

        {/* Listado de Semanas */}
        <div style={{ display: "flex", flexDirection: "column", gap: "1.1rem" }}>
          {filteredWeeks.length === 0 ? (
            <div
              style={{
                padding: "2.5rem",
                textAlign: "center",
                background: "#f8fafc",
                borderRadius: "0.85rem",
                border: "1.5px dashed #cbd5e1",
                color: "#64748b",
                fontSize: "0.85rem"
              }}
            >
              No se encontraron semanas académicas registradas para esta carrera.
            </div>
          ) : (
            filteredWeeks.map((week) => {
            const semRef = `semana_${week.numero_semana}`;
            const isExam = isWeekExam(week);
            const examId = getExamIdForWeek(week);

            const crearPruebaKey = `${ROLES.CREAR_PRUEBA}__${semRef}`;
            const manualKey = `${ROLES.MANUALES}__${semRef}`;
            const pruebaKey = `${ROLES.PRUEBAS}__${semRef}`;
            const examKey = `${ROLES.EXAMENES}__${examId}`;
            const asistKey = `${ROLES.ASISTENCIA}__${semRef}`;

            const curCrearPruebaId = assignmentsMap[crearPruebaKey] || "";
            const curManualId = assignmentsMap[manualKey] || "";
            const curPruebaId = assignmentsMap[pruebaKey] || assignmentsMap[`Subir nota de prueba semanal__${semRef}`] || "";
            const curExamId = assignmentsMap[examKey] || "";
            const curAsistId = assignmentsMap[asistKey] || "";

            const weekTopics = topicsByWeek[week.numero_semana] || [];

            return (
              <div
                key={week.numero_semana}
                style={{
                  borderRadius: "0.85rem",
                  border: isExam ? "1.5px solid #fde68a" : "1.5px solid #e2e8f0",
                  background: isExam ? "#fffdfa" : "#ffffff",
                  overflow: "hidden",
                  boxShadow: "0 2px 8px rgba(0, 0, 0, 0.02)",
                  transition: "all 0.15s ease"
                }}
              >
                {/* Cabecera de la Semana */}
                <div
                  style={{
                    background: isExam ? "#fffbeb" : "#f8fafc",
                    padding: "0.75rem 1.1rem",
                    borderBottom: isExam ? "1px solid #fde68a" : "1px solid #e2e8f0",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    flexWrap: "wrap",
                    gap: "0.75rem"
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", flexWrap: "wrap" }}>
                    <span
                      style={{
                        background: isExam ? "#d97706" : "#0284c7",
                        color: "#ffffff",
                        fontWeight: 900,
                        fontSize: "0.78rem",
                        padding: "0.25rem 0.65rem",
                        borderRadius: "0.45rem"
                      }}
                    >
                      Semana {week.numero_semana}
                    </span>

                    <span
                      style={{
                        background: isExam ? "#fef3c7" : "#e0f2fe",
                        color: isExam ? "#b45309" : "#0369a1",
                        fontSize: "0.72rem",
                        fontWeight: 800,
                        padding: "0.2rem 0.5rem",
                        borderRadius: "9999px"
                      }}
                    >
                      {getWeekDisplayName(week)}
                    </span>

                    {isExam && (
                      <span
                        style={{
                          background: "#fef3c7",
                          border: "1px solid #fcd34d",
                          color: "#92400e",
                          fontSize: "0.72rem",
                          fontWeight: 800,
                          padding: "0.15rem 0.55rem",
                          borderRadius: "9999px",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "0.25rem"
                        }}
                      >
                        <GraduationCap size={12} color="#b45309" />
                        <span>Semana de Examen</span>
                      </span>
                    )}

                    {week.fecha_inicio && week.fecha_fin && (
                      <span style={{ fontSize: "0.72rem", color: "#64748b", display: "inline-flex", alignItems: "center", gap: "0.25rem" }}>
                        <Calendar size={11} />
                        <span>{week.fecha_inicio} al {week.fecha_fin}</span>
                      </span>
                    )}
                  </div>
                </div>

                {/* Contenido de la Semana */}
                {isExam ? (
                  /* ========================================================= */
                  /* CASO A: SEMANA DE EXAMEN (SOLO EXAMEN Y ASISTENCIA)       */
                  /* ========================================================= */
                  <div
                    style={{
                      padding: "1rem 1.1rem",
                      display: "grid",
                      gridTemplateColumns: "1.1fr 2.9fr",
                      gap: "1.25rem",
                      alignItems: "center"
                    }}
                  >
                    {/* Columna Izquierda: Tarjeta de Semana de Examen */}
                    <div
                      style={{
                        background: "#fffbeb",
                        borderRadius: "0.65rem",
                        border: "1px solid #fde68a",
                        padding: "0.85rem 1rem",
                        display: "flex",
                        flexDirection: "column",
                        gap: "0.3rem"
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", color: "#b45309", fontWeight: 800, fontSize: "0.82rem" }}>
                        <GraduationCap size={16} color="#d97706" />
                        <span>Semana de Evaluación</span>
                      </div>
                      <span style={{ fontSize: "0.75rem", color: "#92400e", fontWeight: 600 }}>
                        {week.parcial}
                      </span>
                    </div>

                    {/* Columna Derecha: EXACTAMENTE 2 ROLES (Examen Parcial + Asistencia) */}
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                      {/* ROL: Subir nota de examen parcial */}
                      <div
                        style={{
                          background: curExamId ? "#faf5ff" : "#ffffff",
                          border: curExamId ? "1.5px solid #d8b4fe" : "1.5px dashed #cbd5e1",
                          borderRadius: "0.65rem",
                          padding: "0.85rem",
                          display: "flex",
                          flexDirection: "column",
                          gap: "0.5rem",
                          boxShadow: "0 2px 5px rgba(0,0,0,0.02)"
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.3rem" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                            <div style={{ width: "9px", height: "9px", borderRadius: "50%", background: "#9333ea" }} />
                            <span style={{ fontSize: "0.8rem", fontWeight: 900, color: "#581c87" }}>
                              {ROLES.EXAMENES}
                            </span>
                          </div>
                          <span style={{ fontSize: "0.68rem", fontWeight: 800, background: "#f3e8ff", color: "#7e22ce", padding: "0.15rem 0.45rem", borderRadius: "9999px" }}>
                            {week.parcial}
                          </span>
                        </div>

                        <span style={{ fontSize: "0.7rem", color: "#64748b" }}>
                          Docente encargado de calificar y subir las notas de este examen
                        </span>

                        {renderInstructorSelect(ROLES.EXAMENES, examId, curExamId)}
                      </div>

                      {/* ROL: Pasar lista de asistencia semanal */}
                      <div
                        style={{
                          background: curAsistId ? "#fdf4ff" : "#ffffff",
                          border: curAsistId ? "1.5px solid #f0abfc" : "1.5px dashed #cbd5e1",
                          borderRadius: "0.65rem",
                          padding: "0.85rem",
                          display: "flex",
                          flexDirection: "column",
                          gap: "0.5rem",
                          boxShadow: "0 2px 5px rgba(0,0,0,0.02)"
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.3rem" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                            <div style={{ width: "9px", height: "9px", borderRadius: "50%", background: "#c026d3" }} />
                            <span style={{ fontSize: "0.8rem", fontWeight: 900, color: "#701a75" }}>
                              {ROLES.ASISTENCIA}
                            </span>
                          </div>
                          <span style={{ fontSize: "0.68rem", fontWeight: 800, background: "#fae8ff", color: "#a21caf", padding: "0.15rem 0.45rem", borderRadius: "9999px" }}>
                            Día de Examen
                          </span>
                        </div>

                        <span style={{ fontSize: "0.7rem", color: "#64748b" }}>
                          Docente encargado de tomar asistencia a los estudiantes en el examen
                        </span>

                        {renderInstructorSelect(ROLES.ASISTENCIA, semRef, curAsistId)}
                      </div>
                    </div>
                  </div>
                ) : (
                  /* ========================================================= */
                  /* CASO B: SEMANA DE CLASE REGULAR (MANUALES, PRUEBA, ASIST)  */
                  /* ========================================================= */
                  <div
                    style={{
                      padding: "1rem 1.1rem",
                      display: "grid",
                      gridTemplateColumns: "1.1fr 2.9fr",
                      gap: "1.25rem"
                    }}
                  >
                    {/* Columna Izquierda: Temas / Manuales de la semana */}
                    <div
                      style={{
                        background: "#f8fafc",
                        borderRadius: "0.65rem",
                        border: "1px solid #e2e8f0",
                        padding: "0.75rem 0.9rem",
                        display: "flex",
                        flexDirection: "column",
                        gap: "0.5rem"
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: "0.35rem", fontSize: "0.72rem", fontWeight: 800, color: "#475569", textTransform: "uppercase" }}>
                        <BookOpen size={13} color="#0284c7" />
                        <span>Temas / Manuales ({weekTopics.length})</span>
                      </div>

                      {weekTopics.length > 0 ? (
                        <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem" }}>
                          {weekTopics.map((t) => (
                            <div
                              key={t.id}
                              style={{
                                background: "#ffffff",
                                border: "1px solid #cbd5e1",
                                borderRadius: "0.45rem",
                                padding: "0.35rem 0.55rem",
                                fontSize: "0.75rem",
                                color: "#1e293b",
                                display: "flex",
                                alignItems: "center",
                                gap: "0.4rem"
                              }}
                            >
                              <span style={{ fontWeight: 800, color: "#0284c7" }}>#{t.numero_tema}</span>
                              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.titulo}</span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <span style={{ fontSize: "0.75rem", color: "#94a3b8", fontStyle: "italic" }}>
                          {week.temasDesc ? `Detalle: ${week.temasDesc}` : "Sin temas específicos registrados en el temario."}
                        </span>
                      )}

                      <span style={{ fontSize: "0.68rem", color: "#64748b", marginTop: "auto", lineHeight: 1.3 }}>
                        💡 Quien reciba el rol de manuales calificará todos los temas listados arriba.
                      </span>
                    </div>

                    {/* Columna Derecha: 4 Roles de Clase Regular */}
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "0.85rem" }}>
                      {/* ROL 1: Pasar lista de asistencia semanal */}
                      <div
                        style={{
                          background: curAsistId ? "#fdf4ff" : "#ffffff",
                          border: curAsistId ? "1.5px solid #f0abfc" : "1px solid #e2e8f0",
                          borderRadius: "0.65rem",
                          padding: "0.75rem",
                          display: "flex",
                          flexDirection: "column",
                          gap: "0.45rem",
                          transition: "all 0.15s ease"
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: "0.35rem" }}>
                          <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#c026d3" }} />
                          <span style={{ fontSize: "0.76rem", fontWeight: 800, color: "#701a75", lineHeight: 1.2 }}>
                            {ROLES.ASISTENCIA}
                          </span>
                        </div>
                        <span style={{ fontSize: "0.68rem", color: "#64748b" }}>
                          Pase de lista semanal
                        </span>
                        {renderInstructorSelect(ROLES.ASISTENCIA, semRef, curAsistId)}
                      </div>

                      {/* ROL 2: Crear prueba semanal */}
                      <div
                        style={{
                          background: curCrearPruebaId ? "#f0f9ff" : "#ffffff",
                          border: curCrearPruebaId ? "1.5px solid #7dd3fc" : "1px solid #e2e8f0",
                          borderRadius: "0.65rem",
                          padding: "0.75rem",
                          display: "flex",
                          flexDirection: "column",
                          gap: "0.45rem",
                          transition: "all 0.15s ease"
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: "0.35rem" }}>
                          <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#0284c7" }} />
                          <span style={{ fontSize: "0.76rem", fontWeight: 800, color: "#0369a1", lineHeight: 1.2 }}>
                            {ROLES.CREAR_PRUEBA}
                          </span>
                        </div>
                        <span style={{ fontSize: "0.68rem", color: "#64748b" }}>
                          Diseño de reactivos y prueba
                        </span>
                        {renderInstructorSelect(ROLES.CREAR_PRUEBA, semRef, curCrearPruebaId)}
                      </div>

                      {/* ROL 3: Revisión de prueba semanal */}
                      <div
                        style={{
                          background: curPruebaId ? "#f0fdf4" : "#ffffff",
                          border: curPruebaId ? "1.5px solid #86efac" : "1px solid #e2e8f0",
                          borderRadius: "0.65rem",
                          padding: "0.75rem",
                          display: "flex",
                          flexDirection: "column",
                          gap: "0.45rem",
                          transition: "all 0.15s ease"
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: "0.35rem" }}>
                          <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#16a34a" }} />
                          <span style={{ fontSize: "0.76rem", fontWeight: 800, color: "#14532d", lineHeight: 1.2 }}>
                            {ROLES.PRUEBAS}
                          </span>
                        </div>
                        <span style={{ fontSize: "0.68rem", color: "#64748b" }}>
                          Revisión y retroalimentación semanal
                        </span>
                        {renderInstructorSelect(ROLES.PRUEBAS, semRef, curPruebaId)}
                      </div>

                      {/* ROL 4: Subir nota de manuales semanal */}
                      <div
                        style={{
                          background: curManualId ? "#eff6ff" : "#ffffff",
                          border: curManualId ? "1.5px solid #93c5fd" : "1px solid #e2e8f0",
                          borderRadius: "0.65rem",
                          padding: "0.75rem",
                          display: "flex",
                          flexDirection: "column",
                          gap: "0.45rem",
                          transition: "all 0.15s ease"
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: "0.35rem" }}>
                          <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#2563eb" }} />
                          <span style={{ fontSize: "0.76rem", fontWeight: 800, color: "#1e3a8a", lineHeight: 1.2 }}>
                            {ROLES.MANUALES}
                          </span>
                        </div>
                        <span style={{ fontSize: "0.68rem", color: "#64748b" }}>
                          {weekTopics.length} {weekTopics.length === 1 ? "manual a evaluar" : "manuales a evaluar"}
                        </span>
                        {renderInstructorSelect(ROLES.MANUALES, semRef, curManualId)}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          }))}
        </div>

        {/* Botón inferior para guardar cambios */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: "0.75rem", paddingTop: "0.5rem" }}>
          <button
            onClick={handleSaveAll}
            disabled={saving}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "0.5rem",
              background: hasUnsavedChanges
                ? "linear-gradient(135deg, #10b981 0%, #059669 100%)"
                : "linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)",
              color: "#ffffff",
              border: "none",
              padding: "0.65rem 1.5rem",
              borderRadius: "0.65rem",
              fontSize: "0.88rem",
              fontWeight: 800,
              cursor: saving ? "not-allowed" : "pointer",
              boxShadow: "0 4px 12px rgba(37, 99, 235, 0.2)",
              opacity: saving ? 0.7 : 1,
              transition: "all 0.2s ease"
            }}
          >
            {saving ? (
              <>
                <RefreshCw size={15} className="animate-spin" />
                <span>Guardando cambios...</span>
              </>
            ) : (
              <>
                <Save size={15} />
                <span>Guardar Asignaciones de la Sección</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
