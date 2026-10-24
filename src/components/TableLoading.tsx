import { Skeleton } from "@/components/ui/skeleton";
import { TableCell, TableRow } from "@/components/ui/table";

/** Filas esqueleto para la primera carga de una tabla. */
export function TableSkeletonRows({ columns, rows = 6 }: { columns: number; rows?: number }) {
  return (
    <>
      {Array.from({ length: rows }, (_, r) => (
        <TableRow key={r} aria-hidden="true">
          {Array.from({ length: columns }, (_, c) => (
            <TableCell key={c}>
              <Skeleton className="h-4 w-full max-w-[160px]" />
            </TableCell>
          ))}
        </TableRow>
      ))}
    </>
  );
}

/**
 * Barra fina de progreso para recargas (búsqueda, filtros, paginación):
 * los datos anteriores siguen visibles mientras llegan los nuevos.
 */
export function RefetchBar({ active }: { active: boolean }) {
  return (
    <div
      role="progressbar"
      aria-label="Actualizando resultados"
      aria-hidden={!active}
      className={`absolute inset-x-0 top-0 z-10 h-0.5 overflow-hidden rounded-t-lg transition-opacity duration-200 ${active ? "opacity-100" : "opacity-0"}`}
    >
      <div className="h-full w-1/3 bg-primary animate-[refetch-slide_1s_ease-in-out_infinite] motion-reduce:animate-none motion-reduce:w-full" />
    </div>
  );
}
