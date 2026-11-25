/** Filas por consulta: coincide con max_rows de la API (1000), que recorta cualquier respuesta mayor. */
export const EXPORT_BATCH_SIZE = 1000;

/**
 * Tope de filas por archivo. Excel admite más de un millón; este límite protege la memoria del
 * navegador, que arma el archivo completo antes de descargarlo.
 */
export const EXPORT_MAX_ROWS = 100000;

type Pagina<T> = PromiseLike<{ data: T[] | null; error: unknown }>;

/**
 * Trae todas las filas de una consulta para exportarlas, con un tope. Si hay más filas que el tope
 * falla en lugar de entregar un archivo incompleto, y lo hace sin descargar el resto.
 * `buildQuery` debe crear la consulta de cero en cada llamada y ordenarla de forma estable
 * (con desempate por id) para que los lotes no se solapen.
 * (Para listas sin tope, como Analítica, existe fetchAllPages.)
 */
export async function fetchAllForExport<T>(
  buildQuery: (from: number, to: number) => Pagina<T>,
  maxRows: number = EXPORT_MAX_ROWS,
): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; from < maxRows; from += EXPORT_BATCH_SIZE) {
    const { data, error } = await buildQuery(from, Math.min(from + EXPORT_BATCH_SIZE, maxRows) - 1);
    if (error) throw error;
    const lote = data ?? [];
    rows.push(...lote);
    if (lote.length < Math.min(EXPORT_BATCH_SIZE, maxRows - from)) return rows;
  }
  // Se llenó el tope exacto: una fila más confirma si sobran registros
  const { data, error } = await buildQuery(maxRows, maxRows);
  if (error) throw error;
  if ((data ?? []).length > 0) {
    throw new Error(`Hay más de ${maxRows.toLocaleString("es-CO")} registros. Aplica filtros para exportar menos.`);
  }
  return rows;
}
