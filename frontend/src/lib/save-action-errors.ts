import { ZodError } from 'zod'

/** Falla estándar de server actions con `success: false`. */
export type SaveActionFailure = {
  success: false
  error: string
  fieldErrors?: Record<string, string[]>
  technicalDetail?: string
}

/** Falla estándar con convención `{ ok: false }`. */
export type OkSaveActionFailure = {
  ok: false
  error: string
  fieldErrors?: Record<string, string[]>
  technicalDetail?: string
  code?: string
}

export function zodErrorToFieldErrors(error: ZodError): Record<string, string[]> {
  const fieldErrors: Record<string, string[]> = {}
  for (const issue of error.issues) {
    const key = issue.path.length > 0 ? issue.path.map(String).join('.') : '_form'
    if (!fieldErrors[key]) fieldErrors[key] = []
    fieldErrors[key].push(issue.message)
  }
  return fieldErrors
}

export function firstFieldErrorMessage(fieldErrors: Record<string, string[]>): string | undefined {
  const firstKey = Object.keys(fieldErrors)[0]
  if (!firstKey) return undefined
  return fieldErrors[firstKey]?.[0]
}

export function summaryFromZodError(
  error: ZodError,
  fallback = 'Revisa los datos ingresados.',
): string {
  const fieldErrors = zodErrorToFieldErrors(error)
  return firstFieldErrorMessage(fieldErrors) ?? fallback
}

export function failureFromZod(
  error: ZodError,
  options?: { summary?: string; technicalDetail?: string },
): SaveActionFailure {
  const fieldErrors = zodErrorToFieldErrors(error)
  return {
    success: false,
    error: options?.summary ?? summaryFromZodError(error),
    fieldErrors,
    technicalDetail: options?.technicalDetail,
  }
}

export function failureFromFieldErrors(
  fieldErrors: Record<string, string[]>,
  error: string,
  technicalDetail?: string,
): SaveActionFailure {
  return {
    success: false,
    error,
    fieldErrors,
    technicalDetail,
  }
}

export function failureFromZodOk(
  error: ZodError,
  options?: { summary?: string; technicalDetail?: string; code?: string },
): OkSaveActionFailure {
  const fieldErrors = zodErrorToFieldErrors(error)
  return {
    ok: false,
    error: options?.summary ?? summaryFromZodError(error),
    fieldErrors,
    technicalDetail: options?.technicalDetail,
    code: options?.code,
  }
}

/** Detalle técnico acotado; no incluir payloads ni PHI. */
export function safeActionTechnicalDetail(err: unknown, maxLen = 400): string | undefined {
  if (err instanceof Error && err.message.trim()) {
    const msg = err.message.trim()
    return msg.length > maxLen ? `${msg.slice(0, maxLen - 1)}…` : msg
  }
  if (typeof err === 'string' && err.trim()) {
    const msg = err.trim()
    return msg.length > maxLen ? `${msg.slice(0, maxLen - 1)}…` : msg
  }
  return undefined
}
