# contact-app

Sistema de gestión de casos, clientes, campañas y horarios para el contact center.

Stack: React + Vite + TypeScript + Supabase + React Query + Tailwind CSS

> Este proyecto usa **npm** como package manager. No usar `bun`, `yarn` ni `pnpm`.

## Desarrollo local

Necesitas Node 20, [Docker](https://www.docker.com/) y la [CLI de Supabase](https://supabase.com/docs/guides/cli).
La base de datos local se construye desde las migraciones del repositorio, con datos de ejemplo:
no hace falta acceso a producción.

```sh
git clone https://github.com/Ragnar8322/contact-app.git
cd contact-app
npm ci

# Levanta Supabase local (base de datos, autenticación y API) y aplica migraciones + datos de ejemplo
supabase start -x studio,imgproxy,logflare,vector,edge-runtime,storage-api,realtime,supavisor,mailpit,postgres-meta

# Conecta la app a la instancia local (supabase status muestra la URL y la ANON_KEY)
cat > .env.local <<EOF
VITE_SUPABASE_URL=http://127.0.0.1:54321
VITE_SUPABASE_PUBLISHABLE_KEY=<ANON_KEY de supabase status>
EOF

npm run dev   # http://localhost:8080
```

Usuarios de prueba (contraseña `Demo1234!`):

| Correo | Rol |
|---|---|
| admin@demo.local | Administrador |
| supervisor@demo.local | Supervisor (ambas campañas) |
| gerente@demo.local | Gerente (solo lectura) |
| agente1@demo.local … agente4@demo.local | Agentes de Renovación Web |
| agente5@demo.local | Agente de Asesoría Especializada |

`supabase db reset` reconstruye la base local desde cero cuando quieras volver a los datos de ejemplo.

## Comandos

| Comando | Qué hace |
|---|---|
| `npm run dev` | Servidor de desarrollo |
| `npm test` | Pruebas del frontend (Vitest) |
| `npm run lint` | ESLint |
| `npm run typecheck` | Verificación de tipos de TypeScript |
| `npm run build` | Build de producción |
| `supabase test db` | Pruebas de la base de datos (permisos y funciones, pgTAP) |

## Cambios en la base de datos

Todo cambio de esquema, permisos o funciones entra **solo por una migración**. Nunca se edita
la base de producción a mano desde el panel de Supabase.

```sh
supabase migration new descripcion_del_cambio   # crea supabase/migrations/<fecha>_descripcion_del_cambio.sql
# … escribir el SQL …
supabase db reset          # aplica todas las migraciones desde cero en local
supabase test db           # pruebas de permisos y funciones
# Agrega o actualiza pruebas en supabase/tests/database/ para lo que cambiaste

# Con el PR aprobado:
supabase link --project-ref rmpmwpzmxfdkuhcgimdi   # una sola vez
supabase db push --dry-run                          # revisa qué se aplicará
supabase db push
supabase gen types typescript --linked > src/integrations/supabase/types.ts
```

Reglas que el CI verifica:

- La base se construye desde cero con las migraciones y `supabase/seed.sql`.
- Las pruebas pgTAP pasan.
- `src/integrations/supabase/types.ts` coincide con el esquema de las migraciones.

Para tener en cuenta:

- Las funciones nuevas **no** quedan ejecutables desde la API por defecto. Concede el permiso en
  la misma migración: `GRANT EXECUTE ON FUNCTION public.mi_funcion(...) TO authenticated;`
- `supabase/seed.sql` solo debe tener datos inventados. Los catálogos (roles, estados, tipos de
  servicio, campañas) son copia de producción porque la lógica depende de sus nombres e IDs.
- No uses `supabase config push`: `supabase/config.toml` describe el entorno local y
  sobrescribiría la configuración de autenticación de producción.
- `supabase/migrations_historico/` guarda las migraciones anteriores al esquema base. No se ejecutan.

## Variables de entorno

Copia `.env.example` a `.env.local` para desarrollo. Nunca commitees archivos `.env*`
(están en `.gitignore`, salvo `.env.example`).

## Deploy

- **Frontend:** Vercel despliega `main` automáticamente. Las variables de entorno se configuran
  en Vercel → Settings → Environment Variables con los nombres de `.env.example`.
- **Base de datos:** `supabase db push`, según la sección anterior.
- **Edge functions:** `supabase functions deploy <nombre>`.
