import { render, screen } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { vi, describe, it, expect, beforeEach } from "vitest";

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: vi.fn(),
}));

import { useAuth } from "@/contexts/AuthContext";
import RoleRoute from "@/components/RoleRoute";

const mockUseAuth = useAuth as ReturnType<typeof vi.fn>;

function renderRoleRoute(allowedRoles: string[], userRole: string, path = "/analitica") {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route element={<RoleRoute allowedRoles={allowedRoles} />}>
          <Route path="/analitica" element={<div>Analitica page</div>} />
          <Route path="/casos" element={<div>Casos page</div>} />
        </Route>
        <Route path="/no-autorizado" element={<div>No autorizado</div>} />
      </Routes>
    </MemoryRouter>
  );
}

describe("RoleRoute", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("permite acceso a admin en /analitica", () => {
    mockUseAuth.mockReturnValue({
      profile: { user_roles: { name: "admin" } },
    });
    renderRoleRoute(["admin", "supervisor"], "admin", "/analitica");
    expect(screen.getByText("Analitica page")).toBeInTheDocument();
  });

  it("bloquea acceso a agent en /analitica", () => {
    mockUseAuth.mockReturnValue({
      profile: { user_roles: { name: "agent" } },
    });
    renderRoleRoute(["admin", "supervisor"], "agent", "/analitica");
    expect(screen.getByText("No autorizado")).toBeInTheDocument();
  });

  it("permite acceso a agent en /casos", () => {
    mockUseAuth.mockReturnValue({
      profile: { user_roles: { name: "agent" } },
    });
    renderRoleRoute(["admin", "supervisor", "agent"], "agent", "/casos");
    expect(screen.getByText("Casos page")).toBeInTheDocument();
  });

  it("permite acceso a supervisor en /analitica", () => {
    mockUseAuth.mockReturnValue({
      profile: { user_roles: { name: "supervisor" } },
    });
    renderRoleRoute(["admin", "supervisor"], "supervisor", "/analitica");
    expect(screen.getByText("Analitica page")).toBeInTheDocument();
  });
});
