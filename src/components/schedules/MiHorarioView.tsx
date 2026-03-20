// Vista reducida para el agente: su turno de la semana actual + novedades propias.
import { useState } from "react";
import { AlertCircle, Clock, CalendarDays, Plus, CheckCircle2, XCircle, Hourglass } from "lucide-react";
import { useCurrentSchedule, useMyShifts, useScheduleNovedades } from "@/hooks/useSchedules";
import {
  formatHoras,
  ACTIVIDAD_COLORS,
  TipoActividad,
  NOVEDAD_LABELS,
  EstadoNovedad,
} from "@/types/schedules";
import { cn } from "@/lib/utils";
import { Badge }     from "@/components/ui/badge";
import { Button }    from "@/components/ui/button";
import { Skeleton }  from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import SolicitarNovedadModal from "./SolicitarNovedadModal";

const DIAS = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];

const ESTADO_CONFIG: Record<EstadoNovedad, { label: string; icon: React.ReactNode; class: string }> = {
  pendiente:  { label: "Pendiente",  icon: <Hourglass className="h-3.5 w-3.5" />,   class: "bg-yellow-100 text-yellow-800 border-yellow-300" },
  aprobado:   { label: "Aprobada",   icon: <CheckCircle2 className="h-3.5 w-3.5" />, class: "bg-green-100 text-green-800 border-green-300"   },
  rechazado:  { label: "Rechazada",  icon: <XCircle className="h-3.5 w-3.5" />,      class: "bg-red-100 text-red-800 border-red-300"          },
};

export default function MiHorarioView() {
  const [showModal, setShowModal] = useState(false);

  const { data: schedule, isLoading: loadingSched, isError: errorSched } = useCurrentSchedule();
  const {
    data: shifts,
    isLoading: loadingShifts,
    isError: errorShifts,
  } = useMyShifts(schedule?.id);

  const {
    data: novedades,
    isLoading: loadingNovedades,
  } = useScheduleNovedades(schedule?.id);

  const isLoading = loadingSched || loadingShifts || loadingNovedades;

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}
      </div>
    );
  }

  if (errorSched) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          No se pudo cargar la información del horario. Intenta recargar la página.
        </AlertDescription>
      </Alert>
    );
  }

  if (!schedule) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[40vh] gap-3 text-muted-foreground">
        <CalendarDays className="h-10 w-10 opacity-30" />
        <p className="text-sm">No hay semana programada para esta semana.</p>
      </div>
    );
  }

  if (errorShifts) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          No se pudieron cargar tus turnos. Verifica tu conexión o contacta al administrador.
        </AlertDescription>
      </Alert>
    );
  }

  const shiftByDay = new Map(
    (shifts ?? []).map((s) => {
      const dow = new Date(s.fecha + "T12:00:00").getDay();
      return [dow === 0 ? 6 : dow - 1, s];
    })
  );

  // Novedades de la semana activa
  const novedadesActivas = (novedades ?? []).filter((n) => {
    const d = new Date(n.fecha + "T12:00:00");
    const start = new Date(schedule.semana_inicio + "T00:00:00");
    const end   = new Date(schedule.semana_fin   + "T23:59:59");
    return d >= start && d <= end;
  });

  return (
    <div className="space-y-5">

      {/* ── Turnos de la semana ── */}
      <div className="space-y-3">
        {DIAS.map((dia, i) => {
          const s = shiftByDay.get(i);
          if (!s) {
            return (
              <div key={dia} className="flex items-center gap-3 rounded-lg border px-4 py-3 opacity-40">
                <Clock className="h-4 w-4" />
                <span className="w-24 text-sm font-medium">{dia}</span>
                <span className="text-xs text-muted-foreground">Descanso / Sin turno</span>
              </div>
            );
          }
          const colorClass = ACTIVIDAD_COLORS[s.tipo_actividad as TipoActividad] ?? "bg-gray-100 text-gray-700";
          return (
            <div key={dia} className={cn("flex flex-wrap items-center gap-3 rounded-lg border px-4 py-3", colorClass)}>
              <span className="w-24 text-sm font-semibold">{dia}</span>
              <Badge variant="outline" className="text-xs border-current">{s.tipo_actividad}</Badge>
              {s.hora_inicio && s.hora_fin && (
                <span className="text-xs">
                  {s.hora_inicio.slice(0, 5)} – {s.hora_fin.slice(0, 5)}
                </span>
              )}
              {s.hora_almuerzo && (
                <span className="text-xs opacity-70">
                  Almuerzo {s.hora_almuerzo.slice(0, 5)} ({s.duracion_almuerzo} min)
                </span>
              )}
              <span className="ml-auto text-xs font-medium">{formatHoras(s.horas_dia)}</span>
            </div>
          );
        })}
      </div>

      <Separator />

      {/* ── Mis novedades ── */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            Mis novedades
          </h2>
          <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setShowModal(true)}>
            <Plus className="h-4 w-4" />
            Solicitar novedad
          </Button>
        </div>

        {novedadesActivas.length === 0 ? (
          <p className="text-xs text-muted-foreground py-2">
            No tienes novedades registradas para esta semana.
          </p>
        ) : (
          <div className="space-y-2">
            {novedadesActivas.map((n) => {
              const cfg = ESTADO_CONFIG[n.estado];
              const fechaLabel = new Date(n.fecha + "T12:00:00").toLocaleDateString("es-CO", {
                weekday: "short", day: "numeric", month: "short",
              });
              return (
                <div key={n.id} className="flex flex-wrap items-center gap-2 rounded-lg border px-3 py-2.5 text-sm">
                  <span className="font-medium capitalize">{fechaLabel}</span>
                  <Badge variant="outline" className="text-xs">{NOVEDAD_LABELS[n.tipo_novedad]}</Badge>
                  {!n.es_dia_completo && n.hora_inicio_novedad && n.hora_fin_novedad && (
                    <span className="text-xs text-muted-foreground">
                      {n.hora_inicio_novedad.slice(0, 5)} – {n.hora_fin_novedad.slice(0, 5)}
                      {n.duracion_minutos ? ` (${n.duracion_minutos} min)` : ""}
                    </span>
                  )}
                  {n.descripcion && (
                    <span className="text-xs text-muted-foreground truncate max-w-[160px]">
                      — {n.descripcion}
                    </span>
                  )}
                  <span className={cn("ml-auto flex items-center gap-1 text-xs font-medium border rounded px-1.5 py-0.5", cfg.class)}>
                    {cfg.icon}
                    {cfg.label}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal de solicitud */}
      {showModal && schedule && (
        <SolicitarNovedadModal
          scheduleId={schedule.id}
          open={showModal}
          onClose={() => setShowModal(false)}
        />
      )}
    </div>
  );
}
