import { Router } from "express";
import {
  getRegistros,
  getRegistroById,
  createRegistro,
  updateRegistro,
  deleteRegistro,
  getStats
} from "../controllers/registros.controller.js";
import { authenticateInstructor } from "../middlewares/auth.middleware.js";

const router = Router();

// Todas las rutas de registros requieren autenticación obligatoria de instructor
router.use(authenticateInstructor);

router.get("/stats", getStats);
router.get("/", getRegistros);
router.get("/:id", getRegistroById);
router.post("/", createRegistro);
router.put("/:id", updateRegistro);
router.delete("/:id", deleteRegistro);

export default router;
