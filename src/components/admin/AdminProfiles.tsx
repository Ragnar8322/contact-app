import { useState } from "react";
import { useAllProfiles, useUpdateProfile, useInviteUser, useRoles } from "@/hooks/useAdmin";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Pencil, Check, X } from "lucide-react";
import { toast } from "sonner";

export default function AdminProfiles() {
  const { data: profiles, isLoading } = useAllProfiles();
  const { data: roles } = useRoles();
  const updateProfile = useUpdateProfile();
  const inviteUser = useInviteUser();

  const [editId, setEditId] = useState<string | null>(null);
  const [editData, setEditData] = useState({ nombre: "", telefono: "", role_id: 0 });
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteForm, setInviteForm] = useState({ email: "", nombre: "", telefono: "", role_id: 2 });
  const [inviteResult, setInviteResult] = useState<{ temp_password: string } | null>(null);

  const startEdit = (p: any) => {
    setEditId(p.user_id);
    setEditData({ nombre: p.nombre, telefono: p.telefono || "", role_id: p.role_id });
  };

  const saveEdit = async () => {
    if (!editId) return;
    try {
      await updateProfile.mutateAsync({ user_id: editId, ...editData });
      toast.success("Perfil actualizado");
      setEditId(null);
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const result = await inviteUser.mutateAsync(inviteForm);
      setInviteResult(result);
      toast.success("Usuario creado exitosamente");
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  return (
    <Card className="border-0 shadow-sm">
      <CardContent className="p-0">
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="font-semibold">Perfiles de Usuario</h3>
          <Dialog open={inviteOpen} onOpenChange={(o) => { setInviteOpen(o); if (!o) { setInviteResult(null); setInviteForm({ email: "", nombre: "", telefono: "", role_id: 2 }); } }}>
            <DialogTrigger asChild>
              <Button size="sm"><Plus className="mr-2 h-4 w-4" />Crear Usuario</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Crear Nuevo Usuario</DialogTitle></DialogHeader>
              {inviteResult ? (
                <div className="space-y-3">
                  <p className="text-sm text-muted-foreground">Usuario creado. Comparte estas credenciales temporales:</p>
                  <div className="rounded-lg bg-muted p-3 text-sm font-mono">
                    <p>Email: {inviteForm.email}</p>
                    <p>Contraseña: {inviteResult.temp_password}</p>
                  </div>
                  <Button className="w-full" onClick={() => { setInviteOpen(false); setInviteResult(null); setInviteForm({ email: "", nombre: "", telefono: "", role_id: 2 }); }}>Cerrar</Button>
                </div>
              ) : (
                <form onSubmit={handleInvite} className="space-y-4">
                  <div className="space-y-2">
                    <Label>Email *</Label>
                    <Input type="email" required value={inviteForm.email} onChange={e => setInviteForm(f => ({ ...f, email: e.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <Label>Nombre</Label>
                    <Input value={inviteForm.nombre} onChange={e => setInviteForm(f => ({ ...f, nombre: e.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <Label>Teléfono</Label>
                    <Input value={inviteForm.telefono} onChange={e => setInviteForm(f => ({ ...f, telefono: e.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <Label>Rol *</Label>
                    <Select value={String(inviteForm.role_id)} onValueChange={v => setInviteForm(f => ({ ...f, role_id: Number(v) }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {roles?.map(r => <SelectItem key={r.id} value={String(r.id)}>{r.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <Button type="submit" className="w-full" disabled={inviteUser.isPending}>
                    {inviteUser.isPending ? "Creando..." : "Crear Usuario"}
                  </Button>
                </form>
              )}
            </DialogContent>
          </Dialog>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nombre</TableHead>
              <TableHead>Teléfono</TableHead>
              <TableHead>Rol</TableHead>
              <TableHead>User ID</TableHead>
              <TableHead className="w-20"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={5} className="text-center py-8">Cargando...</TableCell></TableRow>
            ) : profiles?.map((p: any) => (
              <TableRow key={p.user_id}>
                <TableCell>
                  {editId === p.user_id ? (
                    <Input value={editData.nombre} onChange={e => setEditData(d => ({ ...d, nombre: e.target.value }))} className="h-8" />
                  ) : p.nombre}
                </TableCell>
                <TableCell>
                  {editId === p.user_id ? (
                    <Input value={editData.telefono} onChange={e => setEditData(d => ({ ...d, telefono: e.target.value }))} className="h-8" />
                  ) : p.telefono || "-"}
                </TableCell>
                <TableCell>
                  {editId === p.user_id ? (
                    <Select value={String(editData.role_id)} onValueChange={v => setEditData(d => ({ ...d, role_id: Number(v) }))}>
                      <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {roles?.map(r => <SelectItem key={r.id} value={String(r.id)}>{r.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  ) : (
                    <span className="inline-block rounded-full px-2.5 py-0.5 text-xs font-medium bg-secondary text-secondary-foreground capitalize">
                      {(p.user_roles as any)?.name || "—"}
                    </span>
                  )}
                </TableCell>
                <TableCell className="text-xs text-muted-foreground font-mono">{p.user_id.slice(0, 8)}…</TableCell>
                <TableCell>
                  {editId === p.user_id ? (
                    <div className="flex gap-1">
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={saveEdit}><Check className="h-4 w-4" /></Button>
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setEditId(null)}><X className="h-4 w-4" /></Button>
                    </div>
                  ) : (
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => startEdit(p)}><Pencil className="h-4 w-4" /></Button>
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
