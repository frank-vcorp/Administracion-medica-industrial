import { describe, expect, it } from 'vitest'
import {
  antecedentesCapturedIsEmpty,
  antecedentesSnapshotComparable,
  mergeExamAntecedentesPrefill,
  mergePortalPrefillIntoAntecedentes,
} from '@/lib/clinical/prefill-portal-merge'

describe('mergePortalPrefillIntoAntecedentes', () => {
  it('rellena secciones vacías sin pisar captura existente', () => {
    const merged = mergePortalPrefillIntoAntecedentes(
      { datos_personales: { puesto_actual: 'Capturado' } },
      { datos_personales: { puesto_actual: 'Portal', turno: 'MATUTINO' } },
    )
    expect(merged.datos_personales).toEqual({ puesto_actual: 'Capturado' })
  })
})

describe('mergeExamAntecedentesPrefill (SME-111)', () => {
  it('mezcla longitudinal y portal con prioridad del snapshot persistido', () => {
    const merged = mergeExamAntecedentesPrefill(
      { datos_personales: { puesto_actual: 'Staff' } },
      { datos_personales: { puesto_actual: 'Historial', area_departamento: 'Planta' } },
      { patologicos: { asma: { estado: 'SI' } } },
    )
    expect(merged.datos_personales).toMatchObject({
      puesto_actual: 'Staff',
      area_departamento: 'Planta',
    })
    expect(merged.patologicos).toEqual({ asma: { estado: 'SI' } })
    expect(merged._provenance).toMatchObject({ source: 'mixed' })
  })

  it('sin cita (sin portal) usa solo longitudinal', () => {
    const merged = mergeExamAntecedentesPrefill(
      {},
      { datos_personales: { escolaridad: 'Licenciatura' } },
      null,
    )
    expect(merged.datos_personales).toEqual({ escolaridad: 'Licenciatura' })
    expect(merged._provenance).toMatchObject({ source: 'longitudinal' })
  })

  it('no exige snapshot vacío para mezclar (a diferencia del portal-only legacy)', () => {
    const merged = mergeExamAntecedentesPrefill(
      { datos_personales: { puesto_actual: '' } },
      { datos_personales: { puesto_actual: 'Desde historial' } },
      null,
    )
    expect(merged.datos_personales).toEqual({ puesto_actual: 'Desde historial' })
  })

  it('antecedentesSnapshotComparable ignora _provenance', () => {
    expect(
      antecedentesSnapshotComparable({
        datos_personales: { puesto_actual: 'X' },
        _provenance: { source: 'portal' },
      }),
    ).toBe(
      antecedentesSnapshotComparable({
        datos_personales: { puesto_actual: 'X' },
      }),
    )
  })
})

describe('antecedentesCapturedIsEmpty', () => {
  it('vacío cuando todas las secciones están sin datos', () => {
    expect(antecedentesCapturedIsEmpty({})).toBe(true)
    expect(
      antecedentesCapturedIsEmpty({
        datos_personales: { puesto_actual: 'Operador' },
      }),
    ).toBe(false)
  })
})
