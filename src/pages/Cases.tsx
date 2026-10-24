import { useState, useMemo, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { Plus, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useCampana } from "@/contexts/CampanaContext";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { useCases, useCaseById, useEstados, useTiposServicio, useAgentes, type CasesFilters } from "@/hooks/useCases";
import { useCampanasList } from "@/hooks/useCampanas";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogTrigger } from "@/components/ui/dialog";
import UnifiedCaseForm from "@/components/cases/UnifiedCaseForm";
import CasesFilterBar from "@/components/cases/CasesFilterBar";
import ProportionalAssignModal from "@/components/cases/ProportionalAssignModal";
import { CasesTable } from "@/components/cases/CasesTable";
import { CaseDetailSheet } from "@/components/cases/CaseDetailSheet";

type QuickFilter = "todos" | "activos" | "cerrados" | "transferidos";

export default function Cases() {
  const { isGerente, hasRole } = useAuth();
  const { campanaActiva } = useCampana();
  const { data: estados } = useEstados();
  const { data: tiposServicio } = useTiposServicio();
  const { data: agentesData } = useAgentes();
  const { data: allCampanas = [] } = useCampanasList();

  // Enlaces entrantes: /casos?caso=123 abre ese caso; /casos?buscar=900123 llega con la búsqueda aplicada
  const [searchParams, setSearchParams] = useSearchParams();
  const buscarParam = searchParams.get("buscar") ?? "";
  const casoParam = Number(searchParams.get("caso")) || null;

  const [quickFilter, setQuickFilter] = useState<QuickFilter>(buscarParam ? "todos" : "activos");
  const [searchText, setSearchText] = useState(buscarParam);
  const debouncedSearch = useDebouncedValue(searchText);
  const [filters, setFilters] = useState<CasesFilters>({});
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const filtersWithCampana = useMemo(() => {
    const base: CasesFilters = {
      ...filters,
      campanaId: campanaActiva?.id,
      searchText: debouncedSearch.trim() || undefined,
    };

    if (!estados || estados.length === 0) return base;

    const transferidoEstado = estados.find((e) => e.nombre === "Transferido");
    const transferidoId = transferidoEstado?.id;

    if (quickFilter === "todos") {
      base.estadoIds = undefined;
    } else if (quickFilter === "transferidos") {
      base.estadoIds = transferidoId ? [transferidoId] : [];
    } else if (quickFilter === "cerrados") {
      const closedIds = estados
        .filter((e) => e.es_final && e.nombre !== "Transferido")
        .map((e) => e.id);
      base.estadoIds = closedIds.length > 0 ? closedIds : undefined;
    } else {
      const activeIds = estados
        .filter((e) => !e.es_final && e.nombre !== "Transferido")
        .map((e) => e.id);
      base.estadoIds = activeIds.length > 0 ? activeIds : undefined;
    }

    return base;
  }, [filters, campanaActiva, estados, quickFilter, debouncedSearch]);

  useEffect(() => {
    setPage(1);
  }, [filtersWithCampana, quickFilter]);

  const { data: paginatedResult, isLoading, isFetching } = useCases(filtersWithCampana, { page, pageSize });

  const cases = paginatedResult?.data ?? [];
  const totalCount = paginatedResult?.totalCount ?? 0;

  const { data: tabCounts } = useQuery({
    queryKey: ["casos-counts", campanaActiva?.id],
    enabled: !!campanaActiva?.id,
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .rpc("get_casos_counts", { p_campana_id: campanaActiva!.id });
      if (error) throw error;
      return data as { todos: number; activos: number; cerrados: number; transferidos: number };
    },
  });

  const todosCount        = tabCounts?.todos ?? null;
  const activosCount      = tabCounts?.activos ?? null;
  const cerradosCount     = tabCounts?.cerrados ?? null;
  const transferidosCount = tabCounts?.transferidos ?? null;

  const [createOpen, setCreateOpen] = useState(false);
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [selectedCaseId, setSelectedCaseId] = useState<number | null>(null);

  // Un enlace /casos?caso=123 abre ese caso
  useEffect(() => {
    if (casoParam) setSelectedCaseId(casoParam);
  }, [casoParam]);

  // El caso abierto se toma de la página visible; si no está ahí (enlace directo, o un caso
  // que salió de la lista al cerrarlo), se trae por id
  const enLista = cases.find((c) => c.id === selectedCaseId);
  const { data: casoPorId, isError: errorPorId } = useCaseById(selectedCaseId && !enLista ? selectedCaseId : null);
  const selectedCase = enLista ?? (casoPorId?.id === selectedCaseId ? casoPorId : undefined);
  // No existe o no hay acceso (por ejemplo, el caso destino de una transferencia)
  const noDisponible = !!selectedCaseId && !selectedCase && errorPorId;

  const closeDetail = () => {
    setSelectedCaseId(null);
    if (searchParams.has("caso")) {
      const next = new URLSearchParams(searchParams);
      next.delete("caso");
      setSearchParams(next, { replace: true });
    }
  };

  const openCaseById = (id: number) => {
    const next = new URLSearchParams(searchParams);
    next.set("caso", String(id));
    setSearchParams(next);
  };

  const campanaName = (id: string | null) => {
    if (!id) return "—";
    return allCampanas.find((c) => c.id === id)?.nombre || "—";
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Casos</h1>
          <p className="text-muted-foreground">Gestión y seguimiento de casos</p>
        </div>
        {!isGerente && (
          <div className="flex gap-2">
            {hasRole(["admin", "supervisor"]) && (
              <Button variant="outline" onClick={() => setAssignModalOpen(true)}>
                <Users className="mr-2 h-4 w-4" />
                Asignar Casos
              </Button>
            )}
            <Dialog open={createOpen} onOpenChange={setCreateOpen}>
              <DialogTrigger asChild>
                <Button><Plus className="mr-2 h-4 w-4" />Crear Caso</Button>
              </DialogTrigger>
              <UnifiedCaseForm onSuccess={() => setCreateOpen(false)} />
            </Dialog>
          </div>
        )}
      </div>

      {/* Quick Filter Tabs */}
      <div className="flex items-center gap-2">
        {([
          { key: "todos" as QuickFilter,        label: "Todos",        count: todosCount },
          { key: "activos" as QuickFilter,      label: "Activos",      count: activosCount },
          { key: "cerrados" as QuickFilter,     label: "Cerrados",     count: cerradosCount },
          { key: "transferidos" as QuickFilter, label: "Transferidos", count: transferidosCount },
        ]).map((tab) => (
          <button
            key={tab.key}
            type="button"
            aria-pressed={quickFilter === tab.key}
            onClick={() => setQuickFilter(tab.key)}
            className={`px-4 py-2 text-sm font-medium rounded-full border transition-colors ${
              quickFilter === tab.key
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-background text-muted-foreground border-border hover:text-foreground hover:border-foreground/30"
            }`}
          >
            {tab.label} {tab.count !== null ? `(${tab.count})` : ""}
          </button>
        ))}
      </div>

      {/* Filter Bar */}
      <CasesFilterBar
        filters={filters}
        searchText={searchText}
        onSearchTextChange={setSearchText}
        onFiltersChange={setFilters}
        estados={estados || []}
        tiposServicio={tiposServicio || []}
        agentes={agentesData || []}
        showAgenteFilter={hasRole(["admin", "supervisor", "gerente"])}
      />

      <Card className="border-0 shadow-sm">
        <CardContent className="p-0 relative">
          <CasesTable
            cases={cases}
            isLoading={isLoading}
            isRefetching={isFetching && !isLoading}
            transferView={quickFilter === "transferidos"}
            onOpen={(caso) => setSelectedCaseId(caso.id)}
            campanaName={campanaName}
            agenteName={(userId) => agentesData?.find((a) => a.user_id === userId)?.nombre}
            pagination={{
              page,
              pageSize,
              totalCount,
              totalPages: paginatedResult?.totalPages ?? 1,
              hasPrevPage: paginatedResult?.hasPrevPage ?? false,
              hasNextPage: paginatedResult?.hasNextPage ?? false,
              onPage: setPage,
              onPageSize: (size) => { setPageSize(size); setPage(1); },
            }}
          />
        </CardContent>
      </Card>

      <CaseDetailSheet
        caso={selectedCase}
        open={!!selectedCaseId}
        noDisponible={noDisponible}
        onClose={closeDetail}
        onOpenCase={openCaseById}
        estados={estados ?? []}
      />

      <ProportionalAssignModal open={assignModalOpen} onOpenChange={setAssignModalOpen} />
    </div>
  );
}

