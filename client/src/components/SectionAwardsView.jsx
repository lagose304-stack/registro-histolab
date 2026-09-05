import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  Trophy,
  Award,
  Crown,
  Star,
  ArrowLeft,
  Download,
  RefreshCw,
  Search,
  Sparkles,
  Filter,
  CheckCircle2,
  BookOpen,
  FileText,
  TrendingUp,
  Info,
  Medal,
  ChevronDown,
  ChevronUp
} from "lucide-react";
import { api } from "../services/api";
import {
  getRegularWeeks,
  getExamWeeks,
  getCanonicalManualGrade,
  getCanonicalExamGrade,
  getCanonicalQuizGrade,
  getManualDisplayName
} from "../utils/academicEngine";

export default function SectionAwardsView({ seccion, currentInstructor, hideBackButton = false, onClose, notify }) {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [estudiantes, setEstudiantes] = useState([]);
  const [semanasConfig, setSemanasConfig] = useState([]);
  const [temario, setTemario] = useState([]);
  const [configPuntajes, setConfigPuntajes] = useState({});
  const [allEntregas, setAllEntregas] = useState([]);
  
  // Filtros
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState("todos"); // 'todos', 'top3', 'con_bonus'
  const [showDetailColumns, setShowDetailColumns] = useState(true);

  const carrera = seccion?.carrera || "Medicina";

  // Cargar toda la información académica y entregas de la sección
  const loadData = useCallback(async (isRefresh = false) => {
    if (!seccion?.id) return;
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const [resEst, resSemanas, resTemas, resPuntajes, resEntregas] = await Promise.all([
        api.estudiantes?.getBySeccion
          ? api.estudiantes.getBySeccion(seccion.id, carrera).catch((err) => {
              console.warn("Aviso al cargar estudiantes:", err);
              return { data: [] };
            })
          : Promise.resolve({ data: [] }),
        api.semanas?.getConfig
          ? api.semanas.getConfig(carrera).catch((err) => {
              console.warn("Aviso al cargar semanas:", err);
              return { data: [] };
            })
          : Promise.resolve({ data: [] }),
        api.temario?.getAll
          ? api.temario.getAll({ carrera }).catch((err) => {
              console.warn("Aviso al cargar temario:", err);
              return { data: [] };
            })
          : Promise.resolve({ data: [] }),
        api.temario?.getPuntajes
          ? api.temario.getPuntajes(carrera).catch((err) => {
              console.warn("Aviso al cargar puntajes:", err);
              return { data: null };
            })
          : Promise.resolve({ data: null }),
        api.pruebas?.getAllEntregas
          ? api.pruebas.getAllEntregas(seccion.id).catch((err) => {
              console.warn("Aviso al cargar entregas:", err);
              return { data: [] };
            })
          : Promise.resolve({ data: [] })
      ]);

      setEstudiantes(Array.isArray(resEst?.data) ? resEst.data : []);

      if (resSemanas?.data && Array.isArray(resSemanas.data)) {
        const sortedSemanas = [...resSemanas.data].sort(
          (a, b) => Number(a.numero_semana) - Number(b.numero_semana)
        );
        setSemanasConfig(sortedSemanas);
      } else {
        setSemanasConfig([]);
      }

      if (resTemas?.data && Array.isArray(resTemas.data)) {
        const sortedTemas = [...resTemas.data].sort((a, b) => {
          const semA = Number(a.semana) || 999;
          const semB = Number(b.semana) || 999;
          if (semA !== semB) return semA - semB;
          return (Number(a.numero_tema) || 999) - (Number(b.numero_tema) || 999);
        });
        setTemario(sortedTemas);
      } else {
        setTemario([]);
      }

      setConfigPuntajes(resPuntajes?.data || {});
      setAllEntregas(Array.isArray(resEntregas?.data) ? resEntregas.data : []);
    } catch (err) {
      console.error("Error al cargar datos para Premios de la Sección:", err);
      if (notify) notify("Error al cargar los datos de calificaciones para premios.", "error");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [seccion?.id, carrera, notify]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Semanas regulares de pruebas (excluyendo exámenes)
  const regularWeeks = useMemo(() => {
    return getRegularWeeks(semanasConfig, temario);
  }, [semanasConfig, temario]);

  // Semanas de examen parcial
  const examWeeks = useMemo(() => {
    return getExamWeeks(semanasConfig);
  }, [semanasConfig]);

  // Temas evaluables con manual (1.0 pt cada uno)
  const evaluableTopics = useMemo(() => {
    return (temario || []).filter((t) => t.tiene_manual !== false);
  }, [temario]);

  // Diccionario rápido de entregas: clave `${numero_cuenta}___sem_${semana}`
  const entregasMap = useMemo(() => {
    const map = {};
    (allEntregas || []).forEach((ent) => {
      const cuenta = String(ent.numero_cuenta || "").trim();
      const sem = Number(ent.numero_semana);
      if (cuenta && sem) {
        map[`${cuenta}___sem_${sem}`] = ent;
      }
    });
    return map;
  }, [allEntregas]);

  // Cálculo del Ranking Paralelo de Premios
  // Fórmula estricta:
  // Gran Total Premios = sum(Pruebas con Bonus hasta 6 pts) + sum(Manuales 1 pt c/u) + sum(Exámenes Parciales)
  const studentsRanking = useMemo(() => {
    if (!estudiantes || estudiantes.length === 0) return [];

    const computedList = estudiantes.map((st) => {
      const cuenta = String(st.numero_cuenta || "").trim();
      const notas = st.notas || {};

      // 1. Pruebas Semanales (con Bonus)
      let totalPruebasBonus = 0;
      let totalPruebasOficial = 0;
      const pruebasDesglose = [];

      regularWeeks.forEach((rw) => {
        const semNum = Number(rw.numero_semana);
        const entrega = entregasMap[`${cuenta}___sem_${semNum}`];

        let notaReal = null;
        let notaOficial = null;

        if (entrega) {
          // Extraer nota real que incluye bonus
          if (entrega.nota_real !== null && entrega.nota_real !== undefined && !isNaN(Number(entrega.nota_real))) {
            notaReal = Number(entrega.nota_real);
          } else if (entrega.nota_con_bonus !== null && entrega.nota_con_bonus !== undefined && !isNaN(Number(entrega.nota_con_bonus))) {
            notaReal = Number(entrega.nota_con_bonus);
          } else if (entrega.auditoria?.nota_real !== null && entrega.auditoria?.nota_real !== undefined && !isNaN(Number(entrega.auditoria.nota_real))) {
            notaReal = Number(entrega.auditoria.nota_real);
          }

          if (entrega.nota_obtenida !== null && entrega.nota_obtenida !== undefined && !isNaN(Number(entrega.nota_obtenida))) {
            notaOficial = Number(entrega.nota_obtenida);
          }
        }

        // Si no hay entrega online, buscar en notas del estudiante
        if (notaReal === null) {
          const keyReal = `prueba_${semNum}_real`;
          if (notas[keyReal] !== undefined && notas[keyReal] !== null && !isNaN(Number(notas[keyReal]))) {
            notaReal = Number(notas[keyReal]);
          } else if (st[keyReal] !== undefined && st[keyReal] !== null && !isNaN(Number(st[keyReal]))) {
            notaReal = Number(st[keyReal]);
          }
        }

        if (notaOficial === null) {
          const canOficial = getCanonicalQuizGrade(notas, semNum, st);
          if (canOficial !== null) notaOficial = canOficial;
        }

        // Si tenemos notaOficial pero no notaReal, notaReal = notaOficial
        if (notaReal === null && notaOficial !== null) {
          notaReal = notaOficial;
        }

        const cleanReal = notaReal !== null ? Math.round(Number(notaReal) * 1000) / 1000 : 0;
        const cleanOficial = notaOficial !== null ? Math.min(5.0, Math.round(Number(notaOficial) * 1000) / 1000) : 0;

        totalPruebasBonus += cleanReal;
        totalPruebasOficial += cleanOficial;

        pruebasDesglose.push({
          semana: semNum,
          nombre: rw.nombre_semana || `Semana ${semNum}`,
          notaReal: notaReal !== null ? cleanReal : null,
          notaOficial: notaOficial !== null ? cleanOficial : null,
          tieneBonus: cleanReal > 5.0
        });
      });

      totalPruebasBonus = Math.round(totalPruebasBonus * 1000) / 1000;
      totalPruebasOficial = Math.round(totalPruebasOficial * 1000) / 1000;
      const bonusExtraTotal = Math.max(0, Math.round((totalPruebasBonus - totalPruebasOficial) * 1000) / 1000);

      // 2. Manuales de Laboratorio (Individuales, suma directa sobre 1.0 pt cada uno)
      let totalManuales = 0;
      const manualesDesglose = [];

      evaluableTopics.forEach((t) => {
        const grade = getCanonicalManualGrade(notas, t, st);
        const cleanGrade = grade !== null ? Math.round(Number(grade) * 1000) / 1000 : 0;
        totalManuales += cleanGrade;
        manualesDesglose.push({
          temaId: t.id,
          titulo: t.titulo,
          numero: t.numero_tema,
          nota: grade !== null ? cleanGrade : null
        });
      });

      totalManuales = Math.round(totalManuales * 1000) / 1000;

      // 3. Exámenes Parciales (Suma directa)
      let totalExamenes = 0;
      const examenesDesglose = [];

      examWeeks.forEach((ew, idx) => {
        const grade = getCanonicalExamGrade(st, idx, ew, notas);
        const cleanGrade = grade !== null ? Math.round(Number(grade) * 1000) / 1000 : 0;
        totalExamenes += cleanGrade;
        examenesDesglose.push({
          semana: ew.numero_semana,
          parcial: ew.parcial || `Parcial ${idx + 1}`,
          nota: grade !== null ? cleanGrade : null
        });
      });

      // Fallback si no hay examWeeks configuradas: leer directamente primer/segundo/tercer examen
      if (examWeeks.length === 0) {
        [0, 1, 2].forEach((idx) => {
          const grade = getCanonicalExamGrade(st, idx, null, notas);
          if (grade !== null) {
            const cleanGrade = Math.round(Number(grade) * 1000) / 1000;
            totalExamenes += cleanGrade;
            examenesDesglose.push({
              semana: idx + 1,
              parcial: idx === 0 ? "I Parcial" : idx === 1 ? "II Parcial" : "III Parcial",
              nota: cleanGrade
            });
          }
        });
      }

      totalExamenes = Math.round(totalExamenes * 1000) / 1000;

      // GRAN TOTAL PREMIOS (Sin pasar a puntos oro)
      const grandTotalPremios = Math.round((totalPruebasBonus + totalManuales + totalExamenes) * 1000) / 1000;

      return {
        ...st,
        cuenta,
        nombre: st.nombre_completo || `${st.primer_nombre || ""} ${st.primer_apellido || ""}`.trim() || "Estudiante",
        grandTotalPremios,
        totalPruebasBonus,
        totalPruebasOficial,
        bonusExtraTotal,
        totalManuales,
        totalExamenes,
        pruebasDesglose,
        manualesDesglose,
        examenesDesglose
      };
    });

    // Ordenar de mayor a menor según grandTotalPremios
    // Desempate: mayor total en pruebas con bonus, luego mayor en exámenes, luego alfabético
    computedList.sort((a, b) => {
      if (b.grandTotalPremios !== a.grandTotalPremios) {
        return b.grandTotalPremios - a.grandTotalPremios;
      }
      if (b.totalPruebasBonus !== a.totalPruebasBonus) {
        return b.totalPruebasBonus - a.totalPruebasBonus;
      }
      if (b.totalExamenes !== a.totalExamenes) {
        return b.totalExamenes - a.totalExamenes;
      }
      return (a.nombre || "").localeCompare(b.nombre || "");
    });

    // Asignar posición de ranking (1, 2, 3...)
    return computedList.map((item, idx) => ({
      ...item,
      posicion: idx + 1,
      esPodio: idx < 3
    }));
  }, [estudiantes, regularWeeks, examWeeks, evaluableTopics, entregasMap]);

  // Filtrado de la tabla
  const filteredRanking = useMemo(() => {
    return studentsRanking.filter((st) => {
      const q = searchTerm.toLowerCase().trim();
      const matchSearch =
        !q ||
        (st.nombre || "").toLowerCase().includes(q) ||
        (st.cuenta || "").toLowerCase().includes(q);

      if (!matchSearch) return false;

      if (filterType === "top3") return st.posicion <= 3;
      if (filterType === "con_bonus") return st.bonusExtraTotal > 0;

      return true;
    });
  }, [studentsRanking, searchTerm, filterType]);

  // Los 3 mejores de la sección (Podio)
  const top3Winners = useMemo(() => {
    return studentsRanking.slice(0, 3);
  }, [studentsRanking]);

  // Exportar a CSV
  const handleExportCSV = () => {
    if (studentsRanking.length === 0) {
      if (notify) notify("No hay datos para exportar.", "warning");
      return;
    }

    const headers = [
      "Posición",
      "Número de Cuenta",
      "Nombre Completo",
      "Gran Total Premios",
      "Bonus Ganado Extra",
      "Total Pruebas (con Bonus)",
      ...regularWeeks.map((w) => `Prueba Sem ${w.numero_semana}`),
      "Total Manuales (1 pt c/u)",
      ...evaluableTopics.map((t, idx) => `Manual Tema ${t.numero_tema || idx + 1}`),
      "Total Exámenes Parciales",
      ...examWeeks.map((w, idx) => `Examen ${w.parcial || idx + 1}`)
    ];

    const rows = studentsRanking.map((st) => {
      const row = [
        st.posicion,
        `"${st.cuenta}"`,
        `"${st.nombre}"`,
        st.grandTotalPremios.toFixed(3),
        st.bonusExtraTotal.toFixed(3),
        st.totalPruebasBonus.toFixed(3),
        ...st.pruebasDesglose.map((p) => (p.notaReal !== null ? p.notaReal.toFixed(3) : "")),
        st.totalManuales.toFixed(3),
        ...st.manualesDesglose.map((m) => (m.nota !== null ? m.nota.toFixed(3) : "")),
        st.totalExamenes.toFixed(3),
        ...st.examenesDesglose.map((e) => (e.nota !== null ? e.nota.toFixed(3) : ""))
      ];
      return row.join(",");
    });

    const csvContent = "\uFEFF" + [headers.join(","), ...rows].join("\r\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `Premios_Seccion_${seccion?.nombre_seccion || "Histolab"}_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    if (notify) notify("¡Archivo CSV descargado con éxito!", "success");
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.75rem", paddingBottom: "3rem" }}>
      {/* 1. Header principal en Modo Claro / Glass Panel */}
      <div
        className="glass-panel"
        style={{
          background: "#ffffff",
          borderRadius: "1.25rem",
          padding: "1.75rem 2rem",
          border: "1.5px solid #e2e8f0",
          boxShadow: "0 10px 30px -5px rgba(0, 0, 0, 0.05)",
          position: "relative",
          overflow: "hidden"
        }}
      >
        <div
          style={{
            position: "absolute",
            right: "-20px",
            top: "-20px",
            opacity: 0.04,
            color: "#d97706",
            pointerEvents: "none"
          }}
        >
          <Trophy size={260} strokeWidth={1.2} />
        </div>

        <div style={{ position: "relative", zIndex: 1 }}>
          {!hideBackButton && (
            <button
              type="button"
              onClick={onClose}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "0.45rem",
                padding: "0.45rem 0.95rem",
                borderRadius: "0.55rem",
                background: "#f8fafc",
                color: "#334155",
                border: "1px solid #cbd5e1",
                fontSize: "0.82rem",
                fontWeight: 700,
                cursor: "pointer",
                marginBottom: "1.25rem",
                transition: "all 0.15s ease",
                boxShadow: "0 1px 3px rgba(0, 0, 0, 0.03)"
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "#f1f5f9";
                e.currentTarget.style.color = "#0f172a";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "#f8fafc";
                e.currentTarget.style.color = "#334155";
              }}
            >
              <ArrowLeft size={16} />
              <span>Volver a la Sección</span>
            </button>
          )}

          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: "1.25rem" }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", marginBottom: "0.4rem", flexWrap: "wrap" }}>
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "0.35rem",
                    padding: "0.25rem 0.75rem",
                    borderRadius: "9999px",
                    background: "#fef3c7",
                    color: "#92400e",
                    border: "1px solid #fde68a",
                    fontSize: "0.76rem",
                    fontWeight: 800,
                    textTransform: "uppercase"
                  }}
                >
                  <Sparkles size={13} color="#d97706" />
                  Cuadro de Honor y Premiación
                </span>
                <span style={{ fontSize: "0.82rem", color: "#64748b", fontWeight: 700 }}>
                  Sección: <strong style={{ color: "#0284c7" }}>{seccion?.nombre_seccion || "Sección"}</strong>
                </span>
                <span style={{ fontSize: "0.82rem", color: "#cbd5e1" }}>•</span>
                <span
                  style={{
                    background: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
                    color: "#ffffff",
                    fontWeight: 900,
                    fontSize: "0.74rem",
                    padding: "0.15rem 0.6rem",
                    borderRadius: "9999px",
                    textTransform: "uppercase"
                  }}
                >
                  {carrera}
                </span>
              </div>

              <h1 style={{ margin: "0 0 0.5rem", fontSize: "1.85rem", fontWeight: 900, letterSpacing: "-0.02em", color: "#0f172a", display: "flex", alignItems: "center", gap: "0.75rem" }}>
                <div
                  style={{
                    width: "44px",
                    height: "44px",
                    borderRadius: "0.75rem",
                    background: "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)",
                    color: "#ffffff",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    boxShadow: "0 4px 12px rgba(245, 158, 11, 0.35)",
                    flexShrink: 0
                  }}
                >
                  <Trophy size={24} />
                </div>
                <span>Premios de la Sección</span>
              </h1>

              <p style={{ margin: 0, fontSize: "0.92rem", color: "#475569", maxWidth: "800px", lineHeight: 1.55 }}>
                Listado paralelo con bonificaciones completas de pruebas semanales (hasta 6 pts), manuales individuales (1 pt) y exámenes parciales sumados directamente sin convertir a Puntos Oro para seleccionar a los 3 mejores lugares.
              </p>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap" }}>
              <button
                type="button"
                onClick={() => loadData(true)}
                disabled={loading || refreshing}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "0.45rem",
                  padding: "0.65rem 1.15rem",
                  borderRadius: "0.65rem",
                  background: "#ffffff",
                  color: "#334155",
                  border: "1px solid #cbd5e1",
                  fontSize: "0.84rem",
                  fontWeight: 700,
                  cursor: refreshing ? "not-allowed" : "pointer",
                  boxShadow: "0 1px 3px rgba(0, 0, 0, 0.05)",
                  transition: "all 0.15s ease"
                }}
                onMouseEnter={(e) => {
                  if (!refreshing) e.currentTarget.style.background = "#f8fafc";
                }}
                onMouseLeave={(e) => {
                  if (!refreshing) e.currentTarget.style.background = "#ffffff";
                }}
              >
                <RefreshCw size={15} className={refreshing ? "animate-spin" : ""} color="#64748b" />
                <span>Actualizar</span>
              </button>

              <button
                type="button"
                onClick={handleExportCSV}
                disabled={loading || studentsRanking.length === 0}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "0.5rem",
                  padding: "0.65rem 1.25rem",
                  borderRadius: "0.65rem",
                  background: "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)",
                  color: "#ffffff",
                  border: "none",
                  fontSize: "0.86rem",
                  fontWeight: 800,
                  cursor: studentsRanking.length === 0 ? "not-allowed" : "pointer",
                  boxShadow: "0 4px 12px rgba(245, 158, 11, 0.35)",
                  transition: "all 0.15s ease"
                }}
                onMouseEnter={(e) => {
                  if (studentsRanking.length > 0) e.currentTarget.style.filter = "brightness(1.06)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.filter = "none";
                }}
              >
                <Download size={16} />
                <span>Exportar Ranking a CSV</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Banner de Reglas y Explicación del Cálculo Paralelo */}
      <div
        style={{
          background: "#fffbeb",
          border: "1.5px solid #fde68a",
          borderRadius: "1rem",
          padding: "1.2rem 1.5rem",
          display: "flex",
          alignItems: "flex-start",
          gap: "1rem"
        }}
      >
        <div
          style={{
            width: "36px",
            height: "36px",
            borderRadius: "50%",
            background: "#fef3c7",
            color: "#d97706",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0
          }}
        >
          <Info size={20} />
        </div>
        <div style={{ fontSize: "0.86rem", color: "#92400e", lineHeight: 1.5 }}>
          <strong style={{ fontSize: "0.92rem", display: "block", marginBottom: "0.25rem", color: "#78350f" }}>
            📐 Metodología del Ranking Especial de Premios:
          </strong>
          <div>
            1. <strong>Pruebas Semanales con Bonus:</strong> En este cuadro se suma la calificación real obtenida por el alumno (hasta 6.000 pts si acertó la pregunta bonus). En el registro de notas oficial se mantiene el tope normativo de 5.000 pts.
          </div>
          <div>
            2. <strong>Manuales Individuales:</strong> Se suman directamente sus notas sobre 1.000 pt cada uno sin conversión a factores de puntos oro.
          </div>
          <div>
            3. <strong>Exámenes Parciales:</strong> Se añade la sumatoria directa de los exámenes parciales rendidos.
          </div>
          <div style={{ marginTop: "0.35rem", fontWeight: 800, color: "#b45309" }}>
            Fórmula: Gran Total Premios = Σ Pruebas (con Bonus) + Σ Manuales Individuales + Σ Exámenes Parciales
          </div>
        </div>
      </div>

      {/* 3. Podio de los 3 Mejores Estudiantes (Top 3) */}
      <div>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "1rem" }}>
          <Crown size={22} color="#f59e0b" />
          <h2 style={{ fontSize: "1.25rem", fontWeight: 900, color: "#0f172a", margin: 0 }}>
            Podio de Premiación (Top 3 de la Sección)
          </h2>
        </div>

        {top3Winners.length === 0 ? (
          <div
            style={{
              background: "#ffffff",
              padding: "2.5rem",
              borderRadius: "1rem",
              border: "1px dashed #cbd5e1",
              textAlign: "center",
              color: "#64748b"
            }}
          >
            No hay calificaciones registradas para ordenar el podio de esta sección.
          </div>
        ) : (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
              gap: "1.25rem"
            }}
          >
            {/* Medalla de Oro: 1º Lugar */}
            {top3Winners[0] && (
              <div
                style={{
                  background: "linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%)",
                  border: "2px solid #f59e0b",
                  borderRadius: "1.15rem",
                  padding: "1.6rem",
                  boxShadow: "0 10px 25px -5px rgba(245, 158, 11, 0.25)",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                  position: "relative",
                  overflow: "hidden"
                }}
              >
                <div style={{ position: "absolute", top: "1rem", right: "1rem" }}>
                  <span
                    style={{
                      background: "#f59e0b",
                      color: "#ffffff",
                      fontSize: "0.78rem",
                      fontWeight: 900,
                      padding: "0.3rem 0.75rem",
                      borderRadius: "9999px",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "0.3rem",
                      boxShadow: "0 2px 8px rgba(245, 158, 11, 0.4)"
                    }}
                  >
                    🥇 1º LUGAR
                  </span>
                </div>

                <div>
                  <div
                    style={{
                      width: "48px",
                      height: "48px",
                      borderRadius: "50%",
                      background: "#fbbf24",
                      color: "#78350f",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      marginBottom: "1rem"
                    }}
                  >
                    <Crown size={28} />
                  </div>

                  <h3 style={{ margin: "0 0 0.25rem", fontSize: "1.25rem", fontWeight: 900, color: "#78350f" }}>
                    {top3Winners[0].nombre}
                  </h3>
                  <div style={{ fontSize: "0.85rem", color: "#b45309", fontWeight: 700, marginBottom: "1rem" }}>
                    Cuenta: {top3Winners[0].cuenta}
                  </div>
                </div>

                <div style={{ borderTop: "1.5px dashed #fde68a", paddingTop: "1rem" }}>
                  <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: "0.5rem" }}>
                    <span style={{ fontSize: "0.82rem", fontWeight: 800, color: "#92400e" }}>Puntaje Total Premios:</span>
                    <strong style={{ fontSize: "1.55rem", fontWeight: 900, color: "#78350f" }}>
                      {top3Winners[0].grandTotalPremios.toFixed(3)} pts
                    </strong>
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem", fontSize: "0.78rem", color: "#92400e" }}>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span>Pruebas con Bonus:</span>
                      <strong>{top3Winners[0].totalPruebasBonus.toFixed(3)} pts</strong>
                    </div>
                    {top3Winners[0].bonusExtraTotal > 0 && (
                      <div style={{ display: "flex", justifyContent: "space-between", color: "#b45309", fontWeight: 800 }}>
                        <span>⭐ Bonus extra sumado:</span>
                        <span>+{top3Winners[0].bonusExtraTotal.toFixed(3)} pts</span>
                      </div>
                    )}
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span>Manuales individuales:</span>
                      <strong>{top3Winners[0].totalManuales.toFixed(3)} pts</strong>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span>Exámenes parciales:</span>
                      <strong>{top3Winners[0].totalExamenes.toFixed(3)} pts</strong>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Medalla de Plata: 2º Lugar */}
            {top3Winners[1] && (
              <div
                style={{
                  background: "linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)",
                  border: "2px solid #94a3b8",
                  borderRadius: "1.15rem",
                  padding: "1.6rem",
                  boxShadow: "0 10px 25px -5px rgba(148, 163, 184, 0.2)",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                  position: "relative",
                  overflow: "hidden"
                }}
              >
                <div style={{ position: "absolute", top: "1rem", right: "1rem" }}>
                  <span
                    style={{
                      background: "#64748b",
                      color: "#ffffff",
                      fontSize: "0.78rem",
                      fontWeight: 900,
                      padding: "0.3rem 0.75rem",
                      borderRadius: "9999px",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "0.3rem"
                    }}
                  >
                    🥈 2º LUGAR
                  </span>
                </div>

                <div>
                  <div
                    style={{
                      width: "48px",
                      height: "48px",
                      borderRadius: "50%",
                      background: "#cbd5e1",
                      color: "#334155",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      marginBottom: "1rem"
                    }}
                  >
                    <Medal size={26} />
                  </div>

                  <h3 style={{ margin: "0 0 0.25rem", fontSize: "1.25rem", fontWeight: 900, color: "#1e293b" }}>
                    {top3Winners[1].nombre}
                  </h3>
                  <div style={{ fontSize: "0.85rem", color: "#64748b", fontWeight: 700, marginBottom: "1rem" }}>
                    Cuenta: {top3Winners[1].cuenta}
                  </div>
                </div>

                <div style={{ borderTop: "1.5px dashed #cbd5e1", paddingTop: "1rem" }}>
                  <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: "0.5rem" }}>
                    <span style={{ fontSize: "0.82rem", fontWeight: 800, color: "#475569" }}>Puntaje Total Premios:</span>
                    <strong style={{ fontSize: "1.55rem", fontWeight: 900, color: "#1e293b" }}>
                      {top3Winners[1].grandTotalPremios.toFixed(3)} pts
                    </strong>
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem", fontSize: "0.78rem", color: "#475569" }}>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span>Pruebas con Bonus:</span>
                      <strong>{top3Winners[1].totalPruebasBonus.toFixed(3)} pts</strong>
                    </div>
                    {top3Winners[1].bonusExtraTotal > 0 && (
                      <div style={{ display: "flex", justifyContent: "space-between", color: "#0284c7", fontWeight: 800 }}>
                        <span>⭐ Bonus extra sumado:</span>
                        <span>+{top3Winners[1].bonusExtraTotal.toFixed(3)} pts</span>
                      </div>
                    )}
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span>Manuales individuales:</span>
                      <strong>{top3Winners[1].totalManuales.toFixed(3)} pts</strong>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span>Exámenes parciales:</span>
                      <strong>{top3Winners[1].totalExamenes.toFixed(3)} pts</strong>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Medalla de Bronce: 3º Lugar */}
            {top3Winners[2] && (
              <div
                style={{
                  background: "linear-gradient(135deg, #fff7ed 0%, #ffedd5 100%)",
                  border: "2px solid #ea580c",
                  borderRadius: "1.15rem",
                  padding: "1.6rem",
                  boxShadow: "0 10px 25px -5px rgba(234, 88, 12, 0.18)",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                  position: "relative",
                  overflow: "hidden"
                }}
              >
                <div style={{ position: "absolute", top: "1rem", right: "1rem" }}>
                  <span
                    style={{
                      background: "#c2410c",
                      color: "#ffffff",
                      fontSize: "0.78rem",
                      fontWeight: 900,
                      padding: "0.3rem 0.75rem",
                      borderRadius: "9999px",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "0.3rem"
                    }}
                  >
                    🥉 3º LUGAR
                  </span>
                </div>

                <div>
                  <div
                    style={{
                      width: "48px",
                      height: "48px",
                      borderRadius: "50%",
                      background: "#fdba74",
                      color: "#7c2d12",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      marginBottom: "1rem"
                    }}
                  >
                    <Award size={26} />
                  </div>

                  <h3 style={{ margin: "0 0 0.25rem", fontSize: "1.25rem", fontWeight: 900, color: "#7c2d12" }}>
                    {top3Winners[2].nombre}
                  </h3>
                  <div style={{ fontSize: "0.85rem", color: "#c2410c", fontWeight: 700, marginBottom: "1rem" }}>
                    Cuenta: {top3Winners[2].cuenta}
                  </div>
                </div>

                <div style={{ borderTop: "1.5px dashed #fed7aa", paddingTop: "1rem" }}>
                  <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: "0.5rem" }}>
                    <span style={{ fontSize: "0.82rem", fontWeight: 800, color: "#9a3412" }}>Puntaje Total Premios:</span>
                    <strong style={{ fontSize: "1.55rem", fontWeight: 900, color: "#7c2d12" }}>
                      {top3Winners[2].grandTotalPremios.toFixed(3)} pts
                    </strong>
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem", fontSize: "0.78rem", color: "#9a3412" }}>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span>Pruebas con Bonus:</span>
                      <strong>{top3Winners[2].totalPruebasBonus.toFixed(3)} pts</strong>
                    </div>
                    {top3Winners[2].bonusExtraTotal > 0 && (
                      <div style={{ display: "flex", justifyContent: "space-between", color: "#ea580c", fontWeight: 800 }}>
                        <span>⭐ Bonus extra sumado:</span>
                        <span>+{top3Winners[2].bonusExtraTotal.toFixed(3)} pts</span>
                      </div>
                    )}
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span>Manuales individuales:</span>
                      <strong>{top3Winners[2].totalManuales.toFixed(3)} pts</strong>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span>Exámenes parciales:</span>
                      <strong>{top3Winners[2].totalExamenes.toFixed(3)} pts</strong>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 4. Barra de Filtros, Búsqueda y Opciones de visualización */}
      <div
        style={{
          background: "#ffffff",
          borderRadius: "1rem",
          padding: "1.2rem 1.5rem",
          border: "1px solid #e2e8f0",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: "1rem"
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flex: 1, minWidth: "260px" }}>
          <div style={{ position: "relative", width: "100%", maxWidth: "380px" }}>
            <Search size={16} color="#94a3b8" style={{ position: "absolute", left: "0.85rem", top: "50%", transform: "translateY(-50%)" }} />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar estudiante por nombre o cuenta..."
              style={{
                width: "100%",
                padding: "0.55rem 0.85rem 0.55rem 2.3rem",
                borderRadius: "0.55rem",
                border: "1.5px solid #cbd5e1",
                fontSize: "0.85rem",
                outline: "none"
              }}
            />
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "0.35rem" }}>
            <button
              type="button"
              onClick={() => setFilterType("todos")}
              style={{
                padding: "0.45rem 0.85rem",
                borderRadius: "0.5rem",
                border: filterType === "todos" ? "1.5px solid #0284c7" : "1px solid #cbd5e1",
                background: filterType === "todos" ? "#e0f2fe" : "#ffffff",
                color: filterType === "todos" ? "#0369a1" : "#475569",
                fontSize: "0.8rem",
                fontWeight: 700,
                cursor: "pointer"
              }}
            >
              Todos ({studentsRanking.length})
            </button>

            <button
              type="button"
              onClick={() => setFilterType("top3")}
              style={{
                padding: "0.45rem 0.85rem",
                borderRadius: "0.5rem",
                border: filterType === "top3" ? "1.5px solid #f59e0b" : "1px solid #cbd5e1",
                background: filterType === "top3" ? "#fef3c7" : "#ffffff",
                color: filterType === "top3" ? "#b45309" : "#475569",
                fontSize: "0.8rem",
                fontWeight: 700,
                cursor: "pointer"
              }}
            >
              🏆 Podio Top 3
            </button>

            <button
              type="button"
              onClick={() => setFilterType("con_bonus")}
              style={{
                padding: "0.45rem 0.85rem",
                borderRadius: "0.5rem",
                border: filterType === "con_bonus" ? "1.5px solid #10b981" : "1px solid #cbd5e1",
                background: filterType === "con_bonus" ? "#ecfdf5" : "#ffffff",
                color: filterType === "con_bonus" ? "#047857" : "#475569",
                fontSize: "0.8rem",
                fontWeight: 700,
                cursor: "pointer"
              }}
            >
              ⭐ Con Bonus Ganado
            </button>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setShowDetailColumns(!showDetailColumns)}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "0.4rem",
            padding: "0.5rem 0.95rem",
            borderRadius: "0.55rem",
            background: "#f8fafc",
            border: "1px solid #cbd5e1",
            color: "#334155",
            fontSize: "0.8rem",
            fontWeight: 700,
            cursor: "pointer"
          }}
        >
          {showDetailColumns ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
          <span>{showDetailColumns ? "Ocultar Columnas Individuales" : "Ver Columnas Individuales"}</span>
        </button>
      </div>

      {/* 5. Tabla Completa de Calificaciones Paralelas y Premios */}
      <div
        style={{
          background: "#ffffff",
          borderRadius: "1rem",
          border: "1.5px solid #e2e8f0",
          boxShadow: "0 4px 16px -2px rgba(0, 0, 0, 0.04)",
          overflow: "hidden"
        }}
      >
        <div style={{ padding: "1.2rem 1.5rem", borderBottom: "1px solid #e2e8f0", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <h3 style={{ margin: 0, fontSize: "1.05rem", fontWeight: 800, color: "#0f172a" }}>
              Tabla General de Calificaciones para Premiación
            </h3>
            <span style={{ fontSize: "0.78rem", color: "#64748b" }}>
              {filteredRanking.length} estudiantes ordenados de mayor a menor puntaje
            </span>
          </div>
        </div>

        {filteredRanking.length === 0 ? (
          <div style={{ padding: "3rem", textAlign: "center", color: "#64748b" }}>
            No se encontraron estudiantes con los filtros seleccionados.
          </div>
        ) : (
          <div style={{ overflowX: "auto", maxWidth: "100%" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.82rem", textAlign: "left" }}>
              <thead>
                <tr style={{ background: "#f8fafc", borderBottom: "2px solid #e2e8f0", color: "#475569" }}>
                  <th style={{ padding: "0.85rem 1rem", fontWeight: 800, textAlign: "center", width: "70px" }}>Pos.</th>
                  <th style={{ padding: "0.85rem 1rem", fontWeight: 800 }}>Estudiante</th>
                  <th style={{ padding: "0.85rem 1rem", fontWeight: 800, textAlign: "center", background: "#fef3c7", color: "#78350f" }}>
                    🏆 Gran Total Premios
                  </th>
                  <th style={{ padding: "0.85rem 1rem", fontWeight: 800, textAlign: "center", color: "#b45309" }}>
                    ⭐ Bonus Extra
                  </th>
                  <th style={{ padding: "0.85rem 1rem", fontWeight: 800, textAlign: "center", background: "#f0fdf4", color: "#166534" }}>
                    Total Pruebas (c/ Bonus)
                  </th>

                  {/* Columnas individuales de pruebas */}
                  {showDetailColumns &&
                    regularWeeks.map((w) => (
                      <th
                        key={`th_sem_${w.numero_semana}`}
                        style={{
                          padding: "0.75rem 0.6rem",
                          fontWeight: 700,
                          textAlign: "center",
                          fontSize: "0.74rem",
                          color: "#64748b",
                          borderLeft: "1px solid #e2e8f0",
                          whiteSpace: "nowrap"
                        }}
                        title={`Prueba de Semana ${w.numero_semana} (hasta 6 pts con bonus)`}
                      >
                        Prueba Sem {w.numero_semana}
                      </th>
                    ))}

                  <th style={{ padding: "0.85rem 1rem", fontWeight: 800, textAlign: "center", background: "#eff6ff", color: "#1e40af" }}>
                    Total Manuales (1 pt)
                  </th>

                  {/* Columnas individuales de manuales */}
                  {showDetailColumns &&
                    evaluableTopics.map((t, idx) => (
                      <th
                        key={`th_man_${t.id || idx}`}
                        style={{
                          padding: "0.75rem 0.6rem",
                          fontWeight: 700,
                          textAlign: "center",
                          fontSize: "0.72rem",
                          color: "#64748b",
                          borderLeft: "1px solid #e2e8f0",
                          whiteSpace: "nowrap"
                        }}
                        title={t.titulo || `Manual Tema ${t.numero_tema || idx + 1}`}
                      >
                        Man. {t.numero_tema || idx + 1}
                      </th>
                    ))}

                  <th style={{ padding: "0.85rem 1rem", fontWeight: 800, textAlign: "center", background: "#faf5ff", color: "#6b21a8" }}>
                    Total Exámenes
                  </th>

                  {/* Columnas individuales de exámenes */}
                  {showDetailColumns &&
                    examWeeks.map((ew, idx) => (
                      <th
                        key={`th_exam_${ew.numero_semana || idx}`}
                        style={{
                          padding: "0.75rem 0.6rem",
                          fontWeight: 700,
                          textAlign: "center",
                          fontSize: "0.74rem",
                          color: "#64748b",
                          borderLeft: "1px solid #e2e8f0",
                          whiteSpace: "nowrap"
                        }}
                      >
                        {ew.parcial || `Examen ${idx + 1}`}
                      </th>
                    ))}
                </tr>
              </thead>

              <tbody>
                {filteredRanking.map((st) => {
                  const isGold = st.posicion === 1;
                  const isSilver = st.posicion === 2;
                  const isBronze = st.posicion === 3;

                  let rowBg = "#ffffff";
                  if (isGold) rowBg = "#fffdf5";
                  else if (isSilver) rowBg = "#fafafa";
                  else if (isBronze) rowBg = "#fffaf5";

                  return (
                    <tr
                      key={st.id || st.cuenta}
                      style={{
                        background: rowBg,
                        borderBottom: "1px solid #f1f5f9",
                        transition: "background 0.15s ease"
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = "#f1f5f9";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = rowBg;
                      }}
                    >
                      {/* Posición */}
                      <td style={{ padding: "0.85rem 1rem", textAlign: "center" }}>
                        {isGold && (
                          <span
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              justifyContent: "center",
                              width: "28px",
                              height: "28px",
                              borderRadius: "50%",
                              background: "#fbbf24",
                              color: "#78350f",
                              fontWeight: 900,
                              fontSize: "0.82rem",
                              boxShadow: "0 2px 5px rgba(251, 191, 36, 0.4)"
                            }}
                          >
                            🥇
                          </span>
                        )}
                        {isSilver && (
                          <span
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              justifyContent: "center",
                              width: "28px",
                              height: "28px",
                              borderRadius: "50%",
                              background: "#cbd5e1",
                              color: "#1e293b",
                              fontWeight: 900,
                              fontSize: "0.82rem"
                            }}
                          >
                            🥈
                          </span>
                        )}
                        {isBronze && (
                          <span
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              justifyContent: "center",
                              width: "28px",
                              height: "28px",
                              borderRadius: "50%",
                              background: "#fdba74",
                              color: "#7c2d12",
                              fontWeight: 900,
                              fontSize: "0.82rem"
                            }}
                          >
                            🥉
                          </span>
                        )}
                        {!isGold && !isSilver && !isBronze && (
                          <span style={{ color: "#64748b", fontWeight: 800 }}>#{st.posicion}</span>
                        )}
                      </td>

                      {/* Nombre y Cuenta */}
                      <td style={{ padding: "0.85rem 1rem" }}>
                        <div style={{ fontWeight: 800, color: "#0f172a", fontSize: "0.88rem" }}>{st.nombre}</div>
                        <div style={{ fontSize: "0.76rem", color: "#64748b", fontWeight: 600 }}>
                          Cuenta: <span style={{ color: "#0284c7" }}>{st.cuenta}</span>
                        </div>
                      </td>

                      {/* Gran Total Premios */}
                      <td style={{ padding: "0.85rem 1rem", textAlign: "center", background: isGold ? "#fef3c7" : "#fffbeb" }}>
                        <span
                          style={{
                            fontSize: "1.05rem",
                            fontWeight: 900,
                            color: "#78350f"
                          }}
                        >
                          {st.grandTotalPremios.toFixed(3)}
                        </span>
                      </td>

                      {/* Bonus Extra */}
                      <td style={{ padding: "0.85rem 1rem", textAlign: "center" }}>
                        {st.bonusExtraTotal > 0 ? (
                          <span
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "0.2rem",
                              padding: "0.15rem 0.5rem",
                              borderRadius: "9999px",
                              background: "#fef3c7",
                              color: "#b45309",
                              border: "1px solid #fde68a",
                              fontWeight: 800,
                              fontSize: "0.76rem"
                            }}
                          >
                            +{st.bonusExtraTotal.toFixed(3)}
                          </span>
                        ) : (
                          <span style={{ color: "#cbd5e1" }}>—</span>
                        )}
                      </td>

                      {/* Total Pruebas (con Bonus) */}
                      <td style={{ padding: "0.85rem 1rem", textAlign: "center", background: "#f0fdf4" }}>
                        <strong style={{ color: "#166534", fontSize: "0.92rem" }}>
                          {st.totalPruebasBonus.toFixed(3)}
                        </strong>
                      </td>

                      {/* Desglose Pruebas */}
                      {showDetailColumns &&
                        st.pruebasDesglose.map((p) => {
                          const hasScore = p.notaReal !== null;
                          const hasBonus = p.tieneBonus;

                          return (
                            <td
                              key={`td_pr_${st.cuenta}_sem_${p.semana}`}
                              style={{
                                padding: "0.75rem 0.5rem",
                                textAlign: "center",
                                borderLeft: "1px solid #f1f5f9"
                              }}
                            >
                              {hasScore ? (
                                hasBonus ? (
                                  <span
                                    style={{
                                      display: "inline-block",
                                      padding: "0.1rem 0.35rem",
                                      borderRadius: "0.3rem",
                                      background: "#fef3c7",
                                      color: "#b45309",
                                      fontWeight: 900,
                                      border: "1px solid #fde68a"
                                    }}
                                    title={`Nota real con bonus: ${p.notaReal.toFixed(3)} (Oficial en registro: ${p.notaOficial?.toFixed(3) || "5.000"})`}
                                  >
                                    ⭐ {p.notaReal.toFixed(3)}
                                  </span>
                                ) : (
                                  <span style={{ fontWeight: 700, color: "#334155" }}>
                                    {p.notaReal.toFixed(3)}
                                  </span>
                                )
                              ) : (
                                <span style={{ color: "#cbd5e1" }}>—</span>
                              )}
                            </td>
                          );
                        })}

                      {/* Total Manuales */}
                      <td style={{ padding: "0.85rem 1rem", textAlign: "center", background: "#eff6ff" }}>
                        <strong style={{ color: "#1e40af", fontSize: "0.92rem" }}>
                          {st.totalManuales.toFixed(3)}
                        </strong>
                      </td>

                      {/* Desglose Manuales */}
                      {showDetailColumns &&
                        st.manualesDesglose.map((m, idx) => (
                          <td
                            key={`td_man_${st.cuenta}_${m.temaId || idx}`}
                            style={{
                              padding: "0.75rem 0.5rem",
                              textAlign: "center",
                              borderLeft: "1px solid #f1f5f9"
                            }}
                          >
                            {m.nota !== null ? (
                              <span style={{ fontWeight: 600, color: "#334155" }}>
                                {m.nota.toFixed(3)}
                              </span>
                            ) : (
                              <span style={{ color: "#cbd5e1" }}>—</span>
                            )}
                          </td>
                        ))}

                      {/* Total Exámenes */}
                      <td style={{ padding: "0.85rem 1rem", textAlign: "center", background: "#faf5ff" }}>
                        <strong style={{ color: "#6b21a8", fontSize: "0.92rem" }}>
                          {st.totalExamenes.toFixed(3)}
                        </strong>
                      </td>

                      {/* Desglose Exámenes */}
                      {showDetailColumns &&
                        st.examenesDesglose.map((e, idx) => (
                          <td
                            key={`td_exam_${st.cuenta}_${idx}`}
                            style={{
                              padding: "0.75rem 0.5rem",
                              textAlign: "center",
                              borderLeft: "1px solid #f1f5f9"
                            }}
                          >
                            {e.nota !== null ? (
                              <span style={{ fontWeight: 700, color: "#334155" }}>
                                {e.nota.toFixed(3)}
                              </span>
                            ) : (
                              <span style={{ color: "#cbd5e1" }}>—</span>
                            )}
                          </td>
                        ))}
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
