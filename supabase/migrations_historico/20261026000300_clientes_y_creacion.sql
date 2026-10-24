-- ============================================================
-- Fase 1 · Creación de cliente + caso atómica, y permisos de clientes
-- Fecha: 2026-10-26
--
--   1. create_case_with_client(): si el caso no se puede crear, tampoco
--      queda el cliente (antes la app pedía "crea el caso manualmente").
--      SECURITY INVOKER: aplican las mismas políticas que antes.
--   2. clientes: el gerente (solo lectura) ya no puede crear ni editar.
--   3. Los cambios de clientes quedan en la auditoría.
-- ============================================================

-- 1. Cliente (nuevo o existente) + caso + historial en una transacción
CREATE OR REPLACE FUNCTION public.create_case_with_client(
  p_campana_id       uuid,
  p_tipo_servicio_id integer,
  p_descripcion      text,
  p_cliente_id       integer DEFAULT NULL,
  p_cliente          jsonb   DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_uid        uuid := auth.uid();
  v_cliente_id integer := p_cliente_id;
  v_tipo       text;
  v_registrado integer;
  v_caso       integer;
  v_quien      text;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Sesión requerida' USING ERRCODE = '42501';
  END IF;
  IF COALESCE(trim(p_descripcion), '') = '' THEN
    RAISE EXCEPTION 'La descripción del caso es obligatoria';
  END IF;

  IF v_cliente_id IS NULL THEN
    IF p_cliente IS NULL OR COALESCE(trim(p_cliente->>'identificacion'), '') = ''
       OR COALESCE(trim(p_cliente->>'nombre_contacto'), '') = '' THEN
      RAISE EXCEPTION 'Faltan la identificación o el nombre del cliente';
    END IF;
    v_tipo := COALESCE(p_cliente->>'tipo_cliente', 'Persona');
    IF v_tipo = 'Empresa' AND COALESCE(trim(p_cliente->>'razon_social'), '') = '' THEN
      RAISE EXCEPTION 'La razón social es obligatoria para Empresa';
    END IF;

    BEGIN
      INSERT INTO clientes (identificacion, tipo_cliente, nombre_contacto, razon_social, telefono, celular, correo)
      VALUES (
        trim(p_cliente->>'identificacion'),
        v_tipo,
        upper(trim(p_cliente->>'nombre_contacto')),
        CASE WHEN v_tipo = 'Empresa' THEN upper(trim(p_cliente->>'razon_social')) END,
        NULLIF(trim(p_cliente->>'telefono'), ''),
        NULLIF(trim(p_cliente->>'celular'), ''),
        NULLIF(lower(trim(p_cliente->>'correo')), '')
      )
      RETURNING id INTO v_cliente_id;
    EXCEPTION WHEN unique_violation THEN
      RAISE EXCEPTION 'Ya existe un cliente con la identificación %', trim(p_cliente->>'identificacion');
    END;
  END IF;

  SELECT id INTO v_registrado FROM cat_estados WHERE nombre = 'Registrado';
  IF v_registrado IS NULL THEN
    RAISE EXCEPTION 'Falta el estado "Registrado" en el catálogo';
  END IF;

  INSERT INTO casos (cliente_id, tipo_servicio_id, descripcion_inicial, valor_pagar, estado_id,
                     agente_id, created_by, campana_id)
  VALUES (v_cliente_id, p_tipo_servicio_id, trim(p_descripcion), NULL, v_registrado,
          v_uid, v_uid, p_campana_id)
  RETURNING id INTO v_caso;

  SELECT nombre INTO v_quien FROM profiles WHERE user_id = v_uid;
  INSERT INTO caso_historial (caso_id, estado_id, cambiado_por, comentario, agente_id, agente_nombre, estado_nuevo)
  VALUES (v_caso, v_registrado, v_uid, 'Caso creado', v_uid, v_quien, 'Registrado');

  RETURN jsonb_build_object('caso_id', v_caso, 'cliente_id', v_cliente_id, 'cliente_nuevo', p_cliente_id IS NULL);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.create_case_with_client(uuid, integer, text, integer, jsonb) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.create_case_with_client(uuid, integer, text, integer, jsonb) TO authenticated;

-- 2. Escritura de clientes solo para roles que gestionan casos
DROP POLICY IF EXISTS "clientes_insert" ON public.clientes;
CREATE POLICY "clientes_insert" ON public.clientes
  FOR INSERT TO authenticated
  WITH CHECK (( SELECT get_user_role(( SELECT auth.uid() AS uid)) AS get_user_role) IN ('admin', 'supervisor', 'agent'));

DROP POLICY IF EXISTS "clientes_update_authenticated" ON public.clientes;
CREATE POLICY "clientes_update_authenticated" ON public.clientes
  FOR UPDATE TO authenticated
  USING      (( SELECT get_user_role(( SELECT auth.uid() AS uid)) AS get_user_role) IN ('admin', 'supervisor', 'agent'))
  WITH CHECK (( SELECT get_user_role(( SELECT auth.uid() AS uid)) AS get_user_role) IN ('admin', 'supervisor', 'agent'));

-- 3. Auditoría de clientes (solo los campos que cambiaron)
CREATE OR REPLACE FUNCTION public.trg_clientes_activity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cambios jsonb;
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM log_activity('INSERT', 'cliente', NEW.id::text,
      jsonb_build_object('identificacion', NEW.identificacion, 'tipo_cliente', NEW.tipo_cliente));
  ELSIF TG_OP = 'UPDATE' THEN
    SELECT jsonb_object_agg(n.key, jsonb_build_object('antes', o.value, 'despues', n.value))
      INTO v_cambios
      FROM jsonb_each(to_jsonb(NEW)) n
      JOIN jsonb_each(to_jsonb(OLD)) o ON o.key = n.key
     WHERE n.value IS DISTINCT FROM o.value;
    IF v_cambios IS NOT NULL THEN
      PERFORM log_activity('UPDATE', 'cliente', NEW.id::text, v_cambios);
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.trg_clientes_activity() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_clientes_activity ON public.clientes;
CREATE TRIGGER trg_clientes_activity
  AFTER INSERT OR UPDATE ON public.clientes
  FOR EACH ROW EXECUTE FUNCTION public.trg_clientes_activity();
