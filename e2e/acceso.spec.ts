import { test, expect } from "@playwright/test";
import { login, logout, USUARIOS } from "./helpers";

test.describe("acceso por rol", () => {
  test("credenciales incorrectas muestran un mensaje claro", async ({ page }) => {
    await page.goto("/login");
    await page.locator("#email").fill(USUARIOS.agente.email);
    await page.locator("#password").fill("incorrecta");
    await page.getByRole("button", { name: "Iniciar sesión" }).click();
    await expect(page.getByText("Correo o contraseña incorrectos.")).toBeVisible();
    await expect(page).toHaveURL(/\/login$/);
  });

  const menus = {
    admin: { ve: ["Dashboard", "Clientes", "Casos", "Analítica", "Horarios", "Administración"], noVe: ["Mi Horario"] },
    supervisor: { ve: ["Dashboard", "Clientes", "Casos", "Analítica", "Horarios"], noVe: ["Administración", "Mi Horario"] },
    gerente: { ve: ["Dashboard", "Clientes", "Analítica", "Horarios"], noVe: ["Casos", "Administración"] },
    agente: { ve: ["Dashboard", "Clientes", "Casos", "Mi Horario"], noVe: ["Analítica", "Horarios", "Administración"] },
  } as const;

  for (const [rol, { ve, noVe }] of Object.entries(menus)) {
    test(`el menú de ${rol} muestra solo sus secciones`, async ({ page }) => {
      await login(page, rol as keyof typeof menus);
      const nav = page.getByRole("navigation").first();
      for (const item of ve) await expect(nav.getByRole("link", { name: item, exact: true })).toBeVisible();
      for (const item of noVe) await expect(nav.getByRole("link", { name: item, exact: true })).toHaveCount(0);
    });
  }

  test("un agente que abre Analítica por URL vuelve al Dashboard", async ({ page }) => {
    await login(page, "agente");
    await page.goto("/analitica");
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
  });

  test("un admin que recarga Administración se queda en Administración", async ({ page }) => {
    await login(page, "admin");
    await page.goto("/ajustes?tab=importar");
    await expect(page.getByRole("heading", { name: "Administración" })).toBeVisible();
    await page.reload();
    await expect(page.getByRole("heading", { name: "Administración" })).toBeVisible();
    await expect(page).toHaveURL(/\/ajustes\?tab=importar$/);
  });

  test("cerrar sesión vuelve al login", async ({ page }) => {
    await login(page, "supervisor");
    await logout(page);
  });
});
