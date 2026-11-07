import { randomInt } from "node:crypto";

const pick = (value, keys) => Object.fromEntries(keys.filter(key => value?.[key] !== undefined).map(key => [key, value[key]]));
export function studentQuiz(quiz) {
  if (!quiz || !(quiz.publicada === true || String(quiz.publicada) === "true" || quiz.estado === "publicada")) return null;
  const output = pick(quiz, ["id","seccion_id","carrera","numero_semana","titulo","descripcion","instrucciones","publicada","estado","duracion_minutos","tiempo_limite_minutos","tiempo_por_pregunta_segundos","puntaje_total","tiene_bonus","puntaje_maximo_con_bonus","habilitada_en_vivo","control_en_vivo"]);
  const questions = typeof quiz.preguntas === "string" ? JSON.parse(quiz.preguntas) : quiz.preguntas || [];
  output.preguntas = questions.map(question => ({ ...pick(question,["id","numero","enunciado","imagen_url","puntos","tiempo_segundos","es_bonus"]), items: (question.items || []).map(item => {
    const clean = pick(item,["id","tipo","instruccion","etiqueta","puntos","cantidad","texto_completar"]);
    if (item.opciones) clean.opciones = item.opciones.map(option => pick(option,["id","texto"]));
    if (item.pares) {
      clean.pares = item.pares.map(pair => pick(pair,["id","termino"]));
      clean.definiciones = item.pares.map(pair => pair.definicion).filter(Boolean);
      for (let index = clean.definiciones.length - 1; index > 0; index--) {
        const target = randomInt(index + 1);
        [clean.definiciones[index], clean.definiciones[target]] = [clean.definiciones[target], clean.definiciones[index]];
      }
    }
    return clean;
  }) }));
  return output;
}
export const studentLiveState = session => session && pick(session,["seccion_id","numero_semana","carrera","estado","habilitada","pregunta_actual_idx","duracion_segundos","pregunta_inicio_timestamp","tiempo_restante_segundos","tiempo_transcurrido_segundos","server_time","integridad"]);

export function sanitizeClientAudit(audit) {
  const source = audit && typeof audit === "object" && !Array.isArray(audit) ? audit : {};
  const clean = pick(source,["motivo_finalizacion","hora_inicio","hora_fin","conexion_al_enviar","politica_integridad","sincronizada_offline","hora_sincronizacion"]);
  for (const key of Object.keys(clean)) clean[key] = typeof clean[key] === "string" ? clean[key].slice(0,160) : Boolean(clean[key]);
  for (const key of ["strikes","total_salidas","tiempo_fuera_segundos","duracion_total_segundos","intentos_pegar_texto"]) clean[key] = Math.min(86400,Math.max(0,Number(source[key]) || 0));
  clean.incidentes = (Array.isArray(source.incidentes) ? source.incidentes : []).slice(-100).map(incident => ({
    tipo: String(incident?.tipo || "sin_tipo").slice(0,80), detalle: String(incident?.detalle || "").slice(0,500),
    hora: String(incident?.hora || "").slice(0,80), segundosFuera: Math.min(86400,Math.max(0,Number(incident?.segundosFuera) || 0)),
    strike: Math.min(3,Math.max(0,Number(incident?.strike) || 0)), origen: "cliente_no_verificado"
  }));
  clean.strikes = Math.min(3,clean.strikes);
  clean.origen_integridad = "declarado_por_cliente_no_prueba_de_fraude";
  return clean;
}
