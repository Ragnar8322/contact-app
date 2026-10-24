import { describe, it, expect } from "vitest";

// Cada <Label> de un formulario debe apuntar a su campo (htmlFor) o servir de
// etiqueta de grupo (id + aria-labelledby). Sin eso, el lector de pantalla no
// anuncia el campo y hacer clic en la etiqueta no lo enfoca.
const sources = import.meta.glob(
  ["/src/pages/**/*.tsx", "/src/components/**/*.tsx", "!/src/components/ui/**"],
  { query: "?raw", import: "default", eager: true },
) as Record<string, string>;

describe("etiquetas de formulario", () => {
  it("ningún <Label> queda sin asociar", () => {
    expect(Object.keys(sources).length).toBeGreaterThan(30);
    const offenders = Object.entries(sources).flatMap(([path, code]) =>
      [...code.matchAll(/<Label(?![^>]*\b(?:htmlFor|id)=)[^>]*>([^<]*)/g)].map((m) => `${path}: ${m[1].trim()}`),
    );
    expect(offenders).toEqual([]);
  });
});
