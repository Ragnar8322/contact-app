import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

function sanitizeSearch(text: string): string {
  return text.replace(/[%()]/g, "").trim();
}

export function useClients(search?: string) {
  return useQuery({
    queryKey: ["clientes", search],
    queryFn: async () => {
      let query = supabase.from("clientes").select("*").order("id", { ascending: false });
      if (search) {
        const safe = sanitizeSearch(search);
        if (safe) {
          query = query.or(`identificacion.ilike.%${safe}%,nombre_contacto.ilike.%${safe}%,razon_social.ilike.%${safe}%`);
        }
      }
      const { data, error } = await query;
      if (error) throw error;
      return data;
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
