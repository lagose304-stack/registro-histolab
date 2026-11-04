# Mapa de acceso del estudiante

[Véase el mapa general](mapa-del-sitio.md) para las convenciones de rutas y la persistencia compartida.

| Qué puede hacer en el portal | Dónde consultar para cambiarlo |
| --- | --- |
| Iniciar sesión, cambiar contraseña y cerrar sesión | `client/src/App.jsx` y `StudentPortalView.jsx`. En la API, sigue `/api/auth/student-login`, `/api/auth/student-change-password`, `/api/auth/student-heartbeat` y `/api/auth/student-logout` en `auth.routes.js` y `auth.controller.js`. La validación de sesión está en `server/src/middlewares/auth.middleware.js` y su persistencia en `student_concurrent_sessions_migration.sql`. |
| Consultar información académica y calificaciones | `StudentPortalView.jsx` reúne los datos de cuenta, carrera y sección. Consulta las familias `/api/estudiantes`, `/api/secciones`, `/api/temario` y `/api/semanas`. Los cálculos están en `client/src/utils/academicEngine.js`. |
| Abrir una prueba habilitada, responder, entregar y consultar su propia entrega | `StudentPortalView.jsx` y las llamadas de pruebas en `client/src/services/api.js`. Sigue `/api/pruebas/seccion` hasta `pruebas.routes.js` y `pruebas.controller.js`. |
| Participar en una prueba en vivo | La entrada y el envío de latidos están en `StudentPortalView.jsx`. El estado y la sesión activa se consultan en `/api/pruebas/live`, atendido por `liveQuiz.controller.js`. |

Al cambiar el portal, comprueba cómo se determina la cuenta, carrera y sección, y qué validación aplica el servidor a la operación. La creación, revisión y administración de evaluaciones se documentan en los mapas docentes.
