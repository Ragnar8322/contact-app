// Vista reducida para el agente: su turno de la semana actual.
import { Clock, CalendarDays } from "lucide-react";
import { useCurrentSchedule, useMyShifts } from "@/hooks/useSchedules";
import { formatHoras, ACTIVIDAD_COLORS, TipoActividad } from "@/types/schedules";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

const DIAS = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];

export default function MiHorarioView() {
  const { data: schedule, isLoading: loadingSched } = useCurrentSchedule();
  const { data: shifts,   isLoading: loadingShifts } = useMyShifts(schedule?.id);

  if (loadingSched || loadingShifts) {
    return (
      <div className="space-y-3">
        {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}
      </div>
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

  const shiftByDay = new Map(
    (shifts ?? []).map(s => {
      const dow = new Date(s.fecha + "T12:00:00").getDay();
      return [dow === 0 ? 6 : dow - 1, s];
    })
  );

  return (
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
          <div key={dia} className={cn(
            "flex flex-wrap items-center gap-3 rounded-lg border px-4 py-3",
            colorClass
          )}>
            <span className="w-24 text-sm font-semibold">{dia}</span>
            <Badge variant="outline" className="text-xs border-current">{s.tipo_actividad}</Badge>
            {s.hora_inicio && s.hora_fin && (
              <span className="text-xs">
                {s.hora_inicio.slice(0,5)} – {s.hora_fin.slice(0,5)}
              </span>
            )}
            {s.hora_almuerzo && (
              <span className="text-xs opacity-70">
                Almuerzo {s.hora_almuerzo.slice(0,5)} ({s.duracion_almuerzo} min)
              </span>
            )}
            <span className="ml-auto text-xs font-medium">{formatHoras(s.horas_dia)}</span>
          </div>
        );
      })}
    </div>
  );
}
