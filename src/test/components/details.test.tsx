import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { loginErrorMessage } from "@/lib/authErrors";
import { ConfirmDialog } from "@/components/ConfirmDialog";

const signInWithPassword = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { auth: { signInWithPassword: (...a: unknown[]) => signInWithPassword(...a) } },
}));
vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({
    profile: { nombre: "Ana" }, roles: ["admin"], isAdmin: true, loading: false, profileLoading: false,
    hasRole: () => true, signOut: vi.fn(), user: { id: "u1" }, refreshProfile: vi.fn(),
  }),
}));
vi.mock("@/contexts/CampanaContext", () => ({
  useCampana: () => ({ campanaActiva: { id: "c1", nombre: "Renovación Web" }, campanas: [{ id: "c1", nombre: "Renovación Web" }], setCampanaActiva: vi.fn() }),
}));
// Las pestañas de administración cargan datos; aquí solo importa la navegación entre ellas
vi.mock("@/components/admin/AdminProfiles", () => ({ default: () => <p>Panel perfiles</p> }));
vi.mock("@/components/admin/AdminCases", () => ({ default: () => <p>Panel casos</p> }));
vi.mock("@/components/admin/AdminClients", () => ({ default: () => <p>Panel clientes</p> }));
vi.mock("@/components/admin/AdminCatalogs", () => ({ default: () => <p>Panel catálogos</p> }));
vi.mock("@/components/admin/AdminCampanas", () => ({ default: () => <p>Panel campañas</p> }));
vi.mock("@/components/admin/AdminActivityLog", () => ({ default: () => <p>Panel auditoría</p> }));
vi.mock("@/components/admin/AdminImportCasos", () => ({ default: () => <p>Panel importar</p> }));

import Login from "@/pages/Login";
import AppLayout from "@/components/AppLayout";
import Settings from "@/pages/Settings";

describe("login", () => {
  beforeEach(() => signInWithPassword.mockReset());

  it("traduce los errores de Supabase", () => {
    expect(loginErrorMessage("Invalid login credentials")).toBe("Correo o contraseña incorrectos.");
    expect(loginErrorMessage("Failed to fetch")).toMatch(/conexión/);
    expect(loginErrorMessage("algo raro")).toBe("No se pudo iniciar sesión. Inténtalo de nuevo.");
  });

  it("muestra el error junto al formulario y lo borra al volver a escribir", async () => {
    signInWithPassword.mockResolvedValue({ error: { message: "Invalid login credentials" } });
    render(<Login />);
    await userEvent.type(screen.getByLabelText("Correo electrónico"), "ana@x.com");
    await userEvent.type(screen.getByLabelText("Contraseña"), "mala");
    await userEvent.click(screen.getByRole("button", { name: "Iniciar sesión" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Correo o contraseña incorrectos.");
    expect(screen.getByLabelText("Contraseña")).toHaveAttribute("aria-invalid", "true");
    await userEvent.type(screen.getByLabelText("Contraseña"), "x");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("permite a los gestores de contraseñas autocompletar", () => {
    render(<Login />);
    expect(screen.getByLabelText("Correo electrónico")).toHaveAttribute("autocomplete", "username");
    expect(screen.getByLabelText("Contraseña")).toHaveAttribute("autocomplete", "current-password");
  });
});

describe("menú lateral en móvil", () => {
  const originalMatchMedia = window.matchMedia;
  beforeEach(() => {
    // Simula una pantalla angosta: el menú es un panel deslizable
    window.matchMedia = ((query: string) => ({
      matches: query.includes("max-width"), media: query, onchange: null,
      addListener: () => {}, removeListener: () => {}, addEventListener: () => {}, removeEventListener: () => {}, dispatchEvent: () => false,
    })) as typeof window.matchMedia;
  });
  afterEach(() => { window.matchMedia = originalMatchMedia; });

  it("cerrado no recibe foco; se abre con el botón y se cierra con Escape devolviendo el foco", async () => {
    render(<MemoryRouter initialEntries={["/casos"]}><AppLayout><p>contenido</p></AppLayout></MemoryRouter>);
    const sidebar = document.getElementById("app-sidebar")!;
    const menuBtn = screen.getByRole("button", { name: "Abrir menú" });

    expect(sidebar).toHaveAttribute("inert");
    expect(menuBtn).toHaveAttribute("aria-expanded", "false");
    expect(screen.getByRole("banner")).toHaveTextContent("Casos");

    await userEvent.click(menuBtn);
    expect(sidebar).not.toHaveAttribute("inert");
    expect(menuBtn).toHaveAttribute("aria-expanded", "true");
    await waitFor(() => expect(sidebar.contains(document.activeElement)).toBe(true));

    await userEvent.keyboard("{Escape}");
    expect(sidebar).toHaveAttribute("inert");
    expect(menuBtn).toHaveFocus();
  });

  it("marca la página actual en el menú", () => {
    render(<MemoryRouter initialEntries={["/casos"]}><AppLayout><p /></AppLayout></MemoryRouter>);
    const casos = screen.getAllByRole("link", { hidden: true }).find((a) => a.textContent === "Casos");
    expect(casos).toHaveAttribute("aria-current", "page");
  });
});

describe("administración", () => {
  function LocationProbe() {
    const loc = useLocation();
    return <span data-testid="loc">{loc.search}</span>;
  }

  it("la pestaña activa vive en la URL", async () => {
    render(
      <MemoryRouter initialEntries={["/ajustes?tab=campanas"]}>
        <Routes><Route path="/ajustes" element={<><Settings /><LocationProbe /></>} /></Routes>
      </MemoryRouter>,
    );
    expect(screen.getByRole("tab", { name: "Campañas" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByText("Panel campañas")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("tab", { name: "Auditoría" }));
    expect(screen.getByTestId("loc")).toHaveTextContent("?tab=auditoria");
  });
});

describe("confirmación de acciones destructivas", () => {
  it("el foco inicial queda en Cancelar y solo confirma al pulsar la acción", async () => {
    const onConfirm = vi.fn();
    render(
      <ConfirmDialog open onOpenChange={() => {}} title="¿Eliminar Renovación?" description="No se puede deshacer." confirmLabel="Eliminar" onConfirm={onConfirm} />,
    );
    expect(screen.getByRole("alertdialog", { name: "¿Eliminar Renovación?" })).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole("button", { name: "Cancelar" })).toHaveFocus());
    expect(onConfirm).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: "Eliminar" }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });
});

describe("documento", () => {
  it("declara el idioma español para los lectores de pantalla", () => {
    const html = readFileSync(resolve(__dirname, "../../../index.html"), "utf8");
    expect(html).toMatch(/<html lang="es">/);
  });
});

describe("cambio de contraseña", () => {
  it("acepta cualquier símbolo como carácter especial (antes '-' o '_' no contaban)", async () => {
    const { default: ChangePassword } = await import("@/pages/ChangePassword");
    render(<MemoryRouter><ChangePassword /></MemoryRouter>);
    await userEvent.type(screen.getByLabelText("Nueva contraseña"), "Clave-segura1");
    await userEvent.type(screen.getByLabelText("Confirmar nueva contraseña"), "Clave-segura1");
    expect(screen.getByRole("button", { name: "Guardar y continuar" })).toBeEnabled();
    // Cada regla aparece una sola vez (antes se repetían como errores bajo el campo)
    expect(screen.getAllByText(/carácter especial/)).toHaveLength(1);
  });
});
