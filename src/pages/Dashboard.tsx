import { useAuth } from "@/contexts/AuthContext";
import { useCampana } from "@/contexts/CampanaContext";
import { useDashboardStats } from "@/hooks/useDashboardStats";
import { useCases } from "@/hooks/useCases";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { FolderOpen, CheckCircle, UserCheck } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";

const CHART_COLORS = [
  "hsl(215, 80%, 48%)",
  "hsl(170, 60%, 42%)",
  "hsl(38, 92%, 50%)",
  "hsl(280, 60%, 55%)",
  "hsl(0, 72%, 55%)",
  "hsl(200, 70%, 50%)",
  "hsl(130, 50%, 45%)",
];

export default function Dashboard() {
  const { user } = useAuth();
  const { campanaActiva } = useCampana();
  const { data: stats, isLoading: statsLoading } = useDashboardStats(user?.id, campanaActiva?.id);
  const { data: cases } = useCases({ campanaId: campanaActiva?.id });

  const recentCases = cases?.slice(0, 8) || [];

  const kpis = [
    { label: "Casos Abiertos", value: stats?.openCount ?? 0, icon: FolderOpen, color: "text-primary" },
    { label: "Cerrados Hoy", value: stats?.closedTodayCount ?? 0, icon: CheckCircle, color: "text-accent" },
    { label: "Mis Casos Activos", value: stats?.myActiveCount ?? 0, icon: UserCheck, color: "text-warning" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">Resumen general del contact center</p>
      </div>

      {/* KPIs */}
      <div className="grid gap-4 sm:grid-cols-3">
        {kpis.map(({ label, value, icon: Icon, color }) => (
          <Card key={label} className="border-0 shadow-sm">
            <CardContent className="flex items-center gap-4 p-5">
              <div className={`flex h-12 w-12 items-center justify-center rounded-xl bg-muted ${color}`}>
                <Icon className="h-6 w-6" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">{label}</p>
                <p className="text-2xl font-bold">{statsLoading ? "..." : value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Chart */}
        <Card className="border-0 shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">Casos por Estado</CardTitle>
          </CardHeader>
          <CardContent>
            {stats?.byStatus && stats.byStatus.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={stats.byStatus}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 15%, 90%)" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} angle={-20} textAnchor="end" height={60} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Bar dataKey="count" radius={[6, 6, 0, 0]} name="Casos">
                    {stats.byStatus.map((_, i) => (
                      <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="py-10 text-center text-muted-foreground text-sm">Sin datos disponibles</p>
            )}
          </CardContent>
        </Card>

        {/* Recent Cases */}
        <Card className="border-0 shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">Casos Recientes</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y">
              {recentCases.map((caso: any) => (
                <div key={caso.id} className="flex items-center justify-between px-5 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">
                      #{caso.id} - {caso.clientes?.nombre_contacto || caso.clientes?.razon_social}
                    </p>
                    <p className="text-xs text-muted-foreground">{caso.cat_tipo_servicio?.nombre}</p>
                  </div>
                  <div className="text-right">
                    <span className="inline-block rounded-full bg-secondary px-2.5 py-0.5 text-xs font-medium text-secondary-foreground">
                      {caso.cat_estados?.nombre}
                    </span>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {format(new Date(caso.fecha_caso), "dd MMM yyyy", { locale: es })}
                    </p>
                  </div>
                </div>
              ))}
              {recentCases.length === 0 && (
                <p className="py-8 text-center text-sm text-muted-foreground">No hay casos registrados</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
