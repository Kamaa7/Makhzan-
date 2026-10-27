import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
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
