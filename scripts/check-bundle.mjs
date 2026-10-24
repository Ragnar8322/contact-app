// Verifica que ningún archivo de la carga inicial (los que index.html enlaza) supere el límite comprimido.
// Uso: node scripts/check-bundle.mjs [dist] [límite en KB]
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { gzipSync } from "node:zlib";

const dist = process.argv[2] ?? "dist";
const limiteKB = Number(process.argv[3] ?? 300);
const html = readFileSync(join(dist, "index.html"), "utf8");
const assets = [...new Set([...html.matchAll(/(?:src|href)="\/?(assets\/[^"]+\.(?:js|css))"/g)].map((m) => m[1]))];

if (assets.length === 0) {
  console.error("No se encontraron assets en index.html");
  process.exit(1);
}

let falla = false;
let total = 0;
for (const a of assets) {
  const kb = gzipSync(readFileSync(join(dist, a))).length / 1024;
  total += kb;
  const excede = kb > limiteKB;
  falla ||= excede;
  console.log(`${excede ? "✗" : "✓"} ${a.padEnd(40)} ${kb.toFixed(1).padStart(7)} KB gzip`);
}
console.log(`Carga inicial: ${total.toFixed(1)} KB gzip en ${assets.length} archivos (límite por archivo: ${limiteKB} KB)`);
if (falla) {
  console.error("Un archivo de la carga inicial supera el límite. Mueve la dependencia a un import() dinámico o revisa manualChunks en vite.config.ts.");
  process.exit(1);
}
