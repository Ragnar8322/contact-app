import { render, screen } from "@testing-library/react";
import { MemoryRouter, Routes, Route, Navigate } from "react-router-dom";
import { vi, describe, it, expect, beforeEach } from "vitest";

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: vi.fn(),
  AuthProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

import { useAuth } from "@/contexts/AuthContext";

const mockUseAuth = useAuth as ReturnType<typeof vi.fn>;

type RoleName = "admin" | "supervisor" | "agent" | "gerente";

// Replica la lógica de RoleRoute de App.tsx
function RoleRouteLogic({ children, roles }: { children: React.ReactNode; roles: RoleName[] }) {
  const { hasRole, loading, profileLoading } = mockUseAuth();
  if (loading || profileLoading) return <div>Cargando</div>;
  if (!hasRole(roles)) return <Navigate to="/no-autorizado" replace />;
  return <>{children}</>;
}

function renderRoleRoute(allowedRoles: RoleName[], hasRoleFn: (r: RoleName[]) => boolean, path = "/analitica") {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/analitica" element={
          <RoleRouteLogic roles={allowedRoles}>
            <div>Analitica page</div>
          </RoleRouteLogic>
        } />
        <Route path="/casos" element={
          <RoleRouteLogic roles={allowedRoles}>
            <div>Casos page</div>
          </RoleRouteLogic>
        } />
        <Route path="/no-autorizado" element={<div>No autorizado</div>} />
      </Routes>
    </MemoryRouter>
  );
}

describe("RoleRoute — control de acceso por rol", () => {
  beforeEach(() => vi.clearAllMocks());

  it("permite acceso a admin en /analitica", () => {
    mockUseAuth.mockReturnValue({
      loading: false, profileLoading: false,
      hasRole: (roles: RoleName[]) => roles.includes("admin"),
    });
    renderRoleRoute(["admin", "supervisor"], () => true, "/analitica");
    expect(screen.getByText("Analitica page")).toBeInTheDocument();
  });

  it("bloquea acceso a agent en /analitica", () => {
    mockUseAuth.mockReturnValue({
      loading: false, profileLoading: false,
      hasRole: (roles: RoleName[]) => roles.includes("agent"),
    });
    renderRoleRoute(["admin", "supervisor"], () => false, "/analitica");
    expect(screen.getByText("No autorizado")).toBeInTheDocument();
  });

  it("permite acceso a supervisor en /analitica", () => {
    mockUseAuth.mockReturnValue({
      loading: false, profileLoading: false,
      hasRole: (roles: RoleName[]) => roles.includes("supervisor"),
    });
    renderRoleRoute(["admin", "supervisor"], () => true, "/analitica");
    expect(screen.getByText("Analitica page")).toBeInTheDocument();
  });

  it("permite acceso a agent en /casos", () => {
    mockUseAuth.mockReturnValue({
      loading: false, profileLoading: false,
      hasRole: (roles: RoleName[]) => roles.includes("agent"),
    });
    renderRoleRoute(["admin", "supervisor", "agent"], () => true, "/casos");
    expect(screen.getByText("Casos page")).toBeInTheDocument();
  });
});
