import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import assert from "node:assert/strict";
const source = fs
  .readFileSync(new URL("../src/lib/api/client.ts", import.meta.url), "utf8")
  .replaceAll("import.meta.env.VITE_API_URL", "undefined");
const code = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const storage = new Map();
let refreshCalls = 0;
let refreshStatus = 200;
let calls = 0;
const context = {
  exports: {},
  window: { location: { origin: "http://test", pathname: "/display" } },
  localStorage: {
    getItem: (k) => storage.get(k) || null,
    setItem: (k, v) => storage.set(k, v),
    removeItem: (k) => storage.delete(k),
  },
  setTimeout,
  clearTimeout,
  Headers,
  AbortController,
  DOMException,
  console,
  fetch: async (url, opts) => {
    if (url.endsWith("/auth/refresh")) {
      refreshCalls++;
      await new Promise((r) => setTimeout(r, 20));
      return new Response(
        JSON.stringify({ data: { accessToken: "new", refreshToken: "rotated" } }),
        { status: refreshStatus },
      );
    }
    calls++;
    return new Response(JSON.stringify({ success: true, data: { ok: true } }), {
      status: opts.headers.Authorization === "Bearer new" ? 200 : 401,
    });
  },
};
vm.runInNewContext(code, context);
const api = context.exports;
api.setTokens("old", "refresh");
await Promise.all(Array.from({ length: 12 }, () => api.apiRequest("/resource")));
assert.equal(refreshCalls, 1);
assert.equal(storage.get("qms_access_token"), "new");
console.log("PASS concurrent 401 responses share one refresh");
api.setTokens("old", "refresh2");
refreshStatus = 503;
await api.refreshTokens();
assert.equal(storage.get("qms_refresh_token"), "refresh2");
console.log("PASS temporary refresh failure preserves session");
refreshStatus = 200;
const pending = api.refreshTokens();
api.clearTokens();
await pending;
assert.equal(storage.get("qms_access_token"), undefined);
console.log("PASS logout is not undone by an in-flight refresh");
api.setTokens("old", "refresh3");
refreshStatus = 401;
await api.refreshTokens();
assert.equal(context.window.location.href, undefined);
assert.equal(storage.get("qms_access_token"), undefined);
console.log("PASS device URL stays open when employee credentials expire");
