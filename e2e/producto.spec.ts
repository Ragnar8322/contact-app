import { test, expect } from "@playwright/test";
import { login, toast, elegir } from "./helpers";

test.describe("pantallas unificadas, tema y gráficas", () => {
  test("Administración ya no repite Casos ni Clientes", async ({ page }) => {
    await login(page, "admin");
    await page.goto("/ajustes");
    const pestañas = page.getByRole("tablist");
    await expect(pestañas.getByRole("tab")).toHaveText(["Perfiles", "Catálogos", "Campañas", "Auditoría", "Importar"]);
  });

  test("el admin reasigna agente y tipo de servicio desde el detalle del caso", async ({ page }) => {
    await login(page, "admin");
    await page.goto("/casos");
    await page.locator("table tbody tr").first().click();
    const panel = page.getByRole("dialog");
    const agente = panel.getByLabel("Agente", { exact: true });
    const actual = (await agente.textContent())!.trim();
    await agente.click();
    await page.getByRole("option").filter({ hasNotText: actual }).first().click();
    const nuevo = (await agente.textContent())!.trim();
    expect(nuevo).not.toBe(actual);
    await panel.getByRole("button", { name: "Guardar asignación" }).click();
    await toast(page, "Asignación actualizada");
    await expect(panel.getByText(`Reasignado por administrador (agente: ${nuevo})`)).toBeVisible();
    await expect(panel.getByText(nuevo, { exact: true }).first()).toBeVisible();
  });

  test("un agente no ve la sección de asignación", async ({ page }) => {
    await login(page, "agente");
    await page.goto("/casos");
    await page.locator("table tbody tr").first().click();
    await expect(page.getByRole("dialog").getByRole("heading", { name: /^Caso #/ })).toBeVisible();
    await expect(page.getByRole("button", { name: "Guardar asignación" })).toHaveCount(0);
  });

  test("el gerente consulta clientes sin poder crearlos ni editarlos", async ({ page }) => {
    await login(page, "gerente");
    await page.goto("/clientes");
    await expect(page.locator("table tbody tr").first()).toBeVisible();
    await expect(page.getByRole("button", { name: "Crear Cliente" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: /^Editar / })).toHaveCount(0);
  });

  test("el modo oscuro se activa y se mantiene al recargar", async ({ page }) => {
    await login(page, "supervisor");
    const html = page.locator("html");
    await page.getByRole("button", { name: "Tema oscuro" }).click();
    await expect(html).toHaveClass(/\bdark\b/);
    await expect(page.getByRole("button", { name: "Tema oscuro" })).toHaveAttribute("aria-pressed", "true");
    await page.reload();
    await expect(html).toHaveClass(/\bdark\b/);
    await page.getByRole("button", { name: "Tema claro" }).click();
    await expect(html).not.toHaveClass(/\bdark\b/);
  });

  test("Analítica muestra barras con cantidad y porcentaje en vez de tortas", async ({ page }) => {
    await login(page, "supervisor");
    await page.goto("/analitica");
    const tarjeta = page.locator("div.rounded-lg").filter({ has: page.getByText("Casos por Estado", { exact: true }) }).first();
    await expect(tarjeta.locator(".recharts-bar-rectangle").first()).toBeVisible();
    await expect(tarjeta.getByText(/^\d+ \(\d+%\)$/).first()).toBeVisible();
    await expect(page.locator(".recharts-pie")).toHaveCount(0);
  });

  test("la selección de estado del caso sigue funcionando junto a la de asignación", async ({ page }) => {
    await login(page, "admin");
    await page.goto("/casos");
    await page.locator("table tbody tr").first().click();
    const panel = page.getByRole("dialog");
    await elegir(page, panel.getByLabel("Cambiar Estado"), "En gestión");
    await expect(panel.getByLabel("Observaciones (opcional)")).toBeVisible();
  });
});
