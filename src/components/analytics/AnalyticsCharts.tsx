import { forwardRef } from "react";
import {
  Cell, LabelList,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  LineChart, Line,
  ResponsiveContainer, Tooltip,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { safeFormat } from "@/lib/date";
import { getEstadoStyle } from "@/lib/estadoColors";
import type { AnalyticsData } from "@/lib/analytics";

const CLIENTE_COLORS = ["#3b82f6", "#22c55e", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4", "#ec4899"];

function ChartCard({ title, children, height = 250 }: { title: string; children: React.ReactElement; height?: number }) {
  return (
    <Card>
      <CardHeader><CardTitle className="text-base">{title}</CardTitle></CardHeader>
      <CardContent><div style={{ height }}><ResponsiveContainer width="100%" height="100%">{children}</ResponsiveContainer></div></CardContent>
    </Card>
  );
}

// Barras horizontales ordenadas con «cantidad (porcentaje)» al final: se leen mejor que una
// torta con muchas porciones y no dependen solo del color
const alturaBarras = (n: number) => Math.max(160, n * 30 + 30);
const conEtiqueta = <T extends { count: number; percentage: number }>(filas: T[]) =>
  filas.map((f) => ({ ...f, etiqueta: `${f.count.toLocaleString("es-CO")} (${f.percentage.toFixed(0)}%)` }));

// Una sola línea a la derecha de la barra (la posición "right" de recharts la corta al ancho de la barra)
function EtiquetaBarra({ x = 0, y = 0, width = 0, height = 0, value }: {
  x?: number | string; y?: number | string; width?: number | string; height?: number | string; value?: string | number;
}) {
  return (
    <text x={Number(x) + Number(width) + 6} y={Number(y) + Number(height) / 2} dominantBaseline="middle" className="fill-foreground text-xs">
      {value}
    </text>
  );
}

// ResponsiveContainer entrega width y height a su hijo directo: se reenvían al BarChart
function BarrasDistribucion<T extends { count: number; percentage: number }>({ data, nombre, color, width, height }: {
  data: T[];
  nombre: keyof T & string;
  color: (fila: T, i: number) => string;
  width?: number;
  height?: number;
}) {
  return (
    <BarChart width={width} height={height} data={conEtiqueta(data)} layout="vertical" margin={{ left: 8, right: 72, top: 4, bottom: 4 }}>
      <XAxis type="number" hide />
      <YAxis type="category" dataKey={nombre} tick={{ fontSize: 11 }} width={120} axisLine={false} tickLine={false} />
      <Tooltip formatter={(value: number) => [value.toLocaleString("es-CO"), "Casos"]} />
      <Bar dataKey="count" radius={[0, 4, 4, 0]} isAnimationActive={false}>
        {data.map((fila, i) => <Cell key={String(fila[nombre])} fill={color(fila, i)} />)}
        <LabelList dataKey="etiqueta" content={EtiquetaBarra} />
      </Bar>
    </BarChart>
  );
}

/** Las cuatro gráficas de Analítica. El ref apunta al contenedor que se captura para el PDF. */
export const AnalyticsCharts = forwardRef<HTMLDivElement, { data: AnalyticsData }>(function AnalyticsCharts({ data }, ref) {
  return (
    <div ref={ref} className="grid gap-4 md:grid-cols-2">
      <ChartCard title="Casos por Estado" height={alturaBarras(data.casosPorEstado.length)}>
        <BarrasDistribucion data={data.casosPorEstado} nombre="estado" color={(e) => getEstadoStyle(e.estado).hex} />
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
      <ChartCard title="Distribución de Clientes" height={alturaBarras(data.distribucionClientes.length)}>
        <BarrasDistribucion data={data.distribucionClientes} nombre="tipo" color={(_c, i) => CLIENTE_COLORS[i % CLIENTE_COLORS.length]} />
      </ChartCard>
    </div>
  );
});
