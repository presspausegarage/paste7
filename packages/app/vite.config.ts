import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";

// https://vitejs.dev/config/
// Configured per Tauri's guidance: fixed port, no HMR clear, no host restrictions.
export default defineConfig({
  plugins: [react()],
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    host: false,
  },
  envPrefix: ["VITE_", "TAURI_ENV_"],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  build: {
    target: "esnext",
    minify: false,
    // Skip prod sourcemaps. Monaco's bundle pushes Vite's prod build into the
    // 4 GB Node heap when sourcemaps are on; dev mode still has esbuild's
    // inline maps for stack-trace fidelity.
    sourcemap: false,
  },
});
