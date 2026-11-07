import { cp, copyFile, mkdir, realpath, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = await realpath(fileURLToPath(new URL("../", import.meta.url)));
const output = path.join(root, ".wrangler", "pages-site");
// Only remove this generated directory, never a junction pointing outside it.
try {
  if ((await realpath(output)).toLowerCase() !== output.toLowerCase()) throw new Error("La carpeta de salida apunta a otra ubicación.");
  await rm(output, { recursive: true });
} catch (error) { if (error.code !== "ENOENT") throw error; }
await mkdir(output, { recursive: true });
await cp(path.join(root, "client", "dist"), output, { recursive: true });
await copyFile(path.join(root, "cloudflare", "pages-worker.mjs"), path.join(output, "_worker.js"));
await writeFile(path.join(output, "_routes.json"), JSON.stringify({ version: 1, include: ["/api", "/api/*"], exclude: [] }, null, 2));
console.log("Sitio gratuito preparado en .wrangler/pages-site.");
