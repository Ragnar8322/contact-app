-- ============================================================
-- MÓDULO HORARIOS — Fase 1: Estructura de tablas
-- Fecha: 2026-03-18
-- IMPORTANTE: Solo crea tablas nuevas. No modifica ninguna tabla existente.
-- ============================================================

-- ------------------------------------------------------------
-- 1. shift_types — Tipos de turno (GAP, Tele, Calidad, etc.)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.shift_types (
  id          SERIAL PRIMARY KEY,
  campana_id  UUID NOT NULL REFERENCES public.campanas(id) ON DELETE CASCADE,
  nombre      TEXT NOT NULL,
  hora_inicio TIME NOT NULL,         -- ej: 07:30
  hora_fin    TIME NOT NULL,         -- ej: 16:00
  color       TEXT DEFAULT '#6366f1', -- color hex para la UI
  activo      BOOLEAN DEFAULT true,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE public.shift_types IS
  'Tipos de turno configurables por campaña (ej: Turno 8h, Turno 4h Sábado).';

-- ------------------------------------------------------------
-- 2. schedules — Semanas programadas por campaña
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.schedules (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campana_id   UUID NOT NULL REFERENCES public.campanas(id) ON DELETE CASCADE,
  semana_inicio DATE NOT NULL,   -- lunes de la semana (ISO: 2026-03-17)
  semana_fin    DATE NOT NULL,   -- domingo de la semana (ISO: 2026-03-22)
  estado        TEXT NOT NULL DEFAULT 'borrador'
                  CHECK (estado IN ('borrador', 'publicado')),
  creado_por    UUID REFERENCES auth.users(id),
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (campana_id, semana_inicio)
);

COMMENT ON TABLE public.schedules IS
  'Una fila por semana × campaña. Estado borrador/publicado.';

-- ------------------------------------------------------------
-- 3. schedule_shifts — Turno asignado por agente × día
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.schedule_shifts (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_id     UUID NOT NULL REFERENCES public.schedules(id) ON DELETE CASCADE,
  agente_id       UUID NOT NULL REFERENCES auth.users(id),
  fecha           DATE NOT NULL,               -- día exacto (2026-03-18)
  shift_type_id   INT REFERENCES public.shift_types(id),
  hora_inicio     TIME,                        -- permite override del tipo
  hora_fin        TIME,
  hora_almuerzo   TIME,                        -- hora inicio almuerzo
  duracion_almuerzo INT DEFAULT 45,           -- minutos
  tipo_actividad  TEXT DEFAULT 'GAP'
                    CHECK (tipo_actividad IN (
                      'GAP','Tele','Calidad','Apoyo','VIP',
                      'Descanso','Vacaciones','Incapacidad','No_aplica'
                    )),
  horas_dia       NUMERIC(4,2),               -- horas trabajadas ese día
  observacion     TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (schedule_id, agente_id, fecha)
);

COMMENT ON TABLE public.schedule_shifts IS
  'Un registro por agente × día dentro de una semana programada.';

-- ------------------------------------------------------------
-- 4. schedule_novedades — Ausencias, permisos, cambios
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.schedule_novedades (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_id     UUID NOT NULL REFERENCES public.schedules(id) ON DELETE CASCADE,
  agente_id       UUID NOT NULL REFERENCES auth.users(id),
  fecha           DATE NOT NULL,
  tipo_novedad    TEXT NOT NULL
                    CHECK (tipo_novedad IN (
                      'incapacidad','permiso_remunerado','permiso_no_remunerado',
                      'vacaciones','calamidad','cambio_turno','otro'
                    )),
  descripcion     TEXT,
  estado          TEXT NOT NULL DEFAULT 'pendiente'
                    CHECK (estado IN ('pendiente','aprobado','rechazado')),
  revisado_por    UUID REFERENCES auth.users(id),
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE public.schedule_novedades IS
  'Novedades y ausentismos por agente × día.';

-- ------------------------------------------------------------
-- 5. Índices para rendimiento
-- ------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_schedules_campana_semana
  ON public.schedules(campana_id, semana_inicio);

CREATE INDEX IF NOT EXISTS idx_shifts_schedule_agente
  ON public.schedule_shifts(schedule_id, agente_id);

CREATE INDEX IF NOT EXISTS idx_shifts_agente_fecha
  ON public.schedule_shifts(agente_id, fecha);

CREATE INDEX IF NOT EXISTS idx_novedades_schedule
  ON public.schedule_novedades(schedule_id, agente_id);

-- ------------------------------------------------------------
-- 6. Trigger updated_at automático
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_schedules_updated_at
  BEFORE UPDATE ON public.schedules
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_shifts_updated_at
  BEFORE UPDATE ON public.schedule_shifts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_novedades_updated_at
  BEFORE UPDATE ON public.schedule_novedades
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ------------------------------------------------------------
-- 7. Row Level Security
-- ------------------------------------------------------------
ALTER TABLE public.shift_types        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.schedules          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.schedule_shifts    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.schedule_novedades ENABLE ROW LEVEL SECURITY;

-- shift_types: lectura para autenticados, escritura solo admin/supervisor/gerente
CREATE POLICY "shift_types_select"
  ON public.shift_types FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "shift_types_write"
  ON public.shift_types FOR ALL TO authenticated
  USING (get_user_role(auth.uid()) IN ('admin','supervisor','gerente'))
  WITH CHECK (get_user_role(auth.uid()) IN ('admin','supervisor','gerente'));

-- schedules: admin/supervisor/gerente ven todo; agent NO accede
CREATE POLICY "schedules_select_managers"
  ON public.schedules FOR SELECT TO authenticated
  USING (get_user_role(auth.uid()) IN ('admin','supervisor','gerente'));

CREATE POLICY "schedules_write_managers"
  ON public.schedules FOR ALL TO authenticated
  USING (get_user_role(auth.uid()) IN ('admin','supervisor','gerente'))
  WITH CHECK (get_user_role(auth.uid()) IN ('admin','supervisor','gerente'));

-- schedule_shifts: managers ven todo; agent solo ve sus propios turnos
CREATE POLICY "shifts_select_managers"
  ON public.schedule_shifts FOR SELECT TO authenticated
  USING (get_user_role(auth.uid()) IN ('admin','supervisor','gerente'));

CREATE POLICY "shifts_select_own_agent"
  ON public.schedule_shifts FOR SELECT TO authenticated
  USING (
    get_user_role(auth.uid()) = 'agent'
    AND agente_id = auth.uid()
  );

CREATE POLICY "shifts_write_managers"
  ON public.schedule_shifts FOR ALL TO authenticated
  USING (get_user_role(auth.uid()) IN ('admin','supervisor','gerente'))
  WITH CHECK (get_user_role(auth.uid()) IN ('admin','supervisor','gerente'));

-- schedule_novedades: managers ven todo; agent solo ve las suyas
CREATE POLICY "novedades_select_managers"
  ON public.schedule_novedades FOR SELECT TO authenticated
  USING (get_user_role(auth.uid()) IN ('admin','supervisor','gerente'));

CREATE POLICY "novedades_select_own_agent"
  ON public.schedule_novedades FOR SELECT TO authenticated
  USING (
    get_user_role(auth.uid()) = 'agent'
    AND agente_id = auth.uid()
  );

CREATE POLICY "novedades_write_managers"
  ON public.schedule_novedades FOR ALL TO authenticated
  USING (get_user_role(auth.uid()) IN ('admin','supervisor','gerente'))
  WITH CHECK (get_user_role(auth.uid()) IN ('admin','supervisor','gerente'));
