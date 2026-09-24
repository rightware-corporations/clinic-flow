import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

// No Docker required: Vite :8080, Spring Boot :8081. Same-origin dev proxy.
export default defineConfig(() => ({
  server: {
    host: "::",
    port: 8080,
    proxy: {
      "/api": { target: "http://localhost:8081", changeOrigin: true },
      "/actuator": { target: "http://localhost:8081", changeOrigin: true },
    },
    hmr: { overlay: false },
  },
  plugins: [react()],
  resolve: { alias: { "@": path.resolve(__dirname, "./src") } },
}));
