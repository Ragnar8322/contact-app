import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useCampanasList } from "@/hooks/useCampanas";
import { useInsertHistorial, useEstados } from "@/hooks/useCases";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Separator } from "@/components/ui/separator";
import { ArrowRightLeft } from "lucide-react";
import { toast } from "sonner";

interface CaseTransferProps {
  caso: any;
  onTransferred: () => void;
}

export default function CaseTransfer({ caso, onTransferred }: CaseTransferProps) {
  const { user, profile } = useAuth();
  const { data: campanas } = useCampanasList();
  const { data: estados } = useEstados();
  const insertHistorial = useInsertHistorial();
  const qc = useQueryClient();

  const [targetCampanaId, setTargetCampanaId] = useState<string>("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [transferring, setTransferring] = useState(false);

  const isClosed = caso.cat_estados?.es_final === true;
  const isTransferred = caso.cat_estados?.nombre === "Transferido";
  const isDisabled = isClosed || isTransferred;

  const currentCampanaId = caso.campana_id;
  const currentCampana = campanas?.find((c: any) => c.id === currentCampanaId);
  const targetCampana = campanas?.find((c: any) => c.id === targetCampanaId);
  const otherCampanas = campanas?.filter((c: any) => c.id !== currentCampanaId) || [];

  // Find the "Transferido" estado
  const transferidoEstado = estados?.find((e: any) => e.nombre === "Transferido");

  const handleTransfer = async () => {
    if (!user || !targetCampanaId || !caso.id) return;
    setTransferring(true);
    try {
      // Get first admin user_id as fallback agente
      const { data: adminProfile } = await supabase
        .from("profiles")
        .select("user_id")
        .eq("role_id", 1)
        .limit(1)
        .single();

      const newAgenteId = adminProfile?.user_id || user.id;

      // Mark current case as "Transferido"
      const transferidoId = transferidoEstado?.id;
      if (transferidoId) {
        await supabase
          .from("casos")
          .update({
            estado_id: transferidoId,
            fecha_cierre: new Date().toISOString(),
            observacion_cierre: `Transferido a campaña: ${targetCampana?.nombre || targetCampanaId}`,
            updated_by: user.id,
            updated_at: new Date().toISOString(),
          })
          .eq("id", caso.id);
      }

      // Create new case in target campaign
      const { data: newCase, error: createError } = await supabase
        .from("casos")
        .insert({
          cliente_id: caso.cliente_id,
          tipo_servicio_id: caso.tipo_servicio_id,
          descripcion_inicial: caso.descripcion_inicial,
          agente_id: newAgenteId,
          created_by: user.id,
          estado_id: caso.estado_id === transferidoId ? 7 : caso.estado_id, // Registrado as default
          campana_id: targetCampanaId,
        })
        .select("id")
        .single();

      if (createError) throw createError;

      // Update observacion_cierre with new case reference
      if (newCase) {
        await supabase
          .from("casos")
          .update({
            observacion_cierre: `Transferido a campaña: ${targetCampana?.nombre}. Nuevo caso #${newCase.id}`,
          })
          .eq("id", caso.id);
      }

      const comentario = `Caso transferido de ${currentCampana?.nombre || "campaña anterior"} a ${targetCampana?.nombre || "nueva campaña"} por ${profile?.nombre || "usuario"}. Nuevo caso #${newCase?.id || ""}`;

      await insertHistorial.mutateAsync({
        caso_id: caso.id,
        estado_id: transferidoId || caso.estado_id,
        cambiado_por: user.id,
        comentario,
      });

      toast.success(`Caso transferido correctamente a ${targetCampana?.nombre}. Nuevo caso #${newCase?.id}`);
      qc.invalidateQueries({ queryKey: ["casos"] });
      qc.invalidateQueries({ queryKey: ["historial"] });
      setConfirmOpen(false);
      onTransferred();
    } catch (err: any) {
      toast.error("Error al transferir: " + err.message);
    } finally {
      setTransferring(false);
    }
  };

  const disabledMessage = isTransferred
    ? "Este caso ya fue transferido."
    : "No se pueden transferir casos cerrados.";

  return (
    <>
      <Separator />
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
              {otherCampanas.map((c: any) => (
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
              ¿Confirmas que deseas transferir el Caso #{caso.id} de <strong>{currentCampana?.nombre}</strong> a <strong>{targetCampana?.nombre}</strong>? El caso será visible para los agentes de la campaña destino.
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
