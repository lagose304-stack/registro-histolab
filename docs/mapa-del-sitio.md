# Mapa de Registro HistoLab

## Mapas por perfil

- [Estudiantes](mapa-estudiantes.md) — acceso al portal, notas, pruebas y entregas propias.
- [Instructores comunes](mapa-instructores.md) — secciones asignadas o coordinadas, funciones semanales y facultades del titular.
- [Instructores administrativos](mapa-instructores-administrativos.md) — Administración General para Creador y Coordinador, y su relación con los permisos de sección.

Los mapas describen el acceso que presenta la interfaz. Para confirmar la autorización efectiva de una operación, consulta la ruta y su controlador.

## Referencias compartidas

- **Información pública del servicio.** `client/public/privacidad/index.html` y `client/public/condiciones/index.html` se sirven sin sesión ni JavaScript en `/privacidad/` y `/condiciones/`. Comparten `client/public/informacion.css`; el inicio de sesión enlaza ambas y describe la finalidad del servicio. Se incluyen como archivos estáticos al compilar y publicar Pages.

- **Registro de muestras histórico.** Los componentes `RegistroForm.jsx`, `RegistroList.jsx`, `RegistroModal.jsx`, `FilterBar.jsx` y `StatsCards.jsx` permanecen como código histórico y no tienen entrada en el `App.jsx` actual. Su API sigue en `/api/registros`, `registros.controller.js` y `server/src/db/database.js`; no debe confundirse con los portales académicos activos.
- **Apariencia y navegación.** Consulta `client/src/index.css`, `client/src/components/Navbar.jsx` y `client/src/utils/navigationState.js`.
  En el portal docente, el logo y la marca del encabezado vuelven al panel inicial mediante `App.jsx`: limpian la navegación persistida y reinician el panel sin recargar la página ni cerrar la sesión. El botón de Administración General permanece separado de ese acceso.
- **Avisos y recuperación.** `Notification.jsx` presenta avisos compartidos adaptados al ancho disponible. `main.jsx` envuelve ambos portales con `ErrorBoundary.jsx`, que permite recargar o volver al inicio sin mostrar errores internos. Las ventanas de secciones y asignación de instructores comparten el diálogo de administración en `DashboardInstructor.css`; conservan el foco dentro de la ventana y bloquean el cierre durante el guardado. La asignación solo cambia el listado tras confirmar la respuesta de la API y muestra los errores dentro de la ventana.
- **Ubicación de archivos.** Las vistas sin ruta explícita están en `client/src/components/`. Las rutas, los controladores y los archivos SQL se encuentran en `server/src/routes/`, `server/src/controllers/` y `server/src/db/`.
## Flujos que cruzan módulos

- **Primer ingreso y contraseñas.** [Activación y recuperación de cuentas](activacion-cuentas.md) describe el correo registrado, PIN, Supabase Auth, envío con Gmail, «Olvidé mi contraseña» y la transición de los perfiles históricos. Ambos procesos usan `/api/auth/activation/*`; `purpose` distingue la solicitud de primer ingreso de la recuperación.

- **Eliminación de estudiantes.** El panel llama al controlador de estudiantes y a `server/src/services/studentAccountDeletion.js`. La eliminación de Auth activa las cascadas y la limpieza transaccional de `20261109021000_student_account_deletion.sql`; una autorización privada protege la identidad de otros perfiles. `20261109020000_student_auth_only.sql` retira la columna de contraseñas históricas. Las comprobaciones aisladas están en `test_student_deletion_api.mjs` y `test_student_deletion_sql.mjs`.

- **Reposiciones individuales.** [Reposiciones de estudiantes](reposiciones-estudiantes.md) conecta la solicitud del titular, la asignación de Administración General, la sección receptora y el portal del alumno. La matrícula no cambia; solo la práctica autorizada utiliza la prueba receptora y las notas se guardan en origen. Es un flujo distinto de las reposiciones del horario de una sección completa.

- **Permisos.** El panel decide qué sección y módulos muestra. Las utilidades del cliente distinguen funciones como instructor titular y asignaciones semanales. Para verificar el acceso efectivo, sigue cada endpoint desde su ruta hasta el middleware o las comprobaciones del controlador. El servidor maneja JWT en los flujos de autenticación.
- **Calificaciones.** El motor académico combina estudiantes, notas, temario, semanas y ponderaciones. Resuelve las claves de manuales, pruebas y parciales, incluidas variantes históricas. Antes de modificar una fórmula o clave, contrasta el resultado en el libro, el portal y la exportación con los mismos datos.
- **Evaluaciones.** Creación, entrega y calificación tienen rutas distintas. El estado en vivo comparte el archivo de rutas de pruebas y tiene su propio controlador. Al cambiar una prueba en vivo, sigue tanto el control docente como la entrada del estudiante.
- **Persistencia.** `server/src/db/supabase.js` decide si el cliente de Supabase está configurado. El registro encapsula sus operaciones en `database.js`. Varios controladores académicos acceden a Supabase directamente y contemplan archivos locales en `server/data/`. Consulta cada rama para determinar dónde se lee y escribe. Para cambios de tablas, revisa `schema.sql` y las migraciones del área.
- **Entornos.** `client/vite.config.js` define el proxy local. `server/src/index.js` inicia la API local y `server/src/worker.js` la adapta a Cloudflare. `server/src/app.js` registra todas las familias de rutas, incluida `/api/health`. La configuración del Worker está en `wrangler.toml`.

## Verificar un cambio

Usa la llamada correspondiente de `client/src/services/api.js` para rastrear la URL, los parámetros y el encabezado de sesión. Comprueba la vista que escribe y la vista que vuelve a leer. Para fórmulas y formatos, consulta `server/scripts/test_academic_integrity.js`. Para entender escenarios de prueba y persistencia, lee `server/scripts/test_pruebas_workflow.js` y `server/scripts/test_persistence_audit.js` antes de ejecutarlos, ya que escriben y pueden borrar datos.

La autenticación, proyección de datos y política de integridad de las evaluaciones se detallan en [Seguridad e integridad de pruebas](seguridad-pruebas.md), junto con las pruebas aisladas y los requisitos de producción.


## Dirección pública gratuita

La entrada pública es `https://registrohistolab.pages.dev`. Cloudflare Pages sirve la misma compilación del cliente y envía únicamente `/api` y `/api/*` al Worker existente mediante el enlace interno `HISTOLAB_API`. `cloudflare/pages-worker.mjs` conserva métodos, parámetros, cuerpo, encabezado de autorización y errores de la API. No contiene credenciales ni consulta directamente Supabase. Los archivos estáticos no invocan la función.

`cloudflare/wrangler.toml` configura Pages y el enlace al servicio `registro-histolab`; `wrangler.toml` en la raíz conserva la configuración de Express en Workers. `scripts/prepare-pages.mjs` prepara exclusivamente la salida generada en `.wrangler/pages-site`, excluida de Git. No se registró un dominio de pago.

- `npm run deploy` compila y publica el servidor y después la entrada de Pages con la misma compilación.
- `npm run deploy:pages` actualiza únicamente la entrada pública y sus archivos del cliente.
- `npm run deploy:worker` actualiza únicamente el servidor interno.
- `node server/scripts/test_pages_gateway.mjs` verifica el contrato del enlace interno sin solicitudes reales.

La nueva dirección tiene su propio almacenamiento de sesión del navegador: los usuarios deben iniciar sesión al entrar por ella. El servidor y la base de datos son los mismos. La dirección antigua `registro-histolab.7w7.workers.dev` está desactivada y devuelve HTTP 404. `workers_dev = false` en `wrangler.toml` evita reactivarla en publicaciones posteriores; Pages sigue conectando al servidor mediante el enlace interno, sin depender de esa dirección pública.
