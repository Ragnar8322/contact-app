CREATE OR REPLACE FUNCTION create_client_and_case(
  p_cliente JSONB,
  p_caso JSONB
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_cliente_id UUID;
  v_inserted_caso JSONB;
BEGIN
  -- Upsert client (using 'identificacion' as unique key)
  -- Adjust the UNIQUE constraint field if needed.
  INSERT INTO clientes (
    identificacion, 
    nombre, 
    email, 
    telefono,
    created_at
  )
  VALUES (
    p_cliente->>'identificacion',
    p_cliente->>'nombre',
    p_cliente->>'email',
    p_cliente->>'telefono',
    NOW()
  )
  ON CONFLICT (identificacion) DO UPDATE
    SET nombre = EXCLUDED.nombre,
        email = EXCLUDED.email,
        telefono = EXCLUDED.telefono
  RETURNING id INTO v_cliente_id;

  -- Insert case logic
  INSERT INTO casos (
    cliente_id,
    titulo,
    descripcion,
    estado,
    created_at
  )
  VALUES (
    v_cliente_id,
    p_caso->>'titulo',
    p_caso->>'descripcion',
    COALESCE(p_caso->>'estado', 'abierto'),
    NOW()
  )
  RETURNING row_to_json(casos.*) INTO v_inserted_caso;

  -- Return the inserted case with client info context if necessary
  RETURN jsonb_build_object(
    'success', true,
    'cliente_id', v_cliente_id,
    'caso', v_inserted_caso
  );

EXCEPTION WHEN OTHERS THEN
  -- Implicit rollback occurs on EXCEPTION in plpgsql
  RAISE EXCEPTION 'Transaction failed: %', SQLERRM;
END;
$$;
