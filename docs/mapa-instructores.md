# Mapa de acceso del instructor común

[Véase el mapa general](mapa-del-sitio.md) para las convenciones de rutas y la persistencia compartida.

## Alcance por sección

`DashboardInstructor.jsx` carga las secciones y muestra las que el instructor coordina o tiene asignadas. Ambas entradas abren `CoordinatorSectionView.jsx`. Para cambios de acceso, revisa el filtro del panel, los módulos de la sección y las funciones de `client/src/utils/sectionRoleUtils.js`. Las asignaciones operativas relacionan una sección, un rol y una semana.

| Qué puede hacer | Dónde consultar para cambiarlo |
| --- | --- |
| Iniciar sesión y abrir sus secciones | `LoginInstructor.jsx`, `DashboardInstructor.jsx`, `/api/auth` y `/api/secciones`. |
| Consultar calificaciones y asistencia de la sección | `SectionGradebookView.jsx`, `/api/estudiantes` y `client/src/utils/academicEngine.js`. Para exportación, consulta `client/src/utils/exportExcel.js`. |
| Matricular y administrar estudiantes como titular | El primer acceso en `CoordinatorSectionView.jsx` abre `SectionStudentsView.jsx`, la misma vista que usa Administración de Secciones. |
| Pasar asistencia o subir notas de manuales según la asignación semanal | `WeeklyAttendanceTakingView.jsx`, `WeeklyManualsGradingView.jsx`, `/api/asignaciones` y `estudiantes.controller.js`. |
| Crear pruebas y revisar respuestas según el rol semanal | `WeeklyQuizCreationView.jsx`, `ReviewQuizSubmissionsView.jsx`, `/api/pruebas` y `pruebas.controller.js`. |
| Habilitar una prueba en vivo | `LiveQuizControlView.jsx` y `liveQuiz.controller.js`. Revisa la asignación, la condición de titular y la ventana horaria de la sección. |
| Coordinar una sección como titular | `CoordinatorSectionView.jsx` y `sectionRoleUtils.js`. El titular tiene acceso a las semanas de su sección sin depender de una asignación semanal y puede abrir la carga de parciales en `WeeklyExamGradingView.jsx`. Para otras operaciones de coordinación, sigue los módulos `SectionAssignmentsView.jsx`, `SectionDataMigrationView.jsx` y `SectionAwardsView.jsx` desde sus condiciones de entrada. |

La Administración General tiene un [mapa propio](mapa-instructores-administrativos.md). Para confirmar un permiso, sigue el endpoint hasta las comprobaciones del servidor.

La asignación de manuales es colectiva y se muestra como **Todos**. Los integrantes del equipo pueden registrar notas durante el plazo calculado por `shared/manualsWindow.mjs`. Para una semana normal, el plazo es el horario de la siguiente práctica con margen de diez minutos, incluida su reposición. Para la semana previa a examen, el titular define y guarda una fecha en la tarjeta correspondiente de **Proporcionar asignaciones**; **Subir nota de manuales** solo consulta esa fecha y la carga se habilita todo ese día en hora de Honduras. La configuración por sección y semana se guarda en `fechas_carga_manuales`, creada por `server/src/db/manuals_deadlines_migration.sql`. Creador y Coordinador también pueden definir esa fecha mediante su acceso completo.

`GET /api/estudiantes/seccion/:seccion_id/fechas-manuales` devuelve fechas especiales, semanas y eventos de la sección. `PUT /api/estudiantes/seccion/:seccion_id/fechas-manuales/:semana` guarda la fecha especial. `PUT /api/estudiantes/seccion/:seccion_id/manuales/:semana` valida membresía, plazo y temas antes de guardar únicamente las notas de manual modificadas y recalcular el total con el motor académico.

`WeeklyAttendanceTakingView.jsx` muestra al Instructor únicamente las semanas que tiene asignadas para pasar asistencia. Titular, Creador y Coordinador conservan el acceso completo a la sección. El registro semanal se habilita únicamente en la semana actual, desde diez minutos antes del horario de la sección hasta diez minutos después, con hora de Honduras. `shared/attendanceWindow.mjs` calcula la ventana tanto para la pantalla como para `PUT /api/estudiantes/seccion/:seccion_id/asistencia/:semana`. Esta ruta exige una sesión y valida horario, semana y asignación en el servidor antes de guardar los estados de asistencia. El módulo envía solo los estudiantes modificados y permite consultar otras semanas en solo lectura.

Crear y revisar una prueba semanal corresponden a la misma persona. El selector de creación determina la revisión. La API sincroniza ambos roles y su variante histórica en un mismo guardado, con prioridad para la asignación de creación.

Para asistencia, una reposición de `agenda_academica` sustituye la ventana habitual de su práctica original, con el mismo margen de diez minutos. La lista se guarda en la semana original aunque la reposición ocurra después. El módulo consulta `GET /api/semanas/agenda/asistencia/:sectionId`, accesible para el equipo de esa sección. Esta consulta incluye las reposiciones y los exámenes propios o generales de la carrera. En las semanas de examen, la lista sigue el horario del calendario de exámenes y exige que haya uno programado. El guardado registra la clave `asistencia_examen_<semana>` que consume el cuadro de asistencia, junto con sus claves históricas. La ruta de guardado vuelve a consultar la agenda antes de validar el horario.
