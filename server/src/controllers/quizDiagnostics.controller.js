import { saveQuizDiagnostic, listQuizDiagnostics } from "../services/quizDiagnostics.js";

export async function saveDiagnostic(req,res) {
  if (!req.student) return res.status(403).json({success:false,message:"El diagnóstico corresponde a la sesión estudiantil."});
  try {
    const data=await saveQuizDiagnostic(req.params.seccion_id,Number(req.params.semana),req.student,req.params.intento_id,req.body);
    return res.json({success:true,data});
  } catch { return res.status(503).json({success:false,message:"Diagnóstico pendiente. Esto no afecta a la prueba ni a sus respuestas."}); }
}
export async function reviewDiagnostics(req,res) {
  if (req.student) return res.status(403).json({success:false,message:"La revisión del diagnóstico corresponde al docente autorizado."});
  try {
    const data=await listQuizDiagnostics(req.params.seccion_id,Number(req.params.semana),req.params.numero_cuenta);
    return res.json({success:true,data});
  } catch { return res.status(503).json({success:false,message:"No se pudo consultar el diagnóstico técnico."}); }
}
