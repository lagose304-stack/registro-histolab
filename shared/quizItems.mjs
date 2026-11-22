export const RELATED_QUIZ_ITEM = "respuestas_relacionadas";
export const QUIZ_ITEM_TYPES = [
  { id: "texto_corto", label: "Respuesta corta", description: "El estudiante escribe una respuesta breve." },
  { id: "listado", label: "Numeración", description: "Solicita varias respuestas en casillas separadas." },
  { id: "completacion", label: "Completación", description: "Completa palabras o términos dentro de una oración." },
  { id: "seleccion_multiple", label: "Selección múltiple", description: "Presenta opciones y una respuesta correcta." },
  { id: "verdadero_falso", label: "Verdadero o falso", description: "El estudiante decide si la afirmación es verdadera." },
  { id: "terminos_pareados", label: "Términos pareados", description: "Relaciona cada término con su definición." },
  { id: RELATED_QUIZ_ITEM, label: "Respuestas relacionadas", description: "Agrupa campos de escritura y califica cada campo por separado." }
];
export const RELATED_FIELDS_MIN = 2;
export const RELATED_FIELDS_MAX = 6;
export const RELATED_GROUPS_MAX = 10;
export const RELATED_LABEL_MAX = 80;
const boundedCount = (value, min, max) => Number.isInteger(value) && value >= min && value <= max;
export const quizRelatedFieldCount = item => boundedCount(item.campos?.length, RELATED_FIELDS_MIN, RELATED_FIELDS_MAX) ? item.campos.length : RELATED_FIELDS_MIN;
export const quizRelatedGroupCount = item => boundedCount(item.grupos, 1, RELATED_GROUPS_MAX) ? item.grupos : 1;
export const quizRelatedFieldName = (item, index) => {
  const label = item.campos?.[index];
  return (typeof label === "string" && label.trim()) || `Campo ${index + 1}`;
};
export const quizItemLabel = item => QUIZ_ITEM_TYPES.find(type => type.id === item?.tipo)?.label || "Numeración";
export const isQuizItemMultiSlot = item => !["texto_corto", "seleccion_multiple", "verdadero_falso"].includes(item?.tipo);
export const completionParts = text => String(text || "").split(/_{3,}/);
export const completionBlankCount = text => Math.max(0, completionParts(text).length - 1);
export function quizItemSlotCount(item) {
  if (item?.tipo === RELATED_QUIZ_ITEM) return quizRelatedGroupCount(item) * quizRelatedFieldCount(item);
  if (item?.tipo === "completacion") return Math.max(1, completionBlankCount(item.texto_completar));
  if (!isQuizItemMultiSlot(item)) return 1;
  return Math.max(1, item.tipo === "terminos_pareados" ? item.pares?.length || item.cantidad || 3 : Number(item.cantidad) || 3);
}
export function quizSlotLabel(item, index) {
  if (item.tipo === "terminos_pareados") return item.pares?.[index]?.termino || `Término ${index + 1}`;
  if (item.tipo === RELATED_QUIZ_ITEM) {
    const fields = quizRelatedFieldCount(item);
    const name = quizRelatedFieldName(item, index % fields);
    return quizRelatedGroupCount(item) > 1 ? `Grupo ${Math.floor(index / fields) + 1} · ${name}` : name;
  }
  return `${index + 1}.`;
}

export function createQuizItem(type, id) {
  const base = { id, tipo: type, instruccion: "", etiqueta: "", puntos: 1, cantidad: 1, respuesta_modelo: "", respuestas_esperadas: [] };
  if (type === RELATED_QUIZ_ITEM) return { ...base, grupos: 1, campos: ["", ""], cantidad: 2 };
  if (type === "completacion") return { ...base, instruccion: "Completa los espacios en blanco.", etiqueta: "Completa los espacios en blanco.", texto_completar: "", cantidad: 0 };
  if (type === "seleccion_multiple") return { ...base, opciones: Array.from({ length: 4 }, (_, index) => ({ id: `op_${index + 1}`, texto: "" })), respuesta_correcta: "" };
  if (type === "verdadero_falso") return { ...base, respuesta_correcta: "" };
  if (type === "terminos_pareados") return { ...base, cantidad: 3, pares: Array.from({ length: 3 }, (_, index) => ({ id: `par_${index + 1}`, termino: "", definicion: "" })) };
  return { ...base, cantidad: type === "listado" ? 3 : 1 };
}

// Mantener las claves históricas permite revisar y calificar con las entregas existentes.
export function syncQuizItemAnswerKey(item) {
  if (item.tipo === RELATED_QUIZ_ITEM) {
    return { ...item, grupos: quizRelatedGroupCount(item), campos: item.campos.map(label => label.trim()), cantidad: quizItemSlotCount(item) };
  }
  if (item.tipo === "completacion") {
    const count = completionBlankCount(item.texto_completar);
    const answers = Array.from({ length: count }, (_, index) => item.respuestas_esperadas?.[index] || "");
    return { ...item, cantidad: count, respuestas_esperadas: answers, respuesta_modelo: answers.map((answer,index) => `${index + 1}. ${answer}`).join("\n") };
  }
  if (item.tipo === "seleccion_multiple") {
    const options = Array.isArray(item.opciones) ? item.opciones : [];
    const answer = options.find(option => option?.id === item.respuesta_correcta)?.texto || "";
    return { ...item, opciones: options, cantidad: 1, respuestas_esperadas: answer ? [answer] : [], respuesta_modelo: answer };
  }
  if (item.tipo === "verdadero_falso") {
    const answer = ["Verdadero", "Falso"].includes(item.respuesta_correcta) ? item.respuesta_correcta : "";
    return { ...item, cantidad: 1, respuestas_esperadas: answer ? [answer] : [], respuesta_modelo: answer };
  }
  if (item.tipo === "terminos_pareados") {
    const pairs = Array.isArray(item.pares) ? item.pares : [];
    return { ...item, pares: pairs, cantidad: pairs.length, respuestas_esperadas: pairs.map(pair => pair?.definicion || ""), respuesta_modelo: pairs.map(pair => `${pair?.termino || ""} → ${pair?.definicion || ""}`).join("\n") };
  }
  return item;
}

export function quizItemIssues(item, published = true) {
  const issues = [];
  if (item.tipo === "listado" && (!Number.isInteger(Number(item.cantidad)) || Number(item.cantidad) < 1 || Number(item.cantidad) > 10)) issues.push("El número de respuestas debe ser un entero entre 1 y 10.");
  if (typeof (item.instruccion ?? "") !== "string" || typeof (item.etiqueta ?? "") !== "string") issues.push("La instrucción debe ser texto.");
  if (published && !String(item.instruccion || item.etiqueta || "").trim()) issues.push("Escribe la instrucción o afirmación.");
  if (item.tipo === RELATED_QUIZ_ITEM) {
    if (!boundedCount(item.grupos, 1, RELATED_GROUPS_MAX)) issues.push(`Indica entre 1 y ${RELATED_GROUPS_MAX} grupos.`);
    const fields = Array.isArray(item.campos) ? item.campos : [];
    if (!boundedCount(fields.length, RELATED_FIELDS_MIN, RELATED_FIELDS_MAX)) issues.push(`Agrega entre ${RELATED_FIELDS_MIN} y ${RELATED_FIELDS_MAX} campos por grupo.`);
    if (Array.from(fields).some(label => typeof label !== "string" || label.length > RELATED_LABEL_MAX)) {
      issues.push(`Las etiquetas deben ser texto de hasta ${RELATED_LABEL_MAX} caracteres.`);
    } else if (published && (fields.some(label => !label.trim()) || new Set(fields.map(label => label.trim().toLowerCase())).size !== fields.length)) {
      issues.push("Escribe una etiqueta diferente para cada campo.");
    }
  }
  if (item.tipo === "completacion") {
    const count = completionBlankCount(item.texto_completar);
    if (typeof (item.texto_completar ?? "") !== "string") issues.push("La oración debe ser texto.");
    if (count > 10) issues.push("Puedes incluir hasta 10 espacios en blanco.");
    if (published) {
      if (count < 1) issues.push("Escribe una oración con ___ donde deba completarse.");
      if (Array.from({ length: count }, (_,index) => item.respuestas_esperadas?.[index]).some(answer => typeof answer !== "string" || !answer.trim())) issues.push("Completa la respuesta correcta de cada espacio.");
    }
  }
  if (item.tipo === "seleccion_multiple") {
    const options = Array.isArray(item.opciones) ? item.opciones : [];
    if (options.some(option => !option || typeof option.id !== "string" || typeof option.texto !== "string")) issues.push("Las opciones deben contener identificador y texto.");
    if (options.length < 2 || options.length > 8) issues.push("La selección debe tener entre 2 y 8 opciones.");
    if (new Set(options.map(option => option?.id)).size !== options.length || options.some(option => !option?.id)) issues.push("Las opciones deben tener identificadores únicos.");
    if (published) {
      if (options.some(option => !String(option?.texto || "").trim())) issues.push("Completa el texto de todas las opciones.");
      if (new Set(options.map(option => String(option?.texto || "").trim().toLocaleLowerCase())).size !== options.length) issues.push("Las opciones deben ser diferentes.");
      if (!options.some(option => option?.id === item.respuesta_correcta)) issues.push("Marca la respuesta correcta.");
    }
  }
  if (item.tipo === "verdadero_falso" && published && !["Verdadero", "Falso"].includes(item.respuesta_correcta)) issues.push("Selecciona si la afirmación es verdadera o falsa.");
  if (item.tipo === "terminos_pareados") {
    const pairs = Array.isArray(item.pares) ? item.pares : [];
    if (pairs.some(pair => !pair || typeof pair.id !== "string" || typeof pair.termino !== "string" || typeof pair.definicion !== "string")) issues.push("Cada par debe contener identificador, término y definición.");
    if (new Set(pairs.map(pair => pair?.id)).size !== pairs.length) issues.push("Los pares deben tener identificadores únicos.");
    if (pairs.length < 2 || pairs.length > 10) issues.push("Agrega entre 2 y 10 pares.");
    if (published) {
      if (pairs.some(pair => !String(pair?.termino || "").trim() || !String(pair?.definicion || "").trim())) issues.push("Completa todos los términos y definiciones.");
      for (const key of ["termino", "definicion"]) if (new Set(pairs.map(pair => String(pair?.[key] || "").trim().toLocaleLowerCase())).size !== pairs.length) issues.push("Cada término y definición debe ser diferente.");
    }
  }
  return issues;
}

export function normalizeRelatedQuizAnswers(questions, answers) {
  const groups = questions.flatMap(question => {
    const related = (question.items || []).filter(item => item.tipo === RELATED_QUIZ_ITEM);
    if (!related.length) return [];
    const original = answers[question.id];
    const block = original && typeof original === "object" && !Array.isArray(original) ? original : {};
    const fields = Object.fromEntries(related.map(item => {
      const value = block[item.id];
      const fields = Array.from({ length: quizItemSlotCount(item) }, (_, index) => {
        const answer = Array.isArray(value) ? value[index] : undefined;
        return typeof answer === "string" ? answer : "";
      });
      return [item.id, fields];
    }));
    return [[question.id, { ...block, ...fields }]];
  });
  return groups.length ? { ...answers, ...Object.fromEntries(groups) } : answers;
}

export function quizPublicationIssues(questions = []) {
  const issues = [];
  questions.forEach((question, index) => {
    if (!question.items?.length && !String(question.enunciado || "").trim()) issues.push(`Pregunta ${index + 1}: añade al menos un apartado.`);
    (question.items || []).forEach((item, itemIndex) => quizItemIssues(item).forEach(issue => issues.push(`Pregunta ${index + 1}, apartado ${itemIndex + 1}: ${issue}`)));
  });
  return issues;
}

// Sattolo genera un ciclo sin posiciones fijas: ninguna definición coincide con su término.
// La semilla depende del apartado y sus pares para mantener el orden durante la respuesta y al recargar.
export function quizMatchingOptions(item) {
  // El servidor ya mezcló el banco sin posiciones fijas usando la clave privada.
  // Volver a mezclarlo aquí podría devolver una definición a su posición original.
  if (Array.isArray(item.definiciones)) return [...new Set(item.definiciones.filter(Boolean))];
  const options = [...new Set((item.pares || []).map(pair => pair.definicion).filter(Boolean))];
  let seed = 2166136261;
  const identity = JSON.stringify([item.id, (item.pares || []).map(pair => [pair.id, pair.termino, pair.definicion])]);
  for (let index = 0; index < identity.length; index++) seed = Math.imul(seed ^ identity.charCodeAt(index), 16777619) >>> 0;
  for (let index = options.length - 1; index > 0; index--) {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    const target = seed % index;
    [options[index], options[target]] = [options[target], options[index]];
  }
  return options;
}
