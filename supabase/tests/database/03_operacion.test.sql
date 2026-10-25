-- Cambio obligatorio de contraseña validado en el servidor y retención de la auditoría.
BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT plan(11);

CREATE OR REPLACE FUNCTION pg_temp.como(p_uid uuid) RETURNS void LANGUAGE sql AS $$
  SELECT set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated')::text, true),
         set_config('role', 'authenticated', true);
$$;

\set admin   '''d0000000-0000-4000-8000-000000000001'''
\set agente1 '''d0000000-0000-4000-8000-000000000011'''

-- ── Cambio obligatorio de contraseña ──
UPDATE profiles SET must_change_password = true WHERE user_id = :agente1;

SELECT pg_temp.como(:agente1);
SELECT throws_ok($$UPDATE profiles SET must_change_password = false WHERE user_id = auth.uid()$$,
                 '42501', NULL, 'el usuario no puede apagar la marca sin cambiar la contraseña');
SELECT lives_ok($$UPDATE profiles SET telefono = '3001234567' WHERE user_id = auth.uid()$$,
                'sí puede editar sus otros datos');
RESET role;

UPDATE auth.users SET encrypted_password = extensions.crypt('Nueva1234!', extensions.gen_salt('bf')) WHERE id = :agente1;
SELECT is((SELECT must_change_password FROM profiles WHERE user_id = :agente1), false,
          'cambiar la contraseña apaga la marca');

UPDATE profiles SET must_change_password = true WHERE user_id = :agente1;
UPDATE auth.users SET email_confirmed_at = now() WHERE id = :agente1;
SELECT is((SELECT must_change_password FROM profiles WHERE user_id = :agente1), true,
          'otros cambios del usuario de auth no la apagan');

SELECT pg_temp.como(:agente1);
SELECT is((SELECT count(*) FROM profiles WHERE user_id = 'd0000000-0000-4000-8000-000000000012'), 0::bigint,
          'el agente no ve perfiles ajenos');
SELECT pg_temp.como(:admin);
SELECT lives_ok($$UPDATE profiles SET must_change_password = false WHERE user_id = 'd0000000-0000-4000-8000-000000000011'$$,
                'un admin sí puede cambiar la marca');
RESET role;

-- ── Retención de la auditoría ──
INSERT INTO activity_log (created_at, action, entity) VALUES
  (now() - interval '19 months', 'VIEJO', 'prueba'),
  (now() - interval '1 month',   'RECIENTE', 'prueba');
SELECT is(archivo.archivar_auditoria(18), 1, 'archiva solo lo que pasa de 18 meses');
SELECT is((SELECT count(*) FROM archivo.activity_log WHERE action = 'VIEJO'), 1::bigint, 'el evento viejo queda en el archivo');
SELECT is((SELECT count(*) FROM activity_log WHERE action IN ('VIEJO', 'RECIENTE')), 1::bigint, 'y el reciente sigue en línea');
SELECT is((SELECT schedule FROM cron.job WHERE jobname = 'archivar-auditoria'), '0 3 1 * *', 'el archivado corre cada mes');

SELECT pg_temp.como(:admin);
SELECT throws_ok($$SELECT archivo.archivar_auditoria(18)$$, '42501', NULL, 'nadie lo ejecuta desde la API');
RESET role;

SELECT * FROM finish();
ROLLBACK;
