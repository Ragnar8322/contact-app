import { useState, useRef } from "react";
import { format } from "date-fns";
import { FileSpreadsheet, FileText, RefreshCw, Loader2 } from "lucide-react";
import { Navigate } from "react-router-dom";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { AnalyticsFiltersBar } from "@/components/analytics/AnalyticsFiltersBar";
import { AnalyticsCharts } from "@/components/analytics/AnalyticsCharts";
import { AgentPerformanceTable } from "@/components/analytics/AgentPerformanceTable";
import { useAnalyticsData } from "@/hooks/useAnalyticsData";
import { useAnalyticsFilters } from "@/hooks/useAnalyticsFilters";
import { useAuth } from "@/contexts/AuthContext";
import { logActivity } from "@/hooks/useActivityLog";
import type { ReportMeta } from "@/lib/reports/types";

const formatNumber     = (n: number) => n.toLocaleString("es-CO");
const formatPercentage = (n: number) => `${n.toFixed(1)}%`;
const formatCOPValue   = (n: number) => `$ ${n.toLocaleString("es-CO", { maximumFractionDigits: 0 })}`;

function Kpi({ label, value, className }: { label: string; value: string; className?: string }) {
  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle></CardHeader>
      <CardContent><div className={`text-2xl font-bold ${className ?? ""}`}>{value}</div></CardContent>
    </Card>
  );
}

export default function Analytics() {
  const { hasRole } = useAuth();
  const chartsRef = useRef<HTMLDivElement>(null);

  const {
    appliedFilters, pendingFilters, updatePendingFilter,
    applyFilters, clearFilters, activeFilterCount, getFilterSummary,
    campanaOptions, agenteOptions, estadoOptions,
  } = useAnalyticsFilters();

  const [exportingPdf, setExportingPdf] = useState(false);
  const [exportingExcel, setExportingExcel] = useState(false);

  const { data, isLoading, refetch, isRefetching } = useAnalyticsData(appliedFilters);

  if (!hasRole(["admin", "gerente", "supervisor"])) return <Navigate to="/" replace />;

  const reportMeta = (): ReportMeta => ({
    desde: appliedFilters.dateFrom,
    hasta: appliedFilters.dateTo,
    filtros: getFilterSummary(),
    generado: new Date(),
  });

  const handleExportPdf = async () => {
    if (!data || !chartsRef.current) return;
    setExportingPdf(true);
    try {
      const { exportAnalyticsPdf } = await import("@/lib/reports/analyticsPdf");
      await exportAnalyticsPdf(data, reportMeta(), chartsRef.current);
      toast.success("Informe ejecutivo PDF generado exitosamente");
      await logActivity("EXPORT", "reporte", undefined, { formato: "pdf", filtros: getFilterSummary() });
    } catch (error) {
      console.error("Error generating PDF:", error);
      toast.error("Error al generar PDF");
    } finally {
      setExportingPdf(false);
    }
  };

  const handleExportExcel = async () => {
    if (!data) return;
    setExportingExcel(true);
    try {
      const [{ buildAnalyticsWorkbook }, { downloadWorkbook }] = await Promise.all([
        import("@/lib/reports/analyticsExcel"),
        import("@/lib/reports/excel"),
      ]);
      const wb = await buildAnalyticsWorkbook(data, reportMeta());
      await downloadWorkbook(wb, `Reporte_Analitica_${format(new Date(), "yyyyMMdd_HHmm")}.xlsx`);
      toast.success("Reporte Excel generado exitosamente");
      await logActivity("EXPORT", "reporte", undefined, { formato: "xlsx", filtros: getFilterSummary() });
    } catch (error) {
      console.error("Error generating Excel:", error);
      toast.error("Error al generar Excel");
    } finally {
      setExportingExcel(false);
    }
  };

  const hasData = !!data && (data.totalCasos > 0 || data.gestionesRegistradas > 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Analítica</h1>
          <p className="text-muted-foreground">Análisis detallado de gestión, casos y rendimiento</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" onClick={() => refetch()} disabled={isRefetching}>
            {isRefetching ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            <span className="ml-1 hidden sm:inline">Actualizar</span>
          </Button>
          <Button variant="outline" onClick={handleExportPdf} disabled={exportingPdf || !hasData}>
            {exportingPdf ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
            <span className="ml-1">Exportar PDF</span>
          </Button>
          <Button variant="outline" onClick={handleExportExcel} disabled={exportingExcel || !hasData}>
            {exportingExcel ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileSpreadsheet className="h-4 w-4" />}
            <span className="ml-1">Exportar Excel</span>
          </Button>
        </div>
      </div>

      <AnalyticsFiltersBar
        filters={pendingFilters}
        onChange={updatePendingFilter}
        onApply={applyFilters}
        onClear={clearFilters}
        activeFilterCount={activeFilterCount}
        campanaOptions={campanaOptions}
        agenteOptions={agenteOptions}
        estadoOptions={estadoOptions}
      />

      {/* Solo la primera carga muestra esqueletos; al actualizar se conservan los datos visibles */}
      {isLoading ? (
        <div className="space-y-6" aria-busy="true" aria-label="Cargando analítica">
          <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
            {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-24 rounded-lg" />)}
          </div>
          <div className="grid gap-6 lg:grid-cols-2">
            {[1, 2].map((i) => <Skeleton key={i} className="h-72 rounded-lg" />)}
          </div>
        </div>
      ) : !hasData ? (
        <Card><CardContent className="py-20 text-center"><p className="text-muted-foreground">Sin datos para los filtros seleccionados</p></CardContent></Card>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Kpi label="Total Casos" value={formatNumber(data.totalCasos)} />
            <Kpi label="Casos Renovados" value={formatNumber(data.casosRenovados)} className="text-success" />
            <Kpi label="Tasa de Renovación" value={formatPercentage(data.tasaRenovacion)} className="text-primary" />
            <Kpi label="Gestiones Registradas" value={formatNumber(data.gestionesRegistradas)} />
          </div>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Kpi label="Total facturado" value={formatCOPValue(data.totalFacturado)} className="text-success" />
            <Kpi label="Pendiente de cobro" value={formatCOPValue(data.pendienteCobro)} className="text-warning" />
            <Kpi label="Valor promedio" value={formatCOPValue(data.valorPromedio)} />
            <Kpi label="% Recaudo" value={formatPercentage(data.porcentajeRecaudo)} className="text-primary" />
          </div>

          <AnalyticsCharts ref={chartsRef} data={data} />

          {/* Al aplicar o limpiar filtros, la tabla vuelve a la primera página */}
          <AgentPerformanceTable key={JSON.stringify(appliedFilters)} agentes={data.rendimientoAgentes} />
        </>
      )}
    </div>
  );
}
