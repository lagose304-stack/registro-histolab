import assert from "node:assert/strict";
import { normalizeGradeInput } from "../../client/src/utils/gradeInput.mjs";
import { formatGrade } from "../../client/src/utils/academicEngine.js";

for (const [raw, expected] of [["", ""], [".", "0."], [".125", "0.125"], ["0.", "0."],
  ["0.005", "0.005"], ["1.000", "1.000"], ["8.375", "8.375"], ["0,125", "0.125"]]) {
  assert.equal(normalizeGradeInput(raw), expected, `Texto de edición: ${raw}`);
}
for (const raw of ["0.1234", "1e2", "-1", "0..1", "NaN", "Infinity", "1,2,3", "abc"]) {
  assert.equal(normalizeGradeInput(raw), null, `Entrada rechazada: ${raw}`);
}
assert.equal(formatGrade(8.375), "8.375");
assert.equal(formatGrade(8.375, 2), "8.38");
assert.equal(formatGrade(1.005, 2), "1.01");
assert.equal(formatGrade(0, 2), "0.00");
assert.equal(formatGrade("", 2), "—");
assert.equal(formatGrade(null, 2), "—");
console.log("PASS: edición de punto, coma, ceros, tres decimales y redondeo visual independiente a dos decimales.");
