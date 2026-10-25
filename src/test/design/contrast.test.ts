import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const css = readFileSync(resolve(__dirname, "../../index.css"), "utf8");

// Lee los tokens HSL de cada tema y verifica contraste WCAG AA (4.5:1 texto normal).
const bloques = {
  claro: css.slice(css.indexOf(":root"), css.indexOf(".dark")),
  oscuro: css.slice(css.indexOf(".dark {"), css.indexOf("}", css.indexOf(".dark {"))),
};
function token(tema: keyof typeof bloques, name: string): [number, number, number] {
  const m = bloques[tema].match(new RegExp(`--${name}:\\s*([\\d.]+)\\s+([\\d.]+)%\\s+([\\d.]+)%`));
  if (!m) throw new Error(`Token --${name} no encontrado en el tema ${tema}`);
  return [Number(m[1]), Number(m[2]), Number(m[3])];
}

function hslToRgb([h, s, l]: [number, number, number]): [number, number, number] {
  s /= 100; l /= 100;
  const k = (n: number) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return [f(0), f(8), f(4)];
}
function luminance(rgb: [number, number, number]) {
  const [r, g, b] = rgb.map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
function blend(fg: [number, number, number], bg: [number, number, number], alpha: number): [number, number, number] {
  return [0, 1, 2].map((i) => alpha * fg[i] + (1 - alpha) * bg[i]) as [number, number, number];
}
function ratio(a: [number, number, number], b: [number, number, number]) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

describe.each(["claro", "oscuro"] as const)("contraste del tema %s (WCAG AA ≥ 4.5:1)", (tema) => {
  const rgb = (name: string) => hslToRgb(token(tema, name));

  it.each([
    ["foreground", "background"],
    ["foreground", "card"],
    ["muted-foreground", "background"],
    ["muted-foreground", "card"],
    ["muted-foreground", "muted"],
    ["secondary-foreground", "secondary"],
  ])("texto %s sobre %s", (fg, bg) => {
    expect(ratio(rgb(fg), rgb(bg))).toBeGreaterThanOrEqual(4.5);
  });

  it.each(["primary", "destructive", "warning", "success", "info", "accent"])("texto %s-foreground sobre %s", (name) => {
    expect(ratio(rgb(`${name}-foreground`), rgb(name))).toBeGreaterThanOrEqual(4.5);
  });

  // Alertas y KPI usan el color como texto sobre su propio tinte (p. ej. bg-warning/10)
  it.each(["warning", "success", "destructive", "primary"])("texto %s sobre fondo tintado al 10%%", (name) => {
    const tinted = blend(rgb(name), rgb("background"), 0.1);
    expect(ratio(rgb(name), tinted)).toBeGreaterThanOrEqual(4.5);
  });

  // El menú lateral usa sidebar-foreground con opacidad: /85 en enlaces y /75 en texto secundario
  it.each([1, 0.85, 0.75])("texto del menú al %s sobre su fondo", (alpha) => {
    const fondo = rgb("sidebar-background");
    expect(ratio(blend(rgb("sidebar-foreground"), fondo, alpha), fondo)).toBeGreaterThanOrEqual(4.5);
  });

  it.each([
    ["sidebar-accent-foreground", "sidebar-accent"],
    ["sidebar-primary-foreground", "sidebar-primary"],
  ])("menú: %s sobre %s", (fg, bg) => {
    expect(ratio(rgb(fg), rgb(bg))).toBeGreaterThanOrEqual(4.5);
  });

  it.each(["warning", "success", "destructive", "primary"])("texto %s sobre las tarjetas", (name) => {
    expect(ratio(rgb(name), rgb("card"))).toBeGreaterThanOrEqual(4.5);
  });
});

import { ESTADO_STYLES } from "@/lib/estadoColors";

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255) as [number, number, number];
}

describe("etiquetas de estado de casos (WCAG AA ≥ 4.5:1)", () => {
  it.each(Object.entries(ESTADO_STYLES))("%s", (_nombre, style) => {
    expect(ratio(hexToRgb(style.bg), hexToRgb(style.text))).toBeGreaterThanOrEqual(4.5);
  });
});
