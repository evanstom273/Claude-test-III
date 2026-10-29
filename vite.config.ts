import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // Phaser is one big chunk, loaded only for live moments.
  build: { chunkSizeWarningLimit: 1500 },
});
