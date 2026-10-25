// Reporte de errores a Sentry desde las Edge Functions.
// Solo se activa si existe el secret SENTRY_DSN; sin él, los errores quedan en los logs de Supabase.
type SentryModule = typeof import("npm:@sentry/deno@11.6.0");

const DSN = Deno.env.get("SENTRY_DSN");
let cargando: Promise<SentryModule | null> | null = null;

function sentry(): Promise<SentryModule | null> {
  if (!DSN) return Promise.resolve(null);
  cargando ??= import("npm:@sentry/deno@11.6.0")
    .then((S) => {
      S.init({
        dsn: DSN,
        environment: Deno.env.get("ENVIRONMENT") ?? "production",
        // Las integraciones por defecto asumen un proceso de larga vida
        defaultIntegrations: false,
        tracesSampleRate: 0,
        // Sin datos personales: los cuerpos de las peticiones llevan correos y contraseñas temporales
        dataCollection: { userInfo: false, cookies: false, httpHeaders: false, httpBodies: [], urlQueryParams: false },
      });
      return S;
    })
    .catch((e) => {
      console.error("Sentry no disponible:", e);
      return null;
    });
  return cargando;
}

/** Registra el error en los logs y, si hay DSN, en Sentry (espera el envío antes de responder). */
export async function reportarError(err: unknown, funcion: string, contexto: Record<string, unknown> = {}) {
  console.error(`[${funcion}]`, err, contexto);
  const S = await sentry();
  if (!S) return;
  S.withScope((scope) => {
    scope.setTag("funcion", funcion);
    scope.setExtras(contexto);
    S.captureException(err);
  });
  await S.flush(2000);
}
