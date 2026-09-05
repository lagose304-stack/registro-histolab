import { Router } from "express";
import {
  getPruebaSemanal,
  getPruebasPorSeccion,
  savePruebaSemanal,
  submitPruebaEstudiante,
  getEntregasPorSemana,
  getAllEntregasPorSeccion,
  getMiEntregaSemanal,
  calificarEntrega,
  deletePruebasSeccionHandler,
  deleteEntregaEstudiante
} from "../controllers/pruebas.controller.js";
import {
  getLiveQuizState,
  controlLiveQuiz,
  heartbeatLiveQuiz
} from "../controllers/liveQuiz.controller.js";

const router = Router();

// Control y Sincronización en Vivo de Pruebas Semanales
router.get("/live/:seccion_id/:semana", getLiveQuizState);
router.post("/live/:seccion_id/:semana/control", controlLiveQuiz);
router.post("/live/:seccion_id/:semana/heartbeat", heartbeatLiveQuiz);

// Consultas de pruebas y entregas
router.get("/seccion/:seccion_id", getPruebasPorSeccion);
router.get("/seccion/:seccion_id/todas-entregas", getAllEntregasPorSeccion);
router.get("/seccion/:seccion_id/semana/:semana", getPruebaSemanal);
router.get("/seccion/:seccion_id/semana/:semana/entregas", getEntregasPorSemana);
router.get("/seccion/:seccion_id/semana/:semana/estudiante/:numero_cuenta", getMiEntregaSemanal);

// Acciones de guardado, entrega, calificación y eliminación
router.post("/seccion/:seccion_id", savePruebaSemanal);
router.post("/seccion/:seccion_id/entregar", submitPruebaEstudiante);
router.put("/entregas/:entrega_id/calificar", calificarEntrega);
router.delete("/entregas/:entrega_id", deleteEntregaEstudiante);
router.delete("/seccion/:seccion_id/semana/:semana/estudiante/:numero_cuenta", deleteEntregaEstudiante);
router.delete("/seccion/:seccion_id", deletePruebasSeccionHandler);

export default router;
