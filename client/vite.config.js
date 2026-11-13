import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { execFileSync } from "node:child_process";

let updateNumber = "desarrollo";
try {
  updateNumber = execFileSync("git", ["rev-list", "--count", "HEAD"], { encoding: "utf8" }).trim();
} catch { /* Una copia sin historial se identifica como desarrollo. */ }
const siteUpdate = { number: updateNumber, updatedAt: new Date().toISOString() };

// https://vitejs.dev/config/
export default defineConfig({
  define: { __SITE_UPDATE__: JSON.stringify(siteUpdate) },
  plugins: [react(), {
    name: "public-information-pages",
    configureServer(server) {
      server.middlewares.use((req, _res, next) => {
        const url = new URL(req.url, "http://localhost");
        if (/^\/(privacidad|condiciones)\/?$/.test(url.pathname)) {
          req.url = url.pathname.replace(/\/$/, "") + "/index.html" + url.search;
        }
        next();
      });
    }
  }],
  server: {
    host: "127.0.0.1",
    port: 43173,
    strictPort: true,
    proxy: {
      "/api": {
        target: "http://127.0.0.1:43174",
        changeOrigin: true,
        secure: false
      }
    }
  }
});
