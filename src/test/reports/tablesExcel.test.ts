import { describe, it, expect, vi } from "vitest";

vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));

import { loadExcelJS } from "@/lib/reports/excel";
import {
  buildCasosWorkbook, buildClientesWorkbook, fechaLocal, CASOS_OPCIONES, CLIENTES_OPCIONES, type CasoExportable,
} from "@/lib/reports/tablesExcel";
import { fetchAllForExport, EXPORT_BATCH_SIZE, EXPORT_MAX_ROWS } from "@/lib/fetchForExport";

async function releer(wb: Awaited<ReturnType<typeof buildCasosWorkbook>>) {
  const ExcelJS = await loadExcelJS();
  const copia = new ExcelJS.Workbook();
  await copia.xlsx.load(await wb.xlsx.writeBuffer());
  return copia;
}

const caso = (over: Partial<CasoExportable> = {}): CasoExportable => ({
  id: 7,
  fecha_caso: "2026-03-05T15:30:00-05:00",
  fecha_cierre: null,
  valor_pagar: 1500000,
  descripcion_inicial: "Renovar matrícula",
  observacion_cierre: null,
  campana_id: "c1",
  transferido_a_campana_id: null,
  transferido_a_caso_id: null,
  clientes: { identificacion: "0900123", nombre_contacto: "ANA PÉREZ", razon_social: "ACME SAS", telefono: "0353000", celular: null, correo: "ana@acme.co" },
  cat_estados: { nombre: "En gestión" },
  cat_tipo_servicio: { nombre: "Renovación" },
  cat_agentes: { nombre: "LAURA MARTÍNEZ" },
  caso_destino: null,
  ...over,
});

const campanaName = (id: string | null) => (id === "c1" ? "Renovación Web" : id === "c2" ? "Asesoría" : "—");

describe("buildCasosWorkbook", () => {
  it("genera una tabla de Excel con encabezados, una fila por caso y filtros", async () => {
    const wb = await releer(await buildCasosWorkbook([caso(), caso({ id: 8 })], campanaName));
    const ws = wb.getWorksheet("Casos")!;
    expect(ws.getTable("Casos")).toBeTruthy();
    expect(ws.getCell("A1").value).toBe("ID");
    expect(ws.getCell("M1").value).toBe("Valor a pagar");
    expect(ws.getCell("A2").value).toBe(7);
    expect(ws.getCell("A3").value).toBe(8);
    expect(ws.actualRowCount).toBe(3);
  });

  it("conserva ceros a la izquierda y trae montos numéricos", async () => {
    const ws = (await releer(await buildCasosWorkbook([caso()], campanaName))).getWorksheet("Casos")!;
    expect(ws.getCell("C2").value).toBe("0900123");
    expect(ws.getCell("F2").value).toBe("0353000");
    expect(ws.getCell("M2").value).toBe(1500000);
    expect(ws.getCell("M2").numFmt).toBe("#,##0");
    expect(ws.getCell("I2").value).toBe("Renovación Web");
    expect(ws.getCell("K2").value).toBe("En gestión");
  });

  it("muestra la fecha con la hora local que ve el usuario", async () => {
    const ws = (await releer(await buildCasosWorkbook([caso()], campanaName))).getWorksheet("Casos")!;
    const f = ws.getCell("B2").value as Date;
    const local = new Date("2026-03-05T15:30:00-05:00");
    // ExcelJS devuelve el instante en UTC: sus componentes UTC deben ser la hora local del usuario
    expect(f.getUTCHours()).toBe(local.getHours());
    expect(f.getUTCDate()).toBe(local.getDate());
  });

  it("en transferidos usa la campaña destino del nuevo caso", async () => {
    const t = caso({
      transferido_a_campana_id: "c2",
      transferido_a_caso_id: 99,
      caso_destino: { campanas: { nombre: "Asesoría Especializada" } },
    });
    const ws = (await releer(await buildCasosWorkbook([t], campanaName))).getWorksheet("Casos")!;
    expect(ws.getCell("Q2").value).toBe("Asesoría Especializada");
    expect(ws.getCell("R2").value).toBe(99);
  });

  it("incluye solo las columnas elegidas, en el orden del archivo y no en el de selección", async () => {
    const wb = await releer(await buildCasosWorkbook([caso()], campanaName, ["valor_pagar", "cliente", "id"]));
    const ws = wb.getWorksheet("Casos")!;
    expect(ws.getRow(1).values).toEqual([undefined, "ID", "Cliente", "Valor a pagar"]);
    expect(ws.getCell("A2").value).toBe(7);
    expect(ws.getCell("B2").value).toBe("ANA PÉREZ");
    expect(ws.getCell("C2").value).toBe(1500000);
    expect(ws.getCell("C2").numFmt).toBe("#,##0");
    expect(ws.getCell("D1").value ?? null).toBeNull();
  });

  it("ignora claves que ya no existen y rechaza una selección vacía", async () => {
    const wb = await releer(await buildCasosWorkbook([caso()], campanaName, ["id", "columna_borrada"]));
    expect(wb.getWorksheet("Casos")!.getRow(1).values).toEqual([undefined, "ID"]);
    await expect(buildCasosWorkbook([caso()], campanaName, [])).rejects.toThrow(/al menos una columna/);
    await expect(buildCasosWorkbook([caso()], campanaName, ["nada"])).rejects.toThrow(/al menos una columna/);
  });

  it("las opciones del diálogo coinciden con las columnas del archivo completo", async () => {
    const ws = (await releer(await buildCasosWorkbook([caso()], campanaName))).getWorksheet("Casos")!;
    const encabezados = (ws.getRow(1).values as unknown[]).slice(1);
    expect(CASOS_OPCIONES.map((o) => o.titulo)).toEqual(encabezados);
    expect(new Set(CASOS_OPCIONES.map((o) => o.key)).size).toBe(CASOS_OPCIONES.length);
  });

  it("deja vacías las celdas sin dato en lugar de escribir guiones o 'null'", async () => {
    const ws = (await releer(await buildCasosWorkbook([caso({ campana_id: null, clientes: null })], campanaName))).getWorksheet("Casos")!;
    expect(ws.getCell("I2").value).toBe("");
    expect(ws.getCell("D2").value ?? null).toBeNull();
    expect(ws.getCell("O2").value ?? null).toBeNull();
  });
});

describe("buildClientesWorkbook", () => {
  it("exporta una fila por cliente", async () => {
    const wb = await releer(await buildClientesWorkbook([
      { id: 1, identificacion: "900", nombre_contacto: "ANA", tipo_cliente: "Empresa", razon_social: "ACME", telefono: null, celular: "300", correo: "a@a.co", created_at: "2026-01-02T10:00:00Z" },
    ]));
    const ws = wb.getWorksheet("Clientes")!;
    expect(ws.getTable("Clientes")).toBeTruthy();
    expect(ws.getCell("C1").value).toBe("Nombre del contacto");
    expect(ws.getCell("C2").value).toBe("ANA");
    expect(ws.getCell("D2").value).toBe("Empresa");
    expect(ws.getCell("G2").value).toBe("300");
  });

  it("exporta solo las columnas marcadas", async () => {
    const wb = await releer(await buildClientesWorkbook(
      [{ id: 1, identificacion: "900", nombre_contacto: "ANA", tipo_cliente: "Empresa", razon_social: "ACME", telefono: null, celular: "300", correo: "a@a.co", created_at: null }],
      ["correo", "identificacion"],
    ));
    const ws = wb.getWorksheet("Clientes")!;
    expect(ws.getRow(1).values).toEqual([undefined, "NIT / Cédula", "Correo"]);
    expect(ws.getCell("B2").value).toBe("a@a.co");
  });

  it("las opciones del diálogo coinciden con las columnas del archivo completo", async () => {
    const wb = await releer(await buildClientesWorkbook([
      { id: 1, identificacion: "900", nombre_contacto: "ANA", tipo_cliente: "Empresa", razon_social: null, telefono: null, celular: null, correo: null, created_at: null },
    ]));
    const encabezados = (wb.getWorksheet("Clientes")!.getRow(1).values as unknown[]).slice(1);
    expect(CLIENTES_OPCIONES.map((o) => o.titulo)).toEqual(encabezados);
  });
});

describe("fechaLocal", () => {
  it("devuelve null para vacíos y fechas inválidas", () => {
    expect(fechaLocal(null)).toBeNull();
    expect(fechaLocal("no es fecha")).toBeNull();
  });
});

describe("fetchAllForExport", () => {
  /** Simula una tabla con `total` filas: responde solo el rango pedido, como PostgREST. */
  const tabla = (total: number) =>
    vi.fn(async (from: number, to: number) => ({
      data: Array.from({ length: Math.max(0, Math.min(to + 1, total) - from) }, (_, i) => ({ id: from + i })),
      error: null,
    }));

  it("junta todos los lotes hasta que llega uno incompleto", async () => {
    const fetchPage = tabla(EXPORT_BATCH_SIZE + 250);
    const rows = await fetchAllForExport(fetchPage);
    expect(rows).toHaveLength(EXPORT_BATCH_SIZE + 250);
    expect(new Set(rows.map((r) => r.id)).size).toBe(rows.length);
    expect(fetchPage).toHaveBeenNthCalledWith(1, 0, EXPORT_BATCH_SIZE - 1);
    expect(fetchPage).toHaveBeenNthCalledWith(2, EXPORT_BATCH_SIZE, EXPORT_BATCH_SIZE * 2 - 1);
  });

  it("sin filas devuelve una lista vacía", async () => {
    expect(await fetchAllForExport(tabla(0))).toEqual([]);
  });

  it("propaga el error de la consulta", async () => {
    const fetchPage = vi.fn().mockResolvedValue({ data: null, error: { message: "permiso denegado" } });
    await expect(fetchAllForExport(fetchPage)).rejects.toMatchObject({ message: "permiso denegado" });
  });

  it("el tope por archivo es de 100.000 registros", () => {
    expect(EXPORT_MAX_ROWS).toBe(100000);
  });

  it("acepta exactamente el tope de registros", async () => {
    const fetchPage = tabla(EXPORT_MAX_ROWS);
    const rows = await fetchAllForExport(fetchPage);
    expect(rows).toHaveLength(EXPORT_MAX_ROWS);
    // 100 lotes + una consulta de 1 fila que confirma que no sobra nada
    expect(fetchPage).toHaveBeenCalledTimes(EXPORT_MAX_ROWS / EXPORT_BATCH_SIZE + 1);
  });

  it("rechaza un registro por encima del tope en lugar de entregar un archivo incompleto", async () => {
    await expect(fetchAllForExport(tabla(EXPORT_MAX_ROWS + 1))).rejects.toThrow(/más de 100\.000 registros/);
  });

  it("al pasarse del tope no descarga el resto de la tabla", async () => {
    const fetchPage = tabla(5_000_000);
    await expect(fetchAllForExport(fetchPage, EXPORT_BATCH_SIZE * 2)).rejects.toThrow(/Aplica filtros/);
    expect(fetchPage).toHaveBeenCalledTimes(3); // 2 lotes + la fila de comprobación
  });
});
