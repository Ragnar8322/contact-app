-- ============================================================
-- Rendimiento de RLS: funciones de autenticación evaluadas una vez por
-- consulta en lugar de una vez por fila (Supabase Advisors: auth_rls_initplan)
-- Fecha: 2026-10-25
--
-- Generado a partir de pg_policies de producción. Cada política conserva
-- exactamente su lógica; solo se envuelven auth.uid(), auth.role(),
-- get_user_role(auth.uid()) e is_admin(auth.uid()) en (SELECT …), lo que
-- permite a Postgres calcularlas una vez (InitPlan) y no por cada fila.
-- Con 10.625 casos, casos_select_by_role llamaba get_user_role 10.625 veces.
-- ============================================================

ALTER POLICY "admins_select_activity_log" ON public.activity_log
  USING (( SELECT is_admin(auth.uid()) ));

ALTER POLICY "campanas_select" ON public.campanas
  USING ((( SELECT auth.role() ) = 'authenticated'::text));

ALTER POLICY "caso_historial_insert_own" ON public.caso_historial
  WITH CHECK (((cambiado_por = ( SELECT auth.uid() )) AND (( SELECT get_user_role(auth.uid()) AS get_user_role) IS DISTINCT FROM 'gerente'::text)));

ALTER POLICY "casos_insert_no_gerente" ON public.casos
  WITH CHECK ((( SELECT get_user_role(auth.uid()) ) <> 'gerente'::text));

ALTER POLICY "casos_select_by_role" ON public.casos
  USING (
CASE ( SELECT get_user_role(auth.uid()) )
    WHEN 'agent'::text THEN (agente_id = ( SELECT auth.uid() ))
    WHEN 'supervisor'::text THEN (campana_id IN ( SELECT perfil_campanas.campana_id
       FROM perfil_campanas
      WHERE (perfil_campanas.user_id = ( SELECT auth.uid() ))))
    ELSE true
END);

ALTER POLICY "casos_update_admin" ON public.casos
  USING ((( SELECT get_user_role(auth.uid()) ) = 'admin'::text))
  WITH CHECK ((( SELECT get_user_role(auth.uid()) ) = 'admin'::text));

ALTER POLICY "casos_update_agent" ON public.casos
  USING (((( SELECT get_user_role(auth.uid()) ) = 'agent'::text) AND (agente_id = ( SELECT auth.uid() )) AND (( SELECT cat_estados.es_final
   FROM cat_estados
  WHERE (cat_estados.id = casos.estado_id)) = false)))
  WITH CHECK (((( SELECT get_user_role(auth.uid()) ) = 'agent'::text) AND (agente_id = ( SELECT auth.uid() ))));

ALTER POLICY "casos_update_supervisor" ON public.casos
  USING (((( SELECT get_user_role(auth.uid()) ) = 'supervisor'::text) AND (campana_id IN ( SELECT perfil_campanas.campana_id
   FROM perfil_campanas
  WHERE (perfil_campanas.user_id = ( SELECT auth.uid() )))) AND (( SELECT cat_estados.es_final
   FROM cat_estados
  WHERE (cat_estados.id = casos.estado_id)) = false)))
  WITH CHECK (((( SELECT get_user_role(auth.uid()) ) = 'supervisor'::text) AND (campana_id IN ( SELECT perfil_campanas.campana_id
   FROM perfil_campanas
  WHERE (perfil_campanas.user_id = ( SELECT auth.uid() ))))));

ALTER POLICY "Admin can insert agentes" ON public.cat_agentes
  WITH CHECK (( SELECT is_admin(auth.uid()) ));

ALTER POLICY "Admin can update agentes" ON public.cat_agentes
  USING (( SELECT is_admin(auth.uid()) ));

ALTER POLICY "cat_agentes_select" ON public.cat_agentes
  USING ((( SELECT auth.role() ) = 'authenticated'::text));

ALTER POLICY "Admin can delete estados" ON public.cat_estados
  USING (( SELECT is_admin(auth.uid()) ));

ALTER POLICY "Admin can insert estados" ON public.cat_estados
  WITH CHECK (( SELECT is_admin(auth.uid()) ));

ALTER POLICY "Admin can update estados" ON public.cat_estados
  USING (( SELECT is_admin(auth.uid()) ));

ALTER POLICY "cat_estados_select" ON public.cat_estados
  USING ((( SELECT auth.role() ) = 'authenticated'::text));

ALTER POLICY "Admin can delete tipo_servicio" ON public.cat_tipo_servicio
  USING (( SELECT is_admin(auth.uid()) ));

ALTER POLICY "Admin can insert tipo_servicio" ON public.cat_tipo_servicio
  WITH CHECK (( SELECT is_admin(auth.uid()) ));

ALTER POLICY "Admin can update tipo_servicio" ON public.cat_tipo_servicio
  USING (( SELECT is_admin(auth.uid()) ));

ALTER POLICY "cat_tipo_servicio_select" ON public.cat_tipo_servicio
  USING ((( SELECT auth.role() ) = 'authenticated'::text));

ALTER POLICY "clientes_insert" ON public.clientes
  WITH CHECK ((( SELECT auth.role() ) = 'authenticated'::text));

ALTER POLICY "clientes_select_authenticated" ON public.clientes
  USING ((( SELECT auth.role() ) = 'authenticated'::text));

ALTER POLICY "clientes_update_authenticated" ON public.clientes
  USING ((( SELECT auth.role() ) = 'authenticated'::text))
  WITH CHECK ((( SELECT auth.role() ) = 'authenticated'::text));

ALTER POLICY "perfil_campanas_delete" ON public.perfil_campanas
  USING (( SELECT is_admin(auth.uid()) ));

ALTER POLICY "perfil_campanas_insert" ON public.perfil_campanas
  WITH CHECK (( SELECT is_admin(auth.uid()) ));

ALTER POLICY "perfil_campanas_select" ON public.perfil_campanas
  USING (((user_id = ( SELECT auth.uid() )) OR ( SELECT is_admin(auth.uid()) )));

ALTER POLICY "admin_gestiona_todo" ON public.perfiles
  USING ((EXISTS ( SELECT 1
   FROM perfiles p
  WHERE ((p.id = ( SELECT auth.uid() )) AND (p.rol = 'admin'::rol_usuario)))));

ALTER POLICY "perfil_propio" ON public.perfiles
  USING ((( SELECT auth.uid() ) = id));

ALTER POLICY "supervisores_ven_todos" ON public.perfiles
  USING ((EXISTS ( SELECT 1
   FROM perfiles p
  WHERE ((p.id = ( SELECT auth.uid() )) AND (p.rol = ANY (ARRAY['supervisor'::rol_usuario, 'admin'::rol_usuario]))))));

ALTER POLICY "Admins can insert profiles" ON public.profiles
  WITH CHECK (( SELECT is_admin(auth.uid()) ));

ALTER POLICY "Admins can read all profiles" ON public.profiles
  USING (( SELECT is_admin(auth.uid()) ));

ALTER POLICY "Admins can update all profiles" ON public.profiles
  USING (( SELECT is_admin(auth.uid()) ));

ALTER POLICY "Users can read own profile" ON public.profiles
  USING ((( SELECT auth.uid() ) = user_id));

ALTER POLICY "Users can update own profile" ON public.profiles
  USING ((( SELECT auth.uid() ) = user_id))
  WITH CHECK ((( SELECT auth.uid() ) = user_id));

ALTER POLICY "novedades_insert_own_agent" ON public.schedule_novedades
  WITH CHECK (((( SELECT get_user_role(auth.uid()) ) = 'agent'::text) AND (agente_id = ( SELECT auth.uid() )) AND (estado = 'pendiente'::text)));

ALTER POLICY "novedades_select_managers" ON public.schedule_novedades
  USING ((( SELECT get_user_role(auth.uid()) ) = ANY (ARRAY['admin'::text, 'supervisor'::text, 'gerente'::text])));

ALTER POLICY "novedades_select_own_agent" ON public.schedule_novedades
  USING (((( SELECT get_user_role(auth.uid()) ) = 'agent'::text) AND (agente_id = ( SELECT auth.uid() ))));

ALTER POLICY "novedades_write_admin_supervisor" ON public.schedule_novedades
  USING ((( SELECT get_user_role(auth.uid()) ) = ANY (ARRAY['admin'::text, 'supervisor'::text])))
  WITH CHECK ((( SELECT get_user_role(auth.uid()) ) = ANY (ARRAY['admin'::text, 'supervisor'::text])));

ALTER POLICY "shifts_select_managers" ON public.schedule_shifts
  USING ((( SELECT get_user_role(auth.uid()) ) = ANY (ARRAY['admin'::text, 'supervisor'::text, 'gerente'::text])));

ALTER POLICY "shifts_select_own_agent" ON public.schedule_shifts
  USING (((( SELECT get_user_role(auth.uid()) ) = 'agent'::text) AND (agente_id = ( SELECT auth.uid() ))));

ALTER POLICY "shifts_write_admin_supervisor" ON public.schedule_shifts
  USING ((( SELECT get_user_role(auth.uid()) ) = ANY (ARRAY['admin'::text, 'supervisor'::text])))
  WITH CHECK ((( SELECT get_user_role(auth.uid()) ) = ANY (ARRAY['admin'::text, 'supervisor'::text])));

ALTER POLICY "schedules_select_agent_published" ON public.schedules
  USING (((( SELECT get_user_role(auth.uid()) ) = 'agent'::text) AND (estado = 'publicado'::text) AND (campana_id IN ( SELECT schedules.campana_id
   FROM user_role_assignments
  WHERE (user_role_assignments.user_id = ( SELECT auth.uid() ))))));

ALTER POLICY "schedules_select_managers" ON public.schedules
  USING ((( SELECT get_user_role(auth.uid()) ) = ANY (ARRAY['admin'::text, 'supervisor'::text, 'gerente'::text])));

ALTER POLICY "schedules_write_admin_supervisor" ON public.schedules
  USING ((( SELECT get_user_role(auth.uid()) ) = ANY (ARRAY['admin'::text, 'supervisor'::text])))
  WITH CHECK ((( SELECT get_user_role(auth.uid()) ) = ANY (ARRAY['admin'::text, 'supervisor'::text])));

ALTER POLICY "shift_types_write_admin_supervisor" ON public.shift_types
  USING ((( SELECT get_user_role(auth.uid()) ) = ANY (ARRAY['admin'::text, 'supervisor'::text])))
  WITH CHECK ((( SELECT get_user_role(auth.uid()) ) = ANY (ARRAY['admin'::text, 'supervisor'::text])));

ALTER POLICY "sla_config_admin_write" ON public.sla_config
  USING (( SELECT is_admin(auth.uid()) ))
  WITH CHECK (( SELECT is_admin(auth.uid()) ));

ALTER POLICY "sla_config_select_authenticated" ON public.sla_config
  USING ((( SELECT auth.role() ) = 'authenticated'::text));

ALTER POLICY "staging_casos_admin_all" ON public.staging_casos
  USING (( SELECT is_admin(auth.uid()) ))
  WITH CHECK (( SELECT is_admin(auth.uid()) ));

ALTER POLICY "Admins gestionan roles" ON public.user_role_assignments
  USING ((EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.user_id = ( SELECT auth.uid() )) AND (p.role_id = 1)))));

ALTER POLICY "Usuarios leen sus roles" ON public.user_role_assignments
  USING ((user_id = ( SELECT auth.uid() )));
