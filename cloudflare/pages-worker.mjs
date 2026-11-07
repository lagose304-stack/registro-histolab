const API_ORIGIN = "https://registro-histolab.7w7.workers.dev";

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname !== "/api" && !url.pathname.startsWith("/api/")) {
      return env.ASSETS.fetch(request);
    }
    const upstream = new URL(url.pathname + url.search, API_ORIGIN);
    const headers = new Headers(request.headers);
    const clientIp = request.headers.get("CF-Connecting-IP");
    if (clientIp) headers.set("X-Forwarded-For", clientIp);
    try {
      return await env.HISTOLAB_API.fetch(new Request(upstream, new Request(request, { headers, redirect: "manual" })));
    } catch {
      return Response.json({ success: false, message: "No pudimos contactar el servidor. Reintenta en un momento." }, {
        status: 503, headers: { "Cache-Control": "no-store" }
      });
    }
  }
};
