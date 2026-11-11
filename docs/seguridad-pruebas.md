# Seguridad e integridad de pruebas

La implementaci�n se verific� con datos aislados y se public� en Cloudflare el 7 de noviembre de 2026. La migraci�n de permisos se aplic� y verific� en el proyecto correcto mediante su panel de Supabase. La conexi�n de Supabase de Codex sigue mostrando otra organizaci�n; el acceso al proyecto se realiz� desde la sesi�n abierta del propietario. No se modificaron respuestas ni calificaciones.

## Controles aplicados

- `quizAccess.middleware.js` autentica todas las rutas de pruebas y verifica cuenta, secci�n, semana y funci�n asignada. La identidad enviada en el cuerpo no decide qui�n entrega. Calificar o eliminar una entrega verifica su registro real. El servidor aplica la ventana de programaci�n; �nicamente el rol global Creador de la cuenta autenticada puede habilitar y dirigir pruebas fuera de fecha y horario. Coordinador y titular no reciben esa excepci�n.
- `quizPrivacy.mjs` entrega al estudiante una proyecci�n sin claves, modelos ni respuestas esperadas. Los t�rminos pareados conservan t�rminos y un banco de definiciones independiente, sin revelar la asociaci�n correcta. Las consultas en vivo no entregan nombres, IP ni respuestas de compa�eros. Los borradores permanecen fuera del cat�logo estudiantil.
- La correcci�n usa la clave guardada en el servidor. La entrega exige una prueba publicada y una sesi�n iniciada. Los reintentos de entregas selladas son idempotentes, incluso para pruebas manuales; las respuestas originales prevalecen. La restricci�n �nica de la base y un bloqueo local por entrega evitan duplicados concurrentes.
- Una falla al verificar la sesi�n central produce un error recuperable en lugar de reactivar una sesi�n vieja del proceso. Los contadores declarados de integridad se respaldan en los latidos existentes, sin nuevos sondeos, y no pueden disminuir mediante un latido posterior de la misma sesi�n.

## Pantalla completa, navegaci�n y advertencias (11 de noviembre de 2026)

La pol�tica `pantalla-completa-foco-v3` exige pantalla completa real antes de crear el intento. `quizFullscreen.mjs` comprueba la API est�ndar o WebKit y verifica el resultado; si el navegador no la admite o la rechaza, no se inicia. Un intento restaurado sin pantalla completa queda bloqueado por `QuizFullscreenGate.jsx` hasta recuperarla. Los campos quedan deshabilitados mientras se muestra una advertencia o confirmaci�n, durante el env�o y despu�s del sellado.

`quizIntegrity.mjs` observa `blur`, visibilidad y salida de pantalla completa. La advertencia es inmediata, sin tolerancia de dos segundos ni espera al regreso, desde la entrada hasta la finalizaci�n, incluidos lobby, pausas y di�logos. Un mismo episodio cuenta una vez aunque emita los tres eventos; se rearma cuando la p�gina est� visible, enfocada y en pantalla completa. La tercera advertencia bloquea la edici�n y env�a una �nica entrega con las respuestas actuales. Si falla el env�o, se conserva el payload sellado para reintentar. El servidor admite los motivos de finalizaci�n por salida o infracciones en el lobby habilitado; una entrega normal antes de iniciar sigue rechazada. Los reintentos no sustituyen las respuestas selladas.

`quizNavigation.mjs` mantiene el intento al pulsar Atr�s en el historial del mismo documento. El bot�n interno usa la misma confirmaci�n: salir finaliza y env�a; cancelar exige volver a pantalla completa. La p�rdida de pantalla completa muestra directamente la advertencia de integridad y cuenta una falta; no abre la confirmaci�n de entrega. La advertencia sustituye cualquier confirmaci�n abierta y solo permite continuar tras recuperar pantalla completa. Los di�logos no suspenden la detecci�n de salidas. Solo el env�o/sellado/finalizaci�n suspende nuevas advertencias. El cierre o recarga completa conserva el aviso nativo `beforeunload`, sujeto al navegador; no permite reemplazarlo por el di�logo de la aplicaci�n.

`App.jsx` registra el guardi�n de salida de `StudentPortalView.jsx`: el cierre de sesi�n voluntario de la barra superior abre la misma confirmaci�n mientras hay un intento activo. La caducidad o revocaci�n efectiva de una sesi�n conserva su manejo de autenticaci�n.

Cambiar de tama�o, rotar, abrir el teclado o usar gestos no genera advertencias si no provoca alguno de los eventos vigilados. Si un selector o una interrupci�n del sistema produce una p�rdida real de foco, la regla estricta tambi�n cuenta ese evento. Copiar/pegar y atajos restringidos contin�an bloqueados sin leer contenido privado del portapapeles. No se restaura el sondeo con `debugger`, la huella digital ni la medici�n de cadencia. La marca visible se conserva.

Las incidencias del navegador se etiquetan como informaci�n declarada, no como evidencia infalible. Una llamada o interrupci�n del sistema puede ocultar realmente la p�gina: el navegador no puede establecer su intenci�n. La revisi�n muestra esta limitaci�n y no atribuye autom�ticamente una captura o uso de IA. Tampoco puede impedir una c�mara externa, otro dispositivo o un navegador manipulado. El cat�logo conserva los enunciados para restaurar la evaluaci�n; no hay una garant�a de embargo de preguntas futuras. No se a�adi� c�mara, micr�fono, vigilancia remota ni dependencias.

## Verificaci�n reproducible sin datos reales

El contenido de `.quiz-player` permanece oculto y sin interacci�n por CSS salvo cuando la ra�z del documento est� en pantalla completa real (est�ndar o WebKit). Esto oculta tambi�n los enunciados durante la transici�n de salida, antes del siguiente renderizado de React. La confirmaci�n de respuestas vuelve a consultar el estado real del navegador. El aviso nativo que explica c�mo salir pertenece al navegador y el sitio no puede eliminarlo; tampoco puede impedir que el usuario o el sistema termine la pantalla completa. Los dispositivos sin soporte no pueden iniciar la prueba.

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

Las verificaciones hist�ricas de navegador correspond�an a la pol�tica anterior y no certifican la pol�tica estricta. `test_quiz_integrity.mjs` comprueba eventos inmediatos, deduplicaci�n, fallos de permisos de pantalla completa, env�o �nico y Atr�s repetido con datos aislados. `test_quiz_submission_security.mjs` incluye finalizaciones en lobby y conservaci�n de las respuestas originales. `test_quiz_integrity_browser.mjs` contiene la verificaci�n del portal con API simulada, pantalla completa, Atr�s, restauraci�n, sellado sin conexi�n y tama�os 320�640, 640�360, 768�1024 y 1024�768. Requiere Playwright y Chromium; acepta `HISTOLAB_PLAYWRIGHT_MODULE` y `HISTOLAB_CHROMIUM_PATH`. En esta revisi�n su ejecuci�n qued� bloqueada por el cierre de Chromium al arrancar en el entorno restringido; no se da por aprobada la comprobaci�n visual ni la de dispositivos f�sicos. La actualizaci�n del c�digo no implica una publicaci�n en producci�n.

## Estado de producci�n y cierre verificado

La direcci�n p�blica gratuita es `https://registrohistolab.pages.dev`. Pages conecta la API mediante un enlace interno al Worker; los secretos permanecen �nicamente en el servidor. Se verificaron HTTP 200 para la p�gina, salud y configuraci�n acad�mica, y HTTP 401 para consultas de pruebas sin sesi�n desde el nuevo dominio.

- Aplicada `secure_quiz_access_migration.sql` en el proyecto del sitio, con comprobaci�n de ausencia de pruebas activas y l�mite de cinco segundos de espera de bloqueo. La verificaci�n posterior confirm� que `anon` y `authenticated` no tienen SELECT, INSERT, UPDATE ni DELETE en ninguna de las tres tablas; `service_role` conserva esos permisos.
- Sustituida la clave privilegiada antigua en la configuraci�n privada por una clave moderna `sb_secret_.` del mismo proyecto. Se verific� acceso a las tres tablas sin leer filas de estudiantes. La firma JWT de la aplicaci�n se renov� con un valor aleatorio; los usuarios deben iniciar sesi�n nuevamente.
- `JWT_SECRET`, `SUPABASE_KEY` y `SUPABASE_SERVICE_ROLE_KEY` est�n publicados como secretos cifrados de Cloudflare. Los valores no est�n en `wrangler.toml`, en documentaci�n ni en archivos versionados. No se deben restaurar configuraciones antiguas con credenciales expuestas.
- Versi�n inicial del cierre de seguridad: `2f75491f-b31f-4c02-9919-85de9fc6ecf9`, en `https://registro-histolab.7w7.workers.dev`. Se verificaron p�gina principal y API con HTTP 200, y rutas de pruebas sin sesi�n con HTTP 401.
- El propietario desactiv� las API keys antiguas basadas en JWT. El panel muestra **Re-enable JWT-based API keys**, confirmando su estado desactivado. Se verific� que la clave privilegiada retirada devuelve HTTP 401 tanto como `apikey` como en `Authorization` acompa�ada por la clave p�blica moderna. El acceso p�blico directo tambi�n devuelve HTTP 401.
- Tras la retirada se verific� nuevamente el acceso de la clave moderna a las tres tablas con HTTP 200, sin leer filas. La p�gina principal, la API de salud y la configuraci�n acad�mica publicada responden con HTTP 200; las rutas de pruebas sin sesi�n mantienen HTTP 401. La retirada de las API keys antiguas es independiente de la renovaci�n de la firma JWT propia de HistoLab. La validaci�n no incluy� iniciar sesi�n como un alumno o instructor real ni alterar sus datos.

## Fuentes de los criterios

- [MDN: Page Visibility API](https://developer.mozilla.org/en-US/docs/Web/API/Page_Visibility_API): foco y visibilidad son se�ales diferentes.
- [MDN: VisualViewport](https://developer.mozilla.org/en-US/docs/Web/API/VisualViewport): el teclado y las interfaces del sistema cambian el �rea visible.
- [Supabase: seguridad de la API](https://supabase.com/docs/guides/api/securing-your-api): permisos de tabla y RLS son controles complementarios.
- [Cloudflare: secretos](https://developers.cloudflare.com/workers/configuration/secrets/): las credenciales sensibles deben configurarse como secretos, no como variables versionadas.

La direcci�n p�blica antigua de Workers est� desactivada: tanto su p�gina como `/api/health` devuelven HTTP 404. La entrada de Pages y su API siguen operativas mediante el enlace interno, con HTTP 200 en salud y configuraci�n acad�mica y HTTP 401 en pruebas sin sesi�n.

La revisi�n de regresi�n de instructores corrigi� compatibilidad de asignaciones y acceso al resumen de premios; los resultados y la versi�n posterior est�n en [Verificaci�n del panel de instructores](verificacion-instructores.md).
