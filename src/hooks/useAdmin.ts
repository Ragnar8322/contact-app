import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

// ── Profiles ──
export function useAllProfiles() {
  return useQuery({
    queryKey: ["admin-profiles"],
    queryFn: async () => {
      // Fetch profiles
      const { data: profiles, error } = await supabase
        .from("profiles")
        .select("*, user_roles(name)")
        .order("created_at", { ascending: false });
      if (error) throw error;

      // Fetch all role assignments
      const { data: assignments } = await supabase
        .from("user_role_assignments")
        .select("user_id, role_id, user_roles(id, name)");

      // Group assignments by user_id
      const assignmentsByUser: Record<string, { role_id: number; role_name: string }[]> = {};
      assignments?.forEach(a => {
        if (!assignmentsByUser[a.user_id]) assignmentsByUser[a.user_id] = [];
        assignmentsByUser[a.user_id].push({
          role_id: a.role_id,
          role_name: (a.user_roles as any)?.name || "",
        });
      });

      // Attach assignments to profiles
      return profiles?.map(p => ({
        ...p,
        role_assignments: assignmentsByUser[p.user_id] || [],
      }));
    },
  });
}

export function useUpdateProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ user_id, ...values }: { user_id: string; nombre?: string; telefono?: string; role_id?: number }) => {
      const { error } = await supabase.from("profiles").update(values).eq("user_id", user_id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-profiles"] }),
  });
}

export function useSaveRoleAssignments() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ user_id, role_ids }: { user_id: string; role_ids: number[] }) => {
      // Delete existing assignments
      const { error: deleteError } = await supabase
        .from("user_role_assignments")
        .delete()
        .eq("user_id", user_id);
      if (deleteError) throw deleteError;

      // Insert new assignments
      if (role_ids.length > 0) {
        const { error: insertError } = await supabase
          .from("user_role_assignments")
          .insert(role_ids.map(role_id => ({ user_id, role_id })));
        if (insertError) throw insertError;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-profiles"] }),
  });
}

export function useInviteUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (values: { email: string; nombre: string; telefono?: string; role_id: number; role_ids?: number[] }) => {
      // Obtener sesión activa y pasar token explícitamente para evitar el error "Failed to send"
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Sesión expirada. Por favor recarga la página e inicia sesión nuevamente.");

      const { data, error } = await supabase.functions.invoke("invite-user", {
        body: values,
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      // Role assignments are already saved by the edge function
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-profiles"] }),
  });
}

// ── All Roles ──
export function useRoles() {
  return useQuery({
    queryKey: ["user-roles"],
    queryFn: async () => {
      const { data, error } = await supabase.from("user_roles").select("*").order("id");
      if (error) throw error;
      return data;
    },
  });
}

// ── All Cases (admin) ──
export function useAllCases(filters?: {
  estado_id?: number;
  agente_id?: string;
  from?: string;
  to?: string;
  page?: number;
  pageSize?: number;
}) {
  const page = filters?.page ?? 0;
  const pageSize = filters?.pageSize ?? 50;

  return useQuery({
    queryKey: ["admin-cases", filters],
    queryFn: async () => {
      let q = supabase
        .from("casos")
        .select(
          "*, clientes(nombre_contacto, identificacion, telefono, celular, correo), cat_estados(nombre, es_final), cat_tipo_servicio(nombre), cat_agentes(nombre)",
          { count: "exact" }
        )
        .order("fecha_caso", { ascending: false })
        .range(page * pageSize, Math.min((page + 1) * pageSize - 1, 49999)); // máx 50.000 registros

      if (filters?.estado_id) q = q.eq("estado_id", filters.estado_id);
      if (filters?.agente_id) q = q.eq("agente_id", filters.agente_id);
      if (filters?.from) q = q.gte("fecha_caso", filters.from);
      if (filters?.to) q = q.lte("fecha_caso", filters.to);

      const { data, error, count } = await q;
      if (error) throw error;
      return { data, count, page, pageSize };
    },
  });
}

export function useAdminUpdateCase() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...values }: { id: number; estado_id?: number; agente_id?: string; tipo_servicio_id?: number; observacion_cierre?: string; updated_by: string; fecha_cierre?: string; valor_pagar?: number | null }) => {
      const { error } = await supabase.from("casos").update(values).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-cases"] }),
  });
}

// ── Catalogs ──
export function useCreateEstado() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (values: { nombre: string; es_final: boolean }) => {
      const { error } = await supabase.from("cat_estados").insert(values);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["estados"] }),
  });
}

export function useUpdateEstado() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...values }: { id: number; nombre?: string; es_final?: boolean }) => {
      const { error } = await supabase.from("cat_estados").update(values).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["estados"] }),
  });
}

export function useCreateTipoServicio() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (values: { nombre: string }) => {
      const { error } = await supabase.from("cat_tipo_servicio").insert(values);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tipos_servicio"] }),
  });
}

export function useUpdateTipoServicio() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...values }: { id: number; nombre?: string }) => {
      const { error } = await supabase.from("cat_tipo_servicio").update(values).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tipos_servicio"] }),
  });
}

export function useDeleteTipoServicio() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      const { error } = await supabase.from("cat_tipo_servicio").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tipos_servicio"] }),
  });
}

// ── Update Client ──
export function useUpdateClient() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...values }: { id: number; identificacion?: string; nombre_contacto?: string; tipo_cliente?: string; razon_social?: string; telefono?: string; celular?: string; correo?: string }) => {
      const { error } = await supabase.from("clientes").update(values).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["clientes"] }),
  });
}
