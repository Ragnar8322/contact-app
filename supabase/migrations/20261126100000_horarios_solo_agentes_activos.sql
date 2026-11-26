-- Horarios: solo perfiles habilitados (profiles.activo = true).
-- Antes, la grilla y el generador automático incluían también a los usuarios
-- deshabilitados desde Administración.

-- 1. Lista de agentes que alimenta la grilla de /horarios
CREATE OR REPLACE FUNCTION public.get_agentes_by_campana(_campana_id uuid)
RETURNS TABLE(user_id uuid, nombre text)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT
    p.user_id,
    p.nombre
  FROM public.perfil_campanas pc
  JOIN public.profiles p   ON p.user_id  = pc.user_id
  JOIN public.user_roles r ON r.id       = p.role_id
  WHERE pc.campana_id = _campana_id
    AND r.name = 'agent'
    AND p.activo
  ORDER BY p.nombre;
$$;

COMMENT ON FUNCTION public.get_agentes_by_campana(uuid) IS
  'Retorna los agentes habilitados (role=agent, profiles.activo) asociados a una campaña. SECURITY DEFINER para evitar RLS recursivo en perfil_campanas.';

-- 2. Generador automático de turnos (ambas sobrecargas): añade "AND p.activo"
--    reescribiendo la definición vigente; CREATE OR REPLACE conserva dueño y permisos.
DO $$
DECLARE
  f   oid;
  def text;
BEGIN
  FOR f IN
    SELECT oid FROM pg_proc
     WHERE proname = '_generate_schedule_impl'
       AND pronamespace = 'public'::regnamespace
  LOOP
    def := pg_get_functiondef(f);
    IF def LIKE '%p.activo%' THEN
      CONTINUE;
    END IF;
    def := replace(def, 'AND r.name = ''agent''', 'AND r.name = ''agent'' AND p.activo');
    IF def NOT LIKE '%p.activo%' THEN
      RAISE EXCEPTION 'No se pudo parchear _generate_schedule_impl (oid %)', f;
    END IF;
    EXECUTE def;
  END LOOP;
END $$;
