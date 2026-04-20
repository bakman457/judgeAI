import react from "@vitejs/plugin-react";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const templateRoot = fileURLToPath(new URL(".", import.meta.url));

export default {
  root: templateRoot,
  plugins: [react()],
  resolve: {
    alias: {
      "@": resolve(templateRoot, "client", "src"),
      "@shared": resolve(templateRoot, "shared"),
      "@assets": resolve(templateRoot, "attached_assets"),
    },
  },
  test: {
    environment: "node",
    pool: "threads",
    include: [
      "server/**/*.test.ts",
      "server/**/*.spec.ts",
      "client/src/**/*.test.ts",
      "client/src/**/*.spec.ts",
    ],
  },
};
