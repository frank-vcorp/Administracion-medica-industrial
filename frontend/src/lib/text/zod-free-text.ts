import { z } from 'zod'
import { applySentenceCase } from '@/lib/text/sentence-case'

/** Cadena con trim, sin normalización de mayúsculas (IDs, cédulas, enums). */
export const zTrimmedString = z.string().trim()

/** Texto libre clínico / citas: trim + modo oración (es). */
export const zFreeTextString = zTrimmedString.transform(applySentenceCase)

export { applySentenceCase, applySentenceCaseIfAllCaps } from '@/lib/text/sentence-case'
