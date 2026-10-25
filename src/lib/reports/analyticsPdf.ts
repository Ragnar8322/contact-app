import { format } from "date-fns";
import type { AnalyticsData } from "@/lib/analytics";
import type { ReportMeta } from "./types";

type RGB = [number, number, number];

// ─── KV Renovación 2026 — Paleta oficial ───
const KV = {
  azul:      [13,  50,  102] as RGB, // #0D3266 Azul Institucional
  gradIA:    [109, 138, 239] as RGB, // #6D8AEF Gradiente IA
  cian:      [0,   200, 255] as RGB, // #00C8FF Cian
  magenta:   [255, 0,   200] as RGB, // #FF00C8 Acento
  blanco:    [255, 255, 255] as RGB,
  gris:      [80,  80,  80]  as RGB,
  grisClaro: [240, 242, 248] as RGB,
  negro:     [20,  20,  20]  as RGB,
};
const VERDE: RGB = [22, 140, 60];
const AMBAR: RGB = [200, 100, 0];

const formatNumber = (n: number) => n.toLocaleString("es-CO");
const formatPercentage = (n: number) => `${n.toFixed(1)}%`;
const formatCOP = (n: number) => `$ ${n.toLocaleString("es-CO", { maximumFractionDigits: 0 })}`;

/**
 * Informe ejecutivo en PDF: portada, KPIs, gráficas (captura de `chartsElement`)
 * y tabla de rendimiento por agente. Descarga el archivo al terminar.
 */
export async function exportAnalyticsPdf(data: AnalyticsData, meta: ReportMeta, chartsElement: HTMLElement) {
  const [{ jsPDF }, { default: html2canvas }] = await Promise.all([import("jspdf"), import("html2canvas")]);
  const pdf = new jsPDF("p", "mm", "a4");
  const W  = pdf.internal.pageSize.getWidth();   // 210
  const H  = pdf.internal.pageSize.getHeight();  // 297
  const M  = 14; // margen lateral
  const CW = W - M * 2; // ancho contenido

  const setColor = (rgb: RGB) => pdf.setTextColor(rgb[0], rgb[1], rgb[2]);
  const setFill  = (rgb: RGB) => pdf.setFillColor(rgb[0], rgb[1], rgb[2]);
  const setDraw  = (rgb: RGB) => pdf.setDrawColor(rgb[0], rgb[1], rgb[2]);

  const periodoStr = `${format(meta.desde, "dd/MM/yyyy")} — ${format(meta.hasta, "dd/MM/yyyy")}`;
  const genStr     = format(meta.generado, "dd/MM/yyyy HH:mm");

  // ════════════════════════════════════════════
  // PÁGINA 1 — PORTADA EJECUTIVA
  // ════════════════════════════════════════════
  setFill(KV.azul);
  pdf.rect(0, 0, W, H, "F");

  // Banda de acento degradado-IA con línea cian inferior
  setFill(KV.gradIA);
  pdf.rect(0, 0, W, 8, "F");
  setFill(KV.cian);
  pdf.rect(0, 7, W, 1.5, "F");

  setColor(KV.cian);
  pdf.setFontSize(9);
  pdf.setFont("helvetica", "bold");
  pdf.text("CÁMARA DE COMERCIO DE BARRANQUILLA", M, 20);

  setColor(KV.blanco);
  pdf.setFontSize(8);
  pdf.setFont("helvetica", "normal");
  pdf.text("Contact Center · Sistema de Gestión", M, 26);

  setDraw(KV.cian);
  pdf.setLineWidth(0.5);
  pdf.line(M, 30, W - M, 30);

  setColor(KV.blanco);
  pdf.setFontSize(28);
  pdf.setFont("helvetica", "bold");
  pdf.text("INFORME EJECUTIVO", W / 2, 90, { align: "center" });

  setColor(KV.cian);
  pdf.setFontSize(16);
  pdf.text("Renovación Web 2026", W / 2, 102, { align: "center" });

  setFill(KV.magenta);
  pdf.rect(W / 2 - 20, 107, 40, 1.5, "F");

  setColor(KV.blanco);
  pdf.setFontSize(11);
  pdf.setFont("helvetica", "normal");
  pdf.text("Período analizado", W / 2, 120, { align: "center" });
  setColor(KV.cian);
  pdf.setFontSize(13);
  pdf.setFont("helvetica", "bold");
  pdf.text(periodoStr, W / 2, 129, { align: "center" });

  // Recuadros KPI de portada
  const kpisPortada = [
    { label: "Total Casos",     value: formatNumber(data.totalCasos) },
    { label: "Renovados",       value: formatNumber(data.casosRenovados) },
    { label: "Tasa Renovación", value: formatPercentage(data.tasaRenovacion) },
    { label: "Total Facturado", value: formatCOP(data.totalFacturado) },
  ];
  const cardW = (CW - 6) / 4;
  const cardY = 148;
  kpisPortada.forEach((kpi, i) => {
    const cx = M + i * (cardW + 2);
    setFill([20, 65, 130]);
    pdf.roundedRect(cx, cardY, cardW, 28, 2, 2, "F");
    setDraw(KV.cian);
    pdf.setLineWidth(0.4);
    pdf.roundedRect(cx, cardY, cardW, 28, 2, 2, "S");
    setColor(KV.cian);
    pdf.setFontSize(i === 3 ? 8 : 14);
    pdf.setFont("helvetica", "bold");
    pdf.text(kpi.value, cx + cardW / 2, cardY + 13, { align: "center", maxWidth: cardW - 4 });
    setColor(KV.blanco);
    pdf.setFontSize(7);
    pdf.setFont("helvetica", "normal");
    pdf.text(kpi.label, cx + cardW / 2, cardY + 22, { align: "center" });
  });

  setColor([160, 180, 220]);
  pdf.setFontSize(7.5);
  pdf.setFont("helvetica", "italic");
  pdf.text(`Filtros: ${meta.filtros}`, M, 188, { maxWidth: CW });

  // Franja inferior magenta
  setFill(KV.magenta);
  pdf.rect(0, H - 18, W, 18, "F");
  setColor(KV.blanco);
  pdf.setFontSize(7.5);
  pdf.setFont("helvetica", "bold");
  pdf.text("IA Aplicada · Renovación · Crecimiento", W / 2, H - 8, { align: "center" });
  pdf.setFont("helvetica", "normal");
  pdf.text(`Generado: ${genStr}`, M, H - 4);
  pdf.text("Confidencial — Uso Interno", W - M, H - 4, { align: "right" });

  const drawPageHeader = (title: string) => {
    setFill(KV.azul);
    pdf.rect(0, 0, W, 14, "F");
    setFill(KV.cian);
    pdf.rect(0, 13, W, 1.2, "F");
    setColor(KV.blanco);
    pdf.setFontSize(9);
    pdf.setFont("helvetica", "bold");
    pdf.text("CÁMARA DE COMERCIO · Renovación Web 2026", M, 9);
    pdf.setFont("helvetica", "normal");
    pdf.text(`Período: ${periodoStr}`, W - M, 9, { align: "right" });
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
    pdf.text("Cámara de Comercio de Barranquilla · Contact Center", M, H - 3.5);
    setColor(KV.blanco);
    pdf.text(`Página ${pageNum} de ${total}`, W - M, H - 3.5, { align: "right" });
  };

  // ════════════════════════════════════════════
  // PÁGINA 2 — RESUMEN EJECUTIVO DE KPIs
  // ════════════════════════════════════════════
  pdf.addPage();
  drawPageHeader("Resumen Ejecutivo de KPIs");

  type Tag = "" | "positivo" | "alerta";
  const kpiRows: { seccion: string; items: { label: string; value: string; tag: Tag }[] }[] = [
    { seccion: "GESTIÓN OPERATIVA", items: [
      { label: "Total de Casos en Período",         value: formatNumber(data.totalCasos),           tag: "" },
      { label: "Casos con Estado Renovado",         value: formatNumber(data.casosRenovados),       tag: "positivo" },
      { label: "Tasa de Renovación",                value: formatPercentage(data.tasaRenovacion),   tag: data.tasaRenovacion >= 50 ? "positivo" : "alerta" },
      { label: "Gestiones Registradas (historial)", value: formatNumber(data.gestionesRegistradas), tag: "" },
    ]},
    { seccion: "RESUMEN FINANCIERO", items: [
      { label: "Total Facturado (Renovados)", value: formatCOP(data.totalFacturado),            tag: "positivo" },
      { label: "Pendiente de Cobro",          value: formatCOP(data.pendienteCobro),            tag: "alerta" },
      { label: "Valor Promedio por Caso",     value: formatCOP(data.valorPromedio),             tag: "" },
      { label: "% de Recaudo sobre Total",    value: formatPercentage(data.porcentajeRecaudo),  tag: data.porcentajeRecaudo >= 50 ? "positivo" : "alerta" },
    ]},
  ];

  let y = 38;
  kpiRows.forEach((seccion) => {
    setFill(KV.grisClaro);
    pdf.rect(M, y, CW, 7, "F");
    setColor(KV.azul);
    pdf.setFontSize(8);
    pdf.setFont("helvetica", "bold");
    pdf.text(seccion.seccion, M + 3, y + 5);
    y += 9;

    seccion.items.forEach((item, idx) => {
      if (idx % 2 === 0) {
        setFill([248, 250, 255]);
        pdf.rect(M, y - 1, CW, 9, "F");
      }
      setColor(KV.negro);
      pdf.setFontSize(9.5);
      pdf.setFont("helvetica", "normal");
      pdf.text(item.label, M + 3, y + 5.5);

      setColor(item.tag === "positivo" ? VERDE : item.tag === "alerta" ? AMBAR : KV.azul);
      pdf.setFont("helvetica", "bold");
      pdf.text(item.value, W - M - 3, y + 5.5, { align: "right" });

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
  setColor(KV.gris);
  pdf.text(pdf.splitTextToSize(nota, CW - 10), M + 6, y + 14);

  // ════════════════════════════════════════════
  // PÁGINA 3 — GRÁFICAS
  // ════════════════════════════════════════════
  pdf.addPage();
  drawPageHeader("Análisis Visual — Gráficas");

  const canvas = await html2canvas(chartsElement, {
    scale: 1.8,
    useCORS: true,
    logging: false,
    imageTimeout: 15000,
    windowWidth: 1200,
    backgroundColor: "#ffffff",
    // El informe siempre sale en tema claro, aunque la pantalla esté en oscuro
    onclone: (doc) => doc.documentElement.classList.remove("dark"),
  });
  const imgW = CW;
  const maxImgH = H - 50; // espacio disponible después del header
  // Alto en px del canvas que cabe en una página sin deformar la imagen
  const pxPerPage = Math.floor((maxImgH * canvas.width) / imgW);

  // Si la imagen es más alta que la página, se corta en tramos
  for (let srcY = 0; srcY < canvas.height; srcY += pxPerPage) {
    if (srcY > 0) {
      pdf.addPage();
      drawPageHeader("Análisis Visual (cont.)");
    }
    const sliceH = Math.min(pxPerPage, canvas.height - srcY);
    const slice = document.createElement("canvas");
    slice.width = canvas.width;
    slice.height = sliceH;
    slice.getContext("2d")?.drawImage(canvas, 0, srcY, canvas.width, sliceH, 0, 0, canvas.width, sliceH);
    pdf.addImage(slice.toDataURL("image/png"), "PNG", M, 35, imgW, (sliceH * imgW) / canvas.width);
  }

  // ════════════════════════════════════════════
  // PÁGINA 4+ — TABLA RENDIMIENTO POR AGENTE
  // ════════════════════════════════════════════
  pdf.addPage();
  drawPageHeader("Rendimiento por Agente");

  const tHeaders = ["Agente", "Casos", "Gestiones", "Renovados", "Tasa %"];
  const tWidths  = [62, 24, 28, 28, 24];

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

  let ty = drawTableHeader(36);
  data.rendimientoAgentes.forEach((agent, idx) => {
    if (ty > H - 20) {
      pdf.addPage();
      drawPageHeader("Rendimiento por Agente (cont.)");
      ty = drawTableHeader(36);
    }
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
    [agent.casosAsignados, agent.gestiones, agent.renovados].forEach((n, i) => {
      pdf.text(formatNumber(n), tx + tWidths[i + 1] - 2, ty + 5, { align: "right" });
      tx += tWidths[i + 1];
    });
    const tasa = agent.tasaRenovacion;
    setColor(tasa >= 50 ? VERDE : tasa >= 25 ? [180, 100, 0] : [180, 30, 30]);
    pdf.setFont("helvetica", "bold");
    pdf.text(formatPercentage(tasa), tx + tWidths[4] - 2, ty + 5, { align: "right" });
    setDraw([220, 225, 235]);
    pdf.setLineWidth(0.15);
    pdf.line(M, ty + 7, W - M, ty + 7);
    ty += 8;
  });

  // Pies de página en todas las páginas
  const totalPgs = pdf.getNumberOfPages();
  for (let p = 1; p <= totalPgs; p++) {
    pdf.setPage(p);
    drawPageFooter(p, totalPgs);
  }

  pdf.save(`Informe_Ejecutivo_Renovacion_${format(meta.generado, "yyyyMMdd_HHmm")}.pdf`);
}
