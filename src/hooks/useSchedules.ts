// ============================================================
// MÓDULO HORARIOS — Hooks de lectura (sin mutaciones)
// Fase 2: Solo queries. Las mutaciones van en Fase 5.
// ============================================================

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useCampana } from "@/contexts/CampanaContext";
import {
  ShiftType,
  Schedule,
  ScheduleShift,
  ScheduleNovedad,
  getWeekStart,
  getWeekEnd,
  toISODate,
  canManageSchedules,
} from "@/types/schedules";

// ------------------------------------------------------------
// 1. Tipos de turno de la campaña activa
// ------------------------------------------------------------
export function useShiftTypes() {
  const { campanaId } = useCampana();

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
// 2. Schedules (semanas) de la campaña activa
// ------------------------------------------------------------
export function useSchedules() {
  const { campanaId } = useCampana();

  return useQuery<Schedule[]>({
    queryKey: ["schedules", campanaId],
    enabled: !!campanaId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("schedules")
        .select("*")
        .eq("campana_id", campanaId!)
        .order("semana_inicio", { ascending: false })
        .limit(12); // máximo 3 meses atrás
      if (error) throw error;
      return data as Schedule[];
    },
  });
}

// ------------------------------------------------------------
// 3. Schedule de la semana actual (o la semana de una fecha dada)
// ------------------------------------------------------------
export function useCurrentSchedule(fecha?: Date) {
  const { campanaId } = useCampana();
  const ref = fecha ?? new Date();
  const semana_inicio = toISODate(getWeekStart(ref));
  const semana_fin    = toISODate(getWeekEnd(getWeekStart(ref)));

  return useQuery<Schedule | null>({
    queryKey: ["schedules", campanaId, semana_inicio],
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
// 4. Turnos de una semana completa (grilla del equipo)
//    Solo disponible para admin / supervisor / gerente.
//    El agente NO llama este hook — usa useMyShifts.
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
        .select(`
          *,
          agente:profiles!schedule_shifts_agente_id_fkey(
            user_id,
            nombre
          )
        `)
        .eq("schedule_id", scheduleId!)
        .order("fecha")
        .order("hora_inicio");
      if (error) throw error;
      return data as ScheduleShift[];
    },
  });
}

// ------------------------------------------------------------
// 5. Turnos propios del agente autenticado (vista reducida)
// ------------------------------------------------------------
export function useMyShifts(scheduleId: string | null | undefined) {
  const { user } = useAuth();

  return useQuery<ScheduleShift[]>({
    queryKey: ["my_shifts", scheduleId, user?.id],
    enabled: !!scheduleId && !!user?.id,
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
// 6. Novedades de una semana (managers ven todo, agente solo las suyas)
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

      // El agente solo ve las suyas (doble garantía sobre la RLS)
      if (!isManager) {
        query = query.eq("agente_id", user!.id);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as ScheduleNovedad[];
    },
  });
}

// ------------------------------------------------------------
// 7. Cobertura intradiaria (agentes activos por franja de 15min)
//    Retorna un mapa: { "HH:MM" -> count }
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
        .neq("tipo_actividad", "Descanso")
        .neq("tipo_actividad", "Vacaciones")
        .neq("tipo_actividad", "Incapacidad")
        .neq("tipo_actividad", "No_aplica");

      if (error) throw error;

      // Construir mapa de slots de 15min: 07:00 → 18:00
      const slots: Record<string, number> = {};
      for (let h = 7; h < 18; h++) {
        for (const m of [0, 15, 30, 45]) {
          const key = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
          slots[key] = 0;
        }
      }

      for (const shift of data ?? []) {
        if (!shift.hora_inicio || !shift.hora_fin) continue;
        const [startH, startM] = shift.hora_inicio.split(":").map(Number);
        const [endH, endM]     = shift.hora_fin.split(":").map(Number);
        const startMin = startH * 60 + startM;
        const endMin   = endH   * 60 + endM;

        for (const key of Object.keys(slots)) {
          const [kH, kM] = key.split(":").map(Number);
          const kMin = kH * 60 + kM;
          if (kMin >= startMin && kMin < endMin) {
            slots[key]++;
          }
        }
      }

      return slots;
    },
  });
}
