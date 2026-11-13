# Mapa de acceso del instructor administrativo

[Véase el mapa general](mapa-del-sitio.md) para las convenciones de rutas y la persistencia compartida.

`DashboardInstructor.jsx` habilita Administración General para `Creador` y `Coordinador`. El botón del encabezado permanece disponible en el panel docente, las secciones y los módulos. El menú permite volver al panel docente y abrir los cinco módulos administrativos. La barra lateral usa un diálogo nativo adaptable al alto disponible, con cierre y perfil siempre visibles y desplazamiento independiente de los accesos. Separa Gestión general y Configuración académica, incluye descripciones breves y marca el módulo actual con `aria-current`. Se cierra al navegar, al tocar el fondo o con Escape, y devuelve el foco al botón del encabezado. El fondo queda bloqueado mientras está abierta. No añade consultas ni dependencias. La creación de cuentas ofrece Instructor como opción inicial y Coordinador como alternativa. La API usa los mismos roles para gestionar instructores, secciones, temario, ponderaciones y semanas.

| Módulo global | Dónde consultar para cambiarlo |
| --- | --- |
| Gestión de usuarios instructores | `UserManagementView.jsx` muestra el directorio y abre `UserManagementModal.jsx` desde Crear usuario o desde las acciones de cada cuenta. `DashboardInstructor.css` contiene los estilos de ambas vistas. Sigue `services/api.js`, `auth.routes.js` y `auth.controller.js` para revisar la sesión y las validaciones de cada operación. |
| Gestión de secciones | `SectionManagementView.jsx` comparte un directorio y un calendario semanal entre las áreas Secciones, Instructores y Estudiantes. Desde cada ficha se abre `SectionManagementModal.jsx`, `SectionInstructorsModal.jsx` o `SectionStudentsView.jsx` según el área. Los estilos están en `DashboardInstructor.css`. Sigue `secciones.routes.js` y `secciones.controller.js` para cambios en horarios, coordinación o instructores asignados. |
| Gestión de temario y ponderaciones | `TemarioManagementView.jsx` selecciona la carrera activa y separa Temas, Semanas y Puntajes. Desde Temas se abre `TemarioManagementModal.jsx` para editar una ficha o se copia otro temario. `TemarioWeeksWorkspace.jsx` asigna temas y configura clases y exámenes. `TemarioScoresWorkspace.jsx` calcula y guarda las ponderaciones. El orden de temas y semanas se previsualiza en `TemarioOrder.jsx` y se aplica al guardar. Sigue `/api/temario`, `/api/semanas` y sus controladores para la persistencia. |
| Definición de semanas | `WeekDefinitionView.jsx` organiza por parcial las fechas y la descripción de cada semana. El generador omite los recesos indicados y guarda el resultado como un hueco entre semanas. `shared/academicWeek.mjs` calcula la semana actual según la fecha de Honduras. `AcademicEventsView.jsx` abre las reposiciones y el calendario de exámenes. `/api/semanas/agenda` usa `academicAgenda.controller.js` para validar y guardar estas actividades por separado del horario habitual. |
| Reposiciones de estudiantes | `StudentMakeupsView.jsx` abre la bandeja de solicitudes del titular. Creador y Coordinador asignan una sección de la misma carrera y periodo que aún no inicia la práctica, o rechazan con motivo. `studentMakeups.controller.js` y `student_makeups_migration.sql` conservan la matrícula y sincronizan notas en origen. Es independiente de reprogramar una sección completa. Véase [Reposiciones individuales](reposiciones-estudiantes.md). |

## Relación con las secciones

En el control de pruebas en vivo, únicamente el rol global **Creador** puede habilitar e iniciar preguntas fuera de la fecha y horario de la sección. La excepción permite verificaciones y no se extiende a Coordinador, titular ni asignados. `canBypassQuizSchedule` en `shared/instructorRoles.mjs` se aplica en `LiveQuizControlView.jsx` y en `liveQuiz.controller.js`, usando en el servidor el rol vigente de la cuenta autenticada. Véase [Programación de pruebas](programacion-pruebas.md).

**Titular de sección** es una asignación por sección que se guarda en la columna histórica `secciones.coordinador`. El rol global **Coordinador** se guarda en `instructores.rol`.

Desde el área Estudiantes, el botón **Ver estudiantes** abre la matrícula de la sección elegida. El panel permite matricular, editar o eliminar desde el listado y acceder al cuadro de notas. Sigue `api.estudiantes` en `services/api.js`, `estudiantes.routes.js` y `estudiantes.controller.js` para las operaciones de matrícula.

Los formularios de alta manual permiten avanzar con Enter y retroceder con Mayús+Enter. Las flechas mueven el foco según la posición de los campos visibles. En el selector de rol, las flechas conservan su función de cambiar la opción. El registro se confirma con el botón del formulario.

En **Herramientas de la sección**, **Historial de calificaciones** permite a Coordinación y al Creador consultar quién cambió una calificación en esa sección y filtrar por cuenta. El flujo de guardado y consulta se describe en el [mapa de instructores](mapa-instructores.md).


La administración permite secciones de carreras distintas en el mismo horario. Dentro de una misma carrera y periodo, los horarios del mismo día no pueden traslaparse. Los códigos automáticos nuevos incluyen un sufijo de carrera, por ejemplo `MI1300-ENF`, para que cada sección conserve un código único.

**Mis secciones** muestra a cada docente las secciones que coordina o tiene asignadas. Debajo, Creador y Coordinador ven **Todas las secciones**, agrupadas por día y ordenadas por hora. La API de secciones aplica la misma visibilidad con `shared/sectionAccess.mjs`. `hasFullSectionAccess` en `client/src/utils/sectionRoleUtils.js` permite operar todos los módulos de sección a ambos roles globales y al titular de esa sección. Consulta el [mapa del instructor](mapa-instructores.md).

## Migración de datos

`server/src/db/academic_agenda_migration.sql` crea la agenda de reposiciones y exámenes. Las rutas de agenda requieren Administración General. Las reposiciones se sugieren dentro de una semana con fechas guardadas y toman en cuenta las actividades de la misma carrera. Una reposición guardada libera el horario habitual de su sección únicamente en la fecha original.

`WeeklyExamCalendar.jsx` muestra las semanas de examen con fechas guardadas. Arrastrar una sección o elegirla y tocar un bloque abre el formulario con la sección, la fecha y el horario precargados. Los cambios de exámenes se aplican en la cuadrícula y se envían a la API al pulsar **Guardar cambios**.

Publica primero el controlador de instructores actualizado y después aplica `server/src/db/remove_instructor_comite_migration.sql`. Las versiones anteriores de la API todavía consultan y escriben la columna `comite`.

Las cuentas con rol `Creador` pueden mantener varias sesiones simultáneas. La API registra cada una en `public.creator_sessions` y revoca únicamente la sesión que se cierra. La tabla se crea con `server/src/db/creator_concurrent_sessions_migration.sql`. Los demás instructores conservan la sesión única.

Antes de ejecutar `server/src/db/instructor_roles_migration.sql`, confirma el proyecto, los valores actuales de `instructores.rol` y el nombre de la restricción vigente. La migración normaliza los roles conocidos y agrega la restricción de valores canónicos dentro de una transacción.

El calendario carga los exámenes de la carrera y muestra aparte los que quedaron fuera de las semanas de examen vigentes. `PUT /api/semanas/agenda/examenes` guarda juntos los cambios pendientes, incluidos retiros y reprogramaciones.
