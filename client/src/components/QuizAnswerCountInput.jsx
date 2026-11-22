import React, { useId, useState } from "react";
import { Minus, Plus } from "lucide-react";

export default function QuizAnswerCountInput({ value = 3, onChange, label = "Número de respuestas", min = 1, max = 10 }) {
  const id = useId();
  const [draft, setDraft] = useState(null);
  const count = Number(value);
  const text = draft ?? String(value);
  const valid = text !== "" && Number.isInteger(Number(text)) && Number(text) >= min && Number(text) <= max;
  const clamp = number => Math.max(min, Math.min(max, number));
  const commit = number => { setDraft(null); onChange(number); };
  return <div className="user-field">
    <label htmlFor={id}>{label}</label>
    <div className="quiz-item-editor__count">
      <button type="button" className="user-button" aria-label={`Reducir ${label.toLowerCase()}`} disabled={count <= min} onClick={() => commit(clamp(count - 1))}><Minus size={18} aria-hidden="true" /></button>
      <input id={id} type="text" inputMode="numeric" autoComplete="off" value={text}
        aria-describedby={`${id}-hint`} aria-invalid={draft !== null && !valid}
        onFocus={() => setDraft(String(value))}
        onChange={event => {
          const next = event.target.value;
          if (!/^\d*$/.test(next)) return;
          setDraft(next);
          const number = Number(next);
          if (next && number >= min && number <= max) onChange(number);
        }}
        onBlur={() => commit(text === "" ? count : clamp(Number(text)))}
        onKeyDown={event => {
          if (event.key === "Enter") { event.preventDefault(); event.currentTarget.blur(); }
          if (event.key === "ArrowUp" || event.key === "ArrowDown") {
            event.preventDefault(); commit(clamp(count + (event.key === "ArrowUp" ? 1 : -1)));
          }
        }} />
      <button type="button" className="user-button" aria-label={`Aumentar ${label.toLowerCase()}`} disabled={count >= max} onClick={() => commit(clamp(count + 1))}><Plus size={18} aria-hidden="true" /></button>
    </div>
    <small id={`${id}-hint`}>De {min} a {max}. Puedes escribir el número o usar los botones.</small>
  </div>;
}
