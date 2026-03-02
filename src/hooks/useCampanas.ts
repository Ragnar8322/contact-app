import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useCampanasList() {
  return useQuery({
    queryKey: ["campanas"],
    queryFn: async () => {
      const { data, error } = await supabase.from("campanas").select("*").eq("activa", true).order("nombre");
      if (error) throw error;
      return data;
    },
  });
}

export function usePerfilCampanas() {
  return useQuery({
    queryKey: ["perfil-campanas"],
    queryFn: async () => {
      const { data, error } = await supabase.from("perfil_campanas").select("*");
      if (error) throw error;
      return data;
    },
  });
}

export function useAssignCampana() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ user_id, campana_id }: { user_id: string; campana_id: string }) => {
      const { error } = await supabase.from("perfil_campanas").insert({ user_id, campana_id });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["perfil-campanas"] }),
  });
}

export function useUnassignCampana() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ user_id, campana_id }: { user_id: string; campana_id: string }) => {
      const { error } = await supabase
        .from("perfil_campanas")
        .delete()
        .eq("user_id", user_id)
        .eq("campana_id", campana_id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["perfil-campanas"] }),
  });
}
