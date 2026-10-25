import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders } from "../_shared/cors.ts";
import { validarContrasena } from "../_shared/password.ts";
import { reportarError } from "../_shared/monitoring.ts";

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const rawToken = (req.headers.get("Authorization") ?? "").replace("Bearer ", "").trim();

    // Si el token es la anon key, el cliente no tiene sesión activa
    if (!rawToken || rawToken === anonKey) {
      return json({ error: "Sesión no encontrada. Por favor cierra sesión, vuelve a iniciarla y reintenta." }, 401);
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });

    // 1. Validar el JWT del caller
    const { data: { user: caller }, error: callerError } = await adminClient.auth.getUser(rawToken);
    if (!caller || callerError) {
      return json({ error: "Sesión inválida o expirada. Recarga la página." }, 401);
    }

    // 2. Verificar rol del caller (profiles.role_id es el rol más alto de user_role_assignments)
    const { data: callerProfile } = await adminClient
      .from("profiles").select("role_id, user_roles(name)").eq("user_id", caller.id).maybeSingle();
    const callerRoleName = ((callerProfile?.user_roles as { name?: string } | null)?.name ?? "").toLowerCase();
    if (!["admin", "supervisor"].includes(callerRoleName)) {
      return json({ error: `Sin permisos. Tu rol: ${callerRoleName || "sin perfil"}` }, 403);
    }

    // 3. Leer y validar el body
    const body = await req.json();
    const { nombre, telefono, role_id, role_ids } = body;
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    if (!email || !role_id) {
      return json({ error: "email y role_id son obligatorios" }, 400);
    }

    // La contraseña temporal la genera el navegador del admin y no se devuelve en la respuesta.
    // Compatibilidad: el frontend anterior no la envía; en ese caso se genera aquí y se devuelve
    // como antes. Se puede retirar cuando el frontend nuevo esté en producción.
    const enviada = body.temp_password !== undefined;
    if (enviada) {
      const invalida = validarContrasena(body.temp_password);
      if (invalida) return json({ error: invalida }, 400);
    }
    const tempPassword: string = enviada ? body.temp_password : crypto.randomUUID().slice(0, 12) + "Aa1!";

    // 4. Validar que todos los roles existen y que el caller puede asignarlos
    const extraRoleIds: number[] = Array.isArray(role_ids) ? role_ids : [];
    const requestedRoleIds = [...new Set([role_id, ...extraRoleIds])];
    const { data: requestedRoles } = await adminClient.from("user_roles").select("id, name").in("id", requestedRoleIds);
    if (!requestedRoles || requestedRoles.length !== requestedRoleIds.length) {
      return json({ error: "Uno o más roles no existen" }, 400);
    }
    // Un supervisor solo puede invitar agentes; asignar otros roles es exclusivo de admin
    if (callerRoleName !== "admin" && requestedRoles.some((r) => r.name.toLowerCase() !== "agent")) {
      return json({ error: "Un supervisor solo puede invitar agentes" }, 403);
    }
    const roleCheck = requestedRoles.find((r) => r.id === role_id)!;

    // 5. Verificar email duplicado
    const { data: existingUsers } = await adminClient.auth.admin.listUsers({ perPage: 1000 });
    const existingUser = existingUsers?.users?.find((u) => u.email?.toLowerCase() === email);
    if (existingUser) {
      const { data: existingProfile } = await adminClient
        .from("profiles").select("user_id").eq("user_id", existingUser.id).maybeSingle();
      if (existingProfile) {
        return json({ error: `El correo ${email} ya está registrado` }, 400);
      }
      await adminClient.auth.admin.deleteUser(existingUser.id);
    }

    // 6. Crear usuario
    const { data: newUser, error: authError } = await adminClient.auth.admin.createUser({
      email,
      password: tempPassword,
      email_confirm: true,
      user_metadata: { nombre: nombre || email },
    });
    if (authError || !newUser?.user) {
      return json({ error: "Error creando usuario: " + authError?.message }, 400);
    }

    // 7. Crear perfil: debe cambiar la contraseña temporal al entrar
    const { error: upsertError } = await adminClient.from("profiles").upsert({
      user_id: newUser.user.id,
      nombre: nombre || email,
      telefono: telefono || null,
      role_id,
      must_change_password: true,
    }, { onConflict: "user_id" });
    if (upsertError) {
      await adminClient.auth.admin.deleteUser(newUser.user.id);
      await reportarError(upsertError, "invite-user", { paso: "perfil" });
      return json({ error: "Error creando perfil: " + upsertError.message }, 500);
    }

    // 8. Role assignments adicionales
    if (extraRoleIds.length > 0) {
      const { error: rolesError } = await adminClient.from("user_role_assignments").insert(
        extraRoleIds.map((rid) => ({ user_id: newUser.user.id, role_id: rid })),
      );
      if (rolesError) {
        await adminClient.auth.admin.deleteUser(newUser.user.id);
        await reportarError(rolesError, "invite-user", { paso: "roles" });
        return json({ error: "Error asignando roles: " + rolesError.message }, 500);
      }
    }

    // 9. cat_agentes para agents
    if (roleCheck.name.toLowerCase() === "agent") {
      await adminClient.from("cat_agentes").upsert({ user_id: newUser.user.id, nombre: nombre || email, activo: true });
    }

    return json({ success: true, user: { id: newUser.user.id }, ...(enviada ? {} : { temp_password: tempPassword }) });
  } catch (err) {
    await reportarError(err, "invite-user");
    return json({ error: "Error interno: " + (err instanceof Error ? err.message : String(err)) }, 500);
  }
});
