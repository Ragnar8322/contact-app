import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { startOfMonth, endOfMonth } from "date-fns";
import { supabase } from "@/integrations/supabase/client";

export interface AnalyticsFilters {
  dateFrom: Date;
  dateTo: Date;
  campanaId: string | null;
  agenteId: string | null;
  estadoId: number | null;
}

export interface FilterOption {
  value: string;
  label: string;
}

const defaultFilters = (): AnalyticsFilters => ({
  dateFrom: startOfMonth(new Date()),
  dateTo: endOfMonth(new Date()),
  campanaId: null,
  agenteId: null,
  estadoId: null,
});

export function useAnalyticsFilters() {
  const [appliedFilters, setAppliedFilters] = useState<AnalyticsFilters>(defaultFilters);
  const [pendingFilters, setPendingFilters] = useState<AnalyticsFilters>(defaultFilters);

  // Todas las campañas (sin filtrar por activa para que el histórico sea accesible)
  const { data: campanas } = useQuery({
    queryKey: ["analytics-campanas"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("campanas")
        .select("id, nombre, activa")
        .order("nombre");
      if (error) throw error;
      return data;
    },
    staleTime: 5 * 60 * 1000,
  });

  // BUG FIX #7: agentes desde profiles con rol "agent" (fuente de verdad actualizada)
  const { data: agentes } = useQuery({
    queryKey: ["analytics-agentes-profiles"],
    queryFn: async () => {
      // Obtener el ID del rol agent
      const { data: roleRow, error: roleErr } = await supabase
        .from("user_roles")
        .select("id")
        .eq("name", "agent")
        .single();
      if (roleErr || !roleRow) return [];

      // Obtener user_ids con ese rol
      const { data: assignments, error: assignErr } = await supabase
        .from("user_role_assignments")
        .select("user_id")
        .eq("role_id", roleRow.id);
      if (assignErr) throw assignErr;
      const userIds = (assignments ?? []).map((a: any) => a.user_id);
      if (userIds.length === 0) return [];

      // Obtener nombres actualizados desde profiles
      const { data: profiles, error: profErr } = await supabase
        .from("profiles")
        .select("user_id, nombre")
        .in("user_id", userIds)
        .order("nombre");
      if (profErr) throw profErr;
      return profiles ?? [];
    },
    staleTime: 5 * 60 * 1000,
  });

  // Todos los estados
  const { data: estados } = useQuery({
    queryKey: ["analytics-estados"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cat_estados")
        .select("id, nombre")
        .order("nombre");
      if (error) throw error;
      return data;
    },
    staleTime: 5 * 60 * 1000,
  });

  const campanaOptions: FilterOption[] = useMemo(() =>
    (campanas ?? []).map((c: any) => ({ value: c.id, label: c.activa ? c.nombre : `${c.nombre} (inactiva)` })),
  [campanas]);

  const agenteOptions: FilterOption[] = useMemo(() =>
    (agentes ?? []).map((a: any) => ({ value: a.user_id, label: a.nombre })),
  [agentes]);

  const estadoOptions: FilterOption[] = useMemo(() =>
    (estados ?? []).map((e: any) => ({ value: String(e.id), label: e.nombre })),
  [estados]);

  // Contar filtros activos distintos al default
  const activeFilterCount = useMemo(() => {
    const def = defaultFilters();
    let count = 0;
    if (
      appliedFilters.dateFrom.toDateString() !== def.dateFrom.toDateString() ||
      appliedFilters.dateTo.toDateString() !== def.dateTo.toDateString()
    ) count++;
    if (appliedFilters.campanaId) count++;
    if (appliedFilters.agenteId) count++;
    if (appliedFilters.estadoId) count++;
    return count;
  }, [appliedFilters]);

  const updatePendingFilter = <K extends keyof AnalyticsFilters>(
    key: K,
    value: AnalyticsFilters[K]
  ) => setPendingFilters((prev) => ({ ...prev, [key]: value }));

  const applyFilters = () => setAppliedFilters({ ...pendingFilters });

  const clearFilters = () => {
    const def = defaultFilters();
    setPendingFilters(def);
    setAppliedFilters(def);
  };

  const getFilterSummary = (): string => {
    const parts: string[] = [];
    if (appliedFilters.campanaId) {
      const c = campanas?.find((c: any) => c.id === appliedFilters.campanaId);
      parts.push(`Campaña: ${c?.nombre ?? "Seleccionada"}`);
    } else {
      parts.push("Campaña: Todas");
    }
    if (appliedFilters.agenteId) {
      const a = agentes?.find((a: any) => a.user_id === appliedFilters.agenteId);
      parts.push(`Agente: ${a?.nombre ?? "Seleccionado"}`);
    } else {
      parts.push("Agente: Todos");
    }
    if (appliedFilters.estadoId) {
      const e = estados?.find((e: any) => e.id === appliedFilters.estadoId);
      parts.push(`Estado: ${e?.nombre ?? "Seleccionado"}`);
    } else {
      parts.push("Estado: Todos");
    }
    return parts.join(" | ");
  };

  return {
    appliedFilters,
    pendingFilters,
    updatePendingFilter,
    applyFilters,
    clearFilters,
    activeFilterCount,
    getFilterSummary,
    campanaOptions,
    agenteOptions,
    estadoOptions,
  };
}
