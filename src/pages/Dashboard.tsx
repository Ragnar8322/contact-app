import { useState, useMemo, useEffect, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useCampana } from "@/contexts/CampanaContext";
import { useDashboardStats, QUERY_RESILIENCE } from "@/hooks/useDashboardStats";
import { useSLAConfigs } from "@/hooks/useSLA";
import { useCampanasList } from "@/hooks/useCampanas";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import {
  AlertTriangle, Clock, FolderOpen, CheckCircle, UserX, ShieldAlert, TrendingUp, RefreshCw,
} from "lucide-react";
import { formatCOP } from "@/lib/currency";
import { format, startOfDay, startOfWeek, startOfMonth, startOfYear, endOfDay, endOfWeek, endOfMonth, endOfYear, differenceInMinutes, differenceInHours, differenceInDays } from "date-fns";
import { es } from "date-fns/locale";

type Periodo = "dia" | "semana" | "mes" | "año";

function timeAgo(dateStr: string): string {
  const now = new Date();
  const d = new Date(dateStr);
  const mins = differenceInMinutes(now, d);
  if (mins < 60) return `${mins} min`;
  const hrs = differenceInHours(now, d);
  if (hrs < 24) return `${hrs} h`;
  const days = differenceInDays(now, d);
  return `${days} d`;
}

function getPeriodRange(periodo: Periodo): { inicio: Date; fin: Date } {
  const now = new Date();
  switch (periodo) {
    case "dia": return { inicio: startOfDay(now), fin: endOfDay(now) };
    case "semana": return { inicio: startOfWeek(now, { locale: es }), fin: endOfWeek(now, { locale: es }) };
    case "mes": return { inicio: startOfMonth(now), fin: endOfMonth(now) };
    case "año": return { inicio: startOfYear(now), fin: endOfYear(now) };
  }
}

/* ─── Last Updated Hook ─── */
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

export default function Dashboard() {
  const { user, profile, isAdmin, isAgente, hasRole } = useAuth();
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

  const { data: stats, isLoading: statsLoading, isError: statsError, dataUpdatedAt: statsUpdatedAt } = useDashboardStats(campanaIds, campanaNombres, safeSlaConfigs);

  const { data: agents = [], isLoading: agentsLoading, isError: agentsError } = useQuery({
    queryKey: ["dashboard-agents"],
    ...QUERY_RESILIENCE,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("user_id, nombre, role_id, user_roles(name)")
        .eq("role_id", 2);
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: agentCampanas = [] } = useQuery({
    queryKey: ["dashboard-agent-campanas"],
    ...QUERY_RESILIENCE,
    queryFn: async () => {
      const { data, error } = await supabase.from("perfil_campanas").select("user_id, campana_id");
      if (error) throw error;
      return data ?? [];
    },
  });

  // ─── Error & freshness state ───
  const hasError = campanasError || slaError || statsError || agentsError;
  const { text: lastUpdatedText, isFresh } = useLastUpdated(statsUpdatedAt);

  const handleRetry = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["dashboard-stats-v2"] });
    queryClient.invalidateQueries({ queryKey: ["sla-configs-bulk"] });
    queryClient.invalidateQueries({ queryKey: ["campanas"] });
    queryClient.invalidateQueries({ queryKey: ["dashboard-agents"] });
    queryClient.invalidateQueries({ queryKey: ["dashboard-agent-campanas"] });
  }, [queryClient]);

  // ─── Alert banner state ───
  const [alertFilter, setAlertFilter] = useState<"vencidos" | "sinAsignar" | null>(null);
  const totalVencidos = stats?.totalVencidos ?? 0;
  const totalSinAsignar = stats?.totalSinAsignar ?? 0;
  const showAlerts = totalVencidos > 0 || totalSinAsignar > 0;

  // ─── Financial module ───
  const renovacionCampana = useMemo(
    () => allCampanas.find((c) => c.nombre.toLowerCase().includes("renovaci")),
    [allCampanas]
  );

  // ─── Agent stats ───
  const visibleAgents = useMemo(() => {
    if (!agents || !Array.isArray(agents)) return [];
    if (isAdmin) return agents;
    return agents.filter((a) => a.user_id === user?.id);
  }, [agents, isAdmin, user]);

  const agentStats = useMemo(() => {
    const allCases = stats?.allCases;
    if (!allCases || !Array.isArray(allCases) || !visibleAgents.length) return [];
    const now = Date.now();
    return visibleAgents.map((agent) => {
      const myCases = allCases.filter((c: any) => c.agente_id === agent.user_id && !c.cat_estados?.es_final);
      let vencidos = 0;
      myCases.forEach((c: any) => {
        const cid = c.campana_id;
        const cfg = safeSlaConfigs[cid] || { horas_riesgo: 2, horas_vencido: 6 };
        const hrs = (now - new Date(c.fecha_caso).getTime()) / 3600000;
        if (hrs >= cfg.horas_vencido) vencidos++;
      });
      const agentCampanaIds = (agentCampanas ?? []).filter((ac) => ac.user_id === agent.user_id).map((ac) => ac.campana_id);
      const campanaNames = agentCampanaIds.map((id) => campanaNombres[id!] || "").filter(Boolean).join(", ");
      return { ...agent, casosActivos: myCases.length, casosVencidos: vencidos, campanaNames };
    });
  }, [stats?.allCases, visibleAgents, safeSlaConfigs, agentCampanas, campanaNombres]);

  // ─── Recent cases ───
  const recentCases = useMemo(() => {
    const allCases = stats?.allCases;
    if (!allCases || !Array.isArray(allCases)) return [];
    const activeCampId = campanaActiva?.id;
    let filtered = activeCampId ? allCases.filter((c: any) => c.campana_id === activeCampId) : allCases;
    if (alertFilter === "vencidos") {
      const now = Date.now();
      filtered = filtered.filter((c: any) => {
        if (c.cat_estados?.es_final) return false;
        const cfg = safeSlaConfigs[c.campana_id] || { horas_riesgo: 2, horas_vencido: 6 };
        return (now - new Date(c.fecha_caso).getTime()) / 3600000 >= cfg.horas_vencido;
      });
    } else if (alertFilter === "sinAsignar") {
      filtered = filtered.filter((c: any) => !c.agente_id && !c.cat_estados?.es_final);
    }
    return [...filtered].sort((a: any, b: any) => new Date(b.fecha_caso).getTime() - new Date(a.fecha_caso).getTime()).slice(0, 10);
  }, [stats?.allCases, campanaActiva?.id, alertFilter, safeSlaConfigs]);

  function caseBadgeClass(caso: any): string {
    if (caso.cat_estados?.es_final) return "bg-muted text-muted-foreground";
    const cfg = safeSlaConfigs[caso.campana_id] || { horas_riesgo: 2, horas_vencido: 6 };
    const hrs = (Date.now() - new Date(caso.fecha_caso).getTime()) / 3600000;
    if (hrs >= cfg.horas_vencido) return "bg-destructive text-destructive-foreground";
    if (hrs >= cfg.horas_riesgo) return "bg-warning text-warning-foreground";
    return "bg-primary/10 text-primary";
  }

  // ─── First load: show skeletons ───
  const isFirstLoad = (statsLoading || slaLoading) && !stats;

  if (isFirstLoad) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
            <p className="text-muted-foreground">Resumen general del contact center</p>
          </div>
          <Skeleton className="h-5 w-32" />
        </div>
        {/* KPI skeletons */}
        <div className="grid gap-6 lg:grid-cols-2">
          {[1, 2].map((i) => (
            <Card key={i} className="border-0 shadow-sm">
              <CardHeader className="pb-3"><Skeleton className="h-5 w-40" /></CardHeader>
              <CardContent><div className="grid grid-cols-5 gap-3">{[1,2,3,4,5].map(j => <Skeleton key={j} className="h-20 rounded-lg" />)}</div></CardContent>
            </Card>
          ))}
        </div>
        {/* Chart skeleton */}
        <Card className="border-0 shadow-sm">
          <CardHeader><Skeleton className="h-5 w-60" /></CardHeader>
          <CardContent><Skeleton className="h-72 w-full rounded-lg" /></CardContent>
        </Card>
        {/* Bottom section */}
        <div className="grid gap-6 lg:grid-cols-2">
          <Card className="border-0 shadow-sm">
            <CardHeader><Skeleton className="h-5 w-32" /></CardHeader>
            <CardContent className="space-y-3">
              {[1,2,3,4,5].map(i => <Skeleton key={i} className="h-10 w-full rounded" />)}
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm">
            <CardHeader><Skeleton className="h-5 w-32" /></CardHeader>
            <CardContent className="space-y-3">
              {[1,2,3,4,5,6,7,8].map(i => <Skeleton key={i} className="h-10 w-full rounded" />)}
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ─── Header + Last Updated ─── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground">Resumen general del contact center</p>
        </div>
        <div className={`flex items-center gap-1.5 text-xs ${isFresh ? "text-accent" : "text-muted-foreground"}`}>
          <Clock className="h-3.5 w-3.5" />
          <span>{lastUpdatedText}</span>
        </div>
      </div>

      {/* ─── Error Banner ─── */}
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

      {/* ─── SECTION 1: Alert Banner ─── */}
      {showAlerts && (
        <div className={`rounded-xl p-4 flex flex-wrap items-center gap-4 ${totalVencidos > 0 ? "bg-destructive/10 border border-destructive/30" : "bg-warning/10 border border-warning/30"}`}>
          {totalVencidos > 0 && (
            <div className="flex items-center gap-2">
              <ShieldAlert className="h-5 w-5 text-destructive" />
              <span className="text-sm font-medium text-destructive">{totalVencidos} casos vencidos SLA</span>
              <Button size="sm" variant="outline" className="h-7 text-xs border-destructive/40 text-destructive hover:bg-destructive/10" onClick={() => setAlertFilter(alertFilter === "vencidos" ? null : "vencidos")}>
                {alertFilter === "vencidos" ? "Quitar filtro" : "Ver ahora"}
              </Button>
            </div>
          )}
          {totalSinAsignar > 0 && (
            <div className="flex items-center gap-2">
              <UserX className="h-5 w-5 text-warning" />
              <span className="text-sm font-medium" style={{ color: "hsl(var(--warning))" }}>{totalSinAsignar} casos sin asignar</span>
              <Button size="sm" variant="outline" className="h-7 text-xs border-warning/40 hover:bg-warning/10" style={{ color: "hsl(var(--warning))" }} onClick={() => setAlertFilter(alertFilter === "sinAsignar" ? null : "sinAsignar")}>
                {alertFilter === "sinAsignar" ? "Quitar filtro" : "Ver ahora"}
              </Button>
            </div>
          )}
        </div>
      )}

      {/* ─── SECTION 2: KPIs by Campaign ─── */}
      <div className={`grid gap-6 ${visibleCampanas.length > 1 ? "lg:grid-cols-2" : "grid-cols-1"}`}>
        {(stats?.byCampaign ?? []).map((cs) => (
          <Card key={cs.campanaId} className="border-0 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <FolderOpen className="h-4 w-4 text-primary" />
                {cs.campanaNombre}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                <KpiMini label="Abiertos" value={cs.openCount} icon={<FolderOpen className="h-4 w-4" />} />
                <KpiMini label="Cerrados hoy" value={cs.closedTodayCount} icon={<CheckCircle className="h-4 w-4" />} />
                <KpiMini label="Sin asignar" value={cs.sinAsignar} icon={<UserX className="h-4 w-4" />} badge={cs.sinAsignar > 0 ? "destructive" : undefined} />
                <KpiMini label="En riesgo" value={cs.enRiesgo} icon={<Clock className="h-4 w-4" />} badge={cs.enRiesgo > 0 ? "warning" : undefined} />
                <KpiMini label="Vencidos" value={cs.vencidos} icon={<ShieldAlert className="h-4 w-4" />} badge={cs.vencidos > 0 ? "destructive" : undefined} />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* ─── SECTION 3: Financial Module (hidden for agente) ─── */}
      {renovacionCampana && !isAgente && <FinancialModule campana={renovacionCampana} showPctRecuperado={hasRole(["admin", "gerente"])} />}

      {/* ─── SECTION 4: Agents + Recent Cases ─── */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Agents */}
        <Card className="border-0 shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">Agentes Activos</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {agentsLoading ? (
              <div className="p-4 space-y-3">
                {[1,2,3,4,5].map(i => <Skeleton key={i} className="h-10 w-full rounded" />)}
              </div>
            ) : (
              <div className="overflow-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-muted-foreground">
                      <th className="px-4 py-2 text-left font-medium">Nombre</th>
                      <th className="px-4 py-2 text-left font-medium">Campaña</th>
                      <th className="px-4 py-2 text-center font-medium">Activos</th>
                      <th className="px-4 py-2 text-center font-medium">Vencidos SLA</th>
                    </tr>
                  </thead>
                  <tbody>
                    {agentStats.map((a) => (
                      <tr key={a.user_id} className="border-b last:border-0 hover:bg-muted/50">
                        <td className="px-4 py-2.5 font-medium">{a.nombre}</td>
                        <td className="px-4 py-2.5 text-muted-foreground text-xs">{a.campanaNames || "—"}</td>
                        <td className="px-4 py-2.5 text-center">{a.casosActivos}</td>
                        <td className="px-4 py-2.5 text-center">
                          {a.casosVencidos > 0 ? (
                            <Badge variant="destructive" className="text-xs">{a.casosVencidos}</Badge>
                          ) : "0"}
                        </td>
                      </tr>
                    ))}
                    {agentStats.length === 0 && (
                      <tr><td colSpan={4} className="py-8 text-center text-muted-foreground text-sm">Sin agentes</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent cases */}
        <Card className="border-0 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">
              Casos Recientes
              {alertFilter && (
                <Badge variant="outline" className="ml-2 text-xs cursor-pointer" onClick={() => setAlertFilter(null)}>
                  Filtro: {alertFilter === "vencidos" ? "Vencidos" : "Sin asignar"} ✕
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y">
              {recentCases.map((caso: any) => (
                <div key={caso.id} className="flex items-center justify-between px-5 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">#{caso.id}</p>
                  </div>
                  <div className="text-right flex items-center gap-2">
                    <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${caseBadgeClass(caso)}`}>
                      {caso.cat_estados?.nombre || "—"}
                    </span>
                    <span className="text-xs text-muted-foreground whitespace-nowrap">{timeAgo(caso.fecha_caso)}</span>
                  </div>
                </div>
              ))}
              {recentCases.length === 0 && (
                <p className="py-8 text-center text-sm text-muted-foreground">No hay casos</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

/* ─── KPI Mini Card ─── */
function KpiMini({ label, value, icon, badge }: { label: string; value: number; icon: React.ReactNode; badge?: "destructive" | "warning" }) {
  return (
    <div className="rounded-lg bg-muted/50 p-3 text-center">
      <div className="flex justify-center mb-1 text-muted-foreground">{icon}</div>
      <p className="text-lg font-bold">
        {value}
        {badge && value > 0 && (
          <span className={`ml-1 inline-block h-2 w-2 rounded-full ${badge === "destructive" ? "bg-destructive" : "bg-warning"}`} />
        )}
      </p>
      <p className="text-[11px] text-muted-foreground leading-tight">{label}</p>
    </div>
  );
}

/* ─── Financial Module ─── */
function FinancialModule({ campana, showPctRecuperado = true }: { campana: { id: string; nombre: string }; showPctRecuperado?: boolean }) {
  const [periodo, setPeriodo] = useState<Periodo>("mes");
  const [activeStates, setActiveStates] = useState<Set<string>>(new Set(["Renovado", "Pendiente de pago"]));

  const { inicio, fin } = useMemo(() => getPeriodRange(periodo), [periodo]);

  const { data: financialCases = [], isLoading: financialLoading } = useQuery({
    queryKey: ["financial-cases", campana.id, inicio.toISOString(), fin.toISOString()],
    ...QUERY_RESILIENCE,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("casos")
        .select("fecha_caso, valor_pagar, estado_id, cat_estados(nombre)")
        .eq("campana_id", campana.id)
        .gte("fecha_caso", inicio.toISOString())
        .lte("fecha_caso", fin.toISOString());
      if (error) throw error;
      return data ?? [];
    },
  });

  const financialData = useMemo(() => {
    if (!financialCases || !Array.isArray(financialCases)) return { renovado: 0, pendiente: 0, chartData: [] };

    const renovadoCases = financialCases.filter((c: any) => c.cat_estados?.nombre === "Renovado");
    const pendienteCases = financialCases.filter((c: any) => c.cat_estados?.nombre === "Pendiente de pago");

    const renovado = renovadoCases.reduce((s: number, c: any) => s + (c.valor_pagar || 0), 0);
    const pendiente = pendienteCases.reduce((s: number, c: any) => s + (c.valor_pagar || 0), 0);

    const buckets: Record<string, { renovado: number; pendiente: number }> = {};

    function getBucketKey(dateStr: string): string {
      const d = new Date(dateStr);
      switch (periodo) {
        case "dia": return `${d.getHours()}h`;
        case "semana": return format(d, "EEE", { locale: es });
        case "mes": return String(d.getDate());
        case "año": return format(d, "MMM", { locale: es });
      }
    }

    if (periodo === "dia") {
      for (let i = 0; i < 24; i++) buckets[`${i}h`] = { renovado: 0, pendiente: 0 };
    } else if (periodo === "semana") {
      ["lun", "mar", "mié", "jue", "vie", "sáb", "dom"].forEach((d) => (buckets[d] = { renovado: 0, pendiente: 0 }));
    } else if (periodo === "mes") {
      const daysInMonth = fin.getDate();
      for (let i = 1; i <= daysInMonth; i++) buckets[String(i)] = { renovado: 0, pendiente: 0 };
    } else {
      ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"].forEach((m) => (buckets[m] = { renovado: 0, pendiente: 0 }));
    }

    financialCases.forEach((c: any) => {
      const key = getBucketKey(c.fecha_caso).toLowerCase();
      if (!buckets[key]) return;
      const val = c.valor_pagar || 0;
      if (c.cat_estados?.nombre === "Renovado") {
        buckets[key].renovado += val;
      } else if (c.cat_estados?.nombre === "Pendiente de pago") {
        buckets[key].pendiente += val;
      }
    });

    const chartData = Object.entries(buckets).map(([name, v]) => ({ name, ...v }));
    return { renovado, pendiente, chartData };
  }, [financialCases, periodo, fin]);

  const total = financialData.renovado + financialData.pendiente;
  const pctRecuperado = total > 0 ? ((financialData.renovado / total) * 100).toFixed(1) : "—";

  const toggleState = (state: string) => {
    setActiveStates((prev) => {
      const next = new Set(prev);
      if (next.has(state)) next.delete(state);
      else next.add(state);
      return next;
    });
  };

  const periodos: { key: Periodo; label: string }[] = [
    { key: "dia", label: "Día" },
    { key: "semana", label: "Semana" },
    { key: "mes", label: "Mes" },
    { key: "año", label: "Año" },
  ];

  return (
    <Card className="border-0 shadow-sm">
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <CardTitle className="text-base flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-accent" />
            Módulo Financiero — {campana.nombre}
          </CardTitle>
          <div className="flex items-center gap-2">
            <div className="flex rounded-lg border bg-muted/50 p-0.5">
              {periodos.map((p) => (
                <button
                  key={p.key}
                  onClick={() => setPeriodo(p.key)}
                  className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${periodo === p.key ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
                >
                  {p.label}
                </button>
              ))}
            </div>
            <div className="flex gap-1">
              <button
                onClick={() => toggleState("Renovado")}
                className={`px-2.5 py-1 text-xs rounded-full border transition-colors ${activeStates.has("Renovado") ? "bg-accent/15 border-accent text-accent" : "border-border text-muted-foreground"}`}
              >
                🟢 Renovado
              </button>
              <button
                onClick={() => toggleState("Pendiente de pago")}
                className={`px-2.5 py-1 text-xs rounded-full border transition-colors ${activeStates.has("Pendiente de pago") ? "bg-warning/15 border-warning" : "border-border text-muted-foreground"}`}
                style={activeStates.has("Pendiente de pago") ? { color: "hsl(var(--warning))" } : {}}
              >
                🟡 Pendiente
              </button>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {financialLoading ? (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[1,2,3,4].map(i => <Skeleton key={i} className="h-20 rounded-lg" />)}
            </div>
            <Skeleton className="h-72 w-full rounded-lg" />
          </>
        ) : (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="rounded-lg bg-accent/10 p-3 text-center">
                <p className="text-[11px] text-muted-foreground">💰 Valor Renovado</p>
                <p className="text-lg font-bold text-accent">{financialData.renovado ? formatCOP(financialData.renovado) : "—"}</p>
              </div>
              <div className="rounded-lg bg-warning/10 p-3 text-center">
                <p className="text-[11px] text-muted-foreground">⏳ Valor Pendiente</p>
                <p className="text-lg font-bold" style={{ color: "hsl(var(--warning))" }}>{financialData.pendiente ? formatCOP(financialData.pendiente) : "—"}</p>
              </div>
              <div className="rounded-lg bg-muted/50 p-3 text-center">
                <p className="text-[11px] text-muted-foreground">📊 Total en gestión</p>
                <p className="text-lg font-bold">{total ? formatCOP(total) : "—"}</p>
              </div>
              <div className="rounded-lg bg-muted/50 p-3 text-center">
                <p className="text-[11px] text-muted-foreground">📈 % Recuperado</p>
                <p className="text-lg font-bold">{pctRecuperado}%</p>
              </div>
            </div>

            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={financialData.chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 15%, 90%)" />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={(v: number) => formatCOP(v)} />
                <Tooltip
                  formatter={(value: number, name: string) => [formatCOP(value), name]}
                  labelFormatter={(label) => `Período: ${label}`}
                />
                <Legend />
                {activeStates.has("Renovado") && (
                  <Bar dataKey="renovado" name="Renovado" fill="hsl(130, 50%, 45%)" radius={[4, 4, 0, 0]} />
                )}
                {activeStates.has("Pendiente de pago") && (
                  <Bar dataKey="pendiente" name="Pendiente de pago" fill="hsl(38, 92%, 50%)" radius={[4, 4, 0, 0]} />
                )}
              </BarChart>
            </ResponsiveContainer>
          </>
        )}
      </CardContent>
    </Card>
  );
}
