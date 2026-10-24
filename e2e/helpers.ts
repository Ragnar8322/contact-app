import { expect, type Page } from "@playwright/test";

// Usuarios de supabase/seed.sql (contraseña Demo1234!)
export const USUARIOS = {
  admin: { email: "admin@demo.local", nombre: "ANA ADMINISTRADORA" },
  supervisor: { email: "supervisor@demo.local", nombre: "SERGIO SUPERVISOR" },
  gerente: { email: "gerente@demo.local", nombre: "GLORIA GERENTE" },
  agente: { email: "agente1@demo.local", nombre: "LAURA MARTÍNEZ" },
} as const;

export type Rol = keyof typeof USUARIOS;

export const RENOVACION = "Renovación Web";
export const ASESORIA = "Asesoría Especializada";

/** Inicia sesión y, si el usuario tiene varias campañas, elige `campana`. Termina en el Dashboard. */
export async function login(page: Page, rol: Rol, campana = RENOVACION) {
  await page.goto("/login");
  await page.locator("#email").fill(USUARIOS[rol].email);
  await page.locator("#password").fill("Demo1234!");
  await page.getByRole("button", { name: "Iniciar sesión" }).click();
  // Tras el login la app pasa por "/" y, si hay varias campañas, redirige a la selección
  const dashboard = page.getByRole("heading", { name: "Dashboard" });
  const seleccion = page.getByRole("heading", { name: "Selecciona una campaña" });
  await expect(dashboard.or(seleccion)).toBeVisible();
  if (await seleccion.isVisible()) {
    await page.getByRole("button", { name: new RegExp(campana) }).click();
  }
  await expect(dashboard).toBeVisible();
}

export async function logout(page: Page) {
  await page.getByRole("button", { name: "Cerrar sesión" }).click();
  await expect(page).toHaveURL(/\/login$/);
}

/** Espera la notificación con ese texto. */
export async function toast(page: Page, texto: string | RegExp) {
  await expect(page.locator("[data-sonner-toast]").filter({ hasText: texto }).first()).toBeVisible();
}

/** Elige una opción de un Select de Radix abierto desde el control `trigger`. */
export async function elegir(page: Page, trigger: ReturnType<Page["locator"]>, opcion: string | RegExp) {
  await trigger.click();
  await page.getByRole("option", { name: opcion }).click();
}
