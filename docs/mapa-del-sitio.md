# Mapa de Registro HistoLab

## Mapas por perfil

- [Estudiantes](mapa-estudiantes.md) — acceso al portal, notas, pruebas y entregas propias.
- [Instructores comunes](mapa-instructores.md) — secciones asignadas o coordinadas, funciones semanales y facultades del titular.
- [Instructores administrativos](mapa-instructores-administrativos.md) — Administración General para Creador y Coordinador, y su relación con los permisos de sección.

Los mapas describen el acceso que presenta la interfaz. Para confirmar la autorización efectiva de una operación, consulta la ruta y su controlador.

## Referencias compartidas

- **Registro de muestras.** Sigue `client/src/App.jsx` y los componentes `RegistroForm.jsx`, `RegistroList.jsx`, `RegistroModal.jsx`, `FilterBar.jsx` y `StatsCards.jsx` hasta `/api/registros`, `registros.controller.js` y `server/src/db/database.js`.
- **Apariencia y navegación.** Consulta `client/src/index.css`, `client/src/components/Navbar.jsx` y `client/src/utils/navigationState.js`.
- **Ubicación de archivos.** Las vistas sin ruta explícita están en `client/src/components/`. Las rutas, los controladores y los archivos SQL se encuentran en `server/src/routes/`, `server/src/controllers/` y `server/src/db/`.
## Flujos que cruzan módulos

- **Permisos.** El panel decide qué sección y módulos muestra. Las utilidades del cliente distinguen funciones como instructor titular y asignaciones semanales. Para verificar el acceso efectivo, sigue cada endpoint desde su ruta hasta el middleware o las comprobaciones del controlador. El servidor maneja JWT en los flujos de autenticación.
- **Calificaciones.** El motor académico combina estudiantes, notas, temario, semanas y ponderaciones. Resuelve las claves de manuales, pruebas y parciales, incluidas variantes históricas. Antes de modificar una fórmula o clave, contrasta el resultado en el libro, el portal y la exportación con los mismos datos.
- **Evaluaciones.** Creación, entrega y calificación tienen rutas distintas. El estado en vivo comparte el archivo de rutas de pruebas y tiene su propio controlador. Al cambiar una prueba en vivo, sigue tanto el control docente como la entrada del estudiante.
- **Persistencia.** `server/src/db/supabase.js` decide si el cliente de Supabase está configurado. El registro encapsula sus operaciones en `database.js`. Varios controladores académicos acceden a Supabase directamente y contemplan archivos locales en `server/data/`. Consulta cada rama para determinar dónde se lee y escribe. Para cambios de tablas, revisa `schema.sql` y las migraciones del área.
- **Entornos.** `client/vite.config.js` define el proxy local. `server/src/index.js` inicia la API local y `server/src/worker.js` la adapta a Cloudflare. `server/src/app.js` registra todas las familias de rutas, incluida `/api/health`. La configuración del Worker está en `wrangler.toml`.

## Verificar un cambio

Usa la llamada correspondiente de `client/src/services/api.js` para rastrear la URL, los parámetros y el encabezado de sesión. Comprueba la vista que escribe y la vista que vuelve a leer. Para fórmulas y formatos, consulta `server/scripts/test_academic_integrity.js`. Para entender escenarios de prueba y persistencia, lee `server/scripts/test_pruebas_workflow.js` y `server/scripts/test_persistence_audit.js` antes de ejecutarlos, ya que escriben y pueden borrar datos.
