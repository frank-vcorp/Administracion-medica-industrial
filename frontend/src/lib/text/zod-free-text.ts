import { z } from 'zod'
import { applySentenceCase } from '@/lib/text/sentence-case'

/** Cadena con trim, sin normalización de mayúsculas (IDs, cédulas, enums). */
export const zTrimmedString = z.string().trim()

/** Texto libre clínico / citas: trim + modo oración (es). */
export const zFreeTextString = zTrimmedString.transform(applySentenceCase)

/** Texto libre con longitud máxima (y mínima opcional) + modo oración. */
export function zFreeTextMax(max: number, min = 0) {
  const base = z.string().trim().max(max, `Máximo ${max} caracteres`)
  return (min > 0 ? base.min(min) : base).transform(applySentenceCase)
}

export function zFreeTextMaxOptional(max: number) {
  return zFreeTextMax(max).optional()
}

export function zFreeTextMaxNullable(max: number) {
  return zFreeTextMax(max).optional().nullable()
}

export { applySentenceCase, applySentenceCaseIfAllCaps } from '@/lib/text/sentence-case'
