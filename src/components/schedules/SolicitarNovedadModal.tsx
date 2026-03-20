// ============================================================
// SolicitarNovedadModal — Agente solicita permiso / novedad
// Soporta: día completo y parcial por horas (bloques 15 min)
// ============================================================
import { useState, useMemo } from "react";
import {
  Dialog, DialogContent, DialogHeader,
  DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Button }   from "@/components/ui/button";
import { Label }    from "@/components/ui/label";
import { Input }    from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch }   from "@/components/ui/switch";
import {
  Select, SelectContent, SelectItem,
  SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Badge }    from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useCreateNovedad } from "@/hooks/useSchedules";
import { useAuth }  from "@/contexts/AuthContext";
import {
  TipoNovedad,
  NOVEDAD_LABELS,
  NOVEDADES_DIA_COMPLETO,
  generarOpcionesHora,
} from "@/types/schedules";
import { ClipboardList, Clock } from "lucide-react";

const TIPOS_NOVEDAD: TipoNovedad[] = [
  "permiso_horas",
  "permiso_remunerado",
  "permiso_no_remunerado",
  "incapacidad",
  "vacaciones",
  "calamidad",
  "cambio_turno",
  "otro",
];

const OPCIONES_HORA = generarOpcionesHora("07:00", "18:15");

interface Props {
  scheduleId: string;
  open: boolean;
  onClose: () => void;
}

export default function SolicitarNovedadModal({ scheduleId, open, onClose }: Props) {
  const { toast }  = useToast();
  const { user }   = useAuth();
  const { mutate: crear, isPending } = useCreateNovedad();

  const [fecha,         setFecha]         = useState("");
  const [tipo,          setTipo]          = useState<TipoNovedad>("permiso_horas");
  const [descripcion,   setDescripcion]   = useState("");
  const [esDiaCompleto, setEsDiaCompleto] = useState(false);
  const [horaInicio,    setHoraInicio]    = useState("08:00");
  const [horaFin,       setHoraFin]       = useState("10:00");

  // Forzar día completo para tipos que aplican siempre al día entero
  const forceDiaCompleto = NOVEDADES_DIA_COMPLETO.includes(tipo);
  const mostrarHoras = !forceDiaCompleto && !esDiaCompleto;

  // Calcular duración preview
  const duracionPreview = useMemo(() => {
    if (!mostrarHoras) return null;
    const [ih, im] = horaInicio.split(":").map(Number);
    const [fh, fm] = horaFin.split(":").map(Number);
    const mins = (fh * 60 + fm) - (ih * 60 + im);
    if (mins <= 0) return null;
    const rounded = Math.round(mins / 15) * 15;
    const h = Math.floor(rounded / 60);
    const m = rounded % 60;
    return h > 0 ? `${h}h ${m > 0 ? m + "min" : ""}`.trim() : `${m}min`;
  }, [horaInicio, horaFin, mostrarHoras]);

  const horasInvalidas = mostrarHoras && (!duracionPreview);

  function handleSubmit() {
    if (!fecha) {
      toast({ title: "Selecciona una fecha", variant: "destructive" }); return;
    }
    if (!user?.id) return;

    crear(
      {
        schedule_id:         scheduleId,
        agente_id:           user.id,
        fecha,
        tipo_novedad:        tipo,
        descripcion:         descripcion || undefined,
        es_dia_completo:     forceDiaCompleto || esDiaCompleto,
        hora_inicio_novedad: mostrarHoras ? horaInicio : null,
        hora_fin_novedad:    mostrarHoras ? horaFin    : null,
      },
      {
        onSuccess: () => {
          toast({
            title: "Novedad enviada",
            description: "Tu solicitud quedó en estado pendiente. El supervisor la revisará.",
          });
          onClose();
        },
        onError: (e) => {
          toast({ title: "Error al enviar", description: (e as Error).message, variant: "destructive" });
        },
      }
    );
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ClipboardList className="h-5 w-5 text-violet-500" />
            Solicitar novedad
          </DialogTitle>
          <DialogDescription>
            Tu solicitud quedará en estado <strong>pendiente</strong> hasta que un supervisor la apruebe.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-1">

          {/* Tipo de novedad */}
          <div className="space-y-1">
            <Label>Tipo de novedad</Label>
            <Select
              value={tipo}
              onValueChange={(v) => {
                setTipo(v as TipoNovedad);
                if (NOVEDADES_DIA_COMPLETO.includes(v as TipoNovedad)) {
                  setEsDiaCompleto(true);
                }
              }}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {TIPOS_NOVEDAD.map((t) => (
                  <SelectItem key={t} value={t}>{NOVEDAD_LABELS[t]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Fecha */}
          <div className="space-y-1">
            <Label>Fecha</Label>
            <Input
              type="date"
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
              min={new Date().toISOString().slice(0, 10)}
            />
          </div>

          {/* Toggle día completo (solo si el tipo no lo fuerza) */}
          {!forceDiaCompleto && (
            <div className="flex items-center justify-between rounded-lg border px-3 py-2">
              <div>
                <p className="text-sm font-medium">Día completo</p>
                <p className="text-xs text-muted-foreground">
                  Desactiva para indicar solo un bloque de horas.
                </p>
              </div>
              <Switch checked={esDiaCompleto} onCheckedChange={setEsDiaCompleto} />
            </div>
          )}

          {/* Selector de horas en bloques de 15 min */}
          {mostrarHoras && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>Hora inicio</Label>
                  <Select value={horaInicio} onValueChange={setHoraInicio}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="max-h-56">
                      {OPCIONES_HORA.map((h) => (
                        <SelectItem key={h} value={h}>{h}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label>Hora fin</Label>
                  <Select value={horaFin} onValueChange={setHoraFin}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="max-h-56">
                      {OPCIONES_HORA.map((h) => (
                        <SelectItem key={h} value={h}>{h}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {duracionPreview && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Clock className="h-3.5 w-3.5" />
                  Duración: <Badge variant="secondary">{duracionPreview}</Badge>
                </div>
              )}
              {horasInvalidas && (
                <p className="text-xs text-destructive">
                  La hora de fin debe ser posterior a la hora de inicio.
                </p>
              )}
            </div>
          )}

          {/* Descripción */}
          <div className="space-y-1">
            <Label>Descripción (opcional)</Label>
            <Textarea
              rows={2}
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              placeholder="Ej: Cita médica a las 9am, trámite urgente..."
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isPending}>
            Cancelar
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isPending || !fecha || horasInvalidas}
          >
            {isPending ? "Enviando..." : "Enviar solicitud"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
