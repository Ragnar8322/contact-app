-- ============================================================
-- Datos de ejemplo para desarrollo local (supabase db reset)
--
-- Catálogos (roles, estados, tipos de servicio, campañas, SLA): copia de
-- producción, porque la lógica depende de sus nombres e IDs.
-- Personas, clientes y casos: inventados. Nunca cargar datos reales aquí.
--
-- Usuarios de prueba (contraseña de todos: Demo1234!):
--   admin@demo.local · supervisor@demo.local · gerente@demo.local
--   agente1..4@demo.local (Renovación Web) · agente5@demo.local (Asesoría Especializada)
-- ============================================================

-- Catálogos
INSERT INTO public.user_roles (id, name) VALUES (1, 'admin'), (2, 'agent'), (3, 'supervisor'), (4, 'gerente');
INSERT INTO public.cat_estados (id, nombre, es_final) VALUES (7, 'Registrado', false), (8, 'Asignado', false), (9, 'En gestión', false), (10, 'En espera cliente', false), (11, 'En espera área interna', false), (12, 'Resuelto', true), (13, 'No renovado', true), (14, 'Cerrado por inactividad', true), (15, 'Cerrado por error', true), (16, 'Renovado', true), (17, 'Pendiente de Pago', false), (18, 'Transferido', true);
INSERT INTO public.cat_tipo_servicio (id, nombre) VALUES (1, 'Renovación Web'), (2, 'Asesoría Especializada'), (3, 'Asesoría Mercantil / ESAL'), (4, 'Asesoría RNT / RUNEOL');
INSERT INTO public.campanas (id, nombre, descripcion, activa) VALUES ('d9c34f5a-55dd-41c7-b0d8-7c65759f4870', 'Renovación Web', 'Gestión de renovaciones de servicios web', true), ('22da479a-04b5-4554-83da-67f8b374cc38', 'Asesoría Especializada', 'Gestión de asesorías y consultoría especializada', true);
INSERT INTO public.sla_config (campana_id, horas_riesgo, horas_vencido, activo) VALUES ('d9c34f5a-55dd-41c7-b0d8-7c65759f4870', 2, 6, true), ('22da479a-04b5-4554-83da-67f8b374cc38', 2, 6, true);
SELECT setval(pg_get_serial_sequence('public.user_roles', 'id'), (SELECT max(id) FROM public.user_roles));
SELECT setval(pg_get_serial_sequence('public.cat_estados', 'id'), (SELECT max(id) FROM public.cat_estados));
SELECT setval(pg_get_serial_sequence('public.cat_tipo_servicio', 'id'), (SELECT max(id) FROM public.cat_tipo_servicio));
SELECT setval(pg_get_serial_sequence('public.sla_config', 'id'), (SELECT max(id) FROM public.sla_config));

-- Usuarios de prueba (auth.users + identidad de correo)
INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, recovery_token, email_change_token_new, email_change)
VALUES ('00000000-0000-0000-0000-000000000000', 'd0000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'admin@demo.local',
  extensions.crypt('Demo1234!', extensions.gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{"nombre":"ANA ADMINISTRADORA"}',
  now(), now(), '', '', '', '');
INSERT INTO auth.identities (id, provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
VALUES (gen_random_uuid(), 'd0000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000001', '{"sub":"d0000000-0000-4000-8000-000000000001","email":"admin@demo.local"}', 'email', now(), now(), now());
INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, recovery_token, email_change_token_new, email_change)
VALUES ('00000000-0000-0000-0000-000000000000', 'd0000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'supervisor@demo.local',
  extensions.crypt('Demo1234!', extensions.gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{"nombre":"SERGIO SUPERVISOR"}',
  now(), now(), '', '', '', '');
INSERT INTO auth.identities (id, provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
VALUES (gen_random_uuid(), 'd0000000-0000-4000-8000-000000000002', 'd0000000-0000-4000-8000-000000000002', '{"sub":"d0000000-0000-4000-8000-000000000002","email":"supervisor@demo.local"}', 'email', now(), now(), now());
INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, recovery_token, email_change_token_new, email_change)
VALUES ('00000000-0000-0000-0000-000000000000', 'd0000000-0000-4000-8000-000000000003', 'authenticated', 'authenticated', 'gerente@demo.local',
  extensions.crypt('Demo1234!', extensions.gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{"nombre":"GLORIA GERENTE"}',
  now(), now(), '', '', '', '');
INSERT INTO auth.identities (id, provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
VALUES (gen_random_uuid(), 'd0000000-0000-4000-8000-000000000003', 'd0000000-0000-4000-8000-000000000003', '{"sub":"d0000000-0000-4000-8000-000000000003","email":"gerente@demo.local"}', 'email', now(), now(), now());
INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, recovery_token, email_change_token_new, email_change)
VALUES ('00000000-0000-0000-0000-000000000000', 'd0000000-0000-4000-8000-000000000011', 'authenticated', 'authenticated', 'agente1@demo.local',
  extensions.crypt('Demo1234!', extensions.gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{"nombre":"LAURA MARTÍNEZ"}',
  now(), now(), '', '', '', '');
INSERT INTO auth.identities (id, provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
VALUES (gen_random_uuid(), 'd0000000-0000-4000-8000-000000000011', 'd0000000-0000-4000-8000-000000000011', '{"sub":"d0000000-0000-4000-8000-000000000011","email":"agente1@demo.local"}', 'email', now(), now(), now());
INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, recovery_token, email_change_token_new, email_change)
VALUES ('00000000-0000-0000-0000-000000000000', 'd0000000-0000-4000-8000-000000000012', 'authenticated', 'authenticated', 'agente2@demo.local',
  extensions.crypt('Demo1234!', extensions.gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{"nombre":"CARLOS RODRÍGUEZ"}',
  now(), now(), '', '', '', '');
INSERT INTO auth.identities (id, provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
VALUES (gen_random_uuid(), 'd0000000-0000-4000-8000-000000000012', 'd0000000-0000-4000-8000-000000000012', '{"sub":"d0000000-0000-4000-8000-000000000012","email":"agente2@demo.local"}', 'email', now(), now(), now());
INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, recovery_token, email_change_token_new, email_change)
VALUES ('00000000-0000-0000-0000-000000000000', 'd0000000-0000-4000-8000-000000000013', 'authenticated', 'authenticated', 'agente3@demo.local',
  extensions.crypt('Demo1234!', extensions.gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{"nombre":"PAOLA JIMÉNEZ"}',
  now(), now(), '', '', '', '');
INSERT INTO auth.identities (id, provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
VALUES (gen_random_uuid(), 'd0000000-0000-4000-8000-000000000013', 'd0000000-0000-4000-8000-000000000013', '{"sub":"d0000000-0000-4000-8000-000000000013","email":"agente3@demo.local"}', 'email', now(), now(), now());
INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, recovery_token, email_change_token_new, email_change)
VALUES ('00000000-0000-0000-0000-000000000000', 'd0000000-0000-4000-8000-000000000014', 'authenticated', 'authenticated', 'agente4@demo.local',
  extensions.crypt('Demo1234!', extensions.gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{"nombre":"ANDRÉS CASTRO"}',
  now(), now(), '', '', '', '');
INSERT INTO auth.identities (id, provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
VALUES (gen_random_uuid(), 'd0000000-0000-4000-8000-000000000014', 'd0000000-0000-4000-8000-000000000014', '{"sub":"d0000000-0000-4000-8000-000000000014","email":"agente4@demo.local"}', 'email', now(), now(), now());
INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, recovery_token, email_change_token_new, email_change)
VALUES ('00000000-0000-0000-0000-000000000000', 'd0000000-0000-4000-8000-000000000021', 'authenticated', 'authenticated', 'agente5@demo.local',
  extensions.crypt('Demo1234!', extensions.gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{"nombre":"MÓNICA HERRERA"}',
  now(), now(), '', '', '', '');
INSERT INTO auth.identities (id, provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
VALUES (gen_random_uuid(), 'd0000000-0000-4000-8000-000000000021', 'd0000000-0000-4000-8000-000000000021', '{"sub":"d0000000-0000-4000-8000-000000000021","email":"agente5@demo.local"}', 'email', now(), now(), now());

INSERT INTO public.profiles (user_id, nombre, role_id, must_change_password) VALUES ('d0000000-0000-4000-8000-000000000001', 'ANA ADMINISTRADORA', 1, false), ('d0000000-0000-4000-8000-000000000002', 'SERGIO SUPERVISOR', 3, false), ('d0000000-0000-4000-8000-000000000003', 'GLORIA GERENTE', 4, false), ('d0000000-0000-4000-8000-000000000011', 'LAURA MARTÍNEZ', 2, false), ('d0000000-0000-4000-8000-000000000012', 'CARLOS RODRÍGUEZ', 2, false), ('d0000000-0000-4000-8000-000000000013', 'PAOLA JIMÉNEZ', 2, false), ('d0000000-0000-4000-8000-000000000014', 'ANDRÉS CASTRO', 2, false), ('d0000000-0000-4000-8000-000000000021', 'MÓNICA HERRERA', 2, false);
INSERT INTO public.user_role_assignments (user_id, role_id) VALUES ('d0000000-0000-4000-8000-000000000001', 1), ('d0000000-0000-4000-8000-000000000002', 3), ('d0000000-0000-4000-8000-000000000003', 4), ('d0000000-0000-4000-8000-000000000011', 2), ('d0000000-0000-4000-8000-000000000012', 2), ('d0000000-0000-4000-8000-000000000013', 2), ('d0000000-0000-4000-8000-000000000014', 2), ('d0000000-0000-4000-8000-000000000021', 2);
INSERT INTO public.perfil_campanas (user_id, campana_id) VALUES ('d0000000-0000-4000-8000-000000000001', 'd9c34f5a-55dd-41c7-b0d8-7c65759f4870'), ('d0000000-0000-4000-8000-000000000001', '22da479a-04b5-4554-83da-67f8b374cc38'), ('d0000000-0000-4000-8000-000000000002', 'd9c34f5a-55dd-41c7-b0d8-7c65759f4870'), ('d0000000-0000-4000-8000-000000000002', '22da479a-04b5-4554-83da-67f8b374cc38'), ('d0000000-0000-4000-8000-000000000003', 'd9c34f5a-55dd-41c7-b0d8-7c65759f4870'), ('d0000000-0000-4000-8000-000000000003', '22da479a-04b5-4554-83da-67f8b374cc38'), ('d0000000-0000-4000-8000-000000000011', 'd9c34f5a-55dd-41c7-b0d8-7c65759f4870'), ('d0000000-0000-4000-8000-000000000012', 'd9c34f5a-55dd-41c7-b0d8-7c65759f4870'), ('d0000000-0000-4000-8000-000000000013', 'd9c34f5a-55dd-41c7-b0d8-7c65759f4870'), ('d0000000-0000-4000-8000-000000000014', 'd9c34f5a-55dd-41c7-b0d8-7c65759f4870'), ('d0000000-0000-4000-8000-000000000021', '22da479a-04b5-4554-83da-67f8b374cc38');
-- Supervisor y agentes pueden tener casos asignados (casos.agente_id exige cat_agentes)
INSERT INTO public.cat_agentes (user_id, nombre, activo) VALUES ('d0000000-0000-4000-8000-000000000002', 'SERGIO SUPERVISOR', true), ('d0000000-0000-4000-8000-000000000011', 'LAURA MARTÍNEZ', true), ('d0000000-0000-4000-8000-000000000012', 'CARLOS RODRÍGUEZ', true), ('d0000000-0000-4000-8000-000000000013', 'PAOLA JIMÉNEZ', true), ('d0000000-0000-4000-8000-000000000014', 'ANDRÉS CASTRO', true), ('d0000000-0000-4000-8000-000000000021', 'MÓNICA HERRERA', true);

-- 120 clientes y 300 casos inventados, con estados, fechas y montos variados
SELECT setseed(0.27);
INSERT INTO public.clientes (tipo_cliente, identificacion, nombre_contacto, razon_social, celular, correo)
SELECT CASE WHEN g % 3 = 0 THEN 'Empresa' ELSE 'Persona' END,
       (900000000 + g)::text,
       'CONTACTO DEMO ' || g,
       CASE WHEN g % 3 = 0 THEN 'EMPRESA DEMO ' || g || ' SAS' END,
       '300' || lpad(g::text, 7, '0'),
       'cliente' || g || '@demo.local'
  FROM generate_series(1, 120) g;

INSERT INTO public.casos (cliente_id, tipo_servicio_id, estado_id, agente_id, descripcion_inicial, fecha_caso, fecha_cierre,
                          created_by, updated_at, valor_pagar, campana_id)
SELECT cl.id,
       CASE WHEN g % 5 = 0 THEN 2 ELSE 1 END,
       (ARRAY[7,8,9,9,17,16,16,13])[1 + (g % 8)],
       (ARRAY['d0000000-0000-4000-8000-000000000011','d0000000-0000-4000-8000-000000000012','d0000000-0000-4000-8000-000000000013','d0000000-0000-4000-8000-000000000014']::uuid[])[1 + (g % 4)],
       'Caso de ejemplo ' || g || ': solicitud de renovación de matrícula mercantil.',
       now() - (random() * 90 || ' days')::interval,
       CASE WHEN g % 8 IN (5, 6, 7) THEN now() - (random() * 30 || ' days')::interval END,
       'd0000000-0000-4000-8000-000000000001',
       now() - (random() * 20 || ' days')::interval,
       CASE WHEN g % 8 IN (4, 5, 6) THEN round((150000 + random() * 1850000)::numeric, -3) END,
       'd9c34f5a-55dd-41c7-b0d8-7c65759f4870'
  FROM generate_series(1, 300) g
  JOIN public.clientes cl ON cl.identificacion = (900000000 + 1 + (g % 120))::text;

-- Semana actual publicada en Renovación Web con turnos para los agentes
INSERT INTO public.schedules (campana_id, semana_inicio, semana_fin, estado)
VALUES ('d9c34f5a-55dd-41c7-b0d8-7c65759f4870', date_trunc('week', now())::date, date_trunc('week', now())::date + 6, 'publicado');
INSERT INTO public.schedule_shifts (schedule_id, agente_id, fecha, hora_inicio, hora_fin, hora_almuerzo, duracion_almuerzo, tipo_actividad, horas_dia)
SELECT s.id, a.agente, s.semana_inicio + d,
       CASE WHEN d = 6 THEN NULL WHEN d = 5 THEN '08:00'::time ELSE '07:30'::time END,
       CASE WHEN d = 6 THEN NULL WHEN d = 5 THEN '12:00'::time ELSE '18:00'::time END,
       CASE WHEN d < 5 THEN '12:00'::time END,
       CASE WHEN d < 5 THEN 60 ELSE 0 END,
       CASE WHEN d = 6 THEN 'Descanso' ELSE 'GAP' END,
       CASE WHEN d = 6 THEN 0 WHEN d = 5 THEN 4 ELSE 9 END
  FROM public.schedules s
 CROSS JOIN unnest(ARRAY['d0000000-0000-4000-8000-000000000011','d0000000-0000-4000-8000-000000000012','d0000000-0000-4000-8000-000000000013','d0000000-0000-4000-8000-000000000014']::uuid[]) AS a(agente)
 CROSS JOIN generate_series(0, 6) d;

