// Constantes de nombres de roles con soporte de compatibilidad
export const SECTION_ROLES = {
  CREAR_PRUEBA: "Crear prueba semanal",
  MANUALES: "Subir nota de manuales semanal",
  PRUEBAS: "Revisión de prueba semanal",
  PRUEBAS_LEGACY: "Subir nota de prueba semanal",
  EXAMENES: "Subir nota de examen parcial",
  ASISTENCIA: "Pasar lista de asistencia semanal"
};

/**
 * Determina si el usuario autenticado es el Instructor Titular (Coordinador de la sección) o Administrador.
 * El instructor titular tiene acceso total y sin restricciones a todos los módulos y semanas de su sección.
 */
export function isInstructorTitular(user, seccion) {
  if (!user) return false;
  if (user.rol === "Admin") return true;
  if (!seccion || !seccion.coordinador) return false;

  const coordStr = (seccion.coordinador || "").toLowerCase().trim();
  if (!coordStr) return false;

  const pNom = (user.primer_nombre || "").toLowerCase().trim();
  const pApe = (user.primer_apellido || "").toLowerCase().trim();
  const full = (user.nombre_completo || "").toLowerCase().trim();
  const combined = `${pNom} ${pApe}`.trim();

  return (
    coordStr === full ||
    coordStr === combined ||
    (pNom && pApe && coordStr.includes(pNom) && coordStr.includes(pApe)) ||
    full.includes(coordStr) ||
    coordStr.includes(full)
  );
}

/**
 * Comprueba si un usuario dado coincide con un registro de asignación
 * por ID (UUID), ID sintético de coordinador, número de cuenta o nombre.
 */
export function matchesInstructor(user, targetId, targetName, seccion) {
  if (!user) return false;

  // 1. Coincidencia por ID de instructor UUID
  if (user.id && targetId && String(user.id) === String(targetId)) {
    return true;
  }

  // 2. Coincidencia por ID sintético de coordinador (coord-{seccionId})
  if (targetId && String(targetId).startsWith("coord-")) {
    if (isInstructorTitular(user, seccion)) return true;
  }

  // 3. Coincidencia por número de cuenta
  if (user.numero_cuenta && targetId && String(user.numero_cuenta) === String(targetId)) {
    return true;
  }

  // 4. Coincidencia por nombre completo o primer nombre + primer apellido
  if (targetName) {
    const tName = targetName.toLowerCase().trim();
    const uFull = (user.nombre_completo || "").toLowerCase().trim();
    const uNom = (user.primer_nombre || "").toLowerCase().trim();
    const uApe = (user.primer_apellido || "").toLowerCase().trim();
    const uCombined = `${uNom} ${uApe}`.trim();

    if (uFull && (uFull === tName || tName.includes(uFull) || uFull.includes(tName))) {
      return true;
    }
    if (uCombined && (uCombined === tName || tName.includes(uCombined) || uCombined.includes(tName))) {
      return true;
    }
    if (uNom && uApe && tName.includes(uNom) && tName.includes(uApe)) {
      return true;
    }
  }

  return false;
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
