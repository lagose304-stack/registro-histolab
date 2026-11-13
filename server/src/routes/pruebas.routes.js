import { authenticateQuiz, quizAccess } from "../middlewares/quizAccess.middleware.js";
import { Router } from "express";
import {
  getPruebaSemanal,
  getPruebasPorSeccion,
  savePruebaSemanal,
  submitPruebaEstudiante,
  cancelPruebaForIntegrity,
  getEntregasPorSemana,
  getAllEntregasPorSeccion,
  getMiEntregaSemanal,
  calificarEntrega,
  deletePruebasSeccionHandler,
  deleteEntregaEstudiante
} from "../controllers/pruebas.controller.js";
import {
  getLiveQuizState,
  getActiveLiveQuiz,
  controlLiveQuiz,
  heartbeatLiveQuiz
} from "../controllers/liveQuiz.controller.js";

const router = Router();
router.use(authenticateQuiz);

// Control y Sincronización en Vivo de Pruebas Semanales
router.get("/live/:seccion_id/activa", quizAccess({ student: true, kind: "live" }), getActiveLiveQuiz);
router.get("/live/:seccion_id/:semana", quizAccess({ student: true, kind: "live" }), getLiveQuizState);
router.post("/live/:seccion_id/:semana/control", quizAccess({ permission: "create", kind: "control" }), controlLiveQuiz);
router.post("/live/:seccion_id/:semana/heartbeat", quizAccess({ student: true, kind: "live" }), heartbeatLiveQuiz);

// Consultas de pruebas y entregas
router.get("/seccion/:seccion_id", quizAccess({ student: true }), getPruebasPorSeccion);
router.get("/seccion/:seccion_id/todas-entregas", quizAccess({ permission: "section-read", kind: "awards" }), getAllEntregasPorSeccion);
router.get("/seccion/:seccion_id/semana/:semana", quizAccess({ student: true }), getPruebaSemanal);
router.get("/seccion/:seccion_id/semana/:semana/entregas", quizAccess({ permission: "review", kind: "submission" }), getEntregasPorSemana);
router.get("/seccion/:seccion_id/semana/:semana/estudiante/:numero_cuenta", quizAccess({ student: true, kind: "submission" }), getMiEntregaSemanal);

// Acciones de guardado, entrega, calificación y eliminación
router.post("/seccion/:seccion_id", quizAccess({ permission: "create" }), savePruebaSemanal);
router.post("/seccion/:seccion_id/entregar", quizAccess({ student: true, kind: "submission" }), submitPruebaEstudiante);
router.post("/seccion/:seccion_id/anular", quizAccess({ student: true, kind: "submission" }), cancelPruebaForIntegrity);
router.put("/entregas/:entrega_id/calificar", quizAccess({ permission: "review", submission: true }), calificarEntrega);
router.delete("/entregas/:entrega_id", quizAccess({ permission: "review", submission: true }), deleteEntregaEstudiante);
router.delete("/seccion/:seccion_id/semana/:semana/estudiante/:numero_cuenta", quizAccess({ permission: "review" }), deleteEntregaEstudiante);
router.delete("/seccion/:seccion_id", quizAccess({ permission: "full" }), deletePruebasSeccionHandler);

export default router;
