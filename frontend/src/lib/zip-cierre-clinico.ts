/**
 * @fileoverview Constructor del ZIP de cierre clínico por Event.
 *
 *   Ensambla un ZIP en memoria con:
 *     - `01_Dictamen_General/dictamen-general.pdf` ← ExamenMedicoValidatedPDF.
 *     - Una carpeta por estudio aplicable con:
 *         · `dictamen-<slug>.txt` ← texto estructurado (slot + IA + fuente).
 *         · `fuente-<basename>` ← archivo fuente original desde disco si existe.
 *     - `manifest.txt` con Event, archivos incluidos y fuentes ausentes.
 *
 *   El dictamen general se reutiliza desde `generateExamenMedicoValidatedPdf`
 *   (FEATURE-20260825-03). Las fuentes se leen desde `uploads/<fileUrl>` con
 *   la misma convención que el resto del repo (paridad con
 *   `/api/pdf/examen-medico/[eventId]`).
 *
 * @id IMPL-FEATURE-20260825-04
 * @backup context/SPECs/SPEC-FEATURE-20260825-04-ZIP-CIERRE-CLINICO.md
 *
 * Reglas (SPEC §Reglas):
 *   - Todos los datos se resuelven por `eventId` (no mezclar Event/paciente).
 *   - Fuente ausente: manifestar `NO_DISPONIBLE`, no inventar.
 *   - Reutiliza helpers/rutas existentes; sin almacenamiento persistente nuevo.
 *   - Manifest siempre presente, aunque falten todas las fuentes.
 */
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import prisma from '@/lib/prisma'
import { buildZip, type ZipEntry } from '@/lib/zip-store'
import {
  generateExamenMedicoValidatedPdf,
  buildExamenMedicoPdfData,
} from '@/lib/examen-medico-pdf'

const REPO_UPLOAD_DIR = path.join(process.cwd(), '..', 'uploads')

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
    !validator.fullName ||
    !validator.professionalLicense ||
    !validator.signatureImageUrl
  ) {
    throw new CierreClinicoError('validator_identity_incomplete', 410)
  }

  const data = buildExamenMedicoPdfData({
    folio: event.verdict.id,
    signedAt: event.verdict.signedAt,
    status: 'SIGNED',
    worker: {
      firstName: event.worker.firstName ?? '',
      lastName: event.worker.lastName ?? '',
      universalId: event.worker.universalId ?? '',
      dob: event.worker.dob ?? null,
      sexo: s(physicalExamData.sexo ?? dp.sexo),
      identidadGenero: s(
        physicalExamData.identidad_genero ?? dp.identidad_genero,
      ),
      empresa: event.worker.company?.name ?? null,
      puesto: s(dp.puesto_actual),
      area: s(dp.area_departamento),
      tipoExamen: s(physicalExamData.tipo_examen),
      direccion: s(dp.direccion),
      estadoCivil: s(dp.estado_civil),
      escolaridad: s(dp.escolaridad),
      tipoSanguineo: s(apnp.grupo_y_rh),
    },
    ahf: {
      diabetes: s(ahf.diabetes),
      hipertension: s(ahf.has ?? ahf.hipertension),
      epilepsia: s(ahf.epilepsia),
      cardiopatia: s(ahf.cardiopatia),
      renales: s(ahf.renales),
      asma: s(ahf.asma),
      cancer: s(ahf.cancer),
      mentales: s(ahf.mentales),
      otras:
        s(ahf.otras) || s(ahf.otras_especifique)
          ? `${s(ahf.otras)}${s(ahf.otras_especifique) ? ` (${s(ahf.otras_especifique)})` : ''}`
          : null,
    },
    apnp: {
      alcohol: s(apnp.alcohol),
      tabaco: s(apnp.tabaco),
      drogas: s(apnp.drogas_estimulantes),
      ejercicio: s(apnp.ejercicio),
      alimentacion: s(apnp.alimentacion),
      tatuajes: s(apnp.tatuajes),
    },
    historiaOcupacional: {
      empresa: event.worker.company?.name ?? null,
      puesto: s(dp.puesto_actual),
      area: s(dp.area_departamento),
      narrativa: null,
      riesgos: null,
      epp: null,
    },
    app: { texto: appTexto },
    historiaGineco: null,
    inmunizaciones: null,
    somatometria: {
      peso: numOrStr(somatometry.peso_kg ?? vitalSigns.peso_kg),
      talla: numOrStr(somatometry.talla_m ?? vitalSigns.talla_m),
      imc: numOrStr(somatometry.imc ?? vitalSigns.imc),
      cintura: numOrStr(
        somatometry.perimetro_cintura ?? vitalSigns.perimetro_cintura,
      ),
      cadera: numOrStr(
        somatometry.perimetro_cadera ?? vitalSigns.perimetro_cadera,
      ),
      ta,
      fc: numOrStr(somatometry.fc_min ?? vitalSigns.fc_min),
      fr: numOrStr(somatometry.fr_min ?? vitalSigns.fr_min),
      temperatura: numOrStr(somatometry.temperatura ?? vitalSigns.temperatura),
    },
    agudezaVisual: {
      visionLejanaOD: s(eyeAcuity.vision_lejana_od),
      visionLejanaOI: s(eyeAcuity.vision_lejana_oi),
      visionCercanaOD: s(eyeAcuity.vision_cercana_od),
      visionCercanaOI: s(eyeAcuity.vision_cercana_oi),
      lejanaCorregidaOD: s(eyeAcuity.lejana_corregida_od),
      lejanaCorregidaOI: s(eyeAcuity.lejana_corregida_oi),
      cercanaCorregidaOD: s(eyeAcuity.cercana_corregida_od),
      cercanaCorregidaOI: s(eyeAcuity.cercana_corregida_oi),
      reflejos: s(eyeAcuity.reflejos),
      ishihara: s(eyeAcuity.test_ishihara),
      campimetria: s(eyeAcuity.campimetria),
    },
    exploracion: {
      neurologico: s(physicalExamData.neurologico),
      cabeza: s(physicalExamData.cabeza),
      piel_y_faneras: s(physicalExamData.piel_y_faneras),
      oidos_cad: s(physicalExamData.oidos_cad),
      oidos_cai: s(physicalExamData.oidos_cai),
      ojos: s(physicalExamData.ojos),
      boca_estado: s(physicalExamData.boca_estado),
      boca_alineacion: s(physicalExamData.boca_alineacion),
      nariz: s(physicalExamData.nariz),
      faringe: s(physicalExamData.faringe),
      cuello: s(physicalExamData.cuello),
      torax: s(physicalExamData.torax),
      corazon: s(physicalExamData.corazon),
      campos_pulmonares: s(physicalExamData.campos_pulmonares),
      abdomen: s(physicalExamData.abdomen),
      genitourinario: s(physicalExamData.genitourinario),
      columna_vertebral: s(physicalExamData.columna_vertebral),
      test_adam: s(physicalExamData.test_adam),
      ms_superiores: s(physicalExamData.ms_superiores),
      fuerza_muscular_daniels_sup: s(
        physicalExamData.fuerza_muscular_daniels_sup,
      ),
      ms_inferiores: s(physicalExamData.ms_inferiores),
      fuerza_muscular_daniels_inf: s(
        physicalExamData.fuerza_muscular_daniels_inf,
      ),
      circulacion_venosa: s(physicalExamData.circulacion_venosa),
      arco_de_movilidad: s(physicalExamData.arco_de_movilidad),
      tono_muscular: s(physicalExamData.tono_muscular),
      coordinacion: s(physicalExamData.coordinacion),
      test_romberg: s(physicalExamData.test_romberg),
      signo_bragard: s(physicalExamData.signo_bragard),
      prueba_finkelstein: s(physicalExamData.prueba_finkelstein),
      signo_tinel: s(physicalExamData.signo_tinel),
      prueba_phanel: s(physicalExamData.prueba_phanel),
      prueba_lasegue: s(physicalExamData.prueba_lasegue),
      presencia_quiste_sinovial: s(
        physicalExamData.presencia_quiste_sinovial,
      ),
    },
    impresionDiagnostica: s(event.verdict.finalDiagnosis),
    aptitud,
    restricciones: s(physicalExamData.restricciones),
    observacionesFinales: s(physicalExamData.observaciones_finales),
    notaCondicionamiento: null,
    medico: {
      fullName: validator.fullName,
      professionalLicense: validator.professionalLicense,
      signatureImageUrl: validator.signatureImageUrl,
    },
    slots: {
      audiometria: s(physicalExamData.audiometria_texto),
      espirometria: s(physicalExamData.espirometria_texto),
      laboratorios: s(physicalExamData.laboratorios_texto),
      radiografia: s(physicalExamData.radiografia_texto),
      examenMedico: s(physicalExamData.examen_medico_texto),
    },
    ia: {
      audiometriaClasificacion:
        pickIaField(audioIa, ['clasificacion', 'classification']) ??
        s(audioIa?.aiPrediction) ??
        null,
      espirometriaPatron:
        pickIaField(espiroIa, ['patron', 'pattern']) ??
        s(espiroIa?.aiPrediction) ??
        null,
      radiografiaHallazgo:
        pickIaField(radioIa, ['hallazgo', 'finding']) ??
        s(radioIa?.aiPrediction) ??
        null,
      laboratorioOutOfRange: null,
    },
    logoDataUrl: null,
  })

  const recomendacionesPersisted = s(event.verdict.recommendations)
  if (recomendacionesPersisted) {
    data.recomendaciones = recomendacionesPersisted
      .split(/\s*\d+\.\-\s+/)
      .map((r) => r.trim())
      .filter((r) => r.length > 0)
  }

  const result = await generateExamenMedicoValidatedPdf({
    data,
    eventId: event.id,
  })

  // ── 2) Carpetas por estudio (estudios + labs) ──────────────────────────
  type Item = {
    kind: 'STUDY' | 'LAB'
    serviceName: string
    aiPrediction: string | null
    validatorNotes: string | null
    fileUrl: string | null
    slot: string | null
  }

  const items: Item[] = [
    ...event.studies.map<Item>((st) => ({
      kind: 'STUDY' as const,
      serviceName: st.serviceName,
      aiPrediction: st.aiPrediction,
      validatorNotes: st.validatorNotes ?? null,
      fileUrl: st.fileUrl ?? null,
      slot: pickSlot(physicalExamData, st.serviceName),
    })),
    ...event.labs.map<Item>((lb) => ({
      kind: 'LAB' as const,
      serviceName: lb.serviceName,
      aiPrediction: lb.aiPrediction,
      validatorNotes: null,
      fileUrl: lb.fileUrl ?? null,
      slot: pickSlot(physicalExamData, lb.serviceName),
    })),
  ]

  const entries: ZipEntry[] = []
  const manifestStudies: Array<{
    folder: string
    serviceName: string
    dictamenPath: string
    sourcePath: string
  }> = []
  const folderMap = new Map<string, number>()
  let studyIndex = 0
  for (const it of items) {
    studyIndex += 1
    const slug = slugify(it.serviceName)
    folderMap.set(slug, (folderMap.get(slug) ?? 0) + 1)
    const folder = folderName(studyIndex, it.serviceName)
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

    // Fuente original: intentar leer desde disco, si no → placeholder.
    const sourcePath = `${folder}/fuente-${slug}${sourceExt(it.fileUrl)}`
    const sourceBytes = await tryReadSource(it.fileUrl)
    if (sourceBytes) {
      entries.push({ path: sourcePath, data: sourceBytes })
      manifestStudies.push({
        folder,
        serviceName: it.serviceName,
        dictamenPath,
        sourcePath,
      })
    } else {
      // NO inventar: dejar un placeholder textual legible.
      const placeholder = `# Fuente original NO_DISPONIBLE\n\n` +
        `Service: ${it.serviceName}\n` +
        `Tipo:    ${it.kind === 'LAB' ? 'Laboratorio' : 'Estudio paraclínico'}\n` +
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

/** Lee un archivo desde `uploads/<fileUrl>`. Si no existe, devuelve null. */
async function tryReadSource(
  fileUrl: string | null | undefined,
): Promise<Uint8Array | null> {
  if (!fileUrl) return null
  // Defensa: nunca aceptar paths absolutos ni con traversal.
  if (fileUrl.startsWith('/') || fileUrl.includes('..')) return null
  const filePath = path.join(REPO_UPLOAD_DIR, fileUrl)
  try {
    const buf = await readFile(filePath)
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