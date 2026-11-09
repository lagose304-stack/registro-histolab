# Revisión general de interfaz

Fecha: 7 de noviembre de 2026.

Se recorrieron las entradas activas desde `main.jsx`, `App.jsx`, el panel de instructores, la sección y el portal estudiantil. La revisión combina lectura del flujo y sus estilos, renderizado con datos aislados y comprobaciones de interacción. No constituye una prueba exhaustiva de todas las combinaciones posibles ni una validación de escrituras en producción.

## Cobertura

| Área | Pantallas revisadas |
| --- | --- |
| Entrada y navegación | Inicio de sesión, panel de instructores, panel de sección, encabezado, avisos y recuperación de errores. |
| Administración | Usuarios y formulario, secciones y formulario, asignación de instructores, matrícula, temario y formulario, semanas del temario, ponderaciones, definición de semanas, reposiciones y calendario de exámenes. |
| Trabajo de sección | Calificaciones y asistencia, asignaciones, registro de asistencia, notas de manuales y exámenes, creación de pruebas, control en vivo, revisión de respuestas, premios y migración. |
| Portal estudiantil | Inicio, calificaciones, asistencia, cuenta, catálogo e historial de pruebas, comprobante y realización de pruebas. |

Las 25 vistas de administración, sección e inicio de sesión se renderizaron a 320 × 640, 640 × 360, 768 × 1024, 1024 × 768 y 1366 × 900. Se comprobaron también sus errores de lectura a 320 × 640. Los datos y las llamadas de estas comprobaciones fueron simulados; no se modificaron cuentas, matrículas, notas ni pruebas reales.

Los elementos decorativos del inicio de sesión se recortan deliberadamente dentro de su contenedor; no se consideraron contenido ni controles fuera de pantalla.

## Correcciones aplicadas

- Los avisos compartidos se ajustan al ancho de la pantalla, permiten mensajes largos y ofrecen un botón táctil de cierre. Se distinguen visualmente éxito, información y error.
- La recuperación de errores utiliza el diseño del sitio y acciones que se acomodan en una pantalla pequeña. Conserva recarga y retorno al inicio, elimina también el identificador de sesión estudiantil al reiniciar y mantiene el detalle técnico fuera del mensaje al usuario.
- La asignación de instructores comparte el diálogo de administración: búsqueda, disponibles, asignados, titular y acciones de asignación/retiro. El foco permanece dentro del diálogo. Una respuesta fallida conserva la lista previa y presenta el error junto al formulario; los cambios se reflejan tras confirmarse el guardado. Se impiden solicitudes simultáneas y el cierre durante el guardado.
- Crear, editar y eliminar secciones usan un diálogo con foco contenido y la misma paleta de administración. Se corrigieron el encabezado y las acciones inferiores para evitar textos comprimidos en móviles. El cuerpo tiene desplazamiento propio y las acciones siguen disponibles.
- El mapa distingue los componentes históricos de muestras de las entradas académicas actuales.

## Comprobaciones de interacción

- Ventanas de secciones en sus tres modos, asignación de instructores y avisos: cinco tamaños; error de guardado, conservación de la lista, reintento y bloqueo de duplicados/cierre.
- Recuperación: cinco tamaños con un fallo de renderizado simulado; se muestran ambas acciones sin exponer el error interno.
- Calificaciones: todos los parciales cerrados al entrar, exclusividad, apertura desde la primera semana, teclado, semanas alternadas y ausencia de la barra de filtros.
- Asistencia: semanas regulares blancas y exámenes diferenciados; cuatro estados, varios exámenes por parcial, derecho a examen y recuperación tras error de carga.
- Cuenta: validaciones, visibilidad de contraseña, envío sin duplicados, conservación tras error y limpieza tras éxito.
- Pruebas: historial cerrado y agrupado por parcial, comprobante, seis tipos de pregunta, móvil y tablet en ambas orientaciones, temporizador, reconexión, avance y entrega.
- Revisión: ventanas individual y rápida, comentarios, guardado, avance, corrección automática de solo lectura, errores y reintentos.
- Migración: manuales, pruebas, exámenes y asistencia; precisión, límites, cero explícito, pendientes, guardado y descarte, búsqueda, datos vacíos y errores.
- Reglas académicas: `test_grade_input.mjs`, `test_gradebook_consistency.mjs` y `test_academic_integrity.js` aprobados. Compilación de producción aprobada.

Algunas comprobaciones temporales anteriores todavía esperaban la antigua barra de filtros, un parcial inicialmente abierto o semanas grises en asistencia. Se ajustaron las expectativas de la revisión a las preferencias actuales; no se reintrodujeron esos elementos en el producto.

## Alcance y estado

Los componentes históricos `InstructorSectionView`, `WeeklyQuizGradingView`, `RegistroForm`, `RegistroList`, `RegistroModal`, `FilterBar` y `StatsCards` no tienen entrada desde la aplicación actual. Se conservaron como código histórico, sin habilitar sus módulos.

No se cambiaron reglas de autorización, esquema, claves ni datos persistidos durante esta revisión. La compilación conserva el aviso previo de tamaño del paquete de instructores; esta revisión no divide ese paquete.

Las correcciones están disponibles en el sitio local, `http://127.0.0.1:43173/`, con la API en el puerto 43174. La revisión no incluye una nueva publicación ni un envío a GitHub.
