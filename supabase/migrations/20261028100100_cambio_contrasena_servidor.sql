-- El cambio obligatorio de contraseña se valida en el servidor.
-- Antes, la pantalla de cambio apagaba must_change_password con un UPDATE desde el navegador,
-- así que un usuario podía apagarla sin cambiar la contraseña. Ahora:
--   1. La marca se apaga sola cuando la contraseña cambia de verdad (trigger en auth.users).
--   2. Un usuario que no es admin no puede modificar la marca desde la API.

-- SECURITY INVOKER para que current_user sea el rol de quien escribe: las restricciones aplican
-- a la API (authenticated/anon), no a funciones internas como limpiar_cambio_obligatorio,
-- service_role ni GoTrue.
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

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.limpiar_cambio_obligatorio() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
BEGIN
  UPDATE public.profiles SET must_change_password = false
   WHERE user_id = NEW.id AND must_change_password;
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.limpiar_cambio_obligatorio() FROM PUBLIC, anon, authenticated;

-- reset-password e invite-user fijan la contraseña temporal y después encienden la marca,
-- así que este trigger no la apaga en esos casos.
CREATE TRIGGER on_auth_password_changed
  AFTER UPDATE OF encrypted_password ON auth.users
  FOR EACH ROW
  WHEN (OLD.encrypted_password IS DISTINCT FROM NEW.encrypted_password)
  EXECUTE FUNCTION public.limpiar_cambio_obligatorio();
