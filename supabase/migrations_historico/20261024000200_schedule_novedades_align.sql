-- ============================================================
-- MÓDULO HORARIOS — Alinear schedule_novedades con el frontend
-- Fecha: 2026-10-24
--
-- En producción la tabla quedó con otro diseño (fecha_inicio/fecha_fin,
-- hora_inicio/hora_fin) y la migración 20260319220000 nunca se aplicó,
-- así que el frontend (fecha, es_dia_completo, hora_*_novedad) fallaba
-- al crear y listar novedades. La tabla está vacía y ninguna función
-- usa esas columnas, por lo que el cambio no afecta datos.
-- ============================================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.schedule_novedades) THEN
    RAISE EXCEPTION 'schedule_novedades tiene datos: revisar la migración antes de aplicarla';
  END IF;
END $$;

-- ------------------------------------------------------------
-- 1. Columnas
-- ------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
              WHERE table_schema = 'public' AND table_name = 'schedule_novedades'
                AND column_name = 'fecha_inicio') THEN
    ALTER TABLE public.schedule_novedades RENAME COLUMN fecha_inicio TO fecha;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns
              WHERE table_schema = 'public' AND table_name = 'schedule_novedades'
                AND column_name = 'hora_inicio') THEN
    ALTER TABLE public.schedule_novedades RENAME COLUMN hora_inicio TO hora_inicio_novedad;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns
              WHERE table_schema = 'public' AND table_name = 'schedule_novedades'
                AND column_name = 'hora_fin') THEN
    ALTER TABLE public.schedule_novedades RENAME COLUMN hora_fin TO hora_fin_novedad;
  END IF;
END $$;

ALTER TABLE public.schedule_novedades DROP COLUMN IF EXISTS fecha_fin;

ALTER TABLE public.schedule_novedades
  ADD COLUMN IF NOT EXISTS hora_inicio_novedad TIME    DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS hora_fin_novedad    TIME    DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS duracion_minutos    INT     DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS es_dia_completo     BOOLEAN NOT NULL DEFAULT true;

-- ------------------------------------------------------------
-- 2. Constraints (incluye el tipo permiso_horas)
-- ------------------------------------------------------------
ALTER TABLE public.schedule_novedades
  DROP CONSTRAINT IF EXISTS schedule_novedades_tipo_novedad_check;
ALTER TABLE public.schedule_novedades
  ADD CONSTRAINT schedule_novedades_tipo_novedad_check
  CHECK (tipo_novedad IN (
    'incapacidad', 'permiso_remunerado', 'permiso_no_remunerado', 'permiso_horas',
    'vacaciones', 'calamidad', 'cambio_turno', 'otro'
  ));

ALTER TABLE public.schedule_novedades
  DROP CONSTRAINT IF EXISTS chk_novedad_horas_consistencia;
ALTER TABLE public.schedule_novedades
  ADD CONSTRAINT chk_novedad_horas_consistencia CHECK (
    es_dia_completo = true
    OR (
      hora_inicio_novedad IS NOT NULL
      AND hora_fin_novedad IS NOT NULL
      AND hora_fin_novedad > hora_inicio_novedad
      AND (duracion_minutos IS NULL OR duracion_minutos % 15 = 0)
    )
  );

-- El panel de aprobaciones hace join con profiles por esta FK
-- (profiles!schedule_novedades_agente_id_fkey), igual que schedule_shifts.
ALTER TABLE public.schedule_novedades
  DROP CONSTRAINT IF EXISTS schedule_novedades_agente_id_fkey;
ALTER TABLE public.schedule_novedades
  ADD CONSTRAINT schedule_novedades_agente_id_fkey
  FOREIGN KEY (agente_id) REFERENCES public.profiles(user_id);

-- ------------------------------------------------------------
-- 3. duracion_minutos calculada automáticamente
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.calc_duracion_novedad()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
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

DROP TRIGGER IF EXISTS trg_calc_duracion_novedad ON public.schedule_novedades;
CREATE TRIGGER trg_calc_duracion_novedad
  BEFORE INSERT OR UPDATE ON public.schedule_novedades
  FOR EACH ROW EXECUTE FUNCTION public.calc_duracion_novedad();

-- ------------------------------------------------------------
-- 4. Índices
-- ------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_novedades_estado
  ON public.schedule_novedades (estado, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_novedades_agente_fecha
  ON public.schedule_novedades (agente_id, fecha);
