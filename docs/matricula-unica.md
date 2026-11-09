# Una matrícula activa por cuenta

Una cuenta solo puede tener una matrícula activa en todo HistoLab, independientemente de la carrera, sección o periodo. Los números se comparan como texto sin espacios al principio o al final, conservando sus ceros iniciales. Una baja permite una matrícula posterior; la información histórica no se borra. Las reposiciones individuales mantienen la matrícula de origen.

## Validación de la API

`server/src/services/studentEnrollment.js` consulta las cinco tablas al crear una matrícula o cambiar su número de cuenta. Editar el mismo registro conserva su cuenta; cambiarlo a una cuenta ocupada devuelve 409. Si no puede verificar la disponibilidad, devuelve 503. Cuando Supabase está configurado, un fallo de escritura no anuncia éxito ni guarda una matrícula alternativa en archivos. En modo local, se comprueban todas las carreras de nuevo inmediatamente antes de modificar la memoria, sin una espera intermedia.

`SectionStudentsView.jsx` explica la regla y conserva el formulario si la API rechaza la cuenta.

## Protección en PostgreSQL

`supabase/migrations/20261107222157_global_student_accounts.sql` instala un registro de reservas en `histolab_private.student_enrollments`. Su clave primaria es la cuenta; la reserva pertenece a la tabla de carrera y al ID del estudiante. Los triggers de las cinco tablas reservan, cambian o liberan la cuenta en la misma transacción que la matrícula. La clave única de PostgreSQL resuelve los conflictos entre solicitudes concurrentes, incluso si sus verificaciones previas aprobaron ambas.

El registro no está expuesto a la API; RLS está habilitado y los roles públicos, autenticados y de servicio no pueden modificarlo directamente. Una función privada `SECURITY DEFINER`, con ruta de búsqueda fija y tablas permitidas explícitas, mantiene exclusivamente estas reservas desde los triggers. No concede acceso a información académica.

La instalación bloquea temporalmente las escrituras de matrícula mientras comprueba e inventaría los registros activos. Si detecta duplicados anteriores, detiene toda la transacción sin elegir una sección, borrar ni desactivar estudiantes. Puede ejecutarse de nuevo y conserva los datos académicos.

Aplicada al proyecto RegistroHisto (`dghmrqyxrjgxceolqplt`). La comprobación del panel mostró cinco protecciones y 29 matrículas protegidas, sin acceso público ni modificación directa del registro privado. No se crearon ni eliminaron matrículas reales para probarla.

## Verificación aislada

- `node server/scripts/test_student_enrollment.mjs`: API real con almacenamiento simulado; cinco carreras, edición, conflictos de escritura, errores sin respaldo falso y solicitudes locales simultáneas.
- `node server/scripts/test_student_enrollment_sql.mjs`: PostgreSQL en memoria; clave única global, altas, renombrados, reactivaciones, bajas, rollback, historial y permisos. Requiere `HISTOLAB_PGLITE_DIR` apuntando a la instalación externa de prueba de `@electric-sql/pglite`.
