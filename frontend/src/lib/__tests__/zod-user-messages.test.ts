import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import { zodErrorToFieldErrors } from '@/lib/save-action-errors'
import { mapUserFacingError } from '@/lib/user-facing-error'
import {
  formatZodFieldErrorLine,
  formatZodIssueMessage,
  formatZodRequiredFieldBanner,
} from '@/lib/zod-user-messages'
import { validateCertificadoMedicoPayload } from '@/lib/clinical/certificado-medico-validate'
import {
  CERTIFICADO_MEDICO_SCHEMA_VERSION,
  emptySignosVitalesCertificado,
} from '@/schemas/clinical/certificado-medico.schema'

describe('formatZodIssueMessage', () => {
  it('traduce Too small de Zod a español', () => {
    const err = z.string().min(3).safeParse('ab').error!
    expect(formatZodIssueMessage(err.issues[0]!)).toBe('Debe tener al menos 3 caracteres.')
  })
})

describe('mapUserFacingError — certificado integración diagnóstica', () => {
  it('muestra etiqueta con tilde y sin inglés', () => {
    const fieldErrors = zodErrorToFieldErrors(
      z.object({ integracion_diagnostica: z.string().min(3) }).safeParse({
        integracion_diagnostica: 'ab',
      }).error!,
    )
    const out = mapUserFacingError({ fieldErrors, message: 'Revisa el certificado.' })
    expect(out.userMessage).toContain('Integración diagnóstica')
    expect(out.userMessage.toLowerCase()).not.toContain('too small')
    expect(out.userMessage).toMatch(/3 caracteres/)
  })
})

describe('validateCertificadoMedicoPayload', () => {
  const draftPayload = {
    schemaVersion: CERTIFICADO_MEDICO_SCHEMA_VERSION,
    integracion_diagnostica: '',
    exploracion_fisica: '',
    dictamen_laboral: 'APTO',
    dictamen_laboral_texto: 'Apto.',
    medico_nombre: 'Dr.',
    medico_cedula: '1',
    signos_vitales: emptySignosVitalesCertificado(),
  }

  const finalMissingIntegracion = {
    schemaVersion: CERTIFICADO_MEDICO_SCHEMA_VERSION,
    lugar_expedicion: 'Santiago de Querétaro, Querétaro',
    exploracion_fisica: 'Exploración sin hallazgos relevantes.',
    integracion_diagnostica: '',
    dictamen_laboral: 'APTO' as const,
    dictamen_laboral_texto: 'Apto para laborar.',
    medico_nombre: 'Dr. Prueba',
    medico_cedula: '12345678',
    signos_vitales: emptySignosVitalesCertificado(),
  }

  it('borrador acepta integración diagnóstica vacía (autoguardado)', () => {
    const v = validateCertificadoMedicoPayload(draftPayload, 'draft')
    expect(v.valid).toBe(true)
  })

  it('cierre exige integración diagnóstica con mensaje claro', () => {
    const v = validateCertificadoMedicoPayload(finalMissingIntegracion, 'final')
    expect(v.valid).toBe(false)
    if (!v.valid) {
      expect(v.error).toBe(formatZodRequiredFieldBanner('integracion_diagnostica', 3))
      expect(v.fieldErrors?.integracion_diagnostica?.[0]).toMatch(/3 caracteres/)
    }
  })
})

describe('formatZodFieldErrorLine', () => {
  it('usa modo oración en la etiqueta del campo', () => {
    expect(formatZodFieldErrorLine('integracion_diagnostica', 'Debe tener al menos 3 caracteres.')).toBe(
      'Integración diagnóstica: Debe tener al menos 3 caracteres.',
    )
  })
})
