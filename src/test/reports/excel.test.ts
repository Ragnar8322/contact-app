import { describe, it, expect, vi } from "vitest";

vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));

import { loadExcelJS, readFirstSheet } from "@/lib/reports/excel";
import { buildAnalyticsWorkbook } from "@/lib/reports/analyticsExcel";
import { computeAnalytics, type CasoAnalitica } from "@/lib/analytics";
import { validateRow } from "@/hooks/useImportCasos";

async function libroDePrueba() {
  const ExcelJS = await loadExcelJS();
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Hoja");
  ws.addRow(["Cliente Identificacion", "agente_correo", "estado", "tipo_servicio", "descripcion_inicial", "fecha_caso", "valor_pagar"]);
  // Excel guarda las fechas sin zona: ExcelJS las entrega como medianoche UTC
  ws.addRow([900123456, { text: "ana@camarabaq.org.co", hyperlink: "mailto:ana@camarabaq.org.co" }, "Registrado",
    { richText: [{ text: "Renovación " }, { text: "Web", font: { bold: true } }] }, "Renovar", new Date(Date.UTC(2026, 0, 15)), 150000]);
  ws.addRow([]);
  ws.addRow(["  ", null, null, null, null, null, null]);
  ws.addRow(["800", "luis@camarabaq.org.co", "Registrado", "Renovación Web", "x", "15/01/2026", { formula: "100*1500", result: 150000 }]);
  return wb.xlsx.writeBuffer();
}

describe("readFirstSheet", () => {
  it("lee valores simples de enlaces, texto enriquecido, fórmulas y fechas", async () => {
    const filas = await readFirstSheet(await libroDePrueba() as ArrayBuffer);
    expect(filas).toHaveLength(2);
    const [a, b] = filas;
    expect(a.valores).toMatchObject({
      "Cliente Identificacion": 900123456,
      agente_correo: "ana@camarabaq.org.co",
      tipo_servicio: "Renovación Web",
      valor_pagar: 150000,
    });
    expect(b.valores.valor_pagar).toBe(150000);
  });

  it("conserva el número real de fila de Excel aunque haya filas vacías", async () => {
    const filas = await readFirstSheet(await libroDePrueba() as ArrayBuffer);
    expect(filas.map((f) => f.fila)).toEqual([2, 5]);
  });

  it("una fecha de Excel conserva el día en la zona local", async () => {
    const [a] = await readFirstSheet(await libroDePrueba() as ArrayBuffer);
    const row = validateRow(a.valores, a.fila);
    expect(row.fecha_caso).toBe("2026-01-15");
    expect(row.cliente_identificacion).toBe("900123456");
    expect(row._valid).toBe(true);
  });
});

describe("buildAnalyticsWorkbook", () => {
  const caso = (id: number, estado: string, valor: number, fecha: string): CasoAnalitica => ({
    id, agente_id: "a1", cliente_id: 1, valor_pagar: valor, fecha_caso: fecha, created_at: "2026-01-01T00:00:00Z",
    cat_estados: { nombre: estado }, cat_agentes: null, campanas: { nombre: "Renovación Web" },
  });
  const data = computeAnalytics({
    casos: [caso(1, "Renovado", 200000, "2026-01-05"), caso(2, "Pendiente de Pago", 90000, "2026-01-02"), caso(3, "Pendiente de Pago", 50000, "2026-01-28")],
    gestiones: [{ agente_id: "a1", agente_nombre: null, cambiado_en: "2026-01-05T10:00:00Z" }],
    clientes: [{ id: 1, tipo_cliente: "Empresa", identificacion: "900", nombre_contacto: "Ana", razon_social: "ACME" }],
    nombresAgentes: new Map([["a1", "Ana Agente"]]),
    dateFrom: new Date(2026, 0, 1),
    dateTo: new Date(2026, 0, 31),
    hoy: new Date(2026, 1, 10),
  });
  const meta = { desde: new Date(2026, 0, 1), hasta: new Date(2026, 0, 31), filtros: "Campaña: Todas", generado: new Date(2026, 1, 10, 9, 30) };

  async function releer() {
    const wb = await buildAnalyticsWorkbook(data, meta);
    const ExcelJS = await loadExcelJS();
    const copia = new ExcelJS.Workbook();
    await copia.xlsx.load(await wb.xlsx.writeBuffer());
    return copia;
  }

  it("genera las nueve hojas con los metadatos del reporte", async () => {
    const wb = await releer();
    expect(wb.worksheets.map((w) => w.name)).toEqual([
      "Resumen", "Trámites Renovados", "Pendientes de Pago", "Recaudo por Fecha", "Rendimiento Agentes",
      "Gestiones por Día", "Casos por Estado", "Por Campaña", "Clientes",
    ]);
    const resumen = wb.getWorksheet("Resumen")!;
    expect(resumen.getCell("B2").value).toBe("01/01/2026 - 31/01/2026");
    expect(resumen.getCell("B4").value).toBe("10/02/2026 09:30");
    expect(resumen.getCell("A7").value).toBe("Total Casos");
    expect(resumen.getCell("B7").value).toBe(3);
    expect(resumen.getCell("B13").value).toBe(200000);
  });

  it("las tablas tienen encabezado con estilo, filtro y montos numéricos", async () => {
    const ws = (await releer()).getWorksheet("Rendimiento Agentes")!;
    const header = ws.getCell("A6");
    expect(header.value).toBe("Agente");
    expect(header.font?.bold).toBe(true);
    expect(header.fill).toMatchObject({ type: "pattern", fgColor: { argb: "FF0D3266" } });
    expect(ws.autoFilter).toBeTruthy();
    expect(ws.getCell("A7").value).toBe("Ana Agente");
    expect(ws.getCell("F7").value).toBe(200000);
    expect(ws.getCell("F7").numFmt).toBe("#,##0");
    expect(ws.getCell("E7").value).toBe("33.3%");
  });

  it("resalta en naranja los pendientes de más de 30 días", async () => {
    const ws = (await releer()).getWorksheet("Pendientes de Pago")!;
    // Ordenados por días en pendiente, de mayor a menor
    expect(ws.getCell("G7").value).toBe(39);
    expect(ws.getCell("G7").font?.color?.argb).toBe("FFFF6B35");
    expect(ws.getCell("G8").value).toBe(13);
    expect(ws.getCell("G8").font?.color?.argb).not.toBe("FFFF6B35");
  });
});
