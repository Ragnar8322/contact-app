-- Habilitar / deshabilitar perfiles de usuario desde Administración.
-- La edge function reset-password (acción set_active) cambia esta marca, sincroniza
-- cat_agentes.activo y bloquea o desbloquea el acceso en auth (ban_duration).

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS activo boolean NOT NULL DEFAULT true;

-- Un usuario que no es admin no puede reactivarse (ni desactivarse) desde la API.
CREATE OR REPLACE FUNCTION public.protect_profile_privileged_columns() RETURNS trigger
    LANGUAGE plpgsql SECURITY INVOKER
    SET search_path TO 'public'
    AS $$
BEGIN
  IF current_user NOT IN ('authenticated', 'anon') OR public.is_admin(auth.uid()) THEN
    RETURN NEW;
  END IF;

  IF NEW.role_id IS DISTINCT FROM OLD.role_id
     OR NEW.user_id IS DISTINCT FROM OLD.user_id THEN
    RAISE EXCEPTION 'No autorizado para modificar el rol del perfil'
      USING ERRCODE = '42501';
  END IF;

  -- La marca solo cambia al cambiar la contraseña (on_auth_password_changed) o por un admin
  IF NEW.must_change_password IS DISTINCT FROM OLD.must_change_password THEN
    RAISE EXCEPTION 'El cambio obligatorio de contraseña se completa cambiando la contraseña'
      USING ERRCODE = '42501';
  END IF;

  IF NEW.activo IS DISTINCT FROM OLD.activo THEN
    RAISE EXCEPTION 'No autorizado para habilitar o deshabilitar el perfil'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;
