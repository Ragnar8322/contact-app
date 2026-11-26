-- Generador de horarios: el sábado se labora solo de 08:00 a 12:00 (4 h, sin almuerzo).
-- Lunes a viernes sigue usando la ventana y el almuerzo elegidos en el modal.
-- Si el día libre elegido es el sábado, prevalece el descanso; las novedades aprobadas
-- de día completo siguen prevaleciendo sobre todo (ver 20261126120000).

CREATE OR REPLACE FUNCTION "public"."_generate_schedule_impl"(
  "_schedule_id" "uuid",
  "_hora_inicio" time without time zone DEFAULT '07:00:00'::time without time zone,
  "_hora_fin" time without time zone DEFAULT '18:00:00'::time without time zone,
  "_dia_libre_base" integer DEFAULT 6,
  "_duracion_almuerzo" integer DEFAULT 60,
  "_skip_existing" boolean DEFAULT true,
  "_tipo_actividad" "text" DEFAULT 'Tele'::"text"
) RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  _campana_id    uuid;
  _semana_inicio date;
  _estado        text;
  _agente        record;
  _dow           int;
  _fecha         date;
  _generados     int := 0;
  _jornada_horas numeric;
  _rows_affected int;
  _nov_tipo      text;
  _tipo          text;
  _hi            time;
  _hf            time;
  _horas         numeric;
  _alm           int;
  _obs           text;
  _forzar        boolean;
  -- Sábado (dow = 5): jornada fija de media mañana
  c_sab_inicio   constant time := '08:00';
  c_sab_fin      constant time := '12:00';
BEGIN
  SELECT campana_id, semana_inicio, estado
    INTO _campana_id, _semana_inicio, _estado
    FROM public.schedules
   WHERE id = _schedule_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Schedule no encontrado: %', _schedule_id;
  END IF;

  IF _estado != 'borrador' THEN
    RAISE EXCEPTION 'Solo se puede generar sobre un schedule en estado borrador';
  END IF;

  IF _tipo_actividad NOT IN ('GAP','Tele','Calidad','Apoyo','VIP') THEN
    RAISE EXCEPTION 'tipo_actividad inválido: %. Usa: GAP, Tele, Calidad, Apoyo, VIP', _tipo_actividad;
  END IF;

  _jornada_horas := (
    EXTRACT(EPOCH FROM (_hora_fin - _hora_inicio)) / 3600.0
  ) - (_duracion_almuerzo::numeric / 60.0);

  FOR _agente IN
    SELECT p.user_id, p.nombre
      FROM public.perfil_campanas pc
      JOIN public.profiles p  ON p.user_id = pc.user_id
      JOIN public.user_roles r ON r.id = p.role_id
     WHERE pc.campana_id = _campana_id
       AND r.name IN ('agent', 'supervisor')
       AND p.activo
     ORDER BY p.nombre
  LOOP
    FOR _dow IN 0..6 LOOP
      _fecha := _semana_inicio + _dow;

      -- Novedad aprobada de día completo para esta persona y fecha (si hay varias, la más reciente)
      SELECT n.tipo_novedad
        INTO _nov_tipo
        FROM public.schedule_novedades n
       WHERE n.schedule_id = _schedule_id
         AND n.agente_id   = _agente.user_id
         AND n.fecha       = _fecha
         AND n.estado      = 'aprobado'
         AND n.es_dia_completo
         AND n.tipo_novedad NOT IN ('permiso_horas', 'cambio_turno')
       ORDER BY n.created_at DESC
       LIMIT 1;

      _forzar := false;
      _hi := NULL; _hf := NULL; _horas := 0; _alm := 0; _obs := NULL;

      IF _nov_tipo IS NOT NULL THEN
        _forzar := true;
        _tipo := CASE _nov_tipo
                   WHEN 'incapacidad' THEN 'Incapacidad'
                   WHEN 'vacaciones'  THEN 'Vacaciones'
                   ELSE 'No_aplica'
                 END;
        -- Evita el prefijo "Permiso " que la grilla interpreta como permiso por horas
        _obs := 'Novedad: ' || CASE _nov_tipo
                   WHEN 'incapacidad'           THEN 'incapacidad'
                   WHEN 'vacaciones'            THEN 'vacaciones'
                   WHEN 'permiso_remunerado'    THEN 'permiso remunerado'
                   WHEN 'permiso_no_remunerado' THEN 'permiso no remunerado'
                   WHEN 'calamidad'             THEN 'calamidad'
                   ELSE 'otro'
                 END;
      ELSIF _dow = _dia_libre_base THEN
        _tipo := 'Descanso';
      ELSIF _dow = 5 THEN
        _tipo  := _tipo_actividad;
        _hi    := c_sab_inicio;
        _hf    := c_sab_fin;
        _horas := ROUND(EXTRACT(EPOCH FROM (c_sab_fin - c_sab_inicio)) / 3600.0, 2);
        _alm   := 0;
      ELSE
        _tipo  := _tipo_actividad;
        _hi    := _hora_inicio;
        _hf    := _hora_fin;
        _horas := ROUND(_jornada_horas::numeric, 2);
        _alm   := _duracion_almuerzo;
      END IF;

      IF _skip_existing AND NOT _forzar THEN
        INSERT INTO public.schedule_shifts (
          schedule_id, agente_id, fecha,
          tipo_actividad, hora_inicio, hora_fin,
          horas_dia, duracion_almuerzo, observacion
        ) VALUES (
          _schedule_id, _agente.user_id, _fecha,
          _tipo, _hi, _hf, _horas, _alm, _obs
        )
        ON CONFLICT (schedule_id, agente_id, fecha) DO NOTHING;
      ELSE
        INSERT INTO public.schedule_shifts (
          schedule_id, agente_id, fecha,
          tipo_actividad, hora_inicio, hora_fin,
          horas_dia, duracion_almuerzo, observacion
        ) VALUES (
          _schedule_id, _agente.user_id, _fecha,
          _tipo, _hi, _hf, _horas, _alm, _obs
        )
        ON CONFLICT (schedule_id, agente_id, fecha) DO UPDATE
          SET tipo_actividad    = EXCLUDED.tipo_actividad,
              hora_inicio       = EXCLUDED.hora_inicio,
              hora_fin          = EXCLUDED.hora_fin,
              horas_dia         = EXCLUDED.horas_dia,
              duracion_almuerzo = EXCLUDED.duracion_almuerzo,
              observacion       = EXCLUDED.observacion;
      END IF;

      GET DIAGNOSTICS _rows_affected = ROW_COUNT;
      _generados := _generados + _rows_affected;
    END LOOP;
  END LOOP;

  RETURN _generados;
END;
$$;
