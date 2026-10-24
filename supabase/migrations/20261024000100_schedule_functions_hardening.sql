-- ============================================================
-- MÓDULO HORARIOS — Control de rol en funciones SECURITY DEFINER
-- Fecha: 2026-10-24
--
-- generate_schedule (dos sobrecargas en producción) y
-- copy_previous_week_shifts son SECURITY DEFINER y no verificaban
-- el rol: cualquier usuario autenticado podía reescribir los turnos
-- de una semana en borrador. Se renombra cada implementación y se
-- expone un wrapper con la misma firma que exige admin o supervisor.
-- (reset_schedule_shifts y unpublish_schedule ya verifican el rol.)
-- ============================================================

CREATE OR REPLACE FUNCTION public.assert_schedule_manager()
RETURNS void
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- COALESCE: sin perfil get_user_role da NULL y NOT IN no lo atraparía
  IF COALESCE(public.get_user_role(auth.uid()), '') NOT IN ('admin', 'supervisor') THEN
    RAISE EXCEPTION 'No tienes permisos para realizar esta acción'
      USING ERRCODE = '42501';
  END IF;
END;
$$;

DO $$
BEGIN
  IF to_regprocedure('public._generate_schedule_impl(uuid,time,time,integer,integer,boolean,text)') IS NULL THEN
    ALTER FUNCTION public.generate_schedule(uuid, time, time, integer, integer, boolean, text)
      RENAME TO _generate_schedule_impl;
  END IF;
  IF to_regprocedure('public._generate_schedule_impl(uuid,time,time,integer,integer,boolean)') IS NULL THEN
    ALTER FUNCTION public.generate_schedule(uuid, time, time, integer, integer, boolean)
      RENAME TO _generate_schedule_impl;
  END IF;
  IF to_regprocedure('public._copy_previous_week_shifts_impl(uuid)') IS NULL THEN
    ALTER FUNCTION public.copy_previous_week_shifts(uuid)
      RENAME TO _copy_previous_week_shifts_impl;
  END IF;
END $$;

REVOKE EXECUTE ON FUNCTION public._generate_schedule_impl(uuid, time, time, integer, integer, boolean, text)
  FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public._generate_schedule_impl(uuid, time, time, integer, integer, boolean)
  FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public._copy_previous_week_shifts_impl(uuid)
  FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.generate_schedule(
  _schedule_id       uuid,
  _hora_inicio       time    DEFAULT '07:00:00',
  _hora_fin          time    DEFAULT '18:00:00',
  _dia_libre_base    integer DEFAULT 6,
  _duracion_almuerzo integer DEFAULT 60,
  _skip_existing     boolean DEFAULT true,
  _tipo_actividad    text    DEFAULT 'Tele'
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.assert_schedule_manager();
  RETURN public._generate_schedule_impl(
    _schedule_id, _hora_inicio, _hora_fin, _dia_libre_base,
    _duracion_almuerzo, _skip_existing, _tipo_actividad
  );
END;
$$;

-- Sobrecarga de 6 parámetros: se conserva por compatibilidad, sin
-- defaults para no generar ambigüedad con la de 7.
CREATE OR REPLACE FUNCTION public.generate_schedule(
  _schedule_id       uuid,
  _hora_inicio       time,
  _hora_fin          time,
  _dia_libre_base    integer,
  _duracion_almuerzo integer,
  _skip_existing     boolean
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.assert_schedule_manager();
  RETURN public._generate_schedule_impl(
    _schedule_id, _hora_inicio, _hora_fin, _dia_libre_base,
    _duracion_almuerzo, _skip_existing
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.copy_previous_week_shifts(_dest_schedule_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.assert_schedule_manager();
  RETURN public._copy_previous_week_shifts_impl(_dest_schedule_id);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.generate_schedule(uuid, time, time, integer, integer, boolean, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.generate_schedule(uuid, time, time, integer, integer, boolean)       FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.copy_previous_week_shifts(uuid)                                      FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.generate_schedule(uuid, time, time, integer, integer, boolean, text) TO authenticated;
GRANT  EXECUTE ON FUNCTION public.generate_schedule(uuid, time, time, integer, integer, boolean)       TO authenticated;
GRANT  EXECUTE ON FUNCTION public.copy_previous_week_shifts(uuid)                                      TO authenticated;
