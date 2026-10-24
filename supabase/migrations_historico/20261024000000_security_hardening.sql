-- ============================================================
-- Hardening de seguridad
-- Fecha: 2026-10-24
-- Escrita contra el esquema real de producción (supabase db dump),
-- que difiere de las migraciones anteriores del repo.
--
--   1. profiles: un usuario ya no puede cambiarse su propio rol
--   2. caso_historial: lectura según visibilidad del caso,
--      inserción solo a nombre propio
--   3. get_casos_counts: respeta la RLS de casos
--   4. process_staging_casos: (re)creada, solo admin, con campaña
--   5. activity_log: sin INSERT abierto; log_activity con search_path
--   6. create_client_and_case: eliminada si existe
-- ============================================================

-- ------------------------------------------------------------
-- 1. profiles
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Los perfiles los crean el trigger handle_new_user y la edge function
-- invite-user (service_role). Un usuario no necesita insertar el suyo.
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;

-- RLS no puede restringir columnas: un trigger impide que un no-admin
-- cambie role_id o user_id. auth.uid() es NULL para service_role y
-- triggers internos, que sí pueden.
CREATE OR REPLACE FUNCTION public.protect_profile_privileged_columns()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR public.is_admin(auth.uid()) THEN
    RETURN NEW;
  END IF;

  IF NEW.role_id IS DISTINCT FROM OLD.role_id
     OR NEW.user_id IS DISTINCT FROM OLD.user_id THEN
    RAISE EXCEPTION 'No autorizado para modificar el rol del perfil'
      USING ERRCODE = '42501';
  END IF;

  -- El usuario puede apagar su propio must_change_password (ChangePassword),
  -- pero no encenderlo.
  IF NEW.must_change_password = true AND OLD.must_change_password = false THEN
    RAISE EXCEPTION 'No autorizado para modificar must_change_password'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_profile_privileged_columns ON public.profiles;
CREATE TRIGGER trg_protect_profile_privileged_columns
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.protect_profile_privileged_columns();

-- ------------------------------------------------------------
-- 2. caso_historial
--    Producción tenía cuatro políticas abiertas (dos en inglés,
--    dos en español) que dejaban leer e insertar cualquier historial.
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "Authenticated can read history"                  ON public.caso_historial;
DROP POLICY IF EXISTS "Authenticated can insert history"                ON public.caso_historial;
DROP POLICY IF EXISTS "Usuarios autenticados pueden leer historial"     ON public.caso_historial;
DROP POLICY IF EXISTS "Usuarios autenticados pueden insertar historial" ON public.caso_historial;
DROP POLICY IF EXISTS "caso_historial_select_visible"                   ON public.caso_historial;
DROP POLICY IF EXISTS "caso_historial_insert_own"                       ON public.caso_historial;

-- admin/gerente ven todo; el resto solo el historial de casos que
-- puede ver (la subconsulta aplica la RLS de casos).
CREATE POLICY "caso_historial_select_visible"
  ON public.caso_historial FOR SELECT TO authenticated
  USING (
    (SELECT public.get_user_role(auth.uid())) IN ('admin', 'gerente')
    OR EXISTS (SELECT 1 FROM public.casos c WHERE c.id = caso_historial.caso_id)
  );

-- Sin chequear visibilidad del caso: una transferencia cambia agente_id
-- antes de insertar el historial y el agente deja de ver el caso.
CREATE POLICY "caso_historial_insert_own"
  ON public.caso_historial FOR INSERT TO authenticated
  WITH CHECK (
    cambiado_por = auth.uid()
    AND (SELECT public.get_user_role(auth.uid())) IS DISTINCT FROM 'gerente'
  );

-- ------------------------------------------------------------
-- 3. get_casos_counts: SECURITY INVOKER para que los conteos
--    respeten la RLS de casos (el agente ve sus propios conteos,
--    igual que la lista).
-- ------------------------------------------------------------
ALTER FUNCTION public.get_casos_counts(uuid) SECURITY INVOKER;

-- ------------------------------------------------------------
-- 4. process_staging_casos
--    No existía en producción: la importación desde Excel fallaba.
-- ------------------------------------------------------------
DROP FUNCTION IF EXISTS public.process_staging_casos();

CREATE OR REPLACE FUNCTION public.process_staging_casos(p_campana_id uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rec             RECORD;
  v_cliente_id    int;
  v_agente_id     uuid;
  v_estado_id     int;
  v_tipo_id       int;
  v_fecha         date;
  v_valor         numeric;
  v_inserted      int := 0;
  v_skipped       int := 0;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Solo un administrador puede importar casos'
      USING ERRCODE = '42501';
  END IF;

  FOR rec IN SELECT * FROM public.staging_casos LOOP

    SELECT id INTO v_cliente_id
    FROM public.clientes
    WHERE identificacion = rec.cliente_identificacion
    LIMIT 1;

    IF v_cliente_id IS NULL THEN
      INSERT INTO public.clientes (identificacion, nombre_contacto, tipo_cliente)
      VALUES (rec.cliente_identificacion, rec.cliente_identificacion, 'Natural')
      RETURNING id INTO v_cliente_id;
    END IF;

    SELECT user_id INTO v_agente_id
    FROM public.cat_agentes
    WHERE lower(nombre) = lower(trim(rec.agente_nombre))
    LIMIT 1;

    IF v_agente_id IS NULL THEN
      v_skipped := v_skipped + 1;
      CONTINUE;
    END IF;

    SELECT id INTO v_estado_id
    FROM public.cat_estados
    WHERE lower(nombre) = lower(trim(rec.estado))
    LIMIT 1;

    IF v_estado_id IS NULL THEN
      v_skipped := v_skipped + 1;
      CONTINUE;
    END IF;

    SELECT id INTO v_tipo_id
    FROM public.cat_tipo_servicio
    WHERE lower(nombre) = lower(trim(rec.tipo_servicio))
    LIMIT 1;

    IF v_tipo_id IS NULL THEN
      v_skipped := v_skipped + 1;
      CONTINUE;
    END IF;

    BEGIN
      IF rec.fecha_caso ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}' THEN
        v_fecha := rec.fecha_caso::date;
      ELSIF rec.fecha_caso ~ '^[0-9]{1,2}/[0-9]{1,2}/[0-9]{4}' THEN
        v_fecha := to_date(rec.fecha_caso, 'DD/MM/YYYY');
      ELSE
        v_fecha := CURRENT_DATE;
      END IF;
    EXCEPTION WHEN OTHERS THEN
      v_fecha := CURRENT_DATE;
    END;

    BEGIN
      v_valor := regexp_replace(COALESCE(rec.valor_pagar, '0'), '[^0-9.]', '', 'g')::numeric;
    EXCEPTION WHEN OTHERS THEN
      v_valor := NULL;
    END;

    INSERT INTO public.casos (
      cliente_id, agente_id, estado_id, tipo_servicio_id, campana_id,
      descripcion_inicial, fecha_caso, valor_pagar,
      created_by, updated_by
    ) VALUES (
      v_cliente_id, v_agente_id, v_estado_id, v_tipo_id, p_campana_id,
      COALESCE(rec.descripcion_inicial, ''), v_fecha, NULLIF(v_valor, 0),
      auth.uid(), auth.uid()
    );

    v_inserted := v_inserted + 1;
  END LOOP;

  DELETE FROM public.staging_casos WHERE true;

  RETURN jsonb_build_object('inserted', v_inserted, 'skipped', v_skipped);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.process_staging_casos(uuid) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.process_staging_casos(uuid) TO authenticated;

-- ------------------------------------------------------------
-- 5. activity_log
-- ------------------------------------------------------------
-- La tabla ya existe en producción; se mantiene por si se aplica en
-- una base nueva.
CREATE TABLE IF NOT EXISTS public.activity_log (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at    timestamptz NOT NULL DEFAULT now(),
  user_id       uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  user_email    text,
  user_name     text,
  action        text NOT NULL,
  entity        text NOT NULL,
  entity_id     text,
  campana_id    uuid REFERENCES public.campanas(id) ON DELETE SET NULL,
  details       jsonb DEFAULT '{}'::jsonb,
  ip_address    text
);

ALTER TABLE public.activity_log ENABLE ROW LEVEL SECURITY;

-- Sin política de INSERT: se escribe únicamente a través de
-- log_activity (SECURITY DEFINER), que fija el usuario real.
DROP POLICY IF EXISTS "service_role_insert_activity_log" ON public.activity_log;

DROP POLICY IF EXISTS "admins_select_activity_log" ON public.activity_log;
CREATE POLICY "admins_select_activity_log"
  ON public.activity_log FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()));

DROP FUNCTION IF EXISTS public.log_activity(text, text, text, jsonb);

CREATE OR REPLACE FUNCTION public.log_activity(
  p_action      text,
  p_entity      text,
  p_entity_id   text,
  p_details     jsonb DEFAULT '{}'::jsonb,
  p_campana_id  uuid  DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id    uuid := auth.uid();
  v_email      text;
  v_name       text;
  v_campana_id uuid := p_campana_id;
BEGIN
  SELECT email INTO v_email FROM auth.users WHERE id = v_user_id;
  SELECT nombre INTO v_name FROM public.profiles WHERE user_id = v_user_id;

  IF v_campana_id IS NULL THEN
    SELECT campana_id INTO v_campana_id
    FROM public.perfil_campanas WHERE user_id = v_user_id LIMIT 1;
  END IF;

  INSERT INTO public.activity_log
    (user_id, user_email, user_name, action, entity, entity_id, campana_id, details)
  VALUES
    (v_user_id, COALESCE(v_email, ''), COALESCE(v_name, v_email), p_action, p_entity,
     p_entity_id, v_campana_id, COALESCE(p_details, '{}'::jsonb));
END;
$$;

REVOKE EXECUTE ON FUNCTION public.log_activity(text, text, text, jsonb, uuid) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.log_activity(text, text, text, jsonb, uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.trg_casos_activity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public.log_activity('INSERT', 'caso', NEW.id::text,
      jsonb_build_object('estado_id', NEW.estado_id, 'campana_id', NEW.campana_id),
      NEW.campana_id);
  ELSIF TG_OP = 'UPDATE' THEN
    PERFORM public.log_activity('UPDATE', 'caso', NEW.id::text,
      jsonb_build_object('old_estado_id', OLD.estado_id, 'new_estado_id', NEW.estado_id,
                         'old_agente_id', OLD.agente_id, 'new_agente_id', NEW.agente_id),
      NEW.campana_id);
  ELSIF TG_OP = 'DELETE' THEN
    PERFORM public.log_activity('DELETE', 'caso', OLD.id::text, '{}'::jsonb, OLD.campana_id);
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_casos_activity ON public.casos;
CREATE TRIGGER trg_casos_activity
  AFTER INSERT OR UPDATE OR DELETE ON public.casos
  FOR EACH ROW EXECUTE FUNCTION public.trg_casos_activity();

-- ------------------------------------------------------------
-- 6. create_client_and_case: rota y sin uso
-- ------------------------------------------------------------
DROP FUNCTION IF EXISTS public.create_client_and_case(jsonb, jsonb);
