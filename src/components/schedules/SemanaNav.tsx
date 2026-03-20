// Navegador de semanas: ‹ Semana anterior | Semana 17–22 Mar 2026 | Semana siguiente ›
import { ChevronLeft, ChevronRight, CalendarDays } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Schedule } from "@/types/schedules";

function fmtSemana(inicio: string, fin: string): string {
  const opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "short" };
  const locale = "es-CO";
  const d1 = new Date(inicio + "T12:00:00");
  const d2 = new Date(fin   + "T12:00:00");
  return `${d1.toLocaleDateString(locale, opts)} – ${d2.toLocaleDateString(locale, { ...opts, year: "numeric" })}`;
}

interface Props {
  schedule: Schedule | null;
  onPrev: () => void;
  onNext: () => void;
  canGoNext?: boolean;
  // [B11] Agregar canGoPrev simétrico a canGoNext
  canGoPrev?: boolean;
}

export default function SemanaNav({ schedule, onPrev, onNext, canGoNext = true, canGoPrev = true }: Props) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border bg-card px-4 py-2.5">
      {/* [B11] Deshabilitar "← Anterior" cuando canGoPrev sea false */}
      <Button variant="ghost" size="icon" onClick={onPrev} disabled={!canGoPrev}>
        <ChevronLeft className="h-4 w-4" />
      </Button>

      <div className="flex items-center gap-2 text-sm font-medium">
        <CalendarDays className="h-4 w-4 text-muted-foreground" />
        {schedule
          ? fmtSemana(schedule.semana_inicio, schedule.semana_fin)
          : "Sin semana programada"}
        {schedule && (
          <Badge variant={schedule.estado === "publicado" ? "default" : "secondary"} className="ml-1 text-xs">
            {schedule.estado === "publicado" ? "Publicado" : "Borrador"}
          </Badge>
        )}
      </div>

      <Button variant="ghost" size="icon" onClick={onNext} disabled={!canGoNext}>
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  );
}
