import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface SLAConfig {
  horas_riesgo: number;
  horas_vencido: number;
}

export type EstadoSLA = "ok" | "riesgo" | "vencido";

export interface CasoConSLA {
  id: number;
  estado_sla: EstadoSLA;
  horasTranscurridas: number;
  [key: string]: any;
}

export function useSLAConfig(campanaId?: string | null) {
  return useQuery<SLAConfig>({
    queryKey: ["sla-config", campanaId],
    enabled: !!campanaId,
    refetchInterval: 60000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sla_config")
        .select("horas_riesgo, horas_vencido")
        .eq("campana_id", campanaId!)
        .eq("activo", true)
        .maybeSingle();
      if (error) throw error;
      return data ?? { horas_riesgo: 2, horas_vencido: 6 };
    },
  });
}

/** Fetch ALL SLA configs for multiple campaigns in a single query */
export function useSLAConfigs(campanaIds: string[]) {
  return useQuery<Record<string, SLAConfig>>({
    queryKey: ["sla-configs-bulk", campanaIds],
    enabled: campanaIds.length > 0,
    refetchInterval: 60000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sla_config")
        .select("campana_id, horas_riesgo, horas_vencido")
        .in("campana_id", campanaIds)
        .eq("activo", true);
      if (error) throw error;
      const map: Record<string, SLAConfig> = {};
      (data ?? []).forEach((row: any) => {
        if (row.campana_id) {
          map[row.campana_id] = {
            horas_riesgo: row.horas_riesgo ?? 2,
            horas_vencido: row.horas_vencido ?? 6,
          };
        }
      });
      return map;
    },
  });
}

function calcularEstadoSLA(
  fechaCaso: string,
  config: SLAConfig
): { estado_sla: EstadoSLA; horasTranscurridas: number } {
  const now = Date.now();
  const created = new Date(fechaCaso).getTime();
  const horasTranscurridas = (now - created) / (1000 * 60 * 60);

  let estado_sla: EstadoSLA = "ok";
  if (horasTranscurridas >= config.horas_vencido) {
    estado_sla = "vencido";
  } else if (horasTranscurridas >= config.horas_riesgo) {
    estado_sla = "riesgo";
  }

  return { estado_sla, horasTranscurridas };
}

/** Enrich an array of open cases with SLA status */
export function useSLACasos(casos: any[] | undefined | null, config: SLAConfig | undefined | null): CasoConSLA[] {
  if (!casos || !Array.isArray(casos) || !config) return [];
  return casos.map((c) => {
    const esFinal = c.cat_estados?.es_final;
    if (esFinal) {
      return { ...c, estado_sla: "ok" as EstadoSLA, horasTranscurridas: 0 };
    }
    const { estado_sla, horasTranscurridas } = calcularEstadoSLA(c.fecha_caso, config);
    return { ...c, estado_sla, horasTranscurridas };
  });
}

/** Compute SLA summary counts from enriched cases */
export function useSLACounts(casosConSLA: CasoConSLA[] | undefined | null) {
  if (!casosConSLA || !Array.isArray(casosConSLA)) {
    return { enRiesgo: 0, vencidos: 0, sinAsignar: 0 };
  }
  const open = casosConSLA.filter((c) => !c.cat_estados?.es_final);
  return {
    enRiesgo: open.filter((c) => c.estado_sla === "riesgo").length,
    vencidos: open.filter((c) => c.estado_sla === "vencido").length,
    sinAsignar: open.filter((c) => !c.agente_id).length,
  };
}
