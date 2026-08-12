import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// The /api proxy points at the Express backend during development,
// so the browser never deals with CORS locally.
export default defineConfig({
  plugins: [react()],
  server: {
    host: "0.0.0.0", // LAN se bhi reachable (phone/tablet se control karne ke liye)
    port: 5173,
    proxy: {
      "/api": {
        target: "http://localhost:4000",
        changeOrigin: true,
      },
      "/socket.io": {
        target: "http://localhost:4000",
        changeOrigin: true,
        ws: true,
      },
    },
  },
});
