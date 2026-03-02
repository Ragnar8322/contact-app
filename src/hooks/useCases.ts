import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface CasesFilters {
  estadoIds?: number[];
  tipoServicioId?: number | null;
  agenteId?: string | null;
  fechaDesde?: string | null;
  fechaHasta?: string | null;
  campanaId?: string | null;
}

export function useCases(filters?: CasesFilters) {
  return useQuery({
    queryKey: ["casos", filters],
    queryFn: async () => {
      let query = supabase
        .from("casos")
        .select("*, clientes(nombre_contacto, razon_social, identificacion), cat_estados(nombre, es_final), cat_tipo_servicio(nombre), cat_agentes(nombre)")
        .order("fecha_caso", { ascending: false });

      if (filters?.estadoIds && filters.estadoIds.length > 0) {
        query = query.in("estado_id", filters.estadoIds);
      }
      if (filters?.tipoServicioId) {
        query = query.eq("tipo_servicio_id", filters.tipoServicioId);
      }
      if (filters?.agenteId) {
        query = query.eq("agente_id", filters.agenteId);
      }
      if (filters?.fechaDesde) {
        query = query.gte("fecha_caso", filters.fechaDesde);
      }
      if (filters?.fechaHasta) {
        query = query.lte("fecha_caso", filters.fechaHasta + "T23:59:59.999Z");
      }
      if (filters?.campanaId) {
        query = query.eq("campana_id", filters.campanaId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });
}

export function useCaseById(id: number | null) {
  return useQuery({
    queryKey: ["caso", id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("casos")
        .select("*, clientes(nombre_contacto, razon_social, identificacion), cat_estados(nombre, es_final), cat_tipo_servicio(nombre), cat_agentes(nombre)")
        .eq("id", id!)
        .single();
      if (error) throw error;
      return data;
    },
  });
}

export function useCreateCase() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (values: {
      cliente_id: number;
      tipo_servicio_id: number;
      descripcion_inicial: string;
      agente_id: string;
      created_by: string;
      estado_id: number;
      valor_pagar?: number | null;
      campana_id?: string | null;
    }) => {
      const { data, error } = await supabase.from("casos").insert(values).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["casos"] }),
  });
}

export function useUpdateCase() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...values }: { id: number; estado_id?: number; observacion_cierre?: string; updated_by: string; fecha_cierre?: string; valor_pagar?: number | null }) => {
      const { data, error } = await supabase.from("casos").update(values).eq("id", id).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["casos"] });
      qc.invalidateQueries({ queryKey: ["caso"] });
    },
  });
}

export function useInsertHistorial() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (values: { caso_id: number; estado_id: number; cambiado_por: string; comentario?: string }) => {
      const { error } = await supabase.from("caso_historial").insert(values);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["historial"] }),
  });
}

export function useCaseHistory(casoId: number | null) {
  return useQuery({
    queryKey: ["historial", casoId],
    enabled: !!casoId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("caso_historial")
        .select("*, cat_estados(nombre), profiles!caso_historial_cambiado_por_fkey(nombre)")
        .eq("caso_id", casoId!)
        .order("cambiado_en", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
}

export function useEstados() {
  return useQuery({
    queryKey: ["estados"],
    queryFn: async () => {
      const { data, error } = await supabase.from("cat_estados").select("*").order("id");
      if (error) throw error;
      return data;
    },
  });
}

export function useTiposServicio() {
  return useQuery({
    queryKey: ["tipos_servicio"],
    queryFn: async () => {
      const { data, error } = await supabase.from("cat_tipo_servicio").select("*").order("id");
      if (error) throw error;
      return data;
    },
  });
}

export function useAgentes() {
  return useQuery({
    queryKey: ["agentes"],
    queryFn: async () => {
      const { data, error } = await supabase.from("cat_agentes").select("*").eq("activo", true);
      if (error) throw error;
      return data;
    },
  });
}
