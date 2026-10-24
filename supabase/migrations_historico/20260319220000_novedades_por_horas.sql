-- ============================================================
-- MÓDULO HORARIOS — Fase 1: Novedades por horas
-- Fecha: 2026-03-19
-- Extiende schedule_novedades para soportar:
--   1. Novedades parciales (por horas, en bloques de 15 min)
--   2. Novedades de día completo (comportamiento previo)
--   3. Tipo "permiso_horas" en el enum
-- ============================================================

-- ------------------------------------------------------------
-- 1. Nuevas columnas en schedule_novedades
--    hora_inicio_novedad / hora_fin_novedad: NULL = día completo
--    duracion_minutos: calculado o ingresado, múltiplo de 15
-- ------------------------------------------------------------
ALTER TABLE public.schedule_novedades
  ADD COLUMN IF NOT EXISTS hora_inicio_novedad TIME    DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS hora_fin_novedad    TIME    DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS duracion_minutos    INT     DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS es_dia_completo     BOOLEAN NOT NULL DEFAULT true;

COMMENT ON COLUMN public.schedule_novedades.hora_inicio_novedad IS
  'Hora inicio del bloque de permiso parcial. NULL si es día completo.';
COMMENT ON COLUMN public.schedule_novedades.hora_fin_novedad IS
  'Hora fin del bloque de permiso parcial. NULL si es día completo.';
COMMENT ON COLUMN public.schedule_novedades.duracion_minutos IS
  'Duración calculada en minutos. Siempre múltiplo de 15.';
COMMENT ON COLUMN public.schedule_novedades.es_dia_completo IS
  'true = bloquea el día entero; false = permiso parcial por horas.';

-- ------------------------------------------------------------
-- 2. Ampliar el CHECK de tipo_novedad para incluir permiso_horas
-- ------------------------------------------------------------
ALTER TABLE public.schedule_novedades
  DROP CONSTRAINT IF EXISTS schedule_novedades_tipo_novedad_check;

ALTER TABLE public.schedule_novedades
  ADD CONSTRAINT schedule_novedades_tipo_novedad_check
  CHECK (tipo_novedad IN (
    'incapacidad',
    'permiso_remunerado',
    'permiso_no_remunerado',
    'permiso_horas',
    'vacaciones',
    'calamidad',
    'cambio_turno',
    'otro'
  ));

-- ------------------------------------------------------------
-- 3. Constraint: si es_dia_completo=false → horas requeridas
--    y duracion debe ser múltiplo de 15
-- ------------------------------------------------------------
ALTER TABLE public.schedule_novedades
  DROP CONSTRAINT IF EXISTS chk_novedad_horas_consistencia;

ALTER TABLE public.schedule_novedades
  ADD CONSTRAINT chk_novedad_horas_consistencia CHECK (
    (es_dia_completo = true)
    OR (
      es_dia_completo = false
      AND hora_inicio_novedad IS NOT NULL
      AND hora_fin_novedad    IS NOT NULL
      AND hora_fin_novedad > hora_inicio_novedad
      AND (duracion_minutos IS NULL OR duracion_minutos % 15 = 0)
    )
  );

-- ------------------------------------------------------------
-- 4. Constraint: duracion_minutos se auto-calcula si es parcial
--    (trigger para calcular automáticamente al INSERT/UPDATE)
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.calc_duracion_novedad()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.es_dia_completo = false
     AND NEW.hora_inicio_novedad IS NOT NULL
     AND NEW.hora_fin_novedad    IS NOT NULL
  THEN
    -- Calcular minutos y redondear al múltiplo de 15 más cercano
    NEW.duracion_minutos :=
      ROUND(
        EXTRACT(EPOCH FROM (NEW.hora_fin_novedad - NEW.hora_inicio_novedad)) / 60 / 15
      ) * 15;
  ELSE
    NEW.duracion_minutos := NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_calc_duracion_novedad ON public.schedule_novedades;
CREATE TRIGGER trg_calc_duracion_novedad
  BEFORE INSERT OR UPDATE ON public.schedule_novedades
  FOR EACH ROW EXECUTE FUNCTION public.calc_duracion_novedad();

-- ------------------------------------------------------------
-- 5. Actualizar política INSERT del agente:
--    También puede crear novedades parciales (permiso_horas)
--    Estado siempre forzado a 'pendiente'
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "novedades_insert_own_agent" ON public.schedule_novedades;

CREATE POLICY "novedades_insert_own_agent"
  ON public.schedule_novedades FOR INSERT TO authenticated
  WITH CHECK (
    get_user_role(auth.uid()) = 'agent'
    AND agente_id = auth.uid()
    AND estado = 'pendiente'
  );

-- ------------------------------------------------------------
-- 6. Índice para consultas de novedades por estado (panel de aprobaciones)
-- ------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_novedades_estado
  ON public.schedule_novedades(estado, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_novedades_agente_fecha
  ON public.schedule_novedades(agente_id, fecha);
