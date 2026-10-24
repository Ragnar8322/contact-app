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
 * QUERY_RESILIENCE:
 * - staleTime 0: los datos del dashboard siempre se re-fetchen al montar el componente
 *   (antes era 5 min, por eso los contadores de casos/agentes no se actualizaban)
 * - refetchInterval 30s: refresco automático cada 30 segundos en lugar de 60s
 * - gcTime 10 min: mantiene caché en memoria aunque el componente se desmonte
 */
export const QUERY_RESILIENCE = {
  staleTime: 0,              // BUG FIX: era 5*60*1000 → datos nunca se refrescaban al volver al dashboard
  gcTime: 10 * 60 * 1000,
  retry: 2,
  retryDelay: 3000,
  refetchInterval: 30_000,   // BUG FIX: era 60_000 → intervalo reducido a 30s para mejor reactividad
  refetchOnWindowFocus: true, // BUG FIX: refresca al volver al tab/ventana
  refetchOnMount: true,       // BUG FIX: siempre re-fetcha al montar
};

/** Zona horaria del navegador, para que "cerrados hoy" use el día local del usuario. */
export function localTimeZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || "America/Bogota";
}

/**
 * Indicadores por campaña calculados en la base de datos (dashboard_stats).
 * Antes se descargaban todos los casos y se contaban aquí, pero la API corta
 * en 1.000 filas: con 10.625 casos el Dashboard mostraba 267 abiertos de 1.121.
 */
export function useDashboardStats(campanaIds: string[], campanaNombres: Record<string, string>) {
  return useQuery({
    queryKey: ["dashboard-stats-v3", campanaIds],
    enabled: campanaIds.length > 0,
    ...QUERY_RESILIENCE,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("dashboard_stats", {
        p_campana_ids: campanaIds,
        p_tz: localTimeZone(),
      });
      if (error) throw error;

      const byId = new Map((data ?? []).map((r) => [r.campana_id, r]));
      const byCampaign: CampaignStats[] = campanaIds.map((cid) => {
        const r = byId.get(cid);
        return {
          campanaId: cid,
          campanaNombre: campanaNombres[cid] || cid,
          openCount: r?.abiertos ?? 0,
          closedTodayCount: r?.cerrados_hoy ?? 0,
          sinAsignar: r?.sin_asignar ?? 0,
          enRiesgo: r?.en_riesgo ?? 0,
          vencidos: r?.vencidos ?? 0,
        };
      });

      return {
        byCampaign,
        totalVencidos: byCampaign.reduce((s, c) => s + c.vencidos, 0),
        totalSinAsignar: byCampaign.reduce((s, c) => s + c.sinAsignar, 0),
      };
    },
  });
}

/** Casos activos y vencidos por agente (dashboard_agent_stats). */
export function useDashboardAgentStats(campanaIds: string[]) {
  return useQuery({
    queryKey: ["dashboard-agent-stats", campanaIds],
    enabled: campanaIds.length > 0,
    ...QUERY_RESILIENCE,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("dashboard_agent_stats", { p_campana_ids: campanaIds });
      if (error) throw error;
      const map: Record<string, { activos: number; vencidos: number }> = {};
      (data ?? []).forEach((r) => { map[r.agente_id] = { activos: r.activos, vencidos: r.vencidos }; });
      return map;
    },
  });
}

export type RecentCasesFilter = "vencidos" | "sinAsignar" | null;

/**
 * Los 10 casos actualizados más recientemente de la campaña, con el filtro
 * de la alerta aplicado en la consulta (antes se filtraba sobre 1.000 filas).
 */
export function useRecentCases(campanaId: string | null | undefined, filter: RecentCasesFilter, horasVencido: number) {
  return useQuery({
    queryKey: ["dashboard-recent-cases", campanaId, filter, horasVencido],
    enabled: !!campanaId,
    ...QUERY_RESILIENCE,
    queryFn: async () => {
      let query = supabase
        .from("casos")
        .select("id, agente_id, fecha_caso, updated_at, cat_estados!inner(nombre, es_final), clientes(nombre_contacto)")
        .eq("campana_id", campanaId!)
        .order("updated_at", { ascending: false, nullsFirst: false })
        .limit(10);

      if (filter === "vencidos") {
        const limite = new Date(Date.now() - horasVencido * 3600_000).toISOString();
        query = query.eq("cat_estados.es_final", false).lte("fecha_caso", limite);
      } else if (filter === "sinAsignar") {
        query = query.eq("cat_estados.es_final", false).is("agente_id", null);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data ?? [];
    },
  });
}
