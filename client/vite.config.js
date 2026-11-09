import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vitejs.dev/config/
export default defineConfig({
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
