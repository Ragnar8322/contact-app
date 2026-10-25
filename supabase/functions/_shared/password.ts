// Misma regla que src/lib/password.ts
export function validarContrasena(pwd: unknown): string | null {
  if (typeof pwd !== "string" || pwd.length < 8) return "La contraseña debe tener al menos 8 caracteres";
  if (!/[A-Z]/.test(pwd)) return "La contraseña debe incluir al menos una mayúscula";
  if (!/[a-z]/.test(pwd)) return "La contraseña debe incluir al menos una minúscula";
  if (!/[0-9]/.test(pwd)) return "La contraseña debe incluir al menos un número";
  if (!/[^A-Za-z0-9]/.test(pwd)) return "La contraseña debe incluir al menos un carácter especial";
  return null;
}
