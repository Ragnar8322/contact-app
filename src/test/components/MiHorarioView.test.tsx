import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { getWeekStart, toISODate } from "@/types/schedules";

const useCurrentSchedule = vi.fn();
vi.mock("@/hooks/useSchedules", () => ({
  useCurrentSchedule: (d: Date) => useCurrentSchedule(d),
  useMyShifts: () => ({ data: [shiftHoy], isLoading: false, isError: false }),
  useScheduleNovedades: () => ({ data: [], isLoading: false }),
  useCreateNovedad: () => ({ mutate: vi.fn(), isPending: false }),
}));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ user: { id: "a1" } }) }));

// Hoy fijo: miércoles 18 de marzo de 2026
const HOY = new Date(2026, 2, 18, 10, 0);
const lunes = toISODate(getWeekStart(HOY));
const shiftHoy = {
  id: "s1", schedule_id: "w1", agente_id: "a1", fecha: "2026-03-18", tipo_actividad: "GAP",
  hora_inicio: "07:30:00", hora_fin: "16:30:00", hora_almuerzo: "12:00:00", duracion_almuerzo: 60,
  horas_dia: 8, observacion: null, shift_type_id: null, created_at: "", updated_at: "",
};

import MiHorarioView from "@/components/schedules/MiHorarioView";

describe("Mi Horario", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(HOY);
    useCurrentSchedule.mockImplementation((d: Date) => ({
      data: toISODate(getWeekStart(d)) === lunes
        ? { id: "w1", campana_id: "c1", semana_inicio: lunes, semana_fin: "2026-03-22", estado: "publicado" }
        : null,
      isLoading: false, isError: false,
    }));
  });
  afterEach(() => vi.useRealTimers());

  it("resalta el día de hoy", () => {
    render(<MiHorarioView />);
    const hoy = screen.getByText("Hoy", { selector: "div.inline-flex, span, div" }).closest("[aria-current]");
    expect(hoy).toHaveAttribute("aria-current", "date");
    expect(within(hoy as HTMLElement).getByText("Miércoles")).toBeInTheDocument();
  });

  it("los días sin turno se leen sin opacidad reducida", () => {
    render(<MiHorarioView />);
    const lunesRow = screen.getByText("Lunes").closest("div")!;
    expect(lunesRow.className).not.toMatch(/opacity-40/);
    expect(within(lunesRow).getByText("Descanso / Sin turno")).toBeInTheDocument();
  });

  it("permite ver la semana siguiente y volver a hoy", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<MiHorarioView />);
    expect(screen.queryByRole("button", { name: "Hoy" })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Semana siguiente" }));
    expect(toISODate(useCurrentSchedule.mock.calls.at(-1)![0])).toBe("2026-03-23");
    expect(screen.getByText("El horario de esta semana aún no ha sido publicado.")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Hoy" }));
    expect(toISODate(getWeekStart(useCurrentSchedule.mock.calls.at(-1)![0]))).toBe(lunes);
    expect(screen.getByText("Miércoles")).toBeInTheDocument();
  });
});
