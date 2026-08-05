/**
 * @file Hook React para draft autosave de SelfRegistrationForm.
 * @id FIX-20260805-04
 * @spec context/SPECs/SPEC_FIX-20260805-04-DRAFT-AUTOSAVE-SELF-REGISTRATION.md
 *
 * Comportamiento:
 * - Al mount: loadDraft(key) → expone en savedDraft (en useEffect, no en
 *   useState initializer — caso borde #10 / hydration mismatch #418).
 *   FIX B1 (§6.2.1 corolario B1): si `scope === ''` (ruta TOKEN, scope async
 *   no resuelto vía SHA-256), NO decidir todavía — el effect re-correrá
 *   cuando `key` cambie por resolución del scope. Si lo ignoráramos, un
 *   loadDraft(null) prematuramente marcaría isRestored=true y el autosave
 *   sobreescribiría el draft real del usuario con form vacío a los 800ms.
 * - Autosave debounced 800ms sobre [form, uploads]: solo si enabled Y el
 *   usuario ya decidió sobre el restore (acceptRestore/dismissRestore).
 *   Esto evita sobreescribir un draft viejo con un form vacío antes de
 *   que el usuario decida (caso borde específico §6.2 de SPEC).
 * - acceptRestore → isRestored=true (el componente aplica los valores).
 * - dismissRestore → clearDraft + isRestored=true (FIX B2 §6.2.1 corolario
 *   B2). `isRestored` significa "el usuario ya tomó una decisión sobre el
 *   restore" (no "aceptó restaurar"); tras dismiss el form queda vacío
 *   (clearDraft ya ejecutó) y el autosave arranca limpio desde el primer
 *   keystroke posterior.
 * - clearOnSubmit → clearDraft(key) (submit exitoso).
 */
import { useEffect, useRef, useState } from 'react'

import {
  DRAFT_SAVE_DEBOUNCE_MS,
  type SelfRegDraft,
  buildDraftKey,
  clearDraft,
  loadDraft,
  saveDraft,
} from '../self-reg-draft'

interface UseSelfRegDraftOptions {
  source: 'TOKEN' | 'PUBLIC'
  scope: string
  form: Record<string, unknown>
  uploads: Record<string, unknown> | null
  /** Default true. false desactiva autosave (ej. tras success). */
  enabled?: boolean
}

/**
 * Exportado para tests (FIX-20260805-04-FIXES). La firma del contrato
 * público del hook no cambia — solo se añade visibilidad al tipo.
 */
export interface UseSelfRegDraftResult {
  savedDraft: SelfRegDraft | null
  isRestored: boolean
  dismissRestore: () => void
  acceptRestore: () => void
  clearOnSubmit: () => void
}

export function useSelfRegDraft(options: UseSelfRegDraftOptions): UseSelfRegDraftResult {
  const { source, scope, form, uploads, enabled = true } = options

  const key = buildDraftKey(source, scope)

  const [savedDraft, setSavedDraft] = useState<SelfRegDraft | null>(null)
  const [isRestored, setIsRestored] = useState(false)

  // Refs para evitar re-disparar el debounce en cada re-render del hook.
  const formRef = useRef(form)
  const uploadsRef = useRef(uploads)
  formRef.current = form
  uploadsRef.current = uploads

  // Mount: cargar draft (no en useState initializer → SSR safe).
  useEffect(() => {
    // FIX B1 (§6.2.1 corolario B1): mientras `scope === ''` (ruta TOKEN con
    // scope async vía crypto.subtle.digest), NO cargar ni decidir todavía.
    // El effect re-correrá automáticamente cuando `key` cambie por
    // resolución del scope (key = buildDraftKey(source, scope)).
    if (scope === '') return
    const loaded = loadDraft(key, { source, scope })
    setSavedDraft(loaded)
    // Si no hay draft, el autosave puede arrancar inmediatamente.
    if (!loaded) setIsRestored(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  // Autosave debounced.
  useEffect(() => {
    if (!enabled) return
    if (!isRestored) return // esperar decisión del usuario
    const timer = window.setTimeout(() => {
      const draft: SelfRegDraft = {
        version: 1,
        savedAt: Date.now(),
        source,
        scope,
        form: formRef.current,
        uploads: uploadsRef.current,
      }
      saveDraft(key, draft)
    }, DRAFT_SAVE_DEBOUNCE_MS)
    return () => window.clearTimeout(timer)
  }, [form, uploads, enabled, isRestored, key, source, scope])

  return {
    savedDraft,
    isRestored,
    dismissRestore: () => {
      clearDraft(key)
      // FIX B2 (§6.2.1 corolario B2): isRestored=true (no false). Tras
      // dismiss, el form queda vacío y el autosave debe arrancar limpio
      // desde el primer keystroke. `isRestored` = "el usuario ya decidió",
      // no "aceptó restaurar".
      setIsRestored(true)
      setSavedDraft(null)
    },
    acceptRestore: () => {
      setIsRestored(true)
    },
    clearOnSubmit: () => {
      clearDraft(key)
    },
  }
}