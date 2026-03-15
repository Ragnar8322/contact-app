import { useState, useRef } from "react";
import { format } from "date-fns";
import { BarChart2, FileSpreadsheet, FileText, RefreshCw, Loader2, Filter, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { useAnalyticsData } from "@/hooks/useAnalyticsData";
import { useAnalyticsFilters } from "@/hooks/useAnalyticsFilters";
import { useAuth } from "@/contexts/AuthContext";
import { Navigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { safeFormat } from "@/lib/date";
import {
  PieChart, Pie, Cell,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  LineChart, Line,
  ResponsiveContainer, Tooltip,
} from "recharts";
import { getEstadoStyle } from "@/lib/estadoColors";
import { logActivity } from "@/hooks/useActivityLog";

const formatCOPValue = (n: number) =>
  `$ ${n.toLocaleString("es-CO", { maximumFractionDigits: 0 })}`;

// ─── KV Renovación 2026 — Paleta oficial ───────────────────────────────────
const KV = {
  azul:     [13,  50,  102] as [number,number,number],  // #0D3266 Azul Institucional
  gradIA:   [109, 138, 239] as [number,number,number],  // #6D8AEF Gradiente IA
  cian:     [0,   200, 255] as [number,number,number],  // #00C8FF Cian
  magenta:  [255, 0,   200] as [number,number,number],  // #FF00C8 Acento
  blanco:   [255, 255, 255] as [number,number,number],
  gris:     [80,  80,  80]  as [number,number,number],
  grisClaro:[240, 242, 248] as [number,number,number],
  negro:    [20,  20,  20]  as [number,number,number],
};

export default function Analytics() {
  const { hasRole } = useAuth();
  const chartsRef = useRef<HTMLDivElement>(null);

  const {
    appliedFilters, pendingFilters, updatePendingFilter,
    applyFilters, clearFilters, activeFilterCount, getFilterSummary,
    campanaOptions, agenteOptions, estadoOptions,
  } = useAnalyticsFilters();

  const [currentPage, setCurrentPage] = useState(0);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [exportingExcel, setExportingExcel] = useState(false);

  const { data, isLoading, refetch, isRefetching } = useAnalyticsData({
    dateFrom: appliedFilters.dateFrom,
    dateTo: appliedFilters.dateTo,
    campanaId: appliedFilters.campanaId,
    agenteId: appliedFilters.agenteId,
    estadoId: appliedFilters.estadoId,
  });

  if (!hasRole(["admin", "gerente", "supervisor"])) return <Navigate to="/" replace />;

  const ROWS_PER_PAGE = 20;
  const totalPages = Math.ceil((data?.rendimientoAgentes.length || 0) / ROWS_PER_PAGE);
  const paginatedAgentes = data?.rendimientoAgentes.slice(
    currentPage * ROWS_PER_PAGE,
    (currentPage + 1) * ROWS_PER_PAGE
  );

  const formatNumber     = (n: number) => n.toLocaleString("es-CO");
  const formatPercentage = (n: number) => `${n.toFixed(1)}%`;

  const handleApplyFilters = () => { applyFilters(); setCurrentPage(0); };
  const handleClearFilters = () => { clearFilters(); setCurrentPage(0); };

  // ─── PDF EJECUTIVO — KV Renovación 2026 ──────────────────────────────────
  const handleExportPdf = async () => {
    if (!data || !chartsRef.current) return;
    setExportingPdf(true);
    try {
      const [{ jsPDF }, html2canvasModule] = await Promise.all([
        import("jspdf"),
        import("html2canvas"),
      ]);
      const html2canvas = html2canvasModule.default;
      const pdf = new jsPDF("p", "mm", "a4");
      const W  = pdf.internal.pageSize.getWidth();   // 210
      const H  = pdf.internal.pageSize.getHeight();  // 297
      const M  = 14; // margen lateral
      const CW = W - M * 2; // ancho contenido

      // ── Helpers de estilo ──
      const setColor = (rgb: [number,number,number]) => pdf.setTextColor(rgb[0], rgb[1], rgb[2]);
      const setFill  = (rgb: [number,number,number]) => pdf.setFillColor(rgb[0], rgb[1], rgb[2]);
      const setDraw  = (rgb: [number,number,number]) => pdf.setDrawColor(rgb[0], rgb[1], rgb[2]);

      const periodoStr = `${format(appliedFilters.dateFrom, "dd/MM/yyyy")} — ${format(appliedFilters.dateTo, "dd/MM/yyyy")}`;
      const genStr     = format(new Date(), "dd/MM/yyyy HH:mm");

      // ════════════════════════════════════════════
      // PÁGINA 1 — PORTADA EJECUTIVA
      // ════════════════════════════════════════════

      // Fondo completo azul institucional
      setFill(KV.azul);
      pdf.rect(0, 0, W, H, "F");

      // Banda de acento degradado-IA (simulado con rect superpuesto translúcido)
      setFill(KV.gradIA);
      pdf.rect(0, 0, W, 8, "F");

      // Línea cian inferior de la banda
      setFill(KV.cian);
      pdf.rect(0, 7, W, 1.5, "F");

      // Bloque de logos / nombre institución arriba
      setColor(KV.cian);
      pdf.setFontSize(9);
      pdf.setFont("helvetica", "bold");
      pdf.text("CÁMARA DE COMERCIO DE BARRANQUILLA", M, 20);

      setColor(KV.blanco);
      pdf.setFontSize(8);
      pdf.setFont("helvetica", "normal");
      pdf.text("Contact Center · Sistema de Gestión", M, 26);

      // Línea separadora cian
      setDraw(KV.cian);
      pdf.setLineWidth(0.5);
      pdf.line(M, 30, W - M, 30);

      // Título principal centrado
      setColor(KV.blanco);
      pdf.setFontSize(28);
      pdf.setFont("helvetica", "bold");
      pdf.text("INFORME EJECUTIVO", W / 2, 90, { align: "center" });

      // Subtítulo campaña
      setColor(KV.cian);
      pdf.setFontSize(16);
      pdf.setFont("helvetica", "bold");
      pdf.text("Renovación Web 2026", W / 2, 102, { align: "center" });

      // Línea magenta decorativa centrada
      setFill(KV.magenta);
      pdf.rect(W / 2 - 20, 107, 40, 1.5, "F");

      // Período
      setColor(KV.blanco);
      pdf.setFontSize(11);
      pdf.setFont("helvetica", "normal");
      pdf.text("Período analizado", W / 2, 120, { align: "center" });
      setColor(KV.cian);
      pdf.setFontSize(13);
      pdf.setFont("helvetica", "bold");
      pdf.text(periodoStr, W / 2, 129, { align: "center" });

      // Recuadros KPI portada (4 métricas clave)
      const kpisPortada = [
        { label: "Total Casos",      value: formatNumber(data.totalCasos) },
        { label: "Renovados",        value: formatNumber(data.casosRenovados) },
        { label: "Tasa Renovación",  value: formatPercentage(data.tasaRenovacion) },
        { label: "Total Facturado",  value: formatCOPValue(data.totalFacturado) },
      ];
      const cardW = (CW - 6) / 4;
      const cardY = 148;
      kpisPortada.forEach((kpi, i) => {
        const cx = M + i * (cardW + 2);
        // Fondo semi-transparente (azul más claro)
        setFill([20, 65, 130]);
        pdf.roundedRect(cx, cardY, cardW, 28, 2, 2, "F");
        // Borde cian
        setDraw(KV.cian);
        pdf.setLineWidth(0.4);
        pdf.roundedRect(cx, cardY, cardW, 28, 2, 2, "S");
        // Valor
        setColor(KV.cian);
        pdf.setFontSize(i === 3 ? 8 : 14);
        pdf.setFont("helvetica", "bold");
        pdf.text(kpi.value, cx + cardW / 2, cardY + 13, { align: "center", maxWidth: cardW - 4 });
        // Label
        setColor(KV.blanco);
        pdf.setFontSize(7);
        pdf.setFont("helvetica", "normal");
        pdf.text(kpi.label, cx + cardW / 2, cardY + 22, { align: "center" });
      });

      // Filtros aplicados
      setColor([160, 180, 220]);
      pdf.setFontSize(7.5);
      pdf.setFont("helvetica", "italic");
      pdf.text(`Filtros: ${getFilterSummary()}`, M, 188, { maxWidth: CW });

      // Franja inferior magenta + texto
      setFill(KV.magenta);
      pdf.rect(0, H - 18, W, 18, "F");
      setColor(KV.blanco);
      pdf.setFontSize(7.5);
      pdf.setFont("helvetica", "bold");
      pdf.text("IA Aplicada · Renovación · Crecimiento", W / 2, H - 8, { align: "center" });
      pdf.setFont("helvetica", "normal");
      pdf.text(`Generado: ${genStr}`, M, H - 4);
      pdf.text("Confidencial — Uso Interno", W - M, H - 4, { align: "right" });

      // ════════════════════════════════════════════
      // PÁGINA 2 — RESUMEN EJECUTIVO DE KPIs
      // ════════════════════════════════════════════
      pdf.addPage();

      // Header de página interior
      const drawPageHeader = (title: string, pageLabel: string) => {
        setFill(KV.azul);
        pdf.rect(0, 0, W, 14, "F");
        setFill(KV.cian);
        pdf.rect(0, 13, W, 1.2, "F");
        setColor(KV.blanco);
        pdf.setFontSize(9);
        pdf.setFont("helvetica", "bold");
        pdf.text("CÁMARA DE COMERCIO · Renovación Web 2026", M, 9);
        pdf.setFont("helvetica", "normal");
        pdf.text(pageLabel, W - M, 9, { align: "right" });
        // Título sección
        setColor(KV.azul);
        pdf.setFontSize(15);
        pdf.setFont("helvetica", "bold");
        pdf.text(title, M, 26);
        setFill(KV.magenta);
        pdf.rect(M, 28, 30, 1, "F");
      };

      const drawPageFooter = (pageNum: number, total: number) => {
        setFill(KV.azul);
        pdf.rect(0, H - 10, W, 10, "F");
        setColor(KV.cian);
        pdf.setFontSize(7);
        pdf.setFont("helvetica", "normal");
        pdf.text(`Cámara de Comercio de Barranquilla · Contact Center`, M, H - 3.5);
        setColor(KV.blanco);
        pdf.text(`Página ${pageNum} de ${total}`, W - M, H - 3.5, { align: "right" });
      };

      drawPageHeader("Resumen Ejecutivo de KPIs", `Período: ${periodoStr}`);

      // Tabla KPIs operativos
      let y = 38;
      const kpiRows = [
        { seccion: "GESTIÓN OPERATIVA", items: [
          { label: "Total de Casos en Período",       value: formatNumber(data.totalCasos),          tag: "" },
          { label: "Casos con Estado Renovado",        value: formatNumber(data.casosRenovados),       tag: "positivo" },
          { label: "Tasa de Renovación",               value: formatPercentage(data.tasaRenovacion),  tag: data.tasaRenovacion >= 50 ? "positivo" : "alerta" },
          { label: "Gestiones Registradas (historial)",value: formatNumber(data.gestionesRegistradas), tag: "" },
        ]},
        { seccion: "RESUMEN FINANCIERO", items: [
          { label: "Total Facturado (Renovados)",   value: formatCOPValue(data.totalFacturado),  tag: "positivo" },
          { label: "Pendiente de Cobro",            value: formatCOPValue(data.pendienteCobro),  tag: "alerta" },
          { label: "Valor Promedio por Caso",       value: formatCOPValue(data.valorPromedio),   tag: "" },
          { label: "% de Recaudo sobre Total",      value: formatPercentage(data.porcentajeRecaudo), tag: data.porcentajeRecaudo >= 50 ? "positivo" : "alerta" },
        ]},
      ];

      kpiRows.forEach((seccion) => {
        // Encabezado de sección
        setFill(KV.grisClaro);
        pdf.rect(M, y, CW, 7, "F");
        setColor(KV.azul);
        pdf.setFontSize(8);
        pdf.setFont("helvetica", "bold");
        pdf.text(seccion.seccion, M + 3, y + 5);
        y += 9;

        seccion.items.forEach((item, idx) => {
          // Fila alternada
          if (idx % 2 === 0) {
            setFill([248, 250, 255]);
            pdf.rect(M, y - 1, CW, 9, "F");
          }
          setColor(KV.negro);
          pdf.setFontSize(9.5);
          pdf.setFont("helvetica", "normal");
          pdf.text(item.label, M + 3, y + 5.5);

          // Color de valor según tag
          if (item.tag === "positivo") setColor([22, 140, 60]);
          else if (item.tag === "alerta") setColor([200, 100, 0]);
          else setColor(KV.azul);

          pdf.setFont("helvetica", "bold");
          pdf.text(item.value, W - M - 3, y + 5.5, { align: "right" });

          // Línea separadora suave
          setDraw([220, 225, 235]);
          pdf.setLineWidth(0.2);
          pdf.line(M, y + 8, W - M, y + 8);
          y += 9;
        });
        y += 4;
      });

      // Nota interpretativa
      y += 4;
      setFill([230, 240, 255]);
      pdf.roundedRect(M, y, CW, 20, 2, 2, "F");
      setDraw(KV.gradIA);
      pdf.setLineWidth(0.4);
      pdf.roundedRect(M, y, CW, 20, 2, 2, "S");
      setFill(KV.gradIA);
      pdf.rect(M, y, 3, 20, "F");
      setColor(KV.azul);
      pdf.setFontSize(8.5);
      pdf.setFont("helvetica", "bold");
      pdf.text("Nota del período", M + 6, y + 7);
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(8);
      const nota = `Informe generado automáticamente por el sistema Contact Center de la Cámara de Comercio de Barranquilla. Datos correspondientes al período ${periodoStr}. Para consultas adicionales dirigirse al área de Contact Center.`;
      const notaLines = pdf.splitTextToSize(nota, CW - 10);
      setColor(KV.gris);
      pdf.text(notaLines, M + 6, y + 14);

      // ════════════════════════════════════════════
      // PÁGINA 3 — GRÁFICAS
      // ════════════════════════════════════════════
      pdf.addPage();
      drawPageHeader("Análisis Visual — Gráficas", `Período: ${periodoStr}`);

      const canvas = await html2canvas(chartsRef.current!, {
        scale: 1.8,
        useCORS: true,
        logging: false,
        imageTimeout: 15000,
        windowWidth: 1200,
        backgroundColor: "#ffffff",
      });
      const imgData  = canvas.toDataURL("image/png");
      const imgW     = CW;
      const imgH     = (canvas.height * imgW) / canvas.width;
      const maxImgH  = H - 50; // espacio disponible después del header
      const finalH   = Math.min(imgH, maxImgH);
      pdf.addImage(imgData, "PNG", M, 35, imgW, finalH);

      // Si la imagen es más alta, agregar página adicional
      if (imgH > maxImgH) {
        pdf.addPage();
        drawPageHeader("Análisis Visual (cont.)", `Período: ${periodoStr}`);
        const ratioY  = maxImgH / imgH;
        const srcY    = Math.floor(canvas.height * ratioY);
        const remH    = finalH * (1 - ratioY);
        pdf.addImage(imgData, "PNG", M, 35, imgW, remH,
          undefined, "FAST", 0, -(finalH * ratioY));
      }

      // ════════════════════════════════════════════
      // PÁGINA 4+ — TABLA RENDIMIENTO POR AGENTE
      // ════════════════════════════════════════════
      pdf.addPage();
      drawPageHeader("Rendimiento por Agente", `Período: ${periodoStr}`);

      const tHeaders = ["Agente", "Casos", "Gestiones", "Renovados", "Tasa %"];
      const tWidths  = [62, 24, 28, 28, 24];
      let ty = 36;

      const drawTableHeader = (startY: number) => {
        setFill(KV.azul);
        pdf.rect(M, startY, CW, 9, "F");
        setColor(KV.blanco);
        pdf.setFontSize(8.5);
        pdf.setFont("helvetica", "bold");
        let tx = M + 2;
        tHeaders.forEach((h, i) => {
          pdf.text(h, i === 0 ? tx : tx + tWidths[i] - 2, startY + 6.2, { align: i === 0 ? "left" : "right" });
          tx += tWidths[i];
        });
        return startY + 10;
      };

      ty = drawTableHeader(ty);

      data.rendimientoAgentes.forEach((agent, idx) => {
        if (ty > H - 20) {
          pdf.addPage();
          drawPageHeader("Rendimiento por Agente (cont.)", `Período: ${periodoStr}`);
          ty = drawTableHeader(36);
        }
        // Fila alternada
        if (idx % 2 === 0) {
          setFill(KV.grisClaro);
          pdf.rect(M, ty - 1, CW, 8, "F");
        }
        setColor(KV.negro);
        pdf.setFontSize(8.5);
        pdf.setFont("helvetica", "normal");
        let tx = M + 2;
        pdf.text(agent.agente.substring(0, 26), tx, ty + 5);
        tx += tWidths[0];
        pdf.text(formatNumber(agent.casosAsignados), tx + tWidths[1] - 2, ty + 5, { align: "right" }); tx += tWidths[1];
        pdf.text(formatNumber(agent.gestiones),      tx + tWidths[2] - 2, ty + 5, { align: "right" }); tx += tWidths[2];
        pdf.text(formatNumber(agent.renovados),      tx + tWidths[3] - 2, ty + 5, { align: "right" }); tx += tWidths[3];
        // Tasa con color
        const tasa = agent.tasaRenovacion;
        setColor(tasa >= 50 ? [22,140,60] : tasa >= 25 ? [180,100,0] : [180,30,30]);
        pdf.setFont("helvetica", "bold");
        pdf.text(formatPercentage(tasa), tx + tWidths[4] - 2, ty + 5, { align: "right" });
        // Línea separadora
        setDraw([220, 225, 235]);
        pdf.setLineWidth(0.15);
        pdf.line(M, ty + 7, W - M, ty + 7);
        ty += 8;
      });

      // ════════════════════════════════════════════
      // FOOTERS en todas las páginas
      // ════════════════════════════════════════════
      const totalPgs = pdf.getNumberOfPages();
      for (let p = 1; p <= totalPgs; p++) {
        pdf.setPage(p);
        drawPageFooter(p, totalPgs);
      }

      // Guardar
      pdf.save(`Informe_Ejecutivo_Renovacion_${format(new Date(), "yyyyMMdd_HHmm")}.pdf`);
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
      // xlsx-js-style es un fork de xlsx 0.18.5 que agrega estilos de celda.
      // Tiene exactamente la misma API que xlsx, solo agrega la propiedad `.s` en cada celda.
      const XLSX = await import("xlsx-js-style");
      const wb = XLSX.utils.book_new();

      const periodoStr = `${format(appliedFilters.dateFrom, "dd/MM/yyyy")} - ${format(appliedFilters.dateTo, "dd/MM/yyyy")}`;
      const filtrosStr = getFilterSummary();
      const fechaGen   = format(new Date(), "dd/MM/yyyy HH:mm");

      // ── Paleta KV Renovación 2026 ──────────────────────────────────────
      const C = {
        azul:      "0D3266",
        gradIA:    "6D8AEF",
        grisClaro: "F0F2F8",
        blanco:    "FFFFFF",
        negro:     "141414",
        naranja:   "FF6B35",  // alerta pendiente
      } as const;

      // ── Estilos reutilizables ──────────────────────────────────────────
      const sMetaLabel = {
        font: { bold: true, color: { rgb: C.azul }, sz: 10 },
        fill: { fgColor: { rgb: C.grisClaro }, patternType: "solid" as const },
        alignment: { horizontal: "left" as const },
      };
      const sMetaValue = {
        font: { color: { rgb: C.negro }, sz: 10 },
        fill: { fgColor: { rgb: C.grisClaro }, patternType: "solid" as const },
        alignment: { horizontal: "left" as const },
      };
      const sColHeader = {
        font: { bold: true, color: { rgb: C.blanco }, sz: 10 },
        fill: { fgColor: { rgb: C.azul }, patternType: "solid" as const },
        alignment: { horizontal: "center" as const, wrapText: true },
        border: {
          bottom: { style: "thin" as const, color: { rgb: C.gradIA } },
        },
      };
      const sDataNormal = {
        font: { color: { rgb: C.negro }, sz: 10 },
        alignment: { horizontal: "left" as const },
      };
      const sDataAlt = {
        font: { color: { rgb: C.negro }, sz: 10 },
        fill: { fgColor: { rgb: C.grisClaro }, patternType: "solid" as const },
        alignment: { horizontal: "left" as const },
      };
      const sNum = (alt: boolean) => ({
        ...( alt ? sDataAlt : sDataNormal),
        numFmt: "#,##0",
        alignment: { horizontal: "right" as const },
      });
      const sPct = (alt: boolean) => ({
        ...( alt ? sDataAlt : sDataNormal),
        alignment: { horizontal: "right" as const },
      });
      const sSectionTitle = {
        font: { bold: true, color: { rgb: C.blanco }, sz: 11 },
        fill: { fgColor: { rgb: C.gradIA }, patternType: "solid" as const },
      };

      const PCT = (n: number) => `${n.toFixed(1)}%`;

      // ── Helper: aplica estilos a una worksheet ya creada ────────────────
      // META_ROWS = número de filas de encabezado antes de la cabecera de tabla
      // HEADER_ROW = índice de fila (0-based) de la cabecera de columnas
      // numCols = número de columnas
      // numericCols = índices (0-based) de columnas con formato numérico COP
      // pctCols = índices de columnas con porcentaje
      const styleSheet = (
        ws: any,
        metaRows: number,
        headerRowIdx: number,
        numCols: number,
        numericCols: number[] = [],
        pctCols: number[] = []
      ) => {
        const range = XLSX.utils.decode_range(ws["!ref"] ?? "A1");
        const totalRows = range.e.r + 1;

        for (let R = 0; R <= range.e.r; R++) {
          for (let C2 = 0; C2 <= range.e.c; C2++) {
            const addr = XLSX.utils.encode_cell({ r: R, c: C2 });
            if (!ws[addr]) continue;

            // Filas de metadatos (0..metaRows-2, saltando la fila vacía)
            if (R < metaRows - 1) {
              ws[addr].s = C2 === 0 ? sMetaLabel : sMetaValue;
              continue;
            }
            // Fila de cabecera de columnas
            if (R === headerRowIdx) {
              ws[addr].s = sColHeader;
              continue;
            }
            // Filas de datos
            if (R > headerRowIdx) {
              const dataRowIdx = R - headerRowIdx - 1;
              const alt = dataRowIdx % 2 === 1;
              if (numericCols.includes(C2)) {
                ws[addr].s = sNum(alt);
                if (typeof ws[addr].v === "number") ws[addr].t = "n";
              } else if (pctCols.includes(C2)) {
                ws[addr].s = sPct(alt);
              } else {
                ws[addr].s = alt ? sDataAlt : sDataNormal;
              }
            }
          }
        }

        // Fila de altura cabecera
        if (!ws["!rows"]) ws["!rows"] = [];
        ws["!rows"][headerRowIdx] = { hpt: 32 };

        // autoFilter en la fila de cabecera
        const lastCol = XLSX.utils.encode_col(range.e.c);
        const headerAddr = XLSX.utils.encode_row(headerRowIdx);
        ws["!autofilter"] = {
          ref: `A${headerRowIdx + 1}:${lastCol}${headerRowIdx + 1}`,
        };

        return ws;
      };

      // META_ROWS = 5 (4 filas de metadatos + 1 fila vacía)
      const META = 5;
      const HDR  = META; // índice 0-based de la fila de cabecera (fila 6 en Excel)

      // ── 1. RESUMEN ──────────────────────────────────────────────────────
      // El Resumen es diferente: no tiene tabla filtrable, sino secciones
      const wsResumenRows = [
        [{ v: "Reporte", s: sMetaLabel },        { v: "Resumen Ejecutivo", s: sMetaValue }],
        [{ v: "Período", s: sMetaLabel },         { v: periodoStr, s: sMetaValue }],
        [{ v: "Filtros aplicados", s: sMetaLabel }, { v: filtrosStr, s: sMetaValue }],
        [{ v: "Fecha de generación", s: sMetaLabel }, { v: fechaGen, s: sMetaValue }],
        [],
        [{ v: "INDICADORES DE GESTIÓN", s: sSectionTitle }],
        [{ v: "Total Casos", s: sDataNormal }, { v: data.totalCasos, s: sNum(false) }],
        [{ v: "Casos Renovados", s: sDataAlt }, { v: data.casosRenovados, s: sNum(true) }],
        [{ v: "Tasa de Renovación", s: sDataNormal }, { v: PCT(data.tasaRenovacion), s: sPct(false) }],
        [{ v: "Gestiones Registradas", s: sDataAlt }, { v: data.gestionesRegistradas, s: sNum(true) }],
        [],
        [{ v: "RESUMEN FINANCIERO", s: sSectionTitle }],
        [{ v: "Total Facturado", s: sDataNormal }, { v: data.totalFacturado, s: sNum(false) }],
        [{ v: "Pendiente de Cobro", s: sDataAlt },  { v: data.pendienteCobro, s: sNum(true) }],
        [{ v: "% Recaudo", s: sDataNormal }, { v: PCT(data.porcentajeRecaudo), s: sPct(false) }],
        [{ v: "Valor Promedio / Renovación", s: sDataAlt }, { v: data.valorPromedio, s: sNum(true) }],
        [],
        [{ v: "DISTRIBUCIÓN POR TIPO DE CLIENTE", s: sSectionTitle }],
        [
          { v: "Tipo", s: sColHeader }, { v: "Cantidad", s: sColHeader },
          { v: "% del total", s: sColHeader }, { v: "Valor Facturado", s: sColHeader },
        ],
        ...data.distribucionClientes.map((c, i) => {
          const alt = i % 2 === 1;
          return [
            { v: c.tipo, s: alt ? sDataAlt : sDataNormal },
            { v: c.count, s: sNum(alt) },
            { v: PCT(c.percentage), s: sPct(alt) },
            { v: c.valorFacturado, s: sNum(alt) },
          ];
        }),
      ];
      const wsResumen = XLSX.utils.aoa_to_sheet(wsResumenRows);
      wsResumen["!cols"] = [{ wch: 32 }, { wch: 22 }, { wch: 14 }, { wch: 20 }];
      XLSX.utils.book_append_sheet(wb, wsResumen, "Resumen");

      // ── 2. TRÁMITES RENOVADOS ───────────────────────────────────────────
      const tramHeaders = [
        "Fecha Renovación", "N° Matrícula / ID", "Razón Social / Nombre",
        "Tipo", "Agente", "Campaña", "Valor Pagado", "Días hasta Renovación",
      ];
      const tramData = data.tramitesRenovados.map((t) => [
        t.fechaRenovacion, t.numeroMatricula, t.nombreRazonSocial,
        t.tipo, t.agente, t.campana, t.valorPagado, t.diasHastaRenovacion,
      ]);
      const wsTramitesRows = [
        ["Reporte", "Trámites Renovados"],
        ["Período", periodoStr],
        ["Filtros aplicados", filtrosStr],
        ["Fecha de generación", fechaGen],
        [],
        tramHeaders,
        ...tramData,
      ];
      let wsTramites = XLSX.utils.aoa_to_sheet(wsTramitesRows);
      wsTramites["!cols"] = [
        { wch: 16 }, { wch: 18 }, { wch: 36 }, { wch: 10 },
        { wch: 28 }, { wch: 24 }, { wch: 16 }, { wch: 22 },
      ];
      wsTramites = styleSheet(wsTramites, META, HDR, tramHeaders.length, [6], []);
      XLSX.utils.book_append_sheet(wb, wsTramites, "Trámites Renovados");

      // ── 3. PENDIENTES DE PAGO ───────────────────────────────────────────
      const pendHeaders = [
        "Fecha del Caso", "N° Matrícula / ID", "Razón Social / Nombre",
        "Agente", "Campaña", "Valor", "Días en Pendiente",
      ];
      const pendData = data.pendientesPago.map((p) => [
        p.fechaCaso, p.numeroMatricula, p.nombreRazonSocial,
        p.agente, p.campana, p.valor, p.diasEnPendiente,
      ]);
      const wsPendientesRows = [
        ["Reporte", "Pendientes de Pago"],
        ["Período", periodoStr],
        ["Filtros aplicados", filtrosStr],
        ["Fecha de generación", fechaGen],
        [],
        pendHeaders,
        ...pendData,
      ];
      let wsPendientes = XLSX.utils.aoa_to_sheet(wsPendientesRows);
      wsPendientes["!cols"] = [
        { wch: 16 }, { wch: 18 }, { wch: 36 }, { wch: 28 },
        { wch: 24 }, { wch: 16 }, { wch: 18 },
      ];
      wsPendientes = styleSheet(wsPendientes, META, HDR, pendHeaders.length, [5], []);
      // Destacar en naranja las celdas con más de 30 días en pendiente (col 6)
      const pendRange = XLSX.utils.decode_range(wsPendientes["!ref"] ?? "A1");
      for (let R = HDR + 1; R <= pendRange.e.r; R++) {
        const daysCell = XLSX.utils.encode_cell({ r: R, c: 6 });
        if (wsPendientes[daysCell] && typeof wsPendientes[daysCell].v === "number" && wsPendientes[daysCell].v > 30) {
          const alt = (R - HDR - 1) % 2 === 1;
          wsPendientes[daysCell].s = {
            font: { bold: true, color: { rgb: C.naranja }, sz: 10 },
            fill: alt ? { fgColor: { rgb: C.grisClaro }, patternType: "solid" as const } : undefined,
            numFmt: "#,##0",
            alignment: { horizontal: "right" as const },
          };
        }
      }
      XLSX.utils.book_append_sheet(wb, wsPendientes, "Pendientes de Pago");

      // ── 4. RECAUDO POR FECHA ────────────────────────────────────────────
      const recHeaders = [
        "Fecha", "Renovados del día", "Valor Facturado", "Valor Pendiente", "% Recaudo del día",
      ];
      const recData = data.recaudoPorFecha.map((r) => [
        r.fecha, r.renovadosDelDia, r.valorFacturado, r.valorPendiente, PCT(r.porcentajeRecaudo),
      ]);
      const wsRecaudoRows = [
        ["Reporte", "Recaudo por Fecha"],
        ["Período", periodoStr],
        ["Filtros aplicados", filtrosStr],
        ["Fecha de generación", fechaGen],
        [],
        recHeaders,
        ...recData,
      ];
      let wsRecaudo = XLSX.utils.aoa_to_sheet(wsRecaudoRows);
      wsRecaudo["!cols"] = [{ wch: 14 }, { wch: 18 }, { wch: 18 }, { wch: 18 }, { wch: 20 }];
      wsRecaudo = styleSheet(wsRecaudo, META, HDR, recHeaders.length, [2, 3], [4]);
      XLSX.utils.book_append_sheet(wb, wsRecaudo, "Recaudo por Fecha");

      // ── 5. RENDIMIENTO AGENTES ──────────────────────────────────────────
      const agHeaders = [
        "Agente", "Casos Asignados", "Gestiones", "Renovados",
        "Tasa Renovación", "Valor Facturado", "Valor Pendiente",
        "% Recaudo", "Promedio / Renovación",
      ];
      const agData = data.rendimientoAgentes.map((a) => [
        a.agente, a.casosAsignados, a.gestiones, a.renovados,
        PCT(a.tasaRenovacion), a.valorFacturado, a.valorPendiente,
        PCT(a.porcentajeRecaudo), a.promedioPorRenovacion,
      ]);
      const wsAgentesRows = [
        ["Reporte", "Rendimiento de Agentes"],
        ["Período", periodoStr],
        ["Filtros aplicados", filtrosStr],
        ["Fecha de generación", fechaGen],
        [],
        agHeaders,
        ...agData,
      ];
      let wsAgentes = XLSX.utils.aoa_to_sheet(wsAgentesRows);
      wsAgentes["!cols"] = [
        { wch: 30 }, { wch: 16 }, { wch: 12 }, { wch: 12 },
        { wch: 16 }, { wch: 18 }, { wch: 18 }, { wch: 12 }, { wch: 22 },
      ];
      wsAgentes = styleSheet(wsAgentes, META, HDR, agHeaders.length, [1, 2, 3, 5, 6, 8], [4, 7]);
      XLSX.utils.book_append_sheet(wb, wsAgentes, "Rendimiento Agentes");

      // ── 6. GESTIONES POR DÍA ────────────────────────────────────────────
      const gHeaders = [
        "Fecha", "Gestiones", "Renovados del día", "Valor Facturado del día", "Valor Pendiente del día",
      ];
      const gData = data.gestionesPorDia.map((g) => [
        g.fecha.substring(0, 10), g.count, g.renovadosDelDia,
        g.valorFacturadoDia, g.valorPendienteDia,
      ]);
      const wsGestionesRows = [
        ["Reporte", "Gestiones por Día"],
        ["Período", periodoStr],
        ["Filtros aplicados", filtrosStr],
        ["Fecha de generación", fechaGen],
        [],
        gHeaders,
        ...gData,
      ];
      let wsGestiones = XLSX.utils.aoa_to_sheet(wsGestionesRows);
      wsGestiones["!cols"] = [{ wch: 14 }, { wch: 12 }, { wch: 18 }, { wch: 22 }, { wch: 22 }];
      wsGestiones = styleSheet(wsGestiones, META, HDR, gHeaders.length, [1, 2, 3, 4], []);
      XLSX.utils.book_append_sheet(wb, wsGestiones, "Gestiones por Día");

      // ── 7. CASOS POR ESTADO ─────────────────────────────────────────────
      const estHeaders = ["Estado", "Cantidad", "Porcentaje"];
      const estData = data.casosPorEstado.map((e) => [e.estado, e.count, PCT(e.percentage)]);
      const wsEstadosRows = [
        ["Reporte", "Casos por Estado"],
        ["Período", periodoStr],
        ["Filtros aplicados", filtrosStr],
        ["Fecha de generación", fechaGen],
        [],
        estHeaders,
        ...estData,
      ];
      let wsEstados = XLSX.utils.aoa_to_sheet(wsEstadosRows);
      wsEstados["!cols"] = [{ wch: 24 }, { wch: 12 }, { wch: 12 }];
      wsEstados = styleSheet(wsEstados, META, HDR, estHeaders.length, [1], [2]);
      XLSX.utils.book_append_sheet(wb, wsEstados, "Casos por Estado");

      // ── 8. POR CAMPAÑA ──────────────────────────────────────────────────
      const campHeaders = [
        "Campaña", "Casos", "Renovados", "Tasa Renovación", "Facturado", "Pendiente",
      ];
      const campData = data.resumenCampanas.map((c) => [
        c.campana, c.casos, c.renovados, PCT(c.tasa), c.facturado, c.pendiente,
      ]);
      const wsCampanaRows = [
        ["Reporte", "Resumen por Campaña"],
        ["Período", periodoStr],
        ["Filtros aplicados", filtrosStr],
        ["Fecha de generación", fechaGen],
        [],
        campHeaders,
        ...campData,
      ];
      let wsCampana = XLSX.utils.aoa_to_sheet(wsCampanaRows);
      wsCampana["!cols"] = [{ wch: 28 }, { wch: 10 }, { wch: 12 }, { wch: 16 }, { wch: 18 }, { wch: 18 }];
      wsCampana = styleSheet(wsCampana, META, HDR, campHeaders.length, [1, 2, 4, 5], [3]);
      XLSX.utils.book_append_sheet(wb, wsCampana, "Por Campaña");

      // ── 9. CLIENTES ─────────────────────────────────────────────────────
      const cliHeaders = ["Tipo Cliente", "Cantidad", "Porcentaje", "Valor Facturado"];
      const cliData = data.distribucionClientes.map((c) => [
        c.tipo, c.count, PCT(c.percentage), c.valorFacturado,
      ]);
      const wsClientesRows = [
        ["Reporte", "Distribución de Clientes"],
        ["Período", periodoStr],
        ["Filtros aplicados", filtrosStr],
        ["Fecha de generación", fechaGen],
        [],
        cliHeaders,
        ...cliData,
      ];
      let wsClientes = XLSX.utils.aoa_to_sheet(wsClientesRows);
      wsClientes["!cols"] = [{ wch: 18 }, { wch: 12 }, { wch: 14 }, { wch: 20 }];
      wsClientes = styleSheet(wsClientes, META, HDR, cliHeaders.length, [1, 3], [2]);
      XLSX.utils.book_append_sheet(wb, wsClientes, "Clientes");

      XLSX.writeFile(wb, `Reporte_Analitica_${format(new Date(), "yyyyMMdd_HHmm")}.xlsx`);
      toast.success("Reporte Excel generado exitosamente");
      await logActivity("EXPORT", "reporte", undefined, { formato: "xlsx", filtros: getFilterSummary() });
    } catch (error) {
      console.error("Error generating Excel:", error);
      toast.error("Error al generar Excel");
    } finally {
      setExportingExcel(false);
    }
  };

  const hasData = data && (data.totalCasos > 0 || data.gestionesRegistradas > 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <BarChart2 className="h-6 w-6" />
            Analítica
          </h1>
          <p className="text-muted-foreground">Análisis detallado de gestión, casos y rendimiento</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" onClick={() => refetch()} disabled={isRefetching}>
            {isRefetching ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            <span className="ml-1 hidden sm:inline">Actualizar</span>
          </Button>
          <Button onClick={handleExportPdf} disabled={exportingPdf || !hasData} className="bg-primary hover:bg-primary/90">
            {exportingPdf ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
            <span className="ml-1">Exportar PDF</span>
          </Button>
          <Button onClick={handleExportExcel} disabled={exportingExcel || !hasData} className="bg-primary hover:bg-primary/90">
            {exportingExcel ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileSpreadsheet className="h-4 w-4" />}
            <span className="ml-1">Exportar Excel</span>
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="py-4">
          <div className="flex flex-wrap items-center gap-3">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-[130px] justify-start text-left text-sm">{format(pendingFilters.dateFrom, "dd/MM/yyyy")}</Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={pendingFilters.dateFrom} onSelect={(d) => d && updatePendingFilter("dateFrom", d)} initialFocus className="pointer-events-auto" />
              </PopoverContent>
            </Popover>
            <span className="text-muted-foreground text-sm">a</span>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-[130px] justify-start text-left text-sm">{format(pendingFilters.dateTo, "dd/MM/yyyy")}</Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={pendingFilters.dateTo} onSelect={(d) => d && updatePendingFilter("dateTo", d)} initialFocus className="pointer-events-auto" />
              </PopoverContent>
            </Popover>
            <Select value={pendingFilters.campanaId || "all"} onValueChange={(v) => updatePendingFilter("campanaId", v === "all" ? null : v)}>
              <SelectTrigger className="w-[180px]"><SelectValue placeholder="Todas las campañas" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas las campañas</SelectItem>
                {campanaOptions.map((opt) => <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={pendingFilters.agenteId || "all"} onValueChange={(v) => updatePendingFilter("agenteId", v === "all" ? null : v)}>
              <SelectTrigger className="w-[180px]"><SelectValue placeholder="Todos los agentes" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los agentes</SelectItem>
                {agenteOptions.map((opt) => <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={pendingFilters.estadoId ? String(pendingFilters.estadoId) : "all"} onValueChange={(v) => updatePendingFilter("estadoId", v === "all" ? null : Number(v))}>
              <SelectTrigger className="w-[160px]"><SelectValue placeholder="Todos los estados" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los estados</SelectItem>
                {estadoOptions.map((opt) => <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button onClick={handleApplyFilters} className="bg-primary hover:bg-primary/90"><Filter className="h-4 w-4 mr-1" />Aplicar</Button>
            <Button variant="ghost" onClick={handleClearFilters}><X className="h-4 w-4 mr-1" />Limpiar filtros</Button>
            {activeFilterCount > 0 && (
              <Badge variant="secondary" className="ml-2">
                {activeFilterCount} filtro{activeFilterCount > 1 ? "s" : ""} activo{activeFilterCount > 1 ? "s" : ""}
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>

      {isLoading || isRefetching ? (
        <div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
      ) : !hasData ? (
        <Card><CardContent className="py-20 text-center"><p className="text-muted-foreground">Sin datos para los filtros seleccionados</p></CardContent></Card>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Total Casos</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{formatNumber(data!.totalCasos)}</div></CardContent></Card>
            <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Casos Renovados</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold text-green-600">{formatNumber(data!.casosRenovados)}</div></CardContent></Card>
            <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Tasa de Renovación</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold text-blue-600">{formatPercentage(data!.tasaRenovacion)}</div></CardContent></Card>
            <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Gestiones Registradas</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{formatNumber(data!.gestionesRegistradas)}</div></CardContent></Card>
          </div>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">💰 Total Facturado</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold text-green-600">{formatCOPValue(data!.totalFacturado)}</div></CardContent></Card>
            <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">⏳ Pendiente de Cobro</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold text-amber-600">{formatCOPValue(data!.pendienteCobro)}</div></CardContent></Card>
            <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">📊 Valor Promedio</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{formatCOPValue(data!.valorPromedio)}</div></CardContent></Card>
            <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">🎯 % Recaudo</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold text-blue-600">{formatPercentage(data!.porcentajeRecaudo)}</div></CardContent></Card>
          </div>

          <div ref={chartsRef} className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader><CardTitle className="text-base">Casos por Estado</CardTitle></CardHeader>
              <CardContent><div className="h-[250px]"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={data!.casosPorEstado} dataKey="count" nameKey="estado" cx="50%" cy="50%" outerRadius={80} innerRadius={40} label={({ estado, percentage }) => `${estado}: ${percentage.toFixed(0)}%`} labelLine={false}>{data!.casosPorEstado.map((entry, index) => <Cell key={`cell-${index}`} fill={getEstadoStyle(entry.estado).hex} />)}</Pie><Tooltip formatter={(value: number, name: string) => [`${value} (${((value / data!.totalCasos) * 100).toFixed(1)}%)`, name]} /></PieChart></ResponsiveContainer></div></CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-base">Gestiones por Agente (Top 10)</CardTitle></CardHeader>
              <CardContent><div className="h-[250px]"><ResponsiveContainer width="100%" height="100%"><BarChart data={data!.gestionesPorAgente} layout="vertical" margin={{ left: 80, right: 20, top: 5, bottom: 5 }}><CartesianGrid strokeDasharray="3 3" horizontal={false} /><XAxis type="number" /><YAxis type="category" dataKey="agente" tick={{ fontSize: 11 }} width={75} /><Tooltip /><Bar dataKey="count" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} /></BarChart></ResponsiveContainer></div></CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-base">Evolución Diaria de Gestiones</CardTitle></CardHeader>
              <CardContent><div className="h-[250px]"><ResponsiveContainer width="100%" height="100%"><LineChart data={data!.gestionesPorDia} margin={{ left: 0, right: 20, top: 5, bottom: 5 }}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="fecha" tickFormatter={(v) => safeFormat(v, "dd/MM")} tick={{ fontSize: 10 }} /><YAxis /><Tooltip labelFormatter={(v) => safeFormat(v, "dd/MM/yyyy")} /><Line type="monotone" dataKey="count" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} /></LineChart></ResponsiveContainer></div></CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-base">Distribución de Clientes</CardTitle></CardHeader>
              <CardContent><div className="h-[250px]"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={data!.distribucionClientes} dataKey="count" nameKey="tipo" cx="50%" cy="50%" outerRadius={80} innerRadius={40} label={({ tipo, percentage }) => `${tipo}: ${percentage.toFixed(0)}%`} labelLine={false}>{data!.distribucionClientes.map((entry, index) => <Cell key={`cell-${index}`} fill={["#3b82f6","#22c55e","#f59e0b","#ef4444","#8b5cf6","#06b6d4","#ec4899"][index % 7]} />)}</Pie><Tooltip formatter={(value: number, name: string) => [`${value} (${data!.distribucionClientes.find((c) => c.tipo === name)?.percentage.toFixed(1)}%)`, name]} /></PieChart></ResponsiveContainer></div></CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader><CardTitle className="text-base">Rendimiento por Agente</CardTitle></CardHeader>
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
                        <span className={cn(agent.tasaRenovacion >= 50 ? "text-green-600" : agent.tasaRenovacion >= 25 ? "text-amber-600" : "text-red-600")}>
                          {formatPercentage(agent.tasaRenovacion)}
                        </span>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-4">
                  <p className="text-sm text-muted-foreground">Mostrando {currentPage * ROWS_PER_PAGE + 1} - {Math.min((currentPage + 1) * ROWS_PER_PAGE, data!.rendimientoAgentes.length)} de {data!.rendimientoAgentes.length}</p>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => setCurrentPage((p) => Math.max(0, p - 1))} disabled={currentPage === 0}>Anterior</Button>
                    <Button variant="outline" size="sm" onClick={() => setCurrentPage((p) => Math.min(totalPages - 1, p + 1))} disabled={currentPage >= totalPages - 1}>Siguiente</Button>
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
