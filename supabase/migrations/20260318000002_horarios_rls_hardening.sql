-- ============================================================
-- MÓDULO HORARIOS — Fase 6: RLS hardening
-- Fecha: 2026-03-18
-- Complementa la migración 20260318000001 sin modificarla.
-- Cambios:
--   1. gerente  → solo lectura (DROP política ALL, ADD SELECT)
--   2. agent    → puede INSERT sus propias novedades (pendiente)
--   3. agent    → puede SELECT schedules publicados de su campaña
--   4. Previene que agent modifique/elimine sus turnos directamente
--   5. Añade política de auditoría: creado_por se fuerza a auth.uid()
-- ============================================================

-- ------------------------------------------------------------
-- 1. GERENTE: solo lectura en schedules y schedule_shifts
--    (ya existe lectura vía schedules_select_managers;
--     eliminamos la política ALL que le daba escritura)
-- ------------------------------------------------------------

-- Reemplazar política ALL de schedules para quitar escritura a gerente
DROP POLICY IF EXISTS "schedules_write_managers" ON public.schedules;

CREATE POLICY "schedules_write_admin_supervisor"
  ON public.schedules FOR ALL TO authenticated
  USING (
    get_user_role(auth.uid()) IN ('admin', 'supervisor')
  )
  WITH CHECK (
    get_user_role(auth.uid()) IN ('admin', 'supervisor')
  );

-- Reemplazar política ALL de schedule_shifts para quitar escritura a gerente
DROP POLICY IF EXISTS "shifts_write_managers" ON public.schedule_shifts;

CREATE POLICY "shifts_write_admin_supervisor"
  ON public.schedule_shifts FOR ALL TO authenticated
  USING (
    get_user_role(auth.uid()) IN ('admin', 'supervisor')
  )
  WITH CHECK (
    get_user_role(auth.uid()) IN ('admin', 'supervisor')
  );

-- Reemplazar política ALL de schedule_novedades para quitar escritura a gerente
DROP POLICY IF EXISTS "novedades_write_managers" ON public.schedule_novedades;

CREATE POLICY "novedades_write_admin_supervisor"
  ON public.schedule_novedades FOR ALL TO authenticated
  USING (
    get_user_role(auth.uid()) IN ('admin', 'supervisor')
  )
  WITH CHECK (
    get_user_role(auth.uid()) IN ('admin', 'supervisor')
  );

-- Reemplazar política ALL de shift_types para quitar escritura a gerente
DROP POLICY IF EXISTS "shift_types_write" ON public.shift_types;

CREATE POLICY "shift_types_write_admin_supervisor"
  ON public.shift_types FOR ALL TO authenticated
  USING (
    get_user_role(auth.uid()) IN ('admin', 'supervisor')
  )
  WITH CHECK (
    get_user_role(auth.uid()) IN ('admin', 'supervisor')
  );

-- ------------------------------------------------------------
-- 2. AGENT: puede ver schedules PUBLICADOS de su campaña
--    (para que useCurrentSchedule funcione en /mi-horario)
-- ------------------------------------------------------------
CREATE POLICY "schedules_select_agent_published"
  ON public.schedules FOR SELECT TO authenticated
  USING (
    get_user_role(auth.uid()) = 'agent'
    AND estado = 'publicado'
    AND campana_id IN (
      SELECT campana_id
      FROM public.user_role_assignments
      WHERE user_id = auth.uid()
    )
  );

-- ------------------------------------------------------------
-- 3. AGENT: puede INSERT su propia novedad (estado forzado a 'pendiente')
-- ------------------------------------------------------------
CREATE POLICY "novedades_insert_own_agent"
  ON public.schedule_novedades FOR INSERT TO authenticated
  WITH CHECK (
    get_user_role(auth.uid()) = 'agent'
    AND agente_id = auth.uid()
    AND estado = 'pendiente'
  );

-- ------------------------------------------------------------
-- 4. AGENT: no puede UPDATE ni DELETE sus propios turnos
--    (ya garantizado por ausencia de política, pero lo hacemos explícito
--     con una política denegadora — en Supabase RLS permissive,
--     basta con no tener política; dejamos un comentario de intención)
-- ------------------------------------------------------------
-- No se crea política UPDATE/DELETE para agent en schedule_shifts.
-- RLS permissive: sin política = sin acceso. Documentado aquí.

-- ------------------------------------------------------------
-- 5. Forzar creado_por = auth.uid() en INSERT de schedules
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_schedule_creado_por()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  NEW.creado_por = auth.uid();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_schedule_creado_por ON public.schedules;
CREATE TRIGGER trg_schedule_creado_por
  BEFORE INSERT ON public.schedules
  FOR EACH ROW EXECUTE FUNCTION public.set_schedule_creado_por();

-- ------------------------------------------------------------
-- 6. Índice adicional: schedules por estado (para filtro de agente)
-- ------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_schedules_estado
  ON public.schedules(campana_id, estado);

-- ------------------------------------------------------------
-- Resumen de permisos finales
-- ------------------------------------------------------------
-- TABLA           admin  supervisor  gerente  agent
-- shift_types     CRUD   CRUD        R        R
-- schedules       CRUD   CRUD        R        R (solo publicado, su campaña)
-- schedule_shifts CRUD   CRUD        R        R (solo propios)
-- novedades       CRUD   CRUD        R        R+INSERT (solo propias, pendiente)
