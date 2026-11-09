# Programación de pruebas semanales

La semana de una prueba identifica el contenido y la columna de calificación. La fecha de rendición se calcula con las semanas configuradas de cada carrera, sin asumir números fijos de parcial.

| Contenido | Siguiente semana | Rendición |
| --- | --- | --- |
| Semana 1 | Semana 2 regular | Práctica de semana 2 |
| Semana 2 | Semana 3 de examen | Práctica de semana 2 |
| Semana 3 de examen | Cualquiera | Sin prueba semanal |

En la práctica 2 se dirigen las pruebas 1 y 2 por separado. Cada entrega sigue guardándose y calificándose en su semana de contenido. La programación no cambia la matrícula ni amplía una reposición individual a otras semanas.

`shared/quizSchedule.mjs` comparte las reglas entre el control docente y el servidor. El servidor carga semanas y agenda desde `services/quizSchedule.js` y rechaza aperturas fuera del día correspondiente, incluso con acceso completo. El horario ordinario es el de la práctica, sin los márgenes de asistencia. El titular y los perfiles administrativos pueden abrir fuera de hora dentro de ese mismo día. Una prueba iniciada puede avanzar después de finalizar el horario, dentro del día; cerrar o finalizar una sesión sigue disponible. Una reposición de horario desplaza las pruebas que correspondan a esa práctica; no permite habilitarlas en una semana de examen. Si falta la siguiente semana, no se supone una fecha. Si falla la consulta, no se concede apertura.

Los manuales conservan `shared/manualsWindow.mjs`: siguiente práctica, con el margen de asistencia, o fecha especial configurada para el contenido previo a examen. Esta misma ventana se aplica al estudiante en reposición individual, sin adelantar la calificación al día de su práctica.

Verificación aislada, sin escrituras reales: `node server/scripts/test_quiz_schedule.mjs`, `node server/scripts/test_live_quiz_concurrency.mjs`, `node server/scripts/test_student_makeups.mjs` y `node server/scripts/test_manuals_window.mjs`. No se requiere una migración de base de datos.
