-- ============================================================
-- Esquema base de contact-app
-- Fecha: 2026-10-27
--
-- Generado con `supabase db dump -s public,archivo` desde producción después
-- de aplicar las fases 0, 1 y 2. Reemplaza a las migraciones anteriores,
-- que no reconstruían la base (las tablas base nunca se versionaron y el
-- historial remoto no coincidía). Esas migraciones quedan como referencia
-- en supabase/migrations_historico/.
--
-- Desde aquí, todo cambio de base de datos entra solo por una migración nueva.
-- ============================================================

CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA extensions;




SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE SCHEMA IF NOT EXISTS "archivo";


ALTER SCHEMA "archivo" OWNER TO "postgres";


COMMENT ON SCHEMA "archivo" IS 'Objetos heredados fuera de uso. No expuestos por la API.';



CREATE SCHEMA IF NOT EXISTS "public";


ALTER SCHEMA "public" OWNER TO "pg_database_owner";


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE TYPE "archivo"."rol_usuario" AS ENUM (
    'agente',
    'supervisor',
    'admin'
);


ALTER TYPE "archivo"."rol_usuario" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."_copy_previous_week_shifts_impl"("_dest_schedule_id" "uuid") RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  _campana_id       uuid;
  _semana_inicio    date;
  _prev_schedule_id uuid;
  _copied           integer := 0;
BEGIN
  SELECT campana_id, semana_inicio
    INTO _campana_id, _semana_inicio
    FROM public.schedules
   WHERE id = _dest_schedule_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Schedule destino no encontrado: %', _dest_schedule_id;
  END IF;

  IF (SELECT estado FROM public.schedules WHERE id = _dest_schedule_id) != 'borrador' THEN
    RAISE EXCEPTION 'Solo se puede copiar sobre un schedule en estado borrador';
  END IF;

  SELECT id INTO _prev_schedule_id
    FROM public.schedules
   WHERE campana_id = _campana_id
     AND semana_inicio = (_semana_inicio - interval '7 days')::date;

  IF NOT FOUND THEN
    RETURN 0;
  END IF;

  INSERT INTO public.schedule_shifts (
    schedule_id, agente_id, fecha,
    tipo_actividad, hora_inicio, hora_fin,
    horas_dia, duracion_almuerzo, notas
  )
  SELECT
    _dest_schedule_id,
    agente_id,
    (fecha + interval '7 days')::date,
    tipo_actividad,
    hora_inicio,
    hora_fin,
    horas_dia,
    duracion_almuerzo,
    notas
  FROM public.schedule_shifts
  WHERE schedule_id = _prev_schedule_id
  ON CONFLICT (schedule_id, agente_id, fecha) DO NOTHING;

  GET DIAGNOSTICS _copied = ROW_COUNT;
  RETURN _copied;
END;
$$;


ALTER FUNCTION "public"."_copy_previous_week_shifts_impl"("_dest_schedule_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."_copy_previous_week_shifts_impl"("_dest_schedule_id" "uuid") IS 'Copia los turnos de la semana anterior al schedule destino (borrador). ON CONFLICT DO NOTHING preserva ediciones manuales.';



CREATE OR REPLACE FUNCTION "public"."_generate_schedule_impl"("_schedule_id" "uuid", "_hora_inicio" time without time zone DEFAULT '07:00:00'::time without time zone, "_hora_fin" time without time zone DEFAULT '18:00:00'::time without time zone, "_dia_libre_base" integer DEFAULT 6, "_duracion_almuerzo" integer DEFAULT 60, "_skip_existing" boolean DEFAULT true) RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  _campana_id      uuid;
  _semana_inicio   date;
  _estado          text;
  _agente          record;
  _agente_idx      int := 0;
  _dia_libre       int;
  _dow             int;
  _fecha           date;
  _almuerzo_offset int;
  _generados       int := 0;
  _jornada_horas   numeric;
  _rows_affected   int;
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

  _jornada_horas := (
    EXTRACT(EPOCH FROM (_hora_fin - _hora_inicio)) / 3600.0
  ) - (_duracion_almuerzo::numeric / 60.0);

  FOR _agente IN
    SELECT p.user_id, p.nombre
      FROM public.perfil_campanas pc
      JOIN public.profiles p  ON p.user_id = pc.user_id
      JOIN public.user_roles r ON r.id = p.role_id
     WHERE pc.campana_id = _campana_id
       AND r.name = 'agent'
     ORDER BY p.nombre
  LOOP
    _dia_libre       := (_dia_libre_base + _agente_idx) % 7;
    _almuerzo_offset := (_agente_idx % 4) * 30;

    FOR _dow IN 0..6 LOOP
      _fecha := _semana_inicio + (_dow || ' days')::interval;

      IF _dow = _dia_libre THEN
        IF _skip_existing THEN
          INSERT INTO public.schedule_shifts (
            schedule_id, agente_id, fecha,
            tipo_actividad, hora_inicio, hora_fin,
            horas_dia, duracion_almuerzo
          ) VALUES (
            _schedule_id, _agente.user_id, _fecha,
            'Descanso', NULL, NULL, 0, 0
          )
          ON CONFLICT (schedule_id, agente_id, fecha) DO NOTHING;
        ELSE
          INSERT INTO public.schedule_shifts (
            schedule_id, agente_id, fecha,
            tipo_actividad, hora_inicio, hora_fin,
            horas_dia, duracion_almuerzo
          ) VALUES (
            _schedule_id, _agente.user_id, _fecha,
            'Descanso', NULL, NULL, 0, 0
          )
          ON CONFLICT (schedule_id, agente_id, fecha) DO UPDATE
            SET tipo_actividad    = EXCLUDED.tipo_actividad,
                hora_inicio       = EXCLUDED.hora_inicio,
                hora_fin          = EXCLUDED.hora_fin,
                horas_dia         = EXCLUDED.horas_dia,
                duracion_almuerzo = EXCLUDED.duracion_almuerzo;
        END IF;
      ELSE
        IF _skip_existing THEN
          INSERT INTO public.schedule_shifts (
            schedule_id, agente_id, fecha,
            tipo_actividad, hora_inicio, hora_fin,
            horas_dia, duracion_almuerzo
          ) VALUES (
            _schedule_id, _agente.user_id, _fecha,
            'Atencion',
            _hora_inicio, _hora_fin,
            ROUND(_jornada_horas::numeric, 2),
            _duracion_almuerzo
          )
          ON CONFLICT (schedule_id, agente_id, fecha) DO NOTHING;
        ELSE
          INSERT INTO public.schedule_shifts (
            schedule_id, agente_id, fecha,
            tipo_actividad, hora_inicio, hora_fin,
            horas_dia, duracion_almuerzo
          ) VALUES (
            _schedule_id, _agente.user_id, _fecha,
            'Atencion',
            _hora_inicio, _hora_fin,
            ROUND(_jornada_horas::numeric, 2),
            _duracion_almuerzo
          )
          ON CONFLICT (schedule_id, agente_id, fecha) DO UPDATE
            SET tipo_actividad    = EXCLUDED.tipo_actividad,
                hora_inicio       = EXCLUDED.hora_inicio,
                hora_fin          = EXCLUDED.hora_fin,
                horas_dia         = EXCLUDED.horas_dia,
                duracion_almuerzo = EXCLUDED.duracion_almuerzo;
        END IF;
      END IF;

      GET DIAGNOSTICS _rows_affected = ROW_COUNT;
      _generados := _generados + _rows_affected;
    END LOOP;

    _agente_idx := _agente_idx + 1;
  END LOOP;

  RETURN _generados;
END;
$$;


ALTER FUNCTION "public"."_generate_schedule_impl"("_schedule_id" "uuid", "_hora_inicio" time without time zone, "_hora_fin" time without time zone, "_dia_libre_base" integer, "_duracion_almuerzo" integer, "_skip_existing" boolean) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."_generate_schedule_impl"("_schedule_id" "uuid", "_hora_inicio" time without time zone, "_hora_fin" time without time zone, "_dia_libre_base" integer, "_duracion_almuerzo" integer, "_skip_existing" boolean) IS 'Genera turnos para todos los agentes: día libre rotativo, almuerzo escalonado cada 30 min. skip_existing=true preserva turnos editados manualmente.';



CREATE OR REPLACE FUNCTION "public"."_generate_schedule_impl"("_schedule_id" "uuid", "_hora_inicio" time without time zone DEFAULT '07:00:00'::time without time zone, "_hora_fin" time without time zone DEFAULT '18:00:00'::time without time zone, "_dia_libre_base" integer DEFAULT 6, "_duracion_almuerzo" integer DEFAULT 60, "_skip_existing" boolean DEFAULT true, "_tipo_actividad" "text" DEFAULT 'Tele'::"text") RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  _campana_id      uuid;
  _semana_inicio   date;
  _estado          text;
  _agente          record;
  _agente_idx      int := 0;
  _dia_libre       int;
  _dow             int;
  _fecha           date;
  _generados       int := 0;
  _jornada_horas   numeric;
  _rows_affected   int;
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

  -- Validar tipo_actividad
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
       AND r.name = 'agent'
     ORDER BY p.nombre
  LOOP
    _dia_libre := (_dia_libre_base + _agente_idx) % 7;

    FOR _dow IN 0..6 LOOP
      _fecha := _semana_inicio + (_dow || ' days')::interval;

      IF _dow = _dia_libre THEN
        IF _skip_existing THEN
          INSERT INTO public.schedule_shifts (
            schedule_id, agente_id, fecha,
            tipo_actividad, hora_inicio, hora_fin,
            horas_dia, duracion_almuerzo
          ) VALUES (
            _schedule_id, _agente.user_id, _fecha,
            'Descanso', NULL, NULL, 0, 0
          )
          ON CONFLICT (schedule_id, agente_id, fecha) DO NOTHING;
        ELSE
          INSERT INTO public.schedule_shifts (
            schedule_id, agente_id, fecha,
            tipo_actividad, hora_inicio, hora_fin,
            horas_dia, duracion_almuerzo
          ) VALUES (
            _schedule_id, _agente.user_id, _fecha,
            'Descanso', NULL, NULL, 0, 0
          )
          ON CONFLICT (schedule_id, agente_id, fecha) DO UPDATE
            SET tipo_actividad    = EXCLUDED.tipo_actividad,
                hora_inicio       = EXCLUDED.hora_inicio,
                hora_fin          = EXCLUDED.hora_fin,
                horas_dia         = EXCLUDED.horas_dia,
                duracion_almuerzo = EXCLUDED.duracion_almuerzo;
        END IF;
      ELSE
        IF _skip_existing THEN
          INSERT INTO public.schedule_shifts (
            schedule_id, agente_id, fecha,
            tipo_actividad, hora_inicio, hora_fin,
            horas_dia, duracion_almuerzo
          ) VALUES (
            _schedule_id, _agente.user_id, _fecha,
            _tipo_actividad,
            _hora_inicio, _hora_fin,
            ROUND(_jornada_horas::numeric, 2),
            _duracion_almuerzo
          )
          ON CONFLICT (schedule_id, agente_id, fecha) DO NOTHING;
        ELSE
          INSERT INTO public.schedule_shifts (
            schedule_id, agente_id, fecha,
            tipo_actividad, hora_inicio, hora_fin,
            horas_dia, duracion_almuerzo
          ) VALUES (
            _schedule_id, _agente.user_id, _fecha,
            _tipo_actividad,
            _hora_inicio, _hora_fin,
            ROUND(_jornada_horas::numeric, 2),
            _duracion_almuerzo
          )
          ON CONFLICT (schedule_id, agente_id, fecha) DO UPDATE
            SET tipo_actividad    = EXCLUDED.tipo_actividad,
                hora_inicio       = EXCLUDED.hora_inicio,
                hora_fin          = EXCLUDED.hora_fin,
                horas_dia         = EXCLUDED.horas_dia,
                duracion_almuerzo = EXCLUDED.duracion_almuerzo;
        END IF;
      END IF;

      GET DIAGNOSTICS _rows_affected = ROW_COUNT;
      _generados := _generados + _rows_affected;
    END LOOP;

    _agente_idx := _agente_idx + 1;
  END LOOP;

  RETURN _generados;
END;
$$;


ALTER FUNCTION "public"."_generate_schedule_impl"("_schedule_id" "uuid", "_hora_inicio" time without time zone, "_hora_fin" time without time zone, "_dia_libre_base" integer, "_duracion_almuerzo" integer, "_skip_existing" boolean, "_tipo_actividad" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."assert_schedule_manager"() RETURNS "void"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  -- COALESCE: sin perfil get_user_role da NULL y NOT IN no lo atraparía
  IF COALESCE(public.get_user_role(auth.uid()), '') NOT IN ('admin', 'supervisor') THEN
    RAISE EXCEPTION 'No tienes permisos para realizar esta acción'
      USING ERRCODE = '42501';
  END IF;
END;
$$;


ALTER FUNCTION "public"."assert_schedule_manager"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."assign_cases"("p_campana_id" "uuid", "p_caso_ids" integer[], "p_agente_ids" "uuid"[]) RETURNS "jsonb"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
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

  -- Agentes válidos y su carga actual en la campaña (lo que la RLS deja ver a quien llama)
  SELECT array_agg(a.user_id ORDER BY a.nombre),
         array_agg(a.nombre  ORDER BY a.nombre),
         array_agg((SELECT count(*) FROM casos x JOIN cat_estados e ON e.id = x.estado_id
                     WHERE x.agente_id = a.user_id AND x.campana_id = p_campana_id
                       AND NOT COALESCE(e.es_final, false))::int ORDER BY a.nombre)
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


ALTER FUNCTION "public"."assign_cases"("p_campana_id" "uuid", "p_caso_ids" integer[], "p_agente_ids" "uuid"[]) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."assignment_candidates"("p_campana_id" "uuid") RETURNS TABLE("user_id" "uuid", "nombre" "text", "abiertos" integer)
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_rol text := get_user_role(auth.uid());
BEGIN
  IF v_rol IS DISTINCT FROM 'admin' AND NOT (
       v_rol = 'supervisor'
       AND EXISTS (SELECT 1 FROM perfil_campanas WHERE perfil_campanas.user_id = v_uid AND campana_id = p_campana_id)) THEN
    RAISE EXCEPTION 'Solo un administrador o un supervisor de la campaña puede asignar casos' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT a.user_id,
         a.nombre,
         (SELECT count(*) FROM casos x JOIN cat_estados e ON e.id = x.estado_id
           WHERE x.agente_id = a.user_id AND x.campana_id = p_campana_id
             AND NOT COALESCE(e.es_final, false))::int
    FROM cat_agentes a
    JOIN perfil_campanas pc ON pc.user_id = a.user_id AND pc.campana_id = p_campana_id
   WHERE a.activo
     AND (
       EXISTS (SELECT 1 FROM user_role_assignments u JOIN user_roles r ON r.id = u.role_id
                WHERE u.user_id = a.user_id AND r.name = 'agent')
       OR EXISTS (SELECT 1 FROM profiles p JOIN user_roles r ON r.id = p.role_id
                   WHERE p.user_id = a.user_id AND r.name = 'agent')
     )
   ORDER BY a.nombre;
END;
$$;


ALTER FUNCTION "public"."assignment_candidates"("p_campana_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."calc_duracion_novedad"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
BEGIN
  IF NEW.es_dia_completo = false
     AND NEW.hora_inicio_novedad IS NOT NULL
     AND NEW.hora_fin_novedad    IS NOT NULL
  THEN
    NEW.duracion_minutos :=
      ROUND(EXTRACT(EPOCH FROM (NEW.hora_fin_novedad - NEW.hora_inicio_novedad)) / 60 / 15) * 15;
  ELSE
    NEW.duracion_minutos := NULL;
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."calc_duracion_novedad"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."copy_previous_week_shifts"("_dest_schedule_id" "uuid") RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  PERFORM public.assert_schedule_manager();
  RETURN public._copy_previous_week_shifts_impl(_dest_schedule_id);
END;
$$;


ALTER FUNCTION "public"."copy_previous_week_shifts"("_dest_schedule_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_case_with_client"("p_campana_id" "uuid", "p_tipo_servicio_id" integer, "p_descripcion" "text", "p_cliente_id" integer DEFAULT NULL::integer, "p_cliente" "jsonb" DEFAULT NULL::"jsonb") RETURNS "jsonb"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
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


ALTER FUNCTION "public"."create_case_with_client"("p_campana_id" "uuid", "p_tipo_servicio_id" integer, "p_descripcion" "text", "p_cliente_id" integer, "p_cliente" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."dashboard_agent_stats"("p_campana_ids" "uuid"[]) RETURNS TABLE("agente_id" "uuid", "activos" integer, "vencidos" integer)
    LANGUAGE "sql" STABLE
    SET "search_path" TO 'public'
    AS $$
  WITH cfg AS (
    SELECT * FROM sla_vigente(p_campana_ids)
  )
  SELECT ca.agente_id,
         COUNT(*)::int,
         (COUNT(*) FILTER (
            WHERE EXTRACT(EPOCH FROM (now() - ca.fecha_caso)) / 3600.0 >= cfg.horas_vencido
         ))::int
    FROM casos ca
    JOIN cat_estados e ON e.id = ca.estado_id
    JOIN cfg ON cfg.campana_id = ca.campana_id
   WHERE NOT COALESCE(e.es_final, false)
   GROUP BY ca.agente_id;
$$;


ALTER FUNCTION "public"."dashboard_agent_stats"("p_campana_ids" "uuid"[]) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."dashboard_stats"("p_campana_ids" "uuid"[], "p_tz" "text" DEFAULT 'America/Bogota'::"text") RETURNS TABLE("campana_id" "uuid", "abiertos" integer, "cerrados_hoy" integer, "sin_asignar" integer, "en_riesgo" integer, "vencidos" integer)
    LANGUAGE "sql" STABLE
    SET "search_path" TO 'public'
    AS $$
  WITH cfg AS (
    SELECT * FROM sla_vigente(p_campana_ids)
  ),
  k AS (
    SELECT ca.campana_id,
           ca.agente_id,
           ca.fecha_cierre,
           (NOT COALESCE(e.es_final, false) AND e.nombre IS DISTINCT FROM 'Transferido') AS abierto,
           (COALESCE(e.es_final, false) AND e.nombre IS DISTINCT FROM 'Transferido')     AS cerrado,
           EXTRACT(EPOCH FROM (now() - ca.fecha_caso)) / 3600.0                            AS horas,
           cfg.horas_riesgo AS hr,
           cfg.horas_vencido AS hv
      FROM casos ca
      JOIN cat_estados e ON e.id = ca.estado_id
      JOIN cfg ON cfg.campana_id = ca.campana_id
  )
  SELECT cfg.campana_id,
         (COUNT(*) FILTER (WHERE k.abierto))::int,
         (COUNT(*) FILTER (WHERE k.cerrado
                             AND (k.fecha_cierre AT TIME ZONE p_tz)::date = (now() AT TIME ZONE p_tz)::date))::int,
         (COUNT(*) FILTER (WHERE k.abierto AND k.agente_id IS NULL))::int,
         (COUNT(*) FILTER (WHERE k.abierto AND k.horas >= k.hr AND k.horas < k.hv))::int,
         (COUNT(*) FILTER (WHERE k.abierto AND k.horas >= k.hv))::int
    FROM cfg
    LEFT JOIN k ON k.campana_id = cfg.campana_id
   GROUP BY cfg.campana_id;
$$;


ALTER FUNCTION "public"."dashboard_stats"("p_campana_ids" "uuid"[], "p_tz" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."financial_summary"("p_campana_id" "uuid", "p_desde" timestamp with time zone, "p_hasta" timestamp with time zone, "p_periodo" "text", "p_tz" "text" DEFAULT 'America/Bogota'::"text") RETURNS TABLE("tramo" integer, "renovado" numeric, "pendiente" numeric)
    LANGUAGE "sql" STABLE
    SET "search_path" TO 'public'
    AS $$
  WITH k AS (
    SELECT ca.fecha_caso AT TIME ZONE p_tz AS local_ts,
           COALESCE(ca.valor_pagar, 0)     AS valor,
           lower(e.nombre) = 'renovado'    AS es_renovado,
           lower(e.nombre) LIKE '%pendiente%' AS es_pendiente
      FROM casos ca
      JOIN cat_estados e ON e.id = ca.estado_id
     WHERE ca.campana_id = p_campana_id
       AND ca.fecha_caso >= p_desde
       AND ca.fecha_caso <= p_hasta
  )
  SELECT CASE p_periodo
           WHEN 'dia'    THEN EXTRACT(HOUR   FROM local_ts)::int
           WHEN 'semana' THEN EXTRACT(ISODOW FROM local_ts)::int - 1
           WHEN 'mes'    THEN EXTRACT(DAY    FROM local_ts)::int
           ELSE               EXTRACT(MONTH  FROM local_ts)::int - 1
         END AS tramo,
         SUM(valor) FILTER (WHERE es_renovado),
         SUM(valor) FILTER (WHERE es_pendiente AND NOT es_renovado)
    FROM k
   WHERE es_renovado OR es_pendiente
   GROUP BY 1;
$$;


ALTER FUNCTION "public"."financial_summary"("p_campana_id" "uuid", "p_desde" timestamp with time zone, "p_hasta" timestamp with time zone, "p_periodo" "text", "p_tz" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."generate_schedule"("_schedule_id" "uuid", "_hora_inicio" time without time zone, "_hora_fin" time without time zone, "_dia_libre_base" integer, "_duracion_almuerzo" integer, "_skip_existing" boolean) RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  PERFORM public.assert_schedule_manager();
  RETURN public._generate_schedule_impl(
    _schedule_id, _hora_inicio, _hora_fin, _dia_libre_base,
    _duracion_almuerzo, _skip_existing
  );
END;
$$;


ALTER FUNCTION "public"."generate_schedule"("_schedule_id" "uuid", "_hora_inicio" time without time zone, "_hora_fin" time without time zone, "_dia_libre_base" integer, "_duracion_almuerzo" integer, "_skip_existing" boolean) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."generate_schedule"("_schedule_id" "uuid", "_hora_inicio" time without time zone DEFAULT '07:00:00'::time without time zone, "_hora_fin" time without time zone DEFAULT '18:00:00'::time without time zone, "_dia_libre_base" integer DEFAULT 6, "_duracion_almuerzo" integer DEFAULT 60, "_skip_existing" boolean DEFAULT true, "_tipo_actividad" "text" DEFAULT 'Tele'::"text") RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  PERFORM public.assert_schedule_manager();
  RETURN public._generate_schedule_impl(
    _schedule_id, _hora_inicio, _hora_fin, _dia_libre_base,
    _duracion_almuerzo, _skip_existing, _tipo_actividad
  );
END;
$$;


ALTER FUNCTION "public"."generate_schedule"("_schedule_id" "uuid", "_hora_inicio" time without time zone, "_hora_fin" time without time zone, "_dia_libre_base" integer, "_duracion_almuerzo" integer, "_skip_existing" boolean, "_tipo_actividad" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_agentes_by_campana"("_campana_id" "uuid") RETURNS TABLE("user_id" "uuid", "nombre" "text")
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT
    p.user_id,
    p.nombre
  FROM public.perfil_campanas pc
  JOIN public.profiles p   ON p.user_id  = pc.user_id
  JOIN public.user_roles r ON r.id       = p.role_id
  WHERE pc.campana_id = _campana_id
    AND r.name = 'agent'
  ORDER BY p.nombre;
$$;


ALTER FUNCTION "public"."get_agentes_by_campana"("_campana_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_agentes_by_campana"("_campana_id" "uuid") IS 'Retorna los agentes (role=agent) asociados a una campaña. SECURITY DEFINER para evitar RLS recursivo en perfil_campanas.';



CREATE OR REPLACE FUNCTION "public"."get_casos_counts"("p_campana_id" "uuid") RETURNS json
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
DECLARE
  todos_count        INT;
  activos_count      INT;
  cerrados_count     INT;
  transferidos_count INT;
BEGIN
  SELECT COUNT(*) INTO todos_count
  FROM casos
  WHERE campana_id = p_campana_id;

  SELECT COUNT(*) INTO activos_count
  FROM casos c
  JOIN cat_estados e ON e.id = c.estado_id
  WHERE c.campana_id = p_campana_id
    AND e.es_final = false
    AND e.nombre != 'Transferido';

  SELECT COUNT(*) INTO cerrados_count
  FROM casos c
  JOIN cat_estados e ON e.id = c.estado_id
  WHERE c.campana_id = p_campana_id
    AND e.es_final = true
    AND e.nombre != 'Transferido';

  SELECT COUNT(*) INTO transferidos_count
  FROM casos c
  JOIN cat_estados e ON e.id = c.estado_id
  WHERE c.campana_id = p_campana_id
    AND e.nombre = 'Transferido';

  RETURN json_build_object(
    'todos',        todos_count,
    'activos',      activos_count,
    'cerrados',     cerrados_count,
    'transferidos', transferidos_count
  );
END;
$$;


ALTER FUNCTION "public"."get_casos_counts"("p_campana_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_user_role"("_user_id" "uuid") RETURNS "text"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT COALESCE(
    (SELECT r.name
       FROM user_role_assignments u
       JOIN user_roles r ON r.id = u.role_id
      WHERE u.user_id = _user_id
      ORDER BY rol_prioridad(r.name) DESC
      LIMIT 1),
    (SELECT r.name
       FROM profiles p
       JOIN user_roles r ON r.id = p.role_id
      WHERE p.user_id = _user_id
      LIMIT 1)
  );
$$;


ALTER FUNCTION "public"."get_user_role"("_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_admin"("_user_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT COALESCE(public.get_user_role(_user_id) = 'admin', false);
$$;


ALTER FUNCTION "public"."is_admin"("_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."log_activity"("p_action" "text", "p_entity" "text", "p_entity_id" "text", "p_details" "jsonb" DEFAULT '{}'::"jsonb", "p_campana_id" "uuid" DEFAULT NULL::"uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
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


ALTER FUNCTION "public"."log_activity"("p_action" "text", "p_entity" "text", "p_entity_id" "text", "p_details" "jsonb", "p_campana_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."parse_monto_cop"("p" "text") RETURNS numeric
    LANGUAGE "plpgsql" IMMUTABLE
    SET "search_path" TO 'public'
    AS $_$
DECLARE
  v text := regexp_replace(COALESCE(p, ''), '[^0-9.,]', '', 'g');
BEGIN
  IF v = '' THEN RETURN NULL; END IF;
  IF v ~ ',' THEN
    v := replace(replace(v, '.', ''), ',', '.');      -- 1.250.000,50 → 1250000.50
  ELSIF v ~ '^\d{1,3}(\.\d{3})+$' THEN
    v := replace(v, '.', '');                          -- 150.000 → 150000
  END IF;
  RETURN v::numeric;
EXCEPTION WHEN OTHERS THEN
  RETURN NULL;
END;
$_$;


ALTER FUNCTION "public"."parse_monto_cop"("p" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."process_staging_casos"("p_campana_id" "uuid" DEFAULT NULL::"uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
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


ALTER FUNCTION "public"."process_staging_casos"("p_campana_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."protect_profile_privileged_columns"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
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


ALTER FUNCTION "public"."protect_profile_privileged_columns"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."reset_schedule_shifts"("_schedule_id" "uuid") RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  _count integer;
BEGIN
  -- Validar permisos
  IF get_user_role(auth.uid()) NOT IN ('admin', 'supervisor', 'gerente') THEN
    RAISE EXCEPTION 'No tienes permisos para realizar esta acción';
  END IF;

  -- Solo permitir si está en borrador
  IF (SELECT estado FROM public.schedules WHERE id = _schedule_id) != 'borrador' THEN
    RAISE EXCEPTION 'Solo se pueden eliminar turnos de una semana en estado borrador';
  END IF;

  DELETE FROM public.schedule_shifts
   WHERE schedule_id = _schedule_id;

  GET DIAGNOSTICS _count = ROW_COUNT;
  RETURN _count;
END;
$$;


ALTER FUNCTION "public"."reset_schedule_shifts"("_schedule_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."rol_prioridad"("p_nombre" "text") RETURNS integer
    LANGUAGE "sql" IMMUTABLE
    SET "search_path" TO 'public'
    AS $$
  SELECT CASE p_nombre WHEN 'admin' THEN 4 WHEN 'gerente' THEN 3 WHEN 'supervisor' THEN 2 WHEN 'agent' THEN 1 ELSE 0 END;
$$;


ALTER FUNCTION "public"."rol_prioridad"("p_nombre" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_schedule_creado_por"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  NEW.creado_por = auth.uid();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."set_schedule_creado_por"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."set_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_user_roles"("p_user_id" "uuid", "p_role_ids" integer[]) RETURNS "void"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Solo un administrador puede cambiar roles' USING ERRCODE = '42501';
  END IF;
  IF COALESCE(array_length(p_role_ids, 1), 0) = 0 THEN
    RAISE EXCEPTION 'El usuario debe tener al menos un rol';
  END IF;
  IF p_user_id = auth.uid() AND NOT EXISTS (
       SELECT 1 FROM user_roles WHERE id = ANY (p_role_ids) AND name = 'admin') THEN
    RAISE EXCEPTION 'No puedes quitarte tu propio rol de administrador';
  END IF;

  DELETE FROM user_role_assignments WHERE user_id = p_user_id AND role_id <> ALL (p_role_ids);
  INSERT INTO user_role_assignments (user_id, role_id)
  SELECT p_user_id, rid FROM unnest(p_role_ids) rid
   WHERE NOT EXISTS (SELECT 1 FROM user_role_assignments WHERE user_id = p_user_id AND role_id = rid);
END;
$$;


ALTER FUNCTION "public"."set_user_roles"("p_user_id" "uuid", "p_role_ids" integer[]) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sla_vigente"("p_campana_ids" "uuid"[]) RETURNS TABLE("campana_id" "uuid", "horas_riesgo" integer, "horas_vencido" integer)
    LANGUAGE "sql" STABLE
    SET "search_path" TO 'public'
    AS $$
  SELECT c.id,
         COALESCE(s.horas_riesgo, 2),
         COALESCE(s.horas_vencido, 6)
    FROM campanas c
    LEFT JOIN LATERAL (
      SELECT sc.horas_riesgo, sc.horas_vencido
        FROM sla_config sc
       WHERE sc.campana_id = c.id AND sc.activo
       ORDER BY sc.id DESC
       LIMIT 1
    ) s ON true
   WHERE c.id = ANY (p_campana_ids);
$$;


ALTER FUNCTION "public"."sla_vigente"("p_campana_ids" "uuid"[]) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."supervisor_de_campana"("p_campana_id" "uuid") RETURNS TABLE("user_id" "uuid", "nombre" "text")
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT p.user_id, p.nombre
    FROM perfil_campanas pc
    JOIN profiles p ON p.user_id = pc.user_id
   WHERE pc.campana_id = p_campana_id
     AND (
       EXISTS (SELECT 1 FROM user_roles r WHERE r.id = p.role_id AND r.name = 'supervisor')
       OR EXISTS (SELECT 1 FROM user_role_assignments u JOIN user_roles r ON r.id = u.role_id
                   WHERE u.user_id = p.user_id AND r.name = 'supervisor')
     )
   ORDER BY (SELECT count(*) FROM casos x JOIN cat_estados e ON e.id = x.estado_id
              WHERE x.agente_id = p.user_id AND NOT COALESCE(e.es_final, false)),
            p.nombre
   LIMIT 1;
$$;


ALTER FUNCTION "public"."supervisor_de_campana"("p_campana_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sync_profile_role"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_user uuid := COALESCE(NEW.user_id, OLD.user_id);
  v_role int;
BEGIN
  SELECT u.role_id INTO v_role
    FROM user_role_assignments u
    JOIN user_roles r ON r.id = u.role_id
   WHERE u.user_id = v_user
   ORDER BY rol_prioridad(r.name) DESC
   LIMIT 1;

  -- Sin asignaciones se conserva el valor actual (role_id es NOT NULL)
  IF v_role IS NOT NULL THEN
    UPDATE profiles SET role_id = v_role WHERE user_id = v_user AND role_id IS DISTINCT FROM v_role;
  END IF;
  RETURN NULL;
END;
$$;


ALTER FUNCTION "public"."sync_profile_role"() OWNER TO "postgres";


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


ALTER FUNCTION "public"."transfer_case"("p_caso_id" integer, "p_campana_destino" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trg_casos_activity"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
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


ALTER FUNCTION "public"."trg_casos_activity"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trg_clientes_activity"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
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


ALTER FUNCTION "public"."trg_clientes_activity"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."unpublish_schedule"("_schedule_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  -- Validar que el usuario sea manager
  IF get_user_role(auth.uid()) NOT IN ('admin', 'supervisor', 'gerente') THEN
    RAISE EXCEPTION 'No tienes permisos para realizar esta acción';
  END IF;

  UPDATE public.schedules
     SET estado = 'borrador',
         updated_at = NOW()
   WHERE id = _schedule_id;

  RETURN FOUND;
END;
$$;


ALTER FUNCTION "public"."unpublish_schedule"("_schedule_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;


ALTER FUNCTION "public"."update_updated_at"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "archivo"."perfiles" (
    "id" "uuid" NOT NULL,
    "username" "text",
    "nombre" "text",
    "rol" "archivo"."rol_usuario" DEFAULT 'agente'::"archivo"."rol_usuario" NOT NULL,
    "activo" boolean DEFAULT true NOT NULL,
    "creado_en" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "archivo"."perfiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."activity_log" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "user_id" "uuid",
    "user_email" "text",
    "user_name" "text",
    "action" "text" NOT NULL,
    "entity" "text" NOT NULL,
    "entity_id" "text",
    "campana_id" "uuid",
    "details" "jsonb" DEFAULT '{}'::"jsonb",
    "ip_address" "text"
);


ALTER TABLE "public"."activity_log" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."campanas" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "nombre" "text" NOT NULL,
    "descripcion" "text",
    "activa" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."campanas" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."caso_historial" (
    "id" integer NOT NULL,
    "caso_id" integer NOT NULL,
    "estado_id" integer NOT NULL,
    "cambiado_por" "uuid" NOT NULL,
    "cambiado_en" timestamp with time zone DEFAULT "now"() NOT NULL,
    "comentario" "text",
    "observacion" "text",
    "agente_nombre" "text",
    "agente_id" "uuid",
    "estado_nuevo" "text",
    "fecha_cambio" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."caso_historial" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."caso_historial_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."caso_historial_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."caso_historial_id_seq" OWNED BY "public"."caso_historial"."id";



CREATE TABLE IF NOT EXISTS "public"."casos" (
    "id" integer NOT NULL,
    "cliente_id" integer NOT NULL,
    "tipo_servicio_id" integer NOT NULL,
    "estado_id" integer NOT NULL,
    "agente_id" "uuid" NOT NULL,
    "descripcion_inicial" "text" NOT NULL,
    "observacion_cierre" "text",
    "fecha_caso" timestamp with time zone DEFAULT "now"() NOT NULL,
    "fecha_cierre" timestamp with time zone,
    "created_by" "uuid" NOT NULL,
    "updated_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "valor_pagar" numeric,
    "campana_id" "uuid",
    "transferido_a_caso_id" integer,
    "transferido_desde_caso_id" integer
);


ALTER TABLE "public"."casos" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."casos_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."casos_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."casos_id_seq" OWNED BY "public"."casos"."id";



CREATE TABLE IF NOT EXISTS "public"."cat_agentes" (
    "user_id" "uuid" NOT NULL,
    "nombre" "text" NOT NULL,
    "activo" boolean DEFAULT true NOT NULL
);


ALTER TABLE "public"."cat_agentes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."cat_estados" (
    "id" integer NOT NULL,
    "nombre" "text" NOT NULL,
    "es_final" boolean DEFAULT false NOT NULL
);


ALTER TABLE "public"."cat_estados" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."cat_estados_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."cat_estados_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."cat_estados_id_seq" OWNED BY "public"."cat_estados"."id";



CREATE TABLE IF NOT EXISTS "public"."cat_tipo_servicio" (
    "id" integer NOT NULL,
    "nombre" "text" NOT NULL
);


ALTER TABLE "public"."cat_tipo_servicio" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."cat_tipo_servicio_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."cat_tipo_servicio_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."cat_tipo_servicio_id_seq" OWNED BY "public"."cat_tipo_servicio"."id";



CREATE TABLE IF NOT EXISTS "public"."clientes" (
    "id" integer NOT NULL,
    "tipo_cliente" "text" NOT NULL,
    "identificacion" "text" NOT NULL,
    "razon_social" "text",
    "nombre_contacto" "text" NOT NULL,
    "telefono" "text",
    "celular" "text",
    "correo" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."clientes" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."clientes_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."clientes_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."clientes_id_seq" OWNED BY "public"."clientes"."id";



CREATE TABLE IF NOT EXISTS "public"."perfil_campanas" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "campana_id" "uuid"
);


ALTER TABLE "public"."perfil_campanas" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "user_id" "uuid" NOT NULL,
    "nombre" "text" NOT NULL,
    "telefono" "text",
    "role_id" integer NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "must_change_password" boolean DEFAULT true NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."profiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."schedule_novedades" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "schedule_id" "uuid" NOT NULL,
    "agente_id" "uuid" NOT NULL,
    "fecha" "date" NOT NULL,
    "tipo_novedad" "text" NOT NULL,
    "descripcion" "text",
    "estado" "text" DEFAULT 'pendiente'::"text" NOT NULL,
    "revisado_por" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "hora_inicio_novedad" time without time zone,
    "hora_fin_novedad" time without time zone,
    "duracion_minutos" integer,
    "es_dia_completo" boolean DEFAULT true NOT NULL,
    CONSTRAINT "chk_novedad_horas_consistencia" CHECK ((("es_dia_completo" = true) OR (("hora_inicio_novedad" IS NOT NULL) AND ("hora_fin_novedad" IS NOT NULL) AND ("hora_fin_novedad" > "hora_inicio_novedad") AND (("duracion_minutos" IS NULL) OR (("duracion_minutos" % 15) = 0))))),
    CONSTRAINT "schedule_novedades_estado_check" CHECK (("estado" = ANY (ARRAY['pendiente'::"text", 'aprobado'::"text", 'rechazado'::"text"]))),
    CONSTRAINT "schedule_novedades_tipo_novedad_check" CHECK (("tipo_novedad" = ANY (ARRAY['incapacidad'::"text", 'permiso_remunerado'::"text", 'permiso_no_remunerado'::"text", 'permiso_horas'::"text", 'vacaciones'::"text", 'calamidad'::"text", 'cambio_turno'::"text", 'otro'::"text"])))
);


ALTER TABLE "public"."schedule_novedades" OWNER TO "postgres";


COMMENT ON TABLE "public"."schedule_novedades" IS 'Novedades y ausentismos por agente × día.';



CREATE TABLE IF NOT EXISTS "public"."schedule_shifts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "schedule_id" "uuid" NOT NULL,
    "agente_id" "uuid" NOT NULL,
    "fecha" "date" NOT NULL,
    "shift_type_id" integer,
    "hora_inicio" time without time zone,
    "hora_fin" time without time zone,
    "hora_almuerzo" time without time zone,
    "duracion_almuerzo" integer DEFAULT 45,
    "tipo_actividad" "text" DEFAULT 'GAP'::"text",
    "horas_dia" numeric(4,2),
    "observacion" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "schedule_shifts_tipo_actividad_check" CHECK (("tipo_actividad" = ANY (ARRAY['GAP'::"text", 'Tele'::"text", 'Calidad'::"text", 'Apoyo'::"text", 'VIP'::"text", 'Descanso'::"text", 'Vacaciones'::"text", 'Incapacidad'::"text", 'No_aplica'::"text"])))
);


ALTER TABLE "public"."schedule_shifts" OWNER TO "postgres";


COMMENT ON TABLE "public"."schedule_shifts" IS 'Un registro por agente × día dentro de una semana programada.';



CREATE TABLE IF NOT EXISTS "public"."schedules" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "campana_id" "uuid" NOT NULL,
    "semana_inicio" "date" NOT NULL,
    "semana_fin" "date" NOT NULL,
    "estado" "text" DEFAULT 'borrador'::"text" NOT NULL,
    "creado_por" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "schedules_estado_check" CHECK (("estado" = ANY (ARRAY['borrador'::"text", 'publicado'::"text"])))
);


ALTER TABLE "public"."schedules" OWNER TO "postgres";


COMMENT ON TABLE "public"."schedules" IS 'Una fila por semana × campaña. Estado borrador/publicado.';



CREATE TABLE IF NOT EXISTS "public"."shift_types" (
    "id" integer NOT NULL,
    "campana_id" "uuid" NOT NULL,
    "nombre" "text" NOT NULL,
    "hora_inicio" time without time zone NOT NULL,
    "hora_fin" time without time zone NOT NULL,
    "color" "text" DEFAULT '#6366f1'::"text",
    "activo" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."shift_types" OWNER TO "postgres";


COMMENT ON TABLE "public"."shift_types" IS 'Tipos de turno configurables por campaña (ej: Turno 8h, Turno 4h Sábado).';



CREATE SEQUENCE IF NOT EXISTS "public"."shift_types_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."shift_types_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."shift_types_id_seq" OWNED BY "public"."shift_types"."id";



CREATE TABLE IF NOT EXISTS "public"."sla_config" (
    "id" integer NOT NULL,
    "campana_id" "uuid",
    "horas_riesgo" integer DEFAULT 2 NOT NULL,
    "horas_vencido" integer DEFAULT 6 NOT NULL,
    "activo" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."sla_config" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."sla_config_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."sla_config_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."sla_config_id_seq" OWNED BY "public"."sla_config"."id";



CREATE TABLE IF NOT EXISTS "public"."staging_casos" (
    "cliente_identificacion" "text",
    "fecha_caso" "text",
    "tipo_servicio" "text",
    "estado" "text",
    "agente_nombre" "text",
    "valor_pagar" "text",
    "descripcion_inicial" "text",
    "id" integer NOT NULL,
    "agente_correo" "text",
    "fila_excel" integer
);


ALTER TABLE "public"."staging_casos" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."staging_casos_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."staging_casos_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."staging_casos_id_seq" OWNED BY "public"."staging_casos"."id";



CREATE TABLE IF NOT EXISTS "public"."user_role_assignments" (
    "id" integer NOT NULL,
    "user_id" "uuid" NOT NULL,
    "role_id" integer NOT NULL,
    "assigned_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."user_role_assignments" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."user_role_assignments_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."user_role_assignments_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."user_role_assignments_id_seq" OWNED BY "public"."user_role_assignments"."id";



CREATE TABLE IF NOT EXISTS "public"."user_roles" (
    "id" integer NOT NULL,
    "name" "text" NOT NULL
);


ALTER TABLE "public"."user_roles" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."user_roles_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."user_roles_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."user_roles_id_seq" OWNED BY "public"."user_roles"."id";



ALTER TABLE ONLY "public"."caso_historial" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."caso_historial_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."casos" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."casos_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."cat_estados" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."cat_estados_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."cat_tipo_servicio" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."cat_tipo_servicio_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."clientes" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."clientes_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."shift_types" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."shift_types_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."sla_config" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."sla_config_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."staging_casos" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."staging_casos_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."user_role_assignments" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."user_role_assignments_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."user_roles" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."user_roles_id_seq"'::"regclass");



ALTER TABLE ONLY "archivo"."perfiles"
    ADD CONSTRAINT "perfiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "archivo"."perfiles"
    ADD CONSTRAINT "perfiles_username_key" UNIQUE ("username");



ALTER TABLE ONLY "public"."activity_log"
    ADD CONSTRAINT "activity_log_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."campanas"
    ADD CONSTRAINT "campanas_nombre_key" UNIQUE ("nombre");



ALTER TABLE ONLY "public"."campanas"
    ADD CONSTRAINT "campanas_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."caso_historial"
    ADD CONSTRAINT "caso_historial_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."casos"
    ADD CONSTRAINT "casos_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."cat_agentes"
    ADD CONSTRAINT "cat_agentes_pkey" PRIMARY KEY ("user_id");



ALTER TABLE ONLY "public"."cat_estados"
    ADD CONSTRAINT "cat_estados_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."cat_tipo_servicio"
    ADD CONSTRAINT "cat_tipo_servicio_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."clientes"
    ADD CONSTRAINT "clientes_identificacion_key" UNIQUE ("identificacion");



ALTER TABLE ONLY "public"."clientes"
    ADD CONSTRAINT "clientes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."perfil_campanas"
    ADD CONSTRAINT "perfil_campanas_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."perfil_campanas"
    ADD CONSTRAINT "perfil_campanas_user_id_campana_id_key" UNIQUE ("user_id", "campana_id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("user_id");



ALTER TABLE ONLY "public"."schedule_novedades"
    ADD CONSTRAINT "schedule_novedades_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."schedule_shifts"
    ADD CONSTRAINT "schedule_shifts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."schedule_shifts"
    ADD CONSTRAINT "schedule_shifts_schedule_id_agente_id_fecha_key" UNIQUE ("schedule_id", "agente_id", "fecha");



ALTER TABLE ONLY "public"."schedules"
    ADD CONSTRAINT "schedules_campana_id_semana_inicio_key" UNIQUE ("campana_id", "semana_inicio");



ALTER TABLE ONLY "public"."schedules"
    ADD CONSTRAINT "schedules_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."shift_types"
    ADD CONSTRAINT "shift_types_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."sla_config"
    ADD CONSTRAINT "sla_config_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."staging_casos"
    ADD CONSTRAINT "staging_casos_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_role_assignments"
    ADD CONSTRAINT "user_role_assignments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_role_assignments"
    ADD CONSTRAINT "user_role_assignments_user_id_role_id_key" UNIQUE ("user_id", "role_id");



ALTER TABLE ONLY "public"."user_roles"
    ADD CONSTRAINT "user_roles_name_key" UNIQUE ("name");



ALTER TABLE ONLY "public"."user_roles"
    ADD CONSTRAINT "user_roles_pkey" PRIMARY KEY ("id");



CREATE INDEX "idx_activity_log_campana_id" ON "public"."activity_log" USING "btree" ("campana_id");



CREATE INDEX "idx_activity_log_created_at" ON "public"."activity_log" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_activity_log_entity" ON "public"."activity_log" USING "btree" ("entity");



CREATE INDEX "idx_activity_log_user_id" ON "public"."activity_log" USING "btree" ("user_id");



CREATE INDEX "idx_caso_historial_caso_id" ON "public"."caso_historial" USING "btree" ("caso_id");



CREATE INDEX "idx_casos_agente_id" ON "public"."casos" USING "btree" ("agente_id");



CREATE INDEX "idx_casos_campana" ON "public"."casos" USING "btree" ("campana_id");



CREATE INDEX "idx_casos_campana_estado" ON "public"."casos" USING "btree" ("campana_id", "estado_id");



CREATE INDEX "idx_casos_campana_updated" ON "public"."casos" USING "btree" ("campana_id", "updated_at" DESC);



CREATE INDEX "idx_casos_estado_id" ON "public"."casos" USING "btree" ("estado_id");



CREATE INDEX "idx_casos_fecha" ON "public"."casos" USING "btree" ("fecha_caso" DESC);



CREATE INDEX "idx_casos_transferido_desde" ON "public"."casos" USING "btree" ("transferido_desde_caso_id") WHERE ("transferido_desde_caso_id" IS NOT NULL);



CREATE INDEX "idx_clientes_identificacion_trgm" ON "public"."clientes" USING "gin" ("identificacion" "extensions"."gin_trgm_ops");



CREATE INDEX "idx_clientes_nombre_trgm" ON "public"."clientes" USING "gin" ("nombre_contacto" "extensions"."gin_trgm_ops");



CREATE INDEX "idx_clientes_razon_social_trgm" ON "public"."clientes" USING "gin" ("razon_social" "extensions"."gin_trgm_ops");



CREATE INDEX "idx_novedades_agente_fecha" ON "public"."schedule_novedades" USING "btree" ("agente_id", "fecha");



CREATE INDEX "idx_novedades_estado" ON "public"."schedule_novedades" USING "btree" ("estado", "created_at" DESC);



CREATE INDEX "idx_novedades_schedule" ON "public"."schedule_novedades" USING "btree" ("schedule_id", "agente_id");



CREATE INDEX "idx_role_assignments_user" ON "public"."user_role_assignments" USING "btree" ("user_id");



CREATE INDEX "idx_schedules_campana_semana" ON "public"."schedules" USING "btree" ("campana_id", "semana_inicio");



CREATE INDEX "idx_schedules_estado" ON "public"."schedules" USING "btree" ("campana_id", "estado");



CREATE INDEX "idx_shifts_agente_fecha" ON "public"."schedule_shifts" USING "btree" ("agente_id", "fecha");



CREATE INDEX "idx_shifts_schedule_agente" ON "public"."schedule_shifts" USING "btree" ("schedule_id", "agente_id");



CREATE INDEX "idx_ura_role_id" ON "public"."user_role_assignments" USING "btree" ("role_id");



CREATE OR REPLACE TRIGGER "profiles_updated_at" BEFORE UPDATE ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at"();



CREATE OR REPLACE TRIGGER "trg_calc_duracion_novedad" BEFORE INSERT OR UPDATE ON "public"."schedule_novedades" FOR EACH ROW EXECUTE FUNCTION "public"."calc_duracion_novedad"();



CREATE OR REPLACE TRIGGER "trg_casos_activity" AFTER INSERT OR DELETE OR UPDATE ON "public"."casos" FOR EACH ROW EXECUTE FUNCTION "public"."trg_casos_activity"();



CREATE OR REPLACE TRIGGER "trg_clientes_activity" AFTER INSERT OR UPDATE ON "public"."clientes" FOR EACH ROW EXECUTE FUNCTION "public"."trg_clientes_activity"();



CREATE OR REPLACE TRIGGER "trg_novedades_updated_at" BEFORE UPDATE ON "public"."schedule_novedades" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_protect_profile_privileged_columns" BEFORE UPDATE ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "public"."protect_profile_privileged_columns"();



CREATE OR REPLACE TRIGGER "trg_schedule_creado_por" BEFORE INSERT ON "public"."schedules" FOR EACH ROW EXECUTE FUNCTION "public"."set_schedule_creado_por"();



CREATE OR REPLACE TRIGGER "trg_schedules_updated_at" BEFORE UPDATE ON "public"."schedules" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_shifts_updated_at" BEFORE UPDATE ON "public"."schedule_shifts" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_sync_profile_role" AFTER INSERT OR DELETE OR UPDATE ON "public"."user_role_assignments" FOR EACH ROW EXECUTE FUNCTION "public"."sync_profile_role"();



ALTER TABLE ONLY "archivo"."perfiles"
    ADD CONSTRAINT "perfiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."activity_log"
    ADD CONSTRAINT "activity_log_campana_id_fkey" FOREIGN KEY ("campana_id") REFERENCES "public"."campanas"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."activity_log"
    ADD CONSTRAINT "activity_log_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."caso_historial"
    ADD CONSTRAINT "caso_historial_agente_id_fkey" FOREIGN KEY ("agente_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."caso_historial"
    ADD CONSTRAINT "caso_historial_cambiado_por_fkey" FOREIGN KEY ("cambiado_por") REFERENCES "public"."profiles"("user_id");



ALTER TABLE ONLY "public"."caso_historial"
    ADD CONSTRAINT "caso_historial_caso_id_fkey" FOREIGN KEY ("caso_id") REFERENCES "public"."casos"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."caso_historial"
    ADD CONSTRAINT "caso_historial_estado_id_fkey" FOREIGN KEY ("estado_id") REFERENCES "public"."cat_estados"("id");



ALTER TABLE ONLY "public"."casos"
    ADD CONSTRAINT "casos_agente_id_fkey" FOREIGN KEY ("agente_id") REFERENCES "public"."cat_agentes"("user_id");



ALTER TABLE ONLY "public"."casos"
    ADD CONSTRAINT "casos_campana_id_fkey" FOREIGN KEY ("campana_id") REFERENCES "public"."campanas"("id");



ALTER TABLE ONLY "public"."casos"
    ADD CONSTRAINT "casos_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "public"."clientes"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."casos"
    ADD CONSTRAINT "casos_estado_id_fkey" FOREIGN KEY ("estado_id") REFERENCES "public"."cat_estados"("id");



ALTER TABLE ONLY "public"."casos"
    ADD CONSTRAINT "casos_tipo_servicio_id_fkey" FOREIGN KEY ("tipo_servicio_id") REFERENCES "public"."cat_tipo_servicio"("id");



ALTER TABLE ONLY "public"."casos"
    ADD CONSTRAINT "casos_transferido_a_caso_id_fkey" FOREIGN KEY ("transferido_a_caso_id") REFERENCES "public"."casos"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."casos"
    ADD CONSTRAINT "casos_transferido_desde_caso_id_fkey" FOREIGN KEY ("transferido_desde_caso_id") REFERENCES "public"."casos"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."perfil_campanas"
    ADD CONSTRAINT "perfil_campanas_campana_id_fkey" FOREIGN KEY ("campana_id") REFERENCES "public"."campanas"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."perfil_campanas"
    ADD CONSTRAINT "perfil_campanas_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "public"."user_roles"("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."schedule_novedades"
    ADD CONSTRAINT "schedule_novedades_agente_id_fkey" FOREIGN KEY ("agente_id") REFERENCES "public"."profiles"("user_id");



ALTER TABLE ONLY "public"."schedule_novedades"
    ADD CONSTRAINT "schedule_novedades_revisado_por_fkey" FOREIGN KEY ("revisado_por") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."schedule_novedades"
    ADD CONSTRAINT "schedule_novedades_schedule_id_fkey" FOREIGN KEY ("schedule_id") REFERENCES "public"."schedules"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."schedule_shifts"
    ADD CONSTRAINT "schedule_shifts_agente_id_fkey" FOREIGN KEY ("agente_id") REFERENCES "public"."profiles"("user_id") ON DELETE CASCADE;



COMMENT ON CONSTRAINT "schedule_shifts_agente_id_fkey" ON "public"."schedule_shifts" IS 'Relación explícita con profiles para permitir JOINs en PostgREST.';



ALTER TABLE ONLY "public"."schedule_shifts"
    ADD CONSTRAINT "schedule_shifts_schedule_id_fkey" FOREIGN KEY ("schedule_id") REFERENCES "public"."schedules"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."schedule_shifts"
    ADD CONSTRAINT "schedule_shifts_shift_type_id_fkey" FOREIGN KEY ("shift_type_id") REFERENCES "public"."shift_types"("id");



ALTER TABLE ONLY "public"."schedules"
    ADD CONSTRAINT "schedules_campana_id_fkey" FOREIGN KEY ("campana_id") REFERENCES "public"."campanas"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."schedules"
    ADD CONSTRAINT "schedules_creado_por_fkey" FOREIGN KEY ("creado_por") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."shift_types"
    ADD CONSTRAINT "shift_types_campana_id_fkey" FOREIGN KEY ("campana_id") REFERENCES "public"."campanas"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."sla_config"
    ADD CONSTRAINT "sla_config_campana_id_fkey" FOREIGN KEY ("campana_id") REFERENCES "public"."campanas"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_role_assignments"
    ADD CONSTRAINT "user_role_assignments_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "public"."user_roles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_role_assignments"
    ADD CONSTRAINT "user_role_assignments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE "archivo"."perfiles" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "perfiles_delete_admin" ON "archivo"."perfiles" FOR DELETE TO "authenticated" USING (( SELECT "public"."is_admin"(( SELECT "auth"."uid"() AS "uid")) AS "is_admin"));



CREATE POLICY "perfiles_insert_admin" ON "archivo"."perfiles" FOR INSERT TO "authenticated" WITH CHECK (( SELECT "public"."is_admin"(( SELECT "auth"."uid"() AS "uid")) AS "is_admin"));



CREATE POLICY "perfiles_select" ON "archivo"."perfiles" FOR SELECT TO "authenticated" USING ((("id" = ( SELECT "auth"."uid"() AS "uid")) OR ( SELECT "public"."is_admin"(( SELECT "auth"."uid"() AS "uid")) AS "is_admin")));



CREATE POLICY "perfiles_update_admin" ON "archivo"."perfiles" FOR UPDATE TO "authenticated" USING (( SELECT "public"."is_admin"(( SELECT "auth"."uid"() AS "uid")) AS "is_admin")) WITH CHECK (( SELECT "public"."is_admin"(( SELECT "auth"."uid"() AS "uid")) AS "is_admin"));



CREATE POLICY "Admin can delete estados" ON "public"."cat_estados" FOR DELETE USING (( SELECT "public"."is_admin"(( SELECT "auth"."uid"() AS "uid")) AS "is_admin"));



CREATE POLICY "Admin can delete tipo_servicio" ON "public"."cat_tipo_servicio" FOR DELETE USING (( SELECT "public"."is_admin"(( SELECT "auth"."uid"() AS "uid")) AS "is_admin"));



CREATE POLICY "Admin can insert agentes" ON "public"."cat_agentes" FOR INSERT WITH CHECK (( SELECT "public"."is_admin"(( SELECT "auth"."uid"() AS "uid")) AS "is_admin"));



CREATE POLICY "Admin can insert estados" ON "public"."cat_estados" FOR INSERT WITH CHECK (( SELECT "public"."is_admin"(( SELECT "auth"."uid"() AS "uid")) AS "is_admin"));



CREATE POLICY "Admin can insert tipo_servicio" ON "public"."cat_tipo_servicio" FOR INSERT WITH CHECK (( SELECT "public"."is_admin"(( SELECT "auth"."uid"() AS "uid")) AS "is_admin"));



CREATE POLICY "Admin can update agentes" ON "public"."cat_agentes" FOR UPDATE USING (( SELECT "public"."is_admin"(( SELECT "auth"."uid"() AS "uid")) AS "is_admin"));



CREATE POLICY "Admin can update estados" ON "public"."cat_estados" FOR UPDATE USING (( SELECT "public"."is_admin"(( SELECT "auth"."uid"() AS "uid")) AS "is_admin"));



CREATE POLICY "Admin can update tipo_servicio" ON "public"."cat_tipo_servicio" FOR UPDATE USING (( SELECT "public"."is_admin"(( SELECT "auth"."uid"() AS "uid")) AS "is_admin"));



CREATE POLICY "Authenticated can read roles" ON "public"."user_roles" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Service role can insert profiles" ON "public"."profiles" FOR INSERT TO "service_role" WITH CHECK (true);



CREATE POLICY "Service role can read all profiles" ON "public"."profiles" FOR SELECT TO "service_role" USING (true);



CREATE POLICY "Service role can update profiles" ON "public"."profiles" FOR UPDATE TO "service_role" USING (true) WITH CHECK (true);



ALTER TABLE "public"."activity_log" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "admins_select_activity_log" ON "public"."activity_log" FOR SELECT TO "authenticated" USING (( SELECT "public"."is_admin"(( SELECT "auth"."uid"() AS "uid")) AS "is_admin"));



ALTER TABLE "public"."campanas" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "campanas_select" ON "public"."campanas" FOR SELECT TO "authenticated" USING ((( SELECT "auth"."role"() AS "role") = 'authenticated'::"text"));



ALTER TABLE "public"."caso_historial" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "caso_historial_insert_own" ON "public"."caso_historial" FOR INSERT TO "authenticated" WITH CHECK ((("cambiado_por" = ( SELECT "auth"."uid"() AS "uid")) AND (( SELECT "public"."get_user_role"(( SELECT "auth"."uid"() AS "uid")) AS "get_user_role") IS DISTINCT FROM 'gerente'::"text")));



CREATE POLICY "caso_historial_select_visible" ON "public"."caso_historial" FOR SELECT TO "authenticated" USING (((( SELECT "public"."get_user_role"(( SELECT "auth"."uid"() AS "uid")) AS "get_user_role") = ANY (ARRAY['admin'::"text", 'gerente'::"text"])) OR (EXISTS ( SELECT 1
   FROM "public"."casos" "c"
  WHERE ("c"."id" = "caso_historial"."caso_id")))));



ALTER TABLE "public"."casos" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "casos_insert_no_gerente" ON "public"."casos" FOR INSERT TO "authenticated" WITH CHECK ((( SELECT "public"."get_user_role"(( SELECT "auth"."uid"() AS "uid")) AS "get_user_role") <> 'gerente'::"text"));



CREATE POLICY "casos_select_by_role" ON "public"."casos" FOR SELECT TO "authenticated" USING (
CASE ( SELECT "public"."get_user_role"(( SELECT "auth"."uid"() AS "uid")) AS "get_user_role")
    WHEN 'agent'::"text" THEN ("agente_id" = ( SELECT "auth"."uid"() AS "uid"))
    WHEN 'supervisor'::"text" THEN ("campana_id" IN ( SELECT "perfil_campanas"."campana_id"
       FROM "public"."perfil_campanas"
      WHERE ("perfil_campanas"."user_id" = ( SELECT "auth"."uid"() AS "uid"))))
    ELSE true
END);



CREATE POLICY "casos_update" ON "public"."casos" FOR UPDATE TO "authenticated" USING (
CASE ( SELECT "public"."get_user_role"(( SELECT "auth"."uid"() AS "uid")) AS "get_user_role")
    WHEN 'admin'::"text" THEN true
    WHEN 'agent'::"text" THEN (("agente_id" = ( SELECT "auth"."uid"() AS "uid")) AND (( SELECT "cat_estados"."es_final"
       FROM "public"."cat_estados"
      WHERE ("cat_estados"."id" = "casos"."estado_id")) = false))
    WHEN 'supervisor'::"text" THEN (("campana_id" IN ( SELECT "perfil_campanas"."campana_id"
       FROM "public"."perfil_campanas"
      WHERE ("perfil_campanas"."user_id" = ( SELECT "auth"."uid"() AS "uid")))) AND (( SELECT "cat_estados"."es_final"
       FROM "public"."cat_estados"
      WHERE ("cat_estados"."id" = "casos"."estado_id")) = false))
    ELSE false
END) WITH CHECK (
CASE ( SELECT "public"."get_user_role"(( SELECT "auth"."uid"() AS "uid")) AS "get_user_role")
    WHEN 'admin'::"text" THEN true
    WHEN 'agent'::"text" THEN ("agente_id" = ( SELECT "auth"."uid"() AS "uid"))
    WHEN 'supervisor'::"text" THEN ("campana_id" IN ( SELECT "perfil_campanas"."campana_id"
       FROM "public"."perfil_campanas"
      WHERE ("perfil_campanas"."user_id" = ( SELECT "auth"."uid"() AS "uid"))))
    ELSE false
END);



ALTER TABLE "public"."cat_agentes" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "cat_agentes_select" ON "public"."cat_agentes" FOR SELECT USING ((( SELECT "auth"."role"() AS "role") = 'authenticated'::"text"));



ALTER TABLE "public"."cat_estados" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "cat_estados_select" ON "public"."cat_estados" FOR SELECT USING ((( SELECT "auth"."role"() AS "role") = 'authenticated'::"text"));



ALTER TABLE "public"."cat_tipo_servicio" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "cat_tipo_servicio_select" ON "public"."cat_tipo_servicio" FOR SELECT USING ((( SELECT "auth"."role"() AS "role") = 'authenticated'::"text"));



ALTER TABLE "public"."clientes" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "clientes_insert" ON "public"."clientes" FOR INSERT TO "authenticated" WITH CHECK ((( SELECT "public"."get_user_role"(( SELECT "auth"."uid"() AS "uid")) AS "get_user_role") = ANY (ARRAY['admin'::"text", 'supervisor'::"text", 'agent'::"text"])));



CREATE POLICY "clientes_select_authenticated" ON "public"."clientes" FOR SELECT USING ((( SELECT "auth"."role"() AS "role") = 'authenticated'::"text"));



CREATE POLICY "clientes_update_authenticated" ON "public"."clientes" FOR UPDATE TO "authenticated" USING ((( SELECT "public"."get_user_role"(( SELECT "auth"."uid"() AS "uid")) AS "get_user_role") = ANY (ARRAY['admin'::"text", 'supervisor'::"text", 'agent'::"text"]))) WITH CHECK ((( SELECT "public"."get_user_role"(( SELECT "auth"."uid"() AS "uid")) AS "get_user_role") = ANY (ARRAY['admin'::"text", 'supervisor'::"text", 'agent'::"text"])));



CREATE POLICY "novedades_delete" ON "public"."schedule_novedades" FOR DELETE TO "authenticated" USING ((( SELECT "public"."get_user_role"(( SELECT "auth"."uid"() AS "uid")) AS "get_user_role") = ANY (ARRAY['admin'::"text", 'supervisor'::"text"])));



CREATE POLICY "novedades_insert" ON "public"."schedule_novedades" FOR INSERT TO "authenticated" WITH CHECK (((( SELECT "public"."get_user_role"(( SELECT "auth"."uid"() AS "uid")) AS "get_user_role") = ANY (ARRAY['admin'::"text", 'supervisor'::"text"])) OR ((( SELECT "public"."get_user_role"(( SELECT "auth"."uid"() AS "uid")) AS "get_user_role") = 'agent'::"text") AND ("agente_id" = ( SELECT "auth"."uid"() AS "uid")) AND ("estado" = 'pendiente'::"text"))));



CREATE POLICY "novedades_select" ON "public"."schedule_novedades" FOR SELECT TO "authenticated" USING (((( SELECT "public"."get_user_role"(( SELECT "auth"."uid"() AS "uid")) AS "get_user_role") = ANY (ARRAY['admin'::"text", 'supervisor'::"text", 'gerente'::"text"])) OR ((( SELECT "public"."get_user_role"(( SELECT "auth"."uid"() AS "uid")) AS "get_user_role") = 'agent'::"text") AND ("agente_id" = ( SELECT "auth"."uid"() AS "uid")))));



CREATE POLICY "novedades_update" ON "public"."schedule_novedades" FOR UPDATE TO "authenticated" USING ((( SELECT "public"."get_user_role"(( SELECT "auth"."uid"() AS "uid")) AS "get_user_role") = ANY (ARRAY['admin'::"text", 'supervisor'::"text"]))) WITH CHECK ((( SELECT "public"."get_user_role"(( SELECT "auth"."uid"() AS "uid")) AS "get_user_role") = ANY (ARRAY['admin'::"text", 'supervisor'::"text"])));



ALTER TABLE "public"."perfil_campanas" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "perfil_campanas_delete" ON "public"."perfil_campanas" FOR DELETE TO "authenticated" USING (( SELECT "public"."is_admin"(( SELECT "auth"."uid"() AS "uid")) AS "is_admin"));



CREATE POLICY "perfil_campanas_insert" ON "public"."perfil_campanas" FOR INSERT TO "authenticated" WITH CHECK (( SELECT "public"."is_admin"(( SELECT "auth"."uid"() AS "uid")) AS "is_admin"));



CREATE POLICY "perfil_campanas_select" ON "public"."perfil_campanas" FOR SELECT TO "authenticated" USING ((("user_id" = ( SELECT "auth"."uid"() AS "uid")) OR ( SELECT "public"."is_admin"(( SELECT "auth"."uid"() AS "uid")) AS "is_admin")));



ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "profiles_insert_admin" ON "public"."profiles" FOR INSERT TO "authenticated" WITH CHECK (( SELECT "public"."is_admin"(( SELECT "auth"."uid"() AS "uid")) AS "is_admin"));



CREATE POLICY "profiles_select" ON "public"."profiles" FOR SELECT TO "authenticated" USING ((("user_id" = ( SELECT "auth"."uid"() AS "uid")) OR ( SELECT "public"."is_admin"(( SELECT "auth"."uid"() AS "uid")) AS "is_admin")));



CREATE POLICY "profiles_update" ON "public"."profiles" FOR UPDATE TO "authenticated" USING ((("user_id" = ( SELECT "auth"."uid"() AS "uid")) OR ( SELECT "public"."is_admin"(( SELECT "auth"."uid"() AS "uid")) AS "is_admin"))) WITH CHECK ((("user_id" = ( SELECT "auth"."uid"() AS "uid")) OR ( SELECT "public"."is_admin"(( SELECT "auth"."uid"() AS "uid")) AS "is_admin")));



ALTER TABLE "public"."schedule_novedades" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."schedule_shifts" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."schedules" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "schedules_delete" ON "public"."schedules" FOR DELETE TO "authenticated" USING ((( SELECT "public"."get_user_role"(( SELECT "auth"."uid"() AS "uid")) AS "get_user_role") = ANY (ARRAY['admin'::"text", 'supervisor'::"text"])));



CREATE POLICY "schedules_insert" ON "public"."schedules" FOR INSERT TO "authenticated" WITH CHECK ((( SELECT "public"."get_user_role"(( SELECT "auth"."uid"() AS "uid")) AS "get_user_role") = ANY (ARRAY['admin'::"text", 'supervisor'::"text"])));



CREATE POLICY "schedules_select" ON "public"."schedules" FOR SELECT TO "authenticated" USING (((( SELECT "public"."get_user_role"(( SELECT "auth"."uid"() AS "uid")) AS "get_user_role") = ANY (ARRAY['admin'::"text", 'supervisor'::"text", 'gerente'::"text"])) OR ((( SELECT "public"."get_user_role"(( SELECT "auth"."uid"() AS "uid")) AS "get_user_role") = 'agent'::"text") AND ("estado" = 'publicado'::"text") AND ("campana_id" IN ( SELECT "perfil_campanas"."campana_id"
   FROM "public"."perfil_campanas"
  WHERE ("perfil_campanas"."user_id" = ( SELECT "auth"."uid"() AS "uid")))))));



CREATE POLICY "schedules_update" ON "public"."schedules" FOR UPDATE TO "authenticated" USING ((( SELECT "public"."get_user_role"(( SELECT "auth"."uid"() AS "uid")) AS "get_user_role") = ANY (ARRAY['admin'::"text", 'supervisor'::"text"]))) WITH CHECK ((( SELECT "public"."get_user_role"(( SELECT "auth"."uid"() AS "uid")) AS "get_user_role") = ANY (ARRAY['admin'::"text", 'supervisor'::"text"])));



ALTER TABLE "public"."shift_types" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "shift_types_delete" ON "public"."shift_types" FOR DELETE TO "authenticated" USING ((( SELECT "public"."get_user_role"(( SELECT "auth"."uid"() AS "uid")) AS "get_user_role") = ANY (ARRAY['admin'::"text", 'supervisor'::"text"])));



CREATE POLICY "shift_types_insert" ON "public"."shift_types" FOR INSERT TO "authenticated" WITH CHECK ((( SELECT "public"."get_user_role"(( SELECT "auth"."uid"() AS "uid")) AS "get_user_role") = ANY (ARRAY['admin'::"text", 'supervisor'::"text"])));



CREATE POLICY "shift_types_select" ON "public"."shift_types" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "shift_types_update" ON "public"."shift_types" FOR UPDATE TO "authenticated" USING ((( SELECT "public"."get_user_role"(( SELECT "auth"."uid"() AS "uid")) AS "get_user_role") = ANY (ARRAY['admin'::"text", 'supervisor'::"text"]))) WITH CHECK ((( SELECT "public"."get_user_role"(( SELECT "auth"."uid"() AS "uid")) AS "get_user_role") = ANY (ARRAY['admin'::"text", 'supervisor'::"text"])));



CREATE POLICY "shifts_delete" ON "public"."schedule_shifts" FOR DELETE TO "authenticated" USING ((( SELECT "public"."get_user_role"(( SELECT "auth"."uid"() AS "uid")) AS "get_user_role") = ANY (ARRAY['admin'::"text", 'supervisor'::"text"])));



CREATE POLICY "shifts_insert" ON "public"."schedule_shifts" FOR INSERT TO "authenticated" WITH CHECK ((( SELECT "public"."get_user_role"(( SELECT "auth"."uid"() AS "uid")) AS "get_user_role") = ANY (ARRAY['admin'::"text", 'supervisor'::"text"])));



CREATE POLICY "shifts_select" ON "public"."schedule_shifts" FOR SELECT TO "authenticated" USING (((( SELECT "public"."get_user_role"(( SELECT "auth"."uid"() AS "uid")) AS "get_user_role") = ANY (ARRAY['admin'::"text", 'supervisor'::"text", 'gerente'::"text"])) OR ((( SELECT "public"."get_user_role"(( SELECT "auth"."uid"() AS "uid")) AS "get_user_role") = 'agent'::"text") AND ("agente_id" = ( SELECT "auth"."uid"() AS "uid")))));



CREATE POLICY "shifts_update" ON "public"."schedule_shifts" FOR UPDATE TO "authenticated" USING ((( SELECT "public"."get_user_role"(( SELECT "auth"."uid"() AS "uid")) AS "get_user_role") = ANY (ARRAY['admin'::"text", 'supervisor'::"text"]))) WITH CHECK ((( SELECT "public"."get_user_role"(( SELECT "auth"."uid"() AS "uid")) AS "get_user_role") = ANY (ARRAY['admin'::"text", 'supervisor'::"text"])));



ALTER TABLE "public"."sla_config" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "sla_config_delete" ON "public"."sla_config" FOR DELETE TO "authenticated" USING (( SELECT "public"."is_admin"(( SELECT "auth"."uid"() AS "uid")) AS "is_admin"));



CREATE POLICY "sla_config_insert" ON "public"."sla_config" FOR INSERT TO "authenticated" WITH CHECK (( SELECT "public"."is_admin"(( SELECT "auth"."uid"() AS "uid")) AS "is_admin"));



CREATE POLICY "sla_config_select_authenticated" ON "public"."sla_config" FOR SELECT TO "authenticated" USING ((( SELECT "auth"."role"() AS "role") = 'authenticated'::"text"));



CREATE POLICY "sla_config_update" ON "public"."sla_config" FOR UPDATE TO "authenticated" USING (( SELECT "public"."is_admin"(( SELECT "auth"."uid"() AS "uid")) AS "is_admin")) WITH CHECK (( SELECT "public"."is_admin"(( SELECT "auth"."uid"() AS "uid")) AS "is_admin"));



ALTER TABLE "public"."staging_casos" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "staging_casos_admin_all" ON "public"."staging_casos" TO "authenticated" USING (( SELECT "public"."is_admin"(( SELECT "auth"."uid"() AS "uid")) AS "is_admin")) WITH CHECK (( SELECT "public"."is_admin"(( SELECT "auth"."uid"() AS "uid")) AS "is_admin"));



CREATE POLICY "ura_delete_admin" ON "public"."user_role_assignments" FOR DELETE TO "authenticated" USING (( SELECT "public"."is_admin"(( SELECT "auth"."uid"() AS "uid")) AS "is_admin"));



CREATE POLICY "ura_insert_admin" ON "public"."user_role_assignments" FOR INSERT TO "authenticated" WITH CHECK (( SELECT "public"."is_admin"(( SELECT "auth"."uid"() AS "uid")) AS "is_admin"));



CREATE POLICY "ura_select" ON "public"."user_role_assignments" FOR SELECT TO "authenticated" USING ((("user_id" = ( SELECT "auth"."uid"() AS "uid")) OR ( SELECT "public"."is_admin"(( SELECT "auth"."uid"() AS "uid")) AS "is_admin")));



CREATE POLICY "ura_update_admin" ON "public"."user_role_assignments" FOR UPDATE TO "authenticated" USING (( SELECT "public"."is_admin"(( SELECT "auth"."uid"() AS "uid")) AS "is_admin")) WITH CHECK (( SELECT "public"."is_admin"(( SELECT "auth"."uid"() AS "uid")) AS "is_admin"));



ALTER TABLE "public"."user_role_assignments" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_roles" ENABLE ROW LEVEL SECURITY;


GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";



REVOKE ALL ON FUNCTION "public"."_copy_previous_week_shifts_impl"("_dest_schedule_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."_copy_previous_week_shifts_impl"("_dest_schedule_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."_generate_schedule_impl"("_schedule_id" "uuid", "_hora_inicio" time without time zone, "_hora_fin" time without time zone, "_dia_libre_base" integer, "_duracion_almuerzo" integer, "_skip_existing" boolean) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."_generate_schedule_impl"("_schedule_id" "uuid", "_hora_inicio" time without time zone, "_hora_fin" time without time zone, "_dia_libre_base" integer, "_duracion_almuerzo" integer, "_skip_existing" boolean) TO "service_role";



REVOKE ALL ON FUNCTION "public"."_generate_schedule_impl"("_schedule_id" "uuid", "_hora_inicio" time without time zone, "_hora_fin" time without time zone, "_dia_libre_base" integer, "_duracion_almuerzo" integer, "_skip_existing" boolean, "_tipo_actividad" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."_generate_schedule_impl"("_schedule_id" "uuid", "_hora_inicio" time without time zone, "_hora_fin" time without time zone, "_dia_libre_base" integer, "_duracion_almuerzo" integer, "_skip_existing" boolean, "_tipo_actividad" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."assert_schedule_manager"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."assert_schedule_manager"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."assign_cases"("p_campana_id" "uuid", "p_caso_ids" integer[], "p_agente_ids" "uuid"[]) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."assign_cases"("p_campana_id" "uuid", "p_caso_ids" integer[], "p_agente_ids" "uuid"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."assign_cases"("p_campana_id" "uuid", "p_caso_ids" integer[], "p_agente_ids" "uuid"[]) TO "service_role";



REVOKE ALL ON FUNCTION "public"."assignment_candidates"("p_campana_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."assignment_candidates"("p_campana_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."assignment_candidates"("p_campana_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."calc_duracion_novedad"() TO "anon";
GRANT ALL ON FUNCTION "public"."calc_duracion_novedad"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."calc_duracion_novedad"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."copy_previous_week_shifts"("_dest_schedule_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."copy_previous_week_shifts"("_dest_schedule_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."copy_previous_week_shifts"("_dest_schedule_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."create_case_with_client"("p_campana_id" "uuid", "p_tipo_servicio_id" integer, "p_descripcion" "text", "p_cliente_id" integer, "p_cliente" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."create_case_with_client"("p_campana_id" "uuid", "p_tipo_servicio_id" integer, "p_descripcion" "text", "p_cliente_id" integer, "p_cliente" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_case_with_client"("p_campana_id" "uuid", "p_tipo_servicio_id" integer, "p_descripcion" "text", "p_cliente_id" integer, "p_cliente" "jsonb") TO "service_role";



REVOKE ALL ON FUNCTION "public"."dashboard_agent_stats"("p_campana_ids" "uuid"[]) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."dashboard_agent_stats"("p_campana_ids" "uuid"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."dashboard_agent_stats"("p_campana_ids" "uuid"[]) TO "service_role";



REVOKE ALL ON FUNCTION "public"."dashboard_stats"("p_campana_ids" "uuid"[], "p_tz" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."dashboard_stats"("p_campana_ids" "uuid"[], "p_tz" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."dashboard_stats"("p_campana_ids" "uuid"[], "p_tz" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."financial_summary"("p_campana_id" "uuid", "p_desde" timestamp with time zone, "p_hasta" timestamp with time zone, "p_periodo" "text", "p_tz" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."financial_summary"("p_campana_id" "uuid", "p_desde" timestamp with time zone, "p_hasta" timestamp with time zone, "p_periodo" "text", "p_tz" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."financial_summary"("p_campana_id" "uuid", "p_desde" timestamp with time zone, "p_hasta" timestamp with time zone, "p_periodo" "text", "p_tz" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."generate_schedule"("_schedule_id" "uuid", "_hora_inicio" time without time zone, "_hora_fin" time without time zone, "_dia_libre_base" integer, "_duracion_almuerzo" integer, "_skip_existing" boolean) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."generate_schedule"("_schedule_id" "uuid", "_hora_inicio" time without time zone, "_hora_fin" time without time zone, "_dia_libre_base" integer, "_duracion_almuerzo" integer, "_skip_existing" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."generate_schedule"("_schedule_id" "uuid", "_hora_inicio" time without time zone, "_hora_fin" time without time zone, "_dia_libre_base" integer, "_duracion_almuerzo" integer, "_skip_existing" boolean) TO "service_role";



REVOKE ALL ON FUNCTION "public"."generate_schedule"("_schedule_id" "uuid", "_hora_inicio" time without time zone, "_hora_fin" time without time zone, "_dia_libre_base" integer, "_duracion_almuerzo" integer, "_skip_existing" boolean, "_tipo_actividad" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."generate_schedule"("_schedule_id" "uuid", "_hora_inicio" time without time zone, "_hora_fin" time without time zone, "_dia_libre_base" integer, "_duracion_almuerzo" integer, "_skip_existing" boolean, "_tipo_actividad" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."generate_schedule"("_schedule_id" "uuid", "_hora_inicio" time without time zone, "_hora_fin" time without time zone, "_dia_libre_base" integer, "_duracion_almuerzo" integer, "_skip_existing" boolean, "_tipo_actividad" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."get_agentes_by_campana"("_campana_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_agentes_by_campana"("_campana_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_agentes_by_campana"("_campana_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_casos_counts"("p_campana_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_casos_counts"("p_campana_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_casos_counts"("p_campana_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."get_user_role"("_user_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_user_role"("_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_user_role"("_user_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."is_admin"("_user_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."is_admin"("_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_admin"("_user_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."log_activity"("p_action" "text", "p_entity" "text", "p_entity_id" "text", "p_details" "jsonb", "p_campana_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."log_activity"("p_action" "text", "p_entity" "text", "p_entity_id" "text", "p_details" "jsonb", "p_campana_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."log_activity"("p_action" "text", "p_entity" "text", "p_entity_id" "text", "p_details" "jsonb", "p_campana_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."parse_monto_cop"("p" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."parse_monto_cop"("p" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."parse_monto_cop"("p" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."process_staging_casos"("p_campana_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."process_staging_casos"("p_campana_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."process_staging_casos"("p_campana_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."protect_profile_privileged_columns"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."protect_profile_privileged_columns"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."reset_schedule_shifts"("_schedule_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."reset_schedule_shifts"("_schedule_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."reset_schedule_shifts"("_schedule_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."rol_prioridad"("p_nombre" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."rol_prioridad"("p_nombre" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."rol_prioridad"("p_nombre" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."set_schedule_creado_por"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."set_schedule_creado_por"() TO "service_role";



GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."set_user_roles"("p_user_id" "uuid", "p_role_ids" integer[]) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."set_user_roles"("p_user_id" "uuid", "p_role_ids" integer[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_user_roles"("p_user_id" "uuid", "p_role_ids" integer[]) TO "service_role";



REVOKE ALL ON FUNCTION "public"."sla_vigente"("p_campana_ids" "uuid"[]) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."sla_vigente"("p_campana_ids" "uuid"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."sla_vigente"("p_campana_ids" "uuid"[]) TO "service_role";



REVOKE ALL ON FUNCTION "public"."supervisor_de_campana"("p_campana_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."supervisor_de_campana"("p_campana_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."sync_profile_role"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."sync_profile_role"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."transfer_case"("p_caso_id" integer, "p_campana_destino" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."transfer_case"("p_caso_id" integer, "p_campana_destino" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."transfer_case"("p_caso_id" integer, "p_campana_destino" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."trg_casos_activity"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."trg_casos_activity"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."trg_clientes_activity"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."trg_clientes_activity"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."unpublish_schedule"("_schedule_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."unpublish_schedule"("_schedule_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."unpublish_schedule"("_schedule_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."update_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_updated_at"() TO "service_role";



GRANT ALL ON TABLE "archivo"."perfiles" TO "anon";
GRANT ALL ON TABLE "archivo"."perfiles" TO "authenticated";
GRANT ALL ON TABLE "archivo"."perfiles" TO "service_role";



GRANT ALL ON TABLE "public"."activity_log" TO "anon";
GRANT ALL ON TABLE "public"."activity_log" TO "authenticated";
GRANT ALL ON TABLE "public"."activity_log" TO "service_role";



GRANT ALL ON TABLE "public"."campanas" TO "anon";
GRANT ALL ON TABLE "public"."campanas" TO "authenticated";
GRANT ALL ON TABLE "public"."campanas" TO "service_role";



GRANT ALL ON TABLE "public"."caso_historial" TO "anon";
GRANT ALL ON TABLE "public"."caso_historial" TO "authenticated";
GRANT ALL ON TABLE "public"."caso_historial" TO "service_role";



GRANT ALL ON SEQUENCE "public"."caso_historial_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."caso_historial_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."caso_historial_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."casos" TO "anon";
GRANT ALL ON TABLE "public"."casos" TO "authenticated";
GRANT ALL ON TABLE "public"."casos" TO "service_role";



GRANT ALL ON SEQUENCE "public"."casos_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."casos_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."casos_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."cat_agentes" TO "anon";
GRANT ALL ON TABLE "public"."cat_agentes" TO "authenticated";
GRANT ALL ON TABLE "public"."cat_agentes" TO "service_role";



GRANT ALL ON TABLE "public"."cat_estados" TO "anon";
GRANT ALL ON TABLE "public"."cat_estados" TO "authenticated";
GRANT ALL ON TABLE "public"."cat_estados" TO "service_role";



GRANT ALL ON SEQUENCE "public"."cat_estados_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."cat_estados_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."cat_estados_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."cat_tipo_servicio" TO "anon";
GRANT ALL ON TABLE "public"."cat_tipo_servicio" TO "authenticated";
GRANT ALL ON TABLE "public"."cat_tipo_servicio" TO "service_role";



GRANT ALL ON SEQUENCE "public"."cat_tipo_servicio_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."cat_tipo_servicio_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."cat_tipo_servicio_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."clientes" TO "anon";
GRANT ALL ON TABLE "public"."clientes" TO "authenticated";
GRANT ALL ON TABLE "public"."clientes" TO "service_role";



GRANT ALL ON SEQUENCE "public"."clientes_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."clientes_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."clientes_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."perfil_campanas" TO "anon";
GRANT ALL ON TABLE "public"."perfil_campanas" TO "authenticated";
GRANT ALL ON TABLE "public"."perfil_campanas" TO "service_role";



GRANT ALL ON TABLE "public"."profiles" TO "anon";
GRANT ALL ON TABLE "public"."profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."profiles" TO "service_role";



GRANT ALL ON TABLE "public"."schedule_novedades" TO "anon";
GRANT ALL ON TABLE "public"."schedule_novedades" TO "authenticated";
GRANT ALL ON TABLE "public"."schedule_novedades" TO "service_role";



GRANT ALL ON TABLE "public"."schedule_shifts" TO "anon";
GRANT ALL ON TABLE "public"."schedule_shifts" TO "authenticated";
GRANT ALL ON TABLE "public"."schedule_shifts" TO "service_role";



GRANT ALL ON TABLE "public"."schedules" TO "anon";
GRANT ALL ON TABLE "public"."schedules" TO "authenticated";
GRANT ALL ON TABLE "public"."schedules" TO "service_role";



GRANT ALL ON TABLE "public"."shift_types" TO "anon";
GRANT ALL ON TABLE "public"."shift_types" TO "authenticated";
GRANT ALL ON TABLE "public"."shift_types" TO "service_role";



GRANT ALL ON SEQUENCE "public"."shift_types_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."shift_types_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."shift_types_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."sla_config" TO "anon";
GRANT ALL ON TABLE "public"."sla_config" TO "authenticated";
GRANT ALL ON TABLE "public"."sla_config" TO "service_role";



GRANT ALL ON SEQUENCE "public"."sla_config_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."sla_config_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."sla_config_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."staging_casos" TO "anon";
GRANT ALL ON TABLE "public"."staging_casos" TO "authenticated";
GRANT ALL ON TABLE "public"."staging_casos" TO "service_role";



GRANT ALL ON SEQUENCE "public"."staging_casos_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."staging_casos_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."staging_casos_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."user_role_assignments" TO "anon";
GRANT ALL ON TABLE "public"."user_role_assignments" TO "authenticated";
GRANT ALL ON TABLE "public"."user_role_assignments" TO "service_role";



GRANT ALL ON SEQUENCE "public"."user_role_assignments_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."user_role_assignments_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."user_role_assignments_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."user_roles" TO "anon";
GRANT ALL ON TABLE "public"."user_roles" TO "authenticated";
GRANT ALL ON TABLE "public"."user_roles" TO "service_role";



GRANT ALL ON SEQUENCE "public"."user_roles_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."user_roles_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."user_roles_id_seq" TO "service_role";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";









-- ------------------------------------------------------------
-- Permisos de ejecución de funciones, iguales a producción.
-- pg_dump no incluye las revocaciones y Supabase concede EXECUTE a anon y
-- authenticated por defecto sobre cada función nueva: sin este bloque, una
-- base reconstruida dejaría las funciones privilegiadas abiertas a anon.
-- Generado desde has_function_privilege() en producción.
-- ------------------------------------------------------------
REVOKE ALL ON FUNCTION public._copy_previous_week_shifts_impl(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._generate_schedule_impl(uuid,time without time zone,time without time zone,integer,integer,boolean,text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._generate_schedule_impl(uuid,time without time zone,time without time zone,integer,integer,boolean) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.assert_schedule_manager() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.assign_cases(uuid,integer[],uuid[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.assign_cases(uuid,integer[],uuid[]) TO authenticated;
REVOKE ALL ON FUNCTION public.assignment_candidates(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.assignment_candidates(uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.calc_duracion_novedad() FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.calc_duracion_novedad() TO authenticated, anon;
REVOKE ALL ON FUNCTION public.copy_previous_week_shifts(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.copy_previous_week_shifts(uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.create_case_with_client(uuid,integer,text,integer,jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_case_with_client(uuid,integer,text,integer,jsonb) TO authenticated;
REVOKE ALL ON FUNCTION public.dashboard_agent_stats(uuid[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.dashboard_agent_stats(uuid[]) TO authenticated;
REVOKE ALL ON FUNCTION public.dashboard_stats(uuid[],text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.dashboard_stats(uuid[],text) TO authenticated;
REVOKE ALL ON FUNCTION public.financial_summary(uuid,timestamp with time zone,timestamp with time zone,text,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.financial_summary(uuid,timestamp with time zone,timestamp with time zone,text,text) TO authenticated;
REVOKE ALL ON FUNCTION public.generate_schedule(uuid,time without time zone,time without time zone,integer,integer,boolean,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.generate_schedule(uuid,time without time zone,time without time zone,integer,integer,boolean,text) TO authenticated;
REVOKE ALL ON FUNCTION public.generate_schedule(uuid,time without time zone,time without time zone,integer,integer,boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.generate_schedule(uuid,time without time zone,time without time zone,integer,integer,boolean) TO authenticated;
REVOKE ALL ON FUNCTION public.get_agentes_by_campana(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_agentes_by_campana(uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.get_casos_counts(uuid) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_casos_counts(uuid) TO authenticated, anon;
REVOKE ALL ON FUNCTION public.get_user_role(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_role(uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.is_admin(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin(uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.log_activity(text,text,text,jsonb,uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.log_activity(text,text,text,jsonb,uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.parse_monto_cop(text) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.parse_monto_cop(text) TO authenticated, anon;
REVOKE ALL ON FUNCTION public.process_staging_casos(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.process_staging_casos(uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.protect_profile_privileged_columns() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.reset_schedule_shifts(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reset_schedule_shifts(uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.rol_prioridad(text) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rol_prioridad(text) TO authenticated, anon;
REVOKE ALL ON FUNCTION public.set_schedule_creado_por() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.set_updated_at() FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.set_updated_at() TO authenticated, anon;
REVOKE ALL ON FUNCTION public.set_user_roles(uuid,integer[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.set_user_roles(uuid,integer[]) TO authenticated;
REVOKE ALL ON FUNCTION public.sla_vigente(uuid[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sla_vigente(uuid[]) TO authenticated;
REVOKE ALL ON FUNCTION public.supervisor_de_campana(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.sync_profile_role() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.transfer_case(integer,uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.transfer_case(integer,uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.trg_casos_activity() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.trg_clientes_activity() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.unpublish_schedule(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.unpublish_schedule(uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.update_updated_at() FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.update_updated_at() TO authenticated, anon;
