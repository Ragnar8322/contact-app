import { forwardRef } from "react";
import {
  PieChart, Pie, Cell,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  LineChart, Line,
  ResponsiveContainer, Tooltip,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { safeFormat } from "@/lib/date";
import { getEstadoStyle } from "@/lib/estadoColors";
import type { AnalyticsData } from "@/lib/analytics";

const CLIENTE_COLORS = ["#3b82f6", "#22c55e", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4", "#ec4899"];

function ChartCard({ title, children }: { title: string; children: React.ReactElement }) {
  return (
    <Card>
      <CardHeader><CardTitle className="text-base">{title}</CardTitle></CardHeader>
      <CardContent><div className="h-[250px]"><ResponsiveContainer width="100%" height="100%">{children}</ResponsiveContainer></div></CardContent>
    </Card>
  );
}

/** Las cuatro gráficas de Analítica. El ref apunta al contenedor que se captura para el PDF. */
export const AnalyticsCharts = forwardRef<HTMLDivElement, { data: AnalyticsData }>(function AnalyticsCharts({ data }, ref) {
  return (
    <div ref={ref} className="grid gap-4 md:grid-cols-2">
      <ChartCard title="Casos por Estado">
        <PieChart>
          <Pie data={data.casosPorEstado} dataKey="count" nameKey="estado" cx="50%" cy="50%" outerRadius={80} innerRadius={40}
            label={({ estado, percentage }) => `${estado}: ${percentage.toFixed(0)}%`} labelLine={false}>
            {data.casosPorEstado.map((entry) => <Cell key={entry.estado} fill={getEstadoStyle(entry.estado).hex} />)}
          </Pie>
          <Tooltip formatter={(value: number, name: string) => [`${value} (${((value / data.totalCasos) * 100).toFixed(1)}%)`, name]} />
        </PieChart>
      </ChartCard>
      <ChartCard title="Gestiones por Agente (Top 10)">
        <BarChart data={data.gestionesPorAgente} layout="vertical" margin={{ left: 80, right: 20, top: 5, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" horizontal={false} />
          <XAxis type="number" />
          <YAxis type="category" dataKey="agente" tick={{ fontSize: 11 }} width={75} />
          <Tooltip />
          <Bar dataKey="count" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
        </BarChart>
      </ChartCard>
      <ChartCard title="Evolución Diaria de Gestiones">
        <LineChart data={data.gestionesPorDia} margin={{ left: 0, right: 20, top: 5, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="fecha" tickFormatter={(v) => safeFormat(v, "dd/MM")} tick={{ fontSize: 10 }} />
          <YAxis />
          <Tooltip labelFormatter={(v) => safeFormat(v, "dd/MM/yyyy")} />
          <Line type="monotone" dataKey="count" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} />
        </LineChart>
      </ChartCard>
      <ChartCard title="Distribución de Clientes">
        <PieChart>
          <Pie data={data.distribucionClientes} dataKey="count" nameKey="tipo" cx="50%" cy="50%" outerRadius={80} innerRadius={40}
            label={({ tipo, percentage }) => `${tipo}: ${percentage.toFixed(0)}%`} labelLine={false}>
            {data.distribucionClientes.map((entry, index) => <Cell key={entry.tipo} fill={CLIENTE_COLORS[index % CLIENTE_COLORS.length]} />)}
          </Pie>
          <Tooltip formatter={(value: number, name: string) => [`${value} (${data.distribucionClientes.find((c) => c.tipo === name)?.percentage.toFixed(1)}%)`, name]} />
        </PieChart>
      </ChartCard>
    </div>
  );
});
