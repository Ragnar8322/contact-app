import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { differenceInMinutes, differenceInHours, differenceInDays } from "date-fns";
import { CheckCircle, Clock, FolderOpen, ShieldAlert, UserX, X } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EstadoBadge } from "@/components/cases/EstadoBadge";
import type { CampaignStats, RecentCasesFilter } from "@/hooks/useDashboardStats";

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

export function DashboardSkeleton() {
  return (
    <>
      <div className="grid gap-6 lg:grid-cols-2">
        {[1, 2].map((i) => (
          <Card key={i} className="border-0 shadow-sm">
            <CardHeader className="pb-3"><Skeleton className="h-5 w-40" /></CardHeader>
            <CardContent><div className="grid grid-cols-5 gap-3">{[1,2,3,4,5].map(j => <Skeleton key={j} className="h-20 rounded-lg" />)}</div></CardContent>
          </Card>
        ))}
      </div>
      <Card className="border-0 shadow-sm">
        <CardHeader><Skeleton className="h-5 w-60" /></CardHeader>
        <CardContent><Skeleton className="h-72 w-full rounded-lg" /></CardContent>
      </Card>
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
    </>
  );
}

export function SlaAlerts({ vencidos, sinAsignar, filter, onFilter }: {
  vencidos: number;
  sinAsignar: number;
  filter: RecentCasesFilter;
  onFilter: (f: RecentCasesFilter) => void;
}) {
  if (vencidos === 0 && sinAsignar === 0) return null;
  return (
    <div className={`rounded-xl p-4 flex flex-wrap items-center gap-4 ${
      vencidos > 0 ? "bg-destructive/10 border border-destructive/30" : "bg-warning/10 border border-warning/30"
    }`}>
      {vencidos > 0 && (
        <div className="flex items-center gap-2">
          <ShieldAlert className="h-5 w-5 text-destructive" />
          <span className="text-sm font-medium text-destructive">{vencidos} {vencidos === 1 ? "caso vencido" : "casos vencidos"} SLA</span>
          <Button size="sm" variant="outline" className="h-7 text-xs border-destructive/40 text-destructive hover:bg-destructive/10"
            onClick={() => onFilter(filter === "vencidos" ? null : "vencidos")}>
            {filter === "vencidos" ? "Quitar filtro" : "Ver ahora"}
          </Button>
        </div>
      )}
      {sinAsignar > 0 && (
        <div className="flex items-center gap-2">
          <UserX className="h-5 w-5 text-warning" />
          <span className="text-sm font-medium" style={{ color: "hsl(var(--warning))" }}>{sinAsignar} {sinAsignar === 1 ? "caso sin asignar" : "casos sin asignar"}</span>
          <Button size="sm" variant="outline" className="h-7 text-xs border-warning/40 hover:bg-warning/10"
            style={{ color: "hsl(var(--warning))" }}
            onClick={() => onFilter(filter === "sinAsignar" ? null : "sinAsignar")}>
            {filter === "sinAsignar" ? "Quitar filtro" : "Ver ahora"}
          </Button>
        </div>
      )}
    </div>
  );
}

function KpiMini({ label, value, icon, badge }: {
  label: string; value: number; icon: ReactNode; badge?: "destructive" | "warning";
}) {
  return (
    <div className="rounded-lg bg-muted/50 p-3 text-center">
      <div className="flex justify-center mb-1 text-muted-foreground">{icon}</div>
      <p className="text-lg font-bold">
        {value}
        {badge && value > 0 && (
          <span className={`ml-1 inline-block h-2 w-2 rounded-full ${
            badge === "destructive" ? "bg-destructive" : "bg-warning"
          }`} />
        )}
      </p>
      <p className="text-[11px] text-muted-foreground leading-tight">{label}</p>
    </div>
  );
}

export function CampaignKpis({ cs }: { cs: CampaignStats }) {
  return (
    <Card className="border-0 shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <FolderOpen className="h-4 w-4 text-primary" />
          {cs.campanaNombre}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          <KpiMini label="Abiertos"     value={cs.openCount}        icon={<FolderOpen  className="h-4 w-4" />} />
          <KpiMini label="Cerrados hoy" value={cs.closedTodayCount} icon={<CheckCircle className="h-4 w-4" />} />
          <KpiMini label="Sin asignar"  value={cs.sinAsignar}       icon={<UserX       className="h-4 w-4" />} badge={cs.sinAsignar > 0 ? "destructive" : undefined} />
          <KpiMini label="En riesgo"    value={cs.enRiesgo}         icon={<Clock       className="h-4 w-4" />} badge={cs.enRiesgo   > 0 ? "warning"     : undefined} />
          <KpiMini label="Vencidos"     value={cs.vencidos}         icon={<ShieldAlert className="h-4 w-4" />} badge={cs.vencidos   > 0 ? "destructive" : undefined} />
        </div>
      </CardContent>
    </Card>
  );
}

export interface AgentRow {
  user_id: string;
  nombre: string;
  campanaNames: string;
  casosActivos: number;
  casosVencidos: number;
}

export function AgentsCard({ agents, loading }: { agents: AgentRow[]; loading: boolean }) {
  return (
    <Card className="border-0 shadow-sm">
      <CardHeader>
        <CardTitle className="text-base">Agentes Activos</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {loading ? (
          <div className="p-4 space-y-3">{[1,2,3,4,5].map(i => <Skeleton key={i} className="h-10 w-full rounded" />)}</div>
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
                {agents.map((a) => (
                  <tr key={a.user_id} className="border-b last:border-0 hover:bg-muted/50">
                    <td className="px-4 py-2.5 font-medium">{a.nombre}</td>
                    <td className="px-4 py-2.5 text-muted-foreground text-xs">{a.campanaNames || "—"}</td>
                    <td className="px-4 py-2.5 text-center">{a.casosActivos}</td>
                    <td className="px-4 py-2.5 text-center">
                      {a.casosVencidos > 0
                        ? <Badge variant="destructive" className="text-xs">{a.casosVencidos}</Badge>
                        : "0"}
                    </td>
                  </tr>
                ))}
                {agents.length === 0 && (
                  <tr><td colSpan={4} className="py-8 text-center text-muted-foreground text-sm">Sin agentes</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export interface RecentCase {
  id: number;
  fecha_caso: string;
  updated_at: string | null;
  cat_estados: { nombre: string } | null;
  clientes: { nombre_contacto: string } | null;
}

function RecentCaseRow({ casoId, linked, children }: { casoId: number; linked: boolean; children: ReactNode }) {
  const className = "flex items-center justify-between gap-3 px-5 py-3";
  if (!linked) return <div className={className}>{children}</div>;
  return (
    <Link
      to={`/casos?caso=${casoId}`}
      className={`${className} transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring`}
    >
      {children}
    </Link>
  );
}

export function RecentCasesCard({ cases, filter, onClearFilter, linked }: {
  cases: RecentCase[];
  filter: RecentCasesFilter;
  onClearFilter: () => void;
  /** El gerente ve el resumen pero no tiene acceso a /casos */
  linked: boolean;
}) {
  return (
    <Card className="border-0 shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">
          Casos Recientes
          {filter && (
            <Button
              variant="outline"
              size="sm"
              className="ml-2 h-6 gap-1 rounded-full px-2.5 text-xs font-normal"
              onClick={onClearFilter}
              aria-label={`Quitar filtro: ${filter === "vencidos" ? "vencidos" : "sin asignar"}`}
            >
              Filtro: {filter === "vencidos" ? "Vencidos" : "Sin asignar"}
              <X className="h-3 w-3" aria-hidden="true" />
            </Button>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="divide-y">
          {cases.map((caso) => (
            <RecentCaseRow key={caso.id} casoId={caso.id} linked={linked}>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium truncate">#{caso.id}</p>
                {caso.clientes?.nombre_contacto && (
                  <p className="text-xs text-muted-foreground truncate">{caso.clientes.nombre_contacto}</p>
                )}
              </div>
              <div className="text-right flex items-center gap-2">
                <EstadoBadge nombre={caso.cat_estados?.nombre} />
                <span className="text-xs text-muted-foreground whitespace-nowrap">
                  {timeAgo(caso.updated_at || caso.fecha_caso)}
                </span>
              </div>
            </RecentCaseRow>
          ))}
          {cases.length === 0 && (
            <p className="py-8 text-center text-sm text-muted-foreground">No hay casos</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
