-- ============================================================
-- Fase 1 · Número de fila del Excel en los rechazos de la importación
-- Fecha: 2026-10-26
--
-- staging_casos solo recibe las filas que pasaron la validación del
-- navegador, así que numerar por orden de llegada no coincidía con la
-- fila del Excel. El frontend ahora envía fila_excel y el rechazo la usa.
-- ============================================================

ALTER TABLE public.staging_casos ADD COLUMN IF NOT EXISTS fila_excel integer;

CREATE OR REPLACE FUNCTION public.process_staging_casos(p_campana_id uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rec          RECORD;
  v_cliente_id int;
  v_agente_id  uuid;
  v_estado_id  int;
  v_tipo_id    int;
  v_fecha      date;
  v_inserted   int := 0;
  v_rechazados jsonb := '[]'::jsonb;
  v_motivo     text;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Solo un administrador puede importar casos' USING ERRCODE = '42501';
  END IF;

  FOR rec IN
    SELECT s.*, COALESCE(s.fila_excel, row_number() OVER (ORDER BY s.id) + 1) AS fila
      FROM public.staging_casos s
  LOOP
    v_motivo := NULL;
    v_agente_id := NULL;

    -- Agente: por correo; si no viene, por nombre exacto (sin distinguir mayúsculas)
    IF COALESCE(trim(rec.agente_correo), '') <> '' THEN
      SELECT a.user_id INTO v_agente_id
        FROM cat_agentes a JOIN auth.users u ON u.id = a.user_id
       WHERE lower(u.email) = lower(trim(rec.agente_correo)) AND a.activo;
      IF v_agente_id IS NULL THEN v_motivo := format('No hay agente activo con el correo "%s"', trim(rec.agente_correo)); END IF;
    ELSE
      SELECT a.user_id INTO v_agente_id FROM cat_agentes a
       WHERE lower(trim(a.nombre)) = lower(trim(rec.agente_nombre)) AND a.activo
       LIMIT 1;
      IF v_agente_id IS NULL THEN v_motivo := format('No hay agente activo llamado "%s"', COALESCE(rec.agente_nombre, '')); END IF;
    END IF;

    IF v_motivo IS NULL THEN
      SELECT id INTO v_estado_id FROM cat_estados WHERE lower(nombre) = lower(trim(rec.estado)) LIMIT 1;
      IF v_estado_id IS NULL THEN v_motivo := format('Estado desconocido "%s"', COALESCE(rec.estado, '')); END IF;
    END IF;

    IF v_motivo IS NULL THEN
      SELECT id INTO v_tipo_id FROM cat_tipo_servicio WHERE lower(nombre) = lower(trim(rec.tipo_servicio)) LIMIT 1;
      IF v_tipo_id IS NULL THEN v_motivo := format('Tipo de servicio desconocido "%s"', COALESCE(rec.tipo_servicio, '')); END IF;
    END IF;

    IF v_motivo IS NOT NULL THEN
      v_rechazados := v_rechazados || jsonb_build_object(
        'fila', rec.fila, 'identificacion', rec.cliente_identificacion, 'motivo', v_motivo);
      CONTINUE;
    END IF;

    SELECT id INTO v_cliente_id FROM clientes WHERE identificacion = rec.cliente_identificacion LIMIT 1;
    IF v_cliente_id IS NULL THEN
      INSERT INTO clientes (identificacion, nombre_contacto, tipo_cliente)
      VALUES (rec.cliente_identificacion, rec.cliente_identificacion, 'Persona')
      RETURNING id INTO v_cliente_id;
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

    INSERT INTO casos (cliente_id, agente_id, estado_id, tipo_servicio_id, campana_id,
                       descripcion_inicial, fecha_caso, valor_pagar, created_by, updated_by)
    VALUES (v_cliente_id, v_agente_id, v_estado_id, v_tipo_id, p_campana_id,
            COALESCE(rec.descripcion_inicial, ''), v_fecha, NULLIF(parse_monto_cop(rec.valor_pagar), 0),
            auth.uid(), auth.uid());

    v_inserted := v_inserted + 1;
  END LOOP;

  DELETE FROM public.staging_casos WHERE true;

  RETURN jsonb_build_object(
    'inserted', v_inserted,
    'skipped', jsonb_array_length(v_rechazados),
    'rechazados', v_rechazados
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.process_staging_casos(uuid) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.process_staging_casos(uuid) TO authenticated;
