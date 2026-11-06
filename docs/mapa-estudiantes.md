# Mapa de acceso del estudiante

[Véase el mapa general](mapa-del-sitio.md) para las convenciones de rutas y la persistencia compartida.

| Qué puede hacer en el portal | Dónde consultar para cambiarlo |
| --- | --- |
| Iniciar sesión, cambiar contraseña y cerrar sesión | `client/src/App.jsx` y `StudentPortalView.jsx`. En la API, sigue `/api/auth/student-login`, `/api/auth/student-change-password`, `/api/auth/student-heartbeat` y `/api/auth/student-logout` en `auth.routes.js` y `auth.controller.js`. La validación de sesión está en `server/src/middlewares/auth.middleware.js` y su persistencia en `student_concurrent_sessions_migration.sql`. |
| Consultar información académica y calificaciones | `StudentPortalView.jsx` reúne los datos de cuenta, carrera y sección. Consulta las familias `/api/estudiantes`, `/api/secciones`, `/api/temario` y `/api/semanas`. Los cálculos están en `client/src/utils/academicEngine.js`. |
| Abrir una prueba habilitada, responder, entregar y consultar su propia entrega | `StudentPortalView.jsx` y las llamadas de pruebas en `client/src/services/api.js`. Sigue `/api/pruebas/seccion` hasta `pruebas.routes.js` y `pruebas.controller.js`. |
| Participar en una prueba en vivo | La entrada y el envío de latidos están en `StudentPortalView.jsx`. El estado y la sesión activa se consultan en `/api/pruebas/live`, atendido por `liveQuiz.controller.js`. |

Al cambiar el portal, comprueba cómo se determina la cuenta, carrera y sección, y qué validación aplica el servidor a la operación. La creación, revisión y administración de evaluaciones se documentan en los mapas docentes.

Los grupos del libro de calificaciones corresponden a los parciales configurados en las semanas de la carrera. Cada grupo muestra todos sus exámenes, identificados por semana y leídos mediante `getCanonicalExamGrade`; sus notas se suman una sola vez en el subtotal. No se limita la presentación a tres parciales ni a un examen por parcial. Las notas históricas de los tres primeros exámenes siguen siendo compatibles.

Los apartados de pruebas se responden con `QuizItemResponse.jsx`: texto corto, numeración, completación, una opción de selección múltiple, verdadero/falso y selección de definición para cada término pareado. El portal mantiene el autoguardado, el bloqueo al finalizar el tiempo y la misma estructura de respuestas por pregunta y apartado. El resultado conserva la revisión docente de respuestas únicas o casillas, según corresponda.

Selección múltiple, verdadero/falso y términos pareados se califican automáticamente al entregar. Una prueba compuesta únicamente por esos tipos queda calificada en ese momento; si incluye apartados manuales, permanece pendiente hasta que el docente termine de revisarlos. La entrega conserva el estado de calificación devuelto por el servidor.

Después de confirmar una entrega, la salida de pantalla completa ya no cuenta como infracción y los intentos con entrega existente no se restauran como exámenes activos. El catálogo y la sala de espera muestran la duración configurada, y el comprobante respeta la distribución exacta de puntos por casilla.
