import { normalizeSectionCareer } from "./sectionCode.mjs";

export function studentEnrollmentKey(student) {
  if (!student) return "";
  const parts = [student.id, student.numero_cuenta, student.seccion_id, student.carrera]
    .map(value => String(value ?? "").trim());
  if (parts.some(value => !value)) return "";
  parts[3] = normalizeSectionCareer(parts[3]);
  return JSON.stringify(parts);
}

export function sameStudentEnrollment(left, right) {
  const key = studentEnrollmentKey(left);
  return Boolean(key && key === studentEnrollmentKey(right));
}
