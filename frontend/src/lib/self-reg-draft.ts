/**
 * @file Utilidades puras para draft autosave de SelfRegistrationForm.
 * @id FIX-20260805-04
 * @spec context/SPECs/SPEC_FIX-20260805-04-DRAFT-AUTOSAVE-SELF-REGISTRATION.md
 *
 * - Sin React, sin DOM directo (solo localStorage del navegador).
 * - Funciones puras testeables en aislamiento.
 * - Tipos exportados para uso por hook y form.
 */

export const DRAFT_SCHEMA_VERSION = 1 as const

/** TTL en ms (30 días). */
export const DRAFT_TTL_MS = 30 * 24 * 60 * 60 * 1000

/** Debounce de autosave. No escribir en cada keystroke. */
export const DRAFT_SAVE_DEBOUNCE_MS = 800

/** Estructura persistida en localStorage. */
export interface SelfRegDraft {
  version: 1
  /** epoch ms (Date.now()). */
  savedAt: number
  source: 'TOKEN' | 'PUBLIC'
  /** tokenHash8 o publicScope8 — para validar consistencia al restore. */
  scope: string
  /** Estado del form del useState. */
  form: Record<string, unknown>
  /** Estado de uploads del useState (solo metadatos, no binarios). */
  uploads: Record<string, unknown> | null
}

/**
 * Genera la key de localStorage compuesta por source + scope.
 * Ej: 'ami:selfreg:draft:v1:TOKEN:a1b2c3d4'
 *     'ami:selfreg:draft:v1:PUBLIC:e5f6g7h8'
 */
export function buildDraftKey(source: 'TOKEN' | 'PUBLIC', scope: string): string {
  return `ami:selfreg:draft:v${DRAFT_SCHEMA_VERSION}:${source}:${scope}`
}

/**
 * Serializa y guarda el draft en localStorage.
 * Try/catch: si localStorage está lleno o bloqueado, no romper.
 * Retorna true si guardó, false si falló (log warn, no throw).
 */
export function saveDraft(key: string, draft: SelfRegDraft): boolean {
  try {
    if (typeof localStorage === 'undefined') return false
    localStorage.setItem(key, JSON.stringify(draft))
    return true
  } catch (err) {
    // QuotaExceededError o serialización inválida — no romper el form.
    console.warn('[self-reg-draft] saveDraft failed', { key, err })
    return false
  }
}

/**
 * Lee y parsea el draft de localStorage.
 * - Si expiró (savedAt + TTL < now) → null + removeItem (caso borde #7).
 * - Si version mismatch → null (caso borde #6).
 * - Si corrupto (JSON inválido) → null + removeItem (caso borde #5).
 * - Si falta o scope/source no coinciden → null.
 */
export function loadDraft(
  key: string,
  expected?: { source: 'TOKEN' | 'PUBLIC'; scope: string },
): SelfRegDraft | null {
  try {
    if (typeof localStorage === 'undefined') return null
    const raw = localStorage.getItem(key)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<SelfRegDraft> | null
    if (!parsed || typeof parsed !== 'object') {
      localStorage.removeItem(key)
      return null
    }
    if (parsed.version !== DRAFT_SCHEMA_VERSION) {
      // Version mismatch — descartar silenciosamente.
      return null
    }
    if (typeof parsed.savedAt !== 'number') {
      localStorage.removeItem(key)
      return null
    }
    if (Date.now() - parsed.savedAt > DRAFT_TTL_MS) {
      // TTL expirado.
      localStorage.removeItem(key)
      return null
    }
    if (expected) {
      if (parsed.source !== expected.source || parsed.scope !== expected.scope) {
        // Scope mismatch — descartar.
        localStorage.removeItem(key)
        return null
      }
    }
    return {
      version: 1,
      savedAt: parsed.savedAt,
      source: parsed.source as 'TOKEN' | 'PUBLIC',
      scope: parsed.scope as string,
      form: (parsed.form ?? {}) as Record<string, unknown>,
      uploads: (parsed.uploads ?? null) as Record<string, unknown> | null,
    }
  } catch {
    // JSON inválido o cualquier otro error — descartar.
    try {
      localStorage.removeItem(key)
    } catch {
      /* noop */
    }
    return null
  }
}

/** Elimina el draft de localStorage. Idempotente. */
export function clearDraft(key: string): void {
  try {
    if (typeof localStorage === 'undefined') return
    localStorage.removeItem(key)
  } catch {
    /* noop */
  }
}