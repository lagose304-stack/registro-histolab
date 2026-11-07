// No real requests: verify that the free hostname preserves the API contract.
import assert from "node:assert/strict";
import gateway from "../../cloudflare/pages-worker.mjs";

const originalFetch = globalThis.fetch;
try {
  let forwarded;
  globalThis.fetch = async request => {
    forwarded = request;
    return Response.json({ success: false, reason: "NO_TOKEN" }, { status: 401 });
  };
  const request = new Request("https://registrohistolab.pages.dev/api/pruebas/seccion/demo/entregar?test=1", {
    method: "POST", headers: { Authorization: "Bearer test-token", "Content-Type": "application/json", "CF-Connecting-IP": "192.0.2.1", "X-Forwarded-For": "untrusted" },
    body: JSON.stringify({ respuestas: { q1: { a: "Respuesta" } } })
  });
  const result = await gateway.fetch(request, { HISTOLAB_API: { fetch: globalThis.fetch } });
  assert.equal(result.status, 401);
  assert.equal(forwarded.url, "https://registro-histolab.7w7.workers.dev/api/pruebas/seccion/demo/entregar?test=1");
  assert.equal(forwarded.method, "POST");
  assert.equal(forwarded.headers.get("Authorization"), "Bearer test-token");
  assert.equal(forwarded.headers.get("X-Forwarded-For"), "192.0.2.1");
  assert.equal((await forwarded.json()).respuestas.q1.a, "Respuesta");
  assert.equal((await result.json()).reason, "NO_TOKEN");
  let staticCalls = 0;
  await gateway.fetch(new Request("https://registrohistolab.pages.dev/assets/app.js"), { ASSETS: { fetch() { staticCalls++; return new Response("asset"); } } });
  await gateway.fetch(new Request("https://registrohistolab.pages.dev/api-other"), { ASSETS: { fetch() { staticCalls++; return new Response("asset"); } } });
  assert.equal(staticCalls, 2);
  globalThis.fetch = async () => { throw new Error("private internal detail"); };
  const failed = await gateway.fetch(new Request("https://registrohistolab.pages.dev/api/health"), { HISTOLAB_API: { fetch: globalThis.fetch } });
  assert.equal(failed.status, 503);
  assert.equal(failed.headers.get("Cache-Control"), "no-store");
  assert(!(await failed.text()).includes("private internal detail"));
  console.log("PASS: URL, parámetros, método, autorización, respuestas y errores preservados; archivos estáticos sin intermediación.");
} finally { globalThis.fetch = originalFetch; }
