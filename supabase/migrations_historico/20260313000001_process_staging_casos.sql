-- ============================================================
-- Fase 7C: Función que procesa staging_casos → casos
-- ============================================================
-- Lógica:
--   1. Resuelve cliente por identificación (lo crea si no existe)
--   2. Resuelve agente por nombre en cat_agentes
--   3. Resuelve estado por nombre en cat_estados
--   4. Resuelve tipo_servicio por nombre en cat_tipo_servicio
--   5. Inserta en casos
--   6. Limpia staging_casos
-- ============================================================

CREATE OR REPLACE FUNCTION public.process_staging_casos()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  rec             RECORD;
  v_cliente_id    int;
  v_agente_id     text;
  v_estado_id     int;
  v_tipo_id       int;
  v_fecha         date;
  v_valor         numeric;
  v_inserted      int := 0;
  v_skipped       int := 0;
  v_created_by    text;
BEGIN
  -- Usuario que ejecuta la importación
  SELECT COALESCE(email, auth.uid()::text)
  INTO v_created_by
  FROM auth.users WHERE id = auth.uid();

  FOR rec IN SELECT * FROM public.staging_casos LOOP

    -- Resolver cliente
    SELECT id INTO v_cliente_id
    FROM public.clientes
    WHERE identificacion = rec.cliente_identificacion
    LIMIT 1;

    -- Crear cliente mínimo si no existe
    IF v_cliente_id IS NULL THEN
      INSERT INTO public.clientes (identificacion, nombre_contacto, tipo_cliente)
      VALUES (rec.cliente_identificacion, rec.cliente_identificacion, 'Natural')
      RETURNING id INTO v_cliente_id;
    END IF;

    -- Resolver agente
    SELECT user_id INTO v_agente_id
    FROM public.cat_agentes
    WHERE lower(nombre) = lower(trim(rec.agente_nombre))
    LIMIT 1;

    IF v_agente_id IS NULL THEN
      v_skipped := v_skipped + 1;
      CONTINUE; -- Agente no encontrado, saltar fila
    END IF;

    -- Resolver estado
    SELECT id INTO v_estado_id
    FROM public.cat_estados
    WHERE lower(nombre) = lower(trim(rec.estado))
    LIMIT 1;

    IF v_estado_id IS NULL THEN
      v_skipped := v_skipped + 1;
      CONTINUE;
    END IF;

    -- Resolver tipo de servicio
    SELECT id INTO v_tipo_id
    FROM public.cat_tipo_servicio
    WHERE lower(nombre) = lower(trim(rec.tipo_servicio))
    LIMIT 1;

    IF v_tipo_id IS NULL THEN
      v_skipped := v_skipped + 1;
      CONTINUE;
    END IF;

    -- Parsear fecha (soporta YYYY-MM-DD y DD/MM/YYYY)
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

    -- Parsear valor
    BEGIN
      v_valor := regexp_replace(COALESCE(rec.valor_pagar, '0'), '[^0-9.]', '', 'g')::numeric;
    EXCEPTION WHEN OTHERS THEN
      v_valor := NULL;
    END;

    -- Insertar caso
    INSERT INTO public.casos (
      cliente_id, agente_id, estado_id, tipo_servicio_id,
      descripcion_inicial, fecha_caso, valor_pagar,
      created_by, updated_by
    ) VALUES (
      v_cliente_id, v_agente_id, v_estado_id, v_tipo_id,
      rec.descripcion_inicial, v_fecha, NULLIF(v_valor, 0),
      v_created_by, v_created_by
    );

    v_inserted := v_inserted + 1;
  END LOOP;

  -- Limpiar staging
  DELETE FROM public.staging_casos;

  RETURN jsonb_build_object('inserted', v_inserted, 'skipped', v_skipped);
END;
$$;

-- RLS en staging_casos: solo admins escriben/leen
ALTER TABLE public.staging_casos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admins_staging" ON public.staging_casos;
CREATE POLICY "admins_staging" ON public.staging_casos
  USING (
    EXISTS (
      SELECT 1 FROM public.user_role_assignments ura
      JOIN public.user_roles r ON r.id = ura.role_id
      WHERE ura.user_id = auth.uid() AND r.name = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_role_assignments ura
      JOIN public.user_roles r ON r.id = ura.role_id
      WHERE ura.user_id = auth.uid() AND r.name = 'admin'
    )
  );
