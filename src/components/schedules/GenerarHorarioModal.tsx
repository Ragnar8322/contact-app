// Modal para configurar y lanzar la generación inteligente de horarios.
import { useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Button }  from "@/components/ui/button";
import { Label }   from "@/components/ui/label";
import { Input }   from "@/components/ui/input";
import { Switch }  from "@/components/ui/switch";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useGenerateSchedule } from "@/hooks/useSchedules";
import { useToast } from "@/hooks/use-toast";
import { Sparkles, Loader2 } from "lucide-react";

const DIAS = [
  { label: "Lunes",     value: "0" },
  { label: "Martes",    value: "1" },
  { label: "Miércoles", value: "2" },
  { label: "Jueves",    value: "3" },
  { label: "Viernes",   value: "4" },
  { label: "Sábado",    value: "5" },
  { label: "Domingo",   value: "6" },
];

const ACTIVIDADES_PRODUCTIVAS = [
  { label: "Tele",    value: "Tele"    },
  { label: "GAP",     value: "GAP"     },
  { label: "Calidad", value: "Calidad" },
  { label: "Apoyo",   value: "Apoyo"   },
  { label: "VIP",     value: "VIP"     },
];

interface Props {
  scheduleId: string;
  open: boolean;
  onClose: () => void;
  onGenerated: () => void;
}

export default function GenerarHorarioModal({ scheduleId, open, onClose, onGenerated }: Props) {
  const { toast } = useToast();
  const { mutate: generate, isPending } = useGenerateSchedule();

  const [horaInicio,    setHoraInicio   ] = useState("07:00");
  const [horaFin,       setHoraFin      ] = useState("18:00");
  const [diaLibreBase,  setDiaLibreBase ] = useState("6");
  const [durAlmuerzo,   setDurAlmuerzo  ] = useState("60");
  const [skipExisting,  setSkipExisting ] = useState(true);
  const [tipoActividad, setTipoActividad] = useState("Tele");

  function handleGenerate() {
    generate(
      {
        schedule_id:       scheduleId,
        hora_inicio:       horaInicio,
        hora_fin:          horaFin,
        dia_libre_base:    parseInt(diaLibreBase, 10),
        duracion_almuerzo: parseInt(durAlmuerzo, 10),
        skip_existing:     skipExisting,
        tipo_actividad:    tipoActividad,
      },
      {
        onSuccess: (count) => {
          toast({
            title: `Horario generado ✅`,
            description: `${count} turnos creados/actualizados.`,
          });
          onGenerated();
          onClose();
        },
        onError: (err: Error) => {
          toast({ title: "Error al generar horario", description: err.message, variant: "destructive" });
        },
      }
    );
  }

  const jornadaHoras = (() => {
    const [ih, im] = horaInicio.split(":").map(Number);
    const [fh, fm] = horaFin.split(":").map(Number);
    const total = (fh * 60 + fm) - (ih * 60 + im) - parseInt(durAlmuerzo, 10);
    return total > 0 ? (total / 60).toFixed(2) : "—";
  })();

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-violet-500" />
            Generar horario inteligente
          </DialogTitle>
          <DialogDescription>
            El algoritmo asignará turnos a todos los agentes con día libre
            rotativo y almuerzo escalonado cada 30 min.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Jornada */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Hora inicio</Label>
              <Input type="time" value={horaInicio} onChange={(e) => setHoraInicio(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Hora fin</Label>
              <Input type="time" value={horaFin} onChange={(e) => setHoraFin(e.target.value)} />
            </div>
          </div>

          {/* Almuerzo */}
          <div className="space-y-1">
            <Label>Duración almuerzo (min)</Label>
            <Input
              type="number" min={0} max={120}
              value={durAlmuerzo}
              onChange={(e) => setDurAlmuerzo(e.target.value)}
            />
          </div>

          <p className="text-xs text-muted-foreground">
            Horas productivas por día: <strong>{jornadaHoras}h</strong>
          </p>

          {/* Tipo de actividad */}
          <div className="space-y-1">
            <Label>Tipo de actividad</Label>
            <Select value={tipoActividad} onValueChange={setTipoActividad}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ACTIVIDADES_PRODUCTIVAS.map((a) => (
                  <SelectItem key={a.value} value={a.value}>{a.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Día libre base */}
          <div className="space-y-1">
            <Label>Día libre del primer agente</Label>
            <p className="text-xs text-muted-foreground">El resto de agentes rotarán a partir de este día.</p>
            <Select value={diaLibreBase} onValueChange={setDiaLibreBase}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {DIAS.map((d) => (
                  <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Skip existing */}
          <div className="flex items-center justify-between rounded-lg border px-3 py-2">
            <div>
              <p className="text-sm font-medium">Preservar ediciones manuales</p>
              <p className="text-xs text-muted-foreground">Si está activo, no sobreescribirá turnos ya asignados.</p>
            </div>
            <Switch checked={skipExisting} onCheckedChange={setSkipExisting} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isPending}>Cancelar</Button>
          <Button onClick={handleGenerate} disabled={isPending || !horaInicio || !horaFin} className="gap-2">
            {isPending
              ? <><Loader2 className="h-4 w-4 animate-spin" /> Generando...</>
              : <><Sparkles className="h-4 w-4" /> Generar horario</>
            }
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
