import { useState } from "react";
import { useAllProfiles } from "@/hooks/useAdmin";
import { useCampanasList, usePerfilCampanas, useAssignCampana, useUnassignCampana } from "@/hooks/useCampanas";
import { useAllCases, useAdminUpdateCase } from "@/hooks/useAdmin";
import { useEstados, useAgentes, useInsertHistorial } from "@/hooks/useCases";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

// Devuelve true si el perfil tiene alguno de los roles indicados
function hasAnyRole(p: any, roleNames: string[]): boolean {
  // Rol principal en profiles.user_roles.name
  const primaryRole = (p.user_roles as any)?.name;
  if (primaryRole && roleNames.includes(primaryRole)) return true;

  // Roles del nuevo sistema en user_role_assignments (role_name o name)
  const assignments: any[] = p.role_assignments || [];
  return assignments.some(
    (r: any) =>
      (r.role_name && roleNames.includes(r.role_name)) ||
      (r.name && roleNames.includes(r.name))
  );
}

function getPrimaryRoleLabel(p: any): "supervisor" | "agent" {
  if (hasAnyRole(p, ["supervisor"])) return "supervisor";
  return "agent";
}

export default function AdminCampanas() {
  const { user } = useAuth();
  const { data: profiles } = useAllProfiles();
  const { data: campanas } = useCampanasList();
  const { data: perfilCampanas } = usePerfilCampanas();
  const assign = useAssignCampana();
  const unassign = useUnassignCampana();

  const { data: estados } = useEstados();
  const { data: agentes } = useAgentes();
  const [filterCampana, setFilterCampana] = useState<string>("");
  const [filterEstado, setFilterEstado] = useState<string>("");
  const { data: allCasesResult } = useAllCases({
    estado_id: filterEstado && filterEstado !== "all" ? Number(filterEstado) : undefined,
  });
  const allCases = allCasesResult?.data ?? [];
  const updateCase = useAdminUpdateCase();
  const insertHistorial = useInsertHistorial();

  // Usuarios con rol agent o supervisor (excluye admin y gerente)
  const assignableUsers = (profiles || []).filter((p: any) =>
    hasAnyRole(p, ["agent", "supervisor"])
  );

  const isAssigned = (userId: string, campanaId: string) =>
    perfilCampanas?.some(pc => pc.user_id === userId && pc.campana_id === campanaId) || false;

  const handleToggle = async (userId: string, campanaId: string, currentlyAssigned: boolean) => {
    try {
      if (currentlyAssigned) {
        await unassign.mutateAsync({ user_id: userId, campana_id: campanaId });
        toast.success("Campaña desasignada");
      } else {
        await assign.mutateAsync({ user_id: userId, campana_id: campanaId });
        toast.success("Campaña asignada");
      }
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const filteredCases = allCases.filter((c: any) => {
    if (filterCampana && filterCampana !== "all" && c.campana_id !== filterCampana) return false;
    return true;
  });

  const handleCaseReassign = async (casoId: number, field: "campana_id" | "agente_id", value: string) => {
    if (!user) return;
    try {
      const updates: any = { id: casoId, updated_by: user.id };
      updates[field] = value;
      await updateCase.mutateAsync(updates);
      await insertHistorial.mutateAsync({
        caso_id: casoId,
        estado_id: allCases?.find((c: any) => c.id === casoId)?.estado_id || 0,
        cambiado_por: user.id,
        comentario: "Reasignado por administrador",
      });
      toast.success("Caso reasignado");
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  return (
    <div className="space-y-6">
      {/* Section 1: Asignación a Campañas */}
      <Card className="border-0 shadow-sm">
        <CardHeader>
          <CardTitle className="text-base">Asignación a Campañas</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Usuario</TableHead>
                <TableHead>Rol</TableHead>
                {campanas?.map(c => (
                  <TableHead key={c.id} className="text-center">{c.nombre}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {assignableUsers.map((u: any) => {
                const roleLabel = getPrimaryRoleLabel(u);
                return (
                  <TableRow key={u.user_id}>
                    <TableCell className="font-medium">{u.nombre}</TableCell>
                    <TableCell>
                      <Badge
                        variant={roleLabel === "supervisor" ? "default" : "secondary"}
                        className="text-xs"
                      >
                        {roleLabel === "supervisor" ? "Supervisor" : "Agente"}
                      </Badge>
                    </TableCell>
                    {campanas?.map(c => {
                      const assigned = isAssigned(u.user_id, c.id);
                      return (
                        <TableCell key={c.id} className="text-center">
                          <Checkbox
                            checked={assigned}
                            onCheckedChange={() => handleToggle(u.user_id, c.id, assigned)}
                            disabled={assign.isPending || unassign.isPending}
                          />
                        </TableCell>
                      );
                    })}
                  </TableRow>
                );
              })}
              {assignableUsers.length === 0 && (
                <TableRow>
                  <TableCell colSpan={(campanas?.length || 0) + 2} className="text-center py-8 text-muted-foreground">
                    No hay agentes ni supervisores registrados
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Separator />

      {/* Section 2: Case Reassignment */}
      <Card className="border-0 shadow-sm">
        <CardHeader>
          <CardTitle className="text-base">Reasignación de Casos</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div>
              <Label className="text-xs">Campaña</Label>
              <Select value={filterCampana} onValueChange={setFilterCampana}>
                <SelectTrigger className="h-8"><SelectValue placeholder="Todas" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  {campanas?.map(c => <SelectItem key={c.id} value={c.id}>{c.nombre}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
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
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Campaña</TableHead>
                <TableHead>Agente</TableHead>
                <TableHead>Estado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredCases.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">No hay casos</TableCell></TableRow>
              ) : filteredCases.slice(0, 50).map((caso: any) => (
                <TableRow key={caso.id}>
                  <TableCell className="font-medium">#{caso.id}</TableCell>
                  <TableCell>{caso.clientes?.nombre_contacto || "-"}</TableCell>
                  <TableCell>
                    <Select
                      value={caso.campana_id || ""}
                      onValueChange={v => handleCaseReassign(caso.id, "campana_id", v)}
                    >
                      <SelectTrigger className="h-8 w-40"><SelectValue placeholder="Sin campaña" /></SelectTrigger>
                      <SelectContent>
                        {campanas?.map(c => <SelectItem key={c.id} value={c.id}>{c.nombre}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    <Select
                      value={caso.agente_id || ""}
                      onValueChange={v => handleCaseReassign(caso.id, "agente_id", v)}
                    >
                      <SelectTrigger className="h-8 w-40"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {agentes?.map(a => <SelectItem key={a.user_id} value={a.user_id}>{a.nombre}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    <span className="inline-block rounded-full bg-secondary px-2.5 py-0.5 text-xs font-medium text-secondary-foreground">
                      {caso.cat_estados?.nombre}
                    </span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
