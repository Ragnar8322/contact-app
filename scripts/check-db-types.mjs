// Verifica que src/integrations/supabase/types.ts corresponda al esquema de las migraciones.
// Uso: supabase gen types typescript --local > /tmp/types.ts && node scripts/check-db-types.mjs /tmp/types.ts
//
// Ignora dos diferencias de forma: el bloque __InternalSupabase (solo lo agrega la
// generación contra el proyecto remoto) y el formato de los tipos auxiliares.
import { readFileSync } from "node:fs";

const normalizar = (texto) =>
  texto
    .replace(/\/\/.*$/gm, "")
    .replace(/__InternalSupabase:\s*\{[^}]*\}/, "")
    .replace(/[\s()]/g, "");

const [generado] = process.argv.slice(2);
if (!generado) {
  console.error("Falta la ruta de los tipos generados desde la base local.");
  process.exit(2);
}

const enRepo = normalizar(readFileSync("src/integrations/supabase/types.ts", "utf8"));
const desdeMigraciones = normalizar(readFileSync(generado, "utf8"));

if (enRepo !== desdeMigraciones) {
  console.error(
    "types.ts no coincide con el esquema de las migraciones.\n" +
    "Regenera los tipos con:\n  supabase gen types typescript --linked > src/integrations/supabase/types.ts"
  );
  process.exit(1);
}
console.log("types.ts coincide con el esquema de las migraciones.");
