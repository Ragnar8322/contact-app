/// <reference types="vite/client" />

declare const __APP_VERSION__: string;

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_PUBLISHABLE_KEY: string;
  /** Opcional: activa el reporte de errores a Sentry */
  readonly VITE_SENTRY_DSN?: string;
}
