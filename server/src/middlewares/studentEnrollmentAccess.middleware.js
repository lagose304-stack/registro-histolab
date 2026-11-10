import {supabase,isSupabaseConfigured} from "../db/supabase.js";
import {getLocalSchedulingSections} from "../controllers/secciones.controller.js";
import {canViewSection,isInstructorTitular} from "../../../shared/sectionAccess.mjs";
import {hasAdministrationAccess} from "../../../shared/instructorRoles.mjs";

const sectionAccess=(manage, deniedMessage)=>async(req,res,next)=>{
 const id=req.params?.seccion_id||req.body?.seccion_id;
 if(!id)return res.status(400).json({success:false,message:"Selecciona la sección del estudiante."});
 try{
  let section;
  if(isSupabaseConfigured&&supabase){const {data,error}=await supabase.from("secciones").select("*").eq("id",id).maybeSingle();if(error)throw error;section=data;}
  else section=getLocalSchedulingSections().find(item=>String(item.id)===String(id));
  if(!section)return res.status(404).json({success:false,message:"La sección no existe."});
  const allowed=manage?(hasAdministrationAccess(req.instructor?.rol)||isInstructorTitular(req.instructor,section)):canViewSection(req.instructor,section);
  if(!allowed)return res.status(403).json({success:false,message:deniedMessage ?? (manage?"Solo el titular de la sección y Administración General pueden gestionar la matrícula y el correo.":"No tienes acceso a los estudiantes de esta sección.")});
  if(req.body)req.body.carrera=section.carrera;
  if(req.query)req.query.carrera=section.carrera;
  next();
 }catch{return res.status(503).json({success:false,message:"No pudimos verificar el acceso a la sección."});}
};
export const requireStudentEnrollmentManager=sectionAccess(true);
export const requireStudentSectionReader=sectionAccess(false);

export const requireGradeHistoryReader = sectionAccess(true, "Solo el titular, Coordinación y el Creador pueden consultar este historial.");
