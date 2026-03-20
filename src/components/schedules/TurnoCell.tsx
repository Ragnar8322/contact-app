// Celda individual de la grilla: muestra hora inicio-fin y tipo de actividad.
// En modo editable (manager) abre un popover para modificar el turno.
import { cn } from "@/lib/utils";
import { ACTIVIDAD_COLORS, TipoActividad, ScheduleShift } from "@/types/schedules";

interface Props {
  shift?: ScheduleShift;
  editable?: boolean;
  onClick?: (shift?: ScheduleShift) => void;
}

export default function TurnoCell({ shift, editable = false, onClick }: Props) {
  if (!shift) {
    return (
      <div
        onClick={() => editable && onClick?.(undefined)}
        className={cn(
          "flex h-16 items-center justify-center rounded-md border border-dashed text-xs text-muted-foreground",
          editable && "cursor-pointer hover:bg-accent/50 transition-colors"
        )}
      >
        {editable ? "+ Asignar" : "—"}
      </div>
    );
  }

  // [B14] Avisar en desarrollo si el tipo de actividad no tiene color mapeado
  const colorClass = ACTIVIDAD_COLORS[shift.tipo_actividad as TipoActividad];
  if (colorClass === undefined && import.meta.env.DEV) {
    console.warn(
      `[TurnoCell] tipo_actividad desconocido: "${shift.tipo_actividad}". Agregar a ACTIVIDAD_COLORS en types/schedules.ts`
    );
  }

  return (
    <div
      onClick={() => editable && onClick?.(shift)}
      className={cn(
        "flex h-16 flex-col justify-center rounded-md px-2 py-1 text-xs",
        colorClass ?? "bg-gray-100 text-gray-700",
        editable && "cursor-pointer hover:opacity-80 transition-opacity"
      )}
    >
      <span className="font-semibold truncate">{shift.tipo_actividad}</span>
      {shift.hora_inicio && shift.hora_fin && (
        <span className="opacity-80">
          {shift.hora_inicio.slice(0, 5)} – {shift.hora_fin.slice(0, 5)}
        </span>
      )}
      {shift.horas_dia != null && (
        <span className="opacity-70">{shift.horas_dia}h</span>
      )}
    </div>
  );
}
