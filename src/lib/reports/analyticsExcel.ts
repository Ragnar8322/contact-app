import type { Workbook, Worksheet, Style, Fill } from "exceljs";
import { format } from "date-fns";
import type { AnalyticsData } from "@/lib/analytics";
import { loadExcelJS } from "./excel";
import type { ReportMeta } from "./types";

// ── Paleta KV Renovación 2026 ──
const C = {
  azul:      "FF0D3266",
  gradIA:    "FF6D8AEF",
  grisClaro: "FFF0F2F8",
  blanco:    "FFFFFFFF",
  negro:     "FF141414",
  naranja:   "FFFF6B35", // alerta pendiente
} as const;

const solid = (argb: string): Fill => ({ type: "pattern", pattern: "solid", fgColor: { argb } });

const S: Record<string, Partial<Style>> = {
  metaLabel: { font: { bold: true, color: { argb: C.azul }, size: 10 }, fill: solid(C.grisClaro), alignment: { horizontal: "left" } },
  metaValue: { font: { color: { argb: C.negro }, size: 10 }, fill: solid(C.grisClaro), alignment: { horizontal: "left" } },
  colHeader: {
    font: { bold: true, color: { argb: C.blanco }, size: 10 },
    fill: solid(C.azul),
    alignment: { horizontal: "center", vertical: "middle", wrapText: true },
    border: { bottom: { style: "thin", color: { argb: C.gradIA } } },
  },
  sectionTitle: { font: { bold: true, color: { argb: C.blanco }, size: 11 }, fill: solid(C.gradIA) },
};

const dato = (alt: boolean): Partial<Style> => ({
  font: { color: { argb: C.negro }, size: 10 },
  ...(alt ? { fill: solid(C.grisClaro) } : {}),
  alignment: { horizontal: "left" },
});
const numero = (alt: boolean): Partial<Style> => ({ ...dato(alt), numFmt: "#,##0", alignment: { horizontal: "right" } });
const porcentaje = (alt: boolean): Partial<Style> => ({ ...dato(alt), alignment: { horizontal: "right" } });

const PCT = (n: number) => `${n.toFixed(1)}%`;

type Celda = string | number;

function setRow(ws: Worksheet, fila: number, valores: Celda[], estilo: (col: number) => Partial<Style>) {
  const row = ws.getRow(fila);
  valores.forEach((v, i) => {
    const cell = row.getCell(i + 1);
    cell.value = v;
    cell.style = estilo(i);
  });
}

function writeMeta(ws: Worksheet, reporte: string, meta: ReportMeta) {
  [
    ["Reporte", reporte],
    ["Período", `${format(meta.desde, "dd/MM/yyyy")} - ${format(meta.hasta, "dd/MM/yyyy")}`],
    ["Filtros aplicados", meta.filtros],
    ["Fecha de generación", format(meta.generado, "dd/MM/yyyy HH:mm")],
  ].forEach((par, i) => setRow(ws, i + 1, par, (col) => (col === 0 ? S.metaLabel : S.metaValue)));
}

interface TablaSheet {
  hoja: string;
  reporte: string;
  headers: string[];
  filas: Celda[][];
  anchos: number[];
  /** Índices (0-based) de columnas numéricas con separador de miles */
  numericas?: number[];
  /** Índices de columnas de porcentaje (texto "12.3%") */
  porcentajes?: number[];
}

// Fila de encabezados de cada tabla: 4 filas de metadatos + 1 vacía
const HEADER_ROW = 6;

function addTableSheet(wb: Workbook, meta: ReportMeta, t: TablaSheet): Worksheet {
  const ws = wb.addWorksheet(t.hoja);
  ws.columns = t.anchos.map((width) => ({ width }));
  writeMeta(ws, t.reporte, meta);

  setRow(ws, HEADER_ROW, t.headers, () => S.colHeader);
  ws.getRow(HEADER_ROW).height = 32;

  t.filas.forEach((fila, i) => {
    const alt = i % 2 === 1;
    setRow(ws, HEADER_ROW + 1 + i, fila, (col) =>
      t.numericas?.includes(col) ? numero(alt) : t.porcentajes?.includes(col) ? porcentaje(alt) : dato(alt),
    );
  });

  ws.autoFilter = {
    from: { row: HEADER_ROW, column: 1 },
    to: { row: HEADER_ROW + Math.max(t.filas.length, 1), column: t.headers.length },
  };
  return ws;
}

function addResumenSheet(wb: Workbook, data: AnalyticsData, meta: ReportMeta) {
  const ws = wb.addWorksheet("Resumen");
  ws.columns = [{ width: 32 }, { width: 22 }, { width: 14 }, { width: 20 }];
  writeMeta(ws, "Resumen Ejecutivo", meta);

  let fila = 6;
  const seccion = (titulo: string) => setRow(ws, fila++, [titulo], () => S.sectionTitle);
  const indicadores = (items: [string, Celda][]) => {
    items.forEach(([label, valor], i) => {
      const alt = i % 2 === 1;
      setRow(ws, fila++, [label, valor], (col) => (col === 0 ? dato(alt) : typeof valor === "number" ? numero(alt) : porcentaje(alt)));
    });
    fila++;
  };

  seccion("INDICADORES DE GESTIÓN");
  indicadores([
    ["Total Casos", data.totalCasos],
    ["Casos Renovados", data.casosRenovados],
    ["Tasa de Renovación", PCT(data.tasaRenovacion)],
    ["Gestiones Registradas", data.gestionesRegistradas],
  ]);
  seccion("RESUMEN FINANCIERO");
  indicadores([
    ["Total Facturado", data.totalFacturado],
    ["Pendiente de Cobro", data.pendienteCobro],
    ["% Recaudo", PCT(data.porcentajeRecaudo)],
    ["Valor Promedio / Renovación", data.valorPromedio],
  ]);
  seccion("DISTRIBUCIÓN POR TIPO DE CLIENTE");
  setRow(ws, fila++, ["Tipo", "Cantidad", "% del total", "Valor Facturado"], () => S.colHeader);
  data.distribucionClientes.forEach((c, i) => {
    const alt = i % 2 === 1;
    setRow(ws, fila++, [c.tipo, c.count, PCT(c.percentage), c.valorFacturado], (col) =>
      col === 0 ? dato(alt) : col === 2 ? porcentaje(alt) : numero(alt),
    );
  });
}

/** Libro de 9 hojas con el detalle de Analítica. */
export async function buildAnalyticsWorkbook(data: AnalyticsData, meta: ReportMeta): Promise<Workbook> {
  const ExcelJS = await loadExcelJS();
  const wb = new ExcelJS.Workbook();
  wb.creator = "Contact Center · Cámara de Comercio de Barranquilla";

  addResumenSheet(wb, data, meta);

  addTableSheet(wb, meta, {
    hoja: "Trámites Renovados",
    reporte: "Trámites Renovados",
    headers: ["Fecha Renovación", "N° Matrícula / ID", "Razón Social / Nombre", "Tipo", "Agente", "Campaña", "Valor Pagado", "Días hasta Renovación"],
    filas: data.tramitesRenovados.map((t) => [
      t.fechaRenovacion, t.numeroMatricula, t.nombreRazonSocial, t.tipo, t.agente, t.campana, t.valorPagado, t.diasHastaRenovacion,
    ]),
    anchos: [16, 18, 36, 10, 28, 24, 16, 22],
    numericas: [6],
  });

  const pendientes = addTableSheet(wb, meta, {
    hoja: "Pendientes de Pago",
    reporte: "Pendientes de Pago",
    headers: ["Fecha del Caso", "N° Matrícula / ID", "Razón Social / Nombre", "Agente", "Campaña", "Valor", "Días en Pendiente"],
    filas: data.pendientesPago.map((p) => [
      p.fechaCaso, p.numeroMatricula, p.nombreRazonSocial, p.agente, p.campana, p.valor, p.diasEnPendiente,
    ]),
    anchos: [16, 18, 36, 28, 24, 16, 18],
    numericas: [5],
  });
  // Más de 30 días en pendiente: resaltado en naranja
  data.pendientesPago.forEach((p, i) => {
    if (p.diasEnPendiente <= 30) return;
    const alt = i % 2 === 1;
    pendientes.getCell(HEADER_ROW + 1 + i, 7).style = {
      font: { bold: true, color: { argb: C.naranja }, size: 10 },
      ...(alt ? { fill: solid(C.grisClaro) } : {}),
      numFmt: "#,##0",
      alignment: { horizontal: "right" },
    };
  });

  addTableSheet(wb, meta, {
    hoja: "Recaudo por Fecha",
    reporte: "Recaudo por Fecha",
    headers: ["Fecha", "Renovados del día", "Valor Facturado", "Valor Pendiente", "% Recaudo del día"],
    filas: data.recaudoPorFecha.map((r) => [r.fecha, r.renovadosDelDia, r.valorFacturado, r.valorPendiente, PCT(r.porcentajeRecaudo)]),
    anchos: [14, 18, 18, 18, 20],
    numericas: [2, 3],
    porcentajes: [4],
  });

  addTableSheet(wb, meta, {
    hoja: "Rendimiento Agentes",
    reporte: "Rendimiento de Agentes",
    headers: ["Agente", "Casos Asignados", "Gestiones", "Renovados", "Tasa Renovación", "Valor Facturado", "Valor Pendiente", "% Recaudo", "Promedio / Renovación"],
    filas: data.rendimientoAgentes.map((a) => [
      a.agente, a.casosAsignados, a.gestiones, a.renovados, PCT(a.tasaRenovacion),
      a.valorFacturado, a.valorPendiente, PCT(a.porcentajeRecaudo), a.promedioPorRenovacion,
    ]),
    anchos: [30, 16, 12, 12, 16, 18, 18, 12, 22],
    numericas: [1, 2, 3, 5, 6, 8],
    porcentajes: [4, 7],
  });

  addTableSheet(wb, meta, {
    hoja: "Gestiones por Día",
    reporte: "Gestiones por Día",
    headers: ["Fecha", "Gestiones", "Renovados del día", "Valor Facturado del día", "Valor Pendiente del día"],
    filas: data.gestionesPorDia.map((g) => [g.fecha.substring(0, 10), g.count, g.renovadosDelDia, g.valorFacturadoDia, g.valorPendienteDia]),
    anchos: [14, 12, 18, 22, 22],
    numericas: [1, 2, 3, 4],
  });

  addTableSheet(wb, meta, {
    hoja: "Casos por Estado",
    reporte: "Casos por Estado",
    headers: ["Estado", "Cantidad", "Porcentaje"],
    filas: data.casosPorEstado.map((e) => [e.estado, e.count, PCT(e.percentage)]),
    anchos: [24, 12, 12],
    numericas: [1],
    porcentajes: [2],
  });

  addTableSheet(wb, meta, {
    hoja: "Por Campaña",
    reporte: "Resumen por Campaña",
    headers: ["Campaña", "Casos", "Renovados", "Tasa Renovación", "Facturado", "Pendiente"],
    filas: data.resumenCampanas.map((c) => [c.campana, c.casos, c.renovados, PCT(c.tasa), c.facturado, c.pendiente]),
    anchos: [28, 10, 12, 16, 18, 18],
    numericas: [1, 2, 4, 5],
    porcentajes: [3],
  });

  addTableSheet(wb, meta, {
    hoja: "Clientes",
    reporte: "Distribución de Clientes",
    headers: ["Tipo Cliente", "Cantidad", "Porcentaje", "Valor Facturado"],
    filas: data.distribucionClientes.map((c) => [c.tipo, c.count, PCT(c.percentage), c.valorFacturado]),
    anchos: [18, 12, 14, 20],
    numericas: [1, 3],
    porcentajes: [2],
  });

  return wb;
}
