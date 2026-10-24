import { keepPreviousData, useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

function sanitizeSearch(text: string): string {
  return text.replace(/[%()]/g, "").trim();
}

export function useClients(search: string, pagination: { page: number; pageSize: number }) {
  const { page, pageSize } = pagination;
  return useQuery({
    queryKey: ["clientes", search, page, pageSize],
    placeholderData: keepPreviousData,
    queryFn: async () => {
      const from = (page - 1) * pageSize;
      let query = supabase
        .from("clientes")
        .select("*", { count: "exact" })
        .order("id", { ascending: false })
        .range(from, from + pageSize - 1);
      if (search) {
        const safe = sanitizeSearch(search);
        if (safe) {
          query = query.or(`identificacion.ilike.%${safe}%,nombre_contacto.ilike.%${safe}%,razon_social.ilike.%${safe}%`);
        }
      }
      const { data, error, count } = await query;
      if (error) throw error;
      const totalCount = count ?? 0;
      return { rows: data, totalCount, totalPages: Math.max(1, Math.ceil(totalCount / pageSize)) };
    },
  });
}

export function useCreateClient() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (values: {
      identificacion: string;
      nombre_contacto: string;
      tipo_cliente: string;
      razon_social?: string;
      telefono?: string;
      celular?: string;
      correo?: string;
    }) => {
      const { data, error } = await supabase.from("clientes").insert(values).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["clientes"] }),
  });
}

export function useUpdateClient() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...values }: {
      id: number;
      identificacion: string;
      nombre_contacto: string;
      tipo_cliente: string;
      razon_social?: string | null;
      telefono?: string | null;
      celular?: string | null;
      correo?: string | null;
    }) => {
      const { data, error } = await supabase.from("clientes").update(values).eq("id", id).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["clientes"] }),
  });
}
