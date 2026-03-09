import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useAllCases, useAdminUpdateCase } from "@/hooks/useAdmin";
import { useEstados, useTiposServicio, useAgentes, useInsertHistorial } from "@/hooks/useCases";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { Eye, Lock } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { useCaseHistory } from "@/hooks/useCases";
import { formatCOP, formatCOPInput, parseCOPInput } from "@/lib/currency";

export default function AdminCases() {
  const { user } = useAuth();
  const { data: estados } = useEstados();
  const { data: tipos } = useTiposServicio();
  const { data: agentes } = useAgentes();
  const insertHistorial = useInsertHistorial();
  const updateCase = useAdminUpdateCase();

  // Filters
  const [filterEstado, setFilterEstado] = useState<string>("");
  const [filterAgente, setFilterAgente] = useState<string>("");
  const [filterFrom, setFilterFrom] = useState("");
  const [filterTo, setFilterTo] = useState("");

  const filters = {
    estado_id: filterEstado && filterEstado !== "all" ? Number(filterEstado) : undefined,
    agente_id: filterAgente && filterAgente !== "all" ? filterAgente : undefined,
    from: filterFrom || undefined,
    to: filterTo || undefined,
  };
  const { data: cases, isLoading } = useAllCases(filters);

  // Detail
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const { data: history } = useCaseHistory(selectedId);
  const selectedCase = cases?.find((c: any) => c.id === selectedId);

  const [editEstado, setEditEstado] = useState(0);
  const [originalEstado, setOriginalEstado] = useState(0);
  const [editAgente, setEditAgente] = useState("");
  const [editTipo, setEditTipo] = useState(0);
  const [editObservaciones, setEditObservaciones] = useState("");
  const [obsError, setObsError] = useState("");
  const [editValorDisplay, setEditValorDisplay] = useState("");
  const [valorError, setValorError] = useState("");

  const isEditRenovacion = tipos?.find(t => t.id === editTipo)?.nombre?.toLowerCase() === "renovación web";
  const estadoChanged = editEstado !== originalEstado;
  const selectedEstadoFinal = estados?.find(e => e.id === editEstado)?.es_final;
  const selectedEstadoNombre = estados?.find(e => e.id === editEstado)?.nombre;
  const showValorPagar = isEditRenovacion && (selectedEstadoNombre === "Renovado" || selectedEstadoNombre === "Pendiente de Pago");

  const openDetail = (caso: any) => {
    setSelectedId(caso.id);
    setEditEstado(caso.estado_id);
    setOriginalEstado(caso.estado_id);
    setEditAgente(caso.agente_id);
    setEditTipo(caso.tipo_servicio_id);
    setEditObservaciones("");
    setObsError("");
    setEditValorDisplay(caso.valor_pagar ? formatCOP(caso.valor_pagar) : "");
    setValorError("");
  };

  const validateObservaciones = (): boolean => {
    if (!estadoChanged) return true;
    if (!editObservaciones.trim()) {
      setObsError(isEditRenovacion && selectedEstadoFinal ? "Las observaciones son obligatorias." : "Las observaciones de gestión son obligatorias para cambiar el estado.");
      return false;
    }
    if (selectedEstadoFinal && !isEditRenovacion && editObservaciones.trim().length < 30) {
      setObsError("Para estados de cierre, las observaciones deben tener al menos 30 caracteres.");
      return false;
    }
    setObsError("");
    return true;
  };

  const handleUpdate = async () => {
    if (!selectedId || !user) return;
    if (!validateObservaciones()) return;
    if (showValorPagar) {
      const val = parseCOPInput(editValorDisplay);
      if (!val) {
        setValorError("El valor a pagar es obligatorio para este estado.");
        return;
      }
      setValorError("");
    }
    try {
      const updates: any = { id: selectedId, estado_id: editEstado, agente_id: editAgente, tipo_servicio_id: editTipo, updated_by: user.id };
      if (showValorPagar) {
        updates.valor_pagar = parseCOPInput(editValorDisplay);
      }
      if (selectedEstadoFinal) {
        updates.fecha_cierre = new Date().toISOString();
        updates.observacion_cierre = editObservaciones.trim();
      }
      await updateCase.mutateAsync(updates);
      if (estadoChanged) {
        await insertHistorial.mutateAsync({
          caso_id: selectedId,
          estado_id: editEstado,
          cambiado_por: user.id,
          comentario: editObservaciones.trim(),
        });
      }
      setOriginalEstado(editEstado);
      setEditObservaciones("");
      setObsError("");
      toast.success("Caso actualizado");
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  return (
    <div className="space-y-4">
      {/* Filters */}
      <Card className="border-0 shadow-sm">
        <CardContent className="p-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div>
              <Label className="text-xs">Estado</Label>
              <Select value={filterEstado} onValueChange={setFilterEstado}>
                <SelectTrigger className="h-8"><SelectValue placeholder="Todos" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {estados?.map(e => <SelectItem key={e.id} value={String(e.id)}>{e.nombre}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Agente</Label>
              <Select value={filterAgente} onValueChange={setFilterAgente}>
                <SelectTrigger className="h-8"><SelectValue placeholder="Todos" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {agentes?.map(a => <SelectItem key={a.user_id} value={a.user_id}>{a.nombre}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Desde</Label>
              <Input type="date" className="h-8" value={filterFrom} onChange={e => setFilterFrom(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Hasta</Label>
              <Input type="date" className="h-8" value={filterTo} onChange={e => setFilterTo(e.target.value)} />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-0 shadow-sm">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Agente</TableHead>
                <TableHead>Valor a Pagar</TableHead>
                <TableHead>Fecha</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={8} className="text-center py-8">Cargando...</TableCell></TableRow>
              ) : !cases?.length ? (
                <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">No hay casos</TableCell></TableRow>
              ) : cases.map((caso: any) => (
                <TableRow key={caso.id} className="cursor-pointer hover:bg-muted/50" onClick={() => openDetail(caso)}>
                  <TableCell className="font-medium">#{caso.id}</TableCell>
                  <TableCell>{caso.clientes?.nombre_contacto || "-"}</TableCell>
                  <TableCell>{caso.cat_tipo_servicio?.nombre}</TableCell>
                  <TableCell>
                    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${caso.cat_estados?.es_final ? 'bg-accent text-accent-foreground' : 'bg-secondary text-secondary-foreground'}`}>
                      {caso.cat_estados?.es_final && <Lock className="h-3 w-3" />}
                      {caso.cat_estados?.nombre}
                    </span>
                  </TableCell>
                  <TableCell>{caso.cat_agentes?.nombre || "-"}</TableCell>
                  <TableCell>{formatCOP(caso.valor_pagar)}</TableCell>
                  <TableCell>{format(new Date(caso.fecha_caso), "dd/MM/yyyy", { locale: es })}</TableCell>
                  <TableCell><Eye className="h-4 w-4 text-muted-foreground" /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Sheet open={!!selectedId} onOpenChange={open => { if (!open) setSelectedId(null); }}>
        <SheetContent className="w-full sm:max-w-lg overflow-auto">
          <SheetHeader><SheetTitle>Caso #{selectedCase?.id}</SheetTitle></SheetHeader>
          {selectedCase && (
            <div className="mt-4 space-y-5">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><span className="text-muted-foreground">Cliente:</span><p className="font-medium">{selectedCase.clientes?.nombre_contacto}</p></div>
                <div><span className="text-muted-foreground">Fecha:</span><p className="font-medium">{format(new Date(selectedCase.fecha_caso), "dd/MM/yyyy HH:mm", { locale: es })}</p></div>
              </div>

              <Separator />

              <div className="space-y-3">
                <div>
                  <Label>Estado</Label>
                  <Select value={String(editEstado)} onValueChange={v => { setEditEstado(Number(v)); setObsError(""); }}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{estados?.map(e => <SelectItem key={e.id} value={String(e.id)}>{e.nombre}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Agente</Label>
                  <Select value={editAgente} onValueChange={setEditAgente}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{agentes?.map(a => <SelectItem key={a.user_id} value={a.user_id}>{a.nombre}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Tipo de Servicio</Label>
                  <Select value={String(editTipo)} onValueChange={v => setEditTipo(Number(v))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{tipos?.map(t => <SelectItem key={t.id} value={String(t.id)}>{t.nombre}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                {estadoChanged && showValorPagar && (
                  <div className="space-y-2">
                    <Label>Valor a Pagar *</Label>
                    <Input
                      placeholder="$ 0"
                 value={editValorDisplay}
                      onChange={e => { setEditValorDisplay(formatCOPInput(e.target.value)); setValorError(""); }}
                    />
                    {valorError && <p className="text-sm text-destructive">{valorError}</p>}
                  </div>
                )}

                {estadoChanged && (
                  <div className="space-y-2">
                    <Label>
                      Observaciones de gestión *
                      {selectedEstadoFinal && !isEditRenovacion && <span className="ml-1 text-xs text-muted-foreground">(mín. 30 caracteres)</span>}
                    </Label>
                    <Textarea
                      value={editObservaciones}
                      onChange={e => { setEditObservaciones(e.target.value); setObsError(""); }}
                      rows={3}
                      placeholder="Describe la gestión realizada, acuerdo con el cliente o motivo del cambio..."
                    />
                    {selectedEstadoFinal && !isEditRenovacion && (
                      <p className="text-xs text-muted-foreground">{editObservaciones.trim().length}/30 caracteres</p>
                    )}
                    {obsError && <p className="text-sm text-destructive">{obsError}</p>}
                  </div>
                )}

                <Button onClick={handleUpdate} disabled={updateCase.isPending} className="w-full">
                  {updateCase.isPending ? "Guardando..." : "Actualizar Caso"}
                </Button>
              </div>

              <Separator />

              <div>
                <h3 className="mb-3 text-sm font-semibold">Historial de gestiones</h3>
                <div className="space-y-2">
                  {history?.map((h: any) => (
                    <div key={h.id} className="rounded-lg bg-muted p-3 text-sm">
                      <div className="flex items-center justify-between">
                        <span className="font-medium">{h.cat_estados?.nombre}</span>
                        <span className="text-xs text-muted-foreground">{format(new Date(h.cambiado_en), "dd/MM/yyyy HH:mm", { locale: es })}</span>
                      </div>
                      {h.profiles?.nombre && (
                        <p className="text-xs text-muted-foreground mt-0.5">Por: {h.profiles.nombre}</p>
                      )}
                      {h.comentario && <p className="mt-1 text-muted-foreground">{h.comentario}</p>}
                    </div>
                  ))}
                  {(!history || history.length === 0) && <p className="text-sm text-muted-foreground">Sin historial</p>}
                </div>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
