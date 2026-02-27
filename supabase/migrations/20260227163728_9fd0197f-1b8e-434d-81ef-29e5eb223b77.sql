
-- Drop existing update policy
DROP POLICY IF EXISTS "casos_update" ON casos;

-- New policy: agents can only update non-final cases, admins can update any
CREATE POLICY "casos_update" ON casos
FOR UPDATE
USING (
  (
    auth.role() = 'authenticated'
    AND (SELECT es_final FROM cat_estados WHERE id = casos.estado_id) = false
  )
  OR
  is_admin(auth.uid())
)
WITH CHECK (
  (
    auth.role() = 'authenticated'
    AND (SELECT es_final FROM cat_estados WHERE id = casos.estado_id) = false
  )
  OR
  is_admin(auth.uid())
);
