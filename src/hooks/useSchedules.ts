// ============================================================
// MÓDULO HORARIOS — Hooks de lectura y mutación
// FIX: useCampana() expone campanaActiva, no campanaId directamente.
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
  getWeekStart,
  getWeekEnd,
  toISODate,
  canManageSchedules,
} from "@/types/schedules";

// Helper interno
function useCampanaId(): string | null {
  const { campanaActiva } = useCampana();
  return campanaActiva?.id ?? null;
}

// ------------------------------------------------------------
// Tipo de agente para la grilla
// ------------------------------------------------------------
export interface AgenteBasico {
  user_id: string;
  nombre: string;
}

// ------------------------------------------------------------
// 0. Agentes de la campaña activa (FIX PRINCIPAL)
//    Permite mostrar filas en SemanaGrid aunque no haya turnos aún.
// ------------------------------------------------------------
export function useCampanaAgentes() {
  const campanaId = useCampanaId();
  const { roles } = useAuth();
  const isManager = canManageSchedules(roles);

  return useQuery<AgenteBasico[]>({
    queryKey: ["campana_agentes", campanaId],
    enabled: !!campanaId && isManager,
    staleTime: 5 * 60 * 1000, // 5 min — la lista de agentes no cambia frecuentemente
    queryFn: async () => {
      // profiles tiene campana_id + role. Traemos los agentes de esta campaña.
      const { data, error } = await supabase
        .from("profiles")
        .select("user_id, nombre")
        .eq("campana_id", campanaId!)
        .eq("role", "agent")
        .eq("activo", true)
        .order("nombre");
      if (error) throw error;
      return data as AgenteBasico[];
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
// 3. Schedule de la semana actual (o la semana de una fecha dada)
// [B13] Incluir semana_fin en queryKey para invalidación correcta
// ------------------------------------------------------------
export function useCurrentSchedule(fecha?: Date) {
  const campanaId = useCampanaId();
  const ref = fecha ?? new Date();
  const semana_inicio = toISODate(getWeekStart(ref));
  const semana_fin    = toISODate(getWeekEnd(getWeekStart(ref)));

  return useQuery<Schedule | null>({
    // [B13] semana_fin incluida en la key para detectar drift de migración
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
// 4. Turnos de una semana completa (solo managers)
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
// 5. Turnos propios del agente autenticado
// [B1/B3] retry:1 para que errores de RLS sean manejables en el componente
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
// 6. Novedades (managers ven todo, agente solo las suyas)
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
// 7. Cobertura intradiaria por franja de 15 min
// [B9] Rango dinámico basado en min/max de hora_inicio/fin del día
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

      const shifts = data ?? [];

      // [B9] Calcular rango dinámico: mínimo 07:00, máximo 18:00
      let rangeStartMin = 7 * 60;
      let rangeEndMin   = 18 * 60;

      for (const shift of shifts) {
        if (shift.hora_inicio) {
          const [h, m] = shift.hora_inicio.split(":").map(Number);
          rangeStartMin = Math.min(rangeStartMin, h * 60 + m);
        }
        if (shift.hora_fin) {
          const [h, m] = shift.hora_fin.split(":").map(Number);
          rangeEndMin = Math.max(rangeEndMin, h * 60 + m);
        }
      }

      rangeStartMin = Math.floor(rangeStartMin / 15) * 15;
      rangeEndMin   = Math.ceil(rangeEndMin / 15) * 15;

      const slots: Record<string, number> = {};
      for (let min = rangeStartMin; min < rangeEndMin; min += 15) {
        const h = Math.floor(min / 60);
        const m = min % 60;
        const key = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
        slots[key] = 0;
      }

      for (const shift of shifts) {
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

// ------------------------------------------------------------
// 8. Mutación: crear semana programada (B6)
// ------------------------------------------------------------
export function useCreateSchedule() {
  const qc = useQueryClient();
  const campanaId = useCampanaId();

  return useMutation({
    mutationFn: async (payload: CreateSchedulePayload) => {
      const { data, error } = await supabase
        .from("schedules")
        .insert(payload)
        .select()
        .single();
      if (error) throw error;
      return data as Schedule;
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["schedules", campanaId] });
      qc.invalidateQueries({
        queryKey: ["schedules", campanaId, data.semana_inicio],
      });
    },
  });
}

// ------------------------------------------------------------
// 9. Mutación: publicar semana (B6)
// ------------------------------------------------------------
export function usePublishSchedule() {
  const qc = useQueryClient();
  const campanaId = useCampanaId();

  return useMutation({
    mutationFn: async (scheduleId: string) => {
      const { data, error } = await supabase
        .from("schedules")
        .update({ estado: "publicado" })
        .eq("id", scheduleId)
        .select()
        .single();
      if (error) throw error;
      return data as Schedule;
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["schedules", campanaId] });
      qc.invalidateQueries({
        queryKey: ["schedules", campanaId, data.semana_inicio],
      });
    },
  });
}
