/**
 * Mensaje legible de un error capturado. Las consultas de Supabase devuelven errores como
 * objetos simples con `message` (no instancias de Error), así que `instanceof Error` no basta.
 */
export function errorMessage(err: unknown, fallback = "Error inesperado"): string {
  if (err instanceof Error) return err.message;
  if (typeof err === "object" && err !== null && "message" in err && typeof err.message === "string") return err.message;
  if (typeof err === "string" && err) return err;
  return fallback;
}
