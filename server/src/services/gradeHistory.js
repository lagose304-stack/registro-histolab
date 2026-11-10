import {
  getCanonicalExamGrade, getCanonicalManualGrade, getExamMetadata, getExamWeeks
} from "../../../client/src/utils/academicEngine.js";

export function gradeInstructorName(instructor) {
  return instructor?.nombre_completo?.trim() ||
    [instructor?.primer_nombre, instructor?.segundo_nombre, instructor?.primer_apellido, instructor?.segundo_apellido]
      .map(part => part?.trim()).filter(Boolean).join(" ") || "Docente";
}

export function withGradeActor(query, instructor) {
  return instructor?.id ? query.setHeader("x-histolab-grade-actor", String(instructor.id)) : query;
}

export function localGradeSnapshot(student, topics, weeks) {
  const notes = student?.notas || {};
  const grades = new Map();
  const put = (key, label, value) => {
    if (value !== null && value !== undefined && value !== "" && Number.isFinite(Number(value))) {
      grades.set(key, { label, value: Number(value) });
    }
  };

  for (const [key, value] of Object.entries(notes)) {
    if (key.endsWith("_real") || key.startsWith("manual_tema_")) continue;
    const quiz = /^(?:prueba_|examencito_|Prueba de la semana )(\d+)$/.exec(key);
    if (quiz) {
      const canonical = `prueba_${quiz[1]}`;
      put(canonical, `Prueba · Semana ${quiz[1]}`, notes[canonical] ?? notes[`examencito_${quiz[1]}`] ?? value);
    } else {
      put(key, key.replaceAll("_", " "), value);
    }
  }

  for (const topic of topics) {
    const key = `manual_${topic.id}`;
    for (const alias of [key, topic.id, `Manual de ${topic.titulo}`]) grades.delete(alias);
    put(key, `Manual · ${topic.titulo}`, getCanonicalManualGrade(notes, topic, student));
  }

  const exams = getExamWeeks(weeks);
  for (let index = 0; index < Math.max(3, exams.length); index++) {
    const week = exams[index];
    const { key, legacyKey, aliasKey } = getExamMetadata(week, index);
    for (const alias of [legacyKey, aliasKey, ...(week ? [key, `examen_${week.numero_semana}`] : [])]) {
      grades.delete(alias);
    }
    put(week ? key : legacyKey, week ? `Examen · Semana ${week.numero_semana}` : legacyKey.replaceAll("_", " "),
      getCanonicalExamGrade(student, index, week));
  }

  return grades;
}
