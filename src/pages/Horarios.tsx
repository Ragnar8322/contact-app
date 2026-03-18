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
} from "@/hooks/useSchedules";
import {
  getWeekStart, getWeekEnd, toISODate,
} from "@/types/schedules";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import SemanaNav   from "@/components/schedules/SemanaNav";
import SemanaGrid  from "@/components/schedules/SemanaGrid";
import CoverageBar from "@/components/schedules/CoverageBar";
import { Button }  from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { CalendarDays, Plus, Send } from "lucide-react";

export default function Horarios() {
  const { isAdmin, isSupervisor } = useAuth();
  // FIX: destructurar campanaActiva, no campanaId (no existe en el contexto)
  const { campanaActiva } = useCampana();
  const campanaId = campanaActiva?.id ?? null;

  const { toast } = useToast();
  const qc = useQueryClient();

  const [refDate, setRefDate] = useState(() => getWeekStart(new Date()));
  const semanaInicio = toISODate(refDate);
  const semanaFin    = toISODate(getWeekEnd(refDate));

  const { data: schedule, isLoading: loadingSched } = useCurrentSchedule(refDate);
  const { data: shifts,   isLoading: loadingShifts, refetch } = useScheduleShifts(schedule?.id);

  const coberturaFecha = semanaInicio;
  const canEdit = isAdmin || isSupervisor;

  function prevSemana() {
    setRefDate(d => { const n = new Date(d); n.setDate(n.getDate() - 7); return n; });
  }
  function nextSemana() {
    setRefDate(d => { const n = new Date(d); n.setDate(n.getDate() + 7); return n; });
  }

  const handleCrearSemana = useCallback(async () => {
    if (!campanaId) {
      toast({ title: "Error", description: "No hay campaña activa seleccionada.", variant: "destructive" });
      return;
    }
    const { error } = await supabase.from("schedules").insert({
      campana_id:    campanaId,
      semana_inicio: semanaInicio,
      semana_fin:    semanaFin,
      estado:        "borrador",
    });
    if (error) {
      toast({ title: "Error al crear semana", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Semana creada ✅" });
      qc.invalidateQueries({ queryKey: ["schedules", campanaId, semanaInicio] });
    }
  }, [campanaId, semanaInicio, semanaFin, toast, qc]);

  const handlePublicar = useCallback(async () => {
    if (!schedule) return;
    const { error } = await supabase
      .from("schedules")
      .update({ estado: "publicado" })
      .eq("id", schedule.id);
    if (error) {
      toast({ title: "Error al publicar", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Semana publicada 📢" });
      qc.invalidateQueries({ queryKey: ["schedules", campanaId, semanaInicio] });
    }
  }, [schedule, campanaId, semanaInicio, toast, qc]);

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
              <Button size="sm" onClick={handleCrearSemana} disabled={!campanaId}>
                <Plus className="mr-1 h-4 w-4" /> Crear semana
              </Button>
            )}
            {schedule && schedule.estado === "borrador" && (
              <Button size="sm" onClick={handlePublicar}>
                <Send className="mr-1 h-4 w-4" /> Publicar semana
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

      {loadingSched || loadingShifts ? (
        <div className="space-y-2">
          {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}
        </div>
      ) : schedule ? (
        <SemanaGrid
          shifts={shifts ?? []}
          semanaInicio={semanaInicio}
          scheduleId={schedule.id}
          editable={canEdit}
          onShiftSaved={() => refetch()}
        />
      ) : (
        <div className="flex flex-col items-center justify-center min-h-[40vh] gap-3 text-muted-foreground">
          <CalendarDays className="h-10 w-10 opacity-30" />
          <p className="text-sm">No hay semana programada. Crea una para comenzar.</p>
        </div>
      )}

      {schedule && (
        <CoverageBar
          scheduleId={schedule.id}
          fecha={coberturaFecha}
        />
      )}
    </div>
  );
}
