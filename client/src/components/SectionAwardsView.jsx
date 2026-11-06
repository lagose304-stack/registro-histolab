import React, { useState, useEffect, useMemo, useCallback } from "react";
import { Trophy, Crown, Star, ArrowLeft, Download, RefreshCw, Search, BookOpen, FileText, Medal, ChevronDown, LayoutGrid, List, Users, Info, AlertCircle } from "lucide-react";
import "./SectionAwardsView.css";
import { api } from "../services/api";
import {
  getRegularWeeks,
  getExamWeeks,
  getCanonicalManualGrade,
  getCanonicalExamGrade,
  getCanonicalQuizGrade
} from "../utils/academicEngine";

export default function SectionAwardsView({ seccion, currentInstructor, hideBackButton = false, onClose, notify }) {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [estudiantes, setEstudiantes] = useState([]);
  const [semanasConfig, setSemanasConfig] = useState([]);
  const [temario, setTemario] = useState([]);
  const [loadError, setLoadError] = useState("");
  const [allEntregas, setAllEntregas] = useState([]);
  
  // Filtros
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState("todos"); // 'todos', 'top3', 'con_bonus'
  const [viewMode, setViewMode] = useState("list");

  const carrera = seccion?.carrera || "Medicina";

  // Cargar toda la información académica y entregas de la sección
  const loadData = useCallback(async (isRefresh = false) => {
    if (!seccion?.id) return;
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      setLoadError("");
      const results = await Promise.all([
        api.estudiantes.getBySeccion(seccion.id, carrera),
        api.semanas.getConfig(carrera),
        api.temario.getAll({ carrera }),
        api.pruebas.getAllEntregas(seccion.id)
      ]);
      if (results.some(result => result?.success === false)) {
        throw new Error("No se pudieron cargar todos los datos de premios.");
      }
      const [resEst, resSemanas, resTemas, resEntregas] = results;

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

      setAllEntregas(Array.isArray(resEntregas?.data) ? resEntregas.data : []);
    } catch (err) {
      console.error("Error al cargar datos para Premios de la Sección:", err);
      setLoadError("No pudimos actualizar la clasificación completa. Intenta cargar los datos nuevamente.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [seccion?.id, carrera]);

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
    setTimeout(() => URL.revokeObjectURL(url), 1000);

    if (notify) notify("¡Archivo CSV descargado con éxito!", "success");
  };

  const points = value => value.toFixed(3);
  const bonusCount = studentsRanking.filter(student => student.bonusExtraTotal > 0).length;
  const sectionName = seccion?.codigo || seccion?.nombre_seccion || "Sección";
  const resetFilters = () => { setSearchTerm(""); setFilterType("todos"); };

  const renderBreakdown = student => (
    <details className="section-awards__detail">
      <summary>Ver desglose de calificaciones <ChevronDown size={16} aria-hidden="true" /></summary>
      <div className="section-awards__breakdown">
        {[
          { title: "Pruebas semanales", icon: FileText, items: student.pruebasDesglose.map(p => ({ name: p.nombre.toLowerCase().startsWith("semana") ? p.nombre : `Semana ${p.semana} · ${p.nombre}`, value: p.notaReal, bonus: p.tieneBonus })) },
          { title: "Manuales", icon: BookOpen, items: student.manualesDesglose.map(m => ({ name: m.titulo || `Manual ${m.numero}`, value: m.nota })) },
          { title: "Exámenes parciales", icon: Medal, items: student.examenesDesglose.map(e => ({ name: e.parcial, value: e.nota })) }
        ].map(group => (
          <section key={group.title}>
            <h4><group.icon size={16} aria-hidden="true" />{group.title}</h4>
            {group.items.length ? <dl>{group.items.map((item, index) => <div key={index}><dt>{item.name}</dt><dd>{item.bonus && <Star size={13} aria-label="Incluye bonus" />}{item.value === null ? <span className="section-awards__missing">Sin nota</span> : points(item.value)}</dd></div>)}</dl> : <p>No hay evaluaciones configuradas.</p>}
          </section>
        ))}
      </div>
    </details>
  );

  return (
    <section className="section-awards" aria-labelledby="section-awards-title" aria-busy={loading || refreshing}>
      <header className="section-awards__hero">
        {!hideBackButton && <button type="button" className="section-awards__button" onClick={onClose}><ArrowLeft size={17} aria-hidden="true" />Volver a Módulos de la Sección</button>}
        <div className="section-awards__hero-content">
          <div className="section-awards__heading">
            <span className="section-awards__hero-icon"><Trophy size={27} aria-hidden="true" /></span>
            <div><p className="section-awards__eyebrow">Cuadro de honor · {sectionName}</p><h2 id="section-awards-title">Premios de la Sección</h2><p>{carrera} · Reconoce el esfuerzo y el desempeño de tu grupo.</p></div>
          </div>
          <div className="section-awards__actions">
            <button type="button" className="section-awards__button" onClick={() => loadData(true)} disabled={loading || refreshing}><RefreshCw size={17} aria-hidden="true" />{refreshing ? "Actualizando…" : "Actualizar"}</button>
            <button type="button" className="section-awards__button section-awards__button--gold" onClick={handleExportCSV} disabled={loading || refreshing || !!loadError || !studentsRanking.length}><Download size={17} aria-hidden="true" />Descargar CSV</button>
          </div>
        </div>
      </header>

      {loadError && <div className="section-awards__error" role="alert"><AlertCircle size={21} aria-hidden="true" /><div><strong>No se pudo cargar la clasificación</strong><p>{loadError}</p></div><button type="button" className="section-awards__button" onClick={() => loadData(estudiantes.length > 0)} disabled={loading || refreshing}>Reintentar</button></div>}

      {loading ? <div className="section-awards__loading" role="status"><span className="section-awards__sr-only">Cargando premios de la sección…</span><div className="section-awards__skeleton-stats" aria-hidden="true">{[1,2,3].map(i => <div key={i} />)}</div><div className="section-awards__skeleton-podium" aria-hidden="true">{[1,2,3].map(i => <div key={i} />)}</div></div> : !loadError && <>
        <dl className="section-awards__stats">
          <div><Users size={20} aria-hidden="true" /><dt>Estudiantes</dt><dd>{studentsRanking.length}</dd></div>
          <div><Trophy size={20} aria-hidden="true" /><dt>Mayor puntaje</dt><dd>{studentsRanking.length ? points(studentsRanking[0].grandTotalPremios) : "—"}<small> pts</small></dd></div>
          <div><Star size={20} aria-hidden="true" /><dt>Con bonus extra</dt><dd>{bonusCount}<small> {bonusCount === 1 ? "estudiante" : "estudiantes"}</small></dd></div>
        </dl>

        <details className="section-awards__method">
          <summary><span><Info size={18} aria-hidden="true" />¿Cómo se calcula la clasificación?</span><ChevronDown size={17} aria-hidden="true" /></summary>
          <div><p>Se suman <strong>pruebas con bonus + manuales + exámenes parciales</strong>, sin conversión a puntos oro. El bonus ya está incluido en las pruebas; no se suma dos veces.</p><ul><li>Pruebas: nota real, hasta 6 puntos por semana. El registro oficial conserva su límite de 5 puntos.</li><li>Manuales: suma de las notas individuales, sobre 1 punto cada uno.</li><li>Exámenes: suma directa de las calificaciones de los parciales.</li></ul><p>En caso de empate: mayor puntaje en pruebas, luego en exámenes y, por último, orden alfabético. Las evaluaciones sin nota no suman puntos.</p></div>
        </details>

        {studentsRanking.length > 0 ? <>
          <section aria-labelledby="awards-podium-title">
            <div className="section-awards__section-heading"><div><p className="section-awards__eyebrow">Los primeros lugares</p><h3 id="awards-podium-title"><Crown size={21} aria-hidden="true" />Podio de la sección</h3></div><span>Según las notas registradas</span></div>
            <ol className="section-awards__podium">
              {top3Winners.map(student => <li key={student.id || student.cuenta} data-place={student.posicion}>
                <div className="section-awards__podium-top"><span className="section-awards__medal">{student.posicion === 1 ? <Crown size={24} aria-hidden="true" /> : <Medal size={24} aria-hidden="true" />}</span><span>{student.posicion}º lugar</span></div>
                <h4>{student.nombre}</h4><p className="section-awards__account">Cuenta: {student.cuenta}</p>
                <div className="section-awards__podium-score"><strong>{points(student.grandTotalPremios)}</strong><span>puntos para premios</span></div>
                <dl className="section-awards__podium-totals"><div><dt>Pruebas</dt><dd>{points(student.totalPruebasBonus)}</dd></div><div><dt>Manuales</dt><dd>{points(student.totalManuales)}</dd></div><div><dt>Exámenes</dt><dd>{points(student.totalExamenes)}</dd></div></dl>
                {student.bonusExtraTotal > 0 && <span className="section-awards__bonus"><Star size={13} aria-hidden="true" />{points(student.bonusExtraTotal)} de bonus incluidos</span>}
              </li>)}
            </ol>
          </section>

          <section className="section-awards__directory" aria-labelledby="awards-ranking-title">
            <div className="section-awards__section-heading"><div><p className="section-awards__eyebrow">Todos los resultados</p><h3 id="awards-ranking-title">Clasificación general</h3></div><div className="section-awards__view" role="group" aria-label="Visualización de la clasificación"><button type="button" aria-pressed={viewMode === "list"} onClick={() => setViewMode("list")}><List size={17} aria-hidden="true" />Listado</button><button type="button" aria-pressed={viewMode === "cards"} onClick={() => setViewMode("cards")}><LayoutGrid size={17} aria-hidden="true" />Tarjetas</button></div></div>
            <div className="section-awards__filters">
              <label className="section-awards__search"><span>Buscar estudiante</span><div><Search size={18} aria-hidden="true" /><input type="search" placeholder="Nombre o número de cuenta" value={searchTerm} onChange={event => setSearchTerm(event.target.value)} /></div></label>
              <div className="section-awards__filter-options" role="group" aria-label="Filtrar clasificación">{[["todos", "Todos", studentsRanking.length], ["top3", "Podio", top3Winners.length], ["con_bonus", "Con bonus", bonusCount]].map(([value,label,count]) => <button type="button" key={value} aria-pressed={filterType === value} onClick={() => setFilterType(value)}>{label}<span>{count}</span></button>)}</div>
            </div>
            <p className="section-awards__results" role="status">{filteredRanking.length} de {studentsRanking.length} estudiantes · De mayor a menor puntaje</p>
            {filteredRanking.length ? <ol className={`section-awards__ranking section-awards__ranking--${viewMode}`} aria-label="Clasificación de estudiantes">
              {filteredRanking.map(student => <li className="section-awards__student" key={student.id || student.cuenta} data-podium={student.esPodio}>
                <div className="section-awards__student-main"><div className="section-awards__identity"><span className="section-awards__position" aria-label={`Puesto ${student.posicion}`}>{student.posicion <= 3 && <Medal size={15} aria-hidden="true" />}#{student.posicion}</span><div><h4>{student.nombre}</h4><p className="section-awards__account">Cuenta: {student.cuenta}</p></div></div><div className="section-awards__student-score"><span>Total premios</span><strong>{points(student.grandTotalPremios)}<small> pts</small></strong></div></div>
                <dl className="section-awards__totals"><div><dt><FileText size={14} aria-hidden="true" />Pruebas con bonus</dt><dd>{points(student.totalPruebasBonus)}</dd></div><div><dt><BookOpen size={14} aria-hidden="true" />Manuales</dt><dd>{points(student.totalManuales)}</dd></div><div><dt><Medal size={14} aria-hidden="true" />Exámenes</dt><dd>{points(student.totalExamenes)}</dd></div></dl>
                <p className="section-awards__bonus-note">{student.bonusExtraTotal > 0 ? <><Star size={14} aria-hidden="true" />Bonus incluido: +{points(student.bonusExtraTotal)} pts</> : "Sin bonus extra registrado"}</p>
                {renderBreakdown(student)}
              </li>)}
            </ol> : <div className="section-awards__empty"><Search size={30} aria-hidden="true" /><h3>No hay coincidencias</h3><p>Prueba otro nombre, número de cuenta o filtro.</p><button type="button" className="section-awards__button" onClick={resetFilters}>Limpiar filtros</button></div>}
          </section>
        </> : <div className="section-awards__empty"><Trophy size={36} aria-hidden="true" /><h3>El cuadro de honor empieza aquí</h3><p>Cuando haya estudiantes matriculados, verás su clasificación y el desglose de sus puntajes.</p></div>}
      </>}
    </section>
  );
}
