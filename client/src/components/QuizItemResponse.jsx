import React, { useId } from "react";
import { quizMatchingOptions, quizItemSlotCount, completionParts, completionBlankCount } from "../../../shared/quizItems.mjs";
import "./QuizItemResponse.css";

export default function QuizItemResponse({ item, value, onChange = () => {}, disabled = false, onBlur, onPasteBlocked }) {
  const name = useId();
  const label = item.instruccion || item.etiqueta || "Respuesta";
  const blockPaste = event => { if (onPasteBlocked) { event.preventDefault(); onPasteBlocked(); } };
  if (item.tipo === "seleccion_multiple" || item.tipo === "verdadero_falso") {
    const options = item.tipo === "verdadero_falso" ? ["Verdadero", "Falso"] : (item.opciones || []).map(option => option.texto);
    return <fieldset className="quiz-response quiz-response--choices" disabled={disabled} aria-label={label}>
      <legend className="quiz-response__sr">{label}</legend>
      {options.map((option, index) => <label className="quiz-response__choice" data-selected={value === option && Boolean(option)} key={index}>
        <input type="radio" name={name} value={option} checked={Boolean(option) && value === option} onChange={() => onChange(option)} onBlur={onBlur} />
        <span>{item.tipo === "seleccion_multiple" && <b>{String.fromCharCode(65 + index)}.</b>} {option || `Opción ${index + 1}`}</span>
      </label>)}
      <small>Selecciona una respuesta.</small>
    </fieldset>;
  }
  if (item.tipo === "terminos_pareados") {
    const options = quizMatchingOptions(item);
    return <div className="quiz-response quiz-response--pairs">
    {(item.pares || []).map((pair, index) => <label className="quiz-response__pair" key={pair.id || index}>
      <span><b>{index + 1}.</b> {pair.termino || `Término ${index + 1}`}</span>
      <select aria-label={`Definición para ${pair.termino || `término ${index + 1}`}`} disabled={disabled} value={Array.isArray(value) ? value[index] || "" : ""} onBlur={onBlur} onChange={event => {
        const next = Array.from({ length: item.pares.length }, (_, slot) => Array.isArray(value) ? value[slot] || "" : "");
        next[index] = event.target.value; onChange(next);
      }}><option value="">Seleccionar definición</option>{options.map(option => <option key={option} value={option}>{option}</option>)}</select>
      {Array.isArray(value) && value[index] && <small className="quiz-response__selected-definition">{value[index]}</small>}
    </label>)}
  </div>;
  }
  if (item.tipo === "completacion") return <div className="quiz-response quiz-response--completion"><p>
    {completionParts(item.texto_completar).map((part,index,parts)=><React.Fragment key={index}>{part}{index < parts.length - 1 && <input type="text" className="sp-quiz-input" aria-label={`${label} · Espacio ${index + 1}`} placeholder={`Espacio ${index + 1}`} value={Array.isArray(value) ? value[index] || "" : ""} disabled={disabled} onBlur={onBlur} onPaste={blockPaste} autoComplete="off" autoCorrect="off" spellCheck={false} onChange={event=>{
      const next=Array.from({length:completionBlankCount(item.texto_completar)},(_,slot)=>Array.isArray(value)?value[slot]||"":""); next[index]=event.target.value;onChange(next);
    }} />}</React.Fragment>)}
  </p>{!completionBlankCount(item.texto_completar) && <small>La oración aún no tiene espacios para completar.</small>}</div>;
  if (item.tipo === "texto_corto") return <div className="quiz-response"><textarea className="sp-quiz-input sp-quiz-textarea" aria-label={label} rows={2} value={typeof value === "string" ? value : ""} disabled={disabled} onChange={event => onChange(event.target.value)} onBlur={onBlur} onPaste={blockPaste} autoComplete="off" autoCorrect="off" spellCheck={false} placeholder="Escribe tu respuesta" /></div>;
  return <div className="quiz-response quiz-response--list">
    {Array.from({ length: quizItemSlotCount(item) }, (_, index) => <label key={index}><span>{index + 1}.</span><input className="sp-quiz-input" type="text" aria-label={`${label} · Respuesta ${index + 1}`} value={Array.isArray(value) ? value[index] || "" : ""} disabled={disabled} onBlur={onBlur} onPaste={blockPaste} autoComplete="off" autoCorrect="off" spellCheck={false} placeholder={`Respuesta ${index + 1}`} onChange={event => {
      const next = Array.from({ length: quizItemSlotCount(item) }, (_, slot) => Array.isArray(value) ? value[slot] || "" : "");
      next[index] = event.target.value; onChange(next);
    }} /></label>)}
  </div>;
}
