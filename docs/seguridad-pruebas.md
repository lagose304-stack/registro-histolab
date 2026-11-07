# Seguridad e integridad de pruebas

La implementación se verificó con datos aislados y se publicó en Cloudflare el 7 de noviembre de 2026. La migración de permisos se aplicó y verificó en el proyecto correcto mediante su panel de Supabase. La conexión de Supabase de Codex sigue mostrando otra organización; el acceso al proyecto se realizó desde la sesión abierta del propietario. No se modificaron respuestas ni calificaciones.

## Controles aplicados

- `quizAccess.middleware.js` autentica todas las rutas de pruebas y verifica cuenta, sección, semana y función asignada. La identidad enviada en el cuerpo no decide quién entrega. Calificar o eliminar una entrega verifica su registro real. El servidor decide si quien habilita es titular o asignado y aplica su regla de horario.
- `quizPrivacy.mjs` entrega al estudiante una proyección sin claves, modelos ni respuestas esperadas. Los términos pareados conservan términos y un banco de definiciones independiente, sin revelar la asociación correcta. Las consultas en vivo no entregan nombres, IP ni respuestas de compañeros. Los borradores permanecen fuera del catálogo estudiantil.
- La corrección usa la clave guardada en el servidor. La entrega exige una prueba publicada y una sesión iniciada. Los reintentos de entregas selladas son idempotentes, incluso para pruebas manuales; las respuestas originales prevalecen. La restricción única de la base y un bloqueo local por entrega evitan duplicados concurrentes.
- Una falla al verificar la sesión central produce un error recuperable en lugar de reactivar una sesión vieja del proceso. Los contadores declarados de integridad se respaldan en los latidos existentes, sin nuevos sondeos, y no pueden disminuir mediante un latido posterior de la misma sesión.

## Política de visibilidad y falsos positivos

`quizIntegrity.mjs` observa eventos y mantiene un episodio por ausencia; no realiza comprobaciones periódicas. Solo cuenta una advertencia cuando una pregunta activa deja de estar visible al menos dos segundos. Un regreso breve, el lobby, un diálogo de confirmación o un envío no cuentan. Eventos duplicados de foco/visibilidad no duplican la advertencia. La tercera salida sostenida mantiene la regla previa de cerrar y entregar, con revisión del instructor.

Perder el foco, abrir un selector, girar el dispositivo, abrir el teclado, cambiar de tamaño, usar gestos o perder pantalla completa no demuestra una salida de aplicación y no genera sanciones por sí solo. Se bloquearon copiar/pegar y atajos restringidos dentro de la evaluación sin registrar el contenido privado del portapapeles ni convertir el intento en prueba de fraude. Se retiraron el sondeo con `debugger`, la huella digital y la medición de cadencia. La marca visible de la prueba se conserva sin observadores globales de mutaciones.

Las incidencias del navegador se etiquetan como información declarada, no como evidencia infalible. Una llamada o interrupción del sistema puede ocultar realmente la página: el navegador no puede establecer su intención. La revisión muestra esta limitación y no atribuye automáticamente una captura o uso de IA. Tampoco puede impedir una cámara externa, otro dispositivo o un navegador manipulado. El catálogo conserva los enunciados para restaurar la evaluación; no hay una garantía de embargo de preguntas futuras. No se añadió cámara, micrófono, vigilancia remota ni dependencias.

## Verificación reproducible sin datos reales

```text
node server/scripts/test_quiz_integrity.mjs
node server/scripts/test_quiz_auth.mjs
node server/scripts/test_quiz_security.mjs
node server/scripts/test_quiz_submission_security.mjs
node server/scripts/test_live_quiz_concurrency.mjs
node server/scripts/test_quiz_auto_grading.mjs
npm run build
```

Las pruebas aisladas de navegador verificaron los seis tipos de preguntas a 320×640, 390×844, 640×360, 768×1024, 1024×768 y 1366×900; temporizador visible; reconexión y restauración; copia/pegado bloqueados; señales ambiguas sin sanción; tres salidas sostenidas sin doble conteo y una sola entrega íntegra. Son pruebas automatizadas con tamaños simulados, no una certificación de dispositivos físicos.

## Estado de producción y cierre verificado

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
