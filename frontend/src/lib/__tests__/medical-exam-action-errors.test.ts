import { describe, it, expect } from 'vitest'
import { z } from 'zod'
import { mapMedicalExamActionFailure, parseMedicalExamZodIssues } from '@/lib/medical-exam-action-errors'

describe('parseMedicalExamZodIssues', () => {
  it('reconstruye ZodError desde JSON de issues', () => {
    const err = z.object({ peso_kg: z.number() }).safeParse({}).error as z.ZodError
    const json = JSON.stringify({ issues: err.issues })
    const back = parseMedicalExamZodIssues(json)
    expect(back).toBeInstanceOf(z.ZodError)
    expect(back!.issues.length).toBeGreaterThan(0)
  })

  it('devuelve null si el JSON no es de issues', () => {
    expect(parseMedicalExamZodIssues('not json')).toBeNull()
  })
})

describe('mapMedicalExamActionFailure', () => {
  it('usa issues rehidratados para mensaje de validación', () => {
    const err = z
      .object({ vision_lejana_od: z.string().min(1, 'Selecciona valor') })
      .safeParse({})
      .error as z.ZodError
    const tech = JSON.stringify({ issues: err.issues })
    const out = mapMedicalExamActionFailure(
      {
        success: false,
        error: 'Revisa agudeza visual.',
        technicalDetail: tech,
      },
      'test',
    )
    expect(out.kind).toBe('validation')
    expect(out.userMessage).toContain('Agudeza visual')
  })
})
