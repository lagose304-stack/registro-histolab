import { Router } from "express";
import {
  loginInstructor,
  loginStudent,
  registerInstructor,
  logoutInstructor,
  checkHeartbeat,
  getMe,
  getInstructores,
  updateInstructor,
  deleteInstructor
} from "../controllers/auth.controller.js";
import { authenticateInstructor } from "../middlewares/auth.middleware.js";

const router = Router();

// Rutas públicas
router.post("/login", loginInstructor);
router.post("/student-login", loginStudent);
router.post("/register", registerInstructor);

// Rutas protegidas
router.post("/logout", authenticateInstructor, logoutInstructor);
router.get("/heartbeat", authenticateInstructor, checkHeartbeat);
router.get("/me", authenticateInstructor, getMe);
router.get("/instructores", authenticateInstructor, getInstructores);
router.put("/instructores/:id", authenticateInstructor, updateInstructor);
router.delete("/instructores/:id", authenticateInstructor, deleteInstructor);

export default router;
