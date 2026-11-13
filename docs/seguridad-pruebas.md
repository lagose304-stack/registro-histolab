# Seguridad y funcionamiento de pruebas

La implementación se verificó con datos aislados y se publicó en Cloudflare el 7 de noviembre de 2026. La migración de permisos se aplicó y verificó en el proyecto correcto mediante su panel de Supabase. La conexión de Supabase de Codex sigue mostrando otra organización; el acceso al proyecto se realizó desde la sesión abierta del propietario. No se modificaron respuestas ni calificaciones.

## Controles aplicados

- `quizAccess.middleware.js` autentica todas las rutas de pruebas y verifica cuenta, sección, semana y función asignada. La identidad enviada en el cuerpo no decide quién entrega. Calificar o eliminar una entrega verifica su registro real. El servidor aplica la ventana de programación; únicamente el rol global Creador de la cuenta autenticada puede habilitar y dirigir pruebas fuera de fecha y horario. Coordinador y titular no reciben esa excepción.
- `quizPrivacy.mjs` entrega al estudiante una proyección sin claves, modelos ni respuestas esperadas. Los términos pareados conservan términos y un banco de definiciones independiente, sin revelar la asociación correcta. Las consultas en vivo no entregan nombres, IP ni respuestas de compañeros. Los borradores permanecen fuera del catálogo estudiantil.
- La corrección usa la clave guardada en el servidor. La entrega exige una prueba publicada y una sesión iniciada. Los reintentos de entregas selladas son idempotentes, incluso para pruebas manuales; las respuestas originales prevalecen. La restricción única de la base y un bloqueo local por entrega evitan duplicados concurrentes.
- Una falla al verificar la sesión central produce un error recuperable en lugar de reactivar una sesión vieja del proceso.

## Registro de salidas y tres faltas (13 de noviembre de 2026)

La política `salidas-tres-faltas-v1` observa pérdida de foco de la ventana, página oculta, abandono/recarga del documento y cierre voluntario de sesión desde el portal. Una salida abre un episodio y cuenta una sola falta aunque produzca varios eventos. El regreso se registra cuando la página vuelve a estar visible y enfocada, con 150 ms de estabilización para no contar dos veces la misma transición. Rotación, teclado, tamaño de ventana, selección, copiar/pegar e impresión no generan faltas por sí mismos. No se exige pantalla completa, no se vigila el portapapeles ni se tapa el contenido al salir. La primera y segunda faltas presentan un aviso dentro de la prueba. La tercera cierra la edición y envía las respuestas existentes, incluso en la sala de espera.

`QuizActivityConsent.jsx` explica y registra la aceptación antes de crear el intento. `useQuizActivity.js` conserva el identificador asignado por el servidor, el contador y los eventos pendientes. `quizActivityObserver.mjs` solo observa señales del navegador. El contador se recupera del servidor al restaurar y no vuelve a cero por recargar o aceptar nuevamente. Los borradores anteriores a esta política requieren aceptación antes de continuar.

Antes de solicitar la entrega se guarda una copia exacta de respuestas y eventos pendientes. Una falla de red mantiene esa entrega cerrada para edición y reintenta al recuperar conexión, al recargar y cada cinco segundos mientras esté pendiente. Las solicitudes son idempotentes. El servidor confirma los eventos antes de guardar la entrega; su contador decide el motivo `limite_tres_faltas`. No se descartan respuestas ni se registra una anulación. Se conservan preguntas, tipos de respuesta, orden, programación, tiempos, sincronización docente, notas y corrección automática.

## Registro independiente y permisos

`server/src/services/quizActivity.js` usa Supabase cuando está configurado y un archivo local con escritura atómica en desarrollo. Un error de Supabase no se sustituye silenciosamente con el archivo local. La migración `supabase/migrations/20261113214049_quiz_activity_journal.sql` crea `quiz_activity_attempts`, `quiz_activity_events` y la función transaccional `append_quiz_activity`. Debe aplicarse al proyecto de HistoLab antes de publicar este código. La conexión MCP disponible corresponde a otro proyecto: no se aplicó allí.

Cada registro contiene intento, matrícula, cuenta, sección, prueba, versión de reglas y aceptación; cada evento conserva identificador, episodio, señal, falta, pregunta, hora del dispositivo y hora de recepción del servidor. Los regresos se agregan como eventos separados y permiten estimar la duración declarada sin sobrescribir la salida. El orden de recepción se conserva mediante una secuencia de base de datos. La función bloquea el intento durante la transacción y deduplica identificadores y episodios, por lo que reintentos o solicitudes concurrentes no añaden faltas dobles.

Las tablas tienen RLS y no conceden acceso a `anon` ni `authenticated`. La API solo puede leer e insertar eventos, sin UPDATE/DELETE. Las rutas reutilizan `authenticateQuiz` y `quizAccess`: el alumno registra únicamente su intento y el docente necesita permiso de revisión de la semana para consultar otra cuenta. La consulta y el registro no exponen claves de corrección ni datos de compañeros.

Rutas:

- `POST /api/pruebas/seccion/:seccion_id/semana/:semana/actividad/iniciar`: aceptación y recuperación del intento propio.
- `POST /api/pruebas/seccion/:seccion_id/semana/:semana/actividad/:intento_id`: registro de eventos propios.
- `GET /api/pruebas/seccion/:seccion_id/semana/:semana/actividad/estudiante/:numero_cuenta`: bitácora para el revisor autorizado.

La entrega incluye una copia del registro en `auditoria.actividad`, junto con los metadatos y la calificación automática existentes. `QuizActivityReview.jsx` consulta además la bitácora independiente, con error y reintento explícitos. Una eliminación docente de la entrega permite un nuevo intento al ingresar nuevamente; el intento anterior se archiva sin borrar sus eventos. Las calificaciones y auditorías históricas se conservan.

## Límites de interpretación

Son señales declaradas por el navegador, no prueba concluyente de copia ni garantía de cumplimiento legal. `blur` puede producirse al tocar la barra de direcciones o por una interrupción del sistema. No se puede identificar otra aplicación, conocer su contenido, detectar otro dispositivo ni garantizar detección de pantalla dividida, capturas o toda multitarea. El cierre forzoso del proceso puede no emitir eventos; un evento pendiente requiere que el navegador vuelva a conectarse para llegar al servidor. Los datos locales pueden perderse si se borra el almacenamiento. Los relojes del dispositivo pueden ser incorrectos y los clientes manipulados pueden omitir o falsificar señales; la recepción del servidor identifica cuándo llegó el reporte, no certifica su causa. La interfaz docente muestra esas limitaciones y distingue las dos horas. No hay cámara, micrófono, huella digital ni inspección de aplicaciones.

## Verificación aislada

```text
node server/scripts/test_quiz_activity.mjs
node server/scripts/test_quiz_auth.mjs
node server/scripts/test_quiz_security.mjs
node server/scripts/test_quiz_submission_security.mjs
node server/scripts/test_live_quiz_concurrency.mjs
node server/scripts/test_quiz_auto_grading.mjs
node server/scripts/test_academic_integrity.js
node server/scripts/test_quiz_player_browser.mjs
npm run build
```

Se verificaron las transiciones del observador y la función SQL con PostgreSQL embebido: identidad, permisos, duplicados, concurrencia, rollback de lotes inválidos, conservación de registros y nuevos intentos. El navegador usa API simulada sin datos reales en 320×640, 640×360, 768×1024 y 1024×768. Comprueba aceptación, faltas visibles sin bloqueo, envío único con respuestas exactas, recarga, fallo de red, restauración de la entrega cerrada, fin docente y lobby. Las capturas están en `artifacts/quiz-activity/`. La compilación mantiene la advertencia previa de tamaño del panel docente y no añade dependencias. Esta verificación corresponde al código local; no implica publicación ni aplicación de la migración en producción.

## Historial de producción anterior a esta política

La dirección pública gratuita es `https://registrohistolab.pages.dev`. Pages conecta la API mediante un enlace interno al Worker; los secretos permanecen únicamente en el servidor. Se verificaron HTTP 200 para la página, salud y configuración académica, y HTTP 401 para consultas de pruebas sin sesión desde el nuevo dominio.

- Aplicada `secure_quiz_access_migration.sql` en el proyecto del sitio, con comprobación de ausencia de pruebas activas y límite de cinco segundos de espera de bloqueo. La verificación posterior confirmó que `anon` y `authenticated` no tienen SELECT, INSERT, UPDATE ni DELETE en ninguna de las tres tablas; `service_role` conserva esos permisos.
- Sustituida la clave privilegiada antigua en la configuración privada por una clave moderna `sb_secret_…` del mismo proyecto. Se verificó acceso a las tres tablas sin leer filas de estudiantes. La firma JWT de la aplicación se renovó con un valor aleatorio; los usuarios deben iniciar sesión nuevamente.
- `JWT_SECRET`, `SUPABASE_KEY` y `SUPABASE_SERVICE_ROLE_KEY` están publicados como secretos cifrados de Cloudflare. Los valores no están en `wrangler.toml`, en documentación ni en archivos versionados. No se deben restaurar configuraciones antiguas con credenciales expuestas.
- Versión inicial del cierre de seguridad: `2f75491f-b31f-4c02-9919-85de9fc6ecf9`, en `https://registro-histolab.7w7.workers.dev`. Se verificaron página principal y API con HTTP 200, y rutas de pruebas sin sesión con HTTP 401.
- El propietario desactivó las API keys antiguas basadas en JWT. El panel muestra **Re-enable JWT-based API keys**, confirmando su estado desactivado. Se verificó que la clave privilegiada retirada devuelve HTTP 401 tanto como `apikey` como en `Authorization` acompañada por la clave pública moderna. El acceso público directo también devuelve HTTP 401.
- Tras la retirada se verificó nuevamente el acceso de la clave moderna a las tres tablas con HTTP 200, sin leer filas. La página principal, la API de salud y la configuración académica publicada responden con HTTP 200; las rutas de pruebas sin sesión mantienen HTTP 401. La retirada de las API keys antiguas es independiente de la renovación de la firma JWT propia de HistoLab. La validación no incluyó iniciar sesión como un alumno o instructor real ni alterar sus datos.

## Fuentes de los criterios

- [MDN: Page Visibility API](https://developer.mozilla.org/en-US/docs/Web/API/Page_Visibility_API): foco y visibilidad son señales diferentes.
- [MDN: VisualViewport](https://developer.mozilla.org/en-US/docs/Web/API/VisualViewport): el teclado y las interfaces del sistema cambian el área visible.
- [Supabase: seguridad de la API](https://supabase.com/docs/guides/api/securing-your-api): permisos de tabla y RLS son controles complementarios.
- [Cloudflare: secretos](https://developers.cloudflare.com/workers/configuration/secrets/): las credenciales sensibles deben configurarse como secretos, no como variables versionadas.

La dirección pública antigua de Workers está desactivada: tanto su página como `/api/health` devuelven HTTP 404. La entrada de Pages y su API siguen operativas mediante el enlace interno, con HTTP 200 en salud y configuración académica y HTTP 401 en pruebas sin sesión.

La revisión de regresión de instructores corrigió compatibilidad de asignaciones y acceso al resumen de premios; los resultados y la versión posterior están en [Verificación del panel de instructores](verificacion-instructores.md).
