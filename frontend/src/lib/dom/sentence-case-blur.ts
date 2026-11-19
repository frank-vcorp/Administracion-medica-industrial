import { applyProperNameCase, applySentenceCase } from '@/lib/text/sentence-case'
import { shouldEnableSpellCheck } from '@/lib/dom/spell-check'

export const SENTENCE_CASE_INPUT_DEBOUNCE_MS = 400

export type SentenceCaseControlMode = 'off' | 'sentence' | 'proper-name'

const PROPER_NAME_FIELD_NAMES = new Set([
  'firstname',
  'lastname',
  'fullname',
  'nombre',
  'apellidos',
  'apellido',
  'medico_nombre',
  'medico_evaluador',
  'medico_revisor',
  'medico_universidad',
  'lugar_expedicion',
  'lugar_nacimiento',
  'domicilio',
  'domicilio_atencion',
  'domiciliocalle',
  'direccion',
  'address',
  'ciudad',
  'city',
  'municipio',
  'estado_domicilio',
  'colonia',
  'pais',
  'contacto_emergencia',
  'declaracion_protesta_nombre',
  'razonsocial',
  'nombrecomercial',
  'empresa_anterior_1',
  'empresa_anterior_2',
])

export function resolveSentenceCaseMode(
  el: HTMLInputElement | HTMLTextAreaElement,
): SentenceCaseControlMode {
  const attr = el.dataset.sentenceCase
  if (attr === 'off') return 'off'
  if (attr === 'proper-name') return 'proper-name'
  const fieldKey = (el.name || el.id || '').trim().toLowerCase()
  if (fieldKey && PROPER_NAME_FIELD_NAMES.has(fieldKey)) {
    return 'proper-name'
  }
  return 'sentence'
}

/** Mismas exclusiones que el corrector global (tipos, data-spellcheck=off, data-sentence-case=off, readonly). */
export function shouldApplySentenceCaseOnBlur(
  el: HTMLInputElement | HTMLTextAreaElement,
): boolean {
  if (el.dataset.sentenceCaseManaged === 'react') return false
  if (el.dataset.sentenceCase === 'off') return false
  if (!shouldEnableSpellCheck(el)) return false
  if (el instanceof HTMLInputElement) {
    const t = (el.type || 'text').toLowerCase()
    return t === 'text' || t === 'search'
  }
  return true
}

function setNativeValue(el: HTMLInputElement | HTMLTextAreaElement, next: string): void {
  const proto =
    el instanceof HTMLInputElement ? HTMLInputElement.prototype : HTMLTextAreaElement.prototype
  const descriptor = Object.getOwnPropertyDescriptor(proto, 'value')
  descriptor?.set?.call(el, next)
}

function restoreSelection(
  el: HTMLInputElement | HTMLTextAreaElement,
  prev: string,
  next: string,
  selStart: number | null,
  selEnd: number | null,
): void {
  if (selStart === null || selEnd === null) return
  if (next.length === prev.length) {
    el.setSelectionRange(selStart, selEnd)
    return
  }
  const atEnd = selStart === prev.length && selEnd === prev.length
  if (atEnd) {
    el.setSelectionRange(next.length, next.length)
    return
  }
  const ratio = prev.length > 0 ? selStart / prev.length : 0
  const pos = Math.min(Math.round(ratio * next.length), next.length)
  el.setSelectionRange(pos, pos)
}

/**
 * Normaliza texto libre a modo oración (o nombre propio en campos de persona/domicilio/ciudad).
 * Idempotente con controles clínicos React.
 */
export function applySentenceCaseToControl(el: HTMLInputElement | HTMLTextAreaElement): void {
  if (!shouldApplySentenceCaseOnBlur(el)) return
  const mode = resolveSentenceCaseMode(el)
  if (mode === 'off') return
  const current = el.value
  const next = mode === 'proper-name' ? applyProperNameCase(current) : applySentenceCase(current)
  if (next === current) return

  const selStart = el.selectionStart
  const selEnd = el.selectionEnd
  setNativeValue(el, next)
  el.dispatchEvent(new Event('input', { bubbles: true }))
  restoreSelection(el, current, next, selStart, selEnd)
}

/** @deprecated alias de {@link applySentenceCaseToControl} */
export function applySentenceCaseOnBlur(el: HTMLInputElement | HTMLTextAreaElement): void {
  applySentenceCaseToControl(el)
}

export function isSentenceCaseBlurTarget(
  target: EventTarget | null,
): target is HTMLInputElement | HTMLTextAreaElement {
  if (!(target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement)) {
    return false
  }
  return shouldApplySentenceCaseOnBlur(target)
}

const debounceTimers = new WeakMap<HTMLInputElement | HTMLTextAreaElement, ReturnType<typeof setTimeout>>()

export function clearSentenceCaseDebounce(el: HTMLInputElement | HTMLTextAreaElement): void {
  const t = debounceTimers.get(el)
  if (t !== undefined) {
    clearTimeout(t)
    debounceTimers.delete(el)
  }
}

export function scheduleSentenceCaseOnInput(el: HTMLInputElement | HTMLTextAreaElement): void {
  if (!shouldApplySentenceCaseOnBlur(el)) return
  clearSentenceCaseDebounce(el)
  const timer = setTimeout(() => {
    debounceTimers.delete(el)
    applySentenceCaseToControl(el)
  }, SENTENCE_CASE_INPUT_DEBOUNCE_MS)
  debounceTimers.set(el, timer)
}
