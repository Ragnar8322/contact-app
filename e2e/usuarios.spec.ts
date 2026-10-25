import { test, expect } from "@playwright/test";
import { login, logout } from "./helpers";

test.describe("usuarios nuevos", () => {
  test("el admin crea un usuario y este debe cambiar la contraseña temporal antes de entrar", async ({ page }) => {
    const email = `nuevo.${Date.now()}@demo.local`;

    // 1. El admin crea el usuario (invite-user) y ve la contraseña temporal una sola vez
    await login(page, "admin");
    await page.goto("/ajustes?tab=profiles");
    await page.getByRole("button", { name: "Crear Usuario" }).click();
    const form = page.getByRole("dialog");
    await form.getByLabel("Email *").fill(email);
    await form.getByLabel("Nombre").fill("Usuario Nuevo E2E");
    await form.getByRole("button", { name: "Crear Usuario" }).click();

    const credenciales = page.getByRole("alertdialog");
    await expect(credenciales.getByText("Usuario creado")).toBeVisible();
    const temporal = (await credenciales.locator("code").textContent())!.trim();
    expect(temporal).toMatch(/^(?=.*[A-Z])(?=.*[a-z])(?=.*\d)(?=.*[^A-Za-z0-9]).{14}$/);
    await credenciales.getByRole("button", { name: "Entendido" }).click();
    await logout(page);

    // 2. El usuario entra con la temporal y queda obligado a cambiarla
    await page.locator("#email").fill(email);
    await page.locator("#password").fill(temporal);
    await page.getByRole("button", { name: "Iniciar sesión" }).click();
    await expect(page).toHaveURL(/\/cambiar-contrasena$/);
    await page.goto("/");
    await expect(page).toHaveURL(/\/cambiar-contrasena$/);

    // 3. Cambia la contraseña: la base apaga la marca y ya puede continuar
    const nueva = "Definitiva#2026";
    await page.locator("#new-password").fill(nueva);
    await page.locator("#confirm-password").fill(nueva);
    await page.getByRole("button", { name: "Guardar y continuar" }).click();
    // Sin campañas asignadas todavía: llega a la pantalla que lo explica
    await expect(page.getByRole("heading", { name: "Sin campañas asignadas" })).toBeVisible();
    await page.reload();
    await expect(page.getByRole("heading", { name: "Sin campañas asignadas" })).toBeVisible();
    await expect(page).not.toHaveURL(/\/cambiar-contrasena$/);
  });
});
