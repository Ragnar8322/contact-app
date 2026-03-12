import { useState, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useCampana } from "@/contexts/CampanaContext";
import { useEstados, useAgentes } from "@/hooks/useCases";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Loader2, Users, TrendingUp } from "lucide-react";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type AssignMode = "sin_agente" | "todos_activos";

interface AgentWithCount {
  user_id: string;
  nombre: string;
  currentCount: number;
  projected: number;
}

export default function ProportionalAssignModal({ open, onOpenChange }: Props) {
  const { user } = useAuth();
  const { campanaActiva } = useCampana();
  const { data: estados } = useEstados();
  const { data: agentesData } = useAgentes();
  const qc = useQueryClient();

  const [mode, setMode] = useState<AssignMode>("sin_agente");
  const [selectedAgentId, setSelectedAgentId] = useState<string>("all");
  const [agentsWithCounts, setAgentsWithCounts] = useState<AgentWithCount[]>([]);
  const [casesToAssignCount, setCasesToAssignCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const activeEstadoIds = estados
    ?.filter((e: any) => !e.es_final && e.nombre !== "Transferido")
    .map((e: any) => e.id) ?? [];

  useEffect(() => {
    if (!open || !campanaActiva?.id || !agentesData || activeEstadoIds.length === 0) return;
    loadData();
  }, [open, campanaActiva?.id, agentesData, mode, estados]);

  async function loadData() {
    if (!campanaActiva?.id || !agentesData) return;
    setLoading(true);
    try {
      const counts = await Promise.all(
        agentesData.map(async (agent: any) => {
          const { count } = await supabase
            .from("casos")
            .select("id", { count: "exact", head: true })
            .eq("campana_id", campanaActiva.id)
            .eq("agente_id", agent.user_id)
            .in("estado_id", activeEstadoIds);
          return { user_id: agent.user_id, nombre: agent.nombre, currentCount: count ?? 0, projected: 0 };
        })
      );

      let casesQuery = supabase
        .from("casos")
        .select("id", { count: "exact", head: true })
        .eq("campana_id", campanaActiva.id)
        .in("estado_id", activeEstadoIds);

      if (mode === "sin_agente") {
        casesQuery = casesQuery.is("agente_id", null);
      }

      const { count: casesCount } = await casesQuery;
      const toAssign = casesCount ?? 0;
      setCasesToAssignCount(toAssign);

      if (counts.length > 0 && toAssign > 0) {
        if (mode === "todos_activos") {
          const totalActive = counts.reduce((s, a) => s + a.currentCount, 0);
          const base = Math.floor(totalActive / counts.length);
          const remainder = totalActive % counts.length;
          counts.sort((a, b) => a.currentCount - b.currentCount);
          counts.forEach((a, i) => { a.projected = base + (i < remainder ? 1 : 0); });
        } else {
          counts.sort((a, b) => a.currentCount - b.currentCount);
          const projected = counts.map(a => ({ ...a, projected: a.currentCount }));
          for (let i = 0; i < toAssign; i++) {
            let minIdx = 0;
            for (let j = 1; j < projected.length; j++) {
              if (projected[j].projected < projected[minIdx].projected) minIdx = j;
            }
            projected[minIdx].projected++;
          }
          projected.forEach((p, i) => { counts[i].projected = p.projected; });
        }
      } else {
        counts.forEach(a => { a.projected = a.currentCount; });
      }

      setAgentsWithCounts(counts);
    } finally {
      setLoading(false);
    }
  }

  // Agente seleccionado actualmente en el dropdown (para previsualizar)
  const selectedAgent = selectedAgentId === "all"
    ? null
    : agentsWithCounts.find(a => a.user_id === selectedAgentId);

  async function handleConfirm() {
    if (!campanaActiva?.id || !user || agentsWithCounts.length === 0) return;
    setSubmitting(true);
    try {
      let casesQuery = supabase
        .from("casos")
        .select("id, estado_id")
        .eq("campana_id", campanaActiva.id)
        .in("estado_id", activeEstadoIds);

      if (mode === "sin_agente") {
        casesQuery = casesQuery.is("agente_id", null);
      }

      const { data: casesToAssign, error: fetchErr } = await casesQuery;
      if (fetchErr) throw fetchErr;
      if (!casesToAssign || casesToAssign.length === 0) {
        toast.info("No hay casos para asignar.");
        onOpenChange(false);
        return;
      }

      const sorted = [...agentsWithCounts].sort((a, b) => a.currentCount - b.currentCount);

      const updates = casesToAssign.map((caso, index) => ({
        id: caso.id,
        agente_id: sorted[index % sorted.length].user_id,
        updated_by: user.id,
      }));

      const chunkSize = 50;
      for (let i = 0; i < updates.length; i += chunkSize) {
        const chunk = updates.slice(i, i + chunkSize);
        for (const u of chunk) {
          const { error } = await supabase
            .from("casos")
            .update({ agente_id: u.agente_id, updated_by: u.updated_by })
            .eq("id", u.id);
          if (error) throw error;
        }
      }

      const historialEntries = updates.map((u) => {
        const caso = casesToAssign.find(c => c.id === u.id);
        const agente = sorted.find(a => a.user_id === u.agente_id);
        return {
          caso_id: u.id,
          estado_id: caso?.estado_id ?? activeEstadoIds[0],
          cambiado_por: user.id,
          agente_id: u.agente_id,
          agente_nombre: agente?.nombre ?? "",
          observacion: "Asignación proporcional automática",
        };
      });

      for (let i = 0; i < historialEntries.length; i += chunkSize) {
        const chunk = historialEntries.slice(i, i + chunkSize);
        const { error } = await supabase.from("caso_historial").insert(chunk);
        if (error) throw error;
      }

      toast.success(`${updates.length} casos asignados proporcionalmente entre ${sorted.length} agentes`);
      qc.invalidateQueries({ queryKey: ["casos"] });
      qc.invalidateQueries({ queryKey: ["casos-counts"] });
      onOpenChange(false);
    } catch (err: any) {
      toast.error("Error: " + err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5 text-indigo-600" />
            Asignar Casos
          </DialogTitle>
          <DialogDescription>
            Redistribuye casos activos proporcionalmente entre los agentes.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Modo de asignación */}
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground uppercase tracking-wide">¿Qué casos asignar?</Label>
            <Select value={mode} onValueChange={(v) => setMode(v as AssignMode)}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="sin_agente">Solo casos sin agente asignado</SelectItem>
                <SelectItem value="todos_activos">Todos los casos activos (redistribuir todo)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : (
            <>
              {/* Resumen general */}
              <div className="rounded-lg border bg-muted/40 px-4 py-3 flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Casos a reasignar</span>
                <Badge variant={casesToAssignCount > 0 ? "default" : "secondary"} className="text-sm font-bold px-3">
                  {casesToAssignCount}
                </Badge>
              </div>

              {/* Dropdown de agentes con preview */}
              {agentsWithCounts.length > 0 && (
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground uppercase tracking-wide">Ver distribución por agente</Label>
                  <Select value={selectedAgentId} onValueChange={setSelectedAgentId}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Seleccionar agente..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">
                        <span className="flex items-center gap-2">
                          <TrendingUp className="h-3.5 w-3.5 text-muted-foreground" />
                          Todos los agentes ({agentsWithCounts.length})
                        </span>
                      </SelectItem>
                      {agentsWithCounts.map((a) => (
                        <SelectItem key={a.user_id} value={a.user_id}>
                          {a.nombre}
                          <span className="ml-2 text-muted-foreground text-xs">
                            {a.currentCount} → {a.projected}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  {/* Preview card */}
                  {selectedAgent ? (
                    <div className="rounded-lg border bg-card p-3 space-y-2">
                      <p className="text-sm font-medium">{selectedAgent.nombre}</p>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="rounded-md bg-muted/60 px-3 py-2 text-center">
                          <p className="text-xs text-muted-foreground">Casos actuales</p>
                          <p className="text-xl font-bold">{selectedAgent.currentCount}</p>
                        </div>
                        <div className="rounded-md bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800 px-3 py-2 text-center">
                          <p className="text-xs text-indigo-600 dark:text-indigo-400">Después</p>
                          <p className="text-xl font-bold text-indigo-600 dark:text-indigo-400">{selectedAgent.projected}</p>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-lg border bg-card px-3 py-2">
                      <div className="grid grid-cols-3 gap-2 text-center">
                        <div>
                          <p className="text-xs text-muted-foreground">Agentes</p>
                          <p className="font-bold">{agentsWithCounts.length}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Min casos</p>
                          <p className="font-bold">{Math.min(...agentsWithCounts.map(a => a.projected))}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Max casos</p>
                          <p className="font-bold">{Math.max(...agentsWithCounts.map(a => a.projected))}</p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {agentsWithCounts.length === 0 && (
                <p className="text-sm text-center text-muted-foreground py-2">No hay agentes activos</p>
              )}
            </>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button
            onClick={handleConfirm}
            disabled={submitting || loading || casesToAssignCount === 0 || agentsWithCounts.length === 0}
            className="bg-indigo-600 hover:bg-indigo-700 text-white"
          >
            {submitting ? (
              <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Asignando...</>
            ) : (
              "Confirmar Asignación"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
