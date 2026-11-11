import { gradeInstructorName, localGradeSnapshot, withGradeActor } from "../services/gradeHistory.js";
import { getAttendanceKeys, getAttendanceWindow } from "../../../shared/attendanceWindow.mjs";
import { practiceAbsent } from "../../../shared/practiceAttendance.mjs";
import { canViewSection, isInstructorTitular, isSectionAssignedToInstructor, matchesInstructor } from "../../../shared/sectionAccess.mjs";
import { hasAdministrationAccess } from "../../../shared/instructorRoles.mjs";
import { normalizeSectionCareer } from "../../../shared/sectionCode.mjs";
import { getLocalSchedulingSections } from "./secciones.controller.js";
import { buildAcademicWeeks, getLocalSchedulingWeeks } from "./semanas.controller.js";
import { getLocalSectionAssignments } from "./asignaciones.controller.js";
import { getSectionAttendanceEvents } from "./academicAgenda.controller.js";
import { getManualSchedule } from "./manualsSchedule.controller.js";
import { getLocalAcademicSettings } from "./temario.controller.js";
import { getManualsWindow } from "../../../shared/manualsWindow.mjs";
import { buildSectionAwardsRanking } from "../../../client/src/utils/sectionAwards.js";
import { calculateStudentAcademicSummary } from "../../../client/src/utils/academicEngine.js";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { supabase, isSupabaseConfigured } from "../db/supabase.js";
import { assertStudentAccountAvailable, assertLocalStudentAccountAvailable, DUPLICATE_ACCOUNT_MESSAGE } from "../services/studentEnrollment.js";
import { normalizeAccountEmail, validAccountEmail } from "../../../shared/accountActivation.mjs";
import { deleteStudentAccount } from "../services/studentAccountDeletion.js";
import { studentMakeups, destinationMakeup } from "../services/studentMakeups.js";

export async function hasPracticeAbsence(section, account, career, week, attendance) {
  const makeup = await destinationMakeup(section, account, week);
  if (makeup) return practiceAbsent(null, week, makeup);
  const table = await getTableForSeccion(section, career);
  let student = (inMemoryEstudiantes[table] || []).find(row => String(row.seccion_id) === String(section) && String(row.numero_cuenta) === String(account));
  if (isSupabaseConfigured && supabase) {
    const result = await supabase.from(table).select("*").eq("seccion_id", section).eq("numero_cuenta", account).maybeSingle();
    if (result.error) throw result.error;
    student = result.data;
  }
  const requests = await studentMakeups(section, account);
  if (attendance !== undefined && student) student = { ...student, asistencias: attendance };
  return practiceAbsent(student, week, requests.find(row => Number(row.numero_semana) === Number(week)));
}

async function assertAttendanceGrades(section, account, career, notes, attendance) {
  if (!notes) return;
  let { topics } = getLocalAcademicSettings(career);
  if (isSupabaseConfigured && supabase) {
    const result = await supabase.from("temario").select("*");
    if (result.error) throw result.error;
    topics = result.data.filter(topic => normalizeSectionCareer(topic.carrera) === normalizeSectionCareer(career));
  }
  const weeks = new Set();
  for (const [key, value] of Object.entries(notes)) {
    if (!(Number(value) > 0)) continue;
    const quiz = key.match(/^(?:prueba_|examencito_)(\d+)(?:_real)?$/) || key.match(/^Prueba de la semana (\d+)$/);
    if (quiz) weeks.add(Number(quiz[1]));
    const topic = topics.find(topic => [`manual_${topic.id}`, `manual_tema_${topic.numero_tema}`, `Manual de ${topic.titulo}`, String(topic.id)].includes(key));
    if (topic) weeks.add(Number(topic.semana));
  }
  for (const week of weeks) if (await hasPracticeAbsence(section, account, career, week, attendance)) {
    const error = new Error("No puedes registrar notas positivas con falta injustificada en esta práctica.");
    error.status = 409;
    throw error;
  }
}

const publicStudent = row => { if(!row)return row;const {contrasena,current_session_token,auth_user_id,...safe}=row;return safe; };
const conflictMessage = error => /correo|email/i.test(error?.message||"") ? "Este correo ya está registrado en otra cuenta activa." : DUPLICATE_ACCOUNT_MESSAGE;

const __dirname = (() => {
  try {
    if (typeof import.meta !== "undefined" && typeof import.meta.url === "string" && import.meta.url.startsWith("file:")) {
      return path.dirname(fileURLToPath(import.meta.url));
    }
  } catch {}
  return (typeof process !== "undefined" && process.cwd) ? process.cwd() : "/";
})();
const DATA_DIR = path.join(__dirname, "../../data");
const ESTUDIANTES_FILE = path.join(DATA_DIR, "estudiantes_data.json");

function ensureDataDir() {
  try {
    if (typeof fs.existsSync === "function" && !fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
  } catch (err) {
    // Ignorar errores de sistema de archivos en entornos serverless/Cloudflare Workers
  }
}

function loadPersistentEstudiantes() {
  try {
    ensureDataDir();
    if (fs.existsSync(ESTUDIANTES_FILE)) {
      const raw = fs.readFileSync(ESTUDIANTES_FILE, "utf-8");
      return JSON.parse(raw);
    }
  } catch (err) {
    console.warn("Aviso al leer estudiantes locales:", err.message);
  }
  return {
    estudiantes_medicina: [],
    estudiantes_enfermeria: [],
    estudiantes_odontologia: [],
    estudiantes_microbiologia: [],
    estudiantes_nutricion: []
  };
}

function savePersistentEstudiantes(data, throwOnError = false) {
  try {
    ensureDataDir();
    const safe=Object.fromEntries(Object.entries(data).map(([table,rows])=>[table,Array.isArray(rows)?rows.map(publicStudent):rows]));
    const pending = ESTUDIANTES_FILE + ".tmp";
    fs.writeFileSync(pending, JSON.stringify(safe, null, 2), "utf-8");
    fs.renameSync(pending, ESTUDIANTES_FILE);
  } catch (err) {
    if (throwOnError) throw err;
    console.warn("Aviso al guardar estudiantes locales:", err.message);
  }
}

// Memoria de respaldo por carrera respaldada en disco local
let inMemoryEstudiantes = loadPersistentEstudiantes();

function saveLocalGradeRows(table, nextRows, instructor) {
  const existing = inMemoryEstudiantes[table] || [];
  const history = inMemoryEstudiantes.gradeHistory || { entries: [] };
  const added = [];
  if (instructor?.id) {
    const career = table.replace("estudiantes_", "");
    const { topics } = getLocalAcademicSettings(career);
    const weeks = getLocalSchedulingWeeks(career);
    const fecha = new Date().toISOString();
    nextRows.forEach((row, index) => {
      if (row === existing[index]) return;
      const before = localGradeSnapshot(existing[index] || {}, topics, weeks);
      const after = localGradeSnapshot(row, topics, weeks);
      for (const key of new Set([...before.keys(), ...after.keys()])) {
        const anterior = before.get(key)?.value ?? null;
        const nueva = after.get(key)?.value ?? null;
        if (anterior === nueva) continue;
        added.push({
          id: (history.entries.at(-1)?.id || 0) + added.length + 1,
          seccion_id: row.seccion_id,
          instructor_id: instructor.id,
          instructor_nombre: gradeInstructorName(instructor),
          numero_cuenta: row.numero_cuenta,
          estudiante_nombre: row.nombre_completo,
          evaluacion: key,
          etiqueta: (after.get(key) || before.get(key)).label,
          anterior, nueva, fecha
        });
      }
    });
  }
  const next = { ...inMemoryEstudiantes, [table]: nextRows };
  if (added.length) next.gradeHistory = { entries: [...history.entries, ...added] };
  savePersistentEstudiantes(next, true);
  inMemoryEstudiantes = next;
}

// Los días del filtro corresponden a la hora de Honduras.
function gradeHistoryDay(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(value + "T00:00:00-06:00");
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value ? date : null;
}

const gradeHistoryTextPattern = value => '%' + value.replace(/[\\%_]/g, "\\$&") + '%';

export async function getMySectionRank(req, res) {
  res.set("Cache-Control", "private, no-store");
  const student = req.student;
  if (!student?.id || !student.seccion_id || !student.carrera) {
    return res.json({ data: { posicion: null } });
  }

  const career = normalizeSectionCareer(student.carrera);
  const table = normalizeCarreraToTable(career);
  try {
    let students;
    let topics;
    let scores;
    let weeks;
    if (isSupabaseConfigured && supabase) {
      // También encuentra los nombres históricos con tilde.
      const careerFilter = `%${career.slice(0, 5)}%`;
      const results = await Promise.all([
        supabase.from(table).select("id,numero_cuenta,nombre_completo,notas,primer_examen,segundo_examen,tercer_examen", { count: "exact" })
          .eq("seccion_id", student.seccion_id).eq("activo", true),
        supabase.from("temario").select("*").ilike("carrera", careerFilter),
        supabase.from("configuracion_puntajes").select("*").ilike("carrera", careerFilter),
        supabase.from("configuracion_semanas").select("*").ilike("carrera", careerFilter)
      ]);
      if (results.some(result => result.error || !Array.isArray(result.data))) throw new Error("Datos académicos incompletos");
      const [roster, topicRows, scoreRows, weekRows] = results;
      if (roster.count !== roster.data.length) throw new Error("Matrícula incompleta");
      const sameCareer = row => normalizeSectionCareer(row.carrera) === career;
      students = roster.data;
      topics = topicRows.data.filter(sameCareer);
      scores = scoreRows.data.find(sameCareer) || {};
      weeks = buildAcademicWeeks(weekRows.data.filter(sameCareer), topics, career);
    } else {
      students = (inMemoryEstudiantes[table] || []).filter(row =>
        String(row.seccion_id) === String(student.seccion_id) && row.activo !== false);
      ({ topics, scores } = getLocalAcademicSettings(career));
      weeks = buildAcademicWeeks(getLocalSchedulingWeeks(career), topics, career);
    }

    const ranking = buildSectionAwardsRanking(students, scores, topics, weeks).filter(entry =>
      [entry.pruebasDesglose, entry.manualesDesglose, entry.examenesDesglose].some(group =>
        group.some(grade => Number.isFinite(grade.nota))
      )
    );
    const index = ranking.findIndex(entry => String(entry.id) === String(student.id));
    return res.json({ data: { posicion: index < 0 ? null : index + 1 } });
  } catch {
    return res.status(503).json({ message: "No pudimos consultar tu posición en la sección." });
  }
}

export async function listGradeHistory(req, res) {
  res.set("Cache-Control", "private, no-store");
  const { seccion_id } = req.params;
  const { before, cuenta, instructor, evaluacion, accion, desde, hasta } = req.query;
  const firstDay = gradeHistoryDay(desde);
  const lastDay = gradeHistoryDay(hasta);
  if ((before !== undefined && (typeof before !== "string" || !/^\d{1,15}$/.test(before))) ||
      [cuenta, instructor, evaluacion].some(value => value !== undefined && (typeof value !== "string" || value.length > 64)) ||
      [instructor, evaluacion].some(value => value?.includes("*")) ||
      (accion !== undefined && !["asigno", "modifico", "elimino"].includes(accion)) ||
      (desde !== undefined && !firstDay) || (hasta !== undefined && !lastDay) ||
      (firstDay && lastDay && firstDay > lastDay)) {
    return res.status(400).json({ message: "Revisa los filtros y el rango de fechas." });
  }
  const start = firstDay?.toISOString();
  const end = lastDay ? new Date(lastDay.getTime() + 86_400_000).toISOString() : null;
  const pageSize = 30;
  try {
    let rows;
    if (isSupabaseConfigured && supabase) {
      let query = supabase.from("historial_notas").select("*").eq("seccion_id", seccion_id)
        .order("id", { ascending: false }).limit(pageSize + 1);
      if (before) query = query.lt("id", before);
      if (cuenta) query = query.eq("numero_cuenta", cuenta);
      if (instructor) query = query.ilike("instructor_nombre", gradeHistoryTextPattern(instructor));
      if (evaluacion) query = query.ilike("etiqueta", gradeHistoryTextPattern(evaluacion));
      if (accion === "asigno") query = query.is("anterior", null);
      if (accion === "modifico") query = query.not("anterior", "is", null).not("nueva", "is", null);
      if (accion === "elimino") query = query.is("nueva", null);
      if (start) query = query.gte("fecha", start);
      if (end) query = query.lt("fecha", end);
      const { data, error } = await query;
      if (error) throw error;
      rows = data;
    } else {
      const matchesText = (value, term) => !term || String(value).toLowerCase().includes(term.toLowerCase());
      const entries = inMemoryEstudiantes.gradeHistory?.entries || [];
      rows = [];
      for (let i = entries.length - 1; i >= 0 && rows.length <= pageSize; i--) {
        const row = entries[i];
        const action = row.nueva == null ? "elimino" : row.anterior == null ? "asigno" : "modifico";
        if (String(row.seccion_id) === seccion_id && (!before || row.id < Number(before)) &&
            (!cuenta || row.numero_cuenta === cuenta) && (!accion || action === accion) &&
            (!start || row.fecha >= start) && (!end || row.fecha < end) &&
            matchesText(row.instructor_nombre, instructor) && matchesText(row.etiqueta, evaluacion)) rows.push(row);
      }
    }
    return res.json({ data: rows.slice(0, pageSize), next: rows.length > pageSize ? rows[pageSize - 1].id : null });
  } catch {
    return res.status(503).json({ message: "No pudimos consultar el historial de notas." });
  }
}

/**
 * Sanitiza canónicamente el objeto notas antes de persistirlo en Supabase o memoria local:
 * 1. Estandariza de forma transparente examencito_X -> prueba_X (eliminando claves redundantes).
 * 2. Purga manual_tema_X si ya existe un manual_UUID para el tema.
 * 3. Normaliza decimales a un máximo de 3 dígitos de precisión.
 */
export const sanitizeNotasPayload = (notas = {}) => {
  if (!notas || typeof notas !== "object") return {};
  const cleaned = {};

  for (const [rawKey, val] of Object.entries(notas)) {
    if (val === undefined || val === null || val === "") continue;

    let key = rawKey.trim();

    // 1. Estandarizar examencito_X a prueba_X
    if (key.startsWith("examencito_")) {
      const semNum = key.replace("examencito_", "");
      key = `prueba_${semNum}`;
      if (notas[key] !== undefined && notas[key] !== null && notas[key] !== "") continue;
    }

    const numVal = Number(val);
    if (!isNaN(numVal)) {
      cleaned[key] = Math.round(numVal * 1000) / 1000;
    } else {
      cleaned[key] = val;
    }
  }

  // 2. Si existe un manual por ID UUID, eliminar manual_tema_X posicional para evitar inconsistencias
  const hasUuidManual = Object.keys(cleaned).some(
    (k) => k.startsWith("manual_") && !k.startsWith("manual_tema_")
  );
  if (hasUuidManual) {
    for (const k of Object.keys(cleaned)) {
      if (k.startsWith("manual_tema_")) {
        delete cleaned[k];
      }
    }
  }

  return cleaned;
};

/**
 * Normaliza cualquier string de carrera al nombre oficial de su tabla en Supabase
 * Remueve tildes y caracteres especiales para evitar errores tipográficos
 */
export const normalizeCarreraToTable = (carrera) => {
  const c = String(carrera || "")
    .toLowerCase()
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  if (c.includes("enferm")) return "estudiantes_enfermeria";
  if (c.includes("odont")) return "estudiantes_odontologia";
  if (c.includes("microb")) return "estudiantes_microbiologia";
  if (c.includes("nutri")) return "estudiantes_nutricion";
  return "estudiantes_medicina";
};

/**
 * Obtiene la tabla correspondiente a partir del ID de la sección
 */
const getTableForSeccion = async (seccion_id, hintCarrera = null) => {
  if (hintCarrera) {
    return normalizeCarreraToTable(hintCarrera);
  }

  if (isSupabaseConfigured && supabase) {
    try {
      const { data: sec } = await supabase
        .from("secciones")
        .select("carrera")
        .eq("id", seccion_id)
        .maybeSingle();

      if (sec?.carrera) {
        return normalizeCarreraToTable(sec.carrera);
      }
    } catch (e) {
      console.warn("Aviso al consultar carrera de sección:", e.message);
    }
  }

  const localSection = getLocalSchedulingSections().find(section => String(section.id) === String(seccion_id));
  return normalizeCarreraToTable(localSection?.carrera);
};

// 1. Obtener todos los estudiantes de una sección (consultando la tabla de su carrera)
export const getEstudiantesBySeccion = async (req, res) => {
  try {
    const { seccion_id } = req.params;
    const { carrera } = req.query;

    const tableName = await getTableForSeccion(seccion_id, carrera);

    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase
        .from(tableName)
        .select("*")
        .eq("seccion_id", seccion_id)
        .order("nombre_completo", { ascending: true });

      if (!error && data) {
        return res.json({
          success: true,
          table: tableName,
          count: data.length,
          data: data.map(publicStudent)
        });
      } else if (error) {
        return res.status(503).json({ success: false, message: "No pudimos consultar las notas de la sección. Intenta nuevamente." });
      }
    }

    const memoryList = inMemoryEstudiantes[tableName] || [];
    const filtered = memoryList.filter((e) => e.seccion_id === seccion_id);
    return res.json({
      success: true,
      table: tableName,
      count: filtered.length,
      data: filtered.map(publicStudent)
    });
  } catch (error) {
    console.error("Error al obtener estudiantes de la sección:", error);
    res.status(500).json({
      success: false,
      message: "Error al obtener la lista de estudiantes",
      error: error.message
    });
  }
};

// 2. Registrar un nuevo estudiante en una sección
export const createEstudiante = async (req, res) => {
  try {
    const { seccion_id, numero_cuenta, nombre_completo, correo, carrera, notas, asistencias, total } = req.body;

    if (!seccion_id || !numero_cuenta || !nombre_completo) {
      return res.status(400).json({
        success: false,
        message: "El número de cuenta, nombre completo y la sección son requeridos."
      });
    }

    const cleanCuenta = String(numero_cuenta).trim();
    const cleanNombre = String(nombre_completo).trim();
    const cleanEmail=normalizeAccountEmail(correo);
    if(!validAccountEmail(cleanEmail))return res.status(400).json({success:false,message:"Registra el correo personal del estudiante para que pueda activar su cuenta."});
    const tableName = await getTableForSeccion(seccion_id, carrera);
    await assertStudentAccountAvailable(cleanCuenta, null, inMemoryEstudiantes);

    // La validación global incluye esta sección y todas las carreras.
    if (isSupabaseConfigured && supabase) {
      const newRecord = {
        seccion_id,
        numero_cuenta: cleanCuenta,
        nombre_completo: cleanNombre,
        correo: cleanEmail,
        activation_required: true,
        notas: typeof notas === "object" && notas !== null ? notas : {},
        asistencias: typeof asistencias === "object" && asistencias !== null ? asistencias : {},
        total: Number(total) || 0.00,
        activo: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      const { data, error } = await withGradeActor(supabase.from(tableName).insert(newRecord), req.instructor)
        .select()
        .single();

      if (!error && data) {
        if (!inMemoryEstudiantes[tableName]) inMemoryEstudiantes[tableName] = [];
        inMemoryEstudiantes[tableName] = inMemoryEstudiantes[tableName].filter(
          (e) => !(e.seccion_id === seccion_id && e.numero_cuenta === cleanCuenta)
        );
        inMemoryEstudiantes[tableName].push(data);
        savePersistentEstudiantes(inMemoryEstudiantes);

        return res.status(201).json({
          success: true,
          message: "Estudiante matriculado exitosamente en la sección.",
          table: tableName,
          data: publicStudent(data)
        });
      } else if (error) {
        return res.status(error.code === "23505" ? 409 : 503).json({ success: false, message: error.code === "23505" ? conflictMessage(error) : "No pudimos guardar la matrícula. Intenta nuevamente." });
      }
      return res.status(503).json({ success: false, message: "No pudimos confirmar la matrícula. Intenta nuevamente." });
    }

    // Memoria de respaldo
    if (!inMemoryEstudiantes[tableName]) {
      inMemoryEstudiantes[tableName] = [];
    }

    const existsInMemory = inMemoryEstudiantes[tableName].find(
      (e) => e.seccion_id === seccion_id && e.numero_cuenta === cleanCuenta
    );

    if (existsInMemory) {
      return res.status(400).json({
        success: false,
        message: `El estudiante con número de cuenta ${cleanCuenta} ya existe en esta sección.`
      });
    }

    const newInMemory = {
      seccion_id,
      numero_cuenta: cleanCuenta,
      nombre_completo: cleanNombre,
      correo: cleanEmail,
      activation_required: true,
      notas: typeof notas === "object" && notas !== null ? notas : {},
      asistencias: typeof asistencias === "object" && asistencias !== null ? asistencias : {},
      total: Number(total) || 0.00,
      activo: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    assertLocalStudentAccountAvailable(cleanCuenta, null, inMemoryEstudiantes);
    saveLocalGradeRows(tableName, [...inMemoryEstudiantes[tableName], newInMemory], req.instructor);

    return res.status(201).json({
      success: true,
      message: "Estudiante matriculado exitosamente (memoria).",
      table: tableName,
      data: publicStudent(newInMemory)
    });
  } catch (error) {
    console.error("Error al matricular estudiante:", error);
    res.status(error.status || 500).json({
      success: false,
      message: error.status ? error.message : "Error al registrar el estudiante"
    });
  }
};

// 3. Editar datos o calificaciones/asistencias de un estudiante
export const updateEstudiante = async (req, res) => {
  try {
    const { seccion_id, numero_cuenta } = req.params;
    const {
      nombre_completo,
      nuevo_numero_cuenta,
      correo,
      carrera,
      notas,
      asistencias,
      total,
      primer_examen,
      segundo_examen,
      tercer_examen
    } = req.body;

    if (req.body.contrasena !== undefined && req.body.contrasena !== "") return res.status(400).json({success:false,message:"La contraseña debe establecerla el estudiante desde la activación o Mi cuenta."});

    const tableName = await getTableForSeccion(seccion_id, carrera);

    // Sanitizar canónicamente el objeto notas
    const sanitizedNotas = notas ? sanitizeNotasPayload(notas) : undefined;
    await assertAttendanceGrades(seccion_id, numero_cuenta, carrera, sanitizedNotas, asistencias);

    // Validación de reglas académicas de calificaciones:
    // Manuales: máximo 1.000 punto | Pruebas: máximo 5.000 puntos
    if (sanitizedNotas && typeof sanitizedNotas === "object") {
      for (const [k, v] of Object.entries(sanitizedNotas)) {
        const numVal = Number(v);
        if (!isNaN(numVal)) {
          if ((k.startsWith("manual_") || k.startsWith("Manual de ")) && (numVal > 1 || numVal < 0)) {
            return res.status(400).json({
              success: false,
              message: `Error académico: La nota de manual no puede ser mayor a 1 punto (máximo 1.000). Se recibió ${numVal} para ${k}.`
            });
          }
          if (((k.startsWith("prueba_") && !k.endsWith("_real")) || k.startsWith("Prueba de ")) && (numVal > 5 || numVal < 0)) {
            return res.status(400).json({
              success: false,
              message: `Error académico: La nota de prueba no puede ser mayor a 5 puntos (máximo 5.000). Se recibió ${numVal} para ${k}.`
            });
          }
        }
      }
    }

    const updates = {
      updated_at: new Date().toISOString()
    };

    if (nombre_completo !== undefined) updates.nombre_completo = String(nombre_completo).trim();
    if (nuevo_numero_cuenta !== undefined) updates.numero_cuenta = String(nuevo_numero_cuenta).trim();
    if (nuevo_numero_cuenta !== undefined) {
      await assertStudentAccountAvailable(updates.numero_cuenta, { table: tableName, sectionId: seccion_id, account: numero_cuenta }, inMemoryEstudiantes);
    }
    if (correo !== undefined) {
      updates.correo=normalizeAccountEmail(correo);
      if(!validAccountEmail(updates.correo))return res.status(400).json({success:false,message:"Ingresa un correo válido del estudiante."});
    }
    if (sanitizedNotas !== undefined) updates.notas = sanitizedNotas;
    if (asistencias !== undefined) updates.asistencias = asistencias;
    if (total !== undefined) updates.total = Math.round((Number(total) || 0) * 1000) / 1000;
    if (primer_examen !== undefined) {
      const ex1 = Number(primer_examen);
      if (!isNaN(ex1) && (ex1 > 20 || ex1 < 0)) {
        return res.status(400).json({
          success: false,
          message: `Error académico: La nota del primer examen (${ex1}) excede el límite permitido (máx. 20 puntos).`
        });
      }
      updates.primer_examen = Math.round(ex1 * 1000) / 1000;
    }
    if (segundo_examen !== undefined) {
      const ex2 = Number(segundo_examen);
      if (!isNaN(ex2) && (ex2 > 20 || ex2 < 0)) {
        return res.status(400).json({
          success: false,
          message: `Error académico: La nota del segundo examen (${ex2}) excede el límite permitido (máx. 20 puntos).`
        });
      }
      updates.segundo_examen = Math.round(ex2 * 1000) / 1000;
    }
    if (tercer_examen !== undefined) {
      const ex3 = Number(tercer_examen);
      if (!isNaN(ex3) && (ex3 > 20 || ex3 < 0)) {
        return res.status(400).json({
          success: false,
          message: `Error académico: La nota del tercer examen (${ex3}) excede el límite permitido (máx. 20 puntos).`
        });
      }
      updates.tercer_examen = Math.round(ex3 * 1000) / 1000;
    }

    if (isSupabaseConfigured && supabase) {
      const { data, error } = await withGradeActor(supabase.from(tableName).update(updates), req.instructor)
        .eq("seccion_id", seccion_id)
        .eq("numero_cuenta", numero_cuenta)
        .select()
        .single();

      if (!error && data) {
        if (!inMemoryEstudiantes[tableName]) inMemoryEstudiantes[tableName] = [];
        const uIdx = inMemoryEstudiantes[tableName].findIndex(
          (e) => e.seccion_id === seccion_id && e.numero_cuenta === numero_cuenta
        );
        if (uIdx !== -1) inMemoryEstudiantes[tableName][uIdx] = { ...inMemoryEstudiantes[tableName][uIdx], ...data };
        else inMemoryEstudiantes[tableName].push(data);
        savePersistentEstudiantes(inMemoryEstudiantes);

        return res.json({
          success: true,
          message: "Datos del estudiante actualizados correctamente.",
          table: tableName,
          data: publicStudent(data)
        });
      } else if (error) {
        return res.status(error.code === "23505" ? 409 : 503).json({ success: false, message: error.code === "23505" ? conflictMessage(error) : "No pudimos actualizar la matrícula. Intenta nuevamente." });
      }
      return res.status(503).json({ success: false, message: "No pudimos confirmar la actualización. Intenta nuevamente." });
    }

    if (!inMemoryEstudiantes[tableName]) {
      inMemoryEstudiantes[tableName] = [];
    }

    const idx = inMemoryEstudiantes[tableName].findIndex(
      (e) => e.seccion_id === seccion_id && e.numero_cuenta === numero_cuenta
    );

    if (idx !== -1) {
      if (updates.numero_cuenta !== undefined) assertLocalStudentAccountAvailable(updates.numero_cuenta, { table: tableName, sectionId: seccion_id, account: numero_cuenta }, inMemoryEstudiantes);
      const nextRows = inMemoryEstudiantes[tableName].slice();
      nextRows[idx] = { ...nextRows[idx], ...updates };
      saveLocalGradeRows(tableName, nextRows, req.instructor);
      return res.json({
        success: true,
        message: "Estudiante actualizado exitosamente (memoria).",
        table: tableName,
        data: publicStudent(inMemoryEstudiantes[tableName][idx])
      });
    }

    return res.status(404).json({
      success: false,
      message: "Estudiante no encontrado en la sección."
    });
  } catch (error) {
    console.error("Error al actualizar estudiante:", error);
    res.status(error.status || 500).json({
      success: false,
      message: error.status ? error.message : "Error al actualizar los datos del estudiante"
    });
  }
};

// 4. Actualización en lote (Batch Update) de notas y asistencias para toda la sección
export const updateBatchGrades = async (req, res) => {
  try {
    const { seccion_id } = req.params;
    const { updates = [], carrera } = req.body;

    if (!Array.isArray(updates) || updates.length === 0) {
      return res.status(400).json({
        success: false,
        message: "No se proporcionaron actualizaciones de estudiantes."
      });
    }

    // Sanitización canónica y validación de reglas académicas para todos los registros del lote:
    // Manuales: máximo 1.000 punto | Pruebas: máximo 5.000 puntos
    for (const item of updates) {
      if (item.notas && typeof item.notas === "object") {
        item.notas = sanitizeNotasPayload(item.notas);
        for (const [k, v] of Object.entries(item.notas)) {
          const numVal = Number(v);
          if (/^(manual_|Manual de |prueba_|Prueba de |examen_|primer_examen$|segundo_examen$|tercer_examen$)/.test(k) && !Number.isFinite(numVal)) {
            return res.status(400).json({success:false,message:"Las calificaciones deben ser números válidos."});
          }
          if (!isNaN(numVal)) {
            if ((k.startsWith("manual_") || k.startsWith("Manual de ")) && (numVal > 1 || numVal < 0)) {
              return res.status(400).json({
                success: false,
                message: `Error académico: La nota de manual no puede ser mayor a 1 punto (máximo 1.000). Se recibió ${numVal} para ${k} en la cuenta ${item.numero_cuenta || 'estudiante'}.`
              });
            }
            if (((k.startsWith("prueba_") && !k.endsWith("_real")) || k.startsWith("Prueba de ")) && (numVal > 5 || numVal < 0)) {
              return res.status(400).json({
                success: false,
                message: `Error académico: La nota de prueba no puede ser mayor a 5 puntos (máximo 5.000). Se recibió ${numVal} para ${k} en la cuenta ${item.numero_cuenta || 'estudiante'}.`
              });
            }
          }
        }
      }

      if (item.total !== undefined) {
        if (!Number.isFinite(Number(item.total))) return res.status(400).json({success:false,message:"El total debe ser un número válido."});
        item.total = Math.round((Number(item.total) || 0) * 1000) / 1000;
      }
      if (item.primer_examen !== undefined) {
        const ex1 = Number(item.primer_examen);
        if (!Number.isFinite(ex1) || ex1 > 20 || ex1 < 0) {
          return res.status(400).json({
            success: false,
            message: `Error académico: La nota del primer examen (${ex1}) en la cuenta ${item.numero_cuenta || 'estudiante'} excede el límite permitido (máx. 20 puntos).`
          });
        }
        item.primer_examen = Math.round(ex1 * 1000) / 1000;
      }
      if (item.segundo_examen !== undefined) {
        const ex2 = Number(item.segundo_examen);
        if (!Number.isFinite(ex2) || ex2 > 20 || ex2 < 0) {
          return res.status(400).json({
            success: false,
            message: `Error académico: La nota del segundo examen (${ex2}) en la cuenta ${item.numero_cuenta || 'estudiante'} excede el límite permitido (máx. 20 puntos).`
          });
        }
        item.segundo_examen = Math.round(ex2 * 1000) / 1000;
      }
      if (item.tercer_examen !== undefined) {
        const ex3 = Number(item.tercer_examen);
        if (!Number.isFinite(ex3) || ex3 > 20 || ex3 < 0) {
          return res.status(400).json({
            success: false,
            message: `Error académico: La nota del tercer examen (${ex3}) en la cuenta ${item.numero_cuenta || 'estudiante'} excede el límite permitido (máx. 20 puntos).`
          });
        }
        item.tercer_examen = Math.round(ex3 * 1000) / 1000;
      }
    }

    const tableName = await getTableForSeccion(seccion_id, carrera);

    const accounts = updates.map(item => String(item.numero_cuenta ?? "").trim());
    for (const item of updates) await assertAttendanceGrades(seccion_id, item.numero_cuenta, carrera, item.notas, item.asistencias);
    if (accounts.some(account => !account) || new Set(accounts).size !== accounts.length) {
      return res.status(400).json({success:false,message:"Cada actualización debe identificar una cuenta distinta."});
    }
    const gradePayload = item => {
      const payload = { updated_at: new Date().toISOString() };
      for (const key of ["notas","asistencias","total","primer_examen","segundo_examen","tercer_examen"]) {
        if (item[key] !== undefined) payload[key] = item[key];
      }
      return payload;
    };
    let rows;
    if (isSupabaseConfigured && supabase) {
      const loaded = await supabase.from(tableName).select("id,numero_cuenta,updated_at")
        .eq("seccion_id", seccion_id).in("numero_cuenta", accounts);
      if (loaded.error) return res.status(503).json({success:false,message:"No pudimos verificar las matrículas antes de guardar."});
      rows = loaded.data || [];
    } else {
      rows = (inMemoryEstudiantes[tableName] || []).filter(row => String(row.seccion_id) === String(seccion_id) && accounts.includes(String(row.numero_cuenta)));
    }
    if (rows.length !== accounts.length || accounts.some(account => rows.filter(row => String(row.numero_cuenta) === account).length !== 1)) {
      return res.status(409).json({success:false,message:"La matrícula cambió. Actualiza la lista de estudiantes antes de guardar."});
    }
    for (let index = 0; index < updates.length; index++) {
      const item = updates[index], row = rows.find(row => String(row.numero_cuenta) === accounts[index]);
      if ((item.id && String(item.id) !== String(row.id)) ||
          (item.expected_updated_at !== undefined && item.expected_updated_at !== row.updated_at)) {
        return res.status(409).json({success:false,message:"Las notas o la matrícula cambiaron en otra sesión. Actualiza la lista antes de guardar."});
      }
    }
    if (isSupabaseConfigured && supabase) {
      const results = await Promise.all(updates.map((item,index) => {
        const row = rows.find(row => String(row.numero_cuenta) === accounts[index]);
        let query = withGradeActor(supabase.from(tableName).update(gradePayload(item)), req.instructor)
          .eq("seccion_id",seccion_id).eq("numero_cuenta",accounts[index]).eq("id",row.id);
        if (item.expected_updated_at !== undefined) query = item.expected_updated_at === null ? query.is("updated_at",null) : query.eq("updated_at",item.expected_updated_at);
        return query.select("id,numero_cuenta,updated_at");
      }));
      const updatedCount = results.filter(result => !result.error && result.data?.length === 1).length;
      if (updatedCount !== updates.length) {
        return res.status(results.some(result => result.error) ? 503 : 409).json({success:false,updatedCount,
          message:"No se confirmó el guardado completo. Actualiza la lista para comprobar las notas antes de reintentar."});
      }
      return res.json({success:true,table:tableName,updatedCount,
        data:results.map(result => {const row=result.data[0];return {id:row.id,numero_cuenta:row.numero_cuenta,updated_at:row.updated_at};}),
        message:"Calificaciones y asistencias guardadas correctamente."});
    }
    const nextRows = (inMemoryEstudiantes[tableName] || []).map(row => {
      if (String(row.seccion_id) !== String(seccion_id)) return row;
      const index=accounts.indexOf(String(row.numero_cuenta));
      return index < 0 ? row : {...row,...gradePayload(updates[index])};
    });
    saveLocalGradeRows(tableName, nextRows, req.instructor);
    return res.json({success:true,table:tableName,updatedCount:updates.length,
      data:nextRows.filter(row => String(row.seccion_id) === String(seccion_id) && accounts.includes(String(row.numero_cuenta))).map(row => ({id:row.id,numero_cuenta:row.numero_cuenta,updated_at:row.updated_at})),
      message:"Calificaciones guardadas correctamente."});
  } catch (error) {
    console.error("Error al actualizar notas por lote:", error);
    res.status(error.status || 500).json({
      success: false,
      message: error.status ? error.message : "Error al sincronizar calificaciones y asistencias.",
      error: error.message
    });
  }
};

// 5. Borrar un estudiante de una sección
export const deleteEstudiante = async (req, res) => {
  try {
    const { seccion_id, numero_cuenta } = req.params;
    const tableName = await getTableForSeccion(seccion_id, req.query?.carrera);
    await deleteStudentAccount(tableName, seccion_id, numero_cuenta);
    if (inMemoryEstudiantes[tableName]) {
      inMemoryEstudiantes[tableName] = inMemoryEstudiantes[tableName].filter(e => !(e.seccion_id === seccion_id && e.numero_cuenta === numero_cuenta));
      savePersistentEstudiantes(inMemoryEstudiantes);
    }
    return res.json({success:true,table:tableName,message:"Estudiante, cuenta de acceso y datos asociados eliminados correctamente."});
  } catch (error) {
    return res.status(error.status || 503).json({success:false,message:error.status ? error.message : "No pudimos confirmar la eliminación completa del estudiante. Intenta nuevamente."});
  }
};

// 6. Obtener un estudiante específico por carrera y número de cuenta
export const getEstudianteByCuenta = async (req, res) => {
  try {
    const { carrera, numero_cuenta } = req.params;
    const tableName = normalizeCarreraToTable(carrera);
    const cleanCuenta = String(numero_cuenta).trim();
    const sectionId = req.student?.seccion_id || req.query?.seccion_id;
    if(req.student&&(String(req.student.numero_cuenta)!==cleanCuenta||normalizeCarreraToTable(req.student.carrera)!==tableName||(req.query?.seccion_id&&String(req.query.seccion_id)!==String(req.student.seccion_id))))return res.status(403).json({success:false,message:"Solo puedes consultar tu matrícula actual."});

    if (isSupabaseConfigured && supabase) {
      let query = supabase
        .from(tableName)
        .select("*")
        .eq("numero_cuenta", cleanCuenta)
        .eq("activo", true);
      if (sectionId) query = query.eq("seccion_id", sectionId);
      if(req.student?.id)query=query.eq("id",req.student.id);
      const { data, error } = await query.maybeSingle();
      if (error) return res.status(503).json({ success: false, message: "No pudimos consultar tu matrícula. Intenta nuevamente." });

      if (!error && data) {
        let seccionData = null;
        if (data.seccion_id) {
          const { data: sec } = await supabase
            .from("secciones")
            .select("*")
            .eq("id", data.seccion_id)
            .maybeSingle();
          seccionData = sec;
        }

        return res.json({
          success: true,
          data: {
            ...publicStudent(data),
            carrera: carrera,
            seccion: seccionData,
            notas: data.notas || {},
            asistencias: data.asistencias || {}
          }
        });
      }
      return res.status(404).json({success:false,message:"No se encontró tu matrícula actual."});
    }

    const memoryList = inMemoryEstudiantes[tableName] || [];
    const found = memoryList.find((e) => String(e.numero_cuenta).trim() === cleanCuenta && (!sectionId || String(e.seccion_id) === String(sectionId)) && (!req.student?.id || String(e.id) === String(req.student.id)));
    if (found) {
      return res.json({ success: true, data: { ...publicStudent(found), carrera } });
    }

    return res.status(404).json({
      success: false,
      message: `Estudiante con cuenta ${cleanCuenta} no encontrado en ${carrera}.`
    });
  } catch (error) {
    console.error("Error al obtener estudiante por cuenta:", error);
    res.status(500).json({
      success: false,
      message: "Error al consultar información del estudiante",
      error: error.message
    });
  }
};

// 7. Helper directo para actualizar una nota específica de un estudiante (usado por módulo de pruebas)
export const updateEstudianteGradeDirect = async (seccion_id, numero_cuenta, carrera, key, value, strict = false, instructor = null, delivery = null) => {
  const tableName = await getTableForSeccion(seccion_id, carrera);

  if (!inMemoryEstudiantes[tableName]) {
    inMemoryEstudiantes[tableName] = [];
  }

  const idx = inMemoryEstudiantes[tableName].findIndex(
    (e) => String(e.seccion_id) === String(seccion_id) && String(e.numero_cuenta) === String(numero_cuenta)
  );

  let currentEst = idx !== -1 ? inMemoryEstudiantes[tableName][idx] : null;

  if (isSupabaseConfigured && supabase) {
    try {
      const { data, error } = await supabase
        .from(tableName)
        .select("*")
        .eq("seccion_id", seccion_id)
        .eq("numero_cuenta", numero_cuenta)
        .maybeSingle();
      if (error) throw error;
      if (data) currentEst = data;
      else currentEst = null;
    } catch (err) {
      throw err;
    }
  }

  if (!currentEst) { if (strict) throw new Error("No se encontró el estudiante para sincronizar la nota."); return false; }
  if (Number(value) > 0) await assertAttendanceGrades(seccion_id, numero_cuenta, carrera, { [key]: value });

  const currentNotas = { ...(currentEst.notas || {}) };
  if (currentNotas[key] === value) return true;
  if (value === null && /^prueba_\d+$/.test(key)) {
    const week = key.slice("prueba_".length);
    delete currentNotas[`examencito_${week}`];
    delete currentNotas[`Prueba de la semana ${week}`];
    delete currentNotas[`${key}_real`];
  }
  currentNotas[key] = value;
  const sanitized = sanitizeNotasPayload(currentNotas);

  const payload = {
    notas: sanitized,
    updated_at: new Date().toISOString()
  };

  if (isSupabaseConfigured && supabase && delivery) {
    const { data, error } = await withGradeActor(supabase.rpc("sync_quiz_student_grade", {
      p_delivery: delivery.id,
      p_version: delivery.updated_at ?? null,
      p_section: seccion_id,
      p_account: numero_cuenta,
      p_table: tableName,
      p_previous: currentEst.notas ?? null,
      p_grades: sanitized
    }), instructor);
    if (error) throw error;
    if (data !== true) throw new Error("La entrega o la nota cambió durante la sincronización. Vuelve a cargar la revisión.");
    return true;
  }

  if (isSupabaseConfigured && supabase) {
    try {
      let query = withGradeActor(supabase.from(tableName).update(payload), instructor)
        .eq("seccion_id", seccion_id)
        .eq("numero_cuenta", numero_cuenta);
      if (currentEst.id) query = query.eq("id",currentEst.id);
      query = currentEst.notas == null ? query.is("notas",null) : query.eq("notas",JSON.stringify(currentEst.notas));
      const result = await query.select("numero_cuenta");
      if (result.error) throw result.error;
      if (result.data?.length !== 1) throw new Error("Las notas cambiaron durante la sincronización. Vuelve a guardar la calificación.");
    } catch (err) {
      throw err;
    }
  }

  if (idx !== -1) {
    const nextRows = inMemoryEstudiantes[tableName].slice();
    nextRows[idx] = { ...nextRows[idx], ...payload };
    if (isSupabaseConfigured && supabase) {
      inMemoryEstudiantes[tableName] = nextRows;
      savePersistentEstudiantes(inMemoryEstudiantes, strict);
    } else {
      saveLocalGradeRows(tableName, nextRows, instructor);
    }
  }

  return true;
};



// Guardado de la lista semanal con horario y asignaciones verificados en el servidor.
export const saveWeeklyAttendance = async (req, res) => {
  try {
    const { seccion_id, semana } = req.params;
    const weekNumber = Number(semana);
    const { updates } = req.body || {};
    const states = new Set([null, "Asistio", "Falta injustificada", "Falta justificada"]);
    if (!Number.isInteger(weekNumber) || weekNumber < 1 || !Array.isArray(updates) || !updates.length ||
      updates.some(item => !item || !item.numero_cuenta || !states.has(item.estado)) ||
      new Set(updates.map(item => String(item.numero_cuenta))).size !== updates.length) {
      return res.status(400).json({ message: "Envía una semana y estados de asistencia válidos." });
    }

    let section, weeks, assignments;
    if (isSupabaseConfigured && supabase) {
      const sectionResult = await supabase.from("secciones").select("*").eq("id", seccion_id).maybeSingle();
      if (sectionResult.error) throw sectionResult.error;
      section = sectionResult.data;
      if (section) {
        const [weekResult, assignmentResult] = await Promise.all([
          supabase.from("configuracion_semanas").select("*"),
          supabase.from("asignaciones_instructores").select("*").eq("seccion_id", seccion_id)
        ]);
        if (weekResult.error) throw weekResult.error;
        if (assignmentResult.error) throw assignmentResult.error;
        weeks = weekResult.data.filter(week => normalizeSectionCareer(week.carrera) === normalizeSectionCareer(section.carrera));
        assignments = assignmentResult.data;
      }
    } else {
      section = getLocalSchedulingSections().find(item => item.id === seccion_id);
      weeks = getLocalSchedulingWeeks(section?.carrera);
      assignments = getLocalSectionAssignments(seccion_id);
    }
    if (!section) return res.status(404).json({ message: "Sección no encontrada." });

    const user = req.instructor;
    const fullAccess = hasAdministrationAccess(user?.rol) || isInstructorTitular(user, section);
    const assigned = assignments.find(item => item.tipo_asignacion === "Pasar lista de asistencia semanal" &&
      item.referencia_id === `semana_${weekNumber}`);
    if (!fullAccess && (!isSectionAssignedToInstructor(user, section) || !assigned?.instructor_id ||
      !matchesInstructor(user, assigned.instructor_id, assigned.instructor_nombre, section))) {
      return res.status(403).json({ message: "No tienes asignada la asistencia de esta semana." });
    }
    const attendanceEvents = await getSectionAttendanceEvents(section);
    const window = getAttendanceWindow(section, weeks, weekNumber, new Date(), attendanceEvents);
    if (!window.isOpen) return res.status(403).json({ message: window.reason });

    const tableName = normalizeCarreraToTable(section.carrera);
    const accounts = updates.map(item => String(item.numero_cuenta));
    let rows = inMemoryEstudiantes[tableName] || [];
    if (isSupabaseConfigured && supabase) {
      const result = await supabase.from(tableName).select("numero_cuenta,asistencias,notas")
        .eq("seccion_id", seccion_id).in("numero_cuenta", accounts);
      if (result.error) throw result.error;
      rows = result.data;
    } else {
      rows = rows.filter(row => row.seccion_id === seccion_id && accounts.includes(String(row.numero_cuenta)));
    }
    if (rows.length !== updates.length) return res.status(404).json({ message: "Algún estudiante ya no pertenece a esta sección. Actualiza la lista." });

    const attendanceKeys = getAttendanceKeys(weeks.find(week => Number(week.numero_semana) === weekNumber));
    const changes = rows.map(row => {
      const value = updates.find(item => String(item.numero_cuenta) === String(row.numero_cuenta)).estado;
      return { row, asistencias: { ...(row.asistencias || {}), ...Object.fromEntries(attendanceKeys.map(key => [key, value])) } };
    });
    // La clave corresponde al contenido de esta práctica, nunca a la semana de rendición.
    const regularWeek = !window.isExam;
    const absenceNotes = change => regularWeek && practiceAbsent(change, weekNumber)
      ? { notas: sanitizeNotasPayload({ ...(change.row.notas || {}), [`prueba_${weekNumber}`]: 0, [`prueba_${weekNumber}_real`]: 0 }) } : {};
    if (isSupabaseConfigured && supabase) {
      for (const { row, asistencias } of changes) {
        if (!getAttendanceWindow(section, weeks, weekNumber, new Date(), attendanceEvents).isOpen) {
          return res.status(403).json({ message: "El horario para pasar lista terminó durante el guardado. Actualiza la lista para comprobar los registros." });
        }
        let query = withGradeActor(supabase.from(tableName).update({ asistencias, ...absenceNotes({row, asistencias}), updated_at: new Date().toISOString() }), req.instructor)
          .eq("seccion_id", seccion_id).eq("numero_cuenta", row.numero_cuenta);
        query = row.asistencias === null ? query.is("asistencias", null) : query.eq("asistencias", JSON.stringify(row.asistencias));
        if (regularWeek && practiceAbsent({asistencias}, weekNumber)) query = row.notas == null ? query.is("notas", null) : query.eq("notas", JSON.stringify(row.notas));
        const result = await query.select("numero_cuenta");
        if (result.error) throw result.error;
        if (!result.data?.length) {
          return res.status(409).json({ message: "La asistencia cambió en otra sesión. Actualiza la lista antes de guardar de nuevo." });
        }
      }
    } else {
      const nextRows = (inMemoryEstudiantes[tableName] || []).map(row => {
        const change = row.seccion_id === seccion_id && changes.find(item => item.row === row);
        return change ? { ...row, asistencias: change.asistencias, ...absenceNotes(change), updated_at: new Date().toISOString() } : row;
      });
      savePersistentEstudiantes({ ...inMemoryEstudiantes, [tableName]: nextRows }, true);
      inMemoryEstudiantes[tableName] = nextRows;
    }
    return res.json({ success: true, updatedCount: changes.length });
  } catch (error) {
    console.error("Error al guardar asistencia semanal:", error.message);
    return res.status(500).json({ message: "No pudimos completar el guardado. Actualiza la lista antes de reintentar." });
  }
};

export const saveWeeklyManuals = async (req, res) => {
  try {
    const { seccion_id, semana } = req.params;
    const number = Number(semana);
    const updates = req.body?.updates;
    if (!Number.isInteger(number) || number < 1 || !Array.isArray(updates) || !updates.length ||
      updates.some(item => !item?.numero_cuenta || !Array.isArray(item.manuales) || !item.manuales.length ||
        item.manuales.some(manual => !manual?.tema_id || (manual.nota !== null &&
          (typeof manual.nota !== "number" || !Number.isFinite(manual.nota) || manual.nota < 0 || manual.nota > 1)))) ||
      new Set(updates.map(item => String(item.numero_cuenta))).size !== updates.length) {
      return res.status(400).json({ message: "Envía notas de manuales entre 0 y 1 punto." });
    }
    const schedule = await getManualSchedule(seccion_id);
    if (!schedule || !canViewSection(req.instructor, schedule.section)) {
      return res.status(403).json({ message: "Solo el equipo docente de esta sección puede registrar manuales." });
    }
    const window = getManualsWindow(schedule.section, schedule.weeks, number, new Date(), schedule.events, schedule.deadlines);
    if (!window.isOpen) return res.status(403).json({ message: window.reason });
    let { topics, scores } = getLocalAcademicSettings(schedule.section.carrera);
    const tableName = normalizeCarreraToTable(schedule.section.carrera);
    const accounts = updates.map(item => String(item.numero_cuenta));
    let rows = (inMemoryEstudiantes[tableName] || []).filter(row =>
      row.seccion_id === seccion_id && accounts.includes(String(row.numero_cuenta)));
    if (isSupabaseConfigured && supabase) {
      const results = await Promise.all([
        supabase.from("temario").select("*"),
        supabase.from("configuracion_puntajes").select("*"),
        supabase.from(tableName).select("*").eq("seccion_id", seccion_id).in("numero_cuenta", accounts)
      ]);
      const failure = results.find(result => result.error);
      if (failure) throw failure.error;
      const career = normalizeSectionCareer(schedule.section.carrera);
      topics = results[0].data.filter(topic => normalizeSectionCareer(topic.carrera) === career);
      scores = results[1].data.find(score => normalizeSectionCareer(score.carrera) === career) || {};
      rows = results[2].data;
    }
    const allowed = topics.filter(topic => Number(topic.semana) === number && topic.tiene_manual !== false);
    for (const update of updates) {
      if (update.manuales.some(manual => manual.nota > 0) && await hasPracticeAbsence(seccion_id, update.numero_cuenta, schedule.section.carrera, number)) {
        return res.status(409).json({ message: "No puedes registrar una nota de manual con falta injustificada en esta práctica o su reposición." });
      }
    }
    if (rows.some(row => practiceAbsent(row, number) && updates.find(item => String(item.numero_cuenta) === String(row.numero_cuenta))?.manuales.some(manual => manual.nota > 0))) {
      return res.status(409).json({ message: "No puedes registrar una nota de manual con falta injustificada en esta práctica." });
    }
    if (rows.length !== updates.length) return res.status(404).json({ message: "Actualiza la lista de estudiantes antes de guardar." });
    if (updates.some(item => item.manuales.some(manual => !allowed.some(topic => String(topic.id) === String(manual.tema_id))))) {
      return res.status(400).json({ message: "Algún manual no pertenece a la semana seleccionada." });
    }
    const changes = rows.map(row => {
      const update = updates.find(item => String(item.numero_cuenta) === String(row.numero_cuenta));
      const notas = { ...(row.notas || {}) };
      for (const manual of update.manuales) {
        const topic = allowed.find(item => String(item.id) === String(manual.tema_id));
        delete notas[`manual_tema_${topic.numero_tema}`];
        delete notas[`Manual de ${topic.titulo}`];
        delete notas[topic.id];
        if (manual.nota === null) delete notas[`manual_${topic.id}`];
        else notas[`manual_${topic.id}`] = Math.round(manual.nota * 1000) / 1000;
      }
      const total = calculateStudentAcademicSummary(row, scores, topics, schedule.weeks, notas).total;
      return { row, notas, total };
    });
    if (isSupabaseConfigured && supabase) {
      for (const { row, notas, total } of changes) {
        if (!getManualsWindow(schedule.section, schedule.weeks, number, new Date(), schedule.events, schedule.deadlines).isOpen) {
          return res.status(403).json({ message: "El plazo terminó durante el guardado. Actualiza la lista para comprobar los registros." });
        }
        let query = withGradeActor(supabase.from(tableName).update({ notas, total, updated_at: new Date().toISOString() }), req.instructor)
          .eq("seccion_id", seccion_id).eq("numero_cuenta", row.numero_cuenta);
        query = row.notas === null ? query.is("notas", null) : query.eq("notas", JSON.stringify(row.notas));
        const result = await query.select("numero_cuenta");
        if (result.error) throw result.error;
        if (!result.data?.length) return res.status(409).json({ message: "Las notas cambiaron en otra sesión. Actualiza la lista antes de guardar." });
      }
    } else {
      const nextRows = (inMemoryEstudiantes[tableName] || []).map(row => {
        const change = changes.find(item => item.row === row);
        return change ? { ...row, notas: change.notas, total: change.total, updated_at: new Date().toISOString() } : row;
      });
      saveLocalGradeRows(tableName, nextRows, req.instructor);
    }
    return res.json({ success: true, updatedCount: changes.length });
  } catch (error) {
    console.error("Guardar manuales semanales:", error.message);
    return res.status(500).json({ message: "No pudimos completar el guardado de manuales. Actualiza la lista antes de reintentar." });
  }
};
