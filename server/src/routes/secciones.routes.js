import { Router } from "express";
import {
  getSecciones,
  getSeccionById,
  createSeccion,
  updateSeccion,
  deleteSeccion
} from "../controllers/secciones.controller.js";
import { authenticateInstructor } from "../middlewares/auth.middleware.js";

const router = Router();

// Rutas protegidas por sesión de instructor
router.use(authenticateInstructor);

router.get("/", getSecciones);
router.get("/:id", getSeccionById);
router.post("/", createSeccion);
router.put("/:id", updateSeccion);
router.delete("/:id", deleteSeccion);

export default router;
