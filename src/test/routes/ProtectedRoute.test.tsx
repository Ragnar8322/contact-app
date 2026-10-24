import { render, screen } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { vi, describe, it, expect, beforeEach } from "vitest";


vi.mock("@/contexts/AuthContext", () => ({
  useAuth: vi.fn(),
  AuthProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
vi.mock("@/contexts/CampanaContext", () => ({
  useCampana: vi.fn(),
  CampanaProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock("@/components/AppLayout", () => ({ default: ({ children }: { children: React.ReactNode }) => <>{children}</> }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));

import { useAuth } from "@/contexts/AuthContext";
import { useCampana } from "@/contexts/CampanaContext";
import { ProtectedRoute } from "@/components/routes/RouteGuards";

const mockUseAuth = useAuth as ReturnType<typeof vi.fn>;
const mockUseCampana = useCampana as ReturnType<typeof vi.fn>;

function renderWithRouter(initialEntry = "/dashboard") {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route path="/dashboard" element={
          <ProtectedRoute>
            <div>Dashboard</div>
          </ProtectedRoute>
        } />
        <Route path="/login" element={<div>Login page</div>} />
        <Route path="/cambiar-contrasena" element={<div>Cambiar contrasena</div>} />
        <Route path="/seleccionar-campana" element={<div>Seleccionar campana</div>} />
      </Routes>
    </MemoryRouter>
  );
}

describe("ProtectedRoute — lógica de redirección", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("redirige a /login si no hay sesión", () => {
    mockUseAuth.mockReturnValue({ session: null, loading: false, mustChangePassword: false });
    mockUseCampana.mockReturnValue({ loading: false, needsSelection: false, noCampaigns: false });
    renderWithRouter("/dashboard");
    expect(screen.getByText("Login page")).toBeInTheDocument();
  });

  it("redirige a /cambiar-contrasena si must_change_password es true", () => {
    mockUseAuth.mockReturnValue({ session: { user: { id: "u1" } }, loading: false, mustChangePassword: true });
    mockUseCampana.mockReturnValue({ loading: false, needsSelection: false, noCampaigns: false });
    renderWithRouter("/dashboard");
    expect(screen.getByText("Cambiar contrasena")).toBeInTheDocument();
  });

  it("redirige a /seleccionar-campana si needsSelection es true", () => {
    mockUseAuth.mockReturnValue({ session: { user: { id: "u1" } }, loading: false, mustChangePassword: false });
    mockUseCampana.mockReturnValue({ loading: false, needsSelection: true, noCampaigns: false });
    renderWithRouter("/dashboard");
    expect(screen.getByText("Seleccionar campana")).toBeInTheDocument();
  });

  it("muestra el contenido si hay sesión y campaña activa", () => {
    mockUseAuth.mockReturnValue({ session: { user: { id: "u1" } }, loading: false, mustChangePassword: false });
    mockUseCampana.mockReturnValue({ loading: false, needsSelection: false, noCampaigns: false });
    renderWithRouter("/dashboard");
    expect(screen.getByText("Dashboard")).toBeInTheDocument();
  });
});
