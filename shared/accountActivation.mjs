export const normalizeAccountEmail = value => typeof value === "string" ? value.trim().toLowerCase() : "";
export const validAccountEmail = value => typeof value === "string" && value.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
export const validActivationPassword = value => typeof value === "string" && value.length >= 12 && new TextEncoder().encode(value).length <= 72 && Boolean(value.trim());
export function requiresAccountActivation(profile) {
  return profile?.activation_required === true;
}
export function requiresStudentAccountActivation(profile) {
  return requiresAccountActivation(profile) || !profile?.auth_user_id || !profile?.correo || !profile?.activation_completed_at;
}
