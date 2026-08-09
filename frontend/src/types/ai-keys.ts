/**
 * @file Tipos para gestión runtime de API Keys IA vía UI.
 * @id IMPL-20260809-06 — ARCH-20260809-03
 * @spec context/SPECs/SPEC_ARCH-20260809-03-MANAGE-AI-API-KEYS.md
 *
 * Contratos públicos entre el backend FastAPI y la UI Next.js.
 * El backend NUNCA expone la key completa ni el ciphertext — sólo `keySuffix`
 * (últimos 4 chars) para identificación visual.
 *
 * IMPL-20260809-09 — ARCH-20260809-05: añade tipos para "Probar conexión"
 * (`ProbeResult`/`ProbeErrorKind`) y para el selector de proveedor de extracción
 * predeterminado (`GetDefaultResult`/`SetDefaultResult`/`ExtractionProvider`).
 */

export type AIProvider = 'gemini' | 'm3' | 'dr7'

export const AI_PROVIDERS: readonly AIProvider[] = ['gemini', 'm3', 'dr7'] as const

export type AIKeySource = 'env' | 'db'

export interface AIKeyPublic {
  provider: AIProvider
  present: boolean
  keySuffix: string | null
  baseUrl: string | null
  defaultModel: string | null
  enabled: boolean
  updatedAt: string | null
  updatedBy: string | null
  source: AIKeySource
}

export interface AIKeysListResponse {
  providers: AIKeyPublic[]
}

export interface AIKeyUpsertRequest {
  apiKey: string
  baseUrl?: string | null
  defaultModel?: string | null
  expectedUpdatedAt?: string | null
}

export interface AIKeyUpsertResponse {
  provider: AIProvider
  present: true
  keySuffix: string
  baseUrl: string | null
  defaultModel: string | null
  enabled: true
  updatedAt: string | null
  source: 'db'
}

export interface AIKeyDeleteResponse {
  provider: AIProvider
  present: false
  source: 'env'
}

/** Etiqueta legible del proveedor para UI. */
export const AI_PROVIDER_LABELS: Record<AIProvider, string> = {
  gemini: 'Gemini (extracción)',
  m3: 'MiniMax M3 (extracción)',
  dr7: 'DR7 / MedGemma (clínica)',
}

// ===========================================================================
// IMPL-20260809-09 — ARCH-20260809-05
// Probe de conexión y selector de proveedor de extracción predeterminado.
// ===========================================================================

/** Tipos de error que puede devolver un probe. Coinciden con backend. */
export type ProbeErrorKind =
  | 'not_configured'
  | 'decrypt_error'
  | 'auth'
  | 'timeout'
  | 'network'
  | 'http_4xx'
  | 'http_5xx'
  | 'parse'
  | 'rate_limited'
  | 'unknown'

/** Resultado de un probe. Discriminated union por `ok`. */
export type ProbeResult =
  | {
      ok: true
      provider: AIProvider
      latencyMs: number
      httpStatus: number
      message: string
    }
  | {
      ok: false
      provider: AIProvider
      errorKind: ProbeErrorKind
      message: string
      httpStatus?: number
      rateLimited?: boolean
      retryAfterSec?: number
    }

/** Proveedores elegibles como default de extracción (DR7 es clínico-only). */
export type ExtractionProvider = 'gemini' | 'm3'

export const EXTRACTION_PROVIDERS: readonly ExtractionProvider[] = ['gemini', 'm3'] as const

export const EXTRACTION_PROVIDER_LABELS: Record<ExtractionProvider, string> = {
  gemini: 'Gemini',
  m3: 'MiniMax M3',
}

/** Respuesta de GET /api/v2/admin/app-config/extraction-default-provider */
export type GetDefaultResult =
  | {
      ok: true
      provider: ExtractionProvider
      source: 'db' | 'default'
      updatedAt: string | null
    }
  | { ok: false; error: string }

/** Respuesta de PUT /api/v2/admin/app-config/extraction-default-provider */
export type SetDefaultResult =
  | {
      ok: true
      provider: ExtractionProvider
      source: 'db'
      updatedAt: string
    }
  | { ok: false; error: string }