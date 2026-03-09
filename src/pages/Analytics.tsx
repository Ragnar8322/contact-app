import { useState, useRef } from "react";
import { format, startOfMonth, endOfMonth } from "date-fns";
import { es } from "date-fns/locale";
import { BarChart2, FileSpreadsheet, FileText, RefreshCw, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { useCampana } from "@/contexts/CampanaContext";
import { useAnalyticsData } from "@/hooks/useAnalyticsData";
import { cn } from "@/lib/utils";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  LineChart,
  Line,
  ResponsiveContainer,
  Legend,
  Tooltip,
} from "recharts";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import * as XLSX from "xlsx";

const ESTADO_COLORS: Record<string, string> = {
  "Nuevo": "#3b82f6",
  "En Proceso": "#f59e0b",
  "Renovado": "#22c55e",
  "No Renovado": "#ef4444",
  "Pendiente": "#8b5cf6",
  "Cerrado": "#6b7280",
};

const PIE_COLORS = ["#3b82f6", "#22c55e", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4", "#ec4899"];

export default function Analytics() {
  const { toast } = useToast();
  const { campanaActiva } = useCampana();
  const chartsRef = useRef<HTMLDivElement>(null);

  const [dateFrom, setDateFrom] = useState<Date>(startOfMonth(new Date()));
  const [dateTo, setDateTo] = useState<Date>(endOfMonth(new Date()));
  const [currentPage, setCurrentPage] = useState(0);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [exportingExcel, setExportingExcel] = useState(false);

  const { data, isLoading, refetch, isRefetching } = useAnalyticsData(
    dateFrom,
    dateTo,
    campanaActiva?.id
  );

  const ROWS_PER_PAGE = 20;
  const totalPages = Math.ceil((data?.rendimientoAgentes.length || 0) / ROWS_PER_PAGE);
  const paginatedAgentes = data?.rendimientoAgentes.slice(
    currentPage * ROWS_PER_PAGE,
    (currentPage + 1) * ROWS_PER_PAGE
  );

  const formatNumber = (n: number) => n.toLocaleString("es-CO");
  const formatPercentage = (n: number) => `${n.toFixed(1)}%`;

  const handleExportPdf = async () => {
    if (!data || !chartsRef.current) return;
    setExportingPdf(true);

    try {
      const pdf = new jsPDF("p", "mm", "a4");
      const pageWidth = pdf.internal.pageSize.getWidth();
      const margin = 15;

      // Header
      pdf.setFillColor(37, 99, 235);
      pdf.rect(0, 0, pageWidth, 25, "F");
      pdf.setTextColor(255, 255, 255);
      pdf.setFontSize(18);
      pdf.setFont("helvetica", "bold");
      pdf.text("Contact APP — Reporte de Analítica", margin, 16);

      // Date range
      pdf.setTextColor(0, 0, 0);
      pdf.setFontSize(11);
      pdf.setFont("helvetica", "normal");
      pdf.text(
        `Del ${format(dateFrom, "dd/MM/yyyy")} al ${format(dateTo, "dd/MM/yyyy")}`,
        margin,
        35
      );

      // KPI Summary Table
      pdf.setFontSize(14);
      pdf.setFont("helvetica", "bold");
      pdf.text("Resumen de KPIs", margin, 48);

      const kpiData = [
        ["Total Casos", formatNumber(data.totalCasos)],
        ["Casos Renovados", formatNumber(data.casosRenovados)],
        ["Tasa de Renovación", formatPercentage(data.tasaRenovacion)],
        ["Gestiones Registradas", formatNumber(data.gestionesRegistradas)],
      ];

      let yPos = 55;
      pdf.setFontSize(10);
      kpiData.forEach(([label, value]) => {
        pdf.setFont("helvetica", "normal");
        pdf.text(label, margin, yPos);
        pdf.setFont("helvetica", "bold");
        pdf.text(value, margin + 60, yPos);
        yPos += 7;
      });

      // Charts as images
      const canvas = await html2canvas(chartsRef.current, { 
        scale: 2,
        useCORS: true,
        logging: false,
      });
      const imgData = canvas.toDataURL("image/png");
      const imgWidth = pageWidth - margin * 2;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;

      yPos += 10;
      if (yPos + imgHeight > 280) {
        pdf.addPage();
        yPos = margin;
      }
      pdf.addImage(imgData, "PNG", margin, yPos, imgWidth, Math.min(imgHeight, 120));

      // Performance Table
      pdf.addPage();
      pdf.setFontSize(14);
      pdf.setFont("helvetica", "bold");
      pdf.text("Rendimiento por Agente", margin, 20);

      const tableHeaders = ["Agente", "Casos", "Gestiones", "Renovados", "Tasa"];
      const colWidths = [50, 25, 30, 30, 25];

      yPos = 30;
      pdf.setFillColor(37, 99, 235);
      pdf.rect(margin, yPos - 5, pageWidth - margin * 2, 8, "F");
      pdf.setTextColor(255, 255, 255);
      pdf.setFontSize(9);
      pdf.setFont("helvetica", "bold");

      let xPos = margin + 2;
      tableHeaders.forEach((header, i) => {
        pdf.text(header, xPos, yPos);
        xPos += colWidths[i];
      });

      pdf.setTextColor(0, 0, 0);
      pdf.setFont("helvetica", "normal");
      yPos += 8;

      data.rendimientoAgentes.slice(0, 30).forEach((agent) => {
        if (yPos > 275) {
          pdf.addPage();
          yPos = 20;
        }
        xPos = margin + 2;
        pdf.text(agent.agente.substring(0, 20), xPos, yPos);
        xPos += colWidths[0];
        pdf.text(formatNumber(agent.casosAsignados), xPos, yPos);
        xPos += colWidths[1];
        pdf.text(formatNumber(agent.gestiones), xPos, yPos);
        xPos += colWidths[2];
        pdf.text(formatNumber(agent.renovados), xPos, yPos);
        xPos += colWidths[3];
        pdf.text(formatPercentage(agent.tasaRenovacion), xPos, yPos);
        yPos += 6;
      });

      // Footer
      const pageCount = pdf.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        pdf.setPage(i);
        pdf.setFontSize(8);
        pdf.setTextColor(128, 128, 128);
        pdf.text(
          `Generado: ${format(new Date(), "dd/MM/yyyy HH:mm")} | Confidencial`,
          margin,
          290
        );
        pdf.text(`Página ${i} de ${pageCount}`, pageWidth - margin - 20, 290);
      }

      pdf.save(`Reporte_Analitica_${format(new Date(), "yyyyMMdd")}.pdf`);
      toast({ title: "Reporte generado exitosamente" });
    } catch (error) {
      console.error("Error generating PDF:", error);
      toast({ title: "Error al generar PDF", variant: "destructive" });
    } finally {
      setExportingPdf(false);
    }
  };

  const handleExportExcel = async () => {
    if (!data) return;
    setExportingExcel(true);

    try {
      const wb = XLSX.utils.book_new();

      // Sheet 1: Resumen
      const resumenData = [
        ["Métrica", "Valor"],
        ["Total Casos", data.totalCasos],
        ["Casos Renovados", data.casosRenovados],
        ["Tasa de Renovación", `${data.tasaRenovacion.toFixed(1)}%`],
        ["Gestiones Registradas", data.gestionesRegistradas],
      ];
      const wsResumen = XLSX.utils.aoa_to_sheet(resumenData);
      wsResumen["!cols"] = [{ wch: 25 }, { wch: 20 }];
      XLSX.utils.book_append_sheet(wb, wsResumen, "Resumen");

      // Sheet 2: Rendimiento Agentes
      const agentesData = [
        ["Agente", "Casos Asignados", "Gestiones", "Renovados", "Tasa Renovación"],
        ...data.rendimientoAgentes.map((a) => [
          a.agente,
          a.casosAsignados,
          a.gestiones,
          a.renovados,
          `${a.tasaRenovacion.toFixed(1)}%`,
        ]),
      ];
      const wsAgentes = XLSX.utils.aoa_to_sheet(agentesData);
      wsAgentes["!cols"] = [{ wch: 30 }, { wch: 15 }, { wch: 12 }, { wch: 12 }, { wch: 15 }];
      XLSX.utils.book_append_sheet(wb, wsAgentes, "Rendimiento Agentes");

      // Sheet 3: Casos por Estado
      const estadosData = [
        ["Estado", "Cantidad", "Porcentaje"],
        ...data.casosPorEstado.map((e) => [
          e.estado,
          e.count,
          `${e.percentage.toFixed(1)}%`,
        ]),
      ];
      const wsEstados = XLSX.utils.aoa_to_sheet(estadosData);
      wsEstados["!cols"] = [{ wch: 20 }, { wch: 12 }, { wch: 12 }];
      XLSX.utils.book_append_sheet(wb, wsEstados, "Casos por Estado");

      // Sheet 4: Gestiones por Día
      const gestionesDiaData = [
        ["Fecha", "Cantidad"],
        ...data.gestionesPorDia.map((g) => [
          format(new Date(g.fecha), "dd/MM/yyyy"),
          g.count,
        ]),
      ];
      const wsGestiones = XLSX.utils.aoa_to_sheet(gestionesDiaData);
      wsGestiones["!cols"] = [{ wch: 15 }, { wch: 12 }];
      XLSX.utils.book_append_sheet(wb, wsGestiones, "Gestiones por Día");

      // Sheet 5: Clientes
      const clientesData = [
        ["Tipo Cliente", "Cantidad", "Porcentaje"],
        ...data.distribucionClientes.map((c) => [
          c.tipo,
          c.count,
          `${c.percentage.toFixed(1)}%`,
        ]),
      ];
      const wsClientes = XLSX.utils.aoa_to_sheet(clientesData);
      wsClientes["!cols"] = [{ wch: 15 }, { wch: 12 }, { wch: 12 }];
      XLSX.utils.book_append_sheet(wb, wsClientes, "Clientes");

      XLSX.writeFile(wb, `Reporte_Analitica_${format(new Date(), "yyyyMMdd")}.xlsx`);
      toast({ title: "Reporte generado exitosamente" });
    } catch (error) {
      console.error("Error generating Excel:", error);
      toast({ title: "Error al generar Excel", variant: "destructive" });
    } finally {
      setExportingExcel(false);
    }
  };

  const hasData = data && (data.totalCasos > 0 || data.gestionesRegistradas > 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <BarChart2 className="h-6 w-6" />
            Analítica
          </h1>
          <p className="text-muted-foreground">
            Análisis detallado de gestión, casos y rendimiento
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Date From */}
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="w-[140px] justify-start text-left">
                {format(dateFrom, "dd/MM/yyyy")}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={dateFrom}
                onSelect={(d) => d && setDateFrom(d)}
                initialFocus
                className="pointer-events-auto"
              />
            </PopoverContent>
          </Popover>

          <span className="text-muted-foreground">a</span>

          {/* Date To */}
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="w-[140px] justify-start text-left">
                {format(dateTo, "dd/MM/yyyy")}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={dateTo}
                onSelect={(d) => d && setDateTo(d)}
                initialFocus
                className="pointer-events-auto"
              />
            </PopoverContent>
          </Popover>

          <Button
            variant="outline"
            onClick={() => refetch()}
            disabled={isRefetching}
          >
            {isRefetching ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            <span className="ml-1 hidden sm:inline">Actualizar</span>
          </Button>

          <Button
            onClick={handleExportPdf}
            disabled={exportingPdf || !hasData}
            className="bg-primary hover:bg-primary/90"
          >
            {exportingPdf ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <FileText className="h-4 w-4" />
            )}
            <span className="ml-1">Exportar PDF</span>
          </Button>

          <Button
            onClick={handleExportExcel}
            disabled={exportingExcel || !hasData}
            className="bg-primary hover:bg-primary/90"
          >
            {exportingExcel ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <FileSpreadsheet className="h-4 w-4" />
            )}
            <span className="ml-1">Exportar Excel</span>
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : !hasData ? (
        <Card>
          <CardContent className="py-20 text-center">
            <p className="text-muted-foreground">Sin datos para el período seleccionado</p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* KPI Cards */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Total Casos
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatNumber(data.totalCasos)}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Casos Renovados
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">
                  {formatNumber(data.casosRenovados)}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Tasa de Renovación
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-blue-600">
                  {formatPercentage(data.tasaRenovacion)}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Gestiones Registradas
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatNumber(data.gestionesRegistradas)}</div>
              </CardContent>
            </Card>
          </div>

          {/* Charts Grid */}
          <div ref={chartsRef} className="grid gap-4 md:grid-cols-2">
            {/* Chart 1: Casos por Estado */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Casos por Estado</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[250px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={data.casosPorEstado}
                        dataKey="count"
                        nameKey="estado"
                        cx="50%"
                        cy="50%"
                        outerRadius={80}
                        innerRadius={40}
                        label={({ estado, percentage }) => `${estado}: ${percentage.toFixed(0)}%`}
                        labelLine={false}
                      >
                        {data.casosPorEstado.map((entry, index) => (
                          <Cell
                            key={`cell-${index}`}
                            fill={ESTADO_COLORS[entry.estado] || PIE_COLORS[index % PIE_COLORS.length]}
                          />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(value: number, name: string) => [
                          `${value} (${((value / data.totalCasos) * 100).toFixed(1)}%)`,
                          name,
                        ]}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* Chart 2: Gestiones por Agente */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Gestiones por Agente (Top 10)</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[250px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={data.gestionesPorAgente}
                      layout="vertical"
                      margin={{ left: 80, right: 20, top: 5, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                      <XAxis type="number" />
                      <YAxis
                        type="category"
                        dataKey="agente"
                        tick={{ fontSize: 11 }}
                        width={75}
                      />
                      <Tooltip />
                      <Bar dataKey="count" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* Chart 3: Evolución Diaria */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Evolución Diaria de Gestiones</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[250px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart
                      data={data.gestionesPorDia}
                      margin={{ left: 0, right: 20, top: 5, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis
                        dataKey="fecha"
                        tickFormatter={(v) => format(new Date(v), "dd/MM")}
                        tick={{ fontSize: 10 }}
                      />
                      <YAxis />
                      <Tooltip
                        labelFormatter={(v) => format(new Date(v), "dd/MM/yyyy")}
                      />
                      <Line
                        type="monotone"
                        dataKey="count"
                        stroke="hsl(var(--primary))"
                        strokeWidth={2}
                        dot={{ r: 3 }}
                        activeDot={{ r: 5 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* Chart 4: Distribución de Clientes */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Distribución de Clientes</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[250px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={data.distribucionClientes}
                        dataKey="count"
                        nameKey="tipo"
                        cx="50%"
                        cy="50%"
                        outerRadius={80}
                        innerRadius={40}
                        label={({ tipo, percentage }) => `${tipo}: ${percentage.toFixed(0)}%`}
                        labelLine={false}
                      >
                        {data.distribucionClientes.map((entry, index) => (
                          <Cell
                            key={`cell-${index}`}
                            fill={PIE_COLORS[index % PIE_COLORS.length]}
                          />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(value: number, name: string) => [
                          `${value} (${data.distribucionClientes.find(c => c.tipo === name)?.percentage.toFixed(1)}%)`,
                          name,
                        ]}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Performance Table */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Rendimiento por Agente</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Agente</TableHead>
                    <TableHead className="text-right">Casos Asignados</TableHead>
                    <TableHead className="text-right">Gestiones</TableHead>
                    <TableHead className="text-right">Renovados</TableHead>
                    <TableHead className="text-right">Tasa Renovación</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedAgentes?.map((agent) => (
                    <TableRow key={agent.agente}>
                      <TableCell className="font-medium">{agent.agente}</TableCell>
                      <TableCell className="text-right">{formatNumber(agent.casosAsignados)}</TableCell>
                      <TableCell className="text-right">{formatNumber(agent.gestiones)}</TableCell>
                      <TableCell className="text-right">{formatNumber(agent.renovados)}</TableCell>
                      <TableCell className="text-right">
                        <span className={cn(
                          agent.tasaRenovacion >= 50 ? "text-green-600" : 
                          agent.tasaRenovacion >= 25 ? "text-amber-600" : "text-red-600"
                        )}>
                          {formatPercentage(agent.tasaRenovacion)}
                        </span>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-4">
                  <p className="text-sm text-muted-foreground">
                    Mostrando {currentPage * ROWS_PER_PAGE + 1} - {Math.min((currentPage + 1) * ROWS_PER_PAGE, data.rendimientoAgentes.length)} de {data.rendimientoAgentes.length}
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage((p) => Math.max(0, p - 1))}
                      disabled={currentPage === 0}
                    >
                      Anterior
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage((p) => Math.min(totalPages - 1, p + 1))}
                      disabled={currentPage >= totalPages - 1}
                    >
                      Siguiente
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
