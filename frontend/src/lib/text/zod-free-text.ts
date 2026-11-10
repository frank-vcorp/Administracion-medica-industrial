import { z } from 'zod'
import { applySentenceCaseIfAllCaps } from '@/lib/text/sentence-case'

/** Cadena con trim, sin normalización de mayúsculas (IDs, cédulas, enums). */
export const zTrimmedString = z.string().trim()

/** Texto libre clínico / citas: trim + oración forzada solo si todo está en MAYÚSCULAS. */
export const zFreeTextString = zTrimmedString.transform(applySentenceCaseIfAllCaps)

export { applySentenceCaseIfAllCaps }
