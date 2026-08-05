/**
 * @file Fixture Playwright para autenticar un ADMIN antes de los tests.
 * @id IMPL-20260804-05 — O1 (CIERRE) — rev. 2 (fix GEMINI F2)
 * @backup context/SPECs/SPEC_ARCH-20260804-04-BLOQUEO-ASIMETRICO-CONFLICTOS.md
 *
 * Estrategia:
 *  - Usa `page.request` (no el fixture `request` standalone) para que el
 *    Set-Cookie que devuelve NextAuth caiga en el MISMO BrowserContext que
 *    usaremos para verificar la sesión. Sin esto, la cookie se queda en el
 *    jar del APIRequestContext aislado y `page.goto('/admin/...')` redirige
 *    a /login (dictamen GEMINI INFRA-20260805-01 F2).
 *  - El seed-e2e (globalSetup) garantiza que las credenciales existen.
 *  - Persiste la sesión en `tests/.auth/admin.json` para que cada test la
 *    reuse vía `storageState` (configurado en playwright.config.ts).
 */
import { test as setup, expect } from "@playwright/test"

const ADMIN_EMAIL = "e2e-admin@ami.test"
const ADMIN_PASSWORD = "E2eAdmin!2026"

const authFile = "tests/.auth/admin.json"

setup("autenticar ADMIN", async ({ page }) => {
  // page.request comparte cookies con el BrowserContext de page.
  const csrfRes = await page.request.get("/api/auth/csrf")
  expect(csrfRes.ok(), "csrf endpoint debe responder 2xx").toBeTruthy()
  const { csrfToken } = (await csrfRes.json()) as { csrfToken: string }

  // 2) POST credenciales a /api/auth/callback/credentials
  const callbackRes = await page.request.post("/api/auth/callback/credentials", {
    form: {
      csrfToken,
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD,
      redirect: "false",
      json: "true",
    },
  })
  if (!callbackRes.ok()) {
    throw new Error(
      `Login ADMIN falló: status=${callbackRes.status()} body=${await callbackRes.text()}`
    )
  }

  // 3) Verificar sesión en el navegador antes de guardar storageState.
  // Si la cookie no llegó, el middleware redirige a /login.
  await page.goto("/admin/mobile-units")
  await page.waitForLoadState("domcontentloaded")
  if (page.url().includes("/login")) {
    throw new Error(
      `Login ADMIN no produjo sesión válida. URL final=${page.url()}. ` +
        "Verifica NEXTAUTH_SECRET y que el seed-e2e haya corrido."
    )
  }

  // 4) Persistir storageState del BrowserContext (cookies + localStorage)
  await page.context().storageState({ path: authFile })
})

export { authFile }