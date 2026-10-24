-- ============================================================
-- Complemento de 20261025000300: el auth.uid() que va dentro de
-- get_user_role(...) / is_admin(...) también se envuelve en (SELECT …).
-- La función externa ya se evaluaba una sola vez; este cambio deja el
-- patrón uniforme en todas las políticas y elimina los avisos
-- auth_rls_initplan restantes de Supabase Advisors.
-- Fecha: 2026-10-25. Generado desde pg_policies de producción.
-- ============================================================

ALTER POLICY "admins_select_activity_log" ON public.activity_log
  USING (( SELECT is_admin(( SELECT auth.uid() AS uid)) AS is_admin));

ALTER POLICY "caso_historial_insert_own" ON public.caso_historial
  WITH CHECK (((cambiado_por = ( SELECT auth.uid() AS uid)) AND (( SELECT get_user_role(( SELECT auth.uid() AS uid)) AS get_user_role) IS DISTINCT FROM 'gerente'::text)));

ALTER POLICY "caso_historial_select_visible" ON public.caso_historial
  USING (((( SELECT get_user_role(( SELECT auth.uid() AS uid)) AS get_user_role) = ANY (ARRAY['admin'::text, 'gerente'::text])) OR (EXISTS ( SELECT 1
   FROM casos c
  WHERE (c.id = caso_historial.caso_id)))));

ALTER POLICY "casos_insert_no_gerente" ON public.casos
  WITH CHECK ((( SELECT get_user_role(( SELECT auth.uid() AS uid)) AS get_user_role) <> 'gerente'::text));

ALTER POLICY "casos_select_by_role" ON public.casos
  USING (
CASE ( SELECT get_user_role(( SELECT auth.uid() AS uid)) AS get_user_role)
    WHEN 'agent'::text THEN (agente_id = ( SELECT auth.uid() AS uid))
    WHEN 'supervisor'::text THEN (campana_id IN ( SELECT perfil_campanas.campana_id
       FROM perfil_campanas
      WHERE (perfil_campanas.user_id = ( SELECT auth.uid() AS uid))))
    ELSE true
END);

ALTER POLICY "casos_update_admin" ON public.casos
  USING ((( SELECT get_user_role(( SELECT auth.uid() AS uid)) AS get_user_role) = 'admin'::text))
  WITH CHECK ((( SELECT get_user_role(( SELECT auth.uid() AS uid)) AS get_user_role) = 'admin'::text));

ALTER POLICY "casos_update_agent" ON public.casos
  USING (((( SELECT get_user_role(( SELECT auth.uid() AS uid)) AS get_user_role) = 'agent'::text) AND (agente_id = ( SELECT auth.uid() AS uid)) AND (( SELECT cat_estados.es_final
   FROM cat_estados
  WHERE (cat_estados.id = casos.estado_id)) = false)))
  WITH CHECK (((( SELECT get_user_role(( SELECT auth.uid() AS uid)) AS get_user_role) = 'agent'::text) AND (agente_id = ( SELECT auth.uid() AS uid))));

ALTER POLICY "casos_update_supervisor" ON public.casos
  USING (((( SELECT get_user_role(( SELECT auth.uid() AS uid)) AS get_user_role) = 'supervisor'::text) AND (campana_id IN ( SELECT perfil_campanas.campana_id
   FROM perfil_campanas
  WHERE (perfil_campanas.user_id = ( SELECT auth.uid() AS uid)))) AND (( SELECT cat_estados.es_final
   FROM cat_estados
  WHERE (cat_estados.id = casos.estado_id)) = false)))
  WITH CHECK (((( SELECT get_user_role(( SELECT auth.uid() AS uid)) AS get_user_role) = 'supervisor'::text) AND (campana_id IN ( SELECT perfil_campanas.campana_id
   FROM perfil_campanas
  WHERE (perfil_campanas.user_id = ( SELECT auth.uid() AS uid))))));

ALTER POLICY "Admin can insert agentes" ON public.cat_agentes
  WITH CHECK (( SELECT is_admin(( SELECT auth.uid() AS uid)) AS is_admin));

ALTER POLICY "Admin can update agentes" ON public.cat_agentes
  USING (( SELECT is_admin(( SELECT auth.uid() AS uid)) AS is_admin));

ALTER POLICY "Admin can delete estados" ON public.cat_estados
  USING (( SELECT is_admin(( SELECT auth.uid() AS uid)) AS is_admin));

ALTER POLICY "Admin can insert estados" ON public.cat_estados
  WITH CHECK (( SELECT is_admin(( SELECT auth.uid() AS uid)) AS is_admin));

ALTER POLICY "Admin can update estados" ON public.cat_estados
  USING (( SELECT is_admin(( SELECT auth.uid() AS uid)) AS is_admin));

ALTER POLICY "Admin can delete tipo_servicio" ON public.cat_tipo_servicio
  USING (( SELECT is_admin(( SELECT auth.uid() AS uid)) AS is_admin));

ALTER POLICY "Admin can insert tipo_servicio" ON public.cat_tipo_servicio
  WITH CHECK (( SELECT is_admin(( SELECT auth.uid() AS uid)) AS is_admin));

ALTER POLICY "Admin can update tipo_servicio" ON public.cat_tipo_servicio
  USING (( SELECT is_admin(( SELECT auth.uid() AS uid)) AS is_admin));

ALTER POLICY "perfil_campanas_delete" ON public.perfil_campanas
  USING (( SELECT is_admin(( SELECT auth.uid() AS uid)) AS is_admin));

ALTER POLICY "perfil_campanas_insert" ON public.perfil_campanas
  WITH CHECK (( SELECT is_admin(( SELECT auth.uid() AS uid)) AS is_admin));

ALTER POLICY "perfil_campanas_select" ON public.perfil_campanas
  USING (((user_id = ( SELECT auth.uid() AS uid)) OR ( SELECT is_admin(( SELECT auth.uid() AS uid)) AS is_admin)));

ALTER POLICY "Admins can insert profiles" ON public.profiles
  WITH CHECK (( SELECT is_admin(( SELECT auth.uid() AS uid)) AS is_admin));

ALTER POLICY "Admins can read all profiles" ON public.profiles
  USING (( SELECT is_admin(( SELECT auth.uid() AS uid)) AS is_admin));

ALTER POLICY "Admins can update all profiles" ON public.profiles
  USING (( SELECT is_admin(( SELECT auth.uid() AS uid)) AS is_admin));

ALTER POLICY "novedades_insert_own_agent" ON public.schedule_novedades
  WITH CHECK (((( SELECT get_user_role(( SELECT auth.uid() AS uid)) AS get_user_role) = 'agent'::text) AND (agente_id = ( SELECT auth.uid() AS uid)) AND (estado = 'pendiente'::text)));

ALTER POLICY "novedades_select_managers" ON public.schedule_novedades
  USING ((( SELECT get_user_role(( SELECT auth.uid() AS uid)) AS get_user_role) = ANY (ARRAY['admin'::text, 'supervisor'::text, 'gerente'::text])));

ALTER POLICY "novedades_select_own_agent" ON public.schedule_novedades
  USING (((( SELECT get_user_role(( SELECT auth.uid() AS uid)) AS get_user_role) = 'agent'::text) AND (agente_id = ( SELECT auth.uid() AS uid))));

ALTER POLICY "novedades_write_admin_supervisor" ON public.schedule_novedades
  USING ((( SELECT get_user_role(( SELECT auth.uid() AS uid)) AS get_user_role) = ANY (ARRAY['admin'::text, 'supervisor'::text])))
  WITH CHECK ((( SELECT get_user_role(( SELECT auth.uid() AS uid)) AS get_user_role) = ANY (ARRAY['admin'::text, 'supervisor'::text])));

ALTER POLICY "shifts_select_managers" ON public.schedule_shifts
  USING ((( SELECT get_user_role(( SELECT auth.uid() AS uid)) AS get_user_role) = ANY (ARRAY['admin'::text, 'supervisor'::text, 'gerente'::text])));

ALTER POLICY "shifts_select_own_agent" ON public.schedule_shifts
  USING (((( SELECT get_user_role(( SELECT auth.uid() AS uid)) AS get_user_role) = 'agent'::text) AND (agente_id = ( SELECT auth.uid() AS uid))));

ALTER POLICY "shifts_write_admin_supervisor" ON public.schedule_shifts
  USING ((( SELECT get_user_role(( SELECT auth.uid() AS uid)) AS get_user_role) = ANY (ARRAY['admin'::text, 'supervisor'::text])))
  WITH CHECK ((( SELECT get_user_role(( SELECT auth.uid() AS uid)) AS get_user_role) = ANY (ARRAY['admin'::text, 'supervisor'::text])));

ALTER POLICY "schedules_select_agent_published" ON public.schedules
  USING (((( SELECT get_user_role(( SELECT auth.uid() AS uid)) AS get_user_role) = 'agent'::text) AND (estado = 'publicado'::text) AND (campana_id IN ( SELECT schedules.campana_id
   FROM user_role_assignments
  WHERE (user_role_assignments.user_id = ( SELECT auth.uid() AS uid))))));

ALTER POLICY "schedules_select_managers" ON public.schedules
  USING ((( SELECT get_user_role(( SELECT auth.uid() AS uid)) AS get_user_role) = ANY (ARRAY['admin'::text, 'supervisor'::text, 'gerente'::text])));

ALTER POLICY "schedules_write_admin_supervisor" ON public.schedules
  USING ((( SELECT get_user_role(( SELECT auth.uid() AS uid)) AS get_user_role) = ANY (ARRAY['admin'::text, 'supervisor'::text])))
  WITH CHECK ((( SELECT get_user_role(( SELECT auth.uid() AS uid)) AS get_user_role) = ANY (ARRAY['admin'::text, 'supervisor'::text])));

ALTER POLICY "shift_types_write_admin_supervisor" ON public.shift_types
  USING ((( SELECT get_user_role(( SELECT auth.uid() AS uid)) AS get_user_role) = ANY (ARRAY['admin'::text, 'supervisor'::text])))
  WITH CHECK ((( SELECT get_user_role(( SELECT auth.uid() AS uid)) AS get_user_role) = ANY (ARRAY['admin'::text, 'supervisor'::text])));

ALTER POLICY "sla_config_admin_write" ON public.sla_config
  USING (( SELECT is_admin(( SELECT auth.uid() AS uid)) AS is_admin))
  WITH CHECK (( SELECT is_admin(( SELECT auth.uid() AS uid)) AS is_admin));

ALTER POLICY "staging_casos_admin_all" ON public.staging_casos
  USING (( SELECT is_admin(( SELECT auth.uid() AS uid)) AS is_admin))
  WITH CHECK (( SELECT is_admin(( SELECT auth.uid() AS uid)) AS is_admin));
