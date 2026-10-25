import { z } from "zod";

// Misma regla que validan las edge functions (supabase/functions/_shared/password.ts)
export const passwordSchema = z
  .string()
  .min(8, "Mínimo 8 caracteres")
  .regex(/[A-Z]/, "Debe incluir al menos una mayúscula")
  .regex(/[a-z]/, "Debe incluir al menos una minúscula")
  .regex(/[0-9]/, "Debe incluir al menos un número")
  .regex(/[^A-Za-z0-9]/, "Debe incluir al menos un carácter especial");

// Sin caracteres que se confunden al dictarlos o copiarlos (0/O, 1/l/I)
const GRUPOS = ["ABCDEFGHJKLMNPQRSTUVWXYZ", "abcdefghijkmnpqrstuvwxyz", "23456789", "!@#$%*?"];

function aleatorio(max: number): number {
  const limite = Math.floor(0x100000000 / max) * max;
  const buf = new Uint32Array(1);
  do crypto.getRandomValues(buf); while (buf[0] >= limite);
  return buf[0] % max;
}

/** Contraseña temporal de 14 caracteres con al menos uno de cada grupo. */
export function generarContrasenaTemporal(longitud = 14): string {
  const todos = GRUPOS.join("");
  const chars = GRUPOS.map((g) => g[aleatorio(g.length)]);
  while (chars.length < longitud) chars.push(todos[aleatorio(todos.length)]);
  for (let i = chars.length - 1; i > 0; i--) {
    const j = aleatorio(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join("");
}
