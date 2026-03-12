import { render, screen } from "@testing-library/react";
import { MemoryRouter, Routes, Route, Navigate } from "react-router-dom";
import { vi, describe, it, expect, beforeEach } from "vitest";

// ProtectedRoute y RoleRoute viven dentro de App.tsx (no son archivos independientes).
// Testeamos la lógica de redirección directamente con componentes inline.

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: vi.fn(),
  AuthProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
vi.mock("@/contexts/CampanaContext", () => ({
  useCampana: vi.fn(),
  CampanaProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

import { useAuth } from "@/contexts/AuthContext";
import { useCampana } from "@/contexts/CampanaContext";

const mockUseAuth = useAuth as ReturnType<typeof vi.fn>;
const mockUseCampana = useCampana as ReturnType<typeof vi.fn>;

// Replica la lógica de ProtectedRoute de App.tsx para testearla
function ProtectedRouteLogic({ children }: { children: React.ReactNode }) {
  const { session, loading, mustChangePassword } = mockUseAuth();
  const { loading: campLoading, needsSelection, noCampaigns } = mockUseCampana();
  if (loading || campLoading) return <div>Cargando</div>;
  if (!session) return <Navigate to="/login" replace />;
  if (mustChangePassword) return <Navigate to="/cambiar-contrasena" replace />;
  if (noCampaigns || needsSelection) return <Navigate to="/seleccionar-campana" replace />;
  return <>{children}</>;
}

function renderWithRouter(initialEntry = "/dashboard") {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route path="/dashboard" element={
          <ProtectedRouteLogic>
            <div>Dashboard</div>
          </ProtectedRouteLogic>
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
