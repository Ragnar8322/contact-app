import { describe, it, expect, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { FakeSupabase } from "../helpers/fakeSupabase";

const h = vi.hoisted(() => ({ db: null as unknown as import("../helpers/fakeSupabase").FakeSupabase }));
vi.mock("@/integrations/supabase/client", () => ({
  get supabase() { return h.db; },
}));

import { useAnalyticsData, type AnalyticsQueryFilters } from "@/hooks/useAnalyticsData";
import { computeAnalytics, type CasoAnalitica } from "@/lib/analytics";

const caso = (over: Partial<CasoAnalitica> & { estado?: string }): CasoAnalitica => ({
  id: 1, agente_id: "a1", cliente_id: 1, valor_pagar: null, fecha_caso: "2026-01-10T00:00:00", created_at: "2026-01-01T00:00:00Z",
  cat_estados: over.estado ? { nombre: over.estado } : null, cat_agentes: null, campanas: { nombre: "Renovación Web" },
  ...over,
});

describe("computeAnalytics", () => {
  const base = {
    clientes: [
      { id: 1, tipo_cliente: "Empresa", identificacion: "900", nombre_contacto: "Ana", razon_social: "ACME SAS" },
      { id: 2, tipo_cliente: "Persona", identificacion: "100", nombre_contacto: "Luis", razon_social: null },
    ],
    nombresAgentes: new Map([["a1", "Ana Agente"]]),
    dateFrom: new Date(2026, 0, 1),
    dateTo: new Date(2026, 0, 31),
    hoy: new Date(2026, 1, 15),
  };

  const data = computeAnalytics({
    ...base,
    casos: [
      caso({ id: 1, estado: "Renovado", valor_pagar: 300000, fecha_caso: "2026-01-05T00:00:00" }),
      caso({ id: 2, estado: "Renovado", valor_pagar: 100000, cliente_id: 2, agente_id: "a2", cat_agentes: { nombre: "Catálogo Dos" } }),
      caso({ id: 3, estado: "Pendiente de Pago", valor_pagar: 200000, fecha_caso: "2026-01-12T00:00:00" }),
      caso({ id: 4, estado: "En gestión", agente_id: "a3", campanas: null }),
    ],
    gestiones: [
      { agente_id: "a1", agente_nombre: null, cambiado_en: "2026-01-05T12:00:00Z" },
      { agente_id: "a1", agente_nombre: null, cambiado_en: "2026-01-05T13:00:00Z" },
      { agente_id: "a9", agente_nombre: "Externo", cambiado_en: "2026-01-06T12:00:00Z" },
      { agente_id: "a1", agente_nombre: null, cambiado_en: "2026-03-01T15:00:00Z" }, // fuera del período
    ],
  });

  it("calcula los KPIs operativos y financieros", () => {
    expect(data.totalCasos).toBe(4);
    expect(data.casosRenovados).toBe(2);
    expect(data.tasaRenovacion).toBe(50);
    expect(data.totalFacturado).toBe(400000);
    expect(data.pendienteCobro).toBe(200000);
    expect(data.valorPromedio).toBe(200000);
    expect(data.porcentajeRecaudo).toBeCloseTo(66.667, 2);
  });

  it("resuelve el nombre del agente: perfil, luego catálogo, luego el texto del historial", () => {
    const nombres = data.rendimientoAgentes.map((a) => a.agente).sort();
    expect(nombres).toEqual(["Ana Agente", "Catálogo Dos", "Desconocido", "Externo"]);
    const ana = data.rendimientoAgentes.find((a) => a.agente === "Ana Agente")!;
    expect(ana).toMatchObject({ casosAsignados: 2, renovados: 1, gestiones: 3, valorFacturado: 300000, valorPendiente: 200000 });
    expect(ana.porcentajeRecaudo).toBe(60);
  });

  it("las gestiones fuera del período no entran en la serie diaria", () => {
    expect(data.gestionesPorDia).toHaveLength(31);
    expect(data.gestionesPorDia.reduce((s, d) => s + d.count, 0)).toBe(3);
    expect(data.gestionesPorDia.find((d) => d.fecha === "2026-01-05")).toMatchObject({ count: 2, renovadosDelDia: 1, valorFacturadoDia: 300000 });
  });

  it("detalla renovados y pendientes con el nombre correcto del cliente", () => {
    expect(data.tramitesRenovados.map((t) => t.nombreRazonSocial)).toEqual(["ACME SAS", "Luis"]);
    expect(data.pendientesPago).toEqual([
      expect.objectContaining({ numeroMatricula: "900", valor: 200000, diasEnPendiente: 34 }),
    ]);
  });

  it("agrupa por campaña y por tipo de cliente", () => {
    expect(data.resumenCampanas.map((c) => [c.campana, c.casos, c.facturado])).toEqual([
      ["Renovación Web", 3, 400000],
      ["Sin campaña", 1, 0],
    ]);
    expect(data.distribucionClientes).toEqual([
      { tipo: "Empresa", count: 3, percentage: 75, valorFacturado: 300000 },
      { tipo: "Persona", count: 1, percentage: 25, valorFacturado: 100000 },
    ]);
  });

  it("sin casos no divide por cero", () => {
    const vacio = computeAnalytics({ ...base, casos: [], gestiones: [] });
    expect(vacio).toMatchObject({ totalCasos: 0, tasaRenovacion: 0, valorPromedio: 0, porcentajeRecaudo: 0 });
  });
});

describe("useAnalyticsData", () => {
  const casos = Array.from({ length: 2300 }, (_, i) => ({
    ...caso({ id: i + 1, estado: i % 3 === 0 ? "Renovado" : "En gestión", valor_pagar: 1000, agente_id: i % 2 ? "a1" : "a2" }),
    campana_id: i % 2 ? "c1" : "c2",
    estado_id: i % 3 === 0 ? 16 : 8,
  }));
  const tablas = {
    casos,
    caso_historial: casos.map((c) => ({ id: c.id, caso_id: c.id, agente_id: c.agente_id, agente_nombre: null, cambiado_en: "2026-01-10T12:00:00Z" })),
    clientes: [{ id: 1, tipo_cliente: "Empresa", identificacion: "900", nombre_contacto: "Ana", razon_social: null }],
    profiles: [{ user_id: "a1", nombre: "Agente Uno" }, { user_id: "a2", nombre: "Agente Dos" }],
  };

  async function correr(filtros: AnalyticsQueryFilters) {
    h.db = new FakeSupabase({ tablas });
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
    const { result } = renderHook(() => useAnalyticsData(filtros), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    return result.current.data!;
  }

  it("trae todos los casos aunque pasen de 1.000 y pide el historial en lotes", async () => {
    const data = await correr({ dateFrom: new Date(2026, 0, 1), dateTo: new Date(2026, 0, 31) });
    expect(data.totalCasos).toBe(2300);
    expect(data.gestionesRegistradas).toBe(2300);
    expect(h.db.lecturas("casos")).toHaveLength(3);
    expect(h.db.lecturas("caso_historial").length).toBeGreaterThanOrEqual(5);
    expect(h.db.lecturas("caso_historial").every((l) => l.filtros.some((f) => /caso_id=in\.\((\d+)\)/.test(f) && Number(f.match(/\((\d+)\)/)![1]) <= 500))).toBe(true);
  });

  it("aplica los filtros de campaña, agente y estado en la consulta", async () => {
    const data = await correr({ dateFrom: new Date(2026, 0, 1), dateTo: new Date(2026, 0, 31), campanaId: "c1", agenteId: "a1", estadoId: 16 });
    const filtrosCasos = h.db.lecturas("casos")[0].filtros;
    expect(filtrosCasos).toEqual(expect.arrayContaining(["campana_id=eq.c1", "agente_id=eq.a1", "estado_id=eq.16"]));
    expect(h.db.lecturas("caso_historial")[0].filtros).toContain("agente_id=eq.a1");
    expect(data.rendimientoAgentes.map((a) => a.agente)).toEqual(["Agente Uno"]);
  });

  it("propaga el error de Supabase", async () => {
    h.db = new FakeSupabase({ tablas, errores: { casos: { message: "permiso denegado" } } });
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
    const { result } = renderHook(() => useAnalyticsData({ dateFrom: new Date(2026, 0, 1), dateTo: new Date(2026, 0, 31) }), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toMatchObject({ message: "permiso denegado" });
  });
});
