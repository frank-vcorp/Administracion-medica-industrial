import { describe, expect, it } from 'vitest'
import {
  appendPapeletaEventTests,
  buildPapeletaEventTestRow,
  removePapeletaEventTestById,
} from '@/lib/clinical/papeleta-event-tests'

describe('papeleta-event-tests', () => {
  it('buildPapeletaEventTestRow deja snapshots nulos para estudio nuevo', () => {
    const row = buildPapeletaEventTestRow({
      id: 'et-1',
      testNameSnapshot: 'Rayos X',
    })
    expect(row.status).toBe('PENDING')
    expect(row.aiSnapshot).toBeNull()
    expect(row.clinicalContext).toBeNull()
  })

  it('appendPapeletaEventTests no duplica ids', () => {
    const prev = [{ id: 'a', testNameSnapshot: 'Consulta', status: 'IN_PROGRESS' }]
    const next = appendPapeletaEventTests(prev, [
      { id: 'a', testNameSnapshot: 'Dup' },
      { id: 'b', testNameSnapshot: 'Lab' },
    ])
    expect(next).toHaveLength(2)
    expect(next.map((t) => t.id)).toEqual(['a', 'b'])
  })

  it('removePapeletaEventTestById quita solo el id indicado', () => {
    const prev = [
      { id: 'a', testNameSnapshot: 'A' },
      { id: 'b', testNameSnapshot: 'B' },
    ]
    expect(removePapeletaEventTestById(prev, 'b')).toEqual([{ id: 'a', testNameSnapshot: 'A' }])
  })
})
