/**
 * Capa de servicios para comunicación HTTP con el Backend Express y Supabase
 * Con seguridad reforzada, detector de sesiones concurrentes e intercepción de revocación.
 */

import { safeStorage } from "../utils/safeStorage";

const RAW_BASE = (import.meta.env.VITE_API_URL || "").trim().replace(/\/+$/, "");
const API_BASE = RAW_BASE ? `${RAW_BASE}/api` : "/api";

function getAuthHeaders() {
  const token = safeStorage.getItem("histolab_student_token") || safeStorage.getItem("histolab_instructor_token");
  const headers = { "Content-Type": "application/json" };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  return headers;
}

async function handleResponse(response) {
  const data = await response.json().catch(() => ({}));
  
  if (!response.ok) {
    if(response.status===403&&data.reason==="ACTIVATION_REQUIRED"&&(safeStorage.getItem("histolab_instructor_token")||safeStorage.getItem("histolab_student_token")))window.dispatchEvent(new CustomEvent("histolab:session_expired",{detail:{reason:data.reason,message:data.message}}));
    // Si la sesión fue revocada por concurrencia u otro dispositivo
    if (response.status === 401) {
      if (data.reason === "CONCURRENT_SESSION_DETECTED") {
        window.dispatchEvent(
          new CustomEvent("histolab:session_expired", {
            detail: {
              reason: "CONCURRENT_SESSION_DETECTED",
              message: data.message || "Se ha detectado un inicio de sesión en otro dispositivo o pestaña. Tu sesión actual ha sido cerrada por seguridad."
            }
          })
        );
      }
    }

    const errorMsg = data.message || `Error del servidor: ${response.status} ${response.statusText}`;
    const error = new Error(errorMsg);
    error.status = response.status;
    error.reason = data.reason;
    if (data.reason === "SECTION_SELECTION_REQUIRED" && Array.isArray(data.sections)) error.sections = data.sections;
    throw error;
  }
  return data;
}

export const api = {
  reposicionesEstudiantes: {
    async list(section, filters = {}) { const params = new URLSearchParams({ ...filters, ...(section ? { seccion_id: section } : {}) }); return handleResponse(await fetch(`${API_BASE}/reposiciones-estudiantes?${params}`, { headers: getAuthHeaders() })); },
    async options(section) { return handleResponse(await fetch(`${API_BASE}/reposiciones-estudiantes/seccion/${encodeURIComponent(section)}/opciones`, { headers: getAuthHeaders() })); },
    async create(payload) { return handleResponse(await fetch(`${API_BASE}/reposiciones-estudiantes`, { method: "POST", headers: getAuthHeaders(), body: JSON.stringify(payload) })); },
    async destinations(id) { return handleResponse(await fetch(`${API_BASE}/reposiciones-estudiantes/${encodeURIComponent(id)}/destinos`, { headers: getAuthHeaders() })); },
    async resolve(id, payload) { return handleResponse(await fetch(`${API_BASE}/reposiciones-estudiantes/${encodeURIComponent(id)}/resolver`, { method: "PUT", headers: getAuthHeaders(), body: JSON.stringify(payload) })); },
    async receiving(id) { return handleResponse(await fetch(`${API_BASE}/reposiciones-estudiantes/${encodeURIComponent(id)}/recepcion`, { headers: getAuthHeaders() })); },
    async saveReceiving(id, payload) { return handleResponse(await fetch(`${API_BASE}/reposiciones-estudiantes/${encodeURIComponent(id)}/recepcion`, { method: "PUT", headers: getAuthHeaders(), body: JSON.stringify(payload) })); }
  },
  // Autenticación y Control de Sesión de Instructores
  auth: {
    async activationStatus() { return handleResponse(await fetch(`${API_BASE}/auth/activation/status`)); },
    async requestActivation(payload) { return handleResponse(await fetch(`${API_BASE}/auth/activation/request`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload)})); },
    async verifyActivation(payload) { return handleResponse(await fetch(`${API_BASE}/auth/activation/verify`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload)})); },
    async finishActivation(payload) { return handleResponse(await fetch(`${API_BASE}/auth/activation/finish`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload)})); },
    async changeInstructorPassword(payload) {
      const res = await fetch(`${API_BASE}/auth/change-password`, {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify(payload)
      });
      return await handleResponse(res);
    },
    async login(credentials) {
      const res = await fetch(`${API_BASE}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(credentials)
      });
      const result = await handleResponse(res);
      if (result.token) {
        safeStorage.removeItem("histolab_student_token");
        safeStorage.removeItem("histolab_student_user");
        safeStorage.removeItem("histolab_student_session_id");
        safeStorage.setItem("histolab_instructor_token", result.token);
        safeStorage.setItem("histolab_instructor_user", JSON.stringify(result.instructor));
        if (result.sessionId) {
          safeStorage.setItem("histolab_session_id", result.sessionId);
        }
      }
      return result;
    },

    async register(instructorData) {
      const res = await fetch(`${API_BASE}/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(instructorData)
      });
      const result = await handleResponse(res);
      if (result.token) {
        safeStorage.setItem("histolab_instructor_token", result.token);
        safeStorage.setItem("histolab_instructor_user", JSON.stringify(result.instructor));
        if (result.sessionId) {
          safeStorage.setItem("histolab_session_id", result.sessionId);
        }
      }
      return result;
    },

    async checkHeartbeat() {
      const res = await fetch(`${API_BASE}/auth/heartbeat`, {
        headers: getAuthHeaders()
      });
      return await handleResponse(res);
    },

    async getProfile() {
      const res = await fetch(`${API_BASE}/auth/me`, {
        headers: getAuthHeaders()
      });
      return await handleResponse(res);
    },

    async getInstructores() {
      const res = await fetch(`${API_BASE}/auth/instructores`, {
        headers: getAuthHeaders()
      });
      return await handleResponse(res);
    },

    async createInstructor(instructorData) {
      const res = await fetch(`${API_BASE}/auth/register`, {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify(instructorData)
      });
      return await handleResponse(res);
    },

    async updateInstructor(id, instructorData) {
      const res = await fetch(`${API_BASE}/auth/instructores/${id}`, {
        method: "PUT",
        headers: getAuthHeaders(),
        body: JSON.stringify(instructorData)
      });
      return await handleResponse(res);
    },

    async deleteInstructor(id) {
      const res = await fetch(`${API_BASE}/auth/instructores/${id}`, {
        method: "DELETE",
        headers: getAuthHeaders()
      });
      return await handleResponse(res);
    },

    async logout() {
      try {
        await fetch(`${API_BASE}/auth/logout`, {
          method: "POST",
          headers: getAuthHeaders()
        }).catch(() => {});
      } finally {
        safeStorage.removeItem("histolab_instructor_token");
        safeStorage.removeItem("histolab_instructor_user");
        safeStorage.removeItem("histolab_session_id");
      }
    },

    // Autenticación y Control de Sesión de Estudiantes
    async loginStudent({ carrera, numero_cuenta, contrasena, seccion_id }) {
      const res = await fetch(`${API_BASE}/auth/student-login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ carrera, numero_cuenta, contrasena, seccion_id })
      });
      const result = await handleResponse(res);
      if (result.token && result.estudiante) {
        safeStorage.removeItem("histolab_instructor_token");
        safeStorage.removeItem("histolab_instructor_user");
        safeStorage.removeItem("histolab_session_id");
        safeStorage.setItem("histolab_student_token", result.token);
        safeStorage.setItem("histolab_student_user", JSON.stringify(result.estudiante));
        if (result.sessionId) {
          safeStorage.setItem("histolab_student_session_id", result.sessionId);
        }
      }
      return result;
    },

    async checkStudentHeartbeat() {
      const token = safeStorage.getItem("histolab_student_token");
      const headers = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;
      const res = await fetch(`${API_BASE}/auth/student-heartbeat`, {
        headers
      });
      return await handleResponse(res);
    },

    async changeStudentPassword({ carrera, numero_cuenta, contrasena_actual, nueva_contrasena }) {
      const token = safeStorage.getItem("histolab_student_token");
      const headers = { "Content-Type": "application/json" };
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }
      const res = await fetch(`${API_BASE}/auth/student-change-password`, {
        method: "POST",
        headers,
        body: JSON.stringify({ carrera, numero_cuenta, contrasena_actual, nueva_contrasena })
      });
      return await handleResponse(res);
    },

    getCurrentStudent() {
      try {
        const raw = safeStorage.getItem("histolab_student_user");
        if (!raw) return null;
        return JSON.parse(raw);
      } catch {
        return null;
      }
    },

    async logoutStudent() {
      const token = safeStorage.getItem("histolab_student_token");
      try {
        if (token) {
          await fetch(`${API_BASE}/auth/student-logout`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`
            }
          }).catch(() => {});
        }
      } finally {
        if (safeStorage.getItem("histolab_student_token") === token) {
          safeStorage.removeItem("histolab_student_token");
          safeStorage.removeItem("histolab_student_user");
          safeStorage.removeItem("histolab_student_session_id");
        }
      }
    },

    getCurrentInstructor() {
      try {
        const stored = safeStorage.getItem("histolab_instructor_user");
        return stored ? JSON.parse(stored) : null;
      } catch {
        return null;
      }
    },

    getToken() {
      return safeStorage.getItem("histolab_instructor_token");
    }
  },

  // Verificar estado del servidor backend
  async checkHealth() {
    try {
      const res = await fetch(`${API_BASE}/health`);
      return await handleResponse(res);
    } catch (err) {
      console.warn("Backend no disponible o fuera de línea:", err);
      return { status: "offline", error: err.message };
    }
  },

  // Obtener registros con filtros opcionales (búsqueda, estado, prioridad)
  async getRegistros(params = {}) {
    const query = new URLSearchParams();
    if (params.search) query.append("search", params.search);
    if (params.estado && params.estado !== "Todos") query.append("estado", params.estado);
    if (params.prioridad && params.prioridad !== "Todas") query.append("prioridad", params.prioridad);

    const queryString = query.toString() ? `?${query.toString()}` : "";
    const res = await fetch(`${API_BASE}/registros${queryString}`, {
      headers: getAuthHeaders()
    });
    return await handleResponse(res);
  },

  // Obtener un registro por ID
  async getRegistroById(id) {
    const res = await fetch(`${API_BASE}/registros/${id}`, {
      headers: getAuthHeaders()
    });
    return await handleResponse(res);
  },

  // Crear nuevo registro
  async createRegistro(registroData) {
    const res = await fetch(`${API_BASE}/registros`, {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify(registroData)
    });
    return await handleResponse(res);
  },

  // Actualizar un registro existente
  async updateRegistro(id, registroData) {
    const res = await fetch(`${API_BASE}/registros/${id}`, {
      method: "PUT",
      headers: getAuthHeaders(),
      body: JSON.stringify(registroData)
    });
    return await handleResponse(res);
  },

  // Eliminar un registro
  async deleteRegistro(id) {
    const res = await fetch(`${API_BASE}/registros/${id}`, {
      method: "DELETE",
      headers: getAuthHeaders()
    });
    return await handleResponse(res);
  },

  // Módulo de Administración de Secciones
  secciones: {
    async getAll(params = {}) {
      const query = new URLSearchParams();
      if (params.search) query.append("search", params.search);
      if (params.dia && params.dia !== "Todos") query.append("dia", params.dia);
      if (params.activa !== undefined) query.append("activa", params.activa);

      const queryString = query.toString() ? `?${query.toString()}` : "";
      const res = await fetch(`${API_BASE}/secciones${queryString}`, {
        headers: getAuthHeaders()
      });
      return await handleResponse(res);
    },

    async getById(id) {
      const res = await fetch(`${API_BASE}/secciones/${id}`, {
        headers: getAuthHeaders()
      });
      return await handleResponse(res);
    },

    async create(seccionData) {
      const res = await fetch(`${API_BASE}/secciones`, {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify(seccionData)
      });
      return await handleResponse(res);
    },

    async update(id, seccionData) {
      const res = await fetch(`${API_BASE}/secciones/${id}`, {
        method: "PUT",
        headers: getAuthHeaders(),
        body: JSON.stringify(seccionData)
      });
      return await handleResponse(res);
    },

    async delete(id) {
      const res = await fetch(`${API_BASE}/secciones/${id}`, {
        method: "DELETE",
        headers: getAuthHeaders()
      });
      return await handleResponse(res);
    }
  },

  // Módulo de Administración de Temario
  temario: {
    async getAll(params = {}) {
      const query = new URLSearchParams();
      if (params.unidad) query.append("unidad", params.unidad);
      if (params.carrera) query.append("carrera", params.carrera);

      const queryString = query.toString() ? `?${query.toString()}` : "";
      const res = await fetch(`${API_BASE}/temario${queryString}`, {
        headers: getAuthHeaders()
      });
      return await handleResponse(res);
    },

    async getById(id) {
      const res = await fetch(`${API_BASE}/temario/${id}`, {
        headers: getAuthHeaders()
      });
      return await handleResponse(res);
    },

    async create(temaData) {
      const res = await fetch(`${API_BASE}/temario`, {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify(temaData)
      });
      return await handleResponse(res);
    },

    async update(id, temaData) {
      const res = await fetch(`${API_BASE}/temario/${id}`, {
        method: "PUT",
        headers: getAuthHeaders(),
        body: JSON.stringify(temaData)
      });
      return await handleResponse(res);
    },

    async reorder(payload) {
      const body = Array.isArray(payload) ? { items: payload } : payload;
      const res = await fetch(`${API_BASE}/temario/reorder`, {
        method: "PUT",
        headers: getAuthHeaders(),
        body: JSON.stringify(body)
      });
      return await handleResponse(res);
    },

    async delete(id) {
      const res = await fetch(`${API_BASE}/temario/${id}`, {
        method: "DELETE",
        headers: getAuthHeaders()
      });
      return await handleResponse(res);
    },

    async copy(fromCarrera, toCarrera) {
      const res = await fetch(`${API_BASE}/temario/copy`, {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({ fromCarrera, toCarrera })
      });
      return await handleResponse(res);
    },

    async getPuntajes(carrera) {
      const res = await fetch(`${API_BASE}/temario/puntajes/${encodeURIComponent(carrera)}`, {
        headers: getAuthHeaders()
      });
      return await handleResponse(res);
    },

    async savePuntajes(carrera, puntajesData) {
      const res = await fetch(`${API_BASE}/temario/puntajes/${encodeURIComponent(carrera)}`, {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify(puntajesData)
      });
      return await handleResponse(res);
    }
  },

  // Gestión de Estudiantes por Sección
  estudiantes: {
    async getMySectionRank(signal) {
      return handleResponse(await fetch(`${API_BASE}/estudiantes/mi-ranking`, {
        headers: getAuthHeaders(),
        signal
      }));
    },

    async getGradeHistory(seccionId, filters = {}, signal) {
      const query = new URLSearchParams(filters);
      return handleResponse(await fetch(`${API_BASE}/estudiantes/seccion/${encodeURIComponent(seccionId)}/historial-notas?${query}`, {
        headers: getAuthHeaders(),
        signal
      }));
    },

    async getByCuenta(carrera, numeroCuenta, sectionId = null) {
      const query = sectionId ? `?seccion_id=${encodeURIComponent(sectionId)}` : "";
      const res = await fetch(`${API_BASE}/estudiantes/${encodeURIComponent(carrera)}/${encodeURIComponent(numeroCuenta)}${query}`, {
        headers: getAuthHeaders()
      });
      return await handleResponse(res);
    },

    async getBySeccion(seccionId, carrera = null) {
      const query = carrera ? `?carrera=${encodeURIComponent(carrera)}` : "";
      const res = await fetch(`${API_BASE}/estudiantes/seccion/${seccionId}${query}`, {
        headers: getAuthHeaders()
      });
      return await handleResponse(res);
    },

    async saveAttendance(seccionId, semana, updates) {
      return handleResponse(await fetch(`${API_BASE}/estudiantes/seccion/${encodeURIComponent(seccionId)}/asistencia/${semana}`, {
        method: "PUT",
        headers: getAuthHeaders(),
        body: JSON.stringify({ updates })
      }));
    },

    async getManualSchedule(sectionId) {
      return handleResponse(await fetch(`${API_BASE}/estudiantes/seccion/${encodeURIComponent(sectionId)}/fechas-manuales`, {
        headers: getAuthHeaders()
      }));
    },

    async saveManualDate(sectionId, week, date) {
      return handleResponse(await fetch(`${API_BASE}/estudiantes/seccion/${encodeURIComponent(sectionId)}/fechas-manuales/${week}`, {
        method: "PUT", headers: getAuthHeaders(), body: JSON.stringify({ fecha_carga: date })
      }));
    },

    async saveManualGrades(sectionId, week, updates) {
      return handleResponse(await fetch(`${API_BASE}/estudiantes/seccion/${encodeURIComponent(sectionId)}/manuales/${week}`, {
        method: "PUT", headers: getAuthHeaders(), body: JSON.stringify({ updates })
      }));
    },

    async saveMigration(seccionId, updates, carrera = null) {
      return handleResponse(await fetch(`${API_BASE}/estudiantes/seccion/${encodeURIComponent(seccionId)}/migracion`, {
        method: "PUT", headers: getAuthHeaders(), body: JSON.stringify({ updates, carrera })
      }));
    },

    async saveBatch(seccionId, updates, carrera = null) {
      const res = await fetch(`${API_BASE}/estudiantes/seccion/${seccionId}/batch`, {
        method: "PUT",
        headers: getAuthHeaders(),
        body: JSON.stringify({ updates, carrera })
      });
      return await handleResponse(res);
    },

    async create(estudianteData) {
      const res = await fetch(`${API_BASE}/estudiantes`, {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify(estudianteData)
      });
      return await handleResponse(res);
    },

    async update(seccionId, numeroCuenta, estudianteData) {
      const res = await fetch(`${API_BASE}/estudiantes/${seccionId}/${numeroCuenta}`, {
        method: "PUT",
        headers: getAuthHeaders(),
        body: JSON.stringify(estudianteData)
      });
      return await handleResponse(res);
    },

    async delete(seccionId, numeroCuenta, carrera = null) {
      const query = carrera ? `?carrera=${encodeURIComponent(carrera)}` : "";
      const res = await fetch(`${API_BASE}/estudiantes/${seccionId}/${numeroCuenta}${query}`, {
        method: "DELETE",
        headers: getAuthHeaders()
      });
      return await handleResponse(res);
    }
  },

  // Configuración de Semanas Académicas
  semanas: {
    async getSectionAttendanceEvents(sectionId) {
      return handleResponse(await fetch(`${API_BASE}/semanas/agenda/asistencia/${encodeURIComponent(sectionId)}`, {
        headers: getAuthHeaders()
      }));
    },
    async getAgenda(carrera, desde, hasta, tipo) {
      const query = new URLSearchParams(tipo === "examen" ? { carrera, tipo } : { carrera, desde, hasta });
      return handleResponse(await fetch(`${API_BASE}/semanas/agenda?${query}`, { headers: getAuthHeaders() }));
    },

    async saveExamBatch(carrera, changes) {
      return handleResponse(await fetch(`${API_BASE}/semanas/agenda/examenes`, {
        method: "PUT",
        headers: getAuthHeaders(),
        body: JSON.stringify({ carrera, changes })
      }));
    },

    async getAgendaAvailability(carrera, fecha, seccionId, excludeId) {
      const query = new URLSearchParams({ carrera, fecha, seccion_id: seccionId });
      if (excludeId) query.set("excluir", excludeId);
      return handleResponse(await fetch(`${API_BASE}/semanas/agenda/disponibilidad?${query}`, { headers: getAuthHeaders() }));
    },

    async saveAgendaEvent(event, id) {
      const path = id ? `/${encodeURIComponent(id)}` : "";
      return handleResponse(await fetch(`${API_BASE}/semanas/agenda${path}`, {
        method: id ? "PUT" : "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify(event)
      }));
    },

    async deleteAgendaEvent(id) {
      return handleResponse(await fetch(`${API_BASE}/semanas/agenda/${encodeURIComponent(id)}`, {
        method: "DELETE",
        headers: getAuthHeaders()
      }));
    },

    async getConfig(carrera = "Medicina") {
      const res = await fetch(`${API_BASE}/semanas?carrera=${encodeURIComponent(carrera)}`, {
        headers: getAuthHeaders()
      });
      return await handleResponse(res);
    },

    async saveWeek(weekData) {
      const res = await fetch(`${API_BASE}/semanas/week`, {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify(weekData)
      });
      return await handleResponse(res);
    },

    async reorder(carrera, orderedWeeks) {
      const res = await fetch(`${API_BASE}/semanas/reorder`, {
        method: "PUT",
        headers: getAuthHeaders(),
        body: JSON.stringify({ carrera, ordered_weeks: orderedWeeks })
      });
      return await handleResponse(res);
    },

    async deleteWeek(numeroSemana, carrera = "Medicina") {
      const res = await fetch(
        `${API_BASE}/semanas/week/${numeroSemana}?carrera=${encodeURIComponent(carrera)}`,
        {
          method: "DELETE",
          headers: getAuthHeaders()
        }
      );
      return await handleResponse(res);
    },

    async saveConfig(semanasArray, carrera = "Medicina") {
      const res = await fetch(`${API_BASE}/semanas`, {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({ semanas: semanasArray, carrera })
      });
      return await handleResponse(res);
    },

    async setActual(numeroSemana, carrera = "Medicina") {
      const res = await fetch(`${API_BASE}/semanas/actual/${numeroSemana}`, {
        method: "PATCH",
        headers: getAuthHeaders(),
        body: JSON.stringify({ carrera })
      });
      return await handleResponse(res);
    },

    async copy(fromCarrera, toCarrera) {
      const res = await fetch(`${API_BASE}/semanas/copy`, {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({ fromCarrera, toCarrera })
      });
      return await handleResponse(res);
    }
  },

  // Módulo de Roles y Asignaciones de Sección
  asignaciones: {
    async getBySeccion(seccionId) {
      const res = await fetch(`${API_BASE}/asignaciones/${seccionId}`, {
        headers: getAuthHeaders()
      });
      return await handleResponse(res);
    },

    async save(seccionId, data) {
      const res = await fetch(`${API_BASE}/asignaciones/${seccionId}`, {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify(data)
      });
      return await handleResponse(res);
    },

    async saveBatch(seccionId, asignacionesArray) {
      const res = await fetch(`${API_BASE}/asignaciones/${seccionId}/batch`, {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({ asignaciones: asignacionesArray })
      });
      return await handleResponse(res);
    }
  },

  // Módulo de Creación, Rendición y Calificación de Pruebas Semanales
  pruebas: {
    async getBySemana(seccionId, semana) {
      const res = await fetch(`${API_BASE}/pruebas/seccion/${seccionId}/semana/${semana}`, {
        headers: getAuthHeaders()
      });
      return await handleResponse(res);
    },

    async saveBySemana(seccionId, quizData) {
      const res = await fetch(`${API_BASE}/pruebas/seccion/${seccionId}`, {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify(quizData)
      });
      return await handleResponse(res);
    },

    async getBySeccion(seccionId) {
      const res = await fetch(`${API_BASE}/pruebas/seccion/${seccionId}`, {
        headers: getAuthHeaders()
      });
      return await handleResponse(res);
    },

    async submit(seccionId, payload) {
      const res = await fetch(`${API_BASE}/pruebas/seccion/${seccionId}/entregar`, {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify(payload)
      });
      return await handleResponse(res);
    },

    async getEntregas(seccionId, semana) {
      const res = await fetch(`${API_BASE}/pruebas/seccion/${seccionId}/semana/${semana}/entregas`, {
        headers: getAuthHeaders()
      });
      return await handleResponse(res);
    },

    async getAllEntregas(seccionId) {
      const res = await fetch(`${API_BASE}/pruebas/seccion/${seccionId}/todas-entregas`, {
        headers: getAuthHeaders()
      });
      return await handleResponse(res);
    },

    async getMiEntrega(seccionId, semana, numeroCuenta) {
      const res = await fetch(`${API_BASE}/pruebas/seccion/${seccionId}/semana/${semana}/estudiante/${numeroCuenta}`, {
        headers: getAuthHeaders()
      });
      return await handleResponse(res);
    },

    async reopenQuiz(seccionId, semana, numeroCuenta, payload) {
      const res = await fetch(`${API_BASE}/pruebas/live/${encodeURIComponent(seccionId)}/${semana}/estudiante/${encodeURIComponent(numeroCuenta)}/reabrir`, {
        method: "POST", headers: getAuthHeaders(), body: JSON.stringify(payload)
      });
      return await handleResponse(res);
    },

    async calificar(entregaId, payload) {
      const res = await fetch(`${API_BASE}/pruebas/entregas/${entregaId}/calificar`, {
        method: "PUT",
        headers: getAuthHeaders(),
        body: JSON.stringify(payload)
      });
      return await handleResponse(res);
    },

    async deleteEntrega(entregaId, params = {}) {
      const query = new URLSearchParams(params).toString();
      const url = `${API_BASE}/pruebas/entregas/${entregaId}${query ? `?${query}` : ""}`;
      const res = await fetch(url, {
        method: "DELETE",
        headers: getAuthHeaders()
      });
      return await handleResponse(res);
    },

    async deleteEntregaEstudiante(seccionId, semana, numeroCuenta) {
      const res = await fetch(`${API_BASE}/pruebas/seccion/${seccionId}/semana/${semana}/estudiante/${numeroCuenta}`, {
        method: "DELETE",
        headers: getAuthHeaders()
      });
      return await handleResponse(res);
    },

    // Sincronización en Vivo y Control Global de Pruebas
    async getActiveLiveSession(seccionId) {
      const res = await fetch(`${API_BASE}/pruebas/live/${seccionId}/activa`, {
        headers: getAuthHeaders()
      });
      return await handleResponse(res);
    },

    async getLiveState(seccionId, semana) {
      const res = await fetch(`${API_BASE}/pruebas/live/${seccionId}/${semana}`, {
        headers: getAuthHeaders()
      });
      return await handleResponse(res);
    },

    async controlLive(seccionId, semana, payload) {
      const res = await fetch(`${API_BASE}/pruebas/live/${seccionId}/${semana}/control`, {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify(payload)
      });
      return await handleResponse(res);
    },

    async startActivity(seccionId, semana, payload) {
      const res = await fetch(`${API_BASE}/pruebas/seccion/${seccionId}/semana/${semana}/actividad/iniciar`, { method: "POST", headers: getAuthHeaders(), body: JSON.stringify(payload) });
      return await handleResponse(res);
    },
    async saveActivity(seccionId, semana, intentoId, eventos) {
      const res = await fetch(`${API_BASE}/pruebas/seccion/${seccionId}/semana/${semana}/actividad/${intentoId}`, { method: "POST", headers: getAuthHeaders(), body: JSON.stringify({ eventos }), keepalive: true });
      return await handleResponse(res);
    },
    async getActivity(seccionId, semana, cuenta) {
      const res = await fetch(`${API_BASE}/pruebas/seccion/${seccionId}/semana/${semana}/actividad/estudiante/${encodeURIComponent(cuenta)}`, { headers: getAuthHeaders() });
      return await handleResponse(res);
    },
    async saveDiagnostics(seccionId, semana, intentoId, lote) {
      const res = await fetch(`${API_BASE}/pruebas/seccion/${seccionId}/semana/${semana}/actividad/${encodeURIComponent(intentoId)}/diagnostico`, {method:"POST",headers:getAuthHeaders(),body:JSON.stringify(lote),keepalive:true});
      return await handleResponse(res);
    },
    async getDiagnostics(seccionId, semana, cuenta) {
      const res = await fetch(`${API_BASE}/pruebas/seccion/${seccionId}/semana/${semana}/diagnostico/estudiante/${encodeURIComponent(cuenta)}`, {headers:getAuthHeaders()});
      return await handleResponse(res);
    },
    async sendLiveHeartbeat(seccionId, semana, payload) {
      const res = await fetch(`${API_BASE}/pruebas/live/${seccionId}/${semana}/heartbeat`, {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify(payload)
      });
      return await handleResponse(res);
    }
  }
};
