import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  // Versión para los reportes de errores (Vercel expone el commit en el build)
  define: {
    __APP_VERSION__: JSON.stringify(process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? "local"),
  },
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    // exceljs (~850 KB) es el chunk más grande; se carga solo al importar o exportar Excel
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      output: {
        // Solo se agrupan librerías que necesita la carga inicial. Las demás (recharts, jspdf,
        // exceljs…) quedan en chunks automáticos que se descargan con la página que las usa.
        manualChunks(id) {
          if (
            id.includes("node_modules/react/") ||
            id.includes("node_modules/react-dom/") ||
            id.includes("node_modules/scheduler/") ||
            id.includes("node_modules/react-router-dom/") ||
            id.includes("node_modules/react-router/") ||
            id.includes("node_modules/@remix-run/router/")
          ) {
            return "vendor";
          }
          if (id.includes("@radix-ui")) return "radix-ui";
          if (id.includes("@supabase")) return "supabase";
          if (id.includes("date-fns")) return "date-fns";
        },
      },
    },
  },
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/test/**/*.test.{ts,tsx}"],
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov"],
      include: ["src/**/*.{ts,tsx}"],
      exclude: [
        "src/test/**",
        "src/integrations/**",
        "src/main.tsx",
        "src/vite-env.d.ts",
      ],
    },
  },
}));
