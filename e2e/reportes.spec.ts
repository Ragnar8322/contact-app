import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
import ExcelJS from "exceljs";
import { login, toast } from "./helpers";

test.describe("reportes e importación", () => {
  test("Analítica exporta el Excel y el PDF con los datos de la pantalla", async ({ page }) => {
    await login(page, "supervisor");
    await page.goto("/analitica");
    const total = page.getByText("Total Casos", { exact: true }).locator("xpath=../..").locator(".text-2xl");
    await expect(total).toHaveText(/\d/);
    const totalPantalla = Number((await total.textContent())!.replace(/\D/g, ""));

    const [excel] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Exportar Excel" }).click()]);
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(await readFile((await excel.path())!));
    expect(wb.worksheets).toHaveLength(9);
    expect(wb.getWorksheet("Resumen")!.getCell("B7").value).toBe(totalPantalla);

    const [pdf] = await Promise.all([page.waitForEvent("download", { timeout: 60_000 }), page.getByRole("button", { name: "Exportar PDF" }).click()]);
    const bytes = await readFile((await pdf.path())!);
    expect(bytes.subarray(0, 4).toString()).toBe("%PDF");
    expect(pdf.suggestedFilename()).toMatch(/^Informe_Ejecutivo_Renovacion_\d{8}_\d{4}\.pdf$/);
  });

  test("el admin importa casos desde Excel y ve las filas rechazadas", async ({ page }, testInfo) => {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("Casos");
    ws.addRow(["cliente_identificacion", "agente_correo", "estado", "tipo_servicio", "descripcion_inicial", "fecha_caso", "valor_pagar"]);
    ws.addRow(["900000001", { text: "agente1@demo.local", hyperlink: "mailto:agente1@demo.local" }, "Registrado", "Renovación Web", "Importado por E2E", new Date(Date.UTC(2026, 0, 15)), 150000]);
    ws.addRow([]);
    ws.addRow([null, "agente1@demo.local", "Registrado", "Renovación Web", "Sin identificación", "15/01/2026", "$150.000"]);
    const archivo = testInfo.outputPath("importar.xlsx");
    await wb.xlsx.writeFile(archivo);

    await login(page, "admin");
    await page.goto("/ajustes");
    await page.getByRole("tab", { name: "Importar" }).click();
    await page.locator("input[type=file]").setInputFiles(archivo);

    const filas = page.locator("table tbody tr");
    await expect(filas).toHaveCount(2);
    await expect(filas.nth(0)).toContainText("agente1@demo.local");
    await expect(filas.nth(0)).toContainText("2026-01-15");
    await expect(filas.nth(1)).toContainText(/^4/);
    await expect(filas.nth(1)).toContainText("Identificación requerida");

    await page.getByRole("button", { name: "Confirmar importación (1 casos)" }).click();
    await toast(page, /1 casos importados/);
  });
});
