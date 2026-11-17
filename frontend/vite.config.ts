import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      "/api": "http://127.0.0.1:8765",
      "/ws": { target: "ws://127.0.0.1:8765", ws: true },
    },
  },
  build: { outDir: "../src/vsr/web", emptyOutDir: true },
  test: { include: ["tests/**/*.test.{ts,tsx}"], allowOnly: false, retry: 0 },
});
