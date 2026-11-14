# Seguridad y funcionamiento de pruebas

La implementación se verificó con datos aislados y se publicó en Cloudflare el 7 de noviembre de 2026. La migración de permisos se aplicó y verificó en el proyecto correcto mediante su panel de Supabase. La conexión de Supabase de Codex sigue mostrando otra organización; el acceso al proyecto se realizó desde la sesión abierta del propietario. No se modificaron respuestas ni calificaciones.

## Controles aplicados

- `quizAccess.middleware.js` autentica todas las rutas de pruebas y verifica cuenta, sección, semana y función asignada. La identidad enviada en el cuerpo no decide quién entrega. Calificar o eliminar una entrega verifica su registro real. El servidor aplica la ventana de programación; únicamente el rol global Creador de la cuenta autenticada puede habilitar y dirigir pruebas fuera de fecha y horario. Coordinador y titular no reciben esa excepción.
- `quizPrivacy.mjs` entrega al estudiante una proyección sin claves, modelos ni respuestas esperadas. Los términos pareados conservan términos y un banco de definiciones independiente, sin revelar la asociación correcta. Las consultas en vivo no entregan nombres, IP ni respuestas de compañeros. Los borradores permanecen fuera del catálogo estudiantil.
- La corrección usa la clave guardada en el servidor. La entrega exige una prueba publicada y una sesión iniciada. Los reintentos de entregas selladas son idempotentes, incluso para pruebas manuales; las respuestas originales prevalecen. La restricción única de la base y un bloqueo local por entrega evitan duplicados concurrentes.
- Una falla al verificar la sesión central produce un error recuperable en lugar de reactivar una sesión vieja del proceso.

## Registro de salidas y tres faltas (13 de noviembre de 2026)

La política `salidas-tres-faltas-v1` observa pérdida de foco de la ventana, página oculta, abandono/recarga del documento y cierre voluntario de sesión desde el portal. Una salida abre un episodio y cuenta una sola falta aunque produzca varios eventos. El regreso se registra solo al pulsar «Regresar a la prueba», con la página visible y enfocada. Volver a la ventana no detiene el plazo. Rotación, teclado, tamaño de ventana, selección, copiar/pegar e impresión no generan faltas por sí mismos. No se exige la API de pantalla completa ni se vigila el portapapeles. La primera y segunda faltas presentan un aviso a pantalla completa con diez segundos, iniciado en la hora declarada de salida. Si vence sin confirmar el regreso, se envían las respuestas existentes por falta grave. La hora original persiste al recargar y se comprueba al volver del segundo plano; el sistema operativo puede suspender la ejecución y demorar el envío hasta reanudarla. La tercera cierra la edición y envía las respuestas existentes, incluso en la sala de espera.

`QuizActivityConsent.jsx` explica y registra la aceptación antes de crear el intento. `useQuizActivity.js` conserva el identificador asignado por el servidor, el contador y los eventos pendientes. `quizActivityObserver.mjs` solo observa señales del navegador. El contador se recupera del servidor al restaurar y no vuelve a cero por recargar o aceptar nuevamente. Los borradores anteriores a esta política requieren aceptación antes de continuar.

Antes de solicitar la entrega se guarda una copia exacta de respuestas y eventos pendientes. Una falla de red mantiene esa entrega cerrada para edición y reintenta al recuperar conexión, al recargar y cada cinco segundos mientras esté pendiente. Las solicitudes son idempotentes. El servidor confirma los eventos antes de guardar la entrega; su contador decide el motivo `limite_tres_faltas`. No se descartan respuestas ni se registra una anulación. Se conservan preguntas, tipos de respuesta, orden, programación, tiempos, sincronización docente, notas y corrección automática.

## Registro independiente y permisos

El vencimiento se registra en la entrega como `motivo_finalizacion: falta_grave_tiempo` y `auditoria.actividad.falta_grave`, vinculado al episodio de salida. El servidor comprueba que el episodio siga abierto y que hayan transcurrido diez segundos según su hora declarada antes de aceptar ese motivo; no transforma una salida en tres faltas. La revisión docente muestra el motivo grave. Se conserva el esquema existente, sin otra migración. La tercera falta sigue finalizando de inmediato. La hora del dispositivo sigue siendo una declaración del cliente, no una prueba infalible.

`server/src/services/quizActivity.js` usa Supabase cuando está configurado y un archivo local con escritura atómica en desarrollo. Un error de Supabase no se sustituye silenciosamente con el archivo local. La migración `supabase/migrations/20261113214049_quiz_activity_journal.sql` crea `quiz_activity_attempts`, `quiz_activity_events` y la función transaccional `append_quiz_activity`. Debe aplicarse al proyecto de HistoLab antes de publicar este código. La conexión MCP disponible corresponde a otro proyecto: no se aplicó allí.

Cada registro contiene intento, matrícula, cuenta, sección, prueba, versión de reglas y aceptación; cada evento conserva identificador, episodio, señal, falta, pregunta, hora del dispositivo y hora de recepción del servidor. Los regresos se agregan como eventos separados y permiten estimar la duración declarada sin sobrescribir la salida. El orden de recepción se conserva mediante una secuencia de base de datos. La función bloquea el intento durante la transacción y deduplica identificadores y episodios, por lo que reintentos o solicitudes concurrentes no añaden faltas dobles.

Las tablas tienen RLS y no conceden acceso a `anon` ni `authenticated`. La API solo puede leer e insertar eventos, sin UPDATE/DELETE. Las rutas reutilizan `authenticateQuiz` y `quizAccess`: el alumno registra únicamente su intento y el docente necesita permiso de revisión de la semana para consultar otra cuenta. La consulta y el registro no exponen claves de corrección ni datos de compañeros.

Rutas:

- `POST /api/pruebas/seccion/:seccion_id/semana/:semana/actividad/iniciar`: aceptación y recuperación del intento propio.
- `POST /api/pruebas/seccion/:seccion_id/semana/:semana/actividad/:intento_id`: registro de eventos propios.
- `GET /api/pruebas/seccion/:seccion_id/semana/:semana/actividad/estudiante/:numero_cuenta`: bitácora para el revisor autorizado.

La entrega incluye una copia del registro en `auditoria.actividad`, junto con los metadatos y la calificación automática existentes. `QuizActivityReview.jsx` consulta además la bitácora independiente, con error y reintento explícitos. Desde Control en vivo, el docente autorizado puede **Habilitar de nuevo** una entrega con la sala abierta e indicando el motivo. La migración `20261114023949_quiz_individual_reopening.sql` incorpora una función exclusiva de la API que conserva la entrega anterior en `auditoria.reaperturas`, registra docente, motivo y fecha, retira su nota y autoriza un borrador con las respuestas anteriores en la misma transacción. El intento y sus eventos permanecen en la bitácora; se retira el intento para permitir otro contador desde cero. La nueva aceptación permite continuar con la pregunta y el tiempo vigentes de la sala. Las preguntas anteriores siguen cerradas. Los envíos antiguos no reemplazan el borrador y las entregas nuevas usan comparación de versión. El archivo de reaperturas no se expone al estudiante. La eliminación docente histórica de entregas sigue disponible con sus permisos propios, pero no es necesaria para esta recuperación.

## Comprobación de foco y visibilidad

El observador también consulta foco y visibilidad cada segundo para cubrir estados que cambien sin emitir su evento. No penaliza dimensiones, teclado ni rotación. Esta comprobación no garantiza detectar ventanas flotantes en Android o iPadOS: si el navegador conserva foco y visibilidad, la superposición puede no producir ninguna señal observable. Debe contrastarse con el diagnóstico del mismo dispositivo.

## Entregas pendientes después de cerrar la sala

Si un envío sellado perdió `actividad_intento_id`, la API recupera únicamente la aceptación existente de la misma matrícula autenticada (ID y cuenta), sección, semana y prueba, sin reemplazo. No crea una aceptación, no reinicia faltas y no asocia envíos antiguos a una reapertura. El cliente también recupera la referencia y los eventos pendientes del almacenamiento de esa matrícula y prueba si el cierre llega antes del efecto de restauración. Si no hay aceptación, responde `QUIZ_ACCEPTANCE_NOT_FOUND` y conserva el sellado para revisión docente. Comprobaciones aisladas: `test_quiz_activity_recovery.mjs`, `test_quiz_activity_payload.mjs` y `test_quiz_submission_security.mjs`.

Una entrega con intento válido ya aceptado puede sincronizarse aunque el docente haya cerrado o reiniciado la sala y su estado sea `inactiva`. La API comprueba propietario, semana, prueba e intento no retirado antes de aceptarla; no permite crear un intento nuevo con la sala cerrada. El portal sella también cuando recibe el cierre directo, conserva las respuestas pendientes y muestra el mensaje de error de la API en esa pantalla. Si la resolución de sección falla, libera el bloqueo para que el siguiente envío pueda reintentar. La reapertura docente sigue requiriendo una sala abierta, una entrega registrada y la migración `20261114023949_quiz_individual_reopening.sql`; un error `QUIZ_REOPENING_UNAVAILABLE` identifica que falta su función y no elimina la entrega.

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

Se verificaron las transiciones del observador y la función SQL con PostgreSQL embebido: identidad, permisos, duplicados, concurrencia, rollback de lotes inválidos, conservación de registros y nuevos intentos. El navegador usa API simulada sin datos reales en 320×640, 640×360, 768×1024 y 1024×768. Comprueba aceptación, avisos a pantalla completa con regreso explícito y vencimiento por falta grave, envío único con respuestas exactas, recarga, fallo de red, restauración de la entrega cerrada, fin docente y lobby. Las capturas están en `artifacts/quiz-activity/`. La compilación mantiene la advertencia previa de tamaño del panel docente y no añade dependencias. Esta verificación corresponde al código local; no implica publicación ni aplicación de la migración en producción.

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

### Ventanas flotantes en iPad: diagnóstico pendiente en el dispositivo

Una ventana de otra aplicación superpuesta a Chrome puede dejar la prueba parcialmente visible y conservar sus dimensiones. El video revisado muestra uso de esa ventana con cero faltas, pero no revela los eventos recibidos por JavaScript. El observador actual escucha `blur`, `visibilitychange` y abandono del documento; un detector de tamaño tampoco demuestra que exista una ventana flotante. La [especificación de visibilidad](https://www.w3.org/TR/page-visibility-2/) permite que un documento parcialmente visible siga reportándose como `visible`. Este caso no se considera resuelto ni cubierto de forma universal.

`client/public/diagnostico-multitarea.html`, servido como `/diagnostico-multitarea.html` al publicar, permite reproducirlo sin una evaluación real. Registra eventos de foco y visibilidad, dimensiones, orientación y cambios de `visualViewport`; también consulta el estado cada medio segundo para identificar cambios que no vinieran acompañados de eventos. Las marcas manuales sirven de referencia y no se clasifican como detecciones. El informe se descarga en el dispositivo, sin solicitudes a la API, datos académicos ni texto del campo de prueba del teclado. Incluye la identificación del navegador para interpretar los resultados. No registra faltas ni modifica el sistema de Android. Antes de añadir una penalización, comprobar en el mismo iPad ventana flotante, pantalla dividida, cambio de aplicación, teclado y rotación. La prueba automatizada en Chromium verifica la captura y descarga, pero no reproduce el comportamiento del sistema operativo iPadOS.

### Diagnóstico automático durante las próximas pruebas

El aviso de `QuizActivityConsent.jsx` describe la recogida técnica. `useQuizActivity.js` solicita `diagnostico_version: 1` al iniciar; `beginQuizActivity` lo guarda únicamente al crear el nuevo intento. Un intento ya aceptado antes de ese aviso no se actualiza retroactivamente ni inicia la captura. La migración `20261114030710_quiz_automatic_diagnostics.sql` añade esa marca y el almacenamiento privado de lotes, y debe aplicarse antes de publicar esta función. Depende del registro de actividad original. No activa grabación de pantalla, cámara, micrófono ni permisos nuevos del navegador.

`quizDiagnosticsObserver.mjs` observa foco, visibilidad, dimensiones de ventana/pantalla/viewport, orientación, conexión y un indicador booleano de campo de escritura activo. Comprueba cambios de estado cada segundo y toma una muestra estable cada 30 segundos; agrupa ráfagas de eventos durante 250 ms. Cada muestra añade hora del dispositivo, índice de pregunta y contador de faltas observado. La identificación de navegador y sistema se reduce a familia y versión; cuando Safari se identifica como macOS en el iPad no se inventa una versión de iPadOS. No guarda texto de respuestas, teclas, contenido del portapapeles, URL, nombres de aplicaciones, imágenes, audio ni el User-Agent completo. `shared/quizDiagnostics.mjs` permite solo los campos y motivos definidos.

`quizDiagnosticsTransport.mjs` envía lotes de hasta 16 muestras cada 15 segundos o al ocultarse/terminar la prueba. Conserva la identidad del lote antes de enviarlo, mantiene una cola local de hasta 160 muestras pendientes y reintenta con espera progresiva o al recuperar conexión. Limita la captura a 640 muestras por ejecución/restauración y conserva el contador en el almacenamiento del intento. El servidor acepta como máximo 64 lotes por intento, con un máximo de 16 KiB por lote; permite confirmar lotes repetidos sin duplicarlos y sincronizar durante las 24 horas posteriores al cierre. La entrega, la nota, el reloj global y el contador de faltas no esperan a este transporte ni consumen sus datos. Los envíos al abandonar la página son de mejor esfuerzo y no garantizan un registro completo. Una interrupción prolongada o el bloqueo del almacenamiento también puede dejar huecos.

La ruta `POST /api/pruebas/seccion/:seccion_id/semana/:semana/actividad/:intento_id/diagnostico` exige la sesión estudiantil y la matrícula/semana del intento. `quizDiagnostics.controller.js` y `services/quizDiagnostics.js` vuelven a comprobar el propietario y la aceptación. Supabase guarda `quiz_diagnostic_batches` por intento mediante `append_quiz_diagnostic` (instructor anónimo/autenticado sin acceso directo, RPC exclusiva de `service_role`, `SECURITY INVOKER`, RLS y sin UPDATE/DELETE de lotes para la API). La rama local usa `server/data/quiz_diagnostics_data.json`, con bloqueo y escritura temporal. Si Supabase está configurado y falla, no se recurre al archivo local.

`GET /api/pruebas/seccion/:seccion_id/semana/:semana/diagnostico/estudiante/:numero_cuenta` exige permiso de revisión de esa sección y semana. `QuizDiagnosticsReview.jsx` lo consulta solo al abrir «Diagnóstico técnico de la prueba», dentro de `QuizActivityReview.jsx`, y permite descargar el JSON. Se presenta como información técnica incompleta y declarada por el navegador, sin clasificarla como una infracción ni afirmar detección de Slide Over. La ausencia de cambios observables tampoco descarta multitarea.

Verificación aislada: `node server/scripts/test_quiz_diagnostics.mjs`, `node server/scripts/test_quiz_diagnostics_sql.mjs` y `node server/scripts/test_quiz_diagnostics_api.mjs`. Se verificaron observación sin evento de foco, teclado/rotación sin faltas nuevas, campos permitidos, sesión/aceptación, consulta docente, permisos de base, límites bajo concurrencia, reintentos tras confirmación perdida y separación de la bitácora de faltas. `test_quiz_diagnostics_rollout.mjs` comprueba que, si al publicar falta exactamente la columna `diagnostico_version`, el inicio continúa sin diagnóstico usando el registro anterior; otros errores de base o permisos se mantienen visibles y no se ocultan. La reapertura queda indisponible hasta aplicar su función privada. El navegador verifica captura, fallo/reintento sin bloquear la prueba, lote final y descarga docente con datos ficticios. La compilación añade aproximadamente 2,6 KiB comprimidos al módulo del portal estudiantil y 2 KiB comprimidos al docente respecto de la versión local anterior; no se añaden dependencias ni solicitudes durante el inicio de sesión.
