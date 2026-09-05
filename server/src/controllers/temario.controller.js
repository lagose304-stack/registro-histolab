import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { supabase, isSupabaseConfigured } from "../db/supabase.js";
import crypto from "crypto";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.join(__dirname, "../../data");
const PUNTAJES_FILE = path.join(DATA_DIR, "puntajes_data.json");
const TEMARIO_FILE = path.join(DATA_DIR, "temario_data.json");
const inMemoryPuntajes = {};

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function loadPersistentPuntajes() {
  try {
    ensureDataDir();
    if (fs.existsSync(PUNTAJES_FILE)) {
      const raw = fs.readFileSync(PUNTAJES_FILE, "utf-8");
      return JSON.parse(raw);
    }
  } catch (err) {
    console.warn("Aviso al leer puntajes locales:", err.message);
  }
  return {};
}

function savePersistentPuntajes(data) {
  try {
    ensureDataDir();
    fs.writeFileSync(PUNTAJES_FILE, JSON.stringify(data, null, 2), "utf-8");
  } catch (err) {
    console.warn("Aviso al guardar puntajes locales:", err.message);
  }
}

function loadPersistentTemas() {
  try {
    ensureDataDir();
    if (fs.existsSync(TEMARIO_FILE)) {
      const raw = fs.readFileSync(TEMARIO_FILE, "utf-8");
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (err) {
    console.warn("Aviso al leer temario local:", err.message);
  }
  return null;
}

function savePersistentTemas(temas) {
  try {
    ensureDataDir();
    fs.writeFileSync(TEMARIO_FILE, JSON.stringify(temas, null, 2), "utf-8");
  } catch (err) {
    console.warn("Aviso al guardar temario local:", err.message);
  }
}

// Temarios predeterminados para las 5 Carreras Oficiales
export const CAREER_DEFAULT_TEMAS = {
  Medicina: [
    { id: "med_t1", titulo: "Epitelios", semana: 1, carrera: "Medicina", activo: true },
    { id: "med_t2", titulo: "Glándulas", semana: 2, carrera: "Medicina", activo: true },
    { id: "med_t3", titulo: "Tejidos Conectivos No Especializados", semana: 2, carrera: "Medicina", activo: true },
    { id: "med_t4", titulo: "Tejido Adiposo", semana: 3, carrera: "Medicina", activo: true },
    { id: "med_t5", titulo: "Cartílago", semana: 3, carrera: "Medicina", activo: true },
    { id: "med_t6", titulo: "Hueso", semana: 3, carrera: "Medicina", activo: true },
    { id: "med_t7", titulo: "Tejido Nervioso", semana: 4, carrera: "Medicina", activo: true },
    { id: "med_t8", titulo: "Sistema Linfoide", semana: 5, carrera: "Medicina", activo: true },
    { id: "med_t9", titulo: "Tejido Sanguíneo", semana: 6, carrera: "Medicina", activo: true },
    { id: "med_t10", titulo: "Sistema Cardiovascular", semana: 7, carrera: "Medicina", activo: true },
    { id: "med_t11", titulo: "Músculo", semana: 7, carrera: "Medicina", activo: true },
    { id: "med_t12", titulo: "Sistema Tegumentario", semana: 8, carrera: "Medicina", activo: true },
    { id: "med_t13", titulo: "Sistema Respiratorio", semana: 8, carrera: "Medicina", activo: true },
    { id: "med_t14", titulo: "Sistema Endocrino", semana: 9, carrera: "Medicina", activo: true },
    { id: "med_t15", titulo: "Cavidad Oral", semana: 10, carrera: "Medicina", activo: true },
    { id: "med_t16", titulo: "Sistema Digestivo", semana: 10, carrera: "Medicina", activo: true },
    { id: "med_t17", titulo: "Glándulas Anexas", semana: 11, carrera: "Medicina", activo: true },
    { id: "med_t18", titulo: "Sistema Urinario", semana: 11, carrera: "Medicina", activo: true },
    { id: "med_t19", titulo: "Sistema Reproductor Femenino", semana: 12, carrera: "Medicina", activo: true },
    { id: "med_t20", titulo: "Glándula mamaria", semana: 12, carrera: "Medicina", activo: true },
    { id: "med_t21", titulo: "Sistema Reproductor Masculino", semana: 13, carrera: "Medicina", activo: true },
    { id: "med_t22", titulo: "Ojo", semana: 13, carrera: "Medicina", activo: true }
  ],
  Odontologia: [
    { id: "odo_t1", titulo: "Epitelios y Glándulas Salivales", semana: 1, carrera: "Odontologia", activo: true },
    { id: "odo_t2", titulo: "Tejido Conectivo y Hueso Maxilar", semana: 2, carrera: "Odontologia", activo: true },
    { id: "odo_t3", titulo: "Complejo Dentino-Pulpar", semana: 3, carrera: "Odontologia", activo: true },
    { id: "odo_t4", titulo: "Esmalte Dental y Amelogénesis", semana: 4, carrera: "Odontologia", activo: true },
    { id: "odo_t5", titulo: "Periodonto de Inserción (Cemento y Hueso Alveolar)", semana: 5, carrera: "Odontologia", activo: true },
    { id: "odo_t6", titulo: "Periodonto de Protección (Encía y Unión)", semana: 6, carrera: "Odontologia", activo: true },
    { id: "odo_t7", titulo: "Mucosa Bucal y Labios", semana: 7, carrera: "Odontologia", activo: true },
    { id: "odo_t8", titulo: "Lengua y Corpúsculos Gustativos", semana: 8, carrera: "Odontologia", activo: true },
    { id: "odo_t9", titulo: "Embriología y Odontogénesis", semana: 9, carrera: "Odontologia", activo: true },
    { id: "odo_t10", titulo: "Articulación Temporomandibular (ATM)", semana: 10, carrera: "Odontologia", activo: true },
    { id: "odo_t11", titulo: "Sistema Inmune Bucal y Amígdalas", semana: 11, carrera: "Odontologia", activo: true },
    { id: "odo_t12", titulo: "Vascularización e Inervación Maxilofacial", semana: 12, carrera: "Odontologia", activo: true }
  ],
  Enfermeria: [
    { id: "enf_t1", titulo: "Biología Celular y Epitelios de Revestimiento", semana: 1, carrera: "Enfermeria", activo: true },
    { id: "enf_t2", titulo: "Tejido Conectivo y Cicatrización", semana: 2, carrera: "Enfermeria", activo: true },
    { id: "enf_t3", titulo: "Tejido Muscular y Respuestas Motoras", semana: 3, carrera: "Enfermeria", activo: true },
    { id: "enf_t4", titulo: "Tejido Nervioso y Reflejos", semana: 4, carrera: "Enfermeria", activo: true },
    { id: "enf_t5", titulo: "Sistema Cardiovascular y Hemodinámica", semana: 5, carrera: "Enfermeria", activo: true },
    { id: "enf_t6", titulo: "Sistema Hematopoyético e Inmunológico", semana: 6, carrera: "Enfermeria", activo: true },
    { id: "enf_t7", titulo: "Sistema Respiratorio e Intercambio de Gases", semana: 7, carrera: "Enfermeria", activo: true },
    { id: "enf_t8", titulo: "Sistema Renal y Balance Hídrico", semana: 8, carrera: "Enfermeria", activo: true },
    { id: "enf_t9", titulo: "Sistema Gastrointestinal", semana: 9, carrera: "Enfermeria", activo: true },
    { id: "enf_t10", titulo: "Sistema Tegumentario y Cuidados de Piel", semana: 10, carrera: "Enfermeria", activo: true },
    { id: "enf_t11", titulo: "Sistema Endocrino y Homeostasis", semana: 11, carrera: "Enfermeria", activo: true },
    { id: "enf_t12", titulo: "Sistema Reproductor y Gestación", semana: 12, carrera: "Enfermeria", activo: true }
  ],
  Microbiologia: [
    { id: "mic_t1", titulo: "Técnicas Histológicas y Microscopía de Fluorescencia", semana: 1, carrera: "Microbiologia", activo: true },
    { id: "mic_t2", titulo: "Células y Tejidos Básicos", semana: 2, carrera: "Microbiologia", activo: true },
    { id: "mic_t3", titulo: "Respuesta Inmune Innata y Adaptativa", semana: 3, carrera: "Microbiologia", activo: true },
    { id: "mic_t4", titulo: "Órganos Linfoides Primarios y Secundarios", semana: 4, carrera: "Microbiologia", activo: true },
    { id: "mic_t5", titulo: "Histopatología de Infecciones Bacterianas", semana: 5, carrera: "Microbiologia", activo: true },
    { id: "mic_t6", titulo: "Barreras Epiteliales y Mucosas Protectoras", semana: 6, carrera: "Microbiologia", activo: true },
    { id: "mic_t7", titulo: "Sistema Respiratorio y Microbiota", semana: 7, carrera: "Microbiologia", activo: true },
    { id: "mic_t8", titulo: "Tracto Digestivo e Interacción Huésped-Patógeno", semana: 8, carrera: "Microbiologia", activo: true },
    { id: "mic_t9", titulo: "Sistema Urinario y Mecanismos Antimicrobianos", semana: 9, carrera: "Microbiologia", activo: true },
    { id: "mic_t10", titulo: "Sangre y Médula Ósea", semana: 10, carrera: "Microbiologia", activo: true },
    { id: "mic_t11", titulo: "Inmunohistoquímica y Marcadores Celulares", semana: 11, carrera: "Microbiologia", activo: true },
    { id: "mic_t12", titulo: "Diagnóstico Histológico Molecular", semana: 12, carrera: "Microbiologia", activo: true }
  ],
  Nutricion: [
    { id: "nut_t1", titulo: "Organización Tisular y Epitelios", semana: 1, carrera: "Nutricion", activo: true },
    { id: "nut_t2", titulo: "Tejido Adiposo Blanco y Pardo", semana: 2, carrera: "Nutricion", activo: true },
    { id: "nut_t3", titulo: "Cavidad Oral, Dientes y Glándulas Salivales", semana: 3, carrera: "Nutricion", activo: true },
    { id: "nut_t4", titulo: "Esófago y Estómago (Mucosa Gástrica)", semana: 4, carrera: "Nutricion", activo: true },
    { id: "nut_t5", titulo: "Intestino Delgado y Absorción de Nutrientes", semana: 5, carrera: "Nutricion", activo: true },
    { id: "nut_t6", titulo: "Intestino Grueso y Microbiota", semana: 6, carrera: "Nutricion", activo: true },
    { id: "nut_t7", titulo: "Hígado, Lobulillos y Vías Biliares", semana: 7, carrera: "Nutricion", activo: true },
    { id: "nut_t8", titulo: "Páncreas Exocrino y Endocrino (Islotes)", semana: 8, carrera: "Nutricion", activo: true },
    { id: "nut_t9", titulo: "Sistema Endocrino y Señales de Saciedad", semana: 9, carrera: "Nutricion", activo: true },
    { id: "nut_t10", titulo: "Músculo Esquelético y Metabolismo", semana: 10, carrera: "Nutricion", activo: true },
    { id: "nut_t11", titulo: "Sistema Cardiovascular y Aterosclerosis", semana: 11, carrera: "Nutricion", activo: true },
    { id: "nut_t12", titulo: "Sistema Renal y Balance Electrolítico", semana: 12, carrera: "Nutricion", activo: true }
  ]
};

// Generar array plano inicial para la memoria respaldado por disco local
let inMemoryTemas = loadPersistentTemas() || Object.values(CAREER_DEFAULT_TEMAS).flat();

/**
 * Normaliza el nombre de la carrera para búsquedas
 */
const getNormalizedCareerKey = (carrera) => {
  const c = String(carrera || "Medicina")
    .toLowerCase()
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  if (c.includes("enferm")) return "Enfermeria";
  if (c.includes("odont")) return "Odontologia";
  if (c.includes("microb")) return "Microbiologia";
  if (c.includes("nutri")) return "Nutricion";
  return "Medicina";
};

// 1. Obtener todos los temas del temario filtrados por carrera y opcionalmente semana
export const getAllTemas = async (req, res) => {
  try {
    const { carrera = "Medicina", semana } = req.query;
    const normCarrera = getNormalizedCareerKey(carrera);

    if (isSupabaseConfigured && supabase) {
      let query = supabase
        .from("temario")
        .select("*")
        .order("semana", { ascending: true, nullsFirst: false })
        .order("numero_tema", { ascending: true, nullsFirst: false });

      if (carrera && carrera !== "TODAS") {
        query = query.ilike("carrera", `%${normCarrera}%`);
      }

      if (semana && semana !== "TODAS") {
        query = query.eq("semana", parseInt(semana, 10));
      }

      const { data, error } = await query;
      if (!error && data) {
        return res.json({
          success: true,
          carrera: normCarrera,
          count: data.length,
          data
        });
      }
    }

    let filtered = [...inMemoryTemas];
    if (carrera && carrera !== "TODAS") {
      filtered = filtered.filter((t) =>
        getNormalizedCareerKey(t.carrera).toLowerCase() === normCarrera.toLowerCase()
      );
    }
    if (semana && semana !== "TODAS") {
      filtered = filtered.filter((t) => Number(t.semana) === parseInt(semana, 10));
    }
    filtered.sort((a, b) => {
      const semA = Number(a.semana) || 999;
      const semB = Number(b.semana) || 999;
      if (semA !== semB) return semA - semB;
      return (Number(a.numero_tema) || 999) - (Number(b.numero_tema) || 999);
    });

    res.json({
      success: true,
      carrera: normCarrera,
      count: filtered.length,
      data: filtered
    });
  } catch (error) {
    console.error("Error al obtener temario:", error);
    res.status(500).json({
      success: false,
      message: "Error al obtener la lista de temas",
      error: error.message
    });
  }
};

// 2. Obtener un tema por ID
export const getTemaById = async (req, res) => {
  try {
    const { id } = req.params;

    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase
        .from("temario")
        .select("*")
        .eq("id", id)
        .maybeSingle();

      if (!error && data) {
        return res.json({
          success: true,
          data
        });
      }
    }

    const tema = inMemoryTemas.find((t) => t.id === id);
    if (!tema) {
      return res.status(404).json({
        success: false,
        message: `Tema con ID ${id} no encontrado.`
      });
    }

    res.json({
      success: true,
      data: tema
    });
  } catch (error) {
    console.error("Error al buscar tema:", error);
    res.status(500).json({
      success: false,
      message: "Error al buscar el tema",
      error: error.message
    });
  }
};

// 3. Crear un nuevo tema específico para una carrera
export const createTema = async (req, res) => {
  try {
    const {
      titulo,
      nombre,
      semana,
      numero_tema,
      carrera = "Medicina",
      activo,
      tiene_manual,
      desplazar_siguientes = false
    } = req.body;
    const cleanTitulo = (titulo || nombre || "").trim();
    const targetCarrera = getNormalizedCareerKey(carrera);
    const isManual = tiene_manual !== undefined ? Boolean(tiene_manual) : true;

    if (!cleanTitulo) {
      return res.status(400).json({
        success: false,
        message: "El nombre del tema es obligatorio."
      });
    }

    const careerTemas = inMemoryTemas.filter(
      (t) => getNormalizedCareerKey(t.carrera) === targetCarrera
    );
    const numTema = parseInt(numero_tema, 10) || (careerTemas.length + 1);
    const nextSemana = parseInt(semana, 10) || 1;

    // Validación de unicidad y desplazamiento automático (+1)
    if (isSupabaseConfigured && supabase) {
      if (desplazar_siguientes) {
        // Desplazar en orden descendente los temas con numero_tema >= numTema
        const { data: toShift } = await supabase
          .from("temario")
          .select("id, numero_tema")
          .ilike("carrera", `%${targetCarrera}%`)
          .gte("numero_tema", numTema)
          .order("numero_tema", { ascending: false });

        if (toShift && toShift.length > 0) {
          for (const item of toShift) {
            await supabase
              .from("temario")
              .update({
                numero_tema: Number(item.numero_tema) + 1,
                updated_at: new Date().toISOString()
              })
              .eq("id", item.id);
          }
        }
      } else {
        const { data: dupCheck } = await supabase
          .from("temario")
          .select("id, titulo, numero_tema")
          .ilike("carrera", `%${targetCarrera}%`)
          .eq("numero_tema", numTema)
          .limit(1);

        if (dupCheck && dupCheck.length > 0) {
          return res.status(400).json({
            success: false,
            message: `Ya existe el Tema #${numTema} ("${dupCheck[0].titulo}") en la carrera ${targetCarrera}. Cada tema debe tener un número único.`
          });
        }
      }
    } else {
      if (desplazar_siguientes) {
        inMemoryTemas.forEach((t) => {
          if (
            getNormalizedCareerKey(t.carrera) === targetCarrera &&
            Number(t.numero_tema) >= numTema
          ) {
            t.numero_tema = Number(t.numero_tema) + 1;
            t.updated_at = new Date().toISOString();
          }
        });
      } else {
        const dup = inMemoryTemas.find(
          (t) =>
            getNormalizedCareerKey(t.carrera) === targetCarrera &&
            Number(t.numero_tema) === numTema
        );
        if (dup) {
          return res.status(400).json({
            success: false,
            message: `Ya existe el Tema #${numTema} ("${dup.titulo}") en la carrera ${targetCarrera}. Cada tema debe tener un número único.`
          });
        }
      }
    }

    const newTemaData = {
      id: crypto.randomUUID(),
      titulo: cleanTitulo,
      semana: nextSemana,
      numero_tema: numTema,
      carrera: targetCarrera,
      tiene_manual: isManual,
      activo: activo !== undefined ? Boolean(activo) : true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    if (isSupabaseConfigured && supabase) {
      let { data, error } = await supabase
        .from("temario")
        .insert(newTemaData)
        .select()
        .single();

      if (error && error.code === "PGRST204") {
        // Fallback si la columna tiene_manual no ha sido agregada aún a Supabase
        const { tiene_manual: _, ...fallbackData } = newTemaData;
        const resFallback = await supabase
          .from("temario")
          .insert(fallbackData)
          .select()
          .single();
        data = resFallback.data ? { ...resFallback.data, tiene_manual: isManual } : null;
        error = resFallback.error;
      }

      if (!error && data) {
        inMemoryTemas = inMemoryTemas.filter((t) => t.id !== data.id);
        inMemoryTemas.push(data);
        savePersistentTemas(inMemoryTemas);
        return res.status(201).json({
          success: true,
          message: `Tema registrado exitosamente para ${targetCarrera}.`,
          tema: data
        });
      }
    }

    inMemoryTemas.push(newTemaData);
    inMemoryTemas.sort((a, b) => {
      const semA = Number(a.semana) || 999;
      const semB = Number(b.semana) || 999;
      if (semA !== semB) return semA - semB;
      return (Number(a.numero_tema) || 999) - (Number(b.numero_tema) || 999);
    });
    savePersistentTemas(inMemoryTemas);

    res.status(201).json({
      success: true,
      message: `Tema registrado exitosamente para ${targetCarrera} (memoria).`,
      tema: newTemaData
    });
  } catch (error) {
    console.error("Error al crear tema:", error);
    res.status(500).json({
      success: false,
      message: "Error al registrar el tema",
      error: error.message
    });
  }
};

// 4. Actualizar tema
export const updateTema = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      titulo,
      nombre,
      semana,
      numero_tema,
      carrera,
      activo,
      tiene_manual,
      desplazar_siguientes = false
    } = req.body;

    const updates = {
      updated_at: new Date().toISOString()
    };

    if (titulo !== undefined || nombre !== undefined) {
      updates.titulo = (titulo || nombre || "").trim();
    }
    if (numero_tema !== undefined) {
      updates.numero_tema = parseInt(numero_tema, 10);
    }
    if (semana !== undefined) {
      updates.semana = parseInt(semana, 10);
    }
    if (carrera !== undefined) updates.carrera = getNormalizedCareerKey(carrera);
    if (activo !== undefined) updates.activo = Boolean(activo);
    if (tiene_manual !== undefined) updates.tiene_manual = Boolean(tiene_manual);

    // Validación de unicidad si se modifica el número de tema
    if (updates.numero_tema !== undefined) {
      const targetCarrera = updates.carrera || "Medicina";
      if (isSupabaseConfigured && supabase) {
        if (desplazar_siguientes) {
          const { data: toShift } = await supabase
            .from("temario")
            .select("id, numero_tema")
            .ilike("carrera", `%${targetCarrera}%`)
            .neq("id", id)
            .gte("numero_tema", updates.numero_tema)
            .order("numero_tema", { ascending: false });

          if (toShift && toShift.length > 0) {
            for (const item of toShift) {
              await supabase
                .from("temario")
                .update({
                  numero_tema: Number(item.numero_tema) + 1,
                  updated_at: new Date().toISOString()
                })
                .eq("id", item.id);
            }
          }
        } else {
          const { data: dupCheck } = await supabase
            .from("temario")
            .select("id, titulo, numero_tema")
            .ilike("carrera", `%${targetCarrera}%`)
            .eq("numero_tema", updates.numero_tema)
            .neq("id", id)
            .limit(1);

          if (dupCheck && dupCheck.length > 0) {
            return res.status(400).json({
              success: false,
              message: `Ya existe el Tema #${updates.numero_tema} ("${dupCheck[0].titulo}") en la carrera ${targetCarrera}. Cada tema debe tener un número único.`
            });
          }
        }
      } else {
        if (desplazar_siguientes) {
          inMemoryTemas.forEach((t) => {
            if (
              t.id !== id &&
              getNormalizedCareerKey(t.carrera) === targetCarrera &&
              Number(t.numero_tema) >= updates.numero_tema
            ) {
              t.numero_tema = Number(t.numero_tema) + 1;
              t.updated_at = new Date().toISOString();
            }
          });
        } else {
          const dup = inMemoryTemas.find(
            (t) =>
              t.id !== id &&
              getNormalizedCareerKey(t.carrera) === targetCarrera &&
              Number(t.numero_tema) === updates.numero_tema
          );
          if (dup) {
            return res.status(400).json({
              success: false,
              message: `Ya existe el Tema #${updates.numero_tema} ("${dup.titulo}") en la carrera ${targetCarrera}. Cada tema debe tener un número único.`
            });
          }
        }
      }
    }

    if (isSupabaseConfigured && supabase) {
      let { data, error } = await supabase
        .from("temario")
        .update(updates)
        .eq("id", id)
        .select()
        .single();

      console.log("[updateTema] updates enviados:", JSON.stringify(updates));
      if (error) {
        console.error("[updateTema] Supabase error:", JSON.stringify(error));
      }

      if (error && (error.code === "PGRST204" || error.message?.includes("numero_tema") || error.message?.includes("tiene_manual") || error.code === "42703")) {
        const { numero_tema: _n, tiene_manual: _m, ...fallbackUpdates } = updates;
        console.log("[updateTema] Fallback sin columnas nuevas:", JSON.stringify(fallbackUpdates));
        const resFallback = await supabase
          .from("temario")
          .update(fallbackUpdates)
          .eq("id", id)
          .select()
          .single();
        data = resFallback.data ? {
          ...resFallback.data,
          numero_tema: updates.numero_tema ?? resFallback.data.numero_tema,
          tiene_manual: updates.tiene_manual !== undefined ? Boolean(updates.tiene_manual) : resFallback.data.tiene_manual
        } : null;
        error = resFallback.error;
      }

      if (!error && data) {
        const uIdx = inMemoryTemas.findIndex((t) => t.id === id);
        if (uIdx !== -1) inMemoryTemas[uIdx] = { ...inMemoryTemas[uIdx], ...data };
        else inMemoryTemas.push(data);
        savePersistentTemas(inMemoryTemas);
        return res.json({
          success: true,
          message: "Tema actualizado exitosamente.",
          tema: data
        });
      }
    }

    const idx = inMemoryTemas.findIndex((t) => t.id === id);
    if (idx === -1) {
      return res.status(404).json({
        success: false,
        message: `Tema con ID ${id} no encontrado para actualizar.`
      });
    }

    inMemoryTemas[idx] = {
      ...inMemoryTemas[idx],
      ...updates
    };
    inMemoryTemas.sort((a, b) => (Number(a.numero_tema) || 999) - (Number(b.numero_tema) || 999));
    savePersistentTemas(inMemoryTemas);

    res.json({
      success: true,
      message: "Tema actualizado exitosamente (memoria).",
      tema: inMemoryTemas[idx]
    });
  } catch (error) {
    console.error("Error al actualizar tema:", error);
    res.status(500).json({
      success: false,
      message: "Error al actualizar el tema",
      error: error.message
    });
  }
};

// 5. Reordenar Temas masivamente (renumeración secuencial 1, 2, 3... o asignación de semanas)
export const reorderTemas = async (req, res) => {
  try {
    const { assignments, items, ordered_ids, carrera = "Medicina" } = req.body;
    const targetCarrera = getNormalizedCareerKey(carrera);

    let updateList = [];
    if (Array.isArray(ordered_ids) && ordered_ids.length > 0) {
      updateList = ordered_ids.map((id, idx) => ({
        id,
        numero_tema: idx + 1
      }));
    } else if (Array.isArray(items) && items.length > 0) {
      updateList = items;
    } else if (Array.isArray(assignments) && assignments.length > 0) {
      updateList = assignments;
    } else {
      return res.status(400).json({
        success: false,
        message: "No se enviaron datos de reordenamiento válidos."
      });
    }

    if (isSupabaseConfigured && supabase) {
      // Paso 1: Enumeración temporal negativa para evitar choques de unicidad
      for (let idx = 0; idx < updateList.length; idx++) {
        const it = updateList[idx];
        if (it.id && it.numero_tema !== undefined) {
          await supabase
            .from("temario")
            .update({ numero_tema: -(idx + 1), updated_at: new Date().toISOString() })
            .eq("id", it.id);
        }
      }

      // Paso 2: Asignación final positiva y/o semana
      for (const it of updateList) {
        if (it.id) {
          const rowUpdates = { updated_at: new Date().toISOString() };
          if (it.numero_tema !== undefined) rowUpdates.numero_tema = parseInt(it.numero_tema, 10);
          if (it.semana !== undefined) rowUpdates.semana = parseInt(it.semana, 10);
          await supabase
            .from("temario")
            .update(rowUpdates)
            .eq("id", it.id);
        }
      }

      const { data } = await supabase
        .from("temario")
        .select("*")
        .ilike("carrera", `%${targetCarrera}%`)
        .order("numero_tema", { ascending: true });

      if (data) {
        inMemoryTemas = inMemoryTemas.filter((t) => getNormalizedCareerKey(t.carrera) !== targetCarrera).concat(data);
        savePersistentTemas(inMemoryTemas);
      }

      return res.json({
        success: true,
        message: "Temario reordenado exitosamente.",
        data: data || []
      });
    }

    // Actualización en memoria
    for (const item of updateList) {
      const t = inMemoryTemas.find((x) => x.id === item.id);
      if (t) {
        if (item.numero_tema !== undefined) t.numero_tema = parseInt(item.numero_tema, 10);
        if (item.semana !== undefined) t.semana = parseInt(item.semana, 10);
        t.updated_at = new Date().toISOString();
      }
    }
    inMemoryTemas.sort((a, b) => (Number(a.numero_tema) || 999) - (Number(b.numero_tema) || 999));
    savePersistentTemas(inMemoryTemas);

    const result = inMemoryTemas.filter(
      (t) => getNormalizedCareerKey(t.carrera) === targetCarrera
    );

    res.json({
      success: true,
      message: "Temario reordenado exitosamente (memoria).",
      data: result
    });
  } catch (error) {
    console.error("Error al reordenar temas:", error);
    res.status(500).json({
      success: false,
      message: "Error al reordenar el temario",
      error: error.message
    });
  }
};

// 6. Copiar temario de una carrera a otra
export const copyTemario = async (req, res) => {
  try {
    const { fromCarrera = "Medicina", toCarrera } = req.body;
    const sourceCar = getNormalizedCareerKey(fromCarrera);
    const destCar = getNormalizedCareerKey(toCarrera);

    if (!toCarrera) {
      return res.status(400).json({
        success: false,
        message: "La carrera de destino es obligatoria."
      });
    }

    if (sourceCar === destCar) {
      return res.status(400).json({
        success: false,
        message: "Las carreras de origen y destino no pueden ser iguales."
      });
    }

    let sourceTemas = [];
    if (isSupabaseConfigured && supabase) {
      const { data } = await supabase.from("temario").select("*").ilike("carrera", `%${sourceCar}%`);
      sourceTemas = data || [];
    }
    if (sourceTemas.length === 0) {
      sourceTemas = CAREER_DEFAULT_TEMAS[sourceCar] || [];
    }

    if (sourceTemas.length === 0) {
      return res.status(404).json({
        success: false,
        message: `No se encontraron temas en la carrera de origen (${fromCarrera}).`
      });
    }

    const newTemas = sourceTemas.map((st) => ({
      id: crypto.randomUUID(),
      titulo: st.titulo,
      semana: st.semana,
      numero_tema: st.numero_tema || st.semana,
      carrera: destCar,
      activo: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }));

    if (isSupabaseConfigured && supabase) {
      await supabase.from("temario").delete().ilike("carrera", `%${destCar}%`);
      await supabase.from("temario").insert(newTemas);
    }

    inMemoryTemas = inMemoryTemas.filter(
      (t) => getNormalizedCareerKey(t.carrera) !== destCar
    );
    inMemoryTemas.push(...newTemas);

    res.json({
      success: true,
      message: `Temario copiado exitosamente de ${sourceCar} a ${destCar} (${newTemas.length} temas).`,
      data: newTemas
    });
  } catch (error) {
    console.error("Error al copiar temario:", error);
    res.status(500).json({
      success: false,
      message: "Error al duplicar el temario entre carreras",
      error: error.message
    });
  }
};

// 7. Eliminar tema
export const deleteTema = async (req, res) => {
  try {
    const { id } = req.params;

    if (isSupabaseConfigured && supabase) {
      const { error } = await supabase.from("temario").delete().eq("id", id);
      if (!error) {
        inMemoryTemas = inMemoryTemas.filter((t) => t.id !== id);
        savePersistentTemas(inMemoryTemas);
        return res.json({
          success: true,
          message: "Tema eliminado exitosamente del temario."
        });
      }
    }

    const idx = inMemoryTemas.findIndex((t) => t.id === id);
    if (idx === -1) {
      return res.status(404).json({
        success: false,
        message: `Tema con ID ${id} no encontrado.`
      });
    }

    inMemoryTemas.splice(idx, 1);
    savePersistentTemas(inMemoryTemas);

    res.json({
      success: true,
      message: "Tema eliminado exitosamente del temario."
    });
  } catch (error) {
    console.error("Error al eliminar tema:", error);
    res.status(500).json({
      success: false,
      message: "Error al eliminar el tema",
      error: error.message
    });
  }
};

// 8. Obtener configuración de puntajes de una carrera
export const getPuntajesByCarrera = async (req, res) => {
  try {
    const { carrera = "Medicina" } = req.params;
    const targetCarrera = getNormalizedCareerKey(carrera);

    if (isSupabaseConfigured && supabase) {
      let foundData = null;
      const { data: directData, error: dirErr } = await supabase
        .from("configuracion_puntajes")
        .select("*")
        .ilike("carrera", `%${targetCarrera}%`)
        .maybeSingle();

      if (!dirErr && directData) {
        foundData = directData;
      } else {
        const { data: allRows } = await supabase
          .from("configuracion_puntajes")
          .select("*");
        if (Array.isArray(allRows)) {
          foundData = allRows.find(
            (r) => getNormalizedCareerKey(r.carrera) === targetCarrera
          ) || null;
        }
      }

      if (foundData) {
        const m = Number(foundData.nota_total_manuales) || 0;
        const p = Number(foundData.nota_total_pruebas) || 0;
        let exSum = 0;
        if (foundData.examenes && typeof foundData.examenes === "object") {
          Object.values(foundData.examenes).forEach((v) => {
            exSum += Number(v) || 0;
          });
        }
        const sumCalc = Math.round((m + p + exSum) * 1000) / 1000;
        const puntajeFinal = sumCalc > 0 ? sumCalc : (Number(foundData.puntaje_total) || 0);

        return res.json({
          success: true,
          data: {
            carrera: targetCarrera,
            nota_total_manuales: m,
            nota_total_pruebas: p,
            examenes: foundData.examenes || {},
            puntaje_total: puntajeFinal
          }
        });
      }
    }

    // Si Supabase no tiene la tabla o no tiene registro, buscar en almacenamiento persistente local
    const persistent = loadPersistentPuntajes();
    const cached = persistent[targetCarrera] || inMemoryPuntajes[targetCarrera] || null;

    if (cached) {
      const m = Number(cached.nota_total_manuales) || 0;
      const p = Number(cached.nota_total_pruebas) || 0;
      let exSum = 0;
      if (cached.examenes && typeof cached.examenes === "object") {
        Object.values(cached.examenes).forEach((v) => {
          exSum += Number(v) || 0;
        });
      }
      const sumCalc = Math.round((m + p + exSum) * 1000) / 1000;
      const puntajeFinal = sumCalc > 0 ? sumCalc : (Number(cached.puntaje_total) || 0);

      return res.json({
        success: true,
        data: {
          ...cached,
          puntaje_total: puntajeFinal
        }
      });
    }

    return res.json({
      success: true,
      data: null
    });
  } catch (error) {
    console.error("Error al obtener puntajes de carrera:", error);
    res.status(500).json({
      success: false,
      message: "Error al obtener la configuración de puntajes",
      error: error.message
    });
  }
};

// 9. Guardar configuración de puntajes de una carrera
export const savePuntajesByCarrera = async (req, res) => {
  try {
    const { carrera = "Medicina" } = req.params;
    const { nota_total_manuales, nota_total_pruebas, examenes = {}, puntaje_total } = req.body;
    const targetCarrera = getNormalizedCareerKey(carrera);

    const m = Math.round((Number(nota_total_manuales) || 0) * 1000) / 1000;
    const p = Math.round((Number(nota_total_pruebas) || 0) * 1000) / 1000;
    let exSum = 0;
    const cleanExams = {};
    if (examenes && typeof examenes === "object") {
      Object.entries(examenes).forEach(([k, v]) => {
        const numVal = Math.round((Number(v) || 0) * 1000) / 1000;
        cleanExams[k] = numVal;
        exSum += numVal;
      });
    }
    const sumCalc = Math.round((m + p + exSum) * 1000) / 1000;
    const finalTotal = sumCalc > 0 ? sumCalc : (Math.round((Number(puntaje_total) || 0) * 1000) / 1000);

    const payload = {
      carrera: targetCarrera,
      nota_total_manuales: m,
      nota_total_pruebas: p,
      examenes: cleanExams,
      puntaje_total: finalTotal,
      updated_at: new Date().toISOString()
    };

    // 1. Guardar en memoria y en archivo local persistente
    inMemoryPuntajes[targetCarrera] = payload;
    const persistent = loadPersistentPuntajes();
    persistent[targetCarrera] = payload;
    savePersistentPuntajes(persistent);

    // 2. Guardar en Supabase
    if (isSupabaseConfigured && supabase) {
      try {
        let { data, error } = await supabase
          .from("configuracion_puntajes")
          .upsert(payload, { onConflict: "carrera" })
          .select();

        if (error) {
          console.warn("Reintentando guardado de configuracion_puntajes en Supabase:", error.message);
          const updateRes = await supabase
            .from("configuracion_puntajes")
            .update(payload)
            .ilike("carrera", `%${targetCarrera}%`)
            .select();

          if (!updateRes.error && updateRes.data?.length > 0) {
            data = updateRes.data;
            error = null;
          }
        }

        if (!error && data) {
          return res.json({
            success: true,
            message: `Puntajes de ${targetCarrera} guardados exitosamente en la base de datos.`,
            data: data[0] || payload
          });
        }

        if (error) {
          console.error("Error persistiendo puntajes en Supabase:", error.message);
        }
      } catch (sbErr) {
        console.error("Excepción al guardar en Supabase configuracion_puntajes:", sbErr.message);
      }
    }

    return res.json({
      success: true,
      message: `Puntajes de ${targetCarrera} guardados correctamente.`,
      data: payload
    });
  } catch (error) {
    console.error("Error al guardar puntajes de carrera:", error);
    res.status(500).json({
      success: false,
      message: "Error al guardar la configuración de puntajes",
      error: error.message
    });
  }
};

