
-- Create a security definer function to check admin role
CREATE OR REPLACE FUNCTION public.is_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles p
    JOIN public.user_roles r ON r.id = p.role_id
    WHERE p.user_id = _user_id
      AND r.name = 'admin'
  )
$$;

-- Allow admins to read ALL profiles
CREATE POLICY "Admins can read all profiles"
ON public.profiles FOR SELECT
USING (public.is_admin(auth.uid()));

-- Allow admins to update ANY profile
CREATE POLICY "Admins can update all profiles"
ON public.profiles FOR UPDATE
USING (public.is_admin(auth.uid()));

-- Allow admins to insert profiles
CREATE POLICY "Admins can insert profiles"
ON public.profiles FOR INSERT
WITH CHECK (public.is_admin(auth.uid()));

-- cat_estados: allow admin INSERT/UPDATE/DELETE
CREATE POLICY "Admin can insert estados"
ON public.cat_estados FOR INSERT
WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Admin can update estados"
ON public.cat_estados FOR UPDATE
USING (public.is_admin(auth.uid()));

CREATE POLICY "Admin can delete estados"
ON public.cat_estados FOR DELETE
USING (public.is_admin(auth.uid()));

-- cat_tipo_servicio: allow admin INSERT/UPDATE/DELETE
CREATE POLICY "Admin can insert tipo_servicio"
ON public.cat_tipo_servicio FOR INSERT
WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Admin can update tipo_servicio"
ON public.cat_tipo_servicio FOR UPDATE
USING (public.is_admin(auth.uid()));

CREATE POLICY "Admin can delete tipo_servicio"
ON public.cat_tipo_servicio FOR DELETE
USING (public.is_admin(auth.uid()));

-- cat_agentes: allow admin INSERT/UPDATE
CREATE POLICY "Admin can insert agentes"
ON public.cat_agentes FOR INSERT
WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Admin can update agentes"
ON public.cat_agentes FOR UPDATE
USING (public.is_admin(auth.uid()));
