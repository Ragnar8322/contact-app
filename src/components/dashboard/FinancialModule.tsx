import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import { TrendingUp } from "lucide-react";
import {
  startOfDay, startOfWeek, startOfMonth, startOfYear,
  endOfDay, endOfWeek, endOfMonth, endOfYear,
} from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { localTimeZone, QUERY_RESILIENCE } from "@/hooks/useDashboardStats";
import { formatCOP, formatCOPCompact } from "@/lib/currency";
import { buildFinancialChart, type Periodo } from "@/lib/financial";

function getPeriodRange(periodo: Periodo): { inicio: number; fin: number; diasEnMes: number } {
  const now = new Date();
  switch (periodo) {
    case "dia":
      return { inicio: startOfDay(now).getTime(), fin: endOfDay(now).getTime(), diasEnMes: 0 };
    case "semana":
      return {
        inicio: startOfWeek(now, { weekStartsOn: 1 }).getTime(),
        fin:    endOfWeek(now,   { weekStartsOn: 1 }).getTime(),
        diasEnMes: 0,
      };
    case "mes":
      return {
        inicio: startOfMonth(now).getTime(),
        fin:    endOfMonth(now).getTime(),
        diasEnMes: endOfMonth(now).getDate(),
      };
    case "año":
      return { inicio: startOfYear(now).getTime(), fin: endOfYear(now).getTime(), diasEnMes: 0 };
  }
}

const PERIODO_LABEL: Record<Periodo, string> = {
  dia: "hoy", semana: "esta semana", mes: "este mes", año: "este año",
};

const PERIODOS: { key: Periodo; label: string }[] = [
  { key: "dia", label: "Día" },
  { key: "semana", label: "Semana" },
  { key: "mes", label: "Mes" },
  { key: "año", label: "Año" },
];

/* ─── Módulo financiero ───
 * Los totales por tramo se calculan en la base (financial_summary) sobre todos
 * los casos de la campaña; antes se descargaban los casos y la API los cortaba
 * en 1.000 filas.
 */
export function FinancialModule({
  campana,
  showPctRecuperado = true,
}: {
  campana: { id: string; nombre: string };
  showPctRecuperado?: boolean;
}) {
  const [periodo, setPeriodo] = useState<Periodo>("mes");
  const [activeStates, setActiveStates] = useState<Set<string>>(
    new Set(["renovado", "pendiente"])
  );

  const { inicio, fin, diasEnMes } = useMemo(() => getPeriodRange(periodo), [periodo]);

  const { data: financialRows = [], isLoading: financialLoading } = useQuery({
    queryKey: ["financial-summary", campana.id, periodo, inicio, fin],
    ...QUERY_RESILIENCE,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("financial_summary", {
        p_campana_id: campana.id,
        p_desde: new Date(inicio).toISOString(),
        p_hasta: new Date(fin).toISOString(),
        p_periodo: periodo,
        p_tz: localTimeZone(),
      });
      if (error) throw error;
      return data ?? [];
    },
  });

  const financialData = useMemo(
    () => buildFinancialChart(financialRows, periodo, diasEnMes),
    [financialRows, periodo, diasEnMes],
  );

  const showRenovado  = activeStates.has("renovado");
  const showPendiente = activeStates.has("pendiente");
  const renovadoVisible  = showRenovado  ? financialData.renovado  : 0;
  const pendienteVisible = showPendiente ? financialData.pendiente : 0;
  const total = renovadoVisible + pendienteVisible;
  const pctRecuperado =
    total > 0
      ? ((renovadoVisible / total) * 100).toFixed(1)
      : showRenovado && financialData.renovado > 0
        ? "100.0"
        : "—";

  const toggleState = (key: string) => {
    setActiveStates((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  return (
    <Card className="border-0 shadow-sm">
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <CardTitle className="text-base flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-success" />
            Módulo Financiero — {campana.nombre}
          </CardTitle>
          <div className="flex items-center gap-2">
            <div className="flex rounded-lg border bg-muted/50 p-0.5">
              {PERIODOS.map((p) => (
                <button
                  key={p.key}
                  type="button"
                  aria-pressed={periodo === p.key}
                  onClick={() => setPeriodo(p.key)}
                  className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                    periodo === p.key
                      ? "bg-card text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
            <div className="flex gap-1">
              <button
                type="button"
                aria-pressed={showRenovado}
                onClick={() => toggleState("renovado")}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs rounded-full border transition-colors ${
                  showRenovado
                    ? "bg-success/10 border-success text-success"
                    : "border-border text-muted-foreground"
                }`}
              >
                <span className="h-2 w-2 rounded-full bg-success" aria-hidden="true" />Renovado
              </button>
              <button
                type="button"
                aria-pressed={showPendiente}
                onClick={() => toggleState("pendiente")}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs rounded-full border transition-colors ${
                  showPendiente ? "bg-warning/15 border-warning" : "border-border text-muted-foreground"
                }`}
                style={showPendiente ? { color: "hsl(var(--warning))" } : {}}
              >
                <span className="h-2 w-2 rounded-full bg-[hsl(var(--chart-3))]" aria-hidden="true" />Pendiente
              </button>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {financialLoading ? (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-20 rounded-lg" />)}
            </div>
            <Skeleton className="h-72 w-full rounded-lg" />
          </>
        ) : (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className={`rounded-lg p-3 text-center transition-opacity ${
                showRenovado ? "bg-success/10" : "bg-muted/30 opacity-50"
              }`}>
                <p className="text-[11px] text-muted-foreground">Valor renovado</p>
                <p className="text-lg font-bold text-success">
                  {renovadoVisible ? formatCOP(renovadoVisible) : "—"}
                </p>
              </div>
              <div className={`rounded-lg p-3 text-center transition-opacity ${
                showPendiente ? "bg-warning/10" : "bg-muted/30 opacity-50"
              }`}>
                <p className="text-[11px] text-muted-foreground">Valor pendiente</p>
                <p className="text-lg font-bold" style={{ color: "hsl(var(--warning))" }}>
                  {pendienteVisible ? formatCOP(pendienteVisible) : "—"}
                </p>
              </div>
              <div className="rounded-lg bg-muted/50 p-3 text-center">
                <p className="text-[11px] text-muted-foreground">Total en gestión</p>
                <p className="text-lg font-bold">{total ? formatCOP(total) : "—"}</p>
              </div>
              {showPctRecuperado && (
                <div className="rounded-lg bg-muted/50 p-3 text-center">
                  <p className="text-[11px] text-muted-foreground">% Recuperado</p>
                  <p className="text-lg font-bold">
                    {pctRecuperado}{pctRecuperado !== "—" ? "%" : ""}
                  </p>
                </div>
              )}
            </div>

            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={financialData.chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 11 }} width={72} tickFormatter={(v: number) => formatCOPCompact(v)} />
                <Tooltip
                  formatter={(value: number, name: string) => [formatCOP(value), name]}
                  labelFormatter={(label) => `${label} — ${PERIODO_LABEL[periodo]}`}
                />
                {/* Texto de la leyenda en color de texto; el color de la serie solo en el marcador */}
                <Legend formatter={(value) => <span className="text-foreground">{value}</span>} />
                {showRenovado && (
                  <Bar dataKey="renovado" name="Renovado" fill="hsl(var(--success))" radius={[4, 4, 0, 0]} />
                )}
                {showPendiente && (
                  <Bar dataKey="pendiente" name="Pendiente de pago" fill="hsl(var(--chart-3))" radius={[4, 4, 0, 0]} />
                )}
              </BarChart>
            </ResponsiveContainer>
          </>
        )}
      </CardContent>
    </Card>
  );
}
