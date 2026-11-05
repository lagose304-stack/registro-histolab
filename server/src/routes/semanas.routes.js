import { authenticateInstructor, requireAdministration } from "../middlewares/auth.middleware.js";
import { Router } from "express";
import { deleteAgendaEvent, listAgenda, listAvailability, listSectionAttendanceEvents, saveAgendaEvent, saveExamBatch } from "../controllers/academicAgenda.controller.js";
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
const agendaAccess = [authenticateInstructor, requireAdministration];

router.get("/agenda", agendaAccess, listAgenda);
router.get("/agenda/asistencia/:sectionId", authenticateInstructor, listSectionAttendanceEvents);
router.get("/agenda/disponibilidad", agendaAccess, listAvailability);
router.post("/agenda", agendaAccess, saveAgendaEvent);
router.put("/agenda/examenes", agendaAccess, saveExamBatch);
router.put("/agenda/:id", agendaAccess, saveAgendaEvent);
router.delete("/agenda/:id", agendaAccess, deleteAgendaEvent);

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
