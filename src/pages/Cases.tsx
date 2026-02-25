import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useCases, useEstados, useTiposServicio, useCreateCase, useUpdateCase, useInsertHistorial, useCaseHistory } from "@/hooks/useCases";
import { useClients } from "@/hooks/useClients";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { Plus, Eye } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { formatCOP, formatCOPInput, parseCOPInput } from "@/lib/currency";

export default function Cases() {
  const { user } = useAuth();
  const { data: cases, isLoading } = useCases();
  const { data: estados } = useEstados();
  const { data: tipos } = useTiposServicio();
  const { data: allClients } = useClients();
  const createCase = useCreateCase();
  const updateCase = useUpdateCase();
  const insertHistorial = useInsertHistorial();

  const [createOpen, setCreateOpen] = useState(false);
  const [selectedCaseId, setSelectedCaseId] = useState<number | null>(null);
  const { data: history } = useCaseHistory(selectedCaseId);

  const selectedCase = cases?.find((c: any) => c.id === selectedCaseId);

  // Create form
  const [clientSearch, setClientSearch] = useState("");
  const [form, setForm] = useState({ cliente_id: 0, tipo_servicio_id: 0, descripcion_inicial: "", valor_pagar_display: "" });

  const isRenovacionWeb = tipos?.find(t => t.id === form.tipo_servicio_id)?.nombre?.toLowerCase() === "renovación web";

  const filteredClients = allClients?.filter(c =>
    c.nombre_contacto.toLowerCase().includes(clientSearch.toLowerCase()) ||
    c.identificacion.includes(clientSearch)
  )?.slice(0, 20);

  const registradoId = estados?.find(e => e.nombre === "Registrado")?.id || 1;

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.cliente_id || !form.tipo_servicio_id) {
      toast.error("Selecciona cliente y tipo de servicio");
      return;
    }
    const valorPagar = isRenovacionWeb ? parseCOPInput(form.valor_pagar_display) : null;
    if (isRenovacionWeb && !valorPagar) {
      toast.error("El valor a pagar es obligatorio para Renovación web");
      return;
    }
    try {
      await createCase.mutateAsync({
        cliente_id: form.cliente_id,
        tipo_servicio_id: form.tipo_servicio_id,
        descripcion_inicial: form.descripcion_inicial,
        valor_pagar: valorPagar,
        estado_id: registradoId,
        agente_id: user!.id,
        created_by: user!.id,
      });
      toast.success("Caso creado exitosamente");
      setCreateOpen(false);
      setForm({ cliente_id: 0, tipo_servicio_id: 0, descripcion_inicial: "", valor_pagar_display: "" });
    } catch (err: any) {
      toast.error("Error: " + err.message);
    }
  };

  // Edit form
  const [editEstado, setEditEstado] = useState(0);
  const [editComentario, setEditComentario] = useState("");
  const [editObservacion, setEditObservacion] = useState("");

  const openDetail = (caso: any) => {
    setSelectedCaseId(caso.id);
    setEditEstado(caso.estado_id);
    setEditObservacion(caso.observacion_cierre || "");
    setEditComentario("");
  };

  const handleUpdate = async () => {
    if (!selectedCaseId || !user) return;
    try {
      const estado = estados?.find(e => e.id === editEstado);
      const updates: any = { id: selectedCaseId, estado_id: editEstado, updated_by: user.id };
      if (estado?.es_final) {
        updates.fecha_cierre = new Date().toISOString();
        updates.observacion_cierre = editObservacion;
      }
      await updateCase.mutateAsync(updates);
      await insertHistorial.mutateAsync({
        caso_id: selectedCaseId,
        estado_id: editEstado,
        cambiado_por: user.id,
        comentario: editComentario || undefined,
      });
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
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>Nuevo Caso</DialogTitle></DialogHeader>
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="space-y-2">
                <Label>Cliente *</Label>
                <Input placeholder="Buscar cliente..." value={clientSearch} onChange={e => setClientSearch(e.target.value)} />
                {clientSearch && filteredClients && filteredClients.length > 0 && (
                  <div className="max-h-40 overflow-auto rounded-md border bg-popover">
                    {filteredClients.map(c => (
                      <button
                        key={c.id}
                        type="button"
                        className="w-full px-3 py-2 text-left text-sm hover:bg-muted transition-colors"
                        onClick={() => { setForm(f => ({ ...f, cliente_id: c.id })); setClientSearch(c.nombre_contacto); }}
                      >
                        <span className="font-medium">{c.nombre_contacto}</span>
                        <span className="ml-2 text-muted-foreground">{c.identificacion}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div className="space-y-2">
                <Label>Tipo de Servicio *</Label>
                <Select value={form.tipo_servicio_id ? String(form.tipo_servicio_id) : ""} onValueChange={v => setForm(f => ({ ...f, tipo_servicio_id: Number(v), valor_pagar_display: "" }))}>
                  <SelectTrigger><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
                  <SelectContent>
                    {tipos?.map(t => <SelectItem key={t.id} value={String(t.id)}>{t.nombre}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              {isRenovacionWeb && (
                <div className="space-y-2">
                  <Label>Valor a Pagar *</Label>
                  <Input
                    placeholder="$ 0"
                    value={form.valor_pagar_display}
                    onChange={e => setForm(f => ({ ...f, valor_pagar_display: formatCOPInput(e.target.value) }))}
                    required
                  />
                </div>
              )}
              <div className="space-y-2">
                <Label>Descripción Inicial *</Label>
                <Textarea value={form.descripcion_inicial} onChange={e => setForm(f => ({ ...f, descripcion_inicial: e.target.value }))} required rows={3} />
              </div>
              <Button type="submit" className="w-full" disabled={createCase.isPending}>
                {createCase.isPending ? "Creando..." : "Crear Caso"}
              </Button>
            </form>
          </DialogContent>
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
                <Select value={String(editEstado)} onValueChange={v => setEditEstado(Number(v))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {estados?.map(e => <SelectItem key={e.id} value={String(e.id)}>{e.nombre}</SelectItem>)}
                  </SelectContent>
                </Select>

                {estados?.find(e => e.id === editEstado)?.es_final && (
                  <div className="space-y-2">
                    <Label>Observación de Cierre</Label>
                    <Textarea value={editObservacion} onChange={e => setEditObservacion(e.target.value)} rows={2} />
                  </div>
                )}

                <div className="space-y-2">
                  <Label>Comentario</Label>
                  <Textarea value={editComentario} onChange={e => setEditComentario(e.target.value)} rows={2} placeholder="Agregar comentario al historial..." />
                </div>

                <Button onClick={handleUpdate} disabled={updateCase.isPending} className="w-full">
                  {updateCase.isPending ? "Guardando..." : "Actualizar Caso"}
                </Button>
              </div>

              <Separator />

              {/* History */}
              <div>
                <h3 className="mb-3 text-sm font-semibold">Historial</h3>
                <div className="space-y-2">
                  {history?.map((h: any) => (
                    <div key={h.id} className="rounded-lg bg-muted p-3 text-sm">
                      <div className="flex items-center justify-between">
                        <span className="font-medium">{h.cat_estados?.nombre}</span>
                        <span className="text-xs text-muted-foreground">{format(new Date(h.cambiado_en), "dd/MM/yyyy HH:mm", { locale: es })}</span>
                      </div>
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
