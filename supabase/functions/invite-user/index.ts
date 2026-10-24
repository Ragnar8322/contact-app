import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version, x-app-name"
};
Deno.serve(async (req)=>{
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: corsHeaders
    });
  }
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const authHeader = req.headers.get("Authorization") ?? "";
    const rawToken = authHeader.replace("Bearer ", "").trim();
    // Si el token es la anon key, el cliente no tiene sesión activa
    if (!rawToken || rawToken === anonKey) {
      console.error("Token recibido es la anon key o está vacío — sesión no inicializada en el cliente");
      return new Response(JSON.stringify({
        error: "Sesión no encontrada. Por favor cierra sesión, vuelve a iniciarla y reintenta."
      }), {
        status: 401,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json"
        }
      });
    }
    // Cliente admin
    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        persistSession: false
      }
    });
    // 1. Validar el JWT del caller
    const { data: { user: caller }, error: callerError } = await adminClient.auth.getUser(rawToken);
    if (!caller || callerError) {
      console.error("getUser failed:", callerError?.message, "| token[:30]:", rawToken.slice(0, 30));
      return new Response(JSON.stringify({
        error: "Sesión inválida o expirada. Recarga la página."
      }), {
        status: 401,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json"
        }
      });
    }
    // 2. Verificar rol del caller
    const { data: callerProfile } = await adminClient.from("profiles").select("role_id, user_roles(name)").eq("user_id", caller.id).maybeSingle();
    const callerRoleName = (callerProfile?.user_roles?.name ?? "").toLowerCase();
    console.log("caller:", caller.id, "| rol:", callerRoleName);
    if (![
      "admin",
      "supervisor"
    ].includes(callerRoleName)) {
      return new Response(JSON.stringify({
        error: `Sin permisos. Tu rol: ${callerRoleName || "sin perfil"}`
      }), {
        status: 403,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json"
        }
      });
    }
    // 3. Leer body
    const body = await req.json();
    const { nombre, telefono, role_id, role_ids } = body;
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    if (!email || !role_id) {
      return new Response(JSON.stringify({
        error: "email y role_id son obligatorios"
      }), {
        status: 400,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json"
        }
      });
    }
    // 4. Validar que todos los roles existen y que el caller puede asignarlos
    const extraRoleIds: number[] = Array.isArray(role_ids) ? role_ids : [];
    const requestedRoleIds = [
      ...new Set([
        role_id,
        ...extraRoleIds
      ])
    ];
    const { data: requestedRoles } = await adminClient.from("user_roles").select("id, name").in("id", requestedRoleIds);
    if (!requestedRoles || requestedRoles.length !== requestedRoleIds.length) {
      return new Response(JSON.stringify({
        error: "Uno o más roles no existen"
      }), {
        status: 400,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json"
        }
      });
    }
    // Un supervisor solo puede invitar agentes; asignar otros roles es exclusivo de admin
    if (callerRoleName !== "admin" && requestedRoles.some((r)=>r.name.toLowerCase() !== "agent")) {
      return new Response(JSON.stringify({
        error: "Un supervisor solo puede invitar agentes"
      }), {
        status: 403,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json"
        }
      });
    }
    const roleCheck = requestedRoles.find((r)=>r.id === role_id)!;
    // 5. Verificar email duplicado
    const { data: existingUsers } = await adminClient.auth.admin.listUsers({
      perPage: 1000
    });
    const existingUser = existingUsers?.users?.find((u)=>u.email?.toLowerCase() === email);
    if (existingUser) {
      const { data: existingProfile } = await adminClient.from("profiles").select("user_id").eq("user_id", existingUser.id).maybeSingle();
      if (existingProfile) {
        return new Response(JSON.stringify({
          error: `El correo ${email} ya está registrado`
        }), {
          status: 400,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json"
          }
        });
      }
      await adminClient.auth.admin.deleteUser(existingUser.id);
    }
    // 6. Crear usuario
    const tempPassword = crypto.randomUUID().slice(0, 12) + "Aa1!";
    const { data: newUser, error: authError } = await adminClient.auth.admin.createUser({
      email,
      password: tempPassword,
      email_confirm: true,
      user_metadata: {
        nombre: nombre || email
      }
    });
    if (authError || !newUser?.user) {
      return new Response(JSON.stringify({
        error: "Error creando usuario: " + authError?.message
      }), {
        status: 400,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json"
        }
      });
    }
    // 7. Crear perfil
    const { error: upsertError } = await adminClient.from("profiles").upsert({
      user_id: newUser.user.id,
      nombre: nombre || email,
      telefono: telefono || null,
      role_id
    }, {
      onConflict: "user_id"
    });
    if (upsertError) {
      await adminClient.auth.admin.deleteUser(newUser.user.id);
      return new Response(JSON.stringify({
        error: "Error creando perfil: " + upsertError.message
      }), {
        status: 500,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json"
        }
      });
    }
    // 8. Role assignments adicionales
    if (extraRoleIds.length > 0) {
      const { error: rolesError } = await adminClient.from("user_role_assignments").insert(extraRoleIds.map((rid)=>({
          user_id: newUser.user.id,
          role_id: rid
        })));
      if (rolesError) {
        await adminClient.auth.admin.deleteUser(newUser.user.id);
        return new Response(JSON.stringify({
          error: "Error asignando roles: " + rolesError.message
        }), {
          status: 500,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json"
          }
        });
      }
    }
    // 9. cat_agentes para agents
    if (roleCheck.name.toLowerCase() === "agent") {
      await adminClient.from("cat_agentes").upsert({
        user_id: newUser.user.id,
        nombre: nombre || email,
        activo: true
      });
    }
    return new Response(JSON.stringify({
      success: true,
      user: {
        id: newUser.user.id
      },
      temp_password: tempPassword
    }), {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json"
      }
    });
  } catch (err) {
    console.error("Unhandled:", err.message);
    return new Response(JSON.stringify({
      error: "Error interno: " + err.message
    }), {
      status: 500,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json"
      }
    });
  }
});
