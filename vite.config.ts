import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
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
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        manualChunks(id) {
          // Recharts + D3 → chunk separado (era el chunk de 969 kB)
          if (id.includes("recharts") || id.includes("d3-") || id.includes("victory-")) {
            return "charts";
          }
          // Radix UI → chunk de componentes UI
          if (id.includes("@radix-ui")) {
            return "radix-ui";
          }
          // React core + router → vendor
          if (
            id.includes("node_modules/react/") ||
            id.includes("node_modules/react-dom/") ||
            id.includes("node_modules/react-router-dom/") ||
            id.includes("node_modules/react-router/")
          ) {
            return "vendor";
          }
          // Supabase → chunk separado
          if (id.includes("@supabase")) {
            return "supabase";
          }
          // date-fns → chunk separado (era format--RL8_NGy.js de 18kB + calendar)
          if (id.includes("date-fns")) {
            return "date-fns";
          }
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
