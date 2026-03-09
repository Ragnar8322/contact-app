import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify the caller is admin
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "No authorization" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Verify caller is admin using their token
    const callerClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user: caller } } = await callerClient.auth.getUser();
    if (!caller) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check admin role
    const adminClient = createClient(supabaseUrl, serviceRoleKey);
    const { data: profile } = await adminClient
      .from("profiles")
      .select("role_id, user_roles(name)")
      .eq("user_id", caller.id)
      .maybeSingle();

    const roleName = (profile?.user_roles as any)?.name;
    if (roleName !== "admin") {
      return new Response(JSON.stringify({ error: "Admin only" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { email, nombre, telefono, role_id, role_ids } = await req.json();
    if (!email || !role_id) {
      return new Response(JSON.stringify({ error: "email and role_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Validate the role_id exists in user_roles
    const { data: roleCheck } = await adminClient
      .from("user_roles")
      .select("id, name")
      .eq("id", role_id)
      .maybeSingle();

    if (!roleCheck) {
      return new Response(JSON.stringify({ error: "Rol no encontrado en BD con id: " + role_id }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check if user already exists and handle accordingly
    const { data: existingUsers } = await adminClient.auth.admin.listUsers();
    const existingUser = existingUsers?.users?.find((u: any) => u.email === email);
    
    if (existingUser) {
      // Check if they have a profile
      const { data: existingProfile } = await adminClient
        .from("profiles")
        .select("user_id")
        .eq("user_id", existingUser.id)
        .maybeSingle();
      
      if (existingProfile) {
        return new Response(JSON.stringify({ error: "Este usuario ya existe y tiene un perfil asignado." }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      
      // User exists in Auth but has no profile - delete and recreate
      await adminClient.auth.admin.deleteUser(existingUser.id);
    }

    // Create auth user with a temporary password
    const tempPassword = crypto.randomUUID().slice(0, 12) + "Aa1!";
    const { data: newUser, error: authError } = await adminClient.auth.admin.createUser({
      email,
      password: tempPassword,
      email_confirm: true,
      user_metadata: { nombre: nombre || email },
    });

    if (authError) {
      return new Response(JSON.stringify({ error: authError.message }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Upsert profile to handle race condition with trigger
    if (newUser?.user) {
      const { error: profileError } = await adminClient
        .from("profiles")
        .upsert({
          user_id: newUser.user.id,
          nombre: nombre || email,
          telefono: telefono || null,
          role_id,
        }, { onConflict: "user_id" });

      if (profileError) {
        // Cleanup: delete the auth user if profile creation fails
        await adminClient.auth.admin.deleteUser(newUser.user.id);
        return new Response(JSON.stringify({ error: "Error creando perfil: " + profileError.message }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Save role assignments if role_ids provided
      if (role_ids && Array.isArray(role_ids) && role_ids.length > 0) {
        const { error: assignError } = await adminClient
          .from("user_role_assignments")
          .insert(role_ids.map((rid: number) => ({ user_id: newUser.user!.id, role_id: rid })));
        if (assignError) {
          console.error("Error saving role assignments:", assignError.message);
        }
      }

      // Also create cat_agentes entry
      await adminClient
        .from("cat_agentes")
        .upsert({ user_id: newUser.user.id, nombre: nombre || email, activo: true });
    }

    return new Response(
      JSON.stringify({ user: { id: newUser.user?.id }, temp_password: tempPassword }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
