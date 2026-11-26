import { describe, expect, it, vi } from 'vitest'
import { createElement, type ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

vi.mock('next/link', () => ({
  default: ({
    href,
    children,
    ...rest
  }: {
    href: string
    children?: ReactNode
    className?: string
  }) => createElement('a', { href, ...rest }, children),
}))

import PortalHomeDashboard from '@/components/portal/PortalHomeDashboard'
import { PORTAL_HOME_COPY } from '@/lib/portal-home-copy'

const SAMPLE_MONTHS = [
  { monthKey: '2026-01', label: 'ene 2026', attendedCount: 0 },
  { monthKey: '2026-02', label: 'feb 2026', attendedCount: 4 },
  { monthKey: '2026-03', label: 'mar 2026', attendedCount: 7 },
]

describe('PortalHomeDashboard', () => {
  it('renderiza empresa, copy F34, los 6 KPIs, gráfica y accesos clave integrados', () => {
    const html = renderToStaticMarkup(
      createElement(PortalHomeDashboard, {
        companyName: 'Systron Industrial',
        workersCount: 42,
        totalAttended12m: 11,
        proximasCitadas: 5,
        canceladas12m: 1,
        completedEvents: 8,
        inProgressEvents: 3,
        months: SAMPLE_MONTHS,
      }),
    )

    expect(html).toContain('Systron Industrial')
    expect(html).toContain(PORTAL_HOME_COPY.eyebrow)
    expect(html).toContain(PORTAL_HOME_COPY.title)
    expect(html).toContain(PORTAL_HOME_COPY.subtitle)
    expect(html).toContain(PORTAL_HOME_COPY.kpi.colaboradores)
    expect(html).toContain(PORTAL_HOME_COPY.kpi.atendidos)
    expect(html).toContain(PORTAL_HOME_COPY.kpi.citados)
    expect(html).toContain(PORTAL_HOME_COPY.kpi.cancelados)
    expect(html).toContain(PORTAL_HOME_COPY.kpi.expedientesCompletados)
    expect(html).toContain(PORTAL_HOME_COPY.kpi.enProceso)
    expect(html).toContain('42')
    expect(html).toContain('11 en 12 meses')
    expect(html).toContain('ene 2026')
    expect(html).toContain('mar 2026')
    expect(html).toContain('Estado de expedientes')
    expect(html).toContain('href="/portal/events"')
    expect(html).toContain('href="/portal/appointments/new"')
    expect(html).toContain('href="/portal/workers"')
  })

  it('muestra aviso amigable cuando totalAttended12m es 0 y omite estado si falta', () => {
    const html = renderToStaticMarkup(
      createElement(PortalHomeDashboard, {
        companyName: 'Empresa Nueva',
        workersCount: 0,
        totalAttended12m: 0,
        proximasCitadas: null,
        canceladas12m: null,
        completedEvents: null,
        inProgressEvents: null,
        months: [{ monthKey: '2026-11', label: 'nov 2026', attendedCount: 0 }],
      }),
    )

    expect(html).toContain('Aún no hay atenciones registradas en los últimos 12 meses.')
    expect(html).not.toContain('Estado de expedientes')
  })
})
