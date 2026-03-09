import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface CasesFilters {
  estadoIds?: number[];
  tipoServicioId?: number | null;
  agenteId?: string | null;
  fechaDesde?: string | null;
  fechaHasta?: string | null;
  campanaId?: string | null;
  searchText?: string;
}

export interface PaginationParams {
  page?: number;
  pageSize?: number;
}

export interface PaginatedResult<T> {
  data: T[];
  totalCount: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

export function useCases(filters?: CasesFilters, pagination?: PaginationParams) {
  const page = pagination?.page ?? 1;
  const pageSize = pagination?.pageSize ?? 25;

  return useQuery({
    queryKey: ["casos", filters, page, pageSize],
    queryFn: async (): Promise<PaginatedResult<any>> => {
      let query = supabase
        .from("casos")
        .select("*, clientes!inner(nombre_contacto, razon_social, identificacion, telefono, celular, correo), cat_estados(nombre, es_final), cat_tipo_servicio(nombre), cat_agentes(nombre)", { count: "exact" })
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
      if (filters?.searchText) {
        query = query.or(
          `nombre_contacto.ilike.%${filters.searchText}%,identificacion.ilike.%${filters.searchText}%`,
          { referencedTable: "clientes" }
        );
      }

      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;
      query = query.range(from, to);

      const { data, error, count } = await query;
      if (error) throw error;

      const totalCount = count ?? 0;
      const totalPages = Math.ceil(totalCount / pageSize);

      return {
        data: data ?? [],
        totalCount,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      };
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
        .select("*, clientes(nombre_contacto, razon_social, identificacion, telefono, celular, correo), cat_estados(nombre, es_final), cat_tipo_servicio(nombre), cat_agentes(nombre)")
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
    mutationFn: async (values: { caso_id: number; estado_id: number; cambiado_por: string; comentario?: string; observacion?: string; agente_id?: string; agente_nombre?: string; estado_nuevo?: string }) => {
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
        .select("*, cat_estados(nombre, es_final), profiles!caso_historial_cambiado_por_fkey(nombre)")
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
