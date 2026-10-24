-- ============================================================
-- Limpieza de seguridad (avisos de Supabase Advisors)
-- Fecha: 2026-10-25
--
--   1. Ninguna función SECURITY DEFINER se ejecuta sin sesión (anon).
--   2. Las funciones de trigger y auxiliares internas no se pueden
--      llamar como RPC; los triggers siguen funcionando porque Postgres
--      no verifica EXECUTE al dispararlos.
--   3. search_path fijo en las funciones que lo tenían mutable.
--   4. Índices duplicados eliminados.
--
-- is_admin y get_user_role conservan EXECUTE para authenticated:
-- las políticas RLS las evalúan con el rol del usuario.
-- ============================================================

-- 1. Sin acceso anónimo a funciones privilegiadas
DO $$
DECLARE f record;
BEGIN
  FOR f IN
    SELECT p.oid::regprocedure AS sig
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public' AND p.prosecdef
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon', f.sig);
  END LOOP;
END $$;

-- Las funciones que el frontend llama como RPC necesitan authenticated
-- explícito, porque antes lo heredaban de PUBLIC.
DO $$
DECLARE f record;
BEGIN
  FOR f IN
    SELECT p.oid::regprocedure AS sig
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public' AND p.prosecdef
       AND p.proname IN (
         'is_admin', 'get_user_role', 'get_casos_counts', 'get_agentes_by_campana',
         'generate_schedule', 'copy_previous_week_shifts', 'reset_schedule_shifts',
         'unpublish_schedule', 'process_staging_casos', 'log_activity'
       )
  LOOP
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated', f.sig);
  END LOOP;
END $$;

-- 2. Funciones de trigger y auxiliares: nunca como RPC
DO $$
DECLARE f record;
BEGIN
  FOR f IN
    SELECT p.oid::regprocedure AS sig
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public'
       AND p.proname IN (
         'handle_new_user', 'protect_profile_privileged_columns', 'set_schedule_creado_por',
         'trg_casos_activity', 'assert_schedule_manager'
       )
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon, authenticated', f.sig);
  END LOOP;
END $$;

-- 3. search_path fijo
ALTER FUNCTION public.set_updated_at()          SET search_path = public;
ALTER FUNCTION public.update_updated_at()       SET search_path = public;
ALTER FUNCTION public.set_schedule_creado_por() SET search_path = public;

-- 4. Índices duplicados (se conserva uno de cada par)
DROP INDEX IF EXISTS public.idx_historial_caso_id;
DROP INDEX IF EXISTS public.idx_ura_user_id;
