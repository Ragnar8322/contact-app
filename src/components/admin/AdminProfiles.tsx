import { useState } from "react";
import { useAllProfiles, useUpdateProfile, useInviteUser, useRoles, useSaveRoleAssignments, useResetPassword } from "@/hooks/useAdmin";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogTrigger, DialogFooter, DialogDescription
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger
} from "@/components/ui/alert-dialog";
import { Plus, Pencil, Check, X, KeyRound, Shield, Copy } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { cn } from "@/lib/utils";

const passwordSchema = z
  .string()
  .min(8, "Mínimo 8 caracteres")
  .regex(/[A-Z]/, "Debe incluir al menos una mayúscula")
  .regex(/[a-z]/, "Debe incluir al menos una minúscula")
  .regex(/[0-9]/, "Debe incluir al menos un número")
  .regex(/[!@#$%^&*(),.?":{}|<>]/, "Debe incluir al menos un carácter especial");

const ROLE_COLORS: Record<string, string> = {
  admin: "bg-destructive/10 text-destructive border-destructive/20",
  supervisor: "bg-primary/10 text-primary border-primary/20",
  agent: "bg-secondary text-secondary-foreground border-secondary",
  gerente: "bg-accent text-accent-foreground border-accent",
};

function RoleBadges({ assignments, fallbackRole }: {
  assignments: { role_id: number; role_name: string }[];
  fallbackRole?: string;
}) {
  const rolesToShow = assignments.length > 0
    ? assignments.map(a => a.role_name)
    : fallbackRole ? [fallbackRole] : [];
  if (rolesToShow.length === 0) return <span className="text-muted-foreground">—</span>;
  return (
    <div className="flex flex-wrap gap-1">
      {rolesToShow.map((role, i) => (
        <Badge key={i} variant="outline" className={cn("text-xs capitalize", ROLE_COLORS[role] || "")}>
          {role}
        </Badge>
      ))}
    </div>
  );
}

function RoleCheckboxes({ roles, selected, onChange }: {
  roles: { id: number; name: string }[];
  selected: number[];
  onChange: (ids: number[]) => void;
}) {
  return (
    <div className="space-y-2">
      {roles.map(r => (
        <div key={r.id} className="flex items-center gap-2">
          <Checkbox
            id={`role-${r.id}`}
            checked={selected.includes(r.id)}
            onCheckedChange={(checked) => {
              if (checked) onChange([...selected, r.id]);
              else onChange(selected.filter(id => id !== r.id));
            }}
          />
          <Label htmlFor={`role-${r.id}`} className="capitalize cursor-pointer">{r.name}</Label>
        </div>
      ))}
    </div>
  );
}

const INVITE_FORM_INIT = { email: "", nombre: "", telefono: "", selectedRoleIds: [2] as number[] };

// ─── Componente de credenciales (AlertDialog independiente) ───
function CredencialesDialog({
  open,
  onClose,
  email,
  password,
}: {
  open: boolean;
  onClose: () => void;
  email: string;
  password: string;
}) {
  return (
    <AlertDialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle>✅ Usuario creado exitosamente</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-4 pt-2">
              <p className="text-sm text-muted-foreground">
                Comparte estas credenciales temporales con el usuario:
              </p>
              <div className="rounded-lg border bg-muted/60 p-4 space-y-3 text-sm">
                <div className="flex items-center justify-between gap-4">
                  <span className="text-muted-foreground shrink-0">Email</span>
                  <span className="font-medium break-all text-right">{email}</span>
                </div>
                <div className="border-t pt-3 flex items-center justify-between gap-4">
                  <span className="text-muted-foreground shrink-0">Contraseña</span>
                  <div className="flex items-center gap-2">
                    <code className="font-bold tracking-wider bg-background border rounded px-2 py-1">
                      {password}
                    </code>
                    <Button
                      size="icon" variant="outline" className="h-7 w-7 shrink-0"
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(password);
                        toast.success("Contraseña copiada al portapapeles");
                      }}
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </div>
              <p className="text-xs text-amber-600 dark:text-amber-400">
                ⚠️ El usuario deberá cambiar esta contraseña al iniciar sesión por primera vez.
              </p>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogAction onClick={onClose}>Entendido</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

// ─── Componente principal ───
export default function AdminProfiles() {
  const { data: profiles, isLoading, refetch } = useAllProfiles();
  const { data: roles } = useRoles();
  const updateProfile = useUpdateProfile();
  const inviteUser = useInviteUser();
  const saveRoleAssignments = useSaveRoleAssignments();
  const resetPassword = useResetPassword();

  const [editId, setEditId] = useState<string | null>(null);
  const [editData, setEditData] = useState({ nombre: "", telefono: "", selectedRoleIds: [] as number[] });

  // Diálogo de creación
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteForm, setInviteForm] = useState(INVITE_FORM_INIT);

  // Diálogo de credenciales (completamente separado del formulario)
  const [credencialesOpen, setCredencialesOpen] = useState(false);
  const [credenciales, setCredenciales] = useState({ email: "", password: "" });

  // Diálogo contraseña temporal
  const [tempPwdUser, setTempPwdUser] = useState<{ user_id: string; nombre: string } | null>(null);
  const [tempPwd, setTempPwd] = useState("");
  const [tempPwdConfirm, setTempPwdConfirm] = useState("");

  const startEdit = (p: any) => {
    setEditId(p.user_id);
    const existing = p.role_assignments?.map((a: any) => a.role_id) || [];
    setEditData({
      nombre: p.nombre,
      telefono: p.telefono || "",
      selectedRoleIds: existing.length > 0 ? existing : [p.role_id],
    });
  };

  const saveEdit = async () => {
    if (!editId) return;
    try {
      await updateProfile.mutateAsync({ user_id: editId, nombre: editData.nombre, telefono: editData.telefono });
      await saveRoleAssignments.mutateAsync({ user_id: editId, role_ids: editData.selectedRoleIds });
      toast.success("Perfil actualizado");
      setEditId(null);
    } catch (err: any) { toast.error(err.message); }
  };

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();

    // 1. Capturar datos del form ANTES de cerrar
    const emailSnap = inviteForm.email;
    const bodySnap = {
      email: inviteForm.email,
      nombre: inviteForm.nombre,
      telefono: inviteForm.telefono,
      role_id: inviteForm.selectedRoleIds[0] || 2,
      role_ids: inviteForm.selectedRoleIds,
    };

    try {
      const result = await inviteUser.mutateAsync(bodySnap);

      // 2. Guardar credenciales en estado PROPIO (independiente del form)
      setCredenciales({ email: emailSnap, password: result.temp_password });

      // 3. Cerrar formulario y limpiar
      setInviteOpen(false);
      setInviteForm(INVITE_FORM_INIT);

      // 4. Abrir diálogo de credenciales (completamente separado)
      setCredencialesOpen(true);

    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleForceChange = async (userId: string, nombre: string) => {
    try {
      await resetPassword.mutateAsync({ user_id: userId, action: "force_change" });
      toast.success(`${nombre} deberá cambiar su contraseña en el próximo inicio de sesión.`);
      refetch();
    } catch (err: any) { toast.error(err.message); }
  };

  const handleSetTempPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tempPwdUser) return;
    const v = passwordSchema.safeParse(tempPwd);
    if (!v.success) { toast.error(v.error.errors[0].message); return; }
    if (tempPwd !== tempPwdConfirm) { toast.error("Las contraseñas no coinciden"); return; }
    try {
      await resetPassword.mutateAsync({ user_id: tempPwdUser.user_id, action: "set_temp_password", temp_password: tempPwd });
      toast.success("Contraseña temporal establecida.");
      setTempPwdUser(null);
      setTempPwd("");
      setTempPwdConfirm("");
      refetch();
    } catch (err: any) { toast.error(err.message); }
  };

  const tempPwdValid = passwordSchema.safeParse(tempPwd);
  const tempPwdMismatch = tempPwdConfirm.length > 0 && tempPwd !== tempPwdConfirm;

  return (
    <>
      <Card className="border-0 shadow-sm">
        <CardContent className="p-0">
          <div className="flex items-center justify-between p-4 border-b">
            <h3 className="font-semibold">Perfiles de Usuario</h3>

            {/* Diálogo Crear Usuario */}
            <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
              <DialogTrigger asChild>
                <Button size="sm"><Plus className="mr-2 h-4 w-4" />Crear Usuario</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Crear Nuevo Usuario</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleInvite} className="space-y-4">
                  <div className="space-y-2">
                    <Label>Email *</Label>
                    <Input type="email" required value={inviteForm.email}
                      onChange={e => setInviteForm(f => ({ ...f, email: e.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <Label>Nombre</Label>
                    <Input value={inviteForm.nombre}
                      onChange={e => setInviteForm(f => ({ ...f, nombre: e.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <Label>Teléfono</Label>
                    <Input value={inviteForm.telefono}
                      onChange={e => setInviteForm(f => ({ ...f, telefono: e.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <Label>Roles *</Label>
                    {roles && (
                      <RoleCheckboxes
                        roles={roles}
                        selected={inviteForm.selectedRoleIds}
                        onChange={(ids) => setInviteForm(f => ({ ...f, selectedRoleIds: ids }))}
                      />
                    )}
                    {inviteForm.selectedRoleIds.length === 0 && (
                      <p className="text-xs text-destructive">Selecciona al menos un rol</p>
                    )}
                  </div>
                  <Button type="submit" className="w-full"
                    disabled={inviteUser.isPending || inviteForm.selectedRoleIds.length === 0}>
                    {inviteUser.isPending ? "Creando..." : "Crear Usuario"}
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead>Teléfono</TableHead>
                <TableHead>Roles</TableHead>
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
                    {editId === p.user_id
                      ? <Input value={editData.nombre} onChange={e => setEditData(d => ({ ...d, nombre: e.target.value }))} className="h-8" />
                      : p.nombre}
                  </TableCell>
                  <TableCell>
                    {editId === p.user_id
                      ? <Input value={editData.telefono} onChange={e => setEditData(d => ({ ...d, telefono: e.target.value }))} className="h-8" />
                      : p.telefono || "-"}
                  </TableCell>
                  <TableCell>
                    {editId === p.user_id ? (
                      roles && <RoleCheckboxes roles={roles} selected={editData.selectedRoleIds} onChange={(ids) => setEditData(d => ({ ...d, selectedRoleIds: ids }))} />
                    ) : (
                      <RoleBadges assignments={p.role_assignments || []} fallbackRole={(p.user_roles as any)?.name} />
                    )}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground font-mono">{p.user_id.slice(0, 8)}…</TableCell>
                  <TableCell>
                    {editId === p.user_id ? (
                      <div className="flex gap-1">
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={saveEdit} disabled={editData.selectedRoleIds.length === 0}>
                          <Check className="h-4 w-4" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setEditId(null)}>
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ) : (
                      <div className="flex gap-1">
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => startEdit(p)} title="Editar">
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button size="icon" variant="ghost" className="h-7 w-7" title="Marcar para cambio de contraseña">
                              <KeyRound className="h-4 w-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Restablecer contraseña</AlertDialogTitle>
                              <AlertDialogDescription>
                                ¿Seguro que deseas marcar a <strong>{p.nombre}</strong> para que cambie su contraseña en el próximo inicio de sesión?
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction onClick={() => handleForceChange(p.user_id, p.nombre)}>Confirmar</AlertDialogAction>
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
      </Card>

      {/* ── Pop-up de credenciales (AlertDialog completamente independiente) ── */}
      <CredencialesDialog
        open={credencialesOpen}
        onClose={() => setCredencialesOpen(false)}
        email={credenciales.email}
        password={credenciales.password}
      />

      {/* Diálogo contraseña temporal */}
      <Dialog open={!!tempPwdUser} onOpenChange={(o) => { if (!o) setTempPwdUser(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Establecer contraseña temporal</DialogTitle>
            <DialogDescription>Para: <strong>{tempPwdUser?.nombre}</strong></DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSetTempPassword} className="space-y-4">
            <div className="space-y-2">
              <Label>Nueva contraseña temporal</Label>
              <Input type="password" value={tempPwd} onChange={e => setTempPwd(e.target.value)} placeholder="••••••••" required />
              {tempPwd && !tempPwdValid.success && (
                <div className="space-y-1">
                  {tempPwdValid.error!.errors.map((err, i) => (
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
              <Button type="submit" disabled={!tempPwdValid.success || tempPwd !== tempPwdConfirm || resetPassword.isPending}>
                {resetPassword.isPending ? "Guardando..." : "Establecer contraseña"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
