import { describe, it, expect } from "vitest";

// La app monta solo <Sonner /> (App.tsx). Un componente que use otro sistema de
// notificaciones no muestra nada: así le pasó al módulo de Horarios.
const sources = import.meta.glob("/src/**/*.{ts,tsx}", { query: "?raw", import: "default", eager: true }) as Record<string, string>;

describe("notificaciones", () => {
  it("App monta el Toaster de sonner", () => {
    expect(sources["/src/App.tsx"]).toMatch(/<Sonner\s*\/>/);
  });

  it("ningún archivo usa el sistema use-toast, que no está montado", () => {
    expect(Object.keys(sources).length).toBeGreaterThan(50);
    const offenders = Object.entries(sources)
      .filter(([path]) => !path.startsWith("/src/test/"))
      .filter(([, code]) => /from ["']@\/(hooks|components\/ui)\/use-toast["']/.test(code))
      .map(([path]) => path);
    expect(offenders).toEqual([]);
  });
});
