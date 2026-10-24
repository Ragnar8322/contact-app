/** Traduce los errores de Supabase Auth a mensajes claros en español. */
export function loginErrorMessage(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("invalid login credentials")) return "Correo o contraseña incorrectos.";
  if (m.includes("email not confirmed")) return "Tu correo aún no está confirmado. Contacta a un administrador.";
  if (m.includes("rate limit") || m.includes("too many")) return "Demasiados intentos. Espera unos minutos y vuelve a intentarlo.";
  if (m.includes("fetch") || m.includes("network")) return "No hay conexión con el servidor. Revisa tu internet.";
  return "No se pudo iniciar sesión. Inténtalo de nuevo.";
}
