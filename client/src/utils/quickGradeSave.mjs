// Un único envío pendiente. La copia local se escribe antes de adelantar la vista.
const pendingRequests = new Map();

export function createQuickGradeSaver({ storage, key, send, onConfirmed = () => {}, makeId = () => crypto.randomUUID() }) {
  let state = { pending: null, saving: false, error: "" }, active = true;
  const listeners = new Set();
  const update = patch => { state = { ...state, ...patch }; for (const listener of listeners) listener(state); };
  try {
    const raw = key && storage?.getItem(key);
    if (raw) {
      const record = JSON.parse(raw);
      if (record.version !== 1 || !record.id || !record.submissionId || !record.payload?.evaluaciones_incisos) throw new Error();
      state.pending = { ...record, durable: true, recovered: true };
    }
  } catch { state.error = "No se pudo recuperar el guardado pendiente de este dispositivo."; }
  const saver = {
    snapshot: () => state,
    subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); },
    prepare(details) {
      if (state.pending || state.saving) throw new Error("Espera la confirmación del guardado anterior.");
      const record = { ...structuredClone(details), id: makeId(), version: 1, durable: true };
      try {
        if (!key || !storage) throw new Error();
        if (storage.getItem(key) !== null) throw new Error();
        const raw = JSON.stringify(record);
        storage.setItem(key, raw);
        if (storage.getItem(key) !== raw) throw new Error();
      } catch { record.durable = false; }
      update({ pending: record, error: "" });
      return record;
    },
    async run() {
      if (!state.pending || state.saving) return;
      const record = state.pending;
      update({ saving: true, error: "" });
      let response, request;
      const requestKey = JSON.stringify([key, record.id]);
      try {
        request = pendingRequests.get(requestKey);
        if (!request) {
          request = Promise.resolve().then(() => send(record.submissionId, record.payload));
          pendingRequests.set(requestKey, request);
        }
        response = await request;
        if (!response?.success) throw new Error(response?.message || "No se pudo confirmar la calificación.");
      } catch (error) {
        if (pendingRequests.get(requestKey) === request) pendingRequests.delete(requestKey);
        update({ saving: false, error: error.message || "No se pudo confirmar la calificación." });
        return;
      }
      // Solo retirar la copia exacta que el servidor acaba de confirmar.
      try { if (key && JSON.parse(storage?.getItem(key) || "null")?.id === record.id) storage.removeItem(key); } catch {}
      if (active) onConfirmed(record, response.data);
      update({ pending: null, saving: false, error: "" });
      if (pendingRequests.get(requestKey) === request) pendingRequests.delete(requestKey);
    },
    dispose() { active = false; listeners.clear(); }
  };
  return saver;
}
