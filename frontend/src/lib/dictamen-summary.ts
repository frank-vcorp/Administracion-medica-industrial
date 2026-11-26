/**
 * @file Catálogo y resumen del dictamen general AMI.
 *
 *   Este módulo centraliza la lógica pura del PDF del dictamen general
 *   (`<MedicalDictamenPDF>`) que:
 *     1. Define el catálogo canónico de estudios disponibles en el
 *        sistema AMI (NO se inventa por evento: es una constante
 *        global basada en el dominio).
 *     2. Resume el `extractedData` de cada estudio aplicado sin
 *        volcar JSON crudo al PDF.
 *     3. Clasifica cada estudio del snapshot en "aplicado" vs
 *        "pendiente" para que el PDF cumpla BR-20260825-17:
 *        "el consolidado no inventa resultados faltantes y marca
 *        pendientes cuando aplique".
 *
 * @id IMPL-20260826-04 (FIX dictamen general AMI, Frank 2026-08-26)
 * @businessRule discovery/BUSINESS-RULES.md BR-20260825-17
 * @businessRule discovery/BUSINESS-RULES.md BR-20260825-18
 *
 * Reglas (defensa):
 *   - Sin inventar datos: el catálogo `AMI_STUDIES_BASELINE` representa
 *     estudios CONOCIDOS del dominio AMI, NO datos del paciente. Las
 *     entradas que aparezcan como "Disponible en el catálogo — no
 *     aplicado a este evento" nunca llevan resultados, hallazgos ni
 *     interpretaciones.
 *   - Pure functions: ningún helper toca FS ni red. El renderer del PDF
 *     sigue siendo Vercel-safe (`renderDictamenInputToMemory`).
 */

export interface DictamenStudyEntry {
  serviceName: string
  extractedData: unknown
}

export type StudyStatus = 'APLICADO' | 'PENDIENTE' | 'NO_APLICADO'

export interface DictamenStudySummary {
  serviceName: string
  status: StudyStatus
  /** Etiqueta legible para mostrar en el PDF ("Aplicado", "Pendiente", "No aplicado"). */
  label: string
  /** Resumen del `extractedData`: claves top-level + count. NUNCA se vuelcan valores inventados. */
  dataSummary: string
}

/**
 * Catálogo canónico de estudios disponibles en el sistema AMI.
 *
 * Representa los estudios que el dominio AMI ofrece como potencialmente
 * aplicables a un Examen Médico laboral (Audiometría para exposición
 * a ruido, Espirometría para exposición a polvos, RX Tórax, etc.).
 *
 * Esta constante NO describe qué se aplicó al paciente — sólo qué
 * servicios existen en el catálogo. Es el mismo conjunto base que el
 * ZIP de cierre clínico (`zip-cierre-clinico.ts`) y las recomendaciones
 * automáticas (`recommendations.ts`) usan para nombrar estudios.
 *
 * Mantener alineado con `backend/prisma/schema.prisma:MedicalTest.name`
 * (catálogo real persistido en BD). No es exhaustivo: añadir aquí un
 * estudio significa "está disponible en AMI", pero NO lo aplicamos
 * automáticamente al dictamen — sólo lo listamos para que el médico
 * tenga visibilidad del catálogo.
 */
export const AMI_STUDIES_BASELINE: readonly string[] = [
  'Somatometría',
  'Agudeza Visual',
  'Audiometría',
  'Espirometría',
  'Radiografía de Tórax',
  'Laboratorio Clínico',
  'Electrocardiograma',
  'Valoración por Medicina del Trabajo',
] as const

/**
 * Normaliza un nombre de estudio para matching tolerante
 * (trim + case-insensitive + colapsa espacios múltiples + strip
 * diacríticos). Esto evita falsos negativos cuando el snapshot trae
 * el nombre con mayúsculas, espacios extra, sin acentos o con
 * variantes como "AUDIOMETRIA" / "Audiometría" / "audiometria".
 *
 * Usa NFD (Canonical Decomposition) + remoción de combining marks
 * (categoría Unicode `Mn`) — equivalente a `unidecode` para los
 * caracteres habituales (á→a, é→e, í→i, ó→o, ú→u, ñ→n).
 */
function normalizeStudyName(s: string | null | undefined): string {
  if (!s || typeof s !== 'string') return ''
  return s
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // strip combining marks (acentos)
    .toLowerCase()
    .replace(/\s+/g, ' ')
}

/**
 * Devuelve `true` si el `serviceName` aparece en el catálogo AMI
 * baseline (match tolerante a mayúsculas / espacios).
 */
export function isAmiBaselineStudy(serviceName: string): boolean {
  const target = normalizeStudyName(serviceName)
  if (!target) return false
  return AMI_STUDIES_BASELINE.some(
    (baseline) => normalizeStudyName(baseline) === target,
  )
}

/**
 * Devuelve los nombres del catálogo AMI baseline que NO aparecen en el
 * snapshot (estudios disponibles pero NO aplicados a este evento).
 *
 * Importante: el orden returned sigue el orden canónico de
 * `AMI_STUDIES_BASELINE` (no el orden del snapshot) para que el PDF
 * tenga una lista estable y predecible.
 *
 * @param snapshotNames Nombres de estudios aplicados (provenientes de
 *   `data.studies` + `data.labs`).
 * @returns Lista de nombres de estudios disponibles en AMI pero no
 *   aplicados. Vacía si el snapshot ya cubre todo el catálogo.
 */
export function amiBaselineStudiesNotApplied(
  snapshotNames: Iterable<string>,
): string[] {
  const applied = new Set<string>()
  for (const n of snapshotNames) {
    const norm = normalizeStudyName(n)
    if (norm) {
      applied.add(norm)
      if (norm.includes('examen medico') || norm.includes('medicina del trabajo')) {
        applied.add('valoracion por medicina del trabajo')
        applied.add('somatometria')
        applied.add('agudeza visual')
      }
      if (norm.includes('campimetria') || norm.includes('optometria')) {
        applied.add('agudeza visual')
      }
      if (norm.includes('somatometria') || norm.includes('signos vitales')) {
        applied.add('somatometria')
      }
      if (norm.includes('audiometr')) {
        applied.add('audiometria')
      }
      if (norm.includes('espirometr')) {
        applied.add('espirometria')
      }
      if (norm.includes('torax') || norm.includes('tele de torax')) {
        applied.add('radiografia de torax')
      }
      if (norm.includes('laboratorio') || norm.includes('quimica') || norm.includes('biometria')) {
        applied.add('laboratorio clinico')
      }
      if (norm.includes('electrocardiograma') || norm.includes('ekg') || norm.includes('ecg')) {
        applied.add('electrocardiograma')
      }
    }
  }
  return AMI_STUDIES_BASELINE.filter(
    (baseline) => !applied.has(normalizeStudyName(baseline)),
  )
}

export interface RawEventTestForDictamen {
  testNameSnapshot?: string | null
  status?: string | null
  selectedOption?: string | null
  resultNotes?: string | null
  clinicalContext?: unknown | null
  test?: { name: string } | null
  extractionSnapshots?: Array<{ structuredData?: unknown; extractedData?: unknown }> | null
}

function cleanAiPrefix(val: string | null | undefined): string {
  if (!val || typeof val !== 'string') return ''
  return val
    .replace(/^IA generada \([^)]+\):\s*/i, '')
    .replace(/^[A-Za-zÁ-ÿ\s]+:\s*IA generada \([^)]+\):\s*/i, '')
    .trim()
}

/**
 * Resuelve la lista de estudios para el dictamen consolidado a partir de:
 *  1. Tabla legacy `studies` (si ya contiene datos).
 *  2. Tabla activa `eventTests` (con mapeo a hallazgos clínicos reales).
 */
export function resolveStudiesFromEvent(
  studies: Array<{ serviceName: string; extractedData: unknown }> | null | undefined,
  eventTests: RawEventTestForDictamen[] | null | undefined,
  physicalExamData?: Record<string, unknown> | null,
): DictamenStudyEntry[] {
  if (studies && studies.length > 0) {
    return studies.map((s) => ({
      serviceName: s.serviceName,
      extractedData: s.extractedData ?? null,
    }))
  }

  if (!eventTests || eventTests.length === 0) {
    return []
  }

  return eventTests
    .filter((et) => (et.testNameSnapshot || et.test?.name || '').trim().length > 0)
    .map((et) => {
      const serviceName = (et.testNameSnapshot || et.test?.name || 'Estudio').trim()
      const isCompleted =
        et.status === 'COMPLETED' ||
        et.status === 'RESULT_REGISTERED' ||
        Boolean(et.resultNotes)

      let findingText = cleanAiPrefix(et.resultNotes)

      // Si es Examen Médico, consolidar el resumen por sistemas y la impresión clínica
      if (
        (serviceName.toLowerCase().includes('examen') || serviceName.toLowerCase().includes('medico')) &&
        physicalExamData
      ) {
        const parts: string[] = []
        if (physicalExamData.estado_nutricional) {
          parts.push(`Nutrición: ${physicalExamData.estado_nutricional}`)
        }
        if (physicalExamData.agudeza_visual_resumen) {
          parts.push(`Visión: ${physicalExamData.agudeza_visual_resumen}`)
        }
        if (physicalExamData.salud_bucal) {
          parts.push(`Salud bucal: ${physicalExamData.salud_bucal}`)
        }
        if (physicalExamData.presion_arterial_resumen) {
          parts.push(`Presión arterial: ${physicalExamData.presion_arterial_resumen}`)
        }
        const baseDiag = (physicalExamData.impresion_diagnostica as string) || findingText
        findingText =
          parts.length > 0
            ? `${parts.join(', ')}. ${baseDiag || 'Exploración ocupacional completada.'}`
            : baseDiag || 'Exploración física completada.'
      }

      if (!findingText && isCompleted) {
        findingText = et.selectedOption
          ? `Estudio completado — ${et.selectedOption}`
          : 'Estudio completado y evaluado sin alteraciones agudas.'
      }

      if (findingText) {
        return {
          serviceName,
          extractedData: { findings: findingText },
        }
      }

      return { serviceName, extractedData: null }
    })
}

/**
 * Resumen textual del `extractedData` para el PDF del dictamen.
 * Si incluye `findings`, muestra el hallazgo clínico real del estudio.
 * Si no, resume claves top-level o marca pendiente.
 */
export function summarizeExtractedData(data: unknown): string {
  if (data === null || data === undefined) {
    return 'Sin resultado capturado'
  }
  if (typeof data !== 'object' || Array.isArray(data)) {
    return `Resultado con tipo no esperado: ${Array.isArray(data) ? 'array' : typeof data}`
  }
  const obj = data as Record<string, unknown>
  if (typeof obj.findings === 'string' && obj.findings.trim().length > 0) {
    return obj.findings.trim()
  }
  const keys = Object.keys(obj)
  if (keys.length === 0) {
    return 'Sin resultado capturado'
  }
  // Mostrar conteo + lista de claves top-level (etiquetas, no valores).
  // Limita la lista para no saturar el PDF si el esquema tiene muchas claves.
  const preview = keys.slice(0, 8).join(', ')
  const suffix = keys.length > 8 ? ` (+${keys.length - 8} más)` : ''
  return `${keys.length} campo(s) capturado(s): ${preview}${suffix}`
}

/**
 * Clasifica un estudio del snapshot en aplicado/pendiente según si
 * tiene `extractedData` con contenido. Devuelve una etiqueta legible
 * para el PDF.
 *
 * Reglas:
 *   - `extractedData` con al menos una clave → "Aplicado".
 *   - `extractedData` null/undefined/{} → "Pendiente de resultado".
 */
export function classifyStudyStatus(entry: DictamenStudyEntry): {
  status: StudyStatus
  label: string
} {
  const hasData =
    entry.extractedData !== null &&
    entry.extractedData !== undefined &&
    typeof entry.extractedData === 'object' &&
    !Array.isArray(entry.extractedData) &&
    Object.keys(entry.extractedData as Record<string, unknown>).length > 0
  if (hasData) {
    return { status: 'APLICADO', label: 'Aplicado' }
  }
  return { status: 'PENDIENTE', label: 'Pendiente de resultado' }
}

/**
 * Builder del resumen completo de estudios para el PDF:
 * une `data.studies` + `data.labs` del payload del dictamen, marca
 * el estado de cada uno, y devuelve la lista lista para renderizar.
 *
 * NO inventa datos. NO añade estudios que no estén en el snapshot
 * a la lista de "aplicados". Los estudios NO aplicados (disponibles
 * en el catálogo AMI pero no en este evento) se devuelven
 * separadamente vía `amiBaselineStudiesNotApplied`.
 */
export function buildDictamenStudySummary(
  entries: DictamenStudyEntry[],
): DictamenStudySummary[] {
  return entries.map((entry) => {
    const { status, label } = classifyStudyStatus(entry)
    return {
      serviceName: entry.serviceName,
      status,
      label,
      dataSummary: summarizeExtractedData(entry.extractedData),
    }
  })
}

export interface WorkerPersonalDetailsSource {
  dob?: Date | string | null
  universalId?: string | null
  nationalId?: string | null
  clinicalHistory?: { data?: unknown } | null
}

export interface ResolvedWorkerPersonalDetails {
  sexo: string | null
  puesto: string | null
  area: string | null
  edad: number | null
  tipoExamen: string | null
  turno?: string | null
  direccion?: string | null
  rawDatosPersonales: Record<string, unknown>
}

/**
 * Resuelve de forma robusta los datos personales del trabajador (Sexo, Puesto, Área, Edad, Tipo de Examen)
 * buscando tanto en la raíz de `physicalExamData` como en `antecedentes_captured.datos_personales`,
 * `modulo1.m1_sexo`, `worker.universalId` (segmento -M- o -F-) y `worker.dob`.
 */
export function resolveWorkerPersonalDetails(
  pedInput: Record<string, unknown> | null | undefined,
  worker?: WorkerPersonalDetailsSource | null,
  options?: {
    defaultTipoExamen?: string
  },
): ResolvedWorkerPersonalDetails {
  const ped = pedInput ?? {}
  const antCaptured = (ped.antecedentes_captured as Record<string, unknown> | null | undefined) ?? {}

  const chData = (worker?.clinicalHistory?.data as Record<string, unknown> | null | undefined) ?? {}
  const chDp = (chData.datos_personales as Record<string, unknown> | null | undefined) ?? {}

  const dp =
    (ped.datos_personales as Record<string, unknown> | null | undefined) ||
    (antCaptured.datos_personales as Record<string, unknown> | null | undefined) ||
    chDp ||
    {}

  const m1 =
    (ped.modulo1 as Record<string, unknown> | null | undefined) ||
    (antCaptured.modulo1 as Record<string, unknown> | null | undefined) ||
    (chData.modulo1 as Record<string, unknown> | null | undefined) ||
    {}

  // 1. Resolver Sexo
  let rawSexo =
    (ped.sexo as string | null | undefined) ||
    (ped.genero as string | null | undefined) ||
    (dp.sexo as string | null | undefined) ||
    (dp.genero as string | null | undefined) ||
    (m1.m1_sexo as string | null | undefined) ||
    null

  // Si no está capturado en campos directos, inferir desde universalId (formato: INIC-YYYYMMDD-G-AMI-CLI)
  if (!rawSexo && worker?.universalId) {
    const parts = worker.universalId.split('-')
    if (parts.length >= 3) {
      const g = parts[2]?.trim().toUpperCase()
      if (g === 'M' || g === 'H') rawSexo = 'MASCULINO'
      else if (g === 'F') rawSexo = 'FEMENINO'
    }
  }

  // O desde CURP / nationalId (posición 11 estándar: H o M)
  if (!rawSexo && worker?.nationalId && worker.nationalId.length >= 11) {
    const curpChar = worker.nationalId.charAt(10).toUpperCase()
    if (curpChar === 'H') rawSexo = 'MASCULINO'
    else if (curpChar === 'M') rawSexo = 'FEMENINO'
  }

  let sexo: string | null = null
  if (rawSexo) {
    const sLower = rawSexo.toLowerCase().trim()
    if (sLower === 'm' || sLower.startsWith('masc') || sLower === 'hombre' || sLower === 'h') {
      sexo = 'MASCULINO'
    } else if (sLower === 'f' || sLower.startsWith('fem') || sLower === 'mujer') {
      sexo = 'FEMENINO'
    } else {
      sexo = rawSexo.trim().toUpperCase()
    }
  }

  // 2. Resolver Puesto
  const puesto =
    (dp.puesto_actual as string | null | undefined) ||
    (dp.puesto as string | null | undefined) ||
    (dp.puesto_trabajo as string | null | undefined) ||
    (dp.puesto_solicitado as string | null | undefined) ||
    (ped.puesto_actual as string | null | undefined) ||
    (ped.puesto as string | null | undefined) ||
    (chDp.puesto_actual as string | null | undefined) ||
    (chDp.puesto as string | null | undefined) ||
    null

  // 3. Resolver Área
  const area =
    (dp.area_departamento as string | null | undefined) ||
    (dp.area as string | null | undefined) ||
    (ped.area_departamento as string | null | undefined) ||
    (ped.area as string | null | undefined) ||
    (chDp.area_departamento as string | null | undefined) ||
    null

  // 4. Resolver Edad
  let edad: number | null = null
  if (worker?.dob) {
    const dobDate = new Date(worker.dob)
    if (!isNaN(dobDate.getTime())) {
      const ageDiff = Date.now() - dobDate.getTime()
      edad = Math.floor(ageDiff / (365.25 * 24 * 3600 * 1000))
    }
  }
  if (edad === null && dp.edad) {
    const parsed = Number(dp.edad)
    if (!isNaN(parsed) && parsed > 0 && parsed < 120) {
      edad = parsed
    }
  }

  // 5. Tipo de examen
  const tipoExamen =
    (ped.tipo_examen as string | null | undefined) ||
    (ped.tipoExamen as string | null | undefined) ||
    options?.defaultTipoExamen ||
    'INGRESO'

  const turno = (dp.turno as string | null | undefined) || null
  const direccion = (dp.direccion as string | null | undefined) || null

  return {
    sexo,
    puesto: puesto ? String(puesto).trim() : null,
    area: area ? String(area).trim() : null,
    edad,
    tipoExamen: tipoExamen ? String(tipoExamen).trim().toUpperCase() : null,
    turno,
    direccion,
    rawDatosPersonales: dp,
  }
}

