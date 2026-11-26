import { describe, expect, it, vi } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

vi.mock('@/actions/portal-worker.actions', () => ({
  quickRegisterPortalWorkers: vi.fn(),
}))

import PortalQuickWorkerRegister from '@/components/portal/PortalQuickWorkerRegister'

describe('PortalQuickWorkerRegister', () => {
  it('no renderiza <form> anidado y usa button type="button" al abrirse', () => {
    const html = renderToStaticMarkup(
      createElement(PortalQuickWorkerRegister, {
        branchId: '11111111-1111-1111-1111-111111111111',
        date: '2026-11-26',
        time: '09:00',
        serviceProfileId: null,
        slots: [{ hour: 9, count: 0, capacity: 10, full: false }],
        slotsLoading: false,
        defaultOpen: true,
        onWorkersCreated: vi.fn(),
        onSelectTime: vi.fn(),
      }),
    )

    expect(html.toLowerCase()).not.toContain('<form')
    expect(html).toContain('role="region"')
    expect(html).toContain('Guardar trabajadores')
    expect(html).toMatch(/<button[^>]*type="button"[^>]*>Guardar trabajadores<\/button>/)
  })

  it('muestra aviso de carga mientras slotsLoading es true en vez de marcar horario lleno', () => {
    const html = renderToStaticMarkup(
      createElement(PortalQuickWorkerRegister, {
        branchId: '11111111-1111-1111-1111-111111111111',
        date: '2026-11-26',
        time: '09:00',
        serviceProfileId: null,
        slots: [],
        slotsLoading: true,
        defaultOpen: false,
        onWorkersCreated: vi.fn(),
        onSelectTime: vi.fn(),
      }),
    )

    expect(html).toContain('Consultando cupo del horario')
    expect(html).not.toContain('no tiene cupo')
  })
})
