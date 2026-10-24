export interface ReportMeta {
  desde: Date;
  hasta: Date;
  /** Resumen legible de los filtros aplicados */
  filtros: string;
  generado: Date;
}
