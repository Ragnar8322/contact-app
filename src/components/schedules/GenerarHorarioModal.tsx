// Modal para configurar y lanzar la generación inteligente de horarios.
// v2: usa ventanas fijas del plan (L-V 07:30-18:00 / Sáb 08:00-12:00)
//     con breaks flexibles y tope de 42h semanales.
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
import { Sparkles, Loader2, Info } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

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

  // Ventanas L-V (se muestran como referencia, el backend las valida)
  const [horaInicio,    setHoraInicio   ] = useState("07:30");
  const [horaFin,       setHoraFin      ] = useState("18:00");
  const [diaLibreBase,  setDiaLibreBase ] = useState("6");   // Domingo por defecto
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
            title: `Horario generado`,
            description: `${count} turnos creados o actualizados con breaks y almuerzo flexibles.`,
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

  // Preview de horas netas por día
  const jornadaHoras = (() => {
    const [ih, im] = horaInicio.split(":").map(Number);
    const [fh, fm] = horaFin.split(":").map(Number);
    const total = (fh * 60 + fm) - (ih * 60 + im) - parseInt(durAlmuerzo, 10) - 30; // 30 = 2 breaks
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
            Asigna turnos automáticamente respetando la ventana horaria, tope de 42h
            semanales, novedades aprobadas y breaks flexibles.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">

          {/* Aviso de reglas */}
          <Alert className="py-2">
            <Info className="h-4 w-4" />
            <AlertDescription className="text-xs">
              <strong>Reglas activas:</strong> L-V 07:30–18:00 · Sáb 08:00–12:00 ·
              Tope 42h/semana · Break mañana + tarde (15 min c/u) · Almuerzo escalonado.
              Las novedades aprobadas se bloquean automáticamente.
            </AlertDescription>
          </Alert>

          {/* Jornada L-V */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Hora inicio (L-V)</Label>
              <Input type="time" value={horaInicio} min="07:30" max="09:00"
                onChange={(e) => setHoraInicio(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Hora fin (L-V)</Label>
              <Input type="time" value={horaFin} min="16:00" max="18:00"
                onChange={(e) => setHoraFin(e.target.value)} />
            </div>
          </div>

          {/* Almuerzo */}
          <div className="space-y-1">
            <Label>Duración almuerzo (min)</Label>
            <Input
              type="number" min={30} max={90} step={15}
              value={durAlmuerzo}
              onChange={(e) => setDurAlmuerzo(e.target.value)}
            />
          </div>

          <p className="text-xs text-muted-foreground">
            Horas netas por día (L-V): <strong>{jornadaHoras}h</strong>
            <span className="ml-2 opacity-60">(descontando almuerzo + 30 min de breaks)</span>
          </p>

          {/* Tipo de actividad */}
          <div className="space-y-1">
            <Label>Tipo de actividad principal</Label>
            <Select value={tipoActividad} onValueChange={setTipoActividad}>
              <SelectTrigger><SelectValue /></SelectTrigger>
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
            <p className="text-xs text-muted-foreground">El resto de agentes rotan a partir de este día.</p>
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
              <p className="text-xs text-muted-foreground">No sobreescribe turnos ya asignados.</p>
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
