# Datos locales

Los archivos `*_data.json` son copias de trabajo privadas y no se distribuyen con el código. Se conservan en cada equipo y están excluidos de Git para evitar publicar datos personales, respuestas y sesiones.

En producción, la persistencia usa Supabase. Los controladores pueden crear sus archivos locales cuando se utiliza el almacenamiento de desarrollo. No utilices las copias personales para ejecutar pruebas; utiliza los escenarios aislados de `server/scripts`.
