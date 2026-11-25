import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";

const logActivity = vi.fn().mockResolvedValue(undefined);
vi.mock("@/hooks/useActivityLog", () => ({ logActivity: (...a: unknown[]) => logActivity(...a) }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { ExportExcelDialog } from "@/components/ExportExcelDialog";

const columns = [
  { key: "id", titulo: "ID" },
  { key: "cliente", titulo: "Cliente" },
  { key: "valor", titulo: "Valor a pagar" },
];

function setup(over: Partial<React.ComponentProps<typeof ExportExcelDialog>> = {}) {
  const onExport = vi.fn().mockResolvedValue(42);
  render(<ExportExcelDialog entity="casos" label="casos" columns={columns} totalCount={42} onExport={onExport} {...over} />);
  return { onExport, user: userEvent.setup() };
}

describe("ExportExcelDialog", () => {
  beforeEach(() => { logActivity.mockClear(); try { localStorage.clear(); } catch { /* sin almacenamiento */ } });

  it("abre con todas las columnas marcadas y exporta en el orden de la definición", async () => {
    const { onExport, user } = setup();
    await user.click(screen.getByRole("button", { name: /exportar excel/i }));
    expect(screen.getByText("Columnas (3 de 3)")).toBeInTheDocument();

    await user.click(screen.getByLabelText("Cliente")); // desmarca
    await user.click(screen.getByRole("button", { name: /^exportar$/i }));

    await waitFor(() => expect(onExport).toHaveBeenCalledWith(["id", "valor"]));
    expect(logActivity).toHaveBeenCalledWith("EXPORT", "casos", undefined, expect.objectContaining({ filas: 42, columnas: 2 }));
  });

  it("no permite exportar sin columnas", async () => {
    const { onExport, user } = setup();
    await user.click(screen.getByRole("button", { name: /exportar excel/i }));
    await user.click(screen.getByRole("button", { name: "Ninguna" }));
    expect(screen.getByText("Selecciona al menos una columna")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^exportar$/i })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "Todas" }));
    expect(screen.getByRole("button", { name: /^exportar$/i })).toBeEnabled();
    expect(onExport).not.toHaveBeenCalled();
  });

  it("recuerda las columnas elegidas la próxima vez", async () => {
    const first = setup();
    await first.user.click(screen.getByRole("button", { name: /exportar excel/i }));
    await first.user.click(screen.getByLabelText("ID"));
    await first.user.click(screen.getByRole("button", { name: /^exportar$/i }));
    await waitFor(() => expect(first.onExport).toHaveBeenCalledWith(["cliente", "valor"]));

    const second = setup();
    await second.user.click(screen.getAllByRole("button", { name: /exportar excel/i }).at(-1)!);
    expect(await screen.findByText("Columnas (2 de 3)")).toBeInTheDocument();
  });

  it("bloquea la exportación si hay más registros que el tope", async () => {
    const { user } = setup({ totalCount: 100001 });
    await user.click(screen.getByRole("button", { name: /exportar excel/i }));
    expect(screen.getByText(/más de 100\.000 registros/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^exportar$/i })).toBeDisabled();
  });

  it("si la exportación falla, avisa y deja el diálogo abierto para reintentar", async () => {
    const onExport = vi.fn().mockRejectedValue(new Error("sin conexión"));
    const { user } = setup({ onExport });
    await user.click(screen.getByRole("button", { name: /exportar excel/i }));
    await user.click(screen.getByRole("button", { name: /^exportar$/i }));
    await waitFor(() => expect(onExport).toHaveBeenCalled());
    expect(screen.getByRole("button", { name: /^exportar$/i })).toBeEnabled();
    expect(logActivity).not.toHaveBeenCalled();
  });
});
