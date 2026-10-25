import { useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { useAgentes, useInsertHistorial, useTiposServicio, useUpdateCase, type Caso } from "@/hooks/useCases";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { errorMessage } from "@/lib/errors";

/** Reasignación de agente y tipo de servicio. Solo para administradores (antes vivía en Administración → Casos). */
export function CaseAssignment({ caso }: { caso: Caso }) {
  const { user } = useAuth();
  const { data: agentes = [] } = useAgentes();
  const { data: tipos = [] } = useTiposServicio();
  const updateCase = useUpdateCase();
  const insertHistorial = useInsertHistorial();

  const [agenteId, setAgenteId] = useState(caso.agente_id);
  const [tipoId, setTipoId] = useState(caso.tipo_servicio_id);
  const cambio = agenteId !== caso.agente_id || tipoId !== caso.tipo_servicio_id;

  const guardar = async () => {
    if (!user || !cambio) return;
    const cambios = [
      agenteId !== caso.agente_id && `agente: ${agentes.find((a) => a.user_id === agenteId)?.nombre ?? agenteId}`,
      tipoId !== caso.tipo_servicio_id && `tipo de servicio: ${tipos.find((t) => t.id === tipoId)?.nombre ?? tipoId}`,
    ].filter(Boolean).join("; ");
    try {
      await updateCase.mutateAsync({ id: caso.id, agente_id: agenteId, tipo_servicio_id: tipoId, updated_by: user.id });
      await insertHistorial.mutateAsync({
        caso_id: caso.id,
        estado_id: caso.estado_id,
        cambiado_por: user.id,
        comentario: `Reasignado por administrador (${cambios})`,
      });
      toast.success("Asignación actualizada");
    } catch (err) {
      toast.error("No se pudo reasignar: " + errorMessage(err));
    }
  };

  return (
    <div className="space-y-3 rounded-lg border p-3">
      <p className="text-sm font-medium">Asignación <span className="text-xs font-normal text-muted-foreground">(administrador)</span></p>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="caso-asignacion-agente">Agente</Label>
          <Select value={agenteId} onValueChange={setAgenteId}>
            <SelectTrigger id="caso-asignacion-agente"><SelectValue /></SelectTrigger>
            <SelectContent>
              {agentes.map((a) => <SelectItem key={a.user_id} value={a.user_id}>{a.nombre}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="caso-asignacion-tipo">Tipo de servicio</Label>
          <Select value={String(tipoId)} onValueChange={(v) => setTipoId(Number(v))}>
            <SelectTrigger id="caso-asignacion-tipo"><SelectValue /></SelectTrigger>
            <SelectContent>
              {tipos.map((t) => <SelectItem key={t.id} value={String(t.id)}>{t.nombre}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>
      <Button variant="outline" size="sm" onClick={guardar} disabled={!cambio || updateCase.isPending}>
        {updateCase.isPending ? "Guardando..." : "Guardar asignación"}
      </Button>
    </div>
  );
}
