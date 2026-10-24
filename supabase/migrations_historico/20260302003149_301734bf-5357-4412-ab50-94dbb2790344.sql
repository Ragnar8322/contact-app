
-- Enable RLS on campanas
ALTER TABLE public.campanas ENABLE ROW LEVEL SECURITY;

-- Select: all authenticated users
CREATE POLICY "campanas_select"
ON public.campanas FOR SELECT
TO authenticated
USING (auth.role() = 'authenticated');

-- Enable RLS on perfil_campanas
ALTER TABLE public.perfil_campanas ENABLE ROW LEVEL SECURITY;

-- Select: user sees own or admin sees all
CREATE POLICY "perfil_campanas_select"
ON public.perfil_campanas FOR SELECT
TO authenticated
USING (
  user_id = auth.uid()
  OR is_admin(auth.uid())
);

-- Insert: admin only
CREATE POLICY "perfil_campanas_insert"
ON public.perfil_campanas FOR INSERT
TO authenticated
WITH CHECK (is_admin(auth.uid()));

-- Delete: admin only
CREATE POLICY "perfil_campanas_delete"
ON public.perfil_campanas FOR DELETE
TO authenticated
USING (is_admin(auth.uid()));
