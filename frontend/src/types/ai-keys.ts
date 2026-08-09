/**
 * @file Tipos para gestión runtime de API Keys IA vía UI.
 * @id IMPL-20260809-06 — ARCH-20260809-03
 * @spec context/SPECs/SPEC_ARCH-20260809-03-MANAGE-AI-API-KEYS.md
 *
 * Contratos públicos entre el backend FastAPI y la UI Next.js.
 * El backend NUNCA expone la key completa ni el ciphertext — sólo `keySuffix`
 * (últimos 4 chars) para identificación visual.
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