import { useState, useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useCampana } from "@/contexts/CampanaContext";
import { useEstados } from "@/hooks/useCases";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, Users, ChevronDown } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type AssignMode = "registrado" | "todos_activos";

interface CasoItem {
  id: number;
  nombreCliente: string;
}

interface AgentItem {
  user_id: string;
  nombre: string;
  currentCount: number;
}

export default function ProportionalAssignModal({ open, onOpenChange }: Props) {
  const { user } = useAuth();
  const { campanaActiva } = useCampana();
  const { data: estados } = useEstados();
  const qc = useQueryClient();

  const [mode, setMode] = useState<AssignMode>("registrado");

  // Casos
  const [casos, setCasos] = useState<CasoItem[]>([]);
  const [selectedCasoIds, setSelectedCasoIds] = useState<Set<number>>(new Set());
  const [casosOpen, setCasosOpen] = useState(false);
  const casosRef = useRef<HTMLDivElement>(null);

  // Agentes
  const [agents, setAgents] = useState<AgentItem[]>([]);
  const [selectedAgentIds, setSelectedAgentIds] = useState<Set<string>>(new Set());
  const [agentsOpen, setAgentsOpen] = useState(false);
  const agentsRef = useRef<HTMLDivElement>(null);

  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const activeEstadoIds = estados
    ?.filter((e: any) => !e.es_final && e.nombre !== "Transferido")
    .map((e: any) => e.id) ?? [];
  const registradoEstadoId = estados?.find((e: any) => e.nombre === "Registrado")?.id ?? null;

  // Cerrar dropdowns al hacer click fuera
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (casosRef.current && !casosRef.current.contains(e.target as Node)) setCasosOpen(false);
      if (agentsRef.current && !agentsRef.current.contains(e.target as Node)) setAgentsOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (!open || !campanaActiva?.id || !estados || estados.length === 0) return;
    loadData();
  }, [open, campanaActiva?.id, mode, estados]);

  // Reset selecciones al cambiar modo
  useEffect(() => {
    setSelectedCasoIds(new Set());
    setSelectedAgentIds(new Set());
  }, [mode]);

  async function loadData() {
    if (!campanaActiva?.id || !estados || estados.length === 0) return;
    setLoading(true);
    try {
      // ─ 1. Rol agent ID
      const { data: roleRow, error: roleErr } = await supabase
        .from("user_roles").select("id").eq("name", "agent").single();
      if (roleErr || !roleRow) throw new Error("No se encontró el rol 'agent'.");

      // ─ 2. user_ids con rol agent
      const { data: assignments, error: assignErr } = await supabase
        .from("user_role_assignments").select("user_id").eq("role_id", roleRow.id);
      if (assignErr) throw assignErr;
      const agentUserIds = (assignments ?? []).map((r: any) => r.user_id);

      if (agentUserIds.length === 0) {
        setAgents([]);
        setCasos([]);
        return;
      }

      // ─ 3. Nombres desde profiles
      const { data: profiles, error: profErr } = await supabase
        .from("profiles").select("user_id, nombre").in("user_id", agentUserIds);
      if (profErr) throw profErr;

      // ─ 4. Contar casos activos por agente
      const agentList: AgentItem[] = await Promise.all(
        (profiles ?? []).map(async (agent: any) => {
          const { count } = await supabase
            .from("casos")
            .select("id", { count: "exact", head: true })
            .eq("campana_id", campanaActiva.id)
            .eq("agente_id", agent.user_id)
            .in("estado_id", activeEstadoIds);
          return { user_id: agent.user_id, nombre: agent.nombre, currentCount: count ?? 0 };
        })
      );
      setAgents(agentList.sort((a, b) => a.nombre.localeCompare(b.nombre)));
      // Preseleccionar todos los agentes
      setSelectedAgentIds(new Set(agentList.map(a => a.user_id)));

      // ─ 5. Casos a listar según modo
      if (mode === "registrado") {
        if (!registradoEstadoId) { toast.error("No se encontró el estado 'Registrado'."); return; }
        const { data: casosData, error: casosErr } = await supabase
          .from("casos")
          .select("id, clientes(nombre_contacto, razon_social)")
          .eq("campana_id", campanaActiva.id)
          .eq("estado_id", registradoEstadoId)
          .order("id", { ascending: false });
        if (casosErr) throw casosErr;
        const items: CasoItem[] = (casosData ?? []).map((c: any) => ({
          id: c.id,
          nombreCliente: c.clientes?.razon_social || c.clientes?.nombre_contacto || `Caso #${c.id}`,
        }));
        setCasos(items);
        // Preseleccionar todos los casos
        setSelectedCasoIds(new Set(items.map(c => c.id)));
      } else {
        const { data: casosData, error: casosErr } = await supabase
          .from("casos")
          .select("id, clientes(nombre_contacto, razon_social)")
          .eq("campana_id", campanaActiva.id)
          .in("estado_id", activeEstadoIds)
          .order("id", { ascending: false });
        if (casosErr) throw casosErr;
        const items: CasoItem[] = (casosData ?? []).map((c: any) => ({
          id: c.id,
          nombreCliente: c.clientes?.razon_social || c.clientes?.nombre_contacto || `Caso #${c.id}`,
        }));
        setCasos(items);
        setSelectedCasoIds(new Set(items.map(c => c.id)));
      }
    } catch (err: any) {
      toast.error("Error al cargar datos: " + err.message);
    } finally {
      setLoading(false);
    }
  }

  function toggleCaso(id: number) {
    setSelectedCasoIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function toggleAllCasos() {
    if (selectedCasoIds.size === casos.length) setSelectedCasoIds(new Set());
    else setSelectedCasoIds(new Set(casos.map(c => c.id)));
  }

  function toggleAgent(id: string) {
    setSelectedAgentIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function toggleAllAgents() {
    if (selectedAgentIds.size === agents.length) setSelectedAgentIds(new Set());
    else setSelectedAgentIds(new Set(agents.map(a => a.user_id)));
  }

  const casosLabel = selectedCasoIds.size === 0
    ? "Seleccionar casos..."
    : selectedCasoIds.size === casos.length
      ? `Todos los casos (${casos.length})`
      : `${selectedCasoIds.size} caso${selectedCasoIds.size > 1 ? "s" : ""} seleccionado${selectedCasoIds.size > 1 ? "s" : ""}`;

  const agentsLabel = selectedAgentIds.size === 0
    ? "Seleccionar agentes..."
    : selectedAgentIds.size === agents.length
      ? `Todos los agentes (${agents.length})`
      : `${selectedAgentIds.size} agente${selectedAgentIds.size > 1 ? "s" : ""} seleccionado${selectedAgentIds.size > 1 ? "s" : ""}`;

  async function handleConfirm() {
    if (!campanaActiva?.id || !user) return;
    if (selectedCasoIds.size === 0) { toast.warning("Selecciona al menos un caso."); return; }
    if (selectedAgentIds.size === 0) { toast.warning("Selecciona al menos un agente."); return; }

    setSubmitting(true);
    try {
      const casosToAssign = casos.filter(c => selectedCasoIds.has(c.id));
      const agentPool = agents
        .filter(a => selectedAgentIds.has(a.user_id))
        .sort((a, b) => a.currentCount - b.currentCount);

      // Distribución proporcional: asignar en round-robin ponderado
      const updates = casosToAssign.map((caso, index) => ({
        id: caso.id,
        agente_id: agentPool[index % agentPool.length].user_id,
      }));

      const chunkSize = 50;
      for (let i = 0; i < updates.length; i += chunkSize) {
        for (const u of updates.slice(i, i + chunkSize)) {
          const { error } = await supabase
            .from("casos")
            .update({ agente_id: u.agente_id, updated_by: user.id })
            .eq("id", u.id);
          if (error) throw error;
        }
      }

      // Obtener estado_id de cada caso para el historial
      const { data: casosDetalle } = await supabase
        .from("casos").select("id, estado_id").in("id", updates.map(u => u.id));

      const historialEntries = updates.map((u) => {
        const caso = casosDetalle?.find(c => c.id === u.id);
        const agente = agentPool.find(a => a.user_id === u.agente_id);
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
        const { error } = await supabase.from("caso_historial").insert(historialEntries.slice(i, i + chunkSize));
        if (error) throw error;
      }

      toast.success(`${updates.length} casos asignados entre ${agentPool.length} agentes`);
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
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5 text-indigo-600" />
            Asignar Casos
          </DialogTitle>
          <DialogDescription>Distribuye casos entre los agentes de la campaña.</DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          {/* Modo */}
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground uppercase tracking-wide">¿Qué casos asignar?</Label>
            <Select value={mode} onValueChange={(v) => setMode(v as AssignMode)}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="registrado">Casos en estado "Registrado"</SelectItem>
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
              {/* ── DROPDOWN CASOS ────────────────────────────────── */}
              <div className="space-y-1.5" ref={casosRef}>
                <div className="flex items-center justify-between">
                  <Label className="text-xs text-muted-foreground uppercase tracking-wide">Casos a asignar</Label>
                  <Badge variant={selectedCasoIds.size > 0 ? "default" : "secondary"} className="text-xs">
                    {selectedCasoIds.size} / {casos.length}
                  </Badge>
                </div>
                <button
                  type="button"
                  onClick={() => setCasosOpen(o => !o)}
                  className="w-full flex items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm hover:bg-accent transition-colors"
                >
                  <span className={cn(selectedCasoIds.size === 0 && "text-muted-foreground")}>{casosLabel}</span>
                  <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform", casosOpen && "rotate-180")} />
                </button>
                {casosOpen && (
                  <div className="rounded-md border border-input bg-popover shadow-md max-h-52 overflow-y-auto z-50">
                    {/* Seleccionar todos */}
                    <label className="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-accent border-b border-border text-sm font-medium">
                      <Checkbox
                        checked={selectedCasoIds.size === casos.length && casos.length > 0}
                        onCheckedChange={toggleAllCasos}
                      />
                      <span>Seleccionar todos ({casos.length})</span>
                    </label>
                    {casos.length === 0 && (
                      <p className="text-sm text-center text-muted-foreground py-4">No hay casos en estado Registrado</p>
                    )}
                    {casos.map(caso => (
                      <label key={caso.id} className="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-accent text-sm">
                        <Checkbox
                          checked={selectedCasoIds.has(caso.id)}
                          onCheckedChange={() => toggleCaso(caso.id)}
                        />
                        <span className="truncate">{caso.nombreCliente}</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>

              {/* ── DROPDOWN AGENTES ──────────────────────────────── */}
              <div className="space-y-1.5" ref={agentsRef}>
                <div className="flex items-center justify-between">
                  <Label className="text-xs text-muted-foreground uppercase tracking-wide">Agentes</Label>
                  <Badge variant={selectedAgentIds.size > 0 ? "default" : "secondary"} className="text-xs">
                    {selectedAgentIds.size} / {agents.length}
                  </Badge>
                </div>
                <button
                  type="button"
                  onClick={() => setAgentsOpen(o => !o)}
                  className="w-full flex items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm hover:bg-accent transition-colors"
                >
                  <span className={cn(selectedAgentIds.size === 0 && "text-muted-foreground")}>{agentsLabel}</span>
                  <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform", agentsOpen && "rotate-180")} />
                </button>
                {agentsOpen && (
                  <div className="rounded-md border border-input bg-popover shadow-md max-h-52 overflow-y-auto z-50">
                    {/* Seleccionar todos */}
                    <label className="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-accent border-b border-border text-sm font-medium">
                      <Checkbox
                        checked={selectedAgentIds.size === agents.length && agents.length > 0}
                        onCheckedChange={toggleAllAgents}
                      />
                      <span>Seleccionar todos ({agents.length})</span>
                    </label>
                    {agents.length === 0 && (
                      <p className="text-sm text-center text-muted-foreground py-4">No hay agentes con rol Agente</p>
                    )}
                    {agents.map(agent => (
                      <label key={agent.user_id} className="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-accent text-sm">
                        <Checkbox
                          checked={selectedAgentIds.has(agent.user_id)}
                          onCheckedChange={() => toggleAgent(agent.user_id)}
                        />
                        <span>{agent.nombre}</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        <DialogFooter className="gap-2 pt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button
            onClick={handleConfirm}
            disabled={submitting || loading || selectedCasoIds.size === 0 || selectedAgentIds.size === 0}
            className="bg-indigo-600 hover:bg-indigo-700 text-white"
          >
            {submitting
              ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Asignando...</>
              : `Confirmar Asignación (${selectedCasoIds.size} casos)`
            }
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
