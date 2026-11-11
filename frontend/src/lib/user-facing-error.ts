import { z } from 'zod'
import { fieldKeyToPlainLanguage, zodPathToPlainLanguage } from '@/lib/zod-field-labels'
import { formatZodIssueMessage, formatZodMessageString } from '@/lib/zod-user-messages'

export type UserFacingErrorKind = 'validation' | 'usage' | 'technical'

export type UserFacingError = {
  kind: UserFacingErrorKind
  title: string
  userMessage: string
  technicalDetail?: string
}

const HTTP_STATUS_MESSAGES_ES: Partial<Record<number, string>> = {
  400: 'La solicitud no es válida.',
  401: 'Tu sesión expiró o no estás autenticado. Vuelve a iniciar sesión.',
  403: 'No tienes permiso para esta acción.',
  404: 'No se encontró el recurso solicitado.',
  408: 'La operación tardó demasiado. Intenta de nuevo.',
  409: 'Otro usuario o proceso actualizó estos datos. Actualiza e intenta de nuevo.',
  413: 'Los datos enviados son demasiado grandes.',
  422: 'Revisa los datos ingresados.',
  429: 'Demasiadas solicitudes. Espera un momento e intenta de nuevo.',
  500: 'El servidor no pudo completar la acción. Intenta de nuevo o contacta a soporte.',
  502: 'El servicio no respondió correctamente. Intenta de nuevo.',
  503: 'El servicio no está disponible por el momento. Intenta más tarde.',
  504: 'La operación tardó demasiado. Intenta de nuevo.',
}

type IssueLike = { path: PropertyKey[]; message?: unknown; code?: string }

function summarizeZodIssues(issues: readonly IssueLike[]): string {
  const lines: string[] = []
  const seen = new Set<string>()
  for (const issue of issues) {
    const pathStr = zodPathToPlainLanguage(issue.path as (string | number)[])
  const msg =
    typeof issue.message === 'string'
      ? formatZodIssueMessage(issue as z.ZodIssue)
      : ''
    const line = msg ? `${pathStr}: ${msg}` : pathStr
    if (seen.has(line)) continue
    seen.add(line)
    lines.push(line)
    if (lines.length >= 4) break
  }
  return lines.join('\n')
}

function classifyFromMessage(msg: string): UserFacingErrorKind {
  const m = msg.toLowerCase()
  if (
    m.includes('error de servidor') ||
    m.includes('error del servidor') ||
    m.includes('servidor no pudo') ||
    m.includes('problema del servidor') ||
    m.includes('servidor o de red') ||
    m.includes('falló la conexión') ||
    m.includes('sin conexión')
  ) {
    return 'technical'
  }
  if (
    m.includes('inválid') ||
    m.includes('invalid') ||
    m.includes('validación') ||
    m.includes('validation') ||
    m.includes('formato') ||
    m.includes('esperado') ||
    m.includes('required') ||
    m.includes('obligator') ||
    m.includes('debe') ||
    m.includes('too small') ||
    m.includes('too big')
  ) {
    return 'validation'
  }
  if (
    m.includes('completa') ||
    m.includes('completar') ||
    m.includes('falta') ||
    m.includes('faltan') ||
    m.includes('antes de') ||
    m.includes('agrega') ||
    m.includes('ingresa') ||
    m.includes('incompleta') ||
    m.includes('incompleto') ||
    m.includes('parámetros incompletos') ||
    m.includes('parametros incompletos')
  ) {
    return 'usage'
  }
  if (
    m.includes('no tienes permiso') ||
    m.includes('permisos') ||
    m.includes('no autenticado') ||
    m.includes('sesión') ||
    m.includes('no pertenece') ||
    m.includes('no coincide') ||
    m.includes('no es un') ||
    m.includes('no es una') ||
    m.includes('este estudio no') ||
    m.includes('paciente no coincide')
  ) {
    return 'usage'
  }
  return 'technical'
}

function isProbablyTechnicalMessage(msg: string): boolean {
  const m = msg.toLowerCase()
  return (
    m.includes('prisma') ||
    m.includes('postgres') ||
    m.includes('sql') ||
    m.includes('socket hang up') ||
    m.includes('econnreset') ||
    m.includes('econnrefused') ||
    m.includes('timeout') ||
    m.includes('stack') ||
    m.includes('internal server') ||
    m.includes('fetch failed') ||
    m.includes('network') ||
    m.includes('red:') ||
    /\n/.test(msg)
  )
}

function titleForKind(kind: UserFacingErrorKind): string {
  switch (kind) {
    case 'validation':
      return 'Revisa los datos'
    case 'usage':
      return 'Acción no permitida o datos incompletos'
    default:
      return 'No se pudo guardar'
  }
}

function unwrapCauseChain(err: unknown): unknown[] {
  const out: unknown[] = []
  let cur: unknown = err
  const guard = 8
  for (let i = 0; i < guard && cur; i++) {
    out.push(cur)
    if (cur instanceof Error && 'cause' in cur && (cur as Error & { cause?: unknown }).cause) {
      cur = (cur as Error & { cause?: unknown }).cause
    } else {
      break
    }
  }
  return out
}

function technicalDetailFromUnknown(err: unknown): string | undefined {
  if (err instanceof Error && err.message.trim()) {
    const msg = err.message.trim()
    if (msg.length > 800) return `${msg.slice(0, 797)}…`
    return msg
  }
  if (typeof err === 'string' && err.trim()) {
    const msg = err.trim()
    return msg.length > 800 ? `${msg.slice(0, 797)}…` : msg
  }
  return undefined
}

export type MapUserFacingErrorInput = {
  /** Raw error (Error, string, ZodError, JSON object, etc.) */
  error?: unknown
  /** Human-readable message from server or caught block */
  message?: string
  fieldErrors?: Record<string, string[]>
  /** HTTP status when known (e.g. fetch response) */
  httpStatus?: number
  /** Short context for technical detail (e.g. "saveCertificadoMedico") — not shown as main message */
  context?: string
  /** Detalle devuelto por el servidor (mensaje interno seguro para soporte) */
  serverTechnicalDetail?: string
}

function mergeFieldErrors(fieldErrors: Record<string, string[]> | undefined): string | undefined {
  if (!fieldErrors || Object.keys(fieldErrors).length === 0) return undefined
  const lines: string[] = []
  for (const [key, msgs] of Object.entries(fieldErrors)) {
    const label = fieldKeyToPlainLanguage(key)
    for (const m of msgs) {
      const line = `${label}: ${formatZodMessageString(m)}`
      if (!lines.includes(line)) lines.push(line)
      if (lines.length >= 6) return lines.join('\n')
    }
  }
  return lines.join('\n')
}

/**
 * Normaliza errores de API/guardado en mensajes claros para personal de clínica.
 * - Validación Zod → kind `validation`, lista legible por campo.
 * - Mensajes de uso/permisos/incompletos → kind `usage`.
 * - Fallas de red/servidor/excepciones → kind `technical` con detalle opcional.
 */
export function mapUserFacingError(input: MapUserFacingErrorInput = {}): UserFacingError {
  const { error, message, fieldErrors, httpStatus, context, serverTechnicalDetail } = input

  if (error instanceof z.ZodError) {
    const userMessage = summarizeZodIssues(error.issues)
    const fe = mergeFieldErrors(fieldErrors)
    const main = fe ?? userMessage
    const techParts = [context && `[${context}]`, serverTechnicalDetail?.trim()].filter(Boolean) as string[]
    const technicalDetail =
      techParts.length > 0 && techParts.join(' · ') !== main ? techParts.join(' · ') : undefined
    return {
      kind: 'validation',
      title: titleForKind('validation'),
      userMessage: main,
      technicalDetail,
    }
  }

  const fieldBlock = mergeFieldErrors(fieldErrors)
  const msgFromInput =
    typeof message === 'string' && message.trim()
      ? message.trim()
      : error instanceof Error && error.message.trim()
        ? error.message.trim()
        : typeof error === 'string' && error.trim()
          ? error.trim()
          : undefined

  const statusSummary =
    httpStatus != null && HTTP_STATUS_MESSAGES_ES[httpStatus]
      ? HTTP_STATUS_MESSAGES_ES[httpStatus]
      : undefined

  if (msgFromInput) {
    let kind =
      fieldBlock && /\b(revisa|corrije|corrige|completa)\b/i.test(msgFromInput)
        ? 'validation'
        : classifyFromMessage(msgFromInput)
    if (
      kind === 'technical' &&
      !isProbablyTechnicalMessage(msgFromInput) &&
      !serverTechnicalDetail?.trim() &&
      httpStatus == null
    ) {
      kind = 'usage'
    }
    const title = titleForKind(kind)
    let userMessage = msgFromInput
    if (fieldBlock && kind === 'validation') {
      userMessage = fieldBlock
    } else if (fieldBlock && kind !== 'technical') {
      userMessage = `${msgFromInput}\n${fieldBlock}`
    }

    if (kind === 'technical' && statusSummary) {
      userMessage = statusSummary
    }

    const technicalParts: string[] = []
    if (context) technicalParts.push(`[${context}]`)
    if (httpStatus != null) technicalParts.push(`HTTP ${httpStatus}`)
    if (serverTechnicalDetail?.trim()) technicalParts.push(serverTechnicalDetail.trim())
    if (kind === 'technical' || isProbablyTechnicalMessage(msgFromInput)) {
      const detail =
        technicalDetailFromUnknown(error) ??
        (msgFromInput !== userMessage ? msgFromInput : undefined) ??
        msgFromInput
      if (detail) technicalParts.push(detail)
    } else if (fieldBlock && kind !== 'validation') {
      technicalParts.push(fieldBlock)
    }

    let technicalDetail = technicalParts.filter(Boolean).join(' · ') || undefined

    if (technicalDetail === userMessage) {
      technicalDetail =
        [context && `[${context}]`, serverTechnicalDetail?.trim(), httpStatus != null && `HTTP ${httpStatus}`]
          .filter(Boolean)
          .join(' · ') || undefined
    }

    return {
      kind,
      title,
      userMessage,
      technicalDetail: technicalDetail && technicalDetail !== userMessage ? technicalDetail : undefined,
    }
  }

  if (fieldBlock) {
    return {
      kind: 'validation',
      title: titleForKind('validation'),
      userMessage: fieldBlock,
      technicalDetail: context ? `[${context}] ${fieldBlock}` : undefined,
    }
  }

  const fallback =
    statusSummary ?? 'Ocurrió un error al guardar. Si persiste, copia el detalle técnico para soporte.'
  const chain = error != null ? unwrapCauseChain(error) : []
  const tech =
    chain.map(technicalDetailFromUnknown).filter(Boolean).join(' | ') ||
    (httpStatus != null ? `HTTP ${httpStatus}` : undefined)

  return {
    kind: 'technical',
    title: titleForKind('technical'),
    userMessage: fallback,
    technicalDetail: [context && `[${context}]`, tech].filter(Boolean).join(' · ') || undefined,
  }
}

/** Resultado de acciones clínicas con `success: false` y mensaje en `error`. */
export type SaveClinicalFailure = {
  success: false
  error: string
  fieldErrors?: Record<string, string[]>
  technicalDetail?: string
}

export function mapSaveClinicalFailure(
  result: SaveClinicalFailure,
  options?: { context?: string },
): UserFacingError {
  return mapSaveActionFailure(result, options)
}

/** Resultado de guardado (clínica u operaciones) con mensaje en `error`. */
export type SaveActionFailureInput = {
  error: string
  fieldErrors?: Record<string, string[]>
  technicalDetail?: string
}

export function mapSaveActionFailure(
  result: SaveActionFailureInput,
  options?: { context?: string },
): UserFacingError {
  return mapUserFacingError({
    message: result.error,
    fieldErrors: result.fieldErrors,
    context: options?.context,
    serverTechnicalDetail: result.technicalDetail,
  })
}

export function userFacingErrorAriaLabel(kind: UserFacingErrorKind): string {
  switch (kind) {
    case 'validation':
      return 'Error de validación'
    case 'usage':
      return 'Aviso'
    default:
      return 'Error técnico'
  }
}

export function splitUserFacingMessageLines(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
}
