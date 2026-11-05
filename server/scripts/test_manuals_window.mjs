import assert from "node:assert/strict";
import { getManualsWindow } from "../../shared/manualsWindow.mjs";

const section = { id: "s1", dia: "Viernes", hora_inicio: "11:00", hora_fin: "13:00" };
const weeks = [
  { numero_semana: 1, fecha_inicio: "2026-11-02", fecha_fin: "2026-11-08" },
  { numero_semana: 2, fecha_inicio: "2026-11-09", fecha_fin: "2026-11-15" },
  { numero_semana: 3, es_examen: true, fecha_inicio: "2026-11-16", fecha_fin: "2026-11-22" }
];
const windowAt = (date, number = 1, events = [], deadlines = []) =>
  getManualsWindow(section, weeks, number, new Date(date), events, deadlines);

assert.equal(windowAt("2026-11-06T11:00:00-06:00").isOpen, false);
assert.equal(windowAt("2026-11-13T10:49:59-06:00").isOpen, false);
assert.equal(windowAt("2026-11-13T10:50:00-06:00").isOpen, true);
assert.equal(windowAt("2026-11-13T13:09:59-06:00").isOpen, true);
assert.equal(windowAt("2026-11-13T13:10:00-06:00").isOpen, false);

const replacements = [{
  tipo: "reposicion", seccion_id: "s1", fecha_original: "2026-11-13",
  fecha: "2026-11-18", hora_inicio: "09:00", hora_fin: "11:00"
}];
assert.equal(windowAt("2026-11-13T11:00:00-06:00", 1, replacements).isOpen, false);
assert.equal(windowAt("2026-11-18T09:00:00-06:00", 1, replacements).isOpen, true);

assert.equal(windowAt("2026-11-17T12:00:00-06:00", 2).isOpen, false);
assert.equal(windowAt("2026-11-17T12:00:00-06:00", 2).isSpecial, true);
const dates = [{ numero_semana: 2, fecha_carga: "2026-11-17" }];
assert.equal(windowAt("2026-11-16T23:59:59-06:00", 2, [], dates).isOpen, false);
assert.equal(windowAt("2026-11-17T00:00:00-06:00", 2, [], dates).isOpen, true);
assert.equal(windowAt("2026-11-17T23:59:59-06:00", 2, [], dates).isOpen, true);
assert.equal(windowAt("2026-11-18T00:00:00-06:00", 2, [], dates).isOpen, false);
assert.equal(windowAt("2026-11-17T12:00:00-06:00", 3, [], dates).isOpen, false);

console.log("Plazos de manuales, reposiciones y fechas especiales verificados.");
