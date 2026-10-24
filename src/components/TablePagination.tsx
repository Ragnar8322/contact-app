import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  page: number;
  totalPages: number;
  totalCount: number;
  pageSize: number;
  itemLabel: string;
  onPageChange: (page: number) => void;
}

/** Pie de tabla con "Mostrando X–Y de N" y botones anterior/siguiente. */
export function TablePagination({ page, totalPages, totalCount, pageSize, itemLabel, onPageChange }: Props) {
  if (totalCount === 0) return null;
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, totalCount);

  return (
    <nav aria-label="Paginación" className="flex flex-col sm:flex-row items-center justify-between gap-3 border-t px-4 py-3">
      <p className="text-sm text-muted-foreground" aria-live="polite">
        Mostrando {from}–{to} de {totalCount} {itemLabel}
      </p>
      <div className="flex items-center gap-1.5">
        <Button variant="outline" size="sm" className="h-8 px-2" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>
          <ChevronLeft className="h-4 w-4" />
          <span className="hidden sm:inline ml-1">Anterior</span>
        </Button>
        <span className="text-sm px-2 text-muted-foreground whitespace-nowrap">
          Página {page} de {totalPages}
        </span>
        <Button variant="outline" size="sm" className="h-8 px-2" disabled={page >= totalPages} onClick={() => onPageChange(page + 1)}>
          <span className="hidden sm:inline mr-1">Siguiente</span>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </nav>
  );
}
