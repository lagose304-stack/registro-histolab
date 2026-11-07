/** Texto de edición; nunca convierte un campo vacío en una nota cero. */
export function normalizeGradeInput(raw) {
  const text = String(raw ?? "").replace(",", ".").replace(/^\./, "0.");
  return /^(?:\d+(?:\.\d{0,3})?)?$/.test(text) ? text : null;
}

/** Navega solo entre campos editables del mismo listado. */
export function navigateGradeInputs(event) {
  if (event.isComposing || event.nativeEvent?.isComposing || event.altKey || event.ctrlKey || event.metaKey) return;
  const input = event.currentTarget;
  const key = event.key;
  if (!["Enter", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(key)) return;
  if (event.shiftKey && key !== "Enter") return;
  const grid = input.closest("[data-grade-grid]");
  if (!grid) return;
  const cells = [...grid.querySelectorAll("input[data-grade-input]")]
    .filter(cell => !cell.disabled && !cell.readOnly && cell.getClientRects().length > 0);
  const index = cells.indexOf(input);
  if (index < 0) return;
  const allSelected = input.selectionStart === 0 && input.selectionEnd === input.value.length;
  if (key === "ArrowLeft" && !allSelected && input.selectionStart !== 0) return;
  if (key === "ArrowRight" && !allSelected && input.selectionEnd !== input.value.length) return;
  let next;
  if (key === "Enter") next = cells[index + (event.shiftKey ? -1 : 1)];
  else if (key === "ArrowUp" || key === "ArrowDown") {
    const column = input.dataset.gradeColumn || "0";
    const sameColumn = cells.filter(cell => (cell.dataset.gradeColumn || "0") === column);
    next = sameColumn[sameColumn.indexOf(input) + (key === "ArrowUp" ? -1 : 1)];
  } else {
    const direction = key === "ArrowLeft" ? -1 : 1;
    const row = input.dataset.gradeRow;
    const candidate = cells[index + direction];
    if (candidate && (row === undefined || candidate.dataset.gradeRow === row)) next = candidate;
  }
  if (key === "Enter" || next) event.preventDefault();
  if (next) { next.focus(); next.select(); }
}
