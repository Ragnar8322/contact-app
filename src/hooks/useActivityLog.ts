import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type ActivityLogEntry = {
  id: string;
  created_at: string;
  user_email: string | null;
  user_name: string | null;
  action: "INSERT" | "UPDATE" | "DELETE" | "LOGIN" | "EXPORT" | string;
  entity: string;
  entity_id: string | null;
  campana_id: string | null;
  details: Record<string, unknown>;
};

export type ActivityLogFilters = {
  entity?: string | null;
  action?: string | null;
  userId?: string | null;
  dateFrom?: Date | null;
  dateTo?: Date | null;
  page?: number;
  pageSize?: number;
};

export function useActivityLog(filters: ActivityLogFilters = {}) {
  const {
    entity,
    action,
    dateFrom,
    dateTo,
    page = 0,
    pageSize = 50,
  } = filters;

  return useQuery({
    queryKey: ["activity_log", entity, action, dateFrom, dateTo, page],
    queryFn: async () => {
      let query = supabase
        .from("activity_log")
        .select("*", { count: "exact" })
        .order("created_at", { ascending: false })
        .range(page * pageSize, (page + 1) * pageSize - 1);

      if (entity) query = query.eq("entity", entity);
      if (action) query = query.eq("action", action);
      if (dateFrom) query = query.gte("created_at", dateFrom.toISOString());
      if (dateTo) {
        const end = new Date(dateTo);
        end.setHours(23, 59, 59, 999);
        query = query.lte("created_at", end.toISOString());
      }

      const { data, error, count } = await query;
      if (error) throw error;

      return {
        entries: (data ?? []) as ActivityLogEntry[],
        total: count ?? 0,
      };
    },
    staleTime: 1000 * 30, // 30 s
  });
}

// Función utilitaria para registrar acciones desde el frontend (exportes, login manual, etc.)
export async function logActivity(
  action: string,
  entity: string,
  entityId?: string,
  details?: Record<string, unknown>
) {
  await supabase.rpc("log_activity", {
    p_action: action,
    p_entity: entity,
    p_entity_id: entityId ?? null,
    p_details: details ?? {},
  });
}
