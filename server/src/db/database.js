/**
 * Módulo de capa de datos para Registro Histolab
 * Integra Supabase como base de datos principal con fallback en memoria
 */

import { supabase, isSupabaseConfigured } from "./supabase.js";

// Base de datos de respaldo en memoria (si no se configuran variables de entorno)
let registrosMemoria = [
  {
    id: "HL-2026-001",
    paciente: "María Elena Morales",
    edad: 45,
    genero: "Femenino",
    medicoSolicitante: "Dr. Carlos Valenzuela",
    tipoEstudio: "Biopsia Gástrica",
    organo: "Estómago",
    prioridad: "Alta",
    estado: "En Proceso",
    fechaIngreso: "2026-08-20T09:30:00.000Z",
    diagnosticoPresuntivo: "Gastritis crónica / Descarte metaplasia",
    observaciones: "Muestra fijada en formol al 10%. 3 fragmentos milimétricos."
  },
  {
    id: "HL-2026-002",
    paciente: "Roberto Sánchez Gómez",
    edad: 58,
    genero: "Masculino",
    medicoSolicitante: "Dra. Sofía Navarro",
    tipoEstudio: "Citología Cervicovaginal (PAP)",
    organo: "Cérvix",
    prioridad: "Normal",
    estado: "Completado",
    fechaIngreso: "2026-08-19T11:15:00.000Z",
    diagnosticoPresuntivo: "Control ginecológico rutinario",
    observaciones: "Extendido adecuado para evaluación."
  },
  {
    id: "HL-2026-003",
    paciente: "Andrea Lucía Domínguez",
    edad: 34,
    genero: "Femenino",
    medicoSolicitante: "Dr. Fernando Ruiz",
    tipoEstudio: "Inmunohistoquímica",
    organo: "Mama izquierda",
    prioridad: "Urgente",
    estado: "En Proceso",
    fechaIngreso: "2026-08-21T08:00:00.000Z",
    diagnosticoPresuntivo: "Carcinoma ductal infiltrante - Marcadores RE, RP, HER2, Ki-67",
    observaciones: "Bloque de parafina B-104 remitido desde centro externo."
  },
  {
    id: "HL-2026-004",
    paciente: "Juan Carlos Mendoza",
    edad: 62,
    genero: "Masculino",
    medicoSolicitante: "Dr. Andrés Pineda",
    tipoEstudio: "Biopsia de Piel (Punch)",
    organo: "Piel (Espalda superior)",
    prioridad: "Normal",
    estado: "Pendiente",
    fechaIngreso: "2026-08-21T14:20:00.000Z",
    diagnosticoPresuntivo: "Lesión hiperpigmentada / Descarte Melanoma vs Nevo",
    observaciones: "Punch de 4mm. Margen periférico orientado."
  }
];

let contadorMemoria = 5;

// Generar correlativo de ID clínico
function generateId() {
  const currentYear = new Date().getFullYear();
  const randomSuffix = Math.floor(100 + Math.random() * 900);
  return `HL-${currentYear}-${randomSuffix}`;
}

export const db = {
  // Obtener todos los registros con filtros
  getAll: async (filters = {}) => {
    if (isSupabaseConfigured && supabase) {
      let query = supabase
        .from("registros")
        .select("*")
        .order("fechaIngreso", { ascending: false });

      if (filters.estado && filters.estado !== "Todos") {
        query = query.eq("estado", filters.estado);
      }

      if (filters.prioridad && filters.prioridad !== "Todas") {
        query = query.eq("prioridad", filters.prioridad);
      }

      if (filters.search) {
        const q = `%${filters.search.trim()}%`;
        query = query.or(
          `paciente.ilike.${q},id.ilike.${q},tipoEstudio.ilike.${q},medicoSolicitante.ilike.${q},organo.ilike.${q}`
        );
      }

      const { data, error } = await query;
      if (error) throw new Error(error.message);
      return data || [];
    }

    // Fallback en memoria
    let result = [...registrosMemoria];
    if (filters.search) {
      const q = filters.search.toLowerCase();
      result = result.filter(
        (r) =>
          r.paciente.toLowerCase().includes(q) ||
          r.id.toLowerCase().includes(q) ||
          r.medicoSolicitante.toLowerCase().includes(q) ||
          r.tipoEstudio.toLowerCase().includes(q)
      );
    }
    if (filters.estado && filters.estado !== "Todos") {
      result = result.filter((r) => r.estado === filters.estado);
    }
    if (filters.prioridad && filters.prioridad !== "Todas") {
      result = result.filter((r) => r.prioridad === filters.prioridad);
    }
    return result.sort((a, b) => new Date(b.fechaIngreso) - new Date(a.fechaIngreso));
  },

  // Obtener un registro por ID
  getById: async (id) => {
    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase
        .from("registros")
        .select("*")
        .eq("id", id)
        .maybeSingle();

      if (error) throw new Error(error.message);
      return data;
    }

    return registrosMemoria.find((r) => r.id === id);
  },

  // Crear un nuevo registro
  create: async (data) => {
    const newId = data.id || generateId();
    const newRegistro = {
      id: newId,
      paciente: data.paciente || "Sin nombre",
      edad: Number(data.edad) || 0,
      genero: data.genero || "No especificado",
      medicoSolicitante: data.medicoSolicitante || "No especificado",
      tipoEstudio: data.tipoEstudio || "Estudio General",
      organo: data.organo || "No especificado",
      prioridad: data.prioridad || "Normal",
      estado: data.estado || "Pendiente",
      fechaIngreso: data.fechaIngreso || new Date().toISOString(),
      diagnosticoPresuntivo: data.diagnosticoPresuntivo || "",
      observaciones: data.observaciones || ""
    };

    if (isSupabaseConfigured && supabase) {
      const { data: created, error } = await supabase
        .from("registros")
        .insert([newRegistro])
        .select()
        .single();

      if (error) throw new Error(error.message);
      return created;
    }

    // Fallback memoria
    const memoryPadded = String(contadorMemoria++).padStart(3, "0");
    newRegistro.id = `HL-${new Date().getFullYear()}-${memoryPadded}`;
    registrosMemoria.unshift(newRegistro);
    return newRegistro;
  },

  // Actualizar un registro existente
  update: async (id, updateData) => {
    // Sanitizar id para no sobreescribir la llave primaria
    const { id: _, created_at: __, ...cleanData } = updateData;

    if (isSupabaseConfigured && supabase) {
      const { data: updated, error } = await supabase
        .from("registros")
        .update(cleanData)
        .eq("id", id)
        .select()
        .maybeSingle();

      if (error) throw new Error(error.message);
      return updated;
    }

    // Fallback memoria
    const index = registrosMemoria.findIndex((r) => r.id === id);
    if (index === -1) return null;

    registrosMemoria[index] = {
      ...registrosMemoria[index],
      ...cleanData,
      id
    };
    return registrosMemoria[index];
  },

  // Eliminar un registro
  delete: async (id) => {
    if (isSupabaseConfigured && supabase) {
      const { error } = await supabase
        .from("registros")
        .delete()
        .eq("id", id);

      if (error) throw new Error(error.message);
      return true;
    }

    // Fallback memoria
    const index = registrosMemoria.findIndex((r) => r.id === id);
    if (index === -1) return false;

    registrosMemoria.splice(index, 1);
    return true;
  },

  // Obtener estadísticas globales
  getStats: async () => {
    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase.from("registros").select("estado, prioridad");
      if (error) throw new Error(error.message);

      const list = data || [];
      return {
        total: list.length,
        completados: list.filter((r) => r.estado === "Completado").length,
        enProceso: list.filter((r) => r.estado === "En Proceso").length,
        pendientes: list.filter((r) => r.estado === "Pendiente").length,
        urgentes: list.filter((r) => r.prioridad === "Urgente" || r.prioridad === "Alta").length
      };
    }

    // Fallback memoria
    return {
      total: registrosMemoria.length,
      completados: registrosMemoria.filter((r) => r.estado === "Completado").length,
      enProceso: registrosMemoria.filter((r) => r.estado === "En Proceso").length,
      pendientes: registrosMemoria.filter((r) => r.estado === "Pendiente").length,
      urgentes: registrosMemoria.filter((r) => r.prioridad === "Urgente" || r.prioridad === "Alta").length
    };
  }
};
