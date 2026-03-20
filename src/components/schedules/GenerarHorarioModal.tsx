// Modal para configurar y lanzar la generación inteligente de horarios.
// v3: modal scrollable, selects de hora en lugar de input type=time (evita formato 12h del navegador)
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
import { Sparkles, Loader2, Info, Clock } from "lucide-react";

// Opciones de hora en bloques de 30 min para inicio y fin
const HORAS_INICIO = [
  "07:00", "07:30", "08:00", "08:30", "09:00",
];
const HORAS_FIN = [
  "16:00", "16:30", "17:00", "17:30", "18:00",
];

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

const DURACIONES_ALMUERZO = [
  { label: "30 min", value: "30" },
  { label: "45 min", value: "45" },
  { label: "60 min (1 hora)", value: "60" },
  { label: "90 min", value: "90" },
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

  const [horaInicio,    setHoraInicio   ] = useState("07:30");
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
            title: `Horario generado`,
            description: `${count} turnos creados. Sábado: 08:00–12:00. L-V con breaks y almuerzo flexibles.`,
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

  // Preview horas netas L-V
  const jornadaHoras = (() => {
    const [ih, im] = horaInicio.split(":").map(Number);
    const [fh, fm] = horaFin.split(":").map(Number);
    const total = (fh * 60 + fm) - (ih * 60 + im) - parseInt(durAlmuerzo, 10) - 30;
    return total > 0 ? (total / 60).toFixed(1) : "—";
  })();

  // Preview horas semanales estimadas (5 días L-V × horas_dia + 4h sábado)
  const horasSemana = (() => {
    const h = parseFloat(jornadaHoras);
    if (isNaN(h)) return "—";
    return ((h * 5) + 4).toFixed(1);
  })();

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md max-h-[90vh] flex flex-col">
        <DialogHeader className="shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-violet-500" />
            Generar horario inteligente
          </DialogTitle>
          <DialogDescription>
            Asigna turnos automáticamente con ventana horaria, tope de 42h semanales,
            novedades aprobadas y breaks flexibles.
          </DialogDescription>
        </DialogHeader>

        {/* Contenido scrollable */}
        <div className="flex-1 overflow-y-auto space-y-4 py-2 pr-1">

          {/* Aviso de reglas compacto */}
          <div className="flex items-start gap-2 rounded-lg bg-muted/60 border px-3 py-2.5">
            <Info className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
            <div className="text-xs text-muted-foreground space-y-0.5">
              <p><strong className="text-foreground">L–V:</strong> {horaInicio} – {horaFin} · almuerzo + 2 breaks de 15 min</p>
              <p><strong className="text-foreground">Sábado:</strong> 08:00 – 12:00 · sin almuerzo ni breaks</p>
              <p><strong className="text-foreground">Tope:</strong> 42 h netas/semana · novedades aprobadas bloqueadas</p>
            </div>
          </div>

          {/* Hora inicio / fin — Select en lugar de input time para evitar formato 12h */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                Inicio L-V
              </Label>
              <Select value={horaInicio} onValueChange={setHoraInicio}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {HORAS_INICIO.map((h) => (
                    <SelectItem key={h} value={h}>{h}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                Fin L-V
              </Label>
              <Select value={horaFin} onValueChange={setHoraFin}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {HORAS_FIN.map((h) => (
                    <SelectItem key={h} value={h}>{h}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Almuerzo */}
          <div className="space-y-1.5">
            <Label>Duración almuerzo</Label>
            <Select value={durAlmuerzo} onValueChange={setDurAlmuerzo}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DURACIONES_ALMUERZO.map((d) => (
                  <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Preview horas */}
          <div className="grid grid-cols-2 gap-2 rounded-lg bg-muted/40 border px-3 py-2.5 text-xs">
            <div>
              <p className="text-muted-foreground">Horas netas / día (L-V)</p>
              <p className="text-base font-bold">{jornadaHoras}<span className="text-xs font-normal">h</span></p>
            </div>
            <div>
              <p className="text-muted-foreground">Est. semana (con sábado)</p>
              <p className={`text-base font-bold ${parseFloat(horasSemana) > 42 ? "text-destructive" : "text-green-600"}`}>
                {horasSemana}<span className="text-xs font-normal">h</span>
                {parseFloat(horasSemana) > 42 && <span className="text-xs font-normal ml-1">(supera 42h)</span>}
              </p>
            </div>
          </div>

          {/* Tipo de actividad */}
          <div className="space-y-1.5">
            <Label>Actividad principal</Label>
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
          <div className="space-y-1.5">
            <Label>Día libre del 1er agente</Label>
            <p className="text-xs text-muted-foreground -mt-1">El resto de agentes rotan desde este día.</p>
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
          <div className="flex items-center justify-between rounded-lg border px-3 py-2.5">
            <div>
              <p className="text-sm font-medium">Preservar ediciones manuales</p>
              <p className="text-xs text-muted-foreground">No sobreescribe turnos ya asignados.</p>
            </div>
            <Switch checked={skipExisting} onCheckedChange={setSkipExisting} />
          </div>
        </div>

        <DialogFooter className="shrink-0 pt-2 border-t">
          <Button variant="outline" onClick={onClose} disabled={isPending}>Cancelar</Button>
          <Button onClick={handleGenerate} disabled={isPending} className="gap-2">
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
