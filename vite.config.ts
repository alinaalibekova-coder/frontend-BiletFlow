import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// The backend your team runs. During development every request to /api/...
// is forwarded there by Vite, so the browser never complains about CORS.
const BACKEND_URL = "https://biletflow.duckdns.org";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    proxy: {
      "/api": { target: BACKEND_URL, changeOrigin: true },
    },
  },
});
