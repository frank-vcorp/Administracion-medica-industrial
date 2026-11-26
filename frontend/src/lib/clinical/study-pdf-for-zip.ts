/**
 * Resuelve el PDF de entrega por EventTest para el ZIP de cierre clínico.
 */
import { promises as fs } from 'fs'
import path from 'path'
import { tryReadSourceFromBackend } from '@/lib/clinical/backend-file-read'
import { isExamenMedicoTestName } from '@/lib/clinical/examen-medico-variant'

const REPO_UPLOAD_DIR = path.join(process.cwd(), '..', 'uploads')

export type EventTestForZipPdf = {
  id: string
  status: string
  testNameSnapshot: string | null
  fileUrl: string | null
  /** PDF o archivo que el médico subió para el análisis. */
  sourceFileUrl: string | null
  sourceFileName: string | null
  validatedPdfUrl: string | null
  /** ID de la revisión médica más reciente (permite regenerar el PDF validado si no está persistido). */
  reviewId?: string | null
  /** Tipo de estudio del snapshot de extracción (e.g. Audiometria, Espirometria, Rayos_X). */
  studyType?: string | null
  /** Contexto clínico del EventTest (p. ej. adjuntos múltiples en Rayos X). */
  clinicalContext?: unknown | null
}

function sanitizeFilenamePart(value: string): string {
  return value.replace(/[^\w.\-áéíóúñÁÉÍÓÚÑ ]+/gi, '_').slice(0, 80)
}

export async function readPersistedPdfBytes(relativePath: string): Promise<Uint8Array | null> {
  const rel = relativePath.replace(/^\/+/, '')
  const abs = path.join(REPO_UPLOAD_DIR, rel)
  try {
    const buf = await fs.readFile(abs)
    return new Uint8Array(buf)
  } catch {
    const viaUploads = `/uploads/${rel}`
    const viaFiles = rel.includes('/') ? `/api/files/${rel}` : `/api/files/${rel}`
    return (
      (await tryReadSourceFromBackend(viaUploads)) ??
      (await tryReadSourceFromBackend(viaFiles))
    )
  }
}

type ResolvedPdfCandidate = {
  filename: string
  data: Uint8Array
  isFallbackSource: boolean
}

type ClinicalContextFileEntry = {
  url?: unknown
  fileName?: unknown
}

/**
 * Regenera en memoria el PDF validado de un estudio a partir de su `DoctorStudyReview`.
 * Evita devolver `null` cuando `validatedPdfUrl` aún no se ha persistido en disco/S3.
 */
async function renderValidatedPdfFromReviewId(
  reviewId: string,
  studyTypeHint: string | null | undefined,
  testName: string,
  label: string,
): Promise<{ filename: string; data: Uint8Array } | null> {
  try {
    const [{ default: prisma }, { resolveAmiLogoDataUrl }] = await Promise.all([
      import('@/lib/prisma'),
      import('@/lib/ami-brand'),
    ])

    const review = await prisma.doctorStudyReview.findUnique({
      where: { id: reviewId },
      select: {
        id: true,
        doctorStatus: true,
        doctorDiagnosis: true,
        doctorNotes: true,
        doctorRecommendations: true,
        createdAt: true,
        validatedPdfGeneratedAt: true,
        validatorSnapshotFullName: true,
        validatorSnapshotProfessionalLicense: true,
        validatorSnapshotSignatureUrl: true,
        reviewedBy: {
          select: {
            fullName: true,
            professionalLicense: true,
            signatureImageUrl: true,
          },
        },
        prediagnosisSnapshot: {
          select: {
            prediagnosisData: true,
            extractionSnapshot: {
              select: {
                studyType: true,
                structuredData: true,
                eventTest: {
                  select: {
                    id: true,
                    testNameSnapshot: true,
                    eventId: true,
                    clinicalContext: true,
                    event: {
                      select: {
                        worker: {
                          select: {
                            firstName: true,
                            lastName: true,
                            universalId: true,
                            company: { select: { name: true } },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    })

    if (!review || review.doctorStatus === 'REVIEWED_REJECTED') {
      return null
    }

    const fullName =
      review.validatorSnapshotFullName || review.reviewedBy?.fullName || ''
    if (!fullName.trim()) {
      return null
    }

    const medico = {
      fullName,
      professionalLicense:
        review.validatorSnapshotProfessionalLicense ||
        review.reviewedBy?.professionalLicense ||
        '—',
      signatureImageUrl:
        review.validatorSnapshotSignatureUrl ||
        review.reviewedBy?.signatureImageUrl ||
        '',
    }

    const doctorStatus: 'REVIEWED_ACCEPTED' | 'REVIEWED_EDITED' =
      review.doctorStatus === 'REVIEWED_ACCEPTED'
        ? 'REVIEWED_ACCEPTED'
        : 'REVIEWED_EDITED'

    const extractionSnapshot = review.prediagnosisSnapshot?.extractionSnapshot
    const eventTest = extractionSnapshot?.eventTest
    const worker = eventTest?.event?.worker
    const resolvedStudyType = extractionSnapshot?.studyType ?? studyTypeHint ?? ''
    const extractionStructuredData = extractionSnapshot?.structuredData
    const prediagnosisData = review.prediagnosisSnapshot?.prediagnosisData
    const logoDataUrl = await resolveAmiLogoDataUrl()

    const patient = {
      firstName: worker?.firstName ?? '',
      lastName: worker?.lastName ?? '',
      universalId: worker?.universalId ?? null,
      companyName: worker?.company?.name ?? null,
    }
    const reviewCreatedAt = review.validatedPdfGeneratedAt ?? review.createdAt
    const studyName = eventTest?.testNameSnapshot ?? testName

    const common = {
      reviewId: review.id,
      doctorStatus,
      doctorDiagnosis: review.doctorDiagnosis,
      doctorNotes: review.doctorNotes,
      doctorRecommendations: review.doctorRecommendations,
      reviewCreatedAt,
      prediagnosisData,
      patient,
      medico,
      logoDataUrl,
    }

    const classifier = resolvedStudyType || testName

    if (resolvedStudyType === 'Audiometria' || /audiometr/i.test(classifier)) {
      const { buildAudiometriaPdfDataAsync, generateAudiometriaValidatedPdf } =
        await import('@/lib/audiometry-pdf')
      const data = await buildAudiometriaPdfDataAsync({
        ...common,
        eventId: eventTest?.eventId ?? null,
        eventTestId: eventTest?.id ?? null,
        clinicalContext: eventTest?.clinicalContext,
        extractionStructuredData,
        studyName,
        studyType: resolvedStudyType || null,
      })
      const result = await generateAudiometriaValidatedPdf({ reviewId: review.id, data })
      return { filename: `${label}.pdf`, data: new Uint8Array(result.buffer) }
    }

    if (resolvedStudyType === 'Espirometria' || /espirometr/i.test(classifier)) {
      const { buildEspirometryPdfDataAsync, generateEspirometryValidatedPdf } =
        await import('@/lib/espirometry-pdf')
      const data = await buildEspirometryPdfDataAsync({
        ...common,
        eventId: eventTest?.eventId ?? null,
        eventTestId: eventTest?.id ?? null,
        clinicalContext: eventTest?.clinicalContext,
        extractionStructuredData,
        studyName,
        studyType: resolvedStudyType || null,
      })
      const result = await generateEspirometryValidatedPdf({ reviewId: review.id, data })
      return { filename: `${label}.pdf`, data: new Uint8Array(result.buffer) }
    }

    if (resolvedStudyType === 'Campimetria' || /campimetr/i.test(classifier)) {
      const { buildCampimetriaPdfDataAsync, generateCampimetriaValidatedPdf } =
        await import('@/lib/campimetria-pdf')
      const data = await buildCampimetriaPdfDataAsync({
        ...common,
        eventId: eventTest?.eventId ?? '',
        clinicalContext: eventTest?.clinicalContext,
        studyName,
      })
      const result = await generateCampimetriaValidatedPdf({ reviewId: review.id, data })
      return { filename: `${label}.pdf`, data: new Uint8Array(result.buffer) }
    }

    if (resolvedStudyType === 'Rayos_X' || /rayos|\brx\b/i.test(classifier)) {
      const { buildRayosXPdfDataAsync, generateRayosXValidatedPdf } =
        await import('@/lib/rayos-x-pdf')
      const data = await buildRayosXPdfDataAsync({
        ...common,
        eventId: eventTest?.eventId ?? '',
        clinicalContext: eventTest?.clinicalContext ?? null,
        extractionStructuredData,
        studyName,
      })
      const result = await generateRayosXValidatedPdf({ reviewId: review.id, data })
      return { filename: `${label}.pdf`, data: new Uint8Array(result.buffer) }
    }

    if (
      resolvedStudyType === 'Electrocardiograma' ||
      /electrocardiograma|\becg\b/i.test(classifier)
    ) {
      const { buildEcgPdfDataAsync, generateEcgValidatedPdf } =
        await import('@/lib/ecg-pdf')
      const data = await buildEcgPdfDataAsync({
        ...common,
        eventId: eventTest?.eventId ?? '',
        clinicalContext: eventTest?.clinicalContext ?? null,
        extractionStructuredData,
      })
      const result = await generateEcgValidatedPdf({ reviewId: review.id, data })
      return { filename: `${label}.pdf`, data: new Uint8Array(result.buffer) }
    }

    return null
  } catch (err) {
    console.warn(
      `[zip-pdf] No se pudo regenerar PDF validado para reviewId=${reviewId}:`,
      err instanceof Error ? err.message : err,
    )
    return null
  }
}

async function fetchSourceFileBytes(sourceUrl: string): Promise<Uint8Array | null> {
  return (
    (await tryReadSourceFromBackend(sourceUrl)) ??
    (sourceUrl.startsWith('/uploads/')
      ? await readPersistedPdfBytes(sourceUrl.slice('/uploads/'.length))
      : null)
  )
}

async function resolveEventTestPdfInternal(
  test: EventTestForZipPdf,
): Promise<ResolvedPdfCandidate | null> {
  if (test.status === 'CANCELLED') return null

  const label = sanitizeFilenamePart(test.testNameSnapshot ?? 'estudio')
  const name = test.testNameSnapshot ?? ''

  // Examen médico largo: `resolveExamenMedicoEntregablePdfForEvent` en el ZIP
  // (no mezclar con el PDF de resumen/dictamen en `01_Dictamen_General/`).
  if (isExamenMedicoTestName(name)) {
    return null
  }

  if (test.validatedPdfUrl) {
    const data = await readPersistedPdfBytes(test.validatedPdfUrl)
    if (data) {
      const base = path.basename(test.validatedPdfUrl)
      const filename = base.toLowerCase().endsWith('.pdf') ? base : `${label}.pdf`
      return { filename, data, isFallbackSource: false }
    }
  }

  if (test.reviewId) {
    const rendered = await renderValidatedPdfFromReviewId(
      test.reviewId,
      test.studyType,
      name,
      label,
    )
    if (rendered) {
      return { ...rendered, isFallbackSource: false }
    }
  }

  if (test.fileUrl) {
    const bytes = await tryReadSourceFromBackend(test.fileUrl)
    if (bytes) {
      const ext = test.fileUrl.split('.').pop()?.toLowerCase()
      const suffix = ext && ['pdf', 'xml'].includes(ext) ? `.${ext}` : '.pdf'
      return { filename: `${label}${suffix}`, data: bytes, isFallbackSource: true }
    }

    const trimmed = test.fileUrl.trim()
    if (trimmed.startsWith('/uploads/')) {
      try {
        const abs = path.join(REPO_UPLOAD_DIR, trimmed.slice('/uploads/'.length))
        const buf = await fs.readFile(abs)
        return {
          filename: `${label}.pdf`,
          data: new Uint8Array(buf),
          isFallbackSource: true,
        }
      } catch {
        return null
      }
    }
  }

  return null
}

/**
 * PDF validado por estudio. El dictamen general va aparte en `01_Dictamen_General/`.
 */
export async function resolveEventTestPdfForZip(
  test: EventTestForZipPdf,
): Promise<{ filename: string; data: Uint8Array } | null> {
  const res = await resolveEventTestPdfInternal(test)
  return res ? { filename: res.filename, data: res.data } : null
}

function sourceFilenameFromParts(
  url: string,
  explicitName: string | null | undefined,
  label: string,
): string {
  const raw = (explicitName || '').trim()
  if (raw) {
    const base = path.basename(raw)
    if (base) return `fuente-${sanitizeFilenamePart(base)}`
  }
  const fromUrl = url.split('?')[0]
  const base = path.basename(fromUrl)
  if (base && base.includes('.')) return `fuente-${sanitizeFilenamePart(base)}`
  return `fuente-${label}.pdf`
}

function uniqueSourceFilename(
  candidate: string,
  usedNames: Set<string>,
  index: number,
): string {
  if (!usedNames.has(candidate)) {
    usedNames.add(candidate)
    return candidate
  }
  const ext = path.extname(candidate)
  const stem = ext ? candidate.slice(0, -ext.length) : candidate
  let deduped = `${stem}-${index}${ext}`
  let counter = index
  while (usedNames.has(deduped)) {
    counter += 1
    deduped = `${stem}-${counter}${ext}`
  }
  usedNames.add(deduped)
  return deduped
}

function collectSourceCandidates(
  test: EventTestForZipPdf,
): Array<{ url: string; explicitName?: string | null }> {
  const validatedTrimmed = (test.validatedPdfUrl || '').trim()
  const seenUrls = new Set<string>()
  const candidates: Array<{ url: string; explicitName?: string | null }> = []

  const addCandidate = (url: unknown, explicitName?: unknown) => {
    if (typeof url !== 'string') return
    const trimmed = url.trim()
    if (!trimmed || trimmed === validatedTrimmed || seenUrls.has(trimmed)) return
    seenUrls.add(trimmed)
    candidates.push({
      url: trimmed,
      explicitName: typeof explicitName === 'string' ? explicitName : null,
    })
  }

  // Adjuntos múltiples persistidos en clinicalContext (p. ej. Rayos X multi-placa)
  if (test.clinicalContext && typeof test.clinicalContext === 'object') {
    const ctx = test.clinicalContext as { files?: unknown }
    if (Array.isArray(ctx.files)) {
      for (const entry of ctx.files) {
        if (entry && typeof entry === 'object') {
          const fileEntry = entry as ClinicalContextFileEntry
          addCandidate(fileEntry.url, fileEntry.fileName)
        }
      }
    }
  }

  addCandidate(test.sourceFileUrl, test.sourceFileName)
  addCandidate(test.fileUrl, null)

  return candidates
}

/** Informe generado y, aparte, el archivo o archivos que se subieron para analizarlo. */
export async function resolveEventTestFilesForZip(
  test: EventTestForZipPdf,
): Promise<Array<{ filename: string; data: Uint8Array }>> {
  if (test.status === 'CANCELLED') return []

  const name = test.testNameSnapshot ?? ''
  if (isExamenMedicoTestName(name)) return []

  const generated = await resolveEventTestPdfInternal(test)
  const files: Array<{ filename: string; data: Uint8Array }> = []
  const usedNames = new Set<string>()

  // Sólo emitimos `informe-...` cuando proviene de un PDF validado/regenerado,
  // no cuando cayó al fallback del archivo fuente crudo (`fileUrl`).
  if (generated && !generated.isFallbackSource) {
    const reportName = generated.filename.startsWith('fuente-')
      ? generated.filename
      : `informe-${generated.filename}`
    usedNames.add(reportName)
    files.push({
      filename: reportName,
      data: generated.data,
    })
  }

  const label = sanitizeFilenamePart(test.testNameSnapshot ?? 'estudio')
  const fileUrlTrimmed = (test.fileUrl || '').trim()
  const candidates = collectSourceCandidates(test)

  for (let i = 0; i < candidates.length; i += 1) {
    const { url, explicitName } = candidates[i]
    const bytes =
      generated?.isFallbackSource && url === fileUrlTrimmed
        ? generated.data
        : await fetchSourceFileBytes(url)
    if (bytes && bytes.length > 0) {
      const rawName = sourceFilenameFromParts(url, explicitName, label)
      const filename = uniqueSourceFilename(rawName, usedNames, i + 1)
      files.push({ filename, data: bytes })
    }
  }

  return files
}
