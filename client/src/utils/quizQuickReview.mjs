import { isAutomaticQuizItem } from "../../../shared/quizAutoGrading.mjs";

// Las notas guardadas se conservan para el envío, pero no preseleccionan una
// nueva valoración. Solo se muestran elecciones de esta revisión y este alumno.
export function quickReviewSelections(evaluations, selections, submissionId) {
  return Object.fromEntries(Object.entries(evaluations[submissionId] || {})
    .filter(([key]) => selections[submissionId]?.[key] === true));
}

// Proyección exclusiva de la vista: los índices originales mantienen la identidad
// de preguntas/incisos, la posición guardada y el bonus histórico de la pregunta 6.
export function manualQuickReviewQuestions(questions = []) {
  return questions.flatMap((question, questionIndex) => {
    const items = Array.isArray(question.items) ? question.items : [];
    if (!items.length) return [{ ...question, reviewQuestionIndex: questionIndex, reviewManualPoints: Number(question.puntos || 1) }];
    const defaultPoints = Math.round((Number(question.puntos || 1) / items.length) * 1000) / 1000;
    const manualItems = items.flatMap((item, itemIndex) => isAutomaticQuizItem(item) ? [] : [{
      ...item, reviewItemIndex: itemIndex,
      puntos: item.puntos !== undefined && !isNaN(Number(item.puntos)) ? item.puntos : defaultPoints
    }]);
    return manualItems.length ? [{ ...question, items: manualItems, reviewQuestionIndex: questionIndex,
      reviewManualPoints: Math.round(manualItems.reduce((sum, item) => sum + Number(item.puntos), 0) * 1000) / 1000 }] : [];
  });
}
