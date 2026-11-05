import React, { useState } from "react";
import { ArrowDown, ArrowUp } from "lucide-react";

export default function TemarioOrder({ items, noun, itemKey, itemLabel, onSave, onCancel }) {
  const [ordered, setOrdered] = useState(items);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const move = (index, offset) => {
    setOrdered(previous => {
      const next = [...previous];
      const target = index + offset;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  };

  const save = async () => {
    setBusy(true);
    setError("");
    try {
      await onSave(ordered);
    } catch (err) {
      setError(err.message || "No pudimos guardar el orden.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="temario-workspace">
      <header>
        <h3>Ordenar {noun}</h3>
        <p>Usa las flechas para mover cada elemento. Al guardar, se numerarán del 1 al {ordered.length}.</p>
      </header>
      <ol className="temario-order">
        {ordered.map((item, index) => (
          <li key={itemKey(item)}>
            <span className="user-card__avatar" aria-hidden="true">{index + 1}</span>
            <strong>{itemLabel(item)}</strong>
            <div className="temario-inline-actions">
              <button type="button" className="user-button user-button--icon" aria-label={`Subir ${itemLabel(item)}`}
                disabled={busy || index === 0} onClick={() => move(index, -1)}><ArrowUp size={17} aria-hidden="true" /></button>
              <button type="button" className="user-button user-button--icon" aria-label={`Bajar ${itemLabel(item)}`}
                disabled={busy || index === ordered.length - 1} onClick={() => move(index, 1)}><ArrowDown size={17} aria-hidden="true" /></button>
            </div>
          </li>
        ))}
      </ol>
      {error && <p className="user-dialog__error" role="alert">{error}</p>}
      <div className="temario-inline-actions">
        <button type="button" className="user-button" disabled={busy} onClick={onCancel}>Cancelar</button>
        <button type="button" className="user-button user-button--primary" disabled={busy || !ordered.length}
          onClick={save}>{busy ? "Guardando…" : "Guardar orden"}</button>
      </div>
    </section>
  );
}
