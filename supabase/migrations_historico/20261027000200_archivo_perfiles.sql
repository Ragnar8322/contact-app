-- ============================================================
-- Fase 2 · Archivar el esquema heredado de perfiles
-- Fecha: 2026-10-27
--
-- La tabla public.perfiles (44 filas) y el tipo rol_usuario son de una
-- versión anterior: la app usa profiles. El trigger on_auth_user_created
-- seguía escribiendo en perfiles por cada usuario nuevo. Los perfiles
-- reales los crea la edge function invite-user.
--
-- Se mueven a un esquema "archivo" que la API no expone, en lugar de
-- borrarlos, para poder consultarlos o restaurarlos si hiciera falta.
-- ============================================================

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();

CREATE SCHEMA IF NOT EXISTS archivo;
REVOKE ALL ON SCHEMA archivo FROM PUBLIC, anon, authenticated;
COMMENT ON SCHEMA archivo IS 'Objetos heredados fuera de uso. No expuestos por la API.';

ALTER TABLE public.perfiles SET SCHEMA archivo;
ALTER TYPE  public.rol_usuario SET SCHEMA archivo;
