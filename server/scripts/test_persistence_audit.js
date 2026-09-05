import dotenv from "dotenv";
dotenv.config();
import jwt from "jsonwebtoken";
import { supabase, isSupabaseConfigured } from "../src/db/supabase.js";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.join(__dirname, "../data");

const BASE_URL = "http://localhost:5000/api";
const JWT_SECRET = process.env.JWT_SECRET || "histolab_default_secret_key_2026";

// Generar un token válido de instructor para probar endpoints protegidos
const mockInstructorToken = jwt.sign(
  {
    id: "b535b7cd-6f27-4879-b842-bd6541ec9c93",
    correo: "admin@histolab.unah.edu.hn",
    rol: "Administrador",
    session_id: "test-audit-session"
  },
  JWT_SECRET,
  { expiresIn: "1h" }
);

async function runAudit() {
  console.log("===============================================================");
  console.log("🚀 INICIANDO AUDITORÍA COMPLETA DE PERSISTENCIA EN HISTOLAB");
  console.log("===============================================================\n");

  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`  ✅ [PASS] ${message}`);
      passed++;
    } else {
      console.error(`  ❌ [FAIL] ${message}`);
      failed++;
    }
  }

  // ---------------------------------------------------------------------------
  // 1. AUDITORÍA: Configuración de Puntajes por Carrera
  // ---------------------------------------------------------------------------
  console.log("📌 1. Comprobando Persistencia de Puntajes por Carrera...");
  const carreras = ["Medicina", "Enfermería", "Odontología", "Microbiología", "Nutrición"];

  for (const c of carreras) {
    const getRes = await fetch(`${BASE_URL}/temario/puntajes/${encodeURIComponent(c)}`);
    const getJson = await getRes.json();
    assert(getJson.success && getJson.data, `GET puntajes de '${c}' responde exitosamente con datos (total: ${getJson.data?.puntaje_total})`);
  }

  // Guardar puntajes personalizados para Enfermería
  const testPuntajeEnf = {
    nota_total_manuales: 8,
    nota_total_pruebas: 12,
    examenes: { "5": 10, "10": 10 },
    puntaje_total: 40
  };

  const saveRes = await fetch(`${BASE_URL}/temario/puntajes/${encodeURIComponent("Enfermería")}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(testPuntajeEnf)
  });
  const saveJson = await saveRes.json();
  assert(saveJson.success, `Guardado de puntajes para Enfermería respondió con éxito: ${saveJson.message}`);

  // Verificar en Supabase directamente
  if (isSupabaseConfigured && supabase) {
    const { data: enfSb } = await supabase
      .from("configuracion_puntajes")
      .select("*")
      .ilike("carrera", "%Enfermeria%")
      .maybeSingle();

    assert(
      enfSb && Number(enfSb.nota_total_manuales) === 8 && Number(enfSb.nota_total_pruebas) === 12,
      `Verificación directa en tabla 'configuracion_puntajes' de Supabase para Enfermeria (manuales: 8, pruebas: 12)`
    );
  }

  // Verificar en archivo de disco local
  const puntajesDiskRaw = fs.readFileSync(path.join(DATA_DIR, "puntajes_data.json"), "utf-8");
  const puntajesDisk = JSON.parse(puntajesDiskRaw);
  assert(
    puntajesDisk["Enfermeria"] && Number(puntajesDisk["Enfermeria"].nota_total_manuales) === 8,
    `Verificación en respaldo persistente local 'puntajes_data.json' para Enfermeria`
  );

  // ---------------------------------------------------------------------------
  // 2. AUDITORÍA: Temario (Creación, Desplazamiento, Edición y Eliminación)
  // ---------------------------------------------------------------------------
  console.log("\n📌 2. Comprobando Persistencia de Temario...");

  // Crear tema de prueba
  const createTemaRes = await fetch(`${BASE_URL}/temario`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      carrera: "Medicina",
      semana: 1,
      numero_tema: 999,
      titulo: "Tema de Prueba de Auditoría 999",
      tiene_manual: true,
      desplazar_siguientes: false
    })
  });
  const createTemaJson = await createTemaRes.json();
  assert(createTemaJson.success && createTemaJson.tema?.id, `Crear tema respondió con éxito (ID: ${createTemaJson.tema?.id})`);

  const createdTemaId = createTemaJson.tema?.id;

  // Verificar en Supabase
  if (createdTemaId && isSupabaseConfigured && supabase) {
    const { data: sbTema } = await supabase.from("temario").select("*").eq("id", createdTemaId).maybeSingle();
    assert(sbTema && sbTema.numero_tema === 999, `Tema de prueba existe en la tabla 'temario' de Supabase`);

    // Actualizar el tema
    const updateTemaRes = await fetch(`${BASE_URL}/temario/${createdTemaId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        titulo: "Tema de Auditoría Actualizado",
        numero_tema: 999
      })
    });
    const updateTemaJson = await updateTemaRes.json();
    assert(updateTemaJson.success, `Actualizar tema respondió con éxito`);

    // Eliminar el tema
    const delTemaRes = await fetch(`${BASE_URL}/temario/${createdTemaId}`, { method: "DELETE" });
    const delTemaJson = await delTemaRes.json();
    assert(delTemaJson.success, `Eliminar tema respondió con éxito`);

    // Verificar eliminación en Supabase
    const { data: deletedSb } = await supabase.from("temario").select("*").eq("id", createdTemaId).maybeSingle();
    assert(!deletedSb, `Tema eliminado ya no existe en Supabase`);
  }

  // ---------------------------------------------------------------------------
  // 3. AUDITORÍA: Configuración de Semanas
  // ---------------------------------------------------------------------------
  console.log("\n📌 3. Comprobando Persistencia de Configuración de Semanas...");

  const getSemanasRes = await fetch(`${BASE_URL}/semanas?carrera=Medicina`);
  const getSemanasJson = await getSemanasRes.json();
  assert(getSemanasJson.success && getSemanasJson.data?.length > 0, `Listar semanas de Medicina respondió con ${getSemanasJson.data?.length} semanas`);

  // Guardar semana individual mediante POST /semanas/week
  const saveWeekRes = await fetch(`${BASE_URL}/semanas/week`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      carrera: "Medicina",
      numero_semana: 98,
      nombre_semana: "Semana Especial 98",
      parcial: "III Parcial",
      es_examen: false,
      tema_ids: []
    })
  });
  const saveWeekJson = await saveWeekRes.json();
  assert(saveWeekJson.success, `Guardar semana individual respondió con éxito: ${saveWeekJson.message}`);

  // Verificar en Supabase
  if (isSupabaseConfigured && supabase) {
    const { data: weekSb } = await supabase
      .from("configuracion_semanas")
      .select("*")
      .eq("carrera", "Medicina")
      .eq("numero_semana", 98)
      .maybeSingle();
    assert(weekSb && weekSb.numero_semana === 98, `Semana 98 verificada en Supabase 'configuracion_semanas'`);

    // Eliminar semana de prueba mediante DELETE /semanas/week/:numero_semana
    const delWeekRes = await fetch(`${BASE_URL}/semanas/week/98?carrera=Medicina`, { method: "DELETE" });
    const delWeekJson = await delWeekRes.json();
    assert(delWeekJson.success, `Eliminar semana respondió con éxito: ${delWeekJson.message}`);
  }

  // ---------------------------------------------------------------------------
  // 4. AUDITORÍA: Estudiantes y Calificaciones en Lote
  // ---------------------------------------------------------------------------
  console.log("\n📌 4. Comprobando Persistencia de Estudiantes y Calificaciones...");

  const seccionMedicinaId = "8441714f-c3c2-45da-96da-287129ac959e";
  const estRes = await fetch(`${BASE_URL}/estudiantes/seccion/${seccionMedicinaId}?carrera=Medicina`);
  const estJson = await estRes.json();
  assert(estJson.success && estJson.data?.length > 0, `Consulta de estudiantes de la sección respondió con ${estJson.data?.length} estudiante(s)`);

  if (estJson.data?.length > 0) {
    const targetStudent = estJson.data[0];

    // Actualización de notas por lote
    const batchRes = await fetch(`${BASE_URL}/estudiantes/batch/${seccionMedicinaId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        carrera: "Medicina",
        updates: [
          {
            numero_cuenta: targetStudent.numero_cuenta,
            notas: { ...targetStudent.notas, prueba_1: 5 },
            asistencias: targetStudent.asistencias || {},
            total: 81
          }
        ]
      })
    });
    const batchJson = await batchRes.json();
    assert(batchJson.success, `Actualización en lote de calificaciones respondió con éxito: ${batchJson.message}`);

    // Verificar en Supabase
    if (isSupabaseConfigured && supabase) {
      const { data: estSb } = await supabase
        .from("estudiantes_medicina")
        .select("total, notas")
        .eq("seccion_id", seccionMedicinaId)
        .eq("numero_cuenta", targetStudent.numero_cuenta)
        .maybeSingle();

      assert(estSb && estSb.notas?.prueba_1 === 5, `Calificación 'prueba_1: 5' verificada en Supabase 'estudiantes_medicina'`);
    }

    // Verificar respaldo en disco
    const estDiskRaw = fs.readFileSync(path.join(DATA_DIR, "estudiantes_data.json"), "utf-8");
    const estDisk = JSON.parse(estDiskRaw);
    const estDiskFound = estDisk["estudiantes_medicina"]?.find(
      (e) => e.numero_cuenta === targetStudent.numero_cuenta
    );
    assert(estDiskFound && estDiskFound.notas?.prueba_1 === 5, `Calificación verificada en respaldo local 'estudiantes_data.json'`);
  }

  // ---------------------------------------------------------------------------
  // 5. AUDITORÍA: Secciones (Endpoint protegido con Token JWT)
  // ---------------------------------------------------------------------------
  console.log("\n📌 5. Comprobando Persistencia de Secciones...");
  const secRes = await fetch(`${BASE_URL}/secciones`, {
    headers: { Authorization: `Bearer ${mockInstructorToken}` }
  });
  const secJson = await secRes.json();
  assert(secJson.success && secJson.data?.length > 0, `Listado de secciones autenticado respondió con ${secJson.data?.length} secciones`);

  // Verificar respaldo de secciones en disco
  const secDiskRaw = fs.readFileSync(path.join(DATA_DIR, "secciones_data.json"), "utf-8");
  const secDisk = JSON.parse(secDiskRaw);
  assert(Array.isArray(secDisk) && secDisk.length > 0, `Archivo 'secciones_data.json' contiene ${secDisk.length} secciones respaldadas`);

  // ---------------------------------------------------------------------------
  // RESUMEN
  // ---------------------------------------------------------------------------
  console.log("\n===============================================================");
  console.log(`🏁 RESULTADO FINAL DE LA AUDITORÍA:`);
  console.log(`   Pruebas Exitosas: ${passed}`);
  console.log(`   Fallos:           ${failed}`);
  console.log("===============================================================");

  if (failed === 0) {
    console.log("🎉 ¡PERFECTO! Todos los módulos guardan ordenada y persistentemente en Supabase y en respaldo local.");
    process.exit(0);
  } else {
    console.error("⚠️ Se detectaron fallos en la auditoría.");
    process.exit(1);
  }
}

runAudit().catch((err) => {
  console.error("Error crítico durante la auditoría:", err);
  process.exit(1);
});
