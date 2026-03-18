// ============================================================
// MÓDULO HORARIOS — Tipos e interfaces TypeScript
// No importa nada de módulos externos para no romper el build.
// ============================================================

import type { RoleName } from "@/contexts/AuthContext";

// ------------------------------------------------------------
// Actividades (columnas de la malla real CCB)
// ------------------------------------------------------------
export type TipoActividad =
  | "GAP"
  | "Tele"
  | "Calidad"
  | "Apoyo"
  | "VIP"
  | "Descanso"
  | "Vacaciones"
  | "Incapacidad"
  | "No_aplica";

export type EstadoSchedule = "borrador" | "publicado";

export type TipoNovedad =
  | "incapacidad"
  | "permiso_remunerado"
  | "permiso_no_remunerado"
  | "vacaciones"
  | "calamidad"
  | "cambio_turno"
  | "otro";

export type EstadoNovedad = "pendiente" | "aprobado" | "rechazado";

// ------------------------------------------------------------
// shift_types
// ------------------------------------------------------------
export interface ShiftType {
  id: number;
  campana_id: string;
  nombre: string;
  hora_inicio: string;   // "HH:MM"
  hora_fin: string;      // "HH:MM"
  color: string;
  activo: boolean;
  created_at: string;
}

// ------------------------------------------------------------
// schedules (semana × campaña)
// ------------------------------------------------------------
export interface Schedule {
  id: string;
  campana_id: string;
  semana_inicio: string;  // "YYYY-MM-DD" (lunes)
  semana_fin: string;     // "YYYY-MM-DD" (domingo)
  estado: EstadoSchedule;
  creado_por: string | null;
  created_at: string;
  updated_at: string;
}

// ------------------------------------------------------------
// schedule_shifts (turno por agente × día)
// ------------------------------------------------------------
export interface ScheduleShift {
  id: string;
  schedule_id: string;
  agente_id: string;
  fecha: string;           // "YYYY-MM-DD"
  shift_type_id: number | null;
  hora_inicio: string | null;    // "HH:MM"
  hora_fin: string | null;       // "HH:MM"
  hora_almuerzo: string | null;  // "HH:MM"
  duracion_almuerzo: number;     // minutos
  tipo_actividad: TipoActividad;
  horas_dia: number | null;
  observacion: string | null;
  created_at: string;
  updated_at: string;
  // join opcional con profiles
  agente?: {
    nombre: string;
    user_id: string;
  };
}

// ------------------------------------------------------------
// schedule_novedades
// ------------------------------------------------------------
export interface ScheduleNovedad {
  id: string;
  schedule_id: string;
  agente_id: string;
  fecha: string;
  tipo_novedad: TipoNovedad;
  descripcion: string | null;
  estado: EstadoNovedad;
  revisado_por: string | null;
  created_at: string;
  updated_at: string;
}

// ------------------------------------------------------------
// Payloads para mutaciones (Fases 5+)
// ------------------------------------------------------------
export interface CreateSchedulePayload {
  campana_id: string;
  semana_inicio: string;
  semana_fin: string;
}

export interface UpsertShiftPayload {
  schedule_id: string;
  agente_id: string;
  fecha: string;
  shift_type_id?: number;
  hora_inicio?: string;
  hora_fin?: string;
  hora_almuerzo?: string;
  duracion_almuerzo?: number;
  tipo_actividad?: TipoActividad;
  horas_dia?: number;
  observacion?: string;
}

export interface CreateNovedadPayload {
  schedule_id: string;
  agente_id: string;
  fecha: string;
  tipo_novedad: TipoNovedad;
  descripcion?: string;
}

// ------------------------------------------------------------
// Helpers de UI
// ------------------------------------------------------------

/** Retorna true si el rol puede gestionar el módulo completo */
export function canManageSchedules(roles: RoleName[]): boolean {
  return roles.some(r => (["admin", "supervisor", "gerente"] as RoleName[]).includes(r));
}

/** Retorna true si el rol solo puede ver su propio turno */
export function isAgentView(roles: RoleName[]): boolean {
  return roles.includes("agent") && !canManageSchedules(roles);
}

/** Semana ISO: dado un Date, retorna el lunes de esa semana */
export function getWeekStart(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day; // lunes como inicio
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

/** Dado un lunes, retorna el domingo de esa semana */
export function getWeekEnd(monday: Date): Date {
  const d = new Date(monday);
  d.setDate(d.getDate() + 6);
  return d;
}

/** Formatea Date → "YYYY-MM-DD" */
export function toISODate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Convierte horas decimales (8.5) → "8h 30min" */
export function formatHoras(horas: number | null | undefined): string {
  if (horas == null) return "—";
  const h = Math.floor(horas);
  const m = Math.round((horas - h) * 60);
  return m > 0 ? `${h}h ${m}min` : `${h}h`;
}

/** Color de badge según tipo actividad */
export const ACTIVIDAD_COLORS: Record<TipoActividad, string> = {
  GAP:          "bg-blue-100 text-blue-800",
  Tele:         "bg-purple-100 text-purple-800",
  Calidad:      "bg-green-100 text-green-800",
  Apoyo:        "bg-yellow-100 text-yellow-800",
  VIP:          "bg-amber-100 text-amber-800",
  Descanso:     "bg-gray-100 text-gray-600",
  Vacaciones:   "bg-teal-100 text-teal-800",
  Incapacidad:  "bg-red-100 text-red-800",
  No_aplica:    "bg-slate-100 text-slate-500",
};

/** Label legible para tipo novedad */
export const NOVEDAD_LABELS: Record<TipoNovedad, string> = {
  incapacidad:            "Incapacidad",
  permiso_remunerado:     "Permiso remunerado",
  permiso_no_remunerado:  "Permiso no remunerado",
  vacaciones:             "Vacaciones",
  calamidad:              "Calamidad",
  cambio_turno:           "Cambio de turno",
  otro:                   "Otro",
};
