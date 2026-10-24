-- ============================================================
-- Fase 2 · Funciones nuevas cerradas por defecto
-- Fecha: 2026-10-27
--
-- Supabase concede EXECUTE a anon y authenticated sobre cada función que
-- se crea en public. Las fases 0 y 1 tuvieron que revocarlo función por
-- función. Desde ahora una función nueva no la puede ejecutar nadie de la
-- API hasta que su migración lo conceda explícitamente:
--
--   GRANT EXECUTE ON FUNCTION public.mi_funcion(...) TO authenticated;
-- ============================================================

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC, anon, authenticated;
