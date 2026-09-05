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
router.post("/week", saveSingleWeek);
router.delete("/week/:numero_semana", deleteSingleWeek);
router.put("/reorder", reorderSemanas);
router.post("/", saveSemanasConfig);
router.put("/", saveSemanasConfig);
router.post("/copy", copySemanasConfig);
router.patch("/actual/:numero_semana", setSemanaActual);

export default router;
