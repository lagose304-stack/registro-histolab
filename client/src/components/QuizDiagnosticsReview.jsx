import React, { useState } from "react";
import { api } from "../services/api";

export default function QuizDiagnosticsReview({ section, week, account }) {
  const [rows,setRows]=useState(null), [loading,setLoading]=useState(false), [error,setError]=useState("");
  const load=async()=>{
    if (loading) return;
    setLoading(true);setError("");
    try {
      const result=await api.pruebas.getDiagnostics(section,week,account);
      if (!result?.success) throw new Error();
      setRows(result.data || []);
    } catch { setError("No se pudo consultar el diagnóstico. Las faltas y las respuestas no cambian."); }
    finally { setLoading(false); }
  };
  const download=()=>{
    const report={version:1,seccion:section,semana:week,cuenta:account,nota:"Señales declaradas por el navegador. No identifican otra aplicación ni confirman Slide Over o copia.",lotes:rows};
    const url=URL.createObjectURL(new Blob([JSON.stringify(report,null,2)],{type:"application/json"}));
    const link=document.createElement("a");link.href=url;link.download="histolab-diagnostico-prueba.json";link.click();
    setTimeout(()=>URL.revokeObjectURL(url),1000);
  };
  const samples=rows?.flatMap(row=>row.datos?.muestras || []) || [];
  const devices=[...new Set((rows || []).map(row=>{const d=row.datos?.dispositivo || {};return `${d.navegador || "Otro"} ${d.version_navegador || "versión no informada"} · ${d.sistema || "Otro"} ${d.version_sistema || "versión no informada"}`;}))];
  return <details className="quiz-diagnostics-review" onToggle={event=>{if(event.currentTarget.open && rows===null && !error) void load();}}>
    <summary>Diagnóstico técnico de la prueba</summary>
    <p>Datos para investigar compatibilidad y multitarea. No añaden faltas ni prueban que se haya abierto otra aplicación. La ausencia de señales tampoco descarta multitarea.</p>
    {loading && <p role="status">Consultando diagnóstico…</p>}
    {error && <p role="alert">{error} <button type="button" onClick={load}>Reintentar diagnóstico</button></p>}
    {rows && !rows.length && <p>Sin diagnóstico recibido. Puede ser un intento anterior a la actualización, un envío pendiente o una captura no disponible.</p>}
    {rows?.length > 0 && <>
      <p>{samples.length} muestras recibidas en {rows.length} lotes · {new Set(rows.map(row=>row.intento_id)).size} intentos.</p>
      <ul>{devices.map(device=><li key={device}>{device}</li>)}</ul>
      <p>Se guardan cambios de foco, visibilidad, tamaño, orientación y conexión, con muestras periódicas. La captura y los envíos tienen límites; el registro puede estar incompleto.</p>
      <button type="button" onClick={download}>Descargar diagnóstico técnico</button>
    </>}
  </details>;
}
