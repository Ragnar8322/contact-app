import { useState, useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { fetchAllPages } from "@/lib/fetchAllPages";
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
      // Agentes de la campaña con su carga actual (una sola consulta; antes una por agente
      // y leyendo tablas que un supervisor no puede ver)
      const { data: candidatos, error: candErr } = await supabase.rpc("assignment_candidates", {
        p_campana_id: campanaActiva.id,
      });
      if (candErr) throw candErr;
      const agentList: AgentItem[] = (candidatos ?? []).map((a) => ({
        user_id: a.user_id, nombre: a.nombre, currentCount: a.abiertos,
      }));
      setAgents(agentList);
      setSelectedAgentIds(new Set(agentList.map((a) => a.user_id)));

      if (mode === "registrado" && !registradoEstadoId) {
        toast.error("No se encontró el estado 'Registrado'.");
        return;
      }
      const estadoIds = mode === "registrado" ? [registradoEstadoId!] : activeEstadoIds;

      // Todos los casos, paginados (la API corta en 1.000 filas)
      const casosData = await fetchAllPages<{ id: number; clientes: { nombre_contacto: string; razon_social: string | null } | null }>(
        (from, to) => supabase
          .from("casos")
          .select("id, clientes(nombre_contacto, razon_social)")
          .eq("campana_id", campanaActiva.id)
          .in("estado_id", estadoIds)
          .order("id", { ascending: false })
          .range(from, to)
      );
      const items: CasoItem[] = casosData.map((c) => ({
        id: c.id,
        nombreCliente: c.clientes?.razon_social || c.clientes?.nombre_contacto || `Caso #${c.id}`,
      }));
      setCasos(items);
      setSelectedCasoIds(new Set(items.map((c) => c.id)));
    } catch (err) {
      toast.error("Error al cargar datos", { description: (err as Error).message });
    } finally {
      setLoading(false);
    }
  }

  function toggleCaso(id: number) {
    setSelectedCasoIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
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
      if (next.has(id)) next.delete(id);
      else next.add(id);
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
    if (!campanaActiva?.id) return;
    if (selectedCasoIds.size === 0) { toast.warning("Selecciona al menos un caso."); return; }
    if (selectedAgentIds.size === 0) { toast.warning("Selecciona al menos un agente."); return; }

    setSubmitting(true);
    try {
      // Reparto, actualización e historial en una sola transacción (assign_cases):
      // cada caso va al agente con menos casos abiertos; si alguno falla, no se guarda nada.
      const casoIds = casos.filter((c) => selectedCasoIds.has(c.id)).map((c) => c.id);
      const { data, error } = await supabase.rpc("assign_cases", {
        p_campana_id: campanaActiva.id,
        p_caso_ids: casoIds,
        p_agente_ids: [...selectedAgentIds],
      });
      if (error) throw error;
      const r = data as { asignados: number; por_agente: { nombre: string; asignados: number }[] };
      toast.success(`${r.asignados} casos asignados entre ${r.por_agente.length} agentes`, {
        description: r.por_agente.map((a) => `${a.nombre}: ${a.asignados}`).join(" · "),
      });
      qc.invalidateQueries({ queryKey: ["casos"] });
      qc.invalidateQueries({ queryKey: ["casos-counts"] });
      onOpenChange(false);
    } catch (err) {
      toast.error("No se pudo asignar", { description: (err as Error).message });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" aria-hidden="true" />
            Asignar Casos
          </DialogTitle>
          <DialogDescription>Distribuye casos entre los agentes de la campaña.</DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          {/* Modo */}
          <div className="space-y-1.5">
            <Label htmlFor="proportional-assign-modal-que-casos-asignar" className="text-xs text-muted-foreground uppercase tracking-wide">¿Qué casos asignar?</Label>
            <Select value={mode} onValueChange={(v) => setMode(v as AssignMode)}>
              <SelectTrigger id="proportional-assign-modal-que-casos-asignar" className="w-full">
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
                  <Label id="assign-casos-label" className="text-xs text-muted-foreground uppercase tracking-wide">Casos a asignar</Label>
                  <Badge variant={selectedCasoIds.size > 0 ? "default" : "secondary"} className="text-xs">
                    {selectedCasoIds.size} / {casos.length}
                  </Badge>
                </div>
                <button
                  type="button"
                  id="assign-casos-trigger"
                  aria-labelledby="assign-casos-label assign-casos-trigger"
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
                  <Label id="assign-agentes-label" className="text-xs text-muted-foreground uppercase tracking-wide">Agentes</Label>
                  <Badge variant={selectedAgentIds.size > 0 ? "default" : "secondary"} className="text-xs">
                    {selectedAgentIds.size} / {agents.length}
                  </Badge>
                </div>
                <button
                  type="button"
                  id="assign-agentes-trigger"
                  aria-labelledby="assign-agentes-label assign-agentes-trigger"
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
