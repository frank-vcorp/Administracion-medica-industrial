/**
 * @fileoverview Server Action para proponer schemas de presentación clínica persistibles.
 * @id IMPL-20260604-01
 * @backup context/SPECs/SPEC_ARCH-20260604-01-CALIBRACION-PRESENTACION-ESTUDIOS-IA.md
 */
'use server'

const PYTHON_API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

import type { StudyPresentationSchema } from '@/types/calibration'

export interface PresentationSchemaProposalResult {
  success: boolean
  error?: string
  schema?: StudyPresentationSchema
  summary?: string
  audit?: {
    model_name: string
    prompt_source: string
    prompt_version: string
  }
}

/**
 * Solicita al backend una propuesta asistida de schema declarativo usando
 * un snapshot real de extracted_data; nunca se ejecuta en runtime clínico.
 * @id IMPL-20260604-01
 * @backup context/SPECs/SPEC_ARCH-20260604-01-CALIBRACION-PRESENTACION-ESTUDIOS-IA.md
 */
export async function proposePresentationSchema(input: {
  studyType: string
  extractedData: Record<string, unknown>
  aiCalibration?: Record<string, unknown> | null
}): Promise<PresentationSchemaProposalResult> {
  if (!input.studyType.trim()) {
    return { success: false, error: 'studyType es obligatorio para generar la propuesta' }
  }

  try {
    const response = await fetch(`${PYTHON_API}/api/v2/studies/presentation-schema/propose`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        study_type: input.studyType,
        extracted_data: input.extractedData,
        ai_calibration: input.aiCalibration ?? undefined,
      }),
    })

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Sin detalle')
      return {
        success: false,
        error: `Backend respondió ${response.status}: ${errorText.slice(0, 200)}`,
      }
    }

    const result = (await response.json()) as {
      schema?: StudyPresentationSchema
      summary?: string
      audit?: {
        model_name: string
        prompt_source: string
        prompt_version: string
      }
    }

    if (!result.schema) {
      return { success: false, error: 'El backend no devolvió un schema de presentación' }
    }

    return {
      success: true,
      schema: result.schema,
      summary: result.summary,
      audit: result.audit,
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido generando propuesta',
    }
  }
}
