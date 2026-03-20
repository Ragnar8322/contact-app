// ============================================================
// AprobacionesPanel — Supervisor / Admin revisan novedades
// Visible en la página /horarios (panel de gestión)
// ============================================================
import { useState } from "react";
import { CheckCircle2, XCircle, Hourglass, RefreshCw } from "lucide-react";
import { useAllNovedades, useReviewNovedad } from "@/hooks/useSchedules";
import { NOVEDAD_LABELS, EstadoNovedad } from "@/types/schedules";
import { Button }   from "@/components/ui/button";
import { Badge }    from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import {
  Select, SelectContent, SelectItem,
  SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

type FiltroEstado = "todos" | EstadoNovedad;

const ESTADO_BADGE: Record<EstadoNovedad, string> = {
  pendiente: "bg-yellow-100 text-yellow-800 border-yellow-300",
  aprobado:  "bg-green-100 text-green-800 border-green-300",
  rechazado: "bg-red-100 text-red-800 border-red-300",
};

export default function AprobacionesPanel() {
  const { toast } = useToast();
  const [filtro, setFiltro] = useState<FiltroEstado>("pendiente");

  const { data: novedades, isLoading, refetch, isFetching } =
    useAllNovedades(filtro === "todos" ? undefined : filtro);

  const { mutate: review, isPending: reviewing } = useReviewNovedad();

  function handleReview(novedadId: string, estado: "aprobado" | "rechazado") {
    review(
      { novedadId, estado },
      {
        onSuccess: () => {
          toast({
            title: estado === "aprobado" ? "Novedad aprobada" : "Novedad rechazada",
            description: estado === "aprobado"
              ? "El agente será notificado."
              : "La solicitud fue rechazada.",
          });
        },
        onError: (e) => {
          toast({ title: "Error", description: (e as Error).message, variant: "destructive" });
        },
      }
    );
  }

  return (
    <div className="space-y-4">
      {/* Encabezado y filtros */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold">Novedades y permisos</h2>
          <p className="text-xs text-muted-foreground">
            Revisa, aprueba o rechaza las solicitudes de los agentes.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={filtro} onValueChange={(v) => setFiltro(v as FiltroEstado)}>
            <SelectTrigger className="w-36 h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todas</SelectItem>
              <SelectItem value="pendiente">Pendientes</SelectItem>
              <SelectItem value="aprobado">Aprobadas</SelectItem>
              <SelectItem value="rechazado">Rechazadas</SelectItem>
            </SelectContent>
          </Select>
          <Button
            variant="ghost" size="icon" className="h-8 w-8"
            onClick={() => refetch()}
            disabled={isFetching}
            title="Actualizar"
          >
            <RefreshCw className={cn("h-4 w-4", isFetching && "animate-spin")} />
          </Button>
        </div>
      </div>

      {/* Lista */}
      {isLoading ? (
        <div className="space-y-2">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}
        </div>
      ) : !novedades || novedades.length === 0 ? (
        <div className="rounded-lg border border-dashed px-4 py-8 text-center">
          <Hourglass className="mx-auto h-7 w-7 text-muted-foreground/40 mb-2" />
          <p className="text-sm text-muted-foreground">
            {filtro === "pendiente"
              ? "No hay solicitudes pendientes."
              : "No se encontraron novedades con ese filtro."}
          </p>
        </div>
      ) : (
        <div className="divide-y rounded-lg border overflow-hidden">
          {novedades.map((n) => {
            const fechaLabel = new Date(n.fecha + "T12:00:00").toLocaleDateString("es-CO", {
              weekday: "short", day: "numeric", month: "short", year: "numeric",
            });
            const nombreAgente = n.agente?.nombre ?? "Agente desconocido";

            return (
              <div key={n.id} className="flex flex-wrap items-center gap-3 px-4 py-3 bg-background hover:bg-muted/30 transition-colors">
                {/* Info izquierda */}
                <div className="flex-1 min-w-0 space-y-0.5">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-sm font-medium truncate">{nombreAgente}</span>
                    <Badge variant="outline" className="text-xs shrink-0">
                      {NOVEDAD_LABELS[n.tipo_novedad]}
                    </Badge>
                    <span
                      className={cn(
                        "text-xs font-medium border rounded px-1.5 py-0.5 shrink-0",
                        ESTADO_BADGE[n.estado]
                      )}
                    >
                      {n.estado.charAt(0).toUpperCase() + n.estado.slice(1)}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <span className="capitalize">{fechaLabel}</span>
                    {n.es_dia_completo ? (
                      <span>· Día completo</span>
                    ) : n.hora_inicio_novedad && n.hora_fin_novedad ? (
                      <span>
                        · {n.hora_inicio_novedad.slice(0, 5)} – {n.hora_fin_novedad.slice(0, 5)}
                        {n.duracion_minutos ? ` (${n.duracion_minutos} min)` : ""}
                      </span>
                    ) : null}
                    {n.descripcion && (
                      <span className="truncate max-w-[200px]">· {n.descripcion}</span>
                    )}
                  </div>
                </div>

                {/* Acciones solo para pendientes */}
                {n.estado === "pendiente" && (
                  <div className="flex items-center gap-2 shrink-0">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 gap-1 text-xs border-green-400 text-green-700 hover:bg-green-50"
                      disabled={reviewing}
                      onClick={() => handleReview(n.id, "aprobado")}
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Aprobar
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 gap-1 text-xs border-red-400 text-red-700 hover:bg-red-50"
                      disabled={reviewing}
                      onClick={() => handleReview(n.id, "rechazado")}
                    >
                      <XCircle className="h-3.5 w-3.5" />
                      Rechazar
                    </Button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
