import { format } from "date-fns";
import { es } from "date-fns/locale";

export function safeFormat(
  dateStr: string | null | undefined,
  fmt: string
): string {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  return isNaN(d.getTime()) ? "—" : format(d, fmt, { locale: es });
}
