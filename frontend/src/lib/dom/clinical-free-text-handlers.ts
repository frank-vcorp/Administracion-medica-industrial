import { applySentenceCase } from '@/lib/text/sentence-case'
import { SENTENCE_CASE_INPUT_DEBOUNCE_MS } from '@/lib/dom/sentence-case-blur'

/** Normaliza texto libre clínico (modo oración). */
export function normalizeClinicalFreeTextValue(value: string): string {
  return applySentenceCase(value)
}

export function shouldNormalizeClinicalFreeText(value: string): boolean {
  return normalizeClinicalFreeTextValue(value) !== value
}

/** Programa normalización; devuelve función para cancelar el timer pendiente. */
export function scheduleClinicalFreeTextNormalize(
  getValue: () => string,
  onNormalized: (next: string) => void,
  debounceMs = SENTENCE_CASE_INPUT_DEBOUNCE_MS,
): () => void {
  const timer = setTimeout(() => {
    const raw = getValue()
    const next = normalizeClinicalFreeTextValue(raw)
    if (next !== raw) onNormalized(next)
  }, debounceMs)
  return () => clearTimeout(timer)
}
