// ============================================================
// Página /mi-horario — agent (solo lectura)
// Fase 5: UI completa — turno de la semana actual
// ============================================================
import MiHorarioView from "@/components/schedules/MiHorarioView";
import { useCampana } from "@/contexts/CampanaContext";

export default function MiHorario() {
  const { campanaActiva } = useCampana();

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Mi Horario</h1>
        <p className="text-muted-foreground">
          Tus turnos y novedades{campanaActiva ? ` — ${campanaActiva.nombre}` : ""}
        </p>
      </div>
      <MiHorarioView />
    </div>
  );
}
