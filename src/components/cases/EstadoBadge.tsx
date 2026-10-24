import { ArrowRightLeft, Lock } from "lucide-react";
import { getEstadoInlineStyle } from "@/lib/estadoColors";

/** Etiqueta de estado de un caso, con el mismo aspecto en todas las pantallas. */
export function EstadoBadge({ nombre, showLock = false }: { nombre: string | null | undefined; showLock?: boolean }) {
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap"
      style={getEstadoInlineStyle(nombre)}
    >
      {showLock && <Lock className="h-3 w-3" aria-label="Cerrado" />}
      {nombre === "Transferido" && <ArrowRightLeft className="h-3 w-3" aria-hidden="true" />}
      {nombre || "—"}
    </span>
  );
}
