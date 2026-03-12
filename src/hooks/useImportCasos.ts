import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type StagingRow = {
  // Raw columns from Excel
  cliente_identificacion: string | null;
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

export type ImportSummary = {
  total: number;
  valid: number;
  invalid: number;
};

// Columnas esperadas en el Excel (case-insensitive)
const COL_MAP: Record<string, keyof Omit<StagingRow, "_rowIndex" | "_errors" | "_valid">> = {
  identificacion:         "cliente_identificacion",
  cliente_identificacion: "cliente_identificacion",
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

export function validateRow(raw: Record<string, unknown>, index: number): StagingRow {
  const mapped: Partial<StagingRow> = { _rowIndex: index, _errors: [], _valid: false };

  // Map headers
  for (const [rawKey, val] of Object.entries(raw)) {
    const normalized = rawKey.trim().toLowerCase().replace(/ /g, "_");
    const field = COL_MAP[normalized];
    if (field) (mapped as Record<string, unknown>)[field] = val != null ? String(val).trim() : null;
  }

  const errors: string[] = [];

  if (!mapped.cliente_identificacion) errors.push("Identificación requerida");
  if (!mapped.agente_nombre)          errors.push("Agente requerido");
  if (!mapped.estado)                 errors.push("Estado requerido");
  if (!mapped.tipo_servicio)          errors.push("Tipo de servicio requerido");
  if (!mapped.descripcion_inicial)    errors.push("Descripción requerida");
  if (!mapped.fecha_caso)             errors.push("Fecha requerida");

  // Fecha válida
  if (mapped.fecha_caso) {
    const d = new Date(mapped.fecha_caso);
    if (isNaN(d.getTime())) errors.push("Fecha inválida (use YYYY-MM-DD o DD/MM/YYYY)");
  }

  // Valor numérico opcional
  if (mapped.valor_pagar && isNaN(Number(mapped.valor_pagar.replace(/[^0-9.-]/g, "")))) {
    errors.push("Valor debe ser numérico");
  }

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
        agente_nombre:          r.agente_nombre,
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
    mutationFn: async () => {
      // Llama a la función SQL que procesa staging → casos
      const { error } = await supabase.rpc("process_staging_casos" as never);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["casos"] });
      qc.invalidateQueries({ queryKey: ["admin-cases"] });
    },
  });
}
