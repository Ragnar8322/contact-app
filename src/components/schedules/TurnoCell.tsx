// Celda individual de la grilla: muestra hora inicio-fin, tipo, almuerzo y novedades.
// v2: renderiza sub-bloques de almuerzo (variable) y bloque de novedad por horas.
import { cn } from "@/lib/utils";
import { ACTIVIDAD_COLORS, TipoActividad, ScheduleShift, actividadLabel } from "@/types/schedules";
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
  /** Agente y día de la celda, para lectores de pantalla (p. ej. "Ana Pérez, lunes 16 mar") */
  label?: string;
}

/** Botón cuando la celda es editable (Tab + Enter/Espacio); div cuando es solo lectura. */
function CellShell({ editable, label, onActivate, className, children }: {
  editable: boolean;
  label: string;
  onActivate: () => void;
  className: string;
  children: React.ReactNode;
}) {
  if (!editable) return <div className={className}>{children}</div>;
  return (
    <button
      type="button"
      onClick={onActivate}
      aria-label={label}
      className={cn(
        className,
        "w-full text-left cursor-pointer transition-[opacity,transform] duration-100 hover:opacity-80 active:scale-[0.97]",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
        "motion-reduce:transition-none motion-reduce:active:scale-100"
      )}
    >
      {children}
    </button>
  );
}

export default function TurnoCell({ shift, editable = false, novedadHoras, onClick, label = "" }: Props) {
  if (!shift) {
    return (
      <CellShell
        editable={editable}
        label={`Asignar turno: ${label}`}
        onActivate={() => onClick?.(undefined)}
        className={cn(
          "flex h-16 items-center justify-center rounded-md border border-dashed text-xs text-muted-foreground",
          editable && "justify-center text-center hover:bg-accent"
        )}
      >
        {editable ? "+ Asignar" : "—"}
      </CellShell>
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
    <CellShell
      editable={editable}
      label={`Editar turno: ${label}, ${actividadLabel(shift.tipo_actividad)}`}
      onActivate={() => onClick?.(shift)}
      className={cn(
        "flex min-h-16 flex-col justify-start rounded-md px-2 py-1 text-xs gap-0.5",
        colorClass ?? "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300"
      )}
    >
      {/* Actividad + horas */}
      <span className="font-semibold truncate">{actividadLabel(shift.tipo_actividad)}</span>
      {shift.hora_inicio && shift.hora_fin && (
        <span className="opacity-90">
          {shift.hora_inicio.slice(0, 5)} – {shift.hora_fin.slice(0, 5)}
        </span>
      )}

      {/* Almuerzo variable */}
      {shift.hora_almuerzo && shift.duracion_almuerzo > 0 && (
        <span className="flex items-center gap-0.5 opacity-90 text-[11px]">
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
        <span className="opacity-90 mt-auto">{shift.horas_dia}h</span>
      )}
    </CellShell>
  );
}
