# Programación de pruebas semanales

La semana de una prueba identifica el contenido y la columna de calificación. La fecha de rendición se calcula con las semanas configuradas de cada carrera, sin asumir números fijos de parcial.

| Contenido | Siguiente semana | Rendición |
| --- | --- | --- |
| Semana 1 | Semana 2 regular | Práctica de semana 2 |
| Semana 2 | Semana 3 de examen | Práctica de semana 2 |
| Semana 3 de examen | Cualquiera | Sin prueba semanal |

En la práctica 2 se dirigen las pruebas 1 y 2 por separado. Cada entrega sigue guardándose y calificándose en su semana de contenido. La programación no cambia la matrícula ni amplía una reposición individual a otras semanas.

`shared/quizSchedule.mjs` comparte las reglas entre el control docente y el servidor. El servidor carga semanas y agenda desde `services/quizSchedule.js`. El horario ordinario es el de la práctica, sin los márgenes de asistencia. Una reposición de horario desplaza las pruebas que correspondan a esa práctica; la programación ordinaria no permite habilitarlas en una semana de examen. Si falta la siguiente semana, no se supone una fecha. Si falla la consulta, no se concede apertura ordinaria.

Desde el 11 de noviembre de 2026, solo el rol global **Creador** puede habilitar y dirigir una prueba existente fuera de la fecha y horario programados, para agilizar verificaciones. `canBypassQuizSchedule` en `shared/instructorRoles.mjs` comparte esta decisión entre `LiveQuizControlView.jsx` y `liveQuiz.controller.js`. La API consulta exclusivamente el rol vigente de la cuenta autenticada; no acepta declaraciones del cuerpo, `es_titular` ni acceso completo como excepción. Coordinador, titular e instructores asignados deben respetar el día y la ventana horaria al habilitar, iniciar o avanzar preguntas, incluidas las variantes históricas del endpoint. Cerrar, deshabilitar o finalizar una sesión sigue disponible fuera de horario. La excepción no modifica la semana de contenido, las notas, la matrícula ni los permisos de acceso a otras operaciones. No afecta al plazo de manuales ni a asistencia.

Los manuales conservan `shared/manualsWindow.mjs`: siguiente práctica, con el margen de asistencia, o fecha especial configurada para el contenido previo a examen. Esta misma ventana se aplica al estudiante en reposición individual, sin adelantar la calificación al día de su práctica.

Verificación aislada, sin escrituras reales: `node server/scripts/test_quiz_schedule.mjs`, `node server/scripts/test_quiz_creator_schedule.mjs`, `node server/scripts/test_live_quiz_concurrency.mjs`, `node server/scripts/test_student_makeups.mjs` y `node server/scripts/test_manuals_window.mjs`. No se requiere una migración de base de datos.
