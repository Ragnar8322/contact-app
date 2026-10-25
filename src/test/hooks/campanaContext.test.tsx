import { describe, it, expect, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { FakeSupabase } from "../helpers/fakeSupabase";

const h = vi.hoisted(() => ({
  db: null as unknown as import("../helpers/fakeSupabase").FakeSupabase,
  auth: { user: { id: "u1" } as { id: string }, isAdmin: false, loading: false },
}));
vi.mock("@/integrations/supabase/client", () => ({ get supabase() { return h.db; } }));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => h.auth }));

import { CampanaProvider, useCampana } from "@/contexts/CampanaContext";

describe("CampanaContext", () => {
  it("renovar el token (objeto user nuevo, mismo id) no recarga las campañas ni desmonta la app", async () => {
    h.db = new FakeSupabase({
      tablas: {
        campanas: [{ id: "c1", nombre: "Renovación Web", activa: true }],
        perfil_campanas: [{ user_id: "u1", campana_id: "c1" }],
      },
    });
    const wrapper = ({ children }: { children: ReactNode }) => <CampanaProvider>{children}</CampanaProvider>;
    const { result, rerender } = renderHook(() => useCampana(), { wrapper });
    await waitFor(() => expect(result.current.campanaActiva?.id).toBe("c1"));
    const lecturas = h.db.llamadas.length;

    h.auth = { ...h.auth, user: { id: "u1" } };
    rerender();
    await new Promise((r) => setTimeout(r, 20));

    expect(result.current.loading).toBe(false);
    expect(h.db.llamadas.length).toBe(lecturas);
  });

  it("si cambia el usuario sí recarga", async () => {
    h.db.tablas.perfil_campanas.push({ user_id: "u2", campana_id: "c1" });
    const wrapper = ({ children }: { children: ReactNode }) => <CampanaProvider>{children}</CampanaProvider>;
    h.auth = { ...h.auth, user: { id: "u1" } };
    const { result, rerender } = renderHook(() => useCampana(), { wrapper });
    await waitFor(() => expect(result.current.campanaActiva?.id).toBe("c1"));
    const lecturas = h.db.lecturas("perfil_campanas").length;

    h.auth = { ...h.auth, user: { id: "u2" } };
    rerender();
    await waitFor(() => expect(h.db.lecturas("perfil_campanas").length).toBe(lecturas + 1));
  });
});
