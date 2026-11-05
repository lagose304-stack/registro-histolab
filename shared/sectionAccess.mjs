import { hasAdministrationAccess } from "./instructorRoles.mjs";

/**
 * Determina si el usuario autenticado es el Instructor Titular (Coordinador de la sección).
 * El instructor titular tiene acceso total y sin restricciones a todos los módulos y semanas de su sección.
 */
export function isInstructorTitular(user, seccion) {
  if (!user) return false;
  if (!seccion || !seccion.coordinador) return false;

  const coordStr = (seccion.coordinador || "").toLowerCase().trim();
  if (!coordStr) return false;

  const pNom = (user.primer_nombre || "").toLowerCase().trim();
  const pApe = (user.primer_apellido || "").toLowerCase().trim();
  const full = (user.nombre_completo || [
    user.primer_nombre, user.segundo_nombre, user.primer_apellido, user.segundo_apellido
  ].filter(Boolean).join(" ")).toLowerCase().trim();
  const combined = `${pNom} ${pApe}`.trim();

  return (
    coordStr === full ||
    coordStr === combined ||
    (pNom && pApe && coordStr.includes(pNom) && coordStr.includes(pApe)) ||
    (full && full.includes(coordStr)) ||
    Boolean(full && coordStr.includes(full))
  );
}

export function isSectionAssignedToInstructor(instructor, section) {
  if (isInstructorTitular(instructor, section)) return true;
  const keys = [instructor?.id, instructor?.numero_cuenta].filter(Boolean).map(String);
  return Array.isArray(section?.instructores_asignados) &&
    section.instructores_asignados.some(key => keys.includes(String(key)));
}

export function canViewSection(instructor, section) {
  return hasAdministrationAccess(instructor?.rol) || isSectionAssignedToInstructor(instructor, section);
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
