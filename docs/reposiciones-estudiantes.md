# Reposiciones individuales de prácticas

Este procedimiento autoriza a un estudiante a reponer una práctica en otra sección sin cambiar su matrícula. Es independiente de las reposiciones de horario de una sección completa, que permanecen en Definición de semanas y `agenda_academica`.

## Flujo

1. El titular abre **Reposiciones de estudiantes** dentro de **Módulos de la sección** y pulsa **Solicitar reposición**. Selecciona una práctica regular y un estudiante con **Falta justificada** registrada. Añade la justificación para Administración General. No se admiten exámenes, entregas previas de la misma práctica ni notas positivas ya registradas. Un cero de una actividad pendiente de reposición puede reemplazarse por su nota real.
2. Creador y Coordinador abren **Reposiciones de estudiantes** desde Administración General. La bandeja permite buscar, filtrar por estado y consultar páginas de treinta solicitudes. Pueden asignar una sección receptora o rechazar la solicitud indicando un motivo. El servidor vuelve a validar la matrícula, la justificación y los destinos al confirmar; la asignación es condicional para evitar dos decisiones simultáneas.
3. Solo se ofrecen secciones distintas, de la misma carrera y periodo, cuya práctica de esa semana todavía no inicia. Se usan las fechas y el horario vigentes y las reposiciones de sección guardadas. Se descartan las secciones que ya iniciaron su prueba o tienen entregas para esa semana. Una fecha o programación incompleta no permite forzar la asignación.
4. El equipo receptor abre el mismo módulo dentro de su sección y consulta **Estudiantes que recibimos**. En **Registrar reposición** confirma la asistencia durante la práctica. Los manuales se califican en la siguiente práctica receptora; si el contenido corresponde a la semana previa a examen, se usa la fecha especial configurada, igual que para sus estudiantes habituales. La autorización individual no adelanta ese plazo. Se aceptan de cero a un punto con hasta tres decimales.
5. El estudiante ve en su portal la sección receptora y la fecha. Para esa semana, el catálogo, la sala en vivo, el latido, la entrega y el comprobante utilizan la prueba receptora. Las otras semanas siguen en la sección original. El profesor habilita y controla la prueba habitual; los invitados conectados aparecen identificados en Control en vivo. La revisión sigue correspondiendo a la persona asignada para revisar esa prueba.
6. La nota automática o la revisión docente se sincroniza al estudiante original. Se conservan tanto `prueba_<semana>` como `prueba_<semana>_real`, incluido el bonus; los manuales mantienen sus claves por ID. Las correcciones de manuales de la reposición se gestionan desde el registro receptor. La solicitud se completa cuando hay asistencia confirmada, todos sus manuales y una prueba calificada.

La falta justificada original se conserva; la asistencia a la reposición se registra por separado. El motivo y la observación administrativa solo se muestran a Administración General y al titular de origen, no al equipo receptor ni al estudiante. Una solicitud rechazada puede volver a presentarse; una reposición asignada o completada no crea otra evaluación para la misma práctica. Las solicitudes resueltas no se reasignan ni se borran desde la interfaz.

### Resultado de asistencia a la reposición

La lista receptora solo permite **Asistió** y **Falta injustificada**. `asistencia_reposicion` guarda ese registro de manera independiente; `asistio` se conserva por compatibilidad y para completar el flujo. La falta original no se sustituye: se añade `asistencias.reposicion_<semana>` con **Repuso** o **No repuso**, respectivamente. El cuadro de asistencia, el registro semanal, el portal estudiantil y el Excel muestran la anotación junto a **Falta justificada**. Los conteos y el derecho a examen siguen usando la asistencia original.

Antes de pasar lista, `asistencia_reposicion` permanece nula: no se interpreta el antiguo `asistio=false` como una falta registrada. `student_makeup_attendance_migration.sql` actualiza las instalaciones existentes y protege las anotaciones en las cinco carreras frente a cargas anteriores de asistencia. Las asistencias positivas ya registradas se reconocen como **Repuso**; las negativas desconocidas quedan pendientes hasta un registro explícito. El guardado de la anotación y el registro receptor son transaccionales.

Comprobaciones adicionales: `test_makeup_attendance_export.mjs`, los casos de ambos estados en `test_student_makeups.mjs` y `test_student_makeups_sql.mjs`, y pruebas visuales del receptor y del alumno en móvil y tablet. La ampliación se aplicó en RegistroHisto y conserva los permisos privados de las funciones.

## Implementación y persistencia

- `shared/studentMakeups.mjs`: reglas compartidas de justificación, semana regular, carrera, periodo y fecha futura.
- `StudentMakeupsView.jsx` y sus estilos: solicitud, bandeja administrativa y recepción. `DashboardInstructor.jsx` añade la entrada administrativa; `CoordinatorSectionView.jsx` añade el módulo de sección.
- `studentMakeups.routes.js` y `studentMakeups.controller.js`: rutas `/api/reposiciones-estudiantes`, todas autenticadas como instructor. La API valida quién solicita, quién decide y quién pertenece al equipo receptor. La búsqueda conserva el filtro de sección; los datos se consultan por páginas y las secciones de origen se resuelven en conjunto.
- `services/studentMakeups.js`: consultas de autorizaciones, reemplazo de pruebas y sincronización de entregas. No usa archivos locales como respaldo de autorizaciones. Sin Supabase, el nuevo módulo informa indisponibilidad y no concede excepciones de acceso.
- `quizAccess.middleware.js`: conserva la comprobación de cuenta y sección original y redirige únicamente la semana autorizada. Un estudiante no obtiene acceso general a la sección receptora ni puede consultar a otro estudiante. Las respuestas modelo y los datos de compañeros siguen filtrados por `quizPrivacy.mjs`.
- `StudentPortalView.jsx` y `StudentQuizzesView.jsx`: aviso y procedencia de la prueba. No hay traslado de matrícula ni mezcla de calificaciones de carreras o semanas. Se conserva el reproductor, el temporizador, la reconexión y la política de integridad. Los borradores activos de una prueba diferente no se reutilizan para responder la prueba receptora.
- `liveQuiz.controller.js` y `LiveQuizControlView.jsx`: identifican a los invitados a partir de la autorización comprobada en el servidor y del latido existente, sin añadir otra frecuencia de sondeo.
- `pruebas.controller.js`: mantiene la entrega en la sección que creó la prueba y envía la calificación a la ficha original mediante la función transaccional. Las calificaciones regulares siguen usando su mecanismo anterior.

`server/src/db/student_makeups_migration.sql` crea `reposiciones_estudiantes`, índices parciales de unicidad, RLS y dos funciones de escritura. `assign_student_makeup` bloquea la solicitud y verifica destino, fecha y actividad iniciada. `apply_student_makeup` bloquea la solicitud, valida manuales o la entrega real, combina únicamente las notas autorizadas y actualiza al estudiante original dentro de la misma transacción. Si la matrícula dejó de corresponder, revierte el guardado.

Las cinco tablas de estudiantes tienen una protección antes de actualizar `notas`: combina las notas de reposición aplicadas para impedir que una carga anterior de la sección original las elimine. El resto de las notas sigue su flujo existente. Las referencias de sección y entrega usan `ON DELETE RESTRICT` para conservar la procedencia de los registros. Las funciones son `SECURITY INVOKER`, no conceden acceso a `anon` ni `authenticated`, y solo se ejecutan mediante la API con `service_role`.

## Verificación

- `node server/scripts/test_student_makeups.mjs`: controladores reales con persistencia aislada; justificación, permisos, exámenes, destinos, privacidad, prueba receptora, guardado en origen, periodos de asistencia y manuales, cero y tres decimales.
- `test_student_makeups_sql.mjs`: ejecuta la migración dos veces en PostgreSQL en memoria y comprueba unicidad, RLS, guardado atómico, conservación de matrícula, notas ante cargas antiguas y rollback. Requiere `@electric-sql/pglite` únicamente para la prueba; se instaló fuera del proyecto. `HISTOLAB_PGLITE_DIR` señala el directorio que contiene esa instalación. No es una dependencia del sitio.
- Regresiones aprobadas de acceso y entregas de pruebas, corrección automática, concurrencia en vivo, asistencia, manuales, calificaciones y entrada de tres decimales.
- Comprobaciones visuales e interacción aisladas para titular, administración y receptor a 320, 390, 640, 768, 1024 y 1366 px. Se verificaron el aviso estudiantil, el acceso a la evaluación receptora, los seis tipos de pregunta normales y el invitado en Control en vivo.
- Compilación de producción aprobada. La ampliación estudiantil reutiliza las consultas y el reproductor existentes; no incorpora dependencias ni sondeos nuevos.

La migración se aplicó en el proyecto RegistroHisto (`dghmrqyxrjgxceolqplt`). La verificación del panel mostró RLS activo, lectura pública deshabilitada, modificación directa por `authenticated` deshabilitada, escritura de la API habilitada, cero solicitudes y las cinco protecciones de notas instaladas. No se modificaron matrículas, asistencias, contraseñas ni calificaciones reales durante las pruebas.

La implementación está disponible en el sitio local. No incluye un nuevo envío a GitHub ni una publicación del cliente y servidor en Cloudflare.
