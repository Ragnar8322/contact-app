export type Periodo = "dia" | "semana" | "mes" | "año";

export const WEEK_KEYS  = ["lun", "mar", "mie", "jue", "vie", "sab", "dom"];
export const MONTH_KEYS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

export interface FinancialRow {
  /** dia: hora 0-23 · semana: 0 = lunes … 6 = domingo · mes: día 1-31 · año: mes 0-11 */
  tramo: number;
  renovado: number | null;
  pendiente: number | null;
}

export interface FinancialChart {
  renovado: number;
  pendiente: number;
  chartData: { name: string; renovado: number; pendiente: number }[];
}

/** Etiqueta del eje X para un tramo del periodo. */
export function tramoKey(periodo: Periodo, tramo: number): string {
  switch (periodo) {
    case "dia":    return `${tramo}h`;
    case "semana": return WEEK_KEYS[tramo];
    case "mes":    return String(tramo);
    case "año":    return MONTH_KEYS[tramo];
  }
}

/**
 * Convierte los totales por tramo que devuelve financial_summary en la serie
 * completa de la gráfica: todos los tramos del periodo, con 0 donde no hubo casos.
 */
export function buildFinancialChart(rows: FinancialRow[], periodo: Periodo, diasEnMes: number): FinancialChart {
  const tramos =
    periodo === "dia"    ? Array.from({ length: 24 }, (_, i) => i) :
    periodo === "semana" ? Array.from({ length: 7 }, (_, i) => i) :
    periodo === "mes"    ? Array.from({ length: diasEnMes }, (_, i) => i + 1) :
                           Array.from({ length: 12 }, (_, i) => i);

  const byTramo = new Map(rows.map((r) => [r.tramo, r]));
  let renovado = 0;
  let pendiente = 0;
  const chartData = tramos.map((t) => {
    const r = byTramo.get(t);
    const ren = Number(r?.renovado ?? 0);
    const pen = Number(r?.pendiente ?? 0);
    renovado += ren;
    pendiente += pen;
    return { name: tramoKey(periodo, t), renovado: ren, pendiente: pen };
  });

  return { renovado, pendiente, chartData };
}
