-- ============================================================
-- Agregados del Dashboard calculados en la base de datos
-- Fecha: 2026-10-25
--
-- El Dashboard pedía todos los casos y los contaba en el navegador,
-- pero la API devuelve como máximo 1.000 filas: con 10.625 casos
-- mostraba 267 abiertos cuando eran 1.121. Estas funciones devuelven
-- solo los totales. Son SECURITY INVOKER: la RLS de casos aplica igual
-- que antes (un agente ve solo sus casos).
--
-- La lógica replica la que tenía el frontend:
--   abierto     = estado no final y distinto de "Transferido"
--   vencido     = abierto y horas desde fecha_caso >= horas_vencido
--   en riesgo   = abierto y horas_riesgo <= horas < horas_vencido
--   SLA por defecto 2 h / 6 h si la campaña no tiene configuración activa
-- ============================================================

-- SLA vigente por campaña (la fila activa más reciente)
CREATE OR REPLACE FUNCTION public.sla_vigente(p_campana_ids uuid[])
RETURNS TABLE (campana_id uuid, horas_riesgo int, horas_vencido int)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
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

-- Indicadores por campaña
CREATE OR REPLACE FUNCTION public.dashboard_stats(p_campana_ids uuid[], p_tz text DEFAULT 'America/Bogota')
RETURNS TABLE (
  campana_id   uuid,
  abiertos     int,
  cerrados_hoy int,
  sin_asignar  int,
  en_riesgo    int,
  vencidos     int
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
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

-- Casos activos y vencidos por agente (tabla "Agentes activos")
CREATE OR REPLACE FUNCTION public.dashboard_agent_stats(p_campana_ids uuid[])
RETURNS TABLE (agente_id uuid, activos int, vencidos int)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
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

-- Módulo financiero: valores renovado / pendiente por tramo del periodo.
-- p_periodo: 'dia' (tramo = hora 0-23), 'semana' (0 = lunes … 6 = domingo),
--            'mes' (día 1-31), 'año' (mes 0-11)
CREATE OR REPLACE FUNCTION public.financial_summary(
  p_campana_id uuid,
  p_desde      timestamptz,
  p_hasta      timestamptz,
  p_periodo    text,
  p_tz         text DEFAULT 'America/Bogota'
)
RETURNS TABLE (tramo int, renovado numeric, pendiente numeric)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
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

REVOKE EXECUTE ON FUNCTION public.sla_vigente(uuid[])                                    FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.dashboard_stats(uuid[], text)                          FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.dashboard_agent_stats(uuid[])                          FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.financial_summary(uuid, timestamptz, timestamptz, text, text) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.sla_vigente(uuid[])                                    TO authenticated;
GRANT  EXECUTE ON FUNCTION public.dashboard_stats(uuid[], text)                          TO authenticated;
GRANT  EXECUTE ON FUNCTION public.dashboard_agent_stats(uuid[])                          TO authenticated;
GRANT  EXECUTE ON FUNCTION public.financial_summary(uuid, timestamptz, timestamptz, text, text) TO authenticated;

-- El Dashboard ordena los casos recientes por updated_at dentro de la campaña
CREATE INDEX IF NOT EXISTS idx_casos_campana_updated ON public.casos (campana_id, updated_at DESC);
