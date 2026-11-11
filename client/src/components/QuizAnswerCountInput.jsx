import React, { useId, useState } from "react";
import { Minus, Plus } from "lucide-react";

export default function QuizAnswerCountInput({ value = 3, onChange }) {
  const id = useId();
  const [draft, setDraft] = useState(null);
  const count = Number(value);
  const text = draft ?? String(value);
  const valid = text !== "" && Number.isInteger(Number(text)) && Number(text) >= 1 && Number(text) <= 10;
  const commit = number => { setDraft(null); onChange(number); };
  return <div className="user-field">
    <label htmlFor={id}>Número de respuestas</label>
    <div className="quiz-item-editor__count">
      <button type="button" className="user-button" aria-label="Reducir número de respuestas" disabled={count <= 1} onClick={() => commit(Math.max(1, count - 1))}><Minus size={18} aria-hidden="true" /></button>
      <input id={id} type="text" inputMode="numeric" autoComplete="off" value={text}
        aria-describedby={`${id}-hint`} aria-invalid={draft !== null && !valid}
        onFocus={() => setDraft(String(value))}
        onChange={event => {
          const next = event.target.value;
          if (!/^\d*$/.test(next)) return;
          setDraft(next);
          const number = Number(next);
          if (next && number >= 1 && number <= 10) onChange(number);
        }}
        onBlur={() => commit(text === "" ? count : Math.max(1, Math.min(10, Number(text))))}
        onKeyDown={event => {
          if (event.key === "Enter") { event.preventDefault(); event.currentTarget.blur(); }
          if (event.key === "ArrowUp" || event.key === "ArrowDown") {
            event.preventDefault(); commit(Math.max(1, Math.min(10, count + (event.key === "ArrowUp" ? 1 : -1))));
          }
        }} />
      <button type="button" className="user-button" aria-label="Aumentar número de respuestas" disabled={count >= 10} onClick={() => commit(Math.min(10, count + 1))}><Plus size={18} aria-hidden="true" /></button>
    </div>
    <small id={`${id}-hint`}>De 1 a 10 respuestas. Puedes escribir el número o usar los botones.</small>
  </div>;
}
