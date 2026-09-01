import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000
  },
  preview: {
    port: 4173
  },
  build: {
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("node_modules")) {
            if (id.includes("@mui/x-data-grid")) {
              return "vendor-mui-x";
            }
            if (id.includes("@mui/")) {
              return "vendor-mui";
            }
            if (id.includes("lucide-react")) {
              return "vendor-icons";
            }
            if (id.includes("react-dom")) {
              return "vendor-react-dom";
            }
            if (id.includes("@react-google-maps")) {
              return "vendor-maps";
            }
          }
        }
      }
    }
  },
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: "./vitest.setup.ts",
    css: true,
    // tests/e2e is Playwright's. Its specs import @playwright/test, which throws under
    // vitest, so without this the whole suite reports a failure for a file that is not
    // vitest's to run.
    exclude: ["**/node_modules/**", "**/dist/**", "tests/e2e/**"]
  }
});
