import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, eachDayOfInterval, parseISO } from "date-fns";

export interface AnalyticsData {
  totalCasos: number;
  casosRenovados: number;
  tasaRenovacion: number;
  gestionesRegistradas: number;
  totalFacturado: number;
  pendienteCobro: number;
  valorPromedio: number;
  porcentajeRecaudo: number;
  casosPorEstado: { estado: string; count: number; percentage: number }[];
  gestionesPorAgente: { agente: string; count: number }[];
  gestionesPorDia: { fecha: string; count: number }[];
  distribucionClientes: { tipo: string; count: number; percentage: number }[];
  rendimientoAgentes: {
    agente: string;
    casosAsignados: number;
    gestiones: number;
    renovados: number;
    tasaRenovacion: number;
  }[];
}

export interface AnalyticsQueryFilters {
  dateFrom: Date;
  dateTo: Date;
  campanaId?: string | null;
  agenteId?: string | null;
  estadoId?: number | null;
}

// Pagina una query de Supabase que no soporta count exacto grande
async function fetchAllPages<T>(
  buildQuery: (from: number, to: number) => any,
  pageSize = 1000
): Promise<T[]> {
  const results: T[] = [];
  let from = 0;
  while (true) {
    const { data, error } = await buildQuery(from, from + pageSize - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;
    results.push(...data);
    if (data.length < pageSize) break;
    from += pageSize;
  }
  return results;
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
      // BUG FIX #1: usar timestamps completos para que el rango incluya todo el día
      const fromStr = format(dateFrom, "yyyy-MM-dd") + "T00:00:00";
      const toStr   = format(dateTo,   "yyyy-MM-dd") + "T23:59:59";

      // ────────────────────────────────────────────────────
      // 1. CASOS: paginados, left join para no excluir casos sin agente
      // BUG FIX #5: cat_agentes!left en lugar de !inner
      // ────────────────────────────────────────────────────
      const casos = await fetchAllPages<any>((from, to) => {
        let q = supabase
          .from("casos")
          .select(`
            id,
            agente_id,
            estado_id,
            cliente_id,
            campana_id,
            valor_pagar,
            cat_estados(nombre),
            cat_agentes(nombre)
          `)
          .gte("fecha_caso", fromStr)
          .lte("fecha_caso", toStr)
          .range(from, to);

        if (campanaId) q = q.eq("campana_id", campanaId);
        if (agenteId)  q = q.eq("agente_id", agenteId);
        if (estadoId)  q = q.eq("estado_id", estadoId);
        return q;
      });

      const casosIds = new Set(casos.map((c: any) => c.id));
      const casosClienteIds = [...new Set(casos.map((c: any) => c.cliente_id as number))];

      // ────────────────────────────────────────────────────
      // 2. HISTORIAL: paginado y filtrado estrictamente
      // BUG FIX #2: filtrar historial por caso_id IN casosIds (no por fecha independiente)
      // BUG FIX #4: solo contar entradas con agente_id no nulo (gestiones reales de agentes)
      // BUG FIX #6: usar agente_id del historial para atribuir gestiones al agente correcto
      // ────────────────────────────────────────────────────
      let filteredHistorial: any[] = [];

      if (casosIds.size > 0) {
        const casosIdsArr = [...casosIds];
        // Supabase soporta .in() con hasta 1000 valores; paginamos en chunks
        const chunkSize = 500;
        for (let i = 0; i < casosIdsArr.length; i += chunkSize) {
          const chunk = casosIdsArr.slice(i, i + chunkSize);
          const partial = await fetchAllPages<any>((from, to) => {
            let q = supabase
              .from("caso_historial")
              .select("id, caso_id, cambiado_en, agente_id, agente_nombre")
              .in("caso_id", chunk)
              .gte("cambiado_en", fromStr)
              .lte("cambiado_en", toStr)
              .not("agente_id", "is", null)   // BUG FIX #4: solo gestiones de agentes
              .range(from, to);

            if (agenteId) q = q.eq("agente_id", agenteId);
            return q;
          });
          filteredHistorial.push(...partial);
        }
      }

      // ────────────────────────────────────────────────────
      // 3. CLIENTES: solo los que aparecen en los casos filtrados
      // BUG FIX #3: no traer todos los clientes con limit(5000)
      // ────────────────────────────────────────────────────
      let filteredClientes: any[] = [];

      if (casosClienteIds.length > 0) {
        const chunkSize = 500;
        for (let i = 0; i < casosClienteIds.length; i += chunkSize) {
          const chunk = casosClienteIds.slice(i, i + chunkSize);
          const { data, error } = await supabase
            .from("clientes")
            .select("id, tipo_cliente")
            .in("id", chunk);
          if (error) throw error;
          filteredClientes.push(...(data ?? []));
        }
      }

      // ────────────────────────────────────────────────────
      // 4. Mapa de nombres de agentes desde profiles (fuente de verdad)
      // BUG FIX #7: usar profiles en lugar de cat_agentes para nombres
      // ────────────────────────────────────────────────────
      const agentIdsInCasos = [...new Set(casos.map((c: any) => c.agente_id as string).filter(Boolean))];
      const agentIdsInHistorial = [...new Set(filteredHistorial.map((h: any) => h.agente_id as string).filter(Boolean))];
      const allAgentIds = [...new Set([...agentIdsInCasos, ...agentIdsInHistorial])];

      const profilesMap = new Map<string, string>();
      if (allAgentIds.length > 0) {
        const chunkSize = 500;
        for (let i = 0; i < allAgentIds.length; i += chunkSize) {
          const chunk = allAgentIds.slice(i, i + chunkSize);
          const { data, error } = await supabase
            .from("profiles")
            .select("user_id, nombre")
            .in("user_id", chunk);
          if (error) throw error;
          (data ?? []).forEach((p: any) => profilesMap.set(p.user_id, p.nombre));
        }
      }

      // Helper: resolver nombre de agente
      const resolveAgentName = (agente_id: string | null, agente_nombre: string | null): string => {
        if (agente_id && profilesMap.has(agente_id)) return profilesMap.get(agente_id)!;
        if (agente_nombre) return agente_nombre;
        return "Desconocido";
      };

      // ────────────────────────────────────────────────────
      // CÁLCULO DE KPIs
      // ────────────────────────────────────────────────────
      const totalCasos = casos.length;
      const casosRenovados = casos.filter((c: any) => c.cat_estados?.nombre === "Renovado").length;
      const tasaRenovacion = totalCasos > 0 ? (casosRenovados / totalCasos) * 100 : 0;
      const gestionesRegistradas = filteredHistorial.length;

      // Financiero: Total Facturado = suma valor_pagar de casos Renovados
      const totalFacturado = casos
        .filter((c: any) => c.cat_estados?.nombre === "Renovado")
        .reduce((sum: number, c: any) => sum + (Number(c.valor_pagar) || 0), 0);

      // Pendiente de Cobro = suma valor_pagar de casos Pendiente de Pago
      const pendienteCobro = casos
        .filter((c: any) => c.cat_estados?.nombre === "Pendiente de Pago")
        .reduce((sum: number, c: any) => sum + (Number(c.valor_pagar) || 0), 0);

      const totalMonetario = totalFacturado + pendienteCobro;
      const valorPromedio = casosRenovados > 0 ? totalFacturado / casosRenovados : 0;
      const porcentajeRecaudo = totalMonetario > 0 ? (totalFacturado / totalMonetario) * 100 : 0;

      // Casos por estado
      const estadoCount: Record<string, number> = {};
      casos.forEach((c: any) => {
        const estado = c.cat_estados?.nombre || "Sin estado";
        estadoCount[estado] = (estadoCount[estado] || 0) + 1;
      });
      const casosPorEstado = Object.entries(estadoCount)
        .map(([estado, count]) => ({
          estado,
          count,
          percentage: totalCasos > 0 ? (count / totalCasos) * 100 : 0,
        }))
        .sort((a, b) => b.count - a.count);

      // Gestiones por agente (top 10) — atribuidas por agente_id del historial
      // BUG FIX #6: usar agente_id del historial, no cambiado_por
      const agenteGestionCount: Record<string, number> = {};
      filteredHistorial.forEach((h: any) => {
        const name = resolveAgentName(h.agente_id, h.agente_nombre);
        agenteGestionCount[name] = (agenteGestionCount[name] || 0) + 1;
      });
      const gestionesPorAgente = Object.entries(agenteGestionCount)
        .map(([agente, count]) => ({ agente, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);

      // Gestiones por día (relleno con 0 los días sin actividad)
      const daysInRange = eachDayOfInterval({ start: dateFrom, end: dateTo });
      const diaCount: Record<string, number> = {};
      daysInRange.forEach((day) => { diaCount[format(day, "yyyy-MM-dd")] = 0; });
      filteredHistorial.forEach((h: any) => {
        const dia = format(parseISO(h.cambiado_en), "yyyy-MM-dd");
        if (diaCount[dia] !== undefined) diaCount[dia]++;
      });
      const gestionesPorDia = Object.entries(diaCount)
        .map(([fecha, count]) => ({ fecha, count }))
        .sort((a, b) => a.fecha.localeCompare(b.fecha));

      // Distribución de clientes (basada en clientes de los casos filtrados)
      const tipoCount: Record<string, number> = {};
      filteredClientes.forEach((c: any) => {
        tipoCount[c.tipo_cliente] = (tipoCount[c.tipo_cliente] || 0) + 1;
      });
      const totalClientes = filteredClientes.length;
      const distribucionClientes = Object.entries(tipoCount)
        .map(([tipo, count]) => ({
          tipo,
          count,
          percentage: totalClientes > 0 ? (count / totalClientes) * 100 : 0,
        }))
        .sort((a, b) => b.count - a.count);

      // Rendimiento por agente
      // casos asignados y renovados por agente_id del caso
      const agenteStats: Record<string, { casosAsignados: number; gestiones: number; renovados: number }> = {};

      casos.forEach((c: any) => {
        const name = resolveAgentName(c.agente_id, c.cat_agentes?.nombre ?? null);
        if (!agenteStats[name]) agenteStats[name] = { casosAsignados: 0, gestiones: 0, renovados: 0 };
        agenteStats[name].casosAsignados++;
        if (c.cat_estados?.nombre === "Renovado") agenteStats[name].renovados++;
      });

      // Gestiones atribuidas por agente_id del historial (BUG FIX #6)
      filteredHistorial.forEach((h: any) => {
        const name = resolveAgentName(h.agente_id, h.agente_nombre);
        if (!agenteStats[name]) agenteStats[name] = { casosAsignados: 0, gestiones: 0, renovados: 0 };
        agenteStats[name].gestiones++;
      });

      const rendimientoAgentes = Object.entries(agenteStats)
        .map(([agente, stats]) => ({
          agente,
          ...stats,
          tasaRenovacion: stats.casosAsignados > 0 ? (stats.renovados / stats.casosAsignados) * 100 : 0,
        }))
        .sort((a, b) => b.gestiones - a.gestiones);

      return {
        totalCasos,
        casosRenovados,
        tasaRenovacion,
        gestionesRegistradas,
        totalFacturado,
        pendienteCobro,
        valorPromedio,
        porcentajeRecaudo,
        casosPorEstado,
        gestionesPorAgente,
        gestionesPorDia,
        distribucionClientes,
        rendimientoAgentes,
      };
    },
  });
}
