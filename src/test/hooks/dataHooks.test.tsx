// Hooks de datos contra un Supabase simulado: qué consultan, qué escriben y cómo invalidan la caché.
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { FakeSupabase } from "../helpers/fakeSupabase";

const h = vi.hoisted(() => ({
  db: null as unknown as import("../helpers/fakeSupabase").FakeSupabase,
  auth: { user: { id: "u-agente" }, roles: ["agent"] as string[] },
}));
vi.mock("@/integrations/supabase/client", () => ({ get supabase() { return h.db; } }));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => h.auth }));
vi.mock("@/contexts/CampanaContext", () => ({ useCampana: () => ({ campanaActiva: { id: "c1", nombre: "Renovación Web" } }) }));

import { useCases, useUpdateCase } from "@/hooks/useCases";
import { useCreateNovedad, useReviewNovedad, useGenerateSchedule, useScheduleShifts } from "@/hooks/useSchedules";
import { useInsertStaging, useConfirmImport, validateRow } from "@/hooks/useImportCasos";

function setup() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const invalidadas: unknown[] = [];
  const original = qc.invalidateQueries.bind(qc);
  qc.invalidateQueries = ((f?: Parameters<typeof original>[0]) => { invalidadas.push(f?.queryKey); return original(f); }) as typeof qc.invalidateQueries;
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
  return { wrapper, invalidadas };
}

const casos = Array.from({ length: 30 }, (_, i) => ({
  id: i + 1,
  agente_id: i < 12 ? "u-agente" : "otro",
  estado_id: i % 2 ? 8 : 16,
  campana_id: "c1",
  fecha_caso: `2026-01-${String((i % 28) + 1).padStart(2, "0")}`,
  clientes: { nombre_contacto: i === 3 ? "María (Pérez)" : `Cliente ${i}`, identificacion: `900${i}` },
}));

beforeEach(() => {
  h.auth = { user: { id: "u-agente" }, roles: ["agent"] };
  h.db = new FakeSupabase({ tablas: { casos } });
});

describe("useCases", () => {
  it("un agente solo consulta sus casos y la paginación usa el total real", async () => {
    const { wrapper } = setup();
    const { result } = renderHook(() => useCases({ campanaId: "c1" }, { page: 2, pageSize: 5 }), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(h.db.lecturas("casos")[0].filtros).toContain("agente_id=eq.u-agente");
    expect(result.current.data).toMatchObject({ totalCount: 12, totalPages: 3, hasPrevPage: true, hasNextPage: true });
    expect(result.current.data!.data).toHaveLength(5);
  });

  it("supervisor y admin no tienen el filtro de agente", async () => {
    h.auth = { user: { id: "u-sup" }, roles: ["agent", "supervisor"] };
    const { wrapper } = setup();
    const { result } = renderHook(() => useCases({ campanaId: "c1", estadoIds: [8] }), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    const filtros = h.db.lecturas("casos")[0].filtros;
    expect(filtros.some((f) => f.startsWith("agente_id"))).toBe(false);
    expect(filtros).toContain("estado_id=in.(1)");
    expect(result.current.data!.totalCount).toBe(15);
  });

  it("la búsqueda quita los caracteres que rompen el filtro de PostgREST", async () => {
    h.auth = { user: { id: "u-sup" }, roles: ["supervisor"] };
    const { wrapper } = setup();
    const { result } = renderHook(() => useCases({ searchText: " (pérez)%" }), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    const or = h.db.lecturas("casos")[0].filtros.find((f) => f.startsWith("or="))!;
    expect(or).toBe("or=(nombre_contacto.ilike.%pérez%,identificacion.ilike.%pérez%)@clientes");
    expect(result.current.data!.data.map((c) => c.id)).toEqual([4]);
  });

  it("actualizar un caso invalida la lista y el detalle", async () => {
    const { wrapper, invalidadas } = setup();
    const { result } = renderHook(() => useUpdateCase(), { wrapper });
    await act(() => result.current.mutateAsync({ id: 3, estado_id: 16, updated_by: "u-agente" }));
    expect(h.db.tablas.casos.find((c) => c.id === 3)).toMatchObject({ estado_id: 16, updated_by: "u-agente" });
    expect(invalidadas).toEqual(expect.arrayContaining([["casos"], ["caso"]]));
  });
});

describe("mutaciones de horarios", () => {
  it("una novedad nueva queda pendiente y a nombre del usuario si no se indica agente", async () => {
    h.db = new FakeSupabase({ tablas: { schedule_novedades: [] } });
    const { wrapper, invalidadas } = setup();
    const { result } = renderHook(() => useCreateNovedad(), { wrapper });
    await act(() => result.current.mutateAsync({
      schedule_id: "s1", agente_id: "", fecha: "2026-01-12", tipo_novedad: "permiso_remunerado", es_dia_completo: true,
    }));
    expect(h.db.tablas.schedule_novedades[0]).toMatchObject({ agente_id: "u-agente", estado: "pendiente", schedule_id: "s1" });
    expect(invalidadas).toEqual(expect.arrayContaining([["schedule_novedades", "s1"], ["all_novedades"]]));
  });

  it("aprobar una novedad registra quién la revisó", async () => {
    h.auth = { user: { id: "u-sup" }, roles: ["supervisor"] };
    h.db = new FakeSupabase({ tablas: { schedule_novedades: [{ id: "n1", estado: "pendiente" }] } });
    const { wrapper } = setup();
    const { result } = renderHook(() => useReviewNovedad(), { wrapper });
    await act(() => result.current.mutateAsync({ novedadId: "n1", estado: "aprobado" }));
    expect(h.db.tablas.schedule_novedades[0]).toMatchObject({ estado: "aprobado", revisado_por: "u-sup" });
  });

  it("generar horario envía los parámetros con los nombres de la función SQL", async () => {
    h.db = new FakeSupabase({ rpc: { generate_schedule: () => 42 } });
    const { wrapper, invalidadas } = setup();
    const { result } = renderHook(() => useGenerateSchedule(), { wrapper });
    let creados = 0;
    await act(async () => {
      creados = await result.current.mutateAsync({
        schedule_id: "s1", hora_inicio: "07:00", hora_fin: "16:00", dia_libre_base: 6,
        duracion_almuerzo: 60, skip_existing: true, tipo_actividad: "GAP",
      });
    });
    expect(creados).toBe(42);
    expect(h.db.rpcLlamadas[0]).toEqual({
      fn: "generate_schedule",
      args: {
        _schedule_id: "s1", _hora_inicio: "07:00", _hora_fin: "16:00", _dia_libre_base: 6,
        _duracion_almuerzo: 60, _skip_existing: true, _tipo_actividad: "GAP",
      },
    });
    expect(invalidadas).toContainEqual(["schedule_shifts", "s1"]);
  });

  it("un agente no consulta los turnos de toda la semana", async () => {
    h.db = new FakeSupabase({ tablas: { schedule_shifts: [] } });
    const { wrapper } = setup();
    const { result } = renderHook(() => useScheduleShifts("s1"), { wrapper });
    await new Promise((r) => setTimeout(r, 20));
    expect(result.current.fetchStatus).toBe("idle");
    expect(h.db.llamadas).toHaveLength(0);
  });
});

describe("importación de casos", () => {
  it("solo se cargan a staging las filas válidas, con su número de fila de Excel", async () => {
    h.db = new FakeSupabase({ tablas: { staging_casos: [] } });
    const filas = [
      validateRow({ cliente_identificacion: "900", agente_correo: "a@x.co", estado: "Registrado", tipo_servicio: "Renovación Web", descripcion_inicial: "x", fecha_caso: "15/01/2026", valor_pagar: "$150.000" }, 2),
      validateRow({ cliente_identificacion: null, agente_correo: "a@x.co" }, 3),
      validateRow({ cliente_identificacion: "901", agente_nombre: "Ana", estado: "Registrado", tipo_servicio: "Renovación Web", descripcion_inicial: "y", fecha_caso: "2026-01-16" }, 7),
    ];
    const { wrapper } = setup();
    const { result } = renderHook(() => useInsertStaging(), { wrapper });
    await act(() => result.current.mutateAsync(filas));
    expect(h.db.tablas.staging_casos.map((r) => [r.cliente_identificacion, r.fila_excel])).toEqual([["900", 2], ["901", 7]]);
  });

  it("confirmar procesa en la campaña activa e invalida los listados", async () => {
    h.db = new FakeSupabase({ rpc: { process_staging_casos: () => ({ inserted: 2, skipped: 1, rechazados: [] }) } });
    const { wrapper, invalidadas } = setup();
    const { result } = renderHook(() => useConfirmImport(), { wrapper });
    let r: Awaited<ReturnType<typeof result.current.mutateAsync>> | undefined;
    await act(async () => { r = await result.current.mutateAsync("c1"); });
    expect(r).toMatchObject({ inserted: 2, skipped: 1 });
    expect(h.db.rpcLlamadas[0]).toEqual({ fn: "process_staging_casos", args: { p_campana_id: "c1" } });
    expect(invalidadas).toEqual(expect.arrayContaining([["casos"], ["admin-cases"]]));
  });
});
