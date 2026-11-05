import React, { useState, useEffect, useCallback, useMemo } from "react";
import { BookOpen, Calendar, Crown, Save, Search, Users } from "lucide-react";
import { api } from "../services/api";
import { displaySectionCode } from "../../../shared/sectionCode.mjs";
import { synchronizeQuizAssignments } from "../../../shared/quizAssignments.mjs";
import { hasFullSectionAccess } from "../utils/sectionRoleUtils";
import { getManualsWindow } from "../../../shared/manualsWindow.mjs";
import "./SectionAssignmentsView.css";

// Nombres oficiales de los 5 Roles de Sección
const ROLES = {
  CREAR_PRUEBA: "Crear prueba semanal",
  MANUALES: "Subir nota de manuales semanal",
  PRUEBAS: "Revisión de prueba semanal",
  EXAMENES: "Subir nota de examen parcial",
  ASISTENCIA: "Pasar lista de asistencia semanal"
};

const CLASS_ROLES = [ROLES.ASISTENCIA, ROLES.CREAR_PRUEBA, ROLES.PRUEBAS, ROLES.MANUALES];

export default function SectionAssignmentsView({ seccion, currentInstructor, notify = () => {} }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [saveError, setSaveError] = useState("");
  const [changedWeeks, setChangedWeeks] = useState(() => new Set());
  const [saveTarget, setSaveTarget] = useState(null);

  const [manualDates, setManualDates] = useState({});
  const [savedManualDates, setSavedManualDates] = useState({});
  const [dateSavingWeek, setDateSavingWeek] = useState(null);
  const [dateErrors, setDateErrors] = useState({});
  const canConfigureDate = hasFullSectionAccess(currentInstructor || api.auth.getCurrentInstructor(), seccion);

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
        rolLabel: "Titular de sección"
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
    setLoadError("");

    try {
      const [resTemario, resSchedule, resInst, resAsig] = await Promise.all([
        api.temario.getAll({ carrera }),
        api.estudiantes.getManualSchedule(seccion.id),
        api.auth.getInstructores(),
        api.asignaciones.getBySeccion(seccion.id)
      ]);

      if (resTemario?.data) {
        setTemario(resTemario.data);
      }
      setSemanasConfig(resSchedule?.weeks || []);
      const dates = Object.fromEntries((resSchedule?.data || []).map(item => [item.numero_semana, item.fecha_carga]));
      setManualDates(dates);
      setSavedManualDates(dates);
      setDateErrors({});
      if (resInst?.data) {
        setAllInstructores(resInst.data);
      }

      // Procesar asignaciones existentes
      const asigList = resAsig?.data || (Array.isArray(resAsig) ? resAsig : []);
      const map = {};
      synchronizeQuizAssignments(asigList).forEach((a) => {
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
      setChangedWeeks(new Set());
    } catch (err) {
      console.error("Error al cargar datos de asignaciones:", err);
      setLoadError("No pudimos cargar las asignaciones de la sección.");
    } finally {
      setLoading(false);
    }
  }, [seccion?.id, seccion?.coordinador, carrera]);

  useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);

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

  const getWeekDisplayName = (week) => {
    const name = (week.nombre_semana || week.descripcion || "")
      .replace(/^Semana\s*\d+\s*(?:[-:•–—]\s*)?/i, "").trim();
    const topicNames = (topicsByWeek[week.numero_semana] || []).map(topic => topic.titulo).filter(Boolean);
    const detail = name || topicNames.join(", ") || week.temasDesc ||
      (week.esExamen ? `Examen ${week.parcial}` : "");
    return detail ? `Semana ${week.numero_semana} - ${detail}` : `Semana ${week.numero_semana}`;
  };

  // Manejar cambio de asignación en memoria local
  const handleAssignmentChange = (tipo, referencia, instructorId) => {
    const key = `${tipo}__${referencia}`;
    setAssignmentsMap((prev) => {
      const next = {
        ...prev,
        [key]: instructorId || ""
      };

      // El asignado a crear la prueba y revisarla deben ser el mismo obligatoriamente
      if (tipo === ROLES.CREAR_PRUEBA) {
        next[`${ROLES.PRUEBAS}__${referencia}`] = instructorId || "";
        next[`Subir nota de prueba semanal__${referencia}`] = instructorId || "";
      } else if (tipo === ROLES.PRUEBAS || tipo === "Subir nota de prueba semanal") {
        next[`${ROLES.CREAR_PRUEBA}__${referencia}`] = instructorId || "";
        next[`${ROLES.PRUEBAS}__${referencia}`] = instructorId || "";
        next[`Subir nota de prueba semanal__${referencia}`] = instructorId || "";
      }

      return next;
    });
    setChangedWeeks(previous => new Set(previous).add(referencia));
  };

  // Guardar las asignaciones de una semana
  const handleSaveWeek = async (week) => {
    if (!seccion?.id || saving) return;
    setSaving(true);
    setSaveTarget(week.numero_semana);
    setSaveError("");

    try {
      const coordMember = sectionMembers.find((m) => m.esCoordinador) || sectionMembers[0];
      const coordId = coordMember?.id || `coord-${seccion.id}`;

      const weekRef = `semana_${week.numero_semana}`;
      const partial = (week.parcial || "").toUpperCase();
      const examRef = week.esExamen
        ? `examen_${partial.includes("III") || partial.includes("TERCER") ? "III" : partial.includes("II") || partial.includes("SEGUNDO") ? "II" : "I"}`
        : null;
      const payload = Object.entries(assignmentsMap).filter(([key]) => {
        const [role, reference] = key.split("__");
        return role !== ROLES.MANUALES && (reference === weekRef || reference === examRef);
      }).map(([key, instId]) => {
        const [tipo_asignacion, referencia_id] = key.split("__");
        let finalId = instId;
        let finalNombre = "";

        if (tipo_asignacion === ROLES.EXAMENES) {
          finalId = coordId;
          finalNombre = coordMember ? coordMember.nombre : (seccion?.coordinador || "Titular de sección");
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
      setChangedWeeks(previous => {
        const remaining = new Set(previous);
        remaining.delete(weekRef);
        return remaining;
      });
      notify(`Asignaciones de la semana ${week.numero_semana} guardadas`, "success");
    } catch (err) {
      console.error("Error al guardar asignaciones:", err);
      setSaveError(err.message || "No pudimos guardar las asignaciones. Inténtalo de nuevo.");
    } finally {
      setSaving(false);
    }
  };

  const handleSaveManualDate = async weekNumber => {
    const date = manualDates[weekNumber];
    if (!canConfigureDate || dateSavingWeek !== null || !date) return;
    setDateSavingWeek(weekNumber);
    setDateErrors(previous => ({ ...previous, [weekNumber]: "" }));
    try {
      const result = await api.estudiantes.saveManualDate(seccion.id, weekNumber, date);
      setSavedManualDates(previous => ({ ...previous, [weekNumber]: result.data.fecha_carga }));
      notify(`Fecha de carga de manuales de la semana ${weekNumber} guardada`, "success");
    } catch (error) {
      setDateErrors(previous => ({ ...previous, [weekNumber]: error.message || "No pudimos guardar la fecha. Inténtalo de nuevo." }));
    } finally {
      setDateSavingWeek(null);
    }
  };

  // Contador de carga de trabajo por cada miembro de la sección
  const workloadStats = useMemo(() => {
    const counts = {};
    const manualWeeks = academicWeeks.filter(week => !week.esExamen).length;
    sectionMembers.forEach((m) => {
      counts[m.id] = {
        manuales: manualWeeks,
        pruebas: 0,
        examenes: 0,
        asistencia: 0,
        total: manualWeeks
      };
    });

    Object.entries(assignmentsMap).forEach(([key, instId]) => {
      if (!instId || !counts[instId]) return;
      const [tipo] = key.split("__");

      if (tipo === ROLES.MANUALES) return;
      if (tipo === ROLES.PRUEBAS) counts[instId].pruebas++;
      else if (tipo === ROLES.EXAMENES) counts[instId].examenes++;
      else if (tipo === ROLES.ASISTENCIA) counts[instId].asistencia++;

      counts[instId].total++;
    });

    return counts;
  }, [sectionMembers, assignmentsMap, academicWeeks]);

  // Filtrado de semanas según búsqueda y parcial
  const filteredWeeks = useMemo(() => {
    return academicWeeks.filter((w) => {
      // Filtro por Parcial
      if (selectedParcialFilter !== "TODOS") {
        if (w.parcial !== selectedParcialFilter) {
          return false;
        }
      }

      // Filtro por Búsqueda
      if (searchTerm.trim()) {
        const s = searchTerm.trim().toLowerCase();
        const semStr = `semana ${w.numero_semana}`;
        const matchSem = semStr.includes(s) || String(w.numero_semana) === s;
        const matchParcial = w.parcial.toLowerCase().includes(s);

        const topics = topicsByWeek[w.numero_semana] || [];
        const matchTopics = topics.some((t) => (t.titulo || "").toLowerCase().includes(s));

        return matchSem || matchParcial || matchTopics || getWeekDisplayName(w).toLowerCase().includes(s);
      }

      return true;
    });
  }, [academicWeeks, selectedParcialFilter, searchTerm, topicsByWeek]);

  const partials = [...new Set(academicWeeks.map(week => week.parcial))];
  const titularName = sectionMembers.find(member => member.esCoordinador)?.nombre || seccion?.coordinador;
  const renderRole = (role, week) => {
    const ref = `semana_${week.numero_semana}`;
    const value = assignmentsMap[`${role}__${ref}`] ||
      (role === ROLES.PRUEBAS ? assignmentsMap[`Subir nota de prueba semanal__${ref}`] : "") || "";
    if (role === ROLES.MANUALES) {
      return (
        <div className="section-assignments__role" key={role}>
          <strong>{role}</strong>
          <p className="section-assignments__titular"><Users size={16} aria-hidden="true" /> Todos</p>
          <small>Todo el equipo docente de la sección</small>
        </div>
      );
    }
    if (role === ROLES.PRUEBAS) {
      const creatorId = assignmentsMap[`${ROLES.CREAR_PRUEBA}__${ref}`] || "";
      const creator = sectionMembers.find(member => member.id === creatorId);
      return (
        <div className="section-assignments__role" key={role}>
          <strong>{role}</strong>
          <p>{creator?.nombre || "Sin asignar"}</p>
          <small>Revisa quien crea la prueba semanal</small>
        </div>
      );
    }
    if (role === ROLES.EXAMENES) {
      return (
        <div className="section-assignments__role" key={role}>
          <strong>{role}</strong>
          <p className="section-assignments__titular"><Crown size={16} aria-hidden="true" /> {titularName || "Titular de sección"}</p>
          <small>Asignado al titular de sección</small>
        </div>
      );
    }

    return (
      <label className="user-field section-assignments__role" key={role}>
        {role}
        <select value={value} disabled={saving} onChange={event => handleAssignmentChange(role, ref, event.target.value)}>
          <option value="">Sin asignar</option>
          {sectionMembers.map(member => (
            <option key={member.id} value={member.id}>
              {member.nombre}{member.esCoordinador ? " · Titular de sección" : ""}
            </option>
          ))}
        </select>
      </label>
    );
  };

  return (
    <section className="user-directory section-assignments" aria-labelledby="section-assignments-title">
      <header className="user-directory__hero">
        <div>
          <p className="user-directory__eyebrow"><Users size={17} aria-hidden="true" /> Sección {displaySectionCode(seccion?.codigo)} · {carrera}</p>
          <h2 id="section-assignments-title">Proporcionar asignaciones</h2>
          <p>Distribuye las tareas del equipo docente por semana.</p>
        </div>
      </header>

      {loading ? (
        <p className="user-directory__state" role="status">Cargando semanas y asignaciones…</p>
      ) : loadError ? (
        <div className="user-directory__state" role="alert">
          <p>{loadError}</p>
          <button type="button" className="user-button" onClick={loadInitialData}>Reintentar</button>
        </div>
      ) : (
        <>
          <details className="section-assignments__team">
            <summary>Equipo docente y distribución de tareas · {sectionMembers.length}</summary>
            <ul className="section-assignments__team-list">
              {sectionMembers.map(member => {
                const stats = workloadStats[member.id];
                return (
                  <li key={member.id} data-titular={member.esCoordinador}>
                    <strong>{member.nombre}</strong>
                    <span>{member.rolLabel} · {stats.total} asignaciones</span>
                    <span>Manuales {stats.manuales} · Pruebas {stats.pruebas} · Exámenes {stats.examenes} · Asistencia {stats.asistencia}</span>
                  </li>
                );
              })}
            </ul>
          </details>

          <div className="section-assignments__filters">
            <label className="user-field">Parcial
              <select value={selectedParcialFilter} onChange={event => setSelectedParcialFilter(event.target.value)}>
                <option value="TODOS">Todos los parciales</option>
                {partials.map(partial => <option key={partial}>{partial}</option>)}
              </select>
            </label>
            <label className="user-field">
              Buscar semana o tema
              <span className="user-directory__search">
                <Search size={17} aria-hidden="true" />
                <input type="search" value={searchTerm} onChange={event => setSearchTerm(event.target.value)}
                  placeholder="Número de semana o tema" />
              </span>
            </label>
          </div>

          <p className="section-assignments__count" role="status">
            {filteredWeeks.length} de {academicWeeks.length} semanas
          </p>

          {filteredWeeks.length === 0 ? (
            <p className="user-directory__state">{academicWeeks.length ? "Ninguna semana coincide con los filtros."
              : "Aún no hay semanas académicas para esta carrera."}</p>
          ) : filteredWeeks.map(week => {
            const isExam = isWeekExam(week);
            const topics = topicsByWeek[week.numero_semana] || [];
            const isBeforeExam = getManualsWindow(seccion, semanasConfig, week.numero_semana).isSpecial;
            const dateChanged = (manualDates[week.numero_semana] || "") !== (savedManualDates[week.numero_semana] || "");
            return (
              <article className="section-assignments__week" data-exam={isExam} key={week.numero_semana}>
                <header>
                  <p>Semana {week.numero_semana} · {week.parcial} · {isExam ? "Examen" : "Clase"}</p>
                  <h3>{getWeekDisplayName(week)}</h3>
                  {week.fecha_inicio && week.fecha_fin && <p>{week.fecha_inicio} – {week.fecha_fin}</p>}
                </header>
                {!isExam && (
                  <div className="section-assignments__topics">
                    <strong><BookOpen size={16} aria-hidden="true" /> Temas y manuales</strong>
                    {topics.length ? <ul>{topics.map(topic => <li key={topic.id}>{topic.titulo}</li>)}</ul>
                      : <p>{week.temasDesc || "Sin temas asignados."}</p>}
                  </div>
                )}
                <div className="section-assignments__roles">
                  {(isExam ? [ROLES.EXAMENES, ROLES.ASISTENCIA] : CLASS_ROLES).map(role => renderRole(role, week))}
                </div>
                {isBeforeExam && canConfigureDate && (
                  <form className="section-assignments__manual-date" onSubmit={event => {
                    event.preventDefault();
                    handleSaveManualDate(week.numero_semana);
                  }}>
                    <div className="section-assignments__manual-date-heading">
                      <Calendar size={20} aria-hidden="true" />
                      <div><h4>Carga de manuales · Previa al examen</h4>
                        <p>Elige el día en que todo el equipo podrá subir las notas de los manuales de esta semana. Se habilitará durante todo ese día.</p></div>
                    </div>
                    <label className="user-field" htmlFor={`manual-date-${week.numero_semana}`}>Día de carga de manuales
                      <input id={`manual-date-${week.numero_semana}`} type="date" required
                        value={manualDates[week.numero_semana] || ""} disabled={dateSavingWeek === week.numero_semana}
                        onChange={event => {
                          const date = event.target.value;
                          setManualDates(previous => ({ ...previous, [week.numero_semana]: date }));
                          setDateErrors(previous => ({ ...previous, [week.numero_semana]: "" }));
                        }} />
                    </label>
                    <button type="submit" className="user-button user-button--primary"
                      disabled={dateSavingWeek !== null || !manualDates[week.numero_semana] || !dateChanged}>
                      <Save size={17} aria-hidden="true" /> {dateSavingWeek === week.numero_semana ? "Guardando fecha…" : "Guardar fecha"}
                    </button>
                    <p className="section-assignments__date-status" role="status">{dateChanged ? "Fecha sin guardar" : savedManualDates[week.numero_semana] ? "Fecha guardada" : "Fecha pendiente de definir"}</p>
                    {dateErrors[week.numero_semana] && <p className="user-dialog__error section-assignments__date-status" role="alert">{dateErrors[week.numero_semana]}</p>}
                  </form>
                )}
                {saveTarget === week.numero_semana && saveError && (
                  <p className="user-dialog__error" role="alert">{saveError}</p>
                )}
                <div className="section-assignments__week-save">
                  <p role="status">{changedWeeks.has(`semana_${week.numero_semana}`) ? "Cambios sin guardar" : "Sin cambios pendientes"}</p>
                  <button type="button" className="user-button user-button--primary"
                    disabled={saving} onClick={() => handleSaveWeek(week)}>
                    <Save size={17} aria-hidden="true" /> {saving && saveTarget === week.numero_semana ? "Guardando…" : "Guardar semana"}
                  </button>
                </div>
              </article>
            );
          })}


        </>
      )}
    </section>
  );
}
