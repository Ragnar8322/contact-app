import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { rpc: vi.fn().mockResolvedValue({ data: { todos: 1, activos: 1, cerrados: 0, transferidos: 0 }, error: null }) },
}));
vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({
    user: { id: "u1" }, profile: { nombre: "Ana" }, isAdmin: false, isGerente: false, isSupervisor: false,
    hasRole: (r: string[]) => r.includes("agent"),
  }),
}));
vi.mock("@/contexts/CampanaContext", () => ({
  useCampana: () => ({ campanaActiva: { id: "camp1", nombre: "Renovación Web" } }),
}));
vi.mock("@/hooks/useCampanas", () => ({ useCampanasList: () => ({ data: [] }) }));
vi.mock("@/hooks/useClientByIdentificacion", () => ({ useClientByIdentificacion: () => ({ data: null }) }));

const linkedCase = {
  id: 7, estado_id: 1, campana_id: "camp1", descripcion_inicial: "Renovar matrícula",
  fecha_caso: "2026-03-16T15:00:00Z", valor_pagar: null,
  clientes: { nombre_contacto: "COMERCIAL CARIBE SAS", identificacion: "900123" },
  cat_estados: { nombre: "En gestión", es_final: false }, cat_tipo_servicio: { nombre: "Asesoría" }, cat_agentes: { nombre: "Ana" },
};
const useCases = vi.fn();
vi.mock("@/hooks/useCases", () => ({
  useCases: (...args: unknown[]) => useCases(...args),
  useCaseById: (id: number | null) => ({ data: id === 7 ? linkedCase : undefined }),
  useEstados: () => ({ data: [{ id: 1, nombre: "En gestión", es_final: false }] }),
  useTiposServicio: () => ({ data: [] }),
  useAgentes: () => ({ data: [] }),
  useUpdateCase: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useInsertHistorial: () => ({ mutateAsync: vi.fn() }),
  useCaseHistory: () => ({ data: [] }),
}));

import Cases from "@/pages/Cases";

function LocationProbe() {
  const loc = useLocation();
  return <div data-testid="location">{loc.pathname + loc.search}</div>;
}

function renderAt(url: string) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[url]}>
        <Routes>
          <Route path="/casos" element={<><Cases /><LocationProbe /></>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("Casos — enlaces entrantes", () => {
  beforeEach(() => {
    useCases.mockReset();
    useCases.mockReturnValue({ data: { data: [], totalCount: 0, totalPages: 1 }, isLoading: false, isFetching: false });
  });

  it("/casos?caso=7 abre el detalle aunque el caso no esté en la página actual", async () => {
    renderAt("/casos?caso=7");
    expect(await screen.findByRole("dialog", { name: "Caso #7" })).toBeInTheDocument();
    expect(screen.getByText("COMERCIAL CARIBE SAS")).toBeInTheDocument();
  });

  it("al cerrar el detalle, la URL deja de apuntar al caso", async () => {
    renderAt("/casos?caso=7");
    await screen.findByRole("dialog", { name: "Caso #7" });
    await userEvent.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByTestId("location")).toHaveTextContent(/^\/casos$/);
  });

  it("/casos?buscar=900123 llega con la búsqueda aplicada y el filtro en Todos", () => {
    renderAt("/casos?buscar=900123");
    expect(screen.getByPlaceholderText(/Buscar por cliente/)).toHaveValue("900123");
    expect(screen.getByRole("button", { name: /^Todos(\s\(\d+\))?$/ })).toHaveAttribute("aria-pressed", "true");
    const lastFilters = useCases.mock.calls.at(-1)![0];
    expect(lastFilters.searchText).toBe("900123");
  });
});
