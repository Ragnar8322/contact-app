import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders } from "../_shared/cors.ts";
import { validarContrasena } from "../_shared/password.ts";
import { reportarError } from "../_shared/monitoring.ts";

type AdminClient = ReturnType<typeof createClient>;

function esCorreoDuplicado(err: { code?: string; status?: number; message?: string }): boolean {
  return err.code === "email_exists" || err.code === "user_already_exists" ||
    /already (been )?registered|already exists/i.test(err.message ?? "");
}

/** Busca un usuario de Auth por correo recorriendo todas las páginas (solo se usa si el correo ya existe). */
async function buscarUsuarioPorCorreo(admin: AdminClient, email: string) {
  const porPagina = 1000;
  for (let page = 1; page <= 100; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: porPagina });
    if (error) throw error;
    const hallado = data.users.find((u) => u.email?.toLowerCase() === email);
    if (hallado) return hallado;
    if (data.users.length < porPagina) return null;
  }
  return null;
}

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
    if (!Number.isInteger(role_id) || !extraRoleIds.every(Number.isInteger)) {
      return json({ error: "role_id y role_ids deben ser números enteros" }, 400);
    }
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

    // 5. Crear el usuario. El correo duplicado lo detecta Auth con un error `email_exists`:
    //    no se lista a todos los usuarios (listUsers pagina y dejaría de ver duplicados al pasar de 1000).
    let creado = await adminClient.auth.admin.createUser({
      email,
      password: tempPassword,
      email_confirm: true,
      user_metadata: { nombre: nombre || email },
    });

    if (creado.error && esCorreoDuplicado(creado.error)) {
      const existente = await buscarUsuarioPorCorreo(adminClient, email);
      if (existente) {
        const { data: perfil } = await adminClient
          .from("profiles").select("user_id").eq("user_id", existente.id).maybeSingle();
        if (perfil) return json({ error: `El correo ${email} ya está registrado` }, 400);
        // Restos de una invitación interrumpida: sin perfil y sin haber iniciado sesión nunca.
        // Cualquier otro usuario de Auth sin perfil no se toca: podría ser una cuenta real.
        if (existente.last_sign_in_at) {
          return json({ error: `El correo ${email} ya existe en el sistema de acceso sin perfil. Contacta a soporte.` }, 409);
        }
        const { error: delError } = await adminClient.auth.admin.deleteUser(existente.id);
        if (delError) {
          await reportarError(delError, "invite-user", { paso: "limpiar-huerfano" });
          return json({ error: "No se pudo limpiar una invitación anterior incompleta. Reintenta." }, 500);
        }
        creado = await adminClient.auth.admin.createUser({
          email,
          password: tempPassword,
          email_confirm: true,
          user_metadata: { nombre: nombre || email },
        });
      } else {
        return json({ error: `El correo ${email} ya está registrado` }, 400);
      }
    }
    if (creado.error || !creado.data?.user) {
      return json({ error: "Error creando usuario: " + creado.error?.message }, 400);
    }
    const newUser = creado.data;

    // Todo lo que sigue es parte de la misma invitación: si un paso falla se deshace entera.
    // profiles y user_role_assignments caen en cascada con el usuario; cat_agentes no tiene FK a auth.users.
    const deshacer = async () => {
      await adminClient.from("cat_agentes").delete().eq("user_id", newUser.user.id);
      const { error } = await adminClient.auth.admin.deleteUser(newUser.user.id);
      if (error) await reportarError(error, "invite-user", { paso: "rollback" });
    };

    // 6. Crear perfil: debe cambiar la contraseña temporal al entrar
    const { error: upsertError } = await adminClient.from("profiles").upsert({
      user_id: newUser.user.id,
      nombre: nombre || email,
      telefono: telefono || null,
      role_id,
      must_change_password: true,
    }, { onConflict: "user_id" });
    if (upsertError) {
      await deshacer();
      await reportarError(upsertError, "invite-user", { paso: "perfil" });
      return json({ error: "Error creando perfil: " + upsertError.message }, 500);
    }

    // 7. Role assignments adicionales
    if (extraRoleIds.length > 0) {
      const { error: rolesError } = await adminClient.from("user_role_assignments").insert(
        extraRoleIds.map((rid) => ({ user_id: newUser.user.id, role_id: rid })),
      );
      if (rolesError) {
        await deshacer();
        await reportarError(rolesError, "invite-user", { paso: "roles" });
        return json({ error: "Error asignando roles: " + rolesError.message }, 500);
      }
    }

    // 8. cat_agentes para agents (sin esta fila el agente no puede recibir casos)
    if (requestedRoles.some((r) => r.name.toLowerCase() === "agent")) {
      const { error: agenteError } = await adminClient
        .from("cat_agentes").upsert({ user_id: newUser.user.id, nombre: nombre || email, activo: true });
      if (agenteError) {
        await deshacer();
        await reportarError(agenteError, "invite-user", { paso: "agente" });
        return json({ error: "Error registrando al agente: " + agenteError.message }, 500);
      }
    }

    return json({ success: true, user: { id: newUser.user.id }, ...(enviada ? {} : { temp_password: tempPassword }) });
  } catch (err) {
    await reportarError(err, "invite-user");
    return json({ error: "Error interno: " + (err instanceof Error ? err.message : String(err)) }, 500);
  }
});
