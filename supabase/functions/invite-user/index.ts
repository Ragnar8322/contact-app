import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "No autorizado: falta token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // 1. Verificar sesión del caller
    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user: caller }, error: callerError } = await callerClient.auth.getUser();
    if (!caller || callerError) {
      return new Response(JSON.stringify({ error: "Sesion invalida o expirada" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    // 2. Verificar rol del caller
    const { data: callerProfile, error: profileFetchError } = await adminClient
      .from("profiles")
      .select("role_id, user_roles(name)")
      .eq("user_id", caller.id)
      .maybeSingle();

    console.log("DEBUG caller_id:", caller.id, "| profile:", JSON.stringify(callerProfile), "| fetchError:", profileFetchError?.message);

    const callerRoleName = ((callerProfile?.user_roles as any)?.name ?? "").toLowerCase();

    if (!["admin", "supervisor"].includes(callerRoleName)) {
      return new Response(JSON.stringify({
        error: `Sin permisos. Tu rol es: ${callerRoleName || "sin perfil"}`
      }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 3. Leer body
    const { email, nombre, telefono, role_id, role_ids } = await req.json();

    if (!email || !role_id) {
      return new Response(JSON.stringify({ error: "email y role_id son obligatorios" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 4. Validar que el role_id existe
    const { data: roleCheck } = await adminClient
      .from("user_roles")
      .select("id, name")
      .eq("id", role_id)
      .maybeSingle();

    if (!roleCheck) {
      return new Response(JSON.stringify({ error: "Rol no encontrado con id: " + role_id }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 5. Verificar si el email ya existe — búsqueda filtrada server-side (no listUsers masivo)
    // Usa el endpoint REST con ?filter= para traer solo 1 resultado en vez de hasta 1000 usuarios
    const filterRes = await fetch(
      `${supabaseUrl}/auth/v1/admin/users?filter=${encodeURIComponent(email)}&page=1&per_page=1`,
      {
        headers: {
          Authorization: `Bearer ${serviceRoleKey}`,
          apikey: serviceRoleKey,
        },
      }
    );
    const filterData = await filterRes.json();
    const existingUser = filterData?.users?.[0] || null;

    if (existingUser) {
      const { data: existingProfile } = await adminClient
        .from("profiles")
        .select("user_id")
        .eq("user_id", existingUser.id)
        .maybeSingle();

      if (existingProfile) {
        return new Response(JSON.stringify({
          error: `El correo ${email} ya esta registrado en el sistema`
        }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      await adminClient.auth.admin.deleteUser(existingUser.id);
    }

    // 6. Crear usuario con contraseña temporal
    const tempPassword = crypto.randomUUID().slice(0, 12) + "Aa1!";
    const { data: newUser, error: authError } = await adminClient.auth.admin.createUser({
      email,
      password: tempPassword,
      email_confirm: true,
      user_metadata: { nombre: nombre || email },
    });

    if (authError) {
      return new Response(JSON.stringify({ error: "Error creando usuario: " + authError.message }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (newUser?.user) {
      // 7. Crear perfil
      const { error: upsertError } = await adminClient
        .from("profiles")
        .upsert({
          user_id: newUser.user.id,
          nombre: nombre || email,
          telefono: telefono || null,
          role_id,
        }, { onConflict: "user_id" });

      if (upsertError) {
        await adminClient.auth.admin.deleteUser(newUser.user.id);
        return new Response(JSON.stringify({ error: "Error creando perfil: " + upsertError.message }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // 8. Roles adicionales
      if (role_ids && Array.isArray(role_ids) && role_ids.length > 0) {
        await adminClient
          .from("user_role_assignments")
          .insert(role_ids.map((rid: number) => ({ user_id: newUser.user!.id, role_id: rid })));
      }

      // 9. cat_agentes solo para agentes
      if (roleCheck.name.toLowerCase() === "agent") {
        await adminClient
          .from("cat_agentes")
          .upsert({ user_id: newUser.user.id, nombre: nombre || email, activo: true });
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        user: { id: newUser.user?.id },
        temp_password: tempPassword,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (err) {
    return new Response(JSON.stringify({ error: "Error interno: " + (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
