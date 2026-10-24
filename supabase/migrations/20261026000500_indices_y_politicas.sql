-- ============================================================
-- Fase 1 · Índices de búsqueda y políticas consolidadas
-- Fecha: 2026-10-26
--
--   1. Índices de trigramas para la búsqueda de clientes (ilike '%texto%')
--      e índice compuesto de casos por campaña y estado.
--   2. Una política por tabla, rol y acción (Supabase Advisors:
--      multiple_permissive_policies). Postgres evaluaba todas las
--      políticas superpuestas en cada consulta. La lógica de cada rol
--      se conserva, con una corrección:
--        schedules: la política de agentes comparaba schedules.campana_id
--        consigo misma y dejaba ver los horarios publicados de todas las
--        campañas. Ahora solo los de las campañas del agente.
--   3. Las políticas que eran TO public pasan a TO authenticated.
-- ============================================================

-- 1. Índices
CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA extensions;

CREATE INDEX IF NOT EXISTS idx_clientes_nombre_trgm         ON public.clientes USING gin (nombre_contacto extensions.gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_clientes_razon_social_trgm   ON public.clientes USING gin (razon_social extensions.gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_clientes_identificacion_trgm ON public.clientes USING gin (identificacion extensions.gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_casos_campana_estado         ON public.casos (campana_id, estado_id);

-- Atajos legibles para las expresiones de abajo (se expanden en cada política)
--   ROL  = ( SELECT get_user_role(( SELECT auth.uid() AS uid)) AS get_user_role)
--   UID  = ( SELECT auth.uid() AS uid)

-- 2a. casos · UPDATE (tres políticas → una)
DROP POLICY IF EXISTS "casos_update_admin"      ON public.casos;
DROP POLICY IF EXISTS "casos_update_agent"      ON public.casos;
DROP POLICY IF EXISTS "casos_update_supervisor" ON public.casos;
CREATE POLICY "casos_update" ON public.casos
  FOR UPDATE TO authenticated
  USING (
    CASE ( SELECT get_user_role(( SELECT auth.uid() AS uid)) AS get_user_role)
      WHEN 'admin' THEN true
      WHEN 'agent' THEN agente_id = ( SELECT auth.uid() AS uid)
                        AND ( SELECT cat_estados.es_final FROM cat_estados WHERE cat_estados.id = casos.estado_id) = false
      WHEN 'supervisor' THEN campana_id IN ( SELECT perfil_campanas.campana_id FROM perfil_campanas
                                              WHERE perfil_campanas.user_id = ( SELECT auth.uid() AS uid))
                        AND ( SELECT cat_estados.es_final FROM cat_estados WHERE cat_estados.id = casos.estado_id) = false
      ELSE false
    END
  )
  WITH CHECK (
    CASE ( SELECT get_user_role(( SELECT auth.uid() AS uid)) AS get_user_role)
      WHEN 'admin' THEN true
      WHEN 'agent' THEN agente_id = ( SELECT auth.uid() AS uid)
      WHEN 'supervisor' THEN campana_id IN ( SELECT perfil_campanas.campana_id FROM perfil_campanas
                                              WHERE perfil_campanas.user_id = ( SELECT auth.uid() AS uid))
      ELSE false
    END
  );

-- 2b. profiles · SELECT y UPDATE (las de service_role se mantienen)
DROP POLICY IF EXISTS "Admins can read all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can read own profile"   ON public.profiles;
CREATE POLICY "profiles_select" ON public.profiles
  FOR SELECT TO authenticated
  USING (user_id = ( SELECT auth.uid() AS uid) OR ( SELECT is_admin(( SELECT auth.uid() AS uid)) AS is_admin));

DROP POLICY IF EXISTS "Admins can update all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile"   ON public.profiles;
CREATE POLICY "profiles_update" ON public.profiles
  FOR UPDATE TO authenticated
  USING      (user_id = ( SELECT auth.uid() AS uid) OR ( SELECT is_admin(( SELECT auth.uid() AS uid)) AS is_admin))
  WITH CHECK (user_id = ( SELECT auth.uid() AS uid) OR ( SELECT is_admin(( SELECT auth.uid() AS uid)) AS is_admin));

DROP POLICY IF EXISTS "Admins can insert profiles" ON public.profiles;
CREATE POLICY "profiles_insert_admin" ON public.profiles
  FOR INSERT TO authenticated
  WITH CHECK (( SELECT is_admin(( SELECT auth.uid() AS uid)) AS is_admin));

-- 2c. Horarios: una política de lectura por tabla y escritura separada por acción
--     (antes una política ALL de admin/supervisor se sumaba a las de lectura)

-- schedule_novedades
DROP POLICY IF EXISTS "novedades_write_admin_supervisor" ON public.schedule_novedades;
DROP POLICY IF EXISTS "novedades_insert_own_agent"       ON public.schedule_novedades;
DROP POLICY IF EXISTS "novedades_select_managers"        ON public.schedule_novedades;
DROP POLICY IF EXISTS "novedades_select_own_agent"       ON public.schedule_novedades;
CREATE POLICY "novedades_select" ON public.schedule_novedades
  FOR SELECT TO authenticated
  USING (
    ( SELECT get_user_role(( SELECT auth.uid() AS uid)) AS get_user_role) IN ('admin', 'supervisor', 'gerente')
    OR (( SELECT get_user_role(( SELECT auth.uid() AS uid)) AS get_user_role) = 'agent' AND agente_id = ( SELECT auth.uid() AS uid))
  );
CREATE POLICY "novedades_insert" ON public.schedule_novedades
  FOR INSERT TO authenticated
  WITH CHECK (
    ( SELECT get_user_role(( SELECT auth.uid() AS uid)) AS get_user_role) IN ('admin', 'supervisor')
    OR (( SELECT get_user_role(( SELECT auth.uid() AS uid)) AS get_user_role) = 'agent'
        AND agente_id = ( SELECT auth.uid() AS uid) AND estado = 'pendiente')
  );
CREATE POLICY "novedades_update" ON public.schedule_novedades
  FOR UPDATE TO authenticated
  USING      (( SELECT get_user_role(( SELECT auth.uid() AS uid)) AS get_user_role) IN ('admin', 'supervisor'))
  WITH CHECK (( SELECT get_user_role(( SELECT auth.uid() AS uid)) AS get_user_role) IN ('admin', 'supervisor'));
CREATE POLICY "novedades_delete" ON public.schedule_novedades
  FOR DELETE TO authenticated
  USING (( SELECT get_user_role(( SELECT auth.uid() AS uid)) AS get_user_role) IN ('admin', 'supervisor'));

-- schedule_shifts
DROP POLICY IF EXISTS "shifts_write_admin_supervisor" ON public.schedule_shifts;
DROP POLICY IF EXISTS "shifts_select_managers"        ON public.schedule_shifts;
DROP POLICY IF EXISTS "shifts_select_own_agent"       ON public.schedule_shifts;
CREATE POLICY "shifts_select" ON public.schedule_shifts
  FOR SELECT TO authenticated
  USING (
    ( SELECT get_user_role(( SELECT auth.uid() AS uid)) AS get_user_role) IN ('admin', 'supervisor', 'gerente')
    OR (( SELECT get_user_role(( SELECT auth.uid() AS uid)) AS get_user_role) = 'agent' AND agente_id = ( SELECT auth.uid() AS uid))
  );
CREATE POLICY "shifts_insert" ON public.schedule_shifts
  FOR INSERT TO authenticated
  WITH CHECK (( SELECT get_user_role(( SELECT auth.uid() AS uid)) AS get_user_role) IN ('admin', 'supervisor'));
CREATE POLICY "shifts_update" ON public.schedule_shifts
  FOR UPDATE TO authenticated
  USING      (( SELECT get_user_role(( SELECT auth.uid() AS uid)) AS get_user_role) IN ('admin', 'supervisor'))
  WITH CHECK (( SELECT get_user_role(( SELECT auth.uid() AS uid)) AS get_user_role) IN ('admin', 'supervisor'));
CREATE POLICY "shifts_delete" ON public.schedule_shifts
  FOR DELETE TO authenticated
  USING (( SELECT get_user_role(( SELECT auth.uid() AS uid)) AS get_user_role) IN ('admin', 'supervisor'));

-- schedules
DROP POLICY IF EXISTS "schedules_write_admin_supervisor" ON public.schedules;
DROP POLICY IF EXISTS "schedules_select_agent_published" ON public.schedules;
DROP POLICY IF EXISTS "schedules_select_managers"        ON public.schedules;
CREATE POLICY "schedules_select" ON public.schedules
  FOR SELECT TO authenticated
  USING (
    ( SELECT get_user_role(( SELECT auth.uid() AS uid)) AS get_user_role) IN ('admin', 'supervisor', 'gerente')
    OR (( SELECT get_user_role(( SELECT auth.uid() AS uid)) AS get_user_role) = 'agent'
        AND estado = 'publicado'
        AND campana_id IN ( SELECT perfil_campanas.campana_id FROM perfil_campanas
                             WHERE perfil_campanas.user_id = ( SELECT auth.uid() AS uid)))
  );
CREATE POLICY "schedules_insert" ON public.schedules
  FOR INSERT TO authenticated
  WITH CHECK (( SELECT get_user_role(( SELECT auth.uid() AS uid)) AS get_user_role) IN ('admin', 'supervisor'));
CREATE POLICY "schedules_update" ON public.schedules
  FOR UPDATE TO authenticated
  USING      (( SELECT get_user_role(( SELECT auth.uid() AS uid)) AS get_user_role) IN ('admin', 'supervisor'))
  WITH CHECK (( SELECT get_user_role(( SELECT auth.uid() AS uid)) AS get_user_role) IN ('admin', 'supervisor'));
CREATE POLICY "schedules_delete" ON public.schedules
  FOR DELETE TO authenticated
  USING (( SELECT get_user_role(( SELECT auth.uid() AS uid)) AS get_user_role) IN ('admin', 'supervisor'));

-- shift_types
DROP POLICY IF EXISTS "shift_types_write_admin_supervisor" ON public.shift_types;
CREATE POLICY "shift_types_insert" ON public.shift_types
  FOR INSERT TO authenticated
  WITH CHECK (( SELECT get_user_role(( SELECT auth.uid() AS uid)) AS get_user_role) IN ('admin', 'supervisor'));
CREATE POLICY "shift_types_update" ON public.shift_types
  FOR UPDATE TO authenticated
  USING      (( SELECT get_user_role(( SELECT auth.uid() AS uid)) AS get_user_role) IN ('admin', 'supervisor'))
  WITH CHECK (( SELECT get_user_role(( SELECT auth.uid() AS uid)) AS get_user_role) IN ('admin', 'supervisor'));
CREATE POLICY "shift_types_delete" ON public.shift_types
  FOR DELETE TO authenticated
  USING (( SELECT get_user_role(( SELECT auth.uid() AS uid)) AS get_user_role) IN ('admin', 'supervisor'));

-- sla_config
DROP POLICY IF EXISTS "sla_config_admin_write" ON public.sla_config;
CREATE POLICY "sla_config_insert" ON public.sla_config
  FOR INSERT TO authenticated
  WITH CHECK (( SELECT is_admin(( SELECT auth.uid() AS uid)) AS is_admin));
CREATE POLICY "sla_config_update" ON public.sla_config
  FOR UPDATE TO authenticated
  USING      (( SELECT is_admin(( SELECT auth.uid() AS uid)) AS is_admin))
  WITH CHECK (( SELECT is_admin(( SELECT auth.uid() AS uid)) AS is_admin));
CREATE POLICY "sla_config_delete" ON public.sla_config
  FOR DELETE TO authenticated
  USING (( SELECT is_admin(( SELECT auth.uid() AS uid)) AS is_admin));

-- 2d. user_role_assignments (eran TO public)
DROP POLICY IF EXISTS "Admins gestionan roles"  ON public.user_role_assignments;
DROP POLICY IF EXISTS "Usuarios leen sus roles" ON public.user_role_assignments;
CREATE POLICY "ura_select" ON public.user_role_assignments
  FOR SELECT TO authenticated
  USING (
    user_id = ( SELECT auth.uid() AS uid)
    OR EXISTS (SELECT 1 FROM profiles p WHERE p.user_id = ( SELECT auth.uid() AS uid) AND p.role_id = 1)
  );
CREATE POLICY "ura_insert_admin" ON public.user_role_assignments
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM profiles p WHERE p.user_id = ( SELECT auth.uid() AS uid) AND p.role_id = 1));
CREATE POLICY "ura_update_admin" ON public.user_role_assignments
  FOR UPDATE TO authenticated
  USING      (EXISTS (SELECT 1 FROM profiles p WHERE p.user_id = ( SELECT auth.uid() AS uid) AND p.role_id = 1))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles p WHERE p.user_id = ( SELECT auth.uid() AS uid) AND p.role_id = 1));
CREATE POLICY "ura_delete_admin" ON public.user_role_assignments
  FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles p WHERE p.user_id = ( SELECT auth.uid() AS uid) AND p.role_id = 1));

-- 2e. perfiles (tabla heredada que la app no usa; se archiva en la fase 2).
--     Sus políticas consultaban la propia tabla perfiles, lo que en Postgres
--     produce "infinite recursion detected in policy" al leerla. Se reemplazan
--     por una política por acción basada en is_admin().
DROP POLICY IF EXISTS "admin_gestiona_todo"    ON public.perfiles;
DROP POLICY IF EXISTS "perfil_propio"          ON public.perfiles;
DROP POLICY IF EXISTS "supervisores_ven_todos" ON public.perfiles;
CREATE POLICY "perfiles_select" ON public.perfiles
  FOR SELECT TO authenticated
  USING (id = ( SELECT auth.uid() AS uid) OR ( SELECT is_admin(( SELECT auth.uid() AS uid)) AS is_admin));
CREATE POLICY "perfiles_insert_admin" ON public.perfiles
  FOR INSERT TO authenticated
  WITH CHECK (( SELECT is_admin(( SELECT auth.uid() AS uid)) AS is_admin));
CREATE POLICY "perfiles_update_admin" ON public.perfiles
  FOR UPDATE TO authenticated
  USING      (( SELECT is_admin(( SELECT auth.uid() AS uid)) AS is_admin))
  WITH CHECK (( SELECT is_admin(( SELECT auth.uid() AS uid)) AS is_admin));
CREATE POLICY "perfiles_delete_admin" ON public.perfiles
  FOR DELETE TO authenticated
  USING (( SELECT is_admin(( SELECT auth.uid() AS uid)) AS is_admin));
