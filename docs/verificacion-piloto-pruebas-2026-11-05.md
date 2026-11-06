# Prueba piloto de evaluaciones semanales

Fecha local: 5 de noviembre de 2026, America/Tegucigalpa.

Se recorrió el sitio local con un docente, una sección y un estudiante exclusivos del piloto, utilizando la API y la base de datos reales. No se modificaron semanas, calificaciones ni secciones existentes. Los registros temporales se retiraron al concluir.

## Recorrido comprobado

- Creación de sección y matrícula del estudiante; confirmación de los registros en Supabase.
- Publicación y edición de evaluaciones; guardado desde el editor docente.
- Inicio de sesión desde el formulario real del estudiante y entrada a la sala en vivo.
- Inicio, espera y avance de preguntas; respuesta y entrega desde el portal.
- Revisión manual desde el panel docente, bloqueo de las calificaciones automáticas y consulta de resultados después de recargar.
- Persistencia de notas oficiales/reales, comprobante del estudiante y acumulación en Premios de la Sección.
- Reenvío de una entrega con respuestas distintas y puntajes manipulados: se conservaron las respuestas selladas y la calificación original.

## Evaluación mixta: seis formatos

Cada pregunta vale un punto; la sexta es el bonus. Se incluyeron respuestas incorrectas intencionales.

| Formato | Respuesta del piloto | Puntaje comprobado |
| --- | --- | ---: |
| Selección múltiple | Correcta | 1.000 |
| Verdadero/falso | Incorrecta | 0.000 |
| Términos pareados | Dos relaciones correctas de tres | 0.667 |
| Respuesta corta | Correcta, revisada por el docente | 1.000 |
| Numeración | Una respuesta correcta de dos | 0.500 |
| Completación, bonus | Dos espacios correctos | 1.000 |
| Total según la regla vigente de suma y tope oficial | | 4.167 |

Antes de la revisión, la entrega permaneció en estado `enviado`, sin nota definitiva y con 1.667 puntos automáticos. Al completar la revisión pasó a `calificado`, con 4.167 puntos; el mismo resultado quedó en el portal y en `notas.prueba_1` y `notas.prueba_1_real`.

## Evaluación completamente automática

Se respondieron correctamente seis preguntas de selección múltiple, verdadero/falso y términos pareados, incluido el bonus. La entrega quedó calificada sin revisión manual: **5.000 puntos oficiales y 6.000 reales**. La salida normal de pantalla completa no generó advertencias y la evaluación no volvió a abrirse después de entregar ni después de recargar.

Supabase confirmó `notas.prueba_2 = 5` y `notas.prueba_2_real = 6`. Premios mostró **10.167 puntos acumulados**, con el bonus incluido una sola vez.

## Problemas detectados y corregidos

1. Un latido atrasado podía sobrescribir el avance del docente. Ahora presencia y respuestas se guardan separadas del control; las escrituras concurrentes comparan versión y reintentan. Un vencimiento atrasado tampoco cierra la pregunta siguiente.
2. Salir de pantalla completa después de entregar podía registrar una advertencia y restaurar el intento enviado. Ahora se marca la entrega como terminada antes de salir y se impide restaurar intentos ya entregados.
3. El tiempo configurado se guardaba en las preguntas pero no en su columna general; al reabrir el editor podía volver a 90 segundos. Se corrigió el guardado y la lectura histórica. Se comprobó guardar 120 segundos, consultar Supabase y reabrir el editor conservando 120.
4. La revisión mostraba y repartía 0.333 en cada una de tres casillas de un punto. Ahora comparte el reparto exacto de milésimas: 0.334 + 0.333 + 0.333 = 1.000.
5. Al rechazar la base de datos una sección con datos inválidos, el servidor podía responder éxito usando un respaldo local. Ahora devuelve un error y no crea una sección aparente. El rechazo real del piloto devolvió 503 y no dejó registros en Supabase.

## Verificación adicional

- `node server/scripts/test_live_quiz_concurrency.mjs`: latido atrasado frente a avance docente, alumnos que guardan simultáneamente y vencimiento frente a cambio de pregunta. Sin red ni datos reales.
- `node server/scripts/test_quiz_auto_grading.mjs`: aciertos, errores, respuestas vacías, puntajes parciales, bonus, distribución exacta e inmutabilidad.
- `node server/scripts/test_quiz_item_types.mjs`: formatos y claves válidas, completación, numeración y 1800 configuraciones pareadas sin coincidencias de posición.
- `node server/scripts/test_academic_integrity.js`: cálculo académico y sanitización de notas.
- `npm run build`: compilación del cliente.

Alcance: piloto funcional con un estudiante en navegador de escritorio y comprobaciones aisladas de concurrencia. No constituye una prueba de carga con una clase completa ni una auditoría general de seguridad.
