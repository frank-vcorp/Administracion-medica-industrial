import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import {
  failureFromFieldErrors,
  failureFromZod,
  zodErrorToFieldErrors,
} from '@/lib/save-action-errors'
import { mapSaveActionFailure } from '@/lib/user-facing-error'

describe('save-action-errors', () => {
  it('convierte ZodError a fieldErrors por ruta', () => {
    const schema = z.object({ workerId: z.string().min(1, 'Selecciona un trabajador') })
    const parsed = schema.safeParse({ workerId: '' })
    expect(parsed.success).toBe(false)
    if (!parsed.success) {
      const fe = zodErrorToFieldErrors(parsed.error)
      expect(fe.workerId?.[0]).toMatch(/trabajador/i)
      const fail = failureFromZod(parsed.error)
      expect(fail.success).toBe(false)
      expect(fail.fieldErrors?.workerId).toBeDefined()
    }
  })

  it('mapSaveActionFailure muestra lista de campos', () => {
    const fail = failureFromFieldErrors(
      { firstName: ['El nombre es obligatorio'], lastName: ['Los apellidos son obligatorios'] },
      'Revisa los datos del trabajador',
    )
    const mapped = mapSaveActionFailure(fail, { context: 'createWorker' })
    expect(mapped.kind).toBe('validation')
    expect(mapped.userMessage).toMatch(/Nombre/i)
    expect(mapped.userMessage).toMatch(/Apellidos/i)
  })
})
