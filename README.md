# 🔬 Registro Histolab - Plataforma Full-Stack

Base moderna y completa para la gestión y registro de muestras histopatológicas y de laboratorio, construida con arquitectura desacoplada Frontend + Backend.

---

## 🚀 Tecnologías

- **Frontend (`/client`)**: [React 19](https://react.dev/), [Vite](https://vitejs.dev/), [Lucide React](https://lucide.dev/) (iconografía), CSS Vanilla moderno con tokens y diseño responsivo clínico/laboratorial.
- **Backend (`/server`)**: [Node.js](https://nodejs.org/), [Express](https://expressjs.com/), [CORS](https://github.com/expressjs/cors), [dotenv](https://github.com/motdotla/dotenv), [morgan](https://github.com/expressjs/morgan), arquitectura modular por capas (Rutas, Controladores y Almacenamiento/Base de datos).

---

## 📁 Estructura del Proyecto

```
Registro Histolab/
├── package.json               # Scripts unificados de ejecución
├── .gitignore
├── README.md
├── client/                    # Aplicación React Frontend
│   ├── package.json
│   ├── vite.config.js         # Proxy configurado hacia el backend /api
│   ├── index.html
│   └── src/
│       ├── components/        # Componentes reutilizables (Navbar, Formulario, Lista, Stats)
│       ├── services/          # Conexión centralizada con API REST (api.js)
│       ├── styles/            # Sistema de diseño CSS moderno
│       ├── App.jsx            # Contenedor principal con gestión de estado
│       └── main.jsx           # Punto de entrada de React
└── server/                    # API Backend Node/Express
    ├── package.json
    ├── .env.example
    └── src/
        ├── index.js           # Servidor Express y configuración
        ├── routes/            # Definición de rutas REST (/api/registros, /api/health)
        ├── controllers/       # Lógica de negocio y validaciones
        └── db/                # Base de datos / Mock persistente en memoria y utilidades
```

---

## 🛠️ Instalación y Puesta en Marcha

### 1. Instalar todas las dependencias
Desde la raíz del proyecto, ejecuta:
```bash
npm run install:all
```
*(Este comando instalará las dependencias de la raíz, del servidor y del cliente automáticamente).*

### 2. Iniciar el entorno de desarrollo
Para iniciar **simultáneamente** el Frontend y el Backend en paralelo:
```bash
npm run dev
```

- **Frontend**: `http://localhost:5173`
- **Backend API**: `http://localhost:5000` (con endpoints como `http://localhost:5000/api/registros` y `http://localhost:5000/api/health`)

---

## 📜 Scripts Disponibles

| Comando | Descripción |
|---|---|
| `npm run dev` | Inicia simultáneamente Frontend (`:5173`) y Backend (`:5000`) |
| `npm run dev:client` | Inicia únicamente el servidor de desarrollo de Vite (Frontend) |
| `npm run dev:server` | Inicia únicamente la API de Express (Backend) con recarga automática |
| `npm run build` | Compila la aplicación de React para producción |
| `npm run start` | Inicia el servidor backend en modo producción |

---

## 🔌 Endpoints de la API Backend

- `GET /api/health` - Estado de salud y uptime del servidor.
- `GET /api/registros` - Lista todos los registros con opción a filtros por búsqueda o estado.
- `GET /api/registros/:id` - Obtiene un registro específico por ID.
- `POST /api/registros` - Crea un nuevo registro de muestra/paciente.
- `PUT /api/registros/:id` - Actualiza los datos o estado de un registro.
- `DELETE /api/registros/:id` - Elimina un registro del sistema.

---

## 🗄️ Configuración de Supabase

1. Abre tu proyecto en [Supabase](https://supabase.com/).
2. Ve al **SQL Editor** y ejecuta el script ubicado en [server/src/db/schema.sql](server/src/db/schema.sql).
3. Obtén tu **Project URL** y tu **anon key** (o `service_role key`) en `Project Settings > API`.
4. Configúralas en [server/.env](server/.env):
   ```env
   SUPABASE_URL=https://tu-proyecto.supabase.co
   SUPABASE_KEY=tu-anon-key-o-service-role
   ```

