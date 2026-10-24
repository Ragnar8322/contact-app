import { test, expect, type Page } from "@playwright/test";
import { login, toast, elegir, ASESORIA, USUARIOS } from "./helpers";

/** Abre el primer caso de la pestaña Activos y devuelve su número. */
async function abrirPrimerCasoActivo(page: Page) {
  await page.goto("/casos");
  await expect(page.getByRole("button", { name: /^Activos/ })).toHaveAttribute("aria-pressed", "true");
  const fila = page.locator("table tbody tr").first();
  await expect(fila.locator("td").first()).toContainText(/\d+/);
  await fila.click();
  const titulo = page.getByRole("dialog").getByRole("heading", { name: /^Caso #\d+$/ });
  await expect(titulo).toBeVisible();
  return Number((await titulo.textContent())!.replace(/\D/g, ""));
}

test.describe("casos", () => {
  test("un agente crea un caso con un cliente nuevo", async ({ page }) => {
    await login(page, "agente");
    await page.goto("/casos");
    await page.getByRole("button", { name: "Crear Caso" }).click();
    const dialogo = page.getByRole("dialog");
    const identificacion = `E2E${Date.now()}`;
    await dialogo.getByLabel("Identificación *").fill(identificacion);
    await expect(dialogo.getByText("Cliente no encontrado")).toBeVisible();
    await dialogo.getByLabel("Nombre del Contacto *").fill("Cliente de Prueba E2E");
    await elegir(page, dialogo.getByLabel("Tipo de Servicio *"), "Renovación Web");
    await dialogo.getByLabel("Descripción Inicial *").fill("Caso creado por la prueba de punta a punta");
    await dialogo.getByRole("button", { name: "Crear Cliente y Caso" }).click();
    await toast(page, "Cliente y caso creados exitosamente");

    await page.getByPlaceholder(/Buscar por cliente/).fill(identificacion);
    await expect(page.locator("table tbody tr")).toHaveCount(1);
    // La app guarda los nombres en mayúsculas
    await expect(page.locator("table tbody tr").first()).toContainText("CLIENTE DE PRUEBA E2E");
  });

  test("un agente gestiona y cierra un caso", async ({ page }) => {
    await login(page, "agente");
    await abrirPrimerCasoActivo(page);
    const panel = page.getByRole("dialog");

    // Gestión sin cambio de estado: observación opcional
    await elegir(page, panel.getByLabel("Cambiar Estado"), "En gestión");
    await panel.getByLabel("Observaciones (opcional)").fill("Llamada de seguimiento E2E");
    await panel.getByRole("button", { name: "Actualizar Caso" }).click();
    await toast(page, "Caso actualizado");
    await expect(panel.getByText("Llamada de seguimiento E2E")).toBeVisible();

    // Cierre: exige observaciones
    await elegir(page, panel.getByLabel("Cambiar Estado"), "No renovado");
    await expect(panel.getByRole("button", { name: "Actualizar Caso" })).toBeDisabled();
    await panel.getByLabel(/Observaciones de gestión/).fill("El cliente informa que no renovará este año.");
    await panel.getByRole("button", { name: "Actualizar Caso" }).click();
    await toast(page, "Caso actualizado");
    await expect(panel.getByText("Este caso está cerrado")).toBeVisible();
  });

  test("un agente transfiere un caso a otra campaña y queda con el supervisor", async ({ page }) => {
    await login(page, "agente");
    const id = await abrirPrimerCasoActivo(page);
    const panel = page.getByRole("dialog");
    await elegir(page, panel.getByRole("combobox").filter({ hasText: "Seleccionar campaña destino" }), ASESORIA);
    await panel.getByRole("button", { name: "Transferir", exact: true }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: "Confirmar transferencia" }).click();
    await toast(page, new RegExp(`asignado a ${USUARIOS.supervisor.nombre}`));

    // El original queda Transferido y enlaza al caso nuevo
    await page.goto(`/casos?caso=${id}`);
    const detalle = page.getByRole("dialog");
    const aviso = detalle.getByRole("alert").filter({ hasText: "Este caso fue transferido." });
    await expect(aviso).toContainText(`en la campaña ${ASESORIA}`);

    // El caso nuevo es del supervisor de la otra campaña: el agente no puede abrirlo
    await aviso.getByRole("button", { name: /^#\d+$/ }).click();
    await expect(page.getByText("No tienes acceso a este caso.")).toBeVisible();

    // En la pestaña Transferidos se ve la campaña destino
    await page.keyboard.press("Escape");
    await page.goto("/casos");
    await page.getByRole("button", { name: /^Transferidos/ }).click();
    await expect(page.locator("table tbody tr").filter({ hasText: `#${id}` }).first()).toContainText(ASESORIA);
  });

  test("un supervisor reparte los casos registrados entre los agentes", async ({ page }) => {
    await login(page, "supervisor");
    await page.goto("/casos");
    await page.getByRole("button", { name: "Asignar Casos" }).click();
    const modal = page.getByRole("dialog");
    const confirmar = modal.getByRole("button", { name: /Confirmar Asignación \(\d+ casos\)/ });
    await expect(confirmar).toBeEnabled();
    const n = Number((await confirmar.textContent())!.match(/\((\d+) casos\)/)![1]);
    expect(n).toBeGreaterThan(0);
    await confirmar.click();
    await toast(page, new RegExp(`${n} casos asignados entre \\d+ agentes`));
  });

  test("el gerente ve los casos pero no puede abrir la sección Casos", async ({ page }) => {
    await login(page, "gerente");
    await page.goto("/casos");
    await expect(page).toHaveURL(/\/$/);
  });
});
