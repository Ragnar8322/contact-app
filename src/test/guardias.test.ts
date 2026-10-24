import { describe, it, expect } from "vitest";

// Criterios de la fase 3 que deben mantenerse
describe("guardia de tamaño", () => {
  const paginas = import.meta.glob("/src/pages/*.tsx", { query: "?raw", import: "default", eager: true }) as Record<string, string>;

  it("ninguna página supera 400 líneas (la lógica va en hooks, lib/ y componentes)", () => {
    expect(Object.keys(paginas).length).toBeGreaterThan(5);
    for (const [path, code] of Object.entries(paginas)) {
      expect(code.split("\n").length, path).toBeLessThanOrEqual(400);
    }
  });
});
