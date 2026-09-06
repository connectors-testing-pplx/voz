import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

// Relative base so the static build works on GitHub Pages project URLs
// (e.g. https://<user>.github.io/voz/) regardless of the repo name.
export default defineConfig({
  base: "./",
  plugins: [react()],
  resolve: {
    alias: {
      "@voz/compliance": path.resolve(__dirname, "../../packages/compliance/src"),
      "@voz/flows": path.resolve(__dirname, "../../packages/flows/src"),
      "@voz/reports": path.resolve(__dirname, "../../packages/reports/src"),
      "@voz/ui": path.resolve(__dirname, "../../packages/ui/src"),
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    outDir: "dist",
    sourcemap: false,
    chunkSizeWarningLimit: 1200,
  },
});
