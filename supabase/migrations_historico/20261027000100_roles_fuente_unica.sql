-- ============================================================
-- Fase 2 · Una sola fuente para el rol del usuario
-- Fecha: 2026-10-27
--
-- Antes: la base decidía permisos con profiles.role_id y la interfaz
-- mostraba menús según user_role_assignments. Editar roles en
-- Administración solo cambiaba las asignaciones, así que un usuario con
-- rol de supervisor asignado seguía siendo "agent" para la base
-- (caso real: una supervisora veía menús que la base le negaba).
--
-- Ahora:
--   - user_role_assignments es la fuente. El rol efectivo es el más alto
--     (admin > gerente > supervisor > agent), igual que en la interfaz.
--   - profiles.role_id queda como dato derivado y se sincroniza con un trigger.
--   - set_user_roles() reemplaza las asignaciones en una sola transacción
--     (antes: borrar todo y luego insertar; si fallaba, el usuario quedaba sin rol).
-- ============================================================

CREATE OR REPLACE FUNCTION public.rol_prioridad(p_nombre text)
RETURNS int
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE p_nombre WHEN 'admin' THEN 4 WHEN 'gerente' THEN 3 WHEN 'supervisor' THEN 2 WHEN 'agent' THEN 1 ELSE 0 END;
$$;

-- Rol efectivo: el más alto de las asignaciones; si no tiene, el de profiles
CREATE OR REPLACE FUNCTION public.get_user_role(_user_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
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

CREATE OR REPLACE FUNCTION public.is_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(public.get_user_role(_user_id) = 'admin', false);
$$;

-- profiles.role_id derivado de las asignaciones
CREATE OR REPLACE FUNCTION public.sync_profile_role()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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

REVOKE EXECUTE ON FUNCTION public.sync_profile_role() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_sync_profile_role ON public.user_role_assignments;
CREATE TRIGGER trg_sync_profile_role
  AFTER INSERT OR UPDATE OR DELETE ON public.user_role_assignments
  FOR EACH ROW EXECUTE FUNCTION public.sync_profile_role();

-- Alinear los datos actuales
UPDATE profiles p
   SET role_id = x.role_id
  FROM (
    SELECT DISTINCT ON (u.user_id) u.user_id, u.role_id
      FROM user_role_assignments u
      JOIN user_roles r ON r.id = u.role_id
     ORDER BY u.user_id, rol_prioridad(r.name) DESC
  ) x
 WHERE x.user_id = p.user_id
   AND p.role_id IS DISTINCT FROM x.role_id;

-- Guardar los roles de un usuario en una sola transacción (solo admin, vía RLS)
CREATE OR REPLACE FUNCTION public.set_user_roles(p_user_id uuid, p_role_ids integer[])
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
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

REVOKE EXECUTE ON FUNCTION public.set_user_roles(uuid, integer[]) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.set_user_roles(uuid, integer[]) TO authenticated;

-- Las políticas de user_role_assignments también usan la fuente única
DROP POLICY IF EXISTS "ura_select"       ON public.user_role_assignments;
DROP POLICY IF EXISTS "ura_insert_admin" ON public.user_role_assignments;
DROP POLICY IF EXISTS "ura_update_admin" ON public.user_role_assignments;
DROP POLICY IF EXISTS "ura_delete_admin" ON public.user_role_assignments;
CREATE POLICY "ura_select" ON public.user_role_assignments
  FOR SELECT TO authenticated
  USING (user_id = ( SELECT auth.uid() AS uid) OR ( SELECT is_admin(( SELECT auth.uid() AS uid)) AS is_admin));
CREATE POLICY "ura_insert_admin" ON public.user_role_assignments
  FOR INSERT TO authenticated
  WITH CHECK (( SELECT is_admin(( SELECT auth.uid() AS uid)) AS is_admin));
CREATE POLICY "ura_update_admin" ON public.user_role_assignments
  FOR UPDATE TO authenticated
  USING      (( SELECT is_admin(( SELECT auth.uid() AS uid)) AS is_admin))
  WITH CHECK (( SELECT is_admin(( SELECT auth.uid() AS uid)) AS is_admin));
CREATE POLICY "ura_delete_admin" ON public.user_role_assignments
  FOR DELETE TO authenticated
  USING (( SELECT is_admin(( SELECT auth.uid() AS uid)) AS is_admin));
