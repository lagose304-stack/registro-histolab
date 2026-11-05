import React, { useState } from "react";
import { AlertTriangle, Edit3, Plus, Trash2 } from "lucide-react";
import { api } from "../services/api";
import TemarioDialog from "./TemarioDialog";

export default function TemarioManagementModal({ mode, temas, selectedTema, carrera, onClose, onSuccess, notify }) {
  const creating = mode === "create";
  const deleting = mode === "delete";
  const selectedId = selectedTema?.id;
  const [number, setNumber] = useState(() => selectedTema?.numero_tema || Math.max(0, ...temas.map(topic => Number(topic.numero_tema) || 0)) + 1);
  const [title, setTitle] = useState(selectedTema?.titulo || selectedTema?.nombre || "");
  const [manual, setManual] = useState(selectedTema?.tiene_manual !== false);
  const [shift, setShift] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const titleInput = React.useRef(null);
  const duplicate = temas.find(topic => topic.id !== selectedId && Number(topic.numero_tema) === Number(number));

  const save = async (event) => {
    event.preventDefault();
    if (busy) return;
    const next = event.nativeEvent.submitter?.value === "next";
    const keepOpen = event.nativeEvent.submitter?.value === "stay";
    setError("");
    setSuccess("");
    setBusy(true);
    try {
      if (deleting) {
        await api.temario.delete(selectedId);
      } else {
        const cleanTitle = title.trim();
        if (!cleanTitle) throw new Error("Escribe el título del tema.");
        if (!Number.isInteger(Number(number)) || Number(number) < 1 || Number(number) > 99) {
          throw new Error("Usa un número de tema entre 1 y 99.");
        }
        if (duplicate && !shift) throw new Error("Elige otro número o activa el desplazamiento de temas.");
        const payload = {
          numero_tema: Number(number),
          titulo: cleanTitle,
          carrera,
          tiene_manual: manual,
          desplazar_siguientes: Boolean(duplicate && shift)
        };
        if (creating) await api.temario.create(payload);
        else await api.temario.update(selectedId, payload);
      }
      notify(deleting ? "Tema eliminado" : creating ? "Tema creado" : "Cambios guardados", "success");
      onSuccess();
      if (next) {
        setNumber(Number(number) + 1);
        setTitle("");
        setManual(true);
        setShift(true);
        setSuccess("Tema creado. Ya puedes agregar el siguiente.");
        titleInput.current?.focus();
      } else if (keepOpen) {
        setSuccess("Cambios guardados.");
      } else {
        onClose();
      }
    } catch (err) {
      setError(err.message || "No pudimos completar la operación.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <TemarioDialog title={deleting ? "Eliminar tema" : creating ? "Crear tema" : "Editar tema"}
      career={carrera} Icon={deleting ? Trash2 : creating ? Plus : Edit3} busy={busy} onClose={onClose}
      footer={
        <>
          {error && <p className="user-dialog__error" role="alert">{error}</p>}
          <div className="user-dialog__buttons temario-dialog-actions">
            <button type="button" className="user-button" disabled={busy} onClick={onClose}>Cerrar</button>
            {!deleting && (
              <button type="submit" form="temario-topic-form" className="user-button" disabled={busy}
                value={creating ? "next" : "stay"}>{creating ? "Guardar y crear otro" : "Guardar y seguir editando"}</button>
            )}
            <button type="submit" form="temario-topic-form" disabled={busy}
              className={deleting ? "user-button user-button--destructive" : "user-button user-button--primary"}>
              {busy ? "Procesando…" : deleting ? "Eliminar tema" : "Guardar y cerrar"}
            </button>
          </div>
        </>
      }>
      <form id="temario-topic-form" className="user-dialog__body" onSubmit={save}>
        {success && <p className="temario-feedback" role="status">{success}</p>}
        {deleting ? (
          <>
            <p><strong>Tema {selectedTema?.numero_tema} · {title}</strong></p>
            <div className="user-dialog__warning"><AlertTriangle size={21} aria-hidden="true" />
              <p>Se eliminará este tema del temario de {carrera}.</p>
            </div>
          </>
        ) : (
          <>
            <label className="user-field">Título del tema
              <input required ref={titleInput} value={title} onChange={event => setTitle(event.target.value)} />
            </label>
            <label className="user-field">Número del tema
              <input type="number" min="1" max="99" required value={number} onChange={event => setNumber(event.target.value)} />
            </label>
            {duplicate && (
              <div className="user-dialog__warning">
                <AlertTriangle size={19} aria-hidden="true" />
                <div>
                  <p>El número {number} ya corresponde a «{duplicate.titulo || duplicate.nombre}».</p>
                  <label className="temario-check">
                    <input type="checkbox" checked={shift} onChange={event => setShift(event.target.checked)} />
                    Desplazar los temas siguientes un lugar
                  </label>
                </div>
              </div>
            )}
            <label className="temario-check">
              <input type="checkbox" checked={manual} onChange={event => setManual(event.target.checked)} />
              Tiene manual evaluable
            </label>
          </>
        )}
      </form>
    </TemarioDialog>
  );
}
