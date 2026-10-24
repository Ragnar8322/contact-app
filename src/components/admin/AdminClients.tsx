import { useState } from "react";
import { useClients, useCreateClient } from "@/hooks/useClients";
import { useUpdateClient } from "@/hooks/useAdmin";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Pencil, Check, X, Search } from "lucide-react";
import { toast } from "sonner";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { RefetchBar, TableSkeletonRows } from "@/components/TableLoading";
import { TablePagination } from "@/components/TablePagination";

const PAGE_SIZE = 25;

export default function AdminClients() {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const debouncedSearch = useDebouncedValue(search);
  const { data: result, isLoading, isFetching } = useClients(debouncedSearch, { page, pageSize: PAGE_SIZE });
  const clients = result?.rows;
  const createClient = useCreateClient();
  const updateClient = useUpdateClient();

  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({ identificacion: "", nombre_contacto: "", tipo_cliente: "Persona", razon_social: "", telefono: "", celular: "", correo: "" });

  const [editId, setEditId] = useState<number | null>(null);
  const [editData, setEditData] = useState({ nombre_contacto: "", telefono: "", celular: "", correo: "", tipo_cliente: "" });

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await createClient.mutateAsync(form);
      toast.success("Cliente creado");
      setCreateOpen(false);
      setForm({ identificacion: "", nombre_contacto: "", tipo_cliente: "Persona", razon_social: "", telefono: "", celular: "", correo: "" });
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const startEdit = (c: any) => {
    setEditId(c.id);
    setEditData({ nombre_contacto: c.nombre_contacto, telefono: c.telefono || "", celular: c.celular || "", correo: c.correo || "", tipo_cliente: c.tipo_cliente });
  };

  const saveEdit = async () => {
    if (!editId) return;
    try {
      await updateClient.mutateAsync({ id: editId, ...editData });
      toast.success("Cliente actualizado");
      setEditId(null);
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar por nombre o identificación..." className="pl-9" value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} aria-label="Buscar clientes" />
        </div>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button size="sm"><Plus className="mr-2 h-4 w-4" />Crear Cliente</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Nuevo Cliente</DialogTitle></DialogHeader>
            <form onSubmit={handleCreate} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="admin-clients-identificacion" className="text-xs">Identificación *</Label>
                  <Input id="admin-clients-identificacion" required value={form.identificacion} onChange={e => setForm(f => ({ ...f, identificacion: e.target.value }))} />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="admin-clients-tipo" className="text-xs">Tipo *</Label>
                  <Select value={form.tipo_cliente} onValueChange={v => setForm(f => ({ ...f, tipo_cliente: v }))}>
                    <SelectTrigger id="admin-clients-tipo"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Persona">Persona</SelectItem>
                      <SelectItem value="Empresa">Empresa</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-1">
                  <Label htmlFor="admin-clients-nombre-contacto" className="text-xs">Nombre Contacto *</Label>
                  <Input id="admin-clients-nombre-contacto" required value={form.nombre_contacto} onChange={e => setForm(f => ({ ...f, nombre_contacto: e.target.value.toUpperCase() }))} className="uppercase" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="admin-clients-telefono" className="text-xs">Teléfono</Label>
                  <Input id="admin-clients-telefono" type="tel" inputMode="tel" autoComplete="tel" value={form.telefono} onChange={e => setForm(f => ({ ...f, telefono: e.target.value }))} />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="admin-clients-celular" className="text-xs">Celular</Label>
                  <Input id="admin-clients-celular" type="tel" inputMode="tel" autoComplete="tel" value={form.celular} onChange={e => setForm(f => ({ ...f, celular: e.target.value }))} />
                </div>
              </div>
              <div className="space-y-1">
                  <Label htmlFor="admin-clients-correo" className="text-xs">Correo</Label>
                  <Input id="admin-clients-correo" type="email" value={form.correo} onChange={e => setForm(f => ({ ...f, correo: e.target.value.toLowerCase() }))} className="lowercase" />
              </div>
              <Button type="submit" className="w-full" disabled={createClient.isPending}>
                {createClient.isPending ? "Creando..." : "Crear Cliente"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card className="border-0 shadow-sm">
        <CardContent className="p-0 relative">
          <RefetchBar active={isFetching && !isLoading} />
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead>
                <TableHead>Identificación</TableHead>
                <TableHead>Nombre</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Celular</TableHead>
                <TableHead>Correo</TableHead>
                <TableHead className="w-20"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableSkeletonRows columns={7} />
              ) : !clients?.length ? (
                <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No hay clientes</TableCell></TableRow>
              ) : clients.map((c: any) => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">{c.id}</TableCell>
                  <TableCell>{c.identificacion}</TableCell>
                  <TableCell>
                    {editId === c.id ? <Input value={editData.nombre_contacto} onChange={e => setEditData(d => ({ ...d, nombre_contacto: e.target.value }))} className="h-8" /> : c.nombre_contacto}
                  </TableCell>
                  <TableCell>
                    {editId === c.id ? (
                      <Select value={editData.tipo_cliente} onValueChange={v => setEditData(d => ({ ...d, tipo_cliente: v }))}>
                        <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Persona">Persona</SelectItem>
                          <SelectItem value="Empresa">Empresa</SelectItem>
                        </SelectContent>
                      </Select>
                    ) : c.tipo_cliente}
                  </TableCell>
                  <TableCell>
                    {editId === c.id ? <Input value={editData.celular} onChange={e => setEditData(d => ({ ...d, celular: e.target.value }))} className="h-8" /> : c.celular || "-"}
                  </TableCell>
                  <TableCell>
                    {editId === c.id ? <Input value={editData.correo} onChange={e => setEditData(d => ({ ...d, correo: e.target.value }))} className="h-8" /> : c.correo || "-"}
                  </TableCell>
                  <TableCell>
                    {editId === c.id ? (
                      <div className="flex gap-1">
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={saveEdit} aria-label="Guardar"><Check className="h-4 w-4" /></Button>
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setEditId(null)} aria-label="Cancelar"><X className="h-4 w-4" /></Button>
                      </div>
                    ) : (
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => startEdit(c)} aria-label="Editar"><Pencil className="h-4 w-4" /></Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <TablePagination
            page={page}
            totalPages={result?.totalPages ?? 1}
            totalCount={result?.totalCount ?? 0}
            pageSize={PAGE_SIZE}
            itemLabel="clientes"
            onPageChange={setPage}
          />
        </CardContent>
      </Card>
    </div>
  );
}
