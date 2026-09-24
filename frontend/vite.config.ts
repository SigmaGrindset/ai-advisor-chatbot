import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    // In development Vite serves the bundle and the application service serves
    // the API. Proxying keeps the browser on one origin, as the combined image
    // does. With VITE_API_BASE_URL set, the proxy goes unused and requests
    // cross to the backend as they do from a separately hosted frontend.
    proxy: { "/api": "http://localhost:8000" },
  },
});
