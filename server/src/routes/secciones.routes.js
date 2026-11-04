import { Router } from "express";
import {
  getSecciones,
  getSeccionById,
  createSeccion,
  updateSeccion,
  deleteSeccion
} from "../controllers/secciones.controller.js";
import { authenticateInstructor, requireAdministration } from "../middlewares/auth.middleware.js";

const router = Router();

// Rutas protegidas por sesión de instructor
router.use(authenticateInstructor);

router.get("/", getSecciones);
router.get("/:id", getSeccionById);
router.post("/", requireAdministration, createSeccion);
router.put("/:id", requireAdministration, updateSeccion);
router.delete("/:id", requireAdministration, deleteSeccion);

export default router;
