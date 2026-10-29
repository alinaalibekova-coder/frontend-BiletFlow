import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// The backend your team runs. During development every request to /api/...
// is forwarded there by Vite, so the browser never complains about CORS.
const BACKEND_URL = "http://89.168.75.147:8080";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    proxy: {
      "/api": { target: BACKEND_URL, changeOrigin: true },
    },
  },
});
