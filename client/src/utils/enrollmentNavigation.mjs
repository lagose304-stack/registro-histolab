/** Navega por los campos visibles de un formulario de alta manual. */
export function navigateEnrollmentFields(event) {
  const { key, target: field, currentTarget: form } = event;
  if (!["Enter", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(key) ||
      event.defaultPrevented || event.nativeEvent?.isComposing || event.altKey || event.ctrlKey || event.metaKey ||
      (event.shiftKey && key !== "Enter")) return;

  const fields = [...form.querySelectorAll("input:not([type=hidden]), select")].filter(control =>
    !control.matches(":disabled, [readonly]") && control.getClientRects().length > 0 &&
    getComputedStyle(control).visibility === "visible"
  );
  const index = fields.indexOf(field);
  if (index < 0) return;

  let next;
  if (key === "Enter") {
    event.preventDefault();
    next = fields[index + (event.shiftKey ? -1 : 1)];
  } else {
    // Las flechas del selector siguen cambiando su opción de forma nativa.
    if (field.tagName === "SELECT") return;
    const horizontal = key === "ArrowLeft" || key === "ArrowRight";
    const backwards = key === "ArrowLeft" || key === "ArrowUp";
    if (horizontal) {
      const { selectionStart, selectionEnd, value } = field;
      const allSelected = selectionStart === 0 && selectionEnd === value.length;
      const atEdge = backwards ? selectionStart === 0 : selectionEnd === value.length;
      if (!allSelected && (!atEdge || selectionStart !== selectionEnd)) return;
    }

    const origin = field.getBoundingClientRect();
    const candidates = fields.flatMap(control => {
      if (control === field) return [];
      const { top, left } = control.getBoundingClientRect();
      const dy = top - origin.top;
      const dx = left - origin.left;
      const sameRow = Math.abs(dy) < origin.height / 2;
      if (horizontal ? !sameRow || !dx || (dx < 0) !== backwards : sameRow || (dy < 0) !== backwards) return [];
      return [{ control, rowDistance: horizontal ? 0 : Math.abs(dy), columnDistance: Math.abs(dx) }];
    });
    candidates.sort((a, b) => a.rowDistance - b.rowDistance || a.columnDistance - b.columnDistance);
    next = candidates[0]?.control;
  }

  if (next) {
    event.preventDefault();
    next.focus();
    next.select?.();
  }
}
