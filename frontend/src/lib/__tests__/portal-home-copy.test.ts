import { describe, it, expect } from 'vitest'
import { PORTAL_HOME_COPY } from '@/lib/portal-home-copy'

/** F34 — textos fijos del inicio portal; cliente y vista previa comparten este módulo. */
describe('PORTAL_HOME_COPY (F34)', () => {
  it('bienvenida y KPIs usan copy acordado, no el dashboard staff', () => {
    expect(PORTAL_HOME_COPY.title).toBe(
      'Bienvenido a tu software especializado en salud ocupacional',
    )
    expect(PORTAL_HOME_COPY.subtitle).toContain('atendidos, citados y cancelados')
    expect(PORTAL_HOME_COPY.kpi.atendidos).toBe('Atendidos del mes')
    expect(PORTAL_HOME_COPY.kpi.citados).toBe('Citados del mes')
    expect(PORTAL_HOME_COPY.kpi.cancelados).toBe('Cancelados del mes')
    expect(PORTAL_HOME_COPY.title).not.toContain('Tu agenda')
    expect(PORTAL_HOME_COPY.title).not.toContain('nuestra prioridad')
  })
})
