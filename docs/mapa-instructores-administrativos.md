# Mapa de acceso del instructor administrativo

[Véase el mapa general](mapa-del-sitio.md) para las convenciones de rutas y la persistencia compartida.

`DashboardInstructor.jsx` habilita Administración General para `Creador` y `Administrador`. El botón del panel docente abre un menú lateral con los cuatro módulos. La regla compartida en `shared/instructorRoles.mjs` interpreta el valor histórico `Admin` como `Administrador`. La API exige acceso administrativo para crear, editar o eliminar instructores y para modificar secciones, temario, ponderaciones y semanas.

| Módulo global | Dónde consultar para cambiarlo |
| --- | --- |
| Gestión de usuarios instructores | `UserManagementView.jsx`, `UserManagementModal.jsx`, `auth.routes.js` y `auth.controller.js`. Revisa el middleware de sesión y las validaciones de cada operación de cuentas. |
| Gestión de secciones | `SectionManagementView.jsx`, `SectionManagementModal.jsx`, `SectionInstructorsModal.jsx` y `/api/secciones`. Sigue `secciones.routes.js` y `secciones.controller.js` para cambios en horarios, coordinación o instructores asignados. |
| Gestión de temario y ponderaciones | `TemarioManagementView.jsx`, `TemarioManagementModal.jsx`, `PuntajesManagementModal.jsx` y `/api/temario`, incluido `/api/temario/puntajes`. Consulta `temario.controller.js` y `create_career_tables.sql` para la configuración por carrera. |
| Definición de semanas | `WeekDefinitionView.jsx`, `/api/semanas` y `semanas.controller.js`. Si cambia la identificación de semanas regulares o de examen, revisa también `client/src/utils/academicEngine.js`. |

## Relación con las secciones

La lista **Mis secciones** usa el filtro de coordinación o asignación del panel. Para operar dentro de una sección, consulta el [mapa del instructor](mapa-instructores.md). La función `isInstructorTitular` en `client/src/utils/sectionRoleUtils.js` comprueba la identidad frente al coordinador de la sección. El acceso global de administrador es independiente de esa condición.

## Migración de datos

Las cuentas con rol `Creador` pueden mantener varias sesiones simultáneas. La API registra cada una en `public.creator_sessions` y revoca únicamente la sesión que se cierra. La tabla se crea con `server/src/db/creator_concurrent_sessions_migration.sql`. Los demás instructores conservan la sesión única.

Antes de ejecutar `server/src/db/instructor_roles_migration.sql`, confirma el proyecto, los valores actuales de `instructores.rol` y el nombre de la restricción vigente. La migración normaliza los roles conocidos y agrega la restricción de valores canónicos dentro de una transacción.
