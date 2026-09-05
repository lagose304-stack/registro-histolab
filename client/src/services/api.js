/**
 * Capa de servicios para comunicación HTTP con el Backend Express y Supabase
 * Con seguridad reforzada, detector de sesiones concurrentes e intercepción de revocación.
 */

import { safeStorage } from "../utils/safeStorage";

const RAW_BASE = (import.meta.env.VITE_API_URL || "").trim().replace(/\/+$/, "");
const API_BASE = RAW_BASE ? `${RAW_BASE}/api` : "/api";

function getAuthHeaders() {
  const token = safeStorage.getItem("histolab_instructor_token");
  const headers = { "Content-Type": "application/json" };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  return headers;
}

async function handleResponse(response) {
  const data = await response.json().catch(() => ({}));
  
  if (!response.ok) {
    // Si la sesión fue revocada por concurrencia u otro dispositivo
    if (response.status === 401) {
      if (data.reason === "CONCURRENT_SESSION_DETECTED") {
        window.dispatchEvent(
          new CustomEvent("histolab:session_expired", {
            detail: {
              reason: "CONCURRENT_SESSION_DETECTED",
              message: "Se ha detectado un inicio de sesión en otro dispositivo o pestaña. Tu sesión actual ha sido cerrada por seguridad."
            }
          })
        );
      }
    }

    const errorMsg = data.message || `Error del servidor: ${response.status} ${response.statusText}`;
    const error = new Error(errorMsg);
    error.status = response.status;
    error.reason = data.reason;
    throw error;
  }
  return data;
}

export const api = {
  // Autenticación y Control de Sesión de Instructores
  auth: {
    async login(credentials) {
      const res = await fetch(`${API_BASE}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(credentials)
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
    async loginStudent({ carrera, numero_cuenta, contrasena }) {
      const res = await fetch(`${API_BASE}/auth/student-login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ carrera, numero_cuenta, contrasena })
      });
      const result = await handleResponse(res);
      if (result.token && result.estudiante) {
        safeStorage.setItem("histolab_student_token", result.token);
        safeStorage.setItem("histolab_student_user", JSON.stringify(result.estudiante));
      }
      return result;
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

    logoutStudent() {
      safeStorage.removeItem("histolab_student_token");
      safeStorage.removeItem("histolab_student_user");
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
    async getByCuenta(carrera, numeroCuenta) {
      const res = await fetch(`${API_BASE}/estudiantes/${encodeURIComponent(carrera)}/${encodeURIComponent(numeroCuenta)}`, {
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
