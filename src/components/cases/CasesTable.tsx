import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight, Eye, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { RefetchBar, TableSkeletonRows } from "@/components/TableLoading";
import { CaseIdButton } from "@/components/cases/CaseIdButton";
import { EstadoBadge } from "@/components/cases/EstadoBadge";
import type { CasoListado } from "@/hooks/useCases";
import { formatCOP } from "@/lib/currency";
import { safeFormat } from "@/lib/date";

type SortField = "id" | "identificacion";
type SortDir = "asc" | "desc";

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100] as const;

interface Props {
  cases: CasoListado[];
  isLoading: boolean;
  isRefetching: boolean;
  /** Vista de transferidos: columnas de origen y destino */
  transferView: boolean;
  onOpen: (caso: CasoListado) => void;
  campanaName: (id: string | null) => string;
  /** user_id → nombre, para "Transferido por" */
  agenteName: (userId: string | null) => string | undefined;
  pagination: {
    page: number;
    pageSize: number;
    totalCount: number;
    totalPages: number;
    hasPrevPage: boolean;
    hasNextPage: boolean;
    onPage: (page: number) => void;
    onPageSize: (size: number) => void;
  };
}

function SortableHead({ field, label, sortField, sortDir, onSort }: {
  field: SortField;
  label: string;
  sortField: SortField | null;
  sortDir: SortDir;
  onSort: (field: SortField) => void;
}) {
  const active = sortField === field;
  const Icon = !active ? ArrowUpDown : sortDir === "asc" ? ArrowUp : ArrowDown;
  return (
    <TableHead aria-sort={active ? (sortDir === "asc" ? "ascending" : "descending") : "none"}>
      <button
        type="button"
        onClick={() => onSort(field)}
        className="inline-flex items-center gap-1 whitespace-nowrap rounded-sm hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {label}
        <Icon className={`h-3 w-3 ${active ? "" : "opacity-50"}`} aria-hidden="true" />
      </button>
    </TableHead>
  );
}

function Pagination({ page, pageSize, totalCount, totalPages, hasPrevPage, hasNextPage, onPage, onPageSize }: Props["pagination"]) {
  const fromRecord = totalCount === 0 ? 0 : (page - 1) * pageSize + 1;
  const toRecord = Math.min(page * pageSize, totalCount);
  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 border-t px-4 py-3">
      <p className="text-sm text-muted-foreground">
        Mostrando {fromRecord}–{toRecord} de {totalCount} casos
      </p>
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-muted-foreground">Por página:</span>
          <div className="flex rounded-md border bg-muted/50 p-0.5">
            {PAGE_SIZE_OPTIONS.map((size) => (
              <button
                key={size}
                type="button"
                aria-pressed={pageSize === size}
                onClick={() => onPageSize(size)}
                className={`px-2.5 py-1 text-xs font-medium rounded transition-colors ${pageSize === size ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
              >
                {size}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <Button variant="outline" size="sm" className="h-8 px-2" disabled={!hasPrevPage} onClick={() => onPage(Math.max(1, page - 1))}>
            <ChevronLeft className="h-4 w-4" />
            <span className="hidden sm:inline ml-1">Anterior</span>
          </Button>
          <span className="text-sm px-2 text-muted-foreground whitespace-nowrap">
            Página {page} de {totalPages}
          </span>
          <Button variant="outline" size="sm" className="h-8 px-2" disabled={!hasNextPage} onClick={() => onPage(Math.min(totalPages, page + 1))}>
            <span className="hidden sm:inline mr-1">Siguiente</span>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

export function CasesTable({ cases, isLoading, isRefetching, transferView, onOpen, campanaName, agenteName, pagination }: Props) {
  const [sortField, setSortField] = useState<SortField | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir("asc");
    }
  };

  // Ordena la página visible
  const sorted = useMemo(() => {
    if (!sortField) return cases;
    const key = (c: CasoListado) => (sortField === "id" ? c.id : c.clientes?.identificacion || "");
    return [...cases].sort((a, b) => {
      const valA = key(a), valB = key(b);
      if (valA < valB) return sortDir === "asc" ? -1 : 1;
      if (valA > valB) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
  }, [cases, sortField, sortDir]);

  const columns = transferView ? 7 : 9;

  return (
    <>
      <RefetchBar active={isRefetching} />

      <Table>
        <TableHeader>
          <TableRow>
            <SortableHead field="id" label="ID" sortField={sortField} sortDir={sortDir} onSort={toggleSort} />
            <TableHead>Cliente</TableHead>
            {transferView ? (
              <>
                <TableHead>Campaña origen</TableHead>
                <TableHead>Campaña destino</TableHead>
                <TableHead>Fecha transferencia</TableHead>
                <TableHead>Nuevo caso #</TableHead>
                <TableHead>Transferido por</TableHead>
              </>
            ) : (
              <>
                <SortableHead field="identificacion" label="NIT / Cédula" sortField={sortField} sortDir={sortDir} onSort={toggleSort} />
                <TableHead>Tipo</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Agente</TableHead>
                <TableHead>Valor a Pagar</TableHead>
                <TableHead>Fecha</TableHead>
                <TableHead><span className="sr-only">Estado de edición</span></TableHead>
              </>
            )}
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading ? (
            <TableSkeletonRows columns={columns} />
          ) : sorted.length === 0 ? (
            <TableRow><TableCell colSpan={columns} className="text-center py-8 text-muted-foreground">No hay casos</TableCell></TableRow>
          ) : sorted.map((caso) => (
            <TableRow key={caso.id} className="cursor-pointer hover:bg-muted/50" onClick={() => onOpen(caso)}>
              <TableCell><CaseIdButton id={caso.id} onOpen={() => onOpen(caso)} /></TableCell>
              <TableCell>{caso.clientes?.nombre_contacto || "-"}</TableCell>
              {transferView ? (
                <>
                  <TableCell className="text-sm">{campanaName(caso.campana_id)}</TableCell>
                  <TableCell className="text-sm">{caso.caso_destino?.campanas?.nombre ?? campanaName(caso.transferido_a_campana_id)}</TableCell>
                  <TableCell className="text-sm">{safeFormat(caso.fecha_cierre, "dd/MM/yyyy HH:mm")}</TableCell>
                  <TableCell className="text-sm font-medium">{caso.transferido_a_caso_id ? `#${caso.transferido_a_caso_id}` : "—"}</TableCell>
                  <TableCell className="text-sm">{agenteName(caso.updated_by) ?? "—"}</TableCell>
                </>
              ) : (
                <>
                  <TableCell className="font-mono text-sm">{caso.clientes?.identificacion || "-"}</TableCell>
                  <TableCell>{caso.cat_tipo_servicio?.nombre}</TableCell>
                  <TableCell>
                    <EstadoBadge nombre={caso.cat_estados?.nombre} />
                  </TableCell>
                  <TableCell>{caso.cat_agentes?.nombre || "-"}</TableCell>
                  <TableCell>{formatCOP(caso.valor_pagar)}</TableCell>
                  <TableCell>{safeFormat(caso.fecha_caso, "dd/MM/yyyy")}</TableCell>
                  <TableCell>
                    {caso.cat_estados?.es_final ? (
                      <span title="Caso cerrado: solo lectura">
                        <Lock className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                        <span className="sr-only">Cerrado, solo lectura</span>
                      </span>
                    ) : (
                      <span title="Caso abierto">
                        <Eye className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                        <span className="sr-only">Abierto</span>
                      </span>
                    )}
                  </TableCell>
                </>
              )}
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {pagination.totalCount > 0 && <Pagination {...pagination} />}
    </>
  );
}
