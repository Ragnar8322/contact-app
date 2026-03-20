// ============================================================
// Página /horarios — admin | supervisor | gerente
// FIX: useCampana() expone campanaActiva, no campanaId.
// ============================================================
import { useState, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useCampana } from "@/contexts/CampanaContext";
import {
  useCurrentSchedule,
  useScheduleShifts,
  useCreateSchedule,
  usePublishSchedule,
  useCampanaAgentes,
} from "@/hooks/useSchedules";
import {
  getWeekStart, getWeekEnd, toISODate,
} from "@/types/schedules";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import SemanaNav   from "@/components/schedules/SemanaNav";
import SemanaGrid  from "@/components/schedules/SemanaGrid";
import CoverageBar from "@/components/schedules/CoverageBar";
import { Button }  from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { CalendarDays, Plus, Send } from "lucide-react";

const DIAS_SEMANA = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

export default function Horarios() {
  const { isAdmin, isSupervisor } = useAuth();
  const { campanaActiva } = useCampana();
  const campanaId = campanaActiva?.id ?? null;

  const { toast } = useToast();
  const qc = useQueryClient();

  const [refDate, setRefDate] = useState(() => getWeekStart(new Date()));
  const semanaInicio = toISODate(refDate);
  const semanaFin    = toISODate(getWeekEnd(refDate));

  const { data: schedule,  isLoading: loadingSched  } = useCurrentSchedule(refDate);
  const { data: shifts,    isLoading: loadingShifts } = useScheduleShifts(schedule?.id);
  // FIX: cargar agentes de la campaña independientemente de los turnos
  const { data: agentes,   isLoading: loadingAgentes } = useCampanaAgentes();

  // [B4] Estado para el día seleccionado en CoverageBar (0=Lun, 6=Dom)
  const [coberturaDiaIdx, setCoberturaDiaIdx] = useState(0);
  const coberturaFecha = (() => {
    const d = new Date(semanaInicio + "T12:00:00");
    d.setDate(d.getDate() + coberturaDiaIdx);
    return d.toISOString().slice(0, 10);
  })();

  const canEdit = isAdmin || isSupervisor;

  // [B6] Mutaciones via React Query
  const { mutate: crearSemana,   isPending: creando    } = useCreateSchedule();
  const { mutate: publicarSemana, isPending: publicando } = usePublishSchedule();

  function prevSemana() {
    setRefDate(d => { const n = new Date(d); n.setDate(n.getDate() - 7); return n; });
    setCoberturaDiaIdx(0);
  }
  function nextSemana() {
    setRefDate(d => { const n = new Date(d); n.setDate(n.getDate() + 7); return n; });
    setCoberturaDiaIdx(0);
  }

  const handleCrearSemana = useCallback(() => {
    if (!campanaId) {
      toast({ title: "Error", description: "No hay campaña activa seleccionada.", variant: "destructive" });
      return;
    }
    crearSemana(
      { campana_id: campanaId, semana_inicio: semanaInicio, semana_fin: semanaFin },
      {
        onSuccess: () => toast({ title: "Semana creada ✅" }),
        onError: (err: Error) => toast({ title: "Error al crear semana", description: err.message, variant: "destructive" }),
      }
    );
  }, [campanaId, semanaInicio, semanaFin, toast, crearSemana]);

  const handlePublicar = useCallback(() => {
    if (!schedule) return;
    publicarSemana(schedule.id, {
      onSuccess: () => toast({ title: "Semana publicada 📢" }),
      onError: (err: Error) => toast({ title: "Error al publicar", description: err.message, variant: "destructive" }),
    });
  }, [schedule, publicarSemana, toast]);

  // [B7] Invalidar queries en lugar de llamar refetch()
  const handleShiftSaved = useCallback(() => {
    qc.invalidateQueries({ queryKey: ["schedule_shifts", schedule?.id] });
  }, [qc, schedule?.id]);

  const isLoading = loadingSched || loadingShifts || loadingAgentes;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Módulo Horarios</h1>
          <p className="text-sm text-muted-foreground">
            Gestión de turnos semanales
            {campanaActiva ? ` — ${campanaActiva.nombre}` : ""}
          </p>
        </div>
        {canEdit && (
          <div className="flex gap-2">
            {!loadingSched && !schedule && (
              <Button size="sm" onClick={handleCrearSemana} disabled={!campanaId || creando}>
                <Plus className="mr-1 h-4 w-4" />
                {creando ? "Creando..." : "Crear semana"}
              </Button>
            )}
            {schedule && schedule.estado === "borrador" && (
              <Button size="sm" onClick={handlePublicar} disabled={publicando}>
                <Send className="mr-1 h-4 w-4" />
                {publicando ? "Publicando..." : "Publicar semana"}
              </Button>
            )}
          </div>
        )}
      </div>

      <SemanaNav
        schedule={schedule ?? null}
        onPrev={prevSemana}
        onNext={nextSemana}
      />

      {isLoading ? (
        <div className="space-y-2">
          {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}
        </div>
      ) : schedule ? (
        <SemanaGrid
          agentes={agentes ?? []}
          shifts={shifts ?? []}
          semanaInicio={semanaInicio}
          scheduleId={schedule.id}
          editable={canEdit}
          onShiftSaved={handleShiftSaved}
        />
      ) : (
        <div className="flex flex-col items-center justify-center min-h-[40vh] gap-3 text-muted-foreground">
          <CalendarDays className="h-10 w-10 opacity-30" />
          <p className="text-sm">No hay semana programada. Crea una para comenzar.</p>
        </div>
      )}

      {/* [B4] Selector de día para CoverageBar */}
      {schedule && (
        <div className="space-y-2">
          <div className="flex gap-1 flex-wrap">
            {DIAS_SEMANA.map((dia, i) => (
              <Button
                key={dia}
                size="sm"
                variant={coberturaDiaIdx === i ? "default" : "outline"}
                className="text-xs h-7 px-2"
                onClick={() => setCoberturaDiaIdx(i)}
              >
                {dia}
              </Button>
            ))}
          </div>
          <CoverageBar
            scheduleId={schedule.id}
            fecha={coberturaFecha}
          />
        </div>
      )}
    </div>
  );
}
