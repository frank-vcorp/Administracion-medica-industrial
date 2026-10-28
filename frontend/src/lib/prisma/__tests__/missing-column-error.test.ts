import { describe, expect, it } from 'vitest'
import { Prisma } from '@prisma/client'
import {
  CANCELLATION_REASON_COLUMNS,
  isPrismaMissingColumnError,
} from '@/lib/prisma/missing-column-error'

describe('isPrismaMissingColumnError', () => {
  it('detecta P2022 por columnas de cancelación', () => {
    const error = new Prisma.PrismaClientKnownRequestError(
      'Invalid `prisma.medicalEvent.findUnique()` invocation',
      {
        code: 'P2022',
        clientVersion: '5.22.0',
        meta: { column: 'medical_events.cancellationReason' },
      },
    )
    expect(isPrismaMissingColumnError(error)).toBe(true)
    expect(isPrismaMissingColumnError(error, CANCELLATION_REASON_COLUMNS)).toBe(
      true,
    )
  })

  it('ignora P2022 de otra columna', () => {
    const error = new Prisma.PrismaClientKnownRequestError('x', {
      code: 'P2022',
      clientVersion: '5.22.0',
      meta: { column: 'medical_events.dischargedAt' },
    })
    expect(isPrismaMissingColumnError(error, CANCELLATION_REASON_COLUMNS)).toBe(
      false,
    )
  })
})
