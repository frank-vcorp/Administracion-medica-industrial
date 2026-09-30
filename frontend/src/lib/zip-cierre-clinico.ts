/**
 * @fileoverview Constructor del ZIP de cierre clínico por Event.
 *
 *   Ensambla un ZIP en memoria con:
 *     - `01_Dictamen_General/dictamen-general.pdf` ← resumen/dictamen
 *       (`MedicalDictamenPDF`), no el formulario largo de examen médico.
 *     - Una carpeta por cada `EventTest` de la papeleta con su PDF validado
 *       (o archivo de resultado en laboratorio/documentales).
 *     - `manifest.txt` con Event, archivos incluidos y PDFs ausentes.
 *
 *   El examen médico largo va en su carpeta de papeleta vía
 *   `resolveExamenMedicoEntregablePdfForEvent`. Las fuentes se obtienen vía HTTP desde el
 *   backend oficial (mismo path que el visor embebido), NO desde
 *   filesystem local — Vercel no comparte filesystem con Railway/S3.
 *
 * @id IMPL-FEATURE-20260825-04
 * @id IMPL-20260826-05 (FIX: fuente vía backend `/api/files`, no FS Vercel)
 * @backup context/SPECs/SPEC-FEATURE-20260825-04-ZIP-CIERRE-CLINICO.md
 *
 * Reglas (SPEC §Reglas):
 *   - Todos los datos se resuelven por `eventId` (no mezclar Event/paciente).
 *   - Fuente ausente: manifestar `NO_DISPONIBLE`, no inventar.
 *   - Reutiliza helpers/rutas existentes; sin almacenamiento persistente nuevo.
 *   - Manifest siempre presente, aunque falten todas las fuentes.
 *   - Defensa contra SSRF: `resolveBackendFileUrl` rechaza URLs con
 *     esquema (http/https/s3) y paths con `..`. Sólo construye URLs
 *     absolutas a partir de una `baseUrl` controlada por configuración.
 */
import prisma from '@/lib/prisma'
import { buildZip, type ZipEntry } from '@/lib/zip-store'
import { resolveExamenMedicoEntregablePdfForEvent } from '@/lib/examen-medico-pdf'
import { renderDictamenGeneralPdfForEvent } from '@/lib/dictamen-pdf'
import { findSiblingEventsInAtencion } from '@/lib/event-atencion'
import { isExamenMedicoTestName } from '@/lib/clinical/examen-medico-variant'
import {
  type EventTestForZipPdf,
  resolveEventTestPdfForZip,
} from '@/lib/clinical/study-pdf-for-zip'

export {
  resolveBackendFileUrl,
  tryReadSourceFromBackend,
} from '@/lib/clinical/backend-file-read'

/** Roles clínicos autorizados (SPEC §Reglas). */
export const CLINICAL_ROLES = new Set<string>([
  'SUPERADMIN',
  'DOCTOR_GENERAL',
  'DOCTOR_VALIDATOR',
])

/** Resultado de la construcción del ZIP. */
export interface BuildCierreClinicoZipResult {
  /** Buffer ZIP completo. */
  zip: Uint8Array
  /** Nombre sugerido para `Content-Disposition`. */
  filename: string
  /** Manifest textual (incluido en el ZIP; expuesto para tests/logs). */
  manifest: string
  /** Lista de entradas (path + bytes) para diagnóstico. */
  entries: ReadonlyArray<ZipEntry>
}

// ──────────────────────────────────────────────────────────────────────────
// Helpers puros — testeables sin Prisma ni FS.
// ──────────────────────────────────────────────────────────────────────────

/** Slug seguro para nombre de archivo / carpeta. */
export function slugify(input: string, maxLen = 60): string {
  const norm = input
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase()
  return (norm || 'item').slice(0, maxLen)
}

/** Indexa una lista con prefijo NN_ para orden estable. */
export function folderName(index: number, label: string): string {
  const n = String(index).padStart(2, '0')
  return `${n}_${slugify(label)}`
}

/**
 * Construye el texto del dictamen por estudio a partir del slot persistido
 * en `physicalExamData` + predicción IA + fuente del extractor.
 * Determinista y testeable sin Prisma.
 */
export function buildStudyDictamenText(input: {
  serviceName: string
  kind: 'STUDY' | 'LAB'
  /** Slot textual persistido en physicalExamData (ej. audiometria_texto). */
  slot: string | null
  /** Prediagnóstico IA persistido. */
  aiPrediction: string | null
  /** Notas del validador médico (si existen). */
  validatorNotes?: string | null
}): string {
  const lines: string[] = []
  lines.push(`# Dictamen — ${input.serviceName}`)
  lines.push('')
  lines.push(`Tipo: ${input.kind === 'LAB' ? 'Laboratorio' : 'Estudio paraclínico'}`)
  lines.push('')
  if (input.slot && input.slot.trim().length > 0) {
    lines.push('## Snapshot médico (slot persistido en physicalExamData)')
    lines.push(input.slot.trim())
    lines.push('')
  } else {
    lines.push('## Snapshot médico')
    lines.push('NO_DISPONIBLE — el médico no completó el slot de este estudio.')
    lines.push('')
  }
  if (input.aiPrediction && input.aiPrediction.trim().length > 0) {
    lines.push('## Prediagnóstico IA (referencia, NO firmado)')
    lines.push(input.aiPrediction.trim())
    lines.push('')
  } else {
    lines.push('## Prediagnóstico IA')
    lines.push('NO_DISPONIBLE — sin extracción IA asociada.')
    lines.push('')
  }
  if (input.validatorNotes && input.validatorNotes.trim().length > 0) {
    lines.push('## Notas del médico validador')
    lines.push(input.validatorNotes.trim())
    lines.push('')
  }
  lines.push('---')
  lines.push('Dictamen firmado en MedicalVerdict; este archivo es una')
  lines.push('primera versión operativa generada por IMPL-FEATURE-20260825-04.')
  return lines.join('\n')
}

/**
 * Construye el contenido del manifest.txt a partir de los paths finales.
 * Siempre se incluye — si no hay entradas, sólo lista los placeholders
 * "NO_DISPONIBLE" por sección.
 *
 * IMPL-20260826-06 (DEC-20260826-01 / BR-20260826-01): acepta
 * `atencionEventIds` para listar todos los Events del trabajador
 * ligados a la misma cita que se consolidan en este ZIP. Si se omite
 * (compat legacy), sólo se lista el `eventId` raíz.
 */
export function buildManifest(input: {
  eventId: string
  universalId: string
  workerName: string
  generatedAt: Date
  dictamenGeneralPath: string
  studyEntries: ReadonlyArray<{
    folder: string
    serviceName: string
    pdfPath: string
    eventTestId: string
  }>
  /** IDs de los Events del trabajador que pertenecen a la misma atención/cita. */
  atencionEventIds?: ReadonlyArray<string>
  /** `appointmentId` que agrupa los Events (o `null` si es walk-in). */
  appointmentId?: string | null
}): string {
  const lines: string[] = []
  lines.push('Manifest — ZIP de cierre clínico')
  lines.push('='.repeat(60))
  lines.push(`Event ID:        ${input.eventId}`)
  lines.push(`Universal ID:    ${input.universalId}`)
  lines.push(`Trabajador:      ${input.workerName}`)
  lines.push(
    `Generado:        ${input.generatedAt.toISOString()}`,
  )
  lines.push(`Generador:       IMPL-FEATURE-20260825-04`)
  if (
    input.atencionEventIds &&
    input.atencionEventIds.length > 0 &&
    input.appointmentId !== undefined
  ) {
    lines.push('')
    lines.push('Atención consolidada (DEC-20260826-01 / BR-20260826-01):')
    lines.push(
      `  Cita / appointmentId: ${input.appointmentId ?? '(sin cita / walk-in)'}`,
    )
    lines.push(`  Events incluidos (${input.atencionEventIds.length}):`)
    for (const id of input.atencionEventIds) {
      lines.push(`    - ${id}`)
    }
  }
  lines.push('')
  lines.push('Estructura:')
  lines.push(`  ${input.dictamenGeneralPath}`)
  for (const s of input.studyEntries) {
    lines.push(`  ${s.folder}/`)
    lines.push(`    ${s.serviceName} (EventTest ${s.eventTestId})`)
    lines.push(`    - pdf: ${s.pdfPath}`)
  }
  lines.push('  manifest.txt')
  lines.push('')
  lines.push('Leyenda:')
  lines.push('  NO_DISPONIBLE = PDF del estudio no generado o no recuperable.')
  return lines.join('\n')
}

/** String seguro para manifest: null/undefined → ''. */
function s(v: unknown): string {
  if (v === null || v === undefined) return ''
  return String(v).trim()
}

const eventTestsForZipSelect = {
  id: true,
  status: true,
  testNameSnapshot: true,
  fileUrl: true,
  extractionSnapshots: {
    where: { isSuperseded: false },
    orderBy: { version: 'desc' as const },
    take: 1,
    select: {
      aiPrediagnoses: {
        where: { isSuperseded: false },
        orderBy: { version: 'desc' as const },
        take: 1,
        select: {
          doctorReviews: {
            orderBy: { createdAt: 'desc' as const },
            take: 1,
            select: {
              validatedPdfUrl: true,
              validatedPdfError: true,
            },
          },
        },
      },
    },
  },
} as const

type RawEventTestForZip = {
  id: string
  status: string
  testNameSnapshot: string | null
  fileUrl: string | null
  extractionSnapshots?: Array<{
    aiPrediagnoses?: Array<{
      doctorReviews?: Array<{
        validatedPdfUrl: string | null
        validatedPdfError: string | null
      }>
    }>
  }>
}

function mapEventTestForZipPdf(test: RawEventTestForZip): EventTestForZipPdf {
  const latestReview =
    test.extractionSnapshots?.[0]?.aiPrediagnoses?.[0]?.doctorReviews?.[0]
  const validatedPdfUrl =
    latestReview?.validatedPdfUrl && !latestReview?.validatedPdfError
      ? latestReview.validatedPdfUrl
      : null
  return {
    id: test.id,
    status: test.status,
    testNameSnapshot: test.testNameSnapshot,
    fileUrl: test.fileUrl,
    validatedPdfUrl,
  }
}

// ──────────────────────────────────────────────────────────────────────────
// Builder principal.
// ──────────────────────────────────────────────────────────────────────────

/**
 * Construye el ZIP de cierre clínico en memoria. Lee el Event, renderiza
 * el dictamen general y agrega el PDF validado de cada EventTest.
 *
 * Lanza si el Event no existe o no tiene verdict firmado (esos casos
 * los maneja el caller con su propio código HTTP).
 */
export async function buildCierreClinicoZip(
  eventId: string,
): Promise<BuildCierreClinicoZipResult> {
  const event = await prisma.medicalEvent.findUnique({
    where: { id: eventId },
    select: {
      id: true,
      worker: {
        select: {
          firstName: true,
          lastName: true,
          universalId: true,
          dob: true,
          companyId: true,
          company: { select: { name: true } },
          clinicalHistory: { select: { data: true } },
        },
      },
      exam: {
        select: {
          physicalExamData: true,
          eyeAcuityData: true,
          somatometryData: true,
          vitalSignsData: true,
        },
      },
      verdict: {
        select: {
          id: true,
          finalDiagnosis: true,
          recommendations: true,
          signedAt: true,
          pdfUrl: true,
          signatureHash: true,
          validator: {
            select: {
              id: true,
              fullName: true,
              professionalLicense: true,
              signatureImageUrl: true,
            },
          },
        },
      },
      eventTests: {
        select: eventTestsForZipSelect,
        orderBy: { createdAt: 'asc' },
      },
    },
  })
  if (!event) {
    throw new CierreClinicoError('event_not_found', 404)
  }
  if (!event.verdict) {
    throw new CierreClinicoError('verdict_missing', 404)
  }

  // ── 1.5) IMPL-20260826-06 (DEC-20260826-01 / BR-20260826-01):
  //       Resolver los Events hermanos de la misma atención/cita.
  //       Con el schema actual (`appointmentId @unique`), esto devuelve
  //       únicamente el Event actual — pero el helper queda listo para
  //       la migración N:1 (varios Events por cita) sin más cambios.
  // ────────────────────────────────────────────────────────────────────────
  const atencionResolution = await findSiblingEventsInAtencion(
    eventId,
    prisma,
  )
  const atencionEventIds = atencionResolution.eventIds
  // Cargar los datos de los Events hermanos (excluyendo el actual que
  // ya tenemos cargado arriba).
  const siblingEventIds = atencionEventIds.filter((id) => id !== eventId)
  const siblingEventsRaw = siblingEventIds.length > 0
    ? await prisma.medicalEvent.findMany({
        where: { id: { in: siblingEventIds } },
        select: {
          id: true,
          eventTests: {
            select: eventTestsForZipSelect,
            orderBy: { createdAt: 'asc' },
          },
        },
        orderBy: { createdAt: 'asc' },
      })
    : []

  // ── 1) Dictamen general (reutiliza el helper FEATURE-20260825-03) ─────
  const aptitud = s(
    (event.exam?.physicalExamData as Record<string, unknown> | null)?.aptitud,
  )
  if (!aptitud) {
    // SPEC §reglas: el dictamen requiere aptitud (paridad con P2-3).
    throw new CierreClinicoError('aptitud_missing', 409)
  }
  const validator = event.verdict.validator
  if (
    !validator ||
    !validator.fullName
  ) {
    // IMPL-20260826-08: el helper `buildDictamenGeneralAmiConsolidado`
    // (debajo) maneja los fallbacks de `professionalLicense` /
    // `signatureImageUrl` (pueden ser null sin impedir la firma). Aquí
    // sólo exigimos `fullName` para mantener la identidad del firmante.
    throw new CierreClinicoError('validator_identity_incomplete', 410)
  }

  // Resumen / dictamen de aptitud (`MedicalDictamenPDF`), no el formulario
  // largo de examen médico (`ExamenMedicoValidatedPDF`).
  const dictamenGeneralBuffer = await renderDictamenGeneralPdfForEvent(
    event.id,
    prisma,
  )

  const examenMedicoPdfByEvent = new Map<string, Uint8Array | null>()
  async function examenMedicoPdfForEvent(evId: string): Promise<Uint8Array | null> {
    if (!examenMedicoPdfByEvent.has(evId)) {
      const bytes = await resolveExamenMedicoEntregablePdfForEvent(evId, prisma)
      examenMedicoPdfByEvent.set(evId, bytes)
    }
    return examenMedicoPdfByEvent.get(evId) ?? null
  }

  // ── 2) PDF por EventTest (papeleta) ───────────────────────────────────
  type ZipTestRow = EventTestForZipPdf & {
    serviceName: string
    eventId: string
  }

  const testRows: ZipTestRow[] = [
    ...event.eventTests.map((et) => ({
      ...mapEventTestForZipPdf(et),
      serviceName: et.testNameSnapshot ?? 'Estudio',
      eventId: event.id,
    })),
    ...siblingEventsRaw.flatMap((sib) =>
      sib.eventTests.map((et) => ({
        ...mapEventTestForZipPdf(et),
        serviceName: et.testNameSnapshot ?? 'Estudio',
        eventId: sib.id,
      })),
    ),
  ]

  const entries: ZipEntry[] = []
  const manifestStudies: Array<{
    folder: string
    serviceName: string
    pdfPath: string
    eventTestId: string
  }> = []

  let studyIndex = 0
  for (const row of testRows) {
    if (row.status === 'CANCELLED') continue

    studyIndex += 1
    const folder = folderName(studyIndex, row.serviceName)
    const pdfResolved = isExamenMedicoTestName(row.serviceName)
      ? await (async () => {
          const data = await examenMedicoPdfForEvent(row.eventId)
          return data ? { filename: 'examen-medico.pdf', data } : null
        })()
      : await resolveEventTestPdfForZip(row)

    if (pdfResolved) {
      const pdfPath = `${folder}/${pdfResolved.filename}`
      entries.push({ path: pdfPath, data: pdfResolved.data })
      manifestStudies.push({
        folder,
        serviceName: row.serviceName,
        pdfPath,
        eventTestId: row.id,
      })
    } else {
      const pdfPath = `${folder}/PDF_NO_DISPONIBLE.txt`
      const note =
        `# PDF del estudio NO_DISPONIBLE\n\n` +
        `Estudio: ${row.serviceName}\n` +
        `EventTest: ${row.id}\n` +
        `Event: ${row.eventId}\n` +
        `Generado: ${new Date().toISOString()}\n\n` +
        `Revise que el estudio tenga PDF validado (revisión médica) o archivo cargado.\n`
      entries.push({
        path: pdfPath,
        data: new TextEncoder().encode(note),
      })
      manifestStudies.push({
        folder,
        serviceName: row.serviceName,
        pdfPath: `${pdfPath} (NO_DISPONIBLE)`,
        eventTestId: row.id,
      })
    }
  }

  // ── 3) Dictamen general ────────────────────────────────────────────────
  const dictamenGeneralPath = '01_Dictamen_General/dictamen-general.pdf'
  entries.unshift({
    path: dictamenGeneralPath,
    data: new Uint8Array(dictamenGeneralBuffer),
  })

  // ── 4) Manifest ────────────────────────────────────────────────────────
  const workerName =
    [event.worker.firstName, event.worker.lastName]
      .filter((x) => x && x.length > 0)
      .join(' ') || '(sin nombre)'
  const manifest = buildManifest({
    eventId: event.id,
    universalId: event.worker.universalId ?? '(sin universalId)',
    workerName,
    generatedAt: new Date(),
    dictamenGeneralPath,
    studyEntries: manifestStudies,
    // IMPL-20260826-06: listar todos los Events de la cita consolidada.
    atencionEventIds,
    appointmentId: atencionResolution.appointmentId,
  })
  entries.push({ path: 'manifest.txt', data: new TextEncoder().encode(manifest) })

  const zip = buildZip(entries)
  return {
    zip,
    filename: `CierreClinico-${event.worker.universalId ?? event.id}.zip`,
    manifest,
    entries,
  }
}

/** Error tipado para distinguir casos del SPEC. */
export class CierreClinicoError extends Error {
  constructor(
    public readonly code:
      | 'event_not_found'
      | 'verdict_missing'
      | 'aptitud_missing'
      | 'validator_identity_incomplete',
    public readonly httpStatus: number,
  ) {
    super(`cierre_clinico:${code}`)
  }
}