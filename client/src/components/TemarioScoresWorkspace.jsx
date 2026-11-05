import React, { useState, useEffect, useMemo, useCallback } from "react";
import { api } from "../services/api";

export default function TemarioScoresWorkspace({ carrera, topics, notify }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [saveError, setSaveError] = useState("");
  const [saved, setSaved] = useState(false);

  // Semanas y temas de la carrera para calcular cantidades reales
  const [semanasConfig, setSemanasConfig] = useState([]);

  // Estados de puntajes (sin valores por defecto)
  const [notaManuales, setNotaManuales] = useState("");
  const [notaPruebas, setNotaPruebas] = useState("");
  const [examenesPuntajes, setExamenesPuntajes] = useState({});

  // Cargar datos de la carrera
  const loadData = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    setSaveError("");
    setSaved(false);
    try {
      const [resSemanas, resPuntajes] = await Promise.all([
        api.semanas.getConfig(carrera),
        api.temario.getPuntajes(carrera)
      ]);

      if (resSemanas?.data) {
        setSemanasConfig(resSemanas.data);
      }

      // Semanas de examen para esta carrera
      const exams = (resSemanas?.data || []).filter(
        (w) => Boolean(w.es_examen) || (w.temas || "").toUpperCase().includes("EXAMEN")
      );

      // Si ya existen puntajes guardados
      if (resPuntajes?.data) {
        const d = resPuntajes.data;
        setNotaManuales(
          d.nota_total_manuales !== null && d.nota_total_manuales !== undefined
            ? String(d.nota_total_manuales)
            : ""
        );
        setNotaPruebas(
          d.nota_total_pruebas !== null && d.nota_total_pruebas !== undefined
            ? String(d.nota_total_pruebas)
            : ""
        );
        const currentExams = d.examenes || {};

        const initEx = {};
        exams.forEach((w) => {
          const sem = String(w.numero_semana);
          initEx[sem] =
            currentExams[sem] !== undefined && currentExams[sem] !== null
              ? String(currentExams[sem])
              : "";
        });
        setExamenesPuntajes(initEx);
      } else {
        // Cero valores por defecto: campos limpios
        setNotaManuales("");
        setNotaPruebas("");
        const initEx = {};
        exams.forEach((w) => {
          initEx[String(w.numero_semana)] = "";
        });
        setExamenesPuntajes(initEx);
      }
    } catch (err) {
      console.error("Error al cargar configuración de puntajes:", err);
      setLoadError("No pudimos cargar los puntajes de la carrera.");
    } finally {
      setLoading(false);
    }
  }, [carrera]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Semanas de examen que realmente existen para esta carrera
  const examWeeks = useMemo(() => {
    if (!Array.isArray(semanasConfig) || semanasConfig.length === 0) return [];
    return semanasConfig
      .filter((w) => Boolean(w.es_examen) || (w.temas || "").toUpperCase().includes("EXAMEN"))
      .sort((a, b) => Number(a.numero_semana) - Number(b.numero_semana));
  }, [semanasConfig]);

  // Temas que tienen manual evaluable
  const temasConManual = useMemo(() => {
    return topics.filter((t) => t.tiene_manual !== false);
  }, [topics]);

  // Semanas regulares de clase (sin examen) para pruebas
  const semanasRegulares = useMemo(() => {
    return semanasConfig.filter(
      (w) => !w.es_examen && !(w.temas || "").toUpperCase().includes("EXAMEN")
    );
  }, [semanasConfig]);

  // Cálculo reactivo del promedio por manual según el valor actual escrito
  const promedioPorManual = useMemo(() => {
    const count = temasConManual.length;
    if (!count) return null;
    const clean = String(notaManuales).trim();
    if (!clean) return null;
    const pts = parseFloat(clean);
    if (isNaN(pts) || pts <= 0) return null;
    const val = pts / count;
    return Math.round(val * 1000) / 1000;
  }, [temasConManual.length, notaManuales]);

  // Cálculo reactivo del promedio por prueba semanal según el valor actual escrito
  const promedioPorPrueba = useMemo(() => {
    const count = semanasRegulares.length;
    if (!count) return null;
    const clean = String(notaPruebas).trim();
    if (!clean) return null;
    const pts = parseFloat(clean);
    if (isNaN(pts) || pts <= 0) return null;
    const val = pts / count;
    return Math.round(val * 1000) / 1000;
  }, [semanasRegulares.length, notaPruebas]);

  // Manejo de cambio en inputs numéricos con soporte para hasta 3 decimales
  const handleDecimalChange = (raw, setter) => {
    setSaved(false);
    const clean = String(raw).replace(",", ".");
    if (clean === "" || /^\d*(\.\d{0,3})?$/.test(clean)) {
      setter(clean);
    }
  };

  const handleExamScoreChange = (semNum, raw) => {
    setSaved(false);
    const clean = String(raw).replace(",", ".");
    if (clean === "" || /^\d*(\.\d{0,3})?$/.test(clean)) {
      setExamenesPuntajes((prev) => ({
        ...prev,
        [String(semNum)]: clean
      }));
    }
  };

  // Suma de los exámenes ingresados
  const sumaExamenes = useMemo(() => {
    let sum = 0;
    Object.values(examenesPuntajes).forEach((val) => {
      sum += Number(val) || 0;
    });
    return Math.round(sum * 1000) / 1000;
  }, [examenesPuntajes]);

  // Cálculo del puntaje total en tiempo real (suma de manuales + pruebas + todos los exámenes)
  const totalCalculado = useMemo(() => {
    const m = Number(notaManuales) || 0;
    const p = Number(notaPruebas) || 0;
    return Math.round((m + p + sumaExamenes) * 1000) / 1000;
  }, [notaManuales, notaPruebas, sumaExamenes]);

  // Guardar puntajes
  const handleSave = async (event) => {
    event.preventDefault();
    if (saving) return;
    setSaveError("");
    setSaved(false);
    const valManuales = Number(notaManuales) || 0;
    const valPruebas = Number(notaPruebas) || 0;

    const formattedExams = {};
    Object.entries(examenesPuntajes).forEach(([sem, val]) => {
      formattedExams[sem] = Math.round((Number(val) || 0) * 1000) / 1000;
    });

    setSaving(true);
    try {
      const payload = {
        nota_total_manuales: Math.round(valManuales * 1000) / 1000,
        nota_total_pruebas: Math.round(valPruebas * 1000) / 1000,
        examenes: formattedExams,
        puntaje_total: totalCalculado
      };

      const res = await api.temario.savePuntajes(carrera, payload);
      notify(res.message || `Puntajes de ${carrera} guardados exitosamente.`, "success");
      setSaved(true);
    } catch (err) {
      console.error("Error al guardar puntajes:", err);
      setSaveError(err.message || "No pudimos guardar los puntajes.");
    } finally {
      setSaving(false);
    }
  };

  // Helper para nombre visible de semana de examen
  const getExamTitle = (w, index) => {
    const custom = (w.nombre_semana || w.descripcion || "").trim();
    if (custom && !custom.toLowerCase().startsWith("semana")) {
      return custom;
    }
    return `Examen Parcial ${index + 1}`;
  };

  return (
    <section className="temario-workspace">
      <header>
        <h3>Puntajes de {carrera}</h3>
        <p>Define cuánto valen los manuales, las pruebas y cada examen. El total se calcula al escribir.</p>
      </header>
      {loading ? <p role="status">Cargando puntajes…</p> : loadError ? (
        <div className="user-directory__state" role="alert">
          <p>{loadError}</p>
          <button type="button" className="user-button" onClick={loadData}>Reintentar</button>
        </div>
      ) : (
        <form className="temario-week-form" onSubmit={handleSave}>
          <fieldset className="temario-week-topics">
            <legend>Trabajo de clase</legend>
            <div className="temario-form-grid">
              <label className="user-field">Total de manuales
                <input inputMode="decimal" value={notaManuales} onChange={event => handleDecimalChange(event.target.value, setNotaManuales)} />
                <small>{temasConManual.length} manuales evaluables{promedioPorManual !== null ? ` · ${promedioPorManual} puntos por manual` : ""}</small>
              </label>
              <label className="user-field">Total de pruebas
                <input inputMode="decimal" value={notaPruebas} onChange={event => handleDecimalChange(event.target.value, setNotaPruebas)} />
                <small>{semanasRegulares.length} semanas de clase{promedioPorPrueba !== null ? ` · ${promedioPorPrueba} puntos por prueba` : ""}</small>
              </label>
            </div>
          </fieldset>
          <fieldset className="temario-week-topics">
            <legend>Exámenes</legend>
            {examWeeks.length ? <div className="temario-form-grid">
              {examWeeks.map((week, index) => (
                <label className="user-field" key={week.numero_semana}>{getExamTitle(week, index)}
                  <input inputMode="decimal" value={examenesPuntajes[String(week.numero_semana)] ?? ""}
                    onChange={event => handleExamScoreChange(week.numero_semana, event.target.value)} />
                  <small>Semana {week.numero_semana}{week.parcial ? ` · ${week.parcial}` : ""}</small>
                </label>
              ))}
            </div> : <p>Marca una semana como examen en la pestaña Semanas para asignarle puntos.</p>}
          </fieldset>
          <div className="temario-score-summary">
            <div><span>Puntaje total</span><strong>{totalCalculado} puntos</strong></div>
            <p>Manuales {Number(notaManuales) || 0} · Pruebas {Number(notaPruebas) || 0} · Exámenes {sumaExamenes}</p>
          </div>
          {saveError && <p className="user-dialog__error" role="alert">{saveError}</p>}
          {saved && <p className="temario-feedback" role="status">Puntajes guardados.</p>}
          <div className="temario-inline-actions">
            <button type="button" className="user-button" disabled={saving} onClick={loadData}>Restaurar guardados</button>
            <button type="submit" className="user-button user-button--primary" disabled={saving}>{saving ? "Guardando…" : "Guardar puntajes"}</button>
          </div>
        </form>
      )}
    </section>
  );
}
