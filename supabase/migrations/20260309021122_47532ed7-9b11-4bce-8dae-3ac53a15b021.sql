CREATE OR REPLACE FUNCTION get_casos_counts(p_campana_id UUID)
RETURNS JSON AS $$
DECLARE
  activos_count INT;
  cerrados_count INT;
  transferidos_count INT;
BEGIN
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
    'activos', activos_count,
    'cerrados', cerrados_count,
    'transferidos', transferidos_count
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;