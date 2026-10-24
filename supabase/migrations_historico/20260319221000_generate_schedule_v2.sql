-- ============================================================
-- MÓDULO HORARIOS — Fase 2: Motor de reglas generate_schedule v2
-- Fecha: 2026-03-19
--
-- Reglas implementadas:
--   1. Ventana L-V 07:30-18:00 / Sáb 08:00-12:00
--   2. Breaks flexibles: 15 min mañana + 15 min tarde + 1h almuerzo
--      ubicados dinámicamente dentro del turno (no fijos)
--   3. Novedades dinámicas:
--      - Permiso por horas: turno normal + bloque Novedad etiquetado
--      - Novedad día completo: marcar día con tipo incapacidad/vacaciones
--   4. Tope máximo 42h semanales netas (sin almuerzo ni breaks)
-- ============================================================

-- ------------------------------------------------------------
-- Helper: minutos entre dos TIME valores
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.minutos_entre(t1 TIME, t2 TIME)
RETURNS INT LANGUAGE sql IMMUTABLE AS $$
  SELECT EXTRACT(EPOCH FROM (t2 - t1))::INT / 60;
$$;

-- ------------------------------------------------------------
-- Helper: distribuye break dentro de un turno
-- Retorna la hora de inicio del break dentro de la primera
-- o segunda mitad según posición (1=mañana, 2=tarde)
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.calcular_hora_break(
  p_hora_inicio TIME,
  p_hora_fin    TIME,
  p_posicion    INT   -- 1 = primer tercio, 2 = último tercio
)
RETURNS TIME LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE
  total_min  INT;
  offset_min INT;
BEGIN
  total_min := EXTRACT(EPOCH FROM (p_hora_fin - p_hora_inicio))::INT / 60;
  IF p_posicion = 1 THEN
    -- Break mañana: al 25% del turno, redondeado a 15 min
    offset_min := (total_min * 25 / 100 / 15) * 15;
  ELSE
    -- Break tarde: al 75% del turno, redondeado a 15 min
    offset_min := (total_min * 75 / 100 / 15) * 15;
  END IF;
  RETURN p_hora_inicio + (offset_min || ' minutes')::INTERVAL;
END;
$$;

-- ------------------------------------------------------------
-- Helper: almuerzo distribuido (escalonado entre agentes)
-- Posiciona el almuerzo en el 45-55% de la jornada
-- con un offset de 30 min por agente para escalonarlo
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.calcular_hora_almuerzo(
  p_hora_inicio  TIME,
  p_hora_fin     TIME,
  p_agente_idx   INT,   -- índice del agente (para escalonar)
  p_dur_almuerzo INT    -- duración en minutos
)
RETURNS TIME LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE
  total_min    INT;
  mid_min      INT;
  offset_min   INT;
  almuerzo_min INT;
BEGIN
  total_min  := EXTRACT(EPOCH FROM (p_hora_fin - p_hora_inicio))::INT / 60;
  mid_min    := total_min / 2;
  -- Escalonar: cada agente se desplaza 30 min, ciclo de 4 grupos
  offset_min := (p_agente_idx % 4) * 30;
  -- El almuerzo empieza en el 40% + offset, redondeado a 15 min
  almuerzo_min := ((mid_min - (p_dur_almuerzo / 2) + offset_min) / 15) * 15;
  -- Asegurar que quede dentro de la jornada con al menos 45 min antes y después
  almuerzo_min := GREATEST(almuerzo_min, 45);
  almuerzo_min := LEAST(almuerzo_min, total_min - p_dur_almuerzo - 45);
  RETURN p_hora_inicio + (almuerzo_min || ' minutes')::INTERVAL;
END;
$$;

-- ------------------------------------------------------------
-- FUNCIÓN PRINCIPAL: generate_schedule v2
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.generate_schedule(
  _schedule_id       UUID,
  _hora_inicio       TEXT    DEFAULT '07:30',   -- override ventana inicio
  _hora_fin          TEXT    DEFAULT '18:00',   -- override ventana fin
  _dia_libre_base    INT     DEFAULT 6,         -- 0=Lun..6=Dom
  _duracion_almuerzo INT     DEFAULT 60,        -- minutos
  _skip_existing     BOOLEAN DEFAULT true,
  _tipo_actividad    TEXT    DEFAULT 'GAP'
)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_campana_id     UUID;
  v_semana_inicio  DATE;
  v_semana_fin     DATE;

  -- Ventanas por defecto del plan
  v_win_lv_ini     TIME := '07:30';
  v_win_lv_fin     TIME := '18:00';
  v_win_sab_ini    TIME := '08:00';
  v_win_sab_fin    TIME := '12:00';

  -- Override del caller
  v_hora_inicio    TIME;
  v_hora_fin       TIME;

  v_agente         RECORD;
  v_fecha          DATE;
  v_dia_semana     INT;   -- 0=Lun..6=Dom (ISO)
  v_agente_idx     INT;
  v_dia_libre      INT;

  v_turno_ini      TIME;
  v_turno_fin      TIME;
  v_almuerzo_ini   TIME;
  v_break1_ini     TIME;
  v_break2_ini     TIME;
  v_horas_netas    NUMERIC(5,2);
  v_horas_semana   NUMERIC(5,2);
  v_tope_horas     NUMERIC(5,2) := 42.0;

  -- Novedades del agente en la semana
  v_novedad        RECORD;
  v_es_dia_completo BOOLEAN;
  v_nov_ini        TIME;
  v_nov_fin        TIME;

  v_count          INT := 0;
  v_shift_exists   BOOLEAN;
BEGIN
  -- 1. Obtener datos del schedule
  SELECT campana_id, semana_inicio, semana_fin
    INTO v_campana_id, v_semana_inicio, v_semana_fin
    FROM public.schedules
   WHERE id = _schedule_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Schedule % no encontrado', _schedule_id;
  END IF;

  -- 2. Validar ventanas
  v_hora_inicio := GREATEST(_hora_inicio::TIME, v_win_lv_ini);
  v_hora_fin    := LEAST(_hora_fin::TIME,    v_win_lv_fin);

  -- 3. Iterar agentes de la campaña
  v_agente_idx := 0;
  FOR v_agente IN
    SELECT user_id, nombre
      FROM public.profiles p
      JOIN public.user_role_assignments ura ON ura.user_id = p.user_id
      JOIN public.user_roles ur ON ur.id = ura.role_id
     WHERE ura.campana_id = v_campana_id
       AND ur.name = 'agent'
     ORDER BY p.nombre
  LOOP
    -- Acumulador semanal para este agente
    v_horas_semana := 0;
    -- Día libre rotativo
    v_dia_libre := (_dia_libre_base + v_agente_idx) % 7;

    -- Iterar días de la semana
    v_fecha := v_semana_inicio;
    WHILE v_fecha <= v_semana_fin LOOP
      -- Día de la semana ISO: 0=Lun..6=Dom
      v_dia_semana := EXTRACT(ISODOW FROM v_fecha)::INT - 1;

      -- Verificar si ya existe turno (skip_existing)
      SELECT EXISTS(
        SELECT 1 FROM public.schedule_shifts
         WHERE schedule_id = _schedule_id
           AND agente_id   = v_agente.user_id
           AND fecha        = v_fecha
      ) INTO v_shift_exists;

      IF _skip_existing AND v_shift_exists THEN
        v_fecha := v_fecha + 1;
        CONTINUE;
      END IF;

      -- Verificar tope semanal
      IF v_horas_semana >= v_tope_horas THEN
        -- Insertar Descanso para los días restantes
        INSERT INTO public.schedule_shifts (
          schedule_id, agente_id, fecha,
          tipo_actividad, horas_dia, observacion
        )
        VALUES (
          _schedule_id, v_agente.user_id, v_fecha,
          'No_aplica', 0, 'Tope 42h alcanzado'
        )
        ON CONFLICT (schedule_id, agente_id, fecha)
        DO UPDATE SET tipo_actividad = 'No_aplica', horas_dia = 0,
                      observacion = 'Tope 42h alcanzado';
        v_fecha := v_fecha + 1;
        CONTINUE;
      END IF;

      -- Día domingo (6) siempre descanso
      IF v_dia_semana = 6 THEN
        INSERT INTO public.schedule_shifts (
          schedule_id, agente_id, fecha,
          tipo_actividad, horas_dia
        )
        VALUES (_schedule_id, v_agente.user_id, v_fecha, 'Descanso', 0)
        ON CONFLICT (schedule_id, agente_id, fecha)
        DO UPDATE SET tipo_actividad = 'Descanso', horas_dia = 0;
        v_fecha := v_fecha + 1;
        CONTINUE;
      END IF;

      -- Día libre rotativo
      IF v_dia_semana = v_dia_libre THEN
        INSERT INTO public.schedule_shifts (
          schedule_id, agente_id, fecha,
          tipo_actividad, horas_dia
        )
        VALUES (_schedule_id, v_agente.user_id, v_fecha, 'Descanso', 0)
        ON CONFLICT (schedule_id, agente_id, fecha)
        DO UPDATE SET tipo_actividad = 'Descanso', horas_dia = 0;
        v_fecha := v_fecha + 1;
        CONTINUE;
      END IF;

      -- Buscar novedad aprobada para este agente en esta fecha
      SELECT tipo_novedad, es_dia_completo, hora_inicio_novedad, hora_fin_novedad
        INTO v_novedad
        FROM public.schedule_novedades
       WHERE schedule_id  = _schedule_id
         AND agente_id    = v_agente.user_id
         AND fecha        = v_fecha
         AND estado       = 'aprobado'
       LIMIT 1;

      -- Novedad de día completo
      IF FOUND AND v_novedad.es_dia_completo THEN
        INSERT INTO public.schedule_shifts (
          schedule_id, agente_id, fecha,
          tipo_actividad, horas_dia, observacion
        )
        VALUES (
          _schedule_id, v_agente.user_id, v_fecha,
          CASE v_novedad.tipo_novedad
            WHEN 'incapacidad'           THEN 'Incapacidad'
            WHEN 'vacaciones'            THEN 'Vacaciones'
            ELSE 'No_aplica'
          END,
          0,
          'Novedad: ' || v_novedad.tipo_novedad
        )
        ON CONFLICT (schedule_id, agente_id, fecha)
        DO UPDATE SET
          tipo_actividad = EXCLUDED.tipo_actividad,
          horas_dia = 0,
          observacion = EXCLUDED.observacion;

        v_fecha := v_fecha + 1;
        CONTINUE;
      END IF;

      -- ── Determinar ventana del día ──
      IF v_dia_semana = 5 THEN
        -- Sábado
        v_turno_ini := v_win_sab_ini;
        v_turno_fin := v_win_sab_fin;
      ELSE
        -- L-V dentro de la ventana configurada
        v_turno_ini := v_hora_inicio;
        v_turno_fin := v_hora_fin;
      END IF;

      -- ── Calcular almuerzo y breaks ──
      v_almuerzo_ini := public.calcular_hora_almuerzo(
        v_turno_ini, v_turno_fin, v_agente_idx, _duracion_almuerzo
      );
      v_break1_ini := public.calcular_hora_break(v_turno_ini, v_turno_fin, 1);
      v_break2_ini := public.calcular_hora_break(v_turno_ini, v_turno_fin, 2);

      -- ── Calcular horas netas (total - almuerzo - 2 breaks de 15 min) ──
      v_horas_netas := ROUND(
        (public.minutos_entre(v_turno_ini, v_turno_fin)
          - _duracion_almuerzo
          - 30   -- 2 breaks de 15 min
        )::NUMERIC / 60,
        2
      );
      -- Sábado: sin breaks, jornada corta
      IF v_dia_semana = 5 THEN
        v_horas_netas := ROUND(
          public.minutos_entre(v_turno_ini, v_turno_fin)::NUMERIC / 60, 2
        );
        v_almuerzo_ini := NULL;
        v_break1_ini   := NULL;
        v_break2_ini   := NULL;
      END IF;

      -- ── Registrar novedad por horas en observación ──
      DECLARE
        v_obs TEXT := NULL;
        v_nov_horas_ini TIME := NULL;
        v_nov_horas_fin TIME := NULL;
      BEGIN
        IF FOUND AND NOT v_novedad.es_dia_completo
           AND v_novedad.hora_inicio_novedad IS NOT NULL
        THEN
          v_nov_horas_ini := v_novedad.hora_inicio_novedad;
          v_nov_horas_fin := v_novedad.hora_fin_novedad;
          v_obs := 'Permiso ' || v_nov_horas_ini::TEXT || '-' || v_nov_horas_fin::TEXT;

          -- Restar las horas del permiso parcial de las horas netas
          v_horas_netas := v_horas_netas -
            ROUND(public.minutos_entre(v_nov_horas_ini, v_nov_horas_fin)::NUMERIC / 60, 2);
          v_horas_netas := GREATEST(v_horas_netas, 0);
        END IF;

        -- ── Insertar/actualizar turno ──
        INSERT INTO public.schedule_shifts (
          schedule_id, agente_id, fecha,
          hora_inicio, hora_fin,
          hora_almuerzo, duracion_almuerzo,
          tipo_actividad, horas_dia, observacion
        )
        VALUES (
          _schedule_id, v_agente.user_id, v_fecha,
          v_turno_ini, v_turno_fin,
          v_almuerzo_ini, CASE WHEN v_dia_semana = 5 THEN 0 ELSE _duracion_almuerzo END,
          _tipo_actividad,
          v_horas_netas,
          v_obs
        )
        ON CONFLICT (schedule_id, agente_id, fecha)
        DO UPDATE SET
          hora_inicio       = EXCLUDED.hora_inicio,
          hora_fin          = EXCLUDED.hora_fin,
          hora_almuerzo     = EXCLUDED.hora_almuerzo,
          duracion_almuerzo = EXCLUDED.duracion_almuerzo,
          tipo_actividad    = EXCLUDED.tipo_actividad,
          horas_dia         = EXCLUDED.horas_dia,
          observacion       = EXCLUDED.observacion;

        v_count := v_count + 1;
      END;

      -- Acumular horas semanales
      v_horas_semana := v_horas_semana + COALESCE(v_horas_netas, 0);

      v_fecha := v_fecha + 1;
    END LOOP; -- días

    v_agente_idx := v_agente_idx + 1;
  END LOOP; -- agentes

  RETURN v_count;
END;
$$;

-- Permiso de ejecución para usuarios autenticados
REVOKE EXECUTE ON FUNCTION public.generate_schedule FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.generate_schedule TO authenticated;
