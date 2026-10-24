/**
 * Trae todas las filas de una consulta de Supabase en páginas de `pageSize`.
 * La API devuelve como máximo 1.000 filas por petición; sin esto, las listas
 * largas se cortan sin aviso.
 */
export async function fetchAllPages<T>(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  buildQuery: (from: number, to: number) => PromiseLike<{ data: any[] | null; error: unknown }>,
  pageSize = 1000
): Promise<T[]> {
  const results: T[] = [];
  let from = 0;
  while (true) {
    const { data, error } = await buildQuery(from, from + pageSize - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;
    results.push(...(data as T[]));
    if (data.length < pageSize) break;
    from += pageSize;
  }
  return results;
}
