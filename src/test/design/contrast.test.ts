import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const css = readFileSync(resolve(__dirname, "../../index.css"), "utf8");

// Lee los tokens HSL del tema claro (:root) y verifica contraste WCAG AA (4.5:1 texto normal).
const root = css.slice(css.indexOf(":root"), css.indexOf(".dark"));
function token(name: string): [number, number, number] {
  const m = root.match(new RegExp(`--${name}:\\s*([\\d.]+)\\s+([\\d.]+)%\\s+([\\d.]+)%`));
  if (!m) throw new Error(`Token --${name} no encontrado`);
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

const rgb = (name: string) => hslToRgb(token(name));
const WHITE: [number, number, number] = [1, 1, 1];

describe("contraste del tema claro (WCAG AA ≥ 4.5:1)", () => {
  it.each([
    ["muted-foreground", "background"],
    ["muted-foreground", "card"],
    ["muted-foreground", "muted"],
    ["foreground", "background"],
    ["accent-foreground", "accent"],
    ["secondary-foreground", "secondary"],
  ])("texto %s sobre %s", (fg, bg) => {
    expect(ratio(rgb(fg), rgb(bg))).toBeGreaterThanOrEqual(4.5);
  });

  it.each(["primary", "destructive", "warning", "success"])("texto blanco sobre %s", (bg) => {
    expect(ratio(WHITE, rgb(bg))).toBeGreaterThanOrEqual(4.5);
  });

  // Alertas y KPI usan el color como texto sobre su propio tinte (p. ej. bg-warning/10)
  it.each(["warning", "success", "destructive", "primary"])("texto %s sobre fondo tintado al 10%%", (name) => {
    const tinted = blend(rgb(name), rgb("background"), 0.1);
    expect(ratio(rgb(name), tinted)).toBeGreaterThanOrEqual(4.5);
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
