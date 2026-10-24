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

// Filas tal como las trae useAnalyticsData
export interface CasoAnalitica {
  id: number;
  agente_id: string | null;
  cliente_id: number;
  valor_pagar: number | null;
  fecha_caso: string | null;
  created_at: string | null;
  cat_estados: { nombre: string } | null;
  cat_agentes: { nombre: string } | null;
  campanas: { nombre: string } | null;
}

export interface GestionAnalitica {
  agente_id: string | null;
  agente_nombre: string | null;
  cambiado_en: string;
}

export interface ClienteAnalitica {
  id: number;
  tipo_cliente: string;
  identificacion: string;
  nombre_contacto: string;
  razon_social: string | null;
}

export interface AnalyticsInput {
  casos: CasoAnalitica[];
  gestiones: GestionAnalitica[];
  clientes: ClienteAnalitica[];
  /** user_id → nombre del perfil */
  nombresAgentes: Map<string, string>;
  dateFrom: Date;
  dateTo: Date;
  /** Referencia para los días en pendiente */
  hoy?: Date;
}

const RENOVADO = "Renovado";
const PENDIENTE_PAGO = "Pendiente de Pago";

const valor = (c: CasoAnalitica) => Number(c.valor_pagar) || 0;
const pct = (parte: number, total: number) => (total > 0 ? (parte / total) * 100 : 0);

export function computeAnalytics({
  casos, gestiones, clientes, nombresAgentes, dateFrom, dateTo, hoy = new Date(),
}: AnalyticsInput): AnalyticsData {
  const clienteMap = new Map(clientes.map((c) => [c.id, c]));

  const resolveAgentName = (agente_id: string | null, agente_nombre: string | null): string => {
    if (agente_id && nombresAgentes.has(agente_id)) return nombresAgentes.get(agente_id)!;
    if (agente_nombre) return agente_nombre;
    return "Desconocido";
  };
  const agenteDelCaso = (c: CasoAnalitica) => resolveAgentName(c.agente_id, c.cat_agentes?.nombre ?? null);
  const resolveCampanaName = (c: CasoAnalitica): string => c.campanas?.nombre ?? "Sin campaña";
  const resolveNombreCliente = (c: CasoAnalitica): string => {
    const cliente = clienteMap.get(c.cliente_id);
    if (!cliente) return "—";
    if (cliente.tipo_cliente === "Empresa") return cliente.razon_social || cliente.nombre_contacto || "—";
    return cliente.nombre_contacto || "—";
  };
  const esRenovado = (c: CasoAnalitica) => c.cat_estados?.nombre === RENOVADO;
  const esPendiente = (c: CasoAnalitica) => c.cat_estados?.nombre === PENDIENTE_PAGO;

  // ── KPIs ──
  const totalCasos = casos.length;
  const renovados = casos.filter(esRenovado);
  const casosRenovados = renovados.length;
  const totalFacturado = renovados.reduce((sum, c) => sum + valor(c), 0);
  const pendienteCobro = casos.filter(esPendiente).reduce((sum, c) => sum + valor(c), 0);

  // ── Casos por estado ──
  const estadoCount: Record<string, number> = {};
  casos.forEach((c) => {
    const estado = c.cat_estados?.nombre || "Sin estado";
    estadoCount[estado] = (estadoCount[estado] || 0) + 1;
  });
  const casosPorEstado = Object.entries(estadoCount)
    .map(([estado, count]) => ({ estado, count, percentage: pct(count, totalCasos) }))
    .sort((a, b) => b.count - a.count);

  // ── Gestiones por agente (top 10) ──
  const agenteGestionCount: Record<string, number> = {};
  gestiones.forEach((h) => {
    const name = resolveAgentName(h.agente_id, h.agente_nombre);
    agenteGestionCount[name] = (agenteGestionCount[name] || 0) + 1;
  });
  const gestionesPorAgente = Object.entries(agenteGestionCount)
    .map(([agente, count]) => ({ agente, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  // ── Gestiones por día (con valor diario) ──
  const dias: Record<string, { count: number; renovados: number; facturado: number; pendiente: number }> = {};
  eachDayOfInterval({ start: dateFrom, end: dateTo }).forEach((day) => {
    dias[format(day, "yyyy-MM-dd")] = { count: 0, renovados: 0, facturado: 0, pendiente: 0 };
  });
  gestiones.forEach((h) => {
    const dia = dias[format(parseISO(h.cambiado_en), "yyyy-MM-dd")];
    if (dia) dia.count++;
  });
  casos.forEach((c) => {
    const dia = c.fecha_caso ? dias[c.fecha_caso.substring(0, 10)] : undefined;
    if (!dia) return;
    if (esRenovado(c)) {
      dia.renovados++;
      dia.facturado += valor(c);
    }
    if (esPendiente(c)) dia.pendiente += valor(c);
  });
  const gestionesPorDia = Object.entries(dias)
    .map(([fecha, d]) => ({
      fecha,
      count: d.count,
      renovadosDelDia: d.renovados,
      valorFacturadoDia: d.facturado,
      valorPendienteDia: d.pendiente,
    }))
    .sort((a, b) => a.fecha.localeCompare(b.fecha));

  // ── Distribución de clientes (con valor por tipo) ──
  const tipoCount: Record<string, number> = {};
  const tipoValor: Record<string, number> = {};
  casos.forEach((c) => {
    const tipo = clienteMap.get(c.cliente_id)?.tipo_cliente ?? "Desconocido";
    tipoCount[tipo] = (tipoCount[tipo] || 0) + 1;
    if (esRenovado(c)) tipoValor[tipo] = (tipoValor[tipo] || 0) + valor(c);
  });
  const totalClientes = Object.values(tipoCount).reduce((a, b) => a + b, 0);
  const distribucionClientes = Object.entries(tipoCount)
    .map(([tipo, count]) => ({
      tipo,
      count,
      percentage: pct(count, totalClientes),
      valorFacturado: tipoValor[tipo] ?? 0,
    }))
    .sort((a, b) => b.count - a.count);

  // ── Rendimiento por agente (con columnas financieras) ──
  type AgenteStats = { casosAsignados: number; gestiones: number; renovados: number; valorFacturado: number; valorPendiente: number };
  const agenteStats: Record<string, AgenteStats> = {};
  const statsDe = (name: string) =>
    (agenteStats[name] ??= { casosAsignados: 0, gestiones: 0, renovados: 0, valorFacturado: 0, valorPendiente: 0 });
  casos.forEach((c) => {
    const s = statsDe(agenteDelCaso(c));
    s.casosAsignados++;
    if (esRenovado(c)) {
      s.renovados++;
      s.valorFacturado += valor(c);
    }
    if (esPendiente(c)) s.valorPendiente += valor(c);
  });
  gestiones.forEach((h) => {
    statsDe(resolveAgentName(h.agente_id, h.agente_nombre)).gestiones++;
  });
  const rendimientoAgentes: RendimientoAgente[] = Object.entries(agenteStats)
    .map(([agente, s]) => ({
      agente,
      ...s,
      tasaRenovacion: pct(s.renovados, s.casosAsignados),
      porcentajeRecaudo: pct(s.valorFacturado, s.valorFacturado + s.valorPendiente),
      promedioPorRenovacion: s.renovados > 0 ? s.valorFacturado / s.renovados : 0,
    }))
    .sort((a, b) => b.gestiones - a.gestiones);

  // ── Trámites renovados (detalle fila a fila) ──
  const tramitesRenovados: TramiteRenovado[] = renovados
    .map((c) => {
      const cliente = clienteMap.get(c.cliente_id);
      const dias = c.created_at && c.fecha_caso ? differenceInDays(parseISO(c.fecha_caso), parseISO(c.created_at)) : 0;
      return {
        fechaRenovacion: c.fecha_caso?.substring(0, 10) ?? "—",
        numeroMatricula: cliente?.identificacion ?? "—",
        nombreRazonSocial: resolveNombreCliente(c),
        tipo: cliente?.tipo_cliente ?? "—",
        agente: agenteDelCaso(c),
        campana: resolveCampanaName(c),
        valorPagado: valor(c),
        diasHastaRenovacion: Math.max(0, dias),
      };
    })
    .sort((a, b) => a.fechaRenovacion.localeCompare(b.fechaRenovacion));

  // ── Pendientes de pago ──
  const pendientesPago: PendientePago[] = casos
    .filter(esPendiente)
    .map((c) => ({
      fechaCaso: c.fecha_caso?.substring(0, 10) ?? "—",
      numeroMatricula: clienteMap.get(c.cliente_id)?.identificacion ?? "—",
      nombreRazonSocial: resolveNombreCliente(c),
      agente: agenteDelCaso(c),
      campana: resolveCampanaName(c),
      valor: valor(c),
      diasEnPendiente: Math.max(0, differenceInDays(hoy, c.fecha_caso ? parseISO(c.fecha_caso) : hoy)),
    }))
    .sort((a, b) => b.diasEnPendiente - a.diasEnPendiente);

  // ── Recaudo por fecha (desglose diario) ──
  const recaudoPorFecha: RecaudoPorFecha[] = gestionesPorDia.map((d) => ({
    fecha: d.fecha,
    renovadosDelDia: d.renovadosDelDia,
    valorFacturado: d.valorFacturadoDia,
    valorPendiente: d.valorPendienteDia,
    porcentajeRecaudo: pct(d.valorFacturadoDia, d.valorFacturadoDia + d.valorPendienteDia),
  }));

  // ── Resumen por campaña ──
  const campanaStats: Record<string, { casos: number; renovados: number; facturado: number; pendiente: number }> = {};
  casos.forEach((c) => {
    const s = (campanaStats[resolveCampanaName(c)] ??= { casos: 0, renovados: 0, facturado: 0, pendiente: 0 });
    s.casos++;
    if (esRenovado(c)) {
      s.renovados++;
      s.facturado += valor(c);
    }
    if (esPendiente(c)) s.pendiente += valor(c);
  });
  const resumenCampanas: ResumenCampana[] = Object.entries(campanaStats)
    .map(([campana, s]) => ({ campana, ...s, tasa: pct(s.renovados, s.casos) }))
    .sort((a, b) => b.facturado - a.facturado);

  return {
    totalCasos,
    casosRenovados,
    tasaRenovacion: pct(casosRenovados, totalCasos),
    gestionesRegistradas: gestiones.length,
    totalFacturado,
    pendienteCobro,
    valorPromedio: casosRenovados > 0 ? totalFacturado / casosRenovados : 0,
    porcentajeRecaudo: pct(totalFacturado, totalFacturado + pendienteCobro),
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
}
