# Verificación de notas de varios exámenes

Fecha local: 5 de noviembre de 2026, America/Tegucigalpa.

La prueba piloto anterior comprobó pruebas semanales y Premios, pero no varios exámenes parciales dentro del cuadro de notas. Esta verificación amplía ese alcance con una sección, un docente y un estudiante temporales, utilizando la interfaz, API y Supabase reales. Los registros temporales fueron eliminados al finalizar.

## Errores reproducidos

- El cuadro aplicaba cortes fijos por semana: el examen I de la semana 5 podía leer `segundo_examen`, y los exámenes de las semanas 11 y 16 podían leer ambos `tercer_examen`.
- La exportación creaba columnas por semana pero no resolvía los alias históricos usados al registrar las notas; podía exportar ceros aunque hubiera calificaciones.
- Una carga inicial atrasada podía reemplazar las modificaciones hechas después de otra carga ya completada. Durante el piloto se observó que desaparecía la clave por semana del primer examen al guardar el segundo; la protección de versión y edición corrigió esa pérdida.
- El portal tenía tres parciales fijos y seleccionaba un solo examen por parcial. Podía ocultar evaluaciones adicionales o agruparlas incorrectamente.

## Corrección

`getExamMetadata` centraliza la identidad del examen según su semana y posición cronológica. `getCanonicalExamGrade` da prioridad a la clave por semana y conserva la lectura de los alias históricos. El formulario, motor académico, cuadro y exportación usan la misma resolución. El portal construye los parciales configurados y muestra todos los exámenes del grupo.

No se migraron ni reescribieron calificaciones existentes. Las nuevas ediciones guardan la clave por semana y mantienen los alias de los tres primeros exámenes para compatibilidad. Los cambios de cargas atrasadas se descartan.

## Piloto real

Se registraron desde **Subir nota de examen parcial**:

| Evaluación | Semana | Nota |
| --- | ---: | ---: |
| Examen I | 5 | 7.125 |
| Examen II | 11 | 8.625 |
| Examen III | 16 | Sin nota |
| Total de exámenes | | 15.750 |

Se verificó que guardar el segundo conserva la nota y la clave del primero. Después se usó en el mismo estudiante temporal un formato histórico, con notas en JSON y ceros por defecto en las columnas antiguas, para comprobar la compatibilidad que causaba el problema del cuadro.

Resultados comprobados:

- Cuadro general: 7.125 en I, 8.625 en II, III pendiente y total 15.750.
- Filtro I Parcial: muestra 7.125, sin trasladar 8.625.
- Filtro II Parcial: muestra 8.625, sin trasladar 7.125.
- Archivo Excel descargado y leído con ExcelJS: valores numéricos 7.125, 8.625 y 15.750.
- Portal del estudiante: ambas calificaciones y total correcto, conservados después de recargar.
- Sin errores JavaScript durante el recorrido.

## Casos adicionales aislados

- Dos exámenes dentro de un mismo parcial: el portal muestra ambos y suma 15.750, sin quedarse solo con el primero.
- Cuatro parciales: el portal muestra los cuatro y conserva notas independientes; adaptación a móvil de 360 px sin desbordamiento horizontal.
- Datos por semana con alias históricos distintos: la semana tiene prioridad.
- Cero explícito: permanece como nota válida.
- Cuarto examen sin nota: no vuelve a utilizar la calificación del primero.
- Datos históricos sin semanas configuradas: el motor suma las notas JSON sin ocultarlas por ceros predeterminados.

Comprobaciones: `node server/scripts/test_exam_grade_mapping.mjs`, `node server/scripts/test_academic_integrity.js` y `npm run build`.

El alcance es funcional y de compatibilidad de calificaciones; no incluye una prueba de carga multiusuario ni reconstruye notas que ya hubieran sido sobrescritas antes de esta corrección.
