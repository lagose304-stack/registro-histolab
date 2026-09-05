import { Router } from "express";
import {
  getAsignacionesPorSeccion,
  guardarAsignacion,
  guardarAsignacionesBatch
} from "../controllers/asignaciones.controller.js";
import { authenticateInstructor } from "../middlewares/auth.middleware.js";

const router = Router();

// Rutas protegidas para miembros e instructores
router.use(authenticateInstructor);

router.get("/:seccionId", getAsignacionesPorSeccion);
router.post("/:seccionId", guardarAsignacion);
router.post("/:seccionId/batch", guardarAsignacionesBatch);

export default router;
