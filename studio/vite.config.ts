import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "node:path";

export default defineConfig({
  root: resolve(__dirname),
  plugins: [react()],
  server: { fs: { allow: [resolve(__dirname, "..")] } },
  build: { outDir: resolve(__dirname, "../dist/studio"), emptyOutDir: true }
});
