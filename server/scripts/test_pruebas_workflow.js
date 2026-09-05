const BASE_URL = "http://localhost:5000/api";

async function runTest() {
  console.log("🚀 Iniciando prueba integral del flujo de Pruebas Semanales...");

  const testSeccionId = `test-sec-${Date.now()}`;
  const testSemana = 3;
  const testCuenta = `2023100${Math.floor(Math.random() * 8999 + 1000)}`;
  const testNombre = "Estudiante Prueba Histolab";

  // 1. Crear / Guardar una prueba semanal con preguntas estructuradas:
  // - Pregunta 1 con Sub-item de texto corto (ej. estructura enfocada)
  // - Sub-item de listado numerado con N=3 (ej. 3 características morfológicas)
  // - Sub-item de listado numerado con N=3 (ej. 3 ubicaciones anatómicas)
  console.log("\n1️⃣ Creando cuestionario semanal para la sección...");
  const quizPayload = {
    seccion_id: testSeccionId,
    carrera: "Medicina",
    numero_semana: testSemana,
    titulo: "Prueba Semanal 3: Tejido Epitelial y Conectivo",
    descripcion: "Identifique la micrografía y conteste con precisión los elementos requeridos.",
    tiempo_limite_minutos: 15,
    publicada: true,
    preguntas: [
      {
        id: "p1",
        enunciado: "Observe la micrografía enfocada en 40x del microscopio y responda:",
        imagen_url: "https://images.unsplash.com/photo-1579154204601-01588f351e67?w=600",
        puntos: 5.0,
        items: [
          {
            id: "i1",
            tipo: "texto_corto",
            instruccion: "¿Cuál es la estructura u órgano enfocado?",
            respuesta_modelo: "Tráquea (Epitelio cilíndrico seudoestratificado ciliado)",
            cantidad: 1
          },
          {
            id: "i2",
            tipo: "listado",
            instruccion: "Mencione 3 características morfológicas distintivas observadas:",
            cantidad: 3,
            respuestas_esperadas: [
              "Cilios en el borde apical",
              "Células caliciformes productoras de moco",
              "Núcleos a diferentes alturas dando apariencia estratificada"
            ]
          },
          {
            id: "i3",
            tipo: "listado",
            instruccion: "Mencione 3 ubicaciones corporales donde se encuentra este tipo de epitelio:",
            cantidad: 3,
            respuestas_esperadas: [
              "Tráquea",
              "Bronquios principales",
              "Cavidad nasal"
            ]
          }
        ]
      }
    ]
  };

  const resSave = await fetch(`${BASE_URL}/pruebas/seccion/${testSeccionId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(quizPayload)
  });
  const dataSave = await resSave.json();
  console.log("Resultado guardado prueba:", dataSave.success, dataSave.message);
  if (!dataSave.success) throw new Error("Fallo al guardar prueba");

  // 2. Obtener prueba como estudiante
  console.log("\n2️⃣ Obteniendo prueba como estudiante...");
  const resGet = await fetch(`${BASE_URL}/pruebas/seccion/${testSeccionId}/semana/${testSemana}`);
  const dataGet = await resGet.json();
  console.log("Prueba obtenida:", dataGet.data?.titulo, "Reactivos:", dataGet.data?.preguntas?.length);

  // 3. Estudiante envía sus respuestas
  console.log("\n3️⃣ Estudiante envía respuestas a los campos de texto y listas...");
  const studentAnswers = {
    "p1_i1": "Tráquea",
    "p1_i2_0": "Presencia de cilios apicales móviles",
    "p1_i2_1": "Células caliciformes mucosecretoras",
    "p1_i2_2": "Disposición pseudoestratificada de núcleos celulares",
    "p1_i3_0": "Tráquea",
    "p1_i3_1": "Bronquios lobares",
    "p1_i3_2": "Fosas nasales"
  };

  const submitPayload = {
    quiz_id: dataGet.data?.id,
    numero_semana: testSemana,
    numero_cuenta: testCuenta,
    nombre_completo: testNombre,
    carrera: "Medicina",
    respuestas: studentAnswers
  };

  const resSubmit = await fetch(`${BASE_URL}/pruebas/seccion/${testSeccionId}/entregar`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(submitPayload)
  });
  const dataSubmit = await resSubmit.json();
  console.log("Resultado entrega estudiante:", dataSubmit.success, dataSubmit.message);
  if (!dataSubmit.success) throw new Error("Fallo al entregar prueba");
  const entregaId = dataSubmit.data?.id;

  // 4. Docente consulta entregas de la semana
  console.log("\n4️⃣ Docente consulta lista de entregas para la semana...");
  const resEntregas = await fetch(`${BASE_URL}/pruebas/seccion/${testSeccionId}/semana/${testSemana}/entregas`);
  const dataEntregas = await resEntregas.json();
  console.log(`Total entregas encontradas: ${dataEntregas.data?.length}`);
  const foundSub = dataEntregas.data?.find(e => e.numero_cuenta === testCuenta);
  console.log(`Entrega de ${testNombre}: Estado = ${foundSub?.estado}`);

  // 5. Docente califica la entrega (4.850 / 5.000 pts)
  console.log("\n5️⃣ Docente califica la entrega del alumno...");
  const resCalificar = await fetch(`${BASE_URL}/pruebas/entregas/${entregaId}/calificar`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      nota_obtenida: 4.85,
      comentarios: "Excelente identificación histológica de cilios y caliciformes. Muy bien respondido.",
      calificado_por: "Dra. Docente Titular",
      carrera: "Medicina"
    })
  });
  const dataCalificar = await resCalificar.json();
  console.log("Resultado calificación:", dataCalificar.success, dataCalificar.message);
  console.log("Nota asignada:", dataCalificar.data?.nota_obtenida, "pts");

  // 6. Alumno consulta su nota y retroalimentación en su dashboard
  console.log("\n6️⃣ Estudiante verifica su nota en su dashboard...");
  const resMiEntrega = await fetch(`${BASE_URL}/pruebas/seccion/${testSeccionId}/semana/${testSemana}/estudiante/${testCuenta}`);
  const dataMiEntrega = await resMiEntrega.json();
  console.log("Estado de la entrega para el alumno:", dataMiEntrega.data?.estado);
  console.log("Nota mostrada al alumno:", dataMiEntrega.data?.nota_obtenida, "/ 5.000 pts");
  console.log("Comentarios del docente:", dataMiEntrega.data?.comentarios);

  // 7. Prueba de seguridad: Validar que no permita calificaciones > 5 pts
  console.log("\n7️⃣ Validación de seguridad: Intentar calificar con 6.500 pts...");
  const resInvalid = await fetch(`${BASE_URL}/pruebas/entregas/${entregaId}/calificar`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      nota_obtenida: 6.5,
      comentarios: "Nota excedida",
      carrera: "Medicina"
    })
  });
  const dataInvalid = await resInvalid.json();
  console.log("¿Rechazó correctamente la nota > 5?:", !dataInvalid.success, "(Mensaje:", dataInvalid.message, ")");

  // 8. Prueba de eliminación en cascada por sección
  console.log("\n8️⃣ Prueba de vinculación y eliminación en cascada...");
  const resDeletePruebas = await fetch(`${BASE_URL}/pruebas/seccion/${testSeccionId}`, {
    method: "DELETE"
  });
  const dataDeletePruebas = await resDeletePruebas.json();
  console.log("Resultado borrado en cascada:", dataDeletePruebas.success, dataDeletePruebas.message);

  const resVerifyPruebas = await fetch(`${BASE_URL}/pruebas/seccion/${testSeccionId}`);
  const dataVerifyPruebas = await resVerifyPruebas.json();
  console.log("Pruebas restantes para la sección eliminada:", dataVerifyPruebas.data?.length);

  const resVerifyEntregas = await fetch(`${BASE_URL}/pruebas/seccion/${testSeccionId}/semana/${testSemana}/entregas`);
  const dataVerifyEntregas = await resVerifyEntregas.json();
  console.log("Entregas restantes para la sección eliminada:", dataVerifyEntregas.data?.length);

  if ((dataVerifyPruebas.data?.length || 0) !== 0 || (dataVerifyEntregas.data?.length || 0) !== 0) {
    throw new Error("Fallo en la eliminación en cascada: aún quedan pruebas o entregas para la sección");
  }
  console.log("✅ Eliminación en cascada confirmada: 0 pruebas y 0 entregas restantes vinculadas a esa sección.");

  console.log("\n🎉 ¡TODAS LAS PRUEBAS DEL FLUJO Y DE VINCULACIÓN COMPLETADAS EXITOSAMENTE!");
}

runTest().catch((err) => {
  console.error("❌ Error en la prueba:", err);
  process.exit(1);
});
