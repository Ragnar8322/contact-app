-- Permisos por rol (RLS) sobre los datos de supabase/seed.sql.
-- Se ejecuta con `supabase test db`; cada archivo corre en una transacción que se revierte.
BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT plan(24);

-- Suplanta a un usuario como lo hace la API
CREATE OR REPLACE FUNCTION pg_temp.como(p_uid uuid) RETURNS void LANGUAGE sql AS $$
  SELECT set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated')::text, true),
         set_config('role', 'authenticated', true);
$$;

-- Ejecuta una sentencia y devuelve cuántas filas afectó (UPDATE/DELETE no pueden ir dentro de is())
CREATE OR REPLACE FUNCTION pg_temp.filas(q text) RETURNS bigint LANGUAGE plpgsql AS $$
DECLARE n bigint;
BEGIN
  EXECUTE q;
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END;
$$;

\set admin      '''d0000000-0000-4000-8000-000000000001'''
\set supervisor '''d0000000-0000-4000-8000-000000000002'''
\set gerente    '''d0000000-0000-4000-8000-000000000003'''
\set agente1    '''d0000000-0000-4000-8000-000000000011'''
\set agente5    '''d0000000-0000-4000-8000-000000000021'''

SELECT count(*) AS total_casos FROM casos \gset

-- Visibilidad de casos
SELECT pg_temp.como(:admin);
SELECT is((SELECT count(*) FROM casos), :total_casos::bigint, 'admin ve todos los casos');
SELECT pg_temp.como(:gerente);
SELECT is((SELECT count(*) FROM casos), :total_casos::bigint, 'gerente ve todos los casos');
SELECT pg_temp.como(:supervisor);
SELECT is((SELECT count(*) FROM casos), :total_casos::bigint, 'supervisor ve los casos de sus campañas');
SELECT pg_temp.como(:agente1);
SELECT is((SELECT count(*) FROM casos WHERE agente_id <> auth.uid()), 0::bigint, 'agente no ve casos ajenos');
SELECT ok((SELECT count(*) FROM casos) > 0, 'agente ve sus casos');
SELECT pg_temp.como(:agente5);
SELECT is((SELECT count(*) FROM casos), 0::bigint, 'agente de otra campaña sin casos no ve nada');

-- Edición de casos
SELECT pg_temp.como(:agente1);
SELECT is(pg_temp.filas($q$UPDATE casos c SET descripcion_inicial = 'x' FROM cat_estados e
                       WHERE e.id = c.estado_id AND NOT e.es_final AND c.agente_id <> auth.uid()$q$), 0::bigint, 'agente no edita casos ajenos');
SELECT is(pg_temp.filas($q$UPDATE casos c SET descripcion_inicial = 'x' FROM cat_estados e
                       WHERE e.id = c.estado_id AND e.es_final AND c.agente_id = auth.uid()$q$), 0::bigint, 'agente no edita sus casos cerrados');
SELECT ok(pg_temp.filas($q$UPDATE casos c SET descripcion_inicial = 'x' FROM cat_estados e
                       WHERE e.id = c.estado_id AND NOT e.es_final AND c.agente_id = auth.uid()$q$) > 0, 'agente edita sus casos abiertos');
SELECT throws_ok($$UPDATE casos SET agente_id = 'd0000000-0000-4000-8000-000000000012'
                    WHERE id = (SELECT min(c.id) FROM casos c JOIN cat_estados e ON e.id = c.estado_id
                                 WHERE c.agente_id = auth.uid() AND NOT e.es_final)$$,
                 '42501', NULL, 'agente no puede reasignar su caso a otro');
SELECT pg_temp.como(:gerente);
SELECT is(pg_temp.filas($q$UPDATE casos SET descripcion_inicial = 'x'$q$), 0::bigint, 'gerente no edita casos');
SELECT throws_ok($$INSERT INTO casos (cliente_id, tipo_servicio_id, estado_id, agente_id, descripcion_inicial, created_by)
                    VALUES (1, 1, 7, 'd0000000-0000-4000-8000-000000000011', 'x', auth.uid())$$,
                 '42501', NULL, 'gerente no crea casos');

-- Clientes
SELECT throws_ok($$INSERT INTO clientes (tipo_cliente, identificacion, nombre_contacto) VALUES ('Persona', 'T-1', 'X')$$,
                 '42501', NULL, 'gerente no crea clientes');
SELECT is(pg_temp.filas($q$UPDATE clientes SET telefono = '1'$q$), 0::bigint, 'gerente no edita clientes');
SELECT pg_temp.como(:agente1);
SELECT lives_ok($$INSERT INTO clientes (tipo_cliente, identificacion, nombre_contacto) VALUES ('Persona', 'T-2', 'X')$$, 'agente crea clientes');

-- Perfiles y roles
SELECT is((SELECT count(*) FROM profiles), 1::bigint, 'agente solo ve su perfil');
SELECT throws_ok($$UPDATE profiles SET role_id = 1 WHERE user_id = auth.uid()$$, '42501', NULL, 'agente no puede cambiarse el rol');
SELECT throws_ok($$INSERT INTO user_role_assignments (user_id, role_id) VALUES (auth.uid(), 1)$$, '42501', NULL, 'agente no puede asignarse roles');

-- Horarios: el agente solo ve los publicados de su campaña
SELECT is((SELECT count(*) FROM schedules WHERE campana_id NOT IN (SELECT campana_id FROM perfil_campanas WHERE user_id = auth.uid())),
          0::bigint, 'agente no ve horarios de otras campañas');
SELECT is((SELECT count(*) FROM schedule_shifts WHERE agente_id <> auth.uid()), 0::bigint, 'agente solo ve sus turnos');
SELECT throws_ok($$INSERT INTO schedules (campana_id, semana_inicio, semana_fin)
                    VALUES ('d9c34f5a-55dd-41c7-b0d8-7c65759f4870', '2030-01-07', '2030-01-13')$$,
                 '42501', NULL, 'agente no crea semanas de horario');

-- Auditoría
SELECT throws_ok($$INSERT INTO activity_log (action, entity) VALUES ('FALSO', 'x')$$, '42501', NULL, 'nadie inserta auditoría directamente');

-- Acceso anónimo
RESET role;
SELECT set_config('request.jwt.claims', '', true), set_config('role', 'anon', true);
SELECT throws_ok($$SELECT get_user_role('d0000000-0000-4000-8000-000000000001')$$, '42501', NULL, 'anon no ejecuta funciones privilegiadas');
SELECT throws_ok($$SELECT transfer_case(1, 'd9c34f5a-55dd-41c7-b0d8-7c65759f4870')$$, '42501', NULL, 'anon no transfiere casos');

SELECT * FROM finish();
ROLLBACK;
