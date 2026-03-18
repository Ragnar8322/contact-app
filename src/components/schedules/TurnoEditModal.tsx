// Modal para crear / editar un turno individual.
// Mutaciones: upsert en schedule_shifts.
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { ScheduleShift, TipoActividad } from "@/types/schedules";

const ACTIVIDADES: TipoActividad[] = [
  "GAP", "Tele", "Calidad", "Apoyo", "VIP",
  "Descanso", "Vacaciones", "Incapacidad", "No_aplica",
];

interface Props {
  scheduleId: string;
  agente_id: string;
  agente_nombre: string;
  fecha: string;
  shift?: ScheduleShift;
  onClose: () => void;
  onSaved: () => void;
}

export default function TurnoEditModal({ scheduleId, agente_id, agente_nombre, fecha, shift, onClose, onSaved }: Props) {
  const { toast } = useToast();
  const qc = useQueryClient();

  const [horaInicio, setHoraInicio]   = useState(shift?.hora_inicio?.slice(0,5) ?? "08:00");
  const [horaFin,    setHoraFin]      = useState(shift?.hora_fin?.slice(0,5)    ?? "16:00");
  const [horaAlmuerzo, setHoraAlmuerzo] = useState(shift?.hora_almuerzo?.slice(0,5) ?? "12:00");
  const [durAlmuerzo,  setDurAlmuerzo]  = useState(String(shift?.duracion_almuerzo ?? 45));
  const [actividad,  setActividad]    = useState<TipoActividad>(shift?.tipo_actividad ?? "GAP");
  const [observacion, setObservacion] = useState(shift?.observacion ?? "");
  const [saving, setSaving]           = useState(false);

  // Calcular horas_dia automáticamente
  function calcHoras(): number | null {
    try {
      const [sh, sm] = horaInicio.split(":").map(Number);
      const [eh, em] = horaFin.split(":").map(Number);
      const durMin = (eh * 60 + em) - (sh * 60 + sm) - Number(durAlmuerzo);
      return Math.round((durMin / 60) * 100) / 100;
    } catch { return null; }
  }

  async function handleSave() {
    setSaving(true);
    const horas_dia = calcHoras();
    const payload = {
      schedule_id:       scheduleId,
      agente_id,
      fecha,
      hora_inicio:       horaInicio,
      hora_fin:          horaFin,
      hora_almuerzo:     horaAlmuerzo,
      duracion_almuerzo: Number(durAlmuerzo),
      tipo_actividad:    actividad,
      horas_dia,
      observacion:       observacion || null,
    };

    const { error } = await supabase
      .from("schedule_shifts")
      .upsert(payload, { onConflict: "schedule_id,agente_id,fecha" });

    setSaving(false);
    if (error) {
      toast({ title: "Error al guardar", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Turno guardado" });
      qc.invalidateQueries({ queryKey: ["schedule_shifts", scheduleId] });
      onSaved();
    }
  }

  const fechaLabel = new Date(fecha + "T12:00:00").toLocaleDateString("es-CO", {
    weekday: "long", day: "numeric", month: "long",
  });

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="capitalize">{agente_nombre}</DialogTitle>
          <p className="text-sm text-muted-foreground capitalize">{fechaLabel}</p>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Hora inicio</Label>
              <Input type="time" value={horaInicio} onChange={e => setHoraInicio(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Hora fin</Label>
              <Input type="time" value={horaFin} onChange={e => setHoraFin(e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Inicio almuerzo</Label>
              <Input type="time" value={horaAlmuerzo} onChange={e => setHoraAlmuerzo(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Duración almuerzo (min)</Label>
              <Input type="number" min={15} max={120} step={15}
                value={durAlmuerzo} onChange={e => setDurAlmuerzo(e.target.value)} />
            </div>
          </div>

          <div className="space-y-1">
            <Label>Tipo de actividad</Label>
            <Select value={actividad} onValueChange={v => setActividad(v as TipoActividad)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {ACTIVIDADES.map(a => (
                  <SelectItem key={a} value={a}>{a}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {calcHoras() != null && (
            <p className="text-xs text-muted-foreground">
              Horas netas: <strong>{calcHoras()}h</strong>
            </p>
          )}

          <div className="space-y-1">
            <Label>Observación (opcional)</Label>
            <Textarea rows={2} value={observacion} onChange={e => setObservacion(e.target.value)}
              placeholder="Ej: Capacitación, cambio de turno..." />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Guardando..." : "Guardar turno"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
