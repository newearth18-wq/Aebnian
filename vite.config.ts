import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { colyseus } from "colyseus/vite";

export default defineConfig({
  plugins: [
    react(),
    colyseus({
      serverEntry: "/src/server/index.ts",
      port: Number(process.env.PORT ?? 2567),
      serveClient: true,
    }),
  ],
});
