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
      "@hooks": path.resolve(__dirname, "./src/hooks"),
      "@shared-types": path.resolve(__dirname, "./src/types"),
      "@theme": path.resolve(__dirname, "./src/theme"),
    },
  },
  server: {
    headers: {
      // Content Security Policy - Report Only mode for testing
      // In production, remove 'Report-Only' and adjust as needed
      'Content-Security-Policy-Report-Only': [
        "default-src 'self'",
        "script-src 'self'",
        "style-src 'self' 'unsafe-inline'", // styled-components needs unsafe-inline
        "img-src 'self' data: https:",
        "font-src 'self' data:",
        "connect-src 'self'",
        "frame-ancestors 'none'",
        "base-uri 'self'",
        "form-action 'self'",
        "require-trusted-types-for 'script'", // Trusted Types (Chromium)
        "trusted-types output-merger-sanitizer", // Our custom policy
      ].join('; '),
      // Prevent MIME type sniffing
      'X-Content-Type-Options': 'nosniff',
      // Prevent clickjacking
      'X-Frame-Options': 'DENY',
      // Referrer policy
      'Referrer-Policy': 'strict-origin-when-cross-origin',
      // Permissions policy - restrict clipboard access
      'Permissions-Policy': 'clipboard-read=(), clipboard-write=(self)',
    },
  },
});