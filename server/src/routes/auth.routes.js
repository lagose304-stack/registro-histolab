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
import { changeInstructorPassword } from "../controllers/instructorAccount.controller.js";
import { activationStatus, requestActivation, verifyActivation, finishActivation } from "../controllers/accountActivation.controller.js";

const router = Router();
router.get("/activation/status",activationStatus);
router.post("/activation/request",requestActivation);
router.post("/activation/verify",verifyActivation);
router.post("/activation/finish",finishActivation);

// Rutas públicas
router.post("/login", loginInstructor);
router.post("/student-login", loginStudent);
router.post("/student-change-password", authenticateStudent, changeStudentPassword);


// Rutas protegidas de estudiantes
router.get("/student-heartbeat", authenticateStudent, checkStudentHeartbeat);
router.post("/student-logout", authenticateStudent, logoutStudent);

// Rutas protegidas de instructores
router.post("/register", authenticateInstructor, requireAdministration, registerInstructor);
router.post("/logout", authenticateInstructor, logoutInstructor);
router.get("/heartbeat", authenticateInstructor, checkHeartbeat);
router.get("/me", authenticateInstructor, getMe);
router.post("/change-password", authenticateInstructor, changeInstructorPassword);
router.get("/instructores", authenticateInstructor, getInstructores);
router.put("/instructores/:id", authenticateInstructor, requireAdministration, updateInstructor);
router.delete("/instructores/:id", authenticateInstructor, requireAdministration, deleteInstructor);

export default router;
