import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { Trophy, Crown, ArrowLeft, Download, RefreshCw, Search, BookOpen, FileText, Medal, ChevronDown, LayoutGrid, List, Users, AlertCircle } from "lucide-react";
import "./SectionAwardsView.css";
import { api } from "../services/api";
import { buildSectionAwardsRanking } from "../utils/sectionAwards";

export default function SectionAwardsView({ seccion, currentInstructor, hideBackButton = false, onClose, notify }) {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState("");
  const [estudiantes, setEstudiantes] = useState([]);
  const [semanasConfig, setSemanasConfig] = useState([]);
  const [temario, setTemario] = useState([]);
  const [loadError, setLoadError] = useState("");
  const [configPuntajes, setConfigPuntajes] = useState({});
  
  // Filtros
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState("todos"); // 'todos', 'top3'
  const [viewMode, setViewMode] = useState("list");

  const loadVersion = useRef(0);
  const carrera = seccion?.carrera || "Medicina";

  // Cargar las mismas fuentes académicas que el libro de notas.
  const loadData = useCallback(async (isRefresh = false) => {
    if (!seccion?.id) return;
    const version = ++loadVersion.current;
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      setLoadError("");
      const results = await Promise.all([
        api.estudiantes.getBySeccion(seccion.id, carrera),
        api.semanas.getConfig(carrera),
        api.temario.getAll({ carrera }),
        api.temario.getPuntajes(carrera)
      ]);
      if (results.some(result => result?.success === false)) {
        throw new Error("No se pudieron cargar todos los datos de premios.");
      }
      if (version !== loadVersion.current) return;
      const [resEst, resSemanas, resTemas, resPuntajes] = results;
      if (![resEst, resSemanas, resTemas].every(result => Array.isArray(result?.data))) throw new Error("Datos académicos incompletos");

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
    } catch (err) {
      if (version !== loadVersion.current) return;
      console.error("Error al cargar datos para Premios de la Sección:", err);
      setLoadError("No pudimos actualizar la clasificación completa. Intenta cargar los datos nuevamente.");
    } finally {
      if (version === loadVersion.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [seccion?.id, carrera]);

  useEffect(() => {
    loadData();
    return () => { loadVersion.current++; };
  }, [loadData]);

  const studentsRanking = useMemo(
    () => buildSectionAwardsRanking(estudiantes, configPuntajes, temario, semanasConfig),
    [estudiantes, configPuntajes, temario, semanasConfig]
  );
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


      return true;
    });
  }, [studentsRanking, searchTerm, filterType]);

  // Los 3 mejores de la sección (Podio)
  const top3Winners = useMemo(() => {
    return studentsRanking.slice(0, 3);
  }, [studentsRanking]);

  const handleExportImage = async () => {
    if (exporting || loading || refreshing || loadError || !studentsRanking.length) return;
    setExporting(true);
    setExportError("");
    try {
      const { downloadAwardsImage } = await import("../utils/exportAwardsImage");
      await downloadAwardsImage(studentsRanking, seccion);
    } catch {
      setExportError("No pudimos preparar la imagen. Intenta descargarlo nuevamente.");
    } finally {
      setExporting(false);
    }
  };
  const points = value => value.toFixed(3);
  const sectionName = seccion?.codigo || seccion?.nombre_seccion || "Sección";
  const resetFilters = () => { setSearchTerm(""); setFilterType("todos"); };

  const renderBreakdown = student => (
    <details className="section-awards__detail">
      <summary>Ver desglose de calificaciones <ChevronDown size={16} aria-hidden="true" /></summary>
      <div className="section-awards__breakdown">
        {[
          { title: "Pruebas semanales", icon: FileText, items: student.pruebasDesglose.map(p => ({ name: p.nombre.toLowerCase().startsWith("semana") ? p.nombre : `Semana ${p.semana} · ${p.nombre}`, value: p.nota })) },
          { title: "Manuales", icon: BookOpen, items: student.manualesDesglose.map(m => ({ name: m.titulo || `Manual ${m.numero}`, value: m.nota })) },
          { title: "Exámenes parciales", icon: Medal, items: student.examenesDesglose.map(e => ({ name: e.parcial, value: e.nota })) }
        ].map(group => (
          <section key={group.title}>
            <h4><group.icon size={16} aria-hidden="true" />{group.title}</h4>
            {group.items.length ? <dl>{group.items.map((item, index) => <div key={index}><dt>{item.name}</dt><dd>{item.value === null ? <span className="section-awards__missing">Sin nota</span> : points(item.value)}</dd></div>)}</dl> : <p>No hay evaluaciones configuradas.</p>}
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
            <button type="button" className="section-awards__button section-awards__button--gold" onClick={handleExportImage} disabled={loading || refreshing || exporting || !!loadError || !studentsRanking.length}><Download size={17} aria-hidden="true" />{exporting ? "Preparando imagen…" : "Descargar podio"}</button>
          </div>
        </div>
      </header>

      {exportError && <p className="section-awards__error" role="alert">{exportError}</p>}

      {loadError && <div className="section-awards__error" role="alert"><AlertCircle size={21} aria-hidden="true" /><div><strong>No se pudo cargar la clasificación</strong><p>{loadError}</p></div><button type="button" className="section-awards__button" onClick={() => loadData(estudiantes.length > 0)} disabled={loading || refreshing}>Reintentar</button></div>}

      {loading ? <div className="section-awards__loading" role="status"><span className="section-awards__sr-only">Cargando premios de la sección…</span><div className="section-awards__skeleton-stats" aria-hidden="true">{[1,2,3].map(i => <div key={i} />)}</div><div className="section-awards__skeleton-podium" aria-hidden="true">{[1,2,3].map(i => <div key={i} />)}</div></div> : !loadError && <>
        <dl className="section-awards__stats">
          <div><Users size={20} aria-hidden="true" /><dt>Estudiantes</dt><dd>{studentsRanking.length}</dd></div>
          <div><Trophy size={20} aria-hidden="true" /><dt>Mayor puntaje</dt><dd>{studentsRanking.length ? points(studentsRanking[0].grandTotalPremios) : "—"}<small> pts</small></dd></div>
        </dl>



        {studentsRanking.length > 0 ? <>
          <section aria-labelledby="awards-podium-title">
            <div className="section-awards__section-heading"><div><p className="section-awards__eyebrow">Los primeros lugares</p><h3 id="awards-podium-title"><Crown size={21} aria-hidden="true" />Podio de la sección</h3></div><span>Según las notas registradas</span></div>
            <ol className="section-awards__podium">
              {top3Winners.map(student => <li key={student.id || student.cuenta} data-place={student.posicion}>
                <div className="section-awards__podium-top"><span className="section-awards__medal">{student.posicion === 1 ? <Crown size={24} aria-hidden="true" /> : <Medal size={24} aria-hidden="true" />}</span><span>{student.posicion}º lugar</span></div>
                <h4>{student.nombre}</h4><p className="section-awards__account">Cuenta: {student.cuenta}</p>
                <div className="section-awards__podium-score"><strong>{points(student.grandTotalPremios)}</strong><span>puntos para premios</span></div>
                <dl className="section-awards__podium-totals"><div><dt>Oro pruebas</dt><dd>{points(student.totalPruebas)}</dd></div><div><dt>Oro manuales</dt><dd>{points(student.totalManuales)}</dd></div><div><dt>Exámenes</dt><dd>{points(student.totalExamenes)}</dd></div></dl>
              </li>)}
            </ol>
          </section>

          <section className="section-awards__directory" aria-labelledby="awards-ranking-title">
            <div className="section-awards__section-heading"><div><p className="section-awards__eyebrow">Todos los resultados</p><h3 id="awards-ranking-title">Clasificación general</h3></div><div className="section-awards__view" role="group" aria-label="Visualización de la clasificación"><button type="button" aria-pressed={viewMode === "list"} onClick={() => setViewMode("list")}><List size={17} aria-hidden="true" />Listado</button><button type="button" aria-pressed={viewMode === "cards"} onClick={() => setViewMode("cards")}><LayoutGrid size={17} aria-hidden="true" />Tarjetas</button></div></div>
            <div className="section-awards__filters">
              <label className="section-awards__search"><span>Buscar estudiante</span><div><Search size={18} aria-hidden="true" /><input type="search" placeholder="Nombre o número de cuenta" value={searchTerm} onChange={event => setSearchTerm(event.target.value)} /></div></label>
              <div className="section-awards__filter-options" role="group" aria-label="Filtrar clasificación">{[["todos", "Todos", studentsRanking.length], ["top3", "Podio", top3Winners.length]].map(([value,label,count]) => <button type="button" key={value} aria-pressed={filterType === value} onClick={() => setFilterType(value)}>{label}<span>{count}</span></button>)}</div>
            </div>
            <p className="section-awards__results" role="status">{filteredRanking.length} de {studentsRanking.length} estudiantes · De mayor a menor puntaje</p>
            {filteredRanking.length ? <ol className={`section-awards__ranking section-awards__ranking--${viewMode}`} aria-label="Clasificación de estudiantes">
              {filteredRanking.map(student => <li className="section-awards__student" key={student.id || student.cuenta} data-podium={student.esPodio}>
                <div className="section-awards__student-main"><div className="section-awards__identity"><span className="section-awards__position" aria-label={`Puesto ${student.posicion}`}>{student.posicion <= 3 && <Medal size={15} aria-hidden="true" />}#{student.posicion}</span><div><h4>{student.nombre}</h4><p className="section-awards__account">Cuenta: {student.cuenta}</p></div></div><div className="section-awards__student-score"><span>Nota total real</span><strong>{points(student.grandTotalPremios)}<small> pts</small></strong></div></div>
                <dl className="section-awards__totals"><div><dt><FileText size={14} aria-hidden="true" />Oro de pruebas</dt><dd>{points(student.totalPruebas)}</dd></div><div><dt><BookOpen size={14} aria-hidden="true" />Oro de manuales</dt><dd>{points(student.totalManuales)}</dd></div><div><dt><Medal size={14} aria-hidden="true" />Exámenes</dt><dd>{points(student.totalExamenes)}</dd></div></dl>
                {renderBreakdown(student)}
              </li>)}
            </ol> : <div className="section-awards__empty"><Search size={30} aria-hidden="true" /><h3>No hay coincidencias</h3><p>Prueba otro nombre, número de cuenta o filtro.</p><button type="button" className="section-awards__button" onClick={resetFilters}>Limpiar filtros</button></div>}
          </section>
        </> : <div className="section-awards__empty"><Trophy size={36} aria-hidden="true" /><h3>El cuadro de honor empieza aquí</h3><p>Cuando haya estudiantes matriculados, verás su clasificación y el desglose de sus puntajes.</p></div>}
      </>}
    </section>
  );
}
