-- ============================================================
-- Fase 2 · Corrección del reparto en assign_cases
-- Fecha: 2026-10-27
--
-- La carga de cada agente se calculaba incluyendo los casos del lote. Al
-- redistribuir casos ya asignados ("todos los activos"), un agente parecía
-- cargado por casos que se le iban a quitar y el reparto quedaba
-- desbalanceado. Lo detectaron las pruebas pgTAP de esta fase.
-- ============================================================

CREATE OR REPLACE FUNCTION public.assign_cases(p_campana_id uuid, p_caso_ids integer[], p_agente_ids uuid[])
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_uid      uuid := auth.uid();
  v_rol      text := (SELECT get_user_role(auth.uid()));
  v_agentes  uuid[];
  v_nombres  text[];
  v_carga    int[];
  v_destino  uuid[] := '{}';
  v_caso     integer;
  v_min      int;
  i          int;
  v_n        int;
  v_quien    text;
BEGIN
  IF v_rol NOT IN ('admin', 'supervisor') THEN
    RAISE EXCEPTION 'Solo un administrador o un supervisor puede asignar casos' USING ERRCODE = '42501';
  END IF;
  IF COALESCE(array_length(p_caso_ids, 1), 0) = 0 OR COALESCE(array_length(p_agente_ids, 1), 0) = 0 THEN
    RAISE EXCEPTION 'Selecciona al menos un caso y un agente';
  END IF;

  -- Agentes válidos y su carga en la campaña SIN contar los casos del lote:
  -- al redistribuir casos ya asignados, esos casos se le van a quitar a su agente actual.
  SELECT array_agg(a.user_id ORDER BY a.nombre),
         array_agg(a.nombre  ORDER BY a.nombre),
         array_agg((SELECT count(*) FROM casos x JOIN cat_estados e ON e.id = x.estado_id
                     WHERE x.agente_id = a.user_id AND x.campana_id = p_campana_id
                       AND NOT COALESCE(e.es_final, false)
                       AND x.id <> ALL (p_caso_ids))::int ORDER BY a.nombre)
    INTO v_agentes, v_nombres, v_carga
    FROM cat_agentes a
   WHERE a.user_id = ANY (p_agente_ids) AND a.activo;

  IF COALESCE(array_length(v_agentes, 1), 0) <> (SELECT count(DISTINCT x) FROM unnest(p_agente_ids) x) THEN
    RAISE EXCEPTION 'Algún agente seleccionado no existe o está inactivo';
  END IF;

  -- Reparto equilibrado: cada caso al agente con menor carga (empate: orden alfabético)
  FOREACH v_caso IN ARRAY p_caso_ids LOOP
    v_min := 1;
    FOR i IN 2 .. array_length(v_agentes, 1) LOOP
      IF v_carga[i] < v_carga[v_min] THEN v_min := i; END IF;
    END LOOP;
    v_destino := v_destino || v_agentes[v_min];
    v_carga[v_min] := v_carga[v_min] + 1;
  END LOOP;

  UPDATE casos c
     SET agente_id = d.agente_id, updated_by = v_uid, updated_at = now()
    FROM unnest(p_caso_ids, v_destino) AS d(caso_id, agente_id)
   WHERE c.id = d.caso_id
     AND c.campana_id = p_campana_id
     AND EXISTS (SELECT 1 FROM cat_estados e WHERE e.id = c.estado_id AND NOT COALESCE(e.es_final, false));
  GET DIAGNOSTICS v_n = ROW_COUNT;

  IF v_n <> array_length(p_caso_ids, 1) THEN
    RAISE EXCEPTION 'Solo se podían asignar % de % casos (cerrados, de otra campaña o sin permiso). No se guardó ningún cambio.',
      v_n, array_length(p_caso_ids, 1);
  END IF;

  SELECT nombre INTO v_quien FROM profiles WHERE user_id = v_uid;

  INSERT INTO caso_historial (caso_id, estado_id, cambiado_por, agente_id, agente_nombre, observacion)
  SELECT c.id, c.estado_id, v_uid, d.agente_id, a.nombre,
         format('Asignación proporcional por %s', COALESCE(v_quien, 'usuario'))
    FROM unnest(p_caso_ids, v_destino) AS d(caso_id, agente_id)
    JOIN casos c ON c.id = d.caso_id
    JOIN cat_agentes a ON a.user_id = d.agente_id;

  RETURN jsonb_build_object(
    'asignados', v_n,
    'por_agente', (
      SELECT jsonb_agg(jsonb_build_object('agente_id', x.agente_id, 'nombre', a.nombre, 'asignados', x.n) ORDER BY a.nombre)
        FROM (SELECT agente_id, count(*) n FROM unnest(v_destino) agente_id GROUP BY 1) x
        JOIN cat_agentes a ON a.user_id = x.agente_id
    )
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.assign_cases(uuid, integer[], uuid[]) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.assign_cases(uuid, integer[], uuid[]) TO authenticated;
