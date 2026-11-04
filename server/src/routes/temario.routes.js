import { authenticateInstructor, requireAdministration } from "../middlewares/auth.middleware.js";
import { Router } from "express";
import {
  getAllTemas,
  getTemaById,
  createTema,
  updateTema,
  reorderTemas,
  copyTemario,
  deleteTema,
  getPuntajesByCarrera,
  savePuntajesByCarrera
} from "../controllers/temario.controller.js";

const router = Router();

// Rutas de Puntajes por Carrera (deben ir antes de /:id)
router.get("/puntajes/:carrera", getPuntajesByCarrera);
router.post("/puntajes/:carrera", authenticateInstructor, requireAdministration, savePuntajesByCarrera);

// Rutas del Temario
router.get("/", getAllTemas);
router.get("/:id", getTemaById);
router.post("/", authenticateInstructor, requireAdministration, createTema);
router.post("/copy", authenticateInstructor, requireAdministration, copyTemario);
router.put("/reorder", authenticateInstructor, requireAdministration, reorderTemas);
router.put("/:id", authenticateInstructor, requireAdministration, updateTema);
router.delete("/:id", authenticateInstructor, requireAdministration, deleteTema);

export default router;

