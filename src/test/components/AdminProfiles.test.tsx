import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";

type Perfil = {
  user_id: string; nombre: string; telefono: string | null; role_id: number; activo: boolean;
  must_change_password: boolean; role_assignments: { role_id: number; role_name: string }[]; user_roles: { name: string };
};
const perfil = (n: number, activo = true): Perfil => ({
  user_id: `u${String(n).padStart(8, "0")}-0000`, nombre: `USUARIO ${String(n).padStart(2, "0")}`, telefono: null, role_id: 2,
  activo, must_change_password: false, role_assignments: [], user_roles: { name: "agent" },
});

// vi.mock se eleva al inicio del archivo: lo que usa debe estar declarado con vi.hoisted
const { estado, setActive, mutation } = vi.hoisted(() => {
  const estado = { perfiles: [] as Perfil[] };
  return {
    estado,
    setActive: vi.fn(async ({ user_id, activo }: { user_id: string; activo: boolean }) => {
      estado.perfiles = estado.perfiles.map((p) => (p.user_id === user_id ? { ...p, activo } : p));
    }),
    mutation: () => ({ mutateAsync: vi.fn(), isPending: false }),
  };
});

vi.mock("@/hooks/useAdmin", () => ({
  // Una lista nueva en cada render, como cuando React Query trae datos frescos
  useAllProfiles: () => ({ data: [...estado.perfiles], isLoading: false, refetch: vi.fn() }),
  useRoles: () => ({ data: [] }),
  useUpdateProfile: mutation,
  useInviteUser: mutation,
  useSaveRoleAssignments: mutation,
  useResetPassword: mutation,
  useSetUserActive: () => ({ mutateAsync: setActive, isPending: false }),
}));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ user: { id: "admin-id" } }) }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import AdminProfiles from "@/components/admin/AdminProfiles";

const nombres = () => screen.queryAllByText(/^USUARIO \d+$/).map((e) => e.textContent);

describe("AdminProfiles — usuarios inhabilitados", () => {
  beforeEach(() => { setActive.mockClear(); });

  it("oculta a los inhabilitados por defecto y muestra cuántos hay en el botón", () => {
    estado.perfiles = [perfil(1), perfil(2, false), perfil(3), perfil(4, false)];
    render(<AdminProfiles />);
    expect(nombres()).toEqual(["USUARIO 01", "USUARIO 03"]);
    expect(screen.getByRole("button", { name: /ver inhabilitados \(2\)/i })).toBeInTheDocument();
    expect(screen.getByText(/de 2 usuarios/)).toBeInTheDocument();
  });

  it("el botón los muestra al final de la lista y se puede volver a ocultar", async () => {
    estado.perfiles = [perfil(1), perfil(2, false), perfil(3)];
    const user = userEvent.setup();
    render(<AdminProfiles />);

    await user.click(screen.getByRole("button", { name: /ver inhabilitados/i }));
    expect(nombres()).toEqual(["USUARIO 01", "USUARIO 03", "USUARIO 02"]);
    expect(screen.getByText(/de 3 usuarios/)).toBeInTheDocument();
    const ocultar = screen.getByRole("button", { name: /ocultar inhabilitados/i });
    expect(ocultar).toHaveAttribute("aria-pressed", "true");

    await user.click(ocultar);
    expect(nombres()).toEqual(["USUARIO 01", "USUARIO 03"]);
  });

  it("al inhabilitar a un usuario su fila desaparece sola y el contador sube", async () => {
    estado.perfiles = [perfil(1), perfil(2), perfil(3)];
    const user = userEvent.setup();
    render(<AdminProfiles />);
    expect(screen.getByRole("button", { name: /ver inhabilitados \(0\)/i })).toBeDisabled();

    await user.click(screen.getByRole("switch", { name: /deshabilitar a usuario 02/i }));
    const dialogo = await screen.findByRole("alertdialog");
    await user.click(within(dialogo).getByRole("button", { name: /^deshabilitar$/i }));

    await vi.waitFor(() => expect(nombres()).toEqual(["USUARIO 01", "USUARIO 03"]));
    expect(setActive).toHaveBeenCalledWith({ user_id: "u00000002-0000", activo: false });
    expect(screen.getByRole("button", { name: /ver inhabilitados \(1\)/i })).toBeEnabled();
  });

  it("al habilitar de nuevo desde la vista de inhabilitados, el usuario sigue en la lista", async () => {
    estado.perfiles = [perfil(1), perfil(2, false)];
    const user = userEvent.setup();
    render(<AdminProfiles />);
    await user.click(screen.getByRole("button", { name: /ver inhabilitados/i }));

    await user.click(screen.getByRole("switch", { name: /habilitar a usuario 02/i }));
    const dialogo = await screen.findByRole("alertdialog");
    await user.click(within(dialogo).getByRole("button", { name: /^habilitar$/i }));

    await vi.waitFor(() => expect(setActive).toHaveBeenCalledWith({ user_id: "u00000002-0000", activo: true }));
    expect(nombres()).toEqual(["USUARIO 01", "USUARIO 02"]);
    // Ya no hay inhabilitados, pero el botón sigue disponible para volver a la vista normal
    expect(screen.getByRole("button", { name: /ocultar inhabilitados/i })).toBeEnabled();
  });

  it("la paginación cuenta solo los usuarios visibles y vuelve a la página 1 al cambiar la vista", async () => {
    estado.perfiles = [...Array.from({ length: 12 }, (_, i) => perfil(i + 1)), perfil(13, false)];
    const user = userEvent.setup();
    render(<AdminProfiles />);
    expect(screen.getByText(/Mostrando 1–10 de 12 usuarios/)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /siguiente/i }));
    expect(screen.getByText(/Mostrando 11–12 de 12 usuarios/)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /ver inhabilitados/i }));
    expect(screen.getByText(/Mostrando 1–10 de 13 usuarios/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /siguiente/i }));
    expect(nombres()).toEqual(["USUARIO 11", "USUARIO 12", "USUARIO 13"]);
  });

  it("si no queda ningún usuario activo muestra un mensaje en vez de una tabla vacía", () => {
    estado.perfiles = [perfil(1, false)];
    render(<AdminProfiles />);
    expect(screen.getByText("No hay usuarios activos")).toBeInTheDocument();
  });
});
