-- ============================================================
-- Fase 6C: Auditoría / Activity Log
-- ============================================================

-- Tabla principal de auditoría
CREATE TABLE IF NOT EXISTS public.activity_log (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at    timestamptz NOT NULL DEFAULT now(),
  user_id       uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  user_email    text,
  user_name     text,
  action        text NOT NULL,           -- 'INSERT' | 'UPDATE' | 'DELETE' | 'LOGIN' | 'EXPORT'
  entity        text NOT NULL,           -- 'caso' | 'cliente' | 'usuario' | 'sesion' | 'reporte'
  entity_id     text,                   -- PK del registro afectado (puede ser uuid o texto)
  campana_id    uuid REFERENCES public.cat_campanas(id) ON DELETE SET NULL,
  details       jsonb DEFAULT '{}'::jsonb,  -- diff o metadatos adicionales
  ip_address    text
);

-- Índices para queries frecuentes
CREATE INDEX IF NOT EXISTS idx_activity_log_created_at  ON public.activity_log (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_log_user_id     ON public.activity_log (user_id);
CREATE INDEX IF NOT EXISTS idx_activity_log_entity      ON public.activity_log (entity);
CREATE INDEX IF NOT EXISTS idx_activity_log_campana_id  ON public.activity_log (campana_id);

-- RLS: solo admins pueden leer; el sistema escribe vía service_role
ALTER TABLE public.activity_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admins_select_activity_log" ON public.activity_log
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      JOIN public.cat_roles r ON r.id = p.role_id
      WHERE p.id = auth.uid() AND r.nombre = 'admin'
    )
  );

-- Permite insertar desde funciones con service_role (edge functions)
CREATE POLICY "service_role_insert_activity_log" ON public.activity_log
  FOR INSERT
  WITH CHECK (true);

-- ============================================================
-- Función helper para registrar desde triggers
-- ============================================================
CREATE OR REPLACE FUNCTION public.log_activity(
  p_action   text,
  p_entity   text,
  p_entity_id text,
  p_details  jsonb DEFAULT '{}'::jsonb
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id    uuid;
  v_email      text;
  v_name       text;
  v_campana_id uuid;
BEGIN
  v_user_id := auth.uid();

  SELECT email INTO v_email FROM auth.users WHERE id = v_user_id;

  SELECT
    COALESCE(p.nombre || ' ' || p.apellido, p.nombre, v_email),
    p.campana_id
  INTO v_name, v_campana_id
  FROM public.profiles p
  WHERE p.id = v_user_id;

  INSERT INTO public.activity_log
    (user_id, user_email, user_name, action, entity, entity_id, campana_id, details)
  VALUES
    (v_user_id, v_email, v_name, p_action, p_entity, p_entity_id, v_campana_id, p_details);
END;
$$;

-- ============================================================
-- Trigger automático en casos (INSERT / UPDATE / DELETE)
-- ============================================================
CREATE OR REPLACE FUNCTION public.trg_casos_activity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_action  text;
  v_details jsonb := '{}'::jsonb;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_action  := 'INSERT';
    v_details := jsonb_build_object('estado_id', NEW.estado_id, 'campana_id', NEW.campana_id);
    PERFORM public.log_activity(v_action, 'caso', NEW.id::text, v_details);
  ELSIF TG_OP = 'UPDATE' THEN
    v_action  := 'UPDATE';
    v_details := jsonb_build_object(
      'old_estado_id', OLD.estado_id,
      'new_estado_id', NEW.estado_id
    );
    PERFORM public.log_activity(v_action, 'caso', NEW.id::text, v_details);
  ELSIF TG_OP = 'DELETE' THEN
    v_action  := 'DELETE';
    PERFORM public.log_activity(v_action, 'caso', OLD.id::text, v_details);
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_casos_activity ON public.casos;
CREATE TRIGGER trg_casos_activity
  AFTER INSERT OR UPDATE OR DELETE ON public.casos
  FOR EACH ROW EXECUTE FUNCTION public.trg_casos_activity();
