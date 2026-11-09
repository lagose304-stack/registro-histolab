# Publicación completa de HistoLab

La actualización completa incluye las cuentas por correo, recuperación y cambio de contraseña, matrícula única, borrado coordinado con Auth, reposiciones, programación de pruebas y ajustes de interfaz descritos en los mapas. Reemplaza el alcance parcial de las publicaciones anteriores.

El destino es `registrohistolab.pages.dev`, con el Worker `registro-histolab` y Supabase `dghmrqyxrjgxceolqplt`. El proyecto Atlas no forma parte de esta publicación. Las pruebas funcionales se realizan localmente con datos aislados; en producción se comprueba únicamente disponibilidad y configuración pública.

Los secretos y las copias privadas `server/data/*_data.json` permanecen en el equipo y fuera de Git. Las migraciones se conservan como historial; no se deben volver a ejecutar indiscriminadamente sobre una base actualizada.
