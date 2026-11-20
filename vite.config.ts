import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  base: process.env.TAURI_ENV_PLATFORM ? "./" : "/",
  clearScreen: false,
  plugins: [react()],
  server: {
    host: "127.0.0.1",
    port: 5188,
    strictPort: true,
  },
  optimizeDeps: {
    include: ["sql.js"],
  },
  assetsInclude: ["**/*.wasm"],
  build: {
    commonjsOptions: {
      include: [/sql\.js/, /node_modules/],
    },
  },
});
