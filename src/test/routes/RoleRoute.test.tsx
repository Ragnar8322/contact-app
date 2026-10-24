import { render, screen } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { vi, describe, it, expect, beforeEach } from "vitest";

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: vi.fn(),
  AuthProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
vi.mock("@/contexts/CampanaContext", () => ({ useCampana: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));

import { useAuth, type RoleName } from "@/contexts/AuthContext";
import { RoleRoute } from "@/components/routes/RouteGuards";

const mockUseAuth = useAuth as ReturnType<typeof vi.fn>;

function comoRol(rol: RoleName, extra: Record<string, unknown> = {}) {
  mockUseAuth.mockReturnValue({
    loading: false, profileLoading: false,
    hasRole: (roles: RoleName[]) => roles.includes(rol),
    ...extra,
  });
}

function renderRoleRoute(allowedRoles: RoleName[], path = "/analitica") {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/analitica" element={<RoleRoute roles={allowedRoles}><div>Analitica page</div></RoleRoute>} />
        <Route path="/casos" element={<RoleRoute roles={allowedRoles}><div>Casos page</div></RoleRoute>} />
        <Route path="/" element={<div>Inicio</div>} />
      </Routes>
    </MemoryRouter>
  );
}

describe("RoleRoute — control de acceso por rol", () => {
  beforeEach(() => vi.clearAllMocks());

  it("permite acceso a admin en /analitica", () => {
    comoRol("admin");
    renderRoleRoute(["admin", "supervisor"]);
    expect(screen.getByText("Analitica page")).toBeInTheDocument();
  });

  it("un agente que entra a /analitica vuelve al inicio", () => {
    comoRol("agent");
    renderRoleRoute(["admin", "supervisor"]);
    expect(screen.getByText("Inicio")).toBeInTheDocument();
    expect(screen.queryByText("Analitica page")).not.toBeInTheDocument();
  });

  it("permite acceso a supervisor en /analitica", () => {
    comoRol("supervisor");
    renderRoleRoute(["admin", "supervisor"]);
    expect(screen.getByText("Analitica page")).toBeInTheDocument();
  });

  it("permite acceso a agent en /casos", () => {
    comoRol("agent");
    renderRoleRoute(["admin", "supervisor", "agent"], "/casos");
    expect(screen.getByText("Casos page")).toBeInTheDocument();
  });

  it("mientras cargan los roles no redirige", () => {
    comoRol("agent", { profileLoading: true });
    renderRoleRoute(["admin"]);
    expect(screen.getByRole("status")).toHaveTextContent("Cargando");
    expect(screen.queryByText("Inicio")).not.toBeInTheDocument();
  });
});
