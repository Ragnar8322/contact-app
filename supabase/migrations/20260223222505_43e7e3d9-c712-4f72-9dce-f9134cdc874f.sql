
-- Insert profile for jbriceno user
INSERT INTO public.profiles (user_id, nombre, role_id)
VALUES ('8b7c9987-1bd9-443b-b596-8072ffb56323', 'Juan Briceño', 1)
ON CONFLICT (user_id) DO NOTHING;

-- Insert cat_agentes record so cases can reference this user
INSERT INTO public.cat_agentes (user_id, nombre, activo)
VALUES ('8b7c9987-1bd9-443b-b596-8072ffb56323', 'Juan Briceño', true)
ON CONFLICT (user_id) DO NOTHING;

-- Clean up duplicate estados (keep only 7-15 which have better naming)
DELETE FROM public.cat_estados WHERE id IN (1,2,3,4,5,6);
