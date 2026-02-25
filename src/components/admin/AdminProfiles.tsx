import { useState } from "react";
import { useAllProfiles, useUpdateProfile, useInviteUser, useRoles } from "@/hooks/useAdmin";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Plus, Pencil, Check, X, KeyRound, Shield } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";

const passwordSchema = z
  .string()
  .min(8, "Mínimo 8 caracteres")
  .regex(/[A-Z]/, "Debe incluir al menos una mayúscula")
  .regex(/[a-z]/, "Debe incluir al menos una minúscula")
  .regex(/[0-9]/, "Debe incluir al menos un número")
  .regex(/[!@#$%^&*(),.?":{}|<>]/, "Debe incluir al menos un carácter especial");

export default function AdminProfiles() {
  const { data: profiles, isLoading, refetch } = useAllProfiles();
  const { data: roles } = useRoles();
  const updateProfile = useUpdateProfile();
  const inviteUser = useInviteUser();

  const [editId, setEditId] = useState<string | null>(null);
  const [editData, setEditData] = useState({ nombre: "", telefono: "", role_id: 0 });
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteForm, setInviteForm] = useState({ email: "", nombre: "", telefono: "", role_id: 2 });
  const [inviteResult, setInviteResult] = useState<{ temp_password: string } | null>(null);

  // Temp password dialog
  const [tempPwdUser, setTempPwdUser] = useState<{ user_id: string; nombre: string } | null>(null);
  const [tempPwd, setTempPwd] = useState("");
  const [tempPwdConfirm, setTempPwdConfirm] = useState("");
  const [tempPwdLoading, setTempPwdLoading] = useState(false);

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

  const handleForceChange = async (userId: string, nombre: string) => {
    try {
      const { error } = await supabase.functions.invoke("reset-password", {
        body: { user_id: userId, action: "force_change" },
      });
      if (error) throw error;
      toast.success(`${nombre} deberá cambiar su contraseña en el próximo inicio de sesión.`);
      refetch();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleSetTempPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tempPwdUser) return;
    const validation = passwordSchema.safeParse(tempPwd);
    if (!validation.success) {
      toast.error(validation.error.errors[0].message);
      return;
    }
    if (tempPwd !== tempPwdConfirm) {
      toast.error("Las contraseñas no coinciden");
      return;
    }
    setTempPwdLoading(true);
    try {
      const { error } = await supabase.functions.invoke("reset-password", {
        body: { user_id: tempPwdUser.user_id, action: "set_temp_password", temp_password: tempPwd },
      });
      if (error) throw error;
      toast.success("Contraseña temporal establecida. El usuario deberá cambiarla al iniciar sesión.");
      setTempPwdUser(null);
      setTempPwd("");
      setTempPwdConfirm("");
      refetch();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setTempPwdLoading(false);
    }
  };

  const tempPwdValid = passwordSchema.safeParse(tempPwd);
  const tempPwdMismatch = tempPwdConfirm.length > 0 && tempPwd !== tempPwdConfirm;

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
              <TableHead className="w-40"></TableHead>
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
                    <div className="flex gap-1">
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => startEdit(p)} title="Editar">
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button size="icon" variant="ghost" className="h-7 w-7" title="Restablecer contraseña">
                            <KeyRound className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Restablecer contraseña</AlertDialogTitle>
                            <AlertDialogDescription>
                              ¿Seguro que deseas restablecer la contraseña de <strong>{p.nombre}</strong>? Se le pedirá que la cambie en su próximo inicio de sesión.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction onClick={() => handleForceChange(p.user_id, p.nombre)}>
                              Confirmar
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                      <Button size="icon" variant="ghost" className="h-7 w-7" title="Establecer contraseña temporal"
                        onClick={() => { setTempPwdUser({ user_id: p.user_id, nombre: p.nombre }); setTempPwd(""); setTempPwdConfirm(""); }}>
                        <Shield className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>

      {/* Temp password dialog */}
      <Dialog open={!!tempPwdUser} onOpenChange={(o) => { if (!o) setTempPwdUser(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Establecer contraseña temporal</DialogTitle>
            <DialogDescription>Para: {tempPwdUser?.nombre}</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSetTempPassword} className="space-y-4">
            <div className="space-y-2">
              <Label>Nueva contraseña temporal</Label>
              <Input type="password" value={tempPwd} onChange={e => setTempPwd(e.target.value)} placeholder="••••••••" required />
              {tempPwd && !tempPwdValid.success && (
                <div className="space-y-1">
                  {tempPwdValid.error.errors.map((err, i) => (
                    <p key={i} className="text-xs text-destructive">{err.message}</p>
                  ))}
                </div>
              )}
            </div>
            <div className="space-y-2">
              <Label>Confirmar contraseña</Label>
              <Input type="password" value={tempPwdConfirm} onChange={e => setTempPwdConfirm(e.target.value)} placeholder="••••••••" required />
              {tempPwdMismatch && <p className="text-xs text-destructive">Las contraseñas no coinciden</p>}
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setTempPwdUser(null)}>Cancelar</Button>
              <Button type="submit" disabled={!tempPwdValid.success || tempPwd !== tempPwdConfirm || tempPwdLoading}>
                {tempPwdLoading ? "Guardando..." : "Establecer contraseña"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
