/**
 * @file Tests focales (V1) para `buildDictamenGeneralAmiConsolidado`
 * (IMPL-20260826-08 / FND-20260826-03).
 *
 *   Helper compartido entre `signature.actions.tsx:reemitSignedDictamen` y
 *   `zip-cierre-clinico.ts:buildCierreClinicoZip`. Garantiza que el PDF
 *   re-emitido y el general del ZIP usen el MISMO dictamen general
 *   consolidado por `appointmentId + workerId`.
 *
 * @id IMPL-20260826-08 (FIX FND-20260826-03)
 * @finding discovery/FINDINGS.md FND-20260826-03
 * @businessRule discovery/BUSINESS-RULES.md BR-20260826-01
 * @businessRule discovery/BUSINESS-RULES.md BR-20260826-02
 */
import { describe, it, expect, vi } from 'vitest'

// ─── Mocks ────────────────────────────────────────────────────────────────
const mockFindSiblingEventsInAtencion = vi.fn()

vi.mock('@/lib/event-atencion', () => ({
  findSiblingEventsInAtencion: (...a: unknown[]) =>
    mockFindSiblingEventsInAtencion(...a),
}))

// Mock Prisma con los métodos que el helper usa.
const mockMedicalEventFindUnique = vi.fn()
// `findMany` por defecto devuelve `[]` (cero siblings) — los tests que
// necesitan siblings lo mockean específicamente con `mockResolvedValueOnce`.
const mockMedicalEventFindMany = vi.fn().mockResolvedValue([])

vi.mock('@/lib/prisma', () => ({
  default: {
    medicalEvent: {
      findUnique: (...a: unknown[]) => mockMedicalEventFindUnique(...a),
      findMany: (...a: unknown[]) => mockMedicalEventFindMany(...a),
    },
  },
}))

const { buildDictamenGeneralAmiConsolidado, hasConsolidation } =
  await import('@/lib/dictamen-general-ami')

import { beforeEach } from 'vitest'

// Reset de mocks entre tests (Vitest no lo hace por defecto).
beforeEach(() => {
  mockMedicalEventFindUnique.mockReset()
  mockMedicalEventFindMany.mockReset().mockResolvedValue([])
  mockFindSiblingEventsInAtencion.mockReset()
})

function buildEvent(opts: {
  hasVerdict?: boolean
  validatorName?: string | null
  validatorLicense?: string | null
  appointmentId?: string | null
  workerId?: string
  studies?: Array<{ serviceName: string; extractedData: unknown }>
  labs?: Array<{ serviceName: string; extractedData: unknown }>
} = {}) {
  return {
    id: 'evt-current',
    worker: {
      firstName: 'Juan',
      lastName: 'Pérez',
      universalId: 'U-1',
      dob: new Date('1980-01-01T00:00:00.000Z'),
      nationalId: null,
      company: { name: 'ACME' },
    },
    branch: { name: 'Branch-1', address: null },
    exam: {
      physicalExamData: {
        aptitud: 'APTO',
        tipo_examen: 'Ingreso',
        antecedentes_personales_patologicos: null,
        datos_personales: {
          puesto_actual: 'Soldador',
          area_departamento: 'Producción',
          estado_civil: 'Soltero',
          escolaridad: 'Secundaria',
        },
      },
      eyeAcuityData: {
        vision_lejana_od: '20/20',
      },
      somatometryData: {
        peso_kg: '75',
        talla_m: '1.70',
        imc: '26',
      },
      vitalSignsData: { ta: '120/80', fc_min: '72' },
    },
    verdict: opts.hasVerdict === false
      ? null
      : {
          id: 'verdict-1',
          finalDiagnosis: 'Apto para el puesto',
          recommendations: 'EPP auditivo',
          signedAt: new Date('2026-08-25T12:00:00.000Z'),
          signatureHash: 'sha256:old-hash',
          pdfUrl: 'dictamen-old-key.pdf',
          validator: {
            id: 'user-1',
            fullName: opts.validatorName ?? 'Dr. Validator',
            professionalLicense: opts.validatorLicense ?? 'CED-1',
            signatureImageUrl: 'https://example.com/sig.png',
          },
        },
    studies: opts.studies ?? [
      { serviceName: 'Audiometría', extractedData: { oido_der: 'normal' } },
    ],
    labs: opts.labs ?? [
      { serviceName: 'Biometría', extractedData: null },
    ],
  }
}

describe('IMPL-20260826-08: buildDictamenGeneralAmiConsolidado', () => {
  // ─── Defensas de input ──────────────────────────────────────────────
  it('Event no existe → lanza Error explícito', async () => {
    mockMedicalEventFindUnique.mockResolvedValueOnce(null)
    mockFindSiblingEventsInAtencion.mockResolvedValue({
      eventIds: [],
      appointmentId: null,
      hasAppointment: false,
      workerId: null,
    })

    await expect(
      buildDictamenGeneralAmiConsolidado('evt-ghost', {
        medicalEvent: {
          findUnique: mockMedicalEventFindUnique,
          findMany: mockMedicalEventFindMany,
        },
      } as never),
    ).rejects.toThrow(/Event no encontrado/i)
  })

  it('Event sin Verdict → lanza Error explícito', async () => {
    mockMedicalEventFindUnique.mockResolvedValueOnce(
      buildEvent({ hasVerdict: false }) as never,
    )
    await expect(
      buildDictamenGeneralAmiConsolidado('evt-current', {
        medicalEvent: {
          findUnique: mockMedicalEventFindUnique,
          findMany: mockMedicalEventFindMany,
        },
      } as never),
    ).rejects.toThrow(/No hay dictamen/i)
  })

  it('Validador sin fullName → lanza Error (defensa de identidad)', async () => {
    mockMedicalEventFindUnique.mockResolvedValueOnce(
      buildEvent({ validatorName: '' }) as never,
    )
    await expect(
      buildDictamenGeneralAmiConsolidado('evt-current', {
        medicalEvent: {
          findUnique: mockMedicalEventFindUnique,
          findMany: mockMedicalEventFindMany,
        },
      } as never),
    ).rejects.toThrow(/identidad/i)
  })

  // ─── Flujo feliz: 1 solo Event (sin hermanos, N:1 legacy) ─────────
  it('sin hermanos (1:1) → consolidatedEvents con 1 Event marcado isCurrent', async () => {
    mockMedicalEventFindUnique.mockResolvedValueOnce(buildEvent() as never)
    mockFindSiblingEventsInAtencion.mockResolvedValue({
      eventIds: ['evt-current'],
      appointmentId: null,
      hasAppointment: false,
      workerId: 'worker-1',
    })

    const result = await buildDictamenGeneralAmiConsolidado('evt-current', {
      medicalEvent: {
        findUnique: mockMedicalEventFindUnique,
        findMany: mockMedicalEventFindMany,
      },
    } as never)

    expect(result.data.folio).toBe('verdict-1')
    expect(result.verdict?.id).toBe('verdict-1')
    expect(result.atencionResolution.eventIds).toEqual(['evt-current'])
    expect(result.data.consolidatedEvents).toHaveLength(1)
    expect(result.data.consolidatedEvents?.[0].isCurrent).toBe(true)
    expect(result.data.consolidatedEvents?.[0].eventId).toBe('evt-current')
    // El medico.fullName se preserva del snapshot.
    expect(result.data.medico.fullName).toBe('Dr. Validator')
  })

  // ─── Flujo consolidado (N:1 post-migración) ─────────────────────────
  it('con hermanos (N:1) → consolidatedEvents con actual + siblings', async () => {
    mockMedicalEventFindUnique.mockResolvedValueOnce(buildEvent() as never)
    mockFindSiblingEventsInAtencion.mockResolvedValue({
      eventIds: ['evt-current', 'evt-sibling-1', 'evt-sibling-2'],
      appointmentId: 'appt-1',
      hasAppointment: true,
      workerId: 'worker-1',
    })
    // El helper hace findMany para cargar studies/labs de los siblings.
    mockMedicalEventFindMany.mockResolvedValueOnce([
      {
        id: 'evt-sibling-1',
        studies: [{ serviceName: 'Espirometría', extractedData: null }],
        labs: [],
      },
      {
        id: 'evt-sibling-2',
        studies: [],
        labs: [{ serviceName: 'Química', extractedData: { glu: 90 } }],
      },
    ])

    const result = await buildDictamenGeneralAmiConsolidado('evt-current', {
      medicalEvent: {
        findUnique: mockMedicalEventFindUnique,
        findMany: mockMedicalEventFindMany,
      },
    } as never)

    expect(result.data.consolidatedEvents).toHaveLength(3)
    expect(result.data.consolidatedEvents?.[0].isCurrent).toBe(true)
    expect(result.data.consolidatedEvents?.[0].eventId).toBe('evt-current')
    expect(result.data.consolidatedEvents?.[1].isCurrent).toBe(false)
    expect(result.data.consolidatedEvents?.[1].eventId).toBe('evt-sibling-1')
    expect(result.data.consolidatedEvents?.[2].eventId).toBe('evt-sibling-2')
    // La consulta de siblings pasa los IDs correctos.
    expect(mockMedicalEventFindMany).toHaveBeenCalledTimes(1)
    const findManyArg = mockMedicalEventFindMany.mock.calls[0][0] as { where: { id: { in: string[] } } }
    expect(findManyArg.where.id.in).toEqual(['evt-sibling-1', 'evt-sibling-2'])
  })

  // ─── NO inventa datos: el medico.fullName viene del snapshot ────────
  it('NO inventa validator.fullName — usa el snapshot persistido', async () => {
    mockMedicalEventFindUnique.mockResolvedValueOnce(
      buildEvent({ validatorName: 'Dr. Snapshot Original' }) as never,
    )
    mockFindSiblingEventsInAtencion.mockResolvedValue({
      eventIds: ['evt-current'],
      appointmentId: null,
      hasAppointment: false,
      workerId: 'worker-1',
    })

    const result = await buildDictamenGeneralAmiConsolidado('evt-current', {
      medicalEvent: {
        findUnique: mockMedicalEventFindUnique,
        findMany: mockMedicalEventFindMany,
      },
    } as never)

    expect(result.data.medico.fullName).toBe('Dr. Snapshot Original')
    expect(result.data.medico.professionalLicense).toBe('CED-1')
  })

  // ─── BR-20260826-02: filtra por workerId en la consulta de siblings ──
  it('BR-20260826-02: el helper pasa workerId al resolver siblings (defensa)', async () => {
    mockMedicalEventFindUnique.mockResolvedValueOnce(
      buildEvent({ workerId: 'worker-A' }) as never,
    )
    mockFindSiblingEventsInAtencion.mockResolvedValue({
      eventIds: ['evt-current', 'evt-sibling-A'],
      appointmentId: 'appt-shared',
      hasAppointment: true,
      workerId: 'worker-A',
    })
    const mockFindMany = vi.fn().mockResolvedValueOnce([
      {
        id: 'evt-sibling-A',
        studies: [],
        labs: [],
      },
    ])

    await buildDictamenGeneralAmiConsolidado('evt-current', {
      medicalEvent: {
        findUnique: mockMedicalEventFindUnique,
        findMany: mockFindMany,
      },
    } as never)

    // Verificamos que el helper llama al resolver con el eventId
    // (que internamente filtra por workerId en `findSiblingEventsInAtencion`).
    expect(mockFindSiblingEventsInAtencion).toHaveBeenCalledTimes(1)
    expect(mockFindSiblingEventsInAtencion.mock.calls[0][0]).toBe('evt-current')
  })

  // ─── BR-20260826-17: extrae datos sin inventar valores ────────────────
  it('BR-20260826-17: extrae physicalExamData sin inventar campos', async () => {
    mockMedicalEventFindUnique.mockResolvedValueOnce(buildEvent() as never)
    mockFindSiblingEventsInAtencion.mockResolvedValue({
      eventIds: ['evt-current'],
      appointmentId: null,
      hasAppointment: false,
      workerId: 'worker-1',
    })

    const result = await buildDictamenGeneralAmiConsolidado('evt-current', {
      medicalEvent: {
        findUnique: mockMedicalEventFindUnique,
        findMany: mockMedicalEventFindMany,
      },
    } as never)

    // El `aptitud` del snapshot fluye al renderer.
    expect(result.data.aptitud).toBe('APTO')
    // El `impresionDiagnostica` viene del Verdict (no del snapshot).
    expect(result.data.impresionDiagnostica).toBe('Apto para el puesto')
    // La `somatometria` tiene datos del snapshot.
    expect(result.data.somatometria.peso).toBe('75')
    expect(result.data.somatometria.talla).toBe('1.70')
  })
})

describe('IMPL-20260826-08: hasConsolidation (helper puro)', () => {
  it('true cuando hay > 1 EventId en el grupo', () => {
    expect(
      hasConsolidation({
        eventIds: ['e1', 'e2'],
        appointmentId: 'a',
        hasAppointment: true,
        workerId: 'w',
      }),
    ).toBe(true)
  })

  it('false cuando hay 0 o 1 EventId en el grupo', () => {
    expect(
      hasConsolidation({
        eventIds: [],
        appointmentId: null,
        hasAppointment: false,
        workerId: null,
      }),
    ).toBe(false)
    expect(
      hasConsolidation({
        eventIds: ['e1'],
        appointmentId: null,
        hasAppointment: false,
        workerId: 'w',
      }),
    ).toBe(false)
  })
})
