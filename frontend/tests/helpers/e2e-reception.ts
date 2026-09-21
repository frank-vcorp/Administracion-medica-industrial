import { expect, type Page } from '@playwright/test'

/** Checkout en recepción (SPEC ARCH-20260921-01 §4.4). */
export async function dischargePatientAtReception(page: Page, eventId: string): Promise<void> {
  await page.goto('/reception')
  await page.waitForLoadState('domcontentloaded')

  const checkoutOpen = page.getByTestId(`reception-checkout-open-${eventId.slice(0, 8)}`)
  await expect(checkoutOpen).toBeVisible({ timeout: 90_000 })
  await checkoutOpen.click()

  await expect(page.getByTestId('reception-checkout-tablet')).toBeVisible()
  await page.getByTestId('reception-checkout-confirm').click()
  await expect(checkoutOpen).toHaveCount(0, { timeout: 30_000 })
}

/** Paso 1 de checkout: marca el estudio como iniciado si sigue en PENDING. */
export async function ensureStudyStarted(page: Page, studyPattern: RegExp): Promise<void> {
  await page.locator('button').filter({ hasText: studyPattern }).first().click()
  const iniciar = page.getByRole('button', { name: /iniciar proceso/i })
  if (await iniciar.isVisible().catch(() => false)) {
    await iniciar.click()
    await expect(iniciar).toHaveCount(0, { timeout: 15_000 })
  }
}

/** Guarda borrador del examen médico (aptitud) sin pasar el evento a VALIDATING. */
export async function saveExamenMedicoDraft(page: Page): Promise<void> {
  await page
    .getByRole('button', {
      name: /impresión y aptitud|impresi.n diagn.stica y aptitud|impresi.n \/ aptitud/i,
    })
    .first()
    .click()
  await page.getByRole('button', { name: /guardar borrador/i }).first().click()
  await expect(
    page.getByText(/borrador guardado|examen m.dico guardado/i).first(),
  ).toBeVisible({ timeout: 30_000 })
}

/** Revisión médica obligatoria cuando el panel IA está visible. */
export async function submitDoctorReviewIfFormVisible(page: Page): Promise<void> {
  const form = page.getByRole('heading', { name: 'Revisión médica obligatoria' })
  if (!(await form.isVisible().catch(() => false))) return

  const diagnosis = page.locator('textarea').first()
  if ((await diagnosis.inputValue()).trim().length === 0) {
    await diagnosis.fill('Hallazgo E2E — sin alteraciones relevantes.')
  }
  await page.getByRole('button', { name: /guardar revisión médica/i }).click()
  await expect(form).toHaveCount(0, { timeout: 60_000 })
}
