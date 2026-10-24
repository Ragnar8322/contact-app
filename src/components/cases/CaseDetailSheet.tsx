import { useState } from "react";
import { ArrowRightLeft, Lock, Mail, Phone } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { useCaseHistory, useInsertHistorial, useUpdateCase, type Caso, type Estado } from "@/hooks/useCases";
import { useCampanasList } from "@/hooks/useCampanas";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { EstadoBadge } from "@/components/cases/EstadoBadge";
import CaseTransfer from "@/components/cases/CaseTransfer";
import { formatCOP, formatCOPInput, parseCOPInput } from "@/lib/currency";
import { safeFormat } from "@/lib/date";
import { errorMessage } from "@/lib/errors";

interface Props {
  caso: Caso | undefined;
  open: boolean;
  /** El caso pedido no existe o el usuario no tiene acceso (por ejemplo, el destino de una transferencia) */
  noDisponible?: boolean;
  onClose: () => void;
  /** Abre otro caso (enlace al caso destino de una transferencia) */
  onOpenCase: (id: number) => void;
  estados: Estado[];
}

export function CaseDetailSheet({ caso, open, noDisponible, onClose, onOpenCase, estados }: Props) {
  return (
    <Sheet open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <SheetContent className="w-full sm:max-w-lg overflow-auto">
        <SheetHeader>
          <SheetTitle>{caso ? `Caso #${caso.id}` : "Caso"}</SheetTitle>
          <SheetDescription className="sr-only">Datos del cliente, gestión e historial del caso</SheetDescription>
        </SheetHeader>
        {!caso && noDisponible && (
          <Alert className="mt-4">
            <Lock className="h-4 w-4" aria-hidden="true" />
            <AlertDescription>
              No tienes acceso a este caso. Si lo transferiste, quedó asignado al supervisor de la campaña destino.
            </AlertDescription>
          </Alert>
        )}
        {/* key: al cambiar de caso, el formulario de gestión vuelve a su estado inicial */}
        {caso && <CaseDetail key={caso.id} caso={caso} estados={estados} onOpenCase={onOpenCase} onTransferred={onClose} />}
      </SheetContent>
    </Sheet>
  );
}

function ContactInfo({ cliente }: { cliente: Caso["clientes"] }) {
  const phones = [cliente?.telefono, cliente?.celular].filter((p): p is string => !!p);
  return (
    <div className="text-sm space-y-1.5">
      <span className="font-medium text-foreground">Datos de Contacto</span>
      <div className="flex items-center gap-1.5">
        <Phone className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
        <span className="text-muted-foreground">Teléfonos:</span>
        {phones.length === 0 ? (
          <span className="text-muted-foreground italic">No registrado</span>
        ) : phones.map((p, i) => (
          <span key={`${i}-${p}`}>
            {i > 0 && <span className="text-muted-foreground">, </span>}
            <a href={`tel:${p}`} className="text-primary hover:underline">{p}</a>
          </span>
        ))}
      </div>
      <div className="flex items-center gap-1.5">
        <Mail className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
        <span className="text-muted-foreground">Correo:</span>
        {cliente?.correo ? (
          <a href={`mailto:${cliente.correo}`} className="text-primary hover:underline">{cliente.correo}</a>
        ) : (
          <span className="text-muted-foreground italic">No registrado</span>
        )}
      </div>
    </div>
  );
}

function CaseHistory({ casoId }: { casoId: number }) {
  const { data: history } = useCaseHistory(casoId);
  return (
    <div className="space-y-2">
      {history?.map((h) => {
        const estadoNombre = h.cat_estados?.nombre || h.estado_nuevo;
        const autor = h.agente_nombre || h.profiles?.nombre;
        return (
          <div key={h.id} className="rounded-lg bg-muted/50 p-3 text-sm">
            <div className="flex items-center justify-between">
              <EstadoBadge nombre={estadoNombre} />
              <span className="text-xs text-muted-foreground">
                {safeFormat(h.fecha_cambio || h.cambiado_en, "dd/MM/yyyy HH:mm")}
              </span>
            </div>
            {autor && <p className="text-xs text-muted-foreground mt-0.5">Por: {autor}</p>}
            {h.observacion && <p className="mt-1 text-muted-foreground">{h.observacion}</p>}
            {/* Al cambiar de estado se guarda el mismo texto como comentario y como observación */}
            {h.comentario && h.comentario !== h.observacion && <p className="mt-1 text-muted-foreground">{h.comentario}</p>}
          </div>
        );
      })}
      {(!history || history.length === 0) && (
        <p className="text-sm text-muted-foreground">Sin historial</p>
      )}
    </div>
  );
}

function CaseDetail({ caso, estados, onOpenCase, onTransferred }: {
  caso: Caso;
  estados: Estado[];
  onOpenCase: (id: number) => void;
  onTransferred: () => void;
}) {
  const { user, profile, isAdmin, isGerente } = useAuth();
  const updateCase = useUpdateCase();
  const insertHistorial = useInsertHistorial();

  const [editEstado, setEditEstado] = useState(caso.estado_id);
  const [originalEstado, setOriginalEstado] = useState(caso.estado_id);
  const [editObservaciones, setEditObservaciones] = useState("");
  const [obsError, setObsError] = useState("");
  const [editValorDisplay, setEditValorDisplay] = useState(caso.valor_pagar ? formatCOP(caso.valor_pagar) : "");
  const [valorError, setValorError] = useState("");
  const [detailObservacion, setDetailObservacion] = useState("");

  const { data: campanas = [] } = useCampanasList();
  const isTransferredCase = caso.cat_estados?.nombre === "Transferido";
  // El destino viene de las columnas transferido_a_* (antes se leía del texto de la observación).
  // Quien transfirió no puede leer el caso nuevo, así que la campaña sale de transferido_a_campana_id.
  const transferInfo = isTransferredCase && caso.transferido_a_caso_id
    ? {
        newCaseId: caso.transferido_a_caso_id,
        targetCampana: caso.caso_destino?.campanas?.nombre
          ?? campanas.find((c) => c.id === caso.transferido_a_campana_id)?.nombre
          ?? null,
      }
    : null;

  const estadoSeleccionado = estados.find((e) => e.id === editEstado);
  const estadoChanged = editEstado !== originalEstado;
  const isEnGestion = estadoSeleccionado?.nombre === "En gestión";
  const selectedEstadoFinal = estadoSeleccionado?.es_final;

  const isRenovacionWeb = caso.cat_tipo_servicio?.nombre?.toLowerCase() === "renovación web";
  const showValorPagar = isRenovacionWeb && (estadoSeleccionado?.nombre === "Renovado" || estadoSeleccionado?.nombre === "Pendiente de Pago");

  const isCaseClosed = caso.cat_estados?.es_final === true;
  const isReadOnly = isGerente || (isCaseClosed && !isAdmin);
  const isFullyLocked = isTransferredCase || isGerente;

  const validateObservaciones = (): boolean => {
    if (!estadoChanged) return true;
    if (isEnGestion) return true;
    if (!editObservaciones.trim()) {
      setObsError(isRenovacionWeb && selectedEstadoFinal ? "Las observaciones son obligatorias." : "Las observaciones de gestión son obligatorias para cambiar el estado.");
      return false;
    }
    if (selectedEstadoFinal && !isRenovacionWeb && editObservaciones.trim().length < 30) {
      setObsError("Para estados de cierre, las observaciones deben tener al menos 30 caracteres.");
      return false;
    }
    setObsError("");
    return true;
  };

  const handleUpdate = async () => {
    if (!user) return;
    const observationText = isEnGestion ? detailObservacion.trim() : editObservaciones.trim();
    const hasObservation = observationText.length > 0;

    if (!estadoChanged && !hasObservation) { toast.info("No hay cambios para guardar."); return; }
    if (estadoChanged && !validateObservaciones()) return;
    if (estadoChanged && !isEnGestion && !editObservaciones.trim()) return;
    if (showValorPagar) {
      const val = parseCOPInput(editValorDisplay);
      if (!val) { setValorError("El valor a pagar es obligatorio para este estado."); return; }
      setValorError("");
    }
    try {
      if (estadoChanged) {
        await updateCase.mutateAsync({
          id: caso.id,
          estado_id: editEstado,
          updated_by: user.id,
          ...(showValorPagar ? { valor_pagar: parseCOPInput(editValorDisplay) } : {}),
          ...(selectedEstadoFinal ? { fecha_cierre: new Date().toISOString(), observacion_cierre: observationText } : {}),
        });
      }
      await insertHistorial.mutateAsync({
        caso_id: caso.id,
        estado_id: editEstado,
        cambiado_por: user.id,
        comentario: estadoChanged ? observationText || undefined : undefined,
        observacion: hasObservation ? observationText : undefined,
        agente_id: user.id,
        agente_nombre: profile?.nombre || user.email || "",
        estado_nuevo: estadoSeleccionado?.nombre || undefined,
      });
      setOriginalEstado(editEstado);
      setEditObservaciones("");
      setObsError("");
      setDetailObservacion("");
      toast.success("Caso actualizado");
    } catch (err) {
      toast.error("Error: " + (err instanceof Error ? errorMessage(err) : String(err)));
    }
  };

  return (
    <div className="mt-4 space-y-5">
      {transferInfo && (
        <Alert className="border-primary/50 bg-primary/5">
          <AlertDescription className="text-sm">
            <ArrowRightLeft className="inline h-4 w-4 mr-1" />
            Este caso fue transferido.
            {" "}Nuevo caso:{" "}
            <button
              type="button"
              onClick={() => onOpenCase(transferInfo.newCaseId)}
              className="font-semibold text-primary underline underline-offset-4 rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              #{transferInfo.newCaseId}
            </button>
            {transferInfo.targetCampana && (
              <> en la campaña <strong>{transferInfo.targetCampana}</strong></>
            )}.
          </AlertDescription>
        </Alert>
      )}

      {(isReadOnly && !isTransferredCase) && (
        <Alert className="border-warning/40 bg-warning/10 text-warning">
          <Lock className="h-4 w-4 !text-warning" aria-hidden="true" />
          <AlertDescription>
            Este caso está cerrado y no puede ser modificado. Si necesitas reabrirlo, contacta a un administrador.
          </AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-2 gap-3 text-sm">
        <div><span className="text-muted-foreground">Cliente:</span><p className="font-medium">{caso.clientes?.nombre_contacto}</p></div>
        <div><span className="text-muted-foreground">NIT / Cédula:</span><p className="font-medium font-mono">{caso.clientes?.identificacion || "-"}</p></div>
        <div><span className="text-muted-foreground">Tipo:</span><p className="font-medium">{caso.cat_tipo_servicio?.nombre}</p></div>
        <div><span className="text-muted-foreground">Agente:</span><p className="font-medium">{caso.cat_agentes?.nombre}</p></div>
        <div><span className="text-muted-foreground">Fecha:</span><p className="font-medium">{safeFormat(caso.fecha_caso, "dd/MM/yyyy HH:mm")}</p></div>
        {caso.valor_pagar != null && caso.valor_pagar > 0 && (
          <div><span className="text-muted-foreground">Valor a Pagar:</span><p className="font-medium">{formatCOP(caso.valor_pagar)}</p></div>
        )}
      </div>
      <div className="text-sm">
        <span className="text-muted-foreground">Descripción:</span>
        <p className="mt-1">{caso.descripcion_inicial}</p>
      </div>

      <ContactInfo cliente={caso.clientes} />

      <Separator />

      {!isReadOnly && !isFullyLocked && (
        <div className="space-y-3">
          <Label htmlFor="cases-cambiar-estado">Cambiar Estado</Label>
          <Select value={String(editEstado)} onValueChange={v => { setEditEstado(Number(v)); setObsError(""); setValorError(""); }}>
            <SelectTrigger id="cases-cambiar-estado"><SelectValue /></SelectTrigger>
            <SelectContent>
              {estados.filter(e => e.nombre !== "Transferido").map(e => <SelectItem key={e.id} value={String(e.id)}>{e.nombre}</SelectItem>)}
            </SelectContent>
          </Select>

          {estadoChanged && showValorPagar && (
            <div className="space-y-2">
              <Label htmlFor="cases-valor-a-pagar">Valor a Pagar *</Label>
              <Input id="cases-valor-a-pagar" placeholder="$ 0" value={editValorDisplay} onChange={e => { setEditValorDisplay(formatCOPInput(e.target.value)); setValorError(""); }} />
              {valorError && <p className="text-sm text-destructive">{valorError}</p>}
            </div>
          )}

          {isEnGestion ? (
            <div className="space-y-2">
              <Label htmlFor="cases-observaciones-opcional">Observaciones (opcional)</Label>
              <Textarea id="cases-observaciones-opcional"
                value={detailObservacion}
                onChange={e => { if (e.target.value.length <= 500) setDetailObservacion(e.target.value); }}
                rows={3}
                placeholder="Escribe una observación sobre esta gestión..."
                maxLength={500}
              />
              <p className="text-xs text-muted-foreground text-right">{detailObservacion.length} / 500</p>
            </div>
          ) : estadoChanged ? (
            <div className="space-y-2">
              <Label htmlFor="cases-observaciones-de-gestion">
                Observaciones de gestión *
                {selectedEstadoFinal && !isRenovacionWeb && <span className="ml-1 text-xs text-muted-foreground">(mín. 30 caracteres)</span>}
              </Label>
              <Textarea id="cases-observaciones-de-gestion" value={editObservaciones} onChange={e => { setEditObservaciones(e.target.value); setObsError(""); }} rows={3} placeholder="Describe la gestión realizada..." />
              {selectedEstadoFinal && !isRenovacionWeb && (
                <p className="text-xs text-muted-foreground">{editObservaciones.trim().length}/30 caracteres</p>
              )}
              {obsError && <p className="text-sm text-destructive">{obsError}</p>}
            </div>
          ) : null}

          <Button
            onClick={handleUpdate}
            disabled={
              updateCase.isPending ||
              (!estadoChanged && !detailObservacion.trim()) ||
              (estadoChanged && !isEnGestion && !editObservaciones.trim())
            }
            className="w-full"
          >
            {updateCase.isPending ? "Guardando..." : "Actualizar Caso"}
          </Button>
        </div>
      )}

      <Separator />

      <div>
        <h3 className="mb-3 text-sm font-semibold">Historial de gestiones</h3>
        <CaseHistory casoId={caso.id} />

        {!isTransferredCase && !isGerente && (
          <CaseTransfer caso={caso} onTransferred={onTransferred} />
        )}
      </div>
    </div>
  );
}
