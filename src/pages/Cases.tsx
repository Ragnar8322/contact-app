import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useCases, useEstados, useUpdateCase, useInsertHistorial, useCaseHistory } from "@/hooks/useCases";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { Plus, Eye } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { formatCOP, formatCOPInput, parseCOPInput } from "@/lib/currency";
import { Input } from "@/components/ui/input";
import UnifiedCaseForm from "@/components/cases/UnifiedCaseForm";

export default function Cases() {
  const { user } = useAuth();
  const { data: cases, isLoading } = useCases();
  const { data: estados } = useEstados();
  
  const updateCase = useUpdateCase();
  const insertHistorial = useInsertHistorial();

  const [createOpen, setCreateOpen] = useState(false);
  const [selectedCaseId, setSelectedCaseId] = useState<number | null>(null);
  const { data: history } = useCaseHistory(selectedCaseId);

  const selectedCase = cases?.find((c: any) => c.id === selectedCaseId);

  // Edit form
  const [editEstado, setEditEstado] = useState(0);
  const [originalEstado, setOriginalEstado] = useState(0);
  const [editObservaciones, setEditObservaciones] = useState("");
  const [obsError, setObsError] = useState("");
  const [editValorDisplay, setEditValorDisplay] = useState("");
  const [valorError, setValorError] = useState("");

  const estadoChanged = editEstado !== originalEstado;
  const selectedEstadoFinal = estados?.find(e => e.id === editEstado)?.es_final;

  const openDetail = (caso: any) => {
    setSelectedCaseId(caso.id);
    setEditEstado(caso.estado_id);
    setOriginalEstado(caso.estado_id);
    setEditObservaciones("");
    setObsError("");
    setEditValorDisplay(caso.valor_pagar ? formatCOP(caso.valor_pagar) : "");
    setValorError("");
  };

  const isRenovacionWeb = selectedCase?.cat_tipo_servicio?.nombre?.toLowerCase() === "renovación web";
  const selectedEstadoNombre = estados?.find(e => e.id === editEstado)?.nombre;
  const showValorPagar = isRenovacionWeb && (selectedEstadoNombre === "Renovado" || selectedEstadoNombre === "Pendiente de Pago");

  const validateObservaciones = (): boolean => {
    if (!estadoChanged) return true;
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
    if (!estadoChanged) {
      toast.info("No has cambiado el estado del caso.");
      return;
    }
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
      const updates: any = { id: selectedCaseId, estado_id: editEstado, updated_by: user.id };
      if (showValorPagar) {
        updates.valor_pagar = parseCOPInput(editValorDisplay);
      }
      if (selectedEstadoFinal) {
        updates.fecha_cierre = new Date().toISOString();
        updates.observacion_cierre = editObservaciones.trim();
      }
      await updateCase.mutateAsync(updates);
      await insertHistorial.mutateAsync({
        caso_id: selectedCaseId,
        estado_id: editEstado,
        cambiado_por: user.id,
        comentario: editObservaciones.trim(),
      });
      setOriginalEstado(editEstado);
      setEditObservaciones("");
      setObsError("");
      toast.success("Caso actualizado");
    } catch (err: any) {
      toast.error("Error: " + err.message);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Casos</h1>
          <p className="text-muted-foreground">Gestión y seguimiento de casos</p>
        </div>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="mr-2 h-4 w-4" />Crear Caso</Button>
          </DialogTrigger>
          <UnifiedCaseForm onSuccess={() => setCreateOpen(false)} />
        </Dialog>
      </div>

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
              ) : cases?.length === 0 ? (
                <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">No hay casos</TableCell></TableRow>
              ) : cases?.map((caso: any) => (
                <TableRow key={caso.id} className="cursor-pointer hover:bg-muted/50" onClick={() => openDetail(caso)}>
                  <TableCell className="font-medium">#{caso.id}</TableCell>
                  <TableCell>{caso.clientes?.nombre_contacto || "-"}</TableCell>
                  <TableCell>{caso.cat_tipo_servicio?.nombre}</TableCell>
                  <TableCell>
                    <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${caso.cat_estados?.es_final ? 'bg-accent text-accent-foreground' : 'bg-secondary text-secondary-foreground'}`}>
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

      {/* Detail Sheet */}
      <Sheet open={!!selectedCaseId} onOpenChange={open => { if (!open) setSelectedCaseId(null); }}>
        <SheetContent className="w-full sm:max-w-lg overflow-auto">
          <SheetHeader>
            <SheetTitle>Caso #{selectedCase?.id}</SheetTitle>
          </SheetHeader>
          {selectedCase && (
            <div className="mt-4 space-y-5">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><span className="text-muted-foreground">Cliente:</span><p className="font-medium">{selectedCase.clientes?.nombre_contacto}</p></div>
                <div><span className="text-muted-foreground">Tipo:</span><p className="font-medium">{selectedCase.cat_tipo_servicio?.nombre}</p></div>
                <div><span className="text-muted-foreground">Agente:</span><p className="font-medium">{selectedCase.cat_agentes?.nombre}</p></div>
                <div><span className="text-muted-foreground">Fecha:</span><p className="font-medium">{format(new Date(selectedCase.fecha_caso), "dd/MM/yyyy HH:mm", { locale: es })}</p></div>
                {selectedCase.valor_pagar != null && selectedCase.valor_pagar > 0 && (
                  <div><span className="text-muted-foreground">Valor a Pagar:</span><p className="font-medium">{formatCOP(selectedCase.valor_pagar)}</p></div>
                )}
              </div>
              <div className="text-sm">
                <span className="text-muted-foreground">Descripción:</span>
                <p className="mt-1">{selectedCase.descripcion_inicial}</p>
              </div>

              <Separator />

              <div className="space-y-3">
                <Label>Cambiar Estado</Label>
                <Select value={String(editEstado)} onValueChange={v => { setEditEstado(Number(v)); setObsError(""); setValorError(""); }}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {estados?.map(e => <SelectItem key={e.id} value={String(e.id)}>{e.nombre}</SelectItem>)}
                  </SelectContent>
                </Select>

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
                      {selectedEstadoFinal && !isRenovacionWeb && <span className="ml-1 text-xs text-muted-foreground">(mín. 30 caracteres)</span>}
                    </Label>
                    <Textarea
                      value={editObservaciones}
                      onChange={e => { setEditObservaciones(e.target.value); setObsError(""); }}
                      rows={3}
                      placeholder="Describe la gestión realizada, acuerdo con el cliente o motivo del cambio..."
                    />
                    {selectedEstadoFinal && !isRenovacionWeb && (
                      <p className="text-xs text-muted-foreground">{editObservaciones.trim().length}/30 caracteres</p>
                    )}
                    {obsError && <p className="text-sm text-destructive">{obsError}</p>}
                  </div>
                )}

                <Button onClick={handleUpdate} disabled={updateCase.isPending || !estadoChanged} className="w-full">
                  {updateCase.isPending ? "Guardando..." : "Actualizar Caso"}
                </Button>
              </div>

              <Separator />

              {/* History */}
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
                  {(!history || history.length === 0) && (
                    <p className="text-sm text-muted-foreground">Sin historial</p>
                  )}
                </div>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
