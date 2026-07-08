import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Configuración base del frontend de EstupeFarma.
// - Vercel: Root Directory = "frontend", Build = "npm run build", Output = "dist".
// - Vitest: tests de la lógica de dominio en entorno Node (sin DOM).
export default defineConfig({
  plugins: [react()],
  server: { port: 5173, open: true },
  test: {
    environment: "node",
    include: ["src/**/*.test.{js,jsx}"],
  },
});
