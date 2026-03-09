import { useState, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useCampana } from "@/contexts/CampanaContext";
import { useEstados, useAgentes } from "@/hooks/useCases";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
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
      // Get agent counts
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

      // Get cases to assign count
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

      // Calculate projected distribution
      if (counts.length > 0 && toAssign > 0) {
        if (mode === "todos_activos") {
          // Full redistribution: total active / agents
          const totalActive = counts.reduce((s, a) => s + a.currentCount, 0);
          const totalToDistribute = totalActive;
          const base = Math.floor(totalToDistribute / counts.length);
          const remainder = totalToDistribute % counts.length;
          counts.sort((a, b) => a.currentCount - b.currentCount);
          counts.forEach((a, i) => {
            a.projected = base + (i < remainder ? 1 : 0);
          });
        } else {
          // Only unassigned: add proportionally to least loaded
          counts.sort((a, b) => a.currentCount - b.currentCount);
          const projected = counts.map(a => ({ ...a, projected: a.currentCount }));
          for (let i = 0; i < toAssign; i++) {
            // Find agent with least projected
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

  async function handleConfirm() {
    if (!campanaActiva?.id || !user || agentsWithCounts.length === 0) return;
    setSubmitting(true);
    try {
      // Fetch case IDs to reassign
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

      // Sort agents by current count ASC for round-robin
      const sorted = [...agentsWithCounts].sort((a, b) => a.currentCount - b.currentCount);

      // Build updates
      const updates = casesToAssign.map((caso, index) => ({
        id: caso.id,
        agente_id: sorted[index % sorted.length].user_id,
        updated_by: user.id,
      }));

      // Batch update in chunks of 50
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

      // Insert historial
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

      // Insert in chunks
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
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Asignación Proporcional</DialogTitle>
          <DialogDescription>
            Redistribuye casos activos proporcionalmente entre los agentes disponibles.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>¿Qué casos reasignar?</Label>
            <Select value={mode} onValueChange={(v) => setMode(v as AssignMode)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="sin_agente">Solo casos sin agente asignado</SelectItem>
                <SelectItem value="todos_activos">Todos los casos activos (redistribuir todo)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">
                Casos a reasignar: <strong>{casesToAssignCount}</strong>
              </p>

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Agente</TableHead>
                    <TableHead className="text-right">Actual</TableHead>
                    <TableHead className="text-right">Después</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {agentsWithCounts.map((a) => (
                    <TableRow key={a.user_id}>
                      <TableCell className="font-medium">{a.nombre}</TableCell>
                      <TableCell className="text-right">{a.currentCount}</TableCell>
                      <TableCell className="text-right font-semibold">{a.projected}</TableCell>
                    </TableRow>
                  ))}
                  {agentsWithCounts.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={3} className="text-center text-muted-foreground py-4">
                        No hay agentes activos
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button
            onClick={handleConfirm}
            disabled={submitting || loading || casesToAssignCount === 0 || agentsWithCounts.length === 0}
          >
            {submitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Asignando...
              </>
            ) : (
              "Confirmar Asignación"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
