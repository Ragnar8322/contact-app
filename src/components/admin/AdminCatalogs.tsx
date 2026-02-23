import { useState } from "react";
import { useEstados, useTiposServicio } from "@/hooks/useCases";
import { useCreateEstado, useUpdateEstado, useCreateTipoServicio, useUpdateTipoServicio, useDeleteTipoServicio } from "@/hooks/useAdmin";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Pencil, Check, X, Trash2 } from "lucide-react";
import { toast } from "sonner";

export default function AdminCatalogs() {
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <EstadosSection />
      <TiposServicioSection />
    </div>
  );
}

function EstadosSection() {
  const { data: estados, isLoading } = useEstados();
  const createEstado = useCreateEstado();
  const updateEstado = useUpdateEstado();

  const [adding, setAdding] = useState(false);
  const [newNombre, setNewNombre] = useState("");
  const [newFinal, setNewFinal] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [editData, setEditData] = useState({ nombre: "", es_final: false });

  const handleAdd = async () => {
    if (!newNombre.trim()) return;
    try {
      await createEstado.mutateAsync({ nombre: newNombre, es_final: newFinal });
      toast.success("Estado creado");
      setAdding(false);
      setNewNombre("");
      setNewFinal(false);
    } catch (err: any) { toast.error(err.message); }
  };

  const startEdit = (e: any) => { setEditId(e.id); setEditData({ nombre: e.nombre, es_final: e.es_final }); };

  const saveEdit = async () => {
    if (!editId) return;
    try {
      await updateEstado.mutateAsync({ id: editId, ...editData });
      toast.success("Estado actualizado");
      setEditId(null);
    } catch (err: any) { toast.error(err.message); }
  };

  return (
    <Card className="border-0 shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="text-base">Estados</CardTitle>
        <Button size="sm" variant="outline" onClick={() => setAdding(true)} disabled={adding}><Plus className="mr-1 h-3 w-3" />Nuevo</Button>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>ID</TableHead>
              <TableHead>Nombre</TableHead>
              <TableHead>Final</TableHead>
              <TableHead className="w-20"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {adding && (
              <TableRow>
                <TableCell>—</TableCell>
                <TableCell><Input value={newNombre} onChange={e => setNewNombre(e.target.value)} className="h-8" placeholder="Nombre..." /></TableCell>
                <TableCell><Checkbox checked={newFinal} onCheckedChange={v => setNewFinal(!!v)} /></TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={handleAdd}><Check className="h-4 w-4" /></Button>
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setAdding(false)}><X className="h-4 w-4" /></Button>
                  </div>
                </TableCell>
              </TableRow>
            )}
            {isLoading ? (
              <TableRow><TableCell colSpan={4} className="text-center py-6">Cargando...</TableCell></TableRow>
            ) : estados?.map(e => (
              <TableRow key={e.id}>
                <TableCell className="text-muted-foreground">{e.id}</TableCell>
                <TableCell>
                  {editId === e.id ? <Input value={editData.nombre} onChange={ev => setEditData(d => ({ ...d, nombre: ev.target.value }))} className="h-8" /> : e.nombre}
                </TableCell>
                <TableCell>
                  {editId === e.id ? <Checkbox checked={editData.es_final} onCheckedChange={v => setEditData(d => ({ ...d, es_final: !!v }))} /> : (e.es_final ? "✓" : "")}
                </TableCell>
                <TableCell>
                  {editId === e.id ? (
                    <div className="flex gap-1">
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={saveEdit}><Check className="h-4 w-4" /></Button>
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setEditId(null)}><X className="h-4 w-4" /></Button>
                    </div>
                  ) : (
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => startEdit(e)}><Pencil className="h-4 w-4" /></Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function TiposServicioSection() {
  const { data: tipos, isLoading } = useTiposServicio();
  const createTipo = useCreateTipoServicio();
  const updateTipo = useUpdateTipoServicio();
  const deleteTipo = useDeleteTipoServicio();

  const [adding, setAdding] = useState(false);
  const [newNombre, setNewNombre] = useState("");
  const [editId, setEditId] = useState<number | null>(null);
  const [editNombre, setEditNombre] = useState("");

  const handleAdd = async () => {
    if (!newNombre.trim()) return;
    try {
      await createTipo.mutateAsync({ nombre: newNombre });
      toast.success("Tipo creado");
      setAdding(false);
      setNewNombre("");
    } catch (err: any) { toast.error(err.message); }
  };

  const saveEdit = async () => {
    if (!editId) return;
    try {
      await updateTipo.mutateAsync({ id: editId, nombre: editNombre });
      toast.success("Tipo actualizado");
      setEditId(null);
    } catch (err: any) { toast.error(err.message); }
  };

  const handleDelete = async (id: number) => {
    try {
      await deleteTipo.mutateAsync(id);
      toast.success("Tipo eliminado");
    } catch (err: any) { toast.error(err.message); }
  };

  return (
    <Card className="border-0 shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="text-base">Tipos de Servicio</CardTitle>
        <Button size="sm" variant="outline" onClick={() => setAdding(true)} disabled={adding}><Plus className="mr-1 h-3 w-3" />Nuevo</Button>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>ID</TableHead>
              <TableHead>Nombre</TableHead>
              <TableHead className="w-28"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {adding && (
              <TableRow>
                <TableCell>—</TableCell>
                <TableCell><Input value={newNombre} onChange={e => setNewNombre(e.target.value)} className="h-8" placeholder="Nombre..." /></TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={handleAdd}><Check className="h-4 w-4" /></Button>
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setAdding(false)}><X className="h-4 w-4" /></Button>
                  </div>
                </TableCell>
              </TableRow>
            )}
            {isLoading ? (
              <TableRow><TableCell colSpan={3} className="text-center py-6">Cargando...</TableCell></TableRow>
            ) : tipos?.map(t => (
              <TableRow key={t.id}>
                <TableCell className="text-muted-foreground">{t.id}</TableCell>
                <TableCell>
                  {editId === t.id ? <Input value={editNombre} onChange={e => setEditNombre(e.target.value)} className="h-8" /> : t.nombre}
                </TableCell>
                <TableCell>
                  {editId === t.id ? (
                    <div className="flex gap-1">
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={saveEdit}><Check className="h-4 w-4" /></Button>
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setEditId(null)}><X className="h-4 w-4" /></Button>
                    </div>
                  ) : (
                    <div className="flex gap-1">
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => { setEditId(t.id); setEditNombre(t.nombre); }}><Pencil className="h-4 w-4" /></Button>
                      <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => handleDelete(t.id)}><Trash2 className="h-4 w-4" /></Button>
                    </div>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
