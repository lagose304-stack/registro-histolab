const ROLE_NAMES = new Map([
  ["creador", "Creador"],
  ["coordinador", "Coordinador"],
  ["instructor", "Instructor"]
]);

export const ASSIGNABLE_INSTRUCTOR_ROLES = ["Instructor", "Coordinador"];

export function normalizeInstructorRole(role) {
  return typeof role === "string" ? ROLE_NAMES.get(role.trim().toLowerCase()) : undefined;
}

export function hasAdministrationAccess(role) {
  const normalized = normalizeInstructorRole(role);
  return normalized === "Creador" || normalized === "Coordinador";
}

// Administrative access and section ownership do not grant this exception.
export function canBypassQuizSchedule(role) {
  return normalizeInstructorRole(role) === "Creador";
}
