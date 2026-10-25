import { describe, it, expect, vi, beforeEach } from "vitest";

const sentry = vi.hoisted(() => ({
  init: vi.fn(),
  captureException: vi.fn(),
  setUser: vi.fn(),
  setTag: vi.fn(),
  scope: { setTag: vi.fn(), setExtras: vi.fn(), setExtra: vi.fn() },
  withScope: vi.fn(),
}));
vi.mock("@sentry/react", () => ({
  ...sentry,
  withScope: (cb: (s: typeof sentry.scope) => void) => { sentry.withScope(); cb(sentry.scope); },
}));

async function cargar(dsn?: string) {
  vi.resetModules();
  vi.stubEnv("VITE_SENTRY_DSN", dsn ?? "");
  return import("@/lib/monitoring");
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("monitoreo de errores", () => {
  it("no reporta errores esperados: reglas de negocio, credenciales y falta de conexión", async () => {
    const { esErrorEsperado } = await cargar();
    expect(esErrorEsperado({ code: "P0001", message: "La campaña no tiene supervisor" })).toBe(true);
    expect(esErrorEsperado({ message: "Invalid login credentials" })).toBe(true);
    expect(esErrorEsperado(new TypeError("Failed to fetch"))).toBe(true);
    expect(esErrorEsperado({ code: "42501", message: "permission denied" })).toBe(false);
    expect(esErrorEsperado(new Error("Cannot read properties of undefined"))).toBe(false);
  });

  it("sin DSN no carga Sentry", async () => {
    const m = await cargar();
    await m.initMonitoring();
    m.reportError(new Error("x"));
    expect(sentry.init).not.toHaveBeenCalled();
    expect(sentry.captureException).not.toHaveBeenCalled();
  });

  it("con DSN reporta los errores de Supabase como Error, con la operación y sin datos personales", async () => {
    const m = await cargar("https://clave@o1.ingest.sentry.io/1");
    await m.initMonitoring();
    expect(sentry.init).toHaveBeenCalledWith(expect.objectContaining({
      dataCollection: expect.objectContaining({ userInfo: false, httpBodies: [] }),
    }));

    m.reportError({ code: "42501", message: "permission denied for table casos" }, { operacion: "guardado", mutacion: "casos" });
    const enviado = sentry.captureException.mock.calls[0][0] as Error;
    expect(enviado).toBeInstanceOf(Error);
    expect(enviado.message).toBe("permission denied for table casos");
    expect(sentry.scope.setTag).toHaveBeenCalledWith("operacion", "guardado");
    expect(sentry.scope.setExtras).toHaveBeenCalledWith({ mutacion: "casos" });

    m.reportError({ code: "P0001", message: "regla de negocio" });
    expect(sentry.captureException).toHaveBeenCalledTimes(1);
  });

  it("los errores ocurridos antes de cargar el SDK se envían al cargarlo", async () => {
    const m = await cargar("https://clave@o1.ingest.sentry.io/1");
    m.setMonitoringUser({ id: "u1", rol: "supervisor" });
    m.reportError(new Error("temprano"), { operacion: "render" });
    expect(sentry.captureException).not.toHaveBeenCalled();
    await m.initMonitoring();
    expect(sentry.captureException).toHaveBeenCalledWith(expect.objectContaining({ message: "temprano" }));
    expect(sentry.setUser).toHaveBeenCalledWith({ id: "u1" });
    expect(sentry.setTag).toHaveBeenCalledWith("rol", "supervisor");
  });
});
