import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface SLAConfig {
  horas_riesgo: number;
  horas_vencido: number;
}

const QUERY_RESILIENCE = {
  staleTime: 5 * 60 * 1000,
  gcTime: 10 * 60 * 1000,
  retry: 2,
  retryDelay: 3000,
  refetchInterval: 60_000,
};

/** Fetch ALL SLA configs for multiple campaigns in a single query */
export function useSLAConfigs(campanaIds: string[]) {
  return useQuery<Record<string, SLAConfig>>({
    queryKey: ["sla-configs-bulk", campanaIds],
    enabled: campanaIds.length > 0,
    ...QUERY_RESILIENCE,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sla_config")
        .select("campana_id, horas_riesgo, horas_vencido")
        .in("campana_id", campanaIds)
        .eq("activo", true);
      if (error) throw error;
      const map: Record<string, SLAConfig> = {};
      (data ?? []).forEach((row) => {
        if (row.campana_id) {
          map[row.campana_id] = {
            horas_riesgo: row.horas_riesgo ?? 2,
            horas_vencido: row.horas_vencido ?? 6,
          };
        }
      });
      return map;
    },
  });
}
