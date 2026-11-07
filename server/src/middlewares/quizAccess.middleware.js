import jwt from "jsonwebtoken";
import { authenticateInstructor, authenticateStudent } from "./auth.middleware.js";
import { supabase, isSupabaseConfigured } from "../db/supabase.js";
import { getLocalSchedulingSections } from "../controllers/secciones.controller.js";
import { getLocalSectionAssignments } from "../controllers/asignaciones.controller.js";
import { getQuizSubmissionForAccess } from "../controllers/pruebas.controller.js";
import { hasAdministrationAccess } from "../../../shared/instructorRoles.mjs";
import { isInstructorTitular, isSectionAssignedToInstructor, matchesInstructor } from "../../../shared/sectionAccess.mjs";
import { synchronizeQuizAssignments } from "../../../shared/quizAssignments.mjs";
import { studentQuiz, studentLiveState } from "./quizPrivacy.mjs";

// Decode is only a dispatcher: both branches verify the signature and current account.
export function authenticateQuiz(req,res,next) {
  const token = req.headers.authorization?.split(" ")[1];
  const decoded = token ? jwt.decode(token) : null;
  return decoded?.rol === "ESTUDIANTE" ? authenticateStudent(req,res,next) : authenticateInstructor(req,res,next);
}
const creation = ["Crear prueba semanal"];
const review = ["Revisión de prueba semanal","Subir nota de prueba semanal"];
export function quizAccess({ student = false, kind = "quiz", permission = "read", submission = false } = {}) {
  return async (req,res,next) => {
    try {
      const record = submission ? await getQuizSubmissionForAccess(req.params.entrega_id) : null;
      if (submission && !record) return res.status(404).json({success:false,message:"Entrega no encontrada."});
      const sectionId = record?.seccion_id || req.params.seccion_id;
      const week = record?.numero_semana || req.params.semana || req.body?.numero_semana;
      if (week !== undefined && (!Number.isInteger(Number(week)) || Number(week)<1)) return res.status(400).json({success:false,message:"Semana inválida."});
      let allowedWeeks = null;
      if (req.student) {
        if (!student || String(req.student.seccion_id || req.student.seccion?.id || "") !== String(sectionId)) return res.status(403).json({success:false,message:"No tienes acceso a esta sección u operación."});
        const account = String(req.student.numero_cuenta).trim();
        if ((req.params.numero_cuenta && String(req.params.numero_cuenta).trim() !== account) || (req.body?.numero_cuenta && String(req.body.numero_cuenta).trim() !== account)) return res.status(403).json({success:false,message:"Solo puedes consultar o enviar tus propias respuestas."});
        if (req.method === "POST") {
          req.body.numero_cuenta = account;
          req.body.nombre_completo = req.student.nombre_completo;
          req.body.carrera = req.student.carrera;
        }
      } else {
        if (!req.instructor) return res.status(401).json({success:false,message:"Inicia sesión."});
        let section;
        if (isSupabaseConfigured && supabase) {
          const {data,error} = await supabase.from("secciones").select("*").eq("id",sectionId).maybeSingle();
          if (error) throw error;
          section=data;
        } else section=getLocalSchedulingSections().find(item=>String(item.id)===String(sectionId));
        if (!section) return res.status(404).json({success:false,message:"Sección no encontrada."});
        const full = hasAdministrationAccess(req.instructor.rol) || isInstructorTitular(req.instructor,section);
        if (!full) {
          if (permission === "full") return res.status(403).json({success:false,message:"Esta operación requiere al titular de la sección."});
          let assignments;
          if (isSupabaseConfigured && supabase) {
            const {data,error}=await supabase.from("asignaciones_instructores").select("*").eq("seccion_id",sectionId);
            if (error) throw error;
            assignments=data || [];
          } else assignments=getLocalSectionAssignments(sectionId);
          // Match the normalized assignments returned to the instructor's UI,
          // including historical review-only rows and creation's precedence.
          const normalizedAssignments = synchronizeQuizAssignments(assignments);
          const member = isSectionAssignedToInstructor(req.instructor,section) || normalizedAssignments.some(item=>matchesInstructor(req.instructor,item.instructor_id,item.instructor_nombre,section));
          if (permission === "section-read") {
            if (!member) return res.status(403).json({success:false,message:"No perteneces al equipo de esta sección."});
          } else {
            const roles = permission === "create" ? creation : permission === "review" ? review : [...creation,...review];
            allowedWeeks = normalizedAssignments.filter(item=>roles.includes(item.tipo_asignacion) && matchesInstructor(req.instructor,item.instructor_id,item.instructor_nombre,section)).map(item=>Number(String(item.referencia_id).replace(/^semana_/,"")));
            const emptyOwnCatalog = permission === "read" && kind === "quiz" && !week && member;
            if (!(week ? allowedWeeks.includes(Number(week)) : allowedWeeks.length || emptyOwnCatalog)) return res.status(403).json({success:false,message:"No tienes asignada esta operación en la semana solicitada."});
          }
        }
        if (req.body && kind === "control") { req.body.es_titular = full; req.body.carrera=section.carrera; }
      }
      // Bind destructive identifiers to the checked resource, never to body/query overrides.
      if (record) req.quizSubmission = record;
      const json = res.json.bind(res);
      res.json = payload => {
        if (payload?.success && payload.data) {
          let data=payload.data;
          if (req.student && kind === "quiz") data=Array.isArray(data)?data.map(studentQuiz).filter(Boolean):studentQuiz(data);
          if (req.student && kind === "live") data=studentLiveState(data);
          // Awards need all weeks' grades, but never answer sheets or audit data.
          if (kind === "awards" && Array.isArray(data)) data=data.map(item=>Object.fromEntries(["id","numero_cuenta","numero_semana","estado","nota_obtenida","nota_real","nota_con_bonus"].filter(key=>item[key]!==undefined).map(key=>[key,item[key]])));
          if (allowedWeeks && Array.isArray(data)) data=data.filter(item=>allowedWeeks.includes(Number(item.numero_semana)));
          payload={...payload,data};
        }
        res.setHeader("Cache-Control","no-store");
        return json(payload);
      };
      next();
    } catch(error) {
      console.error("No se pudo verificar el acceso a pruebas:",error.message);
      return res.status(503).json({success:false,message:"No pudimos verificar el acceso. Reintenta en un momento."});
    }
  };
}
