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

export function useAnalyticsData(filters: AnalyticsQueryFilters) {
  const { dateFrom, dateTo, campanaId, agenteId, estadoId } = filters;

  return useQuery({
    queryKey: [
      "analytics",
      dateFrom.toISOString(),
      dateTo.toISOString(),
      campanaId,
      agenteId,
      estadoId,
    ],
    queryFn: async (): Promise<AnalyticsData> => {
      const fromStr = format(dateFrom, "yyyy-MM-dd");
      const toStr = format(dateTo, "yyyy-MM-dd");

      // Fetch casos in date range with filters
      let casosQuery = supabase
        .from("casos")
        .select(`
          id,
          agente_id,
          estado_id,
          cliente_id,
          valor_pagar,
          cat_estados!inner(nombre),
          cat_agentes!inner(nombre)
        `)
        .gte("fecha_caso", fromStr)
        .lte("fecha_caso", toStr + "T23:59:59");

      if (campanaId) {
        casosQuery = casosQuery.eq("campana_id", campanaId);
      }
      if (agenteId) {
        casosQuery = casosQuery.eq("agente_id", agenteId);
      }
      if (estadoId) {
        casosQuery = casosQuery.eq("estado_id", estadoId);
      }

      const { data: casos, error: casosError } = await casosQuery;
      if (casosError) throw casosError;

      // Fetch caso_historial in date range
      let historialQuery = supabase
        .from("caso_historial")
        .select(`
          id,
          caso_id,
          cambiado_por,
          cambiado_en,
          agente_nombre,
          agente_id,
          estado_id
        `)
        .gte("cambiado_en", fromStr)
        .lte("cambiado_en", toStr + "T23:59:59");

      if (agenteId) {
        historialQuery = historialQuery.eq("agente_id", agenteId);
      }
      if (estadoId) {
        historialQuery = historialQuery.eq("estado_id", estadoId);
      }

      const { data: historial, error: historialError } = await historialQuery;
      if (historialError) throw historialError;

      // If campanaId filter, filter historial by caso_ids
      let filteredHistorial = historial || [];
      if (campanaId && casos) {
        const casosIds = new Set(casos.map((c) => c.id));
        filteredHistorial = filteredHistorial.filter((h) => casosIds.has(h.caso_id));
      }

      // Fetch clientes
      const { data: clientes, error: clientesError } = await supabase
        .from("clientes")
        .select("id, tipo_cliente");

      if (clientesError) throw clientesError;

      // Filter clientes by casos if we have caso filters
      let filteredClientes = clientes || [];
      if (casos && (campanaId || agenteId || estadoId)) {
        const clienteIds = new Set(casos.map((c) => c.cliente_id));
        filteredClientes = filteredClientes.filter((c) => clienteIds.has(c.id));
      }

      // Fetch all agentes for mapping
      const { data: agentes, error: agentesError } = await supabase
        .from("cat_agentes")
        .select("user_id, nombre");

      if (agentesError) throw agentesError;

      const agentesMap = new Map(agentes?.map((a) => [a.user_id, a.nombre]) || []);

      // Calculate KPIs
      const totalCasos = casos?.length || 0;
      const casosRenovados =
        casos?.filter((c) => (c.cat_estados as any)?.nombre === "Renovado").length || 0;
      const tasaRenovacion = totalCasos > 0 ? (casosRenovados / totalCasos) * 100 : 0;
      const gestionesRegistradas = filteredHistorial.length;

      // Financial KPIs
      const totalFacturado = casos
        ?.filter((c) => (c.cat_estados as any)?.nombre === "Renovado")
        .reduce((sum, c) => sum + ((c.valor_pagar as number) || 0), 0) ?? 0;

      const pendienteCobro = casos
        ?.filter((c) => (c.cat_estados as any)?.nombre === "Pendiente de Pago")
        .reduce((sum, c) => sum + ((c.valor_pagar as number) || 0), 0) ?? 0;

      const totalMonetario = totalFacturado + pendienteCobro;
      const valorPromedio = casosRenovados > 0 ? totalFacturado / casosRenovados : 0;
      const porcentajeRecaudo = totalMonetario > 0
        ? (totalFacturado / totalMonetario) * 100
        : 0;

      // Casos por estado
      const estadoCount: Record<string, number> = {};
      casos?.forEach((c) => {
        const estado = (c.cat_estados as any)?.nombre || "Sin estado";
        estadoCount[estado] = (estadoCount[estado] || 0) + 1;
      });
      const casosPorEstado = Object.entries(estadoCount).map(([estado, count]) => ({
        estado,
        count,
        percentage: totalCasos > 0 ? (count / totalCasos) * 100 : 0,
      }));

      // Gestiones por agente (top 10)
      const agenteGestionCount: Record<string, number> = {};
      filteredHistorial.forEach((h) => {
        const agenteName = h.agente_nombre || agentesMap.get(h.cambiado_por) || "Desconocido";
        agenteGestionCount[agenteName] = (agenteGestionCount[agenteName] || 0) + 1;
      });
      const gestionesPorAgente = Object.entries(agenteGestionCount)
        .map(([agente, count]) => ({ agente, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);

      // Gestiones por día
      const daysInRange = eachDayOfInterval({ start: dateFrom, end: dateTo });
      const diaCount: Record<string, number> = {};
      daysInRange.forEach((day) => {
        diaCount[format(day, "yyyy-MM-dd")] = 0;
      });
      filteredHistorial.forEach((h) => {
        const dia = format(parseISO(h.cambiado_en), "yyyy-MM-dd");
        if (diaCount[dia] !== undefined) {
          diaCount[dia]++;
        }
      });
      const gestionesPorDia = Object.entries(diaCount)
        .map(([fecha, count]) => ({ fecha, count }))
        .sort((a, b) => a.fecha.localeCompare(b.fecha));

      // Distribución de clientes
      const tipoCount: Record<string, number> = {};
      filteredClientes.forEach((c) => {
        tipoCount[c.tipo_cliente] = (tipoCount[c.tipo_cliente] || 0) + 1;
      });
      const totalClientes = filteredClientes.length;
      const distribucionClientes = Object.entries(tipoCount).map(([tipo, count]) => ({
        tipo,
        count,
        percentage: totalClientes > 0 ? (count / totalClientes) * 100 : 0,
      }));

      // Rendimiento por agente
      const agenteStats: Record<
        string,
        { casosAsignados: number; gestiones: number; renovados: number }
      > = {};

      casos?.forEach((c) => {
        const agenteName = (c.cat_agentes as any)?.nombre || "Desconocido";
        if (!agenteStats[agenteName]) {
          agenteStats[agenteName] = { casosAsignados: 0, gestiones: 0, renovados: 0 };
        }
        agenteStats[agenteName].casosAsignados++;
        if ((c.cat_estados as any)?.nombre === "Renovado") {
          agenteStats[agenteName].renovados++;
        }
      });

      filteredHistorial.forEach((h) => {
        const agenteName = h.agente_nombre || agentesMap.get(h.cambiado_por) || "Desconocido";
        if (!agenteStats[agenteName]) {
          agenteStats[agenteName] = { casosAsignados: 0, gestiones: 0, renovados: 0 };
        }
        agenteStats[agenteName].gestiones++;
      });

      const rendimientoAgentes = Object.entries(agenteStats)
        .map(([agente, stats]) => ({
          agente,
          ...stats,
          tasaRenovacion:
            stats.casosAsignados > 0 ? (stats.renovados / stats.casosAsignados) * 100 : 0,
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
