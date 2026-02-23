import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useDashboardStats(userId?: string) {
  return useQuery({
    queryKey: ["dashboard-stats", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data: allCases, error } = await supabase
        .from("casos")
        .select("id, estado_id, agente_id, fecha_cierre, cat_estados(nombre, es_final)");
      if (error) throw error;

      const today = new Date().toISOString().slice(0, 10);
      const openCases = allCases?.filter((c: any) => !c.cat_estados?.es_final) || [];
      const closedToday = allCases?.filter((c: any) => c.cat_estados?.es_final && c.fecha_cierre?.slice(0, 10) === today) || [];
      const myCases = allCases?.filter((c: any) => c.agente_id === userId && !c.cat_estados?.es_final) || [];

      // Group by status
      const byStatus: Record<string, number> = {};
      allCases?.forEach((c: any) => {
        const name = c.cat_estados?.nombre || "Sin estado";
        byStatus[name] = (byStatus[name] || 0) + 1;
      });

      return {
        openCount: openCases.length,
        closedTodayCount: closedToday.length,
        myActiveCount: myCases.length,
        byStatus: Object.entries(byStatus).map(([name, count]) => ({ name, count })),
      };
    },
  });
}
