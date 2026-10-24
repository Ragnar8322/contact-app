ALTER TABLE public.caso_historial
ADD CONSTRAINT caso_historial_cambiado_por_fkey
FOREIGN KEY (cambiado_por) REFERENCES public.profiles(user_id);