import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { startOfMonth, endOfMonth, format, eachDayOfInterval, parseISO } from "date-fns";

export interface AnalyticsData {
  totalCasos: number;
  casosRenovados: number;
  tasaRenovacion: number;
  gestionesRegistradas: number;
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

export function useAnalyticsData(dateFrom: Date, dateTo: Date, campanaId?: string) {
  return useQuery({
    queryKey: ["analytics", dateFrom.toISOString(), dateTo.toISOString(), campanaId],
    queryFn: async (): Promise<AnalyticsData> => {
      const fromStr = format(dateFrom, "yyyy-MM-dd");
      const toStr = format(dateTo, "yyyy-MM-dd");

      // Fetch casos in date range
      let casosQuery = supabase
        .from("casos")
        .select(`
          id,
          agente_id,
          estado_id,
          cliente_id,
          cat_estados!inner(nombre),
          cat_agentes!inner(nombre)
        `)
        .gte("fecha_caso", fromStr)
        .lte("fecha_caso", toStr + "T23:59:59");

      if (campanaId) {
        casosQuery = casosQuery.eq("campana_id", campanaId);
      }

      const { data: casos, error: casosError } = await casosQuery;
      if (casosError) throw casosError;

      // Fetch caso_historial in date range
      const { data: historial, error: historialError } = await supabase
        .from("caso_historial")
        .select(`
          id,
          caso_id,
          cambiado_por,
          cambiado_en,
          agente_nombre
        `)
        .gte("cambiado_en", fromStr)
        .lte("cambiado_en", toStr + "T23:59:59");

      if (historialError) throw historialError;

      // Fetch clientes
      const { data: clientes, error: clientesError } = await supabase
        .from("clientes")
        .select("id, tipo_cliente");

      if (clientesError) throw clientesError;

      // Fetch all agentes for mapping
      const { data: agentes, error: agentesError } = await supabase
        .from("cat_agentes")
        .select("user_id, nombre");

      if (agentesError) throw agentesError;

      const agentesMap = new Map(agentes?.map(a => [a.user_id, a.nombre]) || []);

      // Calculate KPIs
      const totalCasos = casos?.length || 0;
      const casosRenovados = casos?.filter(c => 
        (c.cat_estados as any)?.nombre === "Renovado"
      ).length || 0;
      const tasaRenovacion = totalCasos > 0 ? (casosRenovados / totalCasos) * 100 : 0;
      const gestionesRegistradas = historial?.length || 0;

      // Casos por estado
      const estadoCount: Record<string, number> = {};
      casos?.forEach(c => {
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
      historial?.forEach(h => {
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
      daysInRange.forEach(day => {
        diaCount[format(day, "yyyy-MM-dd")] = 0;
      });
      historial?.forEach(h => {
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
      clientes?.forEach(c => {
        tipoCount[c.tipo_cliente] = (tipoCount[c.tipo_cliente] || 0) + 1;
      });
      const totalClientes = clientes?.length || 0;
      const distribucionClientes = Object.entries(tipoCount).map(([tipo, count]) => ({
        tipo,
        count,
        percentage: totalClientes > 0 ? (count / totalClientes) * 100 : 0,
      }));

      // Rendimiento por agente
      const agenteStats: Record<string, { casosAsignados: number; gestiones: number; renovados: number }> = {};
      
      casos?.forEach(c => {
        const agenteName = (c.cat_agentes as any)?.nombre || "Desconocido";
        if (!agenteStats[agenteName]) {
          agenteStats[agenteName] = { casosAsignados: 0, gestiones: 0, renovados: 0 };
        }
        agenteStats[agenteName].casosAsignados++;
        if ((c.cat_estados as any)?.nombre === "Renovado") {
          agenteStats[agenteName].renovados++;
        }
      });

      historial?.forEach(h => {
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
          tasaRenovacion: stats.casosAsignados > 0 
            ? (stats.renovados / stats.casosAsignados) * 100 
            : 0,
        }))
        .sort((a, b) => b.gestiones - a.gestiones);

      return {
        totalCasos,
        casosRenovados,
        tasaRenovacion,
        gestionesRegistradas,
        casosPorEstado,
        gestionesPorAgente,
        gestionesPorDia,
        distribucionClientes,
        rendimientoAgentes,
      };
    },
  });
}
