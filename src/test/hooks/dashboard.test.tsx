import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { buildFinancialChart } from "@/lib/financial";

const rpc = vi.fn();
const calls: { method: string; args: unknown[] }[] = [];
// Cadena de consulta de Supabase que registra cada llamada y resuelve con datos vacíos
function chain(): unknown {
  const handler: ProxyHandler<object> = {
    get(_t, prop: string) {
      if (prop === "then") return (resolve: (v: unknown) => void) => resolve({ data: [{ id: 1 }], error: null });
      return (...args: unknown[]) => { calls.push({ method: prop, args }); return proxy; };
    },
  };
  const proxy = new Proxy({}, handler);
  return proxy;
}
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    rpc: (...a: unknown[]) => rpc(...a),
    from: (table: string) => { calls.push({ method: "from", args: [table] }); return chain(); },
  },
}));

import { useDashboardStats, useRecentCases } from "@/hooks/useDashboardStats";

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

describe("gráfica financiera", () => {
  it("rellena todos los tramos del mes y suma los totales", () => {
    const chart = buildFinancialChart(
      [{ tramo: 3, renovado: 100, pendiente: 50 }, { tramo: 15, renovado: 200, pendiente: null }],
      "mes", 31,
    );
    expect(chart.chartData).toHaveLength(31);
    expect(chart.chartData[2]).toEqual({ name: "3", renovado: 100, pendiente: 50 });
    expect(chart.chartData[0]).toEqual({ name: "1", renovado: 0, pendiente: 0 });
    expect(chart.renovado).toBe(300);
    expect(chart.pendiente).toBe(50);
  });

  it("usa etiquetas de semana (0 = lunes) y de año (0 = enero)", () => {
    expect(buildFinancialChart([{ tramo: 6, renovado: 1, pendiente: 0 }], "semana", 0).chartData.at(-1)).toEqual({ name: "dom", renovado: 1, pendiente: 0 });
    expect(buildFinancialChart([], "año", 0).chartData.map((d) => d.name)[0]).toBe("ene");
    expect(buildFinancialChart([], "dia", 0).chartData).toHaveLength(24);
  });

  it("acepta los numéricos que Postgres devuelve como texto", () => {
    const chart = buildFinancialChart([{ tramo: 1, renovado: "1500000" as unknown as number, pendiente: null }], "año", 0);
    expect(chart.renovado).toBe(1500000);
  });
});

describe("indicadores del Dashboard", () => {
  beforeEach(() => { rpc.mockReset(); calls.length = 0; });

  it("pide los totales a dashboard_stats y conserva el orden de las campañas", async () => {
    rpc.mockResolvedValue({
      data: [{ campana_id: "c2", abiertos: 5, cerrados_hoy: 1, sin_asignar: 0, en_riesgo: 2, vencidos: 3 },
             { campana_id: "c1", abiertos: 1121, cerrados_hoy: 0, sin_asignar: 0, en_riesgo: 0, vencidos: 1121 }],
      error: null,
    });
    const { result } = renderHook(() => useDashboardStats(["c1", "c2", "c3"], { c1: "Renovación Web", c2: "Asesoría" }), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(rpc).toHaveBeenCalledWith("dashboard_stats", expect.objectContaining({ p_campana_ids: ["c1", "c2", "c3"] }));
    expect(result.current.data!.byCampaign.map((c) => [c.campanaNombre, c.openCount])).toEqual([
      ["Renovación Web", 1121], ["Asesoría", 5], ["c3", 0],
    ]);
    expect(result.current.data!.totalVencidos).toBe(1124);
  });

  it("los casos recientes se piden con límite y el filtro de vencidos va en la consulta", async () => {
    const before = Date.now();
    const { result } = renderHook(() => useRecentCases("c1", "vencidos", 72), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(calls.find((c) => c.method === "limit")?.args).toEqual([10]);
    expect(calls.find((c) => c.method === "eq" && c.args[0] === "cat_estados.es_final")?.args).toEqual(["cat_estados.es_final", false]);
    const limite = new Date(calls.find((c) => c.method === "lte")!.args[1] as string).getTime();
    expect(before - limite).toBeGreaterThanOrEqual(72 * 3600_000 - 1000);
  });
});

describe("guardia de escala", () => {
  const sources = import.meta.glob(["/src/pages/Dashboard.tsx", "/src/hooks/useDashboardStats.ts"], { query: "?raw", import: "default", eager: true }) as Record<string, string>;

  it("el Dashboard no descarga la tabla de casos sin límite (la API corta en 1.000 filas)", () => {
    expect(Object.keys(sources)).toHaveLength(2);
    for (const [path, code] of Object.entries(sources)) {
      const consultas = [...code.matchAll(/\.from\("casos"\)[\s\S]*?;/g)].map((m) => m[0]);
      for (const q of consultas) expect(q, `${path} consulta casos sin .limit()`).toMatch(/\.limit\(/);
    }
  });
});
