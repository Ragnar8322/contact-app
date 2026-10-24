import type { Workbook, CellValue } from "exceljs";

/**
 * ExcelJS se carga bajo demanda (pesa ~850 KB) y lo comparten la importación y los reportes.
 * Se usa la variante sin polyfills: los navegadores soportados ya tienen lo necesario.
 */
export async function loadExcelJS() {
  const mod = await import("exceljs/dist/exceljs.bare.min.js");
  return mod.default;
}

export const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

/** Descarga el libro en el navegador con el nombre dado. */
export async function downloadWorkbook(wb: Workbook, fileName: string) {
  const buffer = await wb.xlsx.writeBuffer();
  const url = URL.createObjectURL(new Blob([buffer], { type: XLSX_MIME }));
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

/**
 * Valor útil de una celda. ExcelJS devuelve objetos para fórmulas, hipervínculos (un correo
 * escrito en Excel suele volverse enlace), texto enriquecido y errores.
 * Las fechas llegan en UTC; se pasan a la misma fecha y hora en la zona local para que
 * 15/01/2026 siga siendo 15/01/2026 en Colombia.
 */
export function cellPlainValue(value: CellValue): string | number | boolean | Date | null {
  if (value == null) return null;
  if (value instanceof Date) {
    return new Date(
      value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate(),
      value.getUTCHours(), value.getUTCMinutes(), value.getUTCSeconds(),
    );
  }
  if (typeof value !== "object") return value;
  if ("richText" in value) return value.richText.map((r) => r.text).join("");
  if ("hyperlink" in value) return cellPlainValue(value.text as CellValue);
  if ("result" in value) return cellPlainValue((value.result ?? null) as CellValue);
  if ("error" in value) return null;
  return null;
}

export interface SheetRow {
  /** Número de fila en Excel (la primera fila de datos es la 2) */
  fila: number;
  valores: Record<string, unknown>;
}

/**
 * Lee la primera hoja: la fila 1 son los encabezados y cada fila siguiente un objeto
 * { encabezado: valor }. Las celdas vacías quedan en null y las filas vacías se omiten.
 */
export async function readFirstSheet(data: ArrayBuffer): Promise<SheetRow[]> {
  const ExcelJS = await loadExcelJS();
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(data);
  const ws = wb.worksheets[0];
  if (!ws) return [];

  const headers: string[] = [];
  ws.getRow(1).eachCell((cell, col) => {
    const h = cellPlainValue(cell.value);
    if (h != null) headers[col] = String(h).trim();
  });

  const rows: SheetRow[] = [];
  ws.eachRow((row, fila) => {
    if (fila === 1) return;
    const valores: Record<string, unknown> = {};
    let vacia = true;
    headers.forEach((h, col) => {
      if (!h) return;
      const v = cellPlainValue(row.getCell(col).value);
      const conValor = v !== null && !(typeof v === "string" && v.trim() === "");
      if (conValor) vacia = false;
      valores[h] = conValor ? v : null;
    });
    if (!vacia) rows.push({ fila, valores });
  });
  return rows;
}
