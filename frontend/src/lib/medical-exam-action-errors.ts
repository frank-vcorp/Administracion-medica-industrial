import { z } from 'zod'
import type { ZodIssue } from 'zod'
import { mapSaveClinicalFailure, mapUserFacingError, type UserFacingError } from '@/lib/user-facing-error'

const remoteZodIssuesSchema = z.object({
  issues: z.array(z.unknown()),
})

/**
 * Los server actions de examen médico serializan `technicalDetail` como JSON con `issues` (Zod) para poder rehidratar en el cliente.
 */
export function parseMedicalExamZodIssues(technicalDetail: string | undefined): z.ZodError | null {
  if (!technicalDetail?.trim()) return null
  try {
    const parsed: unknown = JSON.parse(technicalDetail)
    const data = remoteZodIssuesSchema.safeParse(parsed)
    if (!data.success) return null
    return new z.ZodError(data.data.issues as ZodIssue[])
  } catch {
    return null
  }
}

type MedicalExamActionFailure = {
  success: false
  error: string
  technicalDetail?: string
}

export function mapMedicalExamActionFailure(
  res: MedicalExamActionFailure,
  context: string,
): UserFacingError {
  const zErr = parseMedicalExamZodIssues(res.technicalDetail)
  if (zErr) {
    return mapUserFacingError({ error: zErr, message: res.error, context })
  }
  return mapSaveClinicalFailure(
    { success: false, error: res.error, technicalDetail: res.technicalDetail },
    { context },
  )
}
