/**
 * @file Tests focales (V1) para `shouldRenderEventFlowController`.
 *
 *   Helper puro que centraliza la regla de visibilidad del
 *   `EventFlowController` en `frontend/src/app/events/[id]/page.tsx`.
 *
 *   Patrón seguido: igual a `src/lib/__tests__/dictamen-pdf.test.ts`
 *   (vitest directo, sin DOM ni Next runtime).
 *
 * @id IMPL-20260826-03 (FIX pantalla blanca post-firma, Frank 2026-08-26)
 *
 * Cubre (matriz mínima):
 *   - REGRESIÓN post-firma: status=COMPLETED + activeView=VALIDATING
 *     (URL desincronizada) → true (era false → pantalla blanca).
 *   - IN_PROGRESS → false en todos los casos (workspace ocupa el área).
 *   - status=COMPLETED + activeView=COMPLETED → true (legacy).
 *   - status=COMPLETED + activeView=CHECKED_IN/IN_PROGRESS/SCHEDULED
 *     → false (usuario navegó deliberadamente hacia atrás).
 *   - Cualquier otro status con activeView=event.status → true (legacy).
 *   - activeView undefined → false salvo que el status sea COMPLETED.
 */
import { describe, it, expect } from 'vitest'

import { shouldRenderEventFlowController } from '../event-flow-visibility'

describe('IMPL-20260826-03: shouldRenderEventFlowController', () => {
  // ─── REGRESIÓN principal: pantalla blanca post-firma ──────────────────
  it('REGRESIÓN: status=COMPLETED + activeView=VALIDATING → true (FIX)', () => {
    // Caso reportado por Frank 2026-08-26: tras firmar el dictamen,
    // `event.status` pasa a COMPLETED pero la URL conserva
    // `?view=VALIDATING` (la server action no navega). El check antiguo
    // `activeView === event.status` daba false → pantalla blanca.
    expect(shouldRenderEventFlowController('VALIDATING', 'COMPLETED')).toBe(true)
  })

  // ─── IN_PROGRESS nunca renderiza el Flow Controller ──────────────────
  it('IN_PROGRESS + activeView=IN_PROGRESS → false (workspace ocupa el área)', () => {
    expect(shouldRenderEventFlowController('IN_PROGRESS', 'IN_PROGRESS')).toBe(false)
  })

  it('IN_PROGRESS + cualquier activeView → false', () => {
    expect(shouldRenderEventFlowController('VALIDATING', 'IN_PROGRESS')).toBe(false)
    expect(shouldRenderEventFlowController('CHECKED_IN', 'IN_PROGRESS')).toBe(false)
    expect(shouldRenderEventFlowController(undefined, 'IN_PROGRESS')).toBe(false)
  })

  // ─── Legacy preservado: activeView === event.status → true ─────────────
  it('status=COMPLETED + activeView=COMPLETED → true (legacy)', () => {
    expect(shouldRenderEventFlowController('COMPLETED', 'COMPLETED')).toBe(true)
  })

  it('status=VALIDATING + activeView=VALIDATING → true (legacy)', () => {
    expect(shouldRenderEventFlowController('VALIDATING', 'VALIDATING')).toBe(true)
  })

  it('status=CHECKED_IN + activeView=CHECKED_IN → true (legacy)', () => {
    expect(shouldRenderEventFlowController('CHECKED_IN', 'CHECKED_IN')).toBe(true)
  })

  it('status=SCHEDULED + activeView=SCHEDULED → true (legacy)', () => {
    expect(shouldRenderEventFlowController('SCHEDULED', 'SCHEDULED')).toBe(true)
  })

  // ─── COMPLETED con activeView distinto a VALIDATING → false ────────────
  it('status=COMPLETED + activeView=CHECKED_IN → false (usuario navegó hacia atrás)', () => {
    expect(shouldRenderEventFlowController('CHECKED_IN', 'COMPLETED')).toBe(false)
  })

  it('status=COMPLETED + activeView=IN_PROGRESS → false (workspace de papeleta)', () => {
    expect(shouldRenderEventFlowController('IN_PROGRESS', 'COMPLETED')).toBe(false)
  })

  it('status=COMPLETED + activeView=SCHEDULED → false', () => {
    expect(shouldRenderEventFlowController('SCHEDULED', 'COMPLETED')).toBe(false)
  })

  // ─── Otros status: sin match de activeView → false ─────────────────────
  it('status=VALIDATING + activeView=CHECKED_IN → false (navegó hacia atrás)', () => {
    expect(shouldRenderEventFlowController('CHECKED_IN', 'VALIDATING')).toBe(false)
  })

  it('status=CHECKED_IN + activeView=IN_PROGRESS → false', () => {
    expect(shouldRenderEventFlowController('IN_PROGRESS', 'CHECKED_IN')).toBe(false)
  })

  // ─── activeView undefined (defensa) ───────────────────────────────────
  it('status=COMPLETED + activeView=undefined → false (URL vacía)', () => {
    expect(shouldRenderEventFlowController(undefined, 'COMPLETED')).toBe(false)
  })

  it('status=VALIDATING + activeView=undefined → false', () => {
    expect(shouldRenderEventFlowController(undefined, 'VALIDATING')).toBe(false)
  })

  // ─── Matriz de verdad para documentación rápida ───────────────────────
  const matrix: Array<[string | undefined, string, boolean, string]> = [
    ['COMPLETED', 'COMPLETED', true, 'legacy match'],
    ['VALIDATING', 'COMPLETED', true, 'FIX post-firma (pantalla blanca)'],
    ['CHECKED_IN', 'COMPLETED', false, 'COMPLETED no es workspace pero ya no está firmando'],
    ['IN_PROGRESS', 'COMPLETED', false, 'COMPLETED + workspace de papeleta'],
    ['SCHEDULED', 'COMPLETED', false, 'COMPLETED + stepper pre-examen'],
    ['VALIDATING', 'VALIDATING', true, 'legacy match'],
    ['IN_PROGRESS', 'IN_PROGRESS', false, 'IN_PROGRESS NUNCA renderiza'],
    ['CHECKED_IN', 'CHECKED_IN', true, 'legacy match'],
    ['SCHEDULED', 'SCHEDULED', true, 'legacy match'],
    [undefined, 'COMPLETED', false, 'defensa sin URL'],
  ]

  it.each(matrix)(
    'shouldRenderEventFlowController(%j, %j) === %j — %s',
    (activeView, status, expected) => {
      expect(shouldRenderEventFlowController(activeView, status)).toBe(expected)
    },
  )
})
