import { useState } from "react";
import { useClients, useCreateClient } from "@/hooks/useClients";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, Plus } from "lucide-react";
import { toast } from "sonner";

export default function Clients() {
  const [search, setSearch] = useState("");
  const { data: clients, isLoading } = useClients(search);
  const createClient = useCreateClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    identificacion: "", nombre_contacto: "", tipo_cliente: "Persona",
    razon_social: "", telefono: "", celular: "", correo: "",
  });

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await createClient.mutateAsync({
        ...form,
        razon_social: form.razon_social || undefined,
        telefono: form.telefono || undefined,
        celular: form.celular || undefined,
        correo: form.correo || undefined,
      });
      toast.success("Cliente creado exitosamente");
      setOpen(false);
      setForm({ identificacion: "", nombre_contacto: "", tipo_cliente: "Persona", razon_social: "", telefono: "", celular: "", correo: "" });
    } catch (err: any) {
      toast.error("Error: " + err.message);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Clientes</h1>
          <p className="text-muted-foreground">Gestión de clientes del contact center</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="mr-2 h-4 w-4" />Crear Cliente</Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Nuevo Cliente</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Identificación *</Label>
                  <Input value={form.identificacion} onChange={e => setForm(f => ({ ...f, identificacion: e.target.value }))} required />
                </div>
                <div className="space-y-2">
                  <Label>Tipo *</Label>
                  <Select value={form.tipo_cliente} onValueChange={v => setForm(f => ({ ...f, tipo_cliente: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Persona">Persona</SelectItem>
                      <SelectItem value="Empresa">Empresa</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Nombre del Contacto *</Label>
                <Input value={form.nombre_contacto} onChange={e => setForm(f => ({ ...f, nombre_contacto: e.target.value }))} required />
              </div>
              <div className="space-y-2">
                <Label>Razón Social</Label>
                <Input value={form.razon_social} onChange={e => setForm(f => ({ ...f, razon_social: e.target.value }))} />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Teléfono</Label>
                  <Input value={form.telefono} onChange={e => setForm(f => ({ ...f, telefono: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label>Celular</Label>
                  <Input value={form.celular} onChange={e => setForm(f => ({ ...f, celular: e.target.value }))} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Correo electrónico</Label>
                <Input type="email" value={form.correo} onChange={e => setForm(f => ({ ...f, correo: e.target.value }))} />
              </div>
              <Button type="submit" className="w-full" disabled={createClient.isPending}>
                {createClient.isPending ? "Creando..." : "Crear Cliente"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-3">
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar por identificación o nombre..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead>
                <TableHead>Identificación</TableHead>
                <TableHead>Nombre</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Teléfono</TableHead>
                <TableHead>Correo</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={6} className="text-center py-8">Cargando...</TableCell></TableRow>
              ) : clients?.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No se encontraron clientes</TableCell></TableRow>
              ) : clients?.map(c => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">{c.id}</TableCell>
                  <TableCell>{c.identificacion}</TableCell>
                  <TableCell>{c.nombre_contacto}</TableCell>
                  <TableCell><span className="rounded-full bg-secondary px-2 py-0.5 text-xs">{c.tipo_cliente}</span></TableCell>
                  <TableCell>{c.telefono || c.celular || "-"}</TableCell>
                  <TableCell>{c.correo || "-"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
