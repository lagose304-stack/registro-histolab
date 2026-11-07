# Verificación del panel de instructores tras el cierre de seguridad

Se revisó el portal académico publicado en `https://registrohistolab.pages.dev`, la conexión mediante la clave moderna de Supabase y los permisos añadidos al módulo de pruebas. No se editaron alumnos, calificaciones, asistencias, entregas ni cuentas reales.

## Regresiones encontradas y corregidas

1. La pantalla de asignaciones normaliza los registros históricos para que crear y revisar una prueba correspondan al mismo instructor. La nueva autorización del servidor consultaba los registros sin normalizar; podía rechazar una operación que la pantalla permitía. Ahora usa la misma función compartida `synchronizeQuizAssignments`, incluida la prioridad del responsable de creación ante asignaciones antiguas en conflicto.
2. Premios consultaba las entregas completas con un permiso de revisión de pruebas. Esto podía impedir el acceso a instructores del equipo que solo tenían asistencia o manuales y podía producir clasificaciones parciales al limitar semanas. Ahora el equipo puede consultar todas las notas necesarias para la clasificación, y el servidor excluye respuestas y auditorías privadas. Revisar, calificar o eliminar respuestas sigue requiriendo la asignación de pruebas correspondiente.
3. Un instructor del equipo sin pruebas asignadas recibe un catálogo vacío para que el módulo muestre la ausencia de asignaciones; no se convierte en un error de carga. No se permite consultar preguntas de semanas ajenas.

## Comprobaciones completadas

- Supabase Auth responde con la clave moderna. El SDK real rechazó una cuenta ficticia inexistente con `invalid_credentials`, y la ruta publicada de acceso devolvió HTTP 401 para esas credenciales, sin utilizar contraseñas reales ni bloquear usuarios existentes.
- Se verificó la disponibilidad, sin descargar filas, de instructores, sesiones del Creador, secciones, asignaciones, configuración de semanas y puntajes, temario, agenda, fechas de manuales, estudiantes de las cinco carreras y tablas de pruebas.
- Con cuentas y almacenamiento aislados se verificaron accesos por correo y cuenta, generación/validación de JWT, reemplazo de sesión para Instructor y Coordinador y sesiones simultáneas del Creador.
- La autorización de pruebas se probó tanto en la rama Supabase simulada como en almacenamiento local. Se verificaron semanas ajenas, responsables históricos, premios completos, cero explícito y ausencia de respuestas/auditorías en la clasificación.
- La revisión del instructor guardó comentarios y notas de tres decimales en almacenamiento simulado, sincronizó la nota del estudiante ficticio y conservó la corrección automática.
- Se verificaron ventanas de asistencia y manuales, reposiciones, notas pendientes y cero, correspondencia de exámenes por semana, cálculos del cuadro, tipos de preguntas, autocalificación y concurrencia en vivo.
- Pasaron 15 scripts de regresión y la compilación. Las escrituras funcionales se probaron exclusivamente con fixtures; no se hizo una edición de prueba sobre datos reales.
- Tras publicar, página, salud, semanas, temario y puntajes responden HTTP 200. Las rutas de secciones, registro y pruebas requieren sesión. Cloudflare conserva los tres secretos cifrados. La dirección pública anterior sigue respondiendo HTTP 404.

Versión del servidor con las correcciones: `b3a73710-32f4-427a-ba53-62f2c146c5f9`. La entrada de Pages sigue enlazada al mismo servicio interno.

## Límites y módulo heredado

No se inició sesión con la contraseña de una persona real ni se realizó una transacción de escritura en producción. Los resultados combinan comprobaciones reales de conectividad y publicación con pruebas funcionales aisladas de los controladores.

Se encontró que `public.registros`, usada por el antiguo módulo de muestras clínicas, no aparece en la API de la base (`PGRST205`). Ese módulo no está conectado al `App.jsx` ni al panel actual de instructores, y el esquema académico del repositorio tampoco crea esa tabla. No se creó ni activó una tabla clínica como parte de esta revisión. Esto es distinto del registro académico que usa el panel actual y de los permisos de las tres tablas de pruebas modificados anteriormente.
