import jwt from "jsonwebtoken";
import dotenv from "dotenv";
import { supabase, isSupabaseConfigured } from "../db/supabase.js";
import { getInstructorByIdOrEmail } from "../controllers/auth.controller.js";

dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET || "histolab_default_secret_key_2026";

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

    // 🔒 VALIDACIÓN DE SESIÓN CONCURRENTE / ÚNICA:
    // Si el session_id del token no coincide con current_session_token, significa que
    // alguien inició sesión en otro navegador, pestaña o dispositivo.
    if (decoded.session_id && instructor.current_session_token && instructor.current_session_token !== decoded.session_id) {
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
