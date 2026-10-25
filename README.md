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

### Pruebas de punta a punta

```sh
supabase start -x studio,imgproxy,logflare,vector,storage-api,realtime,supavisor,mailpit,postgres-meta
supabase db reset
npm run test:e2e   # compila la app, la sirve en :4173 y recorre los flujos de cada rol
```

Las pruebas viven en `e2e/` y corren en cada PR. Cubren acceso por rol, crear, gestionar, cerrar,
transferir, asignar y reasignar casos, horarios, usuarios nuevos con contraseña temporal,
reportes, importación, modo oscuro y gráficas.

## Comandos

| Comando | Qué hace |
|---|---|
| `npm run dev` | Servidor de desarrollo |
| `npm test` | Pruebas del frontend (Vitest) |
| `npm run lint` | ESLint (falla con cualquier advertencia) |
| `npm run typecheck` | Verificación de tipos de TypeScript (`strict`) |
| `npm run build` | Build de producción |
| `npm run check:bundle` | Verifica que ningún archivo de la carga inicial supere 300 KB comprimido (después de `build`) |
| `supabase test db` | Pruebas de la base de datos (permisos y funciones, pgTAP) |
| `npm run test:e2e` | Flujos de punta a punta con Playwright (requiere `supabase start` con edge functions; ver abajo) |

## Convenciones del código

- TypeScript en modo `strict` y `any` prohibido por lint. Los tipos de las filas salen de
  `src/integrations/supabase/types.ts` o del `select` de cada consulta.
- Las páginas (`src/pages`) solo componen: ninguna supera 400 líneas (lo verifica una prueba).
  Las consultas van en `src/hooks`, los cálculos en `src/lib` y las secciones en `src/components/<módulo>`.
- Reportes PDF y Excel en `src/lib/reports/`. Excel se lee y escribe con ExcelJS, que se descarga
  solo al importar o exportar.
- Los errores de Supabase son objetos con `message`, no instancias de `Error`: para mostrarlos usa
  `errorMessage(err)` de `src/lib/errors.ts`.
- Pruebas de hooks con el Supabase simulado de `src/test/helpers/fakeSupabase.ts`.

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

## Monitoreo de errores (Sentry)

El reporte de errores se activa solo si existe el DSN; sin él, la app no carga el SDK.

1. Crea en Sentry un proyecto **React** y copia su DSN.
2. **Frontend:** en Vercel → Settings → Environment Variables agrega `VITE_SENTRY_DSN` y vuelve a desplegar.
3. **Edge functions:** `supabase secrets set SENTRY_DSN=<dsn>`.
4. **Alertas:** en Sentry → Alerts crea una regla *«A new issue is created»* con aviso por correo, y
   otra de *«Number of events > 10 in 5 minutes»* para fallos repetidos.

Se reportan errores de render, fallos de guardado y de consulta, errores de autenticación y de las
edge functions, con el id y el rol del usuario. No se envían correos, nombres ni el contenido de
las peticiones. Las reglas de negocio (por ejemplo, «la campaña no tiene supervisor»), las
credenciales incorrectas y la falta de conexión no se reportan.

## Edge functions

Secrets en producción (`supabase secrets set NOMBRE=valor`):

| Secret | Para qué |
|---|---|
| `ENVIRONMENT` | `production`: solo el dominio de producción puede llamar las funciones (CORS) |
| `ALLOWED_ORIGINS` | Opcional: dominios extra separados por coma (por ejemplo, un dominio propio) |
| `SENTRY_DSN` | Opcional: reporte de errores |

En local, `supabase/config.toml` fija `ENVIRONMENT=development`.

## Auditoría

`activity_log` conserva 18 meses en línea. El día 1 de cada mes, un trabajo de pg_cron mueve lo
anterior a `archivo.activity_log` (no se borra; ese esquema no lo expone la API).

## Deploy

- **Frontend:** Vercel despliega `main` automáticamente. Las variables de entorno se configuran
  en Vercel → Settings → Environment Variables con los nombres de `.env.example`.
- **Base de datos:** `supabase db push`, según la sección anterior.
- **Edge functions:** `supabase functions deploy <nombre>`.
