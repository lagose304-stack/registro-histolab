import { isQuizItemMultiSlot, quizItemSlotCount, quizItemIssues } from "./quizItems.mjs";

export const isAutomaticQuizItem = item => ["seleccion_multiple", "verdadero_falso", "terminos_pareados"].includes(item?.tipo);
const milli = value => Number.isFinite(Number(value)) ? Math.max(0, Math.round(Number(value) * 1000)) : 0;
const text = value => typeof value === "string" ? value.normalize("NFC").trim() : "";
export const splitQuizPoints = (points, count) => {
  const total = milli(points), base = Math.floor(total / count), remainder = total % count;
  return Array.from({length:count},(_,index)=>(base+(index<remainder?1:0))/1000);
};

// Se ejecuta en el servidor usando la prueba guardada. La misma estructura sirve para la revisión.
export function buildAutomaticQuizAssessment(questions = [], answers = {}) {
  const automatic = {}, manual = [];
  for (const question of questions) {
    const items = Array.isArray(question.items) ? question.items : [];
    if (!items.length) {
      manual.push({ key:`${question.id}___direct`, pregunta_id:question.id, item_id:null, puntos_max:milli(question.puntos ?? 1)/1000 });
      continue;
    }
    for (const item of items) {
      const points = milli(item.puntos ?? (Number(question.puntos ?? 1)/items.length))/1000;
      const slots = isQuizItemMultiSlot(item) ? quizItemSlotCount(item) : 1;
      const weights = splitQuizPoints(points,slots);
      const canAuto = isAutomaticQuizItem(item) && !quizItemIssues({...item,instruccion:item.instruccion || "Respuesta"},true).length;
      const answer = answers?.[question.id]?.[item.id] ?? answers?.[item.id];
      for (let index=0;index<slots;index++) {
        const multi = isQuizItemMultiSlot(item);
        const key = `${question.id}___${item.id}${multi ? `___slot_${index}` : ""}`;
        const record = { key, pregunta_id:question.id, item_id:item.id, ...(multi ? {slot_idx:index}:{}), puntos_max:weights[index] };
        if (!canAuto) { manual.push(record); continue; }
        const expected = item.tipo === "seleccion_multiple" ? item.opciones.find(option=>option.id===item.respuesta_correcta)?.texto
          : item.tipo === "verdadero_falso" ? item.respuesta_correcta : item.pares[index]?.definicion;
        const submitted = multi ? (Array.isArray(answer) ? answer[index] : null) : answer;
        const correct = Boolean(text(expected)) && text(submitted)===text(expected);
        const {key:_,...metadata}=record;
        automatic[key]={...metadata,estado:correct?"buena":"mala",puntos_obtenidos:correct?weights[index]:0,origen:"automatica"};
      }
    }
  }
  return { version:1, automaticas:automatic, manuales:manual };
}

// Solo se aceptan notas manuales para las casillas pendientes; las automáticas son inmutables.
export function resolveQuizAssessment(assessment, manualEvaluations = {}) {
  const evaluations={...assessment.automaticas};
  let pending=0;
  for (const descriptor of assessment.manuales) {
    const requested=manualEvaluations?.[descriptor.key];
    if (!requested || !["buena","regular","mala"].includes(requested.estado) || !Number.isFinite(Number(requested.puntos_obtenidos))) {pending++;continue;}
    const {key,...metadata}=descriptor;
    evaluations[key]={...metadata,estado:requested.estado,puntos_obtenidos:Math.max(0,Math.min(descriptor.puntos_max,Math.round(Number(requested.puntos_obtenidos)*1000)/1000)),origen:"manual"};
  }
  const raw=Object.values(evaluations).reduce((sum,record)=>sum+milli(record.puntos_obtenidos),0)/1000;
  const automaticScore=Object.values(assessment.automaticas).reduce((sum,record)=>sum+milli(record.puntos_obtenidos),0)/1000;
  return { evaluations, pending, automaticCount:Object.keys(assessment.automaticas).length, automaticScore, complete:pending===0 && Object.keys(evaluations).length>0, raw, official:Math.min(5,raw) };
}
