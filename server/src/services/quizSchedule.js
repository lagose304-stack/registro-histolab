import fs from "node:fs";
import path from "node:path";
import { supabase, isSupabaseConfigured } from "../db/supabase.js";
import { normalizeSectionCareer } from "../../../shared/sectionCode.mjs";

export async function loadQuizSchedule(section, dataDir) {
  const career = normalizeSectionCareer(section.carrera);
  if (isSupabaseConfigured && supabase) {
    const [weeks, events] = await Promise.all([
      supabase.from("configuracion_semanas").select("*"),
      supabase.from("agenda_academica").select("id,tipo,carrera,seccion_id,fecha,fecha_original,hora_inicio,hora_fin")
        .eq("carrera",career).or(`seccion_id.eq.${section.id},seccion_id.is.null`)
    ]);
    if (weeks.error || events.error) throw weeks.error || events.error;
    return { weeks: (weeks.data || []).filter(week => normalizeSectionCareer(week.carrera) === career), events: events.data || [] };
  }
  const read = (name, fallback) => { try { return JSON.parse(fs.readFileSync(path.join(dataDir,name),"utf8")); } catch { return fallback; } };
  const saved = read("semanas_data.json",{});
  const weeks = Array.isArray(saved) ? saved.filter(week => normalizeSectionCareer(week.carrera) === career)
    : Object.entries(saved).find(([key]) => normalizeSectionCareer(key) === career)?.[1] || [];
  return { weeks, events: read("agenda_academica.json",[]).filter(event => normalizeSectionCareer(event.carrera) === career && (!event.seccion_id || event.seccion_id === section.id)) };
}
