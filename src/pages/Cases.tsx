import { useState, useMemo, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useCampana } from "@/contexts/CampanaContext";
import { useCases, useEstados, useTiposServicio, useAgentes, useUpdateCase, useInsertHistorial, useCaseHistory, CasesFilters } from "@/hooks/useCases";
import { useCampanasList } from "@/hooks/useCampanas";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Plus, Eye, Lock, ArrowUpDown, ChevronLeft, ChevronRight, Loader2, ArrowRightLeft } from "lucide-react";
import { toast } from "sonner";
import { formatCOP, formatCOPInput, parseCOPInput } from "@/lib/currency";
import { safeFormat } from "@/lib/date";
import { getEstadoInlineStyle } from "@/lib/estadoColors";
import { Input } from "@/components/ui/input";
import UnifiedCaseForm from "@/components/cases/UnifiedCaseForm";
import CasesFilterBar from "@/components/cases/CasesFilterBar";
import CaseTransfer from "@/components/cases/CaseTransfer";

type SortField = "id" | "identificacion" | null;
type SortDir = "asc" | "desc";
type QuickFilter = "activos" | "cerrados" | "transferidos";

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100] as const;


export default function Cases() {
  const { user, profile, isAdmin, isGerente, isSupervisor, hasRole } = useAuth();
  const { campanaActiva } = useCampana();
  const { data: estados } = useEstados();
  const { data: tiposServicio } = useTiposServicio();
  const { data: agentesData } = useAgentes();
  const { data: allCampanas = [] } = useCampanasList();

  // Quick filter tabs
  const [quickFilter, setQuickFilter] = useState<QuickFilter>("activos");

  // Filters
  const [searchText, setSearchText] = useState("");
  const [filters, setFilters] = useState<CasesFilters>({});

  // Pagination
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  // Build estado filters based on quick filter
  const filtersWithCampana = useMemo(() => {
    const base: CasesFilters = {
      ...filters,
      campanaId: campanaActiva?.id,
      searchText: searchText.trim() || undefined,
    };

    if (!estados || estados.length === 0) return base;

    const transferidoEstado = estados.find((e: any) => e.nombre === "Transferido");
    const transferidoId = transferidoEstado?.id;

    if (quickFilter === "transferidos") {
      base.estadoIds = transferidoId ? [transferidoId] : [];
    } else if (quickFilter === "cerrados") {
      const closedIds = estados
        .filter((e: any) => e.es_final && e.nombre !== "Transferido")
        .map((e: any) => e.id);
      base.estadoIds = closedIds.length > 0 ? closedIds : undefined;
    } else {
      const activeIds = estados
        .filter((e: any) => !e.es_final && e.nombre !== "Transferido")
        .map((e: any) => e.id);
      base.estadoIds = activeIds.length > 0 ? activeIds : undefined;
    }

    return base;
  }, [filters, campanaActiva, estados, quickFilter, searchText]);

  // Reset to page 1 when filters or quickFilter change
  useEffect(() => {
    setPage(1);
  }, [filtersWithCampana, quickFilter]);

  const { data: paginatedResult, isLoading, isFetching } = useCases(filtersWithCampana, { page, pageSize });

  const cases = paginatedResult?.data ?? [];
  const totalCount = paginatedResult?.totalCount ?? 0;
  const totalPages = paginatedResult?.totalPages ?? 1;
  const hasNextPage = paginatedResult?.hasNextPage ?? false;
  const hasPrevPage = paginatedResult?.hasPrevPage ?? false;

  // Counts for tabs — use single RPC
  const { data: tabCounts } = useQuery({
    queryKey: ["casos-counts", campanaActiva?.id],
    enabled: !!campanaActiva?.id,
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .rpc("get_casos_counts", { p_campana_id: campanaActiva!.id });
      if (error) throw error;
      return data as { activos: number; cerrados: number; transferidos: number };
    },
  });

  const activosCount = tabCounts?.activos ?? null;
  const cerradosCount = tabCounts?.cerrados ?? null;
  const transferidosCount = tabCounts?.transferidos ?? null;

  const showPageOverlay = isFetching && !isLoading;

  // Sorting (client-side on current page)
  const [sortField, setSortField] = useState<SortField>(null);
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir("asc");
    }
  };

  // Client-side sorting on current page (search is now server-side)
  const filteredCases = useMemo(() => {
    let result = cases;
    if (sortField) {
      result = [...result].sort((a: any, b: any) => {
        let valA: any, valB: any;
        if (sortField === "id") { valA = a.id; valB = b.id; }
        else if (sortField === "identificacion") { valA = a.clientes?.identificacion || ""; valB = b.clientes?.identificacion || ""; }
        if (valA < valB) return sortDir === "asc" ? -1 : 1;
        if (valA > valB) return sortDir === "asc" ? 1 : -1;
        return 0;
      });
    }
    return result;
  }, [cases, sortField, sortDir]);

  const updateCase = useUpdateCase();
  const insertHistorial = useInsertHistorial();

  const [createOpen, setCreateOpen] = useState(false);
  const [selectedCaseId, setSelectedCaseId] = useState<number | null>(null);
  const { data: history } = useCaseHistory(selectedCaseId);

  const selectedCase = filteredCases?.find((c: any) => c.id === selectedCaseId) || cases?.find((c: any) => c.id === selectedCaseId);

  const isTransferredCase = selectedCase?.cat_estados?.nombre === "Transferido";

  // Parse transfer info from observacion_cierre
  const transferInfo = useMemo(() => {
    if (!isTransferredCase || !selectedCase?.observacion_cierre) return null;
    const obs = selectedCase.observacion_cierre as string;
    const caseMatch = obs.match(/Nuevo caso #(\d+)/);
    const campMatch = obs.match(/Transferido a campaña: ([^.]+)/);
    return {
      newCaseId: caseMatch ? caseMatch[1] : null,
      targetCampana: campMatch ? campMatch[1] : null,
    };
  }, [isTransferredCase, selectedCase]);

  // Edit form
  const [editEstado, setEditEstado] = useState(0);
  const [originalEstado, setOriginalEstado] = useState(0);
  const [editObservaciones, setEditObservaciones] = useState("");
  const [obsError, setObsError] = useState("");
  const [editValorDisplay, setEditValorDisplay] = useState("");
  const [valorError, setValorError] = useState("");
  const [detailObservacion, setDetailObservacion] = useState("");

  const estadoChanged = editEstado !== originalEstado;
  const isEnGestion = estados?.find(e => e.id === editEstado)?.nombre === "En gestión";
  const selectedEstadoFinal = estados?.find(e => e.id === editEstado)?.es_final;

  const openDetail = (caso: any) => {
    setSelectedCaseId(caso.id);
    setEditEstado(caso.estado_id);
    setOriginalEstado(caso.estado_id);
    setEditObservaciones("");
    setObsError("");
    setEditValorDisplay(caso.valor_pagar ? formatCOP(caso.valor_pagar) : "");
    setValorError("");
    setDetailObservacion("");
  };

  const isRenovacionWeb = selectedCase?.cat_tipo_servicio?.nombre?.toLowerCase() === "renovación web";
  const selectedEstadoNombre = estados?.find(e => e.id === editEstado)?.nombre;
  const showValorPagar = isRenovacionWeb && (selectedEstadoNombre === "Renovado" || selectedEstadoNombre === "Pendiente de Pago");

  const isCaseClosed = selectedCase?.cat_estados?.es_final === true;
  const isReadOnly = isGerente || (isCaseClosed && !isAdmin);
  const isFullyLocked = isTransferredCase || isGerente;

  const validateObservaciones = (): boolean => {
    if (!estadoChanged) return true;
    if (isEnGestion) return true;
    if (!editObservaciones.trim()) {
      setObsError(isRenovacionWeb && selectedEstadoFinal ? "Las observaciones son obligatorias." : "Las observaciones de gestión son obligatorias para cambiar el estado.");
      return false;
    }
    if (selectedEstadoFinal && !isRenovacionWeb && editObservaciones.trim().length < 30) {
      setObsError("Para estados de cierre, las observaciones deben tener al menos 30 caracteres.");
      return false;
    }
    setObsError("");
    return true;
  };

  const handleUpdate = async () => {
    if (!selectedCaseId || !user) return;
    const observationText = isEnGestion ? detailObservacion.trim() : editObservaciones.trim();
    const hasObservation = observationText.length > 0;

    if (!estadoChanged && !hasObservation) { toast.info("No hay cambios para guardar."); return; }
    if (estadoChanged && !validateObservaciones()) return;
    if (estadoChanged && !isEnGestion && !editObservaciones.trim()) return;
    if (showValorPagar) {
      const val = parseCOPInput(editValorDisplay);
      if (!val) { setValorError("El valor a pagar es obligatorio para este estado."); return; }
      setValorError("");
    }
    try {
      if (estadoChanged) {
        const updates: any = { id: selectedCaseId, estado_id: editEstado, updated_by: user.id };
        if (showValorPagar) updates.valor_pagar = parseCOPInput(editValorDisplay);
        if (selectedEstadoFinal) {
          updates.fecha_cierre = new Date().toISOString();
          updates.observacion_cierre = observationText;
        }
        await updateCase.mutateAsync(updates);
      }
      const agenteName = profile?.nombre || user?.email || "";
      await insertHistorial.mutateAsync({
        caso_id: selectedCaseId,
        estado_id: editEstado,
        cambiado_por: user.id,
        comentario: estadoChanged ? observationText || undefined : undefined,
        observacion: hasObservation ? observationText : undefined,
        agente_id: user.id,
        agente_nombre: agenteName,
        estado_nuevo: estados?.find(e => e.id === editEstado)?.nombre || undefined,
      });
      setOriginalEstado(editEstado);
      setEditObservaciones("");
      setObsError("");
      setDetailObservacion("");
      toast.success("Caso actualizado");
    } catch (err: any) {
      toast.error("Error: " + err.message);
    }
  };

  // Pagination display
  const fromRecord = totalCount === 0 ? 0 : (page - 1) * pageSize + 1;
  const toRecord = Math.min(page * pageSize, totalCount);

  // Helper: campana name by id
  const campanaName = (id: string | null) => {
    if (!id) return "—";
    return allCampanas.find((c: any) => c.id === id)?.nombre || "—";
  };


  const isTransferView = quickFilter === "transferidos";

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Casos</h1>
          <p className="text-muted-foreground">Gestión y seguimiento de casos</p>
        </div>
        {!isGerente && (
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="mr-2 h-4 w-4" />Crear Caso</Button>
            </DialogTrigger>
            <UnifiedCaseForm onSuccess={() => setCreateOpen(false)} />
          </Dialog>
        )}
      </div>

      {/* Quick Filter Tabs */}
      <div className="flex items-center gap-2">
        {([
          { key: "activos" as QuickFilter, label: "Activos", count: activosCount },
          { key: "cerrados" as QuickFilter, label: "Cerrados", count: cerradosCount },
          { key: "transferidos" as QuickFilter, label: "Transferidos", count: transferidosCount },
        ]).map((tab) => (
          <button
            key={tab.key}
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
          {showPageOverlay && (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/60 backdrop-blur-[1px] rounded-lg">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          )}

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="cursor-pointer select-none" onClick={() => toggleSort("id")}>
                  <span className="inline-flex items-center gap-1">ID <ArrowUpDown className="h-3 w-3" /></span>
                </TableHead>
                <TableHead>Cliente</TableHead>
                {isTransferView ? (
                  <>
                    <TableHead>Campaña origen</TableHead>
                    <TableHead>Campaña destino</TableHead>
                    <TableHead>Fecha transferencia</TableHead>
                    <TableHead>Nuevo caso #</TableHead>
                    <TableHead>Transferido por</TableHead>
                  </>
                ) : (
                  <>
                    <TableHead className="cursor-pointer select-none" onClick={() => toggleSort("identificacion")}>
                      <span className="inline-flex items-center gap-1">NIT / Cédula <ArrowUpDown className="h-3 w-3" /></span>
                    </TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Agente</TableHead>
                    <TableHead>Valor a Pagar</TableHead>
                    <TableHead>Fecha</TableHead>
                    <TableHead></TableHead>
                  </>
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={isTransferView ? 7 : 9} className="text-center py-8">Cargando...</TableCell></TableRow>
              ) : filteredCases.length === 0 ? (
                <TableRow><TableCell colSpan={isTransferView ? 7 : 9} className="text-center py-8 text-muted-foreground">No hay casos</TableCell></TableRow>
              ) : filteredCases.map((caso: any) => (
                <TableRow key={caso.id} className="cursor-pointer hover:bg-muted/50" onClick={() => openDetail(caso)}>
                  <TableCell className="font-medium">#{caso.id}</TableCell>
                  <TableCell>{caso.clientes?.nombre_contacto || "-"}</TableCell>
                  {isTransferView ? (
                    <TransferColumns caso={caso} campanaName={campanaName} />
                  ) : (
                    <>
                      <TableCell className="font-mono text-sm">{caso.clientes?.identificacion || "-"}</TableCell>
                      <TableCell>{caso.cat_tipo_servicio?.nombre}</TableCell>
                      <TableCell>
                        <span
                          className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium"
                          style={getEstadoInlineStyle(caso.cat_estados?.nombre)}
                        >
                          {caso.cat_estados?.nombre === "Transferido" && "🔄 "}
                          {caso.cat_estados?.nombre}
                        </span>
                      </TableCell>
                      <TableCell>{caso.cat_agentes?.nombre || "-"}</TableCell>
                      <TableCell>{formatCOP(caso.valor_pagar)}</TableCell>
                      <TableCell>{safeFormat(caso.fecha_caso, "dd/MM/yyyy")}</TableCell>
                      <TableCell>
                        {caso.cat_estados?.es_final ? (
                          <Lock className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <Eye className="h-4 w-4 text-muted-foreground" />
                        )}
                      </TableCell>
                    </>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {/* Pagination Bar */}
          {totalCount > 0 && (
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
                        onClick={() => { setPageSize(size); setPage(1); }}
                        className={`px-2.5 py-1 text-xs font-medium rounded transition-colors ${pageSize === size ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
                      >
                        {size}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <Button variant="outline" size="sm" className="h-8 px-2" disabled={!hasPrevPage} onClick={() => setPage((p) => Math.max(1, p - 1))}>
                    <ChevronLeft className="h-4 w-4" />
                    <span className="hidden sm:inline ml-1">Anterior</span>
                  </Button>
                  <span className="text-sm px-2 text-muted-foreground whitespace-nowrap">
                    Página {page} de {totalPages}
                  </span>
                  <Button variant="outline" size="sm" className="h-8 px-2" disabled={!hasNextPage} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>
                    <span className="hidden sm:inline mr-1">Siguiente</span>
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Detail Sheet */}
      <Sheet open={!!selectedCaseId} onOpenChange={open => { if (!open) setSelectedCaseId(null); }}>
        <SheetContent className="w-full sm:max-w-lg overflow-auto">
          <SheetHeader>
            <SheetTitle>Caso #{selectedCase?.id}</SheetTitle>
          </SheetHeader>
          {selectedCase && (
            <div className="mt-4 space-y-5">
              {/* Transferred banner */}
              {isTransferredCase && transferInfo && (
                <Alert className="border-primary/50 bg-primary/5">
                  <AlertDescription className="text-sm">
                    <ArrowRightLeft className="inline h-4 w-4 mr-1" />
                    Este caso fue transferido.
                    {transferInfo.newCaseId && (
                      <> Ver nuevo caso <strong>#{transferInfo.newCaseId}</strong></>
                    )}
                    {transferInfo.targetCampana && (
                      <> en la campaña <strong>{transferInfo.targetCampana}</strong></>
                    )}.
                  </AlertDescription>
                </Alert>
              )}

              {(isReadOnly && !isTransferredCase) && (
                <Alert className="border-amber-500/50 bg-amber-50 text-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
                  <AlertDescription>
                    ⚠️ Este caso está cerrado y no puede ser modificado. Si necesitas reabrirlo, contacta a un administrador.
                  </AlertDescription>
                </Alert>
              )}

              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><span className="text-muted-foreground">Cliente:</span><p className="font-medium">{selectedCase.clientes?.nombre_contacto}</p></div>
                <div><span className="text-muted-foreground">NIT / Cédula:</span><p className="font-medium font-mono">{selectedCase.clientes?.identificacion || "-"}</p></div>
                <div><span className="text-muted-foreground">Tipo:</span><p className="font-medium">{selectedCase.cat_tipo_servicio?.nombre}</p></div>
                <div><span className="text-muted-foreground">Agente:</span><p className="font-medium">{selectedCase.cat_agentes?.nombre}</p></div>
                <div><span className="text-muted-foreground">Fecha:</span><p className="font-medium">{safeFormat(selectedCase.fecha_caso, "dd/MM/yyyy HH:mm")}</p></div>
                {selectedCase.valor_pagar != null && selectedCase.valor_pagar > 0 && (
                  <div><span className="text-muted-foreground">Valor a Pagar:</span><p className="font-medium">{formatCOP(selectedCase.valor_pagar)}</p></div>
                )}
              </div>
              <div className="text-sm">
                <span className="text-muted-foreground">Descripción:</span>
                <p className="mt-1">{selectedCase.descripcion_inicial}</p>
              </div>

              {/* Client Contact Info */}
              <div className="text-sm space-y-1.5">
                <span className="font-medium text-foreground">Datos de Contacto</span>
                <div className="flex items-center gap-1.5">
                  <span>📞</span>
                  <span className="text-muted-foreground">Teléfonos:</span>
                  {(() => {
                    const phones = [selectedCase.clientes?.telefono, selectedCase.clientes?.celular].filter(Boolean);
                    if (phones.length === 0) return <span className="text-muted-foreground/60 italic">No registrado</span>;
                    return phones.map((p, i) => (
                      <span key={i}>
                        {i > 0 && <span className="text-muted-foreground">, </span>}
                        <a href={`tel:${p}`} className="text-primary hover:underline">{p}</a>
                      </span>
                    ));
                  })()}
                </div>
                <div className="flex items-center gap-1.5">
                  <span>✉️</span>
                  <span className="text-muted-foreground">Correo:</span>
                  {selectedCase.clientes?.correo ? (
                    <a href={`mailto:${selectedCase.clientes.correo}`} className="text-primary hover:underline">{selectedCase.clientes.correo}</a>
                  ) : (
                    <span className="text-muted-foreground/60 italic">No registrado</span>
                  )}
                </div>
              </div>

              <Separator />

              {!isReadOnly && !isFullyLocked && (
                <div className="space-y-3">
                  <Label>Cambiar Estado</Label>
                  <Select value={String(editEstado)} onValueChange={v => { setEditEstado(Number(v)); setObsError(""); setValorError(""); }}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {estados?.filter(e => e.nombre !== "Transferido").map(e => <SelectItem key={e.id} value={String(e.id)}>{e.nombre}</SelectItem>)}
                    </SelectContent>
                  </Select>

                  {estadoChanged && showValorPagar && (
                    <div className="space-y-2">
                      <Label>Valor a Pagar *</Label>
                      <Input placeholder="$ 0" value={editValorDisplay} onChange={e => { setEditValorDisplay(formatCOPInput(e.target.value)); setValorError(""); }} />
                      {valorError && <p className="text-sm text-destructive">{valorError}</p>}
                    </div>
                  )}

                  {isEnGestion ? (
                    <div className="space-y-2">
                      <Label>Observaciones (opcional)</Label>
                      <Textarea
                        value={detailObservacion}
                        onChange={e => { if (e.target.value.length <= 500) setDetailObservacion(e.target.value); }}
                        rows={3}
                        placeholder="Escribe una observación sobre esta gestión..."
                        maxLength={500}
                      />
                      <p className="text-xs text-muted-foreground text-right">{detailObservacion.length} / 500</p>
                    </div>
                  ) : estadoChanged ? (
                    <div className="space-y-2">
                      <Label>
                        Observaciones de gestión *
                        {selectedEstadoFinal && !isRenovacionWeb && <span className="ml-1 text-xs text-muted-foreground">(mín. 30 caracteres)</span>}
                      </Label>
                      <Textarea value={editObservaciones} onChange={e => { setEditObservaciones(e.target.value); setObsError(""); }} rows={3} placeholder="Describe la gestión realizada..." />
                      {selectedEstadoFinal && !isRenovacionWeb && (
                        <p className="text-xs text-muted-foreground">{editObservaciones.trim().length}/30 caracteres</p>
                      )}
                      {obsError && <p className="text-sm text-destructive">{obsError}</p>}
                    </div>
                  ) : null}

                  <Button
                    onClick={handleUpdate}
                    disabled={
                      updateCase.isPending ||
                      (!estadoChanged && !detailObservacion.trim()) ||
                      (estadoChanged && !isEnGestion && !editObservaciones.trim())
                    }
                    className="w-full"
                  >
                    {updateCase.isPending ? "Guardando..." : "Actualizar Caso"}
                  </Button>
                </div>
              )}

              <Separator />

              {/* History */}
              <div>
                <h3 className="mb-3 text-sm font-semibold">Historial de gestiones</h3>
                <div className="space-y-2">
                  {history?.map((h: any) => {
                    const estadoNombre = h.cat_estados?.nombre || h.estado_nuevo;
                    return (
                      <div key={h.id} className="rounded-lg bg-muted/50 p-3 text-sm">
                        <div className="flex items-center justify-between">
                          <span
                            className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium"
                            style={getEstadoInlineStyle(estadoNombre)}
                          >
                            {estadoNombre === "Transferido" && "🔄 "}
                            {estadoNombre}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {safeFormat(h.fecha_cambio || h.cambiado_en, "dd/MM/yyyy HH:mm")}
                          </span>
                        </div>
                        {(h.agente_nombre || h.profiles?.nombre) && (
                          <p className="text-xs text-muted-foreground mt-0.5">Por: {h.agente_nombre || h.profiles?.nombre}</p>
                        )}
                        {h.observacion && <p className="mt-1 text-muted-foreground">{h.observacion}</p>}
                        {h.comentario && <p className="mt-1 text-muted-foreground">{h.comentario}</p>}
                      </div>
                    );
                  })}
                  {(!history || history.length === 0) && (
                    <p className="text-sm text-muted-foreground">Sin historial</p>
                  )}
                </div>

                {/* Transfer - hidden for transferred cases and gerente */}
                {!isTransferredCase && !isGerente && (
                  <CaseTransfer caso={selectedCase} onTransferred={() => setSelectedCaseId(null)} />
                )}
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

/* ─── Transfer Columns Component ─── */
function TransferColumns({ caso, campanaName }: { caso: any; campanaName: (id: string | null) => string }) {
  const obs = (caso.observacion_cierre || "") as string;
  const caseMatch = obs.match(/Nuevo caso #(\d+)/);
  const campMatch = obs.match(/Transferido a campaña: ([^.]+)/);

  return (
    <>
      <TableCell className="text-sm">{campanaName(caso.campana_id)}</TableCell>
      <TableCell className="text-sm">{campMatch ? campMatch[1] : "—"}</TableCell>
      <TableCell className="text-sm">{safeFormat(caso.fecha_cierre, "dd/MM/yyyy HH:mm")}</TableCell>
      <TableCell className="text-sm font-medium">{caseMatch ? `#${caseMatch[1]}` : "—"}</TableCell>
      <TableCell className="text-sm text-muted-foreground">
        <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium text-white" style={{ backgroundColor: TRANSFERIDO_BG }}>
          🔄 Transferido
        </span>
      </TableCell>
    </>
  );
}
