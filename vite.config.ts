// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, nitro (build-only using cloudflare as a default target),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

const backendPort = process.env.BACKEND_PORT || process.env.APP_PORT || process.env.PORT || "9000";
const backendHost = `127.0.0.1:${backendPort}`;

export default defineConfig({
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
  vite: {
    server: {
      host: "0.0.0.0",
      port: 8080,
      ...(process.env.PUBLIC_DEV_ORIGIN ? { origin: process.env.PUBLIC_DEV_ORIGIN } : {}),
      // Allow Vite dev server to accept requests proxied for this hostname.
      allowedHosts: ["xnavbat.polito.uz", "localhost", "127.0.0.1"],
      ...(process.env.PUBLIC_DEV_ORIGIN
        ? {
            hmr: {
              host: new URL(process.env.PUBLIC_DEV_ORIGIN).hostname,
              protocol:
                new URL(process.env.PUBLIC_DEV_ORIGIN).protocol === "https:"
                  ? ("wss" as const)
                  : ("ws" as const),
            },
          }
        : {}),
      proxy: {
        // Local development proxy for the backend API.
        "/api": {
          target: `http://${backendHost}`,
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api(?!\/v1)/, "/api/v1"),
        },
        "/ws": {
          target: `ws://${backendHost}`,
          ws: true,
          changeOrigin: true,
        },
      },
    },
  },
});
