// Modal para crear / editar un turno individual.
// v2: privilegios diferenciados admin vs supervisor.
//   - Supervisor: bloquea guardar si >42h semanales o fuera de ventana permitida
//   - Admin: privilegios absolutos, puede ignorar alertas
import { useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { ScheduleShift, TipoActividad } from "@/types/schedules";
import { AlertTriangle, ShieldAlert } from "lucide-react";

const ACTIVIDADES: TipoActividad[] = [
  "GAP", "Tele", "Calidad", "Apoyo", "VIP",
  "Descanso", "Vacaciones", "Incapacidad", "No_aplica",
];

// Actividades que NO requieren horas de inicio/fin
const ACTIVIDADES_NO_PRODUCTIVAS: TipoActividad[] = [
  "Descanso", "Vacaciones", "Incapacidad", "No_aplica",
];

// Ventana permitida para supervisor (L-V)
const VENTANA_INI = "07:30";
const VENTANA_FIN = "18:00";
const TOPE_HORAS_SEMANALES = 42;

interface Props {
  scheduleId: string;
  agente_id: string;
  agente_nombre: string;
  fecha: string;
  shift?: ScheduleShift;
  horasAcumuladasSemana?: number; // horas ya asignadas al agente en la semana (sin este turno)
  onClose: () => void;
  onSaved: () => void;
}

export default function TurnoEditModal({
  scheduleId,
  agente_id,
  agente_nombre,
  fecha,
  shift,
  horasAcumuladasSemana = 0,
  onClose,
  onSaved,
}: Props) {
  const { toast } = useToast();
  const { isAdmin, isSupervisor } = useAuth();
  const qc = useQueryClient();

  const [horaInicio,   setHoraInicio]   = useState(shift?.hora_inicio?.slice(0, 5) ?? "08:00");
  const [horaFin,      setHoraFin]      = useState(shift?.hora_fin?.slice(0, 5)    ?? "16:00");
  const [horaAlmuerzo, setHoraAlmuerzo] = useState(shift?.hora_almuerzo?.slice(0, 5) ?? "12:00");
  const [durAlmuerzo,  setDurAlmuerzo]  = useState<number>(shift?.duracion_almuerzo ?? 60);
  const [actividad,    setActividad]    = useState<TipoActividad>(shift?.tipo_actividad ?? "GAP");
  const [observacion,  setObservacion]  = useState(shift?.observacion ?? "");
  const [saving,       setSaving]       = useState(false);

  // Admin puede sobreescribir alertas, supervisor no
  const isAdminUser = isAdmin;

  const isNoProductiva = ACTIVIDADES_NO_PRODUCTIVAS.includes(actividad);

  // Calcular horas netas del turno
  const horasCalculadas = useMemo<number | null>(() => {
    if (isNoProductiva) return 0;
    try {
      const [sh, sm] = horaInicio.split(":").map(Number);
      const [eh, em] = horaFin.split(":").map(Number);
      const dur = Number.isFinite(durAlmuerzo) ? durAlmuerzo : 0;
      const durMin = (eh * 60 + em) - (sh * 60 + sm) - dur;
      if (durMin <= 0) return null;
      return Math.round((durMin / 60) * 100) / 100;
    } catch {
      return null;
    }
  }, [horaInicio, horaFin, durAlmuerzo, isNoProductiva]);

  const horasInvalidas = !isNoProductiva && horasCalculadas === null;

  // ── Validaciones de supervisor ──
  const alertas: string[] = [];

  if (!isNoProductiva && !isAdminUser) {
    // Alerta: fuera de ventana
    if (horaInicio < VENTANA_INI || horaFin > VENTANA_FIN) {
      alertas.push(
        `El turno está fuera de la ventana permitida (${VENTANA_INI} – ${VENTANA_FIN}).`
      );
    }
    // Alerta: tope semanal
    const horasTotales = horasAcumuladasSemana + (horasCalculadas ?? 0);
    if (horasTotales > TOPE_HORAS_SEMANALES) {
      alertas.push(
        `Con este turno el agente acumularía ${horasTotales.toFixed(2)}h semanales (tope: ${TOPE_HORAS_SEMANALES}h).`
      );
    }
  }

  // Supervisor no puede guardar si hay alertas; admin sí puede
  const bloqueadoPorSupervisor = alertas.length > 0 && !isAdminUser && isSupervisor;

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
          {!isNoProductiva && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>Hora inicio</Label>
                  <Input type="time" value={horaInicio} onChange={(e) => setHoraInicio(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label>Hora fin</Label>
                  <Input
                    type="time"
                    value={horaFin}
                    onChange={(e) => setHoraFin(e.target.value)}
                    className={horasInvalidas ? "border-destructive" : ""}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>Inicio almuerzo</Label>
                  <Input type="time" value={horaAlmuerzo} onChange={(e) => setHoraAlmuerzo(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label>Duración almuerzo (min)</Label>
                  <Input
                    type="number" min={0} max={120} step={15}
                    value={durAlmuerzo}
                    onChange={(e) => {
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
            <Select value={actividad} onValueChange={(v) => setActividad(v as TipoActividad)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {ACTIVIDADES.map((a) => (
                  <SelectItem key={a} value={a}>{a}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {horasInvalidas && (
            <p className="text-xs text-destructive">
              La hora de fin debe ser posterior a la de inicio (descontando el almuerzo).
            </p>
          )}

          {!isNoProductiva && horasCalculadas != null && (
            <p className="text-xs text-muted-foreground">
              Horas netas: <strong>{horasCalculadas}h</strong>
              {horasAcumuladasSemana > 0 && (
                <span className="ml-2">
                  · Semana total: <strong>{(horasAcumuladasSemana + horasCalculadas).toFixed(2)}h</strong>
                </span>
              )}
            </p>
          )}

          {isNoProductiva && (
            <p className="text-xs text-muted-foreground">
              Esta actividad no requiere horario específico. Se registrará como día no productivo.
            </p>
          )}

          {/* Alertas para supervisor */}
          {alertas.length > 0 && (
            <Alert variant={isAdminUser ? "default" : "destructive"} className="py-2">
              {isAdminUser
                ? <AlertTriangle className="h-4 w-4" />
                : <ShieldAlert className="h-4 w-4" />
              }
              <AlertDescription className="text-xs space-y-1">
                {alertas.map((a, i) => <p key={i}>{a}</p>)}
                {isAdminUser && (
                  <p className="font-medium mt-1">Como administrador puedes guardar de todas formas.</p>
                )}
              </AlertDescription>
            </Alert>
          )}

          <div className="space-y-1">
            <Label>Observación (opcional)</Label>
            <Textarea
              rows={2}
              value={observacion}
              onChange={(e) => setObservacion(e.target.value)}
              placeholder="Ej: Capacitación, cambio de turno..."
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancelar</Button>
          <Button
            onClick={handleSave}
            disabled={saving || horasInvalidas || bloqueadoPorSupervisor}
            variant={alertas.length > 0 && isAdminUser ? "destructive" : "default"}
          >
            {saving
              ? "Guardando..."
              : alertas.length > 0 && isAdminUser
                ? "Guardar (ignorar alertas)"
                : "Guardar turno"
            }
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
