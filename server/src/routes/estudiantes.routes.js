import { Router } from "express";
import {
  getEstudiantesBySeccion,
  getEstudianteByCuenta,
  createEstudiante,
  updateEstudiante,
  updateBatchGrades,
  deleteEstudiante
} from "../controllers/estudiantes.controller.js";

const router = Router();

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
