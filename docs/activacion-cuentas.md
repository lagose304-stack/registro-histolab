# Activación de cuentas por correo

## Corrección de códigos y diagnóstico · 9 de noviembre de 2026

El correo de códigos usa `services/activationEmailTemplate.js`: formato MIME `multipart/alternative`, con versión de texto y HTML UTF-8. La plantilla adapta tablas y estilos integrados a pantallas pequeñas, destaca el código completo y su vigencia, y no necesita imágenes ni recursos externos. `gmailSender.js` conserva el transporte Gmail y la validación de códigos de seis u ocho cifras. `node server/scripts/test_activation_email.mjs` comprueba el MIME, los ceros iniciales y el rechazo de inyección de encabezados; los recorridos de activación prueban ambas versiones del mensaje sin enviar correos reales.

Incidencia resuelta y recorrido real confirmado por el usuario. Los límites de solicitudes están reactivados: una solicitud por correo cada 600 segundos, compartida entre activación y recuperación. `activationRequestLimit.js` reserva el plazo mediante la clave única de `account_activation_limits` y actualización condicionada para resistir concurrencia entre servidores. Sustituye para este flujo los antiguos límites de minuto/hora/día. El formulario recibe `resendAfter=600`; una respuesta 429 incluye el tiempo restante en `Retry-After` y `retryAfter`. Se reinician una sola vez los contadores de solicitudes existentes al publicar; se conservan los desafíos, cuentas, contraseñas y el presupuesto global de Gmail. La pausa de diagnóstico descrita debajo queda como historial.

Supabase genera actualmente códigos de ocho cifras. La API, Gmail y el formulario aceptan códigos de seis u ocho cifras para conservar compatibilidad; Auth sigue validando el código completo. Las pruebas aisladas se ejecutan con ambas longitudes (`TEST_ACTIVATION_OTP_LENGTH=8` para ocho).

Por autorización del usuario, `ACCOUNT_ACTIVATION_RATE_LIMITS_ENABLED=false` pausa temporalmente los límites de solicitudes por correo e IP durante la incidencia. El valor ausente o `true` los activa. Se conservan Turnstile, el presupuesto global de correo, el vencimiento, los intentos de PIN y los desafíos de un uso. Volver a `true` al cerrar la incidencia. No se borran contadores ni se reinician contraseñas.
## Acceso estudiantil exclusivo con Auth · 9 de noviembre de 2026

Se retiró la columna `contrasena` de las cinco tablas estudiantiles y el acceso con contraseñas históricas. Las cuentas sin identidad Auth, correo o activación completa requieren primer ingreso por correo, aunque una bandera histórica indique lo contrario. El cambio de contraseña continúa usando únicamente Auth. Los correos faltantes se completan manualmente en Editar estudiante; nunca se sustituye un correo real por un valor inventado.

En RegistroHisto (`dghmrqyxrjgxceolqplt`) se verificaron antes de la migración 29 estudiantes de Medicina, todos sin correo y sin vínculo Auth. Tras la confirmación explícita del usuario se aplicaron `20261109020000_student_auth_only.sql` y `20261109021000_student_account_deletion.sql`; la consulta posterior confirmó cero columnas antiguas, 29 estudiantes conservados, 29 pendientes de activación y 29 correos pendientes. No se borraron matrículas para probar el sistema en producción.

La eliminación desde el panel comprueba que la identidad no pertenezca a otro estudiante ni a un instructor, prepara una autorización interna ligada a esa ficha y elimina mediante Supabase Auth. Las cascadas y los disparadores retiran en la misma transacción la ficha, sus desafíos, entregas, reposiciones y presencia/respuestas en vivo de las secciones correspondientes. Si falla la limpieza o Auth, la transacción conserva la ficha; la API no utiliza el respaldo local para fingir éxito. Una identidad compartida o cambiada concurrentemente bloquea el borrado. Los perfiles pendientes sin Auth se eliminan por ID con comprobación de vínculo nulo. Esta garantía corresponde al flujo del panel; no se debe sustituir por borrados manuales de filas en Supabase.

El respaldo local de estudiantes también se limpió de contraseñas, conservando el resto de sus datos. Las pruebas de API y SQL usan proveedores y bases aisladas: incluyen rollback completo, identidad compartida, protección de instructores, permisos de servidor e idempotencia. El diálogo de eliminación se verificó con datos ficticios en 320×568, 568×320, 768×1024 y 1024×768, incluyendo fallo de Auth y reintento.

Publicación aislada actualizada: Worker `7a7fc090-c86a-4838-8f47-0647d347616e`, Pages `9e0b2d9f`. No se modificó Atlas. Las secciones siguientes conservan el historial anterior a esta eliminación definitiva de las contraseñas históricas.

## Estado de puesta en marcha · 8 de noviembre de 2026

**Publicación completada.** Se renovó Gmail después de pasar OAuth a producción y se actualizaron sus secretos exclusivamente en `registro-histolab`. Google aceptó la renovación y confirmó el permiso `gmail.send`, sin otro envío de prueba. Se publicaron el Worker `575aa127-7b1e-4e5b-88de-bc8f7b5b85f7` y Pages `a3ab4bd0`. La URL pública devuelve activación habilitada, la clave pública de Turnstile correcta y API saludable; inicio, privacidad y condiciones responden HTTP 200. La marca OAuth sigue sin verificar, un estado distinto de la publicación OAuth en producción.

El paquete de cuentas se preparó en `.wrangler/accounts-release` desde `68ef5f9`, incorporando activación, recuperación, cambio de contraseña, formularios de correo y permisos de matrícula. La integración de Mi cuenta y la separación de matrículas se aplicaron sin incorporar el rediseño administrativo ni los cambios pendientes de reposiciones, notas y programación. El registro y la edición de estudiantes mantienen el correo para activación, sin contraseñas administrativas. No se modificó Atlas.

Las pruebas se ejecutaron sobre esa copia local: SQL y controladores aislados, acceso y cambio de contraseña para ambos perfiles, matrícula y permisos; 16 recorridos de activación/recuperación entre dos perfiles y cuatro tamaños (320×568, 568×320, 768×1024 y 1024×768), con CAPTCHA y proveedores simulados. Se verificó que los archivos del cliente no contienen las credenciales privadas. No se activaron ni restablecieron cuentas reales como prueba en producción.

Los párrafos siguientes conservan el historial de configuración previo a la publicación; sus pendientes de despliegue ya están resueltos por el estado anterior.

Actualización: Google muestra OAuth en producción (marca todavía sin verificar). Se creó el widget Turnstile «Registro HistoLab · Acceso por correo», modo Managed, únicamente para `registrohistolab.pages.dev`, sin pre-clearance. Sus claves se guardaron en los archivos privados ignorados y, junto con las credenciales de Gmail, en secretos del Worker `registro-histolab`; Atlas no se modificó. El controlador comprueba el resultado HTTP, la presencia y longitud del token y el hostname esperado (`TURNSTILE_EXPECTED_HOSTNAME`). Las pruebas aisladas rechazan respuestas de Atlas y dominios ausentes.

La actualización de la función de recuperación se aplicó mediante SQL Editor al proyecto `dghmrqyxrjgxceolqplt` (RegistroHisto). La consulta posterior confirmó `recovery_ready=true`, emisión para `anon=false`, `authenticated=false` y `service_role=true`. No se ejecutaron flujos de recuperación sobre cuentas reales. Queda pendiente completar la nueva autorización Gmail emitida después del paso a producción, actualizar su secreto si cambia y preparar/publicar la versión de cuentas; la ruta pública de activación todavía no está desplegada.

Gmail quedó autorizado de forma privada. La prueba local de transporte al propio remitente fue aceptada por Gmail y el usuario confirmó su llegada a Recibidos; no se modificaron contraseñas ni cuentas reales.

Se publicaron `/privacidad/` y `/condiciones/` en `https://registrohistolab.pages.dev`, con enlaces y descripción del servicio en el inicio. Las direcciones se guardaron en la información de marca de Google. Publicación de Pages: `ecb136db`. Se construyó desde una copia de `68ef5f9`, cuyos archivos principales compilados coincidían con los de producción, agregando únicamente esas páginas y los enlaces. Los cambios pendientes de autenticación y otros módulos no se publicaron. Las páginas se comprobaron localmente en 320×568, 568×320, 768×1024 y 1024×768, también sin JavaScript; en línea se confirmó disponibilidad HTTP 200 y respuesta saludable de la API.

Pendiente para el sistema de contraseñas en producción: completar publicación/configuración OAuth de Google, configurar Turnstile, aplicar las migraciones, transferir los secretos a Cloudflare y publicar la versión correspondiente de servidor y cliente. La prueba de transporte de correo no equivale a una prueba completa de recuperación contra cuentas reales.

El primer ingreso se abre desde `LoginInstructor.jsx` para estudiantes e instructores. `AccountActivationView.jsx` solicita el correo registrado, verifica un PIN de seis cifras y pide contraseña y confirmación. No guarda la autorización temporal en el navegador ni abre una sesión académica antes de terminar.

La opción «Olvidé mi contraseña» abre el mismo formulario en modo recuperación (`purpose: "recovery"`). Permite restablecer cuentas ya activadas y completar la transición de perfiles históricos con correo registrado. El modo de primer ingreso conserva el rechazo de cuentas ya activadas. Ambos comparten límites, CAPTCHA, desafíos de un uso y la invalidación de sesiones al guardar. El correo no permite elegir identidad, sección ni rol.

Aplicar después de la migración inicial `supabase/migrations/20261108060000_account_recovery.sql`. Es aditiva e idempotente; permite emitir desafíos para cuentas ya activadas mediante la API privilegiada. No modifica contraseñas ni perfiles existentes por sí sola.

## Flujo y persistencia

`client/src/services/api.js` llama a `/api/auth/activation/status`, `/request`, `/verify` y `/finish`, montados en `auth.routes.js`. `accountActivation.controller.js` vincula cada solicitud con una ficha activa y su identidad de Supabase Auth. No permite matricularse, escoger un rol ni cambiar de sección durante la activación. El correo activo es único entre los perfiles.

Supabase genera y comprueba el PIN. `gmailSender.js` envía el mensaje mediante Gmail API con permiso exclusivo de envío, sin leer la bandeja. La contraseña se guarda en Supabase Auth; al completar la activación se elimina la contraseña histórica del estudiante y se invalidan las sesiones anteriores de HistoLab.

La migración `supabase/migrations/20261108041109_account_activation.sql` incorpora correo e identidad Auth estudiantil, banderas de activación y tablas de solicitudes y límites. Estas tablas no admiten acceso de los roles públicos. Los códigos no se almacenan en esas tablas. La autorización temporal se almacena como HMAC y vence a los cinco minutos.

## Límites

El PIN vence a los diez minutos y admite cinco intentos. Hay una espera de un minuto entre solicitudes y límites de tres por hora y diez al día por correo, persistidos en la base de datos. El presupuesto global reserva como máximo 400 intentos de envío por 24 horas. Los bloqueos y reservas evitan guardados simultáneos del mismo desafío; el reintento tras una respuesta perdida es idempotente.

En producción se exige Turnstile antes del envío. El formulario no consulta al servidor por cada dígito ni durante la cuenta regresiva. El acceso académico continúa comprobando el perfil y la matrícula autoritativos.

## Configuración privada y puesta en marcha

Las variables aparecen sin secretos en `server/.env.example`. El remitente se conecta mediante `server/scripts/setup_gmail_oauth.mjs`, con retorno local `http://127.0.0.1:43175/callback`. Guarda la autorización solo en los archivos privados ignorados `server/.env` y `.dev.vars`; nunca debe incluirse un archivo de cliente OAuth ni un token en Git. La aplicación OAuth debe salir del modo de pruebas para evitar la caducidad de siete días de la autorización de Gmail.

Antes de habilitar `ACCOUNT_ACTIVATION_ENABLED=true`, aplicar la migración al proyecto correcto, conectar Gmail, configurar Turnstile en producción y comprobar una entrega al remitente. La configuración local no actualiza automáticamente los secretos ni la publicación de Cloudflare.

La recuperación requiere también la migración `20261108060000_account_recovery.sql` antes de publicar el servidor. Sin credenciales de Gmail y, en producción, Turnstile, el servicio permanece deshabilitado y el formulario informa su indisponibilidad. Nunca habilitar el indicador como sustituto de la conexión del remitente.

La transición es aditiva: los perfiles existentes mantienen inicialmente su acceso. Hay que registrar y comprobar sus correos antes de exigirles activación; los perfiles nuevos la requieren. No marcar masivamente perfiles antiguos sin correo, pues impediría su entrada. Durante esta transición los perfiles históricos sin identidad Auth conservan su comprobación de contraseña anterior. Después de activar, solo se usa Supabase Auth y no se guarda contraseña en la ficha.

Solo Administración General y el titular pueden modificar matrícula y correo de estudiantes. El dueño establece su contraseña mediante activación o Mi cuenta; la edición administrativa rechaza contraseñas proporcionadas directamente.

## Verificación aislada

`test_account_activation_sql.mjs` comprueba la migración, permisos, límites, concurrencia y reintentos con PGlite. `test_account_activation.mjs` prueba el controlador contra esa base aislada y proveedores simulados, sin enviar correos reales ni alterar cuentas. `test_student_auth_flow.mjs`, `test_instructor_password.mjs` y `test_student_enrollment.mjs` cubren las rutas existentes afectadas.

`npm run test:accounts` ejecuta las comprobaciones aisladas de activación, recuperación, acceso y cambio de contraseña. PGlite forma parte de las dependencias de desarrollo. Las pruebas también comprueban que recuperar una cuenta activada cierra su sesión anterior, que el reenvío invalida la autorización previa y que una autorización no sirve para otro desafío.
