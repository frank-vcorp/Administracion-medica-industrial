/**
 * @file Tests V1 focales para la propagación del `clinical_context` al
 *   backend de prediagnóstico (FEATURE-20260825-02 + gap-fix del
 *   IMPLEMENTATION_DEFECT detectado por GEMINI + FIX-Vercel-Build).
 *
 * Cubre AC-11:
 *   - Cuando hay un cuestionario de Espirometría guardado (`schemaVersion`
 *     = `espirometria-questionnaire-v1`), el helper valida y reenvía el
 *     payload al backend IA.
 *   - Cuando hay un cuestionario de Audiometría guardado
 *     (`audiometria-questionnaire-v1`), el helper valida y reenvía el
 *     payload al backend IA — el gap-fix.
 *   - Cualquier `schemaVersion` desconocida se rechaza sin bloquear el
 *     upload (defensa contra prompt injection / drift evolutivo).
 *
 * FIX-Vercel-Build 2026-08-25 (commit 68f12fd): el helper se movió del
 * server action `ai-prediagnosis.actions.ts` (donde bloqueaba el build
 * por export síncrono bajo `'use server'`) al módulo
 * `frontend/src/lib/clinical/clinical-context-propagation.ts`. Este
 * test importa directamente desde el módulo de `lib/`, NO toca el
 * server action, y mantiene la trazabilidad AC-11.
 *
 * @id IMPL-FEATURE-20260825-02
 * @backup context/SPECs/SPEC-FEATURE-20260825-02-AUDIOMETRIA-ENTREGABLE.md
 */

import { describe, it, expect } from 'vitest'
import { extractAndValidateClinicalContext as extractCtx } from '@/lib/clinical/clinical-context-propagation'
import { ESPIROMETRIA_QUESTIONNAIRE_SCHEMA_VERSION } from '@/schemas/clinical/espirometria-questionnaire.schema'
import { AUDIOMETRIA_QUESTIONNAIRE_SCHEMA_VERSION } from '@/schemas/clinical/audiometria-questionnaire.schema'
import type {
  AudiometriaQuestionnairePayload,
} from '@/schemas/clinical/audiometria-questionnaire.schema'

function makeFD(entries: Record<string, string>): FormData {
  const fd = new FormData()
  for (const [k, v] of Object.entries(entries)) {
    fd.append(k, v)
  }
  return fd
}

const VALID_ESPIRO_CTX = {
  schemaVersion: ESPIROMETRIA_QUESTIONNAIRE_SCHEMA_VERSION,
  capturedAt: '2026-08-25T14:00:00.000Z',
  antecedentes: { embarazo: 'NO_APLICA' as const },
  exploracionFisica: {
    vias_respiratorias_superiores: { estado: 'NORMAL' as const },
    torax: { estado: 'NORMAL' as const },
    pulmones: { estado: 'NORMAL' as const },
  },
}

const VALID_AUDIO_CTX: AudiometriaQuestionnairePayload = {
  schemaVersion: AUDIOMETRIA_QUESTIONNAIRE_SCHEMA_VERSION,
  capturedAt: '2026-08-25T14:00:00.000Z',
  patientId: undefined,
  responsableCaptura: undefined,
  responsableMedico: undefined,
  consentimiento: 'SI',
  antecedentes: {
    audiometria_previa: 'NO',
    exposicion_ruido_laboral: 'NO',
  },
  exploracionFisica: {
    faringe: { estado: 'NORMAL' },
    cad: { estado: 'NORMAL' },
    cai: { estado: 'NORMAL' },
    mtd: { estado: 'NORMAL' },
    mti: { estado: 'NORMAL' },
  },
}

describe('AC-11: extractAndValidateClinicalContext — propagación a IA', () => {
  it('AC-11.E: acepta y reenvía un cuestionario de Espirometría válido', () => {
    const fd = makeFD({
      clinical_context: JSON.stringify(VALID_ESPIRO_CTX),
    })
    const result = extractCtx(fd)
    expect(result).not.toBeNull()
    expect(result!.studyType).toBe('Espirometria')
    expect(result!.schemaVersion).toBe(
      ESPIROMETRIA_QUESTIONNAIRE_SCHEMA_VERSION,
    )
    // El campo serialized debe ser un JSON válido del mismo payload.
    expect(JSON.parse(result!.serialized)).toEqual(VALID_ESPIRO_CTX)
  })

  it('AC-11.A: acepta y reenvía un cuestionario de Audiometría válido (gap-fix)', () => {
    const fd = makeFD({
      clinical_context: JSON.stringify(VALID_AUDIO_CTX),
    })
    const result = extractCtx(fd)
    expect(result).not.toBeNull()
    expect(result!.studyType).toBe('Audiometria')
    expect(result!.schemaVersion).toBe(
      AUDIOMETRIA_QUESTIONNAIRE_SCHEMA_VERSION,
    )
    expect(JSON.parse(result!.serialized)).toEqual(VALID_AUDIO_CTX)
  })

  it('rechaza schemaVersion desconocida sin bloquear el upload (defensa contra prompt injection)', () => {
    const fd = makeFD({
      clinical_context: JSON.stringify({
        schemaVersion: 'audiometria-questionnaire-v999',
        capturedAt: '2026-08-25T14:00:00.000Z',
        antecedentes: {},
        exploracionFisica: {},
      }),
    })
    const result = extractCtx(fd)
    expect(result).toBeNull()
  })

  it('rechaza schemaVersion ausente sin bloquear el upload', () => {
    const fd = makeFD({
      clinical_context: JSON.stringify({
        capturedAt: '2026-08-25T14:00:00.000Z',
        antecedentes: {},
        exploracionFisica: {},
      }),
    })
    const result = extractCtx(fd)
    expect(result).toBeNull()
  })

  it('devuelve null cuando el FormData no incluye clinical_context', () => {
    const fd = makeFD({})
    expect(extractCtx(fd)).toBeNull()
  })

  it('devuelve null cuando clinical_context no es JSON válido', () => {
    const fd = makeFD({ clinical_context: '{ no es json' })
    expect(extractCtx(fd)).toBeNull()
  })

  it('devuelve null cuando clinical_context NO es un objeto', () => {
    const fd = makeFD({ clinical_context: '"hola"' })
    expect(extractCtx(fd)).toBeNull()
  })

  it('rechaza payload de Espirometría contra schema de Audiometría (sin contaminación)', () => {
    // Defensa contra ataques que pretendan inyectar payload de
    // espirometría en un slot marcado como audiometría.
    const fd = makeFD({
      clinical_context: JSON.stringify({
        ...VALID_ESPIRO_CTX,
        schemaVersion: AUDIOMETRIA_QUESTIONNAIRE_SCHEMA_VERSION,
      }),
    })
    const result = extractCtx(fd)
    expect(result).toBeNull()
  })

  it('rechaza payload de Audiometría con campos faltantes del schema (validación real)', () => {
    const fd = makeFD({
      clinical_context: JSON.stringify({
        schemaVersion: AUDIOMETRIA_QUESTIONNAIRE_SCHEMA_VERSION,
        capturedAt: '2026-08-25T14:00:00.000Z',
        // faltan antecedentes y exploracionFisica
      }),
    })
    const result = extractCtx(fd)
    expect(result).toBeNull()
  })
})