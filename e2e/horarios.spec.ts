import { test, expect, type Page } from "@playwright/test";
import { login, logout, toast } from "./helpers";

// Trabaja dos semanas adelante para no chocar con la semana publicada del seed
async function irASemana(page: Page, saltos: number) {
  for (let i = 0; i < saltos; i++) await page.getByRole("button", { name: "Semana siguiente" }).click();
}

test.describe("horarios", () => {
  test("el supervisor crea, genera y publica una semana y el agente ve sus turnos", async ({ page }) => {
    await login(page, "supervisor");
    await page.goto("/horarios");
    await irASemana(page, 2);

    // Si una corrida anterior ya creó la semana, se reutiliza
    const crear = page.getByRole("button", { name: "Crear semana" });
    const regresar = page.getByRole("button", { name: "Regresar a Borrador" });
    await expect(crear.or(page.getByRole("button", { name: "Generar horario" })).or(regresar)).toBeVisible();
    if (await regresar.isVisible()) await regresar.click();
    if (await crear.isVisible()) {
      await crear.click();
      await toast(page, "Semana creada");
    }

    await page.getByRole("button", { name: "Generar horario" }).click();
    const modal = page.getByRole("dialog");
    await expect(modal.getByRole("heading", { name: "Generar horario inteligente" })).toBeVisible();
    await modal.getByRole("button", { name: /Generar/ }).last().click();
    await toast(page, "Horario generado");

    await page.getByRole("button", { name: "Publicar semana" }).click();
    await toast(page, "Semana publicada");
    await expect(page.getByRole("button", { name: "Regresar a Borrador" })).toBeVisible();

    // El agente ve sus turnos de esa semana
    await logout(page);
    await login(page, "agente");
    await page.goto("/mi-horario");
    await irASemana(page, 2);
    await expect(page.getByText(/\d{2}:\d{2} – \d{2}:\d{2}/).first()).toBeVisible();
    await expect(page.getByText("aún no ha sido publicado")).toHaveCount(0);
  });
});
