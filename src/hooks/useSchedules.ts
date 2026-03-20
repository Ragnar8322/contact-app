// ============================================================
// MÓDULO HORARIOS — Hooks de lectura y mutación
// ============================================================

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useCampana } from "@/contexts/CampanaContext";
import {
  ShiftType,
  Schedule,
  ScheduleShift,
  ScheduleNovedad,
  CreateSchedulePayload,
  CreateNovedadPayload,
  getWeekStart,
  getWeekEnd,
  toISODate,
  canManageSchedules,
} from "@/types/schedules";

function useCampanaId(): string | null {
  const { campanaActiva } = useCampana();
  return campanaActiva?.id ?? null;
}

// ------------------------------------------------------------
// Tipos exportados
// ------------------------------------------------------------
export interface AgenteBasico {
  user_id: string;
  nombre: string;
}

export interface GenerateScheduleParams {
  schedule_id:       string;
  hora_inicio:       string;   // "HH:MM"
  hora_fin:          string;   // "HH:MM"
  dia_libre_base:    number;   // 0=Lun … 6=Dom
  duracion_almuerzo: number;   // minutos
  skip_existing:     boolean;
  tipo_actividad:    string;   // GAP | Tele | Calidad | Apoyo | VIP
}

// ------------------------------------------------------------
// 0. Agentes de la campaña activa
// ------------------------------------------------------------
export function useCampanaAgentes() {
  const campanaId = useCampanaId();
  const { roles } = useAuth();
  const isManager = canManageSchedules(roles);

  return useQuery<AgenteBasico[]>({
    queryKey: ["campana_agentes", campanaId],
    enabled: !!campanaId && isManager,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .rpc("get_agentes_by_campana", { _campana_id: campanaId! });
      if (error) throw error;
      return (data ?? []) as AgenteBasico[];
    },
  });
}

// ------------------------------------------------------------
// 1. Tipos de turno de la campaña activa
// ------------------------------------------------------------
export function useShiftTypes() {
  const campanaId = useCampanaId();

  return useQuery<ShiftType[]>({
    queryKey: ["shift_types", campanaId],
    enabled: !!campanaId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("shift_types")
        .select("*")
        .eq("campana_id", campanaId!)
        .eq("activo", true)
        .order("hora_inicio");
      if (error) throw error;
      return data as ShiftType[];
    },
  });
}

// ------------------------------------------------------------
// 2. Schedules de la campaña activa
// ------------------------------------------------------------
export function useSchedules() {
  const campanaId = useCampanaId();

  return useQuery<Schedule[]>({
    queryKey: ["schedules", campanaId],
    enabled: !!campanaId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("schedules")
        .select("*")
        .eq("campana_id", campanaId!)
        .order("semana_inicio", { ascending: false })
        .limit(12);
      if (error) throw error;
      return data as Schedule[];
    },
  });
}

// ------------------------------------------------------------
// 3. Schedule de la semana actual
// ------------------------------------------------------------
export function useCurrentSchedule(fecha?: Date) {
  const campanaId = useCampanaId();
  const ref = fecha ?? new Date();
  const semana_inicio = toISODate(getWeekStart(ref));
  const semana_fin    = toISODate(getWeekEnd(getWeekStart(ref)));

  return useQuery<Schedule | null>({
    queryKey: ["schedules", campanaId, semana_inicio, semana_fin],
    enabled: !!campanaId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("schedules")
        .select("*")
        .eq("campana_id", campanaId!)
        .eq("semana_inicio", semana_inicio)
        .maybeSingle();
      if (error) throw error;
      return data as Schedule | null;
    },
    meta: { semana_inicio, semana_fin },
  });
}

// ------------------------------------------------------------
// 4. Turnos de una semana completa
// ------------------------------------------------------------
export function useScheduleShifts(scheduleId: string | null | undefined) {
  const { roles } = useAuth();
  const isManager = canManageSchedules(roles);

  return useQuery<ScheduleShift[]>({
    queryKey: ["schedule_shifts", scheduleId],
    enabled: !!scheduleId && isManager,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("schedule_shifts")
        .select(`*, agente:profiles!schedule_shifts_agente_id_fkey(user_id, nombre)`)
        .eq("schedule_id", scheduleId!)
        .order("fecha")
        .order("hora_inicio");
      if (error) throw error;
      return data as ScheduleShift[];
    },
  });
}

// ------------------------------------------------------------
// 5. Turnos propios del agente
// ------------------------------------------------------------
export function useMyShifts(scheduleId: string | null | undefined) {
  const { user } = useAuth();

  return useQuery<ScheduleShift[]>({
    queryKey: ["my_shifts", scheduleId, user?.id],
    enabled: !!scheduleId && !!user?.id,
    retry: 1,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("schedule_shifts")
        .select("*")
        .eq("schedule_id", scheduleId!)
        .eq("agente_id", user!.id)
        .order("fecha");
      if (error) throw error;
      return data as ScheduleShift[];
    },
  });
}

// ------------------------------------------------------------
// 6. Novedades
// ------------------------------------------------------------
export function useScheduleNovedades(scheduleId: string | null | undefined) {
  const { user, roles } = useAuth();
  const isManager = canManageSchedules(roles);

  return useQuery<ScheduleNovedad[]>({
    queryKey: ["schedule_novedades", scheduleId, isManager],
    enabled: !!scheduleId && !!user?.id,
    queryFn: async () => {
      let query = supabase
        .from("schedule_novedades")
        .select("*")
        .eq("schedule_id", scheduleId!)
        .order("fecha");
      if (!isManager) query = query.eq("agente_id", user!.id);
      const { data, error } = await query;
      if (error) throw error;
      return data as ScheduleNovedad[];
    },
  });
}

// ------------------------------------------------------------
// 7. Cobertura intradiaria
// ------------------------------------------------------------
export function useCoverageBySlot(
  scheduleId: string | null | undefined,
  fecha: string | null | undefined
) {
  const { roles } = useAuth();
  const isManager = canManageSchedules(roles);

  return useQuery<Record<string, number>>({
    queryKey: ["coverage_slots", scheduleId, fecha],
    enabled: !!scheduleId && !!fecha && isManager,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("schedule_shifts")
        .select("hora_inicio, hora_fin, tipo_actividad")
        .eq("schedule_id", scheduleId!)
        .eq("fecha", fecha!)
        .not("tipo_actividad", "in", '("Descanso","Vacaciones","Incapacidad","No_aplica")');
      if (error) throw error;

      const shifts = data ?? [];
      let rangeStartMin = 7 * 60, rangeEndMin = 18 * 60;
      for (const s of shifts) {
        if (s.hora_inicio) { const [h,m] = s.hora_inicio.split(":").map(Number); rangeStartMin = Math.min(rangeStartMin, h*60+m); }
        if (s.hora_fin)    { const [h,m] = s.hora_fin.split(":").map(Number);    rangeEndMin   = Math.max(rangeEndMin,   h*60+m); }
      }
      rangeStartMin = Math.floor(rangeStartMin / 15) * 15;
      rangeEndMin   = Math.ceil(rangeEndMin   / 15) * 15;

      const slots: Record<string, number> = {};
      for (let min = rangeStartMin; min < rangeEndMin; min += 15) {
        const key = `${String(Math.floor(min/60)).padStart(2,"0")}:${String(min%60).padStart(2,"0")}`;
        slots[key] = 0;
      }
      for (const s of shifts) {
        if (!s.hora_inicio || !s.hora_fin) continue;
        const [sh,sm] = s.hora_inicio.split(":").map(Number);
        const [eh,em] = s.hora_fin.split(":").map(Number);
        const startMin = sh*60+sm, endMin = eh*60+em;
        for (const key of Object.keys(slots)) {
          const [kh,km] = key.split(":").map(Number);
          if (kh*60+km >= startMin && kh*60+km < endMin) slots[key]++;
        }
      }
      return slots;
    },
  });
}

// ------------------------------------------------------------
// 8. Mutación: crear semana
// ------------------------------------------------------------
export function useCreateSchedule() {
  const qc = useQueryClient();
  const campanaId = useCampanaId();

  return useMutation({
    mutationFn: async (payload: CreateSchedulePayload) => {
      const { data, error } = await supabase.from("schedules").insert(payload).select().single();
      if (error) throw error;
      return data as Schedule;
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["schedules", campanaId] });
      qc.invalidateQueries({ queryKey: ["schedules", campanaId, data.semana_inicio] });
    },
  });
}

// ------------------------------------------------------------
// 9. Mutación: publicar / regresar a borrador
// ------------------------------------------------------------
export function usePublishSchedule() {
  const qc = useQueryClient();
  const campanaId = useCampanaId();

  return useMutation({
    mutationFn: async ({ scheduleId, estado }: { scheduleId: string; estado: "borrador" | "publicado" }) => {
      const { data, error } = await supabase
        .from("schedules").update({ estado })
        .eq("id", scheduleId).select().single();
      if (error) throw error;
      return data as Schedule;
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["schedules", campanaId] });
      qc.invalidateQueries({ queryKey: ["schedules", campanaId, data.semana_inicio] });
    },
  });
}

// ------------------------------------------------------------
// 10. Mutación: copiar semana anterior
// ------------------------------------------------------------
export function useCopyPreviousWeek() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (scheduleId: string): Promise<number> => {
      const { data, error } = await supabase
        .rpc("copy_previous_week_shifts", { _dest_schedule_id: scheduleId });
      if (error) throw error;
      return (data as number) ?? 0;
    },
    onSuccess: (_count, scheduleId) => {
      qc.invalidateQueries({ queryKey: ["schedule_shifts", scheduleId] });
    },
  });
}

// ------------------------------------------------------------
// 11. Mutación: generar horario inteligente
// ------------------------------------------------------------
export function useGenerateSchedule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: GenerateScheduleParams): Promise<number> => {
      const { data, error } = await supabase.rpc("generate_schedule", {
        _schedule_id:       params.schedule_id,
        _hora_inicio:       params.hora_inicio,
        _hora_fin:          params.hora_fin,
        _dia_libre_base:    params.dia_libre_base,
        _duracion_almuerzo: params.duracion_almuerzo,
        _skip_existing:     params.skip_existing,
        _tipo_actividad:    params.tipo_actividad,
      });
      if (error) throw error;
      return (data as number) ?? 0;
    },
    onSuccess: (_count, params) => {
      qc.invalidateQueries({ queryKey: ["schedule_shifts", params.schedule_id] });
    },
  });
}

// ------------------------------------------------------------
// 12. Novedades — todas las campañas (panel de aprobaciones)
// ------------------------------------------------------------
export interface NovedadConAgente extends ScheduleNovedad {
  agente: { nombre: string; user_id: string } | null;
}

export function useAllNovedades(estado?: "pendiente" | "aprobado" | "rechazado") {
  const { user, roles } = useAuth();
  const campanaId = useCampanaId();
  const isManager = canManageSchedules(roles);

  return useQuery<NovedadConAgente[]>({
    queryKey: ["all_novedades", campanaId, estado],
    enabled: !!campanaId && isManager && !!user?.id,
    queryFn: async () => {
      let query = supabase
        .from("schedule_novedades")
        .select(`
          *,
          agente:profiles!schedule_novedades_agente_id_fkey(user_id, nombre)
        `)
        .order("created_at", { ascending: false })
        .limit(200);

      if (estado) query = query.eq("estado", estado);

      // Filtrar por campaña a través de schedules
      const { data: schedIds } = await supabase
        .from("schedules")
        .select("id")
        .eq("campana_id", campanaId!);

      const ids = (schedIds ?? []).map((s) => s.id);
      if (ids.length === 0) return [];

      query = query.in("schedule_id", ids);
      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as NovedadConAgente[];
    },
  });
}

// ------------------------------------------------------------
// 13. Mutación: crear novedad (agente o manager)
// ------------------------------------------------------------
export function useCreateNovedad() {
  const qc = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (payload: CreateNovedadPayload): Promise<ScheduleNovedad> => {
      const { data, error } = await supabase
        .from("schedule_novedades")
        .insert({
          ...payload,
          agente_id: payload.agente_id || user!.id,
          estado: "pendiente",
        })
        .select()
        .single();
      if (error) throw error;
      return data as ScheduleNovedad;
    },
    onSuccess: (_data, payload) => {
      qc.invalidateQueries({ queryKey: ["schedule_novedades", payload.schedule_id] });
      qc.invalidateQueries({ queryKey: ["all_novedades"] });
    },
  });
}

// ------------------------------------------------------------
// 14. Mutación: aprobar / rechazar novedad (supervisor / admin)
// ------------------------------------------------------------
export function useReviewNovedad() {
  const qc = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({
      novedadId,
      estado,
    }: {
      novedadId: string;
      estado: "aprobado" | "rechazado";
    }): Promise<ScheduleNovedad> => {
      const { data, error } = await supabase
        .from("schedule_novedades")
        .update({ estado, revisado_por: user!.id })
        .eq("id", novedadId)
        .select()
        .single();
      if (error) throw error;
      return data as ScheduleNovedad;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["all_novedades"] });
      qc.invalidateQueries({ queryKey: ["schedule_novedades"] });
    },
  });
}

// ------------------------------------------------------------
// 15. Mutación: eliminar todos los turnos (Reset)
// ------------------------------------------------------------
export function useResetSchedule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (scheduleId: string): Promise<number> => {
      const { data, error } = await supabase
        .rpc("reset_schedule_shifts", { _schedule_id: scheduleId });
      if (error) throw error;
      return (data as number) ?? 0;
    },
    onSuccess: (_count, scheduleId) => {
      qc.invalidateQueries({ queryKey: ["schedule_shifts", scheduleId] });
    },
  });
}
