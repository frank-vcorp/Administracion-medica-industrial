import { describe, expect, it } from 'vitest'
import { findCie10ByCode, formatCie10Unified } from '@/lib/clinical/cie-10-catalog'
import { parseConsultaMedicaClinicalContext } from '@/lib/clinical/consulta-medica'
import { parseAppointmentLocalDateTime } from '@/lib/appointment-scheduling'
import {
  buildProximaCitaFields,
  formatProximaCitaLine,
  formatScheduledFollowUp,
  listOpenAgendaHourSlots,
} from '@/lib/clinical/consulta-seguimiento'
import { validateConsultaMedicaPayload } from '@/lib/clinical/consulta-medica-validate'
import {
  CONSULTA_MEDICA_SCHEMA_VERSION,
  CONSULTA_MEDICA_SCHEMA_VERSION_V1,
} from '@/schemas/clinical/consulta-medica.schema'

const APPOINTMENT_ID = '6f1e8c2a-4b3d-4e5f-8a90-1c2d3e4f5a6b'

function legacyDraft() {
  return {
    schemaVersion: CONSULTA_MEDICA_SCHEMA_VERSION_V1,
    tipo_consulta: 'ENFERMEDAD_GENERAL' as const,
    motivo_consulta: '',
    signos_vitales: {},
    exploracion_fisica: '',
    diagnostico_unificado: '',
    diagnostico_especifico: '',
    incapacidad_aplica: false,
    otorga_incapacidad: 'NO' as const,
    receta_lineas: [],
    medico_nombre: 'Médico',
    medico_cedula: '—',
  }
}

describe('próxima cita de seguimiento', () => {
  it('un borrador v1 sin las claves nuevas sigue validando (DA-1)', () => {
    const result = validateConsultaMedicaPayload(legacyDraft(), 'draft')
    expect(result.valid).toBe(true)
    if (!result.valid) return
    expect(result.payload.schemaVersion).toBe(CONSULTA_MEDICA_SCHEMA_VERSION)
    expect(result.payload.proxima_cita_fecha).toBeUndefined()
    expect(result.payload.proxima_cita_hora).toBeUndefined()
    expect(result.payload.proxima_cita_appointment_id).toBeUndefined()

    const restored = parseConsultaMedicaClinicalContext(legacyDraft())
    expect(restored?.motivo_consulta).toBe('')
    expect(restored?.proxima_cita_fecha).toBeUndefined()
  })

  it('guarda fecha y hora en texto libre y un id de cita opcional', () => {
    const fields = buildProximaCitaFields({
      fecha: '  12 de diciembre de 2026  ',
      hora: ' 10:30 ',
      appointmentId: ` ${APPOINTMENT_ID} `,
    })
    const result = validateConsultaMedicaPayload(
      {
        ...legacyDraft(),
        ...fields,
      },
      'draft',
    )
    expect(result.valid).toBe(true)
    if (!result.valid) return
    expect(result.payload.proxima_cita_fecha).toBe('12 de diciembre de 2026')
    expect(result.payload.proxima_cita_hora).toBe('10:30')
    expect(result.payload.proxima_cita_appointment_id).toBe(APPOINTMENT_ID)
    expect(formatProximaCitaLine(result.payload)).toBe('12 de diciembre de 2026 · 10:30')

    const restored = parseConsultaMedicaClinicalContext(result.payload)
    expect(restored?.proxima_cita_fecha).toBe('12 de diciembre de 2026')
  })

  it('el cierre rechaza un id de cita que no es UUID y acepta el seguimiento vacío', () => {
    const entry = findCie10ByCode('J069')
    expect(entry).not.toBeNull()
    if (!entry) return
    const base = {
      ...legacyDraft(),
      motivo_consulta: 'Dolor de garganta de tres días con fiebre.',
      exploracion_fisica: 'Faringe hiperémica, sin exudado. Resto sin datos de alarma.',
      diagnostico_unificado: formatCie10Unified(entry),
      diagnostico_especifico: 'Faringitis',
      medico_nombre: 'Dra. Ejemplo',
      medico_cedula: '12345678',
    }

    const emptyFollowUp = validateConsultaMedicaPayload(base, 'final')
    expect(emptyFollowUp.valid).toBe(true)

    const badId = validateConsultaMedicaPayload(
      { ...base, proxima_cita_appointment_id: 'cita-de-manana' },
      'final',
    )
    expect(badId.valid).toBe(false)
    if (!badId.valid) {
      expect(badId.fieldErrors?.proxima_cita_appointment_id?.[0]).toMatch(/UUID/)
    }
  })

  it('buildProximaCitaFields omite campos en blanco', () => {
    expect(
      buildProximaCitaFields({ fecha: '   ', hora: '', appointmentId: '' }),
    ).toEqual({})
    expect(formatProximaCitaLine({})).toBeNull()
    expect(formatProximaCitaLine({ proxima_cita_fecha: 'Lunes' })).toBe('Lunes')
  })

  it('formatea la cita agendada en hora de México para la nota y el formulario', () => {
    const scheduled = parseAppointmentLocalDateTime('2026-12-12', '10:30')
    expect(formatScheduledFollowUp(scheduled)).toEqual({
      fecha: '12 de diciembre de 2026',
      hora: '10:30',
      dateInput: '2026-12-12',
      timeInput: '10:30',
    })
  })

  it('lista solo horas de agenda con cupo y que no pasaron', () => {
    const now = parseAppointmentLocalDateTime('2026-12-12', '09:30')
    const counts = new Map<number, number>([
      [10, 0],
      [11, 2],
    ])
    expect(
      listOpenAgendaHourSlots({
        hours: [8, 9, 10, 11],
        counts,
        capacity: 2,
        date: '2026-12-12',
        now,
      }).map((slot) => slot.time),
    ).toEqual(['10:00'])
  })
})
