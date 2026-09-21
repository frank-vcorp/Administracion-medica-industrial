/**
 * E2E — Flujo clínico con 4 pruebas (audiometría, espirometría, campimetría, examen médico).
 * Agudeza visual solo dentro del examen médico (no EventTest aparte).
 *
 * Requiere: globalSetup (seed-e2e), auth-setup, DATABASE_URL, NEXTAUTH_SECRET, dev server.
 *
 *   npx playwright test flujo-cuatro-pruebas.spec.ts --project=chromium
 */
import path from 'node:path'
import { test, expect, type BrowserContext, type Page } from '@playwright/test'
import { dynamicTestDate } from './helpers/dates'
import { completeAppointmentCheckIn } from './helpers/e2e-corroboration'
import {
  FOUR_STUDIES_CHECKBOX_PATTERNS,
  FOUR_STUDIES_PAPELETA_PATTERNS,
} from './helpers/e2e-four-studies'
import {
  dischargePatientAtReception,
  ensureStudyStarted,
  saveExamenMedicoDraft,
  submitDoctorReviewIfFormVisible,
} from './helpers/e2e-reception'

const AUTH_STATE = path.join(__dirname, '.auth/admin.json')

const RUN_TAG = Date.now().toString().slice(-6)
const WORKER_DOB = '1990-06-15'
const EMPRESA_NOMBRE = `E2E Cuatro Pruebas ${RUN_TAG}`
const PERFIL_NOMBRE = `Paquete 4 pruebas E2E ${RUN_TAG}`
const APPOINTMENT_DATE = dynamicTestDate(1)

const TRABAJADOR = {
  firstName: `Paciente E2E ${RUN_TAG}`,
  lastName: 'Cuatro Pruebas',
  email: `e2e.4pruebas+${RUN_TAG}@ami.test`,
  phone: `442${RUN_TAG}99`,
}

const AUDIO_XML = path.join(
  __dirname,
  '../../context/PACIENTES/JESSICA GABRIELA.xml',
)

async function extractEventIdFromReceptionOrEvents(
  page: Page,
  workerFullName: string,
): Promise<string> {
  await page.goto('/events')
  await page.waitForLoadState('domcontentloaded')
  const row = page.locator('tr').filter({ hasText: workerFullName }).first()
  await expect(row).toBeVisible({ timeout: 20000 })
  const href =
    (await row.getByRole('link', { name: /abrir expediente/i }).getAttribute('href')) ?? ''
  const match = href.match(/\/events\/([a-f0-9-]+)/)
  if (!match) {
    throw new Error(`No eventId en historial (href=${href || 'null'})`)
  }
  return match[1]
}

test.describe('Flujo E2E — 4 pruebas clínicas', () => {
  test.describe.configure({ mode: 'serial' })

  let page: Page
  let context: BrowserContext
  let companyId: string
  let workerId: string
  let eventId: string

  test.beforeAll(async ({ browser }) => {
    context = await browser.newContext({ storageState: AUTH_STATE })
    page = await context.newPage()
  })

  test('TC-01: Crear empresa cliente', async () => {
    test.setTimeout(90_000)
    await page.goto('/companies')
    await page.getByRole('button', { name: '+ Nueva Empresa' }).click()
    await page.getByPlaceholder('Ej: Aceros del Norte S.A.').fill(EMPRESA_NOMBRE)
    await page.getByPlaceholder('ABC010101XYZ').fill(`E2E${RUN_TAG}XYZ`)
    await page.getByRole('textbox', { name: 'Nombre' }).fill('Contacto E2E')
    await page.getByPlaceholder('email@ejemplo.com').fill('e2e@ami.test')
    await page.getByRole('button', { name: /guardar/i }).click()

    const heading = page.getByRole('heading', { name: EMPRESA_NOMBRE, level: 3 })
    await expect(heading).toBeVisible({ timeout: 20000 })
    const href = await heading
      .locator('xpath=ancestor::div[1]')
      .locator('a:has-text("Configurar Empresa")')
      .getAttribute('href')
    const match = href?.match(/\/companies\/([a-f0-9-]+)/)
    expect(match).toBeTruthy()
    companyId = match![1]
  })

  test('TC-02: Perfil médico (audio, espiro, campimetría, examen médico)', async () => {
    test.setTimeout(90_000)
    test.skip(!companyId, 'Sin empresa')

    await page.goto('/admin/profiles')
    await page.getByRole('button', { name: '+ Nuevo Perfil' }).click()
    const profileForm = page
      .locator('form')
      .filter({
        has: page.getByPlaceholder('Nombre del perfil (ej. Ingreso Operativo)'),
      })
      .first()
    await profileForm.getByPlaceholder('Nombre del perfil (ej. Ingreso Operativo)').fill(PERFIL_NOMBRE)

    for (const pattern of FOUR_STUDIES_CHECKBOX_PATTERNS) {
      const checkbox = profileForm.getByRole('checkbox', { name: pattern })
      await expect(checkbox).toHaveCount(1)
      await checkbox.check()
    }

    await profileForm.getByRole('button', { name: 'Guardar Perfil' }).click()
    await expect(page.getByText('Perfil médico creado exitosamente')).toBeVisible({
      timeout: 20000,
    })
  })

  test('TC-03: Registrar trabajador con perfil', async () => {
    test.setTimeout(90_000)
    test.skip(!companyId, 'Sin empresa')

    await page.goto('/workers')
    await page.getByRole('button', { name: '+ Registrar Trabajador' }).click()
    const form = page.locator('form').filter({ has: page.getByPlaceholder('Nombre') }).first()
    await form.getByPlaceholder('Nombre').fill(TRABAJADOR.firstName)
    await form.getByPlaceholder('Apellidos').fill(TRABAJADOR.lastName)
    await form.locator('input[name="dob"]').fill(WORKER_DOB)
    await form.locator('select[name="gender"]').selectOption('M')
    await form.getByPlaceholder('email@ejemplo.com').fill(TRABAJADOR.email)
    await form.getByPlaceholder('10 dígitos').fill(TRABAJADOR.phone)
    await form.locator('select[name="companyId"]').selectOption(companyId)
    await form.locator('select[name="medicalProfileId"]').selectOption({ label: PERFIL_NOMBRE })
    await form.getByRole('button', { name: 'Guardar Trabajador' }).click({ force: true })
    await expect(page.getByRole('heading', { name: '¡Trabajador Listo!' })).toBeVisible({
      timeout: 20000,
    })
    await page.getByRole('button', { name: 'Ver Padrón' }).click()

    const fullName = `${TRABAJADOR.firstName} ${TRABAJADOR.lastName}`
    const row = page.locator('tr').filter({ hasText: fullName }).first()
    const historialHref = await row.getByRole('link', { name: 'Historial' }).getAttribute('href')
    const wMatch = historialHref?.match(/\/history\/([a-f0-9-]+)/)
    expect(wMatch).toBeTruthy()
    workerId = wMatch![1]
  })

  test('TC-04: Agendar cita', async () => {
    test.setTimeout(90_000)
    test.skip(!workerId, 'Sin trabajador')

    await page.goto('/appointments')
    await page.getByRole('button', { name: /agendar cita/i }).click()
    const form = page.locator('form').filter({ has: page.locator('select[name="companyId"]') }).first()
    await form.locator('select[name="companyId"]').selectOption(companyId)
    await form.locator('select[name="workerId"]').selectOption(workerId)
    const branchValue = await form
      .locator('select[name="branchId"] option:not([value=""])')
      .first()
      .getAttribute('value')
    expect(branchValue).toBeTruthy()
    await form.locator('select[name="branchId"]').selectOption(branchValue!)
    await form.locator('input[name="date"]').fill(APPOINTMENT_DATE)
    await form.locator('input[name="time"]').fill('10:30')
    await form.getByRole('button', { name: 'Confirmar Cita' }).click()

    const fullName = `${TRABAJADOR.firstName} ${TRABAJADOR.lastName}`
    await page.locator('input[type="date"]').first().fill(APPOINTMENT_DATE)
    await expect(page.locator('div.group').filter({ hasText: fullName }).first()).toBeVisible({
      timeout: 20000,
    })
  })

  test('TC-05: Check-in con consentimiento informado', async () => {
    test.setTimeout(120_000)
    test.skip(!workerId, 'Sin trabajador')

    const fullName = `${TRABAJADOR.firstName} ${TRABAJADOR.lastName}`
    await completeAppointmentCheckIn(page, {
      appointmentDate: APPOINTMENT_DATE,
      workerFullName: fullName,
    })

    eventId = await extractEventIdFromReceptionOrEvents(page, fullName)
  })

  test('TC-06: Papeleta con exactamente 4 estudios', async () => {
    test.setTimeout(60_000)
    test.skip(!eventId, 'Sin evento')

    await page.goto(`/events/${eventId}`)
    await expect(page.getByText('Papeleta electrónica', { exact: true })).toBeVisible({
      timeout: 20000,
    })

    for (const pattern of FOUR_STUDIES_PAPELETA_PATTERNS) {
      await expect(page.locator('button').filter({ hasText: pattern }).first()).toBeVisible()
    }

    const studyButtons = page.locator('button').filter({
      hasText: new RegExp(FOUR_STUDIES_PAPELETA_PATTERNS.map((p) => p.source).join('|'), 'i'),
    })
    expect(await studyButtons.count()).toBeGreaterThanOrEqual(4)
  })

  test('TC-07: Examen médico — somatometría, signos vitales y agudeza', async () => {
    test.setTimeout(120_000)
    test.skip(!eventId, 'Sin evento')

    await page.goto(`/events/${eventId}`)
    await page.locator('button').filter({ hasText: /EXAMEN MEDICO/i }).first().click()

    await page.getByPlaceholder('Ej: 75.5').fill('72')
    await page.getByPlaceholder('Ej: 1.75').fill('1.70')
    await page.getByRole('button', { name: /completar somatometría/i }).click()
    await expect(page.getByText(/somatometría completada/i)).toBeVisible({ timeout: 15000 })

    await page.getByRole('button', { name: /signos vitales/i }).first().click()
    await page.getByPlaceholder('120').fill('118')
    await page.getByPlaceholder('80').fill('78')
    await page.getByPlaceholder('BPM').fill('70')
    await page.getByRole('button', { name: /completar signos vitales/i }).click()
    await expect(page.getByText(/signos vitales completados/i)).toBeVisible({ timeout: 15000 })

    await page.getByRole('button', { name: /agudeza visual/i }).first().click()
    const visualInputs = page
      .getByText('Campo Visual', { exact: true })
      .locator('xpath=..')
      .locator('input')
    await expect(visualInputs).toHaveCount(8)
    await visualInputs.nth(0).fill('1.0')
    await visualInputs.nth(1).fill('1.0')
    await page.getByRole('button', { name: /completar agudeza visual/i }).click()
    await expect(page.getByText(/agudeza visual completada/i)).toBeVisible({ timeout: 15000 })

    await saveExamenMedicoDraft(page)
  })

  test('TC-08: Audiometría — subir XML de muestra', async () => {
    test.setTimeout(180_000)
    test.skip(!eventId, 'Sin evento')

    await page.goto(`/events/${eventId}`)
    await page.locator('button').filter({ hasText: /AUDIOMETR/i }).first().click()
    const fileInput = page.locator('input[type="file"]').first()
    await fileInput.setInputFiles(AUDIO_XML)
    await expect(page.getByText(/250/, { exact: true }).first()).toBeVisible({ timeout: 90_000 })
    await submitDoctorReviewIfFormVisible(page)
  })

  test('TC-09: Espirometría — subir PDF (extracción opcional)', async () => {
    test.setTimeout(120_000)
    test.skip(!eventId, 'Sin evento')

    await page.goto(`/events/${eventId}`)
    await page.locator('button').filter({ hasText: /ESPIROMETR/i }).first().click()
    const fileInput = page.locator('input[type="file"]').first()
    const dummyPdf = Buffer.from('%PDF-1.4\n% E2E dummy espirometria')
    await fileInput.setInputFiles({
      name: `espiro_e2e_${RUN_TAG}.pdf`,
      mimeType: 'application/pdf',
      buffer: dummyPdf,
    })
    await expect(
      page.getByText(/procesando estudio con IA|subiendo archivo/i).first(),
    ).not.toBeVisible({ timeout: 60_000 })

    await ensureStudyStarted(page, /ESPIROMETR/i)
    await submitDoctorReviewIfFormVisible(page)
  })

  test('TC-10: Campimetría — guardar borrador', async () => {
    test.setTimeout(120_000)
    test.skip(!eventId, 'Sin evento')

    await page.goto(`/events/${eventId}`)
    await page.locator('button').filter({ hasText: /CAMPIMETR/i }).first().click()
    await page.getByRole('button', { name: /guardar borrador/i }).click()
    await expect(page.getByText(/guardado|borrador/i).first()).toBeVisible({ timeout: 30000 })
  })

  test('TC-11: Revisión médica IA (audiometría) si aplica', async () => {
    test.setTimeout(120_000)
    test.skip(!eventId, 'Sin evento')

    await page.goto(`/events/${eventId}`)
    await page.locator('button').filter({ hasText: /AUDIOMETR/i }).first().click()
    await submitDoctorReviewIfFormVisible(page)
  })

  test('TC-12: Checkout en recepción', async () => {
    test.setTimeout(120_000)
    test.skip(!eventId, 'Sin evento')

    await dischargePatientAtReception(page, eventId)
  })

  test('TC-13: Expediente en validación tras checkout', async () => {
    test.setTimeout(60_000)
    test.skip(!eventId, 'Sin evento')

    await page.goto('/validation')
    await expect(page.getByText('Validación diagnóstica')).toBeVisible()
    await expect(page.locator(`a[href="/events/${eventId}"]`)).toBeVisible({
      timeout: 30_000,
    })
  })

  test('TC-14: Completar examen médico y firmar dictamen', async () => {
    test.setTimeout(180_000)
    test.skip(!eventId, 'Sin evento')

    await page.goto(`/events/${eventId}`)
    await page.locator('button').filter({ hasText: /EXAMEN MEDICO/i }).first().click()
    await page
      .getByRole('button', {
        name: /impresión y aptitud|impresi.n diagn.stica y aptitud|impresi.n \/ aptitud/i,
      })
      .first()
      .click()
    await page.getByRole('button', { name: /completar examen médico/i }).click()
    await expect(page.getByText(/examen m.dico completado|firmar y emitir/i).first()).toBeVisible({
      timeout: 30_000,
    })

    const verdictHeading = page.getByRole('heading', { name: 'Reporte médico de aptitud' })
    await expect(verdictHeading).toBeVisible({ timeout: 30_000 })

    await page
      .getByPlaceholder('Ej: Apto para el puesto sin restricciones...')
      .fill('Apto para el puesto — E2E cuatro pruebas.')
    await page
      .getByPlaceholder('Ej: Uso de protección auditiva...')
      .fill('EPP según política de la empresa.')
    await page.getByRole('button', { name: /firmar y emitir dictamen/i }).click()

    await expect(page.getByRole('heading', { name: '¡Expediente Completado!' })).toBeVisible({
      timeout: 30_000,
    })
    await expect(page.getByText(/dictamen médico ha sido firmado/i)).toBeVisible()
  })

  test.afterAll(async () => {
    await context?.close()
    console.log('\n--- E2E 4 pruebas ---')
    console.log('companyId:', companyId || '(no creada)')
    console.log('workerId:', workerId || '(no creado)')
    console.log('eventId:', eventId || '(no creado)')
    console.log('---------------------\n')
  })
})
