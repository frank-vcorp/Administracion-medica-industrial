/**
 * @fileoverview Helper puro síncrono para extraer y validar el
 *   `clinical_context` que el frontend adjunta al `FormData` de upload IA.
 *   Vive en `lib/` (NO `'use server'`) por dos razones:
 *
 *   1. FIX-Vercel-Build 2026-08-25 (commit 68f12fd): Next.js 16 / Turbopack
 *      rechaza exports SÍNCRONOS desde cualquier módulo marcado con
 *      `'use server'` (todos los exports de un server action deben ser
 *      `async`). Mover este helper a `lib/clinical/` lo libera de esa
 *      restricción y desbloquea el build Vercel.
 *   2. Trazabilidad/testabilidad: el helper es puro y testeable sin
 *      mockear Prisma + fetch; al vivir fuera del server action, los
 *      tests V1 pueden importarlo directamente.
 *
 * Patrón idéntico al de `espirometria-questionnaire-validate.ts` y
 * `audiometria-questionnaire-validate.ts` (FIX-Vercel-Build previo).
 *
 * Soporta DOS ramas (Espirometría y Audiometría) seleccionadas por
 * `schemaVersion` declarado en el payload. Si el `schemaVersion` no es
 * conocido o el payload no valida, devuelve `null` y el caller omite el
 * contexto sin bloquear el upload (defensa contra prompt injection y
 * drift evolutivo).
 *
 * @id IMPL-FEATURE-20260825-02 (FIX-Vercel-Build)
 * @backup context/SPECs/SPEC-FEATURE-20260825-02-AUDIOMETRIA-ENTREGABLE.md
 */

import {
  EspirometriaQuestionnairePayloadSchema,
  ESPIROMETRIA_QUESTIONNAIRE_SCHEMA_VERSION,
} from '@/schemas/clinical/espirometria-questionnaire.schema'
import {
  AudiometriaQuestionnairePayloadSchema,
  AUDIOMETRIA_QUESTIONNAIRE_SCHEMA_VERSION,
} from '@/schemas/clinical/audiometria-questionnaire.schema'

/**
 * Resultado exitoso del helper.
 *
 *   - `serialized`: payload re-serializado (JSON string) listo para enviar
 *     como FormData del backend.
 *   - `schemaVersion`: versión del esquema validado (para audit/trazabilidad).
 *   - `studyType`: tipo canónico del estudio, para que el caller decida si
 *     propagarlo al audit del snapshot o tomar acciones adicionales.
 *   - `present: true`: marca discriminadora para que el caller agregue
 *     metadata al audit (no sólo `if (result)` por compatibilidad TS).
 */
export type ValidatedClinicalContext = {
  serialized: string
  schemaVersion: string
  studyType: 'Espirometria' | 'Audiometria'
  present: true
}

/**
 * Tabla cerrada de versiones soportadas. Mantenerla cerrada facilita
 * auditar las ramas y bloquear versiones futuras desconocidas.
 */
interface SupportedClinicalContext {
  studyType: 'Espirometria' | 'Audiometria'
  schema: (raw: unknown) => { success: true; data: unknown } | { success: false }
}

const SUPPORTED_CLINICAL_CONTEXT_VERSIONS: Record<
  string,
  SupportedClinicalContext
> = {
  [ESPIROMETRIA_QUESTIONNAIRE_SCHEMA_VERSION]: {
    studyType: 'Espirometria',
    schema: (raw) =>
      EspirometriaQuestionnairePayloadSchema.safeParse(raw) as {
        success: true
        data: unknown
      } | { success: false },
  },
  [AUDIOMETRIA_QUESTIONNAIRE_SCHEMA_VERSION]: {
    studyType: 'Audiometria',
    schema: (raw) =>
      AudiometriaQuestionnairePayloadSchema.safeParse(raw) as {
        success: true
        data: unknown
      } | { success: false },
  },
}

/**
 * Extrae y valida el `clinical_context` que `PapeletaWorkspace.handleFileUpload`
 * adjunta al FormData cuando hay un cuestionario versionado guardado en
 * `EventTest.clinicalContext`. Soporta Espirometría y Audiometría.
 *
 * Reglas:
 *   - Si el campo está ausente o vacío → `null` (compat: el backend corre
 *     sin contexto adicional, igual que antes de FEATURE-20260824-02).
 *   - Si está presente, parsear JSON. Si falla o no es un objeto → `null`
 *     (no rompemos el upload: el snapshot sigue siendo válido; sólo se
 *     omite el contexto para evitar prompt injection).
 *   - Si parsea, validar contra el schema correspondiente al
 *     `schemaVersion` declarado. Si NO cumple → `null` + log warn (sin PII).
 *     Defensa en profundidad: el snapshot de `EventTest.clinicalContext`
 *     YA está validado por el server action de guardado, pero el FormData
 *     puede manipularse en cliente antes de llegar aquí.
 *   - Si cumple → devolver el payload re-serializado (string JSON) listo
 *     para enviar como campo FormData del backend.
 *
 * Privacidad: el cuestionario NO incluye PII del encabezado (la papeleta
 * ya lo aporta); sólo antecedentes clínicos y exploración física del
 * estudio (Espirometría o Audiometría según el caso).
 */
export function extractAndValidateClinicalContext(
  formData: FormData,
): ValidatedClinicalContext | null {
  const raw = formData.get('clinical_context')
  if (typeof raw !== 'string' || raw.trim().length === 0) return null

  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    console.warn(
      '[IMPL-FEATURE-20260825-02] clinical_context no es JSON válido; se omite sin bloquear el upload.',
    )
    return null
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    console.warn(
      '[IMPL-FEATURE-20260825-02] clinical_context no es un objeto; se omite sin bloquear el upload.',
    )
    return null
  }

  // Defensa contra prompt injection: validar contra el schema versionado
  // correspondiente. Rechazamos versiones futuras desconocidas para
  // evitar bypass evolutivos.
  const version = (parsed as { schemaVersion?: unknown }).schemaVersion
  const supported = SUPPORTED_CLINICAL_CONTEXT_VERSIONS[
    typeof version === 'string' ? version : ''
  ]
  if (!supported) {
    console.warn(
      `[IMPL-FEATURE-20260825-02] clinical_context.schemaVersion="${String(
        version,
      )}" no soportada; se omite sin bloquear el upload.`,
    )
    return null
  }

  const validated = supported.schema(parsed)
  if (!validated.success) {
    console.warn(
      '[IMPL-FEATURE-20260825-02] clinical_context no cumple el schema versionado; se omite sin bloquear el upload.',
    )
    return null
  }

  return {
    serialized: JSON.stringify(validated.data),
    schemaVersion: (validated.data as { schemaVersion: string }).schemaVersion,
    studyType: supported.studyType,
    present: true,
  }
}