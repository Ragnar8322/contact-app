// Modal para crear / editar un turno individual.
// Mutaciones: upsert en schedule_shifts.
import { useState, useMemo } from "react";
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

// [B3] Actividades que NO requieren horas de inicio/fin
const ACTIVIDADES_NO_PRODUCTIVAS: TipoActividad[] = [
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

  const [horaInicio,   setHoraInicio]   = useState(shift?.hora_inicio?.slice(0,5) ?? "08:00");
  const [horaFin,      setHoraFin]      = useState(shift?.hora_fin?.slice(0,5)    ?? "16:00");
  const [horaAlmuerzo, setHoraAlmuerzo] = useState(shift?.hora_almuerzo?.slice(0,5) ?? "12:00");
  // [B12] Guardar duracion_almuerzo como number, no string
  const [durAlmuerzo,  setDurAlmuerzo]  = useState<number>(shift?.duracion_almuerzo ?? 45);
  const [actividad,    setActividad]    = useState<TipoActividad>(shift?.tipo_actividad ?? "GAP");
  const [observacion,  setObservacion]  = useState(shift?.observacion ?? "");
  const [saving,       setSaving]       = useState(false);

  // [B3] ¿Es una actividad que no requiere tiempo?
  const isNoProductiva = ACTIVIDADES_NO_PRODUCTIVAS.includes(actividad);

  // [B2] [B12] Calcular horas_dia con validación robusta (memoizado para evitar doble cómputo)
  const horasCalculadas = useMemo<number | null>(() => {
    if (isNoProductiva) return 0;
    try {
      const [sh, sm] = horaInicio.split(":").map(Number);
      const [eh, em] = horaFin.split(":").map(Number);
      // [B12] Validar que durAlmuerzo sea un número finito
      const dur = Number.isFinite(durAlmuerzo) ? durAlmuerzo : 0;
      const durMin = (eh * 60 + em) - (sh * 60 + sm) - dur;
      // [B2] Validar que el resultado sea positivo
      if (durMin <= 0) return null;
      return Math.round((durMin / 60) * 100) / 100;
    } catch {
      return null;
    }
  }, [horaInicio, horaFin, durAlmuerzo, isNoProductiva]);

  // [B2] Estado de error de rango de horas
  const horasInvalidas = !isNoProductiva && horasCalculadas === null;

  async function handleSave() {
    if (horasInvalidas) {
      toast({
        title: "Rango de horas inválido",
        description: "La hora de fin debe ser mayor que la hora de inicio más el almuerzo.",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    const payload = {
      schedule_id:       scheduleId,
      agente_id,
      fecha,
      // [B3] Actividades no-productivas: sin horas
      hora_inicio:       isNoProductiva ? null : horaInicio,
      hora_fin:          isNoProductiva ? null : horaFin,
      hora_almuerzo:     isNoProductiva ? null : horaAlmuerzo,
      duracion_almuerzo: isNoProductiva ? 0    : durAlmuerzo,
      tipo_actividad:    actividad,
      horas_dia:         horasCalculadas,
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
          {/* [B3] Solo mostrar campos de hora para actividades productivas */}
          {!isNoProductiva && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>Hora inicio</Label>
                  <Input type="time" value={horaInicio} onChange={e => setHoraInicio(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label>Hora fin</Label>
                  <Input
                    type="time"
                    value={horaFin}
                    onChange={e => setHoraFin(e.target.value)}
                    className={horasInvalidas ? "border-destructive" : ""}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>Inicio almuerzo</Label>
                  <Input type="time" value={horaAlmuerzo} onChange={e => setHoraAlmuerzo(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label>Duración almuerzo (min)</Label>
                  {/* [B12] Controlar como número nativo */}
                  <Input
                    type="number"
                    min={0}
                    max={120}
                    step={15}
                    value={durAlmuerzo}
                    onChange={e => {
                      const v = parseInt(e.target.value, 10);
                      setDurAlmuerzo(Number.isFinite(v) ? v : 0);
                    }}
                  />
                </div>
              </div>
            </>
          )}

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

          {/* [B2] Error de rango de horas */}
          {horasInvalidas && (
            <p className="text-xs text-destructive">
              ⚠ La hora de fin debe ser posterior a la de inicio (descontando el almuerzo).
            </p>
          )}

          {/* [B2] Mostrar cómputo solo si es válido */}
          {!isNoProductiva && horasCalculadas != null && (
            <p className="text-xs text-muted-foreground">
              Horas netas: <strong>{horasCalculadas}h</strong>
            </p>
          )}

          {isNoProductiva && (
            <p className="text-xs text-muted-foreground">
              Esta actividad no requiere horario específico. Se registrará como día no productivo.
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
          <Button onClick={handleSave} disabled={saving || horasInvalidas}>
            {saving ? "Guardando..." : "Guardar turno"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
