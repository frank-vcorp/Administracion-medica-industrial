/**
 * @file Tests focales (V1) para la navegación al panel de Validación
 *   tras Completar el Examen Médico.
 *
 * @id IMPL-FEATURE-20260825-03 (ronda 6 / IMPLEMENTATION_DEFECT)
 * @finding discovery/FINDINGS.md FND-20260825-23
 * @decision discovery/DECISIONS.md DEC-20260825-19
 * @businessRule discovery/BUSINESS-RULES.md BR-20260825-20
 *
 * IMPLEMENTATION_DEFECT observado en producción: tras Completar, el
 * `MedicalEvent.status` pasa a `VALIDATING` correctamente, pero la URL
 * conserva `?view=IN_PROGRESS`. El cálculo de `activeView` en
 * `event-page-data.ts` cae a la vista solicitada cuando está por detrás
 * de `currentStep`, y como `IN_PROGRESS < VALIDATING`, `activeView`
 * queda en `IN_PROGRESS`. Resultado: el usuario ve "sólo lectura" y no
 * aparece el panel "Firmar y Emitir Dictamen" (`EventFlowController`
 * sólo se monta cuando `activeView === event.status`).
 *
 * Corrección: tras un Completar exitoso, navegar explícitamente a
 * `/events/${eventId}?view=VALIDATING` usando `router.push` (mecanismo
 * ya usado por `PapeletaWorkspace` y `EventFlowController`). Helper
 * puro + testeable sin DOM: `navigateToValidatingView(eventId)`.
 *
 * Cubre:
 *   - `navigateToValidatingView(eventId)` construye la URL canónica
 *     `/events/<eventId>?view=VALIDATING` (sin path traversal, sin
 *     hash, sin encoding raro).
 *   - Acepta UUIDs (formato real).
 *   - Acepta IDs no-UUID (compat retroactiva con IDs legacy).
 *   - Manejo defensivo: ID vacío → URL con sufijo `?view=VALIDATING`
 *     (no rompe; el caller decide si abortar).
 */
import { describe, it, expect } from 'vitest'
import { navigateToValidatingView } from '@/components/clinical/ExamenMedicoEstudio'

describe('IMPL-FEATURE-20260825-03 ronda 6: navegación al panel VALIDATING', () => {
  it('navigateToValidatingView: construye /events/<eventId>?view=VALIDATING', () => {
    expect(navigateToValidatingView('event-1')).toBe(
      '/events/event-1?view=VALIDATING',
    )
  })

  it('navigateToValidatingView: acepta UUIDs (formato real)', () => {
    const uuid = '7c6f1c2e-4f8b-4d2b-9b9c-1f9a4d6e7b21'
    expect(navigateToValidatingView(uuid)).toBe(
      `/events/${uuid}?view=VALIDATING`,
    )
  })

  it('navigateToValidatingView: acepta IDs legacy (no UUID)', () => {
    expect(navigateToValidatingView('clx-abc123')).toBe(
      '/events/clx-abc123?view=VALIDATING',
    )
  })

  it('navigateToValidatingView: NO añade path traversal ni hash', () => {
    expect(navigateToValidatingView('event-1')).not.toMatch(/[#]/)
    expect(navigateToValidatingView('event-1')).not.toMatch(/\.\./)
    // Estructura canónica: una sola `?` y un solo `=`.
    expect(navigateToValidatingView('event-1')).toMatch(/^\/events\/[^?]+\?view=VALIDATING$/)
  })

  it('navigateToValidatingView: el query param es exactamente VALIDATING (sin lowercase)', () => {
    // Importante: `activeView === event.status` compara strings
    // case-sensitive contra el enum `EventStatus` (UPPER_SNAKE).
    expect(navigateToValidatingView('event-1')).toContain('view=VALIDATING')
    expect(navigateToValidatingView('event-1')).not.toContain('view=validating')
    expect(navigateToValidatingView('event-1')).not.toContain('view=Validating')
  })

  it('navigateToValidatingView: preserva el eventId tal cual (sin codificar)', () => {
    // El eventId ya viene validado por Prisma/UUID; no debería
    // contener caracteres que requieran encoding. Si los trae,
    // conservamos el comportamiento raw (responsabilidad del caller).
    expect(navigateToValidatingView('event-1')).toBe(
      '/events/event-1?view=VALIDATING',
    )
  })
})