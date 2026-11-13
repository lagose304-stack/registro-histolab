export const QUIZ_ACTIVITY_POLICY = "salidas-tres-faltas-v1";
export const QUIZ_ACTIVITY_LIMIT = 3;
export const QUIZ_ACTIVITY_SIGNALS = {
  pagina_oculta: "La página dejó de estar visible",
  ventana_sin_foco: "La ventana perdió el foco",
  documento_abandonado: "Se abandonó o recargó el documento",
  salida_del_portal: "Se solicitó cerrar la sesión del portal durante la prueba"
};
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function normalizeActivityEvent(event) {
  if (!uuid.test(event?.id || "") || !uuid.test(event?.episodio_id || "") || !["salida", "regreso"].includes(event?.tipo)) throw new Error("Evento de actividad inválido.");
  const date = new Date(event.hora_cliente);
  if (!Number.isFinite(date.getTime())) throw new Error("Hora del evento inválida.");
  const signals = [...new Set(Array.isArray(event.senales) ? event.senales : [])].filter(signal => Object.hasOwn(QUIZ_ACTIVITY_SIGNALS, signal));
  if (event.tipo === "salida" && !signals.length) throw new Error("La salida debe identificar una señal observada.");
  return {
    id: event.id, episodio_id: event.episodio_id, tipo: event.tipo,
    hora_cliente: date.toISOString(), senales: signals,
    pregunta_id: String(event.pregunta_id || "").slice(0, 120),
    pregunta_indice: Math.min(999, Math.max(0, Math.floor(Number(event.pregunta_indice) || 0)))
  };
}

// Misma transición en el almacenamiento local y en la función transaccional SQL.
export function appendLocalActivity(attempt, events, now = () => new Date().toISOString()) {
  const next = structuredClone(attempt);
  for (const source of events) {
    const event = normalizeActivityEvent(source);
    if (next.eventos.some(row => row.id === event.id || (row.episodio_id === event.episodio_id && row.tipo === event.tipo))) continue;
    if (next.finalizado_at) continue;
    if (event.tipo === "salida") {
      if (next.faltas >= QUIZ_ACTIVITY_LIMIT || next.episodio_abierto) continue;
      next.faltas += 1;
      next.episodio_abierto = event.episodio_id;
    } else {
      if (next.episodio_abierto !== event.episodio_id) throw new Error("El regreso no corresponde a la salida abierta.");
      next.episodio_abierto = null;
    }
    next.eventos.push({ ...event, falta: next.faltas, recibido_at: now(), origen: "navegador_declarado" });
  }
  return next;
}
