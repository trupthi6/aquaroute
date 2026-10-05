/// <reference types="vitest" />
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

// Dev: /api and /health are proxied to FastAPI, so the browser never hits CORS.
const API_TARGET = process.env.VITE_API_PROXY ?? "http://127.0.0.1:8000";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      // Module 2: installable app shell only. Offline data/tiles/queue arrive in Module 4.
      manifest: {
        name: "AquaRoute",
        short_name: "AquaRoute",
        description: "Street-level flood risk for the next 3 hours",
        theme_color: "#0b3d5c",
        background_color: "#0b3d5c",
        display: "standalone",
        icons: [{ src: "icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" }],
      },
      workbox: { navigateFallbackDenylist: [/^\/api/, /^\/health/] },
    }),
  ],
  server: {
    port: 5173,
    proxy: { "/api": API_TARGET, "/health": API_TARGET },
  },
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    css: false,
    exclude: ["node_modules", "dist", ".idea", ".git", ".cache", "e2e"],
  },
});
