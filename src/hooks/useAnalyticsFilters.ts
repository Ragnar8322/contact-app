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

export function useAnalyticsFilters() {
  // Applied filters (used for queries)
  const [appliedFilters, setAppliedFilters] = useState<AnalyticsFilters>({
    dateFrom: startOfMonth(new Date()),
    dateTo: endOfMonth(new Date()),
    campanaId: null,
    agenteId: null,
    estadoId: null,
  });

  // Pending filters (user selections before applying)
  const [pendingFilters, setPendingFilters] = useState<AnalyticsFilters>({
    dateFrom: startOfMonth(new Date()),
    dateTo: endOfMonth(new Date()),
    campanaId: null,
    agenteId: null,
    estadoId: null,
  });

  // Fetch campañas
  const { data: campanas } = useQuery({
    queryKey: ["analytics-campanas"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("campanas")
        .select("id, nombre")
        .eq("activa", true)
        .order("nombre");
      if (error) throw error;
      return data;
    },
  });

  // Fetch agentes
  const { data: agentes } = useQuery({
    queryKey: ["analytics-agentes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cat_agentes")
        .select("user_id, nombre")
        .eq("activo", true)
        .order("nombre");
      if (error) throw error;
      return data;
    },
  });

  // Fetch estados
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
  });

  const campanaOptions: FilterOption[] = useMemo(() => {
    return campanas?.map((c) => ({ value: c.id, label: c.nombre })) || [];
  }, [campanas]);

  const agenteOptions: FilterOption[] = useMemo(() => {
    return agentes?.map((a) => ({ value: a.user_id, label: a.nombre })) || [];
  }, [agentes]);

  const estadoOptions: FilterOption[] = useMemo(() => {
    return estados?.map((e) => ({ value: String(e.id), label: e.nombre })) || [];
  }, [estados]);

  // Count active non-default filters
  const activeFilterCount = useMemo(() => {
    let count = 0;
    const defaultFrom = startOfMonth(new Date());
    const defaultTo = endOfMonth(new Date());

    if (
      appliedFilters.dateFrom.toDateString() !== defaultFrom.toDateString() ||
      appliedFilters.dateTo.toDateString() !== defaultTo.toDateString()
    ) {
      count++;
    }
    if (appliedFilters.campanaId) count++;
    if (appliedFilters.agenteId) count++;
    if (appliedFilters.estadoId) count++;

    return count;
  }, [appliedFilters]);

  const updatePendingFilter = <K extends keyof AnalyticsFilters>(
    key: K,
    value: AnalyticsFilters[K]
  ) => {
    setPendingFilters((prev) => ({ ...prev, [key]: value }));
  };

  const applyFilters = () => {
    setAppliedFilters({ ...pendingFilters });
  };

  const clearFilters = () => {
    const defaults: AnalyticsFilters = {
      dateFrom: startOfMonth(new Date()),
      dateTo: endOfMonth(new Date()),
      campanaId: null,
      agenteId: null,
      estadoId: null,
    };
    setPendingFilters(defaults);
    setAppliedFilters(defaults);
  };

  // Get filter summary for exports
  const getFilterSummary = (): string => {
    const parts: string[] = [];

    if (appliedFilters.campanaId) {
      const campana = campanas?.find((c) => c.id === appliedFilters.campanaId);
      parts.push(`Campaña: ${campana?.nombre || "Seleccionada"}`);
    } else {
      parts.push("Campaña: Todas");
    }

    if (appliedFilters.agenteId) {
      const agente = agentes?.find((a) => a.user_id === appliedFilters.agenteId);
      parts.push(`Agente: ${agente?.nombre || "Seleccionado"}`);
    } else {
      parts.push("Agente: Todos");
    }

    if (appliedFilters.estadoId) {
      const estado = estados?.find((e) => e.id === appliedFilters.estadoId);
      parts.push(`Estado: ${estado?.nombre || "Seleccionado"}`);
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
