/**
 * @file Tests del hook useSelfRegDraft (FIX-20260805-04).
 * @id FIX-20260805-04-FIXES
 * @spec context/SPECs/SPEC_FIX-20260805-04-DRAFT-AUTOSAVE-SELF-REGISTRATION.md §6.2 + §6.2.1
 *
 * Cubre regresiones de FIX B1 (TOKEN async scope) y FIX B2 (post-dismiss).
 *
 * Sin @testing-library/react (no es dep declarada). Usamos un renderHook
 * minimalista con `react-dom/client` + `act` de React 19 + DOM stub via
 * `vi.stubGlobal` (el vitest config del proyecto es `environment: 'node'`).
 *
 * Stubeamos:
 *   - localStorage (mismo shim Map-backed que self-reg-draft.test.ts).
 *   - DOM mínimo (document, window, HTMLElement, etc.) para que
 *     react-dom/client.createRoot pueda inicializar.
 *   - window.setTimeout/clearTimeout con `vi.useFakeTimers()` para el
 *     debounce de 800ms.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createElement, useEffect, useState } from 'react'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'

import {
  DRAFT_SAVE_DEBOUNCE_MS,
  PUBLIC_SCOPE_KEY,
  buildDraftKey,
  getOrCreatePublicScope,
  saveDraft,
  type SelfRegDraft,
} from '../self-reg-draft'
import { useSelfRegDraft, type UseSelfRegDraftResult } from '../hooks/useSelfRegDraft'

// ────────────────────────────────────────────────────────────────────────────
// DOM stub mínimo para createRoot en entorno node.
// ────────────────────────────────────────────────────────────────────────────

function makeEl(tag = 'div'): Record<string, unknown> {
  const el: Record<string, unknown> = {
    nodeType: 1,
    tagName: tag.toUpperCase(),
    nodeName: tag.toUpperCase(),
    namespaceURI: 'http://www.w3.org/1999/xhtml',
    style: {},
    children: [] as unknown[],
    _listeners: new Map<string, Set<(...args: unknown[]) => void>>(),
    parentNode: null,
    ownerDocument: null,
    firstChild: null,
    lastChild: null,
    nextSibling: null,
    previousSibling: null,
  }
  el.appendChild = (c: Record<string, unknown>) => {
    ;(el.children as unknown[]).push(c)
    c.parentNode = el
    return c
  }
  el.insertBefore = (c: Record<string, unknown>) => {
    ;(el.children as unknown[]).push(c)
    c.parentNode = el
    return c
  }
  el.removeChild = (c: Record<string, unknown>) => {
    const arr = el.children as unknown[]
    const i = arr.indexOf(c)
    if (i >= 0) {
      arr.splice(i, 1)
      c.parentNode = null
    }
    return c
  }
  el.replaceChild = (c: Record<string, unknown>, old: Record<string, unknown>) => {
    const arr = el.children as unknown[]
    const i = arr.indexOf(old)
    if (i >= 0) arr[i] = c
    return old
  }
  el.setAttribute = () => undefined
  el.removeAttribute = () => undefined
  el.addEventListener = (t: string, h: (...args: unknown[]) => void) => {
    let set = (el._listeners as Map<string, Set<(...args: unknown[]) => void>>).get(t)
    if (!set) {
      set = new Set()
      ;(el._listeners as Map<string, Set<(...args: unknown[]) => void>>).set(t, set)
    }
    set.add(h)
  }
  el.removeEventListener = () => undefined
  el.hasAttribute = () => false
  el.getAttribute = () => null
  Object.defineProperty(el, 'textContent', {
    get() {
      return (el._text as string | undefined) ?? ''
    },
    set(v: string) {
      el._text = v
    },
  })
  Object.defineProperty(el, 'defaultView', { get: () => globalThis.window })
  return el
}

function stubDom() {
  const body = makeEl('body')
  const documentElement = makeEl('html')
  const document: Record<string, unknown> = {
    createElement(tag: string) {
      const e = makeEl(tag)
      e.ownerDocument = document
      return e
    },
    createElementNS(_ns: string, tag: string) {
      const e = makeEl(tag)
      e.ownerDocument = document
      return e
    },
    createTextNode(t: string) {
      return { nodeType: 3, nodeName: '#text', data: t, parentNode: null }
    },
    body,
    documentElement,
    activeElement: body,
    addEventListener() {
      /* noop */
    },
    removeEventListener() {
      /* noop */
    },
    querySelector() {
      return null
    },
    querySelectorAll() {
      return []
    },
    getElementById() {
      return null
    },
  }
  const window_ = {
    document,
    addEventListener() {
      /* noop */
    },
    removeEventListener() {
      /* noop */
    },
    setTimeout: globalThis.setTimeout,
    clearTimeout: globalThis.clearTimeout,
    HTMLIFrameElement: class HTMLIFrameElement {},
    HTMLAnchorElement: class HTMLAnchorElement {},
    HTMLFormElement: class HTMLFormElement {},
    HTMLInputElement: class HTMLInputElement {},
    HTMLSelectElement: class HTMLSelectElement {},
    HTMLTextAreaElement: class HTMLTextAreaElement {},
    HTMLButtonElement: class HTMLButtonElement {},
    HTMLLabelElement: class HTMLLabelElement {},
    HTMLLinkElement: class HTMLLinkElement {},
    HTMLStyleElement: class HTMLStyleElement {},
    HTMLScriptElement: class HTMLScriptElement {},
    HTMLOptionElement: class HTMLOptionElement {},
    HTMLOptGroupElement: class HTMLOptGroupElement {},
    Node: class Node {},
    Element: class Element {},
    HTMLElement: class HTMLElement {},
    Event: class Event {},
    getComputedStyle() {
      return {}
    },
  }
  ;(document as { defaultView?: unknown }).defaultView = window_
  vi.stubGlobal('window', window_)
  vi.stubGlobal('document', document)
  vi.stubGlobal('HTMLElement', window_.HTMLElement)
  // @ts-expect-error - flag global de React
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
}

// ────────────────────────────────────────────────────────────────────────────
// localStorage shim (Map-backed) — igual estilo que self-reg-draft.test.ts.
// ────────────────────────────────────────────────────────────────────────────

function makeShimStorage() {
  const data = new Map<string, string>()
  return {
    getItem: vi.fn((k: string) => (data.has(k) ? data.get(k)! : null)),
    setItem: vi.fn((k: string, v: string) => {
      const o = (globalThis as unknown as { __quota?: boolean }).__quota
      if (o) {
        const e = new Error('QuotaExceededError') as Error & { name: string }
        e.name = 'QuotaExceededError'
        throw e
      }
      data.set(k, v)
    }),
    removeItem: vi.fn((k: string) => {
      data.delete(k)
    }),
    clear: vi.fn(() => {
      data.clear()
    }),
    key: vi.fn((i: number) => Array.from(data.keys())[i] ?? null),
    get length() {
      return data.size
    },
  }
}

// ────────────────────────────────────────────────────────────────────────────
// renderHook minimalista (sin @testing-library/react).
// ────────────────────────────────────────────────────────────────────────────

interface RenderHookHandle<P, R> {
  result: { current: R | undefined }
  rerender: (next: P) => void
  unmount: () => void
}

function renderHook<P, R>(
  callback: (props: P) => R,
  initialProps: P,
): RenderHookHandle<P, R> {
  stubDom()
  // Refs externos (terminan en "Ref" para satisfacer react-hooks/immutability).
  // Se actualizan SOLO dentro de useEffect (los effects son side-effects
  // válidos; el render debe ser puro).
  const resultExternalRef: { current: R | undefined } = { current: undefined }
  const setTickExternalRef: {
    current: ((n: number | ((p: number) => number)) => void) | null
  } = { current: null }
  const currentPropsRef: { current: P } = { current: initialProps }
  let root: Root | null = null

  function TestComp() {
    const [, set] = useState(0)
    // El hook se llama durante el render (es su sitio legítimo).
    const value = callback(currentPropsRef.current)
    // Tras el render, sincronizamos a los refs externos en un effect.
    useEffect(() => {
      setTickExternalRef.current = set
      resultExternalRef.current = value
    })
    return null
  }

  act(() => {
    root = createRoot(document.createElement('div') as unknown as HTMLElement)
    root.render(createElement(TestComp))
  })

  return {
    result: resultExternalRef,
    rerender: (next: P) => {
      currentPropsRef.current = next
      act(() => {
        const setter = setTickExternalRef.current
        if (setter) setter((t: number) => t + 1)
      })
    },
    unmount: () => {
      act(() => {
        root!.unmount()
      })
    },
  }
}

// ────────────────────────────────────────────────────────────────────────────
// Helpers de tests.
// ────────────────────────────────────────────────────────────────────────────

interface Opts {
  source: 'TOKEN' | 'PUBLIC'
  scope: string
  form: Record<string, unknown>
  uploads: Record<string, unknown> | null
  enabled?: boolean
}

function validDraft(overrides: Partial<SelfRegDraft> = {}): SelfRegDraft {
  return {
    version: 1,
    savedAt: Date.now(),
    source: 'TOKEN',
    scope: 'a1b2c3d4',
    form: { razonSocial: 'ACME SA' },
    uploads: null,
    ...overrides,
  }
}

// ────────────────────────────────────────────────────────────────────────────
// Tests.
// ────────────────────────────────────────────────────────────────────────────

describe('useSelfRegDraft', () => {
  let shim: ReturnType<typeof makeShimStorage>

  beforeEach(() => {
    vi.useFakeTimers()
    shim = makeShimStorage()
    vi.stubGlobal('localStorage', shim as unknown as Storage)
    ;(globalThis as unknown as { __quota?: boolean }).__quota = false
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
    delete (globalThis as unknown as { __quota?: boolean }).__quota
  })

  describe('FIX B1 — mount con scope async (ruta TOKEN)', () => {
    it('mount con scope="" no carga draft ni setea isRestored', () => {
      // No hay draft en localStorage para esta key con scope vacío.
      const handle = renderHook<Opts, UseSelfRegDraftResult>(
        (p) => useSelfRegDraft(p),
        {
          source: 'TOKEN',
          scope: '',
          form: { razonSocial: 'X' },
          uploads: null,
        },
      )
      // FIX B1: isRestored queda en default false → modal SE MOSTRARÍA si
      // savedDraft estuviera seteado. Pero como savedDraft=null, el modal
      // no aparece aún.
      expect(handle.result.current!.savedDraft).toBeNull()
      expect(handle.result.current!.isRestored).toBe(false)
      // No debe haberse llamado a loadDraft (early return en B1).
      // loadDraft internamente hace getItem; verificamos que no se leyó
      // la key con scope vacío.
      const keyEmpty = buildDraftKey('TOKEN', '')
      expect(shim.getItem).not.toHaveBeenCalledWith(keyEmpty)
      handle.unmount()
    })

    it('scope se resuelve async CON draft → savedDraft seteado, isRestored=false (modal aparece)', () => {
      // Pre-poblar localStorage con un draft para el scope resuelto.
      const scopeResolved = 'a1b2c3d4'
      const key = buildDraftKey('TOKEN', scopeResolved)
      const existing = validDraft({ source: 'TOKEN', scope: scopeResolved, form: { razonSocial: 'ACME' } })
      saveDraft(key, existing)
      shim.getItem.mockClear()

      const handle = renderHook<Opts, UseSelfRegDraftResult>(
        (p) => useSelfRegDraft(p),
        { source: 'TOKEN', scope: '', form: {}, uploads: null },
      )
      // Tras mount con scope='', savedDraft null, isRestored false.
      expect(handle.result.current!.savedDraft).toBeNull()
      expect(handle.result.current!.isRestored).toBe(false)

      // Simular resolución async del scope: rerender con scope resuelto.
      handle.rerender({
        source: 'TOKEN',
        scope: scopeResolved,
        form: {},
        uploads: null,
      })

      // FIX B1: ahora key cambia, effect re-corre, loadDraft encuentra draft.
      // isRestored debe quedar FALSE → modal aparece (gate savedDraft && !isRestored).
      expect(handle.result.current!.savedDraft).not.toBeNull()
      expect(handle.result.current!.savedDraft!.form).toEqual({ razonSocial: 'ACME' })
      expect(handle.result.current!.isRestored).toBe(false)
      handle.unmount()
    })

    it('scope se resuelve async SIN draft → isRestored=true (autosave activo)', () => {
      const handle = renderHook<Opts, UseSelfRegDraftResult>(
        (p) => useSelfRegDraft(p),
        { source: 'TOKEN', scope: '', form: {}, uploads: null },
      )
      expect(handle.result.current!.isRestored).toBe(false)

      handle.rerender({
        source: 'TOKEN',
        scope: 'ffffffff',
        form: {},
        uploads: null,
      })
      // Sin draft en localStorage → isRestored=true (autosave arranca).
      expect(handle.result.current!.savedDraft).toBeNull()
      expect(handle.result.current!.isRestored).toBe(true)
      handle.unmount()
    })
  })

  describe('FIX B2 — post-dismiss', () => {
    it('dismissRestore → clearDraft + isRestored=true (autosave vivo desde siguiente keystroke)', () => {
      const scope = 'dismiss12'
      const key = buildDraftKey('TOKEN', scope)
      // Pre-poblar con un draft "viejo".
      saveDraft(
        key,
        validDraft({ source: 'TOKEN', scope, form: { razonSocial: 'Old' } }),
      )

      const handle = renderHook<Opts, UseSelfRegDraftResult>(
        (p) => useSelfRegDraft(p),
        { source: 'TOKEN', scope, form: { razonSocial: 'Old' }, uploads: null },
      )
      expect(handle.result.current!.savedDraft).not.toBeNull()
      expect(handle.result.current!.isRestored).toBe(false)

      // Usuario elige "Empezar de nuevo".
      act(() => {
        handle.result.current!.dismissRestore()
      })

      // FIX B2: isRestored=true (NO false). El modal desaparece porque
      // savedDraft=null (gate: savedDraft && !isRestored).
      expect(handle.result.current!.savedDraft).toBeNull()
      expect(handle.result.current!.isRestored).toBe(true)
      // clearDraft ejecutado.
      expect(shim.removeItem).toHaveBeenCalledWith(key)

      // Tras dismiss, un cambio en form debe disparar autosave (800ms).
      handle.rerender({
        source: 'TOKEN',
        scope,
        form: { razonSocial: 'Nuevo' },
        uploads: null,
      })
      act(() => {
        vi.advanceTimersByTime(DRAFT_SAVE_DEBOUNCE_MS)
      })
      // El setItem debe haberse llamado con el form nuevo.
      const lastCall = shim.setItem.mock.calls.at(-1)
      expect(lastCall).toBeDefined()
      expect(lastCall![0]).toBe(key)
      const stored = JSON.parse(lastCall![1] as string)
      expect(stored.form).toEqual({ razonSocial: 'Nuevo' })
      handle.unmount()
    })
  })

  describe('acceptRestore', () => {
    it('isRestored=true; autosave queda activo con form hidratado por el componente', () => {
      const scope = 'accept12'
      const key = buildDraftKey('TOKEN', scope)
      saveDraft(key, validDraft({ source: 'TOKEN', scope, form: { rfc: 'XAXX010101000' } }))

      const handle = renderHook<Opts, UseSelfRegDraftResult>(
        (p) => useSelfRegDraft(p),
        { source: 'TOKEN', scope, form: {}, uploads: null },
      )
      expect(handle.result.current!.savedDraft).not.toBeNull()
      expect(handle.result.current!.isRestored).toBe(false)

      act(() => {
        handle.result.current!.acceptRestore()
      })
      expect(handle.result.current!.isRestored).toBe(true)
      // savedDraft sigue expuesto (el componente lo lee para applyDraft).
      expect(handle.result.current!.savedDraft).not.toBeNull()
      handle.unmount()
    })
  })

  describe('enabled=false', () => {
    it('autosave no dispara aunque cambien form/uploads', () => {
      const scope = 'disabled'
      const handle = renderHook<Opts, UseSelfRegDraftResult>(
        (p) => useSelfRegDraft(p),
        { source: 'TOKEN', scope, form: {}, uploads: null, enabled: false },
      )
      // enabled=false → autosave effect no se suscribe al gate, no timer.
      handle.rerender({
        source: 'TOKEN',
        scope,
        form: { razonSocial: 'X' },
        uploads: null,
        enabled: false,
      })
      act(() => {
        vi.advanceTimersByTime(DRAFT_SAVE_DEBOUNCE_MS * 2)
      })
      // No se llamó a setItem (autosave bloqueado por enabled=false).
      expect(shim.setItem).not.toHaveBeenCalled()
      handle.unmount()
    })

    it('autosave SÍ dispara con enabled=true (true default)', () => {
      const scope = 'enabled'
      const handle = renderHook<Opts, UseSelfRegDraftResult>(
        (p) => useSelfRegDraft(p),
        { source: 'TOKEN', scope, form: { razonSocial: 'X' }, uploads: null },
      )
      // Mount sin draft → isRestored=true → autosave armado.
      expect(handle.result.current!.isRestored).toBe(true)
      handle.rerender({
        source: 'TOKEN',
        scope,
        form: { razonSocial: 'Cambio' },
        uploads: null,
      })
      act(() => {
        vi.advanceTimersByTime(DRAFT_SAVE_DEBOUNCE_MS)
      })
      expect(shim.setItem).toHaveBeenCalled()
      handle.unmount()
    })
  })

  describe('autosave debounce 800ms', () => {
    it('cambio de form → 800ms → saveDraft con payload correcto', () => {
      const scope = 'debounce'
      const key = buildDraftKey('TOKEN', scope)
      const handle = renderHook<Opts, UseSelfRegDraftResult>(
        (p) => useSelfRegDraft(p),
        { source: 'TOKEN', scope, form: {}, uploads: null },
      )
      handle.rerender({
        source: 'TOKEN',
        scope,
        form: { razonSocial: 'ACME', rfc: 'XAXX010101000' },
        uploads: { constanciaFiscal: { filename: 'constancia.pdf' } },
      })

      // Antes de los 800ms — NO debe haberse escrito.
      act(() => {
        vi.advanceTimersByTime(799)
      })
      expect(shim.setItem).not.toHaveBeenCalled()

      // Tras 800ms — debe escribirse.
      act(() => {
        vi.advanceTimersByTime(1)
      })
      expect(shim.setItem).toHaveBeenCalledTimes(1)
      const [calledKey, calledJson] = shim.setItem.mock.calls[0]!
      expect(calledKey).toBe(key)
      const stored = JSON.parse(calledJson as string) as SelfRegDraft
      expect(stored.version).toBe(1)
      expect(stored.source).toBe('TOKEN')
      expect(stored.scope).toBe(scope)
      expect(stored.form).toEqual({ razonSocial: 'ACME', rfc: 'XAXX010101000' })
      expect(stored.uploads).toEqual({ constanciaFiscal: { filename: 'constancia.pdf' } })
      expect(typeof stored.savedAt).toBe('number')
      handle.unmount()
    })

    it('cambio rápido antes de 800ms resetea el timer (cleanup)', () => {
      const scope = 'cleanup'
      const handle = renderHook<Opts, UseSelfRegDraftResult>(
        (p) => useSelfRegDraft(p),
        { source: 'TOKEN', scope, form: {}, uploads: null },
      )
      handle.rerender({ source: 'TOKEN', scope, form: { x: 1 }, uploads: null })
      act(() => {
        vi.advanceTimersByTime(500)
      })
      // Otro cambio a los 500ms → el timer se resetea.
      handle.rerender({ source: 'TOKEN', scope, form: { x: 2 }, uploads: null })
      act(() => {
        vi.advanceTimersByTime(500)
      })
      // Total: 1000ms desde el primer cambio, pero 500ms desde el segundo.
      // No debe haberse escrito todavía.
      expect(shim.setItem).not.toHaveBeenCalled()
      act(() => {
        vi.advanceTimersByTime(300)
      })
      // Ahora 800ms desde el segundo cambio → debe escribir.
      expect(shim.setItem).toHaveBeenCalledTimes(1)
      const stored = JSON.parse(shim.setItem.mock.calls[0]![1] as string)
      expect(stored.form).toEqual({ x: 2 })
      handle.unmount()
    })
  })

  describe('QuotaExceededError en saveDraft', () => {
    it('no rompe; el siguiente cambio vuelve a intentar', () => {
      const scope = 'quota'
      const handle = renderHook<Opts, UseSelfRegDraftResult>(
        (p) => useSelfRegDraft(p),
        { source: 'TOKEN', scope, form: {}, uploads: null },
      )
      // Activar quota exceeded.
      ;(globalThis as unknown as { __quota?: boolean }).__quota = true
      handle.rerender({ source: 'TOKEN', scope, form: { a: 1 }, uploads: null })
      act(() => {
        vi.advanceTimersByTime(DRAFT_SAVE_DEBOUNCE_MS)
      })
      // setItem fue llamado pero lanzó (saveDraft retornó false, no throw).
      expect(shim.setItem).toHaveBeenCalled()
      // El hook sigue vivo: un nuevo cambio intenta de nuevo.
      ;(globalThis as unknown as { __quota?: boolean }).__quota = false
      handle.rerender({ source: 'TOKEN', scope, form: { a: 2 }, uploads: null })
      act(() => {
        vi.advanceTimersByTime(DRAFT_SAVE_DEBOUNCE_MS)
      })
      // setItem llamado al menos 2 veces (1 fallido + 1 exitoso).
      expect(shim.setItem.mock.calls.length).toBeGreaterThanOrEqual(2)
      handle.unmount()
    })
  })

  describe('clearOnSubmit', () => {
    it('clearDraft(key) ejecutado', () => {
      const scope = 'submit'
      const key = buildDraftKey('TOKEN', scope)
      saveDraft(key, validDraft({ source: 'TOKEN', scope }))

      const handle = renderHook<Opts, UseSelfRegDraftResult>(
        (p) => useSelfRegDraft(p),
        { source: 'TOKEN', scope, form: {}, uploads: null },
      )
      shim.removeItem.mockClear()
      act(() => {
        handle.result.current!.clearOnSubmit()
      })
      expect(shim.removeItem).toHaveBeenCalledWith(key)
      handle.unmount()
    })
  })

  describe('FIX-20260805-04-HOTFIX — PUBLIC cross-session', () => {
    // Helper: añade crypto.getRandomValues al window stubeado por stubDom()
    // (que es el que existe en este test file tras renderHook). Es idempotente
    // y barato de llamar entre mounts.
    function ensureWindow() {
      const w = (globalThis as { window?: unknown }).window as
        | {
            crypto?: { getRandomValues: (a: Uint8Array) => Uint8Array }
            localStorage?: Storage
          }
        | undefined
      if (!w) return
      // localStorage debe apuntar al shim de la suite (no al de stubDom,
      // que no existe). getOrCreatePublicScope() usa `window.localStorage`.
      w.localStorage = shim as unknown as Storage
      w.crypto = {
        getRandomValues(arr: Uint8Array) {
          for (let i = 0; i < arr.length; i++) arr[i] = Math.floor(Math.random() * 256)
          return arr
        },
      }
    }

    it('mount 1 con PUBLIC crea scope persistido; mount 2 reusa scope y recupera draft (modal aparece)', () => {
      // ── Mount 1: localStorage limpio. ──
      // El componente monta con scope='' (todavía no resolvió vía useEffect).
      // Simulamos lo que hace SelfRegistrationForm: en useEffect, si source=PUBLIC,
      // llama getOrCreatePublicScope() y setea publicScope.
      const handle1 = renderHook<Opts, UseSelfRegDraftResult>(
        (p) => useSelfRegDraft(p),
        { source: 'PUBLIC', scope: '', form: {}, uploads: null },
      )
      ensureWindow()
      // Resolver scope igual que hace el useEffect del componente.
      const scope1 = getOrCreatePublicScope()
      expect(scope1).toMatch(/^[A-Za-z0-9_-]{8}$/)
      // Debe haberse persistido bajo la clave canónica.
      expect(shim.getItem(PUBLIC_SCOPE_KEY)).toBe(scope1)

      // Re-render con scope resuelto y form con datos → autosave dispara tras 800ms.
      handle1.rerender({
        source: 'PUBLIC',
        scope: scope1,
        form: { razonSocial: 'Cross-Session SA' },
        uploads: null,
      })
      act(() => {
        vi.advanceTimersByTime(DRAFT_SAVE_DEBOUNCE_MS)
      })
      const key1 = buildDraftKey('PUBLIC', scope1)
      expect(shim.setItem).toHaveBeenCalledWith(key1, expect.any(String))
      handle1.unmount()

      // ── Mount 2: "nueva sesión" — nuevo render del hook, mismo localStorage. ──
      shim.setItem.mockClear()
      const handle2 = renderHook<Opts, UseSelfRegDraftResult>(
        (p) => useSelfRegDraft(p),
        { source: 'PUBLIC', scope: '', form: {}, uploads: null },
      )
      ensureWindow()
      // El nuevo mount parte con scope vacío (igual que el componente real).
      expect(handle2.result.current!.savedDraft).toBeNull()

      // Resolver scope vía getOrCreatePublicScope (useEffect del componente).
      const scope2 = getOrCreatePublicScope()
      // El scope debe ser IDÉNTICO al de mount 1 (cross-session persistence).
      expect(scope2).toBe(scope1)

      // Re-render con scope resuelto → el hook debe encontrar el draft guardado
      // en mount 1 y exponerlo vía savedDraft (modal aparecería: savedDraft &&
      // !isRestored).
      handle2.rerender({
        source: 'PUBLIC',
        scope: scope2,
        form: {},
        uploads: null,
      })
      expect(handle2.result.current!.savedDraft).not.toBeNull()
      expect(handle2.result.current!.savedDraft!.form).toEqual({ razonSocial: 'Cross-Session SA' })
      expect(handle2.result.current!.savedDraft!.source).toBe('PUBLIC')
      expect(handle2.result.current!.savedDraft!.scope).toBe(scope1)
      expect(handle2.result.current!.isRestored).toBe(false)
      handle2.unmount()
    })
  })
})
