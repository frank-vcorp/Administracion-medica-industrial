/** Tipos de input donde el corrector del navegador no aplica o estorba (códigos, credenciales). */
export const SPELLCHECK_SKIP_INPUT_TYPES = new Set([
  'password',
  'email',
  'number',
  'tel',
  'url',
  'search',
  'hidden',
  'checkbox',
  'radio',
  'file',
  'date',
  'datetime-local',
  'time',
  'month',
  'week',
  'color',
  'range',
])

export function shouldEnableSpellCheck(el: HTMLInputElement | HTMLTextAreaElement): boolean {
  if (el instanceof HTMLInputElement && SPELLCHECK_SKIP_INPUT_TYPES.has(el.type)) {
    return false
  }
  if (el.dataset.spellcheck === 'off') return false
  if (el.getAttribute('spellcheck') === 'false') return false
  if (el.readOnly) return false
  return true
}

/** Activa corrector nativo del navegador (diccionario según `lang` del documento, p. ej. es-MX). */
export function applySpellCheckDefault(el: Element): void {
  if (!(el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement)) return
  if (!shouldEnableSpellCheck(el)) return
  el.spellCheck = true
}

export function applySpellCheckUnder(root: ParentNode): void {
  if (root instanceof HTMLInputElement || root instanceof HTMLTextAreaElement) {
    applySpellCheckDefault(root)
  }
  root.querySelectorAll('input, textarea').forEach(applySpellCheckDefault)
}
