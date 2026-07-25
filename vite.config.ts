import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  server: {
    port: 5273,
    strictPort: true,
  },
  build: {
    outDir: "dist",
    target: "es2022",
  },
  test: {
    include: ["test/**/*.test.ts"],
    environment: "node",
  },
});
