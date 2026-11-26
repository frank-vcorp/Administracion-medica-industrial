import { describe, expect, it, vi } from 'vitest'
import {
  buildPapeletaUrl,
  examenMedicoNavSectionFromTabs,
  parseExamenMedicoNavSection,
  patchPapeletaSearchParams,
  replacePapeletaQuery,
  resolveActiveEventTestAfterRefresh,
} from '@/lib/clinical/papeleta-navigation'

describe('papeleta-navigation', () => {
  it('parsea inner tab como bloque clínico', () => {
    expect(parseExamenMedicoNavSection('extension')).toEqual({
      outerTab: 'examen_medico',
      innerTab: 'extension',
    })
  })

  it('parsea outer tab', () => {
    expect(parseExamenMedicoNavSection('signos_vitales')).toEqual({
      outerTab: 'signos_vitales',
      innerTab: 'antecedentes',
    })
  })

  it('serializa pestaña activa para URL', () => {
    expect(
      examenMedicoNavSectionFromTabs('examen_medico', 'impresion'),
    ).toBe('impresion')
    expect(examenMedicoNavSectionFromTabs('agudeza_visual', 'antecedentes')).toBe(
      'agudeza_visual',
    )
  })

  it('patch mantiene view y actualiza eventTest', () => {
    const base = new URLSearchParams('view=IN_PROGRESS&foo=1')
    const next = patchPapeletaSearchParams(base, {
      eventTest: 'abc-123',
      emSection: 'extension',
    })
    expect(next.get('view')).toBe('IN_PROGRESS')
    expect(next.get('foo')).toBe('1')
    expect(next.get('eventTest')).toBe('abc-123')
    expect(next.get('emSection')).toBe('extension')
  })

  it('buildPapeletaUrl cambia el estudio y conserva view', () => {
    expect(
      buildPapeletaUrl('/events/evt-1', '?view=IN_PROGRESS&eventTest=old', {
        eventTest: 'new-id',
      }),
    ).toBe('/events/evt-1?view=IN_PROGRESS&eventTest=new-id')
  })

  it('resolveActiveEventTestAfterRefresh prioriza URL del navegador', () => {
    const valid = new Set(['consulta-id', 'nuevo-id'])
    expect(
      resolveActiveEventTestAfterRefresh('nuevo-id', true, valid),
    ).toBe('nuevo-id')
  })

  it('resolveActiveEventTestAfterRefresh respeta vista resumen (param ausente)', () => {
    const valid = new Set(['consulta-id'])
    expect(resolveActiveEventTestAfterRefresh(null, false, valid)).toBe(null)
  })

  it('resolveActiveEventTestAfterRefresh ignora id inválido tras refresh', () => {
    const valid = new Set(['consulta-id'])
    expect(
      resolveActiveEventTestAfterRefresh('desconocido', true, valid),
    ).toBeUndefined()
  })

  it('resolveActiveEventTestAfterRefresh conserva estudio activo si Next limpia query tras revalidatePath', () => {
    const valid = new Set(['certificado-id', 'consulta-id'])
    expect(
      resolveActiveEventTestAfterRefresh(null, false, valid, 'certificado-id'),
    ).toBe('certificado-id')
    expect(
      resolveActiveEventTestAfterRefresh(null, false, valid, 'eliminado-id'),
    ).toBe(null)
  })

  it('replacePapeletaQuery pasa null en history.state para no propagar __NA de Next 16', () => {
    const replaceState = vi.fn()
    vi.stubGlobal('window', {
      location: {
        pathname: '/events/evt-1',
        search: '?view=IN_PROGRESS&eventTest=campi-id',
      },
      history: {
        state: { __NA: true, __PRIVATE_NEXTJS_INTERNALS_TREE: ['mock-tree'] },
        replaceState,
      },
    })
    try {
      replacePapeletaQuery({ eventTest: 'espiro-id' })
      expect(replaceState).toHaveBeenCalledTimes(1)
      expect(replaceState).toHaveBeenCalledWith(
        null,
        '',
        '/events/evt-1?view=IN_PROGRESS&eventTest=espiro-id',
      )
    } finally {
      vi.unstubAllGlobals()
    }
  })
})
