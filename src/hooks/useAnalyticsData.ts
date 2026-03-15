import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, eachDayOfInterval, parseISO, differenceInDays } from "date-fns";

export interface TramiteRenovado {
  fechaRenovacion: string;       // fecha_caso del caso
  numeroMatricula: string;       // identificacion del cliente
  nombreRazonSocial: string;     // razon_social o nombre_contacto
  tipo: string;                  // tipo_cliente: Empresa / Persona
  agente: string;
  campana: string;
  valorPagado: number;           // valor_pagar cuando estado = Renovado
  diasHastaRenovacion: number;   // fecha_caso - created_at del caso
}

export interface PendientePago {
  fechaCaso: string;
  numeroMatricula: string;
  nombreRazonSocial: string;
  agente: string;
  campana: string;
  valor: number;
  diasEnPendiente: number;
}

export interface RecaudoPorFecha {
  fecha: string;
  renovadosDelDia: number;
  valorFacturado: number;
  valorPendiente: number;
  porcentajeRecaudo: number;
}

export interface RendimientoAgente {
  agente: string;
  casosAsignados: number;
  gestiones: number;
  renovados: number;
  tasaRenovacion: number;
  valorFacturado: number;
  valorPendiente: number;
  porcentajeRecaudo: number;
  promedioPorRenovacion: number;
}

export interface ResumenCampana {
  campana: string;
  casos: number;
  renovados: number;
  tasa: number;
  facturado: number;
  pendiente: number;
}

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
  gestionesPorDia: { fecha: string; count: number; renovadosDelDia: number; valorFacturadoDia: number; valorPendienteDia: number }[];
  distribucionClientes: { tipo: string; count: number; percentage: number; valorFacturado: number }[];
  rendimientoAgentes: RendimientoAgente[];
  tramitesRenovados: TramiteRenovado[];
  pendientesPago: PendientePago[];
  recaudoPorFecha: RecaudoPorFecha[];
  resumenCampanas: ResumenCampana[];
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
      const fromStr = format(dateFrom, "yyyy-MM-dd") + "T00:00:00";
      const toStr   = format(dateTo,   "yyyy-MM-dd") + "T23:59:59";

      // ──────────────────────────────────────────────────────
      // 1. CASOS (paginados, con campana)
      // ──────────────────────────────────────────────────────
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

      const casosIds = new Set(casos.map((c: any) => c.id));
      const casosClienteIds = [...new Set(casos.map((c: any) => c.cliente_id as number))];

      // ──────────────────────────────────────────────────────
      // 2. HISTORIAL (filtrado por caso_id IN casosIds)
      // ──────────────────────────────────────────────────────
      let filteredHistorial: any[] = [];

      if (casosIds.size > 0) {
        const casosIdsArr = [...casosIds];
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
              .not("agente_id", "is", null)
              .range(from, to);

            if (agenteId) q = q.eq("agente_id", agenteId);
            return q;
          });
          filteredHistorial.push(...partial);
        }
      }

      // ──────────────────────────────────────────────────────
      // 3. CLIENTES (solo los que aparecen en los casos)
      // ──────────────────────────────────────────────────────
      let filteredClientes: any[] = [];

      if (casosClienteIds.length > 0) {
        const chunkSize = 500;
        for (let i = 0; i < casosClienteIds.length; i += chunkSize) {
          const chunk = casosClienteIds.slice(i, i + chunkSize);
          const { data, error } = await supabase
            .from("clientes")
            .select("id, tipo_cliente, identificacion, nombre_contacto, razon_social")
            .in("id", chunk);
          if (error) throw error;
          filteredClientes.push(...(data ?? []));
        }
      }

      // Mapa cliente_id → datos de cliente
      const clienteMap = new Map<number, any>();
      filteredClientes.forEach((c: any) => clienteMap.set(c.id, c));

      // ──────────────────────────────────────────────────────
      // 4. PERFILES (para resolver nombres de agentes)
      // ──────────────────────────────────────────────────────
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

      const resolveAgentName = (agente_id: string | null, agente_nombre: string | null): string => {
        if (agente_id && profilesMap.has(agente_id)) return profilesMap.get(agente_id)!;
        if (agente_nombre) return agente_nombre;
        return "Desconocido";
      };

      const resolveCampanaName = (c: any): string =>
        c.campanas?.nombre ?? "Sin campaña";

      const resolveNombreCliente = (c: any): string => {
        const cliente = clienteMap.get(c.cliente_id);
        if (!cliente) return "—";
        if (cliente.tipo_cliente === "Empresa") return cliente.razon_social || cliente.nombre_contacto || "—";
        return cliente.nombre_contacto || "—";
      };

      const today = new Date();

      // ──────────────────────────────────────────────────────
      // CÁLCULO DE KPIs
      // ──────────────────────────────────────────────────────
      const totalCasos = casos.length;
      const casosRenovados = casos.filter((c: any) => c.cat_estados?.nombre === "Renovado").length;
      const tasaRenovacion = totalCasos > 0 ? (casosRenovados / totalCasos) * 100 : 0;
      const gestionesRegistradas = filteredHistorial.length;

      const totalFacturado = casos
        .filter((c: any) => c.cat_estados?.nombre === "Renovado")
        .reduce((sum: number, c: any) => sum + (Number(c.valor_pagar) || 0), 0);

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

      // Gestiones por agente
      const agenteGestionCount: Record<string, number> = {};
      filteredHistorial.forEach((h: any) => {
        const name = resolveAgentName(h.agente_id, h.agente_nombre);
        agenteGestionCount[name] = (agenteGestionCount[name] || 0) + 1;
      });
      const gestionesPorAgente = Object.entries(agenteGestionCount)
        .map(([agente, count]) => ({ agente, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);

      // ──────────────────────────────────────────────────────
      // GESTIONES POR DÍA (con valor diario)
      // ──────────────────────────────────────────────────────
      const daysInRange = eachDayOfInterval({ start: dateFrom, end: dateTo });
      const diaCount: Record<string, number> = {};
      const diaRenovados: Record<string, number> = {};
      const diaFacturado: Record<string, number> = {};
      const diaPendiente: Record<string, number> = {};

      daysInRange.forEach((day) => {
        const k = format(day, "yyyy-MM-dd");
        diaCount[k] = 0;
        diaRenovados[k] = 0;
        diaFacturado[k] = 0;
        diaPendiente[k] = 0;
      });

      filteredHistorial.forEach((h: any) => {
        const dia = format(parseISO(h.cambiado_en), "yyyy-MM-dd");
        if (diaCount[dia] !== undefined) diaCount[dia]++;
      });

      casos.forEach((c: any) => {
        const dia = c.fecha_caso?.substring(0, 10);
        if (!dia || diaRenovados[dia] === undefined) return;
        if (c.cat_estados?.nombre === "Renovado") {
          diaRenovados[dia]++;
          diaFacturado[dia] += Number(c.valor_pagar) || 0;
        }
        if (c.cat_estados?.nombre === "Pendiente de Pago") {
          diaPendiente[dia] += Number(c.valor_pagar) || 0;
        }
      });

      const gestionesPorDia = Object.entries(diaCount)
        .map(([fecha, count]) => ({
          fecha,
          count,
          renovadosDelDia: diaRenovados[fecha] ?? 0,
          valorFacturadoDia: diaFacturado[fecha] ?? 0,
          valorPendienteDia: diaPendiente[fecha] ?? 0,
        }))
        .sort((a, b) => a.fecha.localeCompare(b.fecha));

      // ──────────────────────────────────────────────────────
      // DISTRIBUCIÓN CLIENTES (con valor por tipo)
      // ──────────────────────────────────────────────────────
      const tipoCount: Record<string, number> = {};
      const tipoValor: Record<string, number> = {};
      casos.forEach((c: any) => {
        const cliente = clienteMap.get(c.cliente_id);
        const tipo = cliente?.tipo_cliente ?? "Desconocido";
        tipoCount[tipo] = (tipoCount[tipo] || 0) + 1;
        if (c.cat_estados?.nombre === "Renovado") {
          tipoValor[tipo] = (tipoValor[tipo] || 0) + (Number(c.valor_pagar) || 0);
        }
      });
      const totalClientes = Object.values(tipoCount).reduce((a, b) => a + b, 0);
      const distribucionClientes = Object.entries(tipoCount)
        .map(([tipo, count]) => ({
          tipo,
          count,
          percentage: totalClientes > 0 ? (count / totalClientes) * 100 : 0,
          valorFacturado: tipoValor[tipo] ?? 0,
        }))
        .sort((a, b) => b.count - a.count);

      // ──────────────────────────────────────────────────────
      // RENDIMIENTO AGENTES (con columnas financieras)
      // ──────────────────────────────────────────────────────
      const agenteStats: Record<string, {
        casosAsignados: number; gestiones: number; renovados: number;
        valorFacturado: number; valorPendiente: number;
      }> = {};

      casos.forEach((c: any) => {
        const name = resolveAgentName(c.agente_id, c.cat_agentes?.nombre ?? null);
        if (!agenteStats[name]) agenteStats[name] = { casosAsignados: 0, gestiones: 0, renovados: 0, valorFacturado: 0, valorPendiente: 0 };
        agenteStats[name].casosAsignados++;
        if (c.cat_estados?.nombre === "Renovado") {
          agenteStats[name].renovados++;
          agenteStats[name].valorFacturado += Number(c.valor_pagar) || 0;
        }
        if (c.cat_estados?.nombre === "Pendiente de Pago") {
          agenteStats[name].valorPendiente += Number(c.valor_pagar) || 0;
        }
      });

      filteredHistorial.forEach((h: any) => {
        const name = resolveAgentName(h.agente_id, h.agente_nombre);
        if (!agenteStats[name]) agenteStats[name] = { casosAsignados: 0, gestiones: 0, renovados: 0, valorFacturado: 0, valorPendiente: 0 };
        agenteStats[name].gestiones++;
      });

      const rendimientoAgentes: RendimientoAgente[] = Object.entries(agenteStats)
        .map(([agente, stats]) => {
          const totalAgent = stats.valorFacturado + stats.valorPendiente;
          return {
            agente,
            ...stats,
            tasaRenovacion: stats.casosAsignados > 0 ? (stats.renovados / stats.casosAsignados) * 100 : 0,
            porcentajeRecaudo: totalAgent > 0 ? (stats.valorFacturado / totalAgent) * 100 : 0,
            promedioPorRenovacion: stats.renovados > 0 ? stats.valorFacturado / stats.renovados : 0,
          };
        })
        .sort((a, b) => b.gestiones - a.gestiones);

      // ──────────────────────────────────────────────────────
      // TRÁMITES RENOVADOS (detalle fila a fila)
      // ──────────────────────────────────────────────────────
      const tramitesRenovados: TramiteRenovado[] = casos
        .filter((c: any) => c.cat_estados?.nombre === "Renovado")
        .map((c: any) => {
          const cliente = clienteMap.get(c.cliente_id);
          const createdAt = c.created_at ? parseISO(c.created_at) : null;
          const fechaRenovacion = c.fecha_caso ? parseISO(c.fecha_caso) : null;
          const dias = createdAt && fechaRenovacion ? differenceInDays(fechaRenovacion, createdAt) : 0;
          return {
            fechaRenovacion: c.fecha_caso?.substring(0, 10) ?? "—",
            numeroMatricula: cliente?.identificacion ?? "—",
            nombreRazonSocial: resolveNombreCliente(c),
            tipo: cliente?.tipo_cliente ?? "—",
            agente: resolveAgentName(c.agente_id, c.cat_agentes?.nombre ?? null),
            campana: resolveCampanaName(c),
            valorPagado: Number(c.valor_pagar) || 0,
            diasHastaRenovacion: Math.max(0, dias),
          };
        })
        .sort((a, b) => a.fechaRenovacion.localeCompare(b.fechaRenovacion));

      // ──────────────────────────────────────────────────────
      // PENDIENTES DE PAGO
      // ──────────────────────────────────────────────────────
      const pendientesPago: PendientePago[] = casos
        .filter((c: any) => c.cat_estados?.nombre === "Pendiente de Pago")
        .map((c: any) => {
          const cliente = clienteMap.get(c.cliente_id);
          const fechaCaso = c.fecha_caso ? parseISO(c.fecha_caso) : today;
          const diasEnPendiente = differenceInDays(today, fechaCaso);
          return {
            fechaCaso: c.fecha_caso?.substring(0, 10) ?? "—",
            numeroMatricula: cliente?.identificacion ?? "—",
            nombreRazonSocial: resolveNombreCliente(c),
            agente: resolveAgentName(c.agente_id, c.cat_agentes?.nombre ?? null),
            campana: resolveCampanaName(c),
            valor: Number(c.valor_pagar) || 0,
            diasEnPendiente: Math.max(0, diasEnPendiente),
          };
        })
        .sort((a, b) => b.diasEnPendiente - a.diasEnPendiente);

      // ──────────────────────────────────────────────────────
      // RECAUDO POR FECHA (desglose diario)
      // ──────────────────────────────────────────────────────
      const recaudoPorFecha: RecaudoPorFecha[] = gestionesPorDia
        .map((d) => {
          const totalDia = d.valorFacturadoDia + d.valorPendienteDia;
          return {
            fecha: d.fecha,
            renovadosDelDia: d.renovadosDelDia,
            valorFacturado: d.valorFacturadoDia,
            valorPendiente: d.valorPendienteDia,
            porcentajeRecaudo: totalDia > 0 ? (d.valorFacturadoDia / totalDia) * 100 : 0,
          };
        });

      // ──────────────────────────────────────────────────────
      // RESUMEN POR CAMPAÑA
      // ──────────────────────────────────────────────────────
      const campanaStats: Record<string, {
        casos: number; renovados: number; facturado: number; pendiente: number;
      }> = {};

      casos.forEach((c: any) => {
        const nombre = resolveCampanaName(c);
        if (!campanaStats[nombre]) campanaStats[nombre] = { casos: 0, renovados: 0, facturado: 0, pendiente: 0 };
        campanaStats[nombre].casos++;
        if (c.cat_estados?.nombre === "Renovado") {
          campanaStats[nombre].renovados++;
          campanaStats[nombre].facturado += Number(c.valor_pagar) || 0;
        }
        if (c.cat_estados?.nombre === "Pendiente de Pago") {
          campanaStats[nombre].pendiente += Number(c.valor_pagar) || 0;
        }
      });

      const resumenCampanas: ResumenCampana[] = Object.entries(campanaStats)
        .map(([campana, stats]) => ({
          campana,
          ...stats,
          tasa: stats.casos > 0 ? (stats.renovados / stats.casos) * 100 : 0,
        }))
        .sort((a, b) => b.facturado - a.facturado);

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
        tramitesRenovados,
        pendientesPago,
        recaudoPorFecha,
        resumenCampanas,
      };
    },
  });
}
