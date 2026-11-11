import { describe, expect, it } from 'vitest'
import { buildWorkerLongitudinalAntecedentesPrefill } from '@/lib/clinical/worker-antecedentes-prefill'

describe('buildWorkerLongitudinalAntecedentesPrefill', () => {
  it('prioriza historial maestro y completa con examen previo', () => {
    const merged = buildWorkerLongitudinalAntecedentesPrefill({
      clinicalHistoryData: {
        datos_personales: { puesto_actual: 'Desde historial' },
      },
      priorExamCaptured: {
        patologicos: { asma: { estado: 'SI' } },
      },
      currentExamCaptured: null,
    })
    expect(merged?.datos_personales).toEqual({ puesto_actual: 'Desde historial' })
    expect(merged?.patologicos).toEqual({ asma: { estado: 'SI' } })
  })

  it('expone las cinco secciones declarativas para el examen', () => {
    const merged = buildWorkerLongitudinalAntecedentesPrefill({
      clinicalHistoryData: {
        datos_personales: { escolaridad: 'Preparatoria' },
        no_patologicos: { tabaquismo: 'NEGADO' },
      },
      currentExamCaptured: null,
      priorExamCaptured: null,
    })
    expect(merged?.datos_personales).toEqual({ escolaridad: 'Preparatoria' })
    expect(merged?.no_patologicos).toEqual({ tabaquismo: 'NEGADO' })
  })
})
