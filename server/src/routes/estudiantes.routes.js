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

import { authenticateInstructor,authenticateStudent, requireCreator } from "../middlewares/auth.middleware.js";
import {requireStudentEnrollmentManager,requireStudentSectionReader} from "../middlewares/studentEnrollmentAccess.middleware.js";
import { listManualDates, saveManualDate } from "../controllers/manualsSchedule.controller.js";

const router = Router();

router.put("/seccion/:seccion_id/migracion", authenticateInstructor, requireCreator, updateBatchGrades);

router.put("/seccion/:seccion_id/asistencia/:semana", authenticateInstructor, saveWeeklyAttendance);
router.get("/seccion/:seccion_id/fechas-manuales", authenticateInstructor, listManualDates);
router.put("/seccion/:seccion_id/fechas-manuales/:semana", authenticateInstructor, saveManualDate);
router.put("/seccion/:seccion_id/manuales/:semana", authenticateInstructor, saveWeeklyManuals);

// Rutas de Estudiantes
router.get("/seccion/:seccion_id", authenticateInstructor,requireStudentSectionReader,getEstudiantesBySeccion);
router.get("/:carrera/:numero_cuenta", authenticateStudent,getEstudianteByCuenta);
router.put("/seccion/:seccion_id/batch", authenticateInstructor,requireStudentSectionReader,updateBatchGrades);
router.put("/batch/:seccion_id", authenticateInstructor,requireStudentSectionReader,updateBatchGrades);
router.post("/batch/:seccion_id", authenticateInstructor,requireStudentSectionReader,updateBatchGrades);
router.post("/", authenticateInstructor,requireStudentEnrollmentManager,createEstudiante);
router.put("/:seccion_id/:numero_cuenta", authenticateInstructor,requireStudentEnrollmentManager,updateEstudiante);
router.delete("/:seccion_id/:numero_cuenta", authenticateInstructor,requireStudentEnrollmentManager,deleteEstudiante);

export default router;
