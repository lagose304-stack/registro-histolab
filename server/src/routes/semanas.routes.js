import { authenticateInstructor, requireAdministration } from "../middlewares/auth.middleware.js";
import { Router } from "express";
import {
  getSemanasConfig,
  saveSingleWeek,
  deleteSingleWeek,
  saveSemanasConfig,
  copySemanasConfig,
  setSemanaActual,
  reorderSemanas
} from "../controllers/semanas.controller.js";

const router = Router();

// Rutas de Configuración de Semanas
router.get("/", getSemanasConfig);
router.post("/week", authenticateInstructor, requireAdministration, saveSingleWeek);
router.delete("/week/:numero_semana", authenticateInstructor, requireAdministration, deleteSingleWeek);
router.put("/reorder", authenticateInstructor, requireAdministration, reorderSemanas);
router.post("/", authenticateInstructor, requireAdministration, saveSemanasConfig);
router.put("/", authenticateInstructor, requireAdministration, saveSemanasConfig);
router.post("/copy", authenticateInstructor, requireAdministration, copySemanasConfig);
router.patch("/actual/:numero_semana", authenticateInstructor, requireAdministration, setSemanaActual);

export default router;
