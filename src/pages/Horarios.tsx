// ============================================================
// Página /horarios — admin | supervisor | gerente
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
  useCopyPreviousWeek,
} from "@/hooks/useSchedules";
import { getWeekStart, getWeekEnd, toISODate } from "@/types/schedules";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import SemanaNav           from "@/components/schedules/SemanaNav";
import SemanaGrid          from "@/components/schedules/SemanaGrid";
import CoverageBar         from "@/components/schedules/CoverageBar";
import GenerarHorarioModal from "@/components/schedules/GenerarHorarioModal";
import { Button }          from "@/components/ui/button";
import { Skeleton }        from "@/components/ui/skeleton";
import { CalendarDays, Plus, Send, Copy, Sparkles } from "lucide-react";

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

  const { data: schedule,  isLoading: loadingSched   } = useCurrentSchedule(refDate);
  const { data: shifts,    isLoading: loadingShifts  } = useScheduleShifts(schedule?.id);
  const { data: agentes,   isLoading: loadingAgentes } = useCampanaAgentes();

  const [coberturaDiaIdx,    setCoberturaDiaIdx   ] = useState(0);
  const [showGenerarModal,   setShowGenerarModal  ] = useState(false);

  const coberturaFecha = (() => {
    const d = new Date(semanaInicio + "T12:00:00");
    d.setDate(d.getDate() + coberturaDiaIdx);
    return d.toISOString().slice(0, 10);
  })();

  const canEdit = isAdmin || isSupervisor;

  const { mutate: crearSemana,    isPending: creando      } = useCreateSchedule();
  const { mutate: publicarSemana, isPending: publicando   } = usePublishSchedule();
  const { mutate: copiarSemana,   isPending: copiando     } = useCopyPreviousWeek();

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
      toast({ title: "Error", description: "No hay campaña activa.", variant: "destructive" });
      return;
    }
    crearSemana(
      { campana_id: campanaId, semana_inicio: semanaInicio, semana_fin: semanaFin },
      {
        onSuccess: () => toast({ title: "Semana creada ✅" }),
        onError:   (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
      }
    );
  }, [campanaId, semanaInicio, semanaFin, toast, crearSemana]);

  const handlePublicar = useCallback(() => {
    if (!schedule) return;
    publicarSemana(schedule.id, {
      onSuccess: () => toast({ title: "Semana publicada 📢" }),
      onError:   (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
    });
  }, [schedule, publicarSemana, toast]);

  const handleCopiar = useCallback(() => {
    if (!schedule) return;
    copiarSemana(schedule.id, {
      onSuccess: (count) =>
        toast({
          title: count > 0 ? `${count} turnos copiados ✅` : "Sin semana anterior",
          description: count === 0 ? "No existe una semana anterior para copiar." : undefined,
        }),
      onError: (err: Error) => toast({ title: "Error al copiar", description: err.message, variant: "destructive" }),
    });
  }, [schedule, copiarSemana, toast]);

  // [B7] Invalidar queries tras guardar un turno
  const handleShiftSaved = useCallback(() => {
    qc.invalidateQueries({ queryKey: ["schedule_shifts", schedule?.id] });
  }, [qc, schedule?.id]);

  const isLoading = loadingSched || loadingShifts || loadingAgentes;

  return (
    <div className="space-y-5">
      {/* Cabecera */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Módulo Horarios</h1>
          <p className="text-sm text-muted-foreground">
            Gestión de turnos semanales
            {campanaActiva ? ` — ${campanaActiva.nombre}` : ""}
          </p>
        </div>
        {canEdit && (
          <div className="flex flex-wrap gap-2">
            {/* Crear semana */}
            {!loadingSched && !schedule && (
              <Button size="sm" onClick={handleCrearSemana} disabled={!campanaId || creando}>
                <Plus className="mr-1 h-4 w-4" />
                {creando ? "Creando..." : "Crear semana"}
              </Button>
            )}

            {/* Acciones sobre semana en borrador */}
            {schedule && schedule.estado === "borrador" && (
              <>
                {/* Copiar semana anterior */}
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleCopiar}
                  disabled={copiando}
                  title="Copia los turnos de la semana anterior a esta semana"
                >
                  <Copy className="mr-1 h-4 w-4" />
                  {copiando ? "Copiando..." : "Copiar semana anterior"}
                </Button>

                {/* Generar horario inteligente */}
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setShowGenerarModal(true)}
                  className="border-violet-400 text-violet-600 hover:bg-violet-50"
                  title="Genera turnos automáticamente con día libre rotativo y almuerzo escalonado"
                >
                  <Sparkles className="mr-1 h-4 w-4" />
                  Generar horario
                </Button>

                {/* Publicar */}
                <Button size="sm" onClick={handlePublicar} disabled={publicando}>
                  <Send className="mr-1 h-4 w-4" />
                  {publicando ? "Publicando..." : "Publicar semana"}
                </Button>
              </>
            )}
          </div>
        )}
      </div>

      {/* Navegación de semana */}
      <SemanaNav
        schedule={schedule ?? null}
        onPrev={prevSemana}
        onNext={nextSemana}
      />

      {/* Grilla */}
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
          editable={canEdit && schedule.estado === "borrador"}
          onShiftSaved={handleShiftSaved}
        />
      ) : (
        <div className="flex flex-col items-center justify-center min-h-[40vh] gap-3 text-muted-foreground">
          <CalendarDays className="h-10 w-10 opacity-30" />
          <p className="text-sm">No hay semana programada. Crea una para comenzar.</p>
        </div>
      )}

      {/* CoverageBar con selector de día */}
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
          <CoverageBar scheduleId={schedule.id} fecha={coberturaFecha} />
        </div>
      )}

      {/* Modal generación inteligente */}
      {showGenerarModal && schedule && (
        <GenerarHorarioModal
          scheduleId={schedule.id}
          open={showGenerarModal}
          onClose={() => setShowGenerarModal(false)}
          onGenerated={handleShiftSaved}
        />
      )}
    </div>
  );
}
