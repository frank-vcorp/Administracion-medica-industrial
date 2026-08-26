/**
 * @file Tests focales V1 para `event-atencion.ts`.
 *
 *   Cubre el helper `findSiblingEventsInAtencion` y la utility
 *   `isEventInAtencion` que aplican `DEC-20260826-01` / `BR-20260826-01`
 *   para consolidar Events del trabajador ligados a la misma cita.
 *
 *   Patrón: mocks de `PrismaClient` (vi.fn()), igual a otros tests
 *   focal de la lib (sin tocar BD real).
 *
 * @id IMPL-20260826-06 (FIX consolidación por atención/cita)
 * @businessRule discovery/BUSINESS-RULES.md BR-20260826-01
 * @decision discovery/DECISIONS.md DEC-20260826-01
 *
 * Cubre:
 *   - Event sin cita (walk-in) → resolución = [eventId].
 *   - Event con cita + `@unique` actual → resolución = [eventId].
 *   - Event con cita + schema migrado (N:1) → resolución = varios.
 *   - Event inexistente → resolución vacía.
 *   - `eventId` vacío/null → resolución vacía (defensa).
 *   - `isEventInAtencion` membership.
 *   - Orden estable por `createdAt` ascendente.
 *   - NO mezcla Events de otros trabajadores.
 */
import { describe, it, expect, vi } from 'vitest'

import {
  findSiblingEventsInAtencion,
  isEventInAtencion,
  type AtencionResolution,
} from '../event-atencion'

// Helper para construir un mock mínimo de PrismaClient con los métodos
// que `findSiblingEventsInAtencion` usa (post-migración IMPL-20260826-06).
function makePrismaMock(opts: {
  current: { appointmentId: string | null; workerId: string } | null
  siblings?: Array<{ id: string; createdAt: Date }>
  /**
   * Filtro por `where` para simular la consulta real: por defecto sólo
   * respeta `appointmentId` (defensa 1:1 legacy). Para tests del
   * escenario post-migración N:1, el caller puede pasar un filtro
   * que también respeta `workerId`.
   */
  filterByWorkerId?: boolean
}) {
  const findUnique = vi.fn().mockResolvedValue(opts.current)
  const findMany = vi.fn().mockImplementation(({ where }) => {
    if (!opts.siblings) return Promise.resolve([])
    // Si el caller no quiere que el helper filtre por workerId,
    // devolvemos todos los siblings sin chequear (simula comportamiento
    // legacy pre-migración, que ahora NO debería ocurrir en producción).
    if (!opts.filterByWorkerId) return Promise.resolve(opts.siblings)
    // Filtro defensivo (mismo comportamiento que el helper real):
    // si la query NO pidió filtro por workerId, no devolvemos nada.
    if (!where || !where.workerId) return Promise.resolve([])
    if (where.workerId !== opts.current?.workerId) return Promise.resolve([])
    return Promise.resolve(opts.siblings)
  })
  return {
    medicalEvent: {
      findUnique,
      findMany,
    },
    __findUnique: findUnique,
    __findMany: findMany,
  } as unknown as Parameters<typeof findSiblingEventsInAtencion>[1] & {
    __findUnique: ReturnType<typeof vi.fn>
    __findMany: ReturnType<typeof vi.fn>
  }
}

describe('IMPL-20260826-06: findSiblingEventsInAtencion', () => {
  // ─── Defensas de input ──────────────────────────────────────────────
  it('REGRESIÓN: eventId vacío → resolución vacía (no rompe ZIP)', async () => {
    const prisma = makePrismaMock({ current: null })
    const out = await findSiblingEventsInAtencion('', prisma)
    expect(out).toEqual({
      eventIds: [],
      appointmentId: null,
      hasAppointment: false,
      workerId: null,
    })
    expect(prisma.__findUnique).not.toHaveBeenCalled()
  })

  it('defensa: eventId null → resolución vacía', async () => {
    const prisma = makePrismaMock({ current: null })
    const out = await findSiblingEventsInAtencion(
      null as unknown as string,
      prisma,
    )
    expect(out.eventIds).toEqual([])
    expect(out.hasAppointment).toBe(false)
    expect(prisma.__findUnique).not.toHaveBeenCalled()
  })

  it('Event inexistente → resolución vacía', async () => {
    const prisma = makePrismaMock({ current: null })
    const out = await findSiblingEventsInAtencion('ghost-event', prisma)
    expect(out).toEqual({
      eventIds: [],
      appointmentId: null,
      hasAppointment: false,
      workerId: null,
    })
    expect(prisma.__findUnique).toHaveBeenCalledTimes(1)
    expect(prisma.__findMany).not.toHaveBeenCalled()
  })

  // ─── Walk-in (sin cita) ─────────────────────────────────────────────
  it('Event sin cita (walk-in legacy) → resolución = [eventId]', async () => {
    const prisma = makePrismaMock({
      current: { appointmentId: null, workerId: 'worker-A' },
    })
    const out = await findSiblingEventsInAtencion('evt-walkin-1', prisma)
    expect(out).toEqual({
      eventIds: ['evt-walkin-1'],
      appointmentId: null,
      hasAppointment: false,
      workerId: 'worker-A',
    })
    expect(prisma.__findMany).not.toHaveBeenCalled()
  })

  // ─── Caso 1:1 actual del schema (appointmentId @unique) ───────────
  it('REGRESIÓN DEC-20260826-01: schema actual @unique → sólo el Event', async () => {
    // Con `@unique` appointmentId, la query sólo devuelve el propio Event.
    // Este test documenta el BLOQUEO ESTRUCTURAL y protege contra el
    // "asumir" que el schema ya soporta múltiples Events por cita.
    const prisma = makePrismaMock({
      current: { appointmentId: 'appt-1', workerId: 'worker-A' },
      siblings: [
        { id: 'evt-1', createdAt: new Date('2026-08-26T10:00:00.000Z') },
      ],
    })
    const out = await findSiblingEventsInAtencion('evt-1', prisma)
    expect(out).toEqual({
      eventIds: ['evt-1'],
      appointmentId: 'appt-1',
      hasAppointment: true,
      workerId: 'worker-A',
    })
    // Verificamos que la query SQL real usa las FKs existentes.
    expect(prisma.__findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          appointmentId: 'appt-1',
          workerId: 'worker-A',
        }),
        orderBy: { createdAt: 'asc' },
      }),
    )
  })

  // ─── Caso N:1 post-migración (AC-2: dos Events del mismo Appointment) ─
  it('AC-2: dos Events del mismo Appointment + mismo trabajador → ambos', async () => {
    // Caso post-migración (ADR-20260826-01): una Appointment puede
    // tener N Events del mismo trabajador.
    const prisma = makePrismaMock({
      current: { appointmentId: 'appt-1', workerId: 'worker-A' },
      filterByWorkerId: true,
      siblings: [
        { id: 'evt-A1', createdAt: new Date('2026-08-26T08:00:00.000Z') },
        { id: 'evt-A2', createdAt: new Date('2026-08-26T09:00:00.000Z') },
        { id: 'evt-A3', createdAt: new Date('2026-08-26T10:00:00.000Z') },
      ],
    })
    const out = await findSiblingEventsInAtencion('evt-A1', prisma)
    expect(out.eventIds).toEqual(['evt-A1', 'evt-A2', 'evt-A3'])
    expect(out.appointmentId).toBe('appt-1')
    expect(out.workerId).toBe('worker-A')
    expect(out.hasAppointment).toBe(true)
  })

  // ─── Defensa BR-20260826-02: NO incluye Events de otro trabajador ──
  it('AC-3 BR-20260826-02: NO devuelve Events de OTRO trabajador aunque compartan cita', async () => {
    // El helper debe filtrar por `workerId` además de `appointmentId`.
    // Simula: el Event actual es del worker-A, pero hay Events
    // del worker-B con la misma Appointment. El helper NO los debe
    // incluir (riesgo de fuga de datos entre pacientes).
    const findUnique = vi.fn().mockResolvedValue({
      appointmentId: 'appt-shared',
      workerId: 'worker-A',
    })
    // Simula la consulta filtrada que el helper hace internamente.
    // El helper pasa `where: { appointmentId, workerId }`. El mock
    // respeta ambos filtros.
    const findMany = vi.fn().mockImplementation(({ where }) => {
      const all = [
        { id: 'evt-A1', createdAt: new Date('2026-08-26T08:00:00.000Z') },
        { id: 'evt-A2', createdAt: new Date('2026-08-26T09:00:00.000Z') },
        { id: 'evt-B1', createdAt: new Date('2026-08-26T09:30:00.000Z') }, // OTRO worker
      ]
      if (!where || !where.workerId) return Promise.resolve(all)
      // Si la query filtró por worker-A, NO devolvemos evt-B1.
      return Promise.resolve(all.filter((e) => e.id.startsWith('evt-A')))
    })
    const prisma = {
      medicalEvent: { findUnique, findMany },
    } as unknown as Parameters<typeof findSiblingEventsInAtencion>[1]

    const out = await findSiblingEventsInAtencion('evt-A1', prisma)
    // CRÍTICO: NO debe aparecer evt-B1 (del worker-B).
    expect(out.eventIds).toEqual(['evt-A1', 'evt-A2'])
    expect(out.eventIds).not.toContain('evt-B1')
    // Verificamos que la query pidió filtro por workerId.
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          appointmentId: 'appt-shared',
          workerId: 'worker-A',
        }),
      }),
    )
  })

  it('AC-3: NO devuelve Events de OTRA Appointment aunque compartan trabajador', async () => {
    // El mock debe simular el comportamiento correcto de Prisma:
    // el `where: { appointmentId, workerId }` filtra por la cita Y
    // trabajador específicos.
    const findMany = vi.fn().mockImplementation(({ where }) => {
      if (
        where?.appointmentId === 'appt-1' &&
        where?.workerId === 'worker-A'
      ) {
        return Promise.resolve([
          { id: 'evt-A1', createdAt: new Date('2026-08-26T10:00:00.000Z') },
        ])
      }
      return Promise.resolve([])
    })
    const findUnique = vi
      .fn()
      .mockResolvedValue({ appointmentId: 'appt-1', workerId: 'worker-A' })
    const prisma = {
      medicalEvent: { findUnique, findMany },
    } as unknown as Parameters<typeof findSiblingEventsInAtencion>[1]

    const out = await findSiblingEventsInAtencion('evt-A1', prisma)
    expect(out.eventIds).toEqual(['evt-A1'])
    // El helper NUNCA hace un `findMany({})` sin filtro — el filtro
    // por appointmentId+workerId siempre está presente.
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          appointmentId: 'appt-1',
          workerId: 'worker-A',
        }),
      }),
    )
  })

  // ─── Orden estable por createdAt ascendente ─────────────────────────
  it('preserva orden createdAt ascendente (sin reordenar)', async () => {
    const prisma = makePrismaMock({
      current: { appointmentId: 'appt-X', workerId: 'worker-X' },
      filterByWorkerId: true,
      siblings: [
        { id: 'evt-3', createdAt: new Date('2026-08-26T12:00:00.000Z') },
        { id: 'evt-1', createdAt: new Date('2026-08-26T10:00:00.000Z') },
        { id: 'evt-2', createdAt: new Date('2026-08-26T11:00:00.000Z') },
      ],
    })
    const out = await findSiblingEventsInAtencion('evt-1', prisma)
    // La query ya pidió orderBy: createdAt asc → el orden devuelto por
    // Prisma es ascendente. El helper NO reordena.
    expect(out.eventIds).toEqual(['evt-3', 'evt-1', 'evt-2'])
  })

  it('walk-in (sin cita) preserva workerId para gate de scope posterior', async () => {
    // El walk-in no agrupa con nadie, pero el workerId se preserva
    // para que consumers puedan hacer gates de scope adicionales.
    const prisma = makePrismaMock({
      current: { appointmentId: null, workerId: 'worker-Z' },
    })
    const out = await findSiblingEventsInAtencion('evt-z', prisma)
    expect(out.workerId).toBe('worker-Z')
    expect(out.hasAppointment).toBe(false)
  })
})

describe('IMPL-20260826-06: isEventInAtencion (utility)', () => {
  const baseResolution: AtencionResolution = {
    eventIds: ['evt-1', 'evt-2', 'evt-3'],
    appointmentId: 'appt-1',
    hasAppointment: true,
    workerId: 'worker-A',
  }

  it('true para EventId presente en el grupo', () => {
    expect(isEventInAtencion('evt-1', baseResolution)).toBe(true)
    expect(isEventInAtencion('evt-2', baseResolution)).toBe(true)
    expect(isEventInAtencion('evt-3', baseResolution)).toBe(true)
  })

  it('false para EventId fuera del grupo (BR-20260826-01 exclusión)', () => {
    // Exclusión explícita del BR: "no incluir Events históricos fuera
    // de la atención/cita".
    expect(isEventInAtencion('evt-externo', baseResolution)).toBe(false)
    expect(isEventInAtencion('', baseResolution)).toBe(false)
  })

  it('false para resolución vacía', () => {
    const empty: AtencionResolution = {
      eventIds: [],
      appointmentId: null,
      hasAppointment: false,
      workerId: null,
    }
    expect(isEventInAtencion('evt-1', empty)).toBe(false)
  })
})

// ─── Documentación del estado post-migración (IMPL-20260826-06) ───────────
//
// SPEC-FEATURE-20260826-01 / ADR-20260826-01 / DEC-20260826-02 / BR-20260826-02:
//
//   El schema Prisma ya no tiene `@unique` sobre `MedicalEvent.appointmentId`.
//   La consulta del helper pasa `where: { appointmentId, workerId }` para
//   defender de dos riesgos: (a) fuga entre pacientes que comparten
//   `Appointment`, (b) mezcla con Events de citas distintas.
//
//   Rollback disponible en la migración:
//   `revert_remove_medical_event_appointment_id_unique.sql` re-crea el
//   índice UNIQUE con pre-check defensivo (abort si hay duplicados).
//   NO se ejecuta sin autorización humana separada (ADR §Rollback).
//
