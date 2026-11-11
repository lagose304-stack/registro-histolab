import GradeInput from "./GradeInput";
import QuizAnswerCountInput from "./QuizAnswerCountInput";
import { isAutomaticQuizItem } from "../../../shared/quizAutoGrading.mjs";
import React, { useId } from "react";
import { Plus, Trash2 } from "lucide-react";
import { QUIZ_ITEM_TYPES, createQuizItem, quizItemIssues, completionBlankCount } from "../../../shared/quizItems.mjs";

const newId = prefix => `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2,8)}`;
export default function QuizItemEditor({ item, index, onChange, onRemove }) {
  const name = useId();
  const issues = quizItemIssues(item);
  const options = item.opciones || [];
  const pairs = item.pares || [];
  const answersText = item.respuestas_posibles_texto ?? (item.respuestas_esperadas?.length ? item.respuestas_esperadas.join("\n") : item.respuesta_modelo || "");
  const patch = changes => onChange({ ...item, ...changes });
  return <section className="section-quizzes__item quiz-item-editor" aria-label={`Apartado ${index + 1}`}>
    <header><h4>Apartado {index + 1}</h4><button type="button" className="user-button user-button--danger" aria-label={`Eliminar apartado ${index + 1}`} onClick={onRemove}><Trash2 size={17} aria-hidden="true" /></button></header>
    {isAutomaticQuizItem(item) && <p className="quiz-item-editor__auto">Calificación automática al entregar, según la respuesta correcta configurada aquí.</p>}
    <div className="quiz-item-editor__basics">
      <label className="user-field">Tipo de apartado<select value={item.tipo} onChange={event => {
        const type = event.target.value;
        if (!window.confirm("Cambiar el tipo reemplazará sus opciones y respuestas modelo. ¿Continuar?")) return;
        onChange({ ...createQuizItem(type,item.id), instruccion:item.instruccion || "", etiqueta:item.etiqueta || "", puntos:item.puntos });
      }}>{QUIZ_ITEM_TYPES.map(type => <option value={type.id} key={type.id}>{type.label}</option>)}</select></label>
      <label className="user-field">Puntos del apartado<GradeInput max={1} value={item.puntos ?? 1} onValueChange={value => patch({ puntos:value === "" ? 0 : Number(value) })} /><small>La suma de la pregunta puede llegar hasta 1 punto.</small></label>
    </div>
    <label className="user-field">{item.tipo === "verdadero_falso" ? "Afirmación para el estudiante" : "Instrucción para el estudiante"}<textarea aria-label={item.tipo === "verdadero_falso" ? "Afirmación para el estudiante" : "Instrucción para el estudiante"} rows={2} value={item.instruccion || item.etiqueta || ""} placeholder={item.tipo === "verdadero_falso" ? "Ej. El epitelio carece de vasos sanguíneos." : "Explica claramente qué debe responder el estudiante."} onChange={event => patch({ instruccion:event.target.value, etiqueta:event.target.value })} /></label>
    {item.tipo === "seleccion_multiple" ? <div className="quiz-item-editor__answer-key">
      <h5>Opciones y respuesta correcta · Solo docente</h5><p>Escribe entre 2 y 8 opciones. Marca el círculo de la única respuesta correcta.</p>
      {options.map((option, optionIndex) => <div className="quiz-item-editor__option" key={option.id} data-correct={item.respuesta_correcta === option.id}>
        <label className="quiz-item-editor__correct"><input type="radio" name={name} checked={item.respuesta_correcta === option.id} onChange={() => patch({ respuesta_correcta:option.id })} aria-label={`Marcar opción ${optionIndex + 1} como correcta`} /><span>{String.fromCharCode(65 + optionIndex)}</span></label>
        <input type="text" value={option.texto || ""} aria-label={`Texto de opción ${optionIndex + 1}`} placeholder={`Opción ${String.fromCharCode(65 + optionIndex)}`} onChange={event => patch({ opciones:options.map(row => row.id === option.id ? {...row,texto:event.target.value} : row) })} />
        <button type="button" className="user-button user-button--danger" disabled={options.length <= 2} aria-label={`Eliminar opción ${optionIndex + 1}`} onClick={() => patch({ opciones:options.filter(row => row.id !== option.id), respuesta_correcta:item.respuesta_correcta === option.id ? "" : item.respuesta_correcta })}><Trash2 size={16} aria-hidden="true" /></button>
      </div>)}
      <button type="button" className="user-button" disabled={options.length >= 8} onClick={() => patch({ opciones:[...options,{id:newId("op"),texto:""}] })}><Plus size={16} aria-hidden="true" /> Añadir opción</button>
    </div> : item.tipo === "verdadero_falso" ? <div className="quiz-item-editor__answer-key"><h5>Respuesta correcta · Solo docente</h5><div className="quiz-item-editor__boolean">{["Verdadero","Falso"].map(answer => <label key={answer} data-correct={item.respuesta_correcta === answer}><input type="radio" name={name} checked={item.respuesta_correcta === answer} onChange={() => patch({ respuesta_correcta:answer })} />{answer}</label>)}</div></div>
    : item.tipo === "terminos_pareados" ? <div className="quiz-item-editor__answer-key"><h5>Pares correctos · Solo docente</h5><p>Escribe cada término junto a su definición correcta. El estudiante verá las definiciones en un orden diferente y deberá relacionarlas.</p>
      {pairs.map((pair,pairIndex) => <div className="quiz-item-editor__pair" key={pair.id}>
        <label className="user-field">Término {pairIndex + 1}<input type="text" value={pair.termino || ""} onChange={event => patch({ pares:pairs.map(row => row.id === pair.id ? {...row,termino:event.target.value} : row) })} /></label>
        <label className="user-field">Definición {pairIndex + 1}<input type="text" value={pair.definicion || ""} onChange={event => patch({ pares:pairs.map(row => row.id === pair.id ? {...row,definicion:event.target.value} : row) })} /></label>
        <button type="button" className="user-button user-button--danger" disabled={pairs.length <= 2} aria-label={`Eliminar par ${pairIndex + 1}`} onClick={() => patch({ pares:pairs.filter(row => row.id !== pair.id) })}><Trash2 size={16} aria-hidden="true" /></button>
      </div>)}
      <button type="button" className="user-button" disabled={pairs.length >= 10} onClick={() => patch({pares:[...pairs,{id:newId("par"),termino:"",definicion:""}]})}><Plus size={16} aria-hidden="true" /> Añadir par</button>
    </div> : item.tipo === "completacion" ? <div className="quiz-item-editor__answer-key">
      <label className="user-field">Oración para completar<textarea aria-label="Oración para completar" rows={3} value={item.texto_completar || ""} onChange={event=>patch({texto_completar:event.target.value})} placeholder="Ej. La célula que produce la matriz del tejido conectivo es el ___." /><small>Escribe ___ (tres guiones bajos) en cada espacio. Hasta 10 espacios por apartado.</small></label>
      <strong>{completionBlankCount(item.texto_completar)} espacios detectados</strong>
      {Array.from({length:completionBlankCount(item.texto_completar)},(_,blankIndex)=><label className="user-field" key={blankIndex}>Respuesta correcta del espacio {blankIndex + 1}<input type="text" value={item.respuestas_esperadas?.[blankIndex] || ""} onChange={event=>{
        const answers=Array.from({length:completionBlankCount(item.texto_completar)},(_,index)=>item.respuestas_esperadas?.[index]||"");answers[blankIndex]=event.target.value;patch({respuestas_esperadas:answers});
      }} /></label>)}
    </div> : <>
      {item.tipo === "listado" && <><QuizAnswerCountInput value={item.cantidad ?? 3} onChange={cantidad => patch({ cantidad })} /><small>{((Number(item.puntos)||0)/(item.cantidad||3)).toFixed(3)} puntos por respuesta.</small></>}
      <label className="user-field quiz-item-editor__answer-key">Respuestas posibles · Solo docente<textarea aria-label="Respuestas posibles · Solo docente" rows={3} value={answersText} onChange={event => { const text=event.target.value; patch({respuestas_posibles_texto:text,respuesta_modelo:text,respuestas_esperadas:text.split(/[\n,]+/).map(answer=>answer.trim()).filter(Boolean)}); }} placeholder="Una respuesta por línea o separadas por comas." /><small>Guía para quien revisa las respuestas. No se muestra al estudiante.</small></label>
    </>}
    {issues.length > 0 && <div className="quiz-item-editor__issues"><strong>Para completar este apartado</strong><ul>{issues.map((issue,issueIndex)=><li key={issueIndex}>{issue}</li>)}</ul></div>}
  </section>;
}
