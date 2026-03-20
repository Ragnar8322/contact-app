// Celda individual de la grilla: muestra hora inicio-fin, tipo, almuerzo y novedades.
// v2: renderiza sub-bloques de almuerzo (variable) y bloque de novedad por horas.
import { cn } from "@/lib/utils";
import { ACTIVIDAD_COLORS, TipoActividad, ScheduleShift } from "@/types/schedules";
import { Utensils, Clock } from "lucide-react";

interface Props {
  shift?: ScheduleShift;
  editable?: boolean;
  // Novedad parcial aprobada para este turno (si existe)
  novedadHoras?: {
    hora_inicio: string;
    hora_fin: string;
    tipo: string;
  } | null;
  onClick?: (shift?: ScheduleShift) => void;
}

export default function TurnoCell({ shift, editable = false, novedadHoras, onClick }: Props) {
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

  const colorClass = ACTIVIDAD_COLORS[shift.tipo_actividad as TipoActividad];
  if (colorClass === undefined && import.meta.env.DEV) {
    console.warn(
      `[TurnoCell] tipo_actividad desconocido: "${shift.tipo_actividad}". Agregar a ACTIVIDAD_COLORS.`
    );
  }

  // Detectar si hay novedad parcial desde observación o prop
  const hasNovedadHoras = novedadHoras ||
    (shift.observacion && shift.observacion.startsWith("Permiso "));

  // Parsear rango de novedad desde observación si no vino como prop
  let novedadLabel = "";
  if (!novedadHoras && shift.observacion?.startsWith("Permiso ")) {
    novedadLabel = shift.observacion.replace("Permiso ", "");
  } else if (novedadHoras) {
    novedadLabel = `${novedadHoras.hora_inicio.slice(0, 5)}–${novedadHoras.hora_fin.slice(0, 5)}`;
  }

  return (
    <div
      onClick={() => editable && onClick?.(shift)}
      className={cn(
        "flex min-h-16 flex-col justify-start rounded-md px-2 py-1 text-xs gap-0.5",
        colorClass ?? "bg-gray-100 text-gray-700",
        editable && "cursor-pointer hover:opacity-80 transition-opacity"
      )}
    >
      {/* Actividad + horas */}
      <span className="font-semibold truncate">{shift.tipo_actividad}</span>
      {shift.hora_inicio && shift.hora_fin && (
        <span className="opacity-80">
          {shift.hora_inicio.slice(0, 5)} – {shift.hora_fin.slice(0, 5)}
        </span>
      )}

      {/* Almuerzo variable */}
      {shift.hora_almuerzo && shift.duracion_almuerzo > 0 && (
        <span className="flex items-center gap-0.5 opacity-60 text-[10px]">
          <Utensils className="h-2.5 w-2.5 shrink-0" />
          {shift.hora_almuerzo.slice(0, 5)} ({shift.duracion_almuerzo}m)
        </span>
      )}

      {/* Bloque de novedad parcial (permiso por horas) */}
      {hasNovedadHoras && novedadLabel && (
        <span className="flex items-center gap-0.5 text-[10px] bg-orange-100 text-orange-700 rounded px-1 py-0.5 truncate">
          <Clock className="h-2.5 w-2.5 shrink-0" />
          Permiso {novedadLabel}
        </span>
      )}

      {shift.horas_dia != null && shift.horas_dia > 0 && (
        <span className="opacity-70 mt-auto">{shift.horas_dia}h</span>
      )}
    </div>
  );
}
