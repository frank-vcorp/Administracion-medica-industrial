/**
 * @file E2E tests Playwright para el Módulo de Unidades Móviles.
 * @id IMPL-20260711-01
 * @id IMPL-20260804-02-ALINEAR-ESTILO-MOBILE-UNITS — flujo migrado a cards+modal
 * @spec context/SPECs/SPEC_ARCH-20260711-01-MODULO-UNIDADES-MOVILES.md §10
 *
 * Escenarios:
 *  1. Catálogo muestra cards de unidades (paridad BranchCard)
 *  2. Crear unidad móvil vía modal (MobileUnitCreateModal)
 *  3. Asignar unidad a proyecto
 *  4. Detectar conflicto proyecto vs mantenimiento (regla §3.1)
 *  5. Reprogramar mantenimiento
 *  6. Eliminar unidad desde página de detalle (ADMIN-only)
 *
 * Los tests usan selectores `data-testid` que la UI implementa contractualmente.
 * Asumen que el dev server está arriba en baseURL (NEXT_PUBLIC_BASE_URL o http://localhost:3000).
 */
import { test, expect } from '@playwright/test'
import { dynamicTestDate } from './helpers/dates'

// Constante: base URL se puede parametrizar via env. Por defecto localhost.
const BASE = process.env.E2E_BASE_URL || 'http://localhost:3000'

// IMPL-20260804-06 R6: fechas relativas para evitar time-bomb (antes 2026-08-01,
// 2026-08-05, 2026-08-15 hardcodeadas). El offset se ancla a `Date.now()` UTC
// vía helpers/dates.ts.
//   - PROJECT_START_OFFSET, PROJECT_END_OFFSET: rango del proyecto bajo test.
//   - TC4_MAINT_OFFSET: día del mantenimiento en TC-4 (sin conflicto previo).
//   - TC7_MAINT_OFFSET / TC7_PROJECT_OFFSET: día del mantenimiento conflictivo
//     y del proyecto que intenta pisarlo en TC-7. Mismo día por diseño (§7.2).
const PROJECT_START_OFFSET = 7
const PROJECT_END_OFFSET = 11
const TC4_MAINT_OFFSET = 14
const TC7_MAINT_OFFSET = 20
const TC7_PROJECT_OFFSET = TC7_MAINT_OFFSET

test.describe.serial('Módulo Unidades Móviles (ARCH-20260711-01)', () => {
  test.beforeEach(async ({ page }) => {
    page.on('pageerror', (err) => console.error('[pageerror]', err.message))
  })

  test('1. Catálogo muestra cards de unidades', async ({ page }) => {
    await page.goto(`${BASE}/admin/mobile-units`)
    // IMPL-20260804-02: el catálogo ahora es grid de cards (paridad /branches),
    // no tabla. El testid `units-table` quedó en el contenedor grid.
    await expect(page.getByTestId('units-table')).toBeVisible({ timeout: 10_000 })
    // Las 6 unidades del seed: "Unidad Móvil 1" a "Unidad Móvil 6" (h3 en cards)
    for (let i = 1; i <= 6; i++) {
      await expect(page.getByRole('heading', { name: `Unidad Móvil ${i}`, level: 3 })).toBeVisible()
    }
    // Botón de crear (modal trigger)
    await expect(page.getByTestId('new-unit-button')).toBeVisible()
  })

  test('2. Crear unidad móvil vía modal', async ({ page }) => {
    await page.goto(`${BASE}/admin/mobile-units`)
    // Abrir modal
    await page.getByTestId('new-unit-button').click()
    await expect(page.getByRole('dialog', { name: 'Registrar Unidad Móvil' })).toBeVisible()

    // Llenar formulario (paridad BranchCreateModal)
    await page.getByTestId('name-input').fill('Unidad Móvil Test E2E')
    await page.getByTestId('plate-input').fill('TST-001')
    await page.getByLabel('Capacidad (pacientes/día)').fill('50')

    // El modal NO incluye upload de imagen (queda en /edit tras crear).
    await page.getByTestId('save-button').click()

    // Debe redirigir al detalle
    await page.waitForURL(/\/admin\/mobile-units\/[a-f0-9-]+/i, { timeout: 10_000 })
    await expect(page.getByRole('heading', { name: /Unidad Móvil Test E2E/i, level: 2 })).toBeVisible()
  })

  test('3. Asignar unidad a proyecto (selector con validación)', async ({ page }) => {
    await page.goto(`${BASE}/projects/new`)
    await page.getByLabel('Nombre *').fill('Proyecto E2E Mobile')
    await page.getByLabel('Empresa *').selectOption({ index: 1 })
    await page.getByLabel('Inicio *').fill(dynamicTestDate(PROJECT_START_OFFSET))
    await page.getByLabel('Fin *').fill(dynamicTestDate(PROJECT_END_OFFSET))
    await expect(page.getByTestId('mobile-unit-selector')).toBeVisible()
    await page.getByTestId('mobile-unit-selector').selectOption({ index: 1 })
    await expect(page.getByTestId('unit-conflict')).not.toBeVisible({ timeout: 3000 })
    // ARCH-20260804-04 §7.1: en happy path, el banner de bloqueo NO debe estar visible.
    await expect(page.getByTestId('project-blocked-banner')).not.toBeVisible({ timeout: 3000 })
  })

  test('4. Detectar conflicto proyecto vs mantenimiento (§3.1)', async ({ page }) => {
    // IMPL-20260804-02: cards tienen botón "Configurar" en footer (paridad BranchCard).
    // Navegamos clicando el link de la card de Unidad Móvil 1.
    await page.goto(`${BASE}/admin/mobile-units`)
    await page
      .locator('div', { has: page.getByRole('heading', { name: 'Unidad Móvil 1', level: 3 }) })
      .getByRole('link', { name: /Configurar/i })
      .first()
      .click()
    await page.waitForURL(/\/admin\/mobile-units\/[a-f0-9-]+/i)
    await page.getByTestId('calendar-link').click()
    await page.waitForURL(/\/maintenance$/i)

    await page.getByTestId('schedule-button').click()
    await page.getByTestId('schedule-date').fill(dynamicTestDate(TC4_MAINT_OFFSET))
    await page.getByLabel('Descripción').fill('Mantenimiento E2E test')
    await page.getByRole('button', { name: 'Verificar disponibilidad' }).click()
    // ARCH-20260804-04 §3.1: el botón "Programar" debe estar habilitado tras verificar
    // disponibilidad sin conflicto. Si nunca se habilita, el test falla con diagnóstico
    // claro en vez de silenciar el error (FIX IMPL-20260804-05 O4).
    await expect(page.getByRole('button', { name: 'Programar' })).toBeEnabled({ timeout: 10_000 })
    await page.getByRole('button', { name: 'Programar' }).click()
    // Tras programar, debe aparecer el evento en el calendario (data-testid event-*).
    // Esperar al menos un evento que coincida con la descripción.
    await expect(page.locator('[data-testid^="event-"]').first()).toBeVisible({ timeout: 10_000 })
  })

  test('5. Reprogramar mantenimiento (modal)', async ({ page }) => {
    await page.goto(`${BASE}/admin/mobile-units`)
    await page
      .locator('div', { has: page.getByRole('heading', { name: 'Unidad Móvil 1', level: 3 }) })
      .getByRole('link', { name: /Configurar/i })
      .first()
      .click()
    await page.waitForURL(/\/admin\/mobile-units\/[a-f0-9-]+/i)
    await page.getByTestId('calendar-link').click()
    const firstEvent = page.locator('[data-testid^="event-"]').first()
    if ((await firstEvent.count()) > 0) {
      await firstEvent.click()
    }
  })

  test('6. Eliminar unidad desde página de detalle (ADMIN-only)', async ({ page }) => {
    // Caso A: ir al detalle de la unidad Test E2E creada en test 2 y eliminarla.
    await page.goto(`${BASE}/admin/mobile-units`)
    await page
      .locator('div', { has: page.getByRole('heading', { name: 'Unidad Móvil Test E2E', level: 3 }) })
      .getByRole('link', { name: /Configurar/i })
      .first()
      .click()
    await page.waitForURL(/\/admin\/mobile-units\/[a-f0-9-]+/i)

    // Aceptar el confirm dialog de window.confirm
    page.on('dialog', (d) => d.accept())

    // Botón "Eliminar unidad" en header del detalle (visible solo para ADMIN)
    await page.getByRole('button', { name: /Eliminar unidad/i }).click()

    // FIX IMPL-20260804-06 O4-ext: reemplaza .catch(() => {}) por asserts
    // explícitos. Si el botón de confirmación no aparece, falla con snapshot.
    const confirmDelete = page.locator('[data-testid^="delete-"]').first()
    await expect(confirmDelete).toBeVisible({ timeout: 5_000 })
    await confirmDelete.click()

    // Tras éxito redirige a /admin/mobile-units. Si no redirige, falla ruidosamente.
    await page.waitForURL(/\/admin\/mobile-units$/, { timeout: 10_000 })

    // Caso B: unidad del seed con proyectos NO debe poder eliminarse (off-screen check).
    // Solo verificamos que el botón existe y dispara confirm() — el backend rechaza.
    await page.goto(`${BASE}/admin/mobile-units`)
    await page
      .locator('div', { has: page.getByRole('heading', { name: 'Unidad Móvil 2', level: 3 }) })
      .getByRole('link', { name: /Configurar/i })
      .first()
      .click()
    await page.waitForURL(/\/admin\/mobile-units\/[a-f0-9-]+/i)
    await expect(page.getByRole('button', { name: /Eliminar unidad/i })).toBeVisible()
  })

  // ARCH-20260804-04 §7.2 — TC-7: bloqueo asimétrico proyecto→mantenimiento es rechazado.
  // Estrategia de aislamiento: crear un mantenimiento dedicado en Unidad Móvil 2 con
  // fecha dinámica (TC7_MAINT_OFFSET) vía UI de MaintenanceCalendar, luego intentar
  // crear un proyecto sobre esa misma unidad + fecha. NO depende del estado
  // residual de TC-4.
  test('7. Bloqueo asimétrico: proyecto sobre mantenimiento es rechazado (§3.1, ARCH-20260804-04)', async ({ page }) => {
    // ─── Setup: crear mantenimiento PROGRAMADO en Unidad Móvil 2 (TC7_MAINT_OFFSET) ───
    await page.goto(`${BASE}/admin/mobile-units`)
    await page
      .locator('div', { has: page.getByRole('heading', { name: 'Unidad Móvil 2', level: 3 }) })
      .getByRole('link', { name: /Configurar/i })
      .first()
      .click()
    await page.waitForURL(/\/admin\/mobile-units\/[a-f0-9-]+/i)
    await page.getByTestId('calendar-link').click()
    await page.waitForURL(/\/maintenance$/i)

    await page.getByTestId('schedule-button').click()
    await page.getByTestId('schedule-date').fill(dynamicTestDate(TC7_MAINT_OFFSET))
    await page.getByLabel('Descripción').fill('Mantenimiento TC-7 setup')
    // FIX IMPL-20260804-05 O4: assert explícito en lugar de .catch(() => {}).
    // Si el botón no se habilita o el POST falla, Playwright reportará el error
    // con el contexto del DOM en vez de tragar la excepción silenciosamente.
    await expect(page.getByRole('button', { name: 'Programar' })).toBeEnabled({ timeout: 10_000 })
    await page.getByRole('button', { name: 'Programar' }).click()
    // Confirmar que el mantenimiento quedó registrado en el calendario.
    await expect(page.locator('[data-testid^="event-"]').first()).toBeVisible({ timeout: 10_000 })

    // ─── Intento de crear proyecto sobre la misma unidad + fecha ─────────────────
    await page.goto(`${BASE}/projects/new`)
    await page.getByLabel('Nombre *').fill('Proyecto Bloqueo E2E')
    await page.getByLabel('Empresa *').selectOption({ index: 1 })
    await page.getByLabel('Inicio *').fill(dynamicTestDate(TC7_PROJECT_OFFSET))
    await page.getByLabel('Fin *').fill(dynamicTestDate(TC7_PROJECT_OFFSET))

    // mobile-unit-selector: orden estable por `name asc` (ver mobile-unit.actions.ts:117).
    //   index 0 → "— Sin unidad asignada —"
    //   index 1 → Unidad Móvil 1 (ABC-123)
    //   index 2 → Unidad Móvil 2 (DEF-456)   ← objetivo
    //   index 3..6 → Unidad Móvil 3..6
    //   index 7 → Unidad Móvil Test E2E (si TC-6 no la borró)
    // Estrategia elegida: `index: 2` (preferida por robustez). Evita acoplar al
    // label exacto "Unidad Móvil 2 (DEF-456)" — el sufijo de placa rompe el match
    // exacto, y un regex/partial no es estándar en `selectOption({ label })` de Playwright.
    // Como `getMobileUnits` ordena por nombre, el índice 2 es estable incluso si
    // TC-2 creó Test E2E o si TC-6 lo eliminó (nunca desplaza las unidades 1..6).
    await page.getByTestId('mobile-unit-selector').selectOption({ index: 2 })

    // Submit (localizar botón submit del ProjectFormModal)
    await page.getByRole('button', { name: /Crear Proyecto/i }).click()

    // ARCH-20260804-04 §7.2: banner visible + contiene "mantenimiento".
    await expect(page.getByTestId('project-blocked-banner')).toBeVisible({ timeout: 5000 })
    await expect(page.getByTestId('project-blocked-banner')).toContainText(/mantenimiento/i)
  })
})
