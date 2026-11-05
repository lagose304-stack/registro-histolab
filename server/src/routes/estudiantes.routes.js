import { Router } from "express";
import {
  getEstudiantesBySeccion,
  getEstudianteByCuenta,
  createEstudiante,
  updateEstudiante,
  updateBatchGrades,
  saveWeeklyAttendance,
  saveWeeklyManuals,
  deleteEstudiante
} from "../controllers/estudiantes.controller.js";

import { authenticateInstructor } from "../middlewares/auth.middleware.js";
import { listManualDates, saveManualDate } from "../controllers/manualsSchedule.controller.js";

const router = Router();

router.put("/seccion/:seccion_id/asistencia/:semana", authenticateInstructor, saveWeeklyAttendance);
router.get("/seccion/:seccion_id/fechas-manuales", authenticateInstructor, listManualDates);
router.put("/seccion/:seccion_id/fechas-manuales/:semana", authenticateInstructor, saveManualDate);
router.put("/seccion/:seccion_id/manuales/:semana", authenticateInstructor, saveWeeklyManuals);

// Rutas de Estudiantes
router.get("/seccion/:seccion_id", getEstudiantesBySeccion);
router.get("/:carrera/:numero_cuenta", getEstudianteByCuenta);
router.put("/seccion/:seccion_id/batch", updateBatchGrades);
router.put("/batch/:seccion_id", updateBatchGrades);
router.post("/batch/:seccion_id", updateBatchGrades);
router.post("/", createEstudiante);
router.put("/:seccion_id/:numero_cuenta", updateEstudiante);
router.delete("/:seccion_id/:numero_cuenta", deleteEstudiante);

export default router;
