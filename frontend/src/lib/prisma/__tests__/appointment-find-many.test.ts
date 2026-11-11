import { describe, expect, it, vi } from 'vitest'
import { Prisma } from '@prisma/client'
import {
  findManyAppointmentsResilient,
  withAppointmentOptionalMigrationDefaults,
} from '@/lib/prisma/appointment-find-many'

function missingFollowUpColumnError() {
  return new Prisma.PrismaClientKnownRequestError(
    'Invalid `prisma.appointment.findMany()` invocation',
    {
      code: 'P2022',
      clientVersion: '5.22.0',
      meta: { column: 'appointments.followUpFromMedicalEventId' },
    },
  )
}

describe('withAppointmentOptionalMigrationDefaults', () => {
  it('rellena columnas opcionales con null', () => {
    const row = withAppointmentOptionalMigrationDefaults({ id: 'a1' })
    expect(row.cancellationReason).toBeNull()
    expect(row.cancelledAt).toBeNull()
    expect(row.followUpFromMedicalEventId).toBeNull()
    expect(row.id).toBe('a1')
  })
})

describe('findManyAppointmentsResilient', () => {
  it('devuelve filas sin reintento cuando la query completa funciona', async () => {
    const fullRow = { id: '1', followUpFromMedicalEventId: 'ev-1' }
    const findMany = vi.fn().mockResolvedValue([fullRow])
    const db = { appointment: { findMany } }

    const result = await findManyAppointmentsResilient(db, {
      where: { id: '1' },
      include: { worker: true },
    })

    expect(findMany).toHaveBeenCalledTimes(1)
    expect(result).toEqual([fullRow])
  })

  it('reintenta con select acotado en P2022 y adjunta defaults', async () => {
    const fallbackRow = { id: '2', status: 'SCHEDULED' }
    const findMany = vi
      .fn()
      .mockRejectedValueOnce(missingFollowUpColumnError())
      .mockResolvedValueOnce([fallbackRow])
    const db = { appointment: { findMany } }

    const result = await findManyAppointmentsResilient(db, {
      include: {
        worker: { select: { id: true, firstName: true } },
      },
    })

    expect(findMany).toHaveBeenCalledTimes(2)
    const secondCall = findMany.mock.calls[1][0]
    expect(secondCall.select).toBeDefined()
    expect(secondCall.include).toBeUndefined()
    expect(secondCall.select.worker).toEqual({
      select: { id: true, firstName: true },
    })
    expect(secondCall.select.followUpFromMedicalEventId).toBeUndefined()

    expect(result[0].followUpFromMedicalEventId).toBeNull()
    expect(result[0].cancellationReason).toBeNull()
    expect(result[0].cancelledAt).toBeNull()
    expect(result[0].id).toBe('2')
  })

  it('propaga errores que no son columna ausente', async () => {
    const findMany = vi.fn().mockRejectedValue(new Error('connection lost'))
    const db = { appointment: { findMany } }

    await expect(
      findManyAppointmentsResilient(db, { where: {} }),
    ).rejects.toThrow('connection lost')
    expect(findMany).toHaveBeenCalledTimes(1)
  })
})
