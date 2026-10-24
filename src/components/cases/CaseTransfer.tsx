import { useState } from "react";
import { useCampanasList } from "@/hooks/useCampanas";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Separator } from "@/components/ui/separator";
import { ArrowRightLeft } from "lucide-react";
import { toast } from "sonner";
import { errorMessage } from "@/lib/errors";

interface CaseTransferProps {
  caso: { id: number; campana_id: string | null; cat_estados: { nombre: string; es_final: boolean } | null };
  onTransferred: () => void;
}

export default function CaseTransfer({ caso, onTransferred }: CaseTransferProps) {
  const { data: campanas } = useCampanasList();
  const qc = useQueryClient();

  const [targetCampanaId, setTargetCampanaId] = useState<string>("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [transferring, setTransferring] = useState(false);

  const isClosed = caso.cat_estados?.es_final === true;
  const isTransferred = caso.cat_estados?.nombre === "Transferido";
  const isDisabled = isClosed || isTransferred;

  const currentCampanaId = caso.campana_id;
  const currentCampana = campanas?.find((c) => c.id === currentCampanaId);
  const targetCampana = campanas?.find((c) => c.id === targetCampanaId);
  const otherCampanas = campanas?.filter((c) => c.id !== currentCampanaId) || [];

  // Toda la transferencia ocurre en la base en una sola transacción (transfer_case):
  // cierra el caso, crea el nuevo en la campaña destino asignado al supervisor
  // con menos casos abiertos, enlaza ambos y registra el historial.
  const handleTransfer = async () => {
    if (!targetCampanaId || !caso.id) return;
    setTransferring(true);
    try {
      const { data, error } = await supabase.rpc("transfer_case", {
        p_caso_id: caso.id,
        p_campana_destino: targetCampanaId,
      });
      if (error) throw error;
      const r = data as { nuevo_caso_id: number; supervisor_nombre: string; campana_destino: string };
      toast.success(`Caso transferido a ${r.campana_destino}`, {
        description: `Nuevo caso #${r.nuevo_caso_id}, asignado a ${r.supervisor_nombre}.`,
      });
      qc.invalidateQueries({ queryKey: ["casos"] });
      qc.invalidateQueries({ queryKey: ["casos-counts"] });
      qc.invalidateQueries({ queryKey: ["historial"] });
      setConfirmOpen(false);
      onTransferred();
    } catch (err) {
      toast.error("No se pudo transferir", { description: errorMessage(err) });
    } finally {
      setTransferring(false);
    }
  };

  const disabledMessage = isTransferred
    ? "Este caso ya fue transferido."
    : "No se pueden transferir casos cerrados.";

  return (
    <>
      <Separator className="mt-4" />
      <div className="space-y-3">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <ArrowRightLeft className="h-4 w-4" />
          Transferir caso
        </h3>
        <p className="text-xs text-muted-foreground">
          Campaña actual: <span className="font-medium">{currentCampana?.nombre || "Sin campaña"}</span>
        </p>
        <div className="flex gap-2">
          <Select
            value={targetCampanaId}
            onValueChange={setTargetCampanaId}
            disabled={isDisabled}
          >
            <SelectTrigger className="flex-1">
              <SelectValue placeholder="Seleccionar campaña destino" />
            </SelectTrigger>
            <SelectContent>
              {otherCampanas.map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.nombre}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {isDisabled ? (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span>
                    <Button variant="secondary" disabled>
                      Transferir
                    </Button>
                  </span>
                </TooltipTrigger>
                <TooltipContent>
                  {disabledMessage}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          ) : (
            <Button
              variant="secondary"
              disabled={!targetCampanaId}
              onClick={() => setConfirmOpen(true)}
            >
              Transferir
            </Button>
          )}
        </div>
      </div>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar transferencia</AlertDialogTitle>
            <AlertDialogDescription>
              ¿Confirmas que deseas transferir el Caso #{caso.id} de <strong>{currentCampana?.nombre}</strong> a <strong>{targetCampana?.nombre}</strong>? Se creará un caso nuevo en la campaña destino, asignado a su supervisor.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={transferring}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleTransfer} disabled={transferring}>
              {transferring ? "Transfiriendo..." : "Confirmar transferencia"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
