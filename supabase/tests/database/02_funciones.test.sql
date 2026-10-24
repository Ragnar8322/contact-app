-- Funciones de negocio: agregados, transferencias, asignación, creación atómica, importación y roles.
BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT plan(21);

CREATE OR REPLACE FUNCTION pg_temp.como(p_uid uuid) RETURNS void LANGUAGE sql AS $$
  SELECT set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated')::text, true),
         set_config('role', 'authenticated', true);
$$;

\set admin      '''d0000000-0000-4000-8000-000000000001'''
\set supervisor '''d0000000-0000-4000-8000-000000000002'''
\set agente1    '''d0000000-0000-4000-8000-000000000011'''
\set REN        '''d9c34f5a-55dd-41c7-b0d8-7c65759f4870'''
\set ASE        '''22da479a-04b5-4554-83da-67f8b374cc38'''

-- ── Dashboard: los agregados coinciden con un conteo directo ──
SELECT count(*) FILTER (WHERE NOT e.es_final AND e.nombre <> 'Transferido') AS abiertos_esperados
  FROM casos c JOIN cat_estados e ON e.id = c.estado_id WHERE c.campana_id = :REN \gset
SELECT pg_temp.como(:admin);
SELECT is((SELECT abiertos FROM dashboard_stats(ARRAY[:REN::uuid])), :abiertos_esperados::int, 'dashboard_stats cuenta todos los abiertos');
SELECT is((SELECT sum(activos)::int FROM dashboard_agent_stats(ARRAY[:REN::uuid])), :abiertos_esperados::int, 'dashboard_agent_stats suma lo mismo');
SELECT pg_temp.como(:agente1);
SELECT is((SELECT abiertos FROM dashboard_stats(ARRAY[:REN::uuid])),
          (SELECT count(*)::int FROM casos c JOIN cat_estados e ON e.id = c.estado_id WHERE NOT e.es_final AND c.agente_id = auth.uid()),
          'dashboard_stats respeta la RLS del agente');

-- ── Transferencia ──
SELECT min(c.id) AS caso_t FROM casos c JOIN cat_estados e ON e.id = c.estado_id
 WHERE c.agente_id = :agente1 AND NOT e.es_final \gset
SELECT pg_temp.como(:agente1);
SELECT transfer_case(:caso_t, :ASE) AS r \gset
RESET role;
SELECT is((SELECT e.nombre FROM casos c JOIN cat_estados e ON e.id = c.estado_id WHERE c.id = :caso_t), 'Transferido', 'el original queda Transferido');
SELECT is((SELECT n.agente_id FROM casos o JOIN casos n ON n.id = o.transferido_a_caso_id WHERE o.id = :caso_t),
          :supervisor::uuid, 'el caso nuevo queda asignado al supervisor de la campaña destino');
SELECT is((SELECT n.transferido_desde_caso_id FROM casos o JOIN casos n ON n.id = o.transferido_a_caso_id WHERE o.id = :caso_t),
          :caso_t::int, 'ambos casos quedan enlazados');
SELECT is((SELECT count(*) FROM caso_historial h JOIN casos o ON o.id = :caso_t WHERE h.caso_id IN (o.id, o.transferido_a_caso_id)),
          2::bigint, 'se registra historial en los dos casos');

-- Sin supervisor en destino: rechazo
DELETE FROM perfil_campanas WHERE user_id = :supervisor AND campana_id = :ASE;
SELECT min(c.id) AS caso_t2 FROM casos c JOIN cat_estados e ON e.id = c.estado_id
 WHERE c.agente_id = :agente1 AND NOT e.es_final \gset
SELECT pg_temp.como(:agente1);
SELECT throws_like(format('SELECT transfer_case(%s, %L)', :caso_t2, :ASE), '%no tiene supervisor asignado%',
                   'sin supervisor en la campaña destino, la transferencia se rechaza');
RESET role;
INSERT INTO perfil_campanas (user_id, campana_id) VALUES (:supervisor, :ASE);

-- Atomicidad: una falla en el último paso no deja nada
ALTER TABLE caso_historial ADD CONSTRAINT falla_provocada CHECK (comentario NOT LIKE 'Recibido%') NOT VALID;
SELECT count(*) AS casos_antes FROM casos \gset
SELECT pg_temp.como(:agente1);
SELECT throws_ok(format('SELECT transfer_case(%s, %L)', :caso_t2, :ASE), '23514', NULL, 'falla provocada en el historial del caso nuevo');
RESET role;
SELECT is((SELECT count(*) FROM casos), :casos_antes::bigint, 'tras la falla no se creó ningún caso');
SELECT is((SELECT transferido_a_caso_id FROM casos WHERE id = :caso_t2), NULL, 'tras la falla el original no cambió');
ALTER TABLE caso_historial DROP CONSTRAINT falla_provocada;

-- ── Asignación equilibrada ──
SELECT pg_temp.como(:agente1);
SELECT throws_ok(format('SELECT * FROM assignment_candidates(%L)', :REN), '42501', NULL, 'un agente no puede asignar');
SELECT pg_temp.como(:supervisor);
SELECT is((SELECT count(*) FROM assignment_candidates(:REN)), 4::bigint, 'el supervisor ve los 4 agentes de la campaña');
SELECT array_agg(c.id) AS lote FROM (SELECT c.id FROM casos c JOIN cat_estados e ON e.id = c.estado_id
  WHERE c.campana_id = :REN AND NOT e.es_final ORDER BY c.id LIMIT 40) c \gset
SELECT array_agg(user_id) AS agentes FROM assignment_candidates(:REN) \gset
SELECT assign_cases(:REN, :'lote'::int[], :'agentes'::uuid[]) AS reparto \gset
SELECT is((:'reparto'::jsonb ->> 'asignados')::int, 40, 'se asignan los 40 casos');
-- Reparto óptimo: quien recibe casos no queda más de 1 por encima del agente menos cargado
-- (un agente ya muy cargado puede no recibir ninguno)
SELECT ok((SELECT max(c.abiertos) FROM assignment_candidates(:REN) c
            WHERE c.user_id IN (SELECT (x ->> 'agente_id')::uuid FROM jsonb_array_elements(:'reparto'::jsonb -> 'por_agente') x))
          - (SELECT min(abiertos) FROM assignment_candidates(:REN)) <= 1,
          'el reparto equilibra la carga');
SELECT min(c.id) AS cerrado FROM casos c JOIN cat_estados e ON e.id = c.estado_id WHERE e.es_final AND c.campana_id = :REN \gset
SELECT throws_like(format('SELECT assign_cases(%L, %L::int[], %L::uuid[])', :REN, array_append(:'lote'::int[], :cerrado), :'agentes'),
                   '%No se guardó ningún cambio%', 'un caso cerrado en el lote cancela toda la asignación');

-- ── Crear cliente + caso de forma atómica ──
SELECT pg_temp.como(:agente1);
SELECT throws_ok($$SELECT create_case_with_client('d9c34f5a-55dd-41c7-b0d8-7c65759f4870', 99999, 'x', NULL,
                    '{"identificacion":"T-ATOM","nombre_contacto":"x"}')$$, '23503', NULL, 'un tipo de servicio inválido hace fallar el caso');
SELECT is((SELECT count(*) FROM clientes WHERE identificacion = 'T-ATOM'), 0::bigint, 'y el cliente no queda creado');

-- ── Importación: montos colombianos ──
SELECT is(parse_monto_cop('$150.000'), 150000::numeric, '"$150.000" es 150000');
SELECT is(parse_monto_cop('1.250.000,50'), 1250000.50::numeric, '"1.250.000,50" es 1250000.50');

-- ── Roles: fuente única ──
SELECT pg_temp.como(:admin);
SELECT set_user_roles(:agente1, ARRAY[2, 3]);
SELECT is(get_user_role(:agente1), 'supervisor', 'el rol efectivo es el más alto de las asignaciones');

SELECT * FROM finish();
ROLLBACK;
