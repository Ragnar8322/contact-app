// ============================================================
// Página /mi-horario — agent (solo lectura)
// Fase 5: UI completa — turno de la semana actual
// ============================================================
import { Clock } from "lucide-react";
import MiHorarioView from "@/components/schedules/MiHorarioView";
import { useCampana } from "@/contexts/CampanaContext";

export default function MiHorario() {
  const { campanaActiva } = useCampana();

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <Clock className="h-5 w-5 text-muted-foreground" />
        <div>
          <h1 className="text-xl font-semibold">Mi Horario</h1>
          <p className="text-sm text-muted-foreground">
            Semana actual{campanaActiva ? ` — ${campanaActiva.nombre}` : ""}
          </p>
        </div>
      </div>
      <MiHorarioView />
    </div>
  );
}
