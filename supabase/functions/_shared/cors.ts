// supabase/functions/_shared/cors.ts
// Módulo compartido de CORS — valida el origen dinámicamente
// Configurar en Supabase Dashboard > Edge Functions > Secrets:
//   ENVIRONMENT = "production"  (en producción)
//   ENVIRONMENT = "development" (en local)

const ALLOWED_ORIGINS: Record<string, string[]> = {
  production: [
    "https://contact-app.vercel.app",
    // Agregar el dominio real de Vercel si es diferente, ej:
    // "https://contactcenter-casos.vercel.app",
  ],
  preview: [
    // Dominios de preview de Vercel (ej: contact-app-git-*.vercel.app)
    // Agregar los dominios de preview si se usan PRs en Vercel
  ],
  development: [
    "http://localhost:5173",
    "http://localhost:8080",
    "http://localhost:3000",
  ],
};

function getAllowedOrigins(): string[] {
  const env = Deno.env.get("ENVIRONMENT") || "production";
  return [
    ...(ALLOWED_ORIGINS.production || []),
    ...(env !== "production"
      ? [
          ...(ALLOWED_ORIGINS.preview || []),
          ...(ALLOWED_ORIGINS.development || []),
        ]
      : []),
  ];
}

const ALLOWED_HEADERS =
  "authorization, x-client-info, apikey, content-type, " +
  "x-supabase-client-platform, x-supabase-client-platform-version, " +
  "x-supabase-client-runtime, x-supabase-client-runtime-version, x-app-name";

export function getCorsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get("origin") || "";
  const allowed = getAllowedOrigins();
  const allowOrigin = allowed.includes(origin) ? origin : "";

  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Headers": ALLOWED_HEADERS,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Max-Age": "86400",
  };
}
