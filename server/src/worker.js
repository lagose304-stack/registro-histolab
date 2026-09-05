import { httpServerHandler } from "cloudflare:node";
import app from "./app.js";

// Registrar la aplicación Express en el puerto virtual de Cloudflare Workers
app.listen(8080);

// Exportar el manejador HTTP para Cloudflare
export default httpServerHandler({ port: 8080 });
