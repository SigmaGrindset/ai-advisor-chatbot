import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    // In development Vite serves the bundle and the application service serves
    // the API. Proxying keeps the browser on one origin here too, so no CORS
    // configuration is needed in development either.
    proxy: { "/api": "http://localhost:8000" },
  },
});
