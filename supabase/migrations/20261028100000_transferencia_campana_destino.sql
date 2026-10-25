-- La campaña destino de una transferencia queda en el caso original.
-- El caso nuevo pertenece al supervisor de otra campaña y, por la RLS, el agente que
-- transfirió no puede leerlo: sin esta columna no veía a qué campaña fue su caso.
--
-- Sin FK a propósito: una segunda relación casos → campanas volvería ambiguos los embeds
-- `campanas(...)` de PostgREST en todas las consultas de casos. Solo la escribe transfer_case,
-- que valida la campaña.
ALTER TABLE public.casos ADD COLUMN transferido_a_campana_id uuid;

COMMENT ON COLUMN public.casos.transferido_a_campana_id IS
  'Campaña del caso destino de una transferencia (la escribe transfer_case). Sin FK para no duplicar la relación con campanas.';

UPDATE public.casos o
   SET transferido_a_campana_id = d.campana_id
  FROM public.casos d
 WHERE d.id = o.transferido_a_caso_id
   AND o.transferido_a_campana_id IS NULL;

CREATE OR REPLACE FUNCTION "public"."transfer_case"("p_caso_id" integer, "p_campana_destino" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_uid            uuid := auth.uid();
  v_rol            text := get_user_role(auth.uid());
  v_caso           casos%ROWTYPE;
  v_es_final       boolean;
  v_origen_nombre  text;
  v_destino_nombre text;
  v_transferido    integer;
  v_registrado     integer;
  v_sup_id         uuid;
  v_sup_nombre     text;
  v_quien          text;
  v_nuevo          integer;
BEGIN
  IF v_uid IS NULL OR v_rol IS NULL OR v_rol = 'gerente' THEN
    RAISE EXCEPTION 'No tienes permisos para transferir casos' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_caso FROM casos WHERE id = p_caso_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'El caso #% no existe', p_caso_id;
  END IF;

  -- Mismo alcance que la RLS de casos
  IF (v_rol = 'agent' AND v_caso.agente_id IS DISTINCT FROM v_uid)
     OR (v_rol = 'supervisor' AND NOT EXISTS (
           SELECT 1 FROM perfil_campanas WHERE user_id = v_uid AND campana_id = v_caso.campana_id)) THEN
    RAISE EXCEPTION 'No tienes permisos sobre el caso #%', p_caso_id USING ERRCODE = '42501';
  END IF;

  SELECT es_final INTO v_es_final FROM cat_estados WHERE id = v_caso.estado_id;
  IF COALESCE(v_es_final, false) THEN
    RAISE EXCEPTION 'No se pueden transferir casos cerrados o ya transferidos';
  END IF;

  IF p_campana_destino = v_caso.campana_id THEN
    RAISE EXCEPTION 'El caso ya pertenece a esa campaña';
  END IF;

  SELECT nombre INTO v_destino_nombre FROM campanas WHERE id = p_campana_destino AND COALESCE(activa, true);
  IF NOT FOUND THEN
    RAISE EXCEPTION 'La campaña destino no existe o está inactiva';
  END IF;
  SELECT nombre INTO v_origen_nombre FROM campanas WHERE id = v_caso.campana_id;

  SELECT id INTO v_transferido FROM cat_estados WHERE nombre = 'Transferido';
  SELECT id INTO v_registrado  FROM cat_estados WHERE nombre = 'Registrado';
  IF v_transferido IS NULL OR v_registrado IS NULL THEN
    RAISE EXCEPTION 'Faltan los estados "Transferido" o "Registrado" en el catálogo';
  END IF;

  SELECT s.user_id, s.nombre INTO v_sup_id, v_sup_nombre FROM supervisor_de_campana(p_campana_destino) s;
  IF v_sup_id IS NULL THEN
    RAISE EXCEPTION 'La campaña "%" no tiene supervisor asignado. Pide a un administrador que asigne uno antes de transferir.', v_destino_nombre
      USING ERRCODE = 'P0001';
  END IF;

  -- casos.agente_id exige que el usuario exista en cat_agentes
  INSERT INTO cat_agentes (user_id, nombre, activo) VALUES (v_sup_id, v_sup_nombre, true)
  ON CONFLICT (user_id) DO NOTHING;

  INSERT INTO casos (cliente_id, tipo_servicio_id, descripcion_inicial, agente_id, created_by,
                     estado_id, campana_id, transferido_desde_caso_id)
  VALUES (v_caso.cliente_id, v_caso.tipo_servicio_id, v_caso.descripcion_inicial, v_sup_id, v_uid,
          v_registrado, p_campana_destino, v_caso.id)
  RETURNING id INTO v_nuevo;

  UPDATE casos
     SET estado_id = v_transferido,
         fecha_cierre = now(),
         observacion_cierre = format('Transferido a campaña: %s. Nuevo caso #%s', v_destino_nombre, v_nuevo),
         transferido_a_caso_id = v_nuevo,
         transferido_a_campana_id = p_campana_destino,
         updated_by = v_uid,
         updated_at = now()
   WHERE id = v_caso.id;

  SELECT nombre INTO v_quien FROM profiles WHERE user_id = v_uid;

  INSERT INTO caso_historial (caso_id, estado_id, cambiado_por, comentario, agente_id, agente_nombre, estado_nuevo)
  VALUES
    (v_caso.id, v_transferido, v_uid,
     format('Caso transferido de %s a %s por %s. Nuevo caso #%s, asignado a %s.',
            COALESCE(v_origen_nombre, 'sin campaña'), v_destino_nombre, COALESCE(v_quien, 'usuario'), v_nuevo, v_sup_nombre),
     v_uid, v_quien, 'Transferido'),
    (v_nuevo, v_registrado, v_uid,
     format('Recibido por transferencia desde el caso #%s (%s). Asignado a %s.',
            v_caso.id, COALESCE(v_origen_nombre, 'sin campaña'), v_sup_nombre),
     v_sup_id, v_sup_nombre, 'Registrado');

  RETURN jsonb_build_object(
    'nuevo_caso_id', v_nuevo,
    'supervisor_id', v_sup_id,
    'supervisor_nombre', v_sup_nombre,
    'campana_destino', v_destino_nombre
  );
END;
$$;
