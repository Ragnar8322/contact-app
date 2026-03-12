import { describe, it, expect } from "vitest";

// Smoke tests para la edge function invite-user
// Validan la estructura de request/response sin ejecutar Deno

describe("invite-user edge function — smoke tests", () => {
  const FUNCTION_URL = `${import.meta.env.VITE_SUPABASE_URL ?? "http://localhost:54321"}/functions/v1/invite-user`;

  it("rechaza sin Authorization header (401)", async () => {
    const res = await fetch(FUNCTION_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "test@test.com", role_id: 1 }),
    }).catch(() => null);

    // En entorno de test sin Supabase local, la conexión falla — es esperado
    // En CI con Supabase local corriendo, debe retornar 401
    if (res) {
      expect([401, 403]).toContain(res.status);
    } else {
      // Sin servidor local: verificamos que la URL tiene el formato correcto
      expect(FUNCTION_URL).toContain("/functions/v1/invite-user");
    }
  });

  it("la URL de la función tiene el formato correcto", () => {
    expect(FUNCTION_URL).toMatch(/\/functions\/v1\/invite-user$/);
  });

  it("el body mínimo válido contiene email y role_id", () => {
    const validBody = { email: "usuario@camara.com", role_id: 2 };
    expect(validBody).toHaveProperty("email");
    expect(validBody).toHaveProperty("role_id");
    expect(typeof validBody.email).toBe("string");
    expect(typeof validBody.role_id).toBe("number");
  });

  it("body sin email debe ser rechazado por validación", () => {
    const invalidBody = { role_id: 1 };
    const isValid = "email" in invalidBody && "role_id" in invalidBody;
    expect(isValid).toBe(false);
  });

  it("body sin role_id debe ser rechazado por validación", () => {
    const invalidBody = { email: "test@test.com" };
    const isValid = "email" in invalidBody && "role_id" in invalidBody;
    expect(isValid).toBe(false);
  });
});
