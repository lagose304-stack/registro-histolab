# Mapa de acceso del instructor común

[Véase el mapa general](mapa-del-sitio.md) para las convenciones de rutas y la persistencia compartida.

## Alcance por sección

`DashboardInstructor.jsx` carga las secciones y muestra las que el instructor coordina o tiene asignadas. Ambas entradas abren `CoordinatorSectionView.jsx`. Para cambios de acceso, revisa el filtro del panel, los módulos de la sección y las funciones de `client/src/utils/sectionRoleUtils.js`. Las asignaciones operativas relacionan una sección, un rol y una semana.

| Qué puede hacer | Dónde consultar para cambiarlo |
| --- | --- |
| Iniciar sesión y abrir sus secciones | `LoginInstructor.jsx`, `DashboardInstructor.jsx`, `/api/auth` y `/api/secciones`. |
| Consultar calificaciones y asistencia de la sección | `SectionGradebookView.jsx`, `/api/estudiantes` y `client/src/utils/academicEngine.js`. Para exportación, consulta `client/src/utils/exportExcel.js`. |
| Pasar asistencia o subir notas de manuales según la asignación semanal | `WeeklyAttendanceTakingView.jsx`, `WeeklyManualsGradingView.jsx`, `/api/asignaciones` y `estudiantes.controller.js`. |
| Crear pruebas y revisar respuestas según el rol semanal | `WeeklyQuizCreationView.jsx`, `ReviewQuizSubmissionsView.jsx`, `/api/pruebas` y `pruebas.controller.js`. |
| Habilitar una prueba en vivo | `LiveQuizControlView.jsx` y `liveQuiz.controller.js`. Revisa la asignación, la condición de titular y la ventana horaria de la sección. |
| Coordinar una sección como titular | `CoordinatorSectionView.jsx` y `sectionRoleUtils.js`. El titular tiene acceso a las semanas de su sección sin depender de una asignación semanal y puede abrir la carga de parciales en `WeeklyExamGradingView.jsx`. Para otras operaciones de coordinación, sigue los módulos `SectionAssignmentsView.jsx`, `SectionDataMigrationView.jsx` y `SectionAwardsView.jsx` desde sus condiciones de entrada. |

La Administración General tiene un [mapa propio](mapa-instructores-administrativos.md). Para confirmar un permiso, sigue el endpoint hasta las comprobaciones del servidor.
