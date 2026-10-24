// Navegador de semanas: ‹ | 16 mar – 22 mar 2026 [Publicado] [Hoy] | ›
import { ChevronLeft, ChevronRight, CalendarDays } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Schedule } from "@/types/schedules";

function fmtSemana(inicio: string): string {
  const opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "short" };
  const locale = "es-CO";
  const d1 = new Date(inicio + "T12:00:00");
  const d2 = new Date(d1);
  d2.setDate(d1.getDate() + 6);
  return `${d1.toLocaleDateString(locale, opts)} – ${d2.toLocaleDateString(locale, { ...opts, year: "numeric" })}`;
}

interface Props {
  /** Lunes de la semana visible ("YYYY-MM-DD"); se muestra aunque no exista horario */
  semanaInicio: string;
  schedule: Schedule | null;
  onPrev: () => void;
  onNext: () => void;
  /** Vuelve a la semana actual; el botón se oculta si ya se está en ella */
  onToday?: () => void;
  isCurrentWeek?: boolean;
  canGoNext?: boolean;
  canGoPrev?: boolean;
}

export default function SemanaNav({
  semanaInicio, schedule, onPrev, onNext, onToday, isCurrentWeek = false, canGoNext = true, canGoPrev = true,
}: Props) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border bg-card px-2 py-1.5 sm:px-4 sm:py-2.5">
      <Button variant="ghost" size="icon" onClick={onPrev} disabled={!canGoPrev} aria-label="Semana anterior">
        <ChevronLeft className="h-4 w-4" />
      </Button>

      <div className="flex flex-wrap items-center justify-center gap-2 text-sm font-medium" aria-live="polite">
        <CalendarDays className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
        <span>{fmtSemana(semanaInicio)}</span>
        {schedule ? (
          <Badge variant={schedule.estado === "publicado" ? "default" : "secondary"} className="text-xs">
            {schedule.estado === "publicado" ? "Publicado" : "Borrador"}
          </Badge>
        ) : (
          <Badge variant="outline" className="text-xs font-normal">Sin programar</Badge>
        )}
        {onToday && !isCurrentWeek && (
          <Button variant="outline" size="sm" className="h-7 px-2 text-xs" onClick={onToday}>
            Hoy
          </Button>
        )}
      </div>

      <Button variant="ghost" size="icon" onClick={onNext} disabled={!canGoNext} aria-label="Semana siguiente">
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  );
}
