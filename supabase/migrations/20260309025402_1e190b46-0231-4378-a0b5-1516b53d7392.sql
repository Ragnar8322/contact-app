
-- Enable RLS on sla_config and staging_casos
ALTER TABLE public.sla_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staging_casos ENABLE ROW LEVEL SECURITY;

-- sla_config: authenticated can read, admin can write
CREATE POLICY "sla_config_select_authenticated" ON public.sla_config
  FOR SELECT TO authenticated
  USING (auth.role() = 'authenticated'::text);

CREATE POLICY "sla_config_admin_write" ON public.sla_config
  FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

-- staging_casos: admin can do all
CREATE POLICY "staging_casos_admin_all" ON public.staging_casos
  FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));
