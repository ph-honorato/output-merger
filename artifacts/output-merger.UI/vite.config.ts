import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import path from "path";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@components": path.resolve(__dirname, "./src/components"),
      "@translation": path.resolve(__dirname, "./src/i18n"),
      "@utils": path.resolve(__dirname, "./src/utils"),
      "@shared-types": path.resolve(__dirname, "./src/types"),
      "@theme": path.resolve(__dirname, "./src/theme"),
    },
  },
});
