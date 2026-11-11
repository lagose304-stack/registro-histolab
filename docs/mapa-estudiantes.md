# Mapa de acceso del estudiante

[Véase el mapa general](mapa-del-sitio.md) para las convenciones de rutas y la persistencia compartida.

| Qué puede hacer en el portal | Dónde consultar para cambiarlo |
| --- | --- |
| Iniciar sesión, cambiar contraseña y cerrar sesión | `client/src/App.jsx`, `StudentPortalView.jsx` y `StudentAccountView.jsx`. En la API, sigue `/api/auth/student-login`, `/api/auth/student-change-password`, `/api/auth/student-heartbeat` y `/api/auth/student-logout` en `auth.routes.js` y `auth.controller.js`. La validación de sesión está en `server/src/middlewares/auth.middleware.js` y su persistencia en `student_concurrent_sessions_migration.sql`. |
| Consultar información académica y calificaciones | `StudentPortalView.jsx` reúne los datos de cuenta, carrera y sección. Consulta las familias `/api/estudiantes`, `/api/secciones`, `/api/temario` y `/api/semanas`. Los cálculos están en `client/src/utils/academicEngine.js`. |
| Abrir una prueba habilitada, responder, entregar y consultar su propia entrega | `StudentPortalView.jsx` y las llamadas de pruebas en `client/src/services/api.js`. Sigue `/api/pruebas/seccion` hasta `pruebas.routes.js` y `pruebas.controller.js`. |
| Participar en una prueba en vivo | La entrada y el envío de latidos están en `StudentPortalView.jsx`. El estado y la sesión activa se consultan en `/api/pruebas/live`, atendido por `liveQuiz.controller.js`. |

Al cambiar el portal, comprueba cómo se determina la cuenta, carrera y sección, y qué validación aplica el servidor a la operación. La creación, revisión y administración de evaluaciones se documentan en los mapas docentes.

## Acceso y matrículas múltiples

`LoginInstructor.jsx` envía carrera, cuenta y contraseña a `loginStudent`. La matrícula activa es única entre las cinco carreras, protegida por `studentEnrollment.js` y la migración global. Se conserva el manejo de matrículas históricas: si hubiera varias coincidencias, el servidor verifica la contraseña antes de devolver `SECTION_SELECTION_REQUIRED`; el segundo envío incluye `seccion_id`, que se contrasta nuevamente con la identidad elegida. No se elige una matrícula arbitrariamente ni se eliminan registros para resolver ambigüedades.

El JWT identifica el ID de la matrícula elegida. `authenticateStudent` consulta ese ID además de cuenta y carrera, y la actualización académica del portal incluye la sección en `getByCuenta`. Los datos guardados en el navegador solo se reutilizan si pertenecen al mismo ID y sección. El acceso y cambio de contraseña utilizan exclusivamente la identidad vinculada de Supabase Auth; no hay contraseña inicial compartida ni columna de contraseña en las fichas estudiantiles. Sin correo, identidad Auth o activación completa se exige el primer ingreso por correo.

`shared/studentIdentity.mjs` comprueba conjuntamente ID, cuenta, carrera y sección antes de reutilizar notas, aceptar una respuesta HTTP o actualizar la caché del portal. `App.jsx` reinicia el portal si cambia esa identidad completa; las cargas atrasadas se descartan. Si la matrícula no existe en Supabase o la consulta falla, la API no sustituye sus notas por un archivo local. El modo local también exige el ID de la matrícula. Verificación aislada: `node server/scripts/test_grade_isolation.mjs`.

El ingreso se confirma después de guardar y releer `current_session_token`. Un error de consulta o escritura devuelve indisponibilidad temporal; no se presenta como cuenta inexistente ni genera una sesión falsa. Un cierre atrasado no borra una sesión posterior. La API del cliente descarta credenciales residuales del otro perfil al ingresar y usa el token estudiantil en su portal. Verificación aislada: `node server/scripts/test_student_auth_flow.mjs` y `node server/scripts/test_quiz_auth.mjs`; el formulario se comprueba hasta entrar al portal, incluyendo elección de matrícula, en móvil y tablet.

Los grupos del libro de calificaciones corresponden a los parciales configurados en las semanas de la carrera. Cada grupo muestra todos sus exámenes, identificados por semana y leídos mediante `getCanonicalExamGrade`; sus notas se suman una sola vez en el subtotal. No se limita la presentación a tres parciales ni a un examen por parcial. Las notas históricas de los tres primeros exámenes siguen siendo compatibles.

Los apartados de pruebas se responden con `QuizItemResponse.jsx`: texto corto, numeración, completación, una opción de selección múltiple, verdadero/falso y selección de definición para cada término pareado. El portal mantiene el autoguardado, el bloqueo al finalizar el tiempo y la misma estructura de respuestas por pregunta y apartado. El resultado conserva la revisión docente de respuestas únicas o casillas, según corresponda.

Selección múltiple, verdadero/falso y términos pareados se califican automáticamente al entregar. Una prueba compuesta únicamente por esos tipos queda calificada en ese momento; si incluye apartados manuales, permanece pendiente hasta que el docente termine de revisarlos. La entrega conserva el estado de calificación devuelto por el servidor.

Después de confirmar una entrega, la salida de pantalla completa ya no cuenta como infracción y los intentos con entrega existente no se restauran como exámenes activos. El catálogo y la sala de espera muestran la duración configurada, y el comprobante respeta la distribución exacta de puntos por casilla.

## Inicio del portal

`StudentPortalView.jsx` abre la pestaña **Inicio**, implementada en `StudentDashboard.jsx` y `StudentDashboard.css`, salvo cuando se restaura una prueba activa. El dashboard muestra el acumulado y su desglose usando el mismo motor académico, la asistencia registrada, las alertas de derecho a examen cuando hay registros y los datos de sección. Sus accesos abren los módulos existentes de calificaciones, asistencia, pruebas y cuenta; el cierre de sesión sigue en la navegación general de `App.jsx`.

Debajo del resumen, **Tu posición en la sección** muestra un puesto y un mensaje breve. `GET /api/estudiantes/mi-ranking` toma la matrícula de la sesión, aplica el cálculo y el orden de Premios de la sección a las matrículas activas con notas registradas y devuelve solo el puesto propio. Un cero registrado cuenta como calificación. La consulta se hace desde Inicio y un fallo de clasificación no bloquea el resumen académico.

**Actualizar datos** vuelve a consultar semanas, temario, puntajes y el perfil de la misma cuenta como un conjunto. Ante errores o una cuenta distinta en la respuesta, el portal oculta el resumen académico y los módulos de consulta afectados y ofrece reintentar. La carga inicial distingue espera, fallo y ausencia de registros. Los avisos en vivo conservan el inicio y la restauración de evaluaciones; solo se muestra un aviso principal cuando ambas fuentes detectan la misma disponibilidad. El sondeo y la lógica de rendición no cambian. La cabecera y la navegación se comparten con los módulos de consulta; el inicio conserva su componente y estilos propios.

## Mis calificaciones

`StudentGradesView.jsx` y `StudentGradesView.css` presentan el resumen oficial del periodo y el detalle de las actividades agrupadas por los parciales que recibe `StudentPortalView.jsx`. El acumulado global corresponde al periodo completo; el detalle se consulta directamente por parcial y semana, sin barra de filtros. Un cero explícito cuenta como nota; las actividades sin calificación muestran «Sin nota», y una prueba con entrega pendiente puede mostrar «En revisión». No se presenta la suma bruta de manuales, pruebas y exámenes como aporte del parcial: sus escalas difieren, y la sección desplegable explica la ponderación global del motor académico.

Los parciales aparecen cerrados al entrar y se pueden expandir y contraer; abrir uno cierra el anterior y coloca la vista al inicio del parcial para mostrar su primera semana. Las actividades muestran el nombre completo y la escala de origen y se conservan todos los exámenes del grupo. «Ver entrega» selecciona la pestaña de pruebas y abre la revisión existente. Las alertas de derecho a examen conservan visibles las calificaciones y enlazan a asistencia. No se modifican fórmulas, formatos persistidos ni llamadas HTTP para este rediseño.

Dentro de cada parcial, las actividades de calificaciones se agrupan por las semanas configuradas de la carrera en bloques alternos gris claro y blanco. El orden de la programación determina la alternancia. Se conservan las semanas sin actividades en la vista completa y las notas históricas sin semana tienen un bloque propio.

La variante estudiantil de `Navbar.jsx` usa el ancho y los márgenes del portal definidos en `index.css` mediante `app-container--student`. El logo y las acciones de sesión se alinean con las tarjetas de contenido en móvil, tablet y escritorio.

## Mi asistencia

`StudentAttendanceView.jsx` y `StudentAttendanceView.css` muestran los estados semanales y los parciales preparados por `StudentPortalView.jsx`, sin nuevas llamadas HTTP ni escrituras. El resumen distingue asistencias, faltas justificadas, injustificadas y semanas sin registro; estas últimas no se convierten en faltas. Se utilizan las semanas reales de la carrera. Las semanas normales tienen fondo blanco y las de examen se distinguen con fondo lila claro.

Los acordeones aparecen cerrados al entrar, mantienen uno abierto a la vez y desplazan la vista al inicio del parcial al abrir. El derecho a cada examen proviene del cálculo existente `derechoExamenesStatus`; se conservan varios exámenes por parcial y no se presenta una habilitación como confirmada cuando el parcial no tiene registros de asistencia. La carga y los errores siguen controlados por el portal compartido.

Una falta justificada con reposición muestra además **Repuso** o **No repuso**, según la lista receptora. Esta anotación no reemplaza la falta ni cambia sus conteos o el derecho a examen. Antes de registrarse la lista no se añade un resultado negativo.

## Mi cuenta

`StudentAccountView.jsx` y `StudentAccountView.css` reúnen los datos de acceso en consulta y el formulario de cambio de contraseña. Verifican la contraseña actual en Auth, exigen al menos doce caracteres, una clave diferente y confirmación coincidente. Los campos admiten gestores de contraseñas mediante autocompletado y tienen botones accesibles para mostrar u ocultar cada clave. La contraseña nueva nunca se guarda en la matrícula.

El formulario usa la misma llamada `api.auth.changeStudentPassword` con la cuenta y carrera del estudiante autenticado; no cambia el servidor, la sesión ni el formato persistido. Bloquea la edición mientras guarda, conserva los campos ante un error y limpia y oculta las claves tras confirmar el éxito. La ayuda del primer cambio se presenta desplegada a petición del estudiante y las consultas se dirigen al instructor titular de la sección.

## Pruebas semanales

Cuando Administración General asigna una reposición individual, el portal muestra la sección receptora y su fecha. Para esa semana utiliza su prueba y sesión en vivo mediante la autorización del servidor; las otras semanas y la matrícula permanecen en la sección original. El comprobante corresponde a la prueba receptora y las calificaciones se consultan en el registro original. Véase [Reposiciones individuales](reposiciones-estudiantes.md).

`StudentQuizzesView.jsx` y `StudentQuizzesView.css` presentan el catálogo ordenado por semana, con estados en vivo, en espera, entregada en revisión y calificada. Cada tarjeta muestra el número de preguntas y las duraciones configuradas, permite desplegar las instrucciones completas y conserva el acceso a respuestas y comprobante. Una sesión finalizada o inactiva no habilita el botón de entrada; un cero explícito se muestra como nota y el bonus se identifica por separado.

Las pruebas por realizar permanecen visibles. Cada tarjeta indica la práctica de rendición: normalmente la siguiente, o la misma si la siguiente semana es de examen. Esta explicación usa `shared/quizSchedule.mjs` y no cambia la semana de las calificaciones. El historial de entregas se agrupa en acordeones según los parciales configurados en las semanas de la carrera, incluyendo tanto entregas pendientes de revisión como calificadas. Los acordeones comienzan cerrados, permiten uno abierto a la vez y muestran el inicio del grupo al abrir. Las entregas sin una semana configurada se conservan en «Sin parcial asignado». Cada tarjeta mantiene el acceso a sus respuestas y comprobante.

`loadStudentQuizzes` en `StudentPortalView.jsx` carga catálogo, sesiones y entregas como un conjunto y descarta cargas atrasadas. Un fallo muestra reintento y bloquea la entrada desde el catálogo y sus avisos hasta verificar los datos. Conserva los endpoints, los latidos y la restauración de pruebas activas. Los comprobantes mantienen las respuestas y la retroalimentación existentes con una cabecera adaptable a móvil; las notas ausentes no se representan como cero. La lógica de preguntas, sellado y entrega permanece en el portal.


## Resolución de pruebas en vivo

`StudentQuizPlayer.jsx` y `StudentQuizPlayer.css` presentan la sala de espera, la pregunta vigente, la espera entre preguntas y la finalización. Reciben los datos y las acciones de `StudentPortalView.jsx`, que conserva la integridad académica, el borrador local, la restauración y el sellado y envío. La pantalla muestra el número real de preguntas y las duraciones configuradas, mantiene visible el cronómetro durante el desplazamiento y admite preguntas históricas sin apartados. Las instrucciones se consultan en un desplegable. Las micrografías que no cargan ofrecen reintento. La entrega manual conserva el sellado local si no hay conexión.

`QuizItemResponse.jsx` conserva el formato de respuestas para texto corto, listado, completación, selección múltiple, verdadero/falso y términos pareados. En pareados, cada desplegable muestra directamente el texto de las definiciones, sin un cuadro superior. La selección muestra además el texto completo elegido para facilitar su lectura en móvil. El servidor prepara un orden estable sin coincidencias con las posiciones de los términos; el cliente conserva ese orden sin volver a mezclarlo. La vista previa usa la misma regla y los valores enviados siguen siendo las definiciones originales.

La sincronización usa los mismos latidos de `/api/pruebas/live/:seccion_id/:semana/heartbeat`, sin superponer solicitudes ni reiniciar el sondeo en cada pulsación. Los campos se bloquean mientras se verifica la sesión, durante una interrupción, al agotarse el tiempo, fuera de pantalla completa, durante los diálogos y después del sellado. El indicador diferencia conexión inicial, sincronización y reconexión; una respuesta lenta muestra reconexión a los ocho segundos. Los borradores siguen guardándose en el dispositivo. El temporizador local solo disminuye en la fase de pregunta y se corrige con el tiempo del servidor. La política estricta observa pérdida de foco, ocultamiento y salida de pantalla completa desde la entrada hasta la finalización, incluidos lobby, pausas y diálogos. Cada episodio genera una advertencia inmediata; el tercero finaliza y envía las respuestas actuales. Los diálogos de evaluación permiten desplazamiento dentro del alto disponible.


## Seguridad del acceso a pruebas

Todas las rutas de pruebas pasan por `quizAccess.middleware.js`: el estudiante solo accede a su sección y a su propia entrega. `quizPrivacy.mjs` retira claves de corrección y datos de otros participantes; los pareados usan un banco de definiciones separado de los términos. `quizFullscreen.mjs` exige pantalla completa verificada antes de iniciar; `QuizFullscreenGate.jsx` bloquea un intento restaurado hasta recuperarla. `quizIntegrity.mjs` registra inmediatamente una advertencia por episodio de pérdida de foco, ocultamiento o salida de pantalla completa, sin duplicar los eventos de la misma salida. `quizNavigation.mjs` conserva la prueba al pulsar Atrás y presenta la misma confirmación que el botón interno: finalizar y enviar o cancelar y volver a pantalla completa. La tercera advertencia envía una sola entrega; el servidor acepta también estas finalizaciones en lobby habilitado. Los contadores se respaldan en los latidos existentes; los incidentes se identifican como declaraciones del cliente, no como prueba de fraude. Véase [Seguridad e integridad de pruebas](seguridad-pruebas.md) para las verificaciones y límites.

La regla de falta injustificada usa la semana de contenido de la práctica (`shared/practiceAttendance.mjs`), conservada en la prueba y el tema del manual. La semana de rendición se calcula por separado. `quizAccess.middleware.js` bloquea el acceso, envío y latido y anota el motivo en el catálogo; `estudiantes.controller.js` valida las notas y guarda cero al pasar lista. Los detalles y la migración pendiente del guardado transaccional receptor están en [Reposiciones individuales](reposiciones-estudiantes.md#verificación-de-asistencia-y-semana-de-contenido).
