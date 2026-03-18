// Barra de cobertura intradiaria: franjas de 15min de 07:00 a 18:00.
// Usa el hook useCoverageBySlot para obtener el conteo por slot.
import { useCoverageBySlot } from "@/hooks/useSchedules";
import { cn } from "@/lib/utils";

interface Props {
  scheduleId: string;
  fecha: string;
  metaAgentes?: number; // línea de meta (ej: 15)
}

export default function CoverageBar({ scheduleId, fecha, metaAgentes = 15 }: Props) {
  const { data: slots, isLoading } = useCoverageBySlot(scheduleId, fecha);

  if (isLoading) {
    return <div className="h-16 animate-pulse rounded bg-muted" />;
  }

  if (!slots) return null;

  const entries = Object.entries(slots);
  const maxVal  = Math.max(...entries.map(([, v]) => v), metaAgentes);

  return (
    <div className="rounded-lg border bg-card p-3">
      <p className="mb-2 text-xs font-medium text-muted-foreground">
        Cobertura intradiaria — {new Date(fecha + "T12:00:00").toLocaleDateString("es-CO", {
          weekday: "long", day: "numeric", month: "short",
        })}
      </p>
      <div className="flex items-end gap-px h-16">
        {entries.map(([slot, count]) => {
          const pct   = maxVal > 0 ? (count / maxVal) * 100 : 0;
          const color = count >= metaAgentes
            ? "bg-emerald-500"
            : count >= metaAgentes * 0.7
            ? "bg-amber-400"
            : "bg-red-400";
          return (
            <div key={slot} className="group relative flex-1" title={`${slot}: ${count} agentes`}>
              <div
                className={cn("w-full rounded-t transition-all", color)}
                style={{ height: `${pct}%`, minHeight: count > 0 ? 2 : 0 }}
              />
            </div>
          );
        })}
      </div>
      <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
        <span>07:00</span>
        <span>12:00</span>
        <span>18:00</span>
      </div>
    </div>
  );
}
