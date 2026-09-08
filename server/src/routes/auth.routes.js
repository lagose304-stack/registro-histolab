import { Router } from "express";
import {
  loginInstructor,
  loginStudent,
  changeStudentPassword,
  checkStudentHeartbeat,
  logoutStudent,
  registerInstructor,
  logoutInstructor,
  checkHeartbeat,
  getMe,
  getInstructores,
  updateInstructor,
  deleteInstructor
} from "../controllers/auth.controller.js";
import { authenticateInstructor, authenticateStudent } from "../middlewares/auth.middleware.js";

const router = Router();

// Rutas públicas
router.post("/login", loginInstructor);
router.post("/student-login", loginStudent);
router.post("/student-change-password", changeStudentPassword);
router.post("/register", registerInstructor);

// Rutas protegidas de estudiantes
router.get("/student-heartbeat", authenticateStudent, checkStudentHeartbeat);
router.post("/student-logout", authenticateStudent, logoutStudent);

// Rutas protegidas de instructores
router.post("/logout", authenticateInstructor, logoutInstructor);
router.get("/heartbeat", authenticateInstructor, checkHeartbeat);
router.get("/me", authenticateInstructor, getMe);
router.get("/instructores", authenticateInstructor, getInstructores);
router.put("/instructores/:id", authenticateInstructor, updateInstructor);
router.delete("/instructores/:id", authenticateInstructor, deleteInstructor);

export default router;
