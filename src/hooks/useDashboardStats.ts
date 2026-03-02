import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface CampaignStats {
  campanaId: string;
  campanaNombre: string;
  openCount: number;
  closedTodayCount: number;
  sinAsignar: number;
  enRiesgo: number;
  vencidos: number;
}

/**
 * Fetches all cases for given campaign IDs and computes per-campaign KPIs.
 * slaConfigs is a map of campanaId → { horas_riesgo, horas_vencido }
 */
export function useDashboardStats(
  campanaIds: string[],
  campanaNombres: Record<string, string>,
  slaConfigs: Record<string, { horas_riesgo: number; horas_vencido: number }>
) {
  return useQuery({
    queryKey: ["dashboard-stats-v2", campanaIds],
    enabled: campanaIds.length > 0,
    refetchInterval: 60000,
    queryFn: async () => {
      // Fetch all cases for the given campaigns
      const { data: allCases, error } = await supabase
        .from("casos")
        .select("id, estado_id, agente_id, fecha_caso, fecha_cierre, campana_id, valor_pagar, cat_estados(nombre, es_final)")
        .in("campana_id", campanaIds);

      if (error) throw error;

      const today = new Date().toISOString().slice(0, 10);
      const now = Date.now();

      const statsByCampaign: CampaignStats[] = campanaIds.map((cid) => {
        const cases = (allCases || []).filter((c: any) => c.campana_id === cid);
        const config = slaConfigs[cid] || { horas_riesgo: 2, horas_vencido: 6 };

        const openCases = cases.filter((c: any) => !c.cat_estados?.es_final);
        const closedToday = cases.filter(
          (c: any) => c.cat_estados?.es_final && c.fecha_cierre?.slice(0, 10) === today
        );
        const sinAsignar = openCases.filter((c: any) => !c.agente_id);

        let enRiesgo = 0;
        let vencidos = 0;
        openCases.forEach((c: any) => {
          const hours = (now - new Date(c.fecha_caso).getTime()) / (1000 * 60 * 60);
          if (hours >= config.horas_vencido) vencidos++;
          else if (hours >= config.horas_riesgo) enRiesgo++;
        });

        return {
          campanaId: cid,
          campanaNombre: campanaNombres[cid] || cid,
          openCount: openCases.length,
          closedTodayCount: closedToday.length,
          sinAsignar: sinAsignar.length,
          enRiesgo,
          vencidos,
        };
      });

      return {
        byCampaign: statsByCampaign,
        allCases: allCases || [],
        totalVencidos: statsByCampaign.reduce((s, c) => s + c.vencidos, 0),
        totalSinAsignar: statsByCampaign.reduce((s, c) => s + c.sinAsignar, 0),
      };
    },
  });
}
