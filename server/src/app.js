import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { supabase, isSupabaseConfigured } from "./db/supabase.js";
import healthRoutes from "./routes/health.routes.js";
import registrosRoutes from "./routes/registros.routes.js";
import authRoutes from "./routes/auth.routes.js";
import seccionesRoutes from "./routes/secciones.routes.js";
import temarioRoutes from "./routes/temario.routes.js";
import estudiantesRoutes from "./routes/estudiantes.routes.js";
import semanasRoutes from "./routes/semanas.routes.js";
import asignacionesRoutes from "./routes/asignaciones.routes.js";
import pruebasRoutes from "./routes/pruebas.routes.js";

dotenv.config();

const app = express();
const CLIENT_URL = process.env.CLIENT_URL || "http://localhost:5173";

// Middlewares
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      
      const isAllowed =
        origin.includes("localhost") ||
        origin.includes("127.0.0.1") ||
        origin.endsWith(".pages.dev") ||
        origin.endsWith(".workers.dev") ||
        (process.env.CLIENT_URL && origin === process.env.CLIENT_URL);

      if (isAllowed || process.env.NODE_ENV === "production") {
        return callback(null, true);
      }
      return callback(null, true);
    },
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
    credentials: true
  })
);
app.use(express.json());
// Reemplazo seguro de morgan para Cloudflare Workers / Node.js (evita eval / new Function)
app.use((req, res, next) => {
  const start = Date.now();
  res.on("finish", () => {
    const duration = Date.now() - start;
    console.log(`[${req.method}] ${req.originalUrl || req.url} ${res.statusCode} (${duration}ms)`);
  });
  next();
});

// Rutas de la API
app.use("/api/health", healthRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/registros", registrosRoutes);
app.use("/api/secciones", seccionesRoutes);
app.use("/api/temario", temarioRoutes);
app.use("/api/estudiantes", estudiantesRoutes);
app.use("/api/semanas", semanasRoutes);
app.use("/api/asignaciones", asignacionesRoutes);
app.use("/api/pruebas", pruebasRoutes);

// Ruta raíz de bienvenida
app.get("/", (req, res) => {
  res.json({
    message: "Servidor API de Registro Histolab funcionando correctamente 🔬",
    endpoints: {
      health: "/api/health",
      registros: "/api/registros",
      stats: "/api/registros/stats"
    }
  });
});

// Manejo de 404
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Ruta ${req.originalUrl} no encontrada en el servidor API`
  });
});

export default app;
