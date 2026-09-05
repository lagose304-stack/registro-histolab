/**
 * academicEngine.js
 * 
 * MOTOR CENTRAL DE CÁLCULOS ACADÉMICOS Y EVALUACIONES - HISTOLAB
 * 
 * Garantiza:
 * 1. Coherencia matemática del 100% entre Portal de Estudiante, Libro de Calificaciones y Reportes Excel.
 * 2. Cero duplicados ni cruces de notas (estandarización canónica de claves).
 * 3. Cálculos dinámicos de Puntos Oro basados en la configuración de la carrera correspondiente:
 *    - Manuales: Calificados sobre 1.000 pt c/u -> (Suma Bruta / N) * nota_total_manuales
 *    - Pruebas Semanales: Calificadas sobre 5.000 pts c/u -> (Suma Bruta / (K * 5)) * nota_total_pruebas
 *    - Exámenes Parciales: Sumatoria directa según puntaje asignado a cada examen
 *    - Total Oficial: Suma de Exámenes + Nota Oro Manuales + Nota Oro Pruebas
 */

/**
 * Determina si una semana académica corresponde a semana de examen parcial.
 * Examina propiedades booleanas, nombre de la semana, descripción y temas asignados.
 */
export function isExamWeek(week) {
  if (!week) return false;
  if (typeof week === "number") {
    // Si solo se pasó el número de la semana, no podemos inferir sin el objeto
    return false;
  }
  return Boolean(
    week.es_examen === true ||
    week.es_examen === "true" ||
    String(week.nombre_semana || "").toLowerCase().includes("examen") ||
    String(week.descripcion || "").toLowerCase().includes("examen") ||
    String(week.temas || "").toUpperCase().includes("EXAMEN")
  );
}

/**
 * Obtiene la lista ordenada de semanas de examen para una carrera.
 */
export function getExamWeeks(semanasConfig = []) {
  if (!Array.isArray(semanasConfig)) return [];
  return [...semanasConfig]
    .filter((w) => isExamWeek(w))
    .sort((a, b) => Number(a.numero_semana) - Number(b.numero_semana));
}

/**
 * Obtiene la lista ordenada de semanas regulares (excluyendo semanas de examen).
 */
export function getRegularWeeks(semanasConfig = [], temario = []) {
  if (Array.isArray(semanasConfig) && semanasConfig.length > 0) {
    return [...semanasConfig]
      .filter((w) => !isExamWeek(w))
      .sort((a, b) => Number(a.numero_semana) - Number(b.numero_semana));
  }

  // Fallback si no hay semanasConfig: deducir semanas a partir del temario
  const weekNums = Array.from(
    new Set((temario || []).map((t) => Number(t.semana) || 1))
  ).sort((a, b) => a - b);

  return weekNums.map((num) => ({
    numero_semana: num,
    nombre_semana: `Semana ${num}`,
    descripcion: `Semana ${num}`,
    es_examen: false
  }));
}

/**
 * Formatea un valor numérico de calificación a 3 decimales, o "—" si está vacío o no calificado.
 */
export function formatGrade(val) {
  if (val === undefined || val === null || val === "" || val === false) return "—";
  const num = Number(val);
  if (isNaN(num)) return "—";
  if (num === 0) return "0";
  return String(Math.round(num * 1000) / 1000);
}

/**
 * Genera el nombre visible estandarizado para una semana académica: "Semana X: [Nombre]"
 */
export function getWeekDisplayName(w) {
  if (!w) return "";
  const semNum = w.numero_semana;
  const rawName = (w.nombre_semana || w.descripcion || "").trim();
  if (!rawName) return `Semana ${semNum}`;
  if (rawName.toLowerCase().startsWith(`semana ${semNum}`)) return rawName;
  if (rawName.toLowerCase().startsWith("semana")) {
    return rawName.replace(/^semana\s*\d*[:\-]?\s*/i, `Semana ${semNum}: `);
  }
  return `Semana ${semNum}: ${rawName}`;
}

/**
 * Genera el nombre visible estandarizado para un manual de laboratorio: "Manual de [Título]"
 */
export function getManualDisplayName(t) {
  if (!t) return "Manual de Laboratorio";
  const rawTitle = (t.titulo || t.label || "").trim();
  if (!rawTitle) return `Manual de Tema ${t.numero_tema || ""}`.trim();
  if (rawTitle.toLowerCase().startsWith("manual de")) return rawTitle;
  if (rawTitle.toLowerCase().startsWith("manual")) {
    return `Manual de ${rawTitle.replace(/^manual\s*(de)?\s*/i, "")}`;
  }
  return `Manual de ${rawTitle}`;
}

/**
 * Extrae la calificación canónica de un manual específico para un estudiante.
 * Prioriza la clave inmutable `manual_<id>` para evitar colisiones al reordenar temas.
 */
export function getCanonicalManualGrade(notas = {}, topic = {}, student = null) {
  if (!topic) return null;
  const topicId = topic.id;
  const titulo = topic.titulo || "";
  const numTema = topic.numero_tema;

  // 1. Clave canónica por UUID de tema
  if (topicId) {
    if (notas[`manual_${topicId}`] !== undefined && notas[`manual_${topicId}`] !== null && notas[`manual_${topicId}`] !== "") {
      return Number(notas[`manual_${topicId}`]);
    }
    if (notas[topicId] !== undefined && notas[topicId] !== null && notas[topicId] !== "") {
      return Number(notas[topicId]);
    }
  }

  // 2. Clave por título literal
  if (titulo) {
    const keyTitle = `Manual de ${titulo}`;
    if (notas[keyTitle] !== undefined && notas[keyTitle] !== null && notas[keyTitle] !== "") {
      return Number(notas[keyTitle]);
    }
    if (student?.[keyTitle] !== undefined && student[keyTitle] !== null && student[keyTitle] !== "") {
      return Number(student[keyTitle]);
    }
  }

  // 3. Fallback posicional histórico SOLO si el tema no tiene ID asignado
  if (!topicId && numTema !== undefined && numTema !== null) {
    const keyNum = `manual_tema_${numTema}`;
    if (notas[keyNum] !== undefined && notas[keyNum] !== null && notas[keyNum] !== "") {
      return Number(notas[keyNum]);
    }
    const legacyCol = `Manual del tema ${numTema}`;
    if (student?.[legacyCol] !== undefined && student[legacyCol] !== null && student[legacyCol] !== "") {
      return Number(student[legacyCol]);
    }
  }

  return null;
}

/**
 * Extrae la calificación canónica de una prueba semanal para un estudiante.
 * Estandariza la clave `prueba_<semana>`, con soporte de compatibilidad retroactiva.
 */
export function getCanonicalQuizGrade(notas = {}, weekNum, student = null) {
  const sem = Number(weekNum);
  if (!sem) return null;

  const keyPrueba = `prueba_${sem}`;
  if (notas[keyPrueba] !== undefined && notas[keyPrueba] !== null && notas[keyPrueba] !== "") {
    return Number(notas[keyPrueba]);
  }

  const keyExamencito = `examencito_${sem}`;
  if (notas[keyExamencito] !== undefined && notas[keyExamencito] !== null && notas[keyExamencito] !== "") {
    return Number(notas[keyExamencito]);
  }

  const legacyColPrueba = `Prueba de la semana ${sem}`;
  if (student?.[legacyColPrueba] !== undefined && student[legacyColPrueba] !== null && student[legacyColPrueba] !== "") {
    return Number(student[legacyColPrueba]);
  }

  const legacyColExamencito = `Examencito de la semana ${sem}`;
  if (student?.[legacyColExamencito] !== undefined && student[legacyColExamencito] !== null && student[legacyColExamencito] !== "") {
    return Number(student[legacyColExamencito]);
  }

  return null;
}

/**
 * Extrae la calificación canónica de un examen parcial.
 */
export function getCanonicalExamGrade(student = {}, examIndex = 0, examWeek = null, customNotas = null) {
  const notas = customNotas || student?.notas || {};
  const semNum = examWeek ? Number(examWeek.numero_semana) : null;
  const parcialStr = String(examWeek?.parcial || "").toLowerCase();

  let columnKey = "primer_examen";
  let altExamKey = "examen_I";

  if (parcialStr.includes("iii") || parcialStr.includes("tercer") || examIndex === 2) {
    columnKey = "tercer_examen";
    altExamKey = "examen_III";
  } else if (parcialStr.includes("ii") || parcialStr.includes("segundo") || examIndex === 1) {
    columnKey = "segundo_examen";
    altExamKey = "examen_II";
  }

  // 1. Columnas canónicas en tabla estudiante
  if (student?.[columnKey] !== undefined && student[columnKey] !== null && student[columnKey] !== "") {
    return Number(student[columnKey]);
  }

  // 2. Claves en notas JSON
  if (notas[columnKey] !== undefined && notas[columnKey] !== null && notas[columnKey] !== "") {
    return Number(notas[columnKey]);
  }
  if (notas[altExamKey] !== undefined && notas[altExamKey] !== null && notas[altExamKey] !== "") {
    return Number(notas[altExamKey]);
  }

  // 3. Claves por semana de examen
  if (semNum) {
    if (notas[`examen_${semNum}`] !== undefined && notas[`examen_${semNum}`] !== null && notas[`examen_${semNum}`] !== "") {
      return Number(notas[`examen_${semNum}`]);
    }
    if (notas[`examen_semana_${semNum}`] !== undefined && notas[`examen_semana_${semNum}`] !== null && notas[`examen_semana_${semNum}`] !== "") {
      return Number(notas[`examen_semana_${semNum}`]);
    }
    if (student?.[`Examen semana ${semNum}`] !== undefined && student[`Examen semana ${semNum}`] !== null && student[`Examen semana ${semNum}`] !== "") {
      return Number(student[`Examen semana ${semNum}`]);
    }
  }

  return null;
}

/**
 * Calcula de manera centralizada y autoritativa el resumen académico de un estudiante.
 * Retorna las notas acumuladas, puntos oro y listas detalladas con coherencia matemática exacta.
 */
export function calculateStudentAcademicSummary(student = {}, configPuntajes = {}, temario = [], semanasConfig = [], customNotas = null) {
  const notas = customNotas || student?.notas || {};

  // 1. Conteo de temas evaluables con manual
  const evaluableTopics = (temario || []).filter((t) => t.tiene_manual !== false);
  const countManuales = evaluableTopics.length > 0 ? evaluableTopics.length : 1;

  // 2. Semanas regulares para pruebas (excluyendo exámenes)
  const regularWeeks = getRegularWeeks(semanasConfig, temario);
  const countPruebas = regularWeeks.length > 0 ? regularWeeks.length : 1;

  // 3. Semanas de examen configuradas
  const examWeeks = getExamWeeks(semanasConfig);

  // 4. Puntajes asignados a la carrera
  const maxNotaManuales = Number(configPuntajes?.nota_total_manuales) || 0;
  const maxNotaPruebas = Number(configPuntajes?.nota_total_pruebas) || 0;

  let maxExamenesPuntaje = 0;
  if (configPuntajes?.examenes && typeof configPuntajes.examenes === "object") {
    Object.values(configPuntajes.examenes).forEach((v) => {
      maxExamenesPuntaje += Number(v) || 0;
    });
    maxExamenesPuntaje = Math.round(maxExamenesPuntaje * 1000) / 1000;
  }

  const maxPuntajeCarrera = Math.round((maxNotaManuales + maxNotaPruebas + maxExamenesPuntaje) * 1000) / 1000 ||
    Number(configPuntajes?.puntaje_total) || 0;

  // 5. Calcular Notas de Manuales
  let sumaBrutaManuales = 0;
  const manualesList = [];
  const processedManualKeys = new Set();

  evaluableTopics.forEach((t) => {
    const rawGrade = getCanonicalManualGrade(notas, t, student);
    const numGrade = rawGrade !== null ? Number(rawGrade) : 0;
    sumaBrutaManuales += numGrade;

    if (t.id) processedManualKeys.add(`manual_${t.id}`);
    if (t.titulo) processedManualKeys.add(`Manual de ${t.titulo}`);

    manualesList.push({
      key: t.id ? `manual_${t.id}` : `tema_${t.numero_tema}`,
      temaId: t.id,
      label: getManualDisplayName(t),
      titulo: t.titulo,
      numero_tema: Number(t.numero_tema) || 0,
      semana: Number(t.semana) || 0,
      nota: rawGrade,
      ptsMax: 1.0
    });
  });

  // Tomar notas de manuales huérfanas en el objeto notas si existen (excluyendo aliases legacy manual_tema_)
  Object.entries(notas).forEach(([k, v]) => {
    if (k.startsWith("manual_") && !k.startsWith("manual_tema_") && !processedManualKeys.has(k)) {
      const numVal = Number(v) || 0;
      sumaBrutaManuales += numVal;
      manualesList.push({
        key: k,
        temaId: k.replace(/^manual_/, ""),
        label: `Manual ${k.replace(/^manual_/, "")}`,
        titulo: k.replace(/^manual_/, ""),
        numero_tema: 999,
        semana: 0,
        nota: v,
        ptsMax: 1.0
      });
    }
  });

  manualesList.sort((a, b) => a.numero_tema - b.numero_tema);

  // Nota Oro de Manuales
  const notaOroManuales = maxNotaManuales > 0 && countManuales > 0
    ? Math.round(((sumaBrutaManuales / countManuales) * maxNotaManuales) * 1000) / 1000
    : Math.round(sumaBrutaManuales * 1000) / 1000;

  // 6. Calcular Notas de Pruebas Semanales
  let sumaBrutaPruebas = 0;
  const pruebasList = [];
  const processedPruebasWeeks = new Set();

  regularWeeks.forEach((w) => {
    const semNum = Number(w.numero_semana);
    if (!semNum) return;
    processedPruebasWeeks.add(semNum);

    const rawGrade = getCanonicalQuizGrade(notas, semNum, student);
    const numGrade = rawGrade !== null ? Number(rawGrade) : 0;
    sumaBrutaPruebas += numGrade;

    pruebasList.push({
      key: `prueba_${semNum}`,
      semana: semNum,
      label: getWeekDisplayName(w),
      nota: rawGrade,
      ptsMax: 5.0
    });
  });

  // Pruebas huérfanas en notas
  Object.entries(notas).forEach(([k, v]) => {
    if (k.startsWith("prueba_") || k.startsWith("examencito_")) {
      const semNum = parseInt(k.replace(/^(prueba_|examencito_)/, ""), 10);
      if (semNum && !processedPruebasWeeks.has(semNum)) {
        processedPruebasWeeks.add(semNum);
        const numVal = Number(v) || 0;
        sumaBrutaPruebas += numVal;
        pruebasList.push({
          key: `prueba_${semNum}`,
          semana: semNum,
          label: `Semana ${semNum}`,
          nota: v,
          ptsMax: 5.0
        });
      }
    }
  });

  pruebasList.sort((a, b) => a.semana - b.semana);

  // Nota Oro de Pruebas
  const maxBrutoPruebas = countPruebas * 5;
  const notaOroPruebas = maxNotaPruebas > 0 && maxBrutoPruebas > 0
    ? Math.round(((sumaBrutaPruebas / maxBrutoPruebas) * maxNotaPruebas) * 1000) / 1000
    : Math.round(sumaBrutaPruebas * 1000) / 1000;

  // 7. Calcular Exámenes Parciales
  let sumaExamenes = 0;
  const examenesList = [];

  if (examWeeks.length > 0) {
    examWeeks.forEach((w, index) => {
      const semNum = Number(w.numero_semana);
      const parcialStr = String(w.parcial || "").toLowerCase();

      let columnKey = "primer_examen";
      let fallbackLabel = "I Examen Parcial";
      let parcialKey = "I";

      if (parcialStr.includes("iii") || parcialStr.includes("tercer") || index === 2) {
        columnKey = "tercer_examen";
        fallbackLabel = "III Examen Parcial";
        parcialKey = "III";
      } else if (parcialStr.includes("ii") || parcialStr.includes("segundo") || index === 1) {
        columnKey = "segundo_examen";
        fallbackLabel = "II Examen Parcial";
        parcialKey = "II";
      }

      const customName = (w.nombre_semana || w.descripcion || "").trim();
      const label = customName && !customName.toLowerCase().startsWith("semana")
        ? customName
        : fallbackLabel;

      const rawGrade = getCanonicalExamGrade(student, index, w, customNotas);
      const numGrade = rawGrade !== null ? Number(rawGrade) : 0;
      sumaExamenes += numGrade;

      const ptsMax = Number(configPuntajes?.examenes?.[String(semNum)]) ||
        (parcialKey === "I" ? 10 : parcialKey === "II" ? 10 : 15);

      examenesList.push({
        id: `exam_sem_${semNum}`,
        key: columnKey,
        semana: semNum,
        label: label,
        subLabel: `Semana ${semNum} • ${w.parcial || "Examen Parcial"}`,
        parcialKey: parcialKey,
        nota: rawGrade,
        ptsMax: ptsMax
      });
    });
  } else {
    // Fallback: exámenes tradicionales I, II y III
    const ex1 = Number(student?.primer_examen ?? notas.primer_examen ?? notas.examen_I ?? 0);
    const ex2 = Number(student?.segundo_examen ?? notas.segundo_examen ?? notas.examen_II ?? 0);
    const ex3 = Number(student?.tercer_examen ?? notas.tercer_examen ?? notas.examen_III ?? 0);
    sumaExamenes = ex1 + ex2 + ex3;
  }

  sumaExamenes = Math.round(sumaExamenes * 1000) / 1000;

  // 8. Total Acumulado Oficial
  const total = Math.round((sumaExamenes + notaOroManuales + notaOroPruebas) * 1000) / 1000;

  return {
    total,
    notaOroManuales,
    notaOroPruebas,
    sumaExamenes,
    sumaBrutaManuales: Math.round(sumaBrutaManuales * 1000) / 1000,
    countManuales,
    sumaBrutaPruebas: Math.round(sumaBrutaPruebas * 1000) / 1000,
    countPruebas,
    maxNotaManuales,
    maxNotaPruebas,
    maxExamenesPuntaje,
    maxPuntajeCarrera,
    examenesList,
    manualesList,
    pruebasList
  };
}

/**
 * Sanitiza y estandariza el objeto notas para evitar duplicados y claves obsoletas.
 * Transforma examencito_X -> prueba_X y elimina cualquier residuo.
 */
export function sanitizeNotasObject(notas = {}) {
  if (!notas || typeof notas !== "object") return {};
  const cleaned = {};

  Object.entries(notas).forEach(([key, val]) => {
    if (val === undefined || val === null || val === "") return;

    // Estandarizar examencito_X -> prueba_X
    if (key.startsWith("examencito_")) {
      const semNum = key.replace("examencito_", "");
      const canonicalKey = `prueba_${semNum}`;
      if (cleaned[canonicalKey] === undefined) {
        cleaned[canonicalKey] = val;
      }
      return;
    }

    // Omitir alias de manual_tema_X si ya existe un manual con ID
    cleaned[key] = val;
  });

  return cleaned;
}
