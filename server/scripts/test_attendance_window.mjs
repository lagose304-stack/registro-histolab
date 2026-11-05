import assert from "node:assert/strict";
import { getAttendanceKeys, getAttendanceWindow } from "../../shared/attendanceWindow.mjs";

const section = { dia: "Viernes", hora_inicio: "11:00", hora_fin: "13:00" };
const weeks = [
  { numero_semana: 1, fecha_inicio: "2026-11-02", fecha_fin: "2026-11-08" },
  { numero_semana: 2, fecha_inicio: "2026-11-09", fecha_fin: "2026-11-15" }
];
const windowAt = (date, number = 1) => getAttendanceWindow(section, weeks, number, new Date(date));

assert.equal(windowAt("2026-11-06T10:49:59-06:00").isOpen, false);
assert.equal(windowAt("2026-11-06T10:50:00-06:00").isOpen, true);
assert.equal(windowAt("2026-11-06T13:09:59-06:00").isOpen, true);
assert.equal(windowAt("2026-11-06T13:10:00-06:00").isOpen, false);
assert.equal(windowAt("2026-11-05T11:00:00-06:00").isOpen, false);
assert.equal(windowAt("2026-11-06T11:00:00-06:00", 2).isOpen, false);

const scheduled = windowAt("2026-11-06T11:00:00-06:00");
assert.equal(scheduled.opensAt, "2026-11-06T16:50:00.000Z");
assert.equal(scheduled.closesAt, "2026-11-06T19:10:00.000Z");
assert.equal(getAttendanceWindow(section, [{ numero_semana: 1 }], 1).isOpen, false);
assert.equal(getAttendanceWindow({ ...section, dia: "Sin día" }, weeks, 1).isOpen, false);

const movedSection = { ...section, id: "section-1" };
const replacements = [{
  tipo: "reposicion", seccion_id: "section-1", fecha_original: "2026-11-06",
  fecha: "2026-11-11", hora_inicio: "09:00", hora_fin: "11:00"
}];
const movedWindow = (date, number = 1) =>
  getAttendanceWindow(movedSection, weeks, number, new Date(date), replacements);
assert.equal(movedWindow("2026-11-06T11:00:00-06:00").isOpen, false);
assert.equal(movedWindow("2026-11-11T08:49:59-06:00").isOpen, false);
assert.equal(movedWindow("2026-11-11T08:50:00-06:00").isOpen, true);
assert.equal(movedWindow("2026-11-11T11:09:59-06:00").isOpen, true);
assert.equal(movedWindow("2026-11-11T11:10:00-06:00").isOpen, false);
assert.equal(movedWindow("2026-11-11T09:00:00-06:00").isCurrentWeek, false);
assert.equal(movedWindow("2026-11-13T11:00:00-06:00", 2).isOpen, true);
assert.equal(getAttendanceWindow({ ...section, id: "other-section" }, weeks, 1,
  new Date("2026-11-06T11:00:00-06:00"), replacements).isOpen, true);
assert.equal(getAttendanceWindow(movedSection, weeks, 1,
  new Date("2026-11-06T11:00:00-06:00"), []).isOpen, true);

const examWeeks = [{ ...weeks[0], es_examen: true, parcial: "I Parcial" }, weeks[1]];
const examSection = { ...movedSection, carrera: "Medicina" };
const exams = [{
  tipo: "examen", carrera: "MEDICINA", seccion_id: "section-1",
  fecha: "2026-11-04", hora_inicio: "14:00", hora_fin: "16:00"
}];
const examAt = date => getAttendanceWindow(examSection, examWeeks, 1, new Date(date), exams);
assert.equal(examAt("2026-11-04T13:49:59-06:00").isOpen, false);
assert.equal(examAt("2026-11-04T13:50:00-06:00").isOpen, true);
assert.equal(examAt("2026-11-04T16:09:59-06:00").isOpen, true);
assert.equal(examAt("2026-11-04T16:10:00-06:00").isOpen, false);
assert.equal(examAt("2026-11-06T11:00:00-06:00").isOpen, false);
assert.equal(getAttendanceWindow(examSection, examWeeks, 1,
  new Date("2026-11-04T14:00:00-06:00"), []).isOpen, false);
assert.equal(getAttendanceWindow(examSection, examWeeks, 1,
  new Date("2026-11-04T14:00:00-06:00"), [{ ...exams[0], seccion_id: null }]).isOpen, true);
assert.equal(getAttendanceWindow(examSection, examWeeks, 1,
  new Date("2026-11-04T14:00:00-06:00"), [{ ...exams[0], seccion_id: "other-section" }]).isOpen, false);
assert.equal(getAttendanceWindow(examSection, examWeeks, 1,
  new Date("2026-11-04T14:00:00-06:00"), [{ ...exams[0], seccion_id: null, carrera: "ENFERMERIA" }]).isOpen, false);
assert.deepEqual(getAttendanceKeys(examWeeks[0]), [
  "asistencia_examen_1", "Asistencia Primer Examen", "asistencia_1", "semana_1"
]);

console.log("Ventanas de asistencia verificadas.");
