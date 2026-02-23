import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useClients(search?: string) {
  return useQuery({
    queryKey: ["clientes", search],
    queryFn: async () => {
      let query = supabase.from("clientes").select("*").order("id", { ascending: false });
      if (search) {
        query = query.or(`identificacion.ilike.%${search}%,nombre_contacto.ilike.%${search}%,razon_social.ilike.%${search}%`);
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
