import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { cellToText, isValidFecha, parseMontoCOP, validateRow } from "@/hooks/useImportCasos";
import { fetchAllPages } from "@/lib/fetchAllPages";

const rpc = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc: (...a: unknown[]) => rpc(...a) } }));
vi.mock("@/hooks/useCampanas", () => ({
  useCampanasList: () => ({ data: [{ id: "c1", nombre: "Renovación Web" }, { id: "c2", nombre: "Asesoría Especializada" }] }),
}));
const toastError = vi.fn();
const toastSuccess = vi.fn();
vi.mock("sonner", () => ({ toast: { error: (...a: unknown[]) => toastError(...a), success: (...a: unknown[]) => toastSuccess(...a) } }));

import CaseTransfer from "@/components/cases/CaseTransfer";

describe("importación: formatos", () => {
  it("las celdas de fecha del Excel se convierten a YYYY-MM-DD local (antes se guardaba la fecha de hoy)", () => {
    expect(cellToText(new Date(2026, 9, 24))).toBe("2026-10-24");
    expect(cellToText("  ")).toBeNull();
    expect(cellToText(150000)).toBe("150000");
  });

  it("acepta fechas DD/MM/YYYY y rechaza fechas imposibles", () => {
    expect(isValidFecha("24/10/2026")).toBe(true);
    expect(isValidFecha("2026-10-24")).toBe(true);
    expect(isValidFecha("31/02/2026")).toBe(false);
    expect(isValidFecha("ayer")).toBe(false);
  });

  it("interpreta montos colombianos igual que parse_monto_cop en la base", () => {
    expect(parseMontoCOP("$150.000")).toBe(150000);
    expect(parseMontoCOP("1.250.000,50")).toBe(1250000.5);
    expect(parseMontoCOP("1250000.5")).toBe(1250000.5);
    expect(parseMontoCOP("150000")).toBe(150000);
    expect(parseMontoCOP("abc")).toBeNull();
  });

  it("el agente puede venir por correo o por nombre; la fila guarda su número", () => {
    const base = { identificacion: "900", estado: "Registrado", tipo_servicio: "Renovación Web", descripcion: "x", fecha: new Date(2026, 0, 15) };
    expect(validateRow({ ...base, agente_correo: "a@b.co" }, 2)._valid).toBe(true);
    expect(validateRow({ ...base, agente_nombre: "Ana" }, 3)._valid).toBe(true);
    const sinAgente = validateRow(base, 4);
    expect(sinAgente._valid).toBe(false);
    expect(sinAgente._errors).toContain("Agente requerido (correo o nombre)");
    expect(sinAgente._rowIndex).toBe(4);
  });
});

describe("fetchAllPages", () => {
  it("pide páginas hasta recibir una incompleta (la API corta en 1.000 filas)", async () => {
    const pedidas: [number, number][] = [];
    const total = 2350;
    const filas = await fetchAllPages<number>(async (from, to) => {
      pedidas.push([from, to]);
      const data = Array.from({ length: Math.max(0, Math.min(to, total - 1) - from + 1) }, (_, i) => from + i);
      return { data, error: null };
    });
    expect(filas).toHaveLength(2350);
    expect(pedidas).toEqual([[0, 999], [1000, 1999], [2000, 2999]]);
  });
});

describe("transferencia de casos", () => {
  beforeEach(() => { rpc.mockReset(); toastError.mockReset(); toastSuccess.mockReset(); });

  function renderTransfer() {
    const qc = new QueryClient();
    const onTransferred = vi.fn();
    render(
      <QueryClientProvider client={qc}>
        <CaseTransfer caso={{ id: 69, campana_id: "c1", cat_estados: { nombre: "En gestión", es_final: false } }} onTransferred={onTransferred} />
      </QueryClientProvider>,
    );
    return { onTransferred };
  }

  async function transferirA(nombre: string) {
    await userEvent.click(screen.getByRole("combobox"));
    await userEvent.click(await screen.findByRole("option", { name: nombre }));
    await userEvent.click(screen.getByRole("button", { name: "Transferir" }));
    await userEvent.click(await screen.findByRole("button", { name: "Confirmar transferencia" }));
  }

  it("usa transfer_case (una transacción) y anuncia a quién quedó asignado", async () => {
    rpc.mockResolvedValue({ data: { nuevo_caso_id: 10627, supervisor_nombre: "Kelvin Trujillo", campana_destino: "Asesoría Especializada" }, error: null });
    const { onTransferred } = renderTransfer();
    await transferirA("Asesoría Especializada");

    await waitFor(() => expect(rpc).toHaveBeenCalledWith("transfer_case", { p_caso_id: 69, p_campana_destino: "c2" }));
    expect(toastSuccess).toHaveBeenCalledWith("Caso transferido a Asesoría Especializada", { description: "Nuevo caso #10627, asignado a Kelvin Trujillo." });
    expect(onTransferred).toHaveBeenCalled();
  });

  it("muestra el motivo del servidor cuando la campaña no tiene supervisor", async () => {
    rpc.mockResolvedValue({ data: null, error: new Error('La campaña "Asesoría Especializada" no tiene supervisor asignado.') });
    const { onTransferred } = renderTransfer();
    await transferirA("Asesoría Especializada");

    await waitFor(() => expect(toastError).toHaveBeenCalledWith("No se pudo transferir", { description: expect.stringContaining("no tiene supervisor") }));
    expect(onTransferred).not.toHaveBeenCalled();
  });
});

describe("guardia de atomicidad", () => {
  const sources = import.meta.glob(
    ["/src/components/cases/CaseTransfer.tsx", "/src/components/cases/ProportionalAssignModal.tsx", "/src/components/cases/UnifiedCaseForm.tsx", "/src/pages/Cases.tsx"],
    { query: "?raw", import: "default", eager: true },
  ) as Record<string, string>;

  it("transferir, asignar y crear casos no escriben tabla por tabla desde el navegador", () => {
    expect(Object.keys(sources)).toHaveLength(4);
    for (const [path, code] of Object.entries(sources)) {
      if (path.endsWith("Cases.tsx")) continue;
      expect(code, path).not.toMatch(/\.from\("(casos|clientes|caso_historial)"\)\s*\.(insert|update|upsert)/);
    }
  });

  it("el destino de una transferencia se lee de la columna, no del texto de la observación", () => {
    for (const [path, code] of Object.entries(sources)) expect(code, path).not.toMatch(/match\(\/Nuevo caso/);
  });
});
