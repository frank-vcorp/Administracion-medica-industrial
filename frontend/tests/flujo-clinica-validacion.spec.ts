import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

type E2EFixtures = {
  checkoutEventId: string
  checkoutWorkerId: string
}

function loadFixtures(): E2EFixtures {
  const file = path.join(__dirname, '.auth/e2e-fixtures.json')
  return JSON.parse(fs.readFileSync(file, 'utf8')) as E2EFixtures
}

test.describe('SPEC ARCH-20260921-01 — Clínica · checkout · encuesta · validación', () => {
  test.describe.configure({ mode: 'serial' })
  test('recepción muestra kanban de 3 columnas', async ({ page }) => {
    await page.goto('/reception')
    await expect(page.getByRole('heading', { name: 'En sala de espera' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'En proceso' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Listo para checkout' })).toBeVisible()
  })

  test('validación muestra etapas V1/V2/V3', async ({ page }) => {
    await page.goto('/validation')
    await expect(page.getByText('Validación diagnóstica')).toBeVisible()
    await expect(page.getByText('En espera de resultados')).toBeVisible()
    await expect(page.getByText('En espera de diagnóstico por estudio')).toBeVisible()
    await expect(page.getByText('En espera de dictamen final')).toBeVisible()
  })

  test('panel de satisfacción carga KPIs', async ({ page }) => {
    await page.goto('/reports/satisfaction')
    await expect(page.getByText('Satisfacción del paciente')).toBeVisible()
    await expect(page.getByText('Respuestas')).toBeVisible()
  })

  test('encuesta AMI — envío completo', async ({ page }) => {
    test.setTimeout(60000)
    const { checkoutEventId } = loadFixtures()
    await page.goto(`/feedback/satisfaction?event=${checkoutEventId}&mode=kiosk`)

    await expect(page.getByTestId('ami-satisfaction-form')).toBeVisible({ timeout: 15000 })
    await page.getByTestId('satisfaction-turno').fill('Matutino E2E')

    const form = page.getByTestId('ami-satisfaction-form')
    const pickScore = async (legend: string) => {
      const field = form.getByRole('group', { name: legend })
      await field.getByRole('button', { name: '5 de 5' }).click()
    }

    await pickScore('Satisfacción general')
    await pickScore('Trato — respeto y amabilidad')
    await pickScore('Trato — escucha')
    await pickScore('Solución — resolución clara')
    await pickScore('Solución — tiempo de espera')
    await pickScore('Espacio — limpieza')
    await pickScore('Espacio — privacidad')
    await pickScore('¿Recomendarías nuestros servicios?')

    await page.getByTestId('satisfaction-submit').click()
    await expect(page.getByText('¡Gracias por tu opinión!')).toBeVisible({ timeout: 15000 })
  })

  test('checkout en recepción — modal y confirmar salida', async ({ page }) => {
    const { checkoutEventId } = loadFixtures()

    await page.goto('/reception')
    const checkoutOpen = page.getByTestId(`reception-checkout-open-${checkoutEventId.slice(0, 8)}`)

    await expect(checkoutOpen).toBeVisible({ timeout: 15000 })
    await checkoutOpen.click()

    await expect(page.getByTestId('reception-checkout-tablet')).toBeVisible()
    await expect(page.getByTestId('reception-checkout-confirm')).toBeVisible()
    await page.getByTestId('reception-checkout-confirm').click()

    await expect(checkoutOpen).toHaveCount(0, { timeout: 15000 })
  })

  test('post-checkout — expediente visible en validación', async ({ page }) => {
    const { checkoutEventId } = loadFixtures()
    await page.goto('/validation')
    await expect(page.getByRole('link', { name: 'Revisar' }).first()).toBeVisible({ timeout: 15000 })
    await expect(page.locator(`a[href="/events/${checkoutEventId}"]`)).toBeVisible()
  })
})
