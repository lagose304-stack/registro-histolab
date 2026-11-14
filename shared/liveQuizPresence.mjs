export const LIVE_PRESENCE_TTL_MS = 15_000;
export function isLivePresenceRecent(presence, now) {
  const ping = Number(presence?.ultimo_ping);
  return Number.isFinite(ping) && ping > 0 && ping <= now + 1000 && now - ping < LIVE_PRESENCE_TTL_MS;
}
export function livePresenceStatus(presence, session, now, delivery = null) {
  if (delivery && delivery.estado !== "borrador") return { connected: false, answered: false, label: "Entregó", state: "submitted" };
  const waitingForReentry = delivery?.estado === "borrador" && Number(presence?.ultimo_ping || 0) < new Date(delivery.updated_at).getTime();
  if (waitingForReentry || !isLivePresenceRecent(presence, now)) return { connected: false, answered: false, label: delivery?.estado === "borrador" ? "Habilitada de nuevo" : "Sin conexión", state: delivery?.estado === "borrador" ? "reopened" : "offline" };
  const current = Number(presence.pregunta_vista) === Number(session.pregunta_actual_idx);
  const inQuiz = ["prueba", "aviso", "entrega_pendiente"].includes(presence.ubicacion) || (!presence.ubicacion && Number(presence.pregunta_vista) >= 0);
  if (!inQuiz) return { connected: true, answered: false, label: "En el portal", state: "portal" };
  if (presence.ubicacion === "entrega_pendiente") return { connected: true, answered: false, label: "Entrega pendiente", state: "pending" };
  if (presence.ubicacion === "aviso") return { connected: true, answered: false, label: "Aviso de falta", state: "warning" };
  if (session.estado === "inactiva") return { connected: true, answered: false, label: "Sala cerrada", state: "closed" };
  if (session.estado === "finalizada") return { connected: true, answered: false, label: "Finalizando entrega", state: "finishing" };
  if (session.estado === "lobby") return { connected: true, answered: false, label: "En sala", state: "lobby" };
  if (!current) return { connected: true, answered: false, label: "Sincronizando pregunta", state: "syncing" };
  const answered = presence.ha_respondido === true;
  if (session.estado === "esperando_siguiente") return { connected: true, answered, label: answered ? "Respuesta guardada" : "Sin respuesta", state: "waiting" };
  return { connected: true, answered, label: answered ? "Con respuesta" : "Respondiendo", state: answered ? "answered" : "answering" };
}

export function buildLiveStudentRoster(enrollments, session, now, known = true) {
  const presence = session.alumnos_conectados || {};
  const deliveries = session.entregas_estudiantes || {};
  const rows = new Map();
  for (const student of enrollments) {
    const key = String(student.numero_cuenta || "").trim();
    if (key && student.activo !== false) rows.set(key, { ...student, key });
  }
  const enrolledCount = rows.size;
  for (const [account, entry] of Object.entries(presence)) {
    const key = account.trim();
    if (!rows.has(key) && entry?.reposicion) rows.set(key, { key, numero_cuenta: key, nombre_completo: entry.nombre_completo, reposicion: entry.reposicion });
  }
  const students = [...rows.values()].map(student => ({ ...student, delivery: deliveries[student.key], ...(known ? livePresenceStatus(presence[student.key], session, now, deliveries[student.key]) : { connected: false, answered: false, label: "Sin verificar", state: "unknown" }) }));
  return { students, enrolledCount, invitedCount: students.length - enrolledCount, connectedCount: students.filter(row => row.connected).length, answeredCount: students.filter(row => row.answered).length };
}
