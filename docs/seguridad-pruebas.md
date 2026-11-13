# Seguridad e integridad de pruebas

La implementación se verificó con datos aislados y se publicó en Cloudflare el 7 de noviembre de 2026. La migración de permisos se aplicó y verificó en el proyecto correcto mediante su panel de Supabase. La conexión de Supabase de Codex sigue mostrando otra organización; el acceso al proyecto se realizó desde la sesión abierta del propietario. No se modificaron respuestas ni calificaciones.

## Controles aplicados

- `quizAccess.middleware.js` autentica todas las rutas de pruebas y verifica cuenta, sección, semana y función asignada. La identidad enviada en el cuerpo no decide quién entrega. Calificar o eliminar una entrega verifica su registro real. El servidor aplica la ventana de programación; únicamente el rol global Creador de la cuenta autenticada puede habilitar y dirigir pruebas fuera de fecha y horario. Coordinador y titular no reciben esa excepción.
- `quizPrivacy.mjs` entrega al estudiante una proyección sin claves, modelos ni respuestas esperadas. Los términos pareados conservan términos y un banco de definiciones independiente, sin revelar la asociación correcta. Las consultas en vivo no entregan nombres, IP ni respuestas de compañeros. Los borradores permanecen fuera del catálogo estudiantil.
- La corrección usa la clave guardada en el servidor. La entrega exige una prueba publicada y una sesión iniciada. Los reintentos de entregas selladas son idempotentes, incluso para pruebas manuales; las respuestas originales prevalecen. La restricción única de la base y un bloqueo local por entrega evitan duplicados concurrentes.
- Una falla al verificar la sesión central produce un error recuperable en lugar de reactivar una sesión vieja del proceso. Los contadores declarados de integridad se respaldan en los latidos existentes, sin nuevos sondeos, y no pueden disminuir mediante un latido posterior de la misma sesión.

## Pantalla completa, navegación y advertencias (11 de noviembre de 2026)

La política `integridad-estados-v5` exige pantalla completa real cuando el navegador ofrece la API estándar o WebKit. `quizFullscreen.mjs` comprueba la API y verifica el resultado; si está disponible pero se rechaza, no se inicia. En navegadores móviles que no exponen esa capacidad, la prueba usa la misma política de visibilidad y foco, sin ocultar el contenido ni impedir el inicio. Un intento restaurado en un navegador con pantalla completa disponible queda bloqueado por `QuizFullscreenGate.jsx` hasta recuperarla. Los campos quedan deshabilitados mientras se muestra una advertencia o confirmación, durante el envío y después del sellado.

`quizIntegrity.mjs` usa una máquina de estados por intento (`ready`, `blocked`, `closed`) y un adaptador de eventos del navegador. El bloqueo oculta el contenido de forma síncrona con un atributo del documento, antes del renderizado de React; los manejadores de respuesta consultan también la máquina. Observa `blur`, visibilidad y salida de pantalla completa. Cada episodio muestra una cuenta regresiva de diez segundos; solo se rearma al pulsar el control de regreso y comprobar que la página está visible, enfocada y en pantalla completa. Si vence el plazo, `StudentPortalView.jsx` descarta las respuestas locales y solicita `POST /api/pruebas/seccion/:seccion_id/anular`, que registra `anulada_seguridad` con auditoría pero sin respuestas. El servidor impide enviar posteriormente una prueba anulada. Un mismo episodio cuenta una vez aunque emita los tres eventos.

Los eventos `blur` y `focus` solo actualizan el estado de integridad cuando su destino es la ventana. Los cambios de foco de botones y campos dentro del documento, incluida la retirada del botón de regreso, no representan una salida y no suman advertencias. La regresión se comprueba con `test_quiz_integrity.mjs`, `test_quiz_portal_integrity.mjs` y `test_quiz_recovery_browser.mjs`. Este último usa el portal real con API simulada y pantalla completa real: pasó dos salidas y regresos por tamaño (320×640, 640×360, 768×1024 y 1024×768), conservando las respuestas editables y sin advertencias adicionales por mover el foco interno ni desbordamiento horizontal. Usa las mismas variables de instalación de Playwright indicadas abajo. La verificación en Chromium no sustituye la de dispositivos físicos.

`quizNavigation.mjs` mantiene el intento al pulsar Atrás en el historial del mismo documento. El botón interno usa la misma confirmación: salir finaliza y envía; cancelar exige volver a pantalla completa. La pérdida de pantalla completa muestra directamente la advertencia de integridad y cuenta una falta; no abre la confirmación de entrega. La advertencia sustituye cualquier confirmación abierta y solo permite continuar tras recuperar pantalla completa. Los diálogos no suspenden la detección de salidas. Solo el envío/sellado/finalización suspende nuevas advertencias. El cierre o recarga completa conserva el aviso nativo `beforeunload`, sujeto al navegador; no permite reemplazarlo por el diálogo de la aplicación.

`App.jsx` registra el guardián de salida de `StudentPortalView.jsx`: el cierre de sesión voluntario de la barra superior abre la misma confirmación mientras hay un intento activo. La caducidad o revocación efectiva de una sesión conserva su manejo de autenticación.

Cambiar de tamaño, rotar, abrir el teclado o usar gestos no genera advertencias si no provoca alguno de los eventos vigilados. Si un selector o una interrupción del sistema produce una pérdida real de foco, la regla estricta también cuenta ese evento. Copiar/pegar y atajos restringidos continúan bloqueados sin leer contenido privado del portapapeles. No se restaura el sondeo con `debugger`, la huella digital ni la medición de cadencia. La marca visible se conserva.

Las incidencias del navegador se etiquetan como información declarada, no como evidencia infalible. Una llamada o interrupción del sistema puede ocultar realmente la página: el navegador no puede establecer su intención. La revisión muestra esta limitación y no atribuye automáticamente una captura o uso de IA. Tampoco puede impedir una cámara externa, otro dispositivo o un navegador manipulado. El catálogo conserva los enunciados para restaurar la evaluación; no hay una garantía de embargo de preguntas futuras. No se añadió cámara, micrófono, vigilancia remota ni dependencias.

## Verificación reproducible sin datos reales

El contenido de `.quiz-player` permanece oculto y sin interacción por CSS salvo cuando la raíz del documento está en pantalla completa real (estándar o WebKit). Esto oculta también los enunciados durante la transición de salida, antes del siguiente renderizado de React. La confirmación de respuestas vuelve a consultar el estado real del navegador. El aviso nativo que explica cómo salir pertenece al navegador y el sitio no puede eliminarlo; tampoco puede impedir que el usuario o el sistema termine la pantalla completa. Los dispositivos sin soporte no pueden iniciar la prueba.

```text
node server/scripts/test_quiz_integrity.mjs
node server/scripts/test_quiz_portal_integrity.mjs
node server/scripts/test_quiz_creator_schedule.mjs
node server/scripts/test_quiz_auth.mjs
node server/scripts/test_quiz_security.mjs
node server/scripts/test_quiz_submission_security.mjs
node server/scripts/test_live_quiz_concurrency.mjs
node server/scripts/test_quiz_auto_grading.mjs
npm run build
```

La reconstrucción se comprueba con `test_quiz_integrity.mjs` (incluye confirmación explícita y ráfagas de eventos durante una advertencia) y `test_quiz_portal_integrity.mjs` (restauración, diálogos, entrega y sellado). Las verificaciones históricas de navegador correspondían a la política anterior y no certifican la política estricta. `test_quiz_integrity.mjs` comprueba eventos inmediatos, deduplicación, fallos de permisos de pantalla completa, envío único y Atrás repetido con datos aislados. `test_quiz_submission_security.mjs` incluye finalizaciones en lobby y conservación de las respuestas originales. `test_quiz_integrity_browser.mjs` contiene la verificación del portal con API simulada, pantalla completa, Atrás, restauración, sellado sin conexión y tamaños 320×640, 640×360, 768×1024 y 1024×768. Requiere Playwright y Chromium; acepta `HISTOLAB_PLAYWRIGHT_MODULE` y `HISTOLAB_CHROMIUM_PATH`. En esta revisión su ejecución quedó bloqueada por el cierre de Chromium al arrancar en el entorno restringido; no se da por aprobada la comprobación visual ni la de dispositivos físicos. La actualización del código no implica una publicación en producción.

### Verificación de la reconstrucción por estados

Pasaron las pruebas aisladas `test_quiz_integrity.mjs`, `test_quiz_portal_integrity.mjs`, `test_quiz_submission_security.mjs` y `test_quiz_auth.mjs`, además de `npm run build`. La máquina se prueba con mil eventos de foco durante una misma advertencia, confirmación rechazada sin condiciones seguras, confirmación repetida y cierre definitivo. El portal comprueba que no se puedan modificar respuestas antes de confirmar el regreso.

La ejecución de `test_quiz_integrity_browser.mjs` en este entorno no arrancó: falta el módulo `playwright` (`MODULE_NOT_FOUND`). Por tanto, la reconstrucción todavía requiere verificación visual en navegador, móvil y tablet. No se publicó esta reconstrucción.

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
