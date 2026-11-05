import { hasAdministrationAccess } from "../../../shared/instructorRoles.mjs";
import { isInstructorTitular, matchesInstructor } from "../../../shared/sectionAccess.mjs";

export { isInstructorTitular, matchesInstructor };

// Constantes de nombres de roles con soporte de compatibilidad
export const SECTION_ROLES = {
  CREAR_PRUEBA: "Crear prueba semanal",
  MANUALES: "Subir nota de manuales semanal",
  PRUEBAS: "Revisión de prueba semanal",
  PRUEBAS_LEGACY: "Subir nota de prueba semanal",
  EXAMENES: "Subir nota de examen parcial",
  ASISTENCIA: "Pasar lista de asistencia semanal"
};

export function hasFullSectionAccess(user, section) {
  return hasAdministrationAccess(user?.rol) || isInstructorTitular(user, section);
}

/**
 * Obtiene el registro de asignación para una semana y rol específico.
 * @param {Array} asignaciones - Lista de asignaciones de la sección
 * @param {string|string[]} roleNames - Nombre(s) de rol a buscar
 * @param {number|string} semanaNum - Número de la semana (ej. 1, 2)
 */
export function getAssignedRecordForWeek(asignaciones, roleNames, semanaNum) {
  if (!Array.isArray(asignaciones) || !semanaNum) return null;
  const targetRef = `semana_${semanaNum}`;
  const roles = Array.isArray(roleNames) ? roleNames : [roleNames];

  return (
    asignaciones.find(
      (a) => roles.includes(a.tipo_asignacion) && String(a.referencia_id) === targetRef
    ) || null
  );
}

/**
 * Determina si una semana está asignada al usuario dado.
 * Si el usuario es Instructor Titular, SIEMPRE devuelve true.
 */
export function isWeekAssignedToUser(asignaciones, roleNames, semanaNum, user, seccion) {
  if (isInstructorTitular(user, seccion)) return true;
  const record = getAssignedRecordForWeek(asignaciones, roleNames, semanaNum);
  if (!record || !record.instructor_id) return false;
  return matchesInstructor(user, record.instructor_id, record.instructor_nombre, seccion);
}

const DIAS_NORMALIZADOS = {
  0: "domingo",
  1: "lunes",
  2: "martes",
  3: "miercoles",
  4: "jueves",
  5: "viernes",
  6: "sabado"
};

const DIAS_NOMBRE_LEGIBLE = {
  0: "Domingo",
  1: "Lunes",
  2: "Martes",
  3: "Miércoles",
  4: "Jueves",
  5: "Viernes",
  6: "Sábado"
};

/**
 * Obtiene la fecha/hora actual ajustada a la zona horaria de Honduras (America/Tegucigalpa, UTC-6).
 */
export function getHondurasDate() {
  try {
    const str = new Date().toLocaleString("en-US", { timeZone: "America/Tegucigalpa" });
    return new Date(str);
  } catch {
    return new Date();
  }
}

/**
 * Evalúa si el momento actual está dentro del día y rango de horario exclusivo de la sección.
 * @param {Object} seccion - Datos de la sección (dia, hora_inicio, hora_fin)
 * @returns {Object} { isWithin: boolean, reason: string, isSameDay: boolean, isEarly: boolean, isLate: boolean, todayName: string, expectedDay: string, expectedSchedule: string }
 */
export function checkSectionSchedule(seccion) {
  if (!seccion || !seccion.dia || !seccion.hora_inicio) {
    return {
      isWithin: true,
      reason: "",
      isSameDay: true,
      expectedSchedule: seccion?.hora_inicio ? `${seccion.dia || ""} ${seccion.hora_inicio} - ${seccion.hora_fin || ""}`.trim() : ""
    };
  }

  const now = getHondurasDate();
  const currentDayIndex = now.getDay();
  const todayNormalized = DIAS_NORMALIZADOS[currentDayIndex];
  const todayLegible = DIAS_NOMBRE_LEGIBLE[currentDayIndex];

  const cleanSecDay = String(seccion.dia)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();

  const expectedSchedule = `${seccion.dia} de ${seccion.hora_inicio} a ${seccion.hora_fin || "Fin"}`;

  // 1. Verificación de día de la semana
  const isSameDay = cleanSecDay.includes(todayNormalized);

  if (!isSameDay) {
    return {
      isWithin: false,
      isSameDay: false,
      isEarly: false,
      isLate: false,
      todayName: todayLegible,
      expectedDay: seccion.dia,
      expectedSchedule,
      reason: `Hoy es ${todayLegible} y la sección está programada para los días ${seccion.dia}.`
    };
  }

  // 2. Verificación de rango de horas (en minutos desde la medianoche)
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  const [startH, startM] = String(seccion.hora_inicio).split(":").map((v) => parseInt(v, 10) || 0);
  const startMinutes = startH * 60 + (startM || 0);

  let endMinutes = startMinutes + 120; // 2 horas de duración predeterminada si no hay hora_fin
  if (seccion.hora_fin) {
    const [endH, endM] = String(seccion.hora_fin).split(":").map((v) => parseInt(v, 10) || 0);
    endMinutes = endH * 60 + (endM || 0);
    if (endMinutes <= startMinutes) {
      endMinutes = startMinutes + 120;
    }
  }

  if (currentMinutes < startMinutes) {
    const diff = startMinutes - currentMinutes;
    const diffH = Math.floor(diff / 60);
    const diffM = diff % 60;
    const timeRemainingStr = diffH > 0 ? `${diffH} h ${diffM} min` : `${diffM} min`;

    return {
      isWithin: false,
      isSameDay: true,
      isEarly: true,
      isLate: false,
      todayName: todayLegible,
      expectedDay: seccion.dia,
      expectedSchedule,
      reason: `Aún no inicia el horario oficial de la sección (inicia a las ${seccion.hora_inicio}, faltan aprox. ${timeRemainingStr}).`
    };
  }

  if (currentMinutes > endMinutes) {
    return {
      isWithin: false,
      isSameDay: true,
      isEarly: false,
      isLate: true,
      todayName: todayLegible,
      expectedDay: seccion.dia,
      expectedSchedule,
      reason: `El horario oficial de la sección ya concluyó (finalizó a las ${seccion.hora_fin || "Fin"}).`
    };
  }

  return {
    isWithin: true,
    isSameDay: true,
    isEarly: false,
    isLate: false,
    todayName: todayLegible,
    expectedDay: seccion.dia,
    expectedSchedule,
    reason: ""
  };
}
