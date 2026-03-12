# contact-app

Sistema de gestión de contactos y campañas para call centers.

Stack: React + Vite + TypeScript + Supabase + React Query + Tailwind CSS

## Setup

Este proyecto usa **npm** como package manager oficial.

```sh
# 1. Clonar el repositorio
git clone https://github.com/Ragnar8322/contact-app.git
cd contact-app

# 2. Copiar variables de entorno
cp .env.example .env
# Editar .env con las credenciales reales de Supabase

# 3. Instalar dependencias
npm ci

# 4. Servidor de desarrollo
npm run dev

# 5. Build de producción
npm run build

# 6. Lint
npm run lint

# 7. Tests
npm test
```

> **Nota:** No usar `bun`, `yarn` ni `pnpm`. Solo `npm` es el package manager soportado en este proyecto.

## Variables de entorno

Copiar `.env.example` a `.env` y completar con los valores reales del proyecto Supabase.
Nunca commitear el archivo `.env` — está en `.gitignore`.

## Tecnologías

- **Vite** — build tool
- **TypeScript** — tipado estático
- **React** — UI
- **shadcn-ui** — componentes
- **Tailwind CSS** — estilos
- **Supabase** — base de datos, autenticación y edge functions
- **React Query** — manejo de estado del servidor

## Deploy

El proyecto se despliega en Vercel. Las variables de entorno deben configurarse en
Vercel Settings > Environment Variables con los mismos nombres del `.env.example`.
