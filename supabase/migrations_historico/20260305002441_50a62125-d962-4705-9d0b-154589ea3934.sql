
-- Insert new roles
INSERT INTO user_roles (name) VALUES ('supervisor'), ('gerente')
ON CONFLICT DO NOTHING;

-- Security definer function to get user role name without RLS recursion
CREATE OR REPLACE FUNCTION public.get_user_role(_user_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT r.name
  FROM public.profiles p
  JOIN public.user_roles r ON r.id = p.role_id
  WHERE p.user_id = _user_id
  LIMIT 1
$$;

-- Drop existing SELECT policy on casos
DROP POLICY IF EXISTS "casos_select" ON casos;

-- New SELECT policy: role-aware
-- agent sees only their own cases
-- supervisor sees all cases in their campaigns (via perfil_campanas)
-- admin & gerente see everything
CREATE POLICY "casos_select_by_role" ON casos
FOR SELECT TO authenticated
USING (
  CASE get_user_role(auth.uid())
    WHEN 'agent' THEN agente_id = auth.uid()
    WHEN 'supervisor' THEN (
      campana_id IN (
        SELECT campana_id FROM perfil_campanas WHERE user_id = auth.uid()
      )
    )
    ELSE true  -- admin and gerente see all
  END
);

-- Gerente: read-only (block INSERT/UPDATE)
-- Drop and recreate update policies to account for gerente
DROP POLICY IF EXISTS "casos_update" ON casos;
DROP POLICY IF EXISTS "casos_update_admin" ON casos;
DROP POLICY IF EXISTS "casos_update_agente" ON casos;
DROP POLICY IF EXISTS "casos_update_campana" ON casos;

-- Admin can update any case
CREATE POLICY "casos_update_admin" ON casos
FOR UPDATE TO authenticated
USING (get_user_role(auth.uid()) = 'admin')
WITH CHECK (get_user_role(auth.uid()) = 'admin');

-- Supervisor can update cases in their campaigns
CREATE POLICY "casos_update_supervisor" ON casos
FOR UPDATE TO authenticated
USING (
  get_user_role(auth.uid()) = 'supervisor'
  AND campana_id IN (SELECT campana_id FROM perfil_campanas WHERE user_id = auth.uid())
  AND (SELECT es_final FROM cat_estados WHERE id = casos.estado_id) = false
)
WITH CHECK (
  get_user_role(auth.uid()) = 'supervisor'
  AND campana_id IN (SELECT campana_id FROM perfil_campanas WHERE user_id = auth.uid())
);

-- Agent can update only their own non-final cases
CREATE POLICY "casos_update_agent" ON casos
FOR UPDATE TO authenticated
USING (
  get_user_role(auth.uid()) = 'agent'
  AND agente_id = auth.uid()
  AND (SELECT es_final FROM cat_estados WHERE id = casos.estado_id) = false
)
WITH CHECK (
  get_user_role(auth.uid()) = 'agent'
  AND agente_id = auth.uid()
);

-- Gerente cannot update (no policy = denied)

-- INSERT policy: gerente cannot create cases
DROP POLICY IF EXISTS "casos_insert" ON casos;

CREATE POLICY "casos_insert_no_gerente" ON casos
FOR INSERT TO authenticated
WITH CHECK (get_user_role(auth.uid()) != 'gerente');
