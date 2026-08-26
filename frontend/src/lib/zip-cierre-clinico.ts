/**
 * @fileoverview Constructor del ZIP de cierre clínico por Event.
 *
 *   Ensambla un ZIP en memoria con:
 *     - `01_Dictamen_General/dictamen-general.pdf` ← ExamenMedicoValidatedPDF.
 *     - Una carpeta por estudio aplicable con:
 *         · `dictamen-<slug>.txt` ← texto estructurado (slot + IA + fuente).
 *         · `fuente-<basename>` ← archivo fuente original resuelto
 *           desde el backend oficial `/api/files/{key}` (Railway/S3).
 *     - `manifest.txt` con Event, archivos incluidos y fuentes ausentes.
 *
 *   El dictamen general se reutiliza desde `generateExamenMedicoValidatedPdf`
 *   (FEATURE-20260825-03). Las fuentes se obtienen vía HTTP desde el
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
import {
  buildExamenMedicoPdfData,
  generateExamenMedicoValidatedPdf,
} from '@/lib/examen-medico-pdf'
import { dictamenBackendUrl } from '@/lib/dictamen-pdf'
import {
  findSiblingEventsInAtencion,
  isEventInAtencion,
} from '@/lib/event-atencion'
import {
  buildDictamenGeneralAmiConsolidado,
  hasConsolidation,
} from '@/lib/dictamen-general-ami'

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
    dictamenPath: string
    sourcePath: string
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
    lines.push(`    ${s.serviceName}`)
    lines.push(`    - dictamen: ${s.dictamenPath}`)
    lines.push(`    - fuente:   ${s.sourcePath}`)
  }
  lines.push('  manifest.txt')
  lines.push('')
  lines.push('Leyenda:')
  lines.push('  NO_DISPONIBLE = archivo fuente ausente (no se inventó).')
  return lines.join('\n')
}

/** Resuelve los slots por nombre de servicio (case/acento-insensitive). */
function pickSlot(
  physicalExamData: Record<string, unknown>,
  serviceName: string,
): string | null {
  const norm = (s: string) =>
    s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  const target = norm(serviceName)
  const slots: Array<[string, string]> = [
    ['audiometria', 'audiometria_texto'],
    ['audiometry', 'audiometria_texto'],
    ['espirometria', 'espirometria_texto'],
    ['spirometry', 'espirometria_texto'],
    ['laboratorio', 'laboratorios_texto'],
    ['laboratorios', 'laboratorios_texto'],
    ['lab', 'laboratorios_texto'],
    ['radiografia', 'radiografia_texto'],
    ['radiografía', 'radiografia_texto'],
    ['rx', 'radiografia_texto'],
    ['rayos x', 'radiografia_texto'],
  ]
  for (const [needle, key] of slots) {
    if (target.includes(norm(needle))) {
      const v = physicalExamData[key]
      if (typeof v === 'string' && v.trim().length > 0) return v
    }
  }
  return null
}

/** String seguro para manifest: null/undefined → ''. */
function s(v: unknown): string {
  if (v === null || v === undefined) return ''
  return String(v).trim()
}

/** Número o '' si no. */
function numOrStr(v: unknown): string {
  if (v === null || v === undefined || v === '') return ''
  const n = Number(v)
  return Number.isFinite(n) ? String(n) : ''
}

/** Detecta el primer estudio por nombre normalizado. */
function findIaByName<
  T extends { serviceName: string; aiPrediction: string | null; extractedData: unknown; fileUrl?: string | null; validatorNotes?: string | null },
>(list: ReadonlyArray<T>, candidates: ReadonlyArray<string>): T | null {
  if (!list || list.length === 0) return null
  const norm = (str: string) =>
    str.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  for (const item of list) {
    const t = norm(item.serviceName)
    if (candidates.some((c) => t.includes(norm(c)))) return item
  }
  return null
}

// ──────────────────────────────────────────────────────────────────────────
// Builder principal.
// ──────────────────────────────────────────────────────────────────────────

/**
 * Construye el ZIP de cierre clínico en memoria. Lee el Event, renderiza
 * el dictamen general y agrega dictámenes por estudio + fuentes si
 * existen en disco.
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
      studies: {
        select: {
          serviceName: true,
          aiPrediction: true,
          extractedData: true,
          fileUrl: true,
          validatorNotes: true,
        },
      },
      labs: {
        select: {
          serviceName: true,
          aiPrediction: true,
          extractedData: true,
          fileUrl: true,
        },
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
          studies: {
            select: {
              serviceName: true,
              aiPrediction: true,
              extractedData: true,
              fileUrl: true,
              validatorNotes: true,
            },
          },
          labs: {
            select: {
              serviceName: true,
              aiPrediction: true,
              extractedData: true,
              fileUrl: true,
            },
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
  const physicalExamData =
    (event.exam?.physicalExamData as Record<string, unknown> | null) ?? {}
  const eyeAcuity =
    (event.exam?.eyeAcuityData as Record<string, unknown> | null) ?? {}
  const somatometry =
    (event.exam?.somatometryData as Record<string, unknown> | null) ?? {}
  const vitalSigns =
    (event.exam?.vitalSignsData as Record<string, unknown> | null) ?? {}
  const clinicalHistoryData =
    (event.worker.clinicalHistory?.data as Record<string, unknown> | null) ?? {}
  const dp =
    (clinicalHistoryData.datos_personales as Record<string, unknown>) ?? {}
  const _hl =
    (clinicalHistoryData.historia_laboral as Record<string, unknown>) ?? {}
  const ahf =
    (clinicalHistoryData.heredo_familiares as Record<string, unknown>) ?? {}
  const apnp =
    (clinicalHistoryData.no_patologicos as Record<string, unknown>) ?? {}

  const appParts: string[] = []
  const slotsTexts = [
    ['Examen médico', s(physicalExamData.examen_medico_texto)],
    ['Audiometría', s(physicalExamData.audiometria_texto)],
    ['Espirometría', s(physicalExamData.espirometria_texto)],
    ['Laboratorios', s(physicalExamData.laboratorios_texto)],
    ['Radiografía', s(physicalExamData.radiografia_texto)],
  ] as const
  for (const [label, val] of slotsTexts) {
    if (val) appParts.push(`${label}: ${val}`)
  }
  const appTexto = appParts.length > 0
    ? appParts.join('. ')
    : s(physicalExamData.impresion_diagnostica)

  const taSist = Number(somatometry.ta_sistolica ?? vitalSigns.ta_sistolica)
  const taDiast = Number(somatometry.ta_diastolica ?? vitalSigns.ta_diastolica)
  const ta =
    Number.isFinite(taSist) && Number.isFinite(taDiast)
      ? `${taSist}/${taDiast}`
      : ''

  const audioIa = findIaByName(event.studies, [
    'audiometria',
    'audiometry',
  ])
  const espiroIa = findIaByName(event.studies, [
    'espirometria',
    'spirometry',
  ])
  const _labsIa = event.labs?.[0] ?? null
  const radioIa = findIaByName(event.studies, [
    'radiografia',
    'radiografía',
    'rx',
    'rayos x',
  ])

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

  // IMPL-20260826-08 (FND-20260826-03 / DEC-20260826-01): usamos el helper
  // compartido `buildDictamenGeneralAmiConsolidado` para garantizar que
  // el dictamen general del ZIP usa EXACTAMENTE la misma consolidación
  // que la re-emisión del PDF (mismo renderer, misma helper, mismos
  // Events hermanos). Antes: 165 líneas de mapeo inline.
  const consolidado = await buildDictamenGeneralAmiConsolidado(event.id, prisma)
  const data = consolidado.data

  // IMPL-20260826-08: persistimos las recomendaciones normalizadas en el
  // payload final (split por numeración ordinal) — mismo criterio que
  // antes.
  const recomendacionesPersisted = s(event.verdict.recommendations)
  // IMPL-20260826-08: las recomendaciones viven en `ExamenMedicoPDFData`
  // (output de `buildExamenMedicoPdfData`), NO en `BuildExamenMedicoPdfInput`.
  // Por eso primero transformamos el payload y luego persistimos.
  const dataFinal = buildExamenMedicoPdfData(data)
  if (recomendacionesPersisted) {
    dataFinal.recomendaciones = recomendacionesPersisted
      .split(/\s*\d+\.\-\s+/)
      .map((r) => r.trim())
      .filter((r) => r.length > 0)
  }

  const result = await generateExamenMedicoValidatedPdf({
    data: dataFinal,
    eventId: event.id,
  })

  // ── 2) Carpetas por Event/estudio (IMPL-20260826-06) ─────────────────
  //
  // Estructura del ZIP:
  //   01_Dictamen_General/dictamen-general.pdf
  //   02_Event_<eventShort>/dictamen-<serviceSlug>.txt
  //   02_Event_<eventShort>/fuente-<basename>.<ext>
  //   03_Event_<eventShort>/... (si hay siblings)
  //   manifest.txt
  //
  // Antes (rondas previas): una carpeta por estudio, mezclando studies +
  // labs de un solo Event. Ahora: una carpeta por Event hermano de la
  // cita, con sus estudios y labs adentro. Esto preserva la trazabilidad
  // Event↔estudio que exige BR-20260826-01 y permite que el médico
  // identifique a qué Event pertenece cada hallazgo.
  // ────────────────────────────────────────────────────────────────────────
  type Item = {
    eventId: string
    eventShortId: string
    isCurrent: boolean
    kind: 'STUDY' | 'LAB'
    serviceName: string
    aiPrediction: string | null
    validatorNotes: string | null
    fileUrl: string | null
    slot: string | null
  }

  // Construir la lista plana de items: primero el Event actual, luego
  // los hermanos en orden cronológico. El slot (texto del examen físico)
  // sólo aplica al Event actual (cada Event tiene su propio examen).
  const items: Item[] = [
    ...event.studies.map<Item>((st) => ({
      eventId: event.id,
      eventShortId: atencionEventIds.length > 1
        ? atencionEventIds.indexOf(event.id).toString().padStart(2, '0') +
          '_' +
          event.id.split('-')[0].toUpperCase()
        : event.id.split('-')[0].toUpperCase(),
      isCurrent: true,
      kind: 'STUDY' as const,
      serviceName: st.serviceName,
      aiPrediction: st.aiPrediction,
      validatorNotes: st.validatorNotes ?? null,
      fileUrl: st.fileUrl ?? null,
      slot: pickSlot(physicalExamData, st.serviceName),
    })),
    ...event.labs.map<Item>((lb) => ({
      eventId: event.id,
      eventShortId: event.id.split('-')[0].toUpperCase(),
      isCurrent: true,
      kind: 'LAB' as const,
      serviceName: lb.serviceName,
      aiPrediction: lb.aiPrediction,
      validatorNotes: null,
      fileUrl: lb.fileUrl ?? null,
      slot: pickSlot(physicalExamData, lb.serviceName),
    })),
    ...siblingEventsRaw.flatMap<Item>((sib, idx) => {
      const sibEventShortId =
        (idx + 2).toString().padStart(2, '0') +
        '_' +
        sib.id.split('-')[0].toUpperCase()
      return [
        ...sib.studies.map<Item>((st) => ({
          eventId: sib.id,
          eventShortId: sibEventShortId,
          isCurrent: false,
          kind: 'STUDY' as const,
          serviceName: st.serviceName,
          aiPrediction: st.aiPrediction,
          validatorNotes: st.validatorNotes ?? null,
          fileUrl: st.fileUrl ?? null,
          slot: null, // slot sólo del Event actual; siblings no tienen
        })),
        ...sib.labs.map<Item>((lb) => ({
          eventId: sib.id,
          eventShortId: sibEventShortId,
          isCurrent: false,
          kind: 'LAB' as const,
          serviceName: lb.serviceName,
          aiPrediction: lb.aiPrediction,
          validatorNotes: null,
          fileUrl: lb.fileUrl ?? null,
          slot: null,
        })),
      ]
    }),
  ]

  const entries: ZipEntry[] = []
  const manifestStudies: Array<{
    folder: string
    serviceName: string
    dictamenPath: string
    sourcePath: string
    eventId: string
  }> = []
  const folderMap = new Map<string, number>()
  let studyIndex = 0
  for (const it of items) {
    studyIndex += 1
    const slug = slugify(it.serviceName)
    folderMap.set(slug, (folderMap.get(slug) ?? 0) + 1)
    // IMPL-20260826-06: carpetas por Event. Si el Event actual coincide
    // con la cita y no hay siblings, mantener `02_<serviceName>` para
    // retrocompat con consumers legacy del ZIP.
    const folder =
      atencionEventIds.length > 1
        ? `${studyIndex.toString().padStart(2, '0')}_Event_${it.eventShortId}`
        : folderName(studyIndex, it.serviceName)
    const dictamenPath = `${folder}/dictamen-${slug}.txt`
    const dictamenText = buildStudyDictamenText({
      serviceName: it.serviceName,
      kind: it.kind,
      slot: it.slot,
      aiPrediction: it.aiPrediction,
      validatorNotes: it.validatorNotes,
    })
    entries.push({
      path: dictamenPath,
      data: new TextEncoder().encode(dictamenText),
    })

    // Fuente original: intentar leer vía backend `/api/files/{key}`,
    // si no → placeholder. IMPL-20260826-05 — sin filesystem Vercel.
    const sourcePath = `${folder}/fuente-${slug}${sourceExt(it.fileUrl)}`
    const sourceBytes = await tryReadSourceFromBackend(it.fileUrl)
    if (sourceBytes) {
      entries.push({ path: sourcePath, data: sourceBytes })
      manifestStudies.push({
        folder,
        serviceName: it.serviceName,
        dictamenPath,
        sourcePath,
        eventId: it.eventId,
      })
    } else {
      // NO inventar: dejar un placeholder textual legible.
      const placeholder = `# Fuente original NO_DISPONIBLE\n\n` +
        `Service: ${it.serviceName}\n` +
        `Tipo:    ${it.kind === 'LAB' ? 'Laboratorio' : 'Estudio paraclínico'}\n` +
        `Event:   ${it.eventId}\n` +
        `Path en BD: ${it.fileUrl ?? '(sin fileUrl)'}\n` +
        `Fecha de generación: ${new Date().toISOString()}\n\n` +
        `Razón: el archivo no se encontró en disco o no se subió.\n`
      entries.push({
        path: sourcePath,
        data: new TextEncoder().encode(placeholder),
      })
      manifestStudies.push({
        folder,
        serviceName: it.serviceName,
        dictamenPath,
        sourcePath: `${folder}/fuente-${slug}.txt (NO_DISPONIBLE)`,
        eventId: it.eventId,
      })
    }
  }

  // ── 3) Dictamen general ────────────────────────────────────────────────
  const dictamenGeneralPath = '01_Dictamen_General/dictamen-general.pdf'
  entries.unshift({
    path: dictamenGeneralPath,
    data: new Uint8Array(result.buffer),
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

/** Extensión probable basada en fileUrl. */
function sourceExt(fileUrl: string | null | undefined): string {
  if (!fileUrl) return '.bin'
  const base = fileUrl.split('/').pop() ?? fileUrl
  const dot = base.lastIndexOf('.')
  if (dot <= 0 || dot >= base.length - 1) return '.bin'
  const ext = base.slice(dot).toLowerCase()
  // Whitelist conservadora: sólo extensiones esperadas para fuentes
  // clínicas (PDF/imagen). Si no, marcar como .bin para evitar
  // ambigüedad en el manifest.
  if (['.pdf', '.png', '.jpg', '.jpeg', '.tif', '.tiff', '.xml'].includes(ext)) {
    return ext
  }
  return '.bin'
}

/**
 * IMPL-20260826-05 (FIX ZIP cierre clínico):
 * Resuelve un `fileUrl` (lo que viene persistido en `eventTest.fileUrl`)
 * a una URL absoluta del backend oficial `/api/files/{key}`.
 *
 * Acepta y normaliza:
 *   - `"/api/files/foo.pdf"`         → "<base>/api/files/foo.pdf"
 *   - `"/uploads/foo.pdf"`           → "<base>/api/files/foo.pdf" (legacy)
 *   - `"foo.pdf"`                    → "<base>/api/files/foo.pdf"
 *   - `"subdir/foo.pdf"`             → "<base>/api/files/subdir/foo.pdf"
 *
 * Rechaza (devuelve `null`):
 *   - URLs con esquema (`http://`, `https://`, `s3://`, etc.) — defensa SSRF.
 *     Las presigned URLs ya consumidas no deben re-fetche-arse.
 *   - Paths con `..` (path traversal).
 *   - `null`/`undefined`/string vacío.
 *   - Otros paths absolutos que no reconocemos (defensa).
 *
 * @param fileUrl   Valor de `eventTest.fileUrl` (o equivalente).
 * @param baseUrl   URL base del backend (sin trailing slash). Por defecto
 *                 `dictamenBackendUrl()` (lee `NEXT_PUBLIC_API_URL`).
 * @returns URL absoluta segura para `fetch`, o `null` si es inválida.
 */
export function resolveBackendFileUrl(
  fileUrl: string | null | undefined,
  baseUrl: string = dictamenBackendUrl(),
): string | null {
  if (!fileUrl || typeof fileUrl !== 'string') return null
  const trimmed = fileUrl.trim()
  if (trimmed.length === 0) return null

  // Defensa SSRF: rechazar cualquier URL con esquema (incluye presigned
  // S3 ya usadas — no se re-fetche-an). Sólo construimos paths relativos.
  if (/^[a-z][a-z0-9+.-]*:/i.test(trimmed)) return null
  // Defensa path traversal.
  if (trimmed.includes('..')) return null

  // baseUrl puede traer trailing slash; normalizamos.
  const base = baseUrl.replace(/\/+$/, '')

  if (trimmed.startsWith('/api/files/')) {
    return `${base}${trimmed}`
  }
  if (trimmed.startsWith('/uploads/')) {
    const key = trimmed.slice('/uploads/'.length)
    return `${base}/api/files/${key}`
  }
  if (trimmed.startsWith('/')) {
    // Otro path absoluto no reconocido — rechazar defensa.
    return null
  }
  // Path relativo: tratarlo como key.
  return `${base}/api/files/${trimmed}`
}

/**
 * IMPL-20260826-05 (FIX ZIP cierre clínico):
 * Lee los bytes de una fuente desde el backend oficial `/api/files/{key}`
 * vía HTTP. Reemplaza la versión anterior que leía de filesystem
 * local (`<repo>/uploads/`), la cual falla en Vercel (no comparte
 * FS con Railway/S3).
 *
 * Devuelve `null` si:
 *   - `fileUrl` es inválido (`resolveBackendFileUrl` lo rechaza).
 *   - El backend responde 4xx/5xx (incluyendo 404 NoSuchKey).
 *   - La red falla o el body no se puede leer.
 *
 * NO loguea URLs presigned ni keys; sólo registra `null` en el manifest
 * para que el médico sepa que la fuente no se pudo recuperar.
 *
 * @param fileUrl   `eventTest.fileUrl`.
 * @param baseUrl   URL base del backend. Por defecto `dictamenBackendUrl()`.
 * @param fetchImpl Override para tests (inyección de dependencia). Por
 *                  defecto `globalThis.fetch` (runtime estándar).
 */
export async function tryReadSourceFromBackend(
  fileUrl: string | null | undefined,
  baseUrl: string = dictamenBackendUrl(),
  fetchImpl: typeof fetch = (...args) => globalThis.fetch(...args),
): Promise<Uint8Array | null> {
  const url = resolveBackendFileUrl(fileUrl, baseUrl)
  if (!url) return null
  try {
    const res = await fetchImpl(url, { cache: 'no-store' })
    if (!res.ok) return null
    const buf = await res.arrayBuffer()
    return new Uint8Array(buf)
  } catch {
    return null
  }
}

/** Lee una key del `extractedData` IA. */
function pickIaField(
  ia:
    | {
        aiPrediction: string | null
        extractedData: unknown
      }
    | null,
  keys: ReadonlyArray<string>,
): string | null {
  if (!ia || !ia.extractedData || typeof ia.extractedData !== 'object') {
    return null
  }
  const obj = ia.extractedData as Record<string, unknown>
  for (const k of keys) {
    const v = obj[k]
    if (typeof v === 'string' && v.trim().length > 0) return v.trim()
  }
  return null
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