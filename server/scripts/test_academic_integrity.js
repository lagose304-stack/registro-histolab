import assert from "node:assert";
import {
  isExamWeek,
  getExamWeeks,
  getRegularWeeks,
  getCanonicalManualGrade,
  getCanonicalQuizGrade,
  getCanonicalExamGrade,
  calculateStudentAcademicSummary,
  sanitizeNotasObject
} from "../../client/src/utils/academicEngine.js";
import { sanitizeNotasPayload } from "../src/controllers/estudiantes.controller.js";

console.log("===============================================================");
console.log(" INICIANDO TEST DE INTEGRIDAD ACADÉMICA Y BLINDAJE DE NOTAS");
console.log("===============================================================\n");

// 1. Prueba de detección de semanas de examen
console.log("1. Probando detección robusta de semanas de examen...");
const mockSemanas = [
  { numero_semana: 1, nombre_semana: "Semana 1", descripcion: "Clases", es_examen: false, temas: "Tema 1, Tema 2" },
  { numero_semana: 5, nombre_semana: "I Examen Parcial", descripcion: "Examen Teórico", es_examen: true, temas: "EXAMEN TEÓRICO Y PRÁCTICO" },
  { numero_semana: 6, nombre_semana: "Semana 6", descripcion: "Clases", es_examen: false, temas: "Tema 3" },
  { numero_semana: 11, nombre_semana: "Semana 11", descripcion: "Evaluación", es_examen: false, temas: "II EXAMEN PARCIAL" },
  { numero_semana: 16, nombre_semana: "Semana 16", descripcion: "Examen Final", es_examen: "true", temas: "EXAMEN FINAL" }
];

const examWeeks = getExamWeeks(mockSemanas);
assert.strictEqual(examWeeks.length, 3, "Deben detectarse exactamente 3 semanas de examen (5, 11 y 16)");
assert.strictEqual(examWeeks[0].numero_semana, 5);
assert.strictEqual(examWeeks[1].numero_semana, 11);
assert.strictEqual(examWeeks[2].numero_semana, 16);

const regularWeeks = getRegularWeeks(mockSemanas);
assert.strictEqual(regularWeeks.length, 2, "Deben detectarse exactamente 2 semanas regulares (1 y 6)");
console.log("✓ Detección de semanas de examen y regulares: EXITOSA");

// 2. Prueba de resolución canónica de manuales (evitando colisión al reordenar temas)
console.log("\n2. Probando resolución canónica de manuales por ID inmutable...");
const mockTopicA = { id: "topic-uuid-1", titulo: "Epitelios de Revestimiento", numero_tema: 1 };
const mockTopicB = { id: "topic-uuid-2", titulo: "Tejido Conectivo", numero_tema: 2 };

const mockNotas = {
  "manual_topic-uuid-1": 1.0,
  "manual_topic-uuid-2": 0.85,
  "manual_tema_99": 0.5 // legacy o tema inexistente
};

assert.strictEqual(getCanonicalManualGrade(mockNotas, mockTopicA), 1.0);
assert.strictEqual(getCanonicalManualGrade(mockNotas, mockTopicB), 0.85);

// Crear un tema nuevo en la posición 1 (desplazando a los demás)
const mockNewTopic = { id: "topic-uuid-nuevo", titulo: "Introducción a la Microscopía", numero_tema: 1 };
assert.strictEqual(getCanonicalManualGrade(mockNotas, mockNewTopic), null, "Un tema nuevo jamás debe heredar notas de otro tema");
console.log("✓ Blindaje contra colisión y desplazamiento de temas: EXITOSO");

// 3. Prueba de sanitización y unificación de pruebas semanales
console.log("\n3. Probando sanitización canónica de pruebas (eliminando examencito_X redundante)...");
const dirtyPayload = {
  examencito_1: 5.0,
  examencito_2: 4.5,
  prueba_2: 4.5,
  manual_tema_1: 1.0,
  "manual_topic-uuid-1": 1.0
};

const cleanedServer = sanitizeNotasPayload(dirtyPayload);
assert.strictEqual(cleanedServer.prueba_1, 5.0, "examencito_1 debe migrar a prueba_1");
assert.strictEqual(cleanedServer.examencito_1, undefined, "examencito_1 redundante debe desaparecer");
assert.strictEqual(cleanedServer.prueba_2, 4.5, "prueba_2 se conserva");
assert.strictEqual(cleanedServer.manual_tema_1, undefined, "manual_tema_1 posicional debe purgarse si existe manual_UUID");
assert.strictEqual(cleanedServer["manual_topic-uuid-1"], 1.0);

const cleanedClient = sanitizeNotasObject(dirtyPayload);
assert.strictEqual(cleanedClient.prueba_1, 5.0);
assert.strictEqual(cleanedClient.examencito_1, undefined);
console.log("✓ Sanitización canónica backend y frontend: EXITOSA");

// 4. Prueba matemática exhaustiva: Caso Juan Rosales (Medicina - Sección LU0700)
console.log("\n4. Probando cálculo exacto de notas con el caso real de Medicina (Juan Rosales)...");
const mockConfigPuntajes = {
  carrera: "Medicina",
  puntaje_total: 40,
  nota_total_manuales: 5,
  nota_total_pruebas: 5,
  examenes: {
    "5": 10,
    "11": 10,
    "16": 10
  }
};

// 16 semanas totales de Medicina: semanas 5, 11 y 16 son exámenes; 13 son regulares
const semanasMedicina = [];
for (let i = 1; i <= 16; i++) {
  const isEx = i === 5 || i === 11 || i === 16;
  semanasMedicina.push({
    numero_semana: i,
    nombre_semana: isEx ? `Examen Semana ${i}` : `Semana ${i}`,
    descripcion: isEx ? "Examen Parcial" : "Clases",
    es_examen: isEx,
    parcial: i <= 5 ? "I Parcial" : i <= 11 ? "II Parcial" : "III Parcial",
    temas: isEx ? "EXAMEN PARCIAL" : `Tema de la semana ${i}`
  });
}

// 22 temas con manual
const temarioMedicina = [];
for (let i = 1; i <= 22; i++) {
  temarioMedicina.push({
    id: `tema-med-${i}`,
    numero_tema: i,
    titulo: `Tema ${i}`,
    tiene_manual: true,
    semana: Math.min(15, Math.ceil(i / 1.5))
  });
}

// Juan Rosales tiene:
// - 6 manuales con nota 1.0 (sobre 22 evaluables) -> Suma Bruta: 6.0 / 22 -> Puntos Oro: (6/22)*5 = 1.364 pts
// - 13 pruebas con nota 5.0 (sobre 13 regulares) -> Suma Bruta: 65 / 65 -> Puntos Oro: 5.0 pts
// - I Examen Parcial: 10.0 pts
// - Total Oficial Esperado: 10 + 5 + 1.364 = 16.364 / 40 pts
const studentJuan = {
  numero_cuenta: "20211000001",
  nombre_completo: "JUAN CARLOS ROSALES",
  carrera: "Medicina",
  primer_examen: 10,
  segundo_examen: 0,
  tercer_examen: 0,
  notas: {
    primer_examen: 10,
    // 6 manuales evaluados con 1 pt
    "manual_tema-med-1": 1,
    "manual_tema-med-2": 1,
    "manual_tema-med-3": 1,
    "manual_tema-med-4": 1,
    "manual_tema-med-5": 1,
    "manual_tema-med-6": 1,
    // 13 pruebas semanales evaluadas con 5 pts (semanas 1..4, 6..10, 12..15)
    prueba_1: 5, prueba_2: 5, prueba_3: 5, prueba_4: 5,
    prueba_6: 5, prueba_7: 5, prueba_8: 5, prueba_9: 5, prueba_10: 5,
    prueba_12: 5, prueba_13: 5, prueba_14: 5, prueba_15: 5
  }
};

const summary = calculateStudentAcademicSummary(studentJuan, mockConfigPuntajes, temarioMedicina, semanasMedicina);

console.log("Resultados obtenidos:");
console.log(`- Conteo de semanas de pruebas regulares: ${summary.countPruebas} (Esperado: 13)`);
console.log(`- Conteo de temas con manual evaluable: ${summary.countManuales} (Esperado: 22)`);
console.log(`- Nota Oro Manuales: ${summary.notaOroManuales} pts (Esperado: 1.364)`);
console.log(`- Nota Oro Pruebas: ${summary.notaOroPruebas} pts (Esperado: 5.000)`);
console.log(`- Suma Exámenes Parciales: ${summary.sumaExamenes} pts (Esperado: 10.000)`);
console.log(`- Total Acumulado Oficial: ${summary.total} pts (Esperado: 16.364)`);

assert.strictEqual(summary.countPruebas, 13, "Deben ser exactamente 13 pruebas regulares en Medicina");
assert.strictEqual(summary.countManuales, 22, "Deben ser exactamente 22 manuales en Medicina");
assert.strictEqual(summary.notaOroManuales, 1.364, "Nota Oro Manuales debe ser exactamente 1.364");
assert.strictEqual(summary.notaOroPruebas, 5, "Nota Oro Pruebas debe ser exactamente 5.0");
assert.strictEqual(summary.sumaExamenes, 10, "Suma Exámenes debe ser exactamente 10.0");
assert.strictEqual(summary.total, 16.364, "Total Acumulado debe ser exactamente 16.364");

console.log("\n===============================================================");
console.log(" ¡TODAS LAS PRUEBAS DE INTEGRIDAD ACADÉMICA PASARON AL 100%!");
console.log(" El sistema se encuentra 100% blindado contra cruce de datos,");
console.log(" colisiones de notas por temario y discrepancias matemáticas.");
console.log("===============================================================\n");
