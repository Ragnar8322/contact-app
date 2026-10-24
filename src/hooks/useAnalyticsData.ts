import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { fetchAllPages } from "@/lib/fetchAllPages";
import {
  computeAnalytics,
  type AnalyticsData,
  type CasoAnalitica,
  type ClienteAnalitica,
  type GestionAnalitica,
} from "@/lib/analytics";

export type {
  AnalyticsData,
  TramiteRenovado,
  PendientePago,
  RecaudoPorFecha,
  RendimientoAgente,
  ResumenCampana,
} from "@/lib/analytics";

export interface AnalyticsQueryFilters {
  dateFrom: Date;
  dateTo: Date;
  campanaId?: string | null;
  agenteId?: string | null;
  estadoId?: number | null;
}

// Los filtros .in() van en lotes para no exceder el largo de la URL
const CHUNK = 500;
function chunks<T>(items: T[]): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += CHUNK) out.push(items.slice(i, i + CHUNK));
  return out;
}

export function useAnalyticsData(filters: AnalyticsQueryFilters) {
  const { dateFrom, dateTo, campanaId, agenteId, estadoId } = filters;

  return useQuery({
    queryKey: [
      "analytics",
      dateFrom.toISOString(),
      dateTo.toISOString(),
      campanaId ?? null,
      agenteId ?? null,
      estadoId ?? null,
    ],
    queryFn: async (): Promise<AnalyticsData> => {
      const fromStr = format(dateFrom, "yyyy-MM-dd") + "T00:00:00";
      const toStr   = format(dateTo,   "yyyy-MM-dd") + "T23:59:59";

      // 1. Casos del período (paginados)
      const casos: CasoAnalitica[] = await fetchAllPages((from, to) => {
        let q = supabase
          .from("casos")
          .select(`
            id,
            agente_id,
            cliente_id,
            valor_pagar,
            fecha_caso,
            created_at,
            cat_estados(nombre),
            cat_agentes(nombre),
            campanas(nombre)
          `)
          .gte("fecha_caso", fromStr)
          .lte("fecha_caso", toStr)
          .range(from, to);

        if (campanaId) q = q.eq("campana_id", campanaId);
        if (agenteId)  q = q.eq("agente_id", agenteId);
        if (estadoId)  q = q.eq("estado_id", estadoId);
        return q;
      });

      // 2. Gestiones (historial) de esos casos dentro del período
      const gestiones: GestionAnalitica[] = [];
      for (const lote of chunks(casos.map((c) => c.id))) {
        gestiones.push(...await fetchAllPages((from, to) => {
          let q = supabase
            .from("caso_historial")
            .select("agente_id, agente_nombre, cambiado_en")
            .in("caso_id", lote)
            .gte("cambiado_en", fromStr)
            .lte("cambiado_en", toStr)
            .not("agente_id", "is", null)
            .range(from, to);

          if (agenteId) q = q.eq("agente_id", agenteId);
          return q;
        }));
      }

      // 3. Clientes que aparecen en los casos
      const clientes: ClienteAnalitica[] = [];
      for (const lote of chunks([...new Set(casos.map((c) => c.cliente_id))])) {
        const { data, error } = await supabase
          .from("clientes")
          .select("id, tipo_cliente, identificacion, nombre_contacto, razon_social")
          .in("id", lote);
        if (error) throw error;
        clientes.push(...(data ?? []));
      }

      // 4. Nombres de los agentes (casos + historial)
      const agentIds = new Set<string>();
      casos.forEach((c) => c.agente_id && agentIds.add(c.agente_id));
      gestiones.forEach((h) => h.agente_id && agentIds.add(h.agente_id));
      const nombresAgentes = new Map<string, string>();
      for (const lote of chunks([...agentIds])) {
        const { data, error } = await supabase
          .from("profiles")
          .select("user_id, nombre")
          .in("user_id", lote);
        if (error) throw error;
        (data ?? []).forEach((p) => nombresAgentes.set(p.user_id, p.nombre));
      }

      return computeAnalytics({ casos, gestiones, clientes, nombresAgentes, dateFrom, dateTo });
    },
  });
}
