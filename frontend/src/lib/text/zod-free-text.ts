import { z } from 'zod'
import { applySentenceCase } from '@/lib/text/sentence-case'

/** Cadena con trim, sin normalización de mayúsculas (IDs, cédulas, enums). */
export const zTrimmedString = z.string().trim()

/** Texto libre clínico / citas: trim + modo oración (es). */
export const zFreeTextString = zTrimmedString.transform(applySentenceCase)

/** Texto libre con longitud máxima y transform opcional. */
export function zFreeTextMax(max: number) {
  return z.string().trim().max(max).transform(applySentenceCase)
}

export function zFreeTextMaxOptional(max: number) {
  return zFreeTextMax(max).optional()
}

export function zFreeTextMaxNullable(max: number) {
  return zFreeTextMax(max).optional().nullable()
}

export { applySentenceCase, applySentenceCaseIfAllCaps } from '@/lib/text/sentence-case'
