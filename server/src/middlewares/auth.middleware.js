import jwt from "jsonwebtoken";
import { hasAdministrationAccess, normalizeInstructorRole } from "../../../shared/instructorRoles.mjs";
import dotenv from "dotenv";
import { supabase, isSupabaseConfigured } from "../db/supabase.js";
import { getInstructorByIdOrEmail, getStudentByCuentaAndCarrera, getStudentSession } from "../controllers/auth.controller.js";

dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET;

export const authenticateInstructor = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        success: false,
        reason: "NO_TOKEN",
        message: "Acceso denegado. Se requiere inicio de sesión de instructor."
      });
    }

    const token = authHeader.split(" ")[1];
    let decoded;
    try {
      decoded = jwt.verify(token, JWT_SECRET);
    } catch (jwtErr) {
      return res.status(401).json({
        success: false,
        reason: "INVALID_TOKEN",
        message: "Tu sesión ha expirado o el token es inválido. Por favor ingresa nuevamente."
      });
    }

    if (decoded.rol === "ESTUDIANTE") return res.status(403).json({success:false,reason:"FORBIDDEN_ROLE",message:"Se requiere una sesión de instructor."});

    // Obtener el instructor actual desde la base de datos o memoria
    const instructor = await getInstructorByIdOrEmail(decoded.id, decoded.email);

    if (!instructor) {
      return res.status(401).json({
        success: false,
        reason: "INSTRUCTOR_NOT_FOUND",
        message: "Instructor no encontrado en el sistema."
      });
    }

    if (!instructor.activo) {
      return res.status(403).json({
        success: false,
        reason: "ACCOUNT_INACTIVE",
        message: "Esta cuenta de instructor ha sido desactivada por seguridad."
      });
    }

    const isCreator = normalizeInstructorRole(instructor.rol) === "Creador";
    if (isCreator || decoded.creator_session) {
      let session = null;
      if (isCreator && decoded.session_id) {
        const { data, error } = await supabase.from("creator_sessions")
          .select("session_id")
          .eq("instructor_id", instructor.id)
          .eq("session_id", decoded.session_id)
          .gt("expires_at", new Date().toISOString())
          .maybeSingle();
        if (error) throw error;
        session = data;
      }
      if (!session) {
        return res.status(401).json({
          success: false,
          reason: "INVALID_TOKEN",
          message: "Tu sesión ya no está activa. Por favor ingresa nuevamente."
        });
      }
    } else if (decoded.session_id && instructor.current_session_token && instructor.current_session_token !== decoded.session_id) {
      return res.status(401).json({
        success: false,
        reason: "CONCURRENT_SESSION_DETECTED",
        message: "Tu sesión ha sido cerrada porque se inició sesión desde otro dispositivo o pestaña."
      });
    }

    req.instructor = {
      ...decoded,
      ...instructor
    };

    next();
  } catch (error) {
    console.error("Error en authenticateInstructor:", error);
    return res.status(401).json({
      success: false,
      reason: "AUTH_ERROR",
      message: "Error al validar la sesión",
      error: error.message
    });
  }
};

export function requireAdministration(req, res, next) {
  if (!hasAdministrationAccess(req.instructor?.rol)) {
    return res.status(403).json({
      success: false,
      message: "Se requiere acceso a Administración General."
    });
  }
  next();
}

export const authenticateStudent = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        success: false,
        reason: "NO_TOKEN",
        message: "Acceso denegado. Se requiere inicio de sesión de estudiante."
      });
    }

    const token = authHeader.split(" ")[1];
    let decoded;
    try {
      decoded = jwt.verify(token, JWT_SECRET);
    } catch (jwtErr) {
      return res.status(401).json({
        success: false,
        reason: "INVALID_TOKEN",
        message: "Tu sesión ha expirado o el token es inválido. Por favor ingresa nuevamente."
      });
    }

    if (decoded.rol !== "ESTUDIANTE") {
      return res.status(403).json({
        success: false,
        reason: "FORBIDDEN_ROLE",
        message: "Acceso denegado. Se requiere cuenta de estudiante."
      });
    }

    const student = await getStudentByCuentaAndCarrera(decoded.numero_cuenta, decoded.carrera);

    if (!student) {
      return res.status(401).json({
        success: false,
        reason: "STUDENT_NOT_FOUND",
        message: "Estudiante no encontrado en el sistema."
      });
    }

    if (!student.activo) {
      return res.status(403).json({
        success: false,
        reason: "ACCOUNT_INACTIVE",
        message: "Esta cuenta de estudiante ha sido desactivada."
      });
    }

    // 🔒 VALIDACIÓN DE SESIÓN CONCURRENTE / ÚNICA:
    // Verifica contra la base de datos (current_session_token) o el registro en memoria
    const activeSessionId = student.current_session_token || getStudentSession(decoded.carrera, decoded.numero_cuenta);

    if (decoded.session_id && activeSessionId && activeSessionId !== decoded.session_id) {
      return res.status(401).json({
        success: false,
        reason: "CONCURRENT_SESSION_DETECTED",
        message: "Tu sesión ha sido cerrada porque se inició sesión desde otro dispositivo o pestaña."
      });
    }

    req.student = {
      ...decoded,
      ...student
    };

    next();
  } catch (error) {
    console.error("Error en authenticateStudent:", error);
    return res.status(401).json({
      success: false,
      reason: "AUTH_ERROR",
      message: "Error al validar la sesión del estudiante",
      error: error.message
    });
  }
};
