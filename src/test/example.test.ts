import { describe, it, expect } from "vitest";

// Sanity check del entorno de tests
describe("entorno de tests", () => {
  it("vitest está configurado correctamente", () => {
    expect(typeof describe).toBe("function");
    expect(typeof it).toBe("function");
    expect(typeof expect).toBe("function");
  });

  it("el entorno es jsdom", () => {
    expect(typeof window).toBe("object");
    expect(typeof document).toBe("object");
  });

  it("matchMedia está disponible (mock de setup.ts)", () => {
    expect(typeof window.matchMedia).toBe("function");
    const result = window.matchMedia("(min-width: 768px)");
    expect(result).toHaveProperty("matches");
  });
});
