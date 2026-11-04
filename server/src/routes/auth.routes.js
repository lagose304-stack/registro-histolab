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
import { authenticateInstructor, authenticateStudent, requireAdministration } from "../middlewares/auth.middleware.js";

const router = Router();

// Rutas públicas
router.post("/login", loginInstructor);
router.post("/student-login", loginStudent);
router.post("/student-change-password", changeStudentPassword);


// Rutas protegidas de estudiantes
router.get("/student-heartbeat", authenticateStudent, checkStudentHeartbeat);
router.post("/student-logout", authenticateStudent, logoutStudent);

// Rutas protegidas de instructores
router.post("/register", authenticateInstructor, requireAdministration, registerInstructor);
router.post("/logout", authenticateInstructor, logoutInstructor);
router.get("/heartbeat", authenticateInstructor, checkHeartbeat);
router.get("/me", authenticateInstructor, getMe);
router.get("/instructores", authenticateInstructor, getInstructores);
router.put("/instructores/:id", authenticateInstructor, requireAdministration, updateInstructor);
router.delete("/instructores/:id", authenticateInstructor, requireAdministration, deleteInstructor);

export default router;
