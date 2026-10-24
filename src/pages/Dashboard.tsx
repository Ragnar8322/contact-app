import { useState, useMemo, useEffect, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Clock, RefreshCw } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useCampana } from "@/contexts/CampanaContext";
import {
  useDashboardStats, useDashboardAgentStats, useDashboardAgents, useRecentCases, type RecentCasesFilter,
} from "@/hooks/useDashboardStats";
import { useSLAConfigs } from "@/hooks/useSLA";
import { useCampanasList } from "@/hooks/useCampanas";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { FinancialModule } from "@/components/dashboard/FinancialModule";
import {
  AgentsCard, CampaignKpis, DashboardSkeleton, RecentCasesCard, SlaAlerts, type AgentRow,
} from "@/components/dashboard/DashboardSections";

function useLastUpdated(dataUpdatedAt: number) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(interval);
  }, []);
  if (!dataUpdatedAt) return { text: "—", isFresh: false };
  const mins = Math.floor((now - dataUpdatedAt) / 60_000);
  const isFresh = mins < 2;
  const text = mins < 1 ? "Ahora" : `Hace ${mins} min`;
  return { text, isFresh };
}

function DashboardHeader({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">Resumen general del contact center</p>
      </div>
      {children}
    </div>
  );
}

export default function Dashboard() {
  const { user, isAdmin, isAgente, hasRole } = useAuth();
  // El gerente ve el resumen pero no tiene acceso a /casos
  const canOpenCases = hasRole(["admin", "supervisor", "agent"]);
  const { campanaActiva } = useCampana();
  const queryClient = useQueryClient();
  const { data: allCampanas = [], isError: campanasError } = useCampanasList();

  const visibleCampanas = useMemo(() => {
    if (isAdmin) return allCampanas;
    return campanaActiva ? [campanaActiva] : [];
  }, [isAdmin, allCampanas, campanaActiva]);

  const campanaIds = useMemo(() => visibleCampanas.map((c) => c.id), [visibleCampanas]);
  const campanaNombres = useMemo(() => {
    const m: Record<string, string> = {};
    visibleCampanas.forEach((c) => (m[c.id] = c.nombre));
    return m;
  }, [visibleCampanas]);

  const { data: slaConfigs = {}, isLoading: slaLoading, isError: slaError } = useSLAConfigs(campanaIds);

  const safeSlaConfigs = useMemo(() => {
    const m: Record<string, { horas_riesgo: number; horas_vencido: number }> = {};
    campanaIds.forEach((id) => {
      m[id] = slaConfigs[id] ?? { horas_riesgo: 2, horas_vencido: 6 };
    });
    return m;
  }, [campanaIds, slaConfigs]);

  const {
    data: stats,
    isLoading: statsLoading,
    isError: statsError,
    dataUpdatedAt: statsUpdatedAt,
  } = useDashboardStats(campanaIds, campanaNombres);
  const { data: agentCounts = {}, isError: agentStatsError } = useDashboardAgentStats(campanaIds);

  const { agents: agentsQuery, campanas: agentCampanasQuery } = useDashboardAgents();
  const { data: agents = [], isLoading: agentsLoading, isError: agentsError } = agentsQuery;
  const { data: agentCampanas = [] } = agentCampanasQuery;

  const hasError = campanasError || slaError || statsError || agentsError || agentStatsError;
  const { text: lastUpdatedText, isFresh } = useLastUpdated(statsUpdatedAt);

  const handleRetry = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["dashboard-stats-v3"] });
    queryClient.invalidateQueries({ queryKey: ["dashboard-agent-stats"] });
    queryClient.invalidateQueries({ queryKey: ["dashboard-recent-cases"] });
    queryClient.invalidateQueries({ queryKey: ["sla-configs-bulk"] });
    queryClient.invalidateQueries({ queryKey: ["campanas"] });
    queryClient.invalidateQueries({ queryKey: ["dashboard-agents"] });
    queryClient.invalidateQueries({ queryKey: ["dashboard-agent-campanas"] });
    queryClient.invalidateQueries({ queryKey: ["financial-summary"] });
  }, [queryClient]);

  const [alertFilter, setAlertFilter] = useState<RecentCasesFilter>(null);

  const renovacionCampana = useMemo(
    () => allCampanas.find((c) => c.nombre.toLowerCase().includes("renovaci")),
    [allCampanas]
  );

  const agentStats = useMemo((): AgentRow[] => {
    const visibleAgents = isAdmin ? agents : agents.filter((a) => a.user_id === user?.id);
    return visibleAgents.map((agent) => {
      const counts = agentCounts[agent.user_id] ?? { activos: 0, vencidos: 0 };
      const campanaNames = agentCampanas
        .filter((ac) => ac.user_id === agent.user_id)
        .map((ac) => (ac.campana_id && campanaNombres[ac.campana_id]) || "")
        .filter(Boolean)
        .join(", ");
      return { ...agent, casosActivos: counts.activos, casosVencidos: counts.vencidos, campanaNames };
    });
  }, [agents, isAdmin, user, agentCounts, agentCampanas, campanaNombres]);

  const { data: recentCases = [] } = useRecentCases(
    campanaActiva?.id,
    alertFilter,
    safeSlaConfigs[campanaActiva?.id ?? ""]?.horas_vencido ?? 6,
  );

  const isFirstLoad = (statsLoading || slaLoading) && !stats;

  if (isFirstLoad) {
    return (
      <div className="space-y-6">
        <DashboardHeader><Skeleton className="h-5 w-32" /></DashboardHeader>
        <DashboardSkeleton />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <DashboardHeader>
        <div className={`flex items-center gap-1.5 text-xs ${isFresh ? "text-success" : "text-muted-foreground"}`}>
          <Clock className="h-3.5 w-3.5" />
          <span>{lastUpdatedText}</span>
        </div>
      </DashboardHeader>

      {hasError && (
        <div className="rounded-xl border border-warning/40 bg-warning/10 px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-warning" />
            <span className="text-sm font-medium" style={{ color: "hsl(var(--warning))" }}>
              Sin conexión — Mostrando datos en caché. Última actualización: {lastUpdatedText.toLowerCase()}
            </span>
          </div>
          <Button size="sm" variant="outline" className="h-7 text-xs gap-1.5" onClick={handleRetry}>
            <RefreshCw className="h-3 w-3" />
            Reintentar
          </Button>
        </div>
      )}

      <SlaAlerts
        vencidos={stats?.totalVencidos ?? 0}
        sinAsignar={stats?.totalSinAsignar ?? 0}
        filter={alertFilter}
        onFilter={setAlertFilter}
      />

      <div className={`grid gap-6 ${visibleCampanas.length > 1 ? "lg:grid-cols-2" : "grid-cols-1"}`}>
        {(stats?.byCampaign ?? []).map((cs) => <CampaignKpis key={cs.campanaId} cs={cs} />)}
      </div>

      {renovacionCampana && !isAgente && (
        <FinancialModule campana={renovacionCampana} showPctRecuperado={hasRole(["admin", "gerente"])} />
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <AgentsCard agents={agentStats} loading={agentsLoading} />
        <RecentCasesCard cases={recentCases} filter={alertFilter} onClearFilter={() => setAlertFilter(null)} linked={canOpenCases} />
      </div>
    </div>
  );
}
