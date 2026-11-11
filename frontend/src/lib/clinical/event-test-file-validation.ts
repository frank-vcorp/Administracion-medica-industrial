/**
 * Validación de archivos adjuntos a estudios en Papeleta (pruebas clínicas).
 * Compartido entre cliente (previo al upload) y servidor (uploadEventTestFile).
 */
import type { CanonicalAIStudyType, StudyTestRef } from '@/lib/study-ai'
import { getCanonicalAIStudyType, normalizeStudyTypeForBackend } from '@/lib/study-ai'

export const EVENT_TEST_UPLOAD_MAX_BYTES = 20 * 1024 * 1024

export type EventTestFileValidationErrorCode =
  | 'FILE_TOO_LARGE'
  | 'FILE_FORMAT_MISMATCH'

export type EventTestFileValidationResult = {
  valid: boolean
  errorCode?: EventTestFileValidationErrorCode
  message?: string
}

const BASE_DOCUMENT_EXTENSIONS = ['pdf', 'png', 'jpg', 'jpeg'] as const
const BASE_DOCUMENT_MIMES = [
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/jpg',
] as const

const XML_EXTENSIONS = ['xml'] as const
const XML_MIMES = ['application/xml', 'text/xml'] as const

/** Reglas por tipo canónico → formatos aceptados en el dropzone de Papeleta. */
export const STUDY_UPLOAD_FILE_RULES: Record<
  CanonicalAIStudyType,
  { extensions: readonly string[]; mimes: readonly string[] }
> = {
  Audiometria: {
    extensions: [...BASE_DOCUMENT_EXTENSIONS, ...XML_EXTENSIONS],
    mimes: [...BASE_DOCUMENT_MIMES, ...XML_MIMES],
  },
  Espirometria: {
    extensions: [...BASE_DOCUMENT_EXTENSIONS],
    mimes: [...BASE_DOCUMENT_MIMES],
  },
  Laboratorio: {
    extensions: [...BASE_DOCUMENT_EXTENSIONS],
    mimes: [...BASE_DOCUMENT_MIMES],
  },
  Rayos_X: {
    extensions: [...BASE_DOCUMENT_EXTENSIONS],
    mimes: [...BASE_DOCUMENT_MIMES],
  },
  Campimetria: {
    extensions: [...BASE_DOCUMENT_EXTENSIONS],
    mimes: [...BASE_DOCUMENT_MIMES],
  },
  Electrocardiograma: {
    extensions: [...BASE_DOCUMENT_EXTENSIONS],
    mimes: [...BASE_DOCUMENT_MIMES],
  },
  RiesgoCardiovascular: {
    extensions: [...BASE_DOCUMENT_EXTENSIONS],
    mimes: [...BASE_DOCUMENT_MIMES],
  },
  Somatometria: {
    extensions: [...BASE_DOCUMENT_EXTENSIONS],
    mimes: [...BASE_DOCUMENT_MIMES],
  },
  AgudezaVisual: {
    extensions: [...BASE_DOCUMENT_EXTENSIONS],
    mimes: [...BASE_DOCUMENT_MIMES],
  },
  ExamenMedico: {
    extensions: [...BASE_DOCUMENT_EXTENSIONS],
    mimes: [...BASE_DOCUMENT_MIMES],
  },
  Otro: {
    extensions: [...BASE_DOCUMENT_EXTENSIONS],
    mimes: [...BASE_DOCUMENT_MIMES],
  },
}

const STUDY_DISPLAY_NAME: Record<CanonicalAIStudyType, string> = {
  Audiometria: 'Audiometría',
  Espirometria: 'Espirometría',
  Laboratorio: 'Laboratorio',
  Rayos_X: 'Imagenología (rayos X)',
  Campimetria: 'Campimetría',
  Electrocardiograma: 'Electrocardiograma',
  RiesgoCardiovascular: 'Riesgo cardiovascular',
  Somatometria: 'Somatometría',
  AgudezaVisual: 'Agudeza visual',
  ExamenMedico: 'Examen médico',
  Otro: 'este tipo de prueba',
}

function fileExtension(fileName: string): string {
  const base = (fileName || '').trim().toLowerCase()
  const dot = base.lastIndexOf('.')
  if (dot < 0 || dot === base.length - 1) return ''
  return base.slice(dot + 1)
}

function normalizeMime(mime: string | undefined): string {
  return (mime || '').trim().toLowerCase()
}

export function isXmlContentFile(file: Pick<File, 'name' | 'type'>): boolean {
  const mime = normalizeMime(file.type)
  if (XML_MIMES.includes(mime as (typeof XML_MIMES)[number])) return true
  if (fileExtension(file.name) === 'xml') return true
  return false
}

/** Tres capas: MIME, extensión y magic bytes (FIX-20260729-03-G-XML). */
export async function isAudiometryXmlFile(file: File): Promise<boolean> {
  if (isXmlContentFile(file)) return true
  return await sniffXmlMagicBytes(file)
}

/** Sniff XML en los primeros bytes (misma estrategia que uploadEventTestFile). */
export async function sniffXmlMagicBytes(file: File): Promise<boolean> {
  try {
    const head = await file.slice(0, 64).text()
    return head.trimStart().toLowerCase().startsWith('<?xml')
  } catch {
    return false
  }
}

async function sniffContentKind(
  file: File,
): Promise<'pdf' | 'png' | 'jpeg' | 'xml' | 'unknown'> {
  try {
    const buf = new Uint8Array(await file.slice(0, 8).arrayBuffer())
    if (buf.length >= 4 && buf[0] === 0x25 && buf[1] === 0x50 && buf[2] === 0x44 && buf[3] === 0x46) {
      return 'pdf'
    }
    if (
      buf.length >= 4 &&
      buf[0] === 0x89 &&
      buf[1] === 0x50 &&
      buf[2] === 0x4e &&
      buf[3] === 0x47
    ) {
      return 'png'
    }
    if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) {
      return 'jpeg'
    }
    if (await sniffXmlMagicBytes(file)) return 'xml'
  } catch {
    // sin Blob en algún entorno → no bloquear sólo por sniff
  }
  return 'unknown'
}

function extensionLabelList(extensions: readonly string[]): string {
  return extensions.map(e => e.toUpperCase()).join(', ')
}

export function getAcceptAttributeForStudyType(studyType: CanonicalAIStudyType): string {
  const rules = STUDY_UPLOAD_FILE_RULES[studyType]
  return rules.extensions.map(e => `.${e}`).join(',')
}

export function getUploadHintForStudyType(studyType: CanonicalAIStudyType): string {
  const rules = STUDY_UPLOAD_FILE_RULES[studyType]
  const exts = extensionLabelList(rules.extensions)
  if (studyType === 'Audiometria') {
    return `PDF, PNG, JPG o XML (audiómetro) — máx. 20 MB`
  }
  return `${exts.replace(/, /g, ', ')} — máx. 20 MB`
}

export type PublishedCalibrationForFileValidation = {
  enabled: boolean
  canonicalStudyType: string | null
} | null

/**
 * Tipo efectivo para validar el archivo: prefiere calibración V3 publicada
 * cuando está habilitada; si no, heurística por nombre de prueba.
 */
export function resolveStudyTypeForEventTestFileValidation(
  eventTest: StudyTestRef,
  published: PublishedCalibrationForFileValidation,
): CanonicalAIStudyType {
  if (published?.enabled && published.canonicalStudyType) {
    const normalized = normalizeStudyTypeForBackend(published.canonicalStudyType)
    if (normalized && normalized in STUDY_UPLOAD_FILE_RULES) {
      return normalized as CanonicalAIStudyType
    }
  }
  return getCanonicalAIStudyType(eventTest) ?? 'Otro'
}

function mimeOrExtensionMatches(
  file: Pick<File, 'name' | 'type'>,
  rules: { extensions: readonly string[]; mimes: readonly string[] },
): boolean {
  const ext = fileExtension(file.name)
  const mime = normalizeMime(file.type)
  const extOk = ext !== '' && rules.extensions.includes(ext)
  const mimeOk =
    mime !== '' &&
    mime !== 'application/octet-stream' &&
    rules.mimes.includes(mime)
  return extOk || mimeOk
}

/**
 * Validación síncrona (tamaño + extensión/MIME). El servidor y el cliente
 * deben llamar también a `validateEventTestUploadFileAsync` para magic bytes.
 */
export function validateEventTestUploadFileSync(
  file: Pick<File, 'name' | 'type' | 'size'>,
  studyType: CanonicalAIStudyType,
): EventTestFileValidationResult {
  if (file.size > EVENT_TEST_UPLOAD_MAX_BYTES) {
    return {
      valid: false,
      errorCode: 'FILE_TOO_LARGE',
      message: 'El archivo supera el tamaño máximo permitido (20 MB).',
    }
  }

  if (file.size === 0) {
    return {
      valid: false,
      errorCode: 'FILE_FORMAT_MISMATCH',
      message: 'Formato incorrecto: el archivo está vacío.',
    }
  }

  const rules = STUDY_UPLOAD_FILE_RULES[studyType]
  const ext = fileExtension(file.name)
  const studyLabel = STUDY_DISPLAY_NAME[studyType]

  if (isXmlContentFile(file) && studyType !== 'Audiometria') {
    return {
      valid: false,
      errorCode: 'FILE_FORMAT_MISMATCH',
      message:
        'El archivo no coincide con el tipo de prueba seleccionado. ' +
        'Los archivos XML del audiómetro solo aplican a Audiometría.',
    }
  }

  if (!mimeOrExtensionMatches(file, rules)) {
    const allowed = extensionLabelList(rules.extensions)
    return {
      valid: false,
      errorCode: 'FILE_FORMAT_MISMATCH',
      message:
        `Formato incorrecto: este archivo no es adecuado para ${studyLabel}. ` +
        `Formatos permitidos: ${allowed}.`,
    }
  }

  return { valid: true }
}

export async function validateEventTestUploadFileAsync(
  file: File,
  studyType: CanonicalAIStudyType,
): Promise<EventTestFileValidationResult> {
  const sync = validateEventTestUploadFileSync(file, studyType)
  if (!sync.valid) return sync

  const rules = STUDY_UPLOAD_FILE_RULES[studyType]
  const ext = fileExtension(file.name)
  const sniffed = await sniffContentKind(file)
  if (sniffed === 'unknown') {
    return { valid: true }
  }

  const expectedFromExt =
    ext === 'pdf'
      ? 'pdf'
      : ext === 'png'
        ? 'png'
        : ext === 'jpg' || ext === 'jpeg'
          ? 'jpeg'
          : ext === 'xml'
            ? 'xml'
            : null

  if (expectedFromExt && sniffed !== expectedFromExt) {
    return {
      valid: false,
      errorCode: 'FILE_FORMAT_MISMATCH',
      message:
        'El archivo no coincide con la extensión seleccionada. ' +
        'Verifica que sea el documento correcto para este tipo de prueba.',
    }
  }

  if (sniffed === 'xml' && studyType !== 'Audiometria') {
    return {
      valid: false,
      errorCode: 'FILE_FORMAT_MISMATCH',
      message:
        'El archivo no es adecuado para este tipo de prueba. ' +
        'El contenido parece ser XML de audiómetro.',
    }
  }

  if (sniffed === 'xml' && !rules.extensions.includes('xml')) {
    return {
      valid: false,
      errorCode: 'FILE_FORMAT_MISMATCH',
      message: 'Formato incorrecto: este estudio no acepta archivos XML.',
    }
  }

  return { valid: true }
}
