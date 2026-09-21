import { expect, type Page } from '@playwright/test'

/** Trazo mínimo en el lienzo de firma del consentimiento (paso 2). */
export async function drawInformedConsentSignature(page: Page): Promise<void> {
  const canvas = page.locator('.border-dashed.border-violet-200 canvas').first()
  await expect(canvas).toBeVisible({ timeout: 15000 })
  const box = await canvas.boundingBox()
  if (!box) throw new Error('No se pudo medir el canvas de firma')
  const startX = box.x + box.width * 0.2
  const startY = box.y + box.height * 0.55
  const endX = box.x + box.width * 0.75
  await page.mouse.move(startX, startY)
  await page.mouse.down()
  await page.mouse.move(endX, startY, { steps: 12 })
  await page.mouse.up()
}

/**
 * Check-in con corroboración (paso 1 INE + paso 2 consentimiento firmado).
 * Deja al usuario en /reception tras éxito.
 */
export async function completeAppointmentCheckIn(
  page: Page,
  opts: { appointmentDate: string; workerFullName: string },
): Promise<void> {
  await page.goto('/appointments')
  await page.waitForLoadState('domcontentloaded')
  await page.locator('input[type="date"]').first().fill(opts.appointmentDate)

  const appointmentCard = page.locator('div.group').filter({ hasText: opts.workerFullName }).first()
  await expect(appointmentCard).toBeVisible({ timeout: 20000 })
  await appointmentCard.locator('button[title="Check-in"]').click()

  const modal = page
    .locator('div.fixed.inset-0')
    .filter({ has: page.getByRole('heading', { name: 'Corroboración de Identidad' }) })
    .first()
  await expect(modal).toBeVisible()

  const dummyFile = Buffer.from('dummy INE e2e')
  await modal.locator('input[type="file"]').first().setInputFiles({
    name: 'ine_e2e.jpg',
    mimeType: 'image/jpeg',
    buffer: dummyFile,
  })

  await modal.getByRole('button', { name: /continuar al consentimiento/i }).click()
  await expect(page.getByRole('heading', { name: 'Consentimiento Informado' })).toBeVisible({
    timeout: 15000,
  })

  await drawInformedConsentSignature(page)
  await modal.getByRole('button', { name: /firmar y hacer check-in/i }).click()

  await page.waitForURL(/\/reception/, { timeout: 30000 })
}
