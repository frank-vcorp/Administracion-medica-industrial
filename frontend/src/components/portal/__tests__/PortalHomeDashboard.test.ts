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
  it('renderiza empresa, copy F34, los 6 KPIs, gráfica, próximas citas y dictámenes', () => {
    const html = renderToStaticMarkup(
      createElement(PortalHomeDashboard, {
        companyName: 'Systron Industrial',
        workersCount: 42,
        totalAttended12m: 11,
        proximasCitadas: 5,
        canceladas12m: 1,
        completedEvents: 8,
        inProgressEvents: 3,
        aptos: 7,
        noAptos: 1,
        upcomingAppointments: [
          {
            id: 'apt-1',
            expedientId: 'EXP-2026044',
            scheduledAt: '2026-11-26T15:00:00.000Z',
            status: 'CONFIRMED',
            workerId: 'w-1',
            workerName: 'Juan Pérez',
            branchName: 'Colonia del Prado',
            profileName: 'Perfil Operativo',
            prefillStatus: 'SUBMITTED',
          },
        ],
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
    expect(html).toContain('Pico: 7/mes')
    expect(html).toContain('ene 2026')
    expect(html).toContain('mar 2026')
    expect(html).toContain('Próximas citas')
    expect(html).toContain('Juan Pérez')
    expect(html).toContain('href="/portal/workers/w-1"')
    expect(html).toContain('Colonia del Prado')
    expect(html).toContain('Prellenado listo')
    expect(html).toContain('Estado de expedientes')
    expect(html).toContain('Resolución de dictámenes')
    expect(html).toContain('Aptos')
    expect(html).toContain('No cumple')
    expect(html).toContain('href="/portal/events"')
    expect(html).toContain('href="/portal/appointments/new"')
  })

  it('muestra estado vacío sin ceros flotantes, guía de 4 pasos cuando no hay expedientes y omite estado si falta', () => {
    const emptyMonths = Array.from({ length: 12 }, (_, idx) => ({
      monthKey: `2026-${String(idx + 1).padStart(2, '0')}`,
      label: `m${idx + 1} 2026`,
      attendedCount: 0,
    }))

    const withZeroExpedientes = renderToStaticMarkup(
      createElement(PortalHomeDashboard, {
        companyName: 'Empresa Nueva',
        workersCount: 1,
        totalAttended12m: 0,
        proximasCitadas: 1,
        canceladas12m: 0,
        completedEvents: 0,
        inProgressEvents: 0,
        months: emptyMonths,
      }),
    )

    expect(withZeroExpedientes).toContain(
      'Aún no hay atenciones registradas en los últimos 12 meses.',
    )
    expect(withZeroExpedientes).toContain('Agendar primera cita →')
    expect(withZeroExpedientes).toContain('Colaboradores registrados')
    expect(withZeroExpedientes).toContain('1 en padrón')
    expect(withZeroExpedientes).toContain('Citas programadas')
    expect(withZeroExpedientes).toContain('1 próxima(s)')
    expect(withZeroExpedientes).toContain('Atención en clínica')
    expect(withZeroExpedientes).toContain('Dictámenes disponibles')
    expect(withZeroExpedientes).toContain('Sin citas programadas por el momento.')

    const withoutStats = renderToStaticMarkup(
      createElement(PortalHomeDashboard, {
        companyName: 'Empresa Nueva',
        workersCount: 0,
        totalAttended12m: 0,
        proximasCitadas: null,
        canceladas12m: null,
        completedEvents: null,
        inProgressEvents: null,
        months: emptyMonths,
      }),
    )

    expect(withoutStats).not.toContain('Estado de expedientes')
  })
})
