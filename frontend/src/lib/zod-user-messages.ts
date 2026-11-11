import type { ZodIssue } from 'zod'
import { fieldKeyToPlainLanguage } from '@/lib/zod-field-labels'

const ENGLISH_ZOD_PREFIX =
  /^(Too small|Too big|Invalid|Required|Expected|string|Number must|Array must)/i

/** True si el mensaje parece copy clínico en español (no re-traducir). */
function isLikelySpanishMessage(message: string): boolean {
  const m = message.trim()
  if (!m) return false
  if (/[áéíóúñ¿¡]/i.test(m)) return true
  if (ENGLISH_ZOD_PREFIX.test(m)) return false
  return /\b(debe|indica|selecciona|obligatorio|inválid|caracteres|campo|falta)\b/i.test(m)
}

/**
 * Traduce issues Zod por defecto (inglés) a mensajes claros en español.
 * Mensajes custom del schema se conservan.
 */
export function formatZodIssueMessage(issue: ZodIssue): string {
  const raw = typeof issue.message === 'string' ? issue.message.trim() : ''
  if (raw && isLikelySpanishMessage(raw)) return raw

  if (issue.code === 'too_small' && 'origin' in issue) {
    const origin = issue.origin
    if (origin === 'string') {
      const min = typeof issue.minimum === 'number' ? issue.minimum : 1
      if (min <= 1) return 'Campo obligatorio.'
      return `Debe tener al menos ${min} caracteres.`
    }
    if (origin === 'number' || origin === 'int' || origin === 'bigint') {
      return `El valor debe ser al menos ${String(issue.minimum)}.`
    }
    if (origin === 'array' || origin === 'set') {
      return 'Faltan elementos obligatorios en la lista.'
    }
  }

  if (issue.code === 'too_big' && 'origin' in issue && issue.origin === 'string') {
    return `Debe tener como máximo ${String(issue.maximum)} caracteres.`
  }

  if (issue.code === 'invalid_type') {
    return 'El valor no tiene el formato esperado.'
  }

  if (issue.code === 'invalid_value') {
    return 'Selecciona una opción válida.'
  }

  if (/^Too small:/i.test(raw)) {
    const m = raw.match(/>=\s*(\d+)/)
    if (m) return `Debe tener al menos ${m[1]} caracteres.`
    return 'El texto es demasiado corto.'
  }

  if (/^Too big:/i.test(raw)) {
    const m = raw.match(/<=\s*(\d+)/)
    if (m) return `Debe tener como máximo ${m[1]} caracteres.`
    return 'El texto es demasiado largo.'
  }

  if (/^Invalid/i.test(raw)) {
    return 'El valor no es válido.'
  }

  return raw || 'Revisa este campo.'
}

export function formatZodMessageString(message: string): string {
  return formatZodIssueMessage({ code: 'custom', message, path: [] } as ZodIssue)
}

/** Una línea «campo · mensaje» para banners (modo oración en la etiqueta). */
export function formatZodFieldErrorLine(fieldKey: string, message: string): string {
  const label = fieldKeyToPlainLanguage(fieldKey)
  const msg = formatZodMessageString(message)
  if (label === 'Formulario') return msg
  return `${label}: ${msg}`
}

/** Mensaje estilo captura: «Falta: integración diagnóstica (mínimo 3 caracteres).» */
export function formatZodRequiredFieldBanner(fieldKey: string, minChars?: number): string {
  const label = fieldKeyToPlainLanguage(fieldKey)
  const detail =
    minChars != null && minChars > 1
      ? `(mínimo ${minChars} caracteres)`
      : '(campo obligatorio)'
  return `Falta: ${label.toLocaleLowerCase('es')} ${detail}.`
}
