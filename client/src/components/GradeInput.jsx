import React, { useState } from "react";
import { normalizeGradeInput, navigateGradeInputs } from "../utils/gradeInput.mjs";

/** Conserva el punto y ceros de edición aunque el padre almacene un número. */
export default function GradeInput({ value, onValueChange, onInvalidValue, onFocus, onBlur, onKeyDown, min = 0, max, ...props }) {
  const [draft, setDraft] = useState(null);
  return <input {...props} type="text" inputMode="decimal" autoComplete="off" data-grade-input="true"
    value={draft ?? value ?? ""}
    onFocus={event => { setDraft(String(value ?? "")); onFocus?.(event); }}
    onChange={event => {
      const text = normalizeGradeInput(event.target.value);
      if (text === null) return;
      if (text !== "" && (Number(text) < Number(min) || (max !== undefined && Number(text) > Number(max)))) {
        onInvalidValue?.(text);
        return;
      }
      setDraft(text);
      onValueChange(text);
    }}
    onBlur={event => {
      if (draft?.endsWith(".")) onValueChange(draft.slice(0, -1));
      setDraft(null);
      onBlur?.(event);
    }}
    onKeyDown={event => { onKeyDown?.(event); if (!event.defaultPrevented) navigateGradeInputs(event); }} />;
}
