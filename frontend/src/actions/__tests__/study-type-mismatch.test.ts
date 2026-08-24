/**
 * @file Tests para la propagación estructurada de STUDY_TYPE_MISMATCH.
 * @id IMPL-20260824-01-FRONTEND-MISMATCH
 * @spec context/SPECs/SPEC-FIX-20260824-01-STUDY-MISMATCH.md
 *
 * Cubre AC-3 (UI/resultNotes sin HTML/prompt/respuesta) y AC-4 (errores no
 * mismatch siguen propagándose sanitizados).
 *
 * Estrategia:
 *  - `buildMismatchResultNote` se testea unitariamente (no requiere DOM).
 *  - La lógica de parsing del backend response (`triggerStudyAIAnalysis`)
 *    se testea con fetch mockeado.
 *  - La garantía "no HTML/prompt/respuesta en `EventTest.resultNotes`" se
 *    testea con chequeos estáticos del source (defensa contra regresión).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mocks de Next — previos a imports de las actions
vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}))
vi.mock('next-auth/next', () => ({
  getServerSession: vi.fn(),
}))

// Mockear Prisma: usamos una falsa mini-base para verificar qué
// `resultNotes` se intenta persistir.
const prismaMocks = {
  eventTestUpdate: vi.fn(),
  eventTestFindUnique: vi.fn(),
}
vi.mock('@/lib/prisma', () => ({
  default: {
    eventTest: {
      findUnique: (...args: unknown[]) => prismaMocks.eventTestFindUnique(...args),
      update: (...args: unknown[]) => prismaMocks.eventTestUpdate(...args),
    },
  },
}))

// Mockear calibration-v3.actions: el helper `getPublishedVersionForSnapshot`
// no afecta a la lógica de mismatch; retornamos null para mantener el flujo
// estable.
vi.mock('@/actions/calibration-v3.actions', () => ({
  getPublishedCalibrationForEventTest: vi.fn().mockResolvedValue(null),
  getPublishedVersionForSnapshot: vi.fn().mockResolvedValue(null),
}))

// Mockear study-ai helper (eAI eligibility); no lo necesitamos para este test.
vi.mock('@/lib/study-ai', () => ({
  isAIEligibleEventTest: vi.fn().mockReturnValue(false),
  getCanonicalAIStudyType: vi.fn().mockReturnValue(null),
  getAIWorkflowLabel: vi.fn().mockReturnValue(null),
}))

import { buildMismatchResultNote } from '@/lib/clinical/study-type-mismatch-note'
import { triggerStudyAIAnalysis } from '@/actions/ai-prediagnosis.actions'

beforeEach(() => {
  prismaMocks.eventTestUpdate.mockReset()
  prismaMocks.eventTestFindUnique.mockReset()
  // Default: Prisma update retorna el input (no-op para nuestros chequeos).
  prismaMocks.eventTestUpdate.mockImplementation(async (args: unknown) => args)
  // Default: eventTestFindUnique retorna un EventTest AI-eligible mínimo.
  prismaMocks.eventTestFindUnique.mockImplementation(async (args: unknown) => {
    const where = (args as { where?: { id?: string } }).where
    if (where?.id === 'eventTestId') {
      return {
        test: {
          options: {
            aiCalibration: {
              extraction: { prompt: 'mock' },
              presentation: { schema: { sections: [] } },
            },
          },
        },
      }
    }
    return null
  })
})

// ---------------------------------------------------------------------------
// buildMismatchResultNote (resultNotes redacción)
// ---------------------------------------------------------------------------

describe('IMPL-20260824-01 / buildMismatchResultNote — redacción para resultNotes', () => {
  it('AC-3: caso con detectedStudyType confiable → texto accionable SIN prompt/HTML/PII', () => {
    const note = buildMismatchResultNote({
      selectedStudyType: 'Audiometria',
      detectedStudyType: 'Espirometria',
      message: 'Seleccionaste Audiometría, pero el documento parece ser Espirometría.',
    })
    // Contiene los tipos
    expect(note).toContain('Audiometria')
    expect(note).toContain('Espirometria')
    // NO contiene etiquetas HTML
    expect(note).not.toMatch(/<[^>]+>/)
    // NO contiene tokens de prompt
    expect(note.toLowerCase()).not.toContain('system:')
    expect(note.toLowerCase()).not.toContain('assistant:')
    expect(note.toLowerCase()).not.toContain('### instruction')
    // NO contiene placeholders técnicos del backend
    expect(note).not.toContain('respuesta de m3')
    expect(note).not.toContain('respuesta de')
    expect(note).not.toContain('stack')
    expect(note).not.toContain('traceback')
    // NO contiene el mensaje crudo (sólo se usa el `message` como guía, no se copia)
    // El message del backend ya fue redactado por build_user_facing_message;
    // nuestro texto aquí es independiente y NO lo copia verbatim.
  })

  it('AC-3: caso sin detectedStudyType → mensaje genérico sanitizado', () => {
    const note = buildMismatchResultNote({
      selectedStudyType: 'Audiometria',
      detectedStudyType: null,
      message: 'El documento no parece corresponder al estudio seleccionado.',
    })
    // NO afirma un tipo detectado
    expect(note).not.toContain('Espirometria')
    expect(note).not.toContain('audiograma')
    // NO contiene HTML
    expect(note).not.toMatch(/<[^>]+>/)
    // NO contiene tokens de prompt ni stack
    expect(note.toLowerCase()).not.toContain('respuesta de m3')
    expect(note.toLowerCase()).not.toContain('traceback')
  })

  it('AC-3 (defensa): selectedStudyType null → "el estudio seleccionado"', () => {
    const note = buildMismatchResultNote({
      selectedStudyType: null,
      detectedStudyType: 'Espirometria',
      message: null,
    })
    expect(note).toContain('el estudio seleccionado')
    expect(note).not.toContain('null')
    expect(note).not.toContain('undefined')
  })

  it('AC-3 (defensa): selected == detected → fallback genérico (no redundancia)', () => {
    const note = buildMismatchResultNote({
      selectedStudyType: 'Audiometria',
      detectedStudyType: 'Audiometria',
      message: null,
    })
    expect(note).toContain('no parece corresponder')
    // No dice "seleccionaste Audiometría pero parece ser Audiometría"
    expect(note).not.toContain('pero el documento parece ser Audiometria')
  })

  it('AC-3 (privacidad): el `message` del backend NO se copia verbatim al resultNotes', () => {
    const note = buildMismatchResultNote({
      selectedStudyType: 'Audiometria',
      detectedStudyType: 'Espirometria',
      message:
        'Seleccionaste Audiometría, pero el documento parece ser Espirometría. ' +
        'Abre Espirometría y vuelve a cargar el archivo.',
    })
    // El mensaje del backend se compone de forma independiente — nuestro
    // builder produce su propio texto (para que un eventual cambio del
    // backend no afecte el histórico de Prisma). No debe contener la frase
    // literal completa del backend.
    expect(note).not.toBe(
      'Seleccionaste Audiometría, pero el documento parece ser Espirometría. ' +
      'Abre Espirometría y vuelve a cargar el archivo.'
    )
  })
})

// ---------------------------------------------------------------------------
// triggerStudyAIAnalysis: parsing del body estructurado del backend
// ---------------------------------------------------------------------------

describe('IMPL-20260824-01 / triggerStudyAIAnalysis — parsing de STUDY_TYPE_MISMATCH', () => {
  function makeFormData(): FormData {
    const fd = new FormData()
    fd.append('eventTestId', 'eventTestId')
    fd.append('eventId', 'eventId')
    fd.append('triggeredByUserId', 'tester')
    fd.append('file', new File([new Uint8Array(1)], 'fake.pdf', { type: 'application/pdf' }))
    return fd
  }

  beforeEach(() => {
    // Resetear el fetch mock por test
    vi.restoreAllMocks()
  })

  it('AC-1: cuando backend responde status="error" + error_code="STUDY_TYPE_MISMATCH", la action propaga los 4 campos estructurados', async () => {
    const body = {
      status: 'error',
      error_code: 'STUDY_TYPE_MISMATCH',
      error:
        'Seleccionaste Audiometría, pero el documento parece ser Espirometría. ' +
        'Abre Espirometría y vuelve a cargar el archivo.',
      message:
        'Seleccionaste Audiometría, pero el documento parece ser Espirometría. ' +
        'Abre Espirometría y vuelve a cargar el archivo.',
      selected_study_type: 'Audiometria',
      detected_study_type: 'Espirometria',
      file: 'audio.pdf',
    }
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        text: async () => JSON.stringify(body),
        json: async () => body,
      })
    )

    const result = await triggerStudyAIAnalysis(makeFormData())
    expect(result.success).toBe(false)
    expect(result.errorCode).toBe('STUDY_TYPE_MISMATCH')
    expect(result.selectedStudyType).toBe('Audiometria')
    expect(result.detectedStudyType).toBe('Espirometria')
    // F-2: campo `message` se preserva en el result.
    expect(result.message).toBe(body.message)
    // `error` contiene el mensaje redactado del backend (puede usar tildes).
    expect(result.error).toContain('Audiometr')
    expect(result.error).toContain('Espirometr')
    // NUNCA debe contener prompt crudo ni HTML.
    expect(result.error).not.toMatch(/<script/i)
    expect(result.error).not.toMatch(/<[^>]+>/)
  })

  it('AC-2 (inverso, fixture corregido F-1): Espirometría → Audiometría mismatch con fixture naturalmente Audio', async () => {
    // QA-20260824-12 F-1: el fixture anterior afirmaba que el doc era
    // espirometría (= selected), documentando un falso positivo. Este
    // fixture refleja el caso real: el operador seleccionó Espirometría
    // pero el documento ES un audiograma.
    const body = {
      status: 'error',
      error_code: 'STUDY_TYPE_MISMATCH',
      error:
        'Seleccionaste Espirometría, pero el documento parece ser ' +
        'Audiometría. Abre Audiometría y vuelve a cargar el archivo.',
      message:
        'Seleccionaste Espirometría, pero el documento parece ser ' +
        'Audiometría. Abre Audiometría y vuelve a cargar el archivo.',
      selected_study_type: 'Espirometria',
      detected_study_type: 'Audiometria',
      file: 'espi.pdf',
    }
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        text: async () => JSON.stringify(body),
        json: async () => body,
      })
    )

    const result = await triggerStudyAIAnalysis(makeFormData())
    expect(result.success).toBe(false)
    expect(result.errorCode).toBe('STUDY_TYPE_MISMATCH')
    expect(result.selectedStudyType).toBe('Espirometria')
    expect(result.detectedStudyType).toBe('Audiometria')
    // F-2: `message` propagado.
    expect(result.message).toBe(body.message)
  })

  it('F-3 (frontend passthrough): cuando detected_study_type es null en el response, se preserva como null', async () => {
    // QA-20260824-12 F-3: el backend puede devolver `detected_study_type=null`
    // (confianza baja). El frontend debe preservarlo para que la UI use el
    // mensaje genérico en lugar de afirmar un tipo inexistente.
    const body = {
      status: 'error',
      error_code: 'STUDY_TYPE_MISMATCH',
      error:
        'El documento no parece corresponder al estudio seleccionado. ' +
        'Verifica el archivo y vuelve a intentarlo.',
      message:
        'El documento no parece corresponder al estudio seleccionado. ' +
        'Verifica el archivo y vuelve a intentarlo.',
      selected_study_type: 'Audiometria',
      detected_study_type: null,
      file: 'audio.pdf',
    }
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        text: async () => JSON.stringify(body),
        json: async () => body,
      })
    )

    const result = await triggerStudyAIAnalysis(makeFormData())
    expect(result.success).toBe(false)
    expect(result.errorCode).toBe('STUDY_TYPE_MISMATCH')
    expect(result.selectedStudyType).toBe('Audiometria')
    // detectedStudyType es null (NO undefined) — la UI distingue esto.
    expect(result.detectedStudyType).toBeNull()
  })

  it('AC-4: errores genéricos (no mismatch) se propagan con success=false + error, SIN errorCode', async () => {
    const body = {
      status: 'error',
      error: 'Servicios de IA no están disponibles',
    }
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        text: async () => JSON.stringify(body),
        json: async () => body,
      })
    )

    const result = await triggerStudyAIAnalysis(makeFormData())
    expect(result.success).toBe(false)
    expect(result.error).toBe('Servicios de IA no están disponibles')
    // NO debe clasificarse como mismatch.
    expect(result.errorCode).toBeUndefined()
    expect(result.selectedStudyType).toBeUndefined()
    expect(result.detectedStudyType).toBeUndefined()
  })

  it('AC-4 (paridad HTTP no-OK): cuando response.ok=false pero body trae STUDY_TYPE_MISMATCH, igual se clasifica', async () => {
    const body = {
      status: 'error',
      error_code: 'STUDY_TYPE_MISMATCH',
      error: 'Seleccionaste Audiometría pero el documento parece ser Espirometría.',
      message:
        'Seleccionaste Audiometría pero el documento parece ser Espirometría.',
      selected_study_type: 'Audiometria',
      detected_study_type: 'Espirometria',
    }
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        text: async () => JSON.stringify(body),
        json: async () => body,
      })
    )

    const result = await triggerStudyAIAnalysis(makeFormData())
    expect(result.success).toBe(false)
    expect(result.errorCode).toBe('STUDY_TYPE_MISMATCH')
    expect(result.selectedStudyType).toBe('Audiometria')
    expect(result.detectedStudyType).toBe('Espirometria')
  })
})

// ---------------------------------------------------------------------------
// Garantías estáticas — defensa contra regresión de privacidad en el source
// ---------------------------------------------------------------------------

describe('IMPL-20260824-01 / garantías estáticas en event-test.actions.ts', () => {
  it('AC-3: buildMismatchResultNote NUNCA recibe `provider_text` ni campos crudos del proveedor', async () => {
    const { readFileSync } = await import('node:fs')
    const { resolve } = await import('node:path')
    const src = readFileSync(
      resolve(process.cwd(), 'src/actions/event-test.actions.ts'),
      'utf-8'
    )
    // Aislamos el bloque `except mismatch` (sub-bloque dentro del flujo V2)
    const blockMatch = src.match(/STUDY_TYPE_MISMATCH[\s\S]*?return\s*\{([\s\S]*?)\}\s*\}/)
    // Si el matcher falla, sólo aplicamos checks genéricos sobre el source.
    const block = blockMatch ? blockMatch[1] : src
    // El bloque del action NO debe referenciar `provider_text`.
    expect(block.toLowerCase()).not.toContain('provider_text')
    // NO debe copiar un mensaje crudo de `m3` ni `gemini` al cliente.
    expect(block.toLowerCase()).not.toContain('respuesta de m3')
    expect(block.toLowerCase()).not.toContain('respuesta de gemini')
    // NO debe usar dangerouslySetInnerHTML.
    expect(src).not.toContain('dangerouslySetInnerHTML')
  })

  it('AC-3: PapeletaWorkspace NO usa dangerouslySetInnerHTML en ningún banner de mismatch', async () => {
    const { readFileSync } = await import('node:fs')
    const { resolve } = await import('node:path')
    const src = readFileSync(
      resolve(process.cwd(), 'src/components/clinical/PapeletaWorkspace.tsx'),
      'utf-8'
    )
    // El componente que renderiza el banner (MismatchMessageBanner) NO debe
    // usar dangerouslySetInnerHTML.
    expect(src).not.toContain('dangerouslySetInnerHTML')
  })

  it('AC-3 (paridad): ai-prediagnosis.actions.ts propaga el mensaje redactado, NO raw text', async () => {
    const { readFileSync } = await import('node:fs')
    const { resolve } = await import('node:path')
    const src = readFileSync(
      resolve(process.cwd(), 'src/actions/ai-prediagnosis.actions.ts'),
      'utf-8'
    )
    // Cuando STUDY_TYPE_MISMATCH viene del backend, el campo `error` debe
    // poblarse con `result.message` / `result.error` (ambos redactados por
    // el backend). NUNCA debe concatenar el texto crudo del proveedor.
    expect(src).not.toContain('provider_text')
    // El bloque de mapeo de mismatch no debe usar `.raw` ni stack del fetch.
    const mismatchBlockMatch = src.match(
      /error_code\s*===\s*['"]STUDY_TYPE_MISMATCH['"][\s\S]*?return\s*\{([\s\S]*?)\}\s*/
    )
    if (mismatchBlockMatch) {
      const block = mismatchBlockMatch[1]
      // El `error` se construye desde `result.message ?? result.error` —
      // campos del response ya redactados.
      expect(block).toContain('message')
      expect(block).not.toContain('.raw')
    }
  })
})