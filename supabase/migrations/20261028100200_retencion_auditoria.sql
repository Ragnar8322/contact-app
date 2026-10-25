-- Retención de la auditoría: 18 meses en línea; lo anterior se mueve (no se borra) a
-- archivo.activity_log el día 1 de cada mes. El esquema archivo no lo expone la API.
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;

CREATE TABLE IF NOT EXISTS archivo.activity_log (
  LIKE public.activity_log INCLUDING ALL,
  archivado_en timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE archivo.activity_log ENABLE ROW LEVEL SECURITY;
COMMENT ON TABLE archivo.activity_log IS 'Eventos de auditoría con más de 18 meses, movidos por archivo.archivar_auditoria().';

CREATE OR REPLACE FUNCTION archivo.archivar_auditoria(p_meses integer DEFAULT 18) RETURNS integer
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
DECLARE
  v_movidos integer;
BEGIN
  IF p_meses < 12 THEN
    RAISE EXCEPTION 'La auditoría se conserva al menos 12 meses en línea';
  END IF;

  WITH movidos AS (
    DELETE FROM public.activity_log
     WHERE created_at < now() - make_interval(months => p_meses)
    RETURNING *
  )
  INSERT INTO archivo.activity_log
         (id, created_at, user_id, user_email, user_name, action, entity, entity_id, campana_id, details, ip_address)
  SELECT id, created_at, user_id, user_email, user_name, action, entity, entity_id, campana_id, details, ip_address
    FROM movidos;

  GET DIAGNOSTICS v_movidos = ROW_COUNT;
  RETURN v_movidos;
END;
$$;

REVOKE EXECUTE ON FUNCTION archivo.archivar_auditoria(integer) FROM PUBLIC, anon, authenticated;

-- Día 1 de cada mes a las 03:00 UTC (22:00 del último día del mes en Colombia)
SELECT cron.schedule('archivar-auditoria', '0 3 1 * *', 'SELECT archivo.archivar_auditoria(18)');
