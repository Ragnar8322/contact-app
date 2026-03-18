// ============================================================
// Página: /horarios
// Acceso: admin | supervisor | gerente
// Estado: Fase 3 — placeholder. UI completa en Fase 5.
// ============================================================
import { CalendarDays } from "lucide-react";

export default function Horarios() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-muted-foreground">
      <CalendarDays className="h-12 w-12 opacity-30" />
      <div className="text-center">
        <h1 className="text-2xl font-semibold text-foreground">Módulo Horarios</h1>
        <p className="mt-1 text-sm">
          Grilla semanal del equipo — en construcción
        </p>
      </div>
    </div>
  );
}
