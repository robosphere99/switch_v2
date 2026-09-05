import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Production admin UI testing ke liye — /api aur /socket.io production server pe
// proxy hote hain (localhost:4000 ki jagah). Bas `vite --config vite.prodtest.config.ts`
// chalao — isse production ka ADMIN PANEL localhost pe khul jata hai.
// NOTE: Ye file deploy ke liye nahi hai — sirf local testing.
export default defineConfig({
  plugins: [react()],
  server: {
    host: "0.0.0.0",
    port: 5174,
    proxy: {
      "/api": {
        target: "https://onlineswitch.bhartitechnical.com",
        changeOrigin: true,
        secure: true,
      },
      "/socket.io": {
        target: "https://onlineswitch.bhartitechnical.com",
        changeOrigin: true,
        ws: true,
        secure: true,
      },
    },
  },
});
