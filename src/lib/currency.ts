const formatter = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  maximumFractionDigits: 0,
  minimumFractionDigits: 0,
});

/** Format a number as Colombian pesos: $ 1.500.000 */
export function formatCOP(value: number | null | undefined): string {
  if (value == null || value === 0) return "-";
  return formatter.format(value);
}

/** Parse a formatted COP string back to a plain number */
export function parseCOPInput(raw: string): number {
  return Number(raw.replace(/[^0-9]/g, "")) || 0;
}

/** Format a raw input string as COP while typing */
export function formatCOPInput(raw: string): string {
  const num = parseCOPInput(raw);
  if (num === 0) return "";
  return formatter.format(num);
}
