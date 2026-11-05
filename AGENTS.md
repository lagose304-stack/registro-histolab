# Repository Guidelines

Este repositorio reúne el registro de muestras y la gestión académica de HistoLab. Para localizar un cambio, identifica el perfil afectado en el [índice de mapas](docs/mapa-del-sitio.md) y sigue la vista, la llamada HTTP, la ruta, el controlador y la persistencia que correspondan.

## Arquitectura

React y Vite sirven la interfaz. `client/src/App.jsx` coordina las entradas al registro y a los portales. `client/src/services/api.js` concentra las llamadas a Express, cuyo montaje está en `server/src/app.js`. Vite redirige `/api` a Node en desarrollo. En Cloudflare Workers, `wrangler.toml` sirve la compilación de Vite y envía `/api/*` al mismo Express mediante `server/src/worker.js`.

Para cambios de permisos, revisa las condiciones de la vista, `client/src/utils/sectionRoleUtils.js` cuando aplique, y los controles efectivos de la ruta y del controlador. Para notas, parte de `client/src/utils/academicEngine.js` y comprueba cómo el controlador de estudiantes guarda el formato que consumen el portal y el libro de notas.

## Cambios de interfaz

- Trabaja una zona a la vez. Identifica la pantalla o el módulo solicitado y su perfil de acceso en el mapa. Limita el rediseño a esa zona y verifica el flujo completo antes de pasar a la siguiente zona que indique el usuario.
- Diseña primero para pantallas pequeñas y tablets. La interfaz debe ser visualmente cuidada y fácil de usar con el dedo, con texto legible, jerarquía clara y acciones principales visibles. Comprueba que el contenido se adapte sin recortes ni desplazamiento horizontal de la página.
- Prioriza la velocidad en dispositivos modestos y conexiones lentas. Reutiliza componentes y estilos, ajusta el tamaño de las imágenes y evita dependencias, solicitudes y efectos visuales innecesarios. Mide el impacto si el cambio añade recursos o trabajo durante la carga inicial.
- Verifica el flujo principal en una pantalla de móvil pequeña y en una tablet, en orientación vertical y horizontal cuando corresponda. Comprueba formularios, tablas, diálogos y estados de carga o error si forman parte de la zona.

## Desarrollo y verificación

- `npm run install:all` instala las dependencias.
- `npm run dev` inicia Vite en el puerto 43173 y Express en el 43174. Usa `npm run dev:client` o `npm run dev:server` para iniciar cada parte por separado.
- `npm run build` compila el cliente. `npm run start` inicia Express. `npm run deploy` compila y publica en Cloudflare.
- `node server/scripts/test_academic_integrity.js` comprueba reglas de calificación y sanitización. Los otros scripts de `server/scripts` escriben datos mediante la API. Revísalos antes de ejecutarlos y usa datos aislados.

Consulta el esquema y las migraciones pertinentes antes de cambiar formatos persistidos. Comprueba si el controlador usa Supabase o almacenamiento local y preserva la lectura de los datos existentes. Mantén fuera de la documentación las credenciales y los datos personales.

## Historial y mantenimiento

El historial reciente usa prefijos como `feat:`, `fix:`, `style:` y `chore:`, con descripciones en español. Actualiza el mapa cuando un cambio mueva responsabilidades, altere un flujo o introduzca una fuente de datos.
