// Tests unitarios para funciones puras del módulo de horarios.
// No requieren mocks de Supabase ni contextos de React.
import { describe, it, expect } from "vitest";
import {
  getWeekStart,
  getWeekEnd,
  toISODate,
  formatHoras,
  canManageSchedules,
  isAgentView,
} from "@/types/schedules";
import type { RoleName } from "@/contexts/AuthContext";

// ============================================================
// getWeekStart
// ============================================================
describe("getWeekStart", () => {
  it("retorna el lunes dado un miércoles", () => {
    const wed = new Date("2026-03-18"); // miércoles
    const result = getWeekStart(wed);
    expect(toISODate(result)).toBe("2026-03-16");
  });

  it("retorna el lunes anterior dado un domingo", () => {
    const sun = new Date("2026-03-22"); // domingo
    const result = getWeekStart(sun);
    expect(toISODate(result)).toBe("2026-03-16");
  });

  it("retorna el mismo día si ya es lunes", () => {
    const mon = new Date("2026-03-16"); // lunes
    const result = getWeekStart(mon);
    expect(toISODate(result)).toBe("2026-03-16");
  });

  it("retorna el lunes dado un sábado", () => {
    const sat = new Date("2026-03-21"); // sábado
    const result = getWeekStart(sat);
    expect(toISODate(result)).toBe("2026-03-16");
  });
});

// ============================================================
// getWeekEnd
// ============================================================
describe("getWeekEnd", () => {
  it("retorna el domingo dado el lunes de una semana", () => {
    const mon = new Date("2026-03-16");
    const result = getWeekEnd(mon);
    expect(toISODate(result)).toBe("2026-03-22");
  });
});

// ============================================================
// toISODate
// ============================================================
describe("toISODate", () => {
  it("formatea un Date al formato YYYY-MM-DD", () => {
    const d = new Date("2026-01-05T12:00:00Z");
    expect(toISODate(d)).toBe("2026-01-05");
  });
});

// ============================================================
// formatHoras
// ============================================================
describe("formatHoras", () => {
  it("formatea null → '—'", () => {
    expect(formatHoras(null)).toBe("—");
  });

  it("formatea undefined → '—'", () => {
    expect(formatHoras(undefined)).toBe("—");
  });

  it("formatea 8 → '8h'", () => {
    expect(formatHoras(8)).toBe("8h");
  });

  it("formatea 8.5 → '8h 30min'", () => {
    expect(formatHoras(8.5)).toBe("8h 30min");
  });

  it("formatea 0 → '0h'", () => {
    expect(formatHoras(0)).toBe("0h");
  });

  it("formatea 1.25 → '1h 15min'", () => {
    expect(formatHoras(1.25)).toBe("1h 15min");
  });
});

// ============================================================
// canManageSchedules
// ============================================================
describe("canManageSchedules", () => {
  it("retorna true para admin", () => {
    expect(canManageSchedules(["admin"] as RoleName[])).toBe(true);
  });

  it("retorna true para supervisor", () => {
    expect(canManageSchedules(["supervisor"] as RoleName[])).toBe(true);
  });

  it("retorna true para gerente", () => {
    expect(canManageSchedules(["gerente"] as RoleName[])).toBe(true);
  });

  it("retorna false para agent", () => {
    expect(canManageSchedules(["agent"] as RoleName[])).toBe(false);
  });

  it("retorna false para array vacío", () => {
    expect(canManageSchedules([])).toBe(false);
  });

  it("retorna true si tiene admin entre múltiples roles", () => {
    expect(canManageSchedules(["agent", "admin"] as RoleName[])).toBe(true);
  });
});

// ============================================================
// isAgentView
// ============================================================
describe("isAgentView", () => {
  it("retorna true para agent puro", () => {
    expect(isAgentView(["agent"] as RoleName[])).toBe(true);
  });

  it("retorna false para admin (puede gestionar)", () => {
    expect(isAgentView(["admin"] as RoleName[])).toBe(false);
  });

  it("retorna false para agent + supervisor (puede gestionar)", () => {
    expect(isAgentView(["agent", "supervisor"] as RoleName[])).toBe(false);
  });
});
