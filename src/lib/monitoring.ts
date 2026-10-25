// Reporte de errores a Sentry. Solo se activa con VITE_SENTRY_DSN; el SDK se descarga aparte
// para no sumar peso a la carga inicial. Sin DSN, los errores solo van a la consola.
type Sentry = typeof import("@sentry/react");

const DSN = import.meta.env.VITE_SENTRY_DSN as string | undefined;
let sentry: Sentry | null = null;
const pendientes: [unknown, Record<string, unknown>][] = [];
let usuario: { id: string; rol: string } | null = null;

/** Errores esperados que no indican una falla: reglas de negocio, credenciales, sin conexión. */
export function esErrorEsperado(err: unknown): boolean {
  const e = err as { code?: string; message?: string; name?: string } | null;
  const msg = (e?.message ?? "").toLowerCase();
  return (
    e?.code === "P0001" || // RAISE EXCEPTION de las funciones (p. ej. «la campaña no tiene supervisor»)
    msg.includes("invalid login credentials") ||
    msg.includes("failed to fetch") ||
    msg.includes("load failed") ||
    msg.includes("networkerror") ||
    e?.name === "AbortError"
  );
}

export async function initMonitoring() {
  if (!DSN || sentry) return;
  try {
    const S = await import("@sentry/react");
    S.init({
      dsn: DSN,
      environment: import.meta.env.MODE,
      // La define vite.config.ts en el build; no existe en las pruebas
      release: typeof __APP_VERSION__ === "string" ? __APP_VERSION__ : "local",
      // Sin datos personales: los cuerpos y parámetros de las peticiones llevan datos de clientes
      dataCollection: {
        userInfo: false,
        cookies: false,
        httpHeaders: false,
        httpBodies: [],
        urlQueryParams: false,
        databaseQueryData: false,
      },
      tracesSampleRate: 0,
      beforeSend(event, hint) {
        return esErrorEsperado(hint.originalException) ? null : event;
      },
    });
    sentry = S;
    if (usuario) S.setUser({ id: usuario.id });
    if (usuario) S.setTag("rol", usuario.rol);
    for (const [err, ctx] of pendientes.splice(0)) reportError(err, ctx);
  } catch (e) {
    console.error("No se pudo iniciar el monitoreo de errores", e);
  }
}

/** Identifica al usuario en los reportes (solo id y rol, sin correo ni nombre). */
export function setMonitoringUser(u: { id: string; rol: string } | null) {
  usuario = u;
  if (!sentry) return;
  sentry.setUser(u ? { id: u.id } : null);
  sentry.setTag("rol", u?.rol);
}

/** Reporta un error inesperado con contexto (qué operación falló). */
export function reportError(err: unknown, contexto: Record<string, unknown> = {}) {
  if (esErrorEsperado(err)) return;
  console.error(err, contexto);
  if (!DSN) return;
  if (!sentry) {
    if (pendientes.length < 20) pendientes.push([err, contexto]);
    return;
  }
  const S = sentry;
  S.withScope((scope) => {
    const { operacion, ...extra } = contexto;
    if (typeof operacion === "string") scope.setTag("operacion", operacion);
    scope.setExtras(extra);
    // Los errores de Supabase son objetos simples: se convierten para conservar mensaje y código
    const e = err instanceof Error ? err : Object.assign(new Error(String((err as { message?: unknown })?.message ?? err)), {
      name: "SupabaseError",
      cause: err,
    });
    if (!(err instanceof Error) && typeof err === "object" && err) scope.setExtra("supabase", err);
    S.captureException(e);
  });
}
