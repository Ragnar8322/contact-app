// ============================================================
// Página: /mi-horario
// Acceso: agent (solo lectura de turno propio)
// Estado: Fase 3 — placeholder. UI completa en Fase 5.
// ============================================================
import { Clock } from "lucide-react";

export default function MiHorario() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-muted-foreground">
      <Clock className="h-12 w-12 opacity-30" />
      <div className="text-center">
        <h1 className="text-2xl font-semibold text-foreground">Mi Horario</h1>
        <p className="mt-1 text-sm">
          Tu turno semanal — en construcción
        </p>
      </div>
    </div>
  );
}
