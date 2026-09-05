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
router.post("/puntajes/:carrera", savePuntajesByCarrera);

// Rutas del Temario
router.get("/", getAllTemas);
router.get("/:id", getTemaById);
router.post("/", createTema);
router.post("/copy", copyTemario);
router.put("/reorder", reorderTemas);
router.put("/:id", updateTema);
router.delete("/:id", deleteTema);

export default router;

