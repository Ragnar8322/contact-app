import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type StagingRow = {
  // Raw columns from Excel
  cliente_identificacion: string | null;
  agente_correo: string | null;
  agente_nombre: string | null;
  estado: string | null;
  tipo_servicio: string | null;
  descripcion_inicial: string | null;
  fecha_caso: string | null;
  valor_pagar: string | null;
  // Validation
  _rowIndex: number;
  _errors: string[];
  _valid: boolean;
};

export type ImportResult = {
  inserted: number;
  skipped: number;
  rechazados: { fila: number; identificacion: string | null; motivo: string }[];
};

export type ImportSummary = {
  total: number;
  valid: number;
  invalid: number;
};

// Columnas esperadas en el Excel (case-insensitive)
const COL_MAP: Record<string, keyof Omit<StagingRow, "_rowIndex" | "_errors" | "_valid">> = {
  identificacion:         "cliente_identificacion",
  cliente_identificacion: "cliente_identificacion",
  agente_correo:          "agente_correo",
  correo_agente:          "agente_correo",
  correo:                 "agente_correo",
  email:                  "agente_correo",
  agente:                 "agente_nombre",
  agente_nombre:          "agente_nombre",
  estado:                 "estado",
  tipo_servicio:          "tipo_servicio",
  servicio:               "tipo_servicio",
  descripcion:            "descripcion_inicial",
  descripcion_inicial:    "descripcion_inicial",
  fecha:                  "fecha_caso",
  fecha_caso:             "fecha_caso",
  valor:                  "valor_pagar",
  valor_pagar:            "valor_pagar",
};

/** Valor de una celda como texto. Las celdas de fecha llegan como Date (cellDates) → "YYYY-MM-DD" local. */
export function cellToText(val: unknown): string | null {
  if (val == null) return null;
  if (val instanceof Date) {
    if (isNaN(val.getTime())) return null;
    const y = val.getFullYear();
    const m = String(val.getMonth() + 1).padStart(2, "0");
    const d = String(val.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  const t = String(val).trim();
  return t === "" ? null : t;
}

/** Acepta YYYY-MM-DD y DD/MM/YYYY (los mismos formatos que procesa la base). */
export function isValidFecha(texto: string): boolean {
  let y: number, m: number, d: number;
  let match = texto.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) [y, m, d] = [Number(match[1]), Number(match[2]), Number(match[3])];
  else if ((match = texto.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/))) [d, m, y] = [Number(match[1]), Number(match[2]), Number(match[3])];
  else return false;
  const fecha = new Date(y, m - 1, d);
  return fecha.getFullYear() === y && fecha.getMonth() === m - 1 && fecha.getDate() === d;
}

/** Monto en formato colombiano o simple → número (misma regla que parse_monto_cop en la base). */
export function parseMontoCOP(texto: string): number | null {
  let v = texto.replace(/[^0-9.,]/g, "");
  if (v === "") return null;
  if (v.includes(",")) v = v.replace(/\./g, "").replace(",", ".");
  else if (/^\d{1,3}(\.\d{3})+$/.test(v)) v = v.replace(/\./g, "");
  const n = Number(v);
  return isNaN(n) ? null : n;
}

export function validateRow(raw: Record<string, unknown>, index: number): StagingRow {
  const mapped: Partial<StagingRow> = { _rowIndex: index, _errors: [], _valid: false };

  for (const [rawKey, val] of Object.entries(raw)) {
    const normalized = rawKey.trim().toLowerCase().replace(/ /g, "_");
    const field = COL_MAP[normalized];
    if (field) (mapped as Record<string, unknown>)[field] = cellToText(val);
  }

  const errors: string[] = [];
  if (!mapped.cliente_identificacion) errors.push("Identificación requerida");
  if (!mapped.agente_correo && !mapped.agente_nombre) errors.push("Agente requerido (correo o nombre)");
  if (!mapped.estado)                 errors.push("Estado requerido");
  if (!mapped.tipo_servicio)          errors.push("Tipo de servicio requerido");
  if (!mapped.descripcion_inicial)    errors.push("Descripción requerida");
  if (!mapped.fecha_caso)             errors.push("Fecha requerida");
  else if (!isValidFecha(mapped.fecha_caso)) errors.push("Fecha inválida (use YYYY-MM-DD o DD/MM/YYYY)");
  if (mapped.valor_pagar && parseMontoCOP(mapped.valor_pagar) === null) errors.push("Valor debe ser numérico");

  mapped._errors = errors;
  mapped._valid  = errors.length === 0;
  return mapped as StagingRow;
}

export function useClearStaging() {
  return useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("staging_casos").delete().neq("estado", "__never__");
      if (error) throw error;
    },
  });
}

export function useInsertStaging() {
  return useMutation({
    mutationFn: async (rows: StagingRow[]) => {
      const valid = rows.filter(r => r._valid);
      if (valid.length === 0) return;
      const payload = valid.map(r => ({
        cliente_identificacion: r.cliente_identificacion,
        agente_correo:          r.agente_correo,
        agente_nombre:          r.agente_nombre,
        fila_excel:             r._rowIndex,
        estado:                 r.estado,
        tipo_servicio:          r.tipo_servicio,
        descripcion_inicial:    r.descripcion_inicial,
        fecha_caso:             r.fecha_caso,
        valor_pagar:            r.valor_pagar,
      }));
      const { error } = await supabase.from("staging_casos").insert(payload);
      if (error) throw error;
    },
  });
}

export function useConfirmImport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (campanaId: string | null): Promise<ImportResult> => {
      // Llama a la función SQL que procesa staging → casos de la campaña activa
      const { data, error } = await supabase.rpc("process_staging_casos", { p_campana_id: campanaId ?? undefined });
      if (error) throw error;
      return data as unknown as ImportResult;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["casos"] });
      qc.invalidateQueries({ queryKey: ["admin-cases"] });
    },
  });
}
